// Seed data for PlatformSetting: the starting WhatsApp templates and quick picks every new shop
// receives (copied by lib/shop-defaults.ts). After seeding they live in the database.
// Template placeholders: {customer} {device} {ticket} {balance} {shop} {trackUrl}
export const DEFAULT_TEMPLATES = {
  TICKET_RECEIVED: {
    EN: "Hi {customer}, we received your {device}. Ticket {ticket}. Track it here: {trackUrl} - {shop}",
    AR: "مرحباً {customer}، استلمنا جهازك {device}. رقم التذكرة {ticket}. تابع الحالة هنا: {trackUrl} - {shop}",
  },
  TICKET_READY: {
    EN: "Hi {customer}, your {device} is ready for pickup. Ticket {ticket}, balance due {balance}. - {shop}",
    AR: "مرحباً {customer}، جهازك {device} جاهز للاستلام. رقم التذكرة {ticket}، المبلغ المتبقي {balance}. - {shop}",
  },
  TICKET_WAITING_PART: {
    EN: "Hi {customer}, we're waiting for a part for your {device} (ticket {ticket}). We'll update you soon. - {shop}",
    AR: "مرحباً {customer}، ننتظر قطعة لجهازك {device} (تذكرة {ticket}). سنبلغك قريباً. - {shop}",
  },
  TICKET_CANT_FIX: {
    EN: "Hi {customer}, unfortunately we couldn't fix your {device} (ticket {ticket}). You can pick it up anytime. - {shop}",
    AR: "مرحباً {customer}، للأسف لم نتمكن من تصليح جهازك {device} (تذكرة {ticket}). يمكنك استلامه في أي وقت. - {shop}",
  },
  BALANCE_REMINDER: {
    EN: "Hi {customer}, a friendly reminder: balance of {balance} is due for ticket {ticket}. - {shop}",
    AR: "مرحباً {customer}، تذكير: يوجد مبلغ {balance} مستحق على التذكرة {ticket}. - {shop}",
  },
} as const;

export const DEFAULT_PRESETS = [
  { kind: "PROBLEM", labelEn: "Broken screen", labelAr: "شاشة مكسورة" },
  { kind: "PROBLEM", labelEn: "Battery", labelAr: "بطارية" },
  { kind: "PROBLEM", labelEn: "Charging port", labelAr: "منفذ الشحن" },
  { kind: "PROBLEM", labelEn: "Water damage", labelAr: "دخول مياه" },
  { kind: "PROBLEM", labelEn: "Camera", labelAr: "كاميرا" },
  { kind: "PROBLEM", labelEn: "Speaker / mic", labelAr: "سماعة / مايكروفون" },
  { kind: "PROBLEM", labelEn: "Software", labelAr: "سوفتوير" },
  { kind: "PROBLEM", labelEn: "Back glass", labelAr: "زجاج خلفي" },
  { kind: "PAY_OUT", labelEn: "Paid supplier", labelAr: "دفعة لمورد" },
  { kind: "PAY_OUT", labelEn: "Petty cash", labelAr: "مصاريف نثرية" },
  { kind: "PAY_OUT", labelEn: "Owner withdrawal", labelAr: "سحب من المالك" },
  { kind: "PAY_IN", labelEn: "Extra change float", labelAr: "فكّة إضافية" },
  { kind: "PAY_IN", labelEn: "Owner deposit", labelAr: "إيداع من المالك" },
] as const;
