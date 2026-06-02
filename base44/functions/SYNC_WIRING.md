# Channel Sync — Base44 wiring checklist

The sync **logic** lives in code (these functions). The **wiring** below is done
once in the Base44 Builder, because triggers, schedules, public webhook routes
and secrets are platform settings, not repo files. None of this costs message
credits if done via the settings UI rather than the Builder AI.

## Functions in this folder

| Function | Purpose | How it's triggered |
|---|---|---|
| `inboundBookingWebhook` | Receives bookings pushed by OTAs/hubs, dedups, creates/updates `Booking` | **Public webhook** (no auth; validated by secret) |
| `syncHubBookings` | Pull-based backstop: polls FareHarbor/Bokun for recent bookings | **Schedule** (every 10–15 min) |
| `pushAvailability` | Pushes a departure's remaining seats to outbound channels (anti-overbooking) | Called by `updateDepartureCapacity`; can also bind to **Departure update** |
| `autoInvoiceOnBooking` | On booking → confirmed, auto-creates a draft invoice (opt-in) | **Entity automation** on `Booking` create+update |
| `updateDepartureCapacity` | (existing) adjusts local capacity, now also chains `pushAvailability` | Entity automation on `Booking` create+update |

## 1. Inbound webhook
1. Deploy `inboundBookingWebhook`, copy its public URL.
2. For each hub, on the `HubConnection` set `webhook_secret_enc` to a random string.
3. Register the webhook in the provider with this URL:
   `<function-url>?tenant_id=<TENANT_ID>&source=fareharbor&secret=<SECRET>`
   - FareHarbor: email the URL to `support@fareharbor.com` to enable webhooks.
   - Bokun: Settings → Webhooks → add the URL.
   - `source` = `fareharbor` | `bokun` | `custom`.

## 2. Scheduled poll
- Add a **Scheduled** trigger on `syncHubBookings` (every 10–15 min).
- For FareHarbor, store the **company shortname** in `HubConnection.base_url`.
- Bokun signing (HMAC) is implemented per Bokun's documented scheme but
  **must be verified against a live account** before trusting it.

## 3. Availability push (anti-overbooking)
- Already chained: when a booking changes a departure's capacity,
  `updateDepartureCapacity` calls `pushAvailability` automatically.
- FareHarbor needs the slot id on the departure — add a `hub_availability_id`
  field to the `Departure` entity and populate it when departures are imported.
- Bokun push is scaffolded only (marked "manual" until verified).

## 4. Auto-invoicing (opt-in)
- Bind `autoInvoiceOnBooking` as an **entity automation** on `Booking` create+update.
- Enable per tenant by setting on the `InvoicingConnection.settings_json`:
  - `{ "auto_invoice": true }` → auto-create **draft** invoices.
  - add `"auto_issue": true` → also push to the fiscal provider (Quibi/Čebelca).
- `auto_issue` calls `issueInvoice`. Unattended issuance is now supported via a
  shared secret: set a Base44 **env var `INTERNAL_FN_SECRET`** (any long random
  string) available to both `issueInvoice` and `autoInvoiceOnBooking`. Without
  it, auto-issue is rejected and the invoice simply stays a draft. Leave
  `auto_issue` off until you've tested issuance manually — fiscalization is
  legally binding.

## Required data mapping (one-time, per listing)
For inbound bookings to attach to the right product, set on each `Experience`:
- `hub_experience_id` = the listing/product id used by the hub (FareHarbor item
  pk, Bokun product id). Unmapped bookings are not dropped — they raise an
  `Alert` ("needs experience mapping") so you can link them.

## Security note — credential fields
`api_key_enc` / `api_secret_enc` / `credentials_enc` / `webhook_secret_enc` are
currently stored as **plaintext** despite the `_enc` suffix (the forms write raw
values). For real encryption at rest, store a key as a Base44 **secret/env var**
and encrypt/decrypt inside these functions, or use Base44's managed secrets for
the credentials. Until then, rely on Base44's DB-level protection + RBAC and
treat these fields as sensitive.
