import { adminDb, requireUser, method, send, fail, writeLog } from "../_lib/server.js";

export default async function handler(req, res) {
  try {
    method(req, ["POST"]);
    const user = await requireUser(req);
    const expectedEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const suppliedSecret = req.headers["x-bootstrap-secret"];
    if (!expectedEmail || !process.env.ADMIN_BOOTSTRAP_SECRET ||
        user.email?.toLowerCase() !== expectedEmail ||
        suppliedSecret !== process.env.ADMIN_BOOTSTRAP_SECRET ||
        !user.email_confirmed_at) {
      return send(res, 403, { error: "Bootstrap authorization failed." });
    }

    const db = adminDb();
    const { data: existingAdmin, error: lookupError } = await db
      .from("profiles").select("id").eq("role", "SUPER_ADMIN").limit(1);
    if (lookupError) throw lookupError;
    if (existingAdmin?.length && !existingAdmin.some(x => x.id === user.id)) {
      return send(res, 409, { error: "A super admin is already configured." });
    }

    const { error } = await db.from("profiles").upsert({
      id: user.id, email: user.email, role: "SUPER_ADMIN", account_status: "ACTIVE"
    });
    if (error) throw error;
    await writeLog(db, user.id, user.id, "SUPER_ADMIN_BOOTSTRAP", { email: user.email });
    return send(res, 200, { ok: true, message: "Super admin configured." });
  } catch (e) { return fail(res, e); }
}
