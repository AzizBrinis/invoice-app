# PrestaShop Invoice API

Server-to-server API that lets the techno-smart.tn PrestaShop shop (PrestaShop 8.2.5 / PHP 8.3) send an order to
invoice-app and get back the generated invoice PDF. It is used by the shop's **Generate Invoice** button
(PrestaShop module `tsinvoiceapp`, Phase 2; this document is its contract).

```
PrestaShop back office ──(HTTPS, HMAC-signed JSON)──▶ POST /api/integrations/prestashop/invoices
                                                     │ 1. verify HTTPS, IP allowlist, signature, nonce, rate limit
                                                     │ 2. validate payload, recompute totals (no number consumed)
                                                     │ 3. claim order (idempotency) ─ duplicate? → replay existing invoice
                                                     │ 4. resolve client → createInvoiceForUser → record payment
                                                     │ 5. render PDF with the existing invoice template
PrestaShop ◀──── 201/200 JSON {invoice, pdf.base64} or raw application/pdf
```

The invoice is created through the same code path as invoices created in the app (`createInvoiceForUser`,
same numbering sequence, tax engine, PDF template and company settings). It then appears in **Factures**
like any other invoice.

## Code map

| Concern | File |
| --- | --- |
| Routes (Next.js, Node runtime) | `src/app/api/integrations/prestashop/invoices/route.ts` (POST generate), `…/invoices/[shopId]/[orderId]/route.ts` (GET download) |
| Orchestration, HTTP responses, logging | `src/server/integrations/prestashop/service.ts` |
| HMAC signing scheme | `src/server/integrations/prestashop/signature.ts` |
| Payload schema, decimal handling, order → invoice mapping | `src/server/integrations/prestashop/payload.ts` |
| Nonces, rate limit, idempotency (Postgres) | `src/server/integrations/prestashop/store.ts` |
| Environment configuration | `src/server/integrations/prestashop/config.ts` |
| Migration / rollback | `scripts/sql/20261109_external_invoice_requests{,_rollback}.sql` |
| Invoice numbering (shared with the app) | `src/server/sequences.ts`, `createInvoiceForUser` in `src/server/invoices.ts` |
| Tests | `tests/prestashop-invoice-api.test.ts`, `tests/prestashop-invoice-store.test.ts`, `tests/invoice-numbering-db.test.ts`, `tests/prestashop-invoice-e2e-db.test.ts` |

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PRESTASHOP_INVOICE_API_KEYS` | yes | — | Comma-separated `keyId:secret` pairs. Key id `[A-Za-z0-9._-]{3,64}`, secret ≥ 32 chars. Generate with `openssl rand -hex 32`. |
| `PRESTASHOP_INVOICE_TENANT_ID` | yes | — | invoice-app `User.id` of the account (tenant) that owns the invoices and clients. |
| `PRESTASHOP_INVOICE_ALLOWED_IPS` | no | empty (any) | Comma-separated exact IPs of the PrestaShop server. Read from platform-set headers (`x-vercel-forwarded-for`, `x-real-ip`, then `x-forwarded-for`). |
| `PRESTASHOP_INVOICE_RATE_LIMIT_PER_MINUTE` | no | `30` | Authenticated requests per key per minute (shared across instances, stored in Postgres). |
| `PRESTASHOP_INVOICE_MAX_CLOCK_SKEW_SECONDS` | no | `300` | Accepted difference between the request timestamp and server time (30–900). |
| `PRESTASHOP_INVOICE_TOTAL_TOLERANCE` | no | `0.010` | Accepted difference (currency units) between the shop's `totalTaxIncl` and the recomputed invoice total. |
| `PRESTASHOP_INVOICE_APPLY_TIMBRE` | no | `true` | Add the timbre fiscal as configured in the tenant tax settings (Paramètres → Taxes: enabled flag and amount). It is excluded from the totals check, so the invoice total exceeds the order total by that amount. `false` opts out. Exception: a timbre already charged at checkout (`timbreFiscal`) is always carried, once, whatever this setting. |
| `PRESTASHOP_INVOICE_RECORD_PAYMENTS` | no | `true` | When `order.isPaid` is true, record a payment so the invoice is marked paid. |

If a required variable is missing or invalid, the endpoint answers `503 SERVICE_UNAVAILABLE`. The reason is
logged server-side, never returned. HTTPS is enforced when `NODE_ENV=production`.

## Deployment

1. Back up the database, then apply the migration with the direct/session pooler URL:
   `psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/sql/20261109_external_invoice_requests.sql`
   It is additive, transactional and idempotent. It only creates two new tables.
2. Set `PRESTASHOP_INVOICE_TENANT_ID` and `PRESTASHOP_INVOICE_API_KEYS` in Vercel (Production only), plus
   optional hardening variables. Store the same `keyId`/secret in the PrestaShop module configuration.
   Do not put them in source control.
3. Redeploy, then send a signed test request (see [Testing a deployment](#testing-a-deployment)).

**Key rotation:** add the new key (`old:…,new:…`), deploy, switch the module to the new key, then remove the old key.

**Rollback:** remove `PRESTASHOP_INVOICE_API_KEYS` (the endpoint then returns 503), then optionally run
`20261109_external_invoice_requests_rollback.sql`. Invoices that were already generated are kept.

## Endpoint

`POST https://<invoice-app host>/api/integrations/prestashop/invoices`

Other methods return `405`. The endpoint is excluded from the page middleware (`/api`), so no session or CSRF
applies. Authentication comes only from the signature.

### Required headers

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `X-Signature-Key-Id` | Key id from `PRESTASHOP_INVOICE_API_KEYS` |
| `X-Signature-Timestamp` | Current Unix time in seconds |
| `X-Signature-Nonce` | Fresh random value per HTTP attempt, `[A-Za-z0-9_-]{16,128}` (e.g. `bin2hex(random_bytes(16))`) |
| `Idempotency-Key` | Stable per invoice attempt, `[A-Za-z0-9._:-]{8,128}`. **Reuse it on retries.** Recommended: `ps-<id_shop>-<id_order>`. |
| `X-Signature` | `v1=<hex HMAC-SHA256>`, see below |
| `Accept` (optional) | `application/json` (default) or `application/pdf` for a raw PDF body |

Body: JSON, UTF-8, at most 1 MiB.

### Signature (v1)

```
canonical = "PSINV1"            + "\n" +
            "POST"              + "\n" +
            "/api/integrations/prestashop/invoices" + "\n" +
            <X-Signature-Timestamp> + "\n" +
            <X-Signature-Nonce>     + "\n" +
            <Idempotency-Key>       + "\n" +
            hex(sha256(<exact raw request body bytes>))

X-Signature = "v1=" + hex(hmac_sha256(key = secret, message = canonical))
```

Sign exactly the bytes you send: serialize the JSON once and use that same string for both the hash and the body.

PHP reference (for the Phase 2 module):

```php
$body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
$path = '/api/integrations/prestashop/invoices';
$timestamp = (string) time();
$nonce = bin2hex(random_bytes(16));
$idempotencyKey = sprintf('ps-%d-%d', (int) $order->id_shop, (int) $order->id);
$canonical = implode("\n", ['PSINV1', 'POST', $path, $timestamp, $nonce, $idempotencyKey, hash('sha256', $body)]);
$signature = 'v1=' . hash_hmac('sha256', $canonical, $secret);

$ch = curl_init($baseUrl . $path);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_SSL_VERIFYPEER => true,   // never disable
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'X-Signature-Key-Id: ' . $keyId,
        'X-Signature-Timestamp: ' . $timestamp,
        'X-Signature-Nonce: ' . $nonce,
        'Idempotency-Key: ' . $idempotencyKey,
        'X-Signature: ' . $signature,
    ],
]);
```

Keep the PrestaShop server clock in sync (NTP). Requests outside ±`MAX_CLOCK_SKEW_SECONDS` are rejected.

### Request payload (`schemaVersion: 1`)

Unknown fields are rejected. All monetary values and tax rates are **decimal strings** (money: up to 6 decimals,
which is PrestaShop's storage precision; rates: up to 3 decimals). Prices are rounded half-up to 3 decimals of the
currency unit, which is the invoice-app document precision. Supported currencies: `TND`, `EUR`, `USD`, `GBP`, `CAD`.

```json
{
  "schemaVersion": 1,
  "shop": { "id": 1, "name": "Techno Smart" },
  "order": {
    "id": 4521,
    "reference": "XKBKNABJK",
    "createdAt": "2026-11-08T14:32:10+01:00",
    "currency": "TND",
    "paymentMethod": "Paiement à la livraison",
    "isPaid": true,
    "paidAt": "2026-11-08T15:00:00+01:00"
  },
  "customer": {
    "id": 77, "email": "client@example.com", "firstName": "Amine", "lastName": "Ben Salah",
    "company": null, "vatNumber": null, "phone": "+21620000000"
  },
  "billingAddress": {
    "firstName": "Amine", "lastName": "Ben Salah", "company": "ACME SARL", "vatNumber": "1234567/A/M/000",
    "address1": "12 Rue de Marseille", "address2": null, "postcode": "1000", "city": "Tunis",
    "state": null, "country": "Tunisie", "countryIso": "TN", "phone": null, "phoneMobile": "+21620000000"
  },
  "lines": [
    { "productId": 101, "productAttributeId": 0, "reference": "CASQ-X", "name": "Casque Bluetooth X",
      "quantity": 2, "unitPriceTaxExcl": "100.000000", "unitPriceTaxIncl": "119.000000", "taxRate": "19.000" },
    { "productId": 202, "productAttributeId": 5, "reference": null, "name": "Câble USB-C",
      "quantity": 1, "unitPriceTaxExcl": "8.403361", "unitPriceTaxIncl": "10.000000", "taxRate": "19.000" }
  ],
  "shipping": { "carrierName": "Aramex", "amountTaxExcl": "5.882353", "amountTaxIncl": "7.000000", "taxRate": "19.000" },
  "wrapping": null,
  "discounts": [
    { "name": "BIENVENUE", "amountTaxExcl": "8.403361", "amountTaxIncl": "10.000000", "freeShipping": false }
  ],
  "invoiceOptions": { "vatRate": "19.000" },
  "totals": {
    "productsTaxExcl": "208.403361", "productsTaxIncl": "248.000000",
    "discountsTaxExcl": "8.403361", "discountsTaxIncl": "10.000000",
    "shippingTaxExcl": "5.882353", "shippingTaxIncl": "7.000000",
    "wrappingTaxExcl": "0.000000", "wrappingTaxIncl": "0.000000",
    "totalTaxExcl": "205.882353", "totalTaxIncl": "245.000000", "totalPaid": "245.000000"
  }
}
```

| Field | Rules | PrestaShop 8 source |
| --- | --- | --- |
| `shop.id` | int > 0 | `$order->id_shop` |
| `order.id`, `order.reference` | int > 0; `[A-Za-z0-9_-]{1,64}` | `$order->id`, `$order->reference` |
| `order.createdAt` | ISO-8601 with offset | `$order->date_add` + shop timezone |
| `order.currency` | ISO code (supported list) | `(new Currency($order->id_currency))->iso_code` |
| `order.paymentMethod` | 1–128 chars | `$order->payment` |
| `order.isPaid`, `order.paidAt` | bool; ISO-8601 or null | `$order->getCurrentOrderState()->paid`, payment date |
| `customer.*` | valid email; names 1–64 chars | `new Customer($order->id_customer)` |
| `billingAddress.*` | address1/city/country required | `new Address($order->id_address_invoice)`, `Country::getNameById`, `State::getNameById` |
| `lines[]` (1–500) | quantity 1–100000 | `$order->getOrderDetailList()`: `product_id`, `product_attribute_id`, `product_reference`, `product_name`, `product_quantity`, `unit_price_tax_excl`, `unit_price_tax_incl`, `tax_rate` (final price after specific prices) |
| `shipping` | null if no carrier | `total_shipping_tax_excl/incl`, `carrier_tax_rate`, carrier name |
| `wrapping` | null if none | `total_wrapping_tax_excl/incl` |
| `discounts[]` (≤ 50) | sum must equal `totals.discountsTaxExcl` | `$order->getCartRules()`: `name`, `value_tax_excl`, `value`, `free_shipping` |
| `timbreFiscal.amount` | optional decimal string; must equal the tenant's timbre | Timbre fiscal charged at checkout by `tsinvoiceapp` (hidden product line, included in `totals.products*`/`total*`, **excluded from `lines`**). Omitted when not charged. |
| `invoiceOptions.vatRate` | optional decimal string, must be one of the tenant's VAT rates | VAT rate selected by the employee on the order page. Absent/null keeps each line's shop rate. |
| `totals.*` | all required except `totalPaid`; `products − discounts + shipping + wrapping = total` (HT and TTC, ± tolerance) | `total_products`, `total_products_wt`, `total_discounts_tax_excl/incl`, `total_shipping_tax_excl/incl`, `total_wrapping_tax_excl/incl`, `total_paid_tax_excl/incl`, `total_paid_real` |

Use `number_format($value, 6, '.', '')` for money and `number_format($rate, 3, '.', '')` for rates. Never send PHP floats.

There is no invoice number field anywhere in the payload (unknown fields are rejected): numbering belongs exclusively
to invoice-app.

### How the order becomes an invoice

* One invoice line per product, with the description `name (Réf. reference)` and unit `unité`. Lines use the
  **tax-inclusive basis**: the unit TTC price is kept and HT/VAT are derived by the existing engine, as for
  TTC-entered lines in the editor. Products are not linked to invoice-app catalogue products.
* Shipping and gift wrapping become extra lines. A cart rule with `freeShipping: true` is applied to the
  shipping line, so its VAT follows the carrier rate. Other discounts become the invoice's global discount (HT),
  allocated proportionally by the existing engine.
* **Selected VAT (`invoiceOptions.vatRate`):** applied to every product, shipping and wrapping line. The TTC amounts the
  customer paid are kept and HT/VAT are derived from the selected rate (techno-smart.tn records almost all order lines at
  0 %, so the shop's own HT is not meaningful). Discounts are converted from their TTC amount at the same rate. The rate
  must exist in the tenant's tax settings, otherwise `422 VAT_RATE_NOT_ALLOWED` (before any number is consumed).
* **Timbre charged at checkout (`timbreFiscal`):** the invoice carries it as its timbre fiscal exactly once (no second
  timbre is added), so the invoice total equals the order total. It must equal the tenant's configured timbre, otherwise
  `422 TIMBRE_MISMATCH` (also when the timbre is disabled in invoice-app). The totals check compares the invoice total
  without timbre with the order total minus that timbre.
* FODEC is never applied. The timbre fiscal is applied by default from the tenant tax settings (see
  `PRESTASHOP_INVOICE_APPLY_TIMBRE`).
* **Numbering:** the number comes from the same allocator as invoices created in the app: `max(sequence counter,
  highest number already issued with the same prefix/year) + 1`, reserved under a row lock in the same transaction as
  the invoice and its lines. Numbers typed manually in the editor are therefore continued, concurrent creations never
  share a number, and a failed creation does not leave a gap. The shop never supplies a number (any `number` /
  `invoiceNumber` field is rejected), and one order consumes exactly one number: rejected requests, duplicate clicks,
  retries and downloads never reserve one. With annual reset, the year is the **Africa/Tunis** calendar year, so an
  invoice issued at 00:30 on 1 January starts the new series even though the server runs on UTC.
* **Saved in Factures:** the invoice is stored for the tenant like any invoice created in the app, with the same
  sequence, client, lines, payments and audit behaviour. It appears in **Factures** immediately: the list, stats and
  detail caches are expired, not served stale.
* **Company details:** the PDF never stores your company details. They are read from **Paramètres généraux**
  (`CompanySettings`: name, logo, MF, VAT number, address, phone, e-mail, bank details) every time the PDF is
  rendered. To always show current details in PrestaShop, download the PDF through
  [`GET …/invoices/{shopId}/{orderId}`](#download-an-existing-invoice) each time instead of keeping a copy.
* **Totals checks:** the payload's own totals must add up (`VALIDATION_FAILED` otherwise). Then, before any number is
  consumed, the invoice total (without timbre) is recomputed with the tenant's tax settings. If it differs from
  `totals.totalTaxIncl` by more than the tolerance, the request is rejected with `TOTALS_MISMATCH`. A smaller
  difference (VAT rounding of a discount allocated across lines, at most a few millimes) is accepted but never hidden:
  it is returned in `totalsCheck.difference` and shown on the order page.
* Invoice status is `ENVOYEE`, the issue date is the generation date, the reference is the order reference, and the
  notes contain the order number/date, payment method and discount names.
* When the order is paid (and `RECORD_PAYMENTS` is on), a payment of `totalPaid` (capped at the invoice total) is
  recorded with the order's payment method, which moves the invoice to `PAYEE`. If recording fails, the invoice is still
  returned with `payment.recorded = false` and the payment can be entered manually.
* **Client:** matched by e-mail within the tenant, otherwise created (source `IMPORT`). For an existing client only
  **blank** fields (address, phone, company, VAT number) are filled; manual edits in invoice-app are never overwritten.
  Note that the invoice PDF renders the client's *current* record, which is existing app behaviour.

## Responses

All responses carry `Cache-Control: no-store` and `X-Request-Id` (quote it when reporting issues).

### Success

| Status | Meaning |
| --- | --- |
| `201 Created` | Invoice generated by this request. `X-Idempotent-Replay: false` |
| `200 OK` | Invoice already existed for this order with the same payload (retry or second click). `X-Idempotent-Replay: true` |

Default JSON body:

```json
{
  "status": "created",
  "requestId": "1f0c…",
  "invoice": {
    "id": "cm…", "number": "FAC-2026-0042", "status": "PAYEE",
    "orderId": 4521, "orderReference": "XKBKNABJK",
    "issueDate": "2026-11-09T10:12:00.000Z", "currency": "TND",
    "totalTaxIncl": "246.000", "totalTaxExcl": "205.882", "totalVat": "39.118", "timbreAmount": "1.000",
    "vatRates": ["19.000"], "amountPaid": "245.000"
  },
  "payment": { "recorded": true },
  "totalsCheck": { "orderTotalTaxIncl": "245.000", "timbreChargedByShop": false, "invoiceTotalWithoutTimbre": "245.000", "difference": "0.000" },
  "pdf": {
    "filename": "facture-FAC-2026-0042.pdf", "contentType": "application/pdf",
    "sizeBytes": 48211, "sha256": "9a1c…", "base64": "JVBERi0xLjcK…"
  }
}
```

`payment` is `null` when no payment was attempted. Verify `sha256` after decoding `base64`.

With `Accept: application/pdf`, the body is the raw PDF, with headers `Content-Type: application/pdf`,
`Content-Disposition: attachment; filename="…"`, `X-Invoice-Id`, `X-Invoice-Number` and `X-Content-SHA256`.

### Errors

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Données de commande invalides.", "retryable": false,
             "requestId": "1f0c…", "details": [ { "path": "lines.0.quantity", "message": "…" } ] } }
```

| Status | `code` | Retry? | Meaning / module action |
| --- | --- | --- | --- |
| 400 | `INVALID_JSON` | no | Body is not valid UTF-8 JSON. |
| 401 | `UNAUTHORIZED` | no | Missing/malformed headers, unknown key, timestamp outside window, bad signature, or replayed nonce. The response is deliberately generic; check the server logs by `requestId`. |
| 403 | `HTTPS_REQUIRED` / `FORBIDDEN` | no | Plain HTTP in production / IP not in the allowlist. |
| 404 | `INVOICE_NOT_FOUND` | no | GET download only: no invoice was generated for this order. |
| 405 | `METHOD_NOT_ALLOWED` | no | Only `POST`. |
| 409 | `ORDER_ALREADY_INVOICED` | no | The order already has an invoice and the payload changed. `details` has `invoiceId`/`invoiceNumber`. Correct it in invoice-app (credit note / manual edit). |
| 409 | `REQUEST_IN_PROGRESS` | yes | Another request for this order is generating. Wait `Retry-After` seconds and retry. |
| 413 | `PAYLOAD_TOO_LARGE` | no | Body > 1 MiB. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | no | Content-Type must be `application/json`. |
| 422 | `VALIDATION_FAILED` | no | Schema or consistency error; see `details[].path`. |
| 422 | `TOTALS_MISMATCH` | no | Recomputed total ≠ `totals.totalTaxIncl` (± tolerance). Check tax rates and discounts. |
| 422 | `TIMBRE_MISMATCH` | no | `timbreFiscal.amount` differs from the tenant's timbre (or the timbre is disabled in invoice-app). Align the module setting with Paramètres → Taxes. |
| 422 | `VAT_RATE_NOT_ALLOWED` | no | `invoiceOptions.vatRate` is not configured in invoice-app; `details` lists the allowed rates. |
| 422 | `IDEMPOTENCY_KEY_REUSED` | no | The key was used for another order or with a different payload. |
| 429 | `RATE_LIMITED` | yes | Honour `Retry-After`. |
| 500 | `INVOICE_GENERATION_FAILED` | yes | Nothing was created. Retry with the same `Idempotency-Key`. |
| 500 | `PDF_GENERATION_FAILED` | yes | The invoice **was** created (`details.invoiceId`). Retry with the same key to get the PDF; no duplicate is created. |
| 500 | `INTERNAL_ERROR` | yes | Unexpected error. Details are only in the server logs. |
| 503 | `SERVICE_UNAVAILABLE` | yes | Integration not configured (or tenant not found). |

## Download an existing invoice

`GET https://<invoice-app host>/api/integrations/prestashop/invoices/{shopId}/{orderId}`

This is a read-only call for the shop's "Download invoice" button. It never creates an invoice or consumes a number.
The PDF is **re-rendered on every call** from the stored invoice and the **current Paramètres généraux**, so changes
to the company name, address, MF, logo and so on show up on the next download.

* Same signed headers as POST, except that `Content-Type` and `Idempotency-Key` are not needed. The canonical string
  uses `GET`, the full path including both ids, an **empty** idempotency-key line and the SHA-256 of an empty body
  (`e3b0c442…b855`). The signature is therefore bound to that exact order.
* Response: same JSON (or raw PDF with `Accept: application/pdf`) as a POST replay, `status: "existing"`,
  `payment: null`, `totalsCheck: null`.
* `404 INVOICE_NOT_FOUND` when no invoice was generated for that order. Other errors are as in the table above
  (`401`, `429`, `500 PDF_GENERATION_FAILED`, …).

```php
$path = sprintf('/api/integrations/prestashop/invoices/%d/%d', (int) $order->id_shop, (int) $order->id);
$canonical = implode("\n", ['PSINV1', 'GET', $path, $timestamp, $nonce, '', hash('sha256', '')]);
$signature = 'v1=' . hash_hmac('sha256', $canonical, $secret);
```

## Idempotency and duplicates

* There is at most **one invoice per (tenant, shop, order)**. This is enforced by a unique constraint in
  `ExternalInvoiceRequest`, not by application logic alone, so it holds across concurrent serverless instances.
* Same order and same payload, whatever the `Idempotency-Key`, returns the existing invoice (`200`) and regenerates
  its PDF.
* Same `Idempotency-Key` with a different payload or another order returns `422 IDEMPOTENCY_KEY_REUSED`.
* Same order with a changed payload and a new key returns `409 ORDER_ALREADY_INVOICED` (invoices are never silently
  rewritten).
* Concurrent duplicates: one request generates; the others get `409 REQUEST_IN_PROGRESS` or the replay.
* Failures before the invoice exists mark the request `FAILED`, and a retry may regenerate. As soon as the invoice
  exists, the request is marked `COMPLETED`. If an instance crashes in between, the claim becomes stale after
  180 s. The next retry first looks for an invoice with the order reference created since the claim and adopts it
  instead of creating a duplicate.
* **Retry policy for the module:** retry only `retryable: true` errors and network timeouts, with exponential
  backoff (e.g. 2 s, 5 s, 15 s), with the **same `Idempotency-Key`** and a **new nonce/timestamp/signature** on
  every attempt.

## Security summary

* **Authentication:** HMAC-SHA256 over method, path, timestamp, nonce, idempotency key and body hash, compared
  in constant time. Secrets are never logged or returned. Multiple keys allow rotation.
* **Replay protection:** ±5 min timestamp window, and every nonce is stored (`IntegrationRequestNonce`, unique per key)
  for twice that window. Nonces are only stored after a valid signature, so unauthenticated traffic cannot fill the
  table. Expired rows are purged opportunistically.
* **Transport:** HTTPS is required in production. The module must keep TLS verification on.
* **Authorization:** each key may only act on the single configured tenant, and every DB access is scoped by that
  tenant id.
* **Rate limiting:** an in-memory per-IP limit before authentication (120/min per instance) and a Postgres-backed
  per-key limit after authentication (shared across instances).
* **Input:** body size cap, strict Content-Type, strict schema (unknown fields rejected), string-encoded decimals
  parsed without floats, control characters stripped, length limits on every string. HTML escaping happens in the
  existing PDF template.
* **Errors and logs:** clients get stable codes and generic messages. Logs are structured (`[prestashop-invoices]`)
  and contain only request id, key id, shop/order ids, invoice id, event and error class. They never contain
  payload, customer data, headers or signatures.

## Testing

```bash
npm test -- tests/prestashop-invoice-api.test.ts      # unit + endpoint tests (no DB needed)
TEST_DATABASE_URL=postgres://… npm test -- tests/prestashop-invoice-store.test.ts tests/invoice-numbering-db.test.ts tests/prestashop-invoice-e2e-db.test.ts   # local Postgres only
```

The endpoint tests use the real tax/totals engine with an in-memory store and a fake PDF renderer. They cover
successful generation (JSON and binary), authentication failures (missing headers, bad secret, unknown key, expired
or future timestamp, tampered body, replayed nonce, key rotation, HTTPS, IP allowlist, misconfiguration), rate
limiting, validation errors (schema, unknown fields, discount consistency, totals mismatch, body size, JSON,
content type), idempotency (replay, second click, key reuse, changed order, concurrency, in-progress, crash
recovery), failures (invoice, PDF, payment, unexpected), log hygiene, numbering ownership (number fields rejected,
one number per order, Tunis year) and the GET download (re-rendered with changed company details, 404, signature
bound to the order, replayed nonce).

`tests/prestashop-invoice-e2e-db.test.ts` runs the real handler, store, numbering, persistence and PDF template
against Postgres (only headless Chrome is stubbed). It checks that shop and manual invoices share one gapless
sequence (`0001` manual, `0002` shop, second click still `0002`, rejected order consumes nothing, `0003` shop, `0004`
manual, `0005` shop), that the invoices are listed for the tenant, and that after editing Paramètres généraux the
re-downloaded PDF shows the new name, MF, address and phone and none of the old ones.

### Testing a deployment

Sign and send the sample payload above with Node, without adding any dependency:

```bash
BASE=https://<host> KEY_ID=… SECRET=… node -e '
const c=require("crypto"),fs=require("fs");const body=fs.readFileSync("order.json","utf8");
const p="/api/integrations/prestashop/invoices",t=String(Math.floor(Date.now()/1e3)),n=c.randomBytes(16).toString("hex"),k="ps-1-4521";
const s="v1="+c.createHmac("sha256",process.env.SECRET).update(["PSINV1","POST",p,t,n,k,c.createHash("sha256").update(body).digest("hex")].join("\n")).digest("hex");
fetch(process.env.BASE+p,{method:"POST",body,headers:{"content-type":"application/json","x-signature-key-id":process.env.KEY_ID,"x-signature-timestamp":t,"x-signature-nonce":n,"idempotency-key":k,"x-signature":s}})
.then(async r=>{const j=await r.json();if(j.pdf){fs.writeFileSync("invoice.pdf",Buffer.from(j.pdf.base64,"base64"));delete j.pdf.base64}console.log(r.status,JSON.stringify(j,null,2))});'
```

Use a dedicated test order: the invoice it creates consumes a real number in the tenant's sequence.

## Known limitations / Phase 2 notes

* Credit notes and order modifications after invoicing are out of scope (`409 ORDER_ALREADY_INVOICED`).
* The pre-auth IP limiter is per instance; the authenticated per-key limiter is global.
* The PDF is regenerated on every replay and download (never stored), so it reflects the current company settings and
  client record. A PDF the shop saved earlier is a snapshot: use the GET download to show current details.
