import { logger } from "./logger";

// Single touchpoint for the Cloudflare Stream API (DEVIN_ROADMAP §3.6b/§3.17):
// create the RTMPS ingest input, resolve the HLS playback + auto-VOD URLs, and
// tear inputs down. Credentials (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_TOKEN
// / CLOUDFLARE_CUSTOMER_SUBDOMAIN) are provisioned by Kofi when ready. Until then
// the Disabled adapter returns deterministic stub ingest/playback values so the
// whole show lifecycle (schedule -> start -> chat -> end -> VOD) is testable
// without a Cloudflare account — the same pattern as LiveKit/storage/email.

export interface LiveInput {
  streamId: string;
  rtmpsUrl: string;
  streamKey: string;
  playbackUrl: string;
}

export interface CloudflareStreamService {
  isEnabled(): boolean;
  createLiveInput(name: string): Promise<LiveInput>;
  deleteLiveInput(streamId: string): Promise<void>;
  /** Resolve the recorded VOD playback URL for an ended live input, if any. */
  getVodUrl(streamId: string): Promise<string | null>;
}

const CF_API = "https://api.cloudflare.com/client/v4";

class HttpCloudflareStreamService implements CloudflareStreamService {
  constructor(
    private readonly accountId: string,
    private readonly token: string,
    private readonly customerSubdomain: string,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" };
  }

  private playback(uid: string): string {
    return `https://${this.customerSubdomain}/${uid}/manifest/video.m3u8`;
  }

  async createLiveInput(name: string): Promise<LiveInput> {
    const res = await fetch(`${CF_API}/accounts/${this.accountId}/stream/live_inputs`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        meta: { name },
        recording: { mode: "automatic" }, // auto-VOD
      }),
    });
    if (!res.ok) throw new Error(`Cloudflare createLiveInput failed: ${res.status}`);
    const json = (await res.json()) as {
      result: { uid: string; rtmps: { url: string; streamKey: string } };
    };
    const { uid, rtmps } = json.result;
    return { streamId: uid, rtmpsUrl: rtmps.url, streamKey: rtmps.streamKey, playbackUrl: this.playback(uid) };
  }

  async deleteLiveInput(streamId: string): Promise<void> {
    await fetch(`${CF_API}/accounts/${this.accountId}/stream/live_inputs/${streamId}`, {
      method: "DELETE",
      headers: this.headers(),
    }).catch((err) => logger.warn({ err }, "Cloudflare deleteLiveInput failed"));
  }

  async getVodUrl(streamId: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${CF_API}/accounts/${this.accountId}/stream/live_inputs/${streamId}/videos`,
        { headers: this.headers() },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { result: { uid: string }[] };
      const vod = json.result?.[0];
      return vod ? this.playback(vod.uid) : null;
    } catch (err) {
      logger.warn({ err }, "Cloudflare getVodUrl failed");
      return null;
    }
  }
}

class DisabledCloudflareStreamService implements CloudflareStreamService {
  isEnabled(): boolean {
    return false;
  }
  async createLiveInput(name: string): Promise<LiveInput> {
    // Deterministic dev stub — no real streaming, but the lifecycle works.
    const slug = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || "dev";
    return {
      streamId: `dev-${slug}`,
      rtmpsUrl: "rtmps://dev.local/live",
      streamKey: `dev-key-${slug}`,
      playbackUrl: `https://dev.local/hls/dev-${slug}.m3u8`,
    };
  }
  async deleteLiveInput(): Promise<void> {}
  async getVodUrl(streamId: string): Promise<string | null> {
    return `https://dev.local/vod/${streamId}.m3u8`;
  }
}

function build(): CloudflareStreamService {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_TOKEN;
  const subdomain = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN;
  if (accountId && token && subdomain) {
    logger.info("Cloudflare Stream service enabled");
    return new HttpCloudflareStreamService(accountId, token, subdomain);
  }
  logger.warn("Cloudflare Stream not configured — using dev stub (shows + chat still work)");
  return new DisabledCloudflareStreamService();
}

export const cloudflareStream: CloudflareStreamService = build();
