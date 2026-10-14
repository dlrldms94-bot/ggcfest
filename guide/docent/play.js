(function () {
  "use strict";

  var audio = document.querySelector("[data-docent-audio]");
  var button = document.querySelector("[data-docent-play]");
  if (!audio || !button) return;

  var place = button.getAttribute("data-place") || "이 장소";

  function label(playing) {
    button.textContent = playing ? "일시정지" : place + " 설명 듣기";
    button.setAttribute("aria-pressed", playing ? "true" : "false");
  }

  label(false);

  button.addEventListener("click", function () {
    if (audio.paused) {
      var pending = audio.play();
      if (pending && pending.catch) {
        pending.catch(function () {
          button.disabled = true;
          button.textContent = "음성을 재생하지 못했어요";
        });
      }
    } else {
      audio.pause();
    }
  });

  audio.addEventListener("play", function () { label(true); });
  audio.addEventListener("pause", function () {
    if (button.disabled) return;
    label(false);
  });
  audio.addEventListener("ended", function () {
    if (button.disabled) return;
    label(false);
  });
  audio.addEventListener("error", function () {
    button.disabled = true;
    button.textContent = "음성을 불러오지 못했어요";
  });
})();
