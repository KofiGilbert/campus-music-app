import { useState } from "react";
import { useLocation } from "wouter";
import { ApiError, login } from "@/lib/api";

export function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Invalid credentials" : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <form onSubmit={submit} className="w-80 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="mb-1 text-xl font-bold">Campus Admin</h1>
        <p className="mb-6 text-sm text-neutral-400">Sign in with an admin account.</p>
        <label className="mb-1 block text-sm">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          required
        />
        <label className="mb-1 block text-sm">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          required
        />
        {error && <div className="mb-4 text-sm text-red-400">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
