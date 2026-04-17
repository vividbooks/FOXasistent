import { createClient, type Session } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const app = document.querySelector<HTMLDivElement>("#app")!;

function esc(s: string) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderLogin(msg: string | null) {
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f4f5;font-family:system-ui,sans-serif;padding:1rem">
      <div style="width:100%;max-width:22rem;background:#fff;padding:2rem;border-radius:1rem;box-shadow:0 1px 3px #0001">
        <h1 style="margin:0 0 0.25rem;font-size:1.25rem">FOX Catering</h1>
        <p style="margin:0 0 1rem;color:#71717a;font-size:0.875rem">GitHub Pages (Supabase Auth)</p>
        ${
          !url || !anon
            ? `<p style="color:#b91c1c;font-size:0.875rem">Chybí build proměnné VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (GitHub Actions secrets).</p>`
            : ""
        }
        ${msg ? `<p style="color:#b91c1c;font-size:0.875rem">${esc(msg)}</p>` : ""}
        <p style="font-size:0.75rem;color:#71717a;margin-bottom:1rem">
          Zadej <strong>uživatelské jméno</strong> (admin nebo jan) a heslo = tvoje
          <code>FOX_SHARED_PASSWORD</code> z Vercelu / .env (po příkazu <code>npm run sync-auth</code>).
        </p>
        <form id="f" style="display:flex;flex-direction:column;gap:0.75rem">
          <label style="font-size:0.875rem">
            Jméno
            <input name="u" required autocomplete="username" style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem;border:1px solid #d4d4d8;border-radius:0.5rem" />
          </label>
          <label style="font-size:0.875rem">
            Heslo
            <input name="p" type="password" required autocomplete="current-password" style="display:block;width:100%;margin-top:0.25rem;padding:0.5rem;border:1px solid #d4d4d8;border-radius:0.5rem" />
          </label>
          <button type="submit" style="padding:0.65rem;background:#18181b;color:#fff;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer">Přihlásit</button>
        </form>
      </div>
    </div>`;

  if (!url || !anon) return;

  const form = document.getElementById("f") as HTMLFormElement;
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const username = String(fd.get("u") || "")
      .trim()
      .toLowerCase();
    const password = String(fd.get("p") || "");
    const email = `${username}@fox-app.local`;
    const supabase = createClient(url, anon);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      renderLogin(error.message === "Invalid login credentials" ? "Špatné jméno nebo heslo." : error.message);
      return;
    }
    showApp(supabase);
  });
}

async function showApp(supabase: ReturnType<typeof createClient>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    renderLogin(null);
    return;
  }

  const meta = session.user.user_metadata as { role?: string; name?: string } | undefined;
  const role = meta?.role ?? "?";
  const name = meta?.name ?? session.user.email ?? "";

  app.innerHTML = `
    <div style="min-height:100vh;background:#f4f4f5;font-family:system-ui,sans-serif;padding:1.5rem">
      <div style="max-width:36rem;margin:0 auto;background:#fff;padding:1.5rem;border-radius:1rem;box-shadow:0 1px 3px #0001">
        <p style="margin:0 0 0.5rem;font-size:0.875rem;color:#71717a">Přihlášen</p>
        <h1 style="margin:0 0 1rem">${esc(name)}</h1>
        <p style="margin:0 0 1rem">Role: <strong>${esc(role)}</strong></p>
        <p style="font-size:0.875rem;color:#52525b;margin-bottom:1rem">
          Tohle je <strong>statická</strong> verze na GitHub Pages — data a účtenky dál běží v plné Next.js aplikaci (Vercel), dokud je nepřepíšeme na čisté Supabase dotazy z prohlížeče.
        </p>
        <button id="out" type="button" style="padding:0.5rem 1rem;background:#e4e4e7;border:none;border-radius:0.5rem;cursor:pointer">Odhlásit</button>
      </div>
    </div>`;

  document.getElementById("out")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    renderLogin(null);
  });
}

async function boot() {
  if (!url || !anon) {
    renderLogin(null);
    return;
  }
  const supabase = createClient(url, anon);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) showApp(supabase);
  else renderLogin(null);
}

boot();
