const { Pool } = require("pg");

let pool = null;
let useMemory = false;
const memoryReservations = [];

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
      visitDay: data.visitDay,
      createdAt: new Date().toISOString(),
    };
    memoryReservations.push(reservation);
    return reservation;
  }

  const result = await pool.query(
    `INSERT INTO reservations (name, phone, visit_day)
     VALUES ($1, $2, $3)
     RETURNING id, name, phone, visit_day, created_at`,
    [data.name, data.phone, data.visitDay]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    visitDay: row.visit_day,
    createdAt: row.created_at,
  };
}

async function listReservations() {
  if (useMemory) {
    return memoryReservations.slice().reverse();
  }

  const result = await pool.query(
    `SELECT id, name, phone, visit_day, created_at
     FROM reservations
     ORDER BY created_at DESC, id DESC`
  );
  return result.rows.map(function (row) {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      visitDay: row.visit_day,
      createdAt: row.created_at,
    };
  });
}

module.exports = {
  initDatabase,
  pingDatabase,
  createReservation,
  listReservations,
};
