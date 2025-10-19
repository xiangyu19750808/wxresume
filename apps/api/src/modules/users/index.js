import express from 'express';
import jwt from 'jsonwebtoken';
import jwtMiddleware from '../../middlewares/jwt.js';
import { prisma } from '../../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_OPTIONS = { algorithm: 'HS256', expiresIn: '7d' };
const USER_SELECT = { id: true, email: true, nickname: true, created_at: true };

function ok(res, data) {
  if (typeof res.ok === 'function') return res.ok(data);
  const rid = res.req?.requestId;
  return res.status(200).json({ code: 0, msg: 'ok', data, ...(rid ? { requestId: rid } : {}) });
}

function fail(res, status, msg) {
  if (typeof res.fail === 'function') return res.fail(status, msg);
  const rid = res.req?.requestId;
  return res.status(status).json({ code: status, msg, data: null, ...(rid ? { requestId: rid } : {}) });
}

function signToken({ id, role = 'user' }) {
  return jwt.sign({ id, role }, JWT_SECRET, TOKEN_OPTIONS);
}

async function loadUserById(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
}

function parseUserId(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

export function createUsersRouter({ logger = console } = {}) {
  const router = express.Router();

  // Mock 登录：POST /v1/users/profile  body: { user_id }
  router.post('/v1/users/profile', async (req, res) => {
    try {
      if (!JWT_SECRET) return fail(res, 500, 'JWT_SECRET missing');

      const userId = parseUserId(req.body?.user_id ?? req.body?.userId);
      if (userId == null) return fail(res, 400, 'user_id required');

      const user = await loadUserById(userId);
      if (!user) return fail(res, 404, 'user not found');

      const token = signToken({ id: user.id, role: 'user' });
      return ok(res, { token, user });
    } catch (err) {
      (logger?.error || console.error)('[users.profile] login failed', err);
      return fail(res, 500, 'internal error');
    }
  });

  // 受保护读取：GET /v1/users/profile（需 JWT）
  router.get('/v1/users/profile', jwtMiddleware, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ code: 401, msg: 'unauthorized' });

    try {
      const user = await loadUserById(userId);
      if (!user) return res.status(404).json({ code: 404, msg: 'user not found' });
      return res.json({ code: 0, data: { user } });
    } catch (err) {
      (logger?.error || console.error)('[users.profile] fetch failed', err);
      return res.status(500).json({ code: 500, msg: 'internal error' });
    }
  });

  // 兼容 /v1/users/me（与 profile 相同响应）
  router.get('/v1/users/me', jwtMiddleware, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ code: 401, msg: 'unauthorized' });

    try {
      const user = await loadUserById(userId);
      if (!user) return res.status(404).json({ code: 404, msg: 'user not found' });
      return res.json({ code: 0, data: { user } });
    } catch (err) {
      (logger?.error || console.error)('[users.me] fetch failed', err);
      return res.status(500).json({ code: 500, msg: 'internal error' });
    }
  });

  return router;
}

// 便捷注册（可选）
export function registerUsersModule(app, options = {}) {
  const router = createUsersRouter(options);
  app.use(router);
}

// 明确导出
export { createUsersRouter as default };
