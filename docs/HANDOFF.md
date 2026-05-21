# Carpool-Agent — Project Handoff

This document is a handoff from Claude (web chat) → Claude Code.

The project is a Malaysian peer-to-peer car rental marketplace deployed to
Vercel + Supabase. It's mostly working but has one open blocker on the n8n
side (HMAC verification) that needs fixing before WhatsApp notifications go
live.

---

## 1. Live URLs

| Thing                 | URL                                                                                  |
|-----------------------|--------------------------------------------------------------------------------------|
| Production app        | https://carpool-agent.vercel.app                                                     |
| GitHub repo + branch  | https://github.com/soulbladerz/Carpool-Agent → `claude/car-rental-marketplace-Soi3K` |
| Supabase project      | `wumekwxlehrivcxltvoq` · `ap-southeast-1` (Singapore) · free tier                    |
| Supabase dashboard    | https://supabase.com/dashboard/project/wumekwxlehrivcxltvoq                          |
| Vercel project        | `prj_ZVpCsnvvEjQLH7LYjIOQAMHN9wps` (team: `soulbladerzs-projects`)                   |
| n8n webhook (live)    | `https://n8n.xaltech.org/webhook/carpool-notify`                                     |

---

## 2. Secrets & shared values

These are needed for any cross-system work. Treat as sensitive.

- **API_INTEGRATION_KEY** (carpool REST API): `f33b53b7a12c6c9b3a568447d1afcfd4db145a32878c355558bc12e383003c42`
- **CARPOOL_WEBHOOK_SECRET** (HMAC shared with n8n): `8fccb4f292f7ccb6ea60232a312a12d335538a4cc58017596dc3572685abaec5`
- Webhook subscription id (in DB): `486e5f82-9be7-47a8-b63d-1fc7fff4aad8`

The Supabase service role JWT and Vercel env vars are already set in their
respective consoles; not pasted here.

---

## 3. Schema state

All migrations have been applied to the live DB **and** pushed to the repo:

```
supabase/migrations/
  0001_init.sql                          initial owner/agent schema
  0002_rls_fixes.sql                     break recursion in profiles RLS
  0003_member_marketplace.sql            collapse owner/agent → single 'member' role,
                                         introduce requests/offers/bookings model
  0004_audit_fixes.sql                   tighten RLS, add zod input validation
  0005_fix_request_offer_recursion.sql   security-definer helpers to break cross-
                                         table RLS recursion (requests ↔ offers)
  0006_direct_request_privacy.sql        direct requests (car_id IS NOT NULL) are
                                         private to the targeted car owner
  0007_block_overlapping_bookings.sql    car_has_blocking_booking predicate +
                                         create_request / offer trigger / confirm
                                         all re-check window overlap
  0008_cars_blocked_in_window_batch.sql  set-returning batch overlap for
                                         marketplace window filtering
```

Key tables:

- `profiles` — single `member` role (admins separately). `is_verified` flag controls
  whether a member's cars are visible to others.
- `cars` — owned by a member. Statuses: available, rented, inactive.
- `service_areas` — comma-list normalized to rows.
- `requests` — a member posts a request (open marketplace or direct to a car).
- `request_private` — PII (customer name + phone) split from public requests row.
- `offers` — owners reply to requests with their car + price.
- `bookings` — created when requester accepts an offer. Lifecycle:
  pending_owner_confirmation → confirmed → in_progress → completed (or cancelled).
- `audit_log`, `webhook_endpoints` — supporting tables.

Key RPC functions (all SECURITY DEFINER):

- `create_request(p_car_id, ..., p_acting_id)` — atomic write of `requests` +
  `request_private`. Rejects with `car_unavailable_in_window` if a direct
  request overlaps an existing booking on the same car.
- `accept_offer(p_offer_id)` → returns new booking id.
- `confirm_booking(p_booking_id)` → also auto-rejects sibling pending offers.
- `start_booking`, `complete_booking`, `cancel_booking`, `reject_offer`,
  `withdraw_offer`, `cancel_request`.
- Helpers: `is_admin()`, `get_my_role()`, `user_owns_car(p_car_id)`,
  `user_owns_offer_on_request(p_request_id)`, `user_is_request_requester(...)`,
  `user_in_booking_on_request(...)`, `car_has_blocking_booking(car, start, end)`,
  `car_is_currently_booked(car)`, `cars_blocked_in_window(car_ids[], start, end)`.

Trigger `offers_assert_no_overlap_ins` (on offers BEFORE INSERT) rejects offers
whose request window conflicts with an existing booking on the same car.

---

## 4. Frontend conventions

- Next.js 15 App Router + Supabase SSR.
- Routes under `/member/*` (cars, marketplace, requests, bookings).
- Admin routes at `/admin`.
- Currency: single source of truth at `src/lib/format.ts` (`formatMYR()`).
  Never hand-write `$` or `RM` anywhere else.
- All money form labels say "(RM)" explicitly so there's no ambiguity.
- All state-changing UI calls Supabase RPC directly with `supabase.rpc(...)`.
- After every successful RPC, the UI fires a webhook event via
  `emitClientEvent(...)` from `src/lib/webhooks/client.ts`. This is what
  drives the n8n WhatsApp integration.
- Recently fixed: the marketplace accepts `?from=&to=` query params and uses
  `cars_blocked_in_window` RPC to hide cars busy during that window. When the
  user clicks "Request this car" the window passes through to the new-request
  form prefilled.

---

## 5. Webhook event surface (UI-emitted)

| Event              | Fired from                                              | Payload                                            |
|--------------------|---------------------------------------------------------|----------------------------------------------------|
| `request.created`  | request-form (`create_request` RPC success)             | `{ request_id, is_direct, car_id }`                |
| `request.cancelled`| cancel-request.tsx                                      | `{ request_id }`                                   |
| `offer.created`    | offer-form.tsx (after `offers.insert().select('id')`)   | `{ offer_id, request_id, car_id }`                 |
| `offer.accepted`   | offer-actions.tsx → accept                              | `{ offer_id, booking_id }`                         |
| `offer.rejected`   | offer-actions.tsx → reject                              | `{ offer_id }`                                     |
| `booking.created`  | offer-actions.tsx → accept (same flow as offer.accepted)| `{ booking_id, offer_id }`                         |
| `booking.confirmed`| booking-actions.tsx → confirm                           | `{ booking_id }`                                   |
| `booking.started`  | booking-actions.tsx → start                             | `{ booking_id }`                                   |
| `booking.completed`| booking-actions.tsx → complete                          | `{ booking_id }`                                   |
| `booking.cancelled`| booking-actions.tsx → cancel                            | `{ booking_id, p_reason }`                         |

Server-side actions in `src/app/api/v1/*` also emit the same events via
`emit()` in `src/lib/webhooks/emit.ts`. Subscribers receive a stable shape:

```json
{
  "event": "request.created",
  "payload": { ... },
  "sent_at": "2026-05-21T12:00:00.000Z"
}
```

Signed with HMAC-SHA256 over the raw body, signature in `x-carpool-signature`
header. Subscribers must verify with the secret they registered.

Currently registered subscriber: n8n at the URL above, secret as in §2.

---

## 6. ⚠ OPEN BLOCKER — n8n HMAC verification

The n8n workflow JSON is imported and configured. The Config Set node holds:

```
CARPOOL_WEBHOOK_SECRET    (the shared secret)
SUPABASE_URL              https://wumekwxlehrivcxltvoq.supabase.co
SUPABASE_SERVICE_ROLE_KEY (JWT)
WAHA_URL                  http://waha:3000
WAHA_SESSION              default
WAHA_API_KEY              (whatever user set)
CARPOOL_PUBLIC_URL        https://carpool-agent.vercel.app
```

The **"Verify HMAC"** Code node currently uses `require('crypto')` which fails
on this n8n instance:

> Module 'crypto' is disallowed [line 2]

This is n8n's default sandbox. Two ways to fix:

### Option A — Replace the Code node with built-in nodes (cleanest)

n8n ships a **Crypto** node that can do HMAC. Replace the "Verify HMAC" Code
node with:

1. A **Set** node that extracts the raw body string and the signature header
   from the Webhook node's output. Output two fields: `raw_body`, `received_sig`.
2. A **Crypto** node configured as:
   - Action: HMAC
   - Algorithm: SHA256
   - Secret: `={{ $('Config').first().json.CARPOOL_WEBHOOK_SECRET }}`
   - Value: `={{ $json.raw_body }}`
   - Output encoding: hex
3. An **IF** node comparing the Crypto node's hash output to `received_sig`
   (string equals).
4. Continue downstream as before.

The Webhook node has `options.rawBody: true` so the raw body should be
available on `$('Carpool Webhook').first().json.body`.

### Option B — Rewrite the Code node using Web Crypto API

Web Crypto (`crypto.subtle.*`) is available as a global in n8n's sandbox and
doesn't trigger the require-disallowed rule. Replace the Code node body with:

```javascript
const cfg = $('Config').first().json;
const secret = cfg.CARPOOL_WEBHOOK_SECRET;
if (!secret || secret.startsWith('PASTE')) {
  throw new Error('CARPOOL_WEBHOOK_SECRET is not set in the Config node');
}

const inbound = $('Carpool Webhook').first().json;
const sig = (inbound.headers && inbound.headers['x-carpool-signature']) || '';

let rawBody = '';
if (typeof inbound.body === 'string') {
  rawBody = inbound.body;
} else if (inbound.body) {
  rawBody = JSON.stringify(inbound.body);
}

const enc = new TextEncoder();
const key = await crypto.subtle.importKey(
  'raw',
  enc.encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);
const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
const expected = Array.from(new Uint8Array(sigBytes))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

if (sig.length === 0 || sig !== expected) {
  return [{ json: { ok: false, reason: 'invalid_signature' } }];
}

const parsed = typeof inbound.body === 'string'
  ? JSON.parse(inbound.body)
  : inbound.body;

return [{
  json: {
    ok: true,
    event: parsed.event,
    payload: parsed.payload || {},
    sent_at: parsed.sent_at
  }
}];
```

(Make sure the n8n Code node has its language set to JavaScript and "Run Once
For Each Item" mode is the default — single execution. Top-level `await` is
supported in n8n Code nodes.)

**Recommendation:** Option B. Keeps the workflow shape identical, just one
node body changes.

### Once HMAC is fixed — smoke test

1. Activate the workflow in n8n (if not already).
2. Confirm acap2's phone is set in DB:
   `select phone from profiles where email = 'acap2@gmail.com';`
   Should be `+60192535599`.
3. Log in to https://carpool-agent.vercel.app as `acap@gmail.com` / `Test1234!`.
4. Marketplace → click "Request this car" on Toyota Vios.
5. Fill form (any future date range, any test customer name/phone).
6. Submit. WhatsApp should arrive at +60192535599 within 3 seconds.
7. In n8n executions tab, click the latest execution to inspect each node's
   output. The full chain should be:
   `Webhook → Config → Verify HMAC (ok:true) → Respond 200 → Switch
   (request.created branch) → RC · fetch request → RC · compose → RC · send WhatsApp`.

If the WhatsApp doesn't land but the workflow succeeds, the failure is at
WAHA. Check the RC · send WhatsApp node's HTTP response — common issues:
- 404 → WAHA `/api/sendText` path wrong, check WAHA version
- Connection refused → `http://waha:3000` not reachable from n8n container
  (check Docker network)
- 401 → WAHA_API_KEY mismatch
- 200 but no message → WAHA session not started/connected; check WAHA
  dashboard for the `default` session status

---

## 7. Test data state

Test users (all verified, all password `Test1234!`):

| Email                   | Role   | Notes                                              |
|-------------------------|--------|----------------------------------------------------|
| soulbladerz@gmail.com   | admin  | Real owner of the project                          |
| acap@gmail.com          | member | Test requester                                     |
| acap123@gmail.com       | member | Spare test account                                 |
| acap2@gmail.com         | member | Owns the Toyota Vios, phone +60192535599           |

Cars in DB: 1 Toyota Vios owned by acap2 (id `b620f8fd-1151-41c1-a1d7-96164a669941`).
Other cars may have been added during testing — check `select * from cars`.

A completed booking from earlier end-to-end RPC tests is in the bookings
table. Safe to ignore or clean up if needed.

---

## 8. Vercel env vars (already set)

```
NEXT_PUBLIC_SUPABASE_URL=https://wumekwxlehrivcxltvoq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  (legacy anon JWT)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...      (legacy service_role JWT)
API_INTEGRATION_KEY=f33b53b7a12c6c9b3a568447d1afcfd4db145a32878c355558bc12e383003c42
```

Note: the project currently uses Supabase's **legacy JWT keys** rather than
the new `sb_secret_...` / `sb_publishable_...` API keys. Both work; we chose
to defer the migration. If you want to switch later, update both Vercel env
vars and the n8n Config node's `SUPABASE_SERVICE_ROLE_KEY` field in one go.

---

## 9. Future work / Phase 5

Pending improvements ordered by value:

1. **Auto-expire stale flags** — pg_cron or n8n schedule that releases cars
   on bookings that hit `expires_at` without confirmation. (Schema field
   exists, sweeper does not.)
2. **Photo upload for cars** — `next.config.mjs` already whitelists
   `*.supabase.co`; need Supabase Storage bucket + form upload UI.
3. **Profile edit page** — fields exist (name, phone), RLS allows self-update,
   but there's no UI. Currently we set phones via raw SQL.
4. **Per-user notification preferences** + quiet hours (no WhatsApp 11pm–7am).
5. **Receipt / payout summary on booking.completed**.
6. **Customer-side reminders** — the actual passenger (not the agent) gets a
   "your driver picks you up at X" message. Different recipient than the
   booker.
7. **Migrate to new Supabase API keys** (`sb_secret_...`).
8. **Audit log coverage** — currently only verify/unverify writes. Should
   include flag inserts, car CRUD, signups.
9. **API rate limiting** on `/api/v1/*`.

---

## 10. Conventions to keep

- Branch: `claude/car-rental-marketplace-Soi3K`. Don't merge to main without
  explicit approval — main may be different.
- Commit messages: imperative mood, full paragraph for non-trivial changes
  (see prior commits as reference).
- New SQL goes in numbered migration files under `supabase/migrations/`,
  never directly applied to the live DB without committing the file too.
- DB changes that affect RLS: always test the policy under a synthetic JWT
  before assuming it works. The pattern that broke twice now is policies
  that read from the same table their policy is on, or cross-table policies
  that loop. Prefer SECURITY DEFINER helpers like `is_admin()` and
  `get_my_role()` for those checks.
- Currency: always `formatMYR()`. Never hand-format money.
- Errors raised from SQL with a Postgres-y `code_like_this` string get
  mapped to a friendly user message at the form layer (see request-form,
  offer-form, booking-actions).

---

## 11. Quick context for follow-ups

If asked about anything in this project, the priority order is:

1. Database is source of truth — check schema, RLS, RPC bodies first.
2. The Next.js app is mostly thin glue over Supabase + RPCs. Most bugs are
   either RLS misconfigurations or missing trigger logic, not React.
3. The repo on GitHub is in sync with the live DB at the time of writing
   (commit `4bff921`). If the live DB has changes that aren't in repo, the
   priority is to capture them as a migration file.
4. The user is technically proficient (deployed all this themselves with
   minimal hand-holding), comms in mixed English/Malay, prefers concise
   directives over hedging.

Good luck.
