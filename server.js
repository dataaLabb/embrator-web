"use strict";
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();

// ─── startup validation ────────────────────────────────────────────────────────
const jwtSecret = (process.env.JWT_SECRET || "").trim();
const WEAK_PLACEHOLDERS = new Set(["", "change-me", "replace-with-a-long-random-secret"]);
if (WEAK_PLACEHOLDERS.has(jwtSecret) || jwtSecret.length < 32) {
  console.error(
    "FATAL: JWT_SECRET is missing, too short (< 32 chars), or is still a placeholder.\n" +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
  process.exit(1);
}

const IS_PROD = (process.env.NODE_ENV || "development") === "production";
const adminPassword  = (process.env.ADMIN_PASSWORD            || "").trim();
const ordersPassword = (process.env.ORDERS_SCREEN_PASSWORD    || "").trim();
const dashPassword   = (process.env.DASHBOARD_SCREEN_PASSWORD || "").trim();

if (!adminPassword || !ordersPassword || !dashPassword) {
  if (IS_PROD) {
    console.error(
      "FATAL: ADMIN_PASSWORD, ORDERS_SCREEN_PASSWORD, DASHBOARD_SCREEN_PASSWORD must be set in production."
    );
    process.exit(1);
  }
  console.warn(
    "WARNING: Password env vars not set — using weak dev-only defaults. Do NOT use in production.\n" +
    "  ADMIN_PASSWORD            ORDERS_SCREEN_PASSWORD            DASHBOARD_SCREEN_PASSWORD"
  );
}

const SEED_ADMIN_PASSWORD  = adminPassword  || "dev-admin-only!123";
const SEED_ORDERS_PASSWORD = ordersPassword || "dev-orders!456";
const SEED_DASH_PASSWORD   = dashPassword   || "dev-dash!789";

const port = Number(process.env.PORT || 3000);
const databaseUrl = String(process.env.DATABASE_URL || "").trim();

// ─── database ──────────────────────────────────────────────────────────────────
function buildPgConfig() {
  if (!databaseUrl) throw new Error("DATABASE_URL is missing.");
  let parsed;
  try { parsed = new URL(databaseUrl); }
  catch (e) { throw new Error(`DATABASE_URL is invalid: ${e.message}`); }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";
  const ssl = localHosts.has(parsed.hostname) ? false : { rejectUnauthorized };

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    ssl
  };
}

const pool = new Pool(buildPgConfig());

// ─── rate limiter (in-memory, no extra dependencies) ──────────────────────────
const rateStore = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of rateStore) {
    if (now > rec.reset + 120_000) rateStore.delete(key);
  }
}, 5 * 60_000).unref();

function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  let rec = rateStore.get(key);
  if (!rec || now > rec.reset) rec = { count: 0, reset: now + windowMs };
  rec.count += 1;
  rateStore.set(key, rec);
  return rec.count > max;
}

function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(`${req.path}:${ip}`, max, windowMs)) {
      return res.status(429).json({ message: "طلبات كثيرة جدًا. انتظر قليلًا ثم حاول مجددًا." });
    }
    next();
  };
}

// ─── JWT (8-hour expiry) ───────────────────────────────────────────────────────
const TOKEN_TTL = 8 * 60 * 60;

function signToken(payload) {
  const full = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL };
  const encoded = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = crypto.createHmac("sha256", jwtSecret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", jwtSecret).update(parts[0]).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[1]))) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { return null; }
  if (!payload.userId) return null;
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

// ─── screen tokens (orders screen, 4-hour expiry) ─────────────────────────────
const SCREEN_TOKEN_TTL = 4 * 60 * 60;
const screenSecret = jwtSecret + ":screen-v1";

function signScreenToken(scope, userId) {
  const payload = { scope, userId, exp: Math.floor(Date.now() / 1000) + SCREEN_TOKEN_TTL };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", screenSecret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyScreenToken(token, scope) {
  if (!token) return false;
  const parts = String(token).split(".");
  if (parts.length !== 2) return false;
  const sig = crypto.createHmac("sha256", screenSecret).update(parts[0]).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(parts[1]))) return false;
  } catch { return false; }
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { return false; }
  if (payload.scope !== scope) return false;
  if (payload.exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

// ─── middleware ────────────────────────────────────────────────────────────────
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ message: "غير مصرح أو انتهت صلاحية الجلسة." });
  req.user = payload;
  next();
}

function ordersScreenRequired(req, res, next) {
  const token = req.headers["x-screen-token"] || "";
  if (!verifyScreenToken(token, "orders")) {
    return res.status(403).json({ message: "يلزم فتح شاشة الطلبيات بكلمة المرور أولًا." });
  }
  next();
}

// ─── helpers ───────────────────────────────────────────────────────────────────
function serverError(res, error) {
  console.error("[server error]", error?.message || error);
  return res.status(500).json({ message: "حدث خطأ داخلي. حاول مرة أخرى." });
}

async function query(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows;
}

const ANALYTICS_CACHE_TTL_MS = 45 * 1000;
const analyticsCache = new Map();

function stableCacheString(value) {
  if (Array.isArray(value)) {
    return "[" + value.map(stableCacheString).join(",") + "]";
  }
  if (value && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableCacheString(value[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

async function withAnalyticsCache(scope, payload, compute) {
  const key = scope + "::" + stableCacheString(payload || {});
  const now = Date.now();
  const cached = analyticsCache.get(key);
  if (cached && now - cached.time < ANALYTICS_CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await compute();
  analyticsCache.set(key, { time: now, value });
  return value;
}

function clearAnalyticsCache() {
  analyticsCache.clear();
}

function boolValue(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function buildOrderCode() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return (
    `ORD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${String(now.getMilliseconds()).padStart(3, "0")}`
  );
}

async function getOrderLines(orderId) {
  return query(
    `select id, item_code, item_name, unit, model, qty, created_at
     from order_lines where order_id = $1 order by created_at asc`,
    [orderId]
  );
}

const PRODUCTION_SHEET_ID = process.env.PRODUCTION_SHEET_ID || "1T4aYUQn6MRme1LfKe6ryd4YbJMaEN6VNobnwjM9yEZo";
const PRODUCTION_SHEETS = [
  { key: "all", title: "الكل", gid: null },
  { key: "ready", title: "الجاهز", gid: "0" },
  { key: "internal", title: "داخلي", gid: "1577931770" },
  { key: "wings", title: "وينكز", gid: "221278991" }
];
const PRODUCTION_CACHE_TTL_MS = 2 * 60 * 1000;
let productionRowsCache = { time: 0, rows: [] };

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => String(cell || "").trim() !== ""));
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/\uFEFF/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function toNumber(value) {
  const num = Number(String(value || "").replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : 0;
}

function toIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = Number(slash[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

async function fetchProductionSheetRows(sheet) {
  const url = `https://docs.google.com/spreadsheets/d/${PRODUCTION_SHEET_ID}/export?format=csv&gid=${sheet.gid}`;
  const response = await fetch(url, { headers: { "User-Agent": "embrator-web/1.0" } });
  if (!response.ok) {
    throw new Error(`تعذر قراءة شيت الإنتاج: ${sheet.title}`);
  }
  const csv = await response.text();
  const rows = parseCsvRows(csv);
  const headers = (rows.shift() || []).map(normalizeHeader);
  const indexOf = (name) => headers.findIndex((header) => header === name);

  const indexes = {
    lineNumber: indexOf("رقم الخط"),
    lineName: indexOf("اسم الخط"),
    date: indexOf("التاريخ"),
    storyNo: indexOf("رقم القصة"),
    modelCode: indexOf("كود الموديل"),
    workOrder: indexOf("امر الشغل (د)"),
    itemName: indexOf("الصنف"),
    size: indexOf("المقاس"),
    color: indexOf("اللون"),
    quantity: indexOf("الكمية"),
    dozens: indexOf("الكمية بالدستة"),
    destination: indexOf("موجه الي")
  };

  return rows.map((row) => ({
    source: sheet.title,
    lineNumber: indexes.lineNumber >= 0 ? String(row[indexes.lineNumber] || "").trim() : "",
    lineName: indexes.lineName >= 0 ? String(row[indexes.lineName] || "").trim() : "",
    date: indexes.date >= 0 ? toIsoDate(row[indexes.date]) : "",
    storyNo: indexes.storyNo >= 0 ? String(row[indexes.storyNo] || "").trim() : "",
    modelCode: indexes.modelCode >= 0 ? String(row[indexes.modelCode] || "").trim() : "",
    workOrder: indexes.workOrder >= 0 ? String(row[indexes.workOrder] || "").trim() : "",
    itemName: indexes.itemName >= 0 ? String(row[indexes.itemName] || "").trim() : "",
    size: indexes.size >= 0 ? String(row[indexes.size] || "").trim() : "",
    color: indexes.color >= 0 ? String(row[indexes.color] || "").trim() : "",
    quantity: indexes.quantity >= 0 ? toNumber(row[indexes.quantity]) : 0,
    dozens: indexes.dozens >= 0 ? toNumber(row[indexes.dozens]) : 0,
    destination: indexes.destination >= 0 ? String(row[indexes.destination] || "").trim() : ""
  }));
}

async function getProductionRows() {
  const now = Date.now();
  if (productionRowsCache.rows.length && now - productionRowsCache.time < PRODUCTION_CACHE_TTL_MS) {
    return productionRowsCache.rows;
  }
  const rows = (await Promise.all(PRODUCTION_SHEETS.filter((sheet) => sheet.gid).map(fetchProductionSheetRows))).flat();
  productionRowsCache = { time: now, rows };
  return rows;
}

function summarizeTop(rows, key, valueKey, limit = 6) {
  const map = new Map();
  rows.forEach((row) => {
    const label = String(row[key] || "").trim() || "غير محدد";
    map.set(label, (map.get(label) || 0) + Number(row[valueKey] || 0));
  });
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ─── express ───────────────────────────────────────────────────────────────────
const app = express();

app.set("trust proxy", 1);

// security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(self)");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://nominatim.openstreetmap.org",
      "img-src 'self' data: blob:",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join("; ")
  );
  next();
});

// block serving sensitive files
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p === "/server.js" ||
    p.startsWith("/.env") ||
    p.startsWith("/node_modules/") ||
    p === "/package.json" ||
    p === "/package-lock.json"
  ) {
    return res.status(404).end();
  }
  next();
});

app.use(express.json({ limit: "15mb" }));
app.use(express.static(__dirname));

// ─── routes ────────────────────────────────────────────────────────────────────

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "embrator-web", date: new Date().toISOString() });
});

// login — max 10 attempts per 15 min per IP
app.post("/api/auth/login", rateLimit(10, 15 * 60_000), async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "البريد الإلكتروني وكلمة المرور مطلوبان." });
    }
    const rows = await query(
      `select id, email, full_name
       from app_users
       where email = $1
         and password_hash = crypt($2, password_hash)
         and is_active = true
       limit 1`,
      [String(email).trim().toLowerCase(), String(password)]
    );
    if (!rows.length) {
      return res.status(401).json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحين." });
    }
    const user = rows[0];
    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name } });
  } catch (error) {
    serverError(res, error);
  }
});

app.get("/api/lookups", authRequired, async (_req, res) => {
  try {
    const [customers, items] = await Promise.all([
      query(
        `select code, name, rep, category, sector, area, address, phone, email, is_active
         from customers order by name asc`
      ),
      query(
        `select code, name, model, unit, description, price, is_active
         from items order by name asc`
      )
    ]);
    res.json({ customers, items });
  } catch (error) {
    serverError(res, error);
  }
});

app.get("/api/customers", authRequired, async (_req, res) => {
  try {
    const customers = await query(
      `select id, code, name, rep, category, sector, area, address, phone, email, is_active, created_at
       from customers order by name asc`
    );
    res.json({ customers });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/customers", authRequired, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.code || !p.name) return res.status(400).json({ message: "كود العميل والاسم مطلوبان." });
    const rows = await query(
      `insert into customers (code, name, rep, category, sector, area, address, phone, email, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id, code, name, rep, category, sector, area, address, phone, email, is_active, created_at`,
      [p.code, p.name, p.rep||"", p.category||"", p.sector||"", p.area||"", p.address||"", p.phone||"", p.email||"", boolValue(p.isActive)]
    );
    clearAnalyticsCache();
    res.json({ customer: rows[0] });
  } catch (error) {
    serverError(res, error);
  }
});

app.put("/api/customers/:code", authRequired, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.name) return res.status(400).json({ message: "اسم العميل مطلوب." });
    const rows = await query(
      `update customers set name=$2, rep=$3, category=$4, sector=$5, area=$6, address=$7, phone=$8, email=$9, is_active=$10
       where code=$1
       returning id, code, name, rep, category, sector, area, address, phone, email, is_active, created_at`,
      [req.params.code, p.name, p.rep||"", p.category||"", p.sector||"", p.area||"", p.address||"", p.phone||"", p.email||"", boolValue(p.isActive)]
    );
    if (!rows.length) return res.status(404).json({ message: "العميل غير موجود." });
    clearAnalyticsCache();
    res.json({ customer: rows[0] });
  } catch (error) {
    serverError(res, error);
  }
});

app.get("/api/items", authRequired, async (_req, res) => {
  try {
    const items = await query(
      `select id, code, name, model, unit, description, price, is_active, created_at
       from items order by name asc`
    );
    res.json({ items });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/items", authRequired, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.code || !p.name) return res.status(400).json({ message: "كود المنتج والاسم مطلوبان." });
    const rows = await query(
      `insert into items (code, name, model, unit, description, price, is_active)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, code, name, model, unit, description, price, is_active, created_at`,
      [p.code, p.name, p.model||"", p.unit||"", p.description||"", Number(p.price||0), boolValue(p.isActive)]
    );
    clearAnalyticsCache();
    res.json({ item: rows[0] });
  } catch (error) {
    serverError(res, error);
  }
});

app.put("/api/items/:code", authRequired, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.name) return res.status(400).json({ message: "اسم المنتج مطلوب." });
    const rows = await query(
      `update items set name=$2, model=$3, unit=$4, description=$5, price=$6, is_active=$7
       where code=$1
       returning id, code, name, model, unit, description, price, is_active, created_at`,
      [req.params.code, p.name, p.model||"", p.unit||"", p.description||"", Number(p.price||0), boolValue(p.isActive)]
    );
    if (!rows.length) return res.status(404).json({ message: "المنتج غير موجود." });
    clearAnalyticsCache();
    res.json({ item: rows[0] });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/visits", authRequired, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.code || !p.name) return res.status(400).json({ message: "بيانات العميل غير مكتملة." });
    await query(
      `insert into visits (customer_code,customer_name,rep,category,sector,area,address,arabic_address,lat,lng,map_url,created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [p.code, p.name, p.rep||"", p.category||"", p.sector||"", p.area||"", p.address||"",
       p.arabicAddress||"", p.lat||null, p.lng||null, p.mapUrl||"", req.user.userId]
    );
    clearAnalyticsCache();
    res.json({ success: true });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/collections", authRequired, async (req, res) => {
  try {
    const p = req.body || {};
    const customer = p.customer || {};
    const amount = Number(p.amount || 0);
    if (!customer.code) return res.status(400).json({ message: "بيانات العميل غير مكتملة." });
    if (amount <= 0) return res.status(400).json({ message: "قيمة التحصيل يجب أن تكون أكبر من صفر." });
    await query(
      `insert into collections
         (customer_code,customer_name,rep,category,sector,area,address,arabic_address,lat,lng,map_url,
          amount,collection_type,cheque_number,bank_name,due_date,cheque_image,created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        customer.code, customer.name, customer.rep||"", customer.category||"",
        customer.sector||"", customer.area||"", customer.address||"",
        p.arabicAddress||"", p.lat||null, p.lng||null, p.mapUrl||"",
        amount, p.collectionType||"",
        p.chequeNumber||"", p.bankName||"", p.dueDate||null,
        p.chequeImage||"", req.user.userId
      ]
    );
    clearAnalyticsCache();
    res.json({ success: true });
  } catch (error) {
    serverError(res, error);
  }
});

app.get("/api/collections/:id/cheque-image", authRequired, async (req, res) => {
  try {
    const rows = await query(
      `select cheque_image from collections where id = $1 limit 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "التحصيل غير موجود." });
    res.json({ chequeImage: rows[0].cheque_image || "" });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/orders/line", authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const p = req.body || {};
    const customer = p.customer || {};
    const item = p.item || {};
    const qty = Number(p.qty || 0);
    if (!customer.code || !item.code || qty <= 0) {
      return res.status(400).json({ message: "بيانات البند غير مكتملة." });
    }

    let orderId = "";
    let orderCode = String(p.orderCode || "").trim();

    await client.query("begin");

    if (!orderCode) {
      orderCode = buildOrderCode();
    }

    const orderRows = await client.query(
      `select id, order_code, created_by, status from orders where order_code = $1 limit 1`,
      [orderCode]
    );

    if (orderRows.rows.length) {
      const existing = orderRows.rows[0];
      if (String(existing.created_by) !== String(req.user.userId)) {
        await client.query("rollback");
        return res.status(403).json({ message: "غير مصرح بتعديل هذه الطلبية." });
      }
      if (existing.status !== "draft") {
        await client.query("rollback");
        return res.status(400).json({ message: "لا يمكن تعديل طلبية مؤكدة أو ملغية." });
      }
      orderId = existing.id;
      orderCode = existing.order_code;
      if (p.lat || p.lng || p.arabicAddress || p.mapUrl) {
        await client.query(
          `update orders
           set lat = coalesce($2, lat),
               lng = coalesce($3, lng),
               arabic_address = case when $4 <> '' then $4 else arabic_address end,
               map_url = case when $5 <> '' then $5 else map_url end
           where id = $1`,
          [orderId, p.lat||null, p.lng||null, p.arabicAddress||"", p.mapUrl||""]
        );
      }
    } else {
      const created = await client.query(
        `insert into orders
           (order_code,customer_code,customer_name,rep,category,sector,area,address,arabic_address,lat,lng,map_url,status,created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13)
         returning id, order_code`,
        [
          orderCode, customer.code, customer.name, customer.rep||"",
          customer.category||"", customer.sector||"", customer.area||"",
          customer.address||"", p.arabicAddress||"",
          p.lat||null, p.lng||null, p.mapUrl||"", req.user.userId
        ]
      );
      orderId = created.rows[0].id;
      orderCode = created.rows[0].order_code;
    }

    const existingLine = await client.query(
      `select id from order_lines where order_id = $1 and item_code = $2 limit 1`,
      [orderId, item.code]
    );

    if (existingLine.rows.length) {
      await client.query(
        `update order_lines set qty = qty + $1 where id = $2`,
        [qty, existingLine.rows[0].id]
      );
    } else {
      await client.query(
        `insert into order_lines (order_id, item_code, item_name, unit, model, qty)
         values ($1,$2,$3,$4,$5,$6)`,
        [orderId, item.code, item.name, item.unit||"", item.model||"", qty]
      );
    }

    await client.query("commit");
    const lines = await getOrderLines(orderId);
    clearAnalyticsCache();
    res.json({ orderId, orderCode, lines });
  } catch (error) {
    await client.query("rollback");
    serverError(res, error);
  } finally {
    client.release();
  }
});

app.delete("/api/orders/line/:lineId", authRequired, async (req, res) => {
  try {
    const lineCheck = await query(
      `select ol.id, o.created_by, o.status
       from order_lines ol
       join orders o on o.id = ol.order_id
       where ol.id = $1`,
      [req.params.lineId]
    );
    if (!lineCheck.length) return res.status(404).json({ message: "البند غير موجود." });
    if (String(lineCheck[0].created_by) !== String(req.user.userId)) {
      return res.status(403).json({ message: "غير مصرح بتعديل هذه الطلبية." });
    }
    if (lineCheck[0].status !== "draft") {
      return res.status(400).json({ message: "لا يمكن تعديل طلبية مؤكدة أو ملغية." });
    }
    const lineRows = await query(
      `delete from order_lines where id = $1 returning order_id`,
      [req.params.lineId]
    );
    const orderId = lineRows[0] ? lineRows[0].order_id : null;
    const lines = orderId ? await getOrderLines(orderId) : [];
    clearAnalyticsCache();
    res.json({ lines });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/orders/confirm", authRequired, async (req, res) => {
  try {
    const orderId  = String(req.body.orderId  || "").trim();
    const orderCode = String(req.body.orderCode || "").trim();
    if (!orderId && !orderCode) {
      return res.status(400).json({ message: "بيانات الطلبية غير مكتملة." });
    }
    const check = await query(
      `select id, created_by, status from orders
       where ($1 <> '' and id::text = $1) or ($2 <> '' and order_code = $2) limit 1`,
      [orderId, orderCode]
    );
    if (!check.length) return res.status(404).json({ message: "الطلبية غير موجودة." });
    if (String(check[0].created_by) !== String(req.user.userId)) {
      return res.status(403).json({ message: "غير مصرح بتعديل هذه الطلبية." });
    }
    if (check[0].status !== "draft") {
      return res.status(400).json({ message: "الطلبية ليست في حالة مسودة." });
    }
    const rows = await query(
      `update orders set status='confirmed', confirmed_at=now()
       where id=$1 returning id, order_code, status, confirmed_at`,
      [check[0].id]
    );
    clearAnalyticsCache();
    clearAnalyticsCache();
    res.json({ success: true, order: rows[0] || null });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/orders/location", authRequired, async (req, res) => {
  try {
    const orderId  = String(req.body.orderId  || "").trim();
    const orderCode = String(req.body.orderCode || "").trim();
    if (!orderId && !orderCode) {
      return res.status(400).json({ message: "بيانات الطلبية غير مكتملة." });
    }
    const check = await query(
      `select id, created_by, status from orders
       where ($1 <> '' and id::text = $1) or ($2 <> '' and order_code = $2) limit 1`,
      [orderId, orderCode]
    );
    if (!check.length) return res.status(404).json({ message: "الطلبية غير موجودة." });
    if (String(check[0].created_by) !== String(req.user.userId)) {
      return res.status(403).json({ message: "غير مصرح بتعديل هذه الطلبية." });
    }
    const rows = await query(
      `update orders set lat=$2, lng=$3, arabic_address=$4, map_url=$5
       where id=$1 returning id, order_code, lat, lng, arabic_address, map_url`,
      [check[0].id, req.body.lat||null, req.body.lng||null, req.body.arabicAddress||"", req.body.mapUrl||""]
    );
    clearAnalyticsCache();
    res.json({ success: true, order: rows[0] });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/orders/cancel", authRequired, async (req, res) => {
  try {
    const orderId  = String(req.body.orderId  || "").trim();
    const orderCode = String(req.body.orderCode || "").trim();
    if (!orderId && !orderCode) {
      return res.status(400).json({ message: "بيانات الطلبية غير مكتملة." });
    }
    const check = await query(
      `select id, created_by, status from orders
       where ($1 <> '' and id::text = $1) or ($2 <> '' and order_code = $2) limit 1`,
      [orderId, orderCode]
    );
    if (!check.length) return res.status(404).json({ message: "الطلبية غير موجودة." });
    if (String(check[0].created_by) !== String(req.user.userId)) {
      return res.status(403).json({ message: "غير مصرح بتعديل هذه الطلبية." });
    }
    if (check[0].status !== "draft") {
      return res.status(400).json({ message: "الطلبية ليست في حالة مسودة." });
    }
    const rows = await query(
      `update orders set status='cancelled', cancelled_at=now()
       where id=$1 returning id, order_code, status, cancelled_at`,
      [check[0].id]
    );
    res.json({ success: true, order: rows[0] || null });
  } catch (error) {
    serverError(res, error);
  }
});

// orders browser — requires screen token
app.get("/api/orders", authRequired, ordersScreenRequired, async (req, res) => {
  try {
    const values = [];
    const where = [];
    if (req.query.from) { values.push(req.query.from + "T00:00:00"); where.push(`created_at >= $${values.length}`); }
    if (req.query.to)   { values.push(req.query.to   + "T23:59:59"); where.push(`created_at <= $${values.length}`); }
    if (req.query.rep)  { values.push(req.query.rep);                where.push(`rep = $${values.length}`); }
    const clause = where.length ? "where " + where.join(" and ") : "";
    const [orders, summaryByRep] = await Promise.all([
      query(
        `select id, order_code, customer_name, rep, status, address, arabic_address, lat, lng, map_url, created_at
         from orders ${clause} order by created_at desc`,
        values
      ),
      query(
        `select rep, count(*)::int as orders_count from orders ${clause} group by rep order by orders_count desc, rep asc`,
        values
      )
    ]);
    res.json({ orders, summaryByRep });
  } catch (error) {
    serverError(res, error);
  }
});

app.get("/api/orders/:orderCode", authRequired, ordersScreenRequired, async (req, res) => {
  try {
    const orders = await query(
      `select * from orders where order_code = $1 limit 1`,
      [req.params.orderCode]
    );
    if (!orders.length) return res.status(404).json({ message: "الطلبية غير موجودة." });
    const lines = await getOrderLines(orders[0].id);
    res.json({ order: orders[0], lines });
  } catch (error) {
    serverError(res, error);
  }
});

// screen-access — max 10 attempts per 5 min per IP
const VALID_SCOPES = new Set(["orders", "dashboard"]);
app.post("/api/screen-access", authRequired, rateLimit(10, 5 * 60_000), async (req, res) => {
  try {
    const scope = String(req.body.scope || "").trim();
    if (!VALID_SCOPES.has(scope)) {
      return res.status(400).json({ message: "نطاق غير صحيح." });
    }
    const rows = await query(
      `select value from portal_settings where key = $1 limit 1`,
      [`${scope}_password`]
    );
    if (!rows.length || rows[0].value !== String(req.body.password || "")) {
      return res.status(403).json({ message: "كلمة المرور غير صحيحة." });
    }
    const screenToken = signScreenToken(scope, req.user.userId);
    res.json({ success: true, screenToken });
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/dashboard", authRequired, async (req, res) => {
  try {
    const payload = await withAnalyticsCache("dashboard", req.body || {}, async () => {
      const p = req.body || {};
      const values = [];
      const visitWhere = [], collectionWhere = [], orderWhere = [];

      if (p.from) {
        values.push(p.from);
        visitWhere.push(`created_at::date >= $${values.length}`);
        collectionWhere.push(`created_at::date >= $${values.length}`);
        orderWhere.push(`created_at::date >= $${values.length}`);
      }
      if (p.to) {
        values.push(p.to);
        visitWhere.push(`created_at::date <= $${values.length}`);
        collectionWhere.push(`created_at::date <= $${values.length}`);
        orderWhere.push(`created_at::date <= $${values.length}`);
      }
      if (p.rep) {
        values.push(p.rep);
        visitWhere.push(`rep = $${values.length}`);
        collectionWhere.push(`rep = $${values.length}`);
        orderWhere.push(`rep = $${values.length}`);
      }
      if (p.payKind) {
        values.push(p.payKind);
        collectionWhere.push(`collection_type = $${values.length}`);
      }

      const vClause = visitWhere.length ? "where " + visitWhere.join(" and ") : "";
      const cClause = collectionWhere.length ? "where " + collectionWhere.join(" and ") : "";
      const oClause = orderWhere.length ? "where " + orderWhere.join(" and ") : "";
      const repClauseForLines = orderWhere.length
        ? "where " + orderWhere.map((c) => c.replaceAll("created_at", "o.created_at").replaceAll("rep =", "o.rep =")).join(" and ")
        : "";

      const [
        visitRows, collectionRows, orderRows,
        dailyOrders, dailyCollections, ordersByRep, collectionsByType,
        visitsByRep, collectionsByRep, topCustomers, topItems, latestOrders, latestCollections
      ] = await Promise.all([
        query(`select count(*)::int as count from visits ${vClause}`, values),
        query(`select count(*)::int as count, coalesce(sum(amount),0)::numeric as total from collections ${cClause}`, values),
        query(
          `select count(*)::int as total,
                  count(*) filter (where status='confirmed')::int as confirmed,
                  count(*) filter (where status='cancelled')::int as cancelled,
                  count(*) filter (where status='draft')::int as draft
           from orders ${oClause}`,
          values
        ),
        query(`select to_char(created_at::date,'YYYY-MM-DD') as day, count(*)::int as total from orders ${oClause} group by created_at::date order by created_at::date asc`, values),
        query(`select to_char(created_at::date,'YYYY-MM-DD') as day, coalesce(sum(amount),0)::numeric as total from collections ${cClause} group by created_at::date order by created_at::date asc`, values),
        query(`select rep, count(*)::int as total from orders ${oClause} group by rep order by total desc limit 8`, values),
        query(`select collection_type as label, count(*)::int as total from collections ${cClause} group by collection_type order by total desc limit 8`, values),
        query(`select rep, count(*)::int as total from visits ${vClause} group by rep order by total desc limit 8`, values),
        query(`select rep, coalesce(sum(amount),0)::numeric as total from collections ${cClause} group by rep order by total desc limit 8`, values),
        query(`select customer_name as label, count(*)::int as total from orders ${oClause} group by customer_name order by total desc, customer_name asc limit 6`, values),
        query(`select ol.item_name as label, coalesce(sum(ol.qty),0)::numeric as total from order_lines ol join orders o on o.id=ol.order_id ${repClauseForLines} group by ol.item_name order by total desc, ol.item_name asc limit 6`, values),
        query(`select order_code, customer_name, rep, status, created_at from orders ${oClause} order by created_at desc limit 6`, values),
        query(`select customer_name, rep, amount, collection_type, created_at from collections ${cClause} order by created_at desc limit 6`, values)
      ]);

      const visitsCount = visitRows[0].count;
      const collectionsCount = collectionRows[0].count;
      const collectionsTotal = Number(collectionRows[0].total);
      const ordersCount = orderRows[0].total;
      const confirmedOrders = orderRows[0].confirmed;
      const cancelledOrders = orderRows[0].cancelled;
      const draftOrders = orderRows[0].draft;
      const averageCollection = collectionsCount ? collectionsTotal / collectionsCount : 0;
      const orderConfirmationRate = ordersCount ? (confirmedOrders / ordersCount) * 100 : 0;

      return {
        visitsCount, collectionsCount, collectionsTotal, ordersCount,
        confirmedOrders, cancelledOrders, draftOrders, averageCollection, orderConfirmationRate,
        dailyOrders,
        dailyCollections: dailyCollections.map((r) => ({ day: r.day, total: Number(r.total) })),
        ordersByRep,
        collectionsByType,
        visitsByRep,
        collectionsByRep: collectionsByRep.map((r) => ({ rep: r.rep, total: Number(r.total) })),
        topCustomers,
        topItems: topItems.map((r) => ({ label: r.label, total: Number(r.total) })),
        latestOrders,
        latestCollections: latestCollections.map((r) => ({ ...r, amount: Number(r.amount) })),
        statusBreakdown: [
          { label: "Confirmed", total: confirmedOrders },
          { label: "Draft", total: draftOrders },
          { label: "Cancelled", total: cancelledOrders }
        ]
      };
    });

    res.json(payload);
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/field-movements", authRequired, async (req, res) => {
  try {
    const payload = await withAnalyticsCache("field-movements", req.body || {}, async () => {
      const p = req.body || {};
      const exportAll = Boolean(p.exportAll);
      const pageSize = exportAll ? 50000 : Math.min(Math.max(Number(p.pageSize || 10), 1), 50);
      const page = exportAll ? 1 : Math.max(Number(p.page || 1), 1);
      const offset = (page - 1) * pageSize;
      const movVals = [];
      const vWhere = [], cWhereParts = [];

      if (p.from) { movVals.push(p.from); vWhere.push(`created_at::date >= $${movVals.length}`); cWhereParts.push(`created_at::date >= $${movVals.length}`); }
      if (p.to) { movVals.push(p.to); vWhere.push(`created_at::date <= $${movVals.length}`); cWhereParts.push(`created_at::date <= $${movVals.length}`); }
      if (p.rep) { movVals.push(p.rep); vWhere.push(`rep = $${movVals.length}`); cWhereParts.push(`rep = $${movVals.length}`); }
      if (p.payKind) { movVals.push(p.payKind); cWhereParts.push(`collection_type = $${movVals.length}`); }

      const vClause = vWhere.length ? "where " + vWhere.join(" and ") : "";
      const cClause = cWhereParts.length ? "where " + cWhereParts.join(" and ") : "";
      const movementBaseSql = `
        with movement_base as (
          select id::text as movement_id, rep, customer_name, created_at, 'visit' as movement_type,
                 0::numeric as amount, ''::text as cheque_number, ''::text as bank_name,
                 null::date as due_date, false as has_cheque_image,
                 lat, lng, coalesce(arabic_address,address,'') as arabic_address, map_url
          from visits ${vClause}
          union all
          select id::text as movement_id, rep, customer_name, created_at, 'collection' as movement_type,
                 amount, cheque_number, bank_name, due_date, (cheque_image <> '') as has_cheque_image,
                 lat, lng, coalesce(arabic_address,address,'') as arabic_address, map_url
          from collections ${cClause}
          union all
          select id::text as movement_id, rep, customer_name, created_at, 'order' as movement_type,
                 0::numeric as amount, ''::text as cheque_number, ''::text as bank_name,
                 null::date as due_date, false as has_cheque_image,
                 lat, lng, coalesce(arabic_address,address,'') as arabic_address, map_url
          from orders ${vClause}
        )`;

      const [countRows, movementRows] = await Promise.all([
        query(`${movementBaseSql} select count(*)::int as total_count from movement_base`, movVals),
        query(
          exportAll
            ? `${movementBaseSql} select * from movement_base order by created_at desc`
            : `${movementBaseSql} select * from movement_base order by created_at desc limit $${movVals.length + 1} offset $${movVals.length + 2}`,
          exportAll ? movVals : movVals.concat([pageSize, offset])
        )
      ]);

      const totalCount = Number((countRows[0] && countRows[0].total_count) || 0);
      const totalPages = exportAll ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));

      return {
        currentPage: page,
        pageSize,
        totalCount,
        totalPages,
        movementRows: movementRows.map((r) => ({
          movement_id: r.movement_id, rep: r.rep, customer_name: r.customer_name,
          created_at: r.created_at, movement_type: r.movement_type, amount: Number(r.amount || 0),
          cheque_number: r.cheque_number || "", bank_name: r.bank_name || "",
          due_date: r.due_date, has_cheque_image: Boolean(r.has_cheque_image),
          lat: r.lat, lng: r.lng, arabic_address: r.arabic_address, map_url: r.map_url
        }))
      };
    });

    res.json(payload);
  } catch (error) {
    serverError(res, error);
  }
});

app.post("/api/production-dashboard", authRequired, async (req, res) => {
  try {
    const payload = await withAnalyticsCache("production-dashboard", req.body || {}, async () => {
      const from = String(req.body.from || "").trim();
      const to = String(req.body.to || "").trim();
      const source = String(req.body.source || "").trim();
      const rows = await getProductionRows();
      const filtered = rows.filter((row) => {
        if (source && source !== "الكل" && row.source !== source) return false;
        if (from && row.date && row.date < from) return false;
        if (to && row.date && row.date > to) return false;
        return true;
      });

      const totalQuantity = filtered.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const totalDozens = filtered.reduce((sum, row) => sum + Number(row.dozens || 0), 0);
      const dailyQuantity = summarizeTop(filtered, "date", "quantity", 120)
        .filter((row) => row.label && row.label !== "غير محدد")
        .sort((a, b) => a.label.localeCompare(b.label));
      const bySource = summarizeTop(filtered, "source", "quantity", 10);
      const topLines = summarizeTop(filtered, "lineName", "quantity", 8);
      const topItems = summarizeTop(filtered, "itemName", "quantity", 8);
      const topDestinations = summarizeTop(filtered, "destination", "quantity", 8);
      const sizeBreakdown = summarizeTop(filtered, "size", "quantity", 10);
      const recentRecords = filtered
        .filter((row) => row.date)
        .sort((a, b) => {
          const dateDiff = String(b.date).localeCompare(String(a.date));
          if (dateDiff !== 0) return dateDiff;
          return Number(b.quantity || 0) - Number(a.quantity || 0);
        })
        .slice(0, 8);

      return {
        totalQuantity: Number(totalQuantity.toFixed(2)),
        totalDozens: Number(totalDozens.toFixed(2)),
        recordsCount: filtered.length,
        storiesCount: new Set(filtered.map((row) => row.storyNo).filter(Boolean)).size,
        modelsCount: new Set(filtered.map((row) => row.modelCode).filter(Boolean)).size,
        linesCount: new Set(filtered.map((row) => row.lineName).filter(Boolean)).size,
        sources: PRODUCTION_SHEETS.map((sheet) => sheet.title),
        bySource,
        dailyQuantity,
        topLines,
        topItems,
        topDestinations,
        sizeBreakdown,
        recentRecords
      };
    });

    res.json(payload);
  } catch (error) {
    serverError(res, error);
  }
});

app.get("/api/home-summary", authRequired, async (_req, res) => {
  try {
    const [countsRows, recentOrders, recentCollections] = await Promise.all([
      query(
        `select
           (select count(*)::int from customers) as customers_count,
           (select count(*)::int from items) as items_count,
           (select count(*)::int from orders) as orders_count,
           (select count(*)::int from orders where status='confirmed') as confirmed_orders,
           (select count(*)::int from visits where created_at::date = current_date) as visits_today,
           (select coalesce(sum(amount),0)::numeric from collections where created_at::date = current_date) as collections_today`
      ),
      query(`select order_code, customer_name, status, created_at from orders order by created_at desc limit 5`),
      query(`select customer_name, amount, collection_type, created_at from collections order by created_at desc limit 4`)
    ]);
    res.json({ metrics: countsRows[0] || {}, recentOrders, recentCollections });
  } catch (error) {
    serverError(res, error);
  }
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── schema & seed ────────────────────────────────────────────────────────────
async function ensureSchema() {
  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists app_users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      full_name text not null default '',
      password_hash text not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table if not exists customers (
      id uuid primary key default gen_random_uuid(),
      code text not null unique, name text not null,
      rep text not null default '', category text not null default '',
      sector text not null default '', area text not null default '',
      address text not null default '', phone text not null default '',
      email text not null default '', is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table if not exists items (
      id uuid primary key default gen_random_uuid(),
      code text not null unique, name text not null,
      model text not null default '', unit text not null default '',
      description text not null default '', price numeric(14,2) not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table if not exists visits (
      id uuid primary key default gen_random_uuid(),
      customer_code text not null, customer_name text not null,
      rep text not null default '', category text not null default '',
      sector text not null default '', area text not null default '',
      address text not null default '', arabic_address text not null default '',
      lat double precision, lng double precision,
      map_url text not null default '',
      created_by uuid references app_users(id),
      created_at timestamptz not null default now()
    );
    create table if not exists collections (
      id uuid primary key default gen_random_uuid(),
      customer_code text not null, customer_name text not null,
      rep text not null default '', category text not null default '',
      sector text not null default '', area text not null default '',
      address text not null default '', arabic_address text not null default '',
      lat double precision, lng double precision,
      map_url text not null default '',
      amount numeric(14,2) not null default 0,
      collection_type text not null,
      cheque_number text not null default '', bank_name text not null default '',
      due_date date, cheque_image text not null default '',
      created_by uuid references app_users(id),
      created_at timestamptz not null default now()
    );
    create table if not exists orders (
      id uuid primary key default gen_random_uuid(),
      order_code text not null unique,
      customer_code text not null, customer_name text not null,
      rep text not null default '', category text not null default '',
      sector text not null default '', area text not null default '',
      address text not null default '', arabic_address text not null default '',
      lat double precision, lng double precision,
      map_url text not null default '',
      status text not null default 'draft' check (status in ('draft','confirmed','cancelled')),
      created_by uuid references app_users(id),
      created_at timestamptz not null default now(),
      confirmed_at timestamptz, cancelled_at timestamptz
    );
    create table if not exists order_lines (
      id uuid primary key default gen_random_uuid(),
      order_id uuid not null references orders(id) on delete cascade,
      item_code text not null, item_name text not null,
      unit text not null default '', model text not null default '',
      qty numeric(14,2) not null default 0,
      created_at timestamptz not null default now()
    );
    create table if not exists portal_settings (
      key text primary key, value text not null,
      updated_at timestamptz not null default now()
    );

    create index if not exists idx_customers_rep on customers(rep);
    create index if not exists idx_items_model on items(model);
    create index if not exists idx_visits_created_at on visits(created_at desc);
    create index if not exists idx_visits_rep_created_at on visits(rep, created_at desc);
    create index if not exists idx_collections_created_at on collections(created_at desc);
    create index if not exists idx_collections_rep_created_at on collections(rep, created_at desc);
    create index if not exists idx_collections_type_created_at on collections(collection_type, created_at desc);
    create index if not exists idx_orders_created_at on orders(created_at desc);
    create index if not exists idx_orders_rep_created_at on orders(rep, created_at desc);
    create index if not exists idx_orders_status_created_at on orders(status, created_at desc);
    create index if not exists idx_order_lines_order_id on order_lines(order_id);
    create index if not exists idx_order_lines_item_code on order_lines(item_code);

    alter table customers add column if not exists phone text not null default '';
    alter table customers add column if not exists email text not null default '';
    alter table customers add column if not exists is_active boolean not null default true;
    alter table items add column if not exists description text not null default '';
    alter table items add column if not exists price numeric(14,2) not null default 0;
    alter table items add column if not exists is_active boolean not null default true;
    alter table visits add column if not exists arabic_address text not null default '';
    alter table visits add column if not exists lat double precision;
    alter table visits add column if not exists lng double precision;
    alter table visits add column if not exists map_url text not null default '';
    alter table collections add column if not exists arabic_address text not null default '';
    alter table collections add column if not exists lat double precision;
    alter table collections add column if not exists lng double precision;
    alter table collections add column if not exists map_url text not null default '';
    alter table collections add column if not exists cheque_number text not null default '';
    alter table collections add column if not exists bank_name text not null default '';
    alter table collections add column if not exists due_date date;
    alter table collections add column if not exists cheque_image text not null default '';
    alter table orders add column if not exists arabic_address text not null default '';
    alter table orders add column if not exists lat double precision;
    alter table orders add column if not exists lng double precision;
    alter table orders add column if not exists map_url text not null default '';
  `);

  // create admin if not exists, then update password from env var if provided
  await pool.query(
    `insert into app_users (email, full_name, password_hash, is_active)
     values ('admin@embrator.com', 'Admin User', crypt($1, gen_salt('bf')), true)
     on conflict (email) do update set password_hash = crypt($1, gen_salt('bf'))`,
    [SEED_ADMIN_PASSWORD]
  );

  // always sync screen passwords from env vars (upsert)
  await pool.query(
    `insert into portal_settings (key, value) values ($1, $2), ($3, $4)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    ["orders_password", SEED_ORDERS_PASSWORD, "dashboard_password", SEED_DASH_PASSWORD]
  );

  // seed sample data only if tables are empty
  const customerCount = await query(`select count(*)::int as count from customers`);
  if ((customerCount[0] && customerCount[0].count) === 0) {
    await pool.query(
      `insert into customers (code,name,rep,category,sector,area,address,phone,email,is_active) values
         ('C001','مؤسسة النور','أحمد','A','تجزئة','مدينة نصر','القاهرة','01000000001','c001@example.com',true),
         ('C002','شركة الهدى','محمود','B','جملة','المعادي','القاهرة','01000000002','c002@example.com',true)`
    );
  }
  const itemCount = await query(`select count(*)::int as count from items`);
  if ((itemCount[0] && itemCount[0].count) === 0) {
    await pool.query(
      `insert into items (code,name,model,unit,description,price,is_active) values
         ('I001','موتور 1 حصان','M-100','قطعة','موتور تشغيل صناعي',1500,true),
         ('I002','مضخة مياه','P-200','قطعة','مضخة ضغط متوسطة',2200,true)`
    );
  }
}

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Embrator web server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize schema:", error);
    process.exit(1);
  });
