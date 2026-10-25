// Rich, realistic demo data for the "demo" shop: 20 customers, 50 products, 30 repair tickets in
// every status, ~45 counter sales over the last 30 days, daily cash drawer sessions and rate history.
// Deterministic (fixed PRNG seed) and generated in time order, so stock levels, ticket balances
// and drawer totals are all consistent with what the app computes.
import type { Currency, Customer, PaymentMethod, PrismaClient, TicketStatus } from "../lib/generated/prisma/client";

type Ctx = {
  prisma: PrismaClient;
  shopId: string;
  rate: number;
  ownerId: string;
  techIds: string[];
  cashierId: string;
};

// ---------- deterministic helpers ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261024);
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;

const DAY = 86_400_000;
const now = Date.now();
/** A time `daysAgo` days back, during shop hours (09:00–19:00 Beirut ≈ 06:00–16:00 UTC). */
function at(daysAgo: number, hourUtc = int(6, 16), minute = int(0, 59)) {
  const d = new Date(now - daysAgo * DAY);
  d.setUTCHours(hourUtc, minute, int(0, 59), 0);
  return d.getTime() > now ? new Date(now - int(5, 60) * 60_000) : d;
}

// ---------- reference data ----------
const CUSTOMERS: [string, string, "EN" | "AR"][] = [
  ["Ahmad Khalil", "+96170123456", "AR"],
  ["Rita Saliba", "+96171234567", "EN"],
  ["Hassan Mrad", "+9613456123", "AR"],
  ["Nour Haddad", "+96176345678", "EN"],
  ["Georges Abi Nader", "+96178456789", "EN"],
  ["Fatima Zein", "+96181567890", "AR"],
  ["Elie Karam", "+96179678901", "EN"],
  ["Lara Nassif", "+96170789012", "EN"],
  ["Mohammad Jaber", "+9613890123", "AR"],
  ["Christelle Daher", "+96171901234", "EN"],
  ["Ali Hamdan", "+96176012345", "AR"],
  ["Maya Fares", "+96178123987", "EN"],
  ["Tony Rizk", "+96181234876", "EN"],
  ["Zeinab Moussawi", "+96170345765", "AR"],
  ["Karim Saab", "+96171456654", "EN"],
  ["Rana Itani", "+9613567543", "EN"],
  ["Joe Bou Khalil", "+96179678432", "EN"],
  ["Sara Chehab", "+96176789321", "AR"],
  ["Bilal Sleiman", "+96170890210", "AR"],
  ["Yara Tannous", "+96178901109", "EN"],
];

type P = { type: "ACCESSORY" | "PART"; name: string; sku: string; cost: number; price: number; qty: number; low?: number; cat: string; models?: string[] };
const PRODUCTS: P[] = [
  // Parts (compatible models drive which repairs use them)
  { type: "PART", name: "iPhone 11 screen (LCD)", sku: "SCR-IP11", cost: 2200, price: 5500, qty: 5, cat: "Screens", models: ["iPhone 11"] },
  { type: "PART", name: "iPhone 12 screen (OLED)", sku: "SCR-IP12", cost: 3800, price: 8500, qty: 4, cat: "Screens", models: ["iPhone 12", "iPhone 12 Pro"] },
  { type: "PART", name: "iPhone 13 screen (OLED)", sku: "SCR-IP13", cost: 4500, price: 9500, qty: 4, cat: "Screens", models: ["iPhone 13"] },
  { type: "PART", name: "iPhone 14 screen (OLED)", sku: "SCR-IP14", cost: 5500, price: 11500, qty: 2, cat: "Screens", models: ["iPhone 14"] },
  { type: "PART", name: "Galaxy A54 screen", sku: "SCR-A54", cost: 3500, price: 7000, qty: 3, cat: "Screens", models: ["Galaxy A54"] },
  { type: "PART", name: "Galaxy A34 screen", sku: "SCR-A34", cost: 3000, price: 6000, qty: 1, low: 2, cat: "Screens", models: ["Galaxy A34"] },
  { type: "PART", name: "Galaxy S23 screen", sku: "SCR-S23", cost: 9000, price: 16000, qty: 1, cat: "Screens", models: ["Galaxy S23"] },
  { type: "PART", name: "Redmi Note 12 screen", sku: "SCR-RN12", cost: 1800, price: 4000, qty: 4, cat: "Screens", models: ["Redmi Note 12"] },
  { type: "PART", name: "Redmi Note 13 screen", sku: "SCR-RN13", cost: 2000, price: 4500, qty: 3, cat: "Screens", models: ["Redmi Note 13"] },
  { type: "PART", name: "iPhone 11 battery", sku: "BAT-IP11", cost: 900, price: 2500, qty: 6, cat: "Batteries", models: ["iPhone 11"] },
  { type: "PART", name: "iPhone 12 battery", sku: "BAT-IP12", cost: 1200, price: 3000, qty: 5, cat: "Batteries", models: ["iPhone 12", "iPhone 12 Pro"] },
  { type: "PART", name: "iPhone 13 battery", sku: "BAT-IP13", cost: 1400, price: 3500, qty: 4, cat: "Batteries", models: ["iPhone 13", "iPhone 13 Pro"] },
  { type: "PART", name: "Galaxy A54 battery", sku: "BAT-A54", cost: 1000, price: 2500, qty: 0, low: 2, cat: "Batteries", models: ["Galaxy A54"] },
  { type: "PART", name: "Redmi Note 13 battery", sku: "BAT-RN13", cost: 900, price: 2500, qty: 2, cat: "Batteries", models: ["Redmi Note 13", "Redmi Note 12"] },
  { type: "PART", name: "USB-C charging port flex", sku: "PRT-USBC", cost: 300, price: 1500, qty: 12, cat: "Ports", models: ["Galaxy A34", "Galaxy A54", "Redmi Note 12", "Redmi Note 13"] },
  { type: "PART", name: "Lightning charging port flex", sku: "PRT-LGT", cost: 500, price: 2000, qty: 8, cat: "Ports", models: ["iPhone 11", "iPhone 12", "iPhone 13", "iPhone 14"] },
  { type: "PART", name: "iPhone 13 back glass", sku: "BKG-IP13", cost: 800, price: 3500, qty: 3, cat: "Back glass", models: ["iPhone 13"] },
  { type: "PART", name: "iPhone 12 rear camera", sku: "CAM-IP12", cost: 2500, price: 6000, qty: 1, low: 1, cat: "Cameras", models: ["iPhone 12"] },
  { type: "PART", name: "Earpiece speaker (iPhone)", sku: "SPK-IP", cost: 300, price: 1500, qty: 7, cat: "Speakers", models: ["iPhone 11", "iPhone 12", "iPhone 13"] },
  { type: "PART", name: "Loudspeaker (Galaxy A)", sku: "SPK-GA", cost: 300, price: 1500, qty: 5, cat: "Speakers", models: ["Galaxy A34", "Galaxy A54"] },
  // Accessories
  { type: "ACCESSORY", name: "Tempered glass (universal)", sku: "ACC-GLASS", cost: 50, price: 500, qty: 60, low: 10, cat: "Screen protection" },
  { type: "ACCESSORY", name: "Privacy glass iPhone 13/14", sku: "ACC-PRIV13", cost: 150, price: 1000, qty: 18, cat: "Screen protection" },
  { type: "ACCESSORY", name: "Camera lens protector", sku: "ACC-LENS", cost: 80, price: 500, qty: 25, cat: "Screen protection" },
  { type: "ACCESSORY", name: "Clear case iPhone 13", sku: "CASE-IP13C", cost: 150, price: 800, qty: 14, cat: "Cases" },
  { type: "ACCESSORY", name: "Silicone case iPhone 14", sku: "CASE-IP14S", cost: 250, price: 1200, qty: 10, cat: "Cases" },
  { type: "ACCESSORY", name: "Silicone case iPhone 15", sku: "CASE-IP15S", cost: 250, price: 1200, qty: 12, cat: "Cases" },
  { type: "ACCESSORY", name: "Clear case Galaxy A54", sku: "CASE-A54C", cost: 120, price: 700, qty: 9, cat: "Cases" },
  { type: "ACCESSORY", name: "Rugged case Galaxy S23", sku: "CASE-S23R", cost: 400, price: 1500, qty: 4, cat: "Cases" },
  { type: "ACCESSORY", name: "Book case Redmi Note 13", sku: "CASE-RN13B", cost: 200, price: 1000, qty: 6, cat: "Cases" },
  { type: "ACCESSORY", name: "MagSafe clear case iPhone 15 Pro", sku: "CASE-IP15PM", cost: 500, price: 2000, qty: 2, low: 3, cat: "Cases" },
  { type: "ACCESSORY", name: "20W USB-C charger", sku: "ACC-CHG20", cost: 400, price: 1200, qty: 20, cat: "Chargers" },
  { type: "ACCESSORY", name: "25W Samsung fast charger", sku: "ACC-CHG25S", cost: 500, price: 1500, qty: 12, cat: "Chargers" },
  { type: "ACCESSORY", name: "65W GaN charger (2 ports)", sku: "ACC-GAN65", cost: 1200, price: 3000, qty: 6, cat: "Chargers" },
  { type: "ACCESSORY", name: "Car charger dual USB", sku: "ACC-CAR", cost: 200, price: 800, qty: 10, cat: "Chargers" },
  { type: "ACCESSORY", name: "USB-C to USB-C cable 1m", sku: "CBL-CC1", cost: 100, price: 500, qty: 40, cat: "Cables" },
  { type: "ACCESSORY", name: "USB-C to Lightning cable 1m", sku: "CBL-CL1", cost: 150, price: 700, qty: 30, cat: "Cables" },
  { type: "ACCESSORY", name: "USB-A to Micro-USB cable", sku: "CBL-AM", cost: 60, price: 300, qty: 25, cat: "Cables" },
  { type: "ACCESSORY", name: "Braided USB-C cable 2m", sku: "CBL-CC2B", cost: 200, price: 900, qty: 15, cat: "Cables" },
  { type: "ACCESSORY", name: "Power bank 10,000 mAh", sku: "PWR-10K", cost: 900, price: 2200, qty: 8, cat: "Power banks" },
  { type: "ACCESSORY", name: "Power bank 20,000 mAh", sku: "PWR-20K", cost: 1400, price: 3200, qty: 5, cat: "Power banks" },
  { type: "ACCESSORY", name: "Wired earphones (Type-C)", sku: "AUD-EC", cost: 150, price: 700, qty: 18, cat: "Audio" },
  { type: "ACCESSORY", name: "Wireless earbuds", sku: "AUD-TWS", cost: 900, price: 2500, qty: 7, cat: "Audio" },
  { type: "ACCESSORY", name: "Bluetooth speaker mini", sku: "AUD-SPK", cost: 800, price: 2000, qty: 3, low: 3, cat: "Audio" },
  { type: "ACCESSORY", name: "Phone holder (car vent)", sku: "ACC-HOLD", cost: 150, price: 700, qty: 11, cat: "Holders" },
  { type: "ACCESSORY", name: "Ring holder / stand", sku: "ACC-RING", cost: 30, price: 300, qty: 30, cat: "Holders" },
  { type: "ACCESSORY", name: "Selfie stick tripod", sku: "ACC-TRIPOD", cost: 500, price: 1500, qty: 4, cat: "Holders" },
  { type: "ACCESSORY", name: "SD card 64 GB", sku: "MEM-SD64", cost: 400, price: 1000, qty: 9, cat: "Memory" },
  { type: "ACCESSORY", name: "USB flash drive 64 GB", sku: "MEM-USB64", cost: 350, price: 900, qty: 8, cat: "Memory" },
  { type: "ACCESSORY", name: "SIM ejector + adapter kit", sku: "ACC-SIMKIT", cost: 10, price: 200, qty: 50, cat: "Other" },
  { type: "ACCESSORY", name: "Screen cleaning kit", sku: "ACC-CLEAN", cost: 40, price: 300, qty: 20, cat: "Other" },
];

type Problem = { key: string; text: string; part?: string; labor: [string, number] };
const PROBLEMS: Problem[] = [
  { key: "screen", text: "Cracked screen, touch not responding at the bottom", part: "SCR-", labor: ["Screen replacement labor", 1500] },
  { key: "battery", text: "Battery drains very fast, phone shuts down at 20%", part: "BAT-", labor: ["Battery replacement labor", 1000] },
  { key: "port", text: "Not charging unless the cable is held at an angle", part: "PRT-", labor: ["Port replacement labor", 1000] },
  { key: "backglass", text: "Back glass shattered after a drop", part: "BKG-", labor: ["Back glass labor (laser)", 1500] },
  { key: "camera", text: "Rear camera blurry, won't focus", part: "CAM-", labor: ["Camera replacement labor", 1500] },
  { key: "speaker", text: "Can't hear callers, earpiece very low", part: "SPK-", labor: ["Speaker replacement labor", 800] },
  { key: "water", text: "Fell in water, no power", labor: ["Water damage cleaning + diagnosis", 2500] },
  { key: "software", text: "Stuck on logo after update (boot loop)", labor: ["Software reflash, data kept", 2000] },
];
const DEVICES = [
  "iPhone 11", "iPhone 12", "iPhone 12 Pro", "iPhone 13", "iPhone 13", "iPhone 13 Pro", "iPhone 14", "iPhone 14 Pro Max", "iPhone 15",
  "Galaxy A54", "Galaxy A54", "Galaxy A34", "Galaxy S23", "Galaxy A15", "Redmi Note 12", "Redmi Note 13", "Redmi Note 13", "Poco X6", "Hot 40", "Pixel 7",
];
const COLORS = ["Black", "White", "Blue", "Midnight", "Graphite", "Green", "Purple", "Gold", null];
const ACCESSORY_SETS = [[], ["SIM"], ["SIM", "CASE"], ["CASE"], ["SIM", "CASE", "CHARGER"], ["SIM"]];

// Status mix for 30 tickets (oldest first get the most advanced statuses).
const STATUS_PLAN: TicketStatus[] = [
  "PICKED_UP", "PICKED_UP", "PICKED_UP", "PICKED_UP", "PICKED_UP", "PICKED_UP", "PICKED_UP", "PICKED_UP", "CANCELLED", "CANT_FIX",
  "READY", "PICKED_UP", "READY", "READY", "READY", "WAITING_PART", "READY", "REPAIRING", "WAITING_PART", "REPAIRING",
  "REPAIRING", "WAITING_PART", "REPAIRING", "DIAGNOSING", "REPAIRING", "DIAGNOSING", "DIAGNOSING", "RECEIVED", "DIAGNOSING", "RECEIVED",
];
const FLOW: TicketStatus[] = ["RECEIVED", "DIAGNOSING", "REPAIRING", "READY", "PICKED_UP"];
function pathTo(status: TicketStatus): TicketStatus[] {
  if (status === "WAITING_PART") return ["RECEIVED", "DIAGNOSING", "WAITING_PART"];
  if (status === "CANCELLED") return ["RECEIVED", "DIAGNOSING", "CANCELLED"];
  if (status === "CANT_FIX") return ["RECEIVED", "DIAGNOSING", "REPAIRING", "CANT_FIX"];
  return FLOW.slice(0, FLOW.indexOf(status) + 1);
}

export async function seedDemoData(ctx: Ctx) {
  const { prisma, shopId, rate } = ctx;
  const staff = [ctx.ownerId, ctx.cashierId];

  // ---------- rate history ----------
  for (const [daysAgo, r] of [[30, 89000], [18, 89200], [7, 89500]] as const) {
    await prisma.exchangeRate.create({ data: { shopId, rate: r, setById: ctx.ownerId, createdAt: at(daysAgo, 6, 5) } });
  }

  // ---------- catalog lookup ----------
  const models = await prisma.deviceModel.findMany({ where: { shopId: null }, select: { id: true, name: true } });
  const modelId = new Map(models.map((m) => [m.name, m.id]));

  // ---------- products (opening stock 31 days ago; final qty = listed qty) ----------
  // Opening stock = target qty + everything the demo will consume, so nothing goes negative.
  const products = new Map<string, { id: string; cost: number; price: number; qty: number; models: string[] }>();
  for (const p of PRODUCTS) {
    const created = await prisma.product.create({
      data: {
        shopId,
        type: p.type,
        name: p.name,
        sku: p.sku,
        barcode: `629${String(int(1e8, 9e8))}${String(int(0, 9))}`,
        category: p.cat,
        costUsdCents: p.cost,
        priceUsdCents: p.price,
        qty: 0,
        lowStockThreshold: p.low ?? (p.type === "PART" ? 2 : 5),
        compatibleModels: { connect: (p.models ?? []).flatMap((m) => (modelId.has(m) ? [{ id: modelId.get(m)! }] : [])) },
        createdAt: at(31, 6, 0),
      },
    });
    products.set(p.sku, { id: created.id, cost: p.cost, price: p.price, qty: 0, models: p.models ?? [] });
  }

  // ---------- customers ----------
  const customers: Customer[] = [];
  for (const [i, [name, phone, locale]] of CUSTOMERS.entries()) {
    customers.push(
      await prisma.customer.create({ data: { shopId, name, phone, locale, createdAt: at(30 - i, 6, i) } }),
    );
  }

  // ---------- build a time-ordered event list ----------
  type Ev =
    | { t: Date; kind: "ticket"; idx: number }
    | { t: Date; kind: "sale"; idx: number };
  const events: Ev[] = [];
  const ticketDays = STATUS_PLAN.map((_, i) => Math.max(0, 29 - Math.floor(i * 1.0) - int(0, 1)));
  ticketDays.forEach((d, idx) => events.push({ t: at(d), kind: "ticket", idx }));
  const SALE_COUNT = 45;
  for (let i = 0; i < SALE_COUNT; i++) events.push({ t: at(int(0, 29)), kind: "sale", idx: i });
  events.sort((a, b) => a.t.getTime() - b.t.getTime());

  // Planned consumption per SKU (to set opening stock).
  type TicketPlan = {
    status: TicketStatus;
    device: string;
    problem: Problem;
    partSku: string | null;
    customer: Customer;
    techId: string | null;
  };
  const ticketPlans: TicketPlan[] = STATUS_PLAN.map((status, i) => {
    const device = DEVICES[i % DEVICES.length];
    const problem = pick(PROBLEMS);
    const partSku =
      problem.part && !["RECEIVED", "DIAGNOSING", "WAITING_PART", "CANCELLED"].includes(status)
        ? ([...products.entries()].find(([sku, p]) => sku.startsWith(problem.part!) && p.models.includes(device))?.[0] ?? null)
        : null;
    return {
      status,
      device,
      problem,
      partSku,
      customer: customers[i % customers.length],
      techId: status === "RECEIVED" && chance(0.5) ? null : pick(ctx.techIds),
    };
  });
  const accessories = PRODUCTS.filter((p) => p.type === "ACCESSORY");
  const salePlans = Array.from({ length: SALE_COUNT }, () => {
    const lines = Array.from({ length: int(1, 3) }, () => ({ sku: pick(accessories).sku, qty: chance(0.15) ? 2 : 1 }));
    // merge duplicate SKUs
    const merged = new Map<string, number>();
    for (const l of lines) merged.set(l.sku, (merged.get(l.sku) ?? 0) + l.qty);
    return [...merged.entries()].map(([sku, qty]) => ({ sku, qty }));
  });
  const consumption = new Map<string, number>();
  for (const t of ticketPlans) if (t.partSku) consumption.set(t.partSku, (consumption.get(t.partSku) ?? 0) + 1);
  for (const s of salePlans) for (const l of s) consumption.set(l.sku, (consumption.get(l.sku) ?? 0) + l.qty);

  for (const p of PRODUCTS) {
    const prod = products.get(p.sku)!;
    const opening = p.qty + (consumption.get(p.sku) ?? 0);
    if (opening <= 0) continue;
    prod.qty = opening;
    await prisma.product.update({ where: { id: prod.id }, data: { qty: opening } });
    await prisma.stockMovement.create({
      data: { shopId, productId: prod.id, delta: opening, qtyAfter: opening, reason: "INITIAL", userId: ctx.ownerId, createdAt: at(31, 6, 1) },
    });
  }

  // ---------- cash sessions: one per day, opened 08:30 local ----------
  const sessions = new Map<string, { id: string; usdIn: number; lbpIn: number; usdChange: number; lbpChange: number }>();
  const dayOf = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10); // Beirut ≈ UTC+3 (demo)
  async function sessionFor(t: Date) {
    const key = dayOf(t);
    let s = sessions.get(key);
    if (!s) {
      const openedAt = new Date(`${key}T05:30:00Z`);
      const created = await prisma.cashSession.create({
        data: { shopId, openedById: pick(staff), openedAt, openingUsdCents: 5000, openingLbp: 1_000_000 },
      });
      s = { id: created.id, usdIn: 0, lbpIn: 0, usdChange: 0, lbpChange: 0 };
      sessions.set(key, s);
    }
    return s;
  }

  let ticketNo = 1000;
  let saleNo = 1000;

  async function addSale(opts: {
    t: Date;
    customerId: string | null;
    lines: { kind: "PRODUCT" | "TICKET_BALANCE"; productSku?: string; ticketId?: string; description: string; qty: number; price: number; cost: number }[];
    cashierId: string;
  }) {
    const subtotal = opts.lines.reduce((s, l) => s + l.qty * l.price, 0);
    const discount = subtotal >= 3000 && chance(0.25) ? 200 : 0;
    const total = subtotal - discount;
    // Payment mix typical for Lebanon.
    const roll = rnd();
    const pays: { method: PaymentMethod; currency: Currency; amount: number }[] = [];
    let changeAmount = 0;
    let changeCurrency: Currency | null = null;
    if (roll < 0.35) {
      const tendered = Math.ceil(total / 500) * 500; // round up to $5
      pays.push({ method: "CASH", currency: "USD", amount: tendered });
      if (tendered > total) {
        if (chance(0.5)) [changeAmount, changeCurrency] = [tendered - total, "USD"];
        else [changeAmount, changeCurrency] = [Math.floor(((tendered - total) * rate) / 100 / 1000) * 1000, "LBP"];
      }
    } else if (roll < 0.6) {
      const lbp = Math.ceil((total * rate) / 100 / 100_000) * 100_000;
      pays.push({ method: "CASH", currency: "LBP", amount: lbp });
      const over = lbp - Math.round((total * rate) / 100);
      if (over >= 1000) [changeAmount, changeCurrency] = [Math.floor(over / 1000) * 1000, "LBP"];
    } else if (roll < 0.75) {
      // Split: part USD cash, rest LBP cash (exact)
      const usd = Math.min(total, Math.floor(total / 2 / 100) * 100 || 100);
      pays.push({ method: "CASH", currency: "USD", amount: usd });
      const rest = total - usd;
      if (rest > 0) pays.push({ method: "CASH", currency: "LBP", amount: Math.ceil((rest * rate) / 100 / 1000) * 1000 });
    } else if (roll < 0.87) {
      pays.push({ method: "WHISH", currency: "USD", amount: total });
    } else if (roll < 0.94) {
      pays.push({ method: "OMT", currency: "USD", amount: total });
    } else {
      pays.push({ method: "CARD", currency: "USD", amount: total });
    }

    const session = pays.some((p) => p.method === "CASH") || changeAmount ? await sessionFor(opts.t) : null;
    saleNo += 1;
    const sale = await prisma.sale.create({
      data: {
        shopId,
        number: saleNo,
        customerId: opts.customerId,
        subtotalUsdCents: subtotal,
        discountUsdCents: discount,
        totalUsdCents: total,
        changeAmount,
        changeCurrency,
        cashierId: opts.cashierId,
        cashSessionId: session?.id ?? null,
        createdAt: opts.t,
        items: {
          create: opts.lines.map((l) => ({
            shopId,
            kind: l.kind,
            productId: l.productSku ? products.get(l.productSku)!.id : null,
            ticketId: l.ticketId ?? null,
            description: l.description,
            qty: l.qty,
            unitPriceUsdCents: l.price,
            unitCostUsdCents: l.cost,
          })),
        },
        payments: {
          create: pays.map((p) => ({
            shopId,
            method: p.method,
            currency: p.currency,
            amount: p.amount,
            rate,
            usdCentsEquivalent: p.currency === "USD" ? p.amount : Math.round((p.amount * 100) / rate),
            reference: p.method === "WHISH" || p.method === "OMT" ? `TX${int(100000, 999999)}` : null,
            cashSessionId: p.method === "CASH" ? (session?.id ?? null) : null,
            userId: opts.cashierId,
            createdAt: opts.t,
          })),
        },
      },
    });
    if (session) {
      for (const p of pays) {
        if (p.method !== "CASH") continue;
        if (p.currency === "USD") session.usdIn += p.amount;
        else session.lbpIn += p.amount;
      }
      if (changeCurrency === "USD") session.usdChange += changeAmount;
      if (changeCurrency === "LBP") session.lbpChange += changeAmount;
    }
    for (const l of opts.lines) {
      if (!l.productSku) continue;
      const prod = products.get(l.productSku)!;
      prod.qty -= l.qty;
      await prisma.product.update({ where: { id: prod.id }, data: { qty: prod.qty } });
      await prisma.stockMovement.create({
        data: { shopId, productId: prod.id, delta: -l.qty, qtyAfter: prod.qty, reason: "SALE", saleId: sale.id, userId: opts.cashierId, createdAt: opts.t },
      });
    }
  }

  for (const ev of events) {
    if (ev.kind === "sale") {
      const plan = salePlans[ev.idx];
      await addSale({
        t: ev.t,
        customerId: chance(0.3) ? pick(customers).id : null,
        cashierId: pick(staff),
        lines: plan.map((l) => {
          const p = PRODUCTS.find((x) => x.sku === l.sku)!;
          return { kind: "PRODUCT", productSku: l.sku, description: p.name, qty: l.qty, price: p.price, cost: p.cost };
        }),
      });
      continue;
    }

    // ---------- repair ticket ----------
    const plan = ticketPlans[ev.idx];
    const created = ev.t;
    ticketNo += 1;
    const estimate = (plan.partSku ? products.get(plan.partSku)!.price : 0) + plan.problem.labor[1];
    const promisedAt = new Date(created.getTime() + int(1, 4) * DAY);
    promisedAt.setUTCHours(15, 0, 0, 0);
    const steps = pathTo(plan.status);
    // Each step 3–20 h after the previous one (cumulative, so the history is always in order).
    // int() is still called once per step so the rest of the seed stays the same.
    let elapsedHours = 0;
    const stepTimes = steps.map((_, i) => {
      const gap = int(3, 20);
      if (i > 0) elapsedHours += gap;
      return new Date(Math.min(now - 60_000, created.getTime() + elapsedHours * 3600_000));
    });
    const pickedUpAt = plan.status === "PICKED_UP" ? stepTimes.at(-1)! : null;

    const ticket = await prisma.ticket.create({
      data: {
        shopId,
        number: ticketNo,
        customerId: plan.customer.id,
        deviceModelId: modelId.get(plan.device) ?? null,
        modelText: modelId.has(plan.device) ? null : plan.device,
        imei: chance(0.7) ? `35${int(1e12, 9e12)}` : null,
        color: pick(COLORS),
        problem: plan.problem.text,
        accessories: pick(ACCESSORY_SETS),
        conditionNotes: chance(0.3) ? pick(["Scratches on the frame", "Bent corner", "Screen protector cracked", "Missing back cover screw"]) : null,
        estimateUsdCents: estimate,
        promisedAt,
        status: plan.status,
        assignedToId: plan.techId,
        warrantyDays: plan.problem.key === "water" || plan.problem.key === "software" ? 0 : 30,
        pickedUpAt,
        createdById: pick(staff),
        createdAt: created,
        updatedAt: stepTimes.at(-1)!,
        statusLogs: {
          create: steps.map((to, i) => ({
            shopId,
            from: i === 0 ? null : steps[i - 1],
            to,
            userId: i === 0 ? pick(staff) : (plan.techId ?? ctx.ownerId),
            createdAt: stepTimes[i],
          })),
        },
      },
    });

    // Deposit at intake for about half the repairs.
    let paid = 0;
    if (chance(0.5) && plan.status !== "CANCELLED" && plan.status !== "CANT_FIX") {
      const deposit = Math.min(estimate, pick([500, 1000, 2000]));
      const cashUsd = chance(0.7);
      const session = await sessionFor(created);
      await prisma.payment.create({
        data: {
          shopId,
          ticketId: ticket.id,
          method: cashUsd ? "CASH" : "WHISH",
          currency: "USD",
          amount: deposit,
          rate,
          usdCentsEquivalent: deposit,
          reference: cashUsd ? null : `TX${int(100000, 999999)}`,
          cashSessionId: cashUsd ? session.id : null,
          userId: pick(staff),
          createdAt: created,
        },
      });
      if (cashUsd) session.usdIn += deposit;
      paid = deposit;
    }

    // Parts and labor once repairing started (not for cancelled / waiting / diagnosing).
    let total = 0;
    if (["REPAIRING", "READY", "PICKED_UP", "CANT_FIX"].includes(plan.status)) {
      const workAt = stepTimes[Math.min(2, stepTimes.length - 1)];
      if (plan.partSku && plan.status !== "CANT_FIX") {
        const prod = products.get(plan.partSku)!;
        const item = await prisma.ticketItem.create({
          data: {
            shopId,
            ticketId: ticket.id,
            kind: "PART",
            productId: prod.id,
            description: PRODUCTS.find((p) => p.sku === plan.partSku)!.name,
            qty: 1,
            unitPriceUsdCents: prod.price,
            unitCostUsdCents: prod.cost,
            createdAt: workAt,
          },
        });
        prod.qty -= 1;
        await prisma.product.update({ where: { id: prod.id }, data: { qty: prod.qty } });
        await prisma.stockMovement.create({
          data: { shopId, productId: prod.id, delta: -1, qtyAfter: prod.qty, reason: "TICKET_PART", ticketItemId: item.id, userId: plan.techId ?? ctx.ownerId, createdAt: workAt },
        });
        total += prod.price;
      }
      const laborPrice = plan.status === "CANT_FIX" ? 1000 : plan.problem.labor[1];
      await prisma.ticketItem.create({
        data: {
          shopId,
          ticketId: ticket.id,
          kind: "LABOR",
          description: plan.status === "CANT_FIX" ? "Diagnosis fee" : plan.problem.labor[0],
          qty: 1,
          unitPriceUsdCents: laborPrice,
          createdAt: workAt,
        },
      });
      total += laborPrice;
      await prisma.ticket.update({ where: { id: ticket.id }, data: { totalUsdCents: total } });
    }

    // Picked up: most pay the balance at the POS; a couple leave something owed.
    if (plan.status === "PICKED_UP" && pickedUpAt) {
      const balance = total - paid;
      const owes = ev.idx === 3 || ev.idx === 6;
      const pay = owes ? Math.max(0, balance - 1500) : balance;
      if (pay > 0) {
        await addSale({
          t: pickedUpAt,
          customerId: plan.customer.id,
          cashierId: pick(staff),
          lines: [{ kind: "TICKET_BALANCE", ticketId: ticket.id, description: `R-${ticketNo} · ${plan.device}`, qty: 1, price: pay, cost: 0 }],
        });
      }
    }
  }

  // ---------- notes on a few open tickets ----------
  const open = await prisma.ticket.findMany({ where: { shopId, status: { in: ["WAITING_PART", "DIAGNOSING"] } }, take: 4 });
  for (const t of open) {
    await prisma.ticketNote.create({
      data: {
        shopId,
        ticketId: t.id,
        userId: pick(ctx.techIds),
        body: t.status === "WAITING_PART" ? "Part ordered from supplier, expected in 2–3 days." : "Customer asked to keep photos; backup done.",
        createdAt: new Date(t.updatedAt.getTime() + 3600_000),
      },
    });
  }

  // ---------- a pay-out and close every past session (today stays open) ----------
  const today = dayOf(new Date());
  for (const [key, s] of sessions) {
    if (key !== today && chance(0.4)) {
      await prisma.cashMovement.create({
        data: { shopId, cashSessionId: s.id, type: "PAY_OUT", currency: "USD", amount: 1000, reason: "Delivery / supplier", userId: ctx.ownerId, createdAt: new Date(`${key}T12:00:00Z`) },
      });
      s.usdIn -= 1000;
    }
    if (key === today) continue;
    const expectedUsd = 5000 + s.usdIn - s.usdChange;
    const expectedLbp = 1_000_000 + s.lbpIn - s.lbpChange;
    const off = chance(0.2);
    await prisma.cashSession.update({
      where: { id: s.id },
      data: {
        closedAt: new Date(`${key}T17:00:00Z`),
        closedById: pick(staff),
        expectedUsdCents: expectedUsd,
        expectedLbp,
        countedUsdCents: expectedUsd,
        countedLbp: off ? expectedLbp - 50_000 : expectedLbp,
        note: off ? "Short 50,000 LBP, probably change error" : null,
      },
    });
  }

  await prisma.shop.update({ where: { id: shopId }, data: { ticketSeq: ticketNo, saleSeq: saleNo } });
  return { tickets: ticketPlans.length, sales: saleNo - 1000, products: PRODUCTS.length, customers: CUSTOMERS.length };
}
