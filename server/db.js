const { Pool } = require("pg");

let pool = null;
let useMemory = false;
const memoryReservations = [];
const memoryGuestbookEntries = [];

async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    useMemory = true;
    console.log("[db] DATABASE_URL 없음 — 메모리 모드 (로컬 개발)");
    return;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      visit_day TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS birth_date TEXT
  `);
  await pool.query(`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS program TEXT
  `);
  await pool.query(`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS privacy_agreed BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guestbook_entries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("[db] PostgreSQL 연결 완료");
}

async function pingDatabase() {
  if (useMemory) return { mode: "memory" };
  await pool.query("SELECT 1");
  return { mode: "postgres" };
}

async function createReservation(data) {
  if (useMemory) {
    const reservation = {
      id: memoryReservations.length + 1,
      name: data.name,
      phone: data.phone,
      birthDate: data.birthDate,
      visitDay: data.visitDay,
      program: data.program,
      privacyAgreed: data.privacyAgreed === true,
      createdAt: new Date().toISOString(),
    };
    memoryReservations.push(reservation);
    return reservation;
  }

  const result = await pool.query(
    `INSERT INTO reservations (name, phone, birth_date, visit_day, program, privacy_agreed)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, phone, birth_date, visit_day, program, privacy_agreed, created_at`,
    [data.name, data.phone, data.birthDate, data.visitDay, data.program, data.privacyAgreed === true]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    birthDate: row.birth_date,
    visitDay: row.visit_day,
    program: row.program,
    privacyAgreed: row.privacy_agreed === true,
    createdAt: row.created_at,
  };
}

async function listReservations() {
  if (useMemory) {
    return memoryReservations.slice().reverse();
  }

  const result = await pool.query(
    `SELECT id, name, phone, birth_date, visit_day, program, privacy_agreed, created_at
     FROM reservations
     ORDER BY created_at DESC, id DESC`
  );
  return result.rows.map(function (row) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      birthDate: row.birth_date || "",
      visitDay: row.visit_day,
      program: row.program || "",
      privacyAgreed: row.privacy_agreed === true,
      createdAt: row.created_at,
    };
  });
}

async function createGuestbookEntry(data) {
  if (useMemory) {
    const entry = {
      id: memoryGuestbookEntries.reduce(function (max, item) {
        return Math.max(max, item.id);
      }, 0) + 1,
      name: data.name,
      message: data.message,
      createdAt: new Date().toISOString(),
    };
    memoryGuestbookEntries.push(entry);
    return entry;
  }

  const result = await pool.query(
    `INSERT INTO guestbook_entries (name, message)
     VALUES ($1, $2)
     RETURNING id, name, message, created_at`,
    [data.name, data.message]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    createdAt: row.created_at,
  };
}

async function listGuestbookEntries(options) {
  const limit = options.limit;
  const page = options.page;
  const offset = (page - 1) * limit;

  if (useMemory) {
    const filtered = memoryGuestbookEntries
      .slice()
      .reverse();
    const items = filtered.slice(offset, offset + limit);
    return {
      items: items,
      page: page,
      total: memoryGuestbookEntries.length,
    };
  }

  const results = await Promise.all([
    pool.query(
      `SELECT id, name, message, created_at
       FROM guestbook_entries
       ORDER BY id DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query("SELECT COUNT(*)::int AS total FROM guestbook_entries"),
  ]);
  const result = results[0];
  const rows = result.rows.slice(0, limit);
  return {
    items: rows.map(function (row) {
      return {
        id: row.id,
        name: row.name,
        message: row.message,
        createdAt: row.created_at,
      };
    }),
    page: page,
    total: results[1].rows[0].total,
  };
}

async function listAllGuestbookEntries() {
  if (useMemory) {
    return memoryGuestbookEntries.slice().reverse();
  }

  const result = await pool.query(
    `SELECT id, name, message, created_at
     FROM guestbook_entries
     ORDER BY id DESC`
  );
  return result.rows.map(function (row) {
    return {
      id: row.id,
      name: row.name,
      message: row.message,
      createdAt: row.created_at,
    };
  });
}

async function deleteGuestbookEntry(id) {
  if (useMemory) {
    const index = memoryGuestbookEntries.findIndex(function (entry) {
      return entry.id === id;
    });
    if (index === -1) return false;
    memoryGuestbookEntries.splice(index, 1);
    return true;
  }

  const result = await pool.query(
    "DELETE FROM guestbook_entries WHERE id = $1 RETURNING id",
    [id]
  );
  return result.rowCount > 0;
}

module.exports = {
  initDatabase,
  pingDatabase,
  createReservation,
  listReservations,
  createGuestbookEntry,
  listGuestbookEntries,
  listAllGuestbookEntries,
  deleteGuestbookEntry,
};
