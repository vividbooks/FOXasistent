import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

type Row = {
  id: string;
  title: string;
  login: string | null;
  password: string;
  url: string | null;
  notes: string | null;
};

export default function CredentialsPage() {
  const { displayName, role, signOut } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(async () => {
    setErr(null);
    const { data, error } = await supabase
      .from("TeamCredential")
      .select("*")
      .order("sortOrder", { ascending: true })
      .order("title", { ascending: true });
    if (error) setErr(error.message);
    else setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load, reload]);

  const byId = new Map(rows.map((r) => [r.id, r]));

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6 rounded-2xl bg-white p-6 shadow">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Účty a hesla · {displayName} ({role})</p>
            <h1 className="text-lg font-semibold text-zinc-900">TeamCredential</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={role === "ADMIN" ? "/admin" : "/employee"}
              className="rounded-lg bg-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800"
            >
              Zpět do aplikace
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm text-zinc-600 underline"
            >
              Odhlásit
            </button>
          </div>
        </header>

        {err ? <p className="text-sm text-red-700">{err}</p> : null}

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Zatím žádné záznamy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left">
                  <th className="p-2">Služba</th>
                  <th className="p-2">Login</th>
                  <th className="p-2">Heslo</th>
                  <th className="p-2">Odkaz</th>
                  <th className="p-2">Pozn.</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 align-top">
                    <td className="p-2 font-medium">{r.title}</td>
                    <td className="p-2 break-all">{r.login ?? "—"}</td>
                    <td className="p-2">
                      <code className="text-xs break-all">{r.password}</code>
                      <button
                        type="button"
                        className="ml-2 rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs"
                        data-id={r.id}
                        onClick={async (e) => {
                          const id = (e.currentTarget as HTMLButtonElement).dataset.id;
                          const pw = id ? byId.get(id)?.password ?? "" : "";
                          try {
                            await navigator.clipboard.writeText(pw);
                            e.currentTarget.textContent = "OK";
                            setTimeout(() => {
                              e.currentTarget.textContent = "Kopírovat";
                            }, 1000);
                          } catch {
                            e.currentTarget.textContent = "×";
                          }
                        }}
                      >
                        Kopírovat
                      </button>
                    </td>
                    <td className="p-2">
                      {r.url && /^https?:/i.test(r.url) ? (
                        <a href={r.url} className="text-sky-700 underline" target="_blank" rel="noopener noreferrer">
                          otevřít
                        </a>
                      ) : (
                        r.url ?? "—"
                      )}
                    </td>
                    <td className="max-w-[10rem] p-2 text-zinc-600">{r.notes ?? "—"}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="text-xs text-red-700 underline"
                        onClick={async () => {
                          if (!confirm("Smazat?")) return;
                          await supabase.from("TeamCredential").delete().eq("id", r.id);
                          setReload((x) => x + 1);
                        }}
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AddCredentialForm onAdded={() => setReload((x) => x + 1)} />
      </div>
    </div>
  );
}

function AddCredentialForm({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !password) return;
    setBusy(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("TeamCredential").insert({
      id: crypto.randomUUID(),
      title: title.trim(),
      login: login.trim() || null,
      password,
      url: url.trim() || null,
      notes: notes.trim() || null,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    setBusy(false);
    if (!error) {
      setTitle("");
      setLogin("");
      setPassword("");
      setUrl("");
      setNotes("");
      onAdded();
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 border-t border-zinc-100 pt-6">
      <h2 className="font-medium text-zinc-900">Přidat záznam</h2>
      <div className="grid max-w-md gap-2">
        <input
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Název *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Login"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <input
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Heslo *"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <textarea
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Poznámka"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Uložit
        </button>
      </div>
    </form>
  );
}
