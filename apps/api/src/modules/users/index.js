import { Router } from 'express';
import jwt from 'jsonwebtoken';

export function createUsersRouter() {
  const router = Router();

  // POST /v1/users/profile —— mock login，返回 JWT
  router.post('/v1/users/profile', (req, res) => {
    const raw =
      req.body?.user_id ??
      req.body?.userId ??
      req.query?.user_id ??
      req.query?.userId;

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
  });

  return router;
}

// ===== keep this =====
export function registerUsersModule(app, options = {}) {
  const router = createRouter(options);
  app.use(router);
}

export { createRouter };
export { createRouter as createUsersRouter };

