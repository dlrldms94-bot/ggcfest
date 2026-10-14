(function () {
  var key = "ggcfest-visitor-id";

  function visitorId() {
    var id = localStorage.getItem(key);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + "-" + Math.random().toString(16).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function pagePath() {
    return String(location.pathname || "/") + String(location.hash || "");
  }

  function send() {
    try {
      var payload = JSON.stringify({
        visitorId: visitorId(),
        page: pagePath(),
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/visits", new Blob([payload], { type: "application/json" }));
        return;
      }
      fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch (error) {}
  }

  send();
  window.addEventListener("hashchange", send);
})();
