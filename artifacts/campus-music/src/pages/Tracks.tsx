import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AdminTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  university: string | null;
  playCount: number;
  processingStatus: string | null;
}

export function Tracks() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["/admin/tracks", q],
    queryFn: () => api.get<{ items: AdminTrack[] }>(`/admin/tracks${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const takedown = async (id: string) => {
    if (!confirm("Take this track down? This cannot be undone.")) return;
    await api.del(`/admin/tracks/${id}`);
    qc.invalidateQueries({ queryKey: ["/admin/tracks"] });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Tracks</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search title or artist…"
        className="mb-4 w-80 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
      />
      {isLoading ? (
        <div className="text-neutral-400">Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="py-2">Title</th>
              <th>Artist</th>
              <th>Genre</th>
              <th>Plays</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((t) => (
              <tr key={t.id} className="border-b border-neutral-900">
                <td className="py-2">{t.title}</td>
                <td className="text-neutral-400">{t.artist}</td>
                <td>{t.genre}</td>
                <td>{t.playCount.toLocaleString()}</td>
                <td className="text-right">
                  <button onClick={() => takedown(t.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">
                    Take down
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
