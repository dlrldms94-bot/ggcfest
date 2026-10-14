(function () {
  "use strict";

  var data = null;
  var guide = "./guide/";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function norm(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function todayKey() {
    var date = new Date();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return date.getFullYear() + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
  }

  function facilities(type, label) {
    if (data.failed) return "<p>안내 정보를 불러오지 못했어요.</p>";
    var list = (data.facilities || []).filter(function (item) { return item.type === type; });
    if (!list.length) return "<p>" + esc(label) + " 안내를 찾지 못했어요.</p>";
    var items = list.map(function (item) {
      return "<li><strong>" + esc(item.name) + "</strong> " + esc(item.desc || "") +
        (item.hours ? " · " + esc(item.hours) : "") +
        (item.note ? " " + esc(item.note) : "") + "</li>";
    }).join("");
    return "<p>" + esc(label) + " 위치예요.</p><ul>" + items + "</ul><p><a href=\"" + guide + "#facilities/" + type + "\">지도에서 보기</a></p>";
  }

  function zoneAnswer(zone) {
    var programs = (zone.programs || []).slice(0, 5).map(function (program) {
      return "<li>" + esc(program.name) + (program.time ? " · " + esc(program.time) : "") + "</li>";
    }).join("");
    return "<p><strong>" + esc(zone.name) + "</strong> " + esc(zone.summary || "") + "</p>" +
      (programs ? "<ul>" + programs + "</ul>" : "") +
      "<p><a href=\"" + guide + "#programs/" + esc(zone.id) + "\">지도에서 보기</a></p>";
  }

  function todayAnswer() {
    var key = todayKey();
    var labels = {
      "2026-10-16": "10월 16일(금)",
      "2026-10-17": "10월 17일(토)",
      "2026-10-18": "10월 18일(일)"
    };
    if (!labels[key]) {
      return "<p>관악강감찬축제는 10월 16일(금)부터 18일(일)까지 낙성대공원 일대에서 열려요. 오늘은 축제 기간이 아니라 현장 일정은 없어요.</p><p><a href=\"" + guide + "#programs\">프로그램 지도 보기</a></p>";
    }
    if (data.failed) return "<p>안내 정보를 불러오지 못했어요.</p>";
    var items = [];
    (data.zones || []).forEach(function (zone) {
      (zone.programs || []).forEach(function (program) {
        if ((program.days || []).indexOf(key) !== -1) {
          items.push("<li>" + esc(program.name) + (program.time ? " · " + esc(program.time) : "") + " · " + esc(zone.name) + "</li>");
        }
      });
    });
    return "<p>" + labels[key] + "에 열리는 프로그램이에요.</p><ul>" + items.slice(0, 8).join("") + "</ul>" +
      (items.length > 8 ? "<p>일부만 보여드렸어요.</p>" : "") +
      "<p><a href=\"" + guide + "#programs\">프로그램 지도 보기</a></p>";
  }

  function answer(raw) {
    var q = norm(raw);
    if (!data) return "<p>안내 정보를 불러오고 있어요. 잠시 후 다시 물어봐 주세요.</p>";
    if (q.indexOf("화장실") !== -1) return facilities("toilet", "화장실");
    if (q.indexOf("의무") !== -1) return facilities("medic", "의무실");
    if (q.indexOf("분실") !== -1) return facilities("lost", "분실물");
    if (q.indexOf("누구") !== -1 || q.indexOf("설화") !== -1 || q === "강감찬" || q.indexOf("강감찬은") !== -1) {
      return "<p>고려의 명장 강감찬 장군이 태어난 곳이 관악이에요. 큰 별이 떨어졌다는 탄생 설화의 땅, 낙성대에서 축제가 열립니다.</p><p>안국사는 강감찬 장군을 모신 사당이에요.</p><p><a href=\"" + guide + "#programs/anguksa\">안국사 지도 보기</a></p>";
    }
    if (q.indexOf("오늘") !== -1 || q.indexOf("일정") !== -1) return todayAnswer();
    if (data.failed) return "<p>안내 정보를 불러오지 못했어요.</p>";
    var zoneHit = null;
    (data.zones || []).forEach(function (zone) {
      var name = norm(zone.name);
      if (name && q.indexOf(name) !== -1 && (!zoneHit || name.length > norm(zoneHit.name).length)) zoneHit = zone;
    });
    if (!zoneHit && q.indexOf("낙성꽃들정원") !== -1) {
      (data.zones || []).forEach(function (zone) {
        if (zone.id === "flower-garden") zoneHit = zone;
      });
    }
    if (zoneHit) return zoneAnswer(zoneHit);
    var programHit = null;
    var programLen = 0;
    (data.zones || []).forEach(function (zone) {
      (zone.programs || []).forEach(function (program) {
        var name = norm(program.name);
        var matched = name.length >= 2 && (q.indexOf(name) !== -1 || (q.length >= 2 && name.indexOf(q) !== -1));
        var len = matched ? (name.indexOf(q) !== -1 ? q.length : name.length) : 0;
        if (matched && len > programLen) {
          programHit = { zone: zone, program: program };
          programLen = len;
        }
      });
    });
    if (programHit) {
      return "<p><strong>" + esc(programHit.program.name) + "</strong>" +
        (programHit.program.time ? " " + esc(programHit.program.time) : "") +
        " · " + esc(programHit.zone.name) + "에서 열려요.</p>" +
        "<p>" + esc(programHit.zone.summary || "") + "</p>" +
        "<p><a href=\"" + guide + "#programs/" + esc(programHit.zone.id) + "\">지도에서 보기</a></p>";
    }
    return "<p>그 내용은 축제 안내에서 찾지 못했어요. 장소 이름이나 화장실, 의무실, 분실물을 물어봐 주세요.</p>";
  }

  function ask(text) {
    var question = String(text || "").trim();
    if (!question) return;
    var box = document.getElementById("docentAnswer");
    box.hidden = false;
    box.innerHTML = answer(question);
  }

  function setOpen(open) {
    var panel = document.getElementById("docentPanel");
    var launch = document.getElementById("docentLaunch");
    panel.hidden = !open;
    launch.setAttribute("aria-expanded", open ? "true" : "false");
    var label = launch.querySelector(".sr-only");
    if (label) label.textContent = open ? "투모로우 감찬이 닫기" : "투모로우 감찬이 열기";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var launch = document.getElementById("docentLaunch");
    var panel = document.getElementById("docentPanel");
    if (!launch || !panel) return;

    launch.addEventListener("click", function () {
      setOpen(launch.getAttribute("aria-expanded") !== "true");
    });
    document.getElementById("docentClose").addEventListener("click", function () {
      setOpen(false);
      launch.focus();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (launch.getAttribute("aria-expanded") !== "true") return;
      setOpen(false);
      launch.focus();
    });
    document.addEventListener("click", function (event) {
      if (launch.getAttribute("aria-expanded") !== "true") return;
      if (event.target.closest("#docentWidget")) return;
      setOpen(false);
    });
    document.getElementById("docentForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var input = document.getElementById("docentInput");
      ask(input.value);
      input.value = "";
    });
    document.querySelector(".docent-widget__chips").addEventListener("click", function (event) {
      var button = event.target.closest("[data-ask]");
      if (!button) return;
      ask(button.getAttribute("data-ask"));
    });

    fetch("./data/guide.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("guide");
        return res.json();
      })
      .then(function (json) { data = json; })
      .catch(function () { data = { failed: true, zones: [], facilities: [] }; });
  });
})();
