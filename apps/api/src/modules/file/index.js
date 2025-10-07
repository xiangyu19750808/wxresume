import { prisma } from "../../db.js";
import { getSignedUrl } from "../../../../../packages/adapters/cos/index.js";

const EXPIRES_IN_SEC = 180;

function resolveClientIp(req) {
  const xfwd = req.headers["x-forwarded-for"];
  if (typeof xfwd === "string" && xfwd.trim()) {
    const [first] = xfwd.split(",");
    if (first && first.trim()) return first.trim();
  }
  return req.ip;
}

function logAccess(logger, payload) {
  const entry = {
    ...payload,
    ts: new Date().toISOString(),
  };
  if (logger && typeof logger.info === "function") {
    logger.info("[file.download]", entry);
  } else {
    console.info("[file.download]", entry);
  }
}

export function registerFileModule(app, { logger = console } = {}) {
  app.get("/v1/file/download", async (req, res) => {
    const queryValue = req.query?.file_id;
    const fileId = Array.isArray(queryValue) ? queryValue[0] : queryValue;
    const normalizedId = typeof fileId === "string" ? fileId.trim() : "";

    if (!normalizedId) {
      return res.status(400).json({ code: 400, msg: "missing file_id" });
    }

    try {
      let record = null;
      const hasDb = Boolean(process.env.DB_URL);
      if (hasDb) {
        try {
          record = await prisma.fileObject.findUnique({ where: { id: normalizedId } });
        } catch (dbError) {
          if (logger && typeof logger.warn === "function") {
            logger.warn("[file.download] db lookup failed", dbError);
          } else {
            console.warn("[file.download] db lookup failed", dbError);
          }
        }
      }

      const key = record?.cos_key || record?.id || normalizedId;

      if (!key) {
        return res.status(404).json({ code: 404, msg: "file not found" });
      }

      const url = await getSignedUrl(key, { expiresInSec: EXPIRES_IN_SEC });

      logAccess(logger, {
        file_id: normalizedId,
        key,
        ip: resolveClientIp(req),
        ua: req.headers["user-agent"] || "",
      });

      return res.json({ code: 0, data: { url, expiresInSec: EXPIRES_IN_SEC } });
    } catch (error) {
      if (logger && typeof logger.error === "function") {
        logger.error("[file.download]", error);
      } else {
        console.error("[file.download]", error);
      }
      return res.status(500).json({ code: 500, msg: "internal error" });
    }
  });
}
