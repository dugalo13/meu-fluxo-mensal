const STORAGE_KEY = "meu-fluxo-data-v2";

const state = {
  data: null,
  activeMonthId: "2026-06",
  activeView: "summary",
  expenseFilter: "all",
  selectedAction: null
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const monthNames = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const app = {
  monthSelect: document.querySelector("#monthSelect"),
  views: {
    summary: document.querySelector("#view-summary"),
    expenses: document.querySelector("#view-expenses"),
    revenues: document.querySelector("#view-revenues"),
    year: document.querySelector("#view-year"),
    history: document.querySelector("#view-history")
  },
  dialog: document.querySelector("#expenseDialog"),
  form: document.querySelector("#expenseForm"),
  dialogTitle: document.querySelector("#expenseDialogTitle"),
  expenseId: document.querySelector("#expenseId"),
  expenseName: document.querySelector("#expenseName"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseCategory: document.querySelector("#expenseCategory"),
  expensePayment: document.querySelector("#expensePayment"),
  installmentCurrent: document.querySelector("#expenseInstallmentCurrent"),
  installmentTotal: document.querySelector("#expenseInstallmentTotal"),
  expensePaid: document.querySelector("#expensePaid"),
  revenueDialog: document.querySelector("#revenueDialog"),
  revenueForm: document.querySelector("#revenueForm"),
  revenueDialogTitle: document.querySelector("#revenueDialogTitle"),
  revenueId: document.querySelector("#revenueId"),
  revenueName: document.querySelector("#revenueName"),
  revenueAmount: document.querySelector("#revenueAmount"),
  revenueStatus: document.querySelector("#revenueStatus"),
  actionDialog: document.querySelector("#actionDialog"),
  actionDialogTitle: document.querySelector("#actionDialogTitle"),
  actionEditButton: document.querySelector("#actionEditButton"),
  actionDeleteButton: document.querySelector("#actionDeleteButton"),
  actionCancelButton: document.querySelector("#actionCancelButton"),
  backupFileInput: document.querySelector("#backupFileInput")
};

init();

async function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  state.data = saved ? JSON.parse(saved) : await loadSeed();
  normalizeData();
  const june = state.data.months.find((month) => month.id === "2026-06");
  state.activeMonthId = june ? "2026-06" : state.data.months.at(-1).id;
  bindEvents();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

async function loadSeed() {
  if (window.SEED_DATA) return JSON.parse(JSON.stringify(window.SEED_DATA));
  const response = await fetch("./seed.json");
  return response.json();
}

function normalizeData() {
  state.data.months.forEach((month) => {
    month.expenses.forEach((expense) => {
      expense.status = expense.status || "open";
      expense.category = normalizeCategory(expense.category || "Outros");
      expense.name = cleanText(expense.name || "");
      expense.type = expense.type || "planned";
      expense.payment_method = cleanText(expense.payment_method || "");
    });
    month.revenues.forEach((revenue) => {
      revenue.status = revenue.status || "expected";
      revenue.name = cleanText(revenue.name || "");
    });
  });
}

function bindEvents() {
  app.monthSelect.addEventListener("change", (event) => {
    state.activeMonthId = event.target.value;
    render();
  });

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      render();
    });
  });

  app.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveExpenseFromDialog();
  });

  document.querySelector("#closeExpenseDialog").addEventListener("click", () => {
    app.dialog.close();
  });

  app.revenueForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveRevenueFromDialog();
  });

  document.querySelector("#closeRevenueDialog").addEventListener("click", () => {
    app.revenueDialog.close();
  });

  app.actionCancelButton.addEventListener("click", () => closeActionDialog());
  app.actionEditButton.addEventListener("click", () => editSelectedAction());
  app.actionDeleteButton.addEventListener("click", () => deleteSelectedAction());
  app.backupFileInput.addEventListener("change", importBackupFromFile);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function render() {
  renderMonthPicker();
  renderNav();
  renderSummary();
  renderExpenses();
  renderRevenues();
  renderYear();
  renderHistory();
  Object.entries(app.views).forEach(([name, view]) => {
    view.classList.toggle("active", name === state.activeView);
  });
}

function renderMonthPicker() {
  app.monthSelect.innerHTML = state.data.months
    .map((month) => `<option value="${month.id}">${monthLabel(month)}</option>`)
    .join("");
  app.monthSelect.value = state.activeMonthId;
}

function renderNav() {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
}

function activeMonth() {
  return state.data.months.find((month) => month.id === state.activeMonthId);
}

function monthLabel(month) {
  return `${monthNames[month.month - 1]} ${month.year}`;
}

function totals(month) {
  const expenses = sum(month.expenses.map((expense) => Number(expense.amount) || 0));
  const paid = sum(month.expenses.filter((expense) => expense.status === "paid").map((expense) => Number(expense.amount) || 0));
  const revenues = sum(month.revenues.map((revenue) => Number(revenue.amount) || 0));
  return {
    expenses,
    paid,
    open: expenses - paid,
    revenues,
    balance: revenues - expenses
  };
}

function sum(values) {
  return Math.round(values.reduce((acc, value) => acc + value, 0) * 100) / 100;
}

function renderSummary() {
  const month = activeMonth();
  const total = totals(month);
  const topExpenses = [...month.expenses]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 6);
  const paidWidth = total.expenses > 0 ? Math.max(0, Math.min(100, (total.paid / total.expenses) * 100)) : 0;

  app.views.summary.innerHTML = `
    <div class="hero-summary">
      <article class="balance-panel ${total.balance < 0 ? "negative" : ""}">
        <p class="balance-label">Saldo previsto de ${monthLabel(month)}</p>
        <p class="balance-value">${money.format(total.balance)}</p>
        <p class="small">${total.balance >= 0 ? "Mes positivo" : "Mes negativo"}</p>
      </article>
      <div class="grid">
        ${metric("Receitas", money.format(total.revenues), "green")}
        ${metric("Despesas", money.format(total.expenses), "red")}
        ${metric("Quitado", money.format(total.paid), "neutral")}
        ${metric("Em aberto", money.format(total.open), "yellow")}
      </div>
    </div>
    <div class="actions">
      <button class="primary-button" id="openExpense">+ Despesa</button>
      <button class="secondary-button" id="openRevenue">+ Receita</button>
    </div>
    <div class="actions">
      <button class="secondary-button" id="importBackup">Importar backup</button>
      <button class="secondary-button" id="exportBackup">Exportar backup</button>
    </div>
    <section class="panel section">
      <h2>Quitado x em aberto</h2>
      <div class="split-bar" aria-label="Quitado versus em aberto">
        <span class="split-paid" style="width:${paidWidth}%"></span>
        <span class="split-open" style="width:${100 - paidWidth}%"></span>
      </div>
      <p class="small">${money.format(total.paid)} quitado de ${money.format(total.expenses)} previstos.</p>
    </section>
    <section class="section">
      <h2>Principais despesas</h2>
      <div class="list">
        ${topExpenses.map(expenseRow).join("")}
      </div>
    </section>
  `;

  document.querySelector("#openExpense").addEventListener("click", () => openExpenseDialog());
  document.querySelector("#openRevenue").addEventListener("click", () => openRevenueDialog());
  document.querySelector("#importBackup").addEventListener("click", () => app.backupFileInput.click());
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
  bindExpenseControls(app.views.summary);
}

function metric(label, value, tone = "neutral") {
  return `
    <article class="metric metric-${tone}">
      <p class="metric-label">${label}</p>
      <p class="metric-value">${value}</p>
    </article>
  `;
}

function renderExpenses() {
  const month = activeMonth();
  const categories = ["all", "open", "paid", ...new Set(month.expenses.map((expense) => normalizeCategory(expense.category)))];
  const filtered = filterExpenses(month.expenses);

  app.views.expenses.innerHTML = `
    <div class="section">
      <h2>Despesas de ${monthLabel(month)}</h2>
      <div class="filters">
        ${categories.map((category) => filterChip(category)).join("")}
      </div>
      <div class="list">
        ${filtered.length ? filtered.map(expenseRow).join("") : emptyPanel("Nenhuma despesa nesse filtro.")}
      </div>
      <div class="actions">
        <button class="primary-button" id="addExpenseFromList">+ Nova despesa</button>
        <button class="secondary-button" id="markClosed">${month.closed ? "Mes conferido" : "Marcar conferido"}</button>
      </div>
    </div>
  `;

  app.views.expenses.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.expenseFilter = chip.dataset.filter;
      renderExpenses();
    });
  });
  document.querySelector("#addExpenseFromList").addEventListener("click", () => openExpenseDialog());
  document.querySelector("#markClosed").addEventListener("click", () => {
    month.closed = !month.closed;
    save();
    renderExpenses();
  });
  bindExpenseControls(app.views.expenses);
}

function filterChip(value) {
  const labels = { all: "Todas", open: "Abertas", paid: "Quitadas" };
  return `<button class="chip ${state.expenseFilter === value ? "active" : ""}" data-filter="${escapeHtml(value)}">${labels[value] || escapeHtml(value)}</button>`;
}

function filterExpenses(expenses) {
  if (state.expenseFilter === "open") return expenses.filter((expense) => expense.status !== "paid");
  if (state.expenseFilter === "paid") return expenses.filter((expense) => expense.status === "paid");
  if (state.expenseFilter === "all") return expenses;
  return expenses.filter((expense) => normalizeCategory(expense.category) === state.expenseFilter);
}

function expenseRow(expense) {
  const checked = expense.status === "paid" ? "checked" : "";
  const installment = expense.installment ? ` - ${expense.installment.current}/${expense.installment.total}` : "";
  return `
    <article class="expense-row ${expense.status === "paid" ? "paid" : ""}" data-expense-row="${expense.id}">
      <input class="toggle-paid" type="checkbox" data-id="${expense.id}" ${checked} aria-label="Marcar ${escapeHtml(cleanText(expense.name))} como quitada" />
      <div>
        <p class="expense-name">${escapeHtml(cleanText(expense.name))}</p>
        <p class="expense-meta">${escapeHtml(normalizeCategory(expense.category))}${installment}</p>
      </div>
      <strong class="amount">${money.format(Number(expense.amount) || 0)}</strong>
    </article>
  `;
}

function bindExpenseControls(root) {
  root.querySelectorAll("[data-expense-row]").forEach((row) => {
    row.addEventListener("click", () => {
      openActionDialog("expense", row.dataset.expenseRow);
    });
  });

  root.querySelectorAll(".toggle-paid").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      const found = findExpense(checkbox.dataset.id);
      if (found) {
        found.expense.status = checkbox.checked ? "paid" : "open";
        save();
        render();
      }
    });
  });
}

function findExpense(id) {
  for (const month of state.data.months) {
    const expense = month.expenses.find((item) => item.id === id);
    if (expense) return { month, expense };
  }
  return null;
}

function renderRevenues() {
  const month = activeMonth();
  const total = totals(month);
  const received = sum(month.revenues.filter((revenue) => revenue.status === "received").map((revenue) => Number(revenue.amount) || 0));
  const expected = total.revenues - received;

  app.views.revenues.innerHTML = `
    <section class="section">
      <h2>Receitas de ${monthLabel(month)}</h2>
      <div class="grid">
        ${metric("Total", money.format(total.revenues), "green")}
        ${metric("Recebidas", money.format(received), "green")}
        ${metric("Previstas", money.format(expected), "yellow")}
        ${metric("Lancamentos", String(month.revenues.length), "neutral")}
      </div>
    </section>
    <section class="section">
      <h2>Lista de receitas</h2>
      <div class="list">
        ${month.revenues.length ? month.revenues.map(revenueRow).join("") : emptyPanel("Nenhuma receita cadastrada para esse mes.")}
      </div>
      <div class="actions">
        <button class="primary-button" id="addRevenueFromList">+ Nova receita</button>
        <button class="secondary-button" id="goSummaryFromRevenue">Ver resumo</button>
      </div>
    </section>
  `;
  document.querySelector("#addRevenueFromList").addEventListener("click", () => openRevenueDialog());
  document.querySelector("#goSummaryFromRevenue").addEventListener("click", () => {
    state.activeView = "summary";
    render();
  });
  bindRevenueControls(app.views.revenues);
}

function revenueRow(revenue) {
  const statusLabel = revenue.status === "received" ? "Recebida" : "Prevista";
  return `
    <article class="expense-row ${revenue.status === "received" ? "paid" : ""}" data-revenue-row="${revenue.id}">
      <span class="revenue-dot" aria-hidden="true"></span>
      <div>
        <p class="expense-name">${escapeHtml(cleanText(revenue.name))}</p>
        <p class="expense-meta">${statusLabel}</p>
      </div>
      <strong class="amount positive-text">${money.format(Number(revenue.amount) || 0)}</strong>
    </article>
  `;
}

function bindRevenueControls(root) {
  root.querySelectorAll("[data-revenue-row]").forEach((row) => {
    row.addEventListener("click", () => {
      openActionDialog("revenue", row.dataset.revenueRow);
    });
  });
}

function findRevenue(id) {
  for (const month of state.data.months) {
    const revenue = month.revenues.find((item) => item.id === id);
    if (revenue) return { month, revenue };
  }
  return null;
}

function openActionDialog(type, id) {
  state.selectedAction = { type, id };
  const found = type === "expense" ? findExpense(id) : findRevenue(id);
  const item = type === "expense" ? found?.expense : found?.revenue;
  if (!item) return;
  app.actionDialogTitle.textContent = cleanText(item.name);
  app.actionDialog.showModal();
}

function closeActionDialog() {
  state.selectedAction = null;
  app.actionDialog.close();
}

function editSelectedAction() {
  const selected = state.selectedAction;
  closeActionDialog();
  if (!selected) return;
  if (selected.type === "expense") {
    const found = findExpense(selected.id);
    if (found) openExpenseDialog(found.expense);
  } else {
    const found = findRevenue(selected.id);
    if (found) openRevenueDialog(found.revenue);
  }
}

function deleteSelectedAction() {
  const selected = state.selectedAction;
  closeActionDialog();
  if (!selected) return;
  if (selected.type === "expense") {
    const found = findExpense(selected.id);
    if (found) {
      found.month.expenses = found.month.expenses.filter((expense) => expense.id !== selected.id);
    }
  } else {
    const found = findRevenue(selected.id);
    if (found) {
      found.month.revenues = found.month.revenues.filter((revenue) => revenue.id !== selected.id);
    }
  }
  save();
  render();
}

function exportBackup() {
  const payload = JSON.stringify(state.data, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `meu-fluxo-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importBackupFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported || !Array.isArray(imported.months)) {
        throw new Error("Arquivo invalido.");
      }
      state.data = imported;
      normalizeData();
      state.activeMonthId = state.data.months[0]?.id || "2026-01";
      save();
      render();
      event.target.value = "";
    } catch {
      alert("Nao foi possivel importar esse backup.");
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function renderYear() {
  const year = activeMonth().year;
  const months = state.data.months.filter((month) => month.year === year);
  const yearTotals = months.map(totals);
  const totalExpenses = sum(yearTotals.map((item) => item.expenses));
  const totalRevenues = sum(yearTotals.map((item) => item.revenues));
  const balance = totalRevenues - totalExpenses;
  const averageBalance = months.length ? balance / months.length : 0;

  app.views.year.innerHTML = `
    <div class="grid section">
      ${metric(`Gasto em ${year}`, money.format(totalExpenses), "red")}
      ${metric("Recebido", money.format(totalRevenues), "green")}
      ${metric("Saldo acumulado", money.format(balance), balance >= 0 ? "green" : "red")}
      ${metric("Media do saldo", money.format(averageBalance), averageBalance >= 0 ? "green" : "red")}
    </div>
    <section class="panel section">
      <h2>Saldo mes a mes</h2>
      ${lineChart(months, yearTotals)}
    </section>
    <section class="panel section">
      <h2>Detalhe por mes</h2>
      <div class="bar-chart">
        ${months.map((month, index) => {
          const current = yearTotals[index];
          return `
            <button class="history-row" data-month="${month.id}">
              <div></div>
              <div>
                <p class="history-title">${monthLabel(month)}</p>
                <p class="history-meta">Receitas ${money.format(current.revenues)} - despesas ${money.format(current.expenses)}</p>
              </div>
              <strong class="amount ${current.balance < 0 ? "negative-text" : "positive-text"}">${money.format(current.balance)}</strong>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
  bindHistoryRows(app.views.year);
}

function lineChart(months, totalsByMonth) {
  if (!months.length) return emptyPanel("Sem meses para mostrar.");
  const balances = totalsByMonth.map((item) => item.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(0, ...balances);
  const spread = max - min || 1;
  const width = 720;
  const height = 320;
  const padX = 44;
  const padY = 54;
  const step = months.length > 1 ? (width - padX * 2) / (months.length - 1) : 0;
  const points = balances.map((value, index) => {
    const x = padX + index * step;
    const y = padY + (max - value) / spread * (height - padY * 2);
    return { x, y, value };
  });
  const zeroY = padY + (max - 0) / spread * (height - padY * 2);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return `
    <div class="line-chart-wrap">
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafico de saldo mes a mes">
        <line x1="${padX}" y1="${zeroY}" x2="${width - padX}" y2="${zeroY}" class="zero-line" />
        <path d="${path}" class="balance-line" />
        ${points.map((point, index) => `
          <g>
            <circle cx="${point.x}" cy="${point.y}" r="5" class="${point.value < 0 ? "point-negative" : "point-positive"}"></circle>
            <text x="${point.x}" y="${point.y - 13}" text-anchor="middle" class="chart-value">${compactMoney(point.value)}</text>
            <text x="${point.x}" y="${height - 18}" text-anchor="middle" class="chart-month">${monthNames[months[index].month - 1].slice(0, 3)}</text>
          </g>
        `).join("")}
      </svg>
    </div>
  `;
}

function renderHistory() {
  const years = [...new Set(state.data.months.map((month) => month.year))].sort((a, b) => b - a);
  app.views.history.innerHTML = years.map((year) => {
    const months = state.data.months.filter((month) => month.year === year);
    return `
      <section class="section">
        <h2>${year}</h2>
        <div class="list">
          ${months.map((month) => {
            const total = totals(month);
            return `
              <button class="history-row" data-month="${month.id}">
                <div></div>
                <div>
                  <p class="history-title">${monthLabel(month)}</p>
                  <p class="history-meta">${money.format(total.expenses)} despesas - ${month.closed ? "conferido" : "em aberto"}</p>
                </div>
                <strong class="amount ${total.balance < 0 ? "negative-text" : "positive-text"}">${money.format(total.balance)}</strong>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }).join("");
  bindHistoryRows(app.views.history);
}

function bindHistoryRows(root) {
  root.querySelectorAll("[data-month]").forEach((row) => {
    row.addEventListener("click", () => {
      state.activeMonthId = row.dataset.month;
      state.activeView = "summary";
      render();
    });
  });
}

function openExpenseDialog(expense = null) {
  app.form.reset();
  app.expenseId.value = expense ? expense.id : "";
  app.dialogTitle.textContent = expense ? "Editar despesa" : "Nova despesa";
  app.expenseName.value = expense ? cleanText(expense.name) : "";
  app.expenseAmount.value = expense ? String(expense.amount).replace(".", ",") : "";
  app.expenseCategory.value = expense ? cleanText(expense.category) : "Outros";
  app.expensePayment.value = expense ? cleanText(expense.payment_method) : "";
  app.expensePaid.checked = expense ? expense.status === "paid" : false;
  app.installmentCurrent.value = expense && expense.installment ? expense.installment.current : "";
  app.installmentTotal.value = expense && expense.installment ? expense.installment.total : "";
  app.installmentCurrent.disabled = Boolean(expense);
  app.installmentTotal.disabled = Boolean(expense);
  app.dialog.showModal();
}

function openRevenueDialog(revenue = null) {
  app.revenueForm.reset();
  app.revenueId.value = revenue ? revenue.id : "";
  app.revenueDialogTitle.textContent = revenue ? "Editar receita" : "Nova receita";
  app.revenueName.value = revenue ? cleanText(revenue.name) : "";
  app.revenueAmount.value = revenue ? String(revenue.amount).replace(".", ",") : "";
  app.revenueStatus.value = revenue ? revenue.status || "expected" : "expected";
  app.revenueDialog.showModal();
}

function saveRevenueFromDialog() {
  const name = cleanText(app.revenueName.value.trim());
  const amount = parseAmount(app.revenueAmount.value);

  if (!name || amount <= 0) {
    app.revenueName.reportValidity();
    app.revenueAmount.reportValidity();
    return;
  }

  const existingId = app.revenueId.value;
  if (existingId) {
    const found = findRevenue(existingId);
    if (found) {
      found.revenue.name = name;
      found.revenue.amount = amount;
      found.revenue.status = app.revenueStatus.value;
    }
  } else {
    const month = activeMonth();
    month.revenues.push({
      id: `${month.id}-revenue-custom-${Date.now()}`,
      name,
      amount,
      status: app.revenueStatus.value
    });
  }

  save();
  app.revenueDialog.close();
  render();
}

function saveExpenseFromDialog() {
  const name = cleanText(app.expenseName.value.trim());
  const amount = parseAmount(app.expenseAmount.value);

  if (!name || amount <= 0) {
    app.expenseName.reportValidity();
    app.expenseAmount.reportValidity();
    return;
  }

  const existingId = app.expenseId.value;
  if (existingId) {
    const found = findExpense(existingId);
    if (found) {
      found.expense.name = name;
      found.expense.amount = amount;
      found.expense.category = normalizeCategory(app.expenseCategory.value);
      found.expense.payment_method = cleanText(app.expensePayment.value);
      found.expense.status = app.expensePaid.checked ? "paid" : "open";
      if (app.installmentTotal.value) {
        found.expense.installment = {
          current: Number(app.installmentCurrent.value) || 1,
          total: Number(app.installmentTotal.value) || 1
        };
      } else {
        delete found.expense.installment;
      }
    }
  } else {
    addInstallmentExpenses({
      name,
      amount,
      category: normalizeCategory(app.expenseCategory.value),
      payment_method: cleanText(app.expensePayment.value),
      status: app.expensePaid.checked ? "paid" : "open",
      current: Math.max(1, Number(app.installmentCurrent.value) || 1),
      total: Math.max(1, Number(app.installmentTotal.value) || Number(app.installmentCurrent.value) || 1)
    });
  }

  save();
  app.dialog.close();
  render();
}

function addInstallmentExpenses(input) {
  const startIndex = state.data.months.findIndex((month) => month.id === state.activeMonthId);
  const totalToCreate = Math.max(1, input.total - input.current + 1);
  const groupId = `custom-${Date.now()}`;

  for (let offset = 0; offset < totalToCreate; offset += 1) {
    const month = state.data.months[startIndex + offset];
    if (!month) break;
    const current = input.current + offset;
    const isInstallment = input.total > 1;
    month.expenses.push({
      id: `${month.id}-expense-${groupId}-${current}`,
      name: isInstallment ? `${input.name} ${current}/${input.total}` : input.name,
      amount: input.amount,
      category: input.category,
      payment_method: input.payment_method,
      status: offset === 0 ? input.status : "open",
      type: isInstallment ? "installment" : "eventual",
      installment: isInstallment ? { current, total: input.total, groupId } : null
    });
  }
}

function parseAmount(value) {
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function emptyPanel(text) {
  return `<article class="panel"><p class="small">${text}</p></article>`;
}

function compactMoney(value) {
  const rounded = Math.round(value);
  return `R$${rounded.toLocaleString("pt-BR")}`;
}

function cleanText(value) {
  return String(value || "")
    .replace(/Sa\?de/g, "Saude")
    .replace(/sa\?de/g, "saude")
    .replace(/Servi\?os/g, "Servicos")
    .replace(/servi\?os/g, "servicos")
    .replace(/\u00C3\u2021/g, "C")
    .replace(/\u00C3\u00A7/g, "c")
    .replace(/\u00C3\u00A3/g, "a")
    .replace(/\u00C3\u00A1/g, "a")
    .replace(/\u00C3\u00A2/g, "a")
    .replace(/\u00C3\u00AA/g, "e")
    .replace(/\u00C3\u00A9/g, "e")
    .replace(/\u00C3\u00AD/g, "i")
    .replace(/\u00C3\u00B3/g, "o")
    .replace(/\u00C3\u00B4/g, "o")
    .replace(/\u00C3\u00BA/g, "u")
    .replace(/\u00C3\u00B5/g, "o")
    .replace(/\u00E7/g, "c")
    .replace(/\u00C7/g, "C")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function normalizeCategory(value) {
  const cleaned = cleanText(value)
    .replace(/Sa.de/gi, "Saude")
    .replace(/Servi.os/gi, "Servicos")
    .replace(/Cart.o/gi, "Cartao")
    .replace(/Educa..o/gi, "Educacao");

  const lower = cleaned.toLowerCase();
  if (lower.includes("saude")) return "Saude e bem-estar";
  if (lower.includes("assinaturas") || lower.includes("servicos")) return "Assinaturas/Servicos";
  if (lower.includes("educa")) return "Educacao";
  if (lower.includes("cart")) return "Cartao";
  return cleaned || "Outros";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
