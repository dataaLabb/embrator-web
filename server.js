const path = require("path");
const crypto = require("crypto");
const express = require("express");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "change-me";
const databaseUrl = String(process.env.DATABASE_URL || "").trim();

function buildPgConfig() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch (error) {
    throw new Error(`DATABASE_URL is invalid: ${error.message}`);
  }

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "postgres"),
    user: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || ""),
    ssl: {
      rejectUnauthorized: false
    }
  };
}

const pool = new Pool(buildPgConfig());

app.use(express.json({ limit: "15mb" }));
app.use(express.static(__dirname));

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "embrator-web",
    date: new Date().toISOString()
  });
});

function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", jwtSecret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", jwtSecret)
    .update(parts[0])
    .digest("base64url");

  if (expected !== parts[1]) {
    return null;
  }

  return JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
}

async function query(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows;
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ message: "غير مصرح." });
  }
  req.user = payload;
  next();
}

function buildOrderCode() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `ORD-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes()
  )}${pad(now.getSeconds())}${String(now.getMilliseconds()).padStart(3, "0")}`;
}

async function getOrderLines(orderId) {
  return query(
    `
      select id, item_code, item_name, unit, model, qty, created_at
      from order_lines
      where order_id = $1
      order by created_at asc
    `,
    [orderId]
  );
}

function boolValue(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

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
      code text not null unique,
      name text not null,
      rep text not null default '',
      category text not null default '',
      sector text not null default '',
      area text not null default '',
      address text not null default '',
      phone text not null default '',
      email text not null default '',
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );

    create table if not exists items (
      id uuid primary key default gen_random_uuid(),
      code text not null unique,
      name text not null,
      model text not null default '',
      unit text not null default '',
      description text not null default '',
      price numeric(14,2) not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );

    create table if not exists visits (
      id uuid primary key default gen_random_uuid(),
      customer_code text not null,
      customer_name text not null,
      rep text not null default '',
      category text not null default '',
      sector text not null default '',
      area text not null default '',
      address text not null default '',
      arabic_address text not null default '',
      lat double precision,
      lng double precision,
      map_url text not null default '',
      created_by uuid references app_users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists collections (
      id uuid primary key default gen_random_uuid(),
      customer_code text not null,
      customer_name text not null,
      rep text not null default '',
      category text not null default '',
      sector text not null default '',
      area text not null default '',
      address text not null default '',
      arabic_address text not null default '',
      lat double precision,
      lng double precision,
      map_url text not null default '',
      amount numeric(14,2) not null default 0,
      collection_type text not null,
      cheque_number text not null default '',
      bank_name text not null default '',
      due_date date,
      cheque_image text not null default '',
      created_by uuid references app_users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists orders (
      id uuid primary key default gen_random_uuid(),
      order_code text not null unique,
      customer_code text not null,
      customer_name text not null,
      rep text not null default '',
      category text not null default '',
      sector text not null default '',
      area text not null default '',
      address text not null default '',
      arabic_address text not null default '',
      lat double precision,
      lng double precision,
      map_url text not null default '',
      status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
      created_by uuid references app_users(id),
      created_at timestamptz not null default now(),
      confirmed_at timestamptz,
      cancelled_at timestamptz
    );

    create table if not exists order_lines (
      id uuid primary key default gen_random_uuid(),
      order_id uuid not null references orders(id) on delete cascade,
      item_code text not null,
      item_name text not null,
      unit text not null default '',
      model text not null default '',
      qty numeric(14,2) not null default 0,
      created_at timestamptz not null default now()
    );

    create table if not exists portal_settings (
      key text primary key,
      value text not null,
      updated_at timestamptz not null default now()
    );

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

  await pool.query(`
    insert into app_users (email, full_name, password_hash, is_active)
    values (
      'admin@embrator.com',
      'Admin User',
      crypt('12345678', gen_salt('bf')),
      true
    )
    on conflict (email) do nothing;

    insert into portal_settings (key, value)
    values
      ('orders_password', '1234'),
      ('dashboard_password', '5678')
    on conflict (key) do nothing;
  `);

  const customerCount = await query(`select count(*)::int as count from customers`);
  if ((customerCount[0] && customerCount[0].count) === 0) {
    await pool.query(`
      insert into customers (code, name, rep, category, sector, area, address, phone, email, is_active)
      values
        ('C001', 'مؤسسة النور', 'أحمد', 'A', 'تجزئة', 'مدينة نصر', 'القاهرة', '01000000001', 'c001@example.com', true),
        ('C002', 'شركة الهدى', 'محمود', 'B', 'جملة', 'المعادي', 'القاهرة', '01000000002', 'c002@example.com', true);
    `);
  }

  const itemCount = await query(`select count(*)::int as count from items`);
  if ((itemCount[0] && itemCount[0].count) === 0) {
    await pool.query(`
      insert into items (code, name, model, unit, description, price, is_active)
      values
        ('I001', 'موتور 1 حصان', 'M-100', 'قطعة', 'موتور تشغيل صناعي', 1500, true),
        ('I002', 'مضخة مياه', 'P-200', 'قطعة', 'مضخة ضغط متوسطة', 2200, true);
    `);
  }
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const rows = await query(
      `
        select id, email, full_name
        from app_users
        where email = $1
          and password_hash = crypt($2, password_hash)
          and is_active = true
        limit 1
      `,
      [String(email || "").trim().toLowerCase(), String(password || "")]
    );

    if (!rows.length) {
      return res.status(401).json({ message: "البريد الإلكتروني أو كلمة المرور غير صحيحين." });
    }

    const user = rows[0];
    const token = signToken({
      userId: user.id,
      email: user.email
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/lookups", authRequired, async (_req, res) => {
  try {
    const [customers, items] = await Promise.all([
      query(
        `
          select code, name, rep, category, sector, area, address, phone, email, is_active
          from customers
          order by name asc
        `
      ),
      query(
        `
          select code, name, model, unit, description, price, is_active
          from items
          order by name asc
        `
      )
    ]);

    res.json({ customers, items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/customers", authRequired, async (_req, res) => {
  try {
    const customers = await query(
      `
        select id, code, name, rep, category, sector, area, address, phone, email, is_active, created_at
        from customers
        order by name asc
      `
    );
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/customers", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const rows = await query(
      `
        insert into customers
          (code, name, rep, category, sector, area, address, phone, email, is_active)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id, code, name, rep, category, sector, area, address, phone, email, is_active, created_at
      `,
      [
        payload.code,
        payload.name,
        payload.rep || "",
        payload.category || "",
        payload.sector || "",
        payload.area || "",
        payload.address || "",
        payload.phone || "",
        payload.email || "",
        boolValue(payload.isActive, true)
      ]
    );
    res.json({ customer: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/customers/:code", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const rows = await query(
      `
        update customers
        set name = $2,
            rep = $3,
            category = $4,
            sector = $5,
            area = $6,
            address = $7,
            phone = $8,
            email = $9,
            is_active = $10
        where code = $1
        returning id, code, name, rep, category, sector, area, address, phone, email, is_active, created_at
      `,
      [
        req.params.code,
        payload.name,
        payload.rep || "",
        payload.category || "",
        payload.sector || "",
        payload.area || "",
        payload.address || "",
        payload.phone || "",
        payload.email || "",
        boolValue(payload.isActive, true)
      ]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "العميل غير موجود." });
    }
    res.json({ customer: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/items", authRequired, async (_req, res) => {
  try {
    const items = await query(
      `
        select id, code, name, model, unit, description, price, is_active, created_at
        from items
        order by name asc
      `
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/items", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const rows = await query(
      `
        insert into items
          (code, name, model, unit, description, price, is_active)
        values
          ($1, $2, $3, $4, $5, $6, $7)
        returning id, code, name, model, unit, description, price, is_active, created_at
      `,
      [
        payload.code,
        payload.name,
        payload.model || "",
        payload.unit || "",
        payload.description || "",
        Number(payload.price || 0),
        boolValue(payload.isActive, true)
      ]
    );
    res.json({ item: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/items/:code", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const rows = await query(
      `
        update items
        set name = $2,
            model = $3,
            unit = $4,
            description = $5,
            price = $6,
            is_active = $7
        where code = $1
        returning id, code, name, model, unit, description, price, is_active, created_at
      `,
      [
        req.params.code,
        payload.name,
        payload.model || "",
        payload.unit || "",
        payload.description || "",
        Number(payload.price || 0),
        boolValue(payload.isActive, true)
      ]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "المنتج غير موجود." });
    }
    res.json({ item: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/visits", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    await query(
      `
        insert into visits
          (customer_code, customer_name, rep, category, sector, area, address, arabic_address, lat, lng, map_url, created_by)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        payload.code,
        payload.name,
        payload.rep,
        payload.category,
        payload.sector,
        payload.area,
        payload.address || "",
        payload.arabicAddress || "",
        payload.lat || null,
        payload.lng || null,
        payload.mapUrl || "",
        req.user.userId
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/collections", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const customer = payload.customer || {};
    await query(
      `
        insert into collections
          (customer_code, customer_name, rep, category, sector, area, address, arabic_address, lat, lng, map_url, amount, collection_type, cheque_number, bank_name, due_date, cheque_image, created_by)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        customer.code,
        customer.name,
        customer.rep,
        customer.category,
        customer.sector,
        customer.area,
        customer.address || "",
        payload.arabicAddress || "",
        payload.lat || null,
        payload.lng || null,
        payload.mapUrl || "",
        Number(payload.amount || 0),
        payload.collectionType,
        payload.chequeNumber || "",
        payload.bankName || "",
        payload.dueDate || null,
        payload.chequeImage || "",
        req.user.userId
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/collections/:id/cheque-image", authRequired, async (req, res) => {
  try {
    const rows = await query(
      `
        select cheque_image
        from collections
        where id = $1
        limit 1
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "التحصيل غير موجود." });
    }

    res.json({
      chequeImage: rows[0].cheque_image || ""
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/orders/line", authRequired, async (req, res) => {
  const client = await pool.connect();
  try {
    const payload = req.body || {};
    const customer = payload.customer || {};
    const item = payload.item || {};
    let orderId = "";
    let orderCode = String(payload.orderCode || "").trim();

    await client.query("begin");

    if (!orderCode) {
      orderCode = buildOrderCode();
    }

    const orderRows = await client.query(
      `
        select id, order_code
        from orders
        where order_code = $1
        limit 1
      `,
      [orderCode]
    );

    if (orderRows.rows.length) {
      orderId = orderRows.rows[0].id;
      orderCode = orderRows.rows[0].order_code;
      if (payload.lat || payload.lng || payload.arabicAddress || payload.mapUrl) {
        await client.query(
          `
            update orders
            set lat = coalesce($2, lat),
                lng = coalesce($3, lng),
                arabic_address = case when $4 <> '' then $4 else arabic_address end,
                map_url = case when $5 <> '' then $5 else map_url end
            where id = $1
          `,
          [orderId, payload.lat || null, payload.lng || null, payload.arabicAddress || "", payload.mapUrl || ""]
        );
      }
    } else {
      const created = await client.query(
        `
          insert into orders
            (order_code, customer_code, customer_name, rep, category, sector, area, address, arabic_address, lat, lng, map_url, status, created_by)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft', $13)
          returning id, order_code
        `,
        [
          orderCode,
          customer.code,
          customer.name,
          customer.rep,
          customer.category,
          customer.sector,
          customer.area,
          customer.address || "",
          payload.arabicAddress || "",
          payload.lat || null,
          payload.lng || null,
          payload.mapUrl || "",
          req.user.userId
        ]
      );
      orderId = created.rows[0].id;
      orderCode = created.rows[0].order_code;
    }

    const existing = await client.query(
      `
        select id, qty
        from order_lines
        where order_id = $1 and item_code = $2
        limit 1
      `,
      [orderId, item.code]
    );

    if (existing.rows.length) {
      await client.query(
        `
          update order_lines
          set qty = qty + $1
          where id = $2
        `,
        [Number(payload.qty || 0), existing.rows[0].id]
      );
    } else {
      await client.query(
        `
          insert into order_lines
            (order_id, item_code, item_name, unit, model, qty)
          values
            ($1, $2, $3, $4, $5, $6)
        `,
        [orderId, item.code, item.name, item.unit, item.model || "", Number(payload.qty || 0)]
      );
    }

    await client.query("commit");
    const lines = await getOrderLines(orderId);
    res.json({ orderId, orderCode, lines });
  } catch (error) {
    await client.query("rollback");
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

app.delete("/api/orders/line/:lineId", authRequired, async (req, res) => {
  try {
    const lineRows = await query(
      `
        delete from order_lines
        where id = $1
        returning order_id
      `,
      [req.params.lineId]
    );

    const orderId = lineRows[0] ? lineRows[0].order_id : null;
    const lines = orderId ? await getOrderLines(orderId) : [];
    res.json({ lines });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/orders/confirm", authRequired, async (req, res) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    const orderCode = String(req.body.orderCode || "").trim();
    if (!orderId && !orderCode) {
      return res.status(400).json({ message: "بيانات الطلبية غير مكتملة للتأكيد." });
    }

    const rows = await query(
      `
        update orders
        set status = 'confirmed',
            confirmed_at = now()
        where ($1 <> '' and id::text = $1)
           or ($2 <> '' and order_code = $2)
        returning id, order_code, status, confirmed_at
      `,
      [orderId, orderCode]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "لم يتم العثور على الطلبية لتأكيدها." });
    }

    res.json({ success: true, order: rows[0] || null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/orders/location", authRequired, async (req, res) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    const orderCode = String(req.body.orderCode || "").trim();
    if (!orderId && !orderCode) {
      return res.status(400).json({ message: "بيانات الطلبية غير مكتملة لتحديث الموقع." });
    }

    const rows = await query(
      `
        update orders
        set lat = $3,
            lng = $4,
            arabic_address = $5,
            map_url = $6
        where (($1 <> '' and id::text = $1) or ($2 <> '' and order_code = $2))
        returning id, order_code, lat, lng, arabic_address, map_url
      `,
      [
        orderId,
        orderCode,
        req.body.lat || null,
        req.body.lng || null,
        req.body.arabicAddress || "",
        req.body.mapUrl || ""
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "لم يتم العثور على الطلبية لتحديث موقعها." });
    }

    res.json({ success: true, order: rows[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/orders/cancel", authRequired, async (req, res) => {
  try {
    const orderId = String(req.body.orderId || "").trim();
    const orderCode = String(req.body.orderCode || "").trim();
    if (!orderId && !orderCode) {
      return res.status(400).json({ message: "بيانات الطلبية غير مكتملة للإلغاء." });
    }

    const rows = await query(
      `
        update orders
        set status = 'cancelled',
            cancelled_at = now()
        where ($1 <> '' and id::text = $1)
           or ($2 <> '' and order_code = $2)
        returning id, order_code, status, cancelled_at
      `,
      [orderId, orderCode]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "لم يتم العثور على الطلبية لإلغائها." });
    }

    res.json({ success: true, order: rows[0] || null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/orders", authRequired, async (req, res) => {
  try {
    const values = [];
    const where = [];

    if (req.query.from) {
      values.push(req.query.from + "T00:00:00");
      where.push(`created_at >= $${values.length}`);
    }
    if (req.query.to) {
      values.push(req.query.to + "T23:59:59");
      where.push(`created_at <= $${values.length}`);
    }
    if (req.query.rep) {
      values.push(req.query.rep);
      where.push(`rep = $${values.length}`);
    }

    const sql = `
      select id, order_code, customer_name, rep, status, address, arabic_address, lat, lng, map_url, created_at
      from orders
      ${where.length ? "where " + where.join(" and ") : ""}
      order by created_at desc
    `;

    const summarySql = `
      select rep, count(*)::int as orders_count
      from orders
      ${where.length ? "where " + where.join(" and ") : ""}
      group by rep
      order by orders_count desc, rep asc
    `;

    const [orders, summaryByRep] = await Promise.all([query(sql, values), query(summarySql, values)]);
    res.json({ orders, summaryByRep });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/orders/:orderCode", authRequired, async (req, res) => {
  try {
    const orders = await query(
      `
        select *
        from orders
        where order_code = $1
        limit 1
      `,
      [req.params.orderCode]
    );

    if (!orders.length) {
      return res.status(404).json({ message: "الطلبية غير موجودة." });
    }

    const lines = await getOrderLines(orders[0].id);
    res.json({ order: orders[0], lines });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/screen-access", authRequired, async (req, res) => {
  try {
    const rows = await query(
      `
        select value
        from portal_settings
        where key = $1
        limit 1
      `,
      [`${req.body.scope}_password`]
    );

    if (!rows.length || rows[0].value !== String(req.body.password || "")) {
      return res.status(401).json({ message: "كلمة المرور غير صحيحة." });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/dashboard", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const values = [];
    const visitWhere = [];
    const collectionWhere = [];
    const orderWhere = [];

    if (payload.from) {
      values.push(payload.from);
      visitWhere.push(`created_at::date >= $${values.length}`);
      collectionWhere.push(`created_at::date >= $${values.length}`);
      orderWhere.push(`created_at::date >= $${values.length}`);
    }
    if (payload.to) {
      values.push(payload.to);
      visitWhere.push(`created_at::date <= $${values.length}`);
      collectionWhere.push(`created_at::date <= $${values.length}`);
      orderWhere.push(`created_at::date <= $${values.length}`);
    }
    if (payload.rep) {
      values.push(payload.rep);
      visitWhere.push(`rep = $${values.length}`);
      collectionWhere.push(`rep = $${values.length}`);
      orderWhere.push(`rep = $${values.length}`);
    }
    if (payload.payKind) {
      values.push(payload.payKind);
      collectionWhere.push(`collection_type = $${values.length}`);
    }

    const repClauseForOrderLines = orderWhere.length
      ? "where " +
        orderWhere
          .map((clause) => clause.replaceAll("created_at", "o.created_at").replaceAll("rep =", "o.rep ="))
          .join(" and ")
      : "";
    const movementValues = [];
    const movementWhere = [];

    if (payload.from) {
      movementValues.push(payload.from);
      movementWhere.push(`created_at::date >= $${movementValues.length}`);
    }
    if (payload.to) {
      movementValues.push(payload.to);
      movementWhere.push(`created_at::date <= $${movementValues.length}`);
    }
    if (payload.rep) {
      movementValues.push(payload.rep);
      movementWhere.push(`rep = $${movementValues.length}`);
    }

    const movementVisitsWhere = movementWhere.join(" and ");
    const movementCollectionsWhere = [
      movementVisitsWhere,
      payload.payKind ? `collection_type = $${movementValues.push(payload.payKind)}` : ""
    ]
      .filter(Boolean)
      .join(" and ");

    const [
      visitRows,
      collectionRows,
      orderRows,
      dailyOrders,
      dailyCollections,
      ordersByRep,
      collectionsByType,
      visitsByRep,
      collectionsByRep,
      topCustomers,
      topItems,
      latestOrders,
      latestCollections,
      movementRows
    ] =
      await Promise.all([
        query(
          `
            select count(*)::int as count
            from visits
            ${visitWhere.length ? "where " + visitWhere.join(" and ") : ""}
          `,
          values
        ),
        query(
          `
            select count(*)::int as count, coalesce(sum(amount), 0)::numeric as total
            from collections
            ${collectionWhere.length ? "where " + collectionWhere.join(" and ") : ""}
          `,
          values
        ),
        query(
          `
            select
              count(*)::int as total,
              count(*) filter (where status = 'confirmed')::int as confirmed,
              count(*) filter (where status = 'cancelled')::int as cancelled,
              count(*) filter (where status = 'draft')::int as draft
            from orders
            ${orderWhere.length ? "where " + orderWhere.join(" and ") : ""}
          `,
          values
        ),
        query(
          `
            select to_char(created_at::date, 'YYYY-MM-DD') as day, count(*)::int as total
            from orders
            ${orderWhere.length ? "where " + orderWhere.join(" and ") : ""}
            group by created_at::date
            order by created_at::date asc
          `,
          values
        ),
        query(
          `
            select to_char(created_at::date, 'YYYY-MM-DD') as day, coalesce(sum(amount), 0)::numeric as total
            from collections
            ${collectionWhere.length ? "where " + collectionWhere.join(" and ") : ""}
            group by created_at::date
            order by created_at::date asc
          `,
          values
        ),
        query(
          `
            select rep, count(*)::int as total
            from orders
            ${orderWhere.length ? "where " + orderWhere.join(" and ") : ""}
            group by rep
            order by total desc
          `,
          values
        ),
        query(
          `
            select collection_type as label, count(*)::int as total
            from collections
            ${collectionWhere.length ? "where " + collectionWhere.join(" and ") : ""}
            group by collection_type
            order by total desc
          `,
          values
        ),
        query(
          `
            select rep, count(*)::int as total
            from visits
            ${visitWhere.length ? "where " + visitWhere.join(" and ") : ""}
            group by rep
            order by total desc
          `,
          values
        ),
        query(
          `
            select rep, coalesce(sum(amount), 0)::numeric as total
            from collections
            ${collectionWhere.length ? "where " + collectionWhere.join(" and ") : ""}
            group by rep
            order by total desc
          `,
          values
        ),
        query(
          `
            select customer_name as label, count(*)::int as total
            from orders
            ${orderWhere.length ? "where " + orderWhere.join(" and ") : ""}
            group by customer_name
            order by total desc, customer_name asc
            limit 7
          `,
          values
        ),
        query(
          `
            select ol.item_name as label, coalesce(sum(ol.qty), 0)::numeric as total
            from order_lines ol
            join orders o on o.id = ol.order_id
            ${repClauseForOrderLines}
            group by ol.item_name
            order by total desc, ol.item_name asc
            limit 7
          `,
          values
        ),
        query(
          `
            select order_code, customer_name, rep, status, created_at
            from orders
            ${orderWhere.length ? "where " + orderWhere.join(" and ") : ""}
            order by created_at desc
            limit 6
          `,
          values
        ),
        query(
          `
            select customer_name, rep, amount, collection_type, created_at
            from collections
            ${collectionWhere.length ? "where " + collectionWhere.join(" and ") : ""}
            order by created_at desc
            limit 6
          `,
          values
        ),
        query(
          `
            select
              rep,
              customer_name,
              created_at,
              'visit' as movement_type,
              0::numeric as amount,
              lat,
              lng,
              coalesce(arabic_address, address, '') as arabic_address,
              map_url
            from visits
            ${movementVisitsWhere ? "where " + movementVisitsWhere : ""}
            union all
            select
              rep,
              customer_name,
              created_at,
              'collection' as movement_type,
              amount,
              lat,
              lng,
              coalesce(arabic_address, address, '') as arabic_address,
              map_url
            from collections
            ${movementCollectionsWhere ? "where " + movementCollectionsWhere : ""}
            union all
            select
              rep,
              customer_name,
              created_at,
              'order' as movement_type,
              0::numeric as amount,
              lat,
              lng,
              coalesce(arabic_address, address, '') as arabic_address,
              map_url
            from orders
            ${movementVisitsWhere ? "where " + movementVisitsWhere : ""}
            order by created_at asc
          `,
          movementValues
        )
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

    res.json({
      visitsCount,
      collectionsCount,
      collectionsTotal,
      ordersCount,
      confirmedOrders,
      cancelledOrders,
      draftOrders,
      averageCollection,
      orderConfirmationRate,
      dailyOrders,
      dailyCollections: dailyCollections.map((row) => ({ day: row.day, total: Number(row.total) })),
      ordersByRep,
      collectionsByType,
      visitsByRep,
      collectionsByRep: collectionsByRep.map((row) => ({ rep: row.rep, total: Number(row.total) })),
      topCustomers,
      topItems: topItems.map((row) => ({ label: row.label, total: Number(row.total) })),
      latestOrders,
      latestCollections: latestCollections.map((row) => ({ ...row, amount: Number(row.amount) })),
      movementRows: movementRows.map((row) => ({
        rep: row.rep,
        customer_name: row.customer_name,
        created_at: row.created_at,
        movement_type: row.movement_type,
        amount: Number(row.amount || 0),
        lat: row.lat,
        lng: row.lng,
        arabic_address: row.arabic_address,
        map_url: row.map_url
      })),
      statusBreakdown: [
        { label: "Confirmed", total: confirmedOrders },
        { label: "Draft", total: draftOrders },
        { label: "Cancelled", total: cancelledOrders }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/field-movements", authRequired, async (req, res) => {
  try {
    const payload = req.body || {};
    const movementValues = [];
    const movementWhere = [];

    if (payload.from) {
      movementValues.push(payload.from);
      movementWhere.push(`created_at::date >= $${movementValues.length}`);
    }
    if (payload.to) {
      movementValues.push(payload.to);
      movementWhere.push(`created_at::date <= $${movementValues.length}`);
    }
    if (payload.rep) {
      movementValues.push(payload.rep);
      movementWhere.push(`rep = $${movementValues.length}`);
    }

    const visitsWhere = movementWhere.join(" and ");
    const collectionsWhereParts = [...movementWhere];
    if (payload.payKind) {
      movementValues.push(payload.payKind);
      collectionsWhereParts.push(`collection_type = $${movementValues.length}`);
    }
    const collectionsWhere = collectionsWhereParts.join(" and ");

    const movementRows = await query(
      `
        select
          id::text as movement_id,
          rep,
          customer_name,
          created_at,
          'visit' as movement_type,
          0::numeric as amount,
          ''::text as cheque_number,
          ''::text as bank_name,
          null::date as due_date,
          false as has_cheque_image,
          lat,
          lng,
          coalesce(arabic_address, address, '') as arabic_address,
          map_url
        from visits
        ${visitsWhere ? "where " + visitsWhere : ""}
        union all
        select
          id::text as movement_id,
          rep,
          customer_name,
          created_at,
          'collection' as movement_type,
          amount,
          cheque_number,
          bank_name,
          due_date,
          (cheque_image <> '') as has_cheque_image,
          lat,
          lng,
          coalesce(arabic_address, address, '') as arabic_address,
          map_url
        from collections
        ${collectionsWhere ? "where " + collectionsWhere : ""}
        union all
        select
          id::text as movement_id,
          rep,
          customer_name,
          created_at,
          'order' as movement_type,
          0::numeric as amount,
          ''::text as cheque_number,
          ''::text as bank_name,
          null::date as due_date,
          false as has_cheque_image,
          lat,
          lng,
          coalesce(arabic_address, address, '') as arabic_address,
          map_url
        from orders
        ${visitsWhere ? "where " + visitsWhere : ""}
        order by created_at asc
      `,
      movementValues
    );

    res.json({
      movementRows: movementRows.map((row) => ({
        movement_id: row.movement_id,
        rep: row.rep,
        customer_name: row.customer_name,
        created_at: row.created_at,
        movement_type: row.movement_type,
        amount: Number(row.amount || 0),
        cheque_number: row.cheque_number || "",
        bank_name: row.bank_name || "",
        due_date: row.due_date,
        has_cheque_image: Boolean(row.has_cheque_image),
        lat: row.lat,
        lng: row.lng,
        arabic_address: row.arabic_address,
        map_url: row.map_url
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/home-summary", authRequired, async (_req, res) => {
  try {
    const [countsRows, recentOrders, recentCollections] = await Promise.all([
      query(
        `
          select
            (select count(*)::int from customers) as customers_count,
            (select count(*)::int from items) as items_count,
            (select count(*)::int from orders) as orders_count,
            (select count(*)::int from orders where status = 'confirmed') as confirmed_orders,
            (select count(*)::int from visits where created_at::date = current_date) as visits_today,
            (select coalesce(sum(amount), 0)::numeric from collections where created_at::date = current_date) as collections_today
        `
      ),
      query(
        `
          select order_code, customer_name, status, created_at
          from orders
          order by created_at desc
          limit 5
        `
      ),
      query(
        `
          select customer_name, amount, collection_type, created_at
          from collections
          order by created_at desc
          limit 4
        `
      )
    ]);

    res.json({
      metrics: countsRows[0] || {},
      recentOrders,
      recentCollections
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Embrator web server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize schema", error);
    process.exit(1);
  });
