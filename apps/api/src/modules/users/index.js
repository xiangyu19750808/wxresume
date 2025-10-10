import jwt from "jsonwebtoken";
import express from "express";
import jwtMiddleware from "../../middlewares/jwt.js";
import { prisma } from "../../db.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  const message = "JWT_SECRET environment variable is required";
  console.error(message);
  throw new Error(message);
}

const TOKEN_OPTIONS = { algorithm: "HS256", expiresIn: "7d" };
const USER_SELECT = { id: true, email: true, nickname: true, created_at: true };

async function loadUserById(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
}

function normalizeUserId(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function signToken({ id, role = "user" }) {
  return jwt.sign({ id, role }, JWT_SECRET, TOKEN_OPTIONS);
}

function createRouter({ logger = console } = {}) {
  const router = express.Router();

  router.post("/v1/users/profile", async (req, res) => {
    const userId = normalizeUserId(req.body?.user_id);

    if (!userId) {
      return res.status(400).json({ code: 400, msg: "user_id required" });
    }

    try {
      const user = await loadUserById(userId);
      if (!user) {
        return res.status(404).json({ code: 404, msg: "user not found" });
      }

      const token = signToken({ id: user.id });
      return res.json({ code: 0, data: { token, user } });
    } catch (error) {
      if (logger && typeof logger.error === "function") {
        logger.error("[users.profile] login failed", error);
      } else {
        console.error("[users.profile] login failed", error);
      }
      return res.status(500).json({ code: 500, msg: "internal error" });
    }
  });

  router.get("/v1/users/profile", jwtMiddleware, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ code: 401, msg: "unauthorized" });
    }

    try {
      const user = await loadUserById(userId);
      if (!user) {
        return res.status(404).json({ code: 404, msg: "user not found" });
      }

      return res.json({ code: 0, data: { user } });
    } catch (error) {
      if (logger && typeof logger.error === "function") {
        logger.error("[users.profile] fetch failed", error);
      } else {
        console.error("[users.profile] fetch failed", error);
      }
      return res.status(500).json({ code: 500, msg: "internal error" });
    }
  });

  return router;
}

export function registerUsersModule(app, options = {}) {
  const router = createRouter(options);
  app.use(router);
}

export { createRouter };
