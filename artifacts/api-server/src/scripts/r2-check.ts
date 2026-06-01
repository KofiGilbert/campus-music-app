/**
 * Cloudflare R2 connectivity check (Phase 0).
 *
 * Proves the R2 credentials + bucket work end to end via the S3-compatible API:
 * PUT a tiny object, HEAD it, then DELETE it. Exits non-zero on any failure.
 *
 * Run locally:  pnpm --filter @workspace/api-server run r2:check
 * (reads R2_* from artifacts/api-server/.env; in CI/prod the vars come from the
 *  ambient environment / Fly secrets).
 */
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Load the local .env when present; a no-op when env is already provided (CI/prod).
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the ambient environment.
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const endpoint = required("R2_ENDPOINT");
  const bucket = required("R2_BUCKET");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");

  const s3 = new S3Client({
    region: "auto", // R2 ignores region but the SDK requires one.
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const key = `__connectivity-check__/${process.pid}-${Date.now()}.txt`;
  const body = "campus-music r2 connectivity check";

  console.log(`R2 connectivity check -> bucket "${bucket}" @ ${endpoint}`);

  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "text/plain" }),
  );
  console.log(`  PUT    ok  (${key})`);

  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`  HEAD   ok  (${head.ContentLength ?? "?"} bytes)`);

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`  DELETE ok`);

  console.log("R2 connectivity OK");
}

main().catch((err: unknown) => {
  console.error("R2 connectivity FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
