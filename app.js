const STORAGE_KEY = "kaiser_path_v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const state = loadState();
let viewedMonth = new Date();
viewedMonth.setDate(1);

const todayText = $("#todayText");
const habitList = $("#habitList");
const emptyState = $("#emptyState");
const totalHabits = $("#totalHabits");
const doneToday = $("#doneToday");
const progressToday = $("#progressToday");
const progressFill = $("#progressFill");
const weekGrid = $("#weekGrid");
const habitModal = $("#habitModal");
const habitForm = $("#habitForm");

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { habits: [] };
  } catch {
    return { habits: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISO(d);
}

function formatToday() {
  const d = new Date();
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function createHabit({ name, goal, category, color }) {
  const now = new Date().toISOString();

  state.habits.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    goal,
    category,
    color,
    createdAt: now,
    completions: {}
  });

  saveState();
  render();
}

function isDoneOn(habit, iso) {
  return Boolean(habit.completions?.[iso]);
}

function isDoneToday(habit) {
  return isDoneOn(habit, todayISO());
}

function toggleToday(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const key = todayISO();
  habit.completions = habit.completions || {};

  if (habit.completions[key]) {
    delete habit.completions[key];
  } else {
    habit.completions[key] = true;
  }

  saveState();
  render();
}

function deleteHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const confirmed = confirm(`Excluir o hábito "${habit.name}"?`);
  if (!confirmed) return;

  state.habits = state.habits.filter(h => h.id !== id);
  saveState();
  render();
}

function getCurrentStreak(habit) {
  let streak = 0;

  for (let offset = 0; offset > -3650; offset--) {
    const date = todayISO(offset);
    if (isDoneOn(habit, date)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function getBestStreak(habit) {
  const dates = Object.keys(habit.completions || {})
    .filter(date => habit.completions[date])
    .sort();

  if (!dates.length) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00");
    const curr = new Date(dates[i] + "T00:00:00");
    const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      current++;
      best = Math.max(best, current);
    } else if (diff > 1) {
      current = 1;
    }
  }

  return best;
}

function getTotalCompletions(habit) {
  return Object.values(habit.completions || {}).filter(Boolean).length;
}

function getMonthDates(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
}

function getMonthStats(date) {
  const dates = getMonthDates(date).map(toISO);
  const totalHabitsCount = state.habits.length;
  const possibleChecks = dates.length * totalHabitsCount;

  let doneChecks = 0;
  dates.forEach(iso => {
    doneChecks += state.habits.filter(h => isDoneOn(h, iso)).length;
  });

  const percent = possibleChecks ? Math.round((doneChecks / possibleChecks) * 100) : 0;

  return { dates, totalHabitsCount, possibleChecks, doneChecks, percent };
}

function renderHabits() {
  habitList.innerHTML = "";
  emptyState.style.display = state.habits.length ? "none" : "block";

  const template = $("#habitTemplate");

  state.habits.forEach(habit => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".habit-card");
    const checkBtn = node.querySelector(".check-btn");
    const deleteBtn = node.querySelector(".delete-btn");

    card.style.setProperty("--habit-color", habit.color || "#2f80ed");
    if (isDoneToday(habit)) card.classList.add("done");

    node.querySelector("h3").textContent = habit.name;
    node.querySelector("p").textContent = `${habit.category || "Outro"}${habit.goal ? " • " + habit.goal : ""}`;
    node.querySelector(".streak").textContent = getCurrentStreak(habit);
    node.querySelector(".best").textContent = getBestStreak(habit);
    node.querySelector(".total").textContent = getTotalCompletions(habit);

    checkBtn.addEventListener("click", () => toggleToday(habit.id));
    deleteBtn.addEventListener("click", () => deleteHabit(habit.id));

    habitList.appendChild(node);
  });
}

function renderSummary() {
  const total = state.habits.length;
  const done = state.habits.filter(isDoneToday).length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  totalHabits.textContent = total;
  doneToday.textContent = done;
  progressToday.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
}

function renderWeek() {
  weekGrid.innerHTML = "";

  for (let offset = -6; offset <= 0; offset++) {
    const date = new Date();
    date.setDate(date.getDate() + offset);

    const iso = todayISO(offset);
    const dayName = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const dayNumber = date.getDate();

    const total = state.habits.length;
    const done = state.habits.filter(h => isDoneOn(h, iso)).length;
    const percent = total ? Math.round((done / total) * 100) : 0;

    const item = document.createElement("div");
    item.className = "day-pill";
    if (offset === 0) item.classList.add("today");

    item.innerHTML = `
      <span class="day-name">${dayName}</span>
      <span class="day-number">${dayNumber}</span>
      <span class="day-score">${percent}%</span>
    `;

    weekGrid.appendChild(item);
  }
}

function renderCalendar() {
  const calendarGrid = $("#calendarGrid");
  const monthTitle = $("#monthTitle");
  const monthSummary = $("#monthSummary");

  calendarGrid.innerHTML = "";

  const monthName = viewedMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  monthTitle.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const { percent } = getMonthStats(viewedMonth);
  monthSummary.textContent = `${percent}%`;

  const firstDay = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), 1);
  const startBlanks = firstDay.getDay();

  for (let i = 0; i < startBlanks; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-day blank";
    calendarGrid.appendChild(blank);
  }

  getMonthDates(viewedMonth).forEach(date => {
    const iso = toISO(date);
    const total = state.habits.length;
    const done = state.habits.filter(h => isDoneOn(h, iso)).length;
    const percentDay = total ? Math.round((done / total) * 100) : 0;

    const day = document.createElement("div");
    day.className = "calendar-day";
    if (iso === todayISO()) day.classList.add("today");
    if (percentDay === 100 && total > 0) day.classList.add("full");
    else if (percentDay > 0) day.classList.add("partial");

    day.innerHTML = `
      <span class="num">${date.getDate()}</span>
      <span class="done-count">${done}/${total}</span>
    `;

    calendarGrid.appendChild(day);
  });

  const nextMonthBtn = $("#nextMonth");
  const nowMonth = new Date();
  nowMonth.setDate(1);

  nextMonthBtn.disabled = sameMonth(viewedMonth, nowMonth) || viewedMonth > nowMonth;
  nextMonthBtn.style.opacity = nextMonthBtn.disabled ? ".35" : "1";
}

function renderMonthlyDetails() {
  const wrap = $("#monthlyHabitDetails");
  wrap.innerHTML = "";

  if (!state.habits.length) {
    wrap.innerHTML = `<p class="muted">Adicione hábitos para visualizar o histórico mensal.</p>`;
    return;
  }

  const dates = getMonthDates(viewedMonth).map(toISO);

  state.habits.forEach(habit => {
    const done = dates.filter(iso => isDoneOn(habit, iso)).length;
    const total = dates.length;
    const percent = total ? Math.round((done / total) * 100) : 0;

    const row = document.createElement("article");
    row.className = "month-row";
    row.style.setProperty("--habit-color", habit.color || "#2f80ed");

    row.innerHTML = `
      <div class="month-row-top">
        <div>
          <strong>${habit.name}</strong>
          <span>${done} de ${total} dias concluídos</span>
        </div>
        <span class="pill">${percent}%</span>
      </div>
      <div class="row-progress"><div style="width:${percent}%"></div></div>
    `;

    wrap.appendChild(row);
  });
}

function renderHistory() {
  renderCalendar();
  renderMonthlyDetails();
}

function render() {
  todayText.textContent = formatToday();
  renderSummary();
  renderHabits();
  renderWeek();
  renderHistory();
}

function exportBackup() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-kaiser-path-${todayISO()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

function importBackupFile(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  file.text().then(text => {
    const imported = JSON.parse(text);

    if (!imported.habits || !Array.isArray(imported.habits)) {
      alert("Arquivo inválido.");
      return;
    }

    const confirmed = confirm("Importar este backup? Isso substituirá os dados atuais neste dispositivo.");
    if (!confirmed) return;

    state.habits = imported.habits;
    saveState();
    render();
  }).catch(() => {
    alert("Não foi possível importar o arquivo.");
  }).finally(() => {
    fileInput.value = "";
  });
}

$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;

    $$(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    $$(".tab-page").forEach(page => page.classList.remove("active"));
    $(`#${target}Tab`).classList.add("active");
  });
});

$("#openHabitModal").addEventListener("click", () => {
  habitModal.showModal();
  $("#habitName").focus();
});

$("#closeHabitModal").addEventListener("click", () => {
  habitModal.close();
});

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = $("#habitName").value.trim();
  const goal = $("#habitGoal").value.trim();
  const category = $("#habitCategory").value;
  const color = $("#habitColor").value;

  if (!name) return;

  createHabit({ name, goal, category, color });

  habitForm.reset();
  $("#habitColor").value = "#2f80ed";
  habitModal.close();
});

$("#prevMonth").addEventListener("click", () => {
  viewedMonth.setMonth(viewedMonth.getMonth() - 1);
  renderHistory();
});

$("#nextMonth").addEventListener("click", () => {
  const next = new Date(viewedMonth);
  next.setMonth(next.getMonth() + 1);

  const nowMonth = new Date();
  nowMonth.setDate(1);

  if (next <= nowMonth) {
    viewedMonth = next;
    renderHistory();
  }
});

$("#exportBtn").addEventListener("click", exportBackup);
$("#exportBtnSettings").addEventListener("click", exportBackup);
$("#importFile").addEventListener("change", (event) => importBackupFile(event.target));

$("#resetBtn").addEventListener("click", () => {
  const confirmed = confirm("Tem certeza que deseja apagar todos os hábitos e históricos deste dispositivo?");
  if (!confirmed) return;

  state.habits = [];
  saveState();
  render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

render();
