const toastEl = document.getElementById("toast");
const applyPanel = document.getElementById("applyPanel");
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
  applyFormView.hidden = false;
  summonsResult.hidden = true;
  applyPanel.classList.remove("is-summons");
  if (summonsObjectUrl) {
    URL.revokeObjectURL(summonsObjectUrl);
    summonsObjectUrl = "";
  }
  summonsPreview.removeAttribute("src");
  summonsDownload.removeAttribute("href");
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

document.getElementById("applyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const submit = form.querySelector("button[type='submit']");
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  submit.disabled = true;
  try {
    fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        phone: data.get("phone"),
        day: data.get("day"),
      }),
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

resetApplyView();
