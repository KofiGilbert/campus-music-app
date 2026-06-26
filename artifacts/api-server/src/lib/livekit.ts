import { SignJWT } from "jose";
import { logger } from "./logger";

// LiveKit access-token minting. A LiveKit JWT is a standard HS256 JWT signed with
// the project API secret, carrying a `video` grant (room + publish/subscribe
// rights). We mint it directly with `jose` (already a dependency) instead of
// pulling in livekit-server-sdk — fewer deps, and the token format is stable.
//
// Credentials (LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_WS_URL) are
// provisioned by Kofi when ready. Until then isEnabled() is false and the token
// endpoint returns 503; everything else (sessions, chat, presence) still works,
// so the flow is testable end-to-end without a LiveKit account.

interface MintOptions {
  room: string;
  identity: string;
  name?: string;
  canPublish: boolean;
}

export interface LiveKitService {
  isEnabled(): boolean;
  wsUrl(): string | null;
  mintToken(opts: MintOptions): Promise<string>;
}

export class JoseLiveKitService implements LiveKitService {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly url: string,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  wsUrl(): string {
    return this.url;
  }

  async mintToken({ room, identity, name, canPublish }: MintOptions): Promise<string> {
    const secret = new TextEncoder().encode(this.apiSecret);
    // 6-hour token TTL — long enough for a live set, short enough to bound abuse.
    return new SignJWT({
      name,
      video: {
        room,
        roomJoin: true,
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(this.apiKey)
      .setSubject(identity)
      .setIssuedAt()
      .setExpirationTime("6h")
      .sign(secret);
  }
}

class DisabledLiveKitService implements LiveKitService {
  isEnabled(): boolean {
    return false;
  }
  wsUrl(): null {
    return null;
  }
  async mintToken(): Promise<string> {
    throw new Error("LiveKit is not configured");
  }
}

function build(): LiveKitService {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_WS_URL;
  if (apiKey && apiSecret && url) {
    logger.info("LiveKit service enabled");
    return new JoseLiveKitService(apiKey, apiSecret, url);
  }
  logger.warn("LiveKit not configured — live token minting disabled (sessions + chat still work)");
  return new DisabledLiveKitService();
}

export const livekit: LiveKitService = build();
