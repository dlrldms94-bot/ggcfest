(function () {
  "use strict";

  var modal = document.getElementById("guestbookModal");
  var form = document.getElementById("guestbookForm");
  var list = document.getElementById("guestbookList");
  var pagination = document.getElementById("guestbookPagination");
  var count = document.getElementById("guestbookCount");
  var formStatus = document.getElementById("guestbookFormStatus");
  var message = form && form.elements.message;
  var messageCount = document.getElementById("guestbookMessageCount");
  var currentPage = 1;
  var totalPages = 1;
  var pageSize = 6;
  var loading = false;
  var lastFocus = null;
  var resizeTimer = null;

  if (!modal || !form || !list || !pagination) return;

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    try {
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    } catch (error) {
      return "";
    }
  }

  function createCard(item) {
    var article = document.createElement("article");
    article.className = "guestbook-card";

    var head = document.createElement("div");
    head.className = "guestbook-card__head";

    var avatar = document.createElement("span");
    avatar.className = "guestbook-card__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = Array.from(String(item.name || "별"))[0] || "별";

    var meta = document.createElement("div");
    var name = document.createElement("strong");
    name.className = "guestbook-card__name";
    name.textContent = item.name;
    var date = document.createElement("time");
    date.className = "guestbook-card__date";
    date.dateTime = item.createdAt || "";
    date.textContent = formatDate(item.createdAt);
    meta.append(name, date);
    head.append(avatar, meta);

    var body = document.createElement("p");
    body.className = "guestbook-card__message";
    body.textContent = item.message;
    article.append(head, body);
    return article;
  }

  function showListMessage(text) {
    list.replaceChildren();
    var status = document.createElement("p");
    status.className = "guestbook__status";
    status.textContent = text;
    list.append(status);
  }

  function getPageSize() {
    if (window.innerWidth <= 560) return 3;
    if (window.innerWidth <= 820) return 4;
    return 6;
  }

  function pageButton(label, page, options) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = options && options.disabled;
    if (options && options.current) {
      button.className = "is-current";
      button.setAttribute("aria-current", "page");
    }
    button.addEventListener("click", function () {
      loadEntries(page);
    });
    return button;
  }

  function renderPagination() {
    pagination.replaceChildren();
    if (totalPages <= 1) return;

    pagination.append(pageButton("이전", currentPage - 1, { disabled: currentPage === 1 }));
    var pages = [];
    [1, currentPage - 1, currentPage, currentPage + 1, totalPages].forEach(function (page) {
      if (page >= 1 && page <= totalPages && pages.indexOf(page) === -1) pages.push(page);
    });
    pages.sort(function (a, b) { return a - b; });
    pages.forEach(function (page, index) {
      if (index && page - pages[index - 1] > 1) {
        var ellipsis = document.createElement("span");
        ellipsis.textContent = "…";
        ellipsis.setAttribute("aria-hidden", "true");
        pagination.append(ellipsis);
      }
      pagination.append(pageButton(String(page), page, { current: page === currentPage }));
    });
    pagination.append(pageButton("다음", currentPage + 1, { disabled: currentPage === totalPages }));
  }

  async function loadEntries(page) {
    if (loading) return;
    loading = true;
    pageSize = getPageSize();
    showListMessage("방명록을 불러오고 있어요.");
    pagination.querySelectorAll("button").forEach(function (button) {
      button.disabled = true;
    });

    var query = "?limit=" + pageSize + "&page=" + encodeURIComponent(page);
    try {
      var response = await fetch("/api/guestbook" + query, { cache: "no-store" });
      var data = await response.json();
      if (!response.ok) throw new Error(data.message || "방명록을 불러오지 못했어요.");
      list.replaceChildren();
      (data.items || []).forEach(function (item) {
        list.append(createCard(item));
      });
      if (!list.children.length) {
        showListMessage("첫 번째 마음을 남겨주세요.");
      }
      currentPage = data.page || 1;
      totalPages = data.totalPages || 1;
      renderPagination();
      if (count) count.textContent = String(data.total || 0);
    } catch (error) {
      showListMessage(error.message || "방명록을 불러오지 못했어요.");
      renderPagination();
    } finally {
      loading = false;
    }
  }

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    formStatus.textContent = "";
    window.setTimeout(function () {
      form.elements.name.focus();
    }, 0);
  }

  function closeModal() {
    modal.hidden = true;
    if (!document.querySelector(".modal:not([hidden])")) {
      document.body.classList.remove("modal-open");
    }
    formStatus.textContent = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  document.querySelectorAll("[data-open-guestbook]").forEach(function (button) {
    button.addEventListener("click", openModal);
  });
  document.querySelectorAll("[data-close-guestbook]").forEach(function (button) {
    button.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  if (message && messageCount) {
    message.addEventListener("input", function () {
      messageCount.textContent = String(Array.from(message.value).length);
    });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var submit = form.querySelector("button[type='submit']");
    var payload = {
      name: form.elements.name.value,
      message: form.elements.message.value,
      website: form.elements.website.value,
      publicAgreed: form.elements.publicAgreed.checked,
    };
    submit.disabled = true;
    formStatus.textContent = "마음을 전하고 있어요.";

    try {
      var response = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var data = await response.json();
      if (!response.ok) throw new Error(data.message || "방명록을 남기지 못했어요.");
      if (data.item) {
        var empty = list.querySelector(".guestbook__status");
        if (empty) empty.remove();
        list.prepend(createCard(data.item));
        if (count) count.textContent = String(Number(count.textContent || 0) + 1);
      }
      form.reset();
      if (messageCount) messageCount.textContent = "0";
      closeModal();
      await loadEntries(1);
      document.getElementById("guestbook").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      formStatus.textContent = error.message || "방명록을 남기지 못했어요.";
    } finally {
      submit.disabled = false;
    }
  });

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var nextSize = getPageSize();
      if (nextSize !== pageSize) loadEntries(1);
    }, 180);
  });

  loadEntries(1);
})();
