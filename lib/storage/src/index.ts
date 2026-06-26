import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageClient } from "@supabase/storage-js";

export * from "./keys";

/**
 * Storage abstraction. Audio (large, client-direct upload) lives in Cloudflare
 * R2 via the S3-compatible adapter; images (small, server-side processed) live
 * in Supabase Storage. In dev/CI with no credentials, the in-memory adapter
 * stands in (uploads are no-ops, reads return placeholder URLs).
 */
export interface StorageProvider {
  getPresignedUploadUrl(key: string, contentType: string, ttlSec?: number): Promise<string>;
  getSignedReadUrl(key: string, ttlSec?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  putBuffer(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Download an object into memory (used by the transcoder to read raw uploads). */
  getBuffer(key: string): Promise<Buffer>;
}

const DEFAULT_UPLOAD_TTL = 900; // 15 min
const DEFAULT_READ_TTL = 3600; // 1 hour

// The AWS SDK ships sub-packages that resolve @smithy/types to slightly
// different versions, so S3Client and getSignedUrl's `client` parameter can
// reference distinct (structurally identical) Client types. This alias bridges
// them; getSignedUrl works with any S3Client at runtime.
type PresignClient = Parameters<typeof getSignedUrl>[0];

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Optional CDN base; when set, read URLs are CDN-prefixed instead of signed. */
  cdnUrl?: string;
}

/** Cloudflare R2 (S3-compatible) adapter — used for audio + transcoded artifacts. */
export class R2Adapter implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl?: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.cdnUrl = config.cdnUrl?.replace(/\/+$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  getPresignedUploadUrl(key: string, contentType: string, ttlSec = DEFAULT_UPLOAD_TTL): Promise<string> {
    return getSignedUrl(
      this.client as unknown as PresignClient,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: ttlSec },
    );
  }

  getSignedReadUrl(key: string, ttlSec = DEFAULT_READ_TTL): Promise<string> {
    if (this.cdnUrl) return Promise.resolve(`${this.cdnUrl}/${key}`);
    return getSignedUrl(
      this.client as unknown as PresignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSec },
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async putBuffer(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }),
    );
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }
}

export interface SupabaseStorageConfig {
  url: string;
  serviceKey: string;
  bucket: string;
  cdnUrl?: string;
}

/** Supabase Storage adapter — used for images (avatars, future image assets). */
export class SupabaseStorageAdapter implements StorageProvider {
  private readonly client: StorageClient;
  private readonly bucket: string;
  private readonly cdnUrl?: string;

  constructor(config: SupabaseStorageConfig) {
    this.bucket = config.bucket;
    this.cdnUrl = config.cdnUrl?.replace(/\/+$/, "");
    this.client = new StorageClient(`${config.url.replace(/\/+$/, "")}/storage/v1`, {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    });
  }

  async getPresignedUploadUrl(key: string, _contentType: string): Promise<string> {
    const { data, error } = await this.client.from(this.bucket).createSignedUploadUrl(key);
    if (error || !data) throw error ?? new Error("Failed to create signed upload URL");
    return data.signedUrl;
  }

  async getSignedReadUrl(key: string, ttlSec = DEFAULT_READ_TTL): Promise<string> {
    if (this.cdnUrl) return `${this.cdnUrl}/${key}`;
    const { data, error } = await this.client.from(this.bucket).createSignedUrl(key, ttlSec);
    if (error || !data) throw error ?? new Error("Failed to create signed read URL");
    return data.signedUrl;
  }

  async deleteObject(key: string): Promise<void> {
    const { error } = await this.client.from(this.bucket).remove([key]);
    if (error) throw error;
  }

  async objectExists(key: string): Promise<boolean> {
    const { error } = await this.client.from(this.bucket).createSignedUrl(key, 60);
    return !error;
  }

  async putBuffer(key: string, data: Buffer, contentType: string): Promise<void> {
    const { error } = await this.client
      .from(this.bucket)
      .upload(key, data, { contentType, upsert: true });
    if (error) throw error;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const { data, error } = await this.client.from(this.bucket).download(key);
    if (error || !data) throw error ?? new Error(`Failed to download ${key}`);
    return Buffer.from(await data.arrayBuffer());
  }
}

/** In-memory adapter for dev/CI/tests — no external service, no real persistence. */
export class MemoryStorageAdapter implements StorageProvider {
  private readonly store = new Map<string, Buffer>();
  constructor(private readonly label = "memory") {}

  getPresignedUploadUrl(key: string): Promise<string> {
    return Promise.resolve(`${this.label}://upload/${key}`);
  }

  getSignedReadUrl(key: string): Promise<string> {
    return Promise.resolve(`${this.label}://read/${key}`);
  }

  deleteObject(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  objectExists(key: string): Promise<boolean> {
    return Promise.resolve(this.store.has(key));
  }

  putBuffer(key: string, data: Buffer): Promise<void> {
    this.store.set(key, data);
    return Promise.resolve();
  }

  getBuffer(key: string): Promise<Buffer> {
    const buf = this.store.get(key);
    return buf ? Promise.resolve(buf) : Promise.reject(new Error(`Not found: ${key}`));
  }
}

function createAudioStorage(): StorageProvider {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET_NAME;
  if (accessKeyId && secretAccessKey && endpoint && bucket) {
    return new R2Adapter({
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucket,
      cdnUrl: process.env.AUDIO_CDN_URL,
    });
  }
  return new MemoryStorageAdapter("audio-memory");
}

function createImageStorage(): StorageProvider {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    return new SupabaseStorageAdapter({
      url,
      serviceKey,
      bucket: "images",
      cdnUrl: process.env.IMAGE_CDN_URL,
    });
  }
  return new MemoryStorageAdapter("image-memory");
}

/** Audio storage (R2 when configured, else in-memory). */
export const audioStorage: StorageProvider = createAudioStorage();

/** Image storage (Supabase when configured, else in-memory). */
export const imageStorage: StorageProvider = createImageStorage();
