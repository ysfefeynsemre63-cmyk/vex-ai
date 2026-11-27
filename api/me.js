import { requireUser, adminDb, method, send, fail } from "./_lib/server.js";
export default async function handler(req,res) {
  try {
    method(req,["GET"]);
    const user = await requireUser(req);
    const db = adminDb();
    const [profile,subs,usage,limit] = await Promise.all([
      db.from("profiles").select("id,username,email,role,account_status,created_at").eq("id",user.id).single(),
      db.from("subscriptions").select("plan,starts_at,ends_at,status").eq("user_id",user.id).eq("status","ACTIVE").order("created_at",{ascending:false}).limit(1),
      db.from("ai_usage").select("request_count,created_at").eq("user_id",user.id).gte("created_at",new Date(new Date().setHours(0,0,0,0)).toISOString()),
      db.from("usage_limits").select("daily_ai_requests").eq("plan","FREE").single()
    ]);
    for(const r of [profile,subs,usage,limit]) if(r.error) throw r.error;
    const active = (subs.data||[]).find(s=>s.plan==="PREMIUM" && (!s.ends_at || new Date(s.ends_at)>new Date()));
    const plan = active ? "PREMIUM" : "FREE";
    const {data:planLimit,error:limitError} = await db.from("usage_limits").select("daily_ai_requests").eq("plan",plan).single();
    if(limitError) throw limitError;
    const used = (usage.data||[]).reduce((n,x)=>n+(x.request_count||0),0);
    return send(res,200,{profile:profile.data,plan,subscription:active||null,usage:{used,limit:planLimit.daily_ai_requests,remaining:Math.max(0,planLimit.daily_ai_requests-used)}});
  } catch(e) { return fail(res,e); }
}
