import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  verified: boolean;
  isAdmin: boolean;
  bannedAt: string | null;
}

export function Users() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["/admin/users", q],
    queryFn: () => api.get<{ items: AdminUser[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["/admin/users"] });
  const ban = async (u: AdminUser) => {
    await api.post(`/admin/users/${u.id}/ban`, { banned: !u.bannedAt });
    refresh();
  };
  const verify = async (u: AdminUser) => {
    await api.post(`/admin/users/${u.id}/verify`, { verified: !u.verified });
    refresh();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, username, email…"
        className="mb-4 w-80 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none"
      />
      {isLoading ? (
        <div className="text-neutral-400">Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-400">
            <tr className="border-b border-neutral-800">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((u) => (
              <tr key={u.id} className="border-b border-neutral-900">
                <td className="py-2">
                  {u.name} {u.verified && <span className="text-sky-400">✓</span>}{" "}
                  <span className="text-neutral-500">@{u.username}</span>
                </td>
                <td className="text-neutral-400">{u.email}</td>
                <td>{u.role}</td>
                <td>{u.bannedAt ? <span className="text-red-400">Banned</span> : "Active"}</td>
                <td className="text-right">
                  <button onClick={() => verify(u)} className="mr-2 rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800">
                    {u.verified ? "Unverify" : "Verify"}
                  </button>
                  <button
                    onClick={() => ban(u)}
                    className={`rounded px-2 py-1 text-xs ${u.bannedAt ? "border border-neutral-700 hover:bg-neutral-800" : "bg-red-600 text-white"}`}
                  >
                    {u.bannedAt ? "Unban" : "Ban"}
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
