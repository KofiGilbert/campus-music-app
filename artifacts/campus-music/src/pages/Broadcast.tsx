import { useState } from "react";
import { api } from "@/lib/api";

export function Broadcast() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState("all");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (!confirm(`Send this push to ${segment === "all" ? "all users" : segment + "s"}?`)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post<{ ok: boolean; recipients: number }>("/admin/broadcast", {
        title: title.trim() || undefined,
        body: body.trim(),
        segment: segment === "all" ? undefined : segment,
      });
      setResult(`Sent to ${res.recipients} user(s).`);
      setTitle("");
      setBody("");
    } catch {
      setResult("Failed to send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Push broadcast</h1>
      <form onSubmit={send} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Audience</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
          >
            <option value="all">All users</option>
            <option value="artist">Artists</option>
            <option value="listener">Listeners</option>
          </select>
        </div>
        {result && <div className="text-sm text-emerald-400">{result}</div>}
        <button type="submit" disabled={busy} className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50">
          {busy ? "Sending…" : "Send broadcast"}
        </button>
      </form>
    </div>
  );
}
