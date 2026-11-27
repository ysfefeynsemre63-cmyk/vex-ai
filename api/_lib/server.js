import { createClient } from "@supabase/supabase-js";

export function adminDb() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server Supabase environment is missing.");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function userDb() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase environment is missing.");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function bearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function requireUser(req) {
  const token = bearer(req);
  if (!token) throw Object.assign(new Error("Authentication required."), { status: 401 });
  const db = userDb();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error("Invalid session."), { status: 401 });
  return data.user;
}

export async function requireAdmin(req) {
  const user = await requireUser(req);
  const db = adminDb();
  const { data: profile, error } = await db.from("profiles").select("role,account_status").eq("id", user.id).single();
  if (error || profile?.role !== "SUPER_ADMIN" || profile?.account_status !== "ACTIVE") {
    throw Object.assign(new Error("Admin access denied."), { status: 403 });
  }
  return { user, db };
}

export function method(req, allowed) {
  if (!allowed.includes(req.method)) throw Object.assign(new Error("Method not allowed."), { status: 405 });
}

export function send(res, status, body) {
  return res.status(status).json(body);
}

export function fail(res, error) {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  return send(res, status, { error: status === 500 ? "Server error." : error.message });
}

export async function writeLog(db, actor, target, action, details = {}) {
  const { error } = await db.from("admin_logs").insert({
    actor_id: actor, target_user_id: target || null, action, details
  });
  if (error) throw error;
}
