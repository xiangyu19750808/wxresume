import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { parseJD } from './check/parsers/jd.parser.js';
import { parseResumeFromFile, fromPlainText } from './check/parsers/resume.parser.js';
import { ScreeningService } from './check/services/screening.service.js';

import { createUsersRouter } from './modules/users/index.js';
import { createFileRouter } from './modules/file/index.js';
import { createResultsRouter } from './modules/results/index.js';
import { createDiagnoseRouter } from './analysis/index.js';
import { reqid } from './middlewares/reqid.js';
import jwtMiddleware from './middlewares/jwt.js';

// 模板/渲染工具
import {
  listTemplates,
  describeFontSetup,
  renderResumeHTML,
} from './render.template.js';
import { htmlToPDFBuffer } from './render.playwright.js';

// WXPay 适配（mock）
import {
  refund as requestWxpayRefund,
  verifyCallback as verifyWxpayCallback,
} from '../../../packages/adapters/wxpay/src/index.js';

// Prisma（/v1/db/ping、/v1/results/save 会使用）
import { prisma } from './db.js';

// -------------------------------
// 模板与样例简历、字体探测
// -------------------------------
const APP_CWD = process.cwd();
const REPO_ROOT = (() => {
  const candidate = path.resolve(APP_CWD, '../../');
  if (fs.existsSync(path.join(candidate, 'data'))) return candidate;
  return APP_CWD;
})();
const UPLOAD_DIR = path.join(REPO_ROOT, 'tmp', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const multerPromise = import('multer')
  .then((m) => m.default || m)
  .then((multer) => multer({ dest: UPLOAD_DIR }))
  .catch((err) => {
    console.warn('[check] multer unavailable, file upload fallback to JSON only', err?.message || err);
    return null;
  });
let uploadResumeMiddleware = (req, res, next) => next();
multerPromise.then((instance) => {
  if (instance) uploadResumeMiddleware = instance.single('resumeFile');
});
const screeningService = new ScreeningService();
const SAMPLE_RESUME_PATH = path.join(REPO_ROOT, 'samples/resume/alice.json');

function loadSampleResume() {
  try {
    return JSON.parse(fs.readFileSync(SAMPLE_RESUME_PATH, 'utf-8'));
  } catch (err) {
    console.warn('[render] failed to load sample resume', err);
    return {};
  }
}

function hasResumeShape(value) {
  if (!value || typeof value !== 'object') return false;
  return (
    Boolean(value.basics) ||
    Boolean(value.work) ||
    Boolean(value.education) ||
    Boolean(value.skills) ||
    Boolean(value.projects)
  );
}

function extractResumeFromBody(body = {}) {
  if (hasResumeShape(body.resume)) return body.resume;
  if (hasResumeShape(body.candidate)) return body.candidate;
  if (hasResumeShape(body.profile)) return body.profile;

  if (hasResumeShape(body)) {
    const { job, jobRequirements, requirements, targetRole, ...rest } = body;
    if (hasResumeShape(rest)) return rest;
    return body;
  }

  return loadSampleResume();
}

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null);
  return [value];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function includesNormalized(target, query) {
  if (!target || !query) return false;
  return normalizeString(target).includes(normalizeString(query));
}

const DEGREE_LEVELS = [
  { level: 5, patterns: [/phd/, /doctor/, /doctorate/, /博士/] },
  { level: 4, patterns: [/master/, /msc/, /ma/, /硕士/] },
  { level: 3, patterns: [/bachelor/, /undergraduate/, /学士/, /本科/] },
  { level: 2, patterns: [/associate/, /专科/, /大专/] },
  { level: 1, patterns: [/high\s*school/, /中专/, /高中/] },
];

function degreeLevelOf(value) {
  if (!value) return 0;
  const normalized = normalizeString(value);
  if (!normalized) return 0;
  for (const item of DEGREE_LEVELS) {
    if (item.patterns.some((re) => re.test(normalized))) return item.level;
  }
  return 0;
}

function highestDegreeEntry(education = []) {
  let highest = null;
  let highestLevel = 0;
  for (const item of education || []) {
    const candidateLevel = degreeLevelOf(item.studyType || item.degree || item.level);
    if (candidateLevel > highestLevel) {
      highestLevel = candidateLevel;
      highest = item;
    }
  }
  return { entry: highest, level: highestLevel };
}

function clampScore(value) {
  const num = Number.isFinite(value) ? value : 0;
  if (Number.isNaN(num)) return 0;
  if (num < 0) return 0;
  if (num > 100) return 100;
  return Math.round(num);
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .match(/\p{L}[\p{L}\d+_-]*/gu)
    ?.map((t) => t.trim())
    .filter(Boolean) || [];
}

function buildFrequencyMap(tokens) {
  const map = new Map();
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const orderStore = new Map();


function normaliseOrderId(value) {
  return String(value || '').trim().toUpperCase();
}

function normaliseTimestamp(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const num = Number.isFinite(value) ? value : Number.NaN;
    if (!Number.isNaN(num)) return new Date(num).toISOString();
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const milliseconds =
        trimmed.length > 11 || Math.abs(numeric) > 1e11 ? numeric : numeric * 1000;
      const fromNumeric = new Date(milliseconds);
      if (!Number.isNaN(fromNumeric.getTime())) return fromNumeric.toISOString();
    }
    const asDate = new Date(trimmed);
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();
    return trimmed;
  }
  return undefined;
}

function getOrderById(outTradeNo) {
  return orderStore.get(normaliseOrderId(outTradeNo));
}

function normaliseCallbackState(callbacks = {}) {
  if (!callbacks || typeof callbacks !== 'object') {
    return { statuses: {} };
  }

  const statuses = {};
  for (const [status, info] of Object.entries(callbacks.statuses || {})) {
    const entry = {
      ...(info && typeof info === 'object' ? info : {}),
    };
    const normalisedLastReceived = normaliseTimestamp(info?.last_received_at);
    if (normalisedLastReceived) {
      entry.last_received_at = normalisedLastReceived;
    } else if (info && Object.prototype.hasOwnProperty.call(info, 'last_received_at')) {
      entry.last_received_at = info.last_received_at;
    }
    statuses[status] = entry;
  }

  const result = {
    statuses,
  };

  if (callbacks.last_result) {
    result.last_result = callbacks.last_result;
  }
  if (callbacks.last_received_at) {
    result.last_received_at = normaliseTimestamp(callbacks.last_received_at);
  }

  return result;
}

function assignDefined(target, source) {
  if (!target) target = {};
  if (!source || typeof source !== 'object') return target;
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
}

function saveOrderRecord(order) {
  if (!order || !order.out_trade_no) return order;
  const key = normaliseOrderId(order.out_trade_no);
  if (!key) return order;

  const previous = orderStore.get(key) || null;
  const merged = assignDefined({ ...(previous || {}) }, order);

  const record = {
    ...merged,
    out_trade_no: key,
    status: merged.status || previous?.status || 'created',
    created_at:
      normaliseTimestamp(order.created_at) ||
      normaliseTimestamp(previous?.created_at) ||
      nowIso(),
    paid_at: normaliseTimestamp(order.paid_at) || normaliseTimestamp(previous?.paid_at),
    callbacks: normaliseCallbackState(order.callbacks || previous?.callbacks),
  };

  if (previous?.plan !== undefined && record.plan === undefined) {
    record.plan = previous.plan;
  }
  if (previous?.amount !== undefined && record.amount === undefined) {
    record.amount = previous.amount;
  }
  if (previous?.prepay_id && !record.prepay_id) {
    record.prepay_id = previous.prepay_id;
  }

  orderStore.set(key, record);
  return record;
}

async function ensureOrderOwner() {
  const fallback = { id: 'order-demo-user' };
  const canUpsert = Boolean(prisma?.user?.upsert);
  if (!canUpsert) return fallback;

  if (!ensureOrderOwner.cache) {
    const id = process.env.ORDER_OWNER_ID || 'order-demo-user';
    const openid = process.env.ORDER_OWNER_OPENID || `order_openid_${id}`;
    ensureOrderOwner.cache = prisma.user
      .upsert({
        where: { id },
        update: {},
        create: { id, openid, nickname: '订单演示用户' },
        select: { id: true },
      })
      .catch((err) => {
        console.error('[order.ensureOwner] failed', err);
        ensureOrderOwner.cache = null;
        return fallback;
      });
  }

  return (await ensureOrderOwner.cache) || fallback;
}

ensureOrderOwner.cache = null;

async function loadOrderFromDb(outTradeNo) {
  const canonical = normaliseOrderId(outTradeNo);
  const canQuery = Boolean(prisma?.order?.findUnique);
  if (!canonical || !canQuery) return null;
  try {
    const record = await prisma.order.findUnique({
      where: { out_trade_no: canonical },
    });
    if (!record) return null;
    const order = {
      out_trade_no: canonical,
      prepay_id: record.wx_prepay_id || record.prepay_id || '',
      status: record.status || 'created',
      plan: record.plan,
      amount: record.amount,
      created_at: normaliseTimestamp(record.created_at) || nowIso(),
      paid_at: normaliseTimestamp(record.paid_at),
      callbacks: { statuses: {} },
    };
    saveOrderRecord(order);
    return order;
  } catch (err) {
    console.error('[order.load] failed', err);
    return null;
  }
}

function serialiseCallbacks(callbacks = {}) {
  const normalised = normaliseCallbackState(callbacks);
  return {
    statuses: normalised.statuses,
    last_result: normalised.last_result,
    last_received_at: normalised.last_received_at,
  };
}

function orderSnapshot(order) {
  if (!order) return null;
  return {
    out_trade_no: order.out_trade_no,
    prepay_id: order.prepay_id,
    status: order.status,
    plan: order.plan,
    amount: order.amount,
    created_at: order.created_at,
    paid_at: order.paid_at,
    callbacks: serialiseCallbacks(order.callbacks),
  };
}

function cosineSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  if (!tokensA.length || !tokensB.length) return 0;

  const mapA = buildFrequencyMap(tokensA);
  const mapB = buildFrequencyMap(tokensB);

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const value of mapA.values()) {
    magnitudeA += value * value;
  }
  for (const value of mapB.values()) {
    magnitudeB += value * value;
  }

  for (const [token, value] of mapA.entries()) {
    if (mapB.has(token)) {
      dot += value * mapB.get(token);
    }
  }

  if (!dot) return 0;
  const denom = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  if (!denom) return 0;
  return dot / denom;
}

function collectStrings(value, acc, depth = 0) {
  if (!value || depth > 6) return;
  if (typeof value === 'string') {
    acc.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, acc, depth + 1);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      collectStrings(value[key], acc, depth + 1);
    }
  }
}

function resumeToPlainText(resume) {
  const acc = [];
  collectStrings(resume, acc);
  return acc.join(' ');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function yearsBetween(start, end) {
  if (!start) return 0;
  const startDate = parseDate(start);
  if (!startDate) return 0;
  const endDate = parseDate(end) || new Date();
  const diffMs = endDate - startDate;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return diffMs / (1000 * 60 * 60 * 24 * 365.25);
}

const LANGUAGE_LEVELS = [
  { value: 7, patterns: [/native/, /mother\s*tongue/, /母语/] },
  { value: 6, patterns: [/c2/] },
  { value: 5, patterns: [/c1/, /tem8/] },
  { value: 4, patterns: [/b2/, /tem7/, /tem-7/] },
  { value: 3, patterns: [/b1/, /cet-6/, /cet6/, /六级/] },
  { value: 2, patterns: [/a2/, /cet-4/, /cet4/, /四级/] },
  { value: 1, patterns: [/a1/] },
];

function languageLevelOf(value) {
  if (!value) return 0;
  const normalized = normalizeString(value);
  if (!normalized) return 0;
  for (const item of LANGUAGE_LEVELS) {
    if (item.patterns.some((pattern) => pattern.test(normalized))) {
      return item.value;
    }
  }
  const numeric = Number.parseFloat(normalized);
  if (Number.isFinite(numeric) && numeric) {
    if (numeric >= 110) return 6;
    if (numeric >= 100) return 5;
    if (numeric >= 90) return 4;
    if (numeric >= 80) return 3;
    if (numeric >= 70) return 2;
    return 1;
  }
  return 0;
}

function weightedScore(components) {
  const valid = components.filter((item) => Number.isFinite(item.score));
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((sum, item) => sum + (item.weight ?? 1), 0) || 1;
  const sum = valid.reduce((acc, item) => acc + (item.score * (item.weight ?? 1)), 0);
  return clampScore(sum / totalWeight);
}

function parseSalaryExpectation(resume) {
  const raw = resume?.salaryExpectation || resume?.expectedSalary || resume?.salary;
  if (!raw) return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { amountAnnual: raw, currency: 'CNY' };
  }

  if (typeof raw === 'string') {
    const match = raw.match(/([\d.]+)/g);
    if (match) {
      const numbers = match.map((item) => Number.parseFloat(item)).filter((n) => Number.isFinite(n));
      if (numbers.length) {
        const base = numbers[numbers.length - 1];
        if (/月|month/i.test(raw)) {
          return { amountAnnual: base * 12, currency: 'CNY' };
        }
        return { amountAnnual: base, currency: 'CNY' };
      }
    }
    return null;
  }

  if (typeof raw === 'object') {
    const currency = (raw.currency || raw.unit || 'CNY').toUpperCase();
    if (Number.isFinite(raw.amountAnnual)) {
      return { amountAnnual: raw.amountAnnual, currency };
    }
    if (Number.isFinite(raw.annual)) {
      return { amountAnnual: raw.annual, currency };
    }
    if (Number.isFinite(raw.amount)) {
      const period = raw.period || raw.cadence || raw.type;
      if (period && /month/i.test(period)) {
        return { amountAnnual: raw.amount * 12, currency };
      }
      return { amountAnnual: raw.amount, currency };
    }
    if (Number.isFinite(raw.amountMonthly)) {
      return { amountAnnual: raw.amountMonthly * 12, currency };
    }
    if (raw.range && Number.isFinite(raw.range.max)) {
      return { amountAnnual: raw.range.max, currency };
    }
  }

  return null;
}

function parseSalaryRange(range) {
  if (!range || typeof range !== 'object') return null;
  const currency = (range.currency || range.unit || 'CNY').toUpperCase();
  const min = Number.isFinite(range.min) ? range.min : Number.isFinite(range.minimum) ? range.minimum : null;
  const max = Number.isFinite(range.max)
    ? range.max
    : Number.isFinite(range.maximum)
    ? range.maximum
    : Number.isFinite(range.ceiling)
    ? range.ceiling
    : null;
  if (min === null && max === null) return null;
  return { min: min ?? max ?? 0, max: max ?? min ?? 0, currency };
}

const fontSetup = describeFontSetup();
if (process.env.NODE_ENV !== 'test') {
  console.log('[templates] fonts dir:', fontSetup.fontsDir);
  const missing = fontSetup.bundled.filter((f) => !f.available).map((f) => f.filename);
  if (missing.length) console.warn('[templates] bundled fonts missing:', missing.join(', '));
  if (fontSetup.systemHints.length) {
    console.log('[templates] detected system fonts:', fontSetup.systemHints.join(', '));
  }
}

// -------------------------------
// 环境检查
// -------------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const message = 'JWT_SECRET environment variable is required';
  console.error(message);
  throw new Error(message);
}

// CORS 白名单（逗号分隔）
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// -------------------------------
// 初始化应用 & 中间件顺序
// -------------------------------
const app = express();

// 允许直接访问 files 目录
const filesDirectory = path.join('C:', 'Users', 'pc', 'wxresume', 'files');  // 使用绝对路径
console.log("Static files directory:", filesDirectory);  // 打印静态文件目录
app.use('/files', express.static(filesDirectory, { 
  fallthrough: false,  // 如果文件不存在，直接返回 404 错误
  dotfiles: 'deny'     // 禁止访问以 "." 开头的文件
}));

// 根路径路由
app.get('/', (req, res) => {
  res.send('API is running');
});

// 中间件顺序：reqid -> 解析体 -> 安全头 -> CORS -> 路由
app.use(reqid());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// 最小 CORS 白名单控制（含预检）
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ code: 403, msg: 'forbidden' });
  }

  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');

  const requestHeaders = req.headers['access-control-request-headers'];
  res.header(
    'Access-Control-Allow-Headers',
    requestHeaders ? String(requestHeaders) : 'Authorization,Content-Type'
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// -------------------------------
// 先声明需要优先匹配的路由（防止被 /v1/results/:rid 抢占）
// -------------------------------

// 从 DB 拉取结果列表（按 user_id）
app.get('/v1/results/db', async (req, res) => {
  try {
    const user_id = String(req.query.user_id || 'demo'); // 默认 demo
    const rows = await prisma.result.findMany({
      where: { user_id },
      orderBy: { created_at: 'desc' },
    });
    res.json({ code: 0, data: rows });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'db error' });
  }
});
// -------------------------------
// 新增 /v1/order/create 路由
// -------------------------------
app.post('/v1/order/create', async (req, res) => {
  try {
    const plan = typeof req.body?.plan === 'string' ? req.body.plan.trim() : '';
    const amount = Number.parseInt(req.body?.amount, 10);
    const providedOutTradeNo =
      typeof req.body?.out_trade_no === 'string'
        ? req.body.out_trade_no
        : typeof req.body?.order_id === 'string'
        ? req.body.order_id
        : '';
    const providedPrepayId =
      typeof req.body?.prepay_id === 'string'
        ? req.body.prepay_id
        : typeof req.body?.prepayId === 'string'
        ? req.body.prepayId
        : '';

    if (!plan) {
      return res.status(400).json({ code: 400, msg: 'plan required' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ code: 400, msg: 'amount must be positive integer' });
    }

    const canonicalOutTradeNo =
      normaliseOrderId((providedOutTradeNo && providedOutTradeNo.trim()) || generateId('wxorder'));
    const now = nowIso();
    let order = getOrderById(canonicalOutTradeNo) || (await loadOrderFromDb(canonicalOutTradeNo));
    const prepayId =
      (providedPrepayId && providedPrepayId.trim()) || order?.prepay_id || generateId('prepay');

    if (!order) {
      order = {
        out_trade_no: canonicalOutTradeNo,
        prepay_id: prepayId,
        status: 'created',
        created_at: now,
        callbacks: { statuses: {} },
      };
    }

    order.plan = plan;
    order.amount = amount;
    order.prepay_id = prepayId;
    if (!order.callbacks) {
      order.callbacks = { statuses: {} };
    }
    if (!order.created_at) {
      order.created_at = now;
    }

    if (prisma?.order?.upsert) {
      const { id: user_id } = await ensureOrderOwner();
      try {
        const record = await prisma.order.upsert({
          where: { out_trade_no: canonicalOutTradeNo },
          create: {
            user_id,
            plan,
            amount,
            status: order.status,
            wx_prepay_id: prepayId,
            out_trade_no: canonicalOutTradeNo,
            paid_at: order.paid_at ? new Date(order.paid_at) : null,
          },
          update: {
            plan,
            amount,
            wx_prepay_id: prepayId,
          },
          select: {
            plan: true,
            amount: true,
            status: true,
            wx_prepay_id: true,
            paid_at: true,
            created_at: true,
          },
        });
        order.plan = record.plan;
        order.amount = record.amount;
        order.status = record.status || order.status;
        order.prepay_id = record.wx_prepay_id || order.prepay_id;
        order.paid_at = normaliseTimestamp(record.paid_at) || order.paid_at;
        order.created_at = normaliseTimestamp(record.created_at) || order.created_at;
      } catch (err) {
        console.error('[order.create] persist failed', err);
      }
    }

    const snapshot = orderSnapshot(saveOrderRecord(order));

    return res.json({ code: 0, data: snapshot });
  } catch (err) {
    console.error('[order.create] failed', err);
    return res.status(500).json({ code: 500, msg: 'order create failed' });
  }
});

// -------------------------------
// 新增 /v1/order/callback 路由
// -------------------------------
app.post('/v1/order/callback', async (req, res) => {
  try {
    const outTradeNoRaw =
      (typeof req.body?.out_trade_no === 'string' && req.body.out_trade_no) ||
      (typeof req.body?.order_id === 'string' && req.body.order_id) ||
      '';
    const outTradeNo = normaliseOrderId(outTradeNoRaw.trim());
    const result = String(req.body?.result || '').trim().toUpperCase();
    const amount = Number.parseInt(req.body?.amount, 10);

    if (!outTradeNo || !result) {
      return res.status(400).json({ code: 400, msg: 'out_trade_no and result required' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ code: 400, msg: 'amount must be positive integer' });
    }

    let order = getOrderById(outTradeNo);
    if (!order) {
      order = await loadOrderFromDb(outTradeNo);
    }
    if (!order) {
      return res.status(404).json({ code: 404, msg: 'order not found' });
    }

    const receivedAt = nowIso();
    const callbacks = order.callbacks || { statuses: {} };
    const statusEntry = callbacks.statuses[result] || {};
    statusEntry.count = (statusEntry.count || 0) + 1;
    statusEntry.last_amount = amount;
    statusEntry.last_received_at = receivedAt;
    callbacks.statuses[result] = statusEntry;
    callbacks.last_result = result;
    callbacks.last_received_at = receivedAt;
    order.callbacks = callbacks;

    let statusChanged = false;
    if (result === 'SUCCESS' && order.status !== 'paid') {
      order.status = 'paid';
      order.paid_at = receivedAt;
      statusChanged = true;
    } else if (result === 'FAIL' && order.status === 'created') {
      order.status = 'failed';
      statusChanged = true;
    }

    order = saveOrderRecord(order);

    if (prisma?.order?.update) {
      try {
        const data = {
          status: order.status,
          plan: order.plan,
          amount: order.amount,
          wx_prepay_id: order.prepay_id,
        };
        if (order.status === 'paid') {
          data.paid_at = new Date(order.paid_at || receivedAt);
        } else if (order.status === 'failed') {
          data.paid_at = null;
        }
        await prisma.order.update({ where: { out_trade_no: outTradeNo }, data }).catch(async (err) => {
          if (err?.code === 'P2025' && prisma?.order?.upsert) {
            const { id: user_id } = await ensureOrderOwner();
            await prisma.order.upsert({
              where: { out_trade_no: outTradeNo },
              create: {
                user_id,
                plan: order.plan || 'unknown',
                amount: order.amount || amount,
                status: order.status,
                wx_prepay_id: order.prepay_id,
                out_trade_no: outTradeNo,
                paid_at: order.status === 'paid' ? new Date(order.paid_at || receivedAt) : null,
              },
              update: data,
            });
          } else {
            throw err;
          }
        });
      } catch (err) {
        console.error('[order.callback] persist failed', err);
      }
    }

    return res.json({
      code: 0,
      data: {
        out_trade_no: order.out_trade_no,
        status: order.status,
        status_changed: statusChanged,
        callbacks: serialiseCallbacks(order.callbacks),
      },
    });
  } catch (err) {
    console.error('[order.callback] failed', err);
    return res.status(500).json({ code: 500, msg: 'order callback failed' });
  }
});

app.get('/v1/order/status', (req, res) => {
  const outTradeNo = String(req.query?.out_trade_no || '').trim();
  if (!outTradeNo) {
    return res.status(400).json({ code: 400, msg: 'out_trade_no required' });
  }

  const order = getOrderById(outTradeNo);
  if (!order) {
    return res.status(404).json({ code: 404, msg: 'order not found' });
  }

  return res.json({ code: 0, data: orderSnapshot(order) });
});

// -------------------------------
// 新增 /v1/db/ping 接口：数据库连接检查
// -------------------------------
app.get('/v1/db/ping', async (req, res) => {
  try {
    // 简单的数据库连接检查，使用 Prisma 查询数据库
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// -------------------------------
// 路由挂载（保持顺序）
// -------------------------------
app.use(createFileRouter());
app.use(createResultsRouter());
app.use('/v1/analysis', createDiagnoseRouter());
app.use(createUsersRouter());

// -------------------------------
// 微信回调路由：发放 JWT
// -------------------------------
app.get('/v1/auth/wx/callback', async (req, res) => {
  const query = req.query || {};
  const code = String(query.code || '').trim();
  if (!code) {
    return res.status(400).json({ code: 400, msg: 'code required' });
  }

  try {
    const openid = `wxmock_${code}`;
    const defaults = {
      nickname: '演示用户',
      email: `${code}@demo.wxresume.dev`,
    };

    const record = await prisma.user.upsert({
      where: { openid },
      update: defaults,
      create: { openid, ...defaults },
      select: { id: true, nickname: true, email: true },
    });

    const token = jwt.sign({ id: record.id, role: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({
      code: 0,
      data: {
        token,
        user: {
          id: record.id,
          nickname: record.nickname || defaults.nickname,
          email: record.email || defaults.email,
        },
      },
    });
  } catch (err) {
    console.error('[auth.wx.callback] failed', err);
    res.status(500).json({ code: 500, msg: 'internal error' });
  }
});

// -------------------------------
// 生成分析报告
// -------------------------------
app.post('/v1/analysis/report', (req, res) => {
  try {
    const { analysis } = req.body;
    const { match_score, hits, gaps } = analysis;

    const radar = {
      hard: Math.max(0, Math.min(100, match_score)),
      experience: Math.max(0, Math.min(100, Math.round(match_score * 0.8))),
      soft: Math.max(0, Math.min(100, 60 + hits.length * 5 - gaps.length * 10)),
    };

    const recommendations = [
      gaps[0] ? `补齐技能：优先学习【${gaps[0]}】并产出作品` : '保持优势，完善项目案例',
      radar.hard < 70 ? '强化硬技能：围绕JD做2个小项目' : '准备技术亮点总结，量化成果',
      radar.soft < 70 ? '提升软能力：准备STAR面试故事' : '优化简历表达，突出协作成果',
    ];

    res.json({ code: 0, data: { radar, recommendations } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

// -------------------------------
// 教育背景匹配
// -------------------------------
app.post('/v1/education/match', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const job = payload.job || payload.requirements || {};

    const education = ensureArray(resume.education);
    const { entry: highestEntry, level: highestLevel } = highestDegreeEntry(education);
    const requiredDegree = job.requiredDegree || job.degree || job.minDegree;
    const requiredLevel = degreeLevelOf(requiredDegree);

    let degreeScore;
    if (!requiredLevel) {
      degreeScore = 100;
    } else if (!highestLevel) {
      degreeScore = 30;
    } else if (highestLevel >= requiredLevel) {
      degreeScore = 100;
    } else {
      const deficit = requiredLevel - highestLevel;
      degreeScore = clampScore(70 - deficit * 25);
    }

    const majorsRequired = ensureArray(job.preferredMajors || job.majors || job.major).map(String).filter(Boolean);
    const resumeMajors = education
      .map((item) => item.area || item.major || item.fieldOfStudy || item.discipline)
      .filter(Boolean);
    const matchedMajors = majorsRequired.filter((major) =>
      resumeMajors.some(
        (candidate) => includesNormalized(candidate, major) || includesNormalized(major, candidate)
      )
    );

    const majorScore = majorsRequired.length
      ? clampScore((matchedMajors.length / majorsRequired.length) * 100)
      : 100;

    const overallScore = clampScore(degreeScore * 0.6 + majorScore * 0.4);

    const suggestions = [];
    if (requiredLevel && highestLevel < requiredLevel) {
      suggestions.push(`补充学历/证书：目标岗位期望${requiredDegree || '更高学历'}`);
    }
    if (majorsRequired.length && matchedMajors.length < majorsRequired.length) {
      const missingMajors = majorsRequired
        .filter((major) => !matchedMajors.includes(major))
        .slice(0, 2)
        .join('、');
      if (missingMajors) {
        suggestions.push(`在简历中加强相关课程或项目：突出${missingMajors}`);
      }
    }
    if (!suggestions.length) {
      suggestions.push('保持教育背景优势，并在面试中突出专业课程实践');
    }

    res.json({
      code: 0,
      data: {
        score: overallScore,
        degreeScore: clampScore(degreeScore),
        majorScore,
        highestDegree: highestEntry?.studyType || highestEntry?.degree || null,
        matchedMajors,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'education match failed' });
  }
});

// -------------------------------
// 语言能力评估
// -------------------------------
app.post('/v1/language/ability', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const job = payload.job || payload.requirements || {};

    const resumeLanguages = ensureArray(resume.languages || resume.language).map((entry) => {
      const name = entry?.name || entry?.language;
      const level = entry?.level || entry?.proficiency || entry?.grade;
      const numericScore = Number.parseFloat(entry?.score ?? entry?.examScore ?? entry?.points ?? entry?.value);
      return {
        name: name || '',
        level,
        score: Number.isFinite(numericScore) ? numericScore : null,
      };
    });

    const requirements = ensureArray(
      job.requirements || job.languageRequirements || job.languages || job.expectedLanguages
    )
      .map((reqItem) => ({
        language: reqItem?.language || reqItem?.name || reqItem?.code || '',
        level: reqItem?.level || reqItem?.requiredLevel,
        minScore:
          reqItem?.minScore ?? reqItem?.minimumScore ?? reqItem?.score ?? reqItem?.min_points ?? reqItem?.min,
      }))
      .filter((item) => item.language);

    const evaluations = [];
    const suggestions = [];

    for (const requirement of requirements) {
      const languageKey = normalizeString(requirement.language);
      const resumeEntry = resumeLanguages.find((lang) => {
        const langName = normalizeString(lang.name);
        return langName && (langName.includes(languageKey) || languageKey.includes(langName));
      });

      const requiredLevelValue = languageLevelOf(requirement.level);
      let levelScore = null;
      if (requiredLevelValue) {
        if (resumeEntry) {
          const entryLevel = languageLevelOf(resumeEntry.level);
          if (entryLevel >= requiredLevelValue) {
            levelScore = 100;
          } else if (entryLevel > 0) {
            levelScore = clampScore(70 - (requiredLevelValue - entryLevel) * 20);
          } else {
            levelScore = 35;
          }
        } else {
          levelScore = 30;
        }
      }

      const minScore = Number.isFinite(requirement.minScore)
        ? Number(requirement.minScore)
        : null;
      let examScore = null;
      if (minScore !== null) {
        if (resumeEntry?.score !== null && resumeEntry?.score !== undefined) {
          if (resumeEntry.score >= minScore) {
            examScore = 100;
          } else {
            const gapRatio = (minScore - resumeEntry.score) / Math.max(minScore, 1);
            examScore = clampScore(65 - gapRatio * 60);
          }
        } else {
          examScore = 40;
        }
      }

      const combinedScore = weightedScore(
        [
          levelScore === null ? null : { score: levelScore, weight: 0.6 },
          examScore === null ? null : { score: examScore, weight: 0.4 },
        ].filter(Boolean)
      );

      if (!resumeEntry) {
        suggestions.push(`补充${requirement.language}能力或证书以满足岗位要求`);
      } else {
        if (requiredLevelValue && levelScore !== null && levelScore < 80) {
          suggestions.push(`提升${requirement.language}水平至${requirement.level || '更高等级'}`);
        }
        if (minScore !== null && examScore !== null && examScore < 80) {
          suggestions.push(`强化考试成绩：${requirement.language} 至少 ${minScore}`);
        }
      }

      evaluations.push({
        language: requirement.language,
        matched: combinedScore >= 80,
        score: combinedScore,
        levelScore: levelScore === null ? undefined : levelScore,
        examScore: examScore === null ? undefined : examScore,
      });
    }

    const overallScore = requirements.length
      ? clampScore(evaluations.reduce((sum, item) => sum + item.score, 0) / requirements.length)
      : clampScore(resumeLanguages.length ? 90 : 60);

    if (!suggestions.length) {
      suggestions.push('语言能力满足要求，可准备语言相关的面试案例');
    }

    res.json({
      code: 0,
      data: {
        score: overallScore,
        evaluations,
        suggestions: Array.from(new Set(suggestions)).slice(0, 4),
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'language ability failed' });
  }
});

// -------------------------------
// 工作经历匹配
// -------------------------------
app.post('/v1/experience/match', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const job = payload.job || payload.requirements || {};

    const fields = ensureArray(job.fields || job.domains || job.focusAreas || job.industries)
      .map((item) => normalizeString(item))
      .filter(Boolean);
    const workEntries = ensureArray(resume.work);

    let totalYears = 0;
    let relevantYears = 0;
    const details = [];

    for (const entry of workEntries) {
      const durationYears = Number.isFinite(entry?.years)
        ? Number(entry.years)
        : yearsBetween(entry?.startDate || entry?.start || entry?.from, entry?.endDate || entry?.end || entry?.until);
      const safeYears = Number.isFinite(durationYears) ? Math.max(durationYears, 0) : 0;
      totalYears += safeYears;

      const textParts = [
        entry?.company,
        entry?.position,
        entry?.summary,
        entry?.industry,
        ...(ensureArray(entry?.industries) || []),
        ...(ensureArray(entry?.highlights) || []),
        ...(ensureArray(entry?.responsibilities) || []),
      ].filter(Boolean);
      const combinedText = textParts.map((part) => String(part)).join(' ').toLowerCase();
      const matchedFields = fields.filter((field) => combinedText.includes(field));
      const isRelevant = !fields.length || matchedFields.length > 0;
      if (isRelevant) {
        relevantYears += safeYears;
      }

      details.push({
        company: entry?.company || null,
        position: entry?.position || null,
        years: Number(safeYears.toFixed(2)),
        matchedFields,
      });
    }

    const requiredYears = [job.requiredYears, job.minYears, job.years, job.minimumYears]
      .map((value) => (Number.isFinite(value) ? Number(value) : null))
      .find((value) => value !== null) || 0;

    const denominator = requiredYears || totalYears || 1;
    const baseScore = denominator ? Math.min(1, relevantYears / denominator) : 0;
    const score = clampScore(baseScore * 100);

    const suggestions = [];
    if (requiredYears && relevantYears < requiredYears) {
      suggestions.push(`补充与岗位相关的项目案例，突出至少 ${requiredYears} 年经验`);
    }
    if (fields.length && relevantYears === 0) {
      suggestions.push(`强调与领域「${fields.join('、')}」相关的成果与技能`);
    }
    if (!suggestions.length) {
      suggestions.push('工作经历与岗位要求匹配，可准备典型项目复盘');
    }

    res.json({
      code: 0,
      data: {
        score,
        relevantYears: Number(relevantYears.toFixed(2)),
        totalYears: Number(totalYears.toFixed(2)),
        details,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'experience match failed' });
  }
});

// -------------------------------
// 关键词频次分析
// -------------------------------
app.post('/v1/keywords/frequency_analysis', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const resumeText =
      payload.resume_text || payload.resumeText || payload.resumeTextContent || resumeToPlainText(resume);
    const jdText = payload.jd_text || payload.jdText || payload.job_text || '';
    const keywords = ensureArray(payload.jd_keywords || payload.keywords || payload.jobKeywords)
      .map((kw) => String(kw).trim())
      .filter(Boolean);

    const frequencies = keywords.map((keyword) => {
      const regex = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'gi');
      const resumeCount = resumeText ? (resumeText.match(regex) || []).length : 0;
      const jdCount = jdText ? (jdText.match(regex) || []).length : 0;
      return { keyword, resumeCount, jdCount };
    });

    const matchedKeywords = frequencies.filter((item) => item.resumeCount > 0);
    const score = keywords.length ? clampScore((matchedKeywords.length / keywords.length) * 100) : 100;

    const suggestions = keywords
      .filter((keyword) => !matchedKeywords.some((item) => item.keyword === keyword))
      .slice(0, 3)
      .map((keyword) => `考虑在简历中补充与「${keyword}」相关的经历或成果`);
    if (!suggestions.length) {
      suggestions.push('关键词覆盖良好，可继续量化成果以增强说服力');
    }

    res.json({
      code: 0,
      data: {
        score,
        frequencies,
        resumeLength: resumeText.length,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'keyword frequency failed' });
  }
});

// -------------------------------
// 语义上下文分析
// -------------------------------
app.post('/v1/keywords/contextual_analysis', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const resumeText =
      payload.resume_text || payload.resumeText || payload.resumeTextContent || resumeToPlainText(resume);
    const jdText = payload.jd_text || payload.jdText || payload.job_text || '';

    const similarity = cosineSimilarity(resumeText, jdText);
    const score = clampScore(similarity > 0 ? 40 + similarity * 60 : 0);

    const resumeTokens = new Set(tokenize(resumeText));
    const jdTokens = new Set(tokenize(jdText));
    const overlapTokens = [...resumeTokens].filter((token) => jdTokens.has(token)).slice(0, 12);

    const suggestions = [];
    if (!resumeText || !jdText) {
      suggestions.push('提供完整的简历与岗位描述文本以获得准确语义分析');
    }
    if (score < 60) {
      suggestions.push('强化与岗位职责相关的案例描述，提升语义匹配度');
    }
    if (!suggestions.length) {
      suggestions.push('语义匹配良好，可准备面试故事深化理解');
    }

    res.json({
      code: 0,
      data: {
        score,
        similarity,
        overlapTokens,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'context analysis failed' });
  }
});

// -------------------------------
// 职位职责匹配
// -------------------------------
app.post('/v1/job/responsibilities_match', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const job = payload.job || payload.requirements || {};

    const responsibilities = ensureArray(job.responsibilities || job.duties || job.expectations)
      .map((item) => String(item).trim())
      .filter(Boolean);

    const resumeResponsibilities = [];
    for (const work of ensureArray(resume.work)) {
      if (work?.summary) resumeResponsibilities.push(String(work.summary));
      resumeResponsibilities.push(...ensureArray(work?.highlights).map((item) => String(item)));
      resumeResponsibilities.push(...ensureArray(work?.responsibilities).map((item) => String(item)));
    }
    if (resume.summary) {
      resumeResponsibilities.push(String(resume.summary));
    }

    const evaluation = responsibilities.map((resp) => {
      const respTokens = new Set(tokenize(resp));
      let matchedEntry = null;
      let bestRatio = 0;

      for (const entry of resumeResponsibilities) {
        const entryTokens = new Set(tokenize(entry));
        if (!entryTokens.size) continue;
        const intersection = [...respTokens].filter((token) => entryTokens.has(token));
        const ratio = respTokens.size ? intersection.length / respTokens.size : 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          matchedEntry = entry;
        }
        if (ratio >= 0.6 || includesNormalized(entry, resp)) {
          bestRatio = ratio || 1;
          matchedEntry = entry;
          break;
        }
      }

      const matched = Boolean(matchedEntry) && (bestRatio >= 0.35 || includesNormalized(matchedEntry, resp));

      return {
        responsibility: resp,
        matched,
        overlapRatio: Number(bestRatio.toFixed(2)),
        matchedEntry: matchedEntry || null,
      };
    });

    const matchedCount = evaluation.filter((item) => item.matched).length;
    const score = responsibilities.length ? clampScore((matchedCount / responsibilities.length) * 100) : 100;

    const suggestions = responsibilities
      .filter((resp) => !evaluation.find((item) => item.matched && item.responsibility === resp))
      .slice(0, 3)
      .map((resp) => `补充与岗位职责「${resp}」相关的业绩或案例`);
    if (!suggestions.length) {
      suggestions.push('职责匹配良好，可准备量化成果以进一步加分');
    }

    res.json({
      code: 0,
      data: {
        score,
        evaluation,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'responsibilities match failed' });
  }
});

// -------------------------------
// 行业适配度分析
// -------------------------------
app.post('/v1/industry/fit', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const job = payload.job || payload.target || {};

    const jobIndustry = job.industry || job.targetIndustry || job.sector || payload.industry || '';
    const related = ensureArray(
      job.relatedIndustries || job.similarIndustries || job.related || job.secondaryIndustries
    ).map(String);

    const resumeIndustries = [];
    for (const work of ensureArray(resume.work)) {
      if (work?.industry) resumeIndustries.push(String(work.industry));
      resumeIndustries.push(...ensureArray(work?.industries).map((item) => String(item)));
      if (work?.companyIndustry) resumeIndustries.push(String(work.companyIndustry));
    }
    if (resume?.industry) {
      resumeIndustries.push(String(resume.industry));
    }

    const normalizedIndustries = resumeIndustries.filter(Boolean);

    const exactMatch = jobIndustry
      ? normalizedIndustries.some(
          (item) => includesNormalized(item, jobIndustry) || includesNormalized(jobIndustry, item)
        )
      : false;
    const relatedMatch = related.some((rel) =>
      normalizedIndustries.some((item) => includesNormalized(item, rel) || includesNormalized(rel, item))
    );

    let score;
    if (!jobIndustry) {
      score = normalizedIndustries.length ? 90 : 70;
    } else if (exactMatch) {
      score = 100;
    } else if (relatedMatch) {
      score = 80;
    } else if (normalizedIndustries.length) {
      score = 55;
    } else {
      score = 40;
    }

    const suggestions = [];
    if (!jobIndustry) {
      suggestions.push('岗位未明确行业，可在沟通中确认具体方向');
    } else if (!exactMatch) {
      suggestions.push(`在简历中强化与${jobIndustry}行业相关的经验或案例`);
    }
    if (!normalizedIndustries.length) {
      suggestions.push('补充过往项目或公司所属行业信息，提升可读性');
    }
    if (!suggestions.length) {
      suggestions.push('行业匹配度高，可准备行业趋势与洞察分享');
    }

    res.json({
      code: 0,
      data: {
        score: clampScore(score),
        jobIndustry: jobIndustry || null,
        resumeIndustries: normalizedIndustries,
        relatedMatch,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'industry fit failed' });
  }
});

// -------------------------------
// 薪资匹配度分析
// -------------------------------
app.post('/v1/salary/fit', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const job = payload.job || payload.target || {};

    const expectation = parseSalaryExpectation(resume);
    const range =
      parseSalaryRange(job.salaryRange || job.salary || payload.salaryRange || payload.salary) || null;

    const suggestions = [];

    if (!expectation) {
      if (!range) {
        suggestions.push('补充薪资期望信息以便评估合理性');
        return res.json({
          code: 0,
          data: {
            score: 60,
            expectation: null,
            range: null,
            suggestions,
          },
        });
      }

      suggestions.push('补充薪资期望信息以便评估合理性');
      return res.json({
        code: 0,
        data: {
          score: 60,
          expectation: null,
          range,
          suggestions,
        },
      });
    }

    if (!range) {
      suggestions.push('岗位未提供薪资范围，可在沟通中确认以便谈判');
      return res.json({
        code: 0,
        data: {
          score: 90,
          expectation,
          range: null,
          suggestions,
        },
      });
    }

    if (range.currency && expectation.currency && range.currency !== expectation.currency) {
      suggestions.push('注意岗位薪资币种与期望不一致，需明确换算方式');
    }

    const expectedAmount = Number(expectation.amountAnnual);
    const min = Number(range.min);
    const max = Number(range.max);

    let score;
    if (expectedAmount >= min && expectedAmount <= max) {
      score = 100;
      if (!suggestions.length) {
        suggestions.push('薪资期望与岗位范围匹配，可准备谈判亮点');
      }
    } else if (expectedAmount < min) {
      const diffRatio = min ? (min - expectedAmount) / min : 1;
      score = clampScore(100 - diffRatio * 120);
      suggestions.push(`薪资期望略低于岗位下限，可考虑调整至≥${min}`);
    } else {
      const diffRatio = max ? (expectedAmount - max) / max : 1;
      score = clampScore(100 - diffRatio * 120);
      suggestions.push('薪资期望高于岗位上限，建议结合价值点协商或适度下调');
    }

    res.json({
      code: 0,
      data: {
        score,
        expectation,
        range,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'salary fit failed' });
  }
});

// -------------------------------
// Mock 文件服务（main 分支遗留能力）
// -------------------------------
app.get('/mock/:file', (req, res) => {
  const filename = req.params.file;
  const filePath = path.join(process.cwd(), 'resumes_pdf', filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4\n% mock\n')); // 最小可识别 PDF
});

// -------------------------------
// 健康检查
// -------------------------------
app.get('/v1/health', (req, res) => {
  const requestId = req.requestId || req.id;
  res.json({ code: 0, msg: 'ok', requestId });
});

// -------------------------------
// 教育背景匹配
// -------------------------------
app.post('/v1/education/match', (req, res) => {
  try {
    const payload = req.body || {};
    const resume = extractResumeFromBody(payload);
    const job = payload.job || payload.requirements || {};

    const education = ensureArray(resume.education);
    const { entry: highestEntry, level: highestLevel } = highestDegreeEntry(education);
    const requiredDegree = job.requiredDegree || job.degree || job.minDegree;
    const requiredLevel = degreeLevelOf(requiredDegree);

    let degreeScore;
    if (!requiredLevel) {
      degreeScore = 100;
    } else if (!highestLevel) {
      degreeScore = 30;
    } else if (highestLevel >= requiredLevel) {
      degreeScore = 100;
    } else {
      const deficit = requiredLevel - highestLevel;
      degreeScore = clampScore(70 - deficit * 25);
    }

    const majorsRequired = ensureArray(job.preferredMajors || job.majors || job.major).map(String).filter(Boolean);
    const resumeMajors = education
      .map((item) => item.area || item.major || item.fieldOfStudy || item.discipline)
      .filter(Boolean);
    const matchedMajors = majorsRequired.filter((major) =>
      resumeMajors.some(
        (candidate) => includesNormalized(candidate, major) || includesNormalized(major, candidate)
      )
    );

    const majorScore = majorsRequired.length
      ? clampScore((matchedMajors.length / majorsRequired.length) * 100)
      : 100;

    const overallScore = clampScore(degreeScore * 0.6 + majorScore * 0.4);

    const suggestions = [];
    if (requiredLevel && highestLevel < requiredLevel) {
      suggestions.push(`补充学历/证书：目标岗位期望${requiredDegree || '更高学历'}`);
    }
    if (majorsRequired.length && matchedMajors.length < majorsRequired.length) {
      const missingMajors = majorsRequired
        .filter((major) => !matchedMajors.includes(major))
        .slice(0, 2)
        .join('、');
      if (missingMajors) {
        suggestions.push(`在简历中加强相关课程或项目：突出${missingMajors}`);
      }
    }
    if (!suggestions.length) {
      suggestions.push('保持教育背景优势，并在面试中突出专业课程实践');
    }

    res.json({
      code: 0,
      data: {
        score: overallScore,
        degreeScore: clampScore(degreeScore),
        majorScore,
        highestDegree: highestEntry?.studyType || highestEntry?.degree || null,
        matchedMajors,
        suggestions,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err?.message || 'education match failed' });
  }
});

// -------------------------------

app.post('/v1/render/pdf', async (req, res) => {
  let templateId = 'classic';
  try {
    const queryTemplate = req.query.templateId || req.query.template_id;
    const body = req.body || {};
    const bodyTemplate = body.templateId || body.template_id;
    templateId = String(queryTemplate || bodyTemplate || 'classic');

    let resumePayload = {};
    if (hasResumeShape(body.resume)) {
      resumePayload = body.resume;
    } else if (hasResumeShape(body)) {
      const { templateId: _t, template_id: _tid, ...rest } = body;
      resumePayload = rest;
    } else {
      resumePayload = loadSampleResume();
    }

    let rendered;
    try {
      rendered = await renderResumeHTML(resumePayload, templateId);
    } catch (err) {
      if (err?.message?.includes('Unknown template')) {
        return res.status(400).json({ code: 400, msg: err.message });
      }
      throw err;
    }

    const pdf = await htmlToPDFBuffer(rendered.html);
    if (rendered.metadata?.fontWarnings?.length) {
      res.setHeader('X-Render-Font-Warnings', rendered.metadata.fontWarnings.join('; '));
    }
    const resolvedTemplateId = rendered.metadata?.templateId || templateId;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Content-Disposition', `inline; filename="resume-${resolvedTemplateId}.pdf"`);
    res.setHeader('X-Template-Id', resolvedTemplateId);
    res.send(pdf);
  } catch (e) {
    if (process.env.DEBUG_RENDER_ERRORS) {
      console.warn('[render.pdf] failed, returning fallback PDF', e);
    }
    const fallbackPdf = await htmlToPDFBuffer('<h1>Resume export temporarily unavailable</h1>');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(fallbackPdf.length));
    res.setHeader('Content-Disposition', `inline; filename="resume-${templateId}.pdf"`);
    res.setHeader('X-Template-Id', templateId);
    res.setHeader('X-Render-Fallback', '1');
    res.send(fallbackPdf);
  }
});

// -------------------------------
// JD 结构化解析
// -------------------------------
app.post('/v1/jd/parse', (req, res) => {
  try {
    const { jdText = req.body?.raw_text || '' } = req.body || {};
    const text = String(jdText || '').trim();

    if (!text) {
      return res.status(400).json({ code: 400, msg: 'jdText required', data: null });
    }

    const parsed = parseJD(text);
    return res.json({ code: 0, msg: 'ok', data: parsed });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

// -------------------------------
// 筛查入口：支持 JSON + multipart/form-data
// -------------------------------
app.post('/v1/check', async (req, res) => {
  await multerPromise;
  uploadResumeMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        code: 1,
        msg: '文件上传失败',
        data: { status: 'error', reason: 'upload_failed', error: err.message },
      });
    }

    try {
      let resumeText = '';
      const jdText = req.body?.jdText || req.body?.jobDesc || '';

      if (req.file) {
        resumeText = await parseResumeFromFile(req.file.path, req.file.mimetype);
      } else if (req.body?.resumeText) {
        resumeText = fromPlainText(req.body.resumeText);
      }

      if (!resumeText || resumeText.length < 10) {
        return res.status(400).json({
          code: 1,
          msg: '简历内容过短或解析失败',
          data: {
            status: 'error',
            screening_passed: false,
            reason: 'resume_too_short',
            required_action: '请检查文件是否为空或重新上传清晰版本',
            next_step: 'user_input_required',
          },
        });
      }

      if (!jdText || jdText.length < 10) {
        return res.status(400).json({
          code: 1,
          msg: 'JD 内容过短或缺失',
          data: {
            status: 'error',
            screening_passed: false,
            reason: 'jd_too_short',
            required_action: '请提供完整岗位描述',
            next_step: 'user_input_required',
          },
        });
      }

      const parsedJD = parseJD(jdText);
      const result = await screeningService.runScreening({ resumeText, jdText, parsedJD });

      return res.json({ code: 0, msg: 'ok', data: result });
    } catch (error) {
      return res.status(500).json({ code: 1, msg: 'internal_error', data: { error: error?.message } });
    }
  });
});

// -------------------------------
// 匹配分：简历技能 vs JD 关键词（Jaccard + 必须项命中）
// -------------------------------
app.post('/v1/match/score', (req, res) => {
  try {
    const dictPath = path.join(REPO_ROOT, 'data/jd_dict_zh.json');
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

    const body = req.body || {};
    // 1) 简历数据：若未传则读取样例
    let resume = body.resume;
    if (!resume) {
      const samplePath = path.join(REPO_ROOT, 'samples/resume/alice.json');
      resume = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
    }
    const resumeSkills = new Set((resume.skills || []).map((s) => s.name));

    // 2) JD 关键词：优先 body.keywords；否则从 body.jd_text 基于词典提取
    let jdKeywords = Array.isArray(body.keywords) ? body.keywords : [];
    if ((!jdKeywords || jdKeywords.length === 0) && body.jd_text) {
      const text = String(body.jd_text);
      const hit = (list = []) => list.filter((w) => text.includes(w));
      jdKeywords = Array.from(new Set([...(hit(dict.skills || [])), ...(hit(dict.soft || []))]));
    }
    const jdSet = new Set(jdKeywords);

    // 3) Jaccard
    const inter = new Set([...jdSet].filter((x) => resumeSkills.has(x)));
    const union = new Set([...jdSet, ...resumeSkills]);
    const jaccard = union.size ? inter.size / union.size : 0;

    // 4) 命中/缺口
    const hits = [...inter];
    const gaps = [...jdSet].filter((k) => !resumeSkills.has(k)).slice(0, 3);

    // 5) 简单得分
    const mustSet = new Set((dict.skills || []).filter((k) => jdSet.has(k)));
    const mustMiss = [...mustSet].filter((k) => !resumeSkills.has(k)).length;
    let score = Math.round(jaccard * 100 - mustMiss * 10);
    if (score < 0) score = 0;

    res.json({
      code: 0,
      data: { match_score: score, hits, gaps, jd_keywords: [...jdSet], resume_skills: [...resumeSkills] },
    });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

// -------------------------------
// 启动
// -------------------------------
const port = process.env.PORT || 8080;
const host =
  process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

app.listen(port, host, () => {
  console.log(`API listening on ${host}:${port}`);
});