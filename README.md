# Carpool Agent

A marketplace MVP for rental agents and car owners — except everyone is both.
Members list cars **and** post requests on behalf of their customers. When a
member has a customer but no matching car, the request is broadcast; other
members submit offers from their fleet; the requester picks one; the car
owner gives final confirmation.

Customer details (name, phone) stay with the requesting member — car owners
only see pickup area, datetime window, and passenger count.

Designed for **$0 deployment** to start, with a clean API for later integration
(n8n + WAHA WhatsApp, or a parent system).

---

## Stack

- **Next.js 15 (App Router) + Tailwind** — single PWA codebase for web and mobile
- **Supabase** — Postgres + Auth (email/password) + Storage + RLS
- **Vercel** (free tier) — hosting for the Next.js app
- Optional integration: REST endpoints under `/api/v1/*` guarded by an API key

## Roles

| Role   | Capabilities                                                                                  |
|--------|-----------------------------------------------------------------------------------------------|
| member | List/edit cars, set rate/deposit/areas, post requests, submit offers, accept and confirm bookings |
| admin  | Verify members; verified members' cars become visible to other members                        |

Roles are stored on `profiles.role` and assigned at signup (default `member`).

## Data model

```
profiles         (id, email, full_name, role, is_verified, phone, …)
cars             (id, owner_id, make, model, year, car_type, daily_rate, deposit, status, notes)
service_areas    (car_id, area)

requests         (id, requester_id, car_id?, car_type, pickup_area, start_at, end_at,
                  passenger_count, max_daily_rate, notes, status, expires_at)
request_private  (request_id, customer_name, customer_phone, customer_notes)   -- requester-only
offers           (id, request_id, car_id, offerer_id, daily_rate, deposit, notes,
                  status, expires_at)
bookings         (id, request_id, offer_id, car_id, owner_id, booker_id, pickup_area,
                  passenger_count, daily_rate, deposit, start_at, end_at, status, …)

webhook_endpoints (id, url, secret, event_types[], is_active, …)
audit_log
```

Row-Level Security is on for every table; see `supabase/migrations/0001_init.sql`,
`0002_rls_fixes.sql`, and `0003_member_marketplace.sql`. Members see each other's
verified-owner cars, open requests, and their own bookings/offers.
`request_private` is locked to the requesting member and admins.

### State machines

- **request**: `open → matched → fulfilled` (or `cancelled` / `expired`).
- **offer**: `pending → accepted | rejected | withdrawn | expired`.
- **booking**: `pending_owner_confirmation → confirmed → in_progress → completed`
  (or `cancelled`). Created when the requester accepts an offer; confirmed by
  the car owner. Sibling pending offers/bookings on the same request are
  rejected/cancelled when the owner confirms one.

All transitions go through SECURITY DEFINER functions
(`accept_offer`, `reject_offer`, `withdraw_offer`, `confirm_booking`,
`cancel_booking`, `start_booking`, `complete_booking`, `cancel_request`) —
direct UPDATEs to these tables are blocked by RLS.

## Local setup

1. **Create a Supabase project** at https://supabase.com (free tier).
2. **Run the migrations**: open the SQL Editor in Supabase and paste each
   `supabase/migrations/000X_*.sql` in order, or use the Supabase CLI:
   ```bash
   supabase db push
   ```
3. **Promote yourself to admin** (run once in the Supabase SQL editor after
   you sign up your first account):
   ```sql
   update profiles set role = 'admin', is_verified = true where email = 'you@example.com';
   ```
4. **Copy env vars** from `.env.example` to `.env.local` and fill in your
   Supabase URL + anon key + service role key. Generate a long random string
   for `API_INTEGRATION_KEY`.
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
   Vercel domain (e.g. `https://carpool-agent.vercel.app`).
4. Auto-deploys on every push.

When you outgrow the free tier (~thousands of MAU), Supabase Pro is **$25/mo**
and Vercel Pro is **$20/mo**.

## REST API

All endpoints require header `x-api-key: <API_INTEGRATION_KEY>`.

```
GET  /api/v1/cars?area=KL&type=Sedan&max=200
GET  /api/v1/cars/:id

GET  /api/v1/requests?status=open
POST /api/v1/requests
  { requester_email, car_type?, pickup_area, start_at, end_at,
    passenger_count, max_daily_rate?, notes?,
    customer_name, customer_phone, customer_notes? }
GET  /api/v1/requests/:id/offers
POST /api/v1/requests/:id/accept     { offer_id, acting_email }

POST /api/v1/bookings/:id/confirm    { acting_email }
POST /api/v1/bookings/:id/cancel     { acting_email, reason? }
POST /api/v1/bookings/:id/start      { acting_email }
POST /api/v1/bookings/:id/complete   { acting_email }

GET  /api/v1/webhooks
POST /api/v1/webhooks                { url, secret, event_types?: string[] }
DELETE /api/v1/webhooks?id=…
```

Webhook events (HMAC-signed with the endpoint secret in `x-carpool-signature`):
`request.created`, `request.cancelled`, `offer.created`, `offer.accepted`,
`offer.rejected`, `booking.created`, `booking.confirmed`, `booking.cancelled`,
`booking.started`, `booking.completed`.

## n8n / WAHA integration

The webhook surface is the seam for WhatsApp messaging. Recommended layout:

- **Outbound** (app → member's WhatsApp): register an n8n webhook endpoint via
  `POST /api/v1/webhooks`. The app POSTs every booking/offer transition there.
  n8n routes to WAHA and sends the template message.
- **Inbound** (member's WhatsApp reply → app): WAHA → n8n parses intent → n8n
  calls the matching `/api/v1/*` endpoint with `x-api-key` and the acting
  member's email. No new app endpoint is needed.

## Roadmap

- Photo upload for each car (Supabase Storage)
- Cron-based expiry of stale requests and offers
- Per-event retry log for webhook deliveries
- Drop legacy `owner`/`agent` enum values (separate migration once code is
  confirmed off them)
- Map-based service areas (Leaflet + OpenStreetMap)

## Project layout

```
src/
  app/
    api/
      admin/verify/                 # admin verify endpoint
      v1/                           # external integration API
      internal/emit/                # in-app webhook emit (cookie auth)
    member/                         # everything members do
      page.tsx                      # dashboard
      cars/                         # list, add, edit (was /owner)
      marketplace/                  # browse cars + browse requests (was /agent)
      requests/                     # my requests + new + detail (offers)
      bookings/                     # my bookings + detail (confirm/start/cancel/complete)
    admin/                          # admin verify + recent cars + bookings
    login/, signup/                 # auth pages
  components/
  lib/
    auth.ts                         # requireUser / requireRole
    supabase/                       # browser, server, admin clients
    webhooks/emit.ts                # outbound webhook dispatcher
    types.ts
supabase/
  migrations/
    0001_init.sql
    0002_rls_fixes.sql
    0003_member_marketplace.sql     # this redesign
```
