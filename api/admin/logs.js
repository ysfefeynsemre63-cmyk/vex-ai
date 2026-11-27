import { requireAdmin, method, send, fail } from "../_lib/server.js";
export default async function handler(req,res) {
  try {
    method(req,["GET"]);
    const {db} = await requireAdmin(req);
    const {data,error} = await db.from("admin_logs").select("id,actor_id,target_user_id,action,details,created_at").order("created_at",{ascending:false}).limit(200);
    if(error) throw error;
    return send(res,200,{logs:data});
  } catch(e) { return fail(res,e); }
}
