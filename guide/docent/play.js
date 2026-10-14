(function () {
  "use strict";

  var audio = document.querySelector("[data-docent-audio]");
  var button = document.querySelector("[data-docent-play]");
  if (!audio || !button) return;

  var place = button.getAttribute("data-place") || "";
  var caption = document.querySelector("[data-docent-label]");
  var playIcon = button.querySelector(".docent-play__play");
  var pauseIcon = button.querySelector(".docent-play__pause");
  var wave = document.querySelector("[data-docent-wave]");
  var seek = document.querySelector("[data-docent-seek]");
  var current = document.querySelector("[data-docent-current]");
  var duration = document.querySelector("[data-docent-duration]");
  var back = document.querySelector("[data-docent-back]");
  var forward = document.querySelector("[data-docent-forward]");
  var speed = document.querySelector("[data-docent-speed]");
  var restart = document.querySelector("[data-docent-restart]");

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "--:--";
    var minutes = Math.floor(seconds / 60);
    var remaining = Math.floor(seconds % 60);
    return (minutes < 10 ? "0" : "") + minutes + ":" + (remaining < 10 ? "0" : "") + remaining;
  }

  function updateTimeline() {
    var length = isFinite(audio.duration) ? audio.duration : 0;
    var position = isFinite(audio.currentTime) ? audio.currentTime : 0;
    var percent = length ? Math.min(100, Math.max(0, position / length * 100)) : 0;
    if (seek) {
      seek.value = String(percent);
      seek.style.setProperty("--progress", percent + "%");
    }
    if (current) current.textContent = formatTime(position);
    if (duration) duration.textContent = length ? formatTime(length) : "--:--";
  }

  function setPlaying(playing) {
    var text = playing ? "일시정지" : "재생";
    button.setAttribute("aria-pressed", playing ? "true" : "false");
    button.setAttribute("aria-label", (place ? place + " " : "") + text);
    if (caption) caption.textContent = text;
    if (playIcon) playIcon.hidden = playing;
    if (pauseIcon) pauseIcon.hidden = !playing;
    if (wave) wave.classList.toggle("is-playing", playing);
  }

  function fail(message) {
    button.disabled = true;
    if (caption) caption.textContent = message;
    button.setAttribute("aria-label", message);
    if (playIcon) playIcon.hidden = false;
    if (pauseIcon) pauseIcon.hidden = true;
    if (wave) wave.classList.remove("is-playing");
  }

  setPlaying(false);
  updateTimeline();

  function tryAutoplay() {
    if (button.disabled || !audio.paused) return;
    var pending = audio.play();
    if (pending && pending.catch) {
      pending.catch(function () {
        setPlaying(false);
      });
    }
  }

  audio.autoplay = true;
  tryAutoplay();

  button.addEventListener("click", function () {
    if (button.disabled) return;
    if (audio.paused) {
      var pending = audio.play();
      if (pending && pending.catch) {
        pending.catch(function () { fail("음성을 재생하지 못했어요"); });
      }
    } else {
      audio.pause();
    }
  });

  audio.addEventListener("play", function () { setPlaying(true); });
  audio.addEventListener("pause", function () {
    if (button.disabled) return;
    setPlaying(false);
  });
  audio.addEventListener("ended", function () {
    if (button.disabled) return;
    setPlaying(false);
    updateTimeline();
  });
  audio.addEventListener("error", function () { fail("음성을 불러오지 못했어요"); });
  audio.addEventListener("loadedmetadata", updateTimeline);
  audio.addEventListener("durationchange", updateTimeline);
  audio.addEventListener("timeupdate", updateTimeline);

  if (seek) {
    seek.addEventListener("input", function () {
      if (!isFinite(audio.duration)) return;
      audio.currentTime = audio.duration * Number(seek.value) / 100;
      updateTimeline();
    });
  }

  if (back) {
    back.addEventListener("click", function () {
      audio.currentTime = Math.max(0, audio.currentTime - 10);
      updateTimeline();
    });
  }

  if (forward) {
    forward.addEventListener("click", function () {
      var end = isFinite(audio.duration) ? audio.duration : audio.currentTime + 10;
      audio.currentTime = Math.min(end, audio.currentTime + 10);
      updateTimeline();
    });
  }

  if (speed) {
    speed.addEventListener("change", function () {
      audio.playbackRate = Number(speed.value) || 1;
    });
  }

  if (restart) {
    restart.addEventListener("click", function () {
      audio.currentTime = 0;
      updateTimeline();
      var pending = audio.play();
      if (pending && pending.catch) {
        pending.catch(function () { fail("음성을 재생하지 못했어요"); });
      }
    });
  }

})();
