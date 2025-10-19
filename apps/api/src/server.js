import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';

import { createUsersRouter } from './modules/users/index.js';
import { createFileRouter } from './modules/file/index.js';
import { createResultsRouter } from './modules/results/index.js';
import { reqid } from './middlewares/reqid.js';
import jwtMiddleware from './middlewares/jwt.js';

// 可选：模板/渲染工具与 COS 适配占位
import {
  listTemplates,
  describeFontSetup,
  renderResumeHTML
} from './render.template.js';
import { htmlToPDFBuffer } from './render.playwright.js';
import { getSignedUrl } from '../../../packages/adapters/cos/index.js';
import {
  refund as requestWxpayRefund,
  verifyCallback as verifyWxpayCallback,
} from '../../../packages/adapters/wxpay/src/index.js';

// Prisma（/v1/db/ping、/v1/results/save 会使用）
import { prisma } from './db.js';

const APP_CWD = process.cwd();
const REPO_ROOT = (() => {
  const candidate = path.resolve(APP_CWD, '../../');
  if (fs.existsSync(path.join(candidate, 'data'))) return candidate;
  return APP_CWD;
})();
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

const fontSetup = describeFontSetup();
if (process.env.NODE_ENV !== 'test') {
  console.log('[templates] fonts dir:', fontSetup.fontsDir);
  const missing = fontSetup.bundled.filter((f) => !f.available).map((f) => f.filename);
  if (missing.length) {
    console.warn('[templates] bundled fonts missing:', missing.join(', '));
  }
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

/** 中间件顺序：reqid -> 解析体 -> 安全头 -> CORS -> 路由 */
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
// 路由挂载（保持顺序）
// -------------------------------
app.use(createFileRouter());
app.use(createResultsRouter());
app.use(createUsersRouter());

// -------------------------------
// 保留 main 分支的 Mock 文件服务
// /mock/:file  -> 若存在仓库根/resumes_pdf/<file> 则返回该文件
//               否则回一个最小 PDF 占位内容
// -------------------------------
app.get('/mock/:file', (req, res) => {
  const filename = req.params.file;
  const filePath = path.join(process.cwd(), 'resumes_pdf', filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.setHeader('Content-Type', 'application/pdf');
  // 一个最小可被识别的 PDF 占位
  res.send(Buffer.from('%PDF-1.4\n% mock\n'));
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
// 渲染（mock）：读取样例 JSON -> PDF buffer -> 返回字节数
// -------------------------------
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
    const repoRoot = path.resolve(process.cwd(), '../../');
    const dictPath = path.join(repoRoot, 'data/jd_dict_zh.json');
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));
    const text = String(raw_text);

    const hit = (list = []) => list.filter((w) => text.includes(w));
    const keywords = Array.from(
      new Set([...(hit(dict.skills || [])), ...(hit(dict.soft || []))])
    );

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
    const repoRoot = path.resolve(process.cwd(), '../../');
    const dictPath = path.join(repoRoot, 'data/jd_dict_zh.json');
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

    const body = req.body || {};
    // 1) 简历数据：若未传则读取样例
    let resume = body.resume;
    if (!resume) {
      const samplePath = path.join(repoRoot, 'samples/resume/alice.json');
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
// 诊断报告占位（雷达 + 三条建议）
// -------------------------------
app.post('/v1/analysis/report', (req, res) => {
  try {
    const a = req.body?.analysis || {};
    const ms = Number(a.match_score || 0);
    const hits = Array.isArray(a.hits) ? a.hits : [];
    const gaps = Array.isArray(a.gaps) ? a.gaps : [];

    const hard = Math.max(0, Math.min(100, ms));
    const experience = Math.max(0, Math.min(100, Math.round(ms * 0.8)));
    const soft = Math.max(0, Math.min(100, 60 + hits.length * 5 - gaps.length * 10));

    const radar = { hard, experience, soft };
    const recs = [
      gaps[0] ? `补齐技能：优先学习【${gaps[0]}】并产出作品` : '保持优势，完善项目案例',
      hard < 70 ? '强化硬技能：围绕JD做2个小项目' : '准备技术亮点总结，量化成果',
      soft < 70 ? '提升软能力：准备STAR面试故事' : '优化简历表达，突出协作成果',
    ];

    res.json({ code: 0, data: { report_id: 'r-' + Date.now(), radar, recommendations: recs } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

// -------------------------------
// 订单（占位）：create/status/callback
// -------------------------------
const MEM_ORDERS = new Map(); // key: out_trade_no -> {status, amount, plan, callbacks}
const CALLBACK_AUDIT_LOG = path.join(
  REPO_ROOT,
  'data',
  'logs',
  'wxpay-callback-audit.log'
);

function appendCallbackAudit(event) {
  try {
    const dir = path.dirname(CALLBACK_AUDIT_LOG);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const line = `${new Date().toISOString()} ${JSON.stringify(event)}\n`;
    fs.appendFileSync(CALLBACK_AUDIT_LOG, line, 'utf8');
  } catch (err) {
    console.warn('[wxpay-callback] audit log append failed', err);
  }
}

function resolveCallbackStatus(payload = {}) {
  const resource = payload.resource || {};
  return (
    resource.trade_state ||
    payload.trade_state ||
    payload.status ||
    payload.result ||
    payload.event_type ||
    'UNKNOWN'
  );
}

function normaliseStatusKey(status) {
  if (!status) return 'UNKNOWN';
  return String(status).trim().toUpperCase();
}

function resolveCallbackAmount(payload = {}) {
  const fromResource = payload?.resource?.amount;
  if (fromResource && typeof fromResource === 'object') {
    if (typeof fromResource.total === 'number') return fromResource.total;
    if (typeof fromResource.payer_total === 'number') return fromResource.payer_total;
  }

  const amount = payload?.amount;
  if (typeof amount === 'number') return amount;
  if (amount && typeof amount === 'object') {
    if (typeof amount.total === 'number') return amount.total;
    if (typeof amount.payer_total === 'number') return amount.payer_total;
  }

  if (typeof payload?.total === 'number') return payload.total;

  return undefined;
}

function genOutTradeNo() {
  const t = Date.now().toString();
  return 'ORD' + t.slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

app.post('/v1/order/create', (req, res) => {
  try {
    const { plan = 'basic', amount = 1990 } = req.body || {};
    const out_trade_no = genOutTradeNo();
    MEM_ORDERS.set(out_trade_no, {
      status: 'created',
      amount,
      plan,
      created_at: Date.now(),
      callbacks: { total: 0, statuses: {} },
    });
    const prepay_id = 'mock_prepay_' + out_trade_no;
    res.json({ code: 0, data: { out_trade_no, prepay_id } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

app.get('/v1/order/status', (req, res) => {
  try {
    const out_trade_no = String(req.query.out_trade_no || '');
    if (!out_trade_no) return res.status(400).json({ code: 400, msg: 'missing out_trade_no' });
    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) return res.status(404).json({ code: 404, msg: 'order not found' });
    res.json({
      code: 0,
      data: {
        out_trade_no,
        status: order.status,
        amount: order.amount,
        plan: order.plan,
        callbacks: order.callbacks,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

app.post('/v1/order/callback', async (req, res) => {
  try {
    const requestId = req.requestId || req.id;
    let verified;
    try {
      verified = await verifyWxpayCallback(req.headers, req.body);
    } catch (err) {
      const statusCode = 400;
      appendCallbackAudit({
        type: 'verify_failed',
        statusCode,
        message: err?.message || 'invalid signature',
        reqid: requestId,
      });
      return res
        .status(statusCode)
        .json({ code: statusCode, msg: 'invalid callback signature' });
    }

    const payload = req.body || {};
    const out_trade_no = verified.out_trade_no || payload.out_trade_no;
    if (!out_trade_no) {
      appendCallbackAudit({
        type: 'payload_invalid',
        statusCode: 400,
        message: 'missing out_trade_no',
        reqid: requestId,
      });
      return res.status(400).json({ code: 400, msg: 'missing out_trade_no' });
    }

    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) {
      appendCallbackAudit({
        type: 'order_not_found',
        out_trade_no,
        statusCode: 404,
        reqid: requestId,
      });
      return res.status(404).json({ code: 404, msg: 'order not found' });
    }

    const statusRaw = resolveCallbackStatus(payload);
    const statusKey = normaliseStatusKey(statusRaw);
    const callbacks = order.callbacks || { total: 0, statuses: {} };
    callbacks.total = (callbacks.total || 0) + 1;
    const record = callbacks.statuses[statusKey] || {
      count: 0,
      processed: false,
      last_received_at: null,
    };
    record.count += 1;
    record.last_received_at = Date.now();
    callbacks.statuses[statusKey] = record;

    let statusChanged = false;
    if (!record.processed) {
      if (statusKey.includes('SUCCESS')) {
        const amount = resolveCallbackAmount(payload);
        if (
          amount != null &&
          Number(amount) !== Number(order.amount)
        ) {
          appendCallbackAudit({
            type: 'amount_mismatch',
            out_trade_no,
            expected: order.amount,
            received: amount,
            statusCode: 400,
            reqid: requestId,
          });
          return res.status(400).json({ code: 400, msg: 'amount mismatch' });
        }
        order.status = 'paid';
        order.paid_at = Date.now();
      } else {
        order.status = 'failed';
      }
      record.processed = true;
      record.processed_at = Date.now();
      statusChanged = true;
    }

    order.callbacks = callbacks;
    MEM_ORDERS.set(out_trade_no, order);

    appendCallbackAudit({
      type: 'callback_processed',
      out_trade_no,
      status: statusKey,
      replay: record.count,
      total: callbacks.total,
      statusChanged,
      reqid: requestId,
    });

    res.json({
      code: 0,
      data: {
        out_trade_no,
        status: order.status,
        status_changed: statusChanged,
        callbacks,
      },
    });
  } catch (e) {
    appendCallbackAudit({
      type: 'callback_internal_error',
      message: e?.message || 'internal error',
      reqid: req.requestId || req.id,
    });
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

app.post('/v1/order/refund', jwtMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, msg: 'forbidden' });
    }

    const { out_trade_no, amount } = req.body || {};
    if (!out_trade_no) {
      return res.status(400).json({ code: 400, msg: 'missing out_trade_no' });
    }

    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) {
      return res.status(404).json({ code: 404, msg: 'order not found' });
    }

    const normalisedAmount = (() => {
      if (typeof amount === 'number') return amount;
      if (amount && typeof amount.total === 'number') return amount.total;
      return order.amount;
    })();

    const refundResult = await requestWxpayRefund({
      out_trade_no,
      amount: { total: normalisedAmount, currency: 'CNY' },
    });

    order.status = 'refunding';
    order.refund_amount = normalisedAmount;
    order.refund_requested_at = Date.now();
    MEM_ORDERS.set(out_trade_no, order);

    res.json({
      code: 0,
      data: {
        out_trade_no,
        status: 'processing',
        refund_id: refundResult.refund_id,
        accepted_at: refundResult.accepted_at,
      },
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
