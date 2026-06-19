import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type UserClient = SupabaseClient<Database>;
void createClient;

const INTERNAL_DOMAIN = "internal.local";

async function assertAdmin(supabase: UserClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, employee_id, status, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

const createSchema = z.object({
  employee_id: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, "員工編號只能包含英文字母、數字、_ 或 -"),
  password: z.string().min(6).max(128),
  display_name: z.string().trim().min(1).max(100),
  is_admin: z.boolean().optional(),
});

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const employeeId = data.employee_id.trim();
    const email = `${employeeId.toLowerCase()}@${INTERNAL_DOMAIN}`;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.display_name,
        employee_id: employeeId,
        status: "active",
      },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;

    // Ensure profile has employee_id (trigger should have set it, but enforce)
    await supabaseAdmin
      .from("profiles")
      .update({ employee_id: employeeId, display_name: data.display_name, status: "active" })
      .eq("id", newId);

    if (data.is_admin) {
      // Replace any default 'user' role
      await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
      await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "admin" });
    }
    return { id: newId };
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().trim().min(1).max(100).optional(),
  password: z.string().min(6).max(128).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).optional(),
  is_admin: z.boolean().optional(),
});

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    if (data.password && data.password.length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    }

    const profileUpdate: { display_name?: string; status?: string } = {};
    if (data.display_name !== undefined) profileUpdate.display_name = data.display_name;
    if (data.status !== undefined) profileUpdate.status = data.status;
    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", data.user_id);
    }

    if (data.is_admin !== undefined) {
      if (data.user_id === context.userId && data.is_admin === false) {
        throw new Error("不可以移除自己的管理員權限");
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.is_admin ? "admin" : "user" });
    }

    // If marked inactive, sign the user out of all sessions
    if (data.status === "inactive") {
      await supabaseAdmin.auth.admin.signOut(data.user_id).catch(() => undefined);
    }

    return { ok: true };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("不可以刪除自己");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
