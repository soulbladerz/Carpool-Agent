# n8n workflows

Operational tooling for Carpool-Agent. These are n8n workflow exports kept
under version control so the same setup can be re-imported on a fresh n8n
instance.

## `carpool-whatsapp-notifications.json`

Listens for HMAC-signed webhook events from the carpool app and turns them
into WhatsApp messages sent via WAHA. Handles five event types:
`request.created`, `offer.created`, `booking.created`, `booking.confirmed`,
`booking.cancelled`.

### Import & setup

1. n8n → Workflows → Import from File → pick this JSON.
2. Open the **Config** Set node and fill in:
   - `CARPOOL_WEBHOOK_SECRET` — shared HMAC secret (must match the value
     registered with the carpool app via `POST /api/v1/webhooks`)
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - `WAHA_URL`, `WAHA_SESSION`, `WAHA_API_KEY`
   - `CARPOOL_PUBLIC_URL`
3. Activate the workflow.
4. The webhook URL n8n shows is the one to register with the carpool app.

### Known gotcha — HMAC node

The "Verify HMAC" Code node uses Web Crypto (`crypto.subtle.*`) rather than
`require('crypto')` because the latter is blocked by n8n's default sandbox.
If you ever see "Module 'crypto' is disallowed" after re-importing, the
node body got reverted — copy the version from `docs/HANDOFF.md` §6 Option
B back in.

### Subscribing

```
curl -X POST "$CARPOOL_PUBLIC_URL/api/v1/webhooks" \
  -H "x-api-key: $API_INTEGRATION_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-n8n.example.com/webhook/carpool-notify",
    "secret": "the-same-secret-as-in-config",
    "event_types": []
  }'
```

Empty `event_types` array subscribes to all events.
