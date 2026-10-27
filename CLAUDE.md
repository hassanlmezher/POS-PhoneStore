# CLAUDE.md

## Project memory

**Product.** A multi-tenant SaaS POS built specifically for phone repair & accessories shops (Lebanon first, then the Gulf). The core workflow: customer drops off a broken phone → shop creates a repair ticket → fixes it → notifies the customer via a `wa.me` link → customer pays and picks up. Shops also sell accessories over the counter. Each shop lives on its own subdomain (`<slug>.<ROOT_DOMAIN>`). Product name and domain are placeholders, set via `APP_NAME` / `ROOT_DOMAIN` env vars. **Stack:** Next.js (App Router) + TypeScript strict, Tailwind + shadcn/ui + lucide-react, PostgreSQL + Prisma, Better Auth (email + password, DB sessions), next-intl (EN default, AR with RTL), Docker + docker-compose. No external services that need approval or a business account: no WhatsApp/Meta API, no Stripe, no payment gateways.

- Plan, schema and folder structure: [docs/PLAN.md](docs/PLAN.md)
- Decisions log: [docs/DECISIONS.md](docs/DECISIONS.md). One line per decision, so it never has to be discussed again.
- UI work: the `ui-designer` subagent ([.claude/agents/ui-designer.md](.claude/agents/ui-designer.md)).

### Current status
- **Phase:** 6 done + fixes + load/race testing (2026-10-25: 5 shops at once, 8.7k requests in 60 s with 0 errors; race bugs fixed, see DECISIONS). App renamed InChouf; admin login is the owner's own e-mail; test shop "other" removed from production (only demo + bilal); demo staff passwords changed (owner knows them). App runs on Supabase Postgres; no business data left in code (platform settings, quick picks, shop time zone/country code, landing preview all from the DB).
- **Done:** Phases 1–5 + Phase 6: landing page (features, pricing from plans, FAQ, EN/AR), deterministic demo seed (`prisma/seed-demo.ts`: 20 customers, 50 products, 30 tickets, ~50 sales, daily drawers, all cross-checked), production stack (`docker-compose.prod.yml`, `Caddyfile` on-demand TLS + `/api/tls-check`, nightly backups), `docs/DEPLOY.md`. Production build + standalone server verified locally with Caddy-style headers.
- **Features PDF (one at a time, owner says "all good" before the next):** 1 price approval link, 2 phones nobody collects, 3 expenses & real profit, 4 price list + quick quote are done. Next: 5 Google review request.
- **Next:** owner review on the live site; Vercel Pro or a VPS before paying shops. Same compact-rows treatment could go to inventory and customers lists if they grow.
- **Open issues:** LIVE on Vercel (free Hobby, project `inchouf-pos`, region fra1): https://demo.inchouf.com + https://pos-admin.inchouf.com, DNS-only CNAMEs on Cloudflare. Vercel Hobby = non-commercial; upgrade or move to a VPS when shops pay. New shops get their address automatically (lib/domains.ts; keys set on Vercel, verified live with a throwaway shop); "Delete shop" in the admin removes the address too. Migrations must be applied manually before deploying. Supabase is kept awake by /api/keepalive (Vercel Cron daily + GitHub Actions every 3 days). Change any login with scripts/set-login.ts. Git: https://github.com/hassanlmezher/POS-PhoneStore (main); every push to main auto-deploys on Vercel.

### Testing
Full route test with temporary accounts (never real passwords):
1. `SMOKE_PASSWORD=$(openssl rand -hex 16)` then `SMOKE_PASSWORD=$SMOKE_PASSWORD pnpm exec tsx --conditions=react-server scripts/test-accounts.ts create`
2. Dev: `SMOKE_PASSWORD=$SMOKE_PASSWORD node scripts/smoke.mjs` (73/73). Production build: run `.next/standalone/server.js` on :3100 with the Vercel env (6543 pooler, PEM CA, ROOT_DOMAIN=inchouf.com, ADMIN_SUBDOMAIN=pos-admin), then add `SMOKE_VIA=http://127.0.0.1:3100 SMOKE_ADMIN_SUB=pos-admin` and pass `inchouf.com` (72/72). Never log in to the live site with test accounts.
3. `pnpm exec tsx --conditions=react-server scripts/test-accounts.ts delete` (re-attributes their records to the demo owner).

### Local dev
`pnpm db:start` → `pnpm dev` → open `demo.localhost:3000` (or `admin.localhost:3000`). Dev logins are listed at the top of `prisma/seed.ts`. `pnpm db:reset` re-migrates and re-seeds. Next 16 docs: `node_modules/next/dist/docs/` (see AGENTS.md).

## Hard rules
- No third-party dependency that needs approval, verification or a business account. The app must work fully on its own.
- WhatsApp = `https://wa.me/<number>?text=<urlencoded message>` opened in a new tab. Never an API.
- Payments are **recorded**, not processed (cash, Whish, OMT, card terminal, bank transfer).
- Self-hostable on any VPS with Docker. No hosting-provider lock-in.
- Dual currency (USD + LBP) wherever money appears; shop-level exchange rate; receipts show both.
- Bilingual EN/AR with full RTL. English is the default.

## Token efficiency and working style
- Read `CLAUDE.md` and `docs/PLAN.md` first. Do not re-read the whole codebase each session.
- Use Grep/Glob to find code; read only the files and line ranges you need.
- Never re-read a file you just edited to verify it. Never re-read files already in context.
- Prefer small targeted `Edit`s over rewriting whole files.
- Don't print large files, logs or command output; use `head`, `tail` or filters.
- Batch independent tool calls in one turn.
- Keep replies short: what changed, what's next. No long explanations unless asked. No repeating code back.
- Don't create extra docs, READMEs or summaries unless asked.
- Reuse existing components and utilities before creating new ones (see list below).
- Use subagents only for genuinely parallel or large isolated tasks (e.g. ui-designer for a new screen), not for small lookups.
- Run type-check and lint after each feature, not after each edit. Fix errors in one pass.
- If something is ambiguous and cheap to change later, make a sensible choice and log it in `DECISIONS.md` instead of asking.
- Update "Current status" above at the end of every work session (3–5 lines: done, next, open issues).
- Stop after each build phase for owner review.

## Code conventions
- TypeScript strict. Server components by default; server actions for mutations.
- Every database query is filtered by `shopId`. Never trust a `shopId` from the client; take it from the resolved tenant + session (`requireShop()` / `requirePermission()`).
- Money is stored as integers (`Int`/`BigInt`): USD in cents, LBP in whole pounds, always with a currency code. Never floats. Use the shared `lib/money.ts` helpers.
- All user-facing text goes through next-intl (`messages/en.json`, `messages/ar.json`). No hard-coded strings.
- Use logical CSS properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) so RTL works automatically.
- Validate all server-action input with zod.
- Every new table needs RLS enabled in its migration (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`): on Supabase that keeps the public REST API from reading it. The app connects as the table owner and is unaffected.
- Database: Supabase via the session pooler as role `pos_app` (owner of all tables), TLS verified with `certs/supabase-prod-ca-2021.crt` (`DATABASE_CA_CERT`). Use `prisma migrate deploy` (no shadow DB on Supabase), not `migrate dev`, against Supabase.
- Keep dependencies minimal. Don't add a library when a few lines of code will do.

## Shared components & utilities
_(Keep this list updated as they are created.)_
- `components/ui/*`: shadcn-style primitives (button h-11 default, input, label, card, badge, dropdown-menu, sheet, tooltip, separator, skeleton, avatar, kbd, sonner `Toaster`).
- `components/status-badge.tsx`: `<StatusBadge status />`, exports `TICKET_STATUSES`, `TicketStatus`.
- `components/money.tsx`: `<Money usdCents rate rounding? layout="stacked|inline" />`, USD + LBP.
- `components/page-header.tsx`: `<PageHeader title description? actions? />`.
- `components/empty-state.tsx`: `<EmptyState icon? title body? action? />`.
- `components/coming-soon.tsx`: `<ComingSoon icon? />` placeholder for later phases.
- `components/app-shell/*`: `AppShell` (sidebar, top bar, bottom nav), `useShortcuts({ slash, n, s })`.
- `features/auth/login-form.tsx`: `<LoginForm variant slug? shopName? />`.
- More `components/ui/*`: dialog, alert-dialog, popover, textarea, native-select, table.
- `components/field.tsx`: `<Field label htmlFor error hint optional>` + `fieldAria(id, error)`; `error` is an `errors.*` key.
- `components/money-input.tsx`: `<MoneyInput value onValueChange currency rate rounding>` with live USD/LBP hint.
- `components/segmented.tsx`: `<Segmented value onValueChange options label>` radio pills.
- `components/pattern-grid.tsx`: `<PatternGrid value onChange? readOnly? size>` 3×3 lock ("1-5-9-6").
- `components/confirm-dialog.tsx`: `<ConfirmDialog trigger title body confirmLabel onConfirm>` (destructive only).
- `components/pagination.tsx`, `components/url-search-input.tsx` (debounced `?q=`), `components/stat-tile.tsx`, `components/ltr.tsx` (`<Ltr>` for phones/IMEIs/labels), `components/auto-print.tsx`.
- `components/app-shell/global-search.tsx` (uses `features/search/actions.ts`).
- `features/tickets/ui/*`: intake-form, customer-picker, device-picker, ticket-board, warranty-badge, detail/*; `features/customers/ui/customer-dialog.tsx`.
- `lib/use-debounced.ts`; `lib/phone.ts` `formatPhone()`; `lib/numbering.ts` (next ticket/sale number, format/parse label); `lib/stock.ts` `moveStock()`; `lib/whatsapp.ts` (`fillTemplate`, `waLink`); `features/tickets/money.ts` (charge/paid/balance, warrantyUntil).
- `components/brand-logo.tsx`: `<BrandLogo className alt? priority? />`, the product logo (`public/brand/logo.svg`; PNGs 180/192/512 alongside; `app/icon.svg`, `app/apple-icon.png`, `app/manifest.ts`).
- `components/link-tabs.tsx` (URL-driven tabs with count badge; client: scrolls active tab into view, fades hidden edge), `components/stock-level.tsx` (`<StockLevel qty threshold />`, `stockState()`). `ConfirmDialog` also takes `children`, `confirmDisabled`, `onOpenChange`; `CustomerDialog` takes `defaults`, `onCreated`.
- `features/pos/ui/sales-table.tsx`, `features/tickets/ui/ticket-table.tsx`, `features/reports/ui/balances-list.tsx`: client list renderers fed compact rows (pattern for long lists: keeps page data small). `features/reports/reminder.ts` `balanceReminderLink()`.
- `features/inventory/ui/*` (inventory-table, product-dialog, model-multi-select, adjust-stock-form, print-label-button), `features/inventory/margin.ts`; `features/pos/ui/*` (pos-screen, cart.ts live totals, cart-line, payment-rows, pos-customer, done-dialog, void-sale-button).
- `features/pos/money.ts`: `tenderedUsdCents`, `changeDue` (LBP change computed in pounds), `saleBalance` (±1 cent = 0). `lib/barcode.ts`: `code128Svg`, `canEncodeCode128`.
- `features/marketing/ui/*` (landing sections, `ProductMock`, `SectionHeading`/`Container`/`BrandMark`), `features/marketing/contact.ts`.
- `lib/locks.ts`: `lockRows(tx, "Ticket"|"Sale"|"CashSession", shopId, ids)` (FOR UPDATE before read-check-write), `retryOnConflict(fn)` (unique-key races). `i18n/client-messages.ts` `clientMessages(area)`: wrap new client areas in `NextIntlClientProvider` with it. `lib/tenant.ts` `getRequestHost()` (tenant from the proxy header, then Host).
- `lib/public-url.ts` `redirectPublic(path)`: use instead of `redirect()` in pages (absolute public URL behind Caddy).
- `lib/tenant.ts` also: `requireActionShop(permission?)` for server actions, `refreshShop()` after mutations.
- `lib/money.ts` (toLbp, toUsdCents, formatMoney, parseMoney), `lib/phone.ts` (normalizePhone, phoneSearchDigits, waNumber), `lib/crypto.ts` (encrypt/decrypt), `lib/permissions.ts` (`can`), `lib/hosts.ts` (parseHost), `lib/tenant.ts` (requireShop, requirePermission, requireSuperAdmin, getSession), `lib/db.ts` (prisma, tenantDb).
- `components/bar-chart.tsx`: `<BarChart items series label height?>` dependency-free stacked SVG bars (USD cents), hover tooltip, RTL-aware, sr-only list; colors `chart-1`/`chart-2` tokens.
- `components/section-card.tsx`: `<SectionCard title description? actions? padded? id?>` card with header row. `components/auto-refresh.tsx`: `<AutoRefresh seconds />` (router.refresh while visible).
- `features/cash/ui/*`: cash-diff (`<CashDiff diff currency>`, `signedMoney`), drawer-breakdown, session-lists (MovementList, OtherMethodsList), open/close/movement forms. `features/reports/ui/*`: date-range-picker, sections (Overview/Repairs/Products/Balances). `features/dashboard/ui/ticket-list.tsx`.
- `app/shop/[slug]/(app)/error.tsx`: shared error boundary for shop pages.
- `components/ui/switch.tsx` (Switch; styles on aria-checked so it works inside ConfirmDialog triggers), `components/password-input.tsx` (`<PasswordInput value onValueChange generate?>` show/hide + generator, `lib/password.ts`), `components/copy-button.tsx` (`<CopyButton value label?>`). `AutoPrint` takes `auto={false}` for previews (`?preview=1`). `lib/hosts.ts` `shopOrigin(slug)`, `RESERVED_SLUGS`. WhatsApp preview tokens `wa-*` in globals.css.
- `features/settings/ui/*` (shop-profile-form, logo-upload, receipt-settings-form, rate-form (also used by the top-bar RateChip popover), rate-section, template-editor, staff-section); `features/track/ui/track-lookup.tsx`, `features/track/queries.ts` (`findTrackTicket`; `trackUrl(slug, trackToken)` in features/tickets/notify.ts); `features/admin/ui/*` (admin-shell, new-shop-dialog, shop-basics-form, subscription-panel, reset-owner-password, plan-dialog, sub-status-badge, slug.ts).
- `components/search-select.tsx`: `<SearchSelect value onValueChange groups searchPlaceholder emptyText>` searchable select (popover + filter + arrow keys) for long lists (time zones). `features/settings/ui/quick-picks.tsx` (ShopPreset lists), `features/admin/ui/platform-settings-form.tsx`. Landing preview pieces in `features/marketing/ui/product-mock.tsx` take `getShowcaseData()` output and hide when data is missing.
- Layout rules: base grids always `grid-cols-1` (then `sm:grid-cols-…`); tables must fit phones by hiding columns / stacking under the first cell, not by sideways scroll; truncated Latin text inside RTL gets `dir="auto"` + `rtl:text-right`.
- `features/customers/ui/pay-balance-button.tsx`: `<PayBalanceButton kind="sale"|"ticket" id label balanceUsdCents rate rounding>` (record a later payment; `addSalePayment` in features/pos/actions.ts).
- `features/prices/*`: rules (`adjustPrice`, `priceInput`, `adjustInput`), actions `savePrice`/`deletePrice`/`adjustPrices`, queries `listPrices` (`PriceRow`), message `quoteMessage`, ui `quick-quote`, `price-list`, `price-dialogs` (page `/prices`). `DevicePicker` takes `idPrefix`, `allowOther`, `label`.
- `features/expenses/*`: schema (`EXPENSE_CATEGORIES`), actions `saveExpense`/`deleteExpense` (optional drawer pay-out), ui `expense-dialog`, `expenses-list`, `category-icon`, server `RealProfitCard` (page `/expenses`; `profitSummary` now returns `expenses`, `expensesTotal`, `realProfit`). `DateRangePicker` takes `basePath`.
- `features/pickup/*`: rules (stages 3/14/30, daysWaiting, storageFee), queries `listUncollected`, message `pickupWhatsApp`, actions `markPickupReminder`/`chargeStorageFee`, ui `pickup-list` (page `/tickets/pickup`).
- `features/approvals/*`: price approval by link (actions: createApproval/cancelApproval/respondApproval, `link.ts` approvalWhatsApp/approvalUrl, ui: approval-card (ticket page), approval-answer (public page `app/shop/[slug]/approve/[token]`)). Any customer link can add `?lang=en|ar`.
- Server actions must not `redirect()` to app pages (bypasses the proxy rewrite): return a result and navigate client-side with a full load.
