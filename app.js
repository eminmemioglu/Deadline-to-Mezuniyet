const DEADLINE = new Date("2027-06-01T00:00:00");
const START_KEY = "graduation-countdown-start";
const NOTES_KEY = "graduation-day-notes";
const DAY_MS = 24 * 60 * 60 * 1000;

const remainingTitle = document.getElementById("remainingTitle");
const dateInfo = document.getElementById("dateInfo");
const todayText = document.getElementById("todayText");
const boxCountText = document.getElementById("boxCountText");
const daysGrid = document.getElementById("daysGrid");

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

let notes = readNotes();
let currentEditDateKey = null;

const countdownStart = getCountdownStart();
const timeline = buildTimeline(countdownStart, toStartOfDay(DEADLINE));

renderStatic();
renderBoxes();
updateLiveState();

window.setInterval(updateLiveState, 60_000);
window.addEventListener("resize", () => {
  if (!tooltip.classList.contains("hidden") && currentEditDateKey) {
    positionTooltip(document.querySelector(`[data-date='${currentEditDateKey}']`));
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
  boxCountText.textContent = `Toplam kutucuk: ${timeline.length}`;
}

function updateLiveState() {
  const today = toStartOfDay(new Date());
  const remaining = Math.max(0, daysBetween(today, toStartOfDay(DEADLINE)));

  if (remaining === 0) {
    remainingTitle.textContent = "Mezuniyet günü geldi!";
  } else {
    remainingTitle.textContent = `Mezuniyetime kalan süre: ${remaining} gün`;
  }

  todayText.textContent = `Bugün: ${trLong.format(today)}`;

  const boxes = daysGrid.querySelectorAll(".day-box");
  boxes.forEach((box) => {
    const boxDate = parseDateKey(box.dataset.date);
    box.classList.remove("done", "today");

    if (boxDate < today) {
      box.classList.add("done");
    } else if (isSameDay(boxDate, today)) {
      box.classList.add("today");
    }
  });
}

function renderBoxes() {
  daysGrid.innerHTML = "";

  timeline.forEach((date) => {
    const dateKey = formatDateKey(date);
    const box = document.createElement("button");
    box.type = "button";
    box.className = "day-box";
    box.dataset.date = dateKey;
    box.setAttribute("aria-label", `${trLong.format(date)} notlarını düzenle`);

    if (Array.isArray(notes[dateKey]) && notes[dateKey].length > 0) {
      box.classList.add("with-note");
    }

    box.addEventListener("mouseenter", () => showTooltip(box, date));
    box.addEventListener("mouseleave", hideTooltip);
    box.addEventListener("focus", () => showTooltip(box, date));
    box.addEventListener("blur", hideTooltip);
    box.addEventListener("click", () => openEditor(date));

    daysGrid.appendChild(box);
  });
}

function openEditor(date) {
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
  renderBoxes();
  updateLiveState();
  closeEditor();
}

function handleClear() {
  if (!currentEditDateKey) return;

  delete notes[currentEditDateKey];
  persistNotes(notes);
  renderBoxes();
  updateLiveState();
  closeEditor();
}

function showTooltip(box, date) {
  const dateKey = formatDateKey(date);
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
  const deadline = toStartOfDay(DEADLINE);
  const stored = localStorage.getItem(START_KEY);

  if (stored) {
    const parsed = parseDateKey(stored);
    if (!Number.isNaN(parsed.getTime()) && parsed <= deadline) {
      return parsed;
    }
  }

  localStorage.setItem(START_KEY, formatDateKey(today));
  return today;
}

function buildTimeline(start, end) {
  const size = Math.max(0, daysBetween(start, end));
  const list = [];

  for (let i = 0; i < size; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    list.push(toStartOfDay(day));
  }

  return list;
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
