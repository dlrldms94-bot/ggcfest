const { Pool } = require("pg");

let pool = null;
let useMemory = false;
const memoryReservations = [];
const memoryGuestbookEntries = [];
const memoryVisitDays = {};
const memoryVisitKeysByDay = {};
const memoryVisitKeys = new Set();
const memoryPathDays = {};
const memoryPathKeysByDay = {};

function seoulDate(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(value || new Date());
}

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_visits (
      visit_date DATE PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0,
      uniques INTEGER NOT NULL DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_visit_uniques (
      visit_date DATE NOT NULL,
      visitor_key TEXT NOT NULL,
      PRIMARY KEY (visit_date, visitor_key)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_path_visits (
      visit_date DATE NOT NULL,
      page_path TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      uniques INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (visit_date, page_path)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_path_uniques (
      visit_date DATE NOT NULL,
      page_path TEXT NOT NULL,
      visitor_key TEXT NOT NULL,
      PRIMARY KEY (visit_date, page_path, visitor_key)
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

function emptyVisitDay(date) {
  return { date: date, views: 0, uniques: 0 };
}

function mapVisitDay(row) {
  return {
    date: row.visit_date instanceof Date
      ? seoulDate(row.visit_date)
      : String(row.visit_date).slice(0, 10),
    views: Number(row.views) || 0,
    uniques: Number(row.uniques) || 0,
  };
}

function mapPathDay(row) {
  return {
    date: row.visit_date instanceof Date
      ? seoulDate(row.visit_date)
      : String(row.date || row.visit_date).slice(0, 10),
    page: row.page || row.page_path,
    views: Number(row.views) || 0,
    uniques: Number(row.uniques) || 0,
  };
}

function pathDaysFromMemory() {
  return Object.keys(memoryPathDays)
    .map(function (key) { return memoryPathDays[key]; })
    .sort(function (a, b) {
      if (a.date === b.date) return a.page < b.page ? -1 : 1;
      return a.date < b.date ? 1 : -1;
    });
}

async function recordPageVisit(visitorKey, pagePath) {
  const date = seoulDate();
  const pathKey = date + "|" + pagePath;

  if (useMemory) {
    if (!memoryVisitDays[date]) memoryVisitDays[date] = emptyVisitDay(date);
    memoryVisitDays[date].views += 1;
    if (visitorKey) {
      if (!memoryVisitKeysByDay[date]) memoryVisitKeysByDay[date] = new Set();
      if (!memoryVisitKeysByDay[date].has(visitorKey)) {
        memoryVisitKeysByDay[date].add(visitorKey);
        memoryVisitDays[date].uniques += 1;
      }
      memoryVisitKeys.add(visitorKey);
    }
    if (!memoryPathDays[pathKey]) {
      memoryPathDays[pathKey] = { date: date, page: pagePath, views: 0, uniques: 0 };
    }
    memoryPathDays[pathKey].views += 1;
    if (visitorKey) {
      if (!memoryPathKeysByDay[pathKey]) memoryPathKeysByDay[pathKey] = new Set();
      if (!memoryPathKeysByDay[pathKey].has(visitorKey)) {
        memoryPathKeysByDay[pathKey].add(visitorKey);
        memoryPathDays[pathKey].uniques += 1;
      }
    }
    return memoryVisitDays[date];
  }

  const uniqueResult = visitorKey
    ? await pool.query(
        `INSERT INTO page_visit_uniques (visit_date, visitor_key)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING visitor_key`,
        [date, visitorKey]
      )
    : { rowCount: 0 };
  const isNewUnique = uniqueResult.rowCount > 0;
  const pathUniqueResult = visitorKey
    ? await pool.query(
        `INSERT INTO page_path_uniques (visit_date, page_path, visitor_key)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING visitor_key`,
        [date, pagePath, visitorKey]
      )
    : { rowCount: 0 };
  const isNewPathUnique = pathUniqueResult.rowCount > 0;

  await Promise.all([
    pool.query(
      `INSERT INTO page_visits (visit_date, views, uniques)
       VALUES ($1, 1, $2)
       ON CONFLICT (visit_date) DO UPDATE SET
         views = page_visits.views + 1,
         uniques = page_visits.uniques + EXCLUDED.uniques`,
      [date, isNewUnique ? 1 : 0]
    ),
    pool.query(
      `INSERT INTO page_path_visits (visit_date, page_path, views, uniques)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (visit_date, page_path) DO UPDATE SET
         views = page_path_visits.views + 1,
         uniques = page_path_visits.uniques + EXCLUDED.uniques`,
      [date, pagePath, isNewPathUnique ? 1 : 0]
    ),
  ]);
  return { date: date };
}

async function getVisitStats() {
  const today = seoulDate();

  if (useMemory) {
    const days = Object.keys(memoryVisitDays)
      .sort()
      .reverse()
      .map(function (date) {
        return {
          date: date,
          views: memoryVisitDays[date].views,
          uniques: memoryVisitDays[date].uniques,
        };
      });
    const totals = days.reduce(
      function (sum, item) {
        sum.views += item.views;
        return sum;
      },
      { views: 0 }
    );
    return {
      today: memoryVisitDays[today] || emptyVisitDay(today),
      total: { views: totals.views, uniques: memoryVisitKeys.size },
      pathDays: pathDaysFromMemory(),
      days: days,
    };
  }

  const results = await Promise.all([
    pool.query(
      `SELECT visit_date, views, uniques
       FROM page_visits
       WHERE visit_date = $1`,
      [today]
    ),
    pool.query(
      `SELECT COALESCE(SUM(views), 0)::int AS views
       FROM page_visits`
    ),
    pool.query("SELECT COUNT(DISTINCT visitor_key)::int AS uniques FROM page_visit_uniques"),
    pool.query(
      `SELECT visit_date, views, uniques
       FROM page_visits
       ORDER BY visit_date DESC`
    ),
    pool.query(
      `SELECT visit_date, page_path AS page, views, uniques
       FROM page_path_visits
       ORDER BY visit_date DESC, page_path ASC`
    ),
  ]);
  const days = results[3].rows.map(mapVisitDay);

  return {
    today: results[0].rows[0] ? mapVisitDay(results[0].rows[0]) : emptyVisitDay(today),
    total: {
      views: results[1].rows[0].views,
      uniques: results[2].rows[0].uniques,
    },
    pathDays: results[4].rows.map(mapPathDay),
    days: days,
  };
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
  recordPageVisit,
  getVisitStats,
};
