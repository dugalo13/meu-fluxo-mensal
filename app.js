const STORAGE_KEY = "meu-fluxo-data-v2";

const state = {
  data: null,
  activeMonthId: "2026-06",
  activeView: "summary",
  expenseFilter: "all",
  expenseSearch: "",
  categoryFilter: "all",
  selectedAction: null,
  activeNubankPurchaseId: null,
  editWholeSeries: false,
  deletedSnapshot: null,
  undoTimer: null,
  theme: "dark",
  chartStartId: null,
  chartEndId: null,
  chartAuto: true
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
  monthButton: document.querySelector("#monthButton"),
  views: {
    summary: document.querySelector("#view-summary"),
    revenues: document.querySelector("#view-revenues"),
    card: document.querySelector("#view-card"),
    year: document.querySelector("#view-year"),
    options: document.querySelector("#view-options")
  },
  dialog: document.querySelector("#expenseDialog"),
  form: document.querySelector("#expenseForm"),
  dialogTitle: document.querySelector("#expenseDialogTitle"),
  expenseId: document.querySelector("#expenseId"),
  expenseName: document.querySelector("#expenseName"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseDueDate: document.querySelector("#expenseDueDate"),
  expenseCategory: document.querySelector("#expenseCategory"),
  expensePayment: document.querySelector("#expensePayment"),
  installmentCurrent: document.querySelector("#expenseInstallmentCurrent"),
  installmentTotal: document.querySelector("#expenseInstallmentTotal"),
  expensePaid: document.querySelector("#expensePaid"),
  expenseRecurring: document.querySelector("#expenseRecurring"),
  expenseRecurringCount: document.querySelector("#expenseRecurringCount"),
  expenseRecurringCountLabel: document.querySelector("#expenseRecurringCountLabel"),
  revenueDialog: document.querySelector("#revenueDialog"),
  revenueForm: document.querySelector("#revenueForm"),
  revenueDialogTitle: document.querySelector("#revenueDialogTitle"),
  revenueId: document.querySelector("#revenueId"),
  revenueName: document.querySelector("#revenueName"),
  revenueAmount: document.querySelector("#revenueAmount"),
  revenueDueDate: document.querySelector("#revenueDueDate"),
  revenueStatus: document.querySelector("#revenueStatus"),
  revenueRecurring: document.querySelector("#revenueRecurring"),
  revenueRecurringCount: document.querySelector("#revenueRecurringCount"),
  revenueRecurringCountLabel: document.querySelector("#revenueRecurringCountLabel"),
  actionDialog: document.querySelector("#actionDialog"),
  actionDialogTitle: document.querySelector("#actionDialogTitle"),
  actionEditButton: document.querySelector("#actionEditButton"),
  actionEditSeriesButton: document.querySelector("#actionEditSeriesButton"),
  actionCardButton: document.querySelector("#actionCardButton"),
  actionDeleteButton: document.querySelector("#actionDeleteButton"),
  actionDeleteSeriesButton: document.querySelector("#actionDeleteSeriesButton"),
  actionCancelButton: document.querySelector("#actionCancelButton"),
  backupFileInput: document.querySelector("#backupFileInput"),
  monthDialog: document.querySelector("#monthDialog"),
  monthForm: document.querySelector("#monthForm"),
  monthPicker: document.querySelector("#monthPicker"),
  yearPicker: document.querySelector("#yearPicker"),
  budgetDialog: document.querySelector("#budgetDialog"),
  budgetForm: document.querySelector("#budgetForm"),
  budgetFields: document.querySelector("#budgetFields"),
  nubankDialog: document.querySelector("#nubankDialog"),
  nubankDialogTitle: document.querySelector("#nubankDialogTitle"),
  nubankMonthTotal: document.querySelector("#nubankMonthTotal"),
  nubankBaseForm: document.querySelector("#nubankBaseForm"),
  nubankBaseAmount: document.querySelector("#nubankBaseAmount"),
  nubankInstallmentList: document.querySelector("#nubankInstallmentList"),
  nubankPurchaseDialog: document.querySelector("#nubankPurchaseDialog"),
  nubankPurchaseForm: document.querySelector("#nubankPurchaseForm"),
  nubankPurchaseDialogTitle: document.querySelector("#nubankPurchaseDialogTitle"),
  nubankPurchaseId: document.querySelector("#nubankPurchaseId"),
  nubankPurchaseName: document.querySelector("#nubankPurchaseName"),
  nubankPurchaseAmount: document.querySelector("#nubankPurchaseAmount"),
  nubankPurchaseCurrent: document.querySelector("#nubankPurchaseCurrent"),
  nubankPurchaseTotal: document.querySelector("#nubankPurchaseTotal"),
  deleteNubankPurchase: document.querySelector("#deleteNubankPurchase"),
  undoToast: document.querySelector("#undoToast"),
  undoDeleteButton: document.querySelector("#undoDeleteButton")
};

init();

async function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  state.data = saved ? JSON.parse(saved) : await loadSeed();
  state.theme = localStorage.getItem("meu-fluxo-theme") || "dark";
  normalizeData();
  state.activeMonthId = financialMonthForToday().id;
  state.chartAuto = true;
  state.chartEndId = state.activeMonthId;
  state.chartStartId = monthOffsetId(state.chartEndId, -11);
  applyTheme();
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
  state.data.settings = state.data.settings || {};
  state.data.settings.budgets = state.data.settings.budgets || {};
  state.data.nubank_purchases = Array.isArray(state.data.nubank_purchases) ? state.data.nubank_purchases : [];
  const legacyInstallmentGroups = new Map();
  state.data.months.forEach((month) => {
    month.closed = Boolean(month.closed);
    month.expenses.forEach((expense) => {
      expense.status = expense.status || "open";
      expense.category = normalizeCategory(expense.category || "Outros");
      expense.name = cleanText(expense.name || "");
      expense.type = expense.type || "planned";
      expense.payment_method = cleanText(expense.payment_method || "");
      expense.due_date = expense.due_date || "";
      if (isNubankAggregate(expense)) {
        expense.is_nubank_aggregate = true;
        if (expense.nubank_base_amount == null) {
          expense.nubank_base_amount = Number(expense.amount) || 0;
        }
      }
      if (expense.installment && !expense.installment.groupId) {
        const current = Math.max(1, Number(expense.installment.current) || 1);
        const total = Math.max(current, Number(expense.installment.total) || current);
        const startId = monthOffsetId(month.id, -(current - 1));
        const baseName = stripInstallmentSuffix(expense.name).replace(/[^a-z0-9]/gi, "").toLowerCase();
        const key = `${startId}|${baseName}|${total}|${Number(expense.amount) || 0}`;
        if (!legacyInstallmentGroups.has(key)) {
          legacyInstallmentGroups.set(key, `legacy-${startId}-${legacyInstallmentGroups.size + 1}`);
        }
        expense.installment.current = current;
        expense.installment.total = total;
        expense.installment.groupId = legacyInstallmentGroups.get(key);
      }
    });
    month.revenues.forEach((revenue) => {
      revenue.status = revenue.status || "expected";
      revenue.name = cleanText(revenue.name || "");
      revenue.due_date = revenue.due_date || "";
    });
    month.credit_card = month.credit_card || { invoice_total: 0, linked_expense_ids: [] };
    month.credit_card.linked_expense_ids = month.credit_card.linked_expense_ids || [];
    const linkedIds = new Set(month.credit_card.linked_expense_ids);
    month.expenses.forEach((expense) => {
      if (linkedIds.has(expense.id)) expense.show_in_card = true;
    });
  });
  normalizeNubankPurchases();
  syncAllNubankAggregates();
  sortMonths();
}

function bindEvents() {
  app.monthButton.addEventListener("click", openMonthDialog);
  app.monthForm.addEventListener("submit", selectMonthFromDialog);
  document.querySelector("#closeMonthDialog").addEventListener("click", () => app.monthDialog.close());

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
  app.actionEditSeriesButton.addEventListener("click", () => editSelectedAction(true));
  app.actionCardButton.addEventListener("click", () => toggleSelectedExpenseCardVisibility());
  app.actionDeleteButton.addEventListener("click", () => deleteSelectedAction());
  app.actionDeleteSeriesButton.addEventListener("click", () => deleteSelectedAction(true));
  app.backupFileInput.addEventListener("change", importBackupFromFile);
  app.expenseRecurring.addEventListener("change", () => {
    app.expenseRecurringCountLabel.hidden = !app.expenseRecurring.checked;
  });
  app.revenueRecurring.addEventListener("change", () => {
    app.revenueRecurringCountLabel.hidden = !app.revenueRecurring.checked;
  });
  document.querySelectorAll(".money-input").forEach(bindMoneyInput);
  app.budgetForm.addEventListener("submit", saveBudgets);
  document.querySelector("#closeBudgetDialog").addEventListener("click", () => app.budgetDialog.close());
  document.querySelector("#closeNubankDialog").addEventListener("click", () => app.nubankDialog.close());
  document.querySelector("#openNubankPurchase").addEventListener("click", () => openNubankPurchaseDialog());
  app.nubankBaseForm.addEventListener("submit", saveNubankBaseAmount);
  app.nubankPurchaseForm.addEventListener("submit", saveNubankPurchase);
  document.querySelector("#closeNubankPurchaseDialog").addEventListener("click", () => app.nubankPurchaseDialog.close());
  app.deleteNubankPurchase.addEventListener("click", deleteNubankPurchase);
  app.undoDeleteButton.addEventListener("click", undoLastDelete);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function render() {
  renderMonthPicker();
  renderNav();
  renderSummary();
  renderRevenues();
  renderCard();
  renderYear();
  renderOptions();
  Object.entries(app.views).forEach(([name, view]) => {
    view.classList.toggle("active", name === state.activeView);
  });
}

function renderMonthPicker() {
  app.monthButton.textContent = monthLabel(activeMonth());
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

function financialMonthForToday() {
  const today = new Date();
  const monthOffsetValue = today.getDate() >= 20 ? 1 : 0;
  const financialDate = new Date(today.getFullYear(), today.getMonth() + monthOffsetValue, 1);
  return ensureMonth(financialDate.getFullYear(), financialDate.getMonth() + 1);
}

function openMonthDialog() {
  app.monthPicker.innerHTML = monthNames.map((name, index) => (
    `<option value="${index + 1}">${name}</option>`
  )).join("");
  const month = activeMonth();
  app.monthPicker.value = month.month;
  app.yearPicker.value = month.year;
  app.monthDialog.showModal();
}

function selectMonthFromDialog(event) {
  event.preventDefault();
  const monthNumber = Number(app.monthPicker.value);
  const year = Number(app.yearPicker.value);
  if (!year || year < 2000 || year > 2100) {
    app.yearPicker.reportValidity();
    return;
  }
  const month = ensureMonth(year, monthNumber);
  state.activeMonthId = month.id;
  app.monthDialog.close();
  save();
  render();
}

function ensureMonth(year, monthNumber) {
  const id = `${year}-${String(monthNumber).padStart(2, "0")}`;
  let month = state.data.months.find((item) => item.id === id);
  if (!month) {
    month = {
      id,
      year,
      month: monthNumber,
      label: `${String(monthNumber).padStart(2, "0")}/${year}`,
      closed: false,
      summary: { total_expenses: 0, total_revenues: 0, balance: 0 },
      expenses: [],
      revenues: [],
      credit_card: { invoice_total: 0, linked_expense_ids: [] },
      source_sheet: "manual",
      source_rows: []
    };
    state.data.months.push(month);
    sortMonths();
  }
  return month;
}

function sortMonths() {
  state.data.months.sort((a, b) => a.id.localeCompare(b.id));
}

function monthOffset(month, offset) {
  const date = new Date(month.year, month.month - 1 + offset, 1);
  return ensureMonth(date.getFullYear(), date.getMonth() + 1);
}

function monthOffsetId(monthId, offset) {
  const [year, month] = monthId.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(startId, endId) {
  const [startYear, startMonth] = startId.split("-").map(Number);
  const [endYear, endMonth] = endId.split("-").map(Number);
  const months = [];
  const cursor = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth - 1, 1);
  while (cursor <= end && months.length < 12) {
    months.push(ensureMonth(cursor.getFullYear(), cursor.getMonth() + 1));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function isNubankAggregate(expense) {
  if (!expense) return false;
  if (expense.is_nubank_aggregate) return true;
  const name = cleanText(expense.name).toLowerCase();
  return name.includes("despesas fixas") && (name.includes("nubank") || name.includes("cartao"));
}

function normalizeNubankPurchases() {
  state.data.nubank_purchases = state.data.nubank_purchases
    .map((purchase, index) => ({
      id: purchase.id || `nubank-${Date.now()}-${index}`,
      name: cleanText(purchase.name || "Compra parcelada"),
      amount: Math.max(0, Number(purchase.amount) || 0),
      start_month_id: purchase.start_month_id || state.activeMonthId,
      starting_installment: Math.max(1, Number(purchase.starting_installment) || 1),
      total_installments: Math.max(1, Number(purchase.total_installments) || 1)
    }))
    .filter((purchase) => purchase.amount > 0 && purchase.starting_installment <= purchase.total_installments);
}

function monthDistance(startId, endId) {
  const [startYear, startMonth] = startId.split("-").map(Number);
  const [endYear, endMonth] = endId.split("-").map(Number);
  return (endYear - startYear) * 12 + endMonth - startMonth;
}

function nubankInstallmentsForMonth(monthId) {
  return state.data.nubank_purchases.flatMap((purchase) => {
    const offset = monthDistance(purchase.start_month_id, monthId);
    const current = purchase.starting_installment + offset;
    if (offset < 0 || current > purchase.total_installments) return [];
    return [{
      purchase,
      current,
      total: purchase.total_installments,
      amount: Number(purchase.amount) || 0
    }];
  });
}

function nubankAggregate(month) {
  return month.expenses.find(isNubankAggregate) || null;
}

function syncNubankAggregate(month) {
  const installments = nubankInstallmentsForMonth(month.id);
  const installmentTotal = sum(installments.map((item) => item.amount));
  let aggregate = nubankAggregate(month);
  const baseAmount = Number(aggregate?.nubank_base_amount) || 0;
  const totalAmount = sum([baseAmount, installmentTotal]);

  if (!aggregate && totalAmount > 0) {
    aggregate = {
      id: `${month.id}-nubank-fixed-auto`,
      name: "Despesas fixas - Cartao",
      amount: totalAmount,
      nubank_base_amount: 0,
      category: "Assinaturas/Servicos",
      payment_method: "Cartao",
      status: "open",
      type: "nubank-aggregate",
      is_nubank_aggregate: true
    };
    month.expenses.push(aggregate);
  }

  if (!aggregate) return;
  aggregate.name = "Despesas fixas - Cartao";
  aggregate.amount = totalAmount;
  aggregate.nubank_base_amount = baseAmount;
  aggregate.category = normalizeCategory(aggregate.category || "Assinaturas/Servicos");
  aggregate.payment_method = cleanText(aggregate.payment_method || "Cartao");
  aggregate.status = aggregate.status || "open";
  aggregate.type = "nubank-aggregate";
  aggregate.is_nubank_aggregate = true;

  if (totalAmount <= 0 && baseAmount <= 0) {
    month.credit_card = month.credit_card || { invoice_total: 0, linked_expense_ids: [] };
    month.credit_card.linked_expense_ids = (month.credit_card.linked_expense_ids || [])
      .filter((id) => id !== aggregate.id);
    month.expenses = month.expenses.filter((expense) => expense !== aggregate);
    return;
  }

  month.credit_card = month.credit_card || { invoice_total: 0, linked_expense_ids: [] };
  const linkedIds = new Set(month.credit_card.linked_expense_ids || []);
  linkedIds.add(aggregate.id);
  month.credit_card.linked_expense_ids = [...linkedIds];
  aggregate.show_in_card = true;
  aggregate.card_link_locked = true;
}

function syncAllNubankAggregates() {
  state.data.nubank_purchases.forEach((purchase) => {
    const remaining = purchase.total_installments - purchase.starting_installment;
    for (let offset = 0; offset <= remaining; offset += 1) {
      const monthId = monthOffsetId(purchase.start_month_id, offset);
      const [year, monthNumber] = monthId.split("-").map(Number);
      ensureMonth(year, monthNumber);
    }
  });
  state.data.months.forEach((month) => {
    syncNubankAggregate(month);
    syncCardOtherExpense(month);
  });
}

function nubankMonthValues(month) {
  syncNubankAggregate(month);
  const aggregate = nubankAggregate(month);
  const installments = nubankInstallmentsForMonth(month.id);
  return {
    aggregate,
    installments,
    base: Number(aggregate?.nubank_base_amount) || 0,
    installmentsTotal: sum(installments.map((item) => item.amount)),
    total: Number(aggregate?.amount) || 0
  };
}

function totals(month) {
  syncNubankAggregate(month);
  syncCardOtherExpense(month);
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
  const nubank = nubankMonthValues(month);
  const visibleExpenses = month.expenses.filter((expense) => !isNubankAggregate(expense));
  const categories = [...new Set(visibleExpenses.map((expense) => normalizeCategory(expense.category)))].sort();
  const expenses = visibleExpenses.filter((expense) => {
    const matchesStatus = state.expenseFilter === "all"
      || (state.expenseFilter === "paid" && expense.status === "paid")
      || (state.expenseFilter === "open" && expense.status !== "paid");
    const matchesCategory = state.categoryFilter === "all" || normalizeCategory(expense.category) === state.categoryFilter;
    const matchesSearch = !state.expenseSearch || cleanText(expense.name).toLowerCase().includes(state.expenseSearch.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });
  const paidWidth = total.expenses > 0 ? Math.max(0, Math.min(100, (total.paid / total.expenses) * 100)) : 0;
  const budgets = budgetProgress(month);

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
      <button class="primary-button" id="openExpense" ${month.closed ? "disabled" : ""}>+ Despesa</button>
      <button class="secondary-button" id="openRevenue" ${month.closed ? "disabled" : ""}>+ Receita</button>
    </div>
    <section class="panel section month-status">
      <div>
        <h2>${month.closed ? "Mes fechado" : "Mes em andamento"}</h2>
        <p class="small">${month.closed ? "Os lancamentos estao protegidos contra alteracoes." : "Feche o mes depois de conferir os valores."}</p>
      </div>
      <button class="secondary-button" id="toggleMonthClosed">${month.closed ? "Reabrir mes" : "Fechar mes"}</button>
    </section>
    <section class="panel section">
      <h2>Quitado x em aberto</h2>
      <div class="split-bar" aria-label="Quitado versus em aberto">
        <span class="split-paid" style="width:${paidWidth}%"></span>
        <span class="split-open" style="width:${100 - paidWidth}%"></span>
      </div>
      <p class="small">${money.format(total.paid)} quitado de ${money.format(total.expenses)} previstos.</p>
    </section>
    ${budgets.length ? `
      <section class="panel section">
        <h2>Orcamento por categoria</h2>
        <div class="budget-progress-list">${budgets.map(budgetProgressRow).join("")}</div>
      </section>
    ` : ""}
    <section class="section">
      <div class="section-title-row">
        <h2>Despesas</h2>
        <button class="text-button" id="openBudgets">Definir limites</button>
      </div>
      ${nubankSummaryButton(month, nubank)}
      <div class="expense-tools">
        <input id="expenseSearch" type="search" placeholder="Buscar despesa" value="${escapeHtml(state.expenseSearch)}" />
        <select id="expenseCategoryFilter">
          <option value="all">Todas as categorias</option>
          ${categories.map((category) => `<option value="${escapeHtml(category)}" ${category === state.categoryFilter ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
        </select>
      </div>
      <div class="filters" aria-label="Filtrar despesas">
        <button class="chip ${state.expenseFilter === "all" ? "active" : ""}" data-expense-filter="all">Todas</button>
        <button class="chip ${state.expenseFilter === "open" ? "active" : ""}" data-expense-filter="open">Em aberto</button>
        <button class="chip ${state.expenseFilter === "paid" ? "active" : ""}" data-expense-filter="paid">Quitadas</button>
      </div>
      <div class="list">
        ${expenses.length ? expenses.map(expenseRow).join("") : emptyPanel("Nenhuma despesa cadastrada para esse mes.")}
      </div>
    </section>
  `;

  document.querySelector("#openExpense").addEventListener("click", () => openExpenseDialog());
  document.querySelector("#openRevenue").addEventListener("click", () => openRevenueDialog());
  document.querySelector("#openNubankManager").addEventListener("click", openNubankDialog);
  const nubankPaidToggle = document.querySelector("#nubankPaidToggle");
  if (nubankPaidToggle) {
    nubankPaidToggle.addEventListener("change", () => {
      const aggregate = nubankAggregate(month);
      if (!aggregate) return;
      aggregate.status = nubankPaidToggle.checked ? "paid" : "open";
      save();
      render();
    });
  }
  document.querySelector("#toggleMonthClosed").addEventListener("click", toggleMonthClosed);
  document.querySelector("#openBudgets").addEventListener("click", openBudgetDialog);
  document.querySelector("#expenseSearch").addEventListener("change", (event) => {
    state.expenseSearch = cleanText(event.target.value);
    renderSummary();
  });
  document.querySelector("#expenseCategoryFilter").addEventListener("change", (event) => {
    state.categoryFilter = event.target.value;
    renderSummary();
  });
  app.views.summary.querySelectorAll("[data-expense-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expenseFilter = button.dataset.expenseFilter;
      renderSummary();
    });
  });
  bindExpenseControls(app.views.summary);
}

function nubankSummaryButton(month, values) {
  const paid = values.aggregate?.status === "paid";
  const detail = values.installments.length
    ? `${values.installments.length} parcela(s) detalhada(s) neste mes`
    : "Toque para cadastrar e consultar parcelas";
  return `
    <article class="nubank-summary-row section ${paid ? "paid" : ""}">
      <input id="nubankPaidToggle" class="toggle-paid" type="checkbox" ${paid ? "checked" : ""} ${!values.aggregate || month.closed ? "disabled" : ""} aria-label="Marcar despesas fixas do cartao como quitadas" />
      <button id="openNubankManager" class="nubank-summary-button" type="button">
        <span>
          <strong>Despesas fixas - Cartao</strong>
          <small>${detail}</small>
        </span>
        <span class="nubank-summary-value">${money.format(values.total)}</span>
      </button>
    </article>
  `;
}

function metric(label, value, tone = "neutral") {
  return `
    <article class="metric metric-${tone}">
      <p class="metric-label">${label}</p>
      <p class="metric-value">${value}</p>
    </article>
  `;
}

function expenseRow(expense) {
  const checked = expense.status === "paid" ? "checked" : "";
  const installment = expense.installment ? ` - ${expense.installment.current}/${expense.installment.total}` : "";
  const recurrence = expense.recurrence_group_id ? " - recorrente" : "";
  const due = dueDateLabel(expense.due_date, expense.status);
  return `
    <article class="expense-row ${expense.status === "paid" ? "paid" : ""} ${due.className}" data-expense-row="${expense.id}">
      <input class="toggle-paid" type="checkbox" data-id="${expense.id}" ${checked} ${activeMonth().closed ? "disabled" : ""} aria-label="Marcar ${escapeHtml(cleanText(expense.name))} como quitada" />
      <div>
        <p class="expense-name">${escapeHtml(cleanText(expense.name))}</p>
        <p class="expense-meta">${escapeHtml(normalizeCategory(expense.category))}${installment}${recurrence}${due.text ? ` - ${due.text}` : ""}</p>
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
        <button class="primary-button" id="addRevenueFromList" ${month.closed ? "disabled" : ""}>+ Nova receita</button>
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
  const recurrence = revenue.recurrence_group_id ? " - recorrente" : "";
  const due = dueDateLabel(revenue.due_date, revenue.status === "received" ? "paid" : "open");
  return `
    <article class="expense-row ${revenue.status === "received" ? "paid" : ""} ${due.className}" data-revenue-row="${revenue.id}">
      <span class="revenue-dot" aria-hidden="true"></span>
      <div>
        <p class="expense-name">${escapeHtml(cleanText(revenue.name))}</p>
        <p class="expense-meta">${statusLabel}${recurrence}${due.text ? ` - ${due.text}` : ""}</p>
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

function renderCard() {
  const month = activeMonth();
  syncNubankAggregate(month);
  syncCardOtherExpense(month);
  const card = month.credit_card || { invoice_total: 0, linked_expense_ids: [] };
  const linkedTotal = cardLinkedTotal(month);
  const other = Math.max(0, (Number(card.invoice_total) || 0) - linkedTotal);
  const linkedIds = new Set(card.linked_expense_ids || []);
  const candidates = month.expenses
    .filter((expense) => !expense.is_card_auto && (expense.show_in_card || linkedIds.has(expense.id)))
    .sort((a, b) => Number(isNubankAggregate(b)) - Number(isNubankAggregate(a)));

  app.views.card.innerHTML = `
    <section class="section">
      <h2>Cartao de ${monthLabel(month)}</h2>
      <div class="panel">
        <label>
          Valor total da fatura
          <input id="cardInvoiceTotal" class="money-input" inputmode="numeric" value="${formatMoneyInput(card.invoice_total)}" ${month.closed ? "disabled" : ""} />
        </label>
        <div class="grid section">
          ${metric("Ja detalhado", money.format(linkedTotal), "yellow")}
          ${metric("Outras despesas", money.format(other), "red")}
        </div>
        <p class="small">O app calcula: fatura total menos despesas ja detalhadas. A diferenca entra automaticamente como Outras despesas no cartao.</p>
      </div>
    </section>
    <section class="section">
      <h2>Despesas ja dentro da fatura</h2>
      <div class="list">
        ${candidates.length ? candidates.map((expense) => cardExpenseRow(expense, card.linked_expense_ids.includes(expense.id))).join("") : emptyPanel("Toque em uma despesa e escolha Mostrar no cartao para ela aparecer aqui.")}
      </div>
    </section>
  `;

  document.querySelector("#cardInvoiceTotal").addEventListener("change", (event) => {
    month.credit_card.invoice_total = parseAmount(event.target.value);
    syncCardOtherExpense(month);
    save();
    render();
  });
  bindMoneyInput(document.querySelector("#cardInvoiceTotal"));

  app.views.card.querySelectorAll(".card-link-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const ids = new Set(month.credit_card.linked_expense_ids || []);
      if (checkbox.checked) ids.add(checkbox.dataset.id);
      else ids.delete(checkbox.dataset.id);
      month.credit_card.linked_expense_ids = [...ids];
      syncCardOtherExpense(month);
      save();
      render();
    });
  });

  app.views.card.querySelectorAll("[data-open-fixed-card]").forEach((button) => {
    button.addEventListener("click", openNubankDialog);
  });
}

function cardExpenseRow(expense, checked) {
  const locked = isNubankAggregate(expense);
  if (locked) {
    return `
      <article class="expense-row card-fixed-row">
        <input class="toggle-paid card-link-check" type="checkbox" data-id="${expense.id}" checked disabled aria-label="Incluida automaticamente no cartao" />
        <button class="card-fixed-button" type="button" data-open-fixed-card>
          <span>
            <strong class="expense-name">${escapeHtml(cleanText(expense.name))}</strong>
            <small class="expense-meta">Incluida automaticamente - toque para administrar</small>
          </span>
          <strong class="amount">${money.format(Number(expense.amount) || 0)}</strong>
        </button>
      </article>
    `;
  }
  return `
    <article class="expense-row">
      <input class="toggle-paid card-link-check" type="checkbox" data-id="${expense.id}" ${checked ? "checked" : ""} ${activeMonth().closed ? "disabled" : ""} aria-label="Incluir ${escapeHtml(cleanText(expense.name))} no cartao" />
      <div>
        <p class="expense-name">${escapeHtml(cleanText(expense.name))}</p>
        <p class="expense-meta">${escapeHtml(normalizeCategory(expense.category))}</p>
      </div>
      <strong class="amount">${money.format(Number(expense.amount) || 0)}</strong>
    </article>
  `;
}

function cardLinkedTotal(month) {
  const ids = new Set(month.credit_card?.linked_expense_ids || []);
  return sum(month.expenses
    .filter((expense) => ids.has(expense.id) && !expense.is_card_auto)
    .map((expense) => Number(expense.amount) || 0));
}

function syncCardOtherExpense(month) {
  month.credit_card = month.credit_card || { invoice_total: 0, linked_expense_ids: [] };
  const existingIds = new Set(month.expenses.map((expense) => expense.id));
  month.credit_card.linked_expense_ids = (month.credit_card.linked_expense_ids || []).filter((id) => existingIds.has(id));
  const linkedTotal = cardLinkedTotal(month);
  const other = Math.max(0, (Number(month.credit_card.invoice_total) || 0) - linkedTotal);
  const autoId = `${month.id}-card-other-auto`;
  let autoExpense = month.expenses.find((expense) => expense.id === autoId || expense.is_card_auto);
  if (other <= 0) {
    month.expenses = month.expenses.filter((expense) => expense.id !== autoId && !expense.is_card_auto);
    return;
  }
  if (!autoExpense) {
    autoExpense = {
      id: autoId,
      name: "Outras despesas no cartao",
      amount: other,
      category: "Cartao",
      payment_method: "Cartao",
      status: "open",
      type: "card-auto",
      is_card_auto: true
    };
    month.expenses.push(autoExpense);
  } else {
    autoExpense.id = autoId;
    autoExpense.name = "Outras despesas no cartao";
    autoExpense.amount = other;
    autoExpense.category = "Cartao";
    autoExpense.payment_method = "Cartao";
    autoExpense.is_card_auto = true;
  }
}

function openActionDialog(type, id) {
  state.selectedAction = { type, id };
  const found = type === "expense" ? findExpense(id) : findRevenue(id);
  const item = type === "expense" ? found?.expense : found?.revenue;
  if (!item) return;
  app.actionDialogTitle.textContent = cleanText(item.name);
  const groupId = itemSeriesId(item);
  const hasSeries = Boolean(groupId && seriesItems(type, groupId).length > 1);
  app.actionEditSeriesButton.hidden = !hasSeries;
  app.actionDeleteSeriesButton.hidden = !hasSeries;
  app.actionEditButton.disabled = Boolean(found.month.closed);
  app.actionDeleteButton.disabled = Boolean(found.month.closed);
  app.actionEditSeriesButton.disabled = Boolean(found.month.closed);
  app.actionDeleteSeriesButton.disabled = Boolean(found.month.closed);
  app.actionCardButton.hidden = type !== "expense";
  app.actionCardButton.disabled = Boolean(found.month.closed);
  if (type === "expense") {
    app.actionCardButton.textContent = item.show_in_card ? "Remover do cartao" : "Mostrar no cartao";
  }
  app.actionDialog.showModal();
}

function closeActionDialog() {
  state.selectedAction = null;
  app.actionDialog.close();
}

function editSelectedAction(wholeSeries = false) {
  const selected = state.selectedAction;
  closeActionDialog();
  if (!selected) return;
  if (selected.type === "expense") {
    const found = findExpense(selected.id);
    if (found) {
      state.editWholeSeries = wholeSeries;
      openExpenseDialog(found.expense);
    }
  } else {
    const found = findRevenue(selected.id);
    if (found) {
      state.editWholeSeries = wholeSeries;
      openRevenueDialog(found.revenue);
    }
  }
}

function toggleSelectedExpenseCardVisibility() {
  const selected = state.selectedAction;
  closeActionDialog();
  if (!selected || selected.type !== "expense") return;
  const found = findExpense(selected.id);
  if (!found) return;
  found.expense.show_in_card = !found.expense.show_in_card;
  if (!found.expense.show_in_card && found.month.credit_card) {
    found.month.credit_card.linked_expense_ids = (found.month.credit_card.linked_expense_ids || [])
      .filter((id) => id !== found.expense.id);
    syncCardOtherExpense(found.month);
  }
  save();
  render();
}

function deleteSelectedAction(wholeSeries = false) {
  const selected = state.selectedAction;
  closeActionDialog();
  if (!selected) return;
  const snapshot = [];
  if (selected.type === "expense") {
    const found = findExpense(selected.id);
    if (found) {
      const groupId = itemSeriesId(found.expense);
      state.data.months.forEach((month) => {
        const removed = month.expenses.filter((expense) => wholeSeries && groupId ? itemSeriesId(expense) === groupId : expense.id === selected.id);
        removed.forEach((item) => snapshot.push({ type: "expense", monthId: month.id, item: structuredClone(item) }));
        month.expenses = month.expenses.filter((expense) => !removed.includes(expense));
        syncCardOtherExpense(month);
      });
    }
  } else {
    const found = findRevenue(selected.id);
    if (found) {
      const groupId = itemSeriesId(found.revenue);
      state.data.months.forEach((month) => {
        const removed = month.revenues.filter((revenue) => wholeSeries && groupId ? itemSeriesId(revenue) === groupId : revenue.id === selected.id);
        removed.forEach((item) => snapshot.push({ type: "revenue", monthId: month.id, item: structuredClone(item) }));
        month.revenues = month.revenues.filter((revenue) => !removed.includes(revenue));
      });
    }
  }
  state.deletedSnapshot = snapshot;
  showUndoToast();
  save();
  render();
}

function renderOptions() {
  const lastBackup = localStorage.getItem("meu-fluxo-last-backup");
  const backupWarning = !lastBackup || (Date.now() - new Date(lastBackup).getTime()) > 30 * 86400000;
  app.views.options.innerHTML = `
    <section class="section">
      <h2>Opcoes</h2>
      <div class="panel">
        <label>
          Tema do app
          <select id="themeSelect">
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
          </select>
        </label>
      </div>
    </section>
    <section class="section">
      <h2>Backup</h2>
      ${backupWarning ? `<div class="backup-warning">Seu backup esta pendente. Exporte uma copia para proteger seus dados.</div>` : `<p class="small">Ultimo backup: ${new Date(lastBackup).toLocaleDateString("pt-BR")}.</p>`}
      <div class="actions">
        <button class="secondary-button" id="importBackup">Importar backup</button>
        <button class="secondary-button" id="exportBackup">Exportar backup</button>
      </div>
      <p class="small">Use exportar backup para guardar seus dados. Use importar backup para restaurar ou levar os dados para outro aparelho.</p>
    </section>
  `;

  const themeSelect = document.querySelector("#themeSelect");
  themeSelect.value = state.theme;
  themeSelect.addEventListener("change", () => {
    state.theme = themeSelect.value;
    localStorage.setItem("meu-fluxo-theme", state.theme);
    applyTheme();
  });
  document.querySelector("#importBackup").addEventListener("click", () => app.backupFileInput.click());
  document.querySelector("#exportBackup").addEventListener("click", exportBackup);
}

function applyTheme() {
  document.body.dataset.theme = state.theme === "light" ? "light" : "dark";
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", state.theme === "light" ? "#f6f4ef" : "#101418");
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
  localStorage.setItem("meu-fluxo-last-backup", new Date().toISOString());
  renderOptions();
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
      state.activeMonthId = financialMonthForToday().id;
      state.chartAuto = true;
      state.chartEndId = state.activeMonthId;
      state.chartStartId = monthOffsetId(state.chartEndId, -11);
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
  const months = chartMonths();
  const periodLabel = `${monthLabel(months[0])} a ${monthLabel(months[months.length - 1])}`;
  const yearTotals = months.map(totals);
  const totalExpenses = sum(yearTotals.map((item) => item.expenses));
  const totalRevenues = sum(yearTotals.map((item) => item.revenues));
  const balance = totalRevenues - totalExpenses;
  const averageBalance = months.length ? balance / months.length : 0;
  const forecastMonths = monthsBetween(state.activeMonthId, monthOffsetId(state.activeMonthId, 2));
  const forecastBalance = sum(forecastMonths.map((month) => totals(month).balance));

  app.views.year.innerHTML = `
    <section class="panel section">
      <h2>Periodo do grafico</h2>
      <div class="period-grid">
        <label>
          Mes inicial
          <select id="chartStartMonth">${monthOptions(Number(state.chartStartId.split("-")[1]))}</select>
        </label>
        <label>
          Ano inicial
          <input id="chartStartYear" inputmode="numeric" value="${state.chartStartId.split("-")[0]}" />
        </label>
        <label>
          Mes final
          <select id="chartEndMonth">${monthOptions(Number(state.chartEndId.split("-")[1]))}</select>
        </label>
        <label>
          Ano final
          <input id="chartEndYear" inputmode="numeric" value="${state.chartEndId.split("-")[0]}" />
        </label>
      </div>
      <button class="secondary-button full-button" id="applyChartPeriod" type="button">Atualizar grafico</button>
      <button class="text-button full-button" id="resetChartPeriod" type="button">Usar periodo automatico</button>
      <p class="small">${state.chartAuto ? "Periodo automatico, atualizado pela virada financeira do dia 20." : "Periodo escolhido manualmente."} O grafico mostra no maximo 12 meses.</p>
    </section>
    <div class="grid section">
      ${metric("Gasto no periodo", money.format(totalExpenses), "red")}
      ${metric("Recebido", money.format(totalRevenues), "green")}
      ${metric("Saldo acumulado", money.format(balance), balance >= 0 ? "green" : "red")}
      ${metric("Media do saldo", money.format(averageBalance), averageBalance >= 0 ? "green" : "red")}
    </div>
    <section class="panel section">
      <h2>Previsao dos proximos 3 meses</h2>
      <p class="forecast-value ${forecastBalance < 0 ? "negative-text" : "positive-text"}">${money.format(forecastBalance)}</p>
      <p class="small">Calculada com receitas, parcelas e despesas recorrentes ja cadastradas.</p>
    </section>
    <section class="panel section">
      <h2>Saldo mes a mes</h2>
      <p class="small">${periodLabel} - limite de 12 meses.</p>
      ${lineChart(months, yearTotals)}
    </section>
    <section class="panel section">
      <h2>Receitas x despesas</h2>
      <div class="chart-legend"><span class="legend-revenue">Receitas</span><span class="legend-expense">Despesas</span></div>
      ${comparisonLineChart(months, yearTotals)}
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
  document.querySelector("#applyChartPeriod").addEventListener("click", applyChartPeriod);
  document.querySelector("#resetChartPeriod").addEventListener("click", resetChartPeriod);
  bindHistoryRows(app.views.year);
}

function chartMonths() {
  let startId = state.chartStartId || monthOffsetId(state.activeMonthId, -11);
  let endId = state.chartEndId || state.activeMonthId;
  if (startId > endId) [startId, endId] = [endId, startId];
  return monthsBetween(startId, endId);
}

function monthOptions(selectedMonth) {
  return monthNames.map((name, index) => {
    const value = index + 1;
    return `<option value="${value}" ${value === selectedMonth ? "selected" : ""}>${name}</option>`;
  }).join("");
}

function applyChartPeriod() {
  const startMonth = Number(document.querySelector("#chartStartMonth").value);
  const startYear = Number(document.querySelector("#chartStartYear").value);
  const endMonth = Number(document.querySelector("#chartEndMonth").value);
  const endYear = Number(document.querySelector("#chartEndYear").value);
  if (!startYear || !endYear || startYear < 2000 || endYear > 2100) return;

  let startId = `${startYear}-${String(startMonth).padStart(2, "0")}`;
  let endId = `${endYear}-${String(endMonth).padStart(2, "0")}`;
  if (startId > endId) [startId, endId] = [endId, startId];

  const startDate = new Date(Number(startId.slice(0, 4)), Number(startId.slice(5, 7)) - 1, 1);
  const endDate = new Date(Number(endId.slice(0, 4)), Number(endId.slice(5, 7)) - 1, 1);
  const diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth();
  if (diffMonths > 11) {
    startId = monthOffsetId(endId, -11);
  }

  state.chartStartId = startId;
  state.chartEndId = endId;
  state.chartAuto = false;
  save();
  renderYear();
}

function resetChartPeriod() {
  state.chartAuto = true;
  state.chartEndId = financialMonthForToday().id;
  state.chartStartId = monthOffsetId(state.chartEndId, -11);
  save();
  renderYear();
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

function comparisonLineChart(months, totalsByMonth) {
  if (!months.length) return emptyPanel("Sem meses para mostrar.");
  const values = totalsByMonth.flatMap((item) => [item.revenues, item.expenses]);
  const max = Math.max(1, ...values);
  const width = 720;
  const height = 280;
  const padX = 44;
  const padY = 38;
  const step = months.length > 1 ? (width - padX * 2) / (months.length - 1) : 0;
  const pointsFor = (key) => totalsByMonth.map((item, index) => ({
    x: padX + index * step,
    y: padY + (max - item[key]) / max * (height - padY * 2)
  }));
  const revenues = pointsFor("revenues");
  const expenses = pointsFor("expenses");
  const pathFor = (points) => points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return `
    <div class="line-chart-wrap">
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Comparacao entre receitas e despesas">
        <path d="${pathFor(revenues)}" class="revenue-line" />
        <path d="${pathFor(expenses)}" class="expense-line" />
        ${months.map((month, index) => `
          <circle cx="${revenues[index].x}" cy="${revenues[index].y}" r="4" class="revenue-point"></circle>
          <circle cx="${expenses[index].x}" cy="${expenses[index].y}" r="4" class="expense-point"></circle>
          <text x="${revenues[index].x}" y="${height - 12}" text-anchor="middle" class="chart-month">${monthNames[month.month - 1].slice(0, 3)}</text>
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

function openNubankDialog() {
  renderNubankDialog();
  app.nubankDialog.showModal();
}

function renderNubankDialog() {
  const month = activeMonth();
  const values = nubankMonthValues(month);
  app.nubankDialogTitle.textContent = `Despesas fixas - Cartao - ${monthLabel(month)}`;
  app.nubankMonthTotal.textContent = money.format(values.total);
  app.nubankBaseAmount.value = formatMoneyInput(values.base);
  app.nubankBaseAmount.disabled = month.closed;
  app.nubankBaseForm.querySelector("button").disabled = month.closed;
  document.querySelector("#openNubankPurchase").disabled = month.closed;
  app.nubankInstallmentList.innerHTML = values.installments.length
    ? values.installments.map(nubankInstallmentRow).join("")
    : emptyPanel("Nenhuma compra parcelada cadastrada para este mes.");

  app.nubankInstallmentList.querySelectorAll("[data-nubank-purchase]").forEach((button) => {
    button.addEventListener("click", () => openNubankPurchaseDialog(button.dataset.nubankPurchase));
  });
}

function nubankInstallmentRow(item) {
  return `
    <button class="nubank-installment-row" type="button" data-nubank-purchase="${item.purchase.id}" ${activeMonth().closed ? "disabled" : ""}>
      <span>
        <strong>${escapeHtml(item.purchase.name)}</strong>
        <small>Parcela ${item.current}/${item.total}</small>
      </span>
      <strong>${money.format(item.amount)}</strong>
    </button>
  `;
}

function ensureNubankAggregate(month) {
  let aggregate = nubankAggregate(month);
  if (!aggregate) {
    aggregate = {
      id: `${month.id}-nubank-fixed-auto`,
      name: "Despesas fixas - Cartao",
      amount: 0,
      nubank_base_amount: 0,
      category: "Assinaturas/Servicos",
      payment_method: "Cartao",
      status: "open",
      type: "nubank-aggregate",
      is_nubank_aggregate: true
    };
    month.expenses.push(aggregate);
  }
  return aggregate;
}

function saveNubankBaseAmount(event) {
  event.preventDefault();
  const month = activeMonth();
  if (month.closed) return;
  const aggregate = ensureNubankAggregate(month);
  aggregate.nubank_base_amount = parseAmount(app.nubankBaseAmount.value);
  syncNubankAggregate(month);
  syncCardOtherExpense(month);
  save();
  renderNubankDialog();
  render();
}

function openNubankPurchaseDialog(purchaseId = null) {
  if (activeMonth().closed) return;
  const purchase = purchaseId
    ? state.data.nubank_purchases.find((item) => item.id === purchaseId)
    : null;
  const monthItem = purchase
    ? nubankInstallmentsForMonth(state.activeMonthId).find((item) => item.purchase.id === purchase.id)
    : null;

  app.nubankPurchaseForm.reset();
  app.nubankPurchaseAmount.setCustomValidity("");
  app.nubankPurchaseCurrent.setCustomValidity("");
  app.nubankPurchaseTotal.setCustomValidity("");
  app.nubankPurchaseId.value = purchase?.id || "";
  app.nubankPurchaseDialogTitle.textContent = purchase ? "Editar compra parcelada" : "Nova compra parcelada";
  app.nubankPurchaseName.value = purchase?.name || "";
  app.nubankPurchaseAmount.value = formatMoneyInput(purchase?.amount || 0);
  app.nubankPurchaseCurrent.value = monthItem?.current || 1;
  app.nubankPurchaseTotal.value = purchase?.total_installments || 1;
  app.deleteNubankPurchase.hidden = !purchase;
  state.activeNubankPurchaseId = purchase?.id || null;
  app.nubankPurchaseDialog.showModal();
}

function saveNubankPurchase(event) {
  event.preventDefault();
  const name = cleanText(app.nubankPurchaseName.value.trim());
  const amount = parseAmount(app.nubankPurchaseAmount.value);
  const current = Math.max(1, Number(app.nubankPurchaseCurrent.value) || 1);
  const total = Math.max(1, Number(app.nubankPurchaseTotal.value) || 1);
  app.nubankPurchaseAmount.setCustomValidity(amount > 0 ? "" : "Informe um valor maior que zero.");
  app.nubankPurchaseTotal.setCustomValidity(total >= current ? "" : "O total deve ser igual ou maior que a parcela atual.");

  if (!name || amount <= 0 || total < current) {
    app.nubankPurchaseName.reportValidity();
    app.nubankPurchaseAmount.reportValidity();
    app.nubankPurchaseTotal.reportValidity();
    return;
  }

  const existingId = app.nubankPurchaseId.value;
  if (existingId) {
    const purchase = state.data.nubank_purchases.find((item) => item.id === existingId);
    if (purchase) {
      const offset = monthDistance(purchase.start_month_id, state.activeMonthId);
      const startingInstallment = current - offset;
      if (startingInstallment < 1) {
        app.nubankPurchaseCurrent.setCustomValidity("Essa parcela nao pode ficar antes da primeira parcela da compra.");
        app.nubankPurchaseCurrent.reportValidity();
        return;
      }
      app.nubankPurchaseCurrent.setCustomValidity("");
      purchase.name = name;
      purchase.amount = amount;
      purchase.starting_installment = startingInstallment;
      purchase.total_installments = total;
    }
  } else {
    state.data.nubank_purchases.push({
      id: `nubank-${Date.now()}`,
      name,
      amount,
      start_month_id: state.activeMonthId,
      starting_installment: current,
      total_installments: total
    });
  }

  normalizeNubankPurchases();
  syncAllNubankAggregates();
  save();
  app.nubankPurchaseDialog.close();
  state.activeNubankPurchaseId = null;
  render();
  renderNubankDialog();
}

function deleteNubankPurchase() {
  const purchaseId = app.nubankPurchaseId.value;
  if (!purchaseId || activeMonth().closed) return;
  const purchase = state.data.nubank_purchases.find((item) => item.id === purchaseId);
  state.deletedSnapshot = purchase
    ? [{ type: "nubank-purchase", monthId: null, item: structuredClone(purchase) }]
    : null;
  state.data.nubank_purchases = state.data.nubank_purchases.filter((purchase) => purchase.id !== purchaseId);
  syncAllNubankAggregates();
  if (state.deletedSnapshot) showUndoToast();
  save();
  app.nubankPurchaseDialog.close();
  state.activeNubankPurchaseId = null;
  render();
  renderNubankDialog();
}

function openExpenseDialog(expense = null) {
  if (activeMonth().closed) return;
  app.form.reset();
  app.expenseId.value = expense ? expense.id : "";
  app.dialogTitle.textContent = expense ? "Editar despesa" : "Nova despesa";
  app.expenseName.value = expense ? cleanText(expense.name) : "";
  app.expenseAmount.value = formatMoneyInput(expense ? expense.amount : 0);
  app.expenseDueDate.value = expense ? expense.due_date || "" : "";
  app.expenseCategory.value = expense ? cleanText(expense.category) : "Outros";
  app.expensePayment.value = expense ? cleanText(expense.payment_method) : "";
  app.expensePaid.checked = expense ? expense.status === "paid" : false;
  app.installmentCurrent.value = expense && expense.installment ? expense.installment.current : "";
  app.installmentTotal.value = expense && expense.installment ? expense.installment.total : "";
  app.installmentCurrent.disabled = Boolean(expense);
  app.installmentTotal.disabled = Boolean(expense);
  app.expenseRecurring.checked = false;
  app.expenseRecurring.disabled = Boolean(expense);
  app.expenseRecurringCountLabel.hidden = true;
  state.editWholeSeries = expense ? state.editWholeSeries : false;
  app.dialog.showModal();
}

function openRevenueDialog(revenue = null) {
  if (activeMonth().closed) return;
  app.revenueForm.reset();
  app.revenueId.value = revenue ? revenue.id : "";
  app.revenueDialogTitle.textContent = revenue ? "Editar receita" : "Nova receita";
  app.revenueName.value = revenue ? cleanText(revenue.name) : "";
  app.revenueAmount.value = formatMoneyInput(revenue ? revenue.amount : 0);
  app.revenueDueDate.value = revenue ? revenue.due_date || "" : "";
  app.revenueStatus.value = revenue ? revenue.status || "expected" : "expected";
  app.revenueRecurring.checked = false;
  app.revenueRecurring.disabled = Boolean(revenue);
  app.revenueRecurringCountLabel.hidden = true;
  state.editWholeSeries = revenue ? state.editWholeSeries : false;
  app.revenueDialog.showModal();
}

function saveRevenueFromDialog() {
  const name = cleanText(app.revenueName.value.trim());
  const amount = parseAmount(app.revenueAmount.value);
  app.revenueAmount.setCustomValidity(amount > 0 ? "" : "Informe um valor maior que zero.");

  if (!name || amount <= 0) {
    app.revenueName.reportValidity();
    app.revenueAmount.reportValidity();
    return;
  }

  const existingId = app.revenueId.value;
  if (existingId) {
    const found = findRevenue(existingId);
    if (found) {
      const groupId = itemSeriesId(found.revenue);
      const targets = state.editWholeSeries && groupId ? seriesItems("revenue", groupId) : [found];
      targets.forEach(({ month, revenue }) => {
        revenue.name = name;
        revenue.amount = amount;
        revenue.status = app.revenueStatus.value;
        revenue.due_date = shiftDateToMonth(app.revenueDueDate.value, month.id);
      });
    }
  } else {
    addRecurringRevenues({
      name,
      amount,
      status: app.revenueStatus.value,
      due_date: app.revenueDueDate.value,
      count: app.revenueRecurring.checked ? clampCount(app.revenueRecurringCount.value) : 1
    });
  }

  state.editWholeSeries = false;
  save();
  app.revenueDialog.close();
  render();
}

function saveExpenseFromDialog() {
  const name = cleanText(app.expenseName.value.trim());
  const amount = parseAmount(app.expenseAmount.value);
  app.expenseAmount.setCustomValidity(amount > 0 ? "" : "Informe um valor maior que zero.");

  if (!name || amount <= 0) {
    app.expenseName.reportValidity();
    app.expenseAmount.reportValidity();
    return;
  }

  const existingId = app.expenseId.value;
  if (existingId) {
    const found = findExpense(existingId);
    if (found) {
      const groupId = itemSeriesId(found.expense);
      const targets = state.editWholeSeries && groupId ? seriesItems("expense", groupId) : [found];
      targets.forEach(({ month, expense }) => {
        expense.name = expense.installment
          ? `${stripInstallmentSuffix(name)} ${expense.installment.current}/${expense.installment.total}`
          : name;
        expense.amount = amount;
        expense.category = normalizeCategory(app.expenseCategory.value);
        expense.payment_method = cleanText(app.expensePayment.value);
        if (!state.editWholeSeries || expense.id === existingId) {
          expense.status = app.expensePaid.checked ? "paid" : "open";
        }
        expense.due_date = shiftDateToMonth(app.expenseDueDate.value, month.id);
      });
    }
  } else {
    addInstallmentExpenses({
      name,
      amount,
      category: normalizeCategory(app.expenseCategory.value),
      payment_method: cleanText(app.expensePayment.value),
      status: app.expensePaid.checked ? "paid" : "open",
      due_date: app.expenseDueDate.value,
      current: Math.max(1, Number(app.installmentCurrent.value) || 1),
      total: Math.max(1, Number(app.installmentTotal.value) || Number(app.installmentCurrent.value) || 1),
      recurrence_count: app.expenseRecurring.checked ? clampCount(app.expenseRecurringCount.value) : 1
    });
  }

  state.editWholeSeries = false;
  save();
  app.dialog.close();
  render();
}

function addInstallmentExpenses(input) {
  const startMonth = activeMonth();
  const totalToCreate = input.total > 1
    ? Math.max(1, input.total - input.current + 1)
    : input.recurrence_count;
  const groupId = `custom-${Date.now()}`;
  const isInstallment = input.total > 1;
  const isRecurring = !isInstallment && input.recurrence_count > 1;

  for (let offset = 0; offset < totalToCreate; offset += 1) {
    const month = monthOffset(startMonth, offset);
    const current = isInstallment ? input.current + offset : 1;
    month.expenses.push({
      id: `${month.id}-expense-${groupId}-${current}`,
      name: isInstallment ? `${input.name} ${current}/${input.total}` : input.name,
      amount: input.amount,
      category: input.category,
      payment_method: input.payment_method,
      status: offset === 0 ? input.status : "open",
      due_date: shiftDateToMonth(input.due_date, month.id),
      type: isInstallment ? "installment" : (isRecurring ? "recurring" : "eventual"),
      installment: isInstallment ? { current, total: input.total, groupId } : null,
      recurrence_group_id: isRecurring ? groupId : null
    });
  }
}

function addRecurringRevenues(input) {
  const startMonth = activeMonth();
  const groupId = input.count > 1 ? `revenue-${Date.now()}` : null;
  for (let offset = 0; offset < input.count; offset += 1) {
    const month = monthOffset(startMonth, offset);
    month.revenues.push({
      id: `${month.id}-revenue-custom-${Date.now()}-${offset}`,
      name: input.name,
      amount: input.amount,
      status: offset === 0 ? input.status : "expected",
      due_date: shiftDateToMonth(input.due_date, month.id),
      recurrence_group_id: groupId
    });
  }
}

function itemSeriesId(item) {
  return item?.installment?.groupId || item?.recurrence_group_id || null;
}

function seriesItems(type, groupId) {
  const results = [];
  state.data.months.forEach((month) => {
    const items = type === "expense" ? month.expenses : month.revenues;
    items.forEach((item) => {
      if (itemSeriesId(item) === groupId) {
        results.push(type === "expense" ? { month, expense: item } : { month, revenue: item });
      }
    });
  });
  return results;
}

function stripInstallmentSuffix(name) {
  return cleanText(name).replace(/\s+\d+\/\d+$/, "").trim();
}

function clampCount(value) {
  return Math.max(1, Math.min(120, Number(value) || 12));
}

function shiftDateToMonth(dateValue, monthId) {
  if (!dateValue) return "";
  const day = Math.max(1, Math.min(31, Number(dateValue.slice(8, 10)) || 1));
  const [year, month] = monthId.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthId}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function formatMoneyInput(value) {
  const cents = Math.max(0, Math.round((Number(value) || 0) * 100));
  return `${Math.floor(cents / 100).toLocaleString("pt-BR")},${String(cents % 100).padStart(2, "0")}`;
}

function bindMoneyInput(input) {
  if (!input || input.dataset.moneyBound) return;
  input.dataset.moneyBound = "true";
  input.addEventListener("focus", () => input.select());
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
    input.value = formatMoneyInput(Number(digits) / 100);
  });
}

function dueDateLabel(dateValue, status) {
  if (!dateValue || status === "paid") return { text: "", className: "" };
  const due = new Date(`${dateValue}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return { text: `atrasada ${Math.abs(days)} dia(s)`, className: "overdue" };
  if (days <= 7) return { text: days === 0 ? "vence hoje" : `vence em ${days} dia(s)`, className: "due-soon" };
  return { text: `vence ${dateValue.slice(8, 10)}/${dateValue.slice(5, 7)}`, className: "" };
}

function toggleMonthClosed() {
  const month = activeMonth();
  month.closed = !month.closed;
  save();
  render();
}

function budgetCategories() {
  return ["Moradia", "Transporte", "Educacao", "Saude e bem-estar", "Assinaturas/Servicos", "Lazer", "Mercado", "Cartao", "Outros"];
}

function openBudgetDialog() {
  app.budgetFields.innerHTML = budgetCategories().map((category) => `
    <label>
      ${category}
      <input class="money-input budget-input" inputmode="numeric" data-category="${escapeHtml(category)}" value="${formatMoneyInput(state.data.settings.budgets[category] || 0)}" />
    </label>
  `).join("");
  app.budgetFields.querySelectorAll(".money-input").forEach(bindMoneyInput);
  app.budgetDialog.showModal();
}

function saveBudgets(event) {
  event.preventDefault();
  app.budgetFields.querySelectorAll("[data-category]").forEach((input) => {
    const value = parseAmount(input.value);
    if (value > 0) state.data.settings.budgets[input.dataset.category] = value;
    else delete state.data.settings.budgets[input.dataset.category];
  });
  save();
  app.budgetDialog.close();
  render();
}

function budgetProgress(month) {
  const budgets = state.data.settings.budgets || {};
  return Object.entries(budgets).map(([category, limit]) => {
    const spent = sum(month.expenses.filter((expense) => normalizeCategory(expense.category) === category).map((expense) => Number(expense.amount) || 0));
    return { category, limit: Number(limit), spent, percent: Math.min(100, (spent / Number(limit)) * 100) };
  }).filter((item) => item.limit > 0);
}

function budgetProgressRow(item) {
  const alertClass = item.spent > item.limit ? "over-budget" : (item.percent >= 80 ? "near-budget" : "");
  return `
    <div class="budget-progress ${alertClass}">
      <div class="budget-progress-head">
        <strong>${escapeHtml(item.category)}</strong>
        <span>${money.format(item.spent)} de ${money.format(item.limit)}</span>
      </div>
      <div class="budget-track"><span style="width:${item.percent}%"></span></div>
    </div>
  `;
}

function showUndoToast() {
  clearTimeout(state.undoTimer);
  app.undoToast.hidden = false;
  state.undoTimer = setTimeout(() => {
    app.undoToast.hidden = true;
    state.deletedSnapshot = null;
  }, 8000);
}

function undoLastDelete() {
  if (!state.deletedSnapshot) return;
  state.deletedSnapshot.forEach(({ type, monthId, item }) => {
    if (type === "nubank-purchase") {
      state.data.nubank_purchases.push(item);
      return;
    }
    const month = state.data.months.find((entry) => entry.id === monthId);
    if (!month) return;
    if (type === "expense") month.expenses.push(item);
    else month.revenues.push(item);
  });
  normalizeNubankPurchases();
  syncAllNubankAggregates();
  state.deletedSnapshot = null;
  clearTimeout(state.undoTimer);
  app.undoToast.hidden = true;
  save();
  render();
}

function parseAmount(value) {
  const raw = String(value || "").trim();
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
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
