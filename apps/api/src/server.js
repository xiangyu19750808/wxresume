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

    // 非严格占位结构
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

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
