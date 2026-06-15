const STORAGE_KEY = "kaiser_path_v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const FINANCE_CATEGORIES = {
  "Despesa Fixa": [
    "Intercâmbio", "Parcelas", "Internet / TV / Telefone", "Escola / Faculdade",
    "Previdência / Investimento", "Aluguel / Condomínio", "Transporte fixo", "Plano de saúde"
  ],
  "Despesa Variável": [
    "Alimentação / Supermercado", "Restaurantes / Delivery", "Lazer / Entretenimento",
    "Vestuário / Calçados", "Assinaturas / Streaming", "Educação / Cursos",
    "Cuidados Pessoais", "Outros / Imprevistos", "Transporte variável", "Farmácia"
  ],
  "Receita": ["Salário", "Freelance", "Reembolso", "Outras receitas"]
};

const state = ensureState(loadState());
let viewedMonth = new Date();
viewedMonth.setDate(1);
let viewedFinanceMonth = new Date();
viewedFinanceMonth.setDate(1);

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
const financeModal = $("#financeModal");
const financeForm = $("#financeForm");

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { habits: [], finance: { transactions: [] } };
  } catch {
    return { habits: [], finance: { transactions: [] } };
  }
}

function ensureState(data) {
  data.habits = Array.isArray(data.habits) ? data.habits : [];
  data.finance = data.finance && typeof data.finance === "object" ? data.finance : {};
  data.finance.transactions = Array.isArray(data.finance.transactions) ? data.finance.transactions : [];
  return data;
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

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
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(date) {
  const text = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function createHabit({ name, goal, category, color }) {
  state.habits.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name, goal, category, color,
    createdAt: new Date().toISOString(),
    completions: {}
  });
  saveState(); render();
}

function isDoneOn(habit, iso) { return Boolean(habit.completions?.[iso]); }
function isDoneToday(habit) { return isDoneOn(habit, todayISO()); }

function toggleToday(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;
  const key = todayISO();
  habit.completions = habit.completions || {};
  if (habit.completions[key]) delete habit.completions[key];
  else habit.completions[key] = true;
  saveState(); render();
}

function deleteHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;
  if (!confirm(`Excluir o hábito "${habit.name}"?`)) return;
  state.habits = state.habits.filter(h => h.id !== id);
  saveState(); render();
}

function getCurrentStreak(habit) {
  let streak = 0;
  for (let offset = 0; offset > -3650; offset--) {
    if (isDoneOn(habit, todayISO(offset))) streak++;
    else break;
  }
  return streak;
}

function getBestStreak(habit) {
  const dates = Object.keys(habit.completions || {}).filter(date => habit.completions[date]).sort();
  if (!dates.length) return 0;
  let best = 1, current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00");
    const curr = new Date(dates[i] + "T00:00:00");
    const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diff === 1) { current++; best = Math.max(best, current); }
    else if (diff > 1) current = 1;
  }
  return best;
}

function getTotalCompletions(habit) { return Object.values(habit.completions || {}).filter(Boolean).length; }

function getMonthDates(date) {
  const year = date.getFullYear(), month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
}

function getMonthStats(date) {
  const dates = getMonthDates(date).map(toISO);
  const totalHabitsCount = state.habits.length;
  const possibleChecks = dates.length * totalHabitsCount;
  let doneChecks = 0;
  dates.forEach(iso => { doneChecks += state.habits.filter(h => isDoneOn(h, iso)).length; });
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
    const date = new Date(); date.setDate(date.getDate() + offset);
    const iso = todayISO(offset);
    const total = state.habits.length;
    const done = state.habits.filter(h => isDoneOn(h, iso)).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const item = document.createElement("div");
    item.className = "day-pill";
    if (offset === 0) item.classList.add("today");
    item.innerHTML = `<span class="day-name">${date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span><span class="day-number">${date.getDate()}</span><span class="day-score">${percent}%</span>`;
    weekGrid.appendChild(item);
  }
}

function renderCalendar() {
  const calendarGrid = $("#calendarGrid");
  calendarGrid.innerHTML = "";
  $("#monthTitle").textContent = formatMonth(viewedMonth);
  $("#monthSummary").textContent = `${getMonthStats(viewedMonth).percent}%`;
  const firstDay = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), 1);
  for (let i = 0; i < firstDay.getDay(); i++) {
    const blank = document.createElement("div"); blank.className = "calendar-day blank"; calendarGrid.appendChild(blank);
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
    day.innerHTML = `<span class="num">${date.getDate()}</span><span class="done-count">${done}/${total}</span>`;
    calendarGrid.appendChild(day);
  });
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
    row.innerHTML = `<div class="month-row-top"><div><strong>${habit.name}</strong><span>${done} de ${total} dias concluídos</span></div><span class="pill">${percent}%</span></div><div class="row-progress"><div style="width:${percent}%"></div></div>`;
    wrap.appendChild(row);
  });
}

function renderHistory() { renderCalendar(); renderMonthlyDetails(); }

function populateFinanceCategories() {
  const type = $("#financeType").value;
  const select = $("#financeCategory");
  select.innerHTML = "";
  FINANCE_CATEGORIES[type].forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });
}

function openFinanceForm() {
  $("#financeDate").value = todayISO();
  populateFinanceCategories();
  financeModal.showModal();
}

function createFinanceTransaction(data) {
  state.finance.transactions.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    ...data
  });
  saveState(); renderFinance();
}

function deleteFinanceTransaction(id) {
  const item = state.finance.transactions.find(t => t.id === id);
  if (!item) return;
  if (!confirm(`Excluir lançamento "${item.description}"?`)) return;
  state.finance.transactions = state.finance.transactions.filter(t => t.id !== id);
  saveState(); renderFinance();
}

function transactionsForMonth(date) {
  const key = monthKey(date);
  return state.finance.transactions.filter(t => String(t.date || "").slice(0, 7) === key);
}

function financeTotals(items) {
  return items.reduce((acc, t) => {
    const value = Number(t.value || 0);
    if (t.type === "Receita") acc.income += value;
    else {
      acc.expenses += value;
      if (t.type === "Despesa Fixa") acc.fixed += value;
      if (t.type === "Despesa Variável") acc.variable += value;
    }
    acc.balance = acc.income - acc.expenses;
    return acc;
  }, { income: 0, expenses: 0, fixed: 0, variable: 0, balance: 0 });
}

function renderFinanceSummary(items) {
  const totals = financeTotals(items);
  $("#financeMonthTitle").textContent = formatMonth(viewedFinanceMonth);
  $("#financeIncome").textContent = currency(totals.income);
  $("#financeExpenses").textContent = currency(totals.expenses);
  $("#financeFixed").textContent = currency(totals.fixed);
  $("#financeVariable").textContent = currency(totals.variable);
  const balancePill = $("#financeBalancePill");
  balancePill.textContent = currency(totals.balance);
  balancePill.style.color = totals.balance >= 0 ? "var(--good)" : "#ff9bad";
}

function renderCategoryChart(items) {
  const wrap = $("#categoryChart");
  wrap.innerHTML = "";
  const expenses = items.filter(t => t.type !== "Receita");
  const byCategory = new Map();
  expenses.forEach(t => byCategory.set(t.category, (byCategory.get(t.category) || 0) + Number(t.value || 0)));
  const rows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    wrap.innerHTML = `<p class="muted">Nenhum gasto registrado neste mês.</p>`;
    return;
  }
  const max = Math.max(...rows.map(([, v]) => v));
  rows.forEach(([category, value]) => {
    const percent = max ? Math.round((value / max) * 100) : 0;
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `<div class="category-row-top"><strong>${category}</strong><span>${currency(value)}</span></div><div class="category-bar"><div style="width:${percent}%"></div></div>`;
    wrap.appendChild(row);
  });
}

function renderFinanceList(items) {
  const list = $("#financeList");
  const empty = $("#financeEmpty");
  list.innerHTML = "";
  empty.style.display = items.length ? "none" : "block";
  const ordered = [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  ordered.forEach(item => {
    const value = Number(item.value || 0);
    const isIncome = item.type === "Receita";
    const article = document.createElement("article");
    article.className = `finance-item ${isIncome ? "income" : "expense"}`;
    const date = item.date ? new Date(item.date + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data";
    article.innerHTML = `
      <div class="finance-item-top">
        <div>
          <h3>${item.description}</h3>
          <p class="finance-meta">${date} • ${item.type} • ${item.category}</p>
          <p class="finance-meta">${item.payment || "Sem forma"}${item.note ? " • " + item.note : ""}</p>
        </div>
        <strong class="money ${isIncome ? "income" : "expense"}">${isIncome ? "+" : "-"}${currency(value)}</strong>
      </div>
      <div class="finance-actions">
        <button data-delete-finance="${item.id}">Excluir</button>
      </div>`;
    article.querySelector("[data-delete-finance]").addEventListener("click", () => deleteFinanceTransaction(item.id));
    list.appendChild(article);
  });
}

function renderFinance() {
  const items = transactionsForMonth(viewedFinanceMonth);
  renderFinanceSummary(items);
  renderCategoryChart(items);
  renderFinanceList(items);
}

function render() {
  todayText.textContent = formatToday();
  renderSummary(); renderHabits(); renderWeek(); renderHistory(); renderFinance();
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
    const imported = ensureState(JSON.parse(text));
    if (!confirm("Importar este backup? Isso substituirá os dados atuais neste dispositivo.")) return;
    state.habits = imported.habits;
    state.finance = imported.finance;
    saveState(); render();
  }).catch(() => alert("Não foi possível importar o arquivo.")).finally(() => { fileInput.value = ""; });
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

$("#openHabitModal").addEventListener("click", () => { habitModal.showModal(); $("#habitName").focus(); });
$("#closeHabitModal").addEventListener("click", () => habitModal.close());

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#habitName").value.trim();
  if (!name) return;
  createHabit({ name, goal: $("#habitGoal").value.trim(), category: $("#habitCategory").value, color: $("#habitColor").value });
  habitForm.reset(); $("#habitColor").value = "#2f80ed"; habitModal.close();
});

$("#prevMonth").addEventListener("click", () => { viewedMonth.setMonth(viewedMonth.getMonth() - 1); renderHistory(); });
$("#nextMonth").addEventListener("click", () => { viewedMonth.setMonth(viewedMonth.getMonth() + 1); renderHistory(); });

$("#openFinanceModal").addEventListener("click", openFinanceForm);
$("#closeFinanceModal").addEventListener("click", () => financeModal.close());
$("#financeType").addEventListener("change", populateFinanceCategories);
$("#prevFinanceMonth").addEventListener("click", () => { viewedFinanceMonth.setMonth(viewedFinanceMonth.getMonth() - 1); renderFinance(); });
$("#nextFinanceMonth").addEventListener("click", () => { viewedFinanceMonth.setMonth(viewedFinanceMonth.getMonth() + 1); renderFinance(); });

financeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = Number($("#financeValue").value);
  if (!value || value <= 0) return;
  createFinanceTransaction({
    date: $("#financeDate").value,
    type: $("#financeType").value,
    category: $("#financeCategory").value,
    description: $("#financeDescription").value.trim(),
    value,
    payment: $("#financePayment").value,
    note: $("#financeNote").value.trim()
  });
  financeForm.reset();
  $("#financeDate").value = todayISO();
  populateFinanceCategories();
  financeModal.close();
});

$("#exportBtn").addEventListener("click", exportBackup);
$("#exportBtnSettings").addEventListener("click", exportBackup);
$("#importFile").addEventListener("change", (event) => importBackupFile(event.target));
$("#resetBtn").addEventListener("click", () => {
  if (!confirm("Tem certeza que deseja apagar todos os hábitos, históricos e finanças deste dispositivo?")) return;
  state.habits = [];
  state.finance = { transactions: [] };
  saveState(); render();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./service-worker.js").catch(() => {}); });
}

populateFinanceCategories();
render();
