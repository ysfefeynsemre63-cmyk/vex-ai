import { requireAdmin, method, send, fail } from "../_lib/server.js";

export default async function handler(req, res) {
  try {
    method(req, ["GET"]);
    const { db } = await requireAdmin(req);
    const today = new Date(); today.setHours(0,0,0,0);
    const [users, free, premium, todayUsers, usage, recent] = await Promise.all([
      db.from("profiles").select("*", { count: "exact", head: true }),
      db.from("profiles").select("*", { count: "exact", head: true }).eq("role", "FREE"),
      db.from("subscriptions").select("*", { count: "exact", head: true }).eq("plan", "PREMIUM").eq("status", "ACTIVE"),
      db.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
      db.from("ai_usage").select("request_count,tokens_used,created_at"),
      db.from("profiles").select("id,username,email,created_at,role,account_status").order("created_at", { ascending: false }).limit(8)
    ]);
    for (const r of [users,free,premium,todayUsers,usage,recent]) if (r.error) throw r.error;
    const rows = usage.data || [];
    return send(res, 200, {
      totalUsers: users.count || 0, freeUsers: free.count || 0,
      premiumSubscriptions: premium.count || 0, todayUsers: todayUsers.count || 0,
      totalAIRequests: rows.reduce((n,x) => n + (x.request_count || 0), 0),
      totalTokens: rows.reduce((n,x) => n + (x.tokens_used || 0), 0),
      recentUsers: recent.data || []
    });
  } catch (e) { return fail(res, e); }
}
