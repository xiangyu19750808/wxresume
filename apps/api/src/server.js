// apps/api/src/server.js
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { reqid } from './middlewares/reqid.js';

// 轻量开关：在 CI 中置为 1，避免加载所有重依赖
const E2E_LIGHT = process.env.E2E_LIGHT === '1';

// ===== 环境检查（轻量模式下不强制 JWT）=====
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && !E2E_LIGHT) {
  const message = 'JWT_SECRET environment variable is required';
  console.error(message);
  throw new Error(message);
}

// CORS 白名单（完整版用）
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ===== 初始化应用 =====
const app = express();
app.use(reqid());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// CORS：轻量模式放开、完整版按白名单
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (E2E_LIGHT) {
    if (origin) res.header('Access-Control-Allow-Origin', origin);
  } else {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return res.status(403).json({ code: 403, msg: 'forbidden' });
    }
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  const requestHeaders = req.headers['access-control-request-headers'];
  res.header(
    'Access-Control-Allow-Headers',
    requestHeaders ? String(requestHeaders) : 'Authorization,Content-Type'
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ===== Mock PDF 静态返回（两种模式都保留）=====
app.get('/mock/:file', (req, res) => {
  const filename = req.params.file;
  const filePath = path.join(process.cwd(), 'resumes_pdf', filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.send(Buffer.from('%PDF-1.4\n% mock\n'));
});

// ===== 健康检查（两种模式都保留）=====
app.get('/v1/health', (_req, res) => res.json({ code: 0, msg: 'ok' }));

// ===== 轻量模式：仅保留下载+订单内存实现 =====
if (E2E_LIGHT) {
  app.get('/v1/file/download', (req, res) => {
    const fileId = req.query.file_id || req.query.fileId;
    if (!fileId) return res.status(400).json({ code: 400, msg: 'file_id required' });
    const url = `http://127.0.0.1:${process.env.PORT || 9080}/mock/${encodeURIComponent(fileId)}?t=${Date.now()}`;
    return res.json({ code: 0, msg: 'ok', data: { url, expiresInSec: 180 } });
  });

  const MEM_ORDERS = new Map();
  const genOutTradeNo = () =>
    'ORD' +
    Date.now().toString().slice(-8) +
    Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  app.post('/v1/order/create', (req, res) => {
    const { plan = 'basic', amount = 1990 } = req.body || {};
    const out_trade_no = genOutTradeNo();
    MEM_ORDERS.set(out_trade_no, { status: 'created', amount, plan, created_at: Date.now() });
    res.json({ code: 0, msg: 'ok', data: { out_trade_no, prepay_id: 'mock_prepay_' + out_trade_no } });
  });

  app.get('/v1/order/status', (req, res) => {
    const out_trade_no = String(req.query.out_trade_no || '');
    if (!out_trade_no) return res.status(400).json({ code: 400, msg: 'missing out_trade_no' });
    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) return res.status(404).json({ code: 404, msg: 'order not found' });
    res.json({ code: 0, msg: 'ok', data: { out_trade_no, status: order.status, amount: order.amount, plan: order.plan } });
  });

  app.post('/v1/order/callback', (req, res) => {
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
    } else {
      order.status = 'failed';
    }
    MEM_ORDERS.set(out_trade_no, order);
    res.json({ code: 0, msg: 'ok', data: { out_trade_no, status: order.status } });
  });
} else {
  // ===== 完整模式：动态导入所有重依赖（只在这里加载）=====
  const [{ createFileRouter }] = await Promise.all([import('./modules/file/index.js')]);
  const [{ createResultsRouter }] = await Promise.all([import('./modules/results/index.js')]);
  const [{ createUsersRouter }] = await Promise.all([import('./modules/users/index.js')]);

  const [{ default: jwtMiddleware }] = await Promise.all([import('./middlewares/jwt.js')]);
  const [{ listTemplates }] = await Promise.all([import('../../../packages/templates/index.js')]);
  const [{ resumeToHTML }] = await Promise.all([import('./render.template.js')]);
  const [{ htmlToPDFBuffer }] = await Promise.all([import('./render.playwright.js')]);
  const [{ getSignedUrl }] = await Promise.all([import('../../../packages/adapters/cos/index.js')]);
  const [{ prisma }] = await Promise.all([import('./db.js')]);

  // 路由挂载
  app.use(createFileRouter());
  app.use(createResultsRouter());
  app.use(createUsersRouter());

  // 模板清单
  app.get('/v1/templates', (_req, res) => {
    try {
      const templates = listTemplates();
      res.json({ code: 0, data: templates });
    } catch (e) {
      res.status(500).json({ code: 500, msg: e?.message || 'error' });
    }
  });

  // 渲染（mock）
  app.post('/v1/render/mock', async (_req, res) => {
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

  // 真实 PDF 渲染
  app.post('/v1/render/pdf', async (req, res) => {
    try {
      const html = String(req.body?.html || '<h1>Test PDF</h1>');
      const buf = await htmlToPDFBuffer(html);
      res.json({ code: 0, data: { bytes: buf.length } });
    } catch (e) {
      res.status(500).json({ code: 500, msg: e?.message || 'render error' });
    }
  });

  // 用模板把简历渲染为 PDF（真 PDF + 假 URL）
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
      const url = await getSignedUrl(fid);
      res.json({ code: 0, data: { file_id: fid, bytes: buf.length, url } });
    } catch (e) {
      res.status(500).json({ code: 500, msg: e?.message || 'render error' });
    }
  });

  // OpenAPI JSON
  app.get('/v1/openapi.json', (_req, res) => {
    try {
      const p = path.resolve(process.cwd(), 'src/openapi.json');
      const json = fs.readFileSync(p, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(json);
    } catch (e) {
      res.status(500).json({ code: 500, msg: e?.message || 'openapi error' });
    }
  });

  // 保存结果到 DB
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

  // 从 DB 拉取结果列表
  app.get('/v1/results/db', async (req, res) => {
    try {
      const user_id = String(req.query.user_id || 'demo');
      const rows = await prisma.result.findMany({
        where: { user_id },
        orderBy: { created_at: 'desc' },
      });
      res.json({ code: 0, data: rows });
    } catch (e) {
      res.status(500).json({ code: 500, msg: e?.message || 'db error' });
    }
  });

  // /v1/users/me（JWT 保护示例）
  app.get('/v1/users/me', jwtMiddleware, (req, res) => {
    const uid = req.user?.id;
    const user = uid ? { id: uid, nickname: '', role: req.user?.role } : null;
    if (!user) return res.status(401).json({ code: 401, msg: 'unauthorized' });
    res.json({ code: 0, data: { user } });
  });

  // DB ping
  app.get('/v1/db/ping', async (_req, res) => {
    try {
      const u = await prisma.user.count();
      res.json({ code: 0, data: { ok: true, users: u } });
    } catch (e) {
      res.status(500).json({ code: 500, msg: e?.message || 'db error' });
    }
  });
}

// ===== 启动服务 =====
const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`API listening on ${port} (light=${E2E_LIGHT})`));
