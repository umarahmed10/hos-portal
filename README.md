# HOS Client Portal

Live call tool for HOS Automations. Capture client details on a call, generate a service agreement via AI, create an invoice, and get a signature — all before you hang up.

## Stack

- **Next.js 15** App Router — Server Components by default
- **Supabase** — database + client-side signing (anon key) + admin writes (service role)
- **OpenRouter** — LLM agreement generation (meta-llama/llama-4-maverick)
- **Resend** — transactional email (signing notifications + client doc links)
- **jose** — edge-compatible JWT for admin auth
- **sonner** — toast notifications
- **swr** — dashboard polling (every 8s)
- **@react-pdf/renderer** — server-side PDF generation

## Deploy to Vercel

### 1. Database (Supabase)

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New Query**, paste the contents of `schema.sql`, and run it
3. Copy your **Project URL**, **anon key**, and **service_role key** from **Settings → API**

### 2. Email (Resend)

1. Create a free account at [resend.com](https://resend.com)
2. Create an API key
3. Verify a sending domain (or use `onboarding@resend.dev` for testing)

### 3. AI (OpenRouter)

1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Create an API key
3. The default model (`meta-llama/llama-4-maverick`) is free-tier eligible

### 4. Deploy

```bash
# Push to GitHub
git add .
git commit -m "Initial deploy"
git push origin main
```

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import from GitHub
2. Add all environment variables from `.env.local.example`
3. Set `NEXT_PUBLIC_APP_URL` to your Vercel production domain
4. Deploy

### 5. Post-deploy checklist

- [ ] Landing page loads
- [ ] Admin login works with your `ADMIN_PASSWORD`
- [ ] Create a doc → generate agreement → save → share screen shows
- [ ] Open client link → doc renders → sign → email arrives at `NOTIFY_EMAIL`
- [ ] PDF downloads correctly
- [ ] Mobile: test on iPhone (sign flow especially)

## Local Development

```bash
cp .env.local.example .env.local
# Fill in your env vars

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
Server Components fetch data during render (getAllDocs, getDocForClient, etc.)
Client Components receive data via props and handle interactivity only.
All database queries live in lib/data-access.ts — one file to change data logic.
All frontend API calls live in lib/api-client.ts — one file to change API calls.
Admin writes use SUPABASE_SERVICE_ROLE_KEY (server-side only, never in browser).
Client signing uses anon key, constrained by RLS "client_sign" policy.
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `ADMIN_PASSWORD` | ✅ | Admin portal password |
| `JWT_SECRET` | ✅ | 32+ char random string for JWT signing |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key |
| `OPENROUTER_MODEL` | ❌ | Model override (default: meta-llama/llama-4-maverick) |
| `RESEND_API_KEY` | ✅ | Resend API key |
| `RESEND_FROM_EMAIL` | ❌ | Sender address (default: onboarding@resend.dev) |
| `NOTIFY_EMAIL` | ✅ | Where signing notifications go |
| `NEXT_PUBLIC_APP_URL` | ✅ | Full app URL (no trailing slash) |
