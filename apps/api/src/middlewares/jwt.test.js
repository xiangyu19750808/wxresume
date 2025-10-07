import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test-secret";

const { default: jwtMiddleware } = await import("./jwt.js");

const createRes = () => {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
};

test("returns 401 when authorization header is missing", () => {
  const req = { headers: {} };
  const res = createRes();
  let nextCalled = false;

  jwtMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { code: 401, msg: "unauthorized" });
});

test("attaches user payload when token is valid", () => {
  const token = jwt.sign({ id: "user-1", role: "user" }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h"
  });

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createRes();
  let nextCalled = false;

  jwtMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.body, null);
  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { id: "user-1", role: "user" });
});

test("rejects requests when token is invalid or expired", () => {
  const invalidToken = jwt.sign({ id: "user-2", role: "user" }, "wrong-secret", {
    algorithm: "HS256",
    expiresIn: "1h"
  });

  const invalidReq = { headers: { authorization: `Bearer ${invalidToken}` } };
  const invalidRes = createRes();
  let invalidNext = false;

  jwtMiddleware(invalidReq, invalidRes, () => {
    invalidNext = true;
  });

  assert.equal(invalidNext, false);
  assert.equal(invalidRes.statusCode, 401);
  assert.deepEqual(invalidRes.body, { code: 401, msg: "unauthorized" });

  const expiredToken = jwt.sign({ id: "user-3", role: "user" }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: -1
  });

  const expiredReq = { headers: { authorization: `Bearer ${expiredToken}` } };
  const expiredRes = createRes();
  let expiredNext = false;

  jwtMiddleware(expiredReq, expiredRes, () => {
    expiredNext = true;
  });

  assert.equal(expiredNext, false);
  assert.equal(expiredRes.statusCode, 401);
  assert.deepEqual(expiredRes.body, { code: 401, msg: "unauthorized" });
});
