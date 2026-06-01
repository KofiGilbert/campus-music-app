import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Liveness — the process is up. Intentionally does NOT touch the DB: a transient
// DB blip must not make Fly's health check restart-loop the machine. Fly's
// http_service check points here (fly.toml).
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness — can we actually serve traffic (DB reachable)? Used by monitoring /
// load-balancer drain decisions. Ops endpoint; not part of the client API spec.
router.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: "ok" });
  } catch (err) {
    logger.error({ err }, "Readiness check failed (DB unreachable)");
    res.status(503).json({ status: "unavailable" });
  }
});

export default router;
