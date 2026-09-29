const RESERVE_VISIT_DAYS = ["10월 16일 (금)", "10월 17일 (토)", "10월 18일 (일)"];

const RESERVE_PROGRAMS = [
  "10주년기념특별공연",
  "21동네한바퀴",
  "고려장터",
  "시민풍류제",
  "벽란도21",
  "청년드림콘서트",
  "강감찬토크쇼퀴즈쇼",
  "생활예술페스티벌",
  "10주년기념학술대회",
  "리딩데이: 로열인문학",
];

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function positionPickerMenu(picker) {
  const menu = picker.querySelector(".reserve-picker__menu");
  const trigger = picker.querySelector(".reserve-picker__trigger");
  if (!menu || !trigger) return;
  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const maxMenu = 240;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
  const spaceAbove = rect.top - gap - 12;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(maxMenu, openUp ? spaceAbove : spaceBelow);

  menu.style.position = "fixed";
  menu.style.left = rect.left + "px";
  menu.style.width = rect.width + "px";
  menu.style.maxHeight = Math.max(120, maxHeight) + "px";
  menu.style.overflowY = "auto";
  menu.style.overflowX = "hidden";
  if (openUp) {
    menu.style.top = "";
    menu.style.bottom = window.innerHeight - rect.top + gap + "px";
  } else {
    menu.style.bottom = "";
    menu.style.top = rect.bottom + gap + "px";
  }
}

function clearPickerMenuPosition(menu) {
  if (!menu) return;
  menu.style.position = "";
  menu.style.left = "";
  menu.style.top = "";
  menu.style.bottom = "";
  menu.style.width = "";
  menu.style.maxHeight = "";
  menu.style.overflowY = "";
  menu.style.overflowX = "";
}

function closePicker(picker) {
  picker.classList.remove("is-open");
  const menu = picker.querySelector(".reserve-picker__menu");
  const trigger = picker.querySelector(".reserve-picker__trigger");
  if (menu) {
    menu.hidden = true;
    clearPickerMenuPosition(menu);
  }
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function closeAllPickers(root) {
  const scope = root || document;
  scope.querySelectorAll(".reserve-picker.is-open").forEach(closePicker);
}

function closeOtherPickers(current) {
  document.querySelectorAll(".reserve-picker.is-open").forEach((picker) => {
    if (picker !== current) closePicker(picker);
  });
}

function initPicker(picker) {
  if (picker.dataset.pickerReady === "1") return;
  picker.dataset.pickerReady = "1";

  const input = picker.querySelector('input[type="hidden"]');
  const trigger = picker.querySelector(".reserve-picker__trigger");
  const menu = picker.querySelector(".reserve-picker__menu");
  const label = picker.querySelector(".reserve-picker__label");
  const placeholder = picker.dataset.placeholder || "선택";

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = !picker.classList.contains("is-open");
    closeOtherPickers(picker);
    picker.classList.toggle("is-open", open);
    if (open) {
      positionPickerMenu(picker);
      menu.hidden = false;
    } else {
      closePicker(picker);
      return;
    }
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  menu.querySelectorAll(".reserve-picker__option").forEach((option) => {
    option.addEventListener("click", (e) => {
      e.preventDefault();
      const value = option.dataset.value || "";
      input.value = value;
      label.textContent = value || placeholder;
      label.classList.toggle("is-placeholder", !value);
      menu.querySelectorAll(".reserve-picker__option").forEach((el) => {
        el.classList.toggle("is-selected", el === option);
      });
      closePicker(picker);
    });
  });
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

function initBirthFields(form) {
  const yearEl = form.elements.birthYear;
  if (!yearEl || yearEl.dataset.birthReady === "1") return;
  yearEl.dataset.birthReady = "1";
  fillBirthYears(yearEl);
  form.elements.birthYear.addEventListener("change", () => updateBirthDays(form));
  form.elements.birthMonth.addEventListener("change", () => updateBirthDays(form));
}

function resetPicker(picker) {
  const input = picker.querySelector('input[type="hidden"]');
  const label = picker.querySelector(".reserve-picker__label");
  const placeholder = picker.dataset.placeholder || "선택";
  input.value = "";
  label.textContent = placeholder;
  label.classList.add("is-placeholder");
  picker.querySelectorAll(".reserve-picker__option").forEach((el) => {
    el.classList.remove("is-selected");
  });
  closePicker(picker);
}

function resetReserveFormFields(form) {
  if (!form) return;
  closeAllPickers(form);
  form.querySelectorAll(".reserve-picker").forEach(resetPicker);
  if (form.elements.birthDay) {
    form.elements.birthDay.innerHTML = '<option value="">일</option>';
  }
}

function buildPickerMenuOptions(values) {
  return values
    .map(
      (value) =>
        '<button type="button" class="reserve-picker__option" data-value="' +
        value.replace(/"/g, "&quot;") +
        '" role="option">' +
        value +
        "</button>"
    )
    .join("");
}

function mountPickerMenus() {
  document.querySelectorAll('.reserve-picker[data-picker-options="visit"]').forEach((picker) => {
    const menu = picker.querySelector(".reserve-picker__menu");
    if (menu && !menu.children.length) {
      menu.innerHTML = buildPickerMenuOptions(RESERVE_VISIT_DAYS);
    }
  });
  document.querySelectorAll('.reserve-picker[data-picker-options="program"]').forEach((picker) => {
    const menu = picker.querySelector(".reserve-picker__menu");
    if (menu && !menu.children.length) {
      menu.innerHTML = buildPickerMenuOptions(RESERVE_PROGRAMS);
    }
  });
}

function initReserveForm(form) {
  mountPickerMenus();
  form.querySelectorAll(".reserve-picker").forEach(initPicker);
  initBirthFields(form);
}

function initAllReserveForms() {
  document.querySelectorAll("form.reserve-form").forEach(initReserveForm);
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".reserve-picker")) closeAllPickers();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllPickers();
});

window.addEventListener(
  "scroll",
  (event) => {
    if (event.target instanceof Element && event.target.closest(".reserve-picker__menu")) {
      return;
    }
    closeAllPickers();
  },
  true
);
window.addEventListener("resize", () => {
  closeAllPickers();
});

initAllReserveForms();
