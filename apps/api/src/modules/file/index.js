import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { CosFakeAdapter } from "../../../../../packages/adapters/cos/src/index.js";

const r = Router();
const prisma = new PrismaClient();
const cos = new CosFakeAdapter({
  publicBase: "http://localhost:8080/mock",
  localDir: "./paid"
});

r.get("/v1/file/download", async (req, res) => {
  const file_id = (req.query.file_id || "").toString();
  if (!file_id) {
    return res.status(400).json({ code: 1, msg: "file_id required" });
  }

  const f = await prisma.fileObject.findUnique({
    where: { id: file_id },
    select: { id: true, cos_key: true }
  });
  const key = f?.cos_key ?? f?.id ?? file_id; // 缺记录时用 file_id 兜底
  const url = await cos.getSignedUrl({ key, expiresInSec: 180 });

  return res.json({ code: 0, data: { url, expiresInSec: 180 } });
});

export default r;
