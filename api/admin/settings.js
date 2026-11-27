import { requireAdmin, method, send, fail, writeLog } from "../_lib/server.js";

export default async function handler(req,res) {
  try {
    const { user, db } = await requireAdmin(req);
    if (req.method === "GET") {
      const [settings,limits] = await Promise.all([
        db.from("system_settings").select("*"),
        db.from("usage_limits").select("*")
      ]);
      if (settings.error) throw settings.error;
      if (limits.error) throw limits.error;
      return send(res,200,{settings:settings.data,limits:limits.data});
    }
    if (req.method === "PATCH") {
      const { settings={}, limits=[] } = req.body || {};
      const allowed = new Set(["site_name","site_description","maintenance_mode","registration_enabled"]);
      for (const [key,value] of Object.entries(settings)) {
        if (!allowed.has(key)) return send(res,400,{error:`Setting not allowed: ${key}`});
        const {error} = await db.from("system_settings").upsert({key,value,updated_by:user.id,updated_at:new Date().toISOString()});
        if (error) throw error;
      }
      for (const item of limits) {
        if (!["FREE","PREMIUM"].includes(item.plan) || !Number.isInteger(item.daily_ai_requests) || item.daily_ai_requests<0 || item.daily_ai_requests>100000) return send(res,400,{error:"Invalid usage limit."});
        const {error} = await db.from("usage_limits").upsert({...item,updated_at:new Date().toISOString()});
        if (error) throw error;
      }
      await writeLog(db,user.id,null,"SYSTEM_SETTINGS_UPDATED",{settings:Object.keys(settings),limits:limits.length});
      return send(res,200,{ok:true});
    }
    return send(res,405,{error:"Method not allowed."});
  } catch(e) { return fail(res,e); }
}
