# VEX AI — Admin backend add-on

This is an additive Vercel + Supabase admin module. It does not overwrite the existing `index.html`.

## Before deployment

1. In Supabase, open SQL Editor and run `supabase/schema.sql`.
2. In Vercel project settings, add every variable from `.env.example`.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never prefix it with `VITE_`, `NEXT_PUBLIC_`, or expose it in HTML/JS.
4. Deploy the repository to Vercel.
5. Ensure the existing login code stores the Supabase access token as `vex_access_token` in localStorage, or change the key in `admin.js` to match the existing auth implementation.
6. Sign up using the configured `ADMIN_EMAIL`, verify that email, and sign in.
7. From the signed-in browser console, run the one-time bootstrap request below. Replace the secret with the exact `ADMIN_BOOTSTRAP_SECRET` value configured in Vercel:

```js
fetch("/api/admin/bootstrap", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + localStorage.getItem("vex_access_token"),
    "X-Bootstrap-Secret": "YOUR_BOOTSTRAP_SECRET"
  }
}).then(r => r.json()).then(console.log);
```

8. Remove `ADMIN_BOOTSTRAP_SECRET` from Vercel after successful bootstrap and redeploy. The bootstrap endpoint will then be disabled.
9. Open `/admin.html`.

## Existing project integration

- Copy `api/`, `supabase/`, `admin.html`, `admin.css`, `admin.js`, `package.json`, and `vercel.json` into the repository root.
- Do not replace your existing `index.html`.
- The existing app's authentication must issue Supabase access tokens. A static landing page alone does not provide sign-up/login; the current auth flow must be integrated before the admin panel can be used.
- `api/me` returns the signed-in user's own profile, current plan and daily usage summary.

## Security notes and current scope

- Admin authorization is checked on every admin API request using the authenticated Supabase user plus the server-side `profiles.role`.
- The bootstrap route requires a verified matching email AND a one-time secret. Only one super-admin can be bootstrapped.
- Normal users have read-only RLS access to their own profile/subscription/history/usage. No client write policies are created for protected data.
- The Service Role key is used only in Vercel server functions.
- Passwords are never queried or returned.
- Super-admin profile cannot be suspended through the user-management endpoint.

## Important remaining integration

This add-on supplies the secure admin foundation and core membership/admin APIs. It does not yet include the existing VEX AI sign-up/login UI, AI provider integration, per-request AI quota enforcement, usage-event recording, account deletion protection in an auth-management workflow, or a production-grade active-user definition. Do not advertise those as finished until they are implemented and tested.
