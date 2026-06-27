// k6 load test for the read-hot path: health + the feed query.
//
//   k6 run -e BASE_URL=https://campus-music-api.fly.dev scripts/k6/feed-load.js
//
// Ramps to 100 virtual users and asserts p95 latency + error budget. The feed is
// optionalAuth, so it exercises the global-feed path without tokens.
//
// NOTE: the Socket.io gateway (DMs / live / TV / notifications) uses a custom
// handshake k6's raw WS client can't speak; load-test it with a Socket.io-aware
// tool (e.g. artillery + artillery-engine-socketio). Tracked as a follow-up.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/api/healthz`);
  check(health, { "health 200": (r) => r.status === 200 });

  const feed = http.get(`${BASE_URL}/api/feed?limit=20`);
  check(feed, {
    "feed 200": (r) => r.status === 200,
    "feed has items": (r) => Array.isArray(r.json("items")),
  });

  sleep(1);
}
