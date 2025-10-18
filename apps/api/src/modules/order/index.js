import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { unifiedOrder, verifyCallback } from '@wxresume/adapters-wxpay';
import { prisma } from '../../db.js';
import jwtMiddleware from '../../middlewares/jwt.js';

let schemaReadyPromise;

function ensureOrderSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "openid" TEXT NOT NULL,
          "unionid" TEXT,
          "nickname" TEXT,
          "avatar_url" TEXT,
          "phone" TEXT,
          "email" TEXT,
          "target_position" TEXT,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "User_openid_key" ON "User"("openid")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "User_unionid_key" ON "User"("unionid")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Order" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "user_id" TEXT NOT NULL,
          "plan" TEXT NOT NULL,
          "amount" INTEGER NOT NULL,
          "status" TEXT NOT NULL,
          "wx_prepay_id" TEXT,
          "out_trade_no" TEXT NOT NULL,
          "paid_at" DATETIME,
          "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Order_out_trade_no_key" ON "Order"("out_trade_no")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "Order_user_id_idx" ON "Order"("user_id")
      `);
    })();
  }
  return schemaReadyPromise;
}

function generateOutTradeNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `ORD${timestamp}${randomSuffix}`;
}

function normaliseSuccessTime(value) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function ensureUserRecord(userId) {
  if (!userId) return;
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      openid: userId,
    },
  });
}

function serializeOrder(order) {
  if (!order) return null;
  return {
    out_trade_no: order.out_trade_no,
    status: order.status,
    plan: order.plan,
    amount: order.amount,
    paid_at: order.paid_at ? order.paid_at.toISOString() : null,
    prepay_id: order.wx_prepay_id ?? null,
  };
}

export function createOrderRouter() {
  const router = Router();

  router.post('/v1/order/create', jwtMiddleware, async (req, res, next) => {
    try {
      await ensureOrderSchema();

      const planRaw = req.body?.plan;
      const amountRaw = req.body?.amount;

      const plan = typeof planRaw === 'string' ? planRaw.trim() : '';
      if (!plan) {
        return res.fail(400, 'plan required');
      }

      const amount = Number.parseInt(amountRaw, 10);
      if (!Number.isInteger(amount) || amount <= 0) {
        return res.fail(400, 'amount must be positive integer');
      }

      const userId = String(req.user?.id || '');
      if (!userId) {
        return res.fail(401, 'unauthorized');
      }

      await ensureUserRecord(userId);

      const outTradeNo = generateOutTradeNo();

      const created = await prisma.order.create({
        data: {
          user_id: userId,
          plan,
          amount,
          status: 'pending',
          out_trade_no: outTradeNo,
        },
      });

      let payment;
      try {
        payment = await unifiedOrder({
          out_trade_no: created.out_trade_no,
          amount: { total: amount, currency: 'CNY' },
          payer: { openid: userId },
          plan,
        });
      } catch (err) {
        await prisma.order
          .update({
            where: { id: created.id },
            data: { status: 'failed' },
          })
          .catch(() => {});
        throw err;
      }

      const updated = await prisma.order.update({
        where: { id: created.id },
        data: {
          wx_prepay_id: payment?.prepay_id ?? null,
          out_trade_no: payment?.out_trade_no ?? created.out_trade_no,
        },
      });

      return res.ok(serializeOrder(updated));
    } catch (err) {
      next(err);
    }
  });

  router.get('/v1/order/status', jwtMiddleware, async (req, res, next) => {
    try {
      await ensureOrderSchema();

      const outTradeNo = req.query?.out_trade_no ?? req.query?.outTradeNo;
      if (!outTradeNo || typeof outTradeNo !== 'string') {
        return res.fail(400, 'out_trade_no required');
      }

      const userId = String(req.user?.id || '');
      if (!userId) {
        return res.fail(401, 'unauthorized');
      }

      const order = await prisma.order.findUnique({ where: { out_trade_no: outTradeNo } });
      if (!order) {
        return res.fail(404, 'order not found');
      }

      if (order.user_id !== userId) {
        return res.fail(403, 'forbidden');
      }

      return res.ok(serializeOrder(order));
    } catch (err) {
      next(err);
    }
  });

  router.post('/v1/order/callback', async (req, res, next) => {
    try {
      await ensureOrderSchema();

      let verification;
      try {
        verification = await verifyCallback(req.headers, req.body);
      } catch (err) {
        if (err?.code === 'ERR_WXPAY_INVALID_SIGNATURE') {
          return res.fail(403, 'invalid signature');
        }
        throw err;
      }

      const outTradeNo = verification?.out_trade_no;
      if (!outTradeNo) {
        return res.fail(400, 'out_trade_no required');
      }

      const order = await prisma.order.findUnique({ where: { out_trade_no: outTradeNo } });
      if (!order) {
        return res.fail(404, 'order not found');
      }

      const amountFromCallback = req.body?.amount ?? req.body?.resource?.amount?.total;
      if (
        amountFromCallback != null &&
        Number.parseInt(amountFromCallback, 10) !== Number(order.amount)
      ) {
        return res.fail(400, 'amount mismatch');
      }

      const successTime = normaliseSuccessTime(
        verification.success_time ?? req.body?.resource?.success_time
      );

      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.order.findUnique({ where: { out_trade_no: outTradeNo } });
        if (!current) {
          return null;
        }
        if (current.status === 'paid') {
          return current;
        }
        return tx.order.update({
          where: { out_trade_no: outTradeNo },
          data: {
            status: 'paid',
            paid_at: successTime,
          },
        });
      });

      if (!updated) {
        return res.fail(404, 'order not found');
      }

      return res.ok(serializeOrder(updated));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export default createOrderRouter;
