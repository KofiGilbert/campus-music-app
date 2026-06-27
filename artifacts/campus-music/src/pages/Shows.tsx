import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Show {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string | null;
  viewerCount: number;
  playbackUrl: string | null;
  vodUrl: string | null;
}
interface StartResult {
  ingest: { rtmpsUrl: string; streamKey: string; streamId: string };
}

const TYPES = ["trending", "interview", "daily_show", "takeover", "listening_party", "special"];

export function Shows() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("special");
  const [scheduledAt, setScheduledAt] = useState("");
  const [ingest, setIngest] = useState<StartResult["ingest"] | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["/shows"], queryFn: () => api.get<{ items: Show[] }>("/shows") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["/shows"] });

  const schedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.post("/shows", { title: title.trim(), type, scheduledAt: scheduledAt || undefined });
    setTitle("");
    setScheduledAt("");
    refresh();
  };
  const start = async (id: string) => {
    const res = await api.post<StartResult>(`/shows/${id}/start`);
    setIngest(res.ingest);
    refresh();
  };
  const end = async (id: string) => {
    if (!confirm("End this broadcast?")) return;
    await api.post(`/shows/${id}/end`);
    refresh();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Campus Music TV</h1>

      <form onSubmit={schedule} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-56 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none" required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none">
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-400">Scheduled (optional)</label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none" />
        </div>
        <button type="submit" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-900">Schedule</button>
      </form>

      {ingest && (
        <div className="mb-6 rounded-xl border border-emerald-700 bg-emerald-950/40 p-4 text-sm">
          <div className="mb-2 font-semibold text-emerald-300">Ingest — paste into OBS / Streamyard</div>
          <div className="font-mono text-xs">RTMPS URL: {ingest.rtmpsUrl}</div>
          <div className="font-mono text-xs">Stream key: {ingest.streamKey}</div>
          <button onClick={() => setIngest(null)} className="mt-2 text-xs text-neutral-400 underline">dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="text-neutral-400">Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="py-2">Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Viewers</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((s) => (
              <tr key={s.id} className="border-b border-neutral-900">
                <td className="py-2">{s.title}</td>
                <td className="text-neutral-400">{s.type}</td>
                <td>
                  <span className={s.status === "live" ? "text-red-400" : s.status === "ended" ? "text-neutral-500" : "text-sky-400"}>
                    {s.status}
                  </span>
                </td>
                <td>{s.viewerCount}</td>
                <td className="text-right">
                  {s.status === "scheduled" && (
                    <button onClick={() => start(s.id)} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Go live</button>
                  )}
                  {s.status === "live" && (
                    <button onClick={() => end(s.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">End</button>
                  )}
                  {s.status === "ended" && s.vodUrl && (
                    <a href={s.vodUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline">VOD</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
