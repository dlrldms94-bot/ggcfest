const crypto = require("crypto");
const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "..");
const { VISIT_DAYS, PROGRAMS } = require("./reservation-options");
const guestbookAttempts = new Map();
const visitAttempts = new Map();
const GUESTBOOK_WINDOW_MS = 10 * 60 * 1000;
const GUESTBOOK_MAX_WRITES = 5;
const VISIT_WINDOW_MS = 10 * 60 * 1000;
const VISIT_MAX_HITS = 60;
const PAGE_PATHS = {
  home: "메인 홈페이지",
  guide: "스마트 가이드 홈",
  "guide-programs": "스마트 가이드 · 프로그램 지도",
  "guide-facilities": "스마트 가이드 · 편의시설",
  "guide-textsize": "스마트 가이드 · 큰글씨 모드",
  "guide-docent": "AI 스마트 도슨트",
  "guide-docent-anguksa": "도슨트 · 안국사",
  "guide-docent-main-plaza": "도슨트 · 대광장",
  "guide-docent-central-plaza": "도슨트 · 중광장",
  "guide-docent-open-yard": "도슨트 · 열린마당",
  "guide-docent-flower-garden": "도슨트 · 낙성꽃뜰정원",
};

app.use(express.json({ limit: "32kb" }));
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

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

function normalizeBirth(value) {
  return String(value || "").trim();
}

function isValidBirth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00");
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (date > now) return false;
  const year = date.getFullYear();
  return year >= 1900 && year <= now.getFullYear();
}

function normalizeChoices(value, allowed) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = {};
  const chosen = [];
  for (let i = 0; i < list.length; i += 1) {
    const name = String(list[i] || "").trim();
    if (!name || seen[name]) continue;
    if (allowed.indexOf(name) === -1) return null;
    seen[name] = true;
    chosen.push(name);
  }
  return chosen;
}

function normalizeGuestbookText(value, multiline) {
  let text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (multiline) {
    text = text
      .split("\n")
      .map(function (line) { return line.trim().replace(/[ \t]+/g, " "); })
      .filter(Boolean)
      .join("\n");
  } else {
    text = text.replace(/\s+/g, " ");
  }
  return text;
}

function visitRateLimited(req) {
  const now = Date.now();
  const key = String(req.ip || req.socket.remoteAddress || "unknown");
  const recent = (visitAttempts.get(key) || []).filter(function (time) {
    return now - time < VISIT_WINDOW_MS;
  });
  if (recent.length >= VISIT_MAX_HITS) {
    visitAttempts.set(key, recent);
    return true;
  }
  recent.push(now);
  visitAttempts.set(key, recent);
  return false;
}

function isVisitBot(req) {
  const ua = String(req.get("user-agent") || "").toLowerCase();
  if (!ua) return true;
  return /(bot|crawler|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python-requests|ahrefs|semrush)/i.test(ua);
}

function hashVisitorId(value) {
  const raw = String(value || "").trim();
  if (!/^[A-Za-z0-9._-]{8,80}$/.test(raw)) return "";
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function normalizePagePath(value) {
  const raw = String(value || "").trim().replace(/^https?:\/\/[^/]+/i, "");
  const pieces = raw.split("#");
  let pathname = String(pieces[0] || "").split("?")[0].toLowerCase();
  pathname = pathname.replace(/\/index\.html$/, "");
  pathname = pathname.replace(/\/+$/, "") || "/";
  const hash = String(pieces[1] || "").split("/")[0].split("?")[0].toLowerCase();
  if (pathname === "/") return "home";
  if (pathname === "/guide") {
    if (hash === "programs") return "guide-programs";
    if (hash === "facilities") return "guide-facilities";
    if (hash === "textsize") return "guide-textsize";
    return "guide";
  }
  if (pathname === "/guide/docent") return "guide-docent";
  if (pathname === "/guide/docent/anguksa.html") return "guide-docent-anguksa";
  if (pathname === "/guide/docent/main-plaza.html") return "guide-docent-main-plaza";
  if (pathname === "/guide/docent/central-plaza.html") return "guide-docent-central-plaza";
  if (pathname === "/guide/docent/open-yard.html") return "guide-docent-open-yard";
  if (pathname === "/guide/docent/flower-garden.html") return "guide-docent-flower-garden";
  return "";
}

function guestbookRateLimited(req) {
  const now = Date.now();
  const key = String(req.ip || req.socket.remoteAddress || "unknown");
  const recent = (guestbookAttempts.get(key) || []).filter(function (time) {
    return now - time < GUESTBOOK_WINDOW_MS;
  });
  if (recent.length >= GUESTBOOK_MAX_WRITES) {
    guestbookAttempts.set(key, recent);
    return true;
  }
  recent.push(now);
  guestbookAttempts.set(key, recent);
  return false;
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
    const birthDate = normalizeBirth(req.body && req.body.birth);
    const visitDays = normalizeChoices(req.body && req.body.day, VISIT_DAYS);
    const programs = normalizeChoices(req.body && req.body.program, PROGRAMS);

    if (!name) {
      return res.status(400).json({ message: "이름을 입력해 주세요." });
    }
    if (phone.length < 10 || phone.length > 11) {
      return res.status(400).json({ message: "연락처를 확인해 주세요." });
    }
    if (!isValidBirth(birthDate)) {
      return res.status(400).json({ message: "생년월일을 확인해 주세요." });
    }
    if (!visitDays) {
      return res.status(400).json({ message: "방문 희망일을 확인해 주세요." });
    }
    if (!visitDays.length) {
      return res.status(400).json({ message: "방문 희망일을 하나 이상 선택해 주세요." });
    }
    if (!programs) {
      return res.status(400).json({ message: "참여 예정 프로그램을 확인해 주세요." });
    }
    if (!programs.length) {
      return res.status(400).json({ message: "참여 예정 프로그램을 하나 이상 선택해 주세요." });
    }
    if (!req.body || req.body.privacy !== true) {
      return res.status(400).json({ message: "개인정보 수집·이용에 동의해 주세요." });
    }

    const reservation = await db.createReservation({
      name: name,
      phone: formatPhone(phone),
      birthDate: birthDate,
      visitDay: visitDays.join(", "),
      program: programs.join(", "),
      privacyAgreed: true,
    });

    res.status(201).json({ ok: true, id: reservation.id });
  })
);

app.get(
  "/api/guestbook",
  handleAsync(async function (req, res) {
    const rawLimit = Number.parseInt(req.query && req.query.limit, 10);
    const rawPage = Number.parseInt(req.query && req.query.page, 10);
    const limit = Number.isInteger(rawLimit) ? Math.min(12, Math.max(1, rawLimit)) : 6;
    const requestedPage = Number.isInteger(rawPage) ? Math.min(100000, Math.max(1, rawPage)) : 1;
    const result = await db.listGuestbookEntries({ limit: limit, page: requestedPage });
    const totalPages = Math.max(1, Math.ceil(result.total / limit));
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      items: result.items,
      total: result.total,
      page: requestedPage,
      totalPages: totalPages,
    });
  })
);

app.post(
  "/api/visits",
  handleAsync(async function (req, res) {
    if (isVisitBot(req) || visitRateLimited(req)) {
      return res.status(204).end();
    }
    const visitorKey = hashVisitorId(req.body && req.body.visitorId);
    const pagePath = normalizePagePath(req.body && req.body.page);
    if (!pagePath) {
      return res.status(204).end();
    }
    await db.recordPageVisit(visitorKey, pagePath);
    res.status(204).end();
  })
);

app.post(
  "/api/guestbook",
  handleAsync(async function (req, res) {
    if (req.body && String(req.body.website || "").trim()) {
      return res.status(201).json({ ok: true });
    }
    const name = normalizeGuestbookText(req.body && req.body.name, false);
    const message = normalizeGuestbookText(req.body && req.body.message, true);
    if (!name || Array.from(name).length > 12) {
      return res.status(400).json({ message: "이름은 12자 이내로 입력해 주세요." });
    }
    if (!message || Array.from(message).length > 200) {
      return res.status(400).json({ message: "방명록은 200자 이내로 입력해 주세요." });
    }
    if (!req.body || req.body.publicAgreed !== true) {
      return res.status(400).json({ message: "방명록 공개에 동의해 주세요." });
    }
    if (guestbookRateLimited(req)) {
      return res.status(429).json({ message: "잠시 후 다시 작성해 주세요." });
    }

    const entry = await db.createGuestbookEntry({ name: name, message: message });
    res.status(201).json({ ok: true, item: entry });
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

app.get(
  "/api/admin/guestbook",
  requireAdmin,
  handleAsync(async function (req, res) {
    const items = await db.listAllGuestbookEntries();
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, total: items.length, items: items });
  })
);

app.get(
  "/api/admin/visits",
  requireAdmin,
  handleAsync(async function (req, res) {
    const stats = await db.getVisitStats();
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      today: stats.today,
      total: stats.total,
      pathDays: stats.pathDays,
      days: stats.days,
      labels: PAGE_PATHS,
    });
  })
);

app.delete(
  "/api/admin/guestbook/:id",
  requireAdmin,
  handleAsync(async function (req, res) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ message: "올바른 방명록 번호가 아닙니다." });
    }
    const deleted = await db.deleteGuestbookEntry(id);
    if (!deleted) {
      return res.status(404).json({ message: "이미 삭제되었거나 존재하지 않는 방명록입니다." });
    }
    res.json({ ok: true, id: id });
  })
);

app.use("/data", function (req, res, next) {
  res.set("Cache-Control", "no-cache");
  next();
});

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
