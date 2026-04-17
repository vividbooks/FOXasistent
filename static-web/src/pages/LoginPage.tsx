import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase, supabaseConfigured } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    if (!supabaseConfigured) {
      setMsg("Chybí VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY v .env.production.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("u") || "")
      .trim()
      .toLowerCase();
    const password = String(fd.get("p") || "");
    if (!username || !password) return;
    setBusy(true);
    const email = `${username}@fox-app.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setMsg(error.message === "Invalid login credentials" ? "Špatné jméno nebo heslo." : error.message);
      return;
    }
    await refresh();
    const { data } = await supabase.auth.getSession();
    const role = data.session?.user.user_metadata?.role as string | undefined;
    navigate(role === "ADMIN" ? "/admin" : "/employee", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow">
        <h1 className="text-xl font-semibold text-zinc-900">FOX Catering</h1>
        <p className="mt-1 text-sm text-zinc-500">GitHub Pages + Supabase</p>
        {!supabaseConfigured ? (
          <p className="mt-4 text-sm text-red-700">Chybí konfigurace Supabase (build / .env.production).</p>
        ) : null}
        {msg ? <p className="mt-4 text-sm text-red-700">{msg}</p> : null}
        <p className="mt-4 text-xs text-zinc-500">
          Uživatelské jméno (např. admin, jan) a heslo z <code className="rounded bg-zinc-100 px-1">FOX_SHARED_PASSWORD</code>.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            Jméno
            <input
              name="u"
              required
              autoComplete="username"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Heslo
            <input
              name="p"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Přihlásit"}
          </button>
        </form>
      </div>
    </div>
  );
}
