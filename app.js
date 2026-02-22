const DEADLINE = new Date("2027-06-01T00:00:00");
const START_KEY = "graduation-countdown-start";
const NOTES_KEY = "graduation-day-notes";
const DAY_MS = 24 * 60 * 60 * 1000;

const remainingTitle = document.getElementById("remainingTitle");
const dateInfo = document.getElementById("dateInfo");
const todayText = document.getElementById("todayText");
const boxCountText = document.getElementById("boxCountText");
const monthRow = document.getElementById("monthRow");
const weeksGrid = document.getElementById("weeksGrid");

const tooltip = document.getElementById("tooltip");
const editorModal = document.getElementById("editorModal");
const editorDate = document.getElementById("editorDate");
const editorInput = document.getElementById("editorInput");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const cancelBtn = document.getElementById("cancelBtn");

const trLong = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const trMonth = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
});

let notes = readNotes();
let currentEditDateKey = null;
let hoveredDateKey = null;

const deadlineStart = toStartOfDay(DEADLINE);
const countdownStart = getCountdownStart();
const timeline = buildDateRange(countdownStart, deadlineStart);
const calendarWeeks = buildCalendarWeeks(countdownStart, deadlineStart);

renderStatic();
renderCalendar();
updateLiveState();

window.setInterval(updateLiveState, 60_000);
window.addEventListener("resize", () => {
  if (!tooltip.classList.contains("hidden") && hoveredDateKey) {
    const cell = weeksGrid.querySelector(`[data-date='${hoveredDateKey}']`);
    positionTooltip(cell);
  }
});

saveBtn.addEventListener("click", handleSave);
clearBtn.addEventListener("click", handleClear);
cancelBtn.addEventListener("click", closeEditor);
editorModal.addEventListener("click", (event) => {
  if (event.target === editorModal) {
    closeEditor();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !editorModal.classList.contains("hidden")) {
    closeEditor();
  }
});

function renderStatic() {
  dateInfo.textContent = `Hedef tarih: ${trLong.format(DEADLINE)}`;
  boxCountText.textContent = `Toplam aktif kutucuk: ${timeline.length}`;
}

function renderCalendar() {
  monthRow.innerHTML = "";
  weeksGrid.innerHTML = "";

  let lastLabeledMonth = -1;

  calendarWeeks.forEach((week, weekIndex) => {
    const label = document.createElement("span");
    label.className = "month-label";

    const labelDate = getMonthLabelDate(week, weekIndex);
    if (labelDate && labelDate.getMonth() !== lastLabeledMonth) {
      label.textContent = trMonth.format(labelDate);
      lastLabeledMonth = labelDate.getMonth();
    }

    monthRow.appendChild(label);

    const weekColumn = document.createElement("div");
    weekColumn.className = "week-column";

    week.forEach((item) => {
      const box = document.createElement("button");
      box.type = "button";
      box.className = "day-box";

      if (!item.active) {
        box.classList.add("placeholder");
        box.tabIndex = -1;
      } else {
        const dateKey = formatDateKey(item.date);
        box.dataset.date = dateKey;
        box.setAttribute("aria-label", `${trLong.format(item.date)} notlarını düzenle`);

        box.addEventListener("mouseenter", () => showTooltip(box, item.date));
        box.addEventListener("mouseleave", hideTooltip);
        box.addEventListener("focus", () => showTooltip(box, item.date));
        box.addEventListener("blur", hideTooltip);
        box.addEventListener("click", () => openEditor(item.date));
      }

      weekColumn.appendChild(box);
    });

    weeksGrid.appendChild(weekColumn);
  });
}

function updateLiveState() {
  const today = toStartOfDay(new Date());
  const remaining = Math.max(0, daysBetween(today, deadlineStart));

  if (remaining === 0) {
    remainingTitle.textContent = "Mezuniyet günü geldi!";
  } else {
    remainingTitle.textContent = `Mezuniyetime kalan süre: ${remaining} gün`;
  }

  todayText.textContent = `Bugün: ${trLong.format(today)}`;

  const boxes = weeksGrid.querySelectorAll(".day-box[data-date]");
  boxes.forEach((box) => {
    const dateKey = box.dataset.date;
    const date = parseDateKey(dateKey);
    const noteCount = Array.isArray(notes[dateKey]) ? notes[dateKey].length : 0;

    box.classList.remove(
      "dead",
      "future",
      "level-1",
      "level-2",
      "level-3",
      "level-4",
      "today"
    );

    if (noteCount > 0) {
      box.classList.add(levelClass(noteCount));
    } else if (date < today) {
      box.classList.add("dead");
    } else {
      box.classList.add("future");
    }

    if (isSameDay(date, today)) {
      box.classList.add("today");
    }
  });
}

function getMonthLabelDate(week, weekIndex) {
  if (weekIndex === 0) {
    const firstActive = week.find((item) => item.active);
    return firstActive ? firstActive.date : null;
  }

  const monthStart = week.find((item) => item.active && item.date.getDate() === 1);
  return monthStart ? monthStart.date : null;
}

function levelClass(count) {
  if (count >= 4) return "level-4";
  if (count === 3) return "level-3";
  if (count === 2) return "level-2";
  return "level-1";
}

function openEditor(date) {
  hideTooltip();
  const dateKey = formatDateKey(date);
  currentEditDateKey = dateKey;

  editorDate.textContent = trLong.format(date);
  const items = notes[dateKey] || [];
  editorInput.value = items.join("\n");

  editorModal.classList.remove("hidden");
  editorModal.setAttribute("aria-hidden", "false");

  window.setTimeout(() => editorInput.focus(), 0);
}

function closeEditor() {
  editorModal.classList.add("hidden");
  editorModal.setAttribute("aria-hidden", "true");
  currentEditDateKey = null;
}

function handleSave() {
  if (!currentEditDateKey) return;

  const rows = editorInput.value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  if (rows.length > 0) {
    notes[currentEditDateKey] = rows;
  } else {
    delete notes[currentEditDateKey];
  }

  persistNotes(notes);
  renderCalendar();
  updateLiveState();
  closeEditor();
}

function handleClear() {
  if (!currentEditDateKey) return;

  delete notes[currentEditDateKey];
  persistNotes(notes);
  renderCalendar();
  updateLiveState();
  closeEditor();
}

function showTooltip(box, date) {
  const dateKey = formatDateKey(date);
  hoveredDateKey = dateKey;

  const items = notes[dateKey] || [];
  const lines = items.length
    ? items.map((item) => `• ${item}`).join("\n")
    : "Henüz not yok.";

  tooltip.textContent = `${trLong.format(date)}\n${lines}`;
  tooltip.classList.remove("hidden");
  tooltip.setAttribute("aria-hidden", "false");

  positionTooltip(box);
}

function hideTooltip() {
  hoveredDateKey = null;
  tooltip.classList.add("hidden");
  tooltip.setAttribute("aria-hidden", "true");
}

function positionTooltip(box) {
  if (!box) return;

  const rect = box.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 10;

  let top = rect.top - tooltipRect.height - margin;
  if (top < margin) {
    top = rect.bottom + margin;
  }

  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function getCountdownStart() {
  const today = toStartOfDay(new Date());
  const safeStart = today <= deadlineStart ? today : deadlineStart;
  const stored = localStorage.getItem(START_KEY);

  if (stored) {
    const parsed = parseDateKey(stored);
    if (!Number.isNaN(parsed.getTime()) && parsed <= deadlineStart) {
      return parsed;
    }
  }

  localStorage.setItem(START_KEY, formatDateKey(safeStart));
  return safeStart;
}

function buildDateRange(start, endExclusive) {
  const size = Math.max(0, daysBetween(start, endExclusive));
  const list = [];

  for (let i = 0; i < size; i += 1) {
    list.push(addDays(start, i));
  }

  return list;
}

function buildCalendarWeeks(activeStart, activeEndExclusive) {
  if (activeEndExclusive <= activeStart) {
    return [];
  }

  const gridStart = startOfWeekMonday(activeStart);
  const lastActiveDay = addDays(activeEndExclusive, -1);
  const gridEndExclusive = addDays(endOfWeekSunday(lastActiveDay), 1);

  const allGridDays = buildDateRange(gridStart, gridEndExclusive);
  const weeks = [];

  for (let i = 0; i < allGridDays.length; i += 7) {
    const slice = allGridDays.slice(i, i + 7).map((date) => ({
      date,
      active: date >= activeStart && date < activeEndExclusive,
    }));

    weeks.push(slice);
  }

  return weeks;
}

function startOfWeekMonday(date) {
  const d = toStartOfDay(date);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(d, mondayOffset);
}

function endOfWeekSunday(date) {
  const d = toStartOfDay(date);
  const day = d.getDay();
  const sundayOffset = 7 - day;
  return addDays(d, sundayOffset === 7 ? 0 : sundayOffset);
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return toStartOfDay(d);
}

function readNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistNotes(value) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(value));
}

function toStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start, end) {
  return Math.round((end - start) / DAY_MS);
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateKey(date) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}
