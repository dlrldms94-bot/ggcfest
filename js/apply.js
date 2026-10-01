const reserveOpen = window.GGCFEST_CONFIG?.reserveOpen === true;
const toastEl = document.getElementById("toast");
const applyPanel = document.getElementById("applyPanel");
const applySoonView = document.getElementById("applySoonView");
const applyFormView = document.getElementById("applyFormView");
const summonsResult = document.getElementById("summonsResult");
const summonsPreview = document.getElementById("summonsPreview");
const summonsDownload = document.getElementById("summonsDownload");
let summonsObjectUrl = "";

const SUMMONS = {
  src: "./img/summons.jpg",
  width: 724,
  height: 1024,
  scale: 2,
  x: 524 / 724,
  y: 364 / 1024,
  maxWidth: 90 / 724,
  fontSize: 32 / 724,
  minFontSize: 20 / 724,
  color: "#58507e",
};
const summonsTemplate = new Image();
summonsTemplate.src = SUMMONS.src;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("is-on");
  clearTimeout(toast.tid);
  toast.tid = setTimeout(() => toastEl.classList.remove("is-on"), 2400);
}

function resetApplyView() {
  if (!reserveOpen) return;
  applyFormView.hidden = false;
  applySoonView.hidden = true;
  summonsResult.hidden = true;
  applyPanel.classList.remove("is-summons");
  if (summonsObjectUrl) {
    URL.revokeObjectURL(summonsObjectUrl);
    summonsObjectUrl = "";
  }
  summonsPreview.removeAttribute("src");
  summonsDownload.removeAttribute("href");
  const form = document.getElementById("applyForm");
  if (form) {
    form.reset();
    resetReserveFormFields(form);
  }
}

async function createSummonsImage(name) {
  await document.fonts.ready.catch(() => {});
  if (!summonsTemplate.complete || !summonsTemplate.naturalWidth) {
    await new Promise((resolve, reject) => {
      summonsTemplate.onload = resolve;
      summonsTemplate.onerror = reject;
      if (!summonsTemplate.src) summonsTemplate.src = SUMMONS.src;
    });
  }

  const srcW = summonsTemplate.naturalWidth || SUMMONS.width;
  const srcH = summonsTemplate.naturalHeight || SUMMONS.height;
  const scale = SUMMONS.scale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(summonsTemplate, 0, 0, canvas.width, canvas.height);

  const label = name;
  let size = SUMMONS.fontSize * srcW * scale;
  const maxWidth = SUMMONS.maxWidth * srcW * scale;
  const minSize = SUMMONS.minFontSize * srcW * scale;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = SUMMONS.color;
  ctx.font = "800 " + size + 'px "SUIT Variable", "Apple SD Gothic Neo", sans-serif';
  while (size > minSize && ctx.measureText(label).width > maxWidth) {
    size -= 1;
    ctx.font = "800 " + size + 'px "SUIT Variable", "Apple SD Gothic Neo", sans-serif';
  }

  ctx.fillText(label, SUMMONS.x * srcW * scale, SUMMONS.y * srcH * scale);

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.95);
  });
  return blob;
}

function initApplyPage() {
  if (!reserveOpen) {
    applySoonView.hidden = false;
    applyFormView.hidden = true;
    summonsResult.hidden = true;
    return;
  }
  resetApplyView();
}

document.getElementById("applyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!reserveOpen) return;
  const form = e.target;
  const submit = form.querySelector("button[type='submit']");
  const payload = readReservationForm(form);
  if (!payload.day.length) {
    toast("방문 희망일을 하나 이상 선택해 주세요.");
    openReservePicker(form, "day");
    return;
  }
  if (!payload.program.length) {
    toast("참여 예정 프로그램을 하나 이상 선택해 주세요.");
    openReservePicker(form, "program");
    return;
  }
  if (!payload.privacy) {
    toast("개인정보 수집·이용에 동의해 주세요.");
    const privacy = form.querySelector('input[name="privacy"]');
    if (privacy) privacy.focus();
    return;
  }
  const name = payload.name;
  submit.disabled = true;
  try {
    fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

    const blob = await createSummonsImage(name);
    if (!blob) throw new Error("summons");
    if (summonsObjectUrl) URL.revokeObjectURL(summonsObjectUrl);
    summonsObjectUrl = URL.createObjectURL(blob);
    summonsPreview.src = summonsObjectUrl;
    summonsDownload.href = summonsObjectUrl;
    summonsDownload.download = "강감찬소환장-" + name + ".jpg";
    applyFormView.hidden = true;
    summonsResult.hidden = false;
    applyPanel.classList.add("is-summons");
  } catch (error) {
    toast("소환장을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("[data-reset-apply]")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("applyForm").reset();
  resetApplyView();
});

initApplyPage();
