import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

// 文件解析相关库导入
import multer from 'multer';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// 路由与控制器导入 (全部放在顶部)
import { createUsersRouter } from './modules/users/index.js';
import { createFileRouter } from './modules/file/index.js';
import { createResultsRouter } from './modules/results/index.js';
import { createDiagnoseRouter } from './analysis/index.js'; 
import { createResumeRouter } from './resume/index.js';
import { createPayRouter } from './pay/index.js';
import { reqid } from './middlewares/reqid.js';
import { handleOptimize } from './analysis/controller/optimize.controller.js';
import { handleExportPdf } from './analysis/controller/export.controller.js';

const app = express();
app.use((req, res, next) => { console.log('>>> 收到请求:', req.method, req.url); next(); });

// 允许直接访问 files 目录
const filesDirectory = path.join('/root/wxresume/apps/api', 'files');  // 使用绝对路径
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
const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: true });
// 修改后的逻辑：让所有接口都支持 JSON 解析
app.use(jsonParser); 
app.use(urlencodedParser);

 
app.use(helmet());
app.use('/v1/pay', createPayRouter());

// 🎯 全量流量监控：只要有请求经过，必然打印日志
app.use((req, res, next) => {
    console.log(`\n>>> [请求到达] ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log(`📦 [数据包摘要]:`, JSON.stringify(req.body).substring(0, 100));
    }
    next();
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(reqid());

// --------------------------------------------------------------------------
// 2. AI 深度分析路由
// --------------------------------------------------------------------------
const analysisRouter = express.Router();
analysisRouter.post('/optimize', handleOptimize);
analysisRouter.post('/export-pdf', handleExportPdf); // 显式挂载
analysisRouter.use(createDiagnoseRouter());

app.use('/v1/analysis', analysisRouter);

// --------------------------------------------------------------------------
// 3. 其他接口 (JD、简历解析等)
// --------------------------------------------------------------------------
app.post('/v1/jd/parse', async (req, res) => {
    try {
        const content = req.body.content || req.body.raw_text || req.body.text;
        if (!content) return res.status(400).json({ code: 1, error: 'JD内容不能为空' });
        res.json({ code: 0, data: { job_title: "解析中...", key_skills: ["通用"], experience_requirements: "不限" } });
    } catch (err) { res.status(500).json({ code: 500 }); }
});

app.post('/v1/resume/parse', upload.single('resumeFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '未接收到文件' });
        res.json({ code: 0, data: { raw_text: "解析成功" } });
    } catch (err) { res.status(500).json({ error: '解析故障' }); }
});

// --------------------------------------------------------------------------
// 4. 支付与静态文件
// --------------------------------------------------------------------------
app.use('/v1/pay', createPayRouter());
app.use('/files', express.static(path.join(process.cwd(), 'apps/api/files')));

// --------------------------------------------------------------------------
// 5. 业务模块挂载
// --------------------------------------------------------------------------
app.use(createFileRouter());
app.use(createResultsRouter());
app.use(createUsersRouter());

app.get('/v1/db/ping', async (req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok' }); }
  catch (e) { res.status(500).json({ status: 'error', msg: e.message }); }
});

// --------------------------------------------------------------------------
// 6. 启动服务与保活
// --------------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    🚀 服务正式启动：端口 ${PORT}
    🎯 导出接口测试: POST /v1/analysis/export-pdf
    `);
});

server.timeout = 300000;

setInterval(() => {}, 10000); // 保持 Event Loop

process.on('unhandledRejection', (reason) => {
    console.error('>>> [严重错误] 未处理异步拒绝:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('>>> [系统崩溃] 未捕获异常:', err);
});