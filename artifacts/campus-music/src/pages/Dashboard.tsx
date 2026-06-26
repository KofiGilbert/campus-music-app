import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Analytics {
  totals: { users: number; artists: number; tracks: number; posts: number; liveNow: number };
  signupsByDay: { day: string; n: number }[];
  playsByDay: { day: string; n: number }[];
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
      <div className="mt-1 text-sm text-neutral-400">{label}</div>
    </div>
  );
}

function MiniBars({ title, data }: { title: string; data: { day: string; n: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-3 text-sm font-semibold text-neutral-300">{title}</div>
      <div className="flex h-32 items-end gap-1">
        {data.length === 0 && <div className="text-sm text-neutral-500">No data yet</div>}
        {data.map((d) => (
          <div key={d.day} className="flex-1" title={`${d.day}: ${d.n}`}>
            <div className="rounded-t bg-emerald-500" style={{ height: `${(d.n / max) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["/admin/analytics"], queryFn: () => api.get<Analytics>("/admin/analytics") });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      {isLoading || !data ? (
        <div className="text-neutral-400">Loading…</div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
            <Stat label="Users" value={data.totals.users} />
            <Stat label="Artists" value={data.totals.artists} />
            <Stat label="Tracks" value={data.totals.tracks} />
            <Stat label="Posts" value={data.totals.posts} />
            <Stat label="Live now" value={data.totals.liveNow} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <MiniBars title="Signups (14 days)" data={data.signupsByDay} />
            <MiniBars title="Plays (14 days)" data={data.playsByDay} />
          </div>
        </>
      )}
    </div>
  );
}
