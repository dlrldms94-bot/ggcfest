(function () {
  "use strict";

  var state = {
    data: null,
    view: "home",
    category: "all",
    facilityType: "all",
    selectedZone: "",
    selectedFacility: "",
    dayId: "",
    position: null,
    loading: false
  };

  var built = { programs: false, facilities: false };
  var lastFocus = null;
  var titles = {
    home: "별동대 스마트 가이드",
    programs: "프로그램 지도",
    facilities: "화장실 · 의무실 · 분실물",
    today: "오늘의 추천",
    route: "추천 동선",
    textsize: "큰글씨 안내"
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeId(id) {
    return /^[a-z0-9-]+$/.test(String(id || "")) ? String(id) : "";
  }

  function safeColor(color) {
    return /^#[0-9a-fA-F]{3,8}$/.test(String(color || "")) ? color : "#e8d56a";
  }

  function safeSrc(path) {
    var value = String(path || "");
    if (value.indexOf("..") !== -1 || !/^img\/[a-zA-Z0-9_./-]+$/.test(value)) return "";
    return "../" + value;
  }

  function coord(n) {
    var value = Number(n);
    if (!isFinite(value)) return 50;
    return Math.min(100, Math.max(0, value));
  }

  function seoulDate() {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (e) {
      return "";
    }
  }

  function findZone(id) {
    var zones = (state.data && state.data.zones) || [];
    for (var i = 0; i < zones.length; i++) {
      if (zones[i].id === id) return zones[i];
    }
    return null;
  }

  function findFacility(id) {
    var list = (state.data && state.data.facilities) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function categoryById(id) {
    var list = (state.data && state.data.categories) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return { id: id, label: "", color: "#e8d56a" };
  }

  function facilityTypeById(id) {
    var list = (state.data && state.data.facilityTypes) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return { id: id, label: id, short: "·", color: "#14183f" };
  }

  function validDay(id) {
    return ((state.data && state.data.days) || []).some(function (day) {
      return day.id === id;
    });
  }

  function pickDay() {
    var today = seoulDate();
    var days = (state.data && state.data.days) || [];
    for (var i = 0; i < days.length; i++) {
      if (days[i].id === today) return days[i].id;
    }
    return days.length ? days[0].id : "";
  }

  function hasLatLng(poi) {
    return poi && typeof poi.lat === "number" && typeof poi.lng === "number";
  }

  function pointLatLng(poi) {
    if (hasLatLng(poi)) return { lat: poi.lat, lng: poi.lng };
    var bounds = state.data && state.data.map && state.data.map.bounds;
    if (!bounds) return null;
    var x = coord(poi.x);
    var y = coord(poi.y);
    return {
      lng: Number(bounds.west) + (x / 100) * (Number(bounds.east) - Number(bounds.west)),
      lat: Number(bounds.north) - (y / 100) * (Number(bounds.north) - Number(bounds.south))
    };
  }

  function distanceMeters(a, b) {
    if (!a || !b) return null;
    var R = 6371000;
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  }

  function formatDistance(meters) {
    if (meters == null) return "";
    if (meters >= 1000) {
      var km = meters / 1000;
      return "약 " + (km >= 10 ? String(Math.round(km)) : km.toFixed(1)) + "km";
    }
    return "약 " + meters + "m";
  }

  function phoneHref(phone) {
    var digits = String(phone || "").replace(/[^\d+]/g, "");
    if (digits.length < 8) return "";
    return "tel:" + digits;
  }

  function setLarge(on) {
    document.documentElement.classList.toggle("is-large", !!on);
    try {
      localStorage.setItem("ggcGuideLargeText", on ? "1" : "0");
    } catch (e) {}
    var box = document.getElementById("largeSwitch");
    if (box) box.checked = !!on;
    var label = document.getElementById("largeState");
    if (label) label.textContent = on ? "사용 중" : "";
  }

  function parseHash() {
    var raw = (location.hash || "#home").replace(/^#/, "");
    var parts = raw.split("/");
    var view = parts[0] || "home";
    if (!titles[view]) view = "home";
    var arg = "";
    try { arg = decodeURIComponent(parts[1] || ""); } catch (e) { arg = ""; }
    return { view: view, arg: arg };
  }

  function showView(view) {
    document.querySelectorAll("[data-view]").forEach(function (section) {
      section.hidden = section.getAttribute("data-view") !== view;
    });
    document.querySelectorAll("[data-nav], [data-tab]").forEach(function (link) {
      var key = link.getAttribute("data-tab") || link.getAttribute("data-nav");
      if (key === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = titles[view] + " | 관악강감찬축제";
  }

  function openDrawer() {
    var drawer = document.getElementById("drawer");
    var menuBtn = document.getElementById("menuBtn");
    lastFocus = document.activeElement;
    drawer.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "메뉴 닫기");
    document.body.classList.add("is-locked");
    var closeBtn = drawer.querySelector(".drawer__close");
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    var drawer = document.getElementById("drawer");
    var menuBtn = document.getElementById("menuBtn");
    if (drawer.hidden) return;
    drawer.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "메뉴 열기");
    document.body.classList.remove("is-locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function showDataError() {
    ["programApp", "facilityApp", "todayApp", "routeApp"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '<p class="status">안내 정보를 불러오지 못했어요.</p><button class="js-retry" type="button">다시 시도</button>';
    });
  }

  function loadData() {
    if (state.loading) return;
    state.loading = true;
    fetch("../data/guide.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("load");
        return res.json();
      })
      .then(function (data) {
        state.data = data;
        state.loading = false;
        built.programs = false;
        built.facilities = false;
        if (!validDay(state.dayId)) state.dayId = pickDay();
        updateHomeLine();
        onHash();
      })
      .catch(function () {
        state.loading = false;
        showDataError();
      });
  }

  function updateHomeLine() {
    var el = document.getElementById("todayLine");
    if (!el || !state.data) return;
    var today = seoulDate();
    var day = ((state.data.days) || []).filter(function (item) { return item.id === today; })[0];
    if (day) el.textContent = "오늘은 " + day.label + " · " + day.theme;
  }

  function buildPrograms() {
    var root = document.getElementById("programApp");
    var data = state.data;
    var cats = data.categories || [];
    var html = '<div class="chips" id="programChips"><button type="button" data-category="all" aria-pressed="true">전체</button>';
    cats.forEach(function (cat) {
      html += '<button type="button" data-category="' + esc(cat.id) + '" aria-pressed="false">' + esc(cat.label) + "</button>";
    });
    html += '</div><div class="zone-jump" id="zoneJump">';
    (data.zones || []).forEach(function (zone) {
      if (!safeId(zone.id)) return;
      var cat = categoryById(zone.category);
      html += '<button type="button" data-zone="' + esc(zone.id) + '" style="--c:' + esc(safeColor(cat.color)) + '"><i class="dot"></i>' + esc(zone.name) + "</button>";
    });
    html += '</div><div class="map-tools"><p>지도를 밀어 구역을 찾으세요.</p><button type="button" data-zoom="program" aria-pressed="false">한눈에 보기</button></div>';
    html += '<div class="map-scroll" id="programScroll"><div class="map-stage" id="programStage">';
    html += '<img id="programMap" alt="낙성대공원 행사장 안내도" width="1200" height="871">';
    html += '<div class="pins" id="programPins"></div></div></div>';
    html += '<ul class="legend">';
    cats.forEach(function (cat) {
      html += '<li><i style="--c:' + esc(safeColor(cat.color)) + '"></i>' + esc(cat.label) + "</li>";
    });
    html += '</ul><p class="note">핀 위치는 안내도 기준이에요. 혼잡할 때는 현장 표지를 함께 확인해 주세요.</p>';
    html += '<div class="sheet" id="zoneSheet" hidden></div>';
    root.innerHTML = html;

    var img = document.getElementById("programMap");
    var stage = document.getElementById("programStage");
    img.addEventListener("load", function () {
      if (img.naturalWidth) stage.style.aspectRatio = img.naturalWidth + " / " + img.naturalHeight;
    });
    img.src = safeSrc(data.map && data.map.image) || "../img/guide-map.jpg";

    var pins = document.getElementById("programPins");
    (data.zones || []).forEach(function (zone) {
      if (!safeId(zone.id)) return;
      var btn = document.createElement("button");
      var cat = categoryById(zone.category);
      btn.type = "button";
      btn.className = "pin";
      btn.setAttribute("data-zone", zone.id);
      btn.style.left = coord(zone.x) + "%";
      btn.style.top = coord(zone.y) + "%";
      btn.style.background = safeColor(cat.color);
      btn.style.zIndex = String(Math.round(coord(zone.y)));
      btn.textContent = zone.name;
      btn.setAttribute("aria-label", (zone.code ? zone.code + " " : "") + zone.name);
      pins.appendChild(btn);
    });
    built.programs = true;
    centerMap("programScroll");
  }

  function ensurePrograms() {
    if (!state.data) return;
    if (!built.programs) buildPrograms();
    applyCategory();
  }

  function applyCategory() {
    var cat = state.category;
    document.querySelectorAll("#programPins [data-zone], #zoneJump [data-zone]").forEach(function (el) {
      var zone = findZone(el.getAttribute("data-zone"));
      el.hidden = !(cat === "all" || (zone && zone.category === cat));
    });
    document.querySelectorAll("#programChips [data-category]").forEach(function (el) {
      var on = el.getAttribute("data-category") === cat;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (state.selectedZone) {
      var selected = findZone(state.selectedZone);
      if (cat !== "all" && selected && selected.category !== cat) clearZone();
    }
  }

  function updatePinState() {
    document.querySelectorAll("[data-zone]").forEach(function (el) {
      var on = el.getAttribute("data-zone") === state.selectedZone;
      el.classList.toggle("is-active", on);
      if (el.classList.contains("pin") || el.parentElement && el.parentElement.id === "zoneJump") {
        el.setAttribute("aria-pressed", on ? "true" : "false");
      }
    });
  }

  function fillSheet(zone) {
    var sheet = document.getElementById("zoneSheet");
    if (!sheet || !zone) return;
    var cat = categoryById(zone.category);
    var links = (state.data && state.data.links) || {};
    var src = safeSrc(zone.image);
    var html = '<div class="sheet__grip"></div><div class="sheet__bar"><p class="kicker">' +
      esc(zone.code ? zone.code + " · " : "") + esc(cat.label) +
      '</p><button class="sheet__close" type="button">닫기</button></div>';
    html += '<div class="sheet__hero">';
    if (src) html += '<img src="' + esc(src) + '" alt="">';
    html += "<div><h3>" + esc(zone.name) + "</h3><p class=\"summary\">" + esc(zone.summary || "") + "</p></div></div>";
    if (zone.programs && zone.programs.length) {
      html += '<ul class="times">';
      zone.programs.forEach(function (program) {
        var badge = program.days && state.dayId === seoulDate() && program.days.indexOf(state.dayId) !== -1 ? '<em class="badge">오늘</em>' : "";
        html += "<li><strong>" + esc(program.name) + badge + "</strong><span>" + esc(program.time || "") + "</span></li>";
      });
      html += "</ul>";
    }
    if (zone.category === "info") {
      html += '<a class="btn" href="#facilities/lost">분실물 · 안내 보기</a>';
    } else if (links.program) {
      html += '<a class="btn" href="' + esc(links.program) + '">상세보기 →</a>';
    }
    sheet.innerHTML = html;
    sheet.hidden = false;
    sheet.scrollTop = 0;
    var hero = sheet.querySelector("img");
    if (hero) {
      var hideHero = function () { hero.hidden = true; };
      hero.addEventListener("error", hideHero);
      if (hero.complete && !hero.naturalWidth) hideHero();
    }
  }

  function clearZone() {
    state.selectedZone = "";
    if (location.hash.indexOf("#programs/") === 0) {
      history.replaceState(null, "", "#programs");
    }
    updatePinState();
    var sheet = document.getElementById("zoneSheet");
    if (sheet) sheet.hidden = true;
  }

  function scrollMapPin(selector) {
    var pin = document.querySelector(selector);
    if (!pin) return;
    var scroller = pin.closest(".map-scroll");
    if (!scroller) return;
    var pinRect = pin.getBoundingClientRect();
    var scrRect = scroller.getBoundingClientRect();
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollBy({
      left: pinRect.left - scrRect.left - scrRect.width / 2 + pinRect.width / 2,
      top: pinRect.top - scrRect.top - scrRect.height / 2 + pinRect.height / 2,
      behavior: reduce ? "auto" : "smooth"
    });
  }

  function selectZone(id) {
    var zone = findZone(id);
    if (!zone) return;
    state.selectedZone = id;
    if (state.category !== "all" && zone.category !== state.category) state.category = "all";
    applyCategory();
    updatePinState();
    fillSheet(zone);
    scrollMapPin('#programPins [data-zone="' + id + '"]');
  }

  function openZone(id) {
    if (!safeId(id) || !findZone(id)) return;
    var next = "#programs/" + id;
    if (location.hash.indexOf("#programs") === 0) {
      if (location.hash !== next) history.replaceState(null, "", next);
      state.view = "programs";
      showView("programs");
      ensurePrograms();
      selectZone(id);
      return;
    }
    location.hash = "programs/" + id;
  }

  function buildFacilities() {
    var root = document.getElementById("facilityApp");
    var types = (state.data && state.data.facilityTypes) || [];
    var html = '<div class="chips" id="facilityChips"><button type="button" data-ftype="all">전체</button>';
    types.forEach(function (type) {
      html += '<button type="button" data-ftype="' + esc(type.id) + '">' + esc(type.label) + "</button>";
    });
    html += '</div><button class="geo-btn" id="geoBtn" type="button">현 위치 기준 새로고침</button>';
    html += '<p class="status" id="geoStatus" aria-live="polite">버튼을 누르면 현재 위치에서 가까운 순으로 다시 정렬해요. 거리는 직선거리예요.</p>';
    html += '<div class="map-tools"><p>시설 아이콘을 눌러 보세요.</p><button type="button" data-zoom="facility" aria-pressed="false">한눈에 보기</button></div>';
    html += '<div class="map-scroll" id="facilityScroll"><div class="map-stage" id="facilityStage">';
    html += '<img id="facilityMap" alt="낙성대공원 행사장 안내도" width="1200" height="871">';
    html += '<div class="pins" id="facilityPins"></div>';
    html += '<div class="user-dot" id="facilityUser" hidden></div></div></div>';
    html += '<div class="fac-list" id="facilityList"></div>';
    html += '<p class="note">안내용 대략 거리이며 걷는 길과는 다를 수 있어요. 좌표는 행사 전 현장에서 보정해요.</p>';
    root.innerHTML = html;

    var img = document.getElementById("facilityMap");
    var stage = document.getElementById("facilityStage");
    img.addEventListener("load", function () {
      if (img.naturalWidth) stage.style.aspectRatio = img.naturalWidth + " / " + img.naturalHeight;
    });
    img.src = safeSrc(state.data.map && state.data.map.image) || "../img/guide-map.jpg";

    var pins = document.getElementById("facilityPins");
    (state.data.facilities || []).forEach(function (item) {
      if (!safeId(item.id)) return;
      var type = facilityTypeById(item.type);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pin pin--facility";
      btn.setAttribute("data-facility", item.id);
      btn.setAttribute("data-ftype-pin", item.type);
      btn.style.left = coord(item.x) + "%";
      btn.style.top = coord(item.y) + "%";
      btn.style.background = safeColor(type.color);
      btn.style.zIndex = String(Math.round(coord(item.y)));
      btn.textContent = type.short || "·";
      btn.setAttribute("aria-label", item.name);
      pins.appendChild(btn);
    });
    document.getElementById("geoBtn").addEventListener("click", requestLocation);
    built.facilities = true;
    if (state.position) placeUserDot();
    centerMap("facilityScroll");
  }

  function centerMap(scrollerId) {
    var scroller = document.getElementById(scrollerId);
    if (!scroller) return;
    var stage = scroller.querySelector(".map-stage");
    if (!stage) return;
    var apply = function () {
      scroller.scrollLeft = Math.max(0, (stage.offsetWidth - scroller.clientWidth) / 2);
      scroller.scrollTop = Math.max(0, (stage.offsetHeight - scroller.clientHeight) * 0.42);
    };
    requestAnimationFrame(apply);
    var img = stage.querySelector("img");
    if (img && !img.complete) img.addEventListener("load", apply, { once: true });
  }

  function ensureFacilities() {
    if (!state.data) return;
    if (!built.facilities) buildFacilities();
    applyFacilityType();
    renderFacilityList();
  }

  function applyFacilityType() {
    var type = state.facilityType || "all";
    document.querySelectorAll("#facilityPins [data-facility]").forEach(function (el) {
      el.hidden = !(type === "all" || el.getAttribute("data-ftype-pin") === type);
    });
    document.querySelectorAll("#facilityChips [data-ftype]").forEach(function (el) {
      var on = el.getAttribute("data-ftype") === type;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderFacilityList() {
    var list = document.getElementById("facilityList");
    if (!list || !state.data) return;
    var type = state.facilityType || "all";
    var items = (state.data.facilities || []).filter(function (item) {
      return type === "all" || item.type === type;
    }).map(function (item, index) {
      return { item: item, index: index, distance: state.position ? distanceMeters(state.position, pointLatLng(item)) : null };
    });
    if (state.position) {
      items.sort(function (a, b) {
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance || a.index - b.index;
      });
    }
    if (!items.length) {
      list.innerHTML = '<p class="status">표시할 시설이 없어요.</p>';
      return;
    }
    list.innerHTML = items.map(function (row) {
      var item = row.item;
      var meta = facilityTypeById(item.type);
      var dist = formatDistance(row.distance);
      var phone = phoneHref(item.phone);
      var html = '<article class="fac-item' + (item.id === state.selectedFacility ? " is-active" : "") + '">';
      html += '<button type="button" class="fac-item__hit" data-facility="' + esc(item.id) + '">';
      html += '<span class="fac-mark" style="--c:' + esc(safeColor(meta.color)) + '">' + esc(meta.short || "·") + "</span>";
      html += "<span><strong>" + esc(item.name) + "</strong><span class=\"muted\">" + esc(item.desc || "") +
        (item.hours ? " · " + esc(item.hours) : "") + "</span></span>";
      html += '<span class="fac-item__dist">' + (dist ? esc(dist) : "") + "</span></button>";
      if (item.note) html += '<p class="fac-item__note">' + esc(item.note) + "</p>";
      if (phone) html += '<a class="btn btn--line fac-phone" href="' + esc(phone) + '">전화하기 ' + esc(item.phone) + "</a>";
      html += "</article>";
      return html;
    }).join("");
  }

  function selectFacility(id) {
    if (!safeId(id) || !findFacility(id)) return;
    state.selectedFacility = id;
    document.querySelectorAll("#facilityPins [data-facility]").forEach(function (el) {
      var on = el.getAttribute("data-facility") === id;
      el.classList.toggle("is-active", on);
    });
    renderFacilityList();
    scrollMapPin('#facilityPins [data-facility="' + id + '"]');
  }

  function setFacilityType(type) {
    state.facilityType = type && type !== "all" ? type : "all";
    var next = state.facilityType === "all" ? "#facilities" : "#facilities/" + state.facilityType;
    if (location.hash !== next) history.replaceState(null, "", next);
    state.view = "facilities";
    showView("facilities");
    ensureFacilities();
  }

  function placeUserDot() {
    var dot = document.getElementById("facilityUser");
    if (!dot || !state.position || !state.data) return;
    var bounds = state.data.map && state.data.map.bounds;
    if (!bounds) return;
    var x = (state.position.lng - Number(bounds.west)) / (Number(bounds.east) - Number(bounds.west)) * 100;
    var y = (Number(bounds.north) - state.position.lat) / (Number(bounds.north) - Number(bounds.south)) * 100;
    if (x < -15 || x > 115 || y < -15 || y > 115) {
      dot.hidden = true;
      return;
    }
    dot.hidden = false;
    dot.style.left = Math.min(98, Math.max(2, x)) + "%";
    dot.style.top = Math.min(98, Math.max(2, y)) + "%";
  }

  function parkCenter() {
    var bounds = state.data && state.data.map && state.data.map.bounds;
    if (!bounds) return null;
    return {
      lat: (Number(bounds.north) + Number(bounds.south)) / 2,
      lng: (Number(bounds.west) + Number(bounds.east)) / 2
    };
  }

  function requestLocation() {
    var btn = document.getElementById("geoBtn");
    var status = document.getElementById("geoStatus");
    if (!btn || !status) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      status.textContent = "위치는 HTTPS 연결에서만 사용할 수 있어요.";
      return;
    }
    btn.disabled = true;
    status.textContent = "현재 위치를 확인하고 있어요.";
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.position = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };
      btn.disabled = false;
      var acc = Math.round(pos.coords.accuracy || 0);
      var text = "현재 위치 기준으로 가까운 순으로 정렬했어요.";
      if (acc) text += " GPS 오차 약 " + acc + "m.";
      var away = distanceMeters(state.position, parkCenter());
      if (away != null && away > 1200) {
        text += " 지금 위치가 행사장과 멀리 있어요. 도착한 뒤 다시 눌러 주세요.";
      } else if (acc > 80) {
        text += " 오차가 커서 순서가 달라질 수 있어요.";
      }
      status.textContent = text;
      placeUserDot();
      renderFacilityList();
    }, function (err) {
      btn.disabled = false;
      if (err && err.code === 1) {
        status.textContent = "위치 권한이 필요해요. 브라우저 설정에서 위치를 허용한 뒤 다시 눌러 주세요.";
      } else {
        status.textContent = "위치를 가져오지 못했어요. 잠시 후 다시 눌러 주세요.";
      }
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  function scheduleItem(item, step) {
    var zoneId = safeId(item.zoneId);
    var zone = zoneId ? findZone(zoneId) : null;
    var place = item.place || (zone ? zone.name : "");
    var mapBtn = zone
      ? '<button type="button" class="text-link" data-open-zone="' + esc(zone.id) + '">지도에서 보기</button>'
      : "";
    var no = step ? '<span class="step-no">' + step + "</span>" : "";
    return '<article class="sched' + (step ? " sched--step" : "") + '">' + no +
      "<div><strong>" + esc(item.name) + "</strong><span class=\"muted\">" +
      esc([item.time, place].filter(Boolean).join(" · ")) + "</span></div>" + mapBtn + "</article>";
  }

  function renderDay(root, mode) {
    if (!root) return;
    if (!state.data) {
      root.innerHTML = '<p class="status">안내 정보를 불러오고 있어요.</p>';
      return;
    }
    var days = state.data.days || [];
    if (!days.length) {
      root.innerHTML = '<p class="status">등록된 일정이 없어요.</p>';
      return;
    }
    if (!validDay(state.dayId)) state.dayId = days[0].id;
    var day = days.filter(function (item) { return item.id === state.dayId; })[0];
    var today = seoulDate();
    var intro = mode === "route"
      ? "아래 순서대로 이동하면 그날의 주요 일정을 따라갈 수 있어요. 같은 시간대는 하나만 골라도 돼요."
      : (day.id === today
        ? "오늘 일정이에요. 지도에서 위치를 확인할 수 있어요."
        : "날짜를 고르면 그 날의 주요 일정을 볼 수 있어요.");
    var html = '<div class="day-tabs" role="tablist">';
    days.forEach(function (item) {
      html += '<button type="button" role="tab" data-day="' + esc(item.id) + '" aria-selected="' +
        (item.id === day.id ? "true" : "false") + '">' + esc(item.label) + "</button>";
    });
    html += '</div><p class="theme">' + esc(day.theme || "") + '</p><p class="lead">' + esc(intro) + '</p><div class="stack">';
    (day.items || []).forEach(function (item, index) {
      html += scheduleItem(item, mode === "route" ? index + 1 : 0);
    });
    html += "</div>";
    if (day.anytime && day.anytime.length) {
      html += '<h3 class="subhead">상설 · 들르기</h3><div class="stack">';
      day.anytime.forEach(function (item) { html += scheduleItem(item, 0); });
      html += "</div>";
    }
    var timetable = (state.data.links && state.data.links.timetable) || "../index.html#timetable";
    html += '<p class="more"><a href="' + esc(timetable) + '">전체 타임테이블 보기</a></p>';
    root.innerHTML = html;
  }

  function setDay(id) {
    if (!validDay(id)) return;
    state.dayId = id;
    var mode = state.view === "route" ? "route" : "today";
    var next = "#" + mode + "/" + id;
    if (location.hash !== next) history.replaceState(null, "", next);
    renderDay(document.getElementById(mode === "route" ? "routeApp" : "todayApp"), mode);
    if (state.selectedZone) {
      var zone = findZone(state.selectedZone);
      if (zone) fillSheet(zone);
    }
  }

  function toggleZoom(which) {
    var stage = document.getElementById(which + "Stage");
    var btn = document.querySelector('[data-zoom="' + which + '"]');
    if (!stage || !btn) return;
    var fit = !stage.classList.contains("is-fit");
    stage.classList.toggle("is-fit", fit);
    btn.setAttribute("aria-pressed", fit ? "true" : "false");
    btn.textContent = fit ? "크게 보기" : "한눈에 보기";
    if (fit) {
      var scroller = document.getElementById(which + "Scroll");
      if (scroller) scroller.scrollTo(0, 0);
    } else {
      centerMap(which + "Scroll");
    }
  }

  function onMainClick(event) {
    var target = event.target.closest("[data-day], [data-open-zone], [data-zone], [data-facility], [data-category], [data-ftype], [data-zoom], .js-retry, .sheet__close");
    if (!target || !document.getElementById("main").contains(target)) return;
    if (target.classList.contains("js-retry")) {
      loadData();
      return;
    }
    if (target.hasAttribute("data-day")) {
      setDay(target.getAttribute("data-day"));
      return;
    }
    if (target.hasAttribute("data-open-zone")) {
      openZone(target.getAttribute("data-open-zone"));
      return;
    }
    if (target.hasAttribute("data-zone")) {
      openZone(target.getAttribute("data-zone"));
      return;
    }
    if (target.hasAttribute("data-facility")) {
      selectFacility(target.getAttribute("data-facility"));
      return;
    }
    if (target.hasAttribute("data-category")) {
      state.category = target.getAttribute("data-category") || "all";
      applyCategory();
      return;
    }
    if (target.hasAttribute("data-ftype")) {
      setFacilityType(target.getAttribute("data-ftype"));
      return;
    }
    if (target.hasAttribute("data-zoom")) {
      toggleZoom(target.getAttribute("data-zoom"));
      return;
    }
    if (target.classList.contains("sheet__close")) clearZone();
  }

  function onHash() {
    var parsed = parseHash();
    var viewChanged = state.view !== parsed.view;
    state.view = parsed.view;
    if (parsed.view === "facilities") {
      state.facilityType = parsed.arg && parsed.arg !== "all" ? parsed.arg : "all";
    }
    if ((parsed.view === "today" || parsed.view === "route") && parsed.arg && (!state.data || validDay(parsed.arg))) {
      state.dayId = parsed.arg;
    }
    showView(parsed.view);
    if (viewChanged) window.scrollTo(0, 0);
    if (parsed.view === "programs") {
      ensurePrograms();
      if (parsed.arg && safeId(parsed.arg)) selectZone(parsed.arg);
      else clearZone();
    }
    if (parsed.view === "facilities") ensureFacilities();
    if (parsed.view === "today") renderDay(document.getElementById("todayApp"), "today");
    if (parsed.view === "route") renderDay(document.getElementById("routeApp"), "route");
    closeDrawer();
  }

  document.addEventListener("DOMContentLoaded", function () {
    setLarge(document.documentElement.classList.contains("is-large"));
    document.getElementById("menuBtn").addEventListener("click", function () {
      var drawer = document.getElementById("drawer");
      if (drawer.hidden) openDrawer();
      else closeDrawer();
    });
    document.querySelector(".drawer__backdrop").addEventListener("click", closeDrawer);
    document.querySelector(".drawer__close").addEventListener("click", closeDrawer);
    document.getElementById("drawer").addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) return;
      if (link.getAttribute("href") === location.hash) {
        event.preventDefault();
        closeDrawer();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var drawer = document.getElementById("drawer");
      if (!drawer.hidden) closeDrawer();
      else if (state.selectedZone) clearZone();
    });
    document.getElementById("largeSwitch").addEventListener("change", function (event) {
      setLarge(event.target.checked);
    });
    document.getElementById("main").addEventListener("click", onMainClick);
    window.addEventListener("hashchange", onHash);
    onHash();
    loadData();
  });
})();
