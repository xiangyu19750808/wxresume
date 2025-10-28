import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

import { createUsersRouter } from './modules/users/index.js';
import { createFileRouter } from './modules/file/index.js';
import { createResultsRouter } from './modules/results/index.js';
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
  unifiedOrder as createWxpayOrder,
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
const SAMPLE_RESUME_PATH = path.join(REPO_ROOT, 'samples/resume/alice.json');

const ordersStore = new Map();

function createEmptyCallbacksSnapshot() {
  return {
    statuses: {},
    last_received_at: null,
    last_signature: null,
    last_payload: null,
    verifications: {
      last_event_type: null,
      last_transaction_id: null,
      last_success_time: null,
    },
  };
}

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

const SECTION_KEYWORDS = {
  summary: ['自我评价', '个人简介', '自我介绍'],
  skills: ['技能', '技能特长', '专业技能'],
  work: ['工作经历', '工作经验', '实习经历'],
  education: ['教育经历', '教育背景'],
  projects: ['项目经历', '项目经验'],
};

function detectSection(line) {
  if (!line) return null;
  const normalized = String(line).replace(/[：:]/g, '').trim();
  if (!normalized) return null;
  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.startsWith(keyword))) {
      return section;
    }
  }
  return null;
}

function extractEmail(text) {
  const match = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

function extractPhone(text) {
  const match = String(text || '').match(/1[3-9]\d{9}/);
  return match ? match[0] : null;
}

function parseResumeText(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n');
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { resume: loadSampleResume(), warnings: ['empty_text'] };
  }

  const basics = { name: lines.shift() || '候选人', email: null, phone: null };
  const sections = {
    summary: [],
    skills: [],
    work: [],
    education: [],
    projects: [],
  };

  let currentSection = 'summary';

  for (const line of lines) {
    const email = extractEmail(line);
    if (email && !basics.email) basics.email = email;
    const phone = extractPhone(line);
    if (phone && !basics.phone) basics.phone = phone;

    const matchedSection = detectSection(line);
    if (matchedSection) {
      currentSection = matchedSection;
      continue;
    }

    if (currentSection === 'skills') {
      const tokens = line
        .split(/[、，,;；\s]+/)
        .map((token) => token.trim())
        .filter(Boolean);
      sections.skills.push(...tokens);
    } else {
      sections[currentSection].push(line);
    }
  }

  const skills = Array.from(new Set(sections.skills)).map((name) => ({ name }));
  const shapeFrom = (key) => sections[key].map((text, index) => ({ id: index + 1, text }));

  return {
    resume: {
      basics,
      summary: sections.summary.join('\n'),
      skills,
      work: shapeFrom('work'),
      projects: shapeFrom('projects'),
      education: shapeFrom('education'),
      metadata: { source: 'text' },
    },
    warnings: [],
  };
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

const JWT_SIGN_OPTIONS = { algorithm: 'HS256', expiresIn: '7d' };
const PUBLIC_USER_FIELDS = {
  id: true,
  nickname: true,
  avatar_url: true,
  email: true,
  phone: true,
  created_at: true,
};

// CORS 白名单（逗号分隔）
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// -------------------------------
// 初始化应用 & 中间件顺序
// -------------------------------
const app = express();

// 允许直接访问仓库内的 files 目录
const filesDirectory = path.join(REPO_ROOT, 'files');
if (process.env.NODE_ENV !== 'test') {
  console.log('[static] files directory:', filesDirectory);
}
app.use(
  '/files',
  express.static(filesDirectory, {
    fallthrough: false, // 如果文件不存在，直接返回 404 错误
    dotfiles: 'deny', // 禁止访问以 "." 开头的文件
  })
);

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

const FALLBACK_USER_PROFILE = {
  id: 'demo-user',
  nickname: '演示用户',
  avatar_url: null,
  email: 'demo.user@wxresume.dev',
  phone: null,
  created_at: '2024-01-01T00:00:00.000Z',
};

// 模拟微信 OAuth 回调 -> 发放 JWT
app.get('/v1/auth/wx/callback', async (req, res) => {
  const query = req.query || {};
  const code = String(query.code || '').trim();
  if (!code) {
    return res.status(400).json({ code: 400, msg: 'code required' });
  }

  try {
    let user = null;
    try {
      user = await prisma.user.findFirst({ where: { openid: code }, select: PUBLIC_USER_FIELDS });
      if (!user) {
        user = await prisma.user.findFirst({ orderBy: { created_at: 'asc' }, select: PUBLIC_USER_FIELDS });
      }
    } catch (dbError) {
      console.warn('[auth.wx.callback] falling back to demo user due to prisma error:', dbError?.message);
    }

    if (!user) {
      user = { ...FALLBACK_USER_PROFILE };
    }

    const token = jwt.sign({ id: user.id, role: 'user' }, JWT_SECRET, JWT_SIGN_OPTIONS);

    res.json({
      code: 0,
      data: {
        token,
        user,
        state: query.state ?? null,
      },
    });
  } catch (err) {
    console.error('[auth.wx.callback] failed', err);
    res.status(500).json({ code: 500, msg: 'internal error' });
  }
});

// -------------------------------
// 新增 /v1/order/create 路由
// -------------------------------
app.post('/v1/order/create', async (req, res) => {
  try {
    const body = req.body || {};
    const { plan, amount, user_id: userId, userId: camelUserId } = body;

    if (!plan || amount === undefined || amount === null) {
      return res.status(400).json({ code: 400, msg: 'Missing plan or amount' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ code: 400, msg: 'Invalid amount' });
    }

    const now = new Date().toISOString();
    const userIdentifier = userId || camelUserId || null;
    const outTradeNo = `WX${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    let unifiedOrderResult;
    try {
      unifiedOrderResult = await createWxpayOrder({
        out_trade_no: outTradeNo,
        amount: { total: numericAmount, currency: 'CNY' },
        openid: body.openid || `mock-openid-${userIdentifier || 'guest'}`,
        payer: body.payer,
      });
    } catch (err) {
      console.error('[order.create] failed to create unified order', err);
      return res.status(500).json({ code: 500, msg: 'failed_to_create_order' });
    }

    const order = {
      orderId: unifiedOrderResult.out_trade_no,
      out_trade_no: unifiedOrderResult.out_trade_no,
      plan,
      amount: numericAmount,
      status: 'created',
      created_at: now,
      updated_at: now,
      user_id: userIdentifier,
      prepay_id: unifiedOrderResult.prepay_id,
      transaction_id: null,
      paid_at: null,
      last_callback_result: null,
      callbacks: createEmptyCallbacksSnapshot(),
    };

    ordersStore.set(order.out_trade_no, order);

    res.json({ code: 0, data: order });
  } catch (err) {
    console.error('[order.create] unexpected error', err);
    res.status(500).json({ code: 500, msg: 'internal error' });
  }
});

app.get('/v1/order/status', (req, res) => {
  const query = req.query || {};
  const orderId = query.order_id || query.out_trade_no || query.orderId;
  if (!orderId) {
    return res.status(400).json({ code: 400, msg: 'order_id required' });
  }

  const order = ordersStore.get(String(orderId));
  if (!order) {
    return res.status(404).json({ code: 404, msg: 'order not found' });
  }

  res.json({ code: 0, data: order });
});

// -------------------------------
// 新增 /v1/order/callback 路由
// -------------------------------
app.post('/v1/order/callback', async (req, res) => {
  try {
    const body = req.body || {};
    const outTradeNo = body.out_trade_no || body.outTradeNo;
    const resultToken = body.result || body.trade_state || body.event_type;

    if (!outTradeNo || !resultToken) {
      return res.status(400).json({ code: 400, msg: 'Missing required fields' });
    }

    let verification;
    try {
      verification = await verifyWxpayCallback(req.headers, body);
    } catch (err) {
      if (err?.code === 'ERR_WXPAY_INVALID_SIGNATURE') {
        return res.status(401).json({ code: 401, msg: 'invalid_signature' });
      }
      console.error('[order.callback] verification failed', err);
      return res.status(500).json({ code: 500, msg: 'verification_failed' });
    }

    const previous = ordersStore.get(String(outTradeNo));
    if (!previous) {
      return res.status(404).json({ code: 404, msg: 'order not found' });
    }

    const now = new Date().toISOString();
    const normalizedResult = String(resultToken).toUpperCase();
    const derivedStatus = normalizedResult === 'SUCCESS' ? 'paid' : normalizedResult;
    const statusChanged = previous.status !== derivedStatus;

    const callbacks = {
      ...(previous.callbacks ?? createEmptyCallbacksSnapshot()),
      statuses: {
        ...((previous.callbacks && previous.callbacks.statuses) || {}),
      },
    };

    const statusEntry = callbacks.statuses[normalizedResult] || { count: 0, last_at: null };
    callbacks.statuses[normalizedResult] = {
      count: (statusEntry.count || 0) + 1,
      last_at: now,
    };
    callbacks.last_received_at = now;
    callbacks.last_signature =
      req.headers['wechatpay-signature'] ||
      req.headers['wxpay-signature'] ||
      req.headers['x-wxpay-signature'] ||
      req.headers['x-wechatpay-signature'] ||
      null;
    callbacks.last_payload = body;
    callbacks.verifications = {
      last_event_type: verification.event_type,
      last_transaction_id: verification.transaction_id,
      last_success_time: verification.success_time,
    };

    const transactionId =
      body.transaction_id || verification.transaction_id || previous.transaction_id;
    const callbackAmount =
      body.amount !== undefined && body.amount !== null ? Number(body.amount) : previous.amount;

    const updated = {
      ...previous,
      status: derivedStatus,
      amount: Number.isFinite(callbackAmount) ? callbackAmount : previous.amount,
      transaction_id: transactionId,
      paid_at:
        derivedStatus === 'paid'
          ? previous.paid_at || verification.success_time || now
          : previous.paid_at,
      updated_at: now,
      last_callback_result: normalizedResult,
      callbacks,
    };

    ordersStore.set(String(outTradeNo), updated);

    res.json({ code: 0, data: { ...updated, status_changed: statusChanged } });
  } catch (err) {
    console.error('[order.callback] unexpected error', err);
    res.status(500).json({ code: 500, msg: 'internal error' });
  }
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
app.use(createUsersRouter());

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
// 模板清单
// -------------------------------
app.get('/v1/templates', (req, res) => {
  try {
    const templates = listTemplates();
    res.json({ code: 0, data: templates });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

// -------------------------------
// 渲染：resume -> HTML -> PDF
// -------------------------------
app.post('/v1/resumes/parse', (req, res) => {
  try {
    const body = req.body || {};
    const sourceText = body.raw_text ?? body.text ?? '';
    const parsed = parseResumeText(sourceText);
    res.json({ code: 0, data: parsed.resume, warnings: parsed.warnings });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'parse failed' });
  }
});

app.post('/v1/render/mock', async (_req, res) => {
  try {
    const resume = loadSampleResume();
    const { html, metadata } = await renderResumeHTML(resume, 'classic');
    const buf = await htmlToPDFBuffer(html);
    res.json({ code: 0, data: { bytes: buf.length, templateId: metadata?.templateId || 'classic' } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

app.post('/v1/resume/render', async (req, res) => {
  try {
    const body = req.body || {};
    const templateId = String(body.templateId || body.template_id || 'classic');

    let resumePayload = {};
    if (hasResumeShape(body.resume)) {
      resumePayload = body.resume;
    } else if (hasResumeShape(body)) {
      const { templateId: _ti, template_id: _tid, ...rest } = body;
      resumePayload = rest;
    } else {
      resumePayload = loadSampleResume();
    }

    const rendered = await renderResumeHTML(resumePayload, templateId);

    res.json({
      code: 0,
      data: {
        html: rendered.html,
        templateId: rendered.metadata?.templateId || templateId,
        fontWarnings: rendered.metadata?.fontWarnings || [],
        metadata: rendered.metadata || {},
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'render failed' });
  }
});

app.post('/v1/render/pdf', async (req, res) => {
  try {
    const queryTemplate = req.query.templateId || req.query.template_id;
    const body = req.body || {};
    const bodyTemplate = body.templateId || body.template_id;
    const templateId = String(queryTemplate || bodyTemplate || 'classic');

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
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Content-Disposition', `inline; filename="resume-${rendered.metadata?.templateId || templateId}.pdf"`);
    res.setHeader('X-Template-Id', rendered.metadata?.templateId || templateId);
    res.send(pdf);
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'render failed' });
  }
});

// -------------------------------
// JD 解析占位：data/jd_dict_zh.json 简单匹配
// -------------------------------
app.post('/v1/jd/parse', (req, res) => {
  try {
    const { raw_text = '' } = req.body || {};
    const dictPath = path.join(REPO_ROOT, 'data/jd_dict_zh.json');
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
    const text = String(raw_text);

    const hit = (list = []) => list.filter((w) => text.includes(w));
    const keywords = Array.from(new Set([...(hit(dict.skills || [])), ...(hit(dict.soft || []))]));

    const result = {
      jd_id: 'demo-' + Date.now(),
      keywords,
      requirements: {
        must: hit(dict.skills || []),
        nice: hit(dict.soft || []),
        exp_years: (dict.exp_years_tokens || []).find((t) => text.includes(t)) || null,
      },
    };
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
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
app.listen(port, () => console.log(`API listening on ${port}`));
