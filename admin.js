// This file expects the existing VEX login flow to store the Supabase access token
// in localStorage under "vex_access_token". Change only this key if your auth code differs.
const token = () => localStorage.getItem("vex_access_token");
const notice = document.querySelector("#notice");
async function api(path, options={}) {
  const response = await fetch(`/api/${path}`, {
    ...options, headers: {
      "Content-Type":"application/json",
      "Authorization":`Bearer ${token() || ""}`,
      ...(options.headers||{})
    }
  });
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(body.error || "İstek başarısız.");
  return body;
}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function date(v){return v?new Date(v).toLocaleString("tr-TR"):"Süresiz";}
function table(headers, rows){return `<table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")||`<tr><td colspan="${headers.length}" class="muted">Kayıt yok</td></tr>`}</tbody></table>`;}
function message(s){notice.textContent=s;}
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("nav button,.tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active");}));
async function dashboard(){
 const d=await api("admin/dashboard");
 document.querySelector("#stats").innerHTML=[["Toplam kullanıcı",d.totalUsers],["FREE kullanıcı",d.freeUsers],["Premium üyelik",d.premiumSubscriptions],["Bugün kayıt",d.todayUsers],["AI istekleri",d.totalAIRequests],["Kullanılan token",d.totalTokens]].map(([k,v])=>`<div class="stat"><small>${k}</small><strong>${Number(v).toLocaleString("tr-TR")}</strong></div>`).join("");
 document.querySelector("#recent").innerHTML=table(["Kullanıcı","E-posta","Kayıt tarihi","Durum"],d.recentUsers.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td>${date(u.created_at)}</td><td>${esc(u.account_status)}</td></tr>`));
}
async function users(){
 const q=document.querySelector("#search").value;
 const d=await api(`admin/users?q=${encodeURIComponent(q)}`);
 document.querySelector("#userTable").innerHTML=table(["Kullanıcı","E-posta","Üyelik","Kayıt","Hesap","İşlem"],d.users.map(u=>{
  const premium=u.subscriptions?.[0];
  return `<tr><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td>${premium?`PREMIUM · ${date(premium.ends_at)}`:"FREE"}</td><td>${date(u.created_at)}</td><td>${esc(u.account_status)}</td><td>${u.role==="SUPER_ADMIN"?"Korunan yönetici":`<div class="actions"><button data-id="${u.id}" data-status="${u.account_status==="ACTIVE"?"SUSPENDED":"ACTIVE"}">${u.account_status==="ACTIVE"?"Askıya al":"Etkinleştir"}</button></div>`}</td></tr>`;
 }).join(""));
 document.querySelectorAll("#userTable button[data-id]").forEach(b=>b.onclick=async()=>{try{await api("admin/users",{method:"PATCH",body:JSON.stringify({id:b.dataset.id,account_status:b.dataset.status})});await users();message("Hesap durumu güncellendi.");}catch(e){message(e.message);}});
}
async function logs(){
 const d=await api("admin/logs");
 document.querySelector("#logTable").innerHTML=table(["İşlem","Yönetici ID","Hedef kullanıcı ID","Detay","Tarih"],d.logs.map(x=>`<tr><td>${esc(x.action)}</td><td>${esc(x.actor_id)}</td><td>${esc(x.target_user_id||"-")}</td><td>${esc(JSON.stringify(x.details))}</td><td>${date(x.created_at)}</td></tr>`));
}
async function settings(){
 const d=await api("admin/settings"), s=Object.fromEntries(d.settings.map(x=>[x.key,x.value]));
 const f=document.querySelector("#settingsForm");
 f.site_name.value=s.site_name||"VEX AI";f.site_description.value=s.site_description||"";
 f.maintenance_mode.checked=!!s.maintenance_mode;f.registration_enabled.checked=!!s.registration_enabled;
 f.free_limit.value=d.limits.find(x=>x.plan==="FREE")?.daily_ai_requests??20;
 f.premium_limit.value=d.limits.find(x=>x.plan==="PREMIUM")?.daily_ai_requests??500;
}
document.querySelector("#membershipForm").onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.target);await api("admin/membership",{method:"POST",body:JSON.stringify({email:f.get("email"),duration:f.get("duration"),note:f.get("note")})});e.target.reset();message("Premium üyelik verildi.");}catch(x){message(x.message);}};
document.querySelector("#settingsForm").onsubmit=async e=>{e.preventDefault();const f=e.target;try{await api("admin/settings",{method:"PATCH",body:JSON.stringify({settings:{site_name:f.site_name.value,site_description:f.site_description.value,maintenance_mode:f.maintenance_mode.checked,registration_enabled:f.registration_enabled.checked},limits:[{plan:"FREE",daily_ai_requests:Number(f.free_limit.value)},{plan:"PREMIUM",daily_ai_requests:Number(f.premium_limit.value)}]})});message("Ayarlar kaydedildi.");}catch(x){message(x.message);}};
document.querySelector("#search").addEventListener("input",()=>{clearTimeout(window.searchDelay);window.searchDelay=setTimeout(()=>users().catch(e=>message(e.message)),300);});
document.querySelector("#refresh").onclick=()=>load();
async function load(){
 if(!token()){message("Giriş oturumu bulunamadı. Önce VEX AI hesabına giriş yapın.");return;}
 try{await dashboard();await users();await logs();await settings();message("Yönetici doğrulandı. Güvenli bağlantı aktif.");}
 catch(e){message(e.message);}
}
load();
