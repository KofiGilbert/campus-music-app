import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { audioStorage, storageKeys } from "@workspace/storage";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload";
}

/**
 * POST /storage/uploads/request-url
 *
 * Returns a presigned R2 PUT URL + the object key. The client PUTs the file
 * directly to R2, then sends the key to POST /tracks as `sourceKey` (audio)
 * and/or `coverSourceKey`. Artist-only. The raw object is later consumed by the
 * transcoder. Replaces the old GCS-proxy upload + object-serving routes —
 * objects are now served via signed read URLs, not proxied through the API.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (req.auth!.role !== "artist") {
      res.status(403).json({ error: "Only artists can upload files" });
      return;
    }

    const { filename, contentType } = req.body as { filename?: unknown; contentType?: unknown };
    const name =
      typeof filename === "string" && filename.trim() ? sanitizeFilename(filename) : "upload";
    const type =
      typeof contentType === "string" && contentType ? contentType : "application/octet-stream";

    // uuid-scoped raw key; the track row + final audio/ keys are created later by
    // POST /tracks + the transcoder.
    const key = storageKeys.rawUpload(randomUUID(), name);
    try {
      const uploadUrl = await audioStorage.getPresignedUploadUrl(key, type);
      res.json({ uploadUrl, key });
    } catch (err) {
      req.log.error({ err }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

export default router;
