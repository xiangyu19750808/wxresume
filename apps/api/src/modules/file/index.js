import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { CosFakeAdapter } from "../../../../packages/adapters/cos/src/index.js";

const r = Router();
const prisma = new PrismaClient();
const cos = new CosFakeAdapter({ publicBase: "http://localhost:8080/mock", localDir: "./paid" });

r.get("/v1/file/download", async (req, res) => {
  const file_id = (req.query.file_id || "").toString();
  if (!file_id) return res.status(400).json({ code: 1, msg: "file_id required" });

  const f = await prisma.fileObject.findUnique({ where: { id: file_id }, select: { key: true } });
  if (!f) return res.status(404).json({ code: 1, msg: "file not found" });

  const url = await cos.getSignedUrl({ key: f.key, expiresInSec: 180 });
  res.json({ code: 0, data: { url, expiresInSec: 180 } });
});

export default r;
