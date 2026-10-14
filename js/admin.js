const KEY_STORAGE = "ggcfest-admin-key";
const lockForm = document.getElementById("adminLock");
const lockError = document.getElementById("adminLockError");
const board = document.getElementById("adminBoard");
const rowsEl = document.getElementById("adminRows");
const countEl = document.getElementById("adminCount");
const queryEl = document.getElementById("adminQuery");
const dayEl = document.getElementById("adminDay");
const csvBtn = document.getElementById("adminCsv");
const guestbookRowsEl = document.getElementById("guestbookRows");
const guestbookCountEl = document.getElementById("guestbookCount");
const guestbookQueryEl = document.getElementById("guestbookQuery");
const tabButtons = Array.from(document.querySelectorAll("[data-admin-tab]"));
const reservationPanel = document.getElementById("reservationPanel");
const guestbookPanel = document.getElementById("guestbookPanel");

let items = [];
let guestbookItems = [];

function storedKey() {
  return sessionStorage.getItem(KEY_STORAGE) || "";
}

function showError(message) {
  lockError.hidden = !message;
  lockError.textContent = message || "";
}

function setAdminTab(tabName, moveFocus) {
  const showGuestbook = tabName === "guestbook";
  reservationPanel.hidden = showGuestbook;
  guestbookPanel.hidden = !showGuestbook;
  tabButtons.forEach((button) => {
    const active = button.dataset.adminTab === tabName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && moveFocus) button.focus();
  });
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
    if (day && String(item.visitDay || "").indexOf(day) === -1) return false;
    if (!query) return true;
    const hay = (item.name + item.phone + item.birthDate + item.program).replace(/\s+/g, "").toLowerCase();
    return hay.indexOf(query) !== -1;
  });
}

function renderRows() {
  const visible = filteredItems();
  countEl.textContent = visible.length + "건" + (visible.length !== items.length ? " / 전체 " + items.length + "건" : "");
  if (!visible.length) {
    rowsEl.innerHTML = '<tr><td colspan="8">신청 내역이 없습니다.</td></tr>';
    return;
  }
  rowsEl.innerHTML = visible.map((item, index) => {
    return (
      "<tr>" +
      "<td>" + (visible.length - index) + "</td>" +
      "<td>" + escapeHtml(item.name) + "</td>" +
      "<td>" + escapeHtml(item.phone) + "</td>" +
      "<td>" + escapeHtml(item.birthDate) + "</td>" +
      "<td>" + escapeHtml(item.visitDay) + "</td>" +
      "<td>" + escapeHtml(item.program) + "</td>" +
      "<td>" + (item.privacyAgreed ? "동의" : "미동의") + "</td>" +
      "<td>" + escapeHtml(formatTime(item.createdAt)) + "</td>" +
      "</tr>"
    );
  }).join("");
}

function renderGuestbookRows() {
  const query = guestbookQueryEl.value.trim().replace(/\s+/g, "").toLowerCase();
  const visible = guestbookItems.filter((item) => {
    if (!query) return true;
    return (item.name + item.message).replace(/\s+/g, "").toLowerCase().indexOf(query) !== -1;
  });
  guestbookCountEl.textContent =
    visible.length + "건" +
    (visible.length !== guestbookItems.length ? " / 전체 " + guestbookItems.length + "건" : "");
  if (!visible.length) {
    guestbookRowsEl.innerHTML = '<tr><td colspan="5">방명록이 없습니다.</td></tr>';
    return;
  }
  guestbookRowsEl.innerHTML = visible.map((item) => {
    return (
      "<tr>" +
      "<td>" + item.id + "</td>" +
      "<td>" + escapeHtml(item.name) + "</td>" +
      '<td class="admin-guestbook-message">' + escapeHtml(item.message).replace(/\n/g, "<br>") + "</td>" +
      "<td>" + escapeHtml(formatTime(item.createdAt)) + "</td>" +
      '<td><button type="button" class="admin-delete" data-guestbook-id="' + item.id + '">삭제</button></td>' +
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
  const responses = await Promise.all([
    fetch("/api/reservations", { headers }),
    fetch("/api/admin/guestbook", { headers }),
  ]);
  const results = await Promise.all(responses.map((response) => response.json().catch(() => ({}))));
  const failedIndex = responses.findIndex((response) => !response.ok);
  if (responses.some((response) => response.status === 401)) {
    sessionStorage.removeItem(KEY_STORAGE);
    throw new Error("관리자 비밀번호를 확인해 주세요.");
  }
  if (failedIndex !== -1) {
    throw new Error(results[failedIndex].message || "내역을 불러오지 못했습니다.");
  }
  items = Array.isArray(results[0].items) ? results[0].items : [];
  guestbookItems = Array.isArray(results[1].items) ? results[1].items : [];
  lockForm.hidden = true;
  board.hidden = false;
  renderRows();
  renderGuestbookRows();
}

async function deleteGuestbookEntry(id, button) {
  const item = guestbookItems.find((entry) => entry.id === id);
  if (!item) return;
  if (!window.confirm(item.name + "님의 방명록을 삭제할까요?\n삭제한 글은 복구할 수 없습니다.")) return;

  button.disabled = true;
  try {
    const headers = {};
    const key = storedKey();
    if (key) headers["x-admin-key"] = key;
    const response = await fetch("/api/admin/guestbook/" + id, {
      method: "DELETE",
      headers: headers,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "방명록을 삭제하지 못했습니다.");
    guestbookItems = guestbookItems.filter((entry) => entry.id !== id);
    renderGuestbookRows();
  } catch (error) {
    button.disabled = false;
    window.alert(error.message);
  }
}

function csvEscape(value) {
  const text = String(value == null ? "" : value);
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

function downloadCsv() {
  const visible = filteredItems();
  const lines = [["번호", "이름", "연락처", "생년월일", "방문 희망일", "참여 프로그램", "개인정보 동의", "신청 일시"].join(",")];
  visible.forEach((item, index) => {
    lines.push([
      visible.length - index,
      csvEscape(item.name),
      csvEscape(item.phone),
      csvEscape(item.birthDate),
      csvEscape(item.visitDay),
      csvEscape(item.program),
      item.privacyAgreed ? "동의" : "미동의",
      csvEscape(formatTime(item.createdAt)),
    ].join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "관악강감찬축제-사전예약.csv";
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
guestbookQueryEl.addEventListener("input", renderGuestbookRows);
guestbookRowsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-guestbook-id]");
  if (!button) return;
  deleteGuestbookEntry(Number(button.dataset.guestbookId), button);
});
tabButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    setAdminTab(button.dataset.adminTab, false);
  });
  button.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + tabButtons.length) % tabButtons.length;
    setAdminTab(tabButtons[nextIndex].dataset.adminTab, true);
  });
});

(async function start() {
  try {
    await loadList(storedKey());
  } catch (error) {
    lockForm.hidden = false;
    board.hidden = true;
    if (storedKey()) showError(error.message);
  }
})();
