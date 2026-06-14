const STORAGE_KEY = "habit_tracker_mobile_v1";

const $ = (selector) => document.querySelector(selector);

const state = loadState();

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

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatToday() {
  const d = new Date();
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
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

function isDoneToday(habit) {
  return Boolean(habit.completions[todayISO()]);
}

function toggleToday(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const key = todayISO();

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
    if (habit.completions[date]) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function getBestStreak(habit) {
  const dates = Object.keys(habit.completions)
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
  return Object.values(habit.completions).filter(Boolean).length;
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

    card.style.setProperty("--habit-color", habit.color || "#7c3aed");
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
    const done = state.habits.filter(h => h.completions[iso]).length;
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

function render() {
  todayText.textContent = formatToday();
  renderSummary();
  renderHabits();
  renderWeek();
}

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
  $("#habitColor").value = "#7c3aed";
  habitModal.close();
});

$("#exportBtn").addEventListener("click", () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-habit-tracker-${todayISO()}.json`;
  a.click();

  URL.revokeObjectURL(url);
});

$("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
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
  } catch {
    alert("Não foi possível importar o arquivo.");
  } finally {
    event.target.value = "";
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

render();
