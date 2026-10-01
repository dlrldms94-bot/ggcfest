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
  await pool.query(`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS birth_date TEXT
  `);
  await pool.query(`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS program TEXT
  `);
  await pool.query(`
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS privacy_agreed BOOLEAN NOT NULL DEFAULT FALSE
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

module.exports = {
  initDatabase,
  pingDatabase,
  createReservation,
  listReservations,
};
