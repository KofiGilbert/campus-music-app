import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Flag {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporterName: string;
}

export function Flags() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["/admin/flags"],
    queryFn: () => api.get<{ items: Flag[] }>("/admin/flags?status=open"),
  });

  const resolve = async (id: string, status: "resolved" | "dismissed") => {
    await api.post(`/admin/flags/${id}/resolve`, { status });
    qc.invalidateQueries({ queryKey: ["/admin/flags"] });
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Flag queue</h1>
      {isLoading ? (
        <div className="text-neutral-400">Loading…</div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="text-neutral-400">No open reports. 🎉</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="py-2">Target</th>
              <th>Reason</th>
              <th>Reporter</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((f) => (
              <tr key={f.id} className="border-b border-neutral-900 align-top">
                <td className="py-2">
                  <div className="font-medium">{f.targetType}</div>
                  <div className="text-xs text-neutral-500">{f.targetId}</div>
                </td>
                <td className="max-w-md text-neutral-300">{f.reason || <span className="text-neutral-600">—</span>}</td>
                <td className="text-neutral-400">{f.reporterName}</td>
                <td className="text-right">
                  <button onClick={() => resolve(f.id, "resolved")} className="mr-2 rounded bg-emerald-600 px-2 py-1 text-xs text-white">
                    Resolve
                  </button>
                  <button onClick={() => resolve(f.id, "dismissed")} className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800">
                    Dismiss
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
