import { Link, useLocation, Redirect } from "wouter";
import { clearToken, getToken } from "@/lib/api";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/flags", label: "Flags" },
  { href: "/moderation", label: "Moderation" },
  { href: "/tracks", label: "Tracks" },
  { href: "/live", label: "Live" },
  { href: "/shows", label: "Campus TV" },
  { href: "/broadcast", label: "Broadcast" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();

  if (!getToken()) return <Redirect to="/login" />;

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="w-56 shrink-0 border-r border-neutral-800 p-4 flex flex-col">
        <div className="text-lg font-bold mb-6 px-2">Campus Admin</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = location === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-md px-3 py-2 text-sm ${
                  active ? "bg-neutral-800 font-semibold" : "text-neutral-400 hover:bg-neutral-900"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="mt-auto rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 text-left">
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
