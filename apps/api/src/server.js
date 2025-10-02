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

// 渲染测试：从仓库根目录读取 samples/resume/alice.json
app.post("/v1/render/mock", async (req, res) => {
  try {
    const repoRoot = path.resolve(process.cwd(), "../../"); // apps/api -> apps -> repo root
    const samplePath = path.join(repoRoot, "samples/resume/alice.json");
    const resume = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
    const buf = await renderPDF({ templateId: "classic", resume });
    res.json({ code: 0, bytes: buf.length });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e?.message || "error" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
