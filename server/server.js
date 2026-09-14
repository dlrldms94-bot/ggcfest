const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "..");
const VISIT_DAYS = ["10월 16일 (금)", "10월 17일 (토)", "10월 18일 (일)"];

app.use(express.json({ limit: "32kb" }));

function handleAsync(handler) {
  return function (req, res) {
    Promise.resolve(handler(req, res)).catch(function (error) {
      console.error(error);
      res.status(500).json({ message: "서버 오류가 발생했습니다." });
    });
  };
}

function normalizeName(value) {
  return String(value || "").trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhone(digits) {
  if (digits.length === 11) {
    return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
  }
  if (digits.length === 10) {
    return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  }
  return digits;
}

app.get(
  "/api/health",
  handleAsync(async function (req, res) {
    const dbStatus = await db.pingDatabase();
    res.json({ ok: true, db: dbStatus.mode });
  })
);

app.post(
  "/api/reservations",
  handleAsync(async function (req, res) {
    const name = normalizeName(req.body && req.body.name);
    const phone = normalizePhone(req.body && req.body.phone);
    const visitDay = String((req.body && req.body.day) || "").trim();

    if (!name) {
      return res.status(400).json({ message: "이름을 입력해 주세요." });
    }
    if (phone.length < 10 || phone.length > 11) {
      return res.status(400).json({ message: "연락처를 확인해 주세요." });
    }
    if (VISIT_DAYS.indexOf(visitDay) === -1) {
      return res.status(400).json({ message: "방문 희망일을 선택해 주세요." });
    }

    const reservation = await db.createReservation({
      name: name,
      phone: formatPhone(phone),
      visitDay: visitDay,
    });

    res.status(201).json({ ok: true, id: reservation.id });
  })
);

function readAdminKey(req) {
  const header = String(req.get("x-admin-key") || "").trim();
  if (header) return header;
  const auth = String(req.get("authorization") || "");
  if (auth.toLowerCase().indexOf("bearer ") === 0) {
    return auth.slice(7).trim();
  }
  return String((req.query && req.query.key) || "").trim();
}

function requireAdmin(req, res, next) {
  const expected = String(process.env.ADMIN_KEY || "").trim();
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ message: "관리자 키가 설정되지 않았습니다." });
    }
    return next();
  }
  if (readAdminKey(req) !== expected) {
    return res.status(401).json({ message: "관리자 비밀번호를 확인해 주세요." });
  }
  next();
}

app.get(
  "/api/reservations",
  requireAdmin,
  handleAsync(async function (req, res) {
    const items = await db.listReservations();
    res.json({ ok: true, total: items.length, items: items });
  })
);

app.use(express.static(ROOT));

async function start() {
  await db.initDatabase();
  app.listen(PORT, function () {
    console.log("관악강감찬축제 서버: http://localhost:" + PORT);
  });
}

start().catch(function (error) {
  console.error("서버 시작 실패:", error);
  process.exit(1);
});
