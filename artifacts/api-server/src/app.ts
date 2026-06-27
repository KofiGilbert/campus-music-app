import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { captureException } from "./instrument";

const app: Express = express();

// Trust one proxy hop (Fly's edge / load balancer) so req.ip is the real client
// address rather than the proxy's. The rate limiter keys on req.ip, so without
// this every request would share a single proxy-IP bucket. A fixed count (not
// `true`) avoids express-rate-limit's IP-spoofing warning — we trust exactly the
// one hop in front of us. Harmless in local dev (no proxy → no hop to trust).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS allow-list: restrict to ALLOWED_ORIGINS (comma-separated) when set;
// permissive when unset (local dev). Native mobile sends no Origin header, so
// this only gates browser clients (the web + admin SPAs).
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  logger.warn("ALLOWED_ORIGINS is empty in production — CORS is running permissively");
}
app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Central error handler — consistent { error } shape. Express 5 forwards rejected
// promises from async handlers here. Full error is logged + reported to Sentry;
// details are only surfaced to clients outside production.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled request error");
  captureException(err);
  if (res.headersSent) return;
  const exposeDetail = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: exposeDetail && err instanceof Error ? err.message : "Internal Server Error",
  });
});

export default app;
