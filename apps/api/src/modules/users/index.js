// apps/api/src/modules/users/index.js
import express from 'express';
import jwt from 'jsonwebtoken';
import jwtMiddleware from '../../middlewares/jwt.js';
import { prisma } from '../../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_OPTIONS = { algorithm: 'HS256', expiresIn: '7d' };
const USER_SELECT = { id: true, email: true, nickname: true, created_at: true };

function signToken({ id, role = 'user' }) {
  return jwt.sign({ id, role }, JWT_SECRET, TOKEN_OPTIONS);
}

<<<<<<< HEAD
async function loadUserById(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
}

export function createUsersRouter({ logger = console } = {}) {
  const router = express.Router();

  // Mock 登录：POST /v1/users/profile { user_id }
  router.post('/v1/users/profile', async (req, res) => {
    const userId = String(req.body?.user_id ?? '').trim();
    if (!userId) return res.status(400).json({ code: 400, msg: 'user_id required' });

    try {
      const user = await loadUserById(userId);
      if (!user) return res.status(404).json({ code: 404, msg: 'user not found' });

      const token = signToken({ id: user.id });
      return res.json({ code: 0, data: { token, user } });
    } catch (err) {
      (logger?.error || console.error)('[users.profile] login failed', err);
      return res.status(500).json({ code: 500, msg: 'internal error' });
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
=======
    const userId = Number(raw);
    if (!userId) {
      return res.fail ? res.fail(400, 'user_id required') : res.status(400).json({ code: 400, msg: 'user_id required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.fail ? res.fail(500, 'JWT_SECRET missing') : res.status(500).json({ code: 500, msg: 'JWT_SECRET missing' });
    }

    const token = jwt.sign({ id: userId, role: 'user' }, secret, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });

    return res.ok ? res.ok({ jwt: token }) : res.status(200).json({ code: 0, data: { jwt: token } });
  });

  // GET /v1/users/profile —— 示例
  router.get('/v1/users/profile', (req, res) => {
    return res.ok
      ? res.ok({ id: 1, email: 'demo@example.com', nickname: 'demo' })
      : res.status(200).json({
          code: 0,
          data: { id: 1, email: 'demo@example.com', nickname: 'demo' },
        });
>>>>>>> origin/codex/implement-x-request-id-error-handling
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
