import { requireAdmin, method, send, fail, writeLog } from "../_lib/server.js";

const durations = { "7":7, "30":30, "90":90, "365":365, "lifetime":null };

export default async function handler(req,res) {
  try {
    const { user: admin, db } = await requireAdmin(req);
    if (req.method === "POST") {
      const { email, duration, note="" } = req.body || {};
      if (!email || !(duration in durations)) return send(res,400,{error:"Choose a valid user and duration."});
      const { data: target, error: findError } = await db.from("profiles").select("id,role").eq("email",email.toLowerCase()).single();
      if (findError || !target) return send(res,404,{error:"User not found."});
      if (target.role === "SUPER_ADMIN") return send(res,403,{error:"Admin membership is managed separately."});
      const starts = new Date();
      const ends = durations[duration] === null ? null : new Date(starts.getTime()+durations[duration]*86400000).toISOString();
      const { data: sub, error } = await db.from("subscriptions").insert({
        user_id:target.id,plan:"PREMIUM",starts_at:starts.toISOString(),ends_at:ends,note:String(note).slice(0,500),created_by:admin.id,status:"ACTIVE"
      }).select().single();
      if (error) throw error;
      await db.from("membership_history").insert({user_id:target.id,action:"PREMIUM_GRANTED",plan:"PREMIUM",starts_at:starts.toISOString(),ends_at:ends,note:String(note).slice(0,500),performed_by:admin.id});
      await writeLog(db,admin.id,target.id,"PREMIUM_GRANTED",{duration,ends_at:ends});
      return send(res,200,{ok:true,subscription:sub});
    }
    if (req.method === "PATCH") {
      const { subscription_id, action, ends_at, note } = req.body || {};
      if (!subscription_id || !["CANCEL","UPDATE"].includes(action)) return send(res,400,{error:"Invalid membership action."});
      const { data: sub, error: findError } = await db.from("subscriptions").select("*").eq("id",subscription_id).single();
      if (findError || !sub) return send(res,404,{error:"Membership not found."});
      const update = action === "CANCEL"
        ? {status:"CANCELLED",updated_at:new Date().toISOString()}
        : {ends_at: ends_at || null, note:String(note ?? sub.note ?? "").slice(0,500),updated_at:new Date().toISOString()};
      const { error } = await db.from("subscriptions").update(update).eq("id",subscription_id);
      if (error) throw error;
      await db.from("membership_history").insert({user_id:sub.user_id,action:action==="CANCEL"?"PREMIUM_CANCELLED":"PREMIUM_UPDATED",plan:sub.plan,starts_at:sub.starts_at,ends_at:update.ends_at ?? sub.ends_at,note:update.note ?? sub.note,performed_by:admin.id});
      await writeLog(db,admin.id,sub.user_id,action==="CANCEL"?"PREMIUM_CANCELLED":"PREMIUM_UPDATED",{subscription_id});
      return send(res,200,{ok:true});
    }
    return send(res,405,{error:"Method not allowed."});
  } catch(e) { return fail(res,e); }
}
