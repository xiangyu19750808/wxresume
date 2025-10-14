// apps/api/src/server.js
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
import { listTemplates } from '../../../packages/templates/index.js';
import { resumeToHTML } from './render.template.js';
import { htmlToPDFBuffer } from './render.playwright.js';
import { getSignedUrl } from '../../../packages/adapters/cos/index.js';

// Prisma（/v1/db/ping、/v1/results/save 会使用）
import { prisma } from './db.js';

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
// 路由挂载（顺序保持一致）
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
  res.json({ code: 0, msg: 'ok' });
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
app.post('/v1/render/mock', async (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), '../../');
    const samplePath = path.join(repoRoot, 'samples/resume/alice.json');
    const resume = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
    const html = resumeToHTML(resume, 'classic');
    const buf = await htmlToPDFBuffer(html);
    res.json({ code: 0, data: { bytes: buf.length } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
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
const MEM_ORDERS = new Map(); // key: out_trade_no -> {status, amount, plan}

function genOutTradeNo() {
  const t = Date.now().toString();
  return 'ORD' + t.slice(-8) + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
}

app.post('/v1/order/create', (req, res) => {
  try {
    const { plan = 'basic', amount = 1990 } = req.body || {};
    const out_trade_no = genOutTradeNo();
    MEM_ORDERS.set(out_trade_no, { status: 'created', amount, plan, created_at: Date.now() });
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
    res.json({ code: 0, data: { out_trade_no, status: order.status, amount: order.amount, plan: order.plan } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

app.post('/v1/order/callback', (req, res) => {
  try {
    const { out_trade_no, result = 'SUCCESS', amount } = req.body || {};
    if (!out_trade_no) return res.status(400).json({ code: 400, msg: 'missing out_trade_no' });
    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) return res.status(404).json({ code: 404, msg: 'order not found' });
    if (result === 'SUCCESS') {
      if (amount != null && Number(amount) !== Number(order.amount)) {
        return res.status(400).json({ code: 400, msg: 'amount mismatch' });
      }
      order.status = 'paid';
      order.paid_at = Date.now();
      MEM_ORDERS.set(out_trade_no, order);
    } else {
      order.status = 'failed';
      MEM_ORDERS.set(out_trade_no, order);
    }
    res.json({ code: 0, data: { out_trade_no, status: order.status } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'error' });
  }
});

// -------------------------------
// PDF 渲染（Playwright 真渲染）
// -------------------------------
app.post('/v1/render/pdf', async (req, res) => {
  try {
    const html = String(req.body?.html || '<h1>Test PDF</h1>');
    const buf = await htmlToPDFBuffer(html);
    res.json({ code: 0, data: { bytes: buf.length } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'render error' });
  }
});

// -------------------------------
// 用模板把简历渲染为 PDF（真 PDF + 假 URL）
// -------------------------------
app.post('/v1/render/resume', async (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), '../../');
    const samplePath = path.join(repoRoot, 'samples/resume/alice.json');
    const body = req.body || {};
    const templateId = body.templateId || 'classic';
    const resume = body.resume || JSON.parse(fs.readFileSync(samplePath, 'utf-8'));

    const html = resumeToHTML(resume, templateId);
    const buf = await htmlToPDFBuffer(html);

    const fid = 'resume-' + Date.now() + '.pdf';
    const url = await getSignedUrl(fid); // 来自 adapters/cos 的假签名 URL
    res.json({ code: 0, data: { file_id: fid, bytes: buf.length, url } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'render error' });
  }
});

// -------------------------------
// OpenAPI JSON（若存在 src/openapi.json）
// -------------------------------
app.get('/v1/openapi.json', (req, res) => {
  try {
    const p = path.resolve(process.cwd(), 'src/openapi.json');
    const json = fs.readFileSync(p, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(json);
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'openapi error' });
  }
});

// -------------------------------
// 保存结果到 DB
// -------------------------------
app.post('/v1/results/save', async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = body.user_id || 'demo';
    const match = body.match || {};
    const report = body.report || {};
    const file_id = body.file?.file_id || null;
    const bytes = body.file?.bytes ?? null;

    const row = await prisma.result.create({
      data: { user_id, match, report, file_id, bytes },
    });
    res.json({ code: 0, data: { id: row.id, report_id: row.report_id || ('r-' + Date.now()) } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'db error' });
  }
});

// -------------------------------
// 从 DB 拉取结果列表（按 user_id）
// -------------------------------
app.get('/v1/results/db', async (req, res) => {
  try {
    const user_id = String(req.query.user_id || '');
    if (!user_id) return res.status(400).json({ code: 400, msg: 'missing user_id' });
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
// /v1/users/me（JWT 保护示例）
// -------------------------------
app.get('/v1/users/me', jwtMiddleware, (req, res) => {
  const uid = req.user?.id;
  const user = uid ? { id: uid, nickname: '', role: req.user?.role } : null;
  if (!user) return res.status(401).json({ code: 401, msg: 'unauthorized' });
  res.json({ code: 0, data: { user } });
});

// -------------------------------
// DB ping
// -------------------------------
app.get('/v1/db/ping', async (_req, res) => {
  try {
    const u = await prisma.user.count();
    res.json({ code: 0, data: { ok: true, users: u } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || 'db error' });
  }
});

// -------------------------------
// 启动
// -------------------------------
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
