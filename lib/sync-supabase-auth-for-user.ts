import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";

export type ProvisionResult =
  | { ok: true; authUserId: string }
  | { ok: false; error: string };

/**
 * Zajistí záznam v Supabase Auth (email username@fox-app.local) a propojí authUserId v User.
 * Stejná logika jako dřívější npm run sync-auth, ale pro jednoho uživatele.
 */
export async function provisionSupabaseAuthForUserById(
  userId: string,
): Promise<ProvisionResult> {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) {
    return { ok: false, error: "Uživatel nenalezen" };
  }

  const supabase = createSupabaseAdmin();
  const shared = process.env.FOX_SHARED_PASSWORD?.trim() || "zmen-mne";
  const email = `${u.username}@fox-app.local`;

  if (u.authUserId) {
    const { error } = await supabase.auth.admin.updateUserById(u.authUserId, {
      password: shared,
      user_metadata: { app_user_id: u.id, role: u.role, name: u.name },
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, authUserId: u.authUserId };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: shared,
    email_confirm: true,
    user_metadata: { app_user_id: u.id, role: u.role, name: u.name },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const authId = data.user?.id;
  if (!authId) {
    return { ok: false, error: "Auth odpověď bez id" };
  }

  await prisma.user.update({
    where: { id: u.id },
    data: { authUserId: authId },
  });

  return { ok: true, authUserId: authId };
}
