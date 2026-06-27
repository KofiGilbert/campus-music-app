import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AdminPost {
  id: string;
  authorUserId: string;
  body: string;
  type: string;
  createdAt: string;
}
interface AdminComment {
  id: string;
  authorUserId: string;
  targetType: string;
  targetId: string;
  body: string;
  createdAt: string;
}

export function Moderation() {
  const qc = useQueryClient();
  const posts = useQuery({ queryKey: ["/admin/posts"], queryFn: () => api.get<{ items: AdminPost[] }>("/admin/posts") });
  const comments = useQuery({ queryKey: ["/admin/comments"], queryFn: () => api.get<{ items: AdminComment[] }>("/admin/comments") });

  const delPost = async (id: string) => {
    await api.del(`/admin/posts/${id}`);
    qc.invalidateQueries({ queryKey: ["/admin/posts"] });
  };
  const delComment = async (id: string) => {
    await api.del(`/admin/comments/${id}`);
    qc.invalidateQueries({ queryKey: ["/admin/comments"] });
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-4 text-2xl font-bold">Posts</h1>
        <div className="space-y-2">
          {(posts.data?.items ?? []).map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm">{p.body || <span className="text-neutral-500">(no text)</span>}</div>
                <div className="text-xs text-neutral-500">{p.type} · {new Date(p.createdAt).toLocaleString()}</div>
              </div>
              <button onClick={() => delPost(p.id)} className="shrink-0 rounded bg-red-600 px-2 py-1 text-xs text-white">Delete</button>
            </div>
          ))}
          {posts.data?.items.length === 0 && <div className="text-neutral-400">No posts.</div>}
        </div>
      </div>

      <div>
        <h1 className="mb-4 text-2xl font-bold">Comments</h1>
        <div className="space-y-2">
          {(comments.data?.items ?? []).map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm">{c.body}</div>
                <div className="text-xs text-neutral-500">on {c.targetType} · {new Date(c.createdAt).toLocaleString()}</div>
              </div>
              <button onClick={() => delComment(c.id)} className="shrink-0 rounded bg-red-600 px-2 py-1 text-xs text-white">Delete</button>
            </div>
          ))}
          {comments.data?.items.length === 0 && <div className="text-neutral-400">No comments.</div>}
        </div>
      </div>
    </div>
  );
}
