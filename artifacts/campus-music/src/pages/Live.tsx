import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AdminLiveSession {
  id: string;
  hostUserId: string;
  title: string;
  listenerCount: number;
  startedAt: string;
}

export function Live() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["/admin/live-sessions"],
    queryFn: () => api.get<{ items: AdminLiveSession[] }>("/admin/live-sessions"),
    refetchInterval: 10000,
  });

  const forceEnd = async (id: string) => {
    if (!confirm("Force-end this live session?")) return;
    await api.post(`/admin/live-sessions/${id}/end`);
    qc.invalidateQueries({ queryKey: ["/admin/live-sessions"] });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Live sessions</h1>
      {isLoading ? (
        <div className="text-neutral-400">Loading…</div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="text-neutral-400">Nobody is live right now.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="py-2">Title</th>
              <th>Listeners</th>
              <th>Started</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((s) => (
              <tr key={s.id} className="border-b border-neutral-900">
                <td className="py-2">{s.title || <span className="text-neutral-500">(untitled)</span>}</td>
                <td>{s.listenerCount}</td>
                <td className="text-neutral-400">{new Date(s.startedAt).toLocaleTimeString()}</td>
                <td className="text-right">
                  <button onClick={() => forceEnd(s.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">Force end</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
