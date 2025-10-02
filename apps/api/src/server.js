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
