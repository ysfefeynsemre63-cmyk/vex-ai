import { requireAdmin, method, send, fail, writeLog } from "../_lib/server.js";

export default async function handler(req, res) {
  try {
    const { user: admin, db } = await requireAdmin(req);
    if (req.method === "GET") {
      const q = String(req.query.q || "").trim();
      let query = db.from("profiles").select("id,username,email,role,account_status,created_at").order("created_at",{ascending:false}).limit(100);
      if (q) query = query.or(`email.ilike.%${q}%,username.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      const ids = (data || []).map(x => x.id);
      const { data: subs, error: subError } = ids.length
        ? await db.from("subscriptions").select("id,user_id,plan,starts_at,ends_at,status,note").in("user_id", ids).eq("status","ACTIVE")
        : { data: [], error: null };
      if (subError) throw subError;
      return send(res,200,{ users:(data || []).map(u => ({...u, subscriptions:(subs || []).filter(s=>s.user_id===u.id)})) });
    }
    if (req.method === "PATCH") {
      const { id, account_status } = req.body || {};
      if (!id || !["ACTIVE","SUSPENDED"].includes(account_status)) return send(res,400,{error:"Invalid user update."});
      const { data: target, error: getError } = await db.from("profiles").select("role").eq("id",id).single();
      if (getError) throw getError;
      if (target.role === "SUPER_ADMIN") return send(res,403,{error:"The super admin account is protected."});
      const { error } = await db.from("profiles").update({account_status,updated_at:new Date().toISOString()}).eq("id",id);
      if (error) throw error;
      await writeLog(db,admin.id,id,"ACCOUNT_STATUS_CHANGED",{account_status});
      return send(res,200,{ok:true});
    }
    return send(res,405,{error:"Method not allowed."});
  } catch(e) { return fail(res,e); }
}
