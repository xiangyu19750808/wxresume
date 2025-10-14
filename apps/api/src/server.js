// 一定放第1行，确保在加载其它模块前读入 .env
import 'dotenv/config';

import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

import { reqid } from './middlewares/reqid.js';
import jwtMiddleware from './middlewares/jwt.js';

import { createUsersRouter } from './modules/users/index.js';
import { createFileRouter } from './modules/file/index.js';
import { createResultsRouter } from './modules/results/index.js';

import { listTemplates, renderPDF } from '../../../packages/templates/index.js';
import { prisma } from './db.js';
import { htmlToPDFBuffer } from './render.playwright.js';
import { resumeToHTML } from './render.template.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  const message = 'JWT_SECRET environment variable is required';
  console.error(message);
  throw new Error(message);
}

const app = express();

/** 中间件顺序：reqid → 解析器 → 安全头 → CORS → 路由 */
app.use(reqid());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

/** CORS（白名单） */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.fail(403, 403, 'forbidden');
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

/** 健康检查（统一响应） */
app.get('/v1/health', (req, res) => {
  return res.ok(null, 'ok');
});

/** 模板清单 */
app.get('/v1/templates', (req, res) => {
  try {
    const templates = listTemplates();
    res.ok(templates);
  } catch (e) {
    res.fail(500, 500, e?.message || 'error');
  }
});

/** 渲染测试：从样例简历生成 PDF 字节数 */
app.post('/v1/render/mock', async (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), '../../');
    const samplePath = path.join(repoRoot, 'samples/resume/alice.json');
    const resume = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
    const buf = await renderPDF({ templateId: 'classic', resume });
    res.ok({ bytes: buf.length });
  } catch (e) {
    res.fail(500, 500, e?.message || 'error');
  }
});

/** JD 解析占位：读取 data/jd_dict_zh.json 做简单匹配 */
app.post('/v1/jd/parse', (req, res) => {
  try {
    const { raw_text = '' } = req.body || {};
    const repoRoot = path.resolve(process.cwd(), '../../');
    const dictPath = path.join(repoRoot, 'data/jd_dict_zh.json');
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
    res.ok(result);
  } catch (e) {
    res.fail(500, 500, e?.message || 'error');
  }
});

/** 匹配分：基于简历技能 vs JD 关键词的 Jaccard + 必须项命中 */
app.post('/v1/match/score', (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), '../../');
    const dictPath = path.join(repoRoot, 'data/jd_dict_zh.json');
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

    const body = req.body || {};
    // 1) 简历数据：若未传，则读取样例
    let resume = body.resume;
    if (!resume) {
      const samplePath = path.join(repoRoot, 'samples/resume/alice.json');
      resume = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
    }
    // 抽取简历技能集合
    const resumeSkills = new Set(
      [
        ...(resume.skills || []).map((s) => s.name),
        ...((resume.work || []).flatMap((w) => (w.highlights || []).join(' '))).flatMap(() => []),
      ].filter(Boolean)
    );

    // 2) JD 关键词：优先 body.keywords；否则从 body.jd_text 基于词典提取
    let jdKeywords = Array.isArray(body.keywords) ? body.keywords : [];
    if ((!jdKeywords || jdKeywords.length === 0) && body.jd_text) {
      const text = String(body.jd_text);
      const hit = (list = []) => list.filter((w) => text.includes(w));
      jdKeywords = Array.from(new Set([...(hit(dict.skills || [])), ...(hit(dict.soft || []))]));
    }
    const jdSet = new Set(jdKeywords);

    // 3) 计算 Jaccard
    const inter = new Set([...jdSet].filter((x) => resumeSkills.has(x)));
    const union = new Set([...jdSet, ...resumeSkills]);
    const jaccard = union.size ? inter.size / union.size : 0;

    // 4) 命中 / 缺口（Top3）
    const hits = [...inter];
    const gaps = [...jdSet].filter((k) => !resumeSkills.has(k)).slice(0, 3);

    // 5) 简单得分：Jaccard*100，未命中的 must（=词典skills∩JD）每项 -10 分
    const mustSet = new Set((dict.skills || []).filter((k) => jdSet.has(k)));
    const mustMiss = [...mustSet].filter((k) => !resumeSkills.has(k)).length;
    let score = Math.round(jaccard * 100 - mustMiss * 10);
    if (score < 0) score = 0;

    return res.ok({
      match_score: score,
      hits,
      gaps,
      jd_keywords: [...jdSet],
      resume_skills: [...resumeSkills],
    });
  } catch (e) {
    return res.fail(500, 500, e?.message || 'error');
  }
});

/** 诊断报告：根据匹配结果生成雷达与建议 */
app.post('/v1/analysis/report', (req, res) => {
  try {
    const a = req.body?.analysis || {};
    const ms = Number(a.match_score ?? a.score ?? 0);
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

    return res.ok({ report_id: 'r-' + Date.now(), radar, recommendations: recs });
  } catch (e) {
    return res.fail(500, 500, e?.message || 'error');
  }
});

/** ===== Auth: /v1/auth/wx/callback（占位）===== */
const MEM_USERS = new Map(); // key: openid, val: user
function signJWT(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
app.get('/v1/auth/wx/callback', (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) return res.fail(400, 400, 'missing code');

    // 模拟用 code 换 openid（真实环境走微信API）
    const openid = 'wx_' + Buffer.from(code).toString('hex').slice(0, 10);
    const user =
      MEM_USERS.get(openid) || { id: openid, nickname: '用户' + openid.slice(-4), avatar_url: '', role: 'user' };
    MEM_USERS.set(openid, user);

    const token = signJWT({ id: user.id, role: user.role || 'user' });
    res.ok({ token, user });
  } catch (e) {
    res.fail(500, 500, e?.message || 'error');
  }
});

/** ===== JWT 保护中间件 & /v1/users/me ===== */
app.get('/v1/users/me', jwtMiddleware, (req, res) => {
  const uid = req.user?.id;
  const user = MEM_USERS.get(uid) || { id: uid, nickname: '', role: req.user?.role };
  res.ok({ user });
});

/** ===== Order mock: /v1/order/* ===== */
const MEM_ORDERS = new Map(); // key: out_trade_no, val: {status, amount, plan}
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
    res.ok({ out_trade_no, prepay_id });
  } catch (e) {
    res.fail(500, 500, e?.message || 'error');
  }
});
app.get('/v1/order/status', (req, res) => {
  try {
    const out_trade_no = String(req.query.out_trade_no || '');
    if (!out_trade_no) return res.fail(400, 400, 'missing out_trade_no');
    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) return res.fail(404, 404, 'order not found');
    res.ok({ out_trade_no, status: order.status, amount: order.amount, plan: order.plan });
  } catch (e) {
    res.fail(500, 500, e?.message || 'error');
  }
});
app.post('/v1/order/callback', (req, res) => {
  try {
    const { out_trade_no, result = 'SUCCESS', amount } = req.body || {};
    if (!out_trade_no) return res.fail(400, 400, 'missing out_trade_no');
    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) return res.fail(404, 404, 'order not found');
    if (result === 'SUCCESS') {
      if (amount != null && Number(amount) !== Number(order.amount)) {
        return res.fail(400, 400, 'amount mismatch');
      }
      order.status = 'paid';
      order.paid_at = Date.now();
    } else {
      order.status = 'failed';
    }
    MEM_ORDERS.set(out_trade_no, order);
    res.ok({ out_trade_no, status: order.status });
  } catch (e) {
    res.fail(500, 500, e?.message || 'error');
  }
});

/** ===== Results (memory demo 由独立路由提供) ===== */
/** DB ping */
app.get('/v1/db/ping', async (req, res) => {
  try {
    const u = await prisma.user.count();
    res.ok({ ok: true, users: u });
  } catch (e) {
    res.fail(500, 500, e?.message || 'db error');
  }
});

/** 真实 PDF 渲染（原样保留） */
app.post('/v1/render/pdf', async (req, res) => {
  try {
    const html = String(req.body?.html || '<h1>Test PDF</h1>');
    const buf = await htmlToPDFBuffer(html);
    res.ok({ bytes: buf.length });
  } catch (e) {
    res.fail(500, 500, e?.message || 'render error');
  }
});

/** 简历渲染为 PDF（模板 + 假 URL） */
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
    const { getSignedUrl } = await import('../../../packages/adapters/cos/index.js');
    const url = await getSignedUrl(fid);
    res.ok({ file_id: fid, bytes: buf.length, url });
  } catch (e) {
    res.fail(500, 500, e?.message || 'render error');
  }
});

/** OpenAPI JSON */
app.get('/v1/openapi.json', (req, res) => {
  try {
    const p = path.resolve(process.cwd(), 'src/openapi.json');
    const json = fs.readFileSync(p, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(json);
  } catch (e) {
    res.fail(500, 500, e?.message || 'openapi error');
  }
});

/** Mock 文件服务：供签名 URL 下载 */
app.get('/mock/:file', (req, res) => {
  const filename = req.params.file;
  const filePath = path.join(process.cwd(), 'resumes_pdf', filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4\n% mock\n'));
});

/** 子路由挂载（统一放在全部中间件之后） */
app.use(createFileRouter());
app.use(createResultsRouter());
app.use(createUsersRouter());

/** 启动服务 */
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
