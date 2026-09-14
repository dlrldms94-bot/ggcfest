const KEY_STORAGE = "ggcfest-admin-key";
const lockForm = document.getElementById("adminLock");
const lockError = document.getElementById("adminLockError");
const board = document.getElementById("adminBoard");
const rowsEl = document.getElementById("adminRows");
const countEl = document.getElementById("adminCount");
const queryEl = document.getElementById("adminQuery");
const dayEl = document.getElementById("adminDay");
const csvBtn = document.getElementById("adminCsv");

let items = [];

function storedKey() {
  return sessionStorage.getItem(KEY_STORAGE) || "";
}

function showError(message) {
  lockError.hidden = !message;
  lockError.textContent = message || "";
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function filteredItems() {
  const query = queryEl.value.trim().replace(/\s+/g, "").toLowerCase();
  const day = dayEl.value;
  return items.filter((item) => {
    if (day && item.visitDay !== day) return false;
    if (!query) return true;
    const hay = (item.name + item.phone).replace(/\s+/g, "").toLowerCase();
    return hay.indexOf(query) !== -1;
  });
}

function renderRows() {
  const visible = filteredItems();
  countEl.textContent = visible.length + "건" + (visible.length !== items.length ? " / 전체 " + items.length + "건" : "");
  if (!visible.length) {
    rowsEl.innerHTML = '<tr><td colspan="5">신청 내역이 없습니다.</td></tr>';
    return;
  }
  rowsEl.innerHTML = visible.map((item, index) => {
    return (
      "<tr>" +
      "<td>" + (visible.length - index) + "</td>" +
      "<td>" + escapeHtml(item.name) + "</td>" +
      "<td>" + escapeHtml(item.phone) + "</td>" +
      "<td>" + escapeHtml(item.visitDay) + "</td>" +
      "<td>" + escapeHtml(formatTime(item.createdAt)) + "</td>" +
      "</tr>"
    );
  }).join("");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadList(key) {
  const headers = {};
  if (key) headers["x-admin-key"] = key;
  const response = await fetch("/api/reservations", { headers });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    sessionStorage.removeItem(KEY_STORAGE);
    throw new Error(result.message || "관리자 비밀번호를 확인해 주세요.");
  }
  if (!response.ok) {
    throw new Error(result.message || "내역을 불러오지 못했습니다.");
  }
  items = Array.isArray(result.items) ? result.items : [];
  lockForm.hidden = true;
  board.hidden = false;
  renderRows();
}

function csvEscape(value) {
  const text = String(value == null ? "" : value);
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function downloadCsv() {
  const visible = filteredItems();
  const lines = [["번호", "이름", "연락처", "방문 희망일", "신청 일시"].join(",")];
  visible.forEach((item, index) => {
    lines.push([
      visible.length - index,
      csvEscape(item.name),
      csvEscape(item.phone),
      csvEscape(item.visitDay),
      csvEscape(formatTime(item.createdAt)),
    ].join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "관악강감찬축제-사전신청.csv";
  link.click();
  URL.revokeObjectURL(url);
}

lockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = String(new FormData(lockForm).get("key") || "").trim();
  showError("");
  try {
    await loadList(key);
    sessionStorage.setItem(KEY_STORAGE, key);
  } catch (error) {
    showError(error.message);
  }
});

queryEl.addEventListener("input", renderRows);
dayEl.addEventListener("change", renderRows);
csvBtn.addEventListener("click", downloadCsv);

(async function start() {
  try {
    await loadList(storedKey());
  } catch (error) {
    lockForm.hidden = false;
    board.hidden = true;
    if (storedKey()) showError(error.message);
  }
})();
