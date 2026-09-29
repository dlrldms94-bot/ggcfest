function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function fillBirthYears(select) {
  if (select.options.length > 1) return;
  const now = new Date().getFullYear();
  for (let year = now; year >= 1900; year -= 1) {
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = year + "년";
    select.appendChild(opt);
  }
}

function updateBirthDays(form) {
  const yearEl = form.elements.birthYear;
  const monthEl = form.elements.birthMonth;
  const dayEl = form.elements.birthDay;
  if (!yearEl || !monthEl || !dayEl) return;

  const year = parseInt(yearEl.value, 10);
  const month = parseInt(monthEl.value, 10);
  const prev = dayEl.value;
  dayEl.innerHTML = '<option value="">일</option>';
  if (!year || !month) return;

  const max = daysInMonth(year, month);
  for (let day = 1; day <= max; day += 1) {
    const opt = document.createElement("option");
    opt.value = String(day);
    opt.textContent = day + "일";
    dayEl.appendChild(opt);
  }
  if (prev && parseInt(prev, 10) <= max) dayEl.value = prev;
}

function syncBirthDayState(form) {
  const yearEl = form.elements.birthYear;
  const monthEl = form.elements.birthMonth;
  const dayEl = form.elements.birthDay;
  const hint = form.querySelector(".reserve-birth-hint");
  if (!yearEl || !monthEl || !dayEl) return;

  const ready = Boolean(yearEl.value && monthEl.value);
  dayEl.disabled = !ready;
  if (ready) {
    updateBirthDays(form);
    if (hint) hint.hidden = true;
  } else {
    dayEl.innerHTML = '<option value="">일</option>';
    dayEl.value = "";
    if (hint) hint.hidden = false;
  }
}

function initBirthFields(form) {
  const yearEl = form.elements.birthYear;
  if (!yearEl || yearEl.dataset.birthReady === "1") return;
  yearEl.dataset.birthReady = "1";
  fillBirthYears(yearEl);
  form.elements.birthYear.addEventListener("change", () => syncBirthDayState(form));
  form.elements.birthMonth.addEventListener("change", () => syncBirthDayState(form));
  dayElFocus(form);
  syncBirthDayState(form);
}

function dayElFocus(form) {
  const dayEl = form.elements.birthDay;
  if (!dayEl || dayEl.dataset.dayFocusReady === "1") return;
  dayEl.dataset.dayFocusReady = "1";
  dayEl.addEventListener("focus", () => {
    syncBirthDayState(form);
  });
}

function resetReserveFormFields(form) {
  if (!form) return;
  syncBirthDayState(form);
}

function initReserveForm(form) {
  initBirthFields(form);
}

function validateBirthBeforeSubmit(form) {
  syncBirthDayState(form);
  const yearEl = form.elements.birthYear;
  const monthEl = form.elements.birthMonth;
  const dayEl = form.elements.birthDay;
  if (!yearEl?.value || !monthEl?.value) return true;
  if (dayEl?.disabled || !dayEl?.value) {
    dayEl.disabled = false;
    updateBirthDays(form);
    dayEl.focus();
    return false;
  }
  return true;
}

function initAllReserveForms() {
  document.querySelectorAll("form.reserve-form").forEach((form) => {
    initReserveForm(form);
    if (form.dataset.birthSubmitReady === "1") return;
    form.dataset.birthSubmitReady = "1";
    form.addEventListener(
      "submit",
      (event) => {
        if (!validateBirthBeforeSubmit(form)) event.preventDefault();
      },
      true
    );
  });
}

initAllReserveForms();
