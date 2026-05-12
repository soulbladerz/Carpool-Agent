# Carpool Agent

A marketplace MVP that connects independent car owners with rental agents.
Owners list cars (type, rate, deposit, service areas, availability). Agents
browse availability and flag a car when they have a customer. Admins verify
owners.

Designed for **$0 deployment** to start, with a clean API for later integration
into a larger system.

---

## Stack

- **Next.js 15 (App Router) + Tailwind** — single PWA codebase for web and mobile
- **Supabase** — Postgres + Auth (email/password) + Storage + RLS
- **Vercel** (free tier) — hosting for the Next.js app
- Optional integration: REST endpoints under `/api/v1/*` guarded by an API key

## Roles

| Role  | Capabilities                                                                  |
|-------|-------------------------------------------------------------------------------|
| owner | Add/edit cars, set rate/deposit/areas, toggle availability                    |
| agent | Browse available cars, filter by area / type / price, flag a car (24h hold)  |
| admin | Verify owners; verified owners' cars become visible to agents                 |

Roles are stored on `profiles.role` and assigned at signup.

## Data model

```
profiles (id, email, full_name, role, is_verified, phone, …)
cars     (id, owner_id, make, model, year, car_type, daily_rate, deposit, status, notes)
service_areas (car_id, area)                  -- many areas per car
flags    (car_id, agent_id, status, expires_at)
audit_log
```

Row-Level Security is on for every table; see `supabase/migrations/0001_init.sql`
for policies. Agents only see cars from **verified** owners; owners only see
their own cars and flags on those cars.

## Local setup

1. **Create a Supabase project** at https://supabase.com (free tier).
2. **Run the migration**: open the SQL Editor in Supabase and paste the contents
   of `supabase/migrations/0001_init.sql`, or use the Supabase CLI:
   ```bash
   supabase db push
   ```
3. **Promote yourself to admin** (run once in the Supabase SQL editor after you
   sign up your first account):
   ```sql
   update profiles set role = 'admin', is_verified = true where email = 'you@example.com';
   ```
4. **Copy env vars** from `.env.example` to `.env.local` and fill in your Supabase
   project URL + anon key + service role key. Generate a long random string for
   `API_INTEGRATION_KEY`.
5. Install + run:
   ```bash
   npm install
   npm run dev
   ```

## Deploy ($0 path)

| Component | Service       | Free-tier limit                     |
|-----------|---------------|-------------------------------------|
| Frontend  | Vercel        | 100 GB bandwidth / month            |
| Database  | Supabase      | 500 MB Postgres, 50K MAU, 1 GB storage |
| Email     | Supabase SMTP | Built-in for password reset         |

Steps:
1. Push this repo to GitHub.
2. Import into Vercel; add the four env vars from `.env.example`.
3. In Supabase → Authentication → URL Configuration, set the site URL to your
   Vercel domain (e.g. `https://carpool-agent.vercel.app`) so password-reset
   links point to the right host.
4. Done. Auto-deploys on every push.

When you outgrow the free tier (~thousands of MAU), Supabase Pro is **$25/mo**
and Vercel Pro is **$20/mo**.

## REST API (for later integration)

All endpoints require header `x-api-key: <API_INTEGRATION_KEY>`.

```
GET  /api/v1/cars?area=KL&type=Sedan&max=200
GET  /api/v1/cars/:id
POST /api/v1/webhooks                # stub — wire up event emission in phase 2
```

Internal browser-side reads go through Supabase directly, gated by RLS.

## Roadmap (post-MVP)

- Photo upload for each car (Supabase Storage)
- Date-based availability + calendar
- WhatsApp notifications for flag events (Meta Cloud API free tier)
- In-app messaging between owner and agent
- Payment + escrow
- Map-based service areas (Leaflet + OpenStreetMap)
- Webhook subscriptions for the parent system

## Project layout

```
src/
  app/
    api/
      admin/verify/        # admin verify endpoint
      v1/                  # external integration API
    owner/                 # owner dashboard + forms
    agent/                 # agent browse view
    admin/                 # admin verify page
    login/, signup/        # auth pages
  components/
  lib/
    auth.ts                # requireUser / requireRole helpers
    supabase/              # browser, server, admin clients
    types.ts
supabase/
  migrations/0001_init.sql
```
