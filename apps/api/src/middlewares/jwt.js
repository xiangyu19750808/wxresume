import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  const message = "JWT_SECRET environment variable is required";
  console.error(message);
  throw new Error(message);
}

const unauthorizedResponse = (res) => {
  if (typeof res.fail === "function") {
    return res.fail(401, "unauthorized");
  }
  return res.status(401).json({ code: 401, msg: "unauthorized" });
};

const extractBearerToken = (headerValue = "") => {
  if (typeof headerValue !== "string") return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const parseCookieHeader = (cookieHeader = "") => {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) return {};
  return cookieHeader.split(";").reduce((acc, segment) => {
    const [rawKey, ...rest] = segment.split("=");
    const key = rawKey ? rawKey.trim() : "";
    if (!key) return acc;
    acc[key] = rest.join("=").trim();
    return acc;
  }, {});
};

const pickToken = (req) => {
  const bearer = extractBearerToken(req.headers?.authorization);
  if (bearer) return bearer;

  const headerToken =
    (req.headers && (req.headers["x-auth-token"] || req.headers["x-wx-token"] || req.headers["wx-token"])) ||
    req.headers?.token;
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  if (typeof req.headers?.authorization === "string" && req.headers.authorization.trim()) {
    return req.headers.authorization.trim();
  }

  const query = req.query || {};
  const queryToken = query.token || query.access_token || query.accessToken;
  if (typeof queryToken === "string" && queryToken.trim()) {
    return queryToken.trim();
  }

  const cookies = parseCookieHeader(req.headers?.cookie);
  const cookieToken =
    cookies.token ||
    cookies.wx_token ||
    cookies["wx-token"] ||
    cookies["auth-token"];
  if (typeof cookieToken === "string" && cookieToken.trim()) {
    return cookieToken.trim();
  }

  return null;
};

const jwtMiddleware = (req, res, next) => {
  try {
    const token = pickToken(req);
    if (!token) {
      return unauthorizedResponse(res);
    }

    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    const { id, role } = payload || {};

    if (!id || !role) {
      return unauthorizedResponse(res);
    }

    req.user = { id, role, token };
    return next();
  } catch (err) {
    return unauthorizedResponse(res);
  }
};

export default jwtMiddleware;
export { extractBearerToken as extractToken, pickToken };
