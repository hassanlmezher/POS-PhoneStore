# Build Plan

Working names: product = `APP_NAME` env, domain = `ROOT_DOMAIN` env (placeholders until the owner picks them).

## 1. Architecture at a glance

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router (`proxy.ts` replaces `middleware.ts`), TypeScript strict, server components + server actions |
| UI | Tailwind v4, shadcn/ui, lucide-react, sonner (toasts, ships with shadcn) |
| DB | PostgreSQL 16 + Prisma 7 (driver adapter `@prisma/adapter-pg`, client generated to `lib/generated/prisma`) |
| Auth | Better Auth: email + password, sessions stored in Postgres, Prisma adapter |
| i18n | next-intl, locale from cookie / user preference (no `/ar` URL prefix, since URLs are already per-subdomain); `dir="rtl"` on `<html>` for Arabic |
| Validation | zod |
| QR codes | `qrcode` (tiny, offline). Barcodes (Code128) rendered as SVG by our own ~80-line encoder |
| Charts | Own small SVG bar chart (`components/bar-chart.tsx`), no library |
| Printing | Browser print. Dedicated print routes with `@page` CSS for 80mm thermal and A4. No print server |
| Barcode scanning | USB/Bluetooth scanners act as keyboards → the search input handles them. Camera scanning later via native `BarcodeDetector` |
| Deploy | Docker image (Next standalone) + Postgres + Caddy (automatic HTTPS, on-demand TLS per shop subdomain, no DNS-provider API needed) |

### Multi-tenancy
- `proxy.ts` reads the `Host` header:
  - `ROOT_DOMAIN` / `www.` → marketing site (`app/(marketing)`).
  - `admin.ROOT_DOMAIN` → super admin panel (`app/admin`).
  - `<slug>.ROOT_DOMAIN` → rewritten internally to `app/shop/[slug]/...`.
  - Local dev: `<slug>.localhost:3000` works out of the box; `localhost:3000?shop=<slug>` sets a `dev_shop` cookie (dev only). `admin.localhost:3000` for the super admin.
- Direct requests to `/shop/...` paths are blocked by middleware (only reachable through the rewrite).
- `lib/tenant.ts → requireShop()` resolves the slug to a `Shop` server-side (cached per request), checks subscription status, and checks that the session user belongs to that shop. The `shopId` always comes from here, never from form data.
- `lib/db.ts → tenantDb(shopId)`: a Prisma client extension that injects `shopId` into `where` / `data` for every tenant-scoped model. Code in features always uses `tenantDb`, so forgetting the filter is not possible. Raw SQL (reports) must filter on `shopId` explicitly.
- Session cookies are host-only (not shared across subdomains), so a login on one shop never authenticates on another.
- Expired subscription → shop app becomes read-only with a banner (owner can still view and export); the public status page keeps working.

### Money
- Integers only. USD in cents, LBP in whole pounds. Every money column has a matching currency or is documented as USD cents.
- Prices, costs and ticket totals are stored in **USD cents** (the shop's base currency). LBP values shown next to them are computed live with the shop's current rate.
- **Payments** store the amount *in the currency actually tendered* (`amount` + `currency`) **plus a snapshot of the exchange rate** at that moment, so history never changes when the rate changes.
- `Shop.exchangeRate` = LBP per 1 USD (e.g. 89,500). Every rate change is logged in `ExchangeRate`.
- `lib/money.ts`: `toLbp`, `toUsdCents`, `format`, `parseInput`, rounding rules (LBP rounded to the nearest 1,000 for cash by default, configurable). `<Money usd={cents} />` shows both currencies everywhere.

### Roles & permissions (`lib/permissions.ts`, one matrix)
| Area | Owner | Cashier | Technician |
|---|---|---|---|
| Tickets: create / intake | ✓ | ✓ | ✓ |
| Tickets: view | all | all | assigned to them + unassigned |
| Tickets: change status, add parts/labor | ✓ | status only | ✓ (own tickets) |
| POS / payments | ✓ | ✓ | – |
| Customers | ✓ | ✓ | view |
| Inventory: view / adjust | ✓ / ✓ | view / – | view / – |
| Cash drawer | ✓ | ✓ open/close | – |
| Reports, Settings, Staff | ✓ | – | – |

Super admin is a platform user (`shopId = null`, `isSuperAdmin = true`) and only uses `admin.` host.

## 2. Database schema (Prisma, abbreviated)

All tenant tables have `shopId` + `@@index([shopId, ...])`, `createdAt`, `updatedAt`. IDs are `cuid()`.

```prisma
// ---------- Platform ----------
model Shop {
  id                 String   @id @default(cuid())
  slug               String   @unique            // subdomain
  name               String
  logoUrl            String?
  address            String?
  phone              String?
  defaultLocale      Locale   @default(EN)
  exchangeRate       Int      @default(89500)    // LBP per 1 USD
  lbpRounding        Int      @default(1000)
  defaultWarrantyDays Int     @default(30)
  receiptFooter      String?  // EN/AR stored as JSON? -> see receiptFooterAr
  receiptFooterAr    String?
  termsText          String?
  termsTextAr        String?
  ticketPrefix       String   @default("R-")
  ticketSeq          Int      @default(1000)     // incremented atomically
  saleSeq            Int      @default(1000)
  planId             String?
  subscriptionStatus SubStatus @default(TRIAL)   // TRIAL | ACTIVE | EXPIRED | SUSPENDED
  paidUntil          DateTime?
  trialEndsAt        DateTime?
}
model Plan { id, name, priceUsdCents Int, maxStaff Int?, active Boolean }
model SubscriptionPayment { id, shopId, amountUsdCents Int, method String, periodStart, periodEnd, note, recordedById }
model ExchangeRate { id, shopId, rate Int, setById, createdAt }

// ---------- Auth (Better Auth tables + our fields) ----------
model User {
  id, email @unique, name, emailVerified, image?
  shopId        String?          // null for super admin
  role          Role             // OWNER | TECHNICIAN | CASHIER
  isSuperAdmin  Boolean @default(false)
  locale        Locale?
  active        Boolean @default(true)
}
model Session { id, userId, token @unique, expiresAt, ipAddress?, userAgent? }
model Account { id, userId, providerId, accountId, password? }   // Better Auth stores the hash here
model Verification { id, identifier, value, expiresAt }

// ---------- Customers ----------
model Customer {
  id, shopId, name, phone /* E.164, e.g. +96170123456 */, phoneAlt?, notes?
  locale Locale @default(EN)        // language for WhatsApp messages
  @@unique([shopId, phone])
}

// ---------- Device catalog ----------
model DeviceBrand { id, shopId? /* null = global seed */, name }
model DeviceModel { id, shopId?, brandId, name, @@unique([brandId, name]) }

// ---------- Repair tickets ----------
model Ticket {
  id, shopId, number Int, @@unique([shopId, number])   // shown as prefix + number, e.g. R-1042
  customerId
  deviceModelId?    brandText?  modelText?             // "other" = free text
  imei?  color?
  problem           String
  passcodeEnc       String?   // AES-256-GCM with APP_SECRET, revealed on click (logged)
  patternEnc        String?   // pattern as dot sequence, encrypted
  accessories       String[]  // SIM, CASE, CHARGER, MEMORY_CARD, OTHER
  conditionNotes?
  estimateUsdCents  Int?
  promisedAt        DateTime?
  status            TicketStatus @default(RECEIVED)
  assignedToId      String?
  warrantyDays      Int
  pickedUpAt        DateTime?   // warrantyUntil = pickedUpAt + warrantyDays (computed)
  totalUsdCents     Int @default(0)   // denormalized sum of items, updated in the same transaction
  createdById
}
enum TicketStatus { RECEIVED DIAGNOSING WAITING_PART REPAIRING READY PICKED_UP CANCELLED CANT_FIX }

model TicketItem {        // parts and labor
  id, shopId, ticketId
  kind  ItemKind          // PART | LABOR
  productId?              // PART -> deducts stock via StockMovement
  description, qty Int, unitPriceUsdCents Int, unitCostUsdCents Int
}
model TicketStatusLog { id, shopId, ticketId, from TicketStatus?, to TicketStatus, userId, note?, createdAt }
model TicketNote { id, shopId, ticketId, userId, body, createdAt }   // internal notes

// ---------- Inventory ----------
model Product {
  id, shopId
  type   ProductType           // ACCESSORY | PART
  name, sku?, barcode?, @@unique([shopId, sku]), @@unique([shopId, barcode])
  category?
  costUsdCents Int, priceUsdCents Int
  qty Int @default(0), lowStockThreshold Int @default(2)
  active Boolean @default(true)
  compatibleModels DeviceModel[]   // implicit M2M, parts only
}
model StockMovement {
  id, shopId, productId, delta Int, qtyAfter Int
  reason MovementReason        // SALE | TICKET_PART | RESTOCK | ADJUSTMENT | DAMAGED | RETURN | INITIAL
  note?, saleId?, ticketItemId?, userId, createdAt
}

// ---------- Sales & payments ----------
model Sale {
  id, shopId, number Int, @@unique([shopId, number])
  customerId?
  subtotalUsdCents Int, discountUsdCents Int @default(0), totalUsdCents Int
  changeAmount Int @default(0), changeCurrency Currency?   // change handed back
  status SaleStatus @default(COMPLETED)   // COMPLETED | VOIDED
  cashierId, cashSessionId?
}
model SaleItem {
  id, shopId, saleId
  kind SaleItemKind            // PRODUCT | TICKET_BALANCE
  productId?  ticketId?        // TICKET_BALANCE = paying a repair from the POS screen
  description, qty Int, unitPriceUsdCents Int, unitCostUsdCents Int, discountUsdCents Int @default(0)
}
model Payment {                // a recorded payment, never processed
  id, shopId
  saleId?  ticketId?           // ticketId = deposit / direct ticket payment
  method   PaymentMethod       // CASH | WHISH | OMT | CARD | BANK_TRANSFER
  currency Currency            // USD | LBP
  amount   Int                 // cents if USD, pounds if LBP
  rate     Int                 // LBP per USD snapshot
  usdCentsEquivalent Int       // for fast reporting
  reference?                   // Whish/OMT/transfer reference
  cashSessionId?  userId, createdAt
}
// Ticket balance = ticket.total − Σ payments(ticketId) − Σ saleItems(TICKET_BALANCE, ticketId)
// Customer balance owed = Σ open ticket balances (READY/PICKED_UP) + unpaid sale remainders

// ---------- Cash drawer ----------
model CashSession {
  id, shopId, openedById, openedAt, closedById?, closedAt?
  openingUsdCents Int, openingLbp Int
  countedUsdCents Int?, countedLbp Int?
  expectedUsdCents Int?, expectedLbp Int?   // snapshot at close
  note?
}
model CashMovement { id, shopId, cashSessionId, type /* PAY_IN | PAY_OUT */, currency, amount Int, reason, userId }

// ---------- Messaging ----------
model MessageTemplate {
  id, shopId, key TemplateKey   // TICKET_RECEIVED | TICKET_READY | TICKET_WAITING_PART | TICKET_CANT_FIX | BALANCE_REMINDER
  locale Locale, body String    // placeholders: {customer} {device} {ticket} {balance} {shop} {trackUrl}
  @@unique([shopId, key, locale])
}

// ---------- Misc ----------
model AuditLog { id, shopId, userId, action, entity, entityId, meta Json?, createdAt }  // passcode reveals, voids, stock adjustments, rate changes
enum Locale { EN AR }   enum Currency { USD LBP }   enum Role { OWNER TECHNICIAN CASHIER }
```

Notes:
- Ticket/sale numbers: `UPDATE "Shop" SET "ticketSeq" = "ticketSeq" + 1 WHERE id = $1 RETURNING "ticketSeq"` inside the create transaction → no gaps from races, no duplicates.
- Stock changes always go through `lib/stock.ts → moveStock()` (writes `StockMovement` and updates `Product.qty` in one transaction). Negative stock is allowed but flagged.
- Phone numbers normalized to E.164 (default country +961, configurable per shop later). Search matches the trailing digits so `70123456`, `03 123 456` and `+961…` all work.

## 3. Folder structure

```
.
├── CLAUDE.md
├── docs/ PLAN.md, DECISIONS.md, DEPLOY.md (phase 6)
├── design-references/            # screenshots the owner likes
├── .claude/agents/ui-designer.md
├── docker-compose.yml            # dev: postgres (+ app optional)
├── docker-compose.prod.yml       # app + postgres + caddy + backup
├── Dockerfile  Caddyfile  .env.example
├── prisma/ schema.prisma, migrations/, seed.ts, seed-data/ (brands & models list)
├── messages/ en.json, ar.json
├── middleware.ts                 # host → tenant rewrite, locale, auth gate
├── app/
│   ├── (marketing)/              # root domain: landing, pricing, contact
│   ├── admin/                    # super admin: shops, plans, subscriptions
│   ├── shop/[slug]/
│   │   ├── (auth)/login
│   │   ├── (app)/                # authenticated shell: sidebar + topbar + global search
│   │   │   ├── page.tsx          # dashboard
│   │   │   ├── tickets/ (board + table) , new/, [id]/
│   │   │   ├── pos/
│   │   │   ├── inventory/ , [id]/, adjustments/, low-stock/
│   │   │   ├── customers/ , [id]/
│   │   │   ├── cash/
│   │   │   ├── reports/
│   │   │   └── settings/ (shop, receipts, templates, staff, exchange rate)
│   │   ├── print/ ticket/[id], receipt/[id], labels/   # bare layouts for printing
│   │   └── track/                # public repair status page (no login)
│   └── api/auth/[...all]/        # Better Auth handler
├── components/
│   ├── ui/                       # shadcn primitives (generated)
│   └── *.tsx                     # shared: Money, StatusBadge, PhoneInput, CustomerPicker, DataTable, EmptyState, PageHeader, ...
├── features/                     # one folder per domain
│   ├── tickets/  actions.ts, queries.ts, schema.ts, components/
│   ├── customers/ pos/ inventory/ cash/ reports/ settings/ admin/
└── lib/ db.ts, tenant.ts, auth.ts, permissions.ts, money.ts, phone.ts, whatsapp.ts, crypto.ts, stock.ts, numbering.ts, utils.ts
```

## 4. Design system (phase 1, built by ui-designer)
- Tokens as CSS variables in `app/globals.css`: background `#F8FAFC`, card `#FFFFFF`, border `#E5E7EB`, text slate-900/600/400, accent **indigo-600 `#4F46E5`** (proposed; emerald is the alternative), success/warning/danger muted.
- Ticket status palette (soft background + strong text): Received = slate, Diagnosing = sky, Waiting for part = amber, Repairing = indigo, Ready = emerald, Picked up = zinc, Cancelled = rose (muted), Can't fix = orange.
- Fonts: Inter + IBM Plex Sans Arabic via `next/font` (self-hosted at build, no runtime CDN). `tabular-nums` on all numbers.
- Shell: collapsible sidebar (Dashboard, Tickets, POS, Customers, Inventory, Cash, Reports, Settings), top bar with global search (`/`), "New ticket" (`N`) and "New sale" (`S`) buttons, exchange-rate chip, language switch, user menu. Bottom nav on phones.

## 5. Phases (stop after each for review)

**Phase 1: Foundation**
Next.js + TS strict + Tailwind + shadcn setup, ESLint/Prettier · docker-compose (Postgres) · full Prisma schema + first migration · Better Auth (login, logout, sessions in DB) · middleware tenancy (subdomain, `slug.localhost`, `?shop=`) · `tenantDb`, `requireShop`, `requireRole` · next-intl wiring with EN/AR + RTL switch · design tokens, fonts, app shell with navigation, shortcuts, global search placeholder · minimal seed (1 shop, 1 owner, 1 tech, 1 cashier, super admin).
*Done when:* I can log in to `demo.localhost:3000`, see the empty shell in EN and AR, and a user from shop A cannot open shop B.

**Phase 2: Customers + repair tickets**
Customer list/profile, quick-add, phone search · device brand/model catalog (seeded with common brands/models) · new-ticket form (target < 30 s, keyboard-first) · ticket detail: status changes with log, parts/labor (stock deduction), notes, deposit/payments, passcode reveal (audited), warranty status · Kanban board (drag to change status) + table with filters · intake receipt print (80mm + A4, QR to the track page, terms) · WhatsApp notify via `wa.me` with templates in the customer's language.

**Phase 3: Inventory + POS**
Products & parts CRUD, compatible models, stock adjustments with reason, low-stock list, movement history · Code128 barcode labels print · POS screen: search/scan, cart, line & cart discount, split payments, USD/LBP tendered with change calculated, pay a ticket balance in the same cart · 80mm sale receipt with both currencies · void sale (owner, audited, stock restored).

**Phase 4: Cash + reports + dashboard**
Cash drawer open/close, pay in/out, expected vs counted per currency · reports (date range): sales by day, repairs by status, revenue per technician, best sellers, profit (price − cost), outstanding balances; CSV export · dashboard: today's sales, tickets by status, ready-for-pickup list, overdue promised dates, low stock.

**Phase 5: Settings, Arabic polish, public page, super admin**
Shop settings (logo upload stored on local disk volume, receipt footer/terms EN/AR, exchange rate with history, warranty default, WhatsApp templates EN/AR), staff management (invite by setting a temp password, roles, deactivate) · full Arabic translation and RTL pass on every screen and print layout · public `track` page (ticket number + phone, rate-limited) · super admin: shops CRUD, plans, mark paid until date, trial/expired/suspended, impersonate-read-only for support.

**Phase 6: Launch**
Marketing landing page (features, pricing, contact via `wa.me`/email) · rich demo seed: 1 shop, 20 customers, 50 products, 30 tickets across all statuses, sales over the last 30 days · `docker-compose.prod.yml` with Caddy on-demand TLS, nightly `pg_dump` backups, `docs/DEPLOY.md` (VPS from zero, DNS wildcard record, updates, restore).

## 6. Open questions for the owner (sensible defaults already chosen)
1. Product name and domain? (Placeholders for now; only env vars and the landing page change.)
2. Accent color: indigo `#4F46E5` (default) or emerald?
3. Default exchange rate 89,500 LBP/USD and LBP rounding to 1,000: OK?
