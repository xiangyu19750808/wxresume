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

const extractToken = (headerValue = "") => {
  if (typeof headerValue !== "string") return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const jwtMiddleware = (req, res, next) => {
  try {
    const token = extractToken(req.headers?.authorization);
    if (!token) {
      return unauthorizedResponse(res);
    }

    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    const { id, role } = payload || {};

    if (!id || !role) {
      return unauthorizedResponse(res);
    }

    req.user = { id, role };
    return next();
  } catch (err) {
    return unauthorizedResponse(res);
  }
};

export default jwtMiddleware;
export { extractToken };
