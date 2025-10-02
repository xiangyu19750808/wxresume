import express from "express";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { listTemplates, renderPDF } from "../../../packages/templates/index.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());

app.get("/v1/health", (req, res) => res.json({ code: 0, msg: "ok" }));

app.get("/v1/templates", (req, res) => {
  try {
    const templates = listTemplates();
    res.json({ code: 0, data: templates });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// 渲染测试：从仓库根读取样例简历 -> 生成PDF缓冲 -> 返回字节数
app.post("/v1/render/mock", async (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), "../../");
    const samplePath = path.join(repoRoot, "samples/resume/alice.json");
    const resume = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
    const buf = await renderPDF({ templateId: "classic", resume });
    res.json({ code: 0, bytes: buf.length });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// JD 解析占位：读取 data/jd_dict_zh.json 做简单匹配
app.post("/v1/jd/parse", (req, res) => {
  try {
    const { raw_text = "" } = req.body || {};
    const repoRoot = path.resolve(process.cwd(), "../../");
    const dictPath = path.join(repoRoot, "data/jd_dict_zh.json");
    const dict = JSON.parse(fs.readFileSync(dictPath, "utf-8"));
    const text = String(raw_text);

    const hit = (list=[]) => list.filter(w => text.includes(w));
    const keywords = Array.from(new Set([...hit(dict.skills||[]), ...hit(dict.soft||[])]));

    const result = {
      jd_id: "demo-" + Date.now(),
      keywords,
      requirements: {
        must: hit(dict.skills||[]),
        nice: hit(dict.soft||[]),
        exp_years: (dict.exp_years_tokens||[]).find(t=>text.includes(t)) || null
      }
    };
    res.json({ code: 0, data: result });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// 匹配分：基于简历技能 vs JD 关键词的 Jaccard + 必须项命中
app.post("/v1/match/score", (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), "../../");
    const dictPath = path.join(repoRoot, "data/jd_dict_zh.json");
    const dict = JSON.parse(fs.readFileSync(dictPath, "utf-8"));

    const body = req.body || {};
    // 1) 简历数据：若未传，则读取样例 alice.json
    let resume = body.resume;
    if (!resume) {
      const samplePath = path.join(repoRoot, "samples/resume/alice.json");
      resume = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
    }
    // 抽取简历技能集合
    const resumeSkills = new Set([
      ...(resume.skills || []).map(s => s.name),
      ...((resume.work || []).flatMap(w => (w.highlights||[]).join(" "))).flatMap(x=>[])
    ].filter(Boolean));

    // 2) JD 关键词：优先 body.keywords；否则从 body.jd_text 基于词典提取
    let jdKeywords = Array.isArray(body.keywords) ? body.keywords : [];
    if ((!jdKeywords || jdKeywords.length===0) && body.jd_text) {
      const text = String(body.jd_text);
      const hit = (list=[]) => list.filter(w => text.includes(w));
      jdKeywords = Array.from(new Set([...hit(dict.skills||[]), ...hit(dict.soft||[])]));
    }
    const jdSet = new Set(jdKeywords);

    // 3) 计算 Jaccard
    const inter = new Set([...jdSet].filter(x => resumeSkills.has(x)));
    const union = new Set([...jdSet, ...resumeSkills]);
    const jaccard = union.size ? inter.size / union.size : 0;

    // 4) 命中 / 缺口（Top3）
    const hits = [...inter];
    const gaps = [...jdSet].filter(k => !resumeSkills.has(k)).slice(0, 3);

    // 5) 简单得分：Jaccard*100，若存在 must（=词典skills）未命中，每项-10分
    const mustSet = new Set((dict.skills||[]).filter(k => jdSet.has(k)));
    const mustMiss = [...mustSet].filter(k => !resumeSkills.has(k)).length;
    let score = Math.round(jaccard * 100 - mustMiss * 10);
    if (score < 0) score = 0;

    res.json({ code: 0, data: { match_score: score, hits, gaps, jd_keywords: [...jdSet], resume_skills: [...resumeSkills] } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));

// 诊断报告（雷达+三条建议，占位计算）
app.post("/v1/analysis/report", (req, res) => {
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
      gaps[0] ? `补齐技能：优先学习【${gaps[0]}】并产出作品` : "保持优势，完善项目案例",
      hard < 70 ? "强化硬技能：围绕JD做2个小项目" : "准备技术亮点总结，量化成果",
      soft < 70 ? "提升软能力：准备STAR面试故事" : "优化简历表达，突出协作成果"
    ];

    res.json({ code: 0, data: { report_id: "r-" + Date.now(), radar, recommendations: recs }});
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// 文件下载占位：?file_id=xxx -> 返回临时URL
import { getSignedUrl } from "../../../packages/adapters/cos/index.js";
app.get("/v1/file/download", async (req, res) => {
  try {
    const fileId = String(req.query.file_id || "demo.pdf");
    const url = await getSignedUrl(fileId);
    res.json({ code: 0, data: { url } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// ===== Auth: /v1/auth/wx/callback（占位，使用 code 换本地假用户，签发 JWT）=====
import jwt from "jsonwebtoken";
const MEM_USERS = new Map(); // key: openid, val: user

function signJWT(payload) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

app.get("/v1/auth/wx/callback", (req, res) => {
  try {
    const code = String(req.query.code || "");
    if (!code) return res.status(400).json({ code: 400, msg: "missing code" });

    // 模拟用 code 换 openid（真实环境走微信API）
    const openid = "wx_" + Buffer.from(code).toString("hex").slice(0,10);
    const user = MEM_USERS.get(openid) || { id: openid, nickname: "用户" + openid.slice(-4), avatar_url: "" };
    MEM_USERS.set(openid, user);

    const token = signJWT({ uid: user.id, nick: user.nickname });
    res.json({ code: 0, msg: "ok", data: { token, user } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// ===== JWT 保护中间件 & /v1/users/me =====
function verifyJWT(req, res, next) {
  try {
    const auth = String(req.headers.authorization || "");
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ code: 401, msg: "missing bearer" });
    const secret = process.env.JWT_SECRET || "dev-secret";
    const payload = jwt.verify(m[1], secret);
    req.user = payload; // { uid, nick, iat, exp }
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, msg: "invalid token" });
  }
}

app.get("/v1/users/me", verifyJWT, (req, res) => {
  const uid = req.user?.uid;
  const user = MEM_USERS.get(uid) || { id: uid, nickname: req.user?.nick || "" };
  res.json({ code: 0, data: { user } });
});

// ===== Order mock: /v1/order/create =====
const MEM_ORDERS = new Map(); // key: out_trade_no, val: {status, amount, plan}

function genOutTradeNo() {
  const t = Date.now().toString();
  return "ORD" + t.slice(-8) + Math.floor(Math.random()*1000).toString().padStart(3,"0");
}

// 创建订单（占位，返回假 prepay_id）
app.post("/v1/order/create", (req, res) => {
  try {
    const { plan = "basic", amount = 1990 } = req.body || {};
    const out_trade_no = genOutTradeNo();
    MEM_ORDERS.set(out_trade_no, { status: "created", amount, plan, created_at: Date.now() });
    const prepay_id = "mock_prepay_" + out_trade_no;
    res.json({ code: 0, data: { out_trade_no, prepay_id } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// 查询订单状态（占位）
app.get("/v1/order/status", (req, res) => {
  try {
    const out_trade_no = String(req.query.out_trade_no || "");
    if (!out_trade_no) return res.status(400).json({ code: 400, msg: "missing out_trade_no" });
    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) return res.status(404).json({ code: 404, msg: "order not found" });
    res.json({ code: 0, data: { out_trade_no, status: order.status, amount: order.amount, plan: order.plan } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

// 支付回调占位：将订单置为 paid（真实环境需验签）
app.post("/v1/order/callback", (req, res) => {
  try {
    const { out_trade_no, result = "SUCCESS", amount } = req.body || {};
    if (!out_trade_no) return res.status(400).json({ code: 400, msg: "missing out_trade_no" });
    const order = MEM_ORDERS.get(out_trade_no);
    if (!order) return res.status(404).json({ code: 404, msg: "order not found" });
    if (result === "SUCCESS") {
      if (amount != null && Number(amount) !== Number(order.amount)) {
        return res.status(400).json({ code: 400, msg: "amount mismatch" });
      }
      order.status = "paid";
      order.paid_at = Date.now();
      MEM_ORDERS.set(out_trade_no, order);
    } else {
      order.status = "failed";
      MEM_ORDERS.set(out_trade_no, order);
    }
    res.json({ code: 0, data: { out_trade_no, status: order.status } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});
// ===== Results (memory) =====
const MEM_RESULTS = new Map();
function newResult({ user_id="demo", match={}, report={}, file={} }) {
  const rid = "R" + Date.now();
  const item = { rid, user_id, match, report, file, created_at: Date.now() };
  MEM_RESULTS.set(rid, item);
  return item;
}

app.post("/v1/results/demo", async (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), "../../");
    const dict = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/jd_dict_zh.json"), "utf-8"));
    const resume = JSON.parse(fs.readFileSync(path.join(repoRoot, "samples/resume/alice.json"), "utf-8"));
    const text = String(req.body?.jd_text || "3年以上，SQL/Excel，Tableau，沟通协作");

    const hit = (list=[]) => list.filter(w => text.includes(w));
    const keywords = Array.from(new Set([...hit(dict.skills||[]), ...hit(dict.soft||[])]));

    const rs = new Set((resume.skills||[]).map(s => s.name));
    const jd = new Set(keywords);
    const inter = [...jd].filter(k => rs.has(k));
    const union = new Set([...jd, ...rs]);

    let score = Math.round((union.size ? inter.length / union.size : 0) * 100);
    const mustMiss = [...(dict.skills||[]).filter(k => jd.has(k))].filter(k => !rs.has(k)).length;
    score = Math.max(0, score - mustMiss * 10);

    const match = { match_score: score, hits: inter, gaps: [...jd].filter(k => !rs.has(k)).slice(0,3) };

    const hard = Math.min(100, Math.max(0, score));
    const experience = Math.min(100, Math.max(0, Math.round(score * 0.8)));
    const soft = Math.min(100, Math.max(0, 60 + match.hits.length * 5 - match.gaps.length * 10));
    const report = {
      radar: { hard, experience, soft },
      recommendations: [
        match.gaps[0] ? `补齐技能：优先学习【${match.gaps[0]}】并产出作品` : "保持优势，完善项目案例",
        hard < 70 ? "强化硬技能：围绕JD做2个小项目" : "准备技术亮点总结，量化成果",
        soft < 70 ? "提升软能力：准备STAR面试故事" : "优化简历表达，突出协作成果"
      ]
    };

    const { renderPDF } = await import("../../../packages/templates/index.js");
    const { getSignedUrl } = await import("../../../packages/adapters/cos/index.js");
    const buf = await renderPDF({ templateId: "classic", resume });
    const fid = "result-" + Date.now() + ".pdf";
    const file = { file_id: fid, bytes: buf.length, url: await getSignedUrl(fid) };

    const item = newResult({ match, report, file });
    res.json({ code: 0, data: item });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

app.get("/v1/results", (req, res) => {
  res.json({ code: 0, data: [...MEM_RESULTS.values()].sort((a,b)=>b.created_at-a.created_at) });
});

// 从数据库按 user_id 拉取结果列表（倒序）
app.get("/v1/results/db", async (req, res) => {
  try {
    const user_id = String(req.query.user_id || "");
    if (!user_id) return res.status(400).json({ code: 400, msg: "missing user_id" });
    const rows = await prisma.result.findMany({
      where: { user_id },
      orderBy: { created_at: "desc" }
    });
    res.json({ code: 0, data: rows });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "db error" });
  }
});


app.get("/v1/results/:rid", (req, res) => {
  const rid = String(req.params.rid || "");
  const item = MEM_RESULTS.get(rid);
  if (!item) return res.status(404).json({ code: 404, msg: "not found" });
  res.json({ code: 0, data: item });
});


// DB ping
import { prisma } from "./db.js";
app.get("/v1/db/ping", async (req, res) => {
  try {
    const u = await prisma.user.count();
    res.json({ code: 0, data: { ok: true, users: u } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "db error" });
  }
});

// 真实PDF渲染：Playwright
import { htmlToPDFBuffer } from "./render.playwright.js";
app.post("/v1/render/pdf", async (req, res) => {
  try {
    const html = String(req.body?.html || "<h1>Test PDF</h1>");
    const buf = await htmlToPDFBuffer(html);
    res.json({ code: 0, data: { bytes: buf.length } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "render error" });
  }
});

// 用模板把简历渲染为 PDF（真实 PDF + 假URL）
import { resumeToHTML } from "./render.template.js";
app.post("/v1/render/resume", async (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), "../../");
    const samplePath = path.join(repoRoot, "samples/resume/alice.json");
    const body = req.body || {};
    const templateId = body.templateId || "classic";
    const resume = body.resume || JSON.parse(fs.readFileSync(samplePath, "utf-8"));
    const html = resumeToHTML(resume, templateId);
    const buf = await htmlToPDFBuffer(html);
    const fid = "resume-" + Date.now() + ".pdf";
    const { getSignedUrl } = await import("../../../packages/adapters/cos/index.js");
    const url = await getSignedUrl(fid);
    res.json({ code: 0, data: { file_id: fid, bytes: buf.length, url } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "render error" });
  }
});

// Serve OpenAPI JSON
app.get("/v1/openapi.json", (req, res) => {
  try {
    const p = path.resolve(process.cwd(), "src/openapi.json");
    const json = fs.readFileSync(p, "utf-8");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(json);
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "openapi error" });
  }
});
// 保存结果到 DB：/v1/results/save
// body: { user_id?: string, match: {...}, report: {...}, file?: { file_id?: string, bytes?: number } }
app.post("/v1/results/save", async (req, res) => {
  try {
    const body = req.body || {};
    const user_id = body.user_id || "demo";
    const match = body.match || {};
    const report = body.report || {};
    const file_id = body.file?.file_id || null;
    const bytes = body.file?.bytes ?? null;

    const row = await prisma.result.create({
      data: { user_id, match, report, file_id, bytes }
    });

    res.json({ code: 0, data: { id: row.id } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "db error" });
  }
});
