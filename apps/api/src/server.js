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
app.post('/v1/order/create', (req, res) => {
  const { plan, amount } = req.body;
  
  // 简单的订单创建逻辑（你可以根据需要扩展）
  if (!plan || !amount) {
    return res.status(400).json({ code: 400, msg: 'Missing plan or amount' });
  }

  // 模拟创建订单成功，返回订单信息
  const order = {
    orderId: `ORD${Date.now()}`,
    plan,
    amount,
  };

  res.json({ code: 0, data: order });
});

// -------------------------------
// 新增 /v1/order/callback 路由
// -------------------------------
app.post('/v1/order/callback', (req, res) => {
  const { out_trade_no, result, amount } = req.body;

  // 检查必需的参数是否存在
  if (!out_trade_no || !result || !amount) {
    return res.status(400).json({ code: 400, msg: 'Missing required fields' });
  }

  // 假设支付成功，模拟更新订单状态
  res.json({ code: 0, data: { out_trade_no, status: 'paid', status_changed: true } });
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
// 微信回调路由：发放 JWT
// -------------------------------
app.get('/v1/auth/wx/callback', async (req, res) => {
  const query = req.query || {};
  const code = String(query.code || '').trim();
  if (!code) {
    return res.status(400).json({ code: 400, msg: 'code required' });
  }

  try {
    // 模拟用户数据
    const user = { id: 'demo-user', nickname: '演示用户', email: 'demo.user@wxresume.dev' };

    // 返回 JWT token 和用户数据
    const token = jwt.sign({ id: user.id}, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({
      code: 0,
      data: { token, user },
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
