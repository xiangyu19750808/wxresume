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
// 新增 /v1/render/pdf 路由（PDF 渲染功能）
// -------------------------------
app.post('/v1/render/pdf', (req, res) => {
  const { html } = req.body;

  if (!html) {
    return res.status(400).json({ code: 400, msg: 'Missing HTML content' });
  }

  // 假设使用 Playwright 渲染 PDF
  htmlToPDFBuffer(html)
    .then(pdfBuffer => {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdfBuffer);
    })
    .catch(err => {
      res.status(500).json({ code: 500, msg: err.message || 'PDF rendering error' });
    });
});

// -------------------------------
// 新增 /v1/file/download 路由（文件下载功能）
// -------------------------------
app.get('/v1/file/download', (req, res) => {
  const { file_id } = req.query;

  if (!file_id) {
    return res.status(400).json({ code: 400, msg: 'Missing file_id' });
  }

  const filePath = path.join(process.cwd(), 'files', file_id);  // 根据文件路径和存储位置调整
  console.log(`Requesting file: ${filePath}`);  // 打印请求的文件路径

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  } else {
    return res.status(404).json({ code: 404, msg: 'File not found' });
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
// 启动
// -------------------------------
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
