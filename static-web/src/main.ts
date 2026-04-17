import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const app = document.querySelector<HTMLDivElement>("#app")!;

type TeamCredentialRow = {
  id: string;
  title: string;
  login: string | null;
  password: string;
  url: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

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
            ? `<p style="color:#b91c1c;font-size:0.875rem">Chybí <code>static-web/.env.production</code> (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>`
            : ""
        }
        ${msg ? `<p style="color:#b91c1c;font-size:0.875rem">${esc(msg)}</p>` : ""}
        <p style="font-size:0.75rem;color:#71717a;margin-bottom:1rem">
          Uživatelské jméno (admin / jan) a heslo = <code>FOX_SHARED_PASSWORD</code> (po <code>npm run sync-auth</code>).
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
    await showApp(supabase);
  });
}

function newCredentialId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function loadCredentials(supabase: ReturnType<typeof createClient>): Promise<{
  rows: TeamCredentialRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("TeamCredential")
    .select("*")
    .order("sortOrder", { ascending: true })
    .order("title", { ascending: true });
  if (error) return { rows: [], error: error.message };
  return { rows: (data as TeamCredentialRow[]) ?? [], error: null };
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

  const { rows, error: loadErr } = await loadCredentials(supabase);

  const rowsHtml =
    rows.length === 0
      ? `<p style="color:#71717a;font-size:0.875rem">Zatím žádné záznamy — přidej první účet níže.</p>`
      : `<div style="overflow-x:auto;margin-bottom:1.25rem">
          <table style="width:100%;border-collapse:collapse;font-size:0.8125rem">
            <thead>
              <tr style="text-align:left;border-bottom:1px solid #e4e4e7">
                <th style="padding:0.5rem 0.35rem">Účet / služba</th>
                <th style="padding:0.5rem 0.35rem">Login</th>
                <th style="padding:0.5rem 0.35rem">Heslo</th>
                <th style="padding:0.5rem 0.35rem">Odkaz</th>
                <th style="padding:0.5rem 0.35rem">Pozn.</th>
                <th style="padding:0.5rem 0.35rem;width:4rem"></th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((r) => {
                  const link =
                    r.url && /^https?:\/\//i.test(r.url)
                      ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:#2563eb">otevřít</a>`
                      : esc(r.url || "—");
                  return `<tr style="border-bottom:1px solid #f4f4f5;vertical-align:top">
                    <td style="padding:0.5rem 0.35rem;font-weight:600">${esc(r.title)}</td>
                    <td style="padding:0.5rem 0.35rem;word-break:break-all">${esc(r.login || "—")}</td>
                    <td style="padding:0.5rem 0.35rem">
                      <code style="font-size:0.75rem;word-break:break-all">${esc(r.password)}</code>
                      <button type="button" class="copy-pw" data-id="${esc(r.id)}" style="margin-left:0.35rem;padding:0.15rem 0.4rem;font-size:0.7rem;cursor:pointer;border:1px solid #d4d4d8;border-radius:0.35rem;background:#fafafa">Kopírovat</button>
                    </td>
                    <td style="padding:0.5rem 0.35rem">${link}</td>
                    <td style="padding:0.5rem 0.35rem;color:#52525b;max-width:10rem">${esc(r.notes || "—")}</td>
                    <td style="padding:0.5rem 0.35rem">
                      <button type="button" class="del-row" data-id="${esc(r.id)}" style="padding:0.25rem 0.45rem;font-size:0.7rem;color:#b91c1c;border:1px solid #fecaca;border-radius:0.35rem;background:#fef2f2;cursor:pointer">Smazat</button>
                    </td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`;

  app.innerHTML = `
    <div style="min-height:100vh;background:#f4f4f5;font-family:system-ui,sans-serif;padding:1.5rem">
      <div style="max-width:56rem;margin:0 auto;background:#fff;padding:1.5rem;border-radius:1rem;box-shadow:0 1px 3px #0001">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:1rem">
          <div>
            <p style="margin:0 0 0.25rem;font-size:0.875rem;color:#71717a">Přihlášen</p>
            <h1 style="margin:0;font-size:1.25rem">${esc(name)} <span style="font-weight:400;color:#71717a;font-size:0.875rem">(${esc(role)})</span></h1>
          </div>
          <button id="out" type="button" style="padding:0.5rem 1rem;background:#e4e4e7;border:none;border-radius:0.5rem;cursor:pointer">Odhlásit</button>
        </div>
        ${loadErr ? `<p style="color:#b91c1c;font-size:0.875rem;margin:0 0 1rem">Načtení tabulky: ${esc(loadErr)}</p>` : ""}
        <h2 style="margin:0 0 0.75rem;font-size:1rem">Účty a hesla</h2>
        <p style="margin:0 0 1rem;font-size:0.8rem;color:#71717a">Data v Supabase tabulce <code>TeamCredential</code> (RLS: jen přihlášení).</p>
        ${rowsHtml}
        <h3 style="margin:0 0 0.75rem;font-size:0.9375rem">Přidat záznam</h3>
        <form id="add" style="display:grid;gap:0.65rem;max-width:32rem">
          <label style="font-size:0.8125rem">Název účtu / služby *
            <input name="title" required style="display:block;width:100%;margin-top:0.25rem;padding:0.45rem;border:1px solid #d4d4d8;border-radius:0.5rem" />
          </label>
          <label style="font-size:0.8125rem">Login / e-mail
            <input name="login" style="display:block;width:100%;margin-top:0.25rem;padding:0.45rem;border:1px solid #d4d4d8;border-radius:0.5rem" />
          </label>
          <label style="font-size:0.8125rem">Heslo *
            <input name="password" type="text" required autocomplete="off" style="display:block;width:100%;margin-top:0.25rem;padding:0.45rem;border:1px solid #d4d4d8;border-radius:0.5rem" />
          </label>
          <label style="font-size:0.8125rem">URL (volitelně)
            <input name="url" placeholder="https://…" style="display:block;width:100%;margin-top:0.25rem;padding:0.45rem;border:1px solid #d4d4d8;border-radius:0.5rem" />
          </label>
          <label style="font-size:0.8125rem">Poznámka
            <textarea name="notes" rows="2" style="display:block;width:100%;margin-top:0.25rem;padding:0.45rem;border:1px solid #d4d4d8;border-radius:0.5rem;resize:vertical"></textarea>
          </label>
          <button type="submit" style="justify-self:start;padding:0.55rem 1rem;background:#18181b;color:#fff;border:none;border-radius:0.5rem;font-weight:600;cursor:pointer">Uložit</button>
        </form>
        <p style="margin:1.25rem 0 0;font-size:0.75rem;color:#a1a1aa">Plná aplikace (účtenky) zůstává na Vercelu.</p>
      </div>
    </div>`;

  document.getElementById("out")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    renderLogin(null);
  });

  const byId = new Map(rows.map((r) => [r.id, r]));
  app.querySelectorAll<HTMLButtonElement>(".copy-pw").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const pw = id ? byId.get(id)?.password ?? "" : "";
      try {
        await navigator.clipboard.writeText(pw);
        btn.textContent = "Hotovo";
        setTimeout(() => {
          btn.textContent = "Kopírovat";
        }, 1200);
      } catch {
        btn.textContent = "Nelze";
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>(".del-row").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (!id || !confirm("Opravdu smazat tento záznam?")) return;
      const { error } = await supabase.from("TeamCredential").delete().eq("id", id);
      if (error) alert(error.message);
      else await showApp(supabase);
    });
  });

  const addForm = document.getElementById("add") as HTMLFormElement;
  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const title = String(fd.get("title") || "").trim();
    const password = String(fd.get("password") || "");
    if (!title || !password) return;
    const login = String(fd.get("login") || "").trim() || null;
    const urlVal = String(fd.get("url") || "").trim() || null;
    const notes = String(fd.get("notes") || "").trim() || null;
    const now = new Date().toISOString();
    const { error } = await supabase.from("TeamCredential").insert({
      id: newCredentialId(),
      title,
      login,
      password,
      url: urlVal,
      notes,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    if (error) alert(error.message);
    else await showApp(supabase);
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
  if (session) await showApp(supabase);
  else renderLogin(null);
}

boot();
