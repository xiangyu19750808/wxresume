// apps/api/src/server.js
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { createUsersRouter } from './modules/users/index.js';
import { createFileRouter } from './modules/file/index.js';
import { createResultsRouter } from './modules/results/index.js';
import requestIdMiddleware from './middlewares/reqid.js';
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
// 
