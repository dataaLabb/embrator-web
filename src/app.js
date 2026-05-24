(function () {
  "use strict";

  const config = window.EMBRATOR_CONFIG || {};
  const apiBaseUrl = (config.apiBaseUrl || "").replace(/\/$/, "");
  const STORAGE_TOKEN = "embrator.neon.token";
  const STORAGE_EMAIL = "embrator.neon.email";

  const state = {
    token: localStorage.getItem(STORAGE_TOKEN) || "",
    userEmail: localStorage.getItem(STORAGE_EMAIL) || "",
    currentPage: "home",
    customers: [],
    items: [],
    lookupsReady: false,
    visit: emptyFilters(),
    collection: emptyFilters(),
    orderFilters: emptyFilters(),
    orderDraft: { id: "", code: "", lines: [] },
    ordersUnlocked: false,
    ordersScreenToken: "",
    dashboardUnlocked: false,
    ordersList: [],
    ordersSummary: [],
    ordersRepFilter: "",
    dashboardPayload: null,
    dashboardChartView: "trend",
    productionPayload: null,
    fieldAnalyticsPayload: null,
    fieldMovementsPayload: null,
    fieldMovementsPage: 1,
    fieldFilters: null,
    productionFilters: null,
    homeSummary: null,
    lastCompletedOrder: null,
    locations: {
      visit: emptyLocation(),
      collection: emptyLocation(),
      order: emptyLocation()
    },
    customerEditorCode: "",
    customerSearch: "",
    itemEditorCode: "",
    itemSearch: "",
    charts: {}
  };

  const ui = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDom();
    bindEvents();
    reflectSession();

    if (!state.token) {
      return;
    }

    try {
      await bootstrap();
    } catch (error) {
      clearSession();
      reflectSession();
      notify(error.message || "تعذر الاتصال بالخادم أو انتهت الجلسة.", "error");
    }
  }

  function cacheDom() {
    ui.loginScreen = document.getElementById("login-screen");
    ui.appScreen = document.getElementById("app-screen");
    ui.loginForm = document.getElementById("login-form");
    ui.loginEmail = document.getElementById("login-email");
    ui.loginPassword = document.getElementById("login-password");
    ui.loginSubmit = document.getElementById("login-submit");
    ui.loginFeedback = document.getElementById("login-feedback");
    ui.userEmail = document.getElementById("user-email");
    ui.logoutButton = document.getElementById("logout-button");
    ui.screenTitle = document.getElementById("screen-title");
    ui.globalAlert = document.getElementById("global-alert");
    ui.menuLinks = Array.from(document.querySelectorAll(".menu-link"));
    ui.jumpButtons = Array.from(document.querySelectorAll("[data-jump]"));
    ui.pages = Array.from(document.querySelectorAll("[data-page]"));

    ui.heroStats = document.getElementById("hero-stats");
    ui.recentOrders = document.getElementById("recent-orders");
    ui.recentCollections = document.getElementById("recent-collections");
    ui.miniInsights = document.getElementById("mini-insights");

    ui.visitFilters = document.getElementById("visit-filters");
    ui.collectionFilters = document.getElementById("collection-filters");
    ui.orderCustomerFilters = document.getElementById("order-customer-filters");

    ui.visitForm = document.getElementById("visit-form");
    ui.collectionForm = document.getElementById("collection-form");
    ui.collectionKind = document.getElementById("collection-kind");
    ui.transferKindWrapper = document.getElementById("transfer-kind-wrapper");
    ui.transferKind = document.getElementById("transfer-kind");
    ui.collectionAmount = document.getElementById("collection-amount");
    ui.chequeFieldsWrapper = document.getElementById("cheque-fields-wrapper");
    ui.chequeNumber = document.getElementById("cheque-number");
    ui.chequeBankName = document.getElementById("cheque-bank-name");
    ui.chequeDueDate = document.getElementById("cheque-due-date");
    ui.chequeImage = document.getElementById("cheque-image");

    ui.captureVisitLocation = document.getElementById("capture-visit-location");
    ui.captureCollectionLocation = document.getElementById("capture-collection-location");
    ui.captureOrderLocation = document.getElementById("capture-order-location");
    ui.visitLocationSummary = document.getElementById("visit-location-summary");
    ui.collectionLocationSummary = document.getElementById("collection-location-summary");
    ui.orderLocationSummary = document.getElementById("order-location-summary");

    ui.orderModel = document.getElementById("order-model");
    ui.orderItem = document.getElementById("order-item");
    ui.orderQty = document.getElementById("order-qty");
    ui.addOrderLine = document.getElementById("add-order-line");
    ui.orderLines = document.getElementById("order-lines");
    ui.orderCodeLabel = document.getElementById("order-code-label");
    ui.orderCodeBadge = document.getElementById("order-code-badge");
    ui.orderLinesCount = document.getElementById("order-lines-count");
    ui.orderTotalQty = document.getElementById("order-total-qty");
    ui.orderStatusBadge = document.getElementById("order-status-badge");
    ui.orderCompleteBanner = document.getElementById("order-complete-banner");
    ui.confirmOrder = document.getElementById("confirm-order");
    ui.cancelOrder = document.getElementById("cancel-order");

    ui.ordersLock = document.getElementById("orders-lock");
    ui.ordersPanel = document.getElementById("orders-panel");
    ui.ordersPassword = document.getElementById("orders-password");
    ui.unlockOrders = document.getElementById("unlock-orders");
    ui.ordersRepFilter = document.getElementById("orders-rep-filter");
    ui.ordersFrom = document.getElementById("orders-from");
    ui.ordersTo = document.getElementById("orders-to");
    ui.loadOrders = document.getElementById("load-orders");
    ui.showAllOrders = document.getElementById("show-all-orders");
    ui.ordersSummaryTable = document.getElementById("orders-summary-table");
    ui.ordersTable = document.getElementById("orders-table");
    ui.ordersListCaption = document.getElementById("orders-list-caption");

    ui.customerForm = document.getElementById("customer-form");
    ui.customerFormTitle = document.getElementById("customer-form-title");
    ui.customerFormReset = document.getElementById("customer-form-reset");
    ui.customerCode = document.getElementById("customer-code");
    ui.customerName = document.getElementById("customer-name");
    ui.customerRep = document.getElementById("customer-rep");
    ui.customerCategory = document.getElementById("customer-category");
    ui.customerSector = document.getElementById("customer-sector");
    ui.customerArea = document.getElementById("customer-area");
    ui.customerAddress = document.getElementById("customer-address");
    ui.customerPhone = document.getElementById("customer-phone");
    ui.customerEmail = document.getElementById("customer-email");
    ui.customerActive = document.getElementById("customer-active");
    ui.customerSubmit = document.getElementById("customer-submit");
    ui.refreshCustomers = document.getElementById("refresh-customers");
    ui.customersSearch = document.getElementById("customers-search");
    ui.customersTable = document.getElementById("customers-table");

    ui.itemForm = document.getElementById("item-form");
    ui.itemFormTitle = document.getElementById("item-form-title");
    ui.itemFormReset = document.getElementById("item-form-reset");
    ui.itemCode = document.getElementById("item-code");
    ui.itemName = document.getElementById("item-name");
    ui.itemModel = document.getElementById("item-model");
    ui.itemUnit = document.getElementById("item-unit");
    ui.itemPrice = document.getElementById("item-price");
    ui.itemActive = document.getElementById("item-active");
    ui.itemDescription = document.getElementById("item-description");
    ui.itemSubmit = document.getElementById("item-submit");
    ui.refreshItems = document.getElementById("refresh-items");
    ui.itemsSearch = document.getElementById("items-search");
    ui.itemsTable = document.getElementById("items-table");

    ui.dashboardLock = document.getElementById("dashboard-lock");
    ui.dashboardPanel = document.getElementById("dashboard-panel");
    ui.dashboardPassword = document.getElementById("dashboard-password");
    ui.unlockDashboard = document.getElementById("unlock-dashboard");
    ui.dashboardFrom = document.getElementById("dashboard-from");
    ui.dashboardTo = document.getElementById("dashboard-to");
    ui.dashboardRep = document.getElementById("dashboard-rep");
    ui.dashboardPayKind = document.getElementById("dashboard-pay-kind");
    ui.loadDashboard = document.getElementById("load-dashboard");
    ui.dashboardMetrics = document.getElementById("dashboard-metrics");
    ui.topCustomersList = document.getElementById("top-customers-list");
    ui.topItemsList = document.getElementById("top-items-list");
    ui.latestActivityList = document.getElementById("latest-activity-list");
    ui.dashboardChartButtons = Array.from(document.querySelectorAll("[data-dashboard-chart]"));

    ui.trendChart = document.getElementById("trend-chart");
    ui.statusChart = document.getElementById("status-chart");
    ui.repOrdersChart = document.getElementById("rep-orders-chart");
    ui.collectionTypeChart = document.getElementById("collection-type-chart");
    ui.dashboardChartCards = {
      trend: ui.trendChart ? ui.trendChart.closest(".sub-card") : null,
      status: ui.statusChart ? ui.statusChart.closest(".sub-card") : null,
      rep: ui.repOrdersChart ? ui.repOrdersChart.closest(".sub-card") : null,
      collectionType: ui.collectionTypeChart ? ui.collectionTypeChart.closest(".sub-card") : null
    };

    ui.productionFrom = document.getElementById("production-from");
    ui.productionTo = document.getElementById("production-to");
    ui.productionSource = document.getElementById("production-source");
    ui.loadProductionDashboard = document.getElementById("load-production-dashboard");
    ui.productionMetrics = document.getElementById("production-metrics");
    ui.productionDailyChart = document.getElementById("production-daily-chart");
    ui.productionSourceChart = document.getElementById("production-source-chart");
    ui.productionLinesChart = document.getElementById("production-lines-chart");
    ui.productionItemsList = document.getElementById("production-items-list");
    ui.productionDestinationsList = document.getElementById("production-destinations-list");
    ui.productionRecordsTable = document.getElementById("production-records-table");

    ui.fieldFrom = document.getElementById("field-from");
    ui.fieldTo = document.getElementById("field-to");
    ui.fieldRep = document.getElementById("field-rep");
    ui.fieldPayKind = document.getElementById("field-pay-kind");
    ui.loadFieldAnalytics = document.getElementById("load-field-analytics");
    ui.fieldMetrics = document.getElementById("field-metrics");
    ui.fieldCollectionsChart = document.getElementById("field-collections-chart");
    ui.fieldRepCollectionsChart = document.getElementById("field-rep-collections-chart");
    ui.fieldInsightsList = document.getElementById("field-insights-list");
    ui.fieldTypesList = document.getElementById("field-types-list");
    ui.fieldLatestList = document.getElementById("field-latest-list");
    ui.fieldMovementsTable = document.getElementById("field-movements-table");
    ui.fieldPrevPage = document.getElementById("field-prev-page");
    ui.fieldNextPage = document.getElementById("field-next-page");
    ui.fieldPageIndicator = document.getElementById("field-page-indicator");
    ui.exportFieldMovements = document.getElementById("export-field-movements");

    ui.detailsDialog = document.getElementById("details-dialog");
    ui.detailsTitle = document.getElementById("details-title");
    ui.orderDetailsContent = document.getElementById("order-details-content");
    ui.closeDialog = document.getElementById("close-dialog");
    ui.chequeImageDialog = document.getElementById("cheque-image-dialog");
    ui.closeChequeDialog = document.getElementById("close-cheque-dialog");
    ui.chequePreviewImage = document.getElementById("cheque-preview-image");
  }

  function bindEvents() {
    ui.loginForm.addEventListener("submit", onLogin);
    ui.logoutButton.addEventListener("click", logout);
    ui.menuLinks.forEach((button) => {
      button.addEventListener("click", function () {
        setPage(button.dataset.screen);
      });
    });
    ui.jumpButtons.forEach((button) => {
      button.addEventListener("click", function () {
        setPage(button.dataset.jump);
      });
    });

    ui.collectionKind.addEventListener("change", syncTransferField);
    ui.visitForm.addEventListener("submit", onSaveVisit);
    ui.collectionForm.addEventListener("submit", onSaveCollection);
    ui.captureVisitLocation.addEventListener("click", () => captureLocation("visit", ui.captureVisitLocation));
    ui.captureCollectionLocation.addEventListener("click", () =>
      captureLocation("collection", ui.captureCollectionLocation)
    );
    ui.captureOrderLocation.addEventListener("click", () => captureLocation("order", ui.captureOrderLocation));

    ui.orderModel.addEventListener("change", renderOrderItemOptions);
    ui.addOrderLine.addEventListener("click", onAddOrderLine);
    ui.confirmOrder.addEventListener("click", onConfirmOrder);
    ui.cancelOrder.addEventListener("click", onCancelOrder);

    ui.unlockOrders.addEventListener("click", onUnlockOrders);
    ui.loadOrders.addEventListener("click", onLoadOrders);
    ui.ordersRepFilter.addEventListener("change", function () {
      state.ordersRepFilter = ui.ordersRepFilter.value;
      renderOrdersTable();
    });
    ui.showAllOrders.addEventListener("click", function () {
      state.ordersRepFilter = "";
      ui.ordersRepFilter.value = "";
      renderOrdersTable();
    });

    ui.customerForm.addEventListener("submit", onSubmitCustomer);
    ui.customerFormReset.addEventListener("click", resetCustomerEditor);
    ui.refreshCustomers.addEventListener("click", refreshLookupsAndLists);
    ui.customersSearch.addEventListener("input", function () {
      state.customerSearch = ui.customersSearch.value.trim();
      renderCustomersTable();
    });

    ui.itemForm.addEventListener("submit", onSubmitItem);
    ui.itemFormReset.addEventListener("click", resetItemEditor);
    ui.refreshItems.addEventListener("click", refreshLookupsAndLists);
    ui.itemsSearch.addEventListener("input", function () {
      state.itemSearch = ui.itemsSearch.value.trim();
      renderItemsTable();
    });

    ui.unlockDashboard.addEventListener("click", onUnlockDashboard);
    ui.loadDashboard.addEventListener("click", onLoadDashboard);
    ui.loadProductionDashboard.addEventListener("click", onLoadProductionDashboard);
    ui.dashboardChartButtons.forEach((button) => {
      button.addEventListener("click", function () {
        setDashboardChartView(button.dataset.dashboardChart || "trend");
      });
    });
    ui.loadFieldAnalytics.addEventListener("click", onLoadFieldAnalytics);
    ui.fieldPrevPage.addEventListener("click", async function () {
      await changeFieldMovementsPage(-1);
    });
    ui.fieldNextPage.addEventListener("click", async function () {
      await changeFieldMovementsPage(1);
    });
    ui.exportFieldMovements.addEventListener("click", exportFieldMovementsExcel);

    ui.closeDialog.addEventListener("click", () => ui.detailsDialog.close());
    ui.closeChequeDialog.addEventListener("click", () => ui.chequeImageDialog.close());
  }

  async function bootstrap() {
    ui.userEmail.textContent = state.userEmail;
    notify("جارٍ تحميل بيانات التشغيل...", "info");
    await Promise.all([loadLookups(true), loadHomeSummary()]);
    renderAll();
    notify("تم الاتصال بقاعدة البيانات وتجهيز الواجهة.", "success");
  }

  async function refreshLookupsAndLists() {
    try {
      await Promise.all([loadLookups(true), loadHomeSummary()]);
      renderAll();
      notify("تم تحديث البيانات.", "success");
    } catch (error) {
      notify(error.message || "تعذر تحديث البيانات.", "error");
    }
  }

  function renderAll() {
    renderAllFilterGroups();
    renderOrderModelOptions();
    renderOrderLines();
    renderHomeSummary();
    renderOrdersRepSelect();
    renderOrdersSummaryTable();
    renderOrdersTable();
    renderCustomersTable();
    renderItemsTable();
    renderLocationSummary("visit");
    renderLocationSummary("collection");
    renderLocationSummary("order");
    renderProductionDashboard(state.productionPayload);
    renderDashboard(state.dashboardPayload);
    renderFieldAnalytics(state.fieldAnalyticsPayload, state.fieldMovementsPayload);
    setDashboardChartView(state.dashboardChartView);
    syncTransferField();
    setPage(state.currentPage);
  }

  function reflectSession() {
    const loggedIn = Boolean(state.token);
    ui.loginScreen.classList.toggle("hidden", loggedIn);
    ui.appScreen.classList.toggle("hidden", !loggedIn);
  }

  async function onLogin(event) {
    event.preventDefault();
    setBusy(ui.loginSubmit, true, "جارٍ التحقق...");
    ui.loginFeedback.textContent = "";

    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: {
          email: ui.loginEmail.value.trim(),
          password: ui.loginPassword.value
        }
      });

      state.token = result.token;
      state.userEmail = result.user.email;
      localStorage.setItem(STORAGE_TOKEN, state.token);
      localStorage.setItem(STORAGE_EMAIL, state.userEmail);
      reflectSession();
      await bootstrap();
    } catch (error) {
      ui.loginFeedback.textContent = error.message || "فشل تسجيل الدخول.";
    } finally {
      setBusy(ui.loginSubmit, false, "دخول");
    }
  }

  function logout() {
    clearSession();
    ui.loginForm.reset();
    ui.customerForm.reset();
    ui.itemForm.reset();
    destroyCharts();
    reflectSession();
    notify("تم تسجيل الخروج.", "info");
  }

  function clearSession() {
    state.token = "";
    state.userEmail = "";
    state.currentPage = "home";
    state.customers = [];
    state.items = [];
    state.lookupsReady = false;
    state.visit = emptyFilters();
    state.collection = emptyFilters();
    state.orderFilters = emptyFilters();
    state.orderDraft = { id: "", code: "", lines: [] };
    state.ordersUnlocked = false;
    state.ordersScreenToken = "";
    state.dashboardUnlocked = false;
    state.ordersList = [];
    state.ordersSummary = [];
    state.ordersRepFilter = "";
    state.dashboardPayload = null;
    state.fieldAnalyticsPayload = null;
    state.fieldMovementsPayload = null;
    state.fieldMovementsPage = 1;
    state.homeSummary = null;
    state.lastCompletedOrder = null;
    state.locations.visit = emptyLocation();
    state.locations.collection = emptyLocation();
    state.locations.order = emptyLocation();
    state.customerEditorCode = "";
    state.customerSearch = "";
    state.itemEditorCode = "";
    state.itemSearch = "";
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_EMAIL);
  }

  function setPage(pageName) {
    state.currentPage = pageName;
    ui.menuLinks.forEach((button) => button.classList.toggle("active", button.dataset.screen === pageName));
    ui.pages.forEach((page) => page.classList.toggle("hidden", page.dataset.page !== pageName));

    const titles = {
      home: "الرئيسية",
      visit: "تسجيل زيارة",
      collection: "تسجيل تحصيل",
      "orders-entry": "تسجيل طلبية",
      "orders-browser": "عرض الطلبيات",
      customers: "إدارة العملاء",
      items: "إدارة المنتجات",
      "production-dashboard": "لوحة الإنتاج",
      dashboard: "لوحة التحليلات",
      "field-analytics": "تحليل الزيارات والتحصيلات"
    };
    ui.screenTitle.textContent = titles[pageName] || "Embrator";
  }

  async function loadLookups(force) {
    if (state.lookupsReady && !force) {
      return;
    }

    const lookups = await apiRequest("/api/lookups");
    state.customers = (lookups.customers || []).map(normalizeCustomer).sort((a, b) => a.name.localeCompare(b.name, "ar"));
    state.items = (lookups.items || []).map(normalizeItem).sort((a, b) => a.name.localeCompare(b.name, "ar"));
    state.lookupsReady = true;
  }

  async function loadHomeSummary() {
    state.homeSummary = await apiRequest("/api/home-summary");
  }

  function renderHomeSummary() {
    const summary = state.homeSummary;
    if (!summary) {
      return;
    }

    const metrics = summary.metrics || {};
    ui.heroStats.innerHTML = [
      heroStat("العملاء", metrics.customers_count || 0, "إجمالي قاعدة العملاء"),
      heroStat("الطلبيات المؤكدة", metrics.confirmed_orders || 0, "طلبات تم إغلاقها بنجاح"),
      heroStat("تحصيل اليوم", formatCurrency(metrics.collections_today || 0), "قيمة التحصيلات اليوم"),
      heroStat("الزيارات اليوم", metrics.visits_today || 0, "عدد الزيارات الميدانية")
    ].join("");

    ui.recentOrders.innerHTML = (summary.recentOrders || []).length
      ? summary.recentOrders.map(renderRecentOrder).join("")
      : emptyInline("لا توجد طلبات بعد");
    ui.recentCollections.innerHTML = (summary.recentCollections || []).length
      ? summary.recentCollections.map(renderRecentCollection).join("")
      : emptyInline("لا توجد تحصيلات بعد");
    ui.miniInsights.innerHTML = [
      miniInsight("المنتجات", metrics.items_count || 0, "منتج"),
      miniInsight("كل الطلبيات", metrics.orders_count || 0, "طلبية"),
      miniInsight("الزيارات اليوم", metrics.visits_today || 0, "زيارة")
    ].join("");
  }

  function heroStat(label, value, hint) {
    return `
      <article class="hero-stat">
        <div>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(String(value))}</strong>
        </div>
        <small class="muted">${escapeHtml(hint)}</small>
      </article>
    `;
  }

  function miniInsight(label, value, suffix) {
    return `
      <article class="mini-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small class="muted">${escapeHtml(suffix)}</small>
      </article>
    `;
  }

  function renderRecentOrder(order) {
    return `
      <article class="list-item">
        <div>
          <strong>${escapeHtml(order.order_code || "")}</strong>
          <small>${escapeHtml(order.customer_name || "")} • ${escapeHtml(formatDate(order.created_at))}</small>
        </div>
        <span class="${statusClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
      </article>
    `;
  }

  function renderRecentCollection(collection) {
    return `
      <article class="list-item">
        <div>
          <strong>${escapeHtml(collection.customer_name || "")}</strong>
          <small>${escapeHtml(collection.collection_type || "")} • ${escapeHtml(formatDate(collection.created_at))}</small>
        </div>
        <span class="pill pill-confirmed">${escapeHtml(formatCurrency(collection.amount || 0))}</span>
      </article>
    `;
  }

  function renderAllFilterGroups() {
    renderCustomerFilters(ui.visitFilters, state.visit, "visit");
    renderCustomerFilters(ui.collectionFilters, state.collection, "collection");
    renderCustomerFilters(ui.orderCustomerFilters, state.orderFilters, "order");
  }

  function renderCustomerFilters(host, filters, prefix) {
    const activeCustomers = state.customers.filter((entry) => entry.is_active !== false);
    const scoped = scopedCustomers(activeCustomers, filters);

    host.innerHTML = [
      buildSelect(prefix + "-rep", "المندوب", unique(activeCustomers.map((entry) => entry.rep)), filters.rep),
      buildSelect(
        prefix + "-category",
        "التصنيف",
        unique(scoped.byRep.map((entry) => entry.category)),
        filters.category
      ),
      buildSelect(
        prefix + "-sector",
        "القطاع",
        unique(scoped.byCategory.map((entry) => entry.sector)),
        filters.sector
      ),
      buildSelect(prefix + "-area", "المنطقة", unique(scoped.bySector.map((entry) => entry.area)), filters.area),
      buildSelect(
        prefix + "-customer",
        "العميل",
        scoped.final.map((entry) => ({ value: entry.code, label: `${entry.code} | ${entry.name}` })),
        filters.customerCode
      )
    ].join("");

    bindFilterChange(host, prefix + "-rep", (value) => {
      filters.rep = value;
      filters.category = "";
      filters.sector = "";
      filters.area = "";
      filters.customerCode = "";
      renderAllFilterGroups();
    });
    bindFilterChange(host, prefix + "-category", (value) => {
      filters.category = value;
      filters.sector = "";
      filters.area = "";
      filters.customerCode = "";
      renderAllFilterGroups();
    });
    bindFilterChange(host, prefix + "-sector", (value) => {
      filters.sector = value;
      filters.area = "";
      filters.customerCode = "";
      renderAllFilterGroups();
    });
    bindFilterChange(host, prefix + "-area", (value) => {
      filters.area = value;
      filters.customerCode = "";
      renderAllFilterGroups();
    });
    bindFilterChange(host, prefix + "-customer", (value) => {
      filters.customerCode = value;
    });
  }

  function bindFilterChange(host, id, callback) {
    const node = host.querySelector("#" + id);
    if (!node) {
      return;
    }
    node.addEventListener("change", (event) => callback(event.target.value || ""));
  }

  function buildSelect(id, label, options, value) {
    const list = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
    return `
      <label class="field">
        <span>${escapeHtml(label)}</span>
        <select id="${escapeHtml(id)}">
          <option value="">اختر</option>
          ${list
            .map(
              (option) => `
                <option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>
                  ${escapeHtml(option.label)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>
    `;
  }

  function scopedCustomers(customers, filters) {
    const byRep = customers.filter((entry) => !filters.rep || entry.rep === filters.rep);
    const byCategory = byRep.filter((entry) => !filters.category || entry.category === filters.category);
    const bySector = byCategory.filter((entry) => !filters.sector || entry.sector === filters.sector);
    const final = bySector
      .filter((entry) => !filters.area || entry.area === filters.area)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return { byRep, byCategory, bySector, final };
  }

  function syncTransferField() {
    ui.transferKindWrapper.classList.toggle("hidden", ui.collectionKind.value !== "تحويل");
    ui.chequeFieldsWrapper.classList.toggle("hidden", ui.collectionKind.value !== "شيك");
  }

  async function onSaveVisit(event) {
    event.preventDefault();
    const customer = findCustomer(state.visit.customerCode);
    if (!customer) {
      notify("اختر العميل أولًا قبل حفظ الزيارة.", "error");
      return;
    }

    const button = event.submitter;
    setBusy(button, true, "جارٍ الحفظ...");
    try {
      await apiRequest("/api/visits", {
        method: "POST",
        body: Object.assign({}, customer, locationPayload("visit"))
      });
      state.visit = emptyFilters();
      state.locations.visit = emptyLocation();
      await loadHomeSummary();
      renderAllFilterGroups();
      renderLocationSummary("visit");
      renderHomeSummary();
      notify("تم تسجيل الزيارة بنجاح.", "success");
    } catch (error) {
      notify(error.message || "تعذر تسجيل الزيارة.", "error");
    } finally {
      setBusy(button, false, "حفظ الزيارة");
    }
  }

  async function onSaveCollection(event) {
    event.preventDefault();
    const customer = findCustomer(state.collection.customerCode);
    const amount = Number(ui.collectionAmount.value || 0);
    if (!customer) {
      notify("اختر العميل أولًا قبل حفظ التحصيل.", "error");
      return;
    }
    if (amount <= 0) {
      notify("أدخل قيمة تحصيل صحيحة.", "error");
      return;
    }

    if (ui.collectionKind.value === "شيك") {
      if (!ui.chequeNumber.value.trim()) {
        notify("أدخل رقم الشيك.", "error");
        return;
      }
      if (!ui.chequeBankName.value.trim()) {
        notify("أدخل اسم البنك.", "error");
        return;
      }
      if (!ui.chequeDueDate.value) {
        notify("أدخل تاريخ الاستحقاق.", "error");
        return;
      }
    }

    const button = event.submitter;
    setBusy(button, true, "جارٍ الحفظ...");
    try {
      const collectionType = ui.collectionKind.value === "تحويل" ? ui.transferKind.value : ui.collectionKind.value;
      const chequeImage = ui.chequeImage.files && ui.chequeImage.files[0] ? await readFileAsDataUrl(ui.chequeImage.files[0]) : "";
      await apiRequest("/api/collections", {
        method: "POST",
        body: Object.assign(
          {
            customer,
            amount,
            collectionType,
            chequeNumber: ui.collectionKind.value === "شيك" ? ui.chequeNumber.value.trim() : "",
            bankName: ui.collectionKind.value === "شيك" ? ui.chequeBankName.value.trim() : "",
            dueDate: ui.collectionKind.value === "شيك" ? ui.chequeDueDate.value : "",
            chequeImage
          },
          locationPayload("collection")
        )
      });
      state.collection = emptyFilters();
      state.locations.collection = emptyLocation();
      ui.collectionForm.reset();
      await loadHomeSummary();
      renderAllFilterGroups();
      renderLocationSummary("collection");
      renderHomeSummary();
      syncTransferField();
      notify("تم تسجيل التحصيل بنجاح.", "success");
    } catch (error) {
      notify(error.message || "تعذر تسجيل التحصيل.", "error");
    } finally {
      setBusy(button, false, "حفظ التحصيل");
    }
  }

  function renderOrderModelOptions() {
    const models = unique(state.items.filter((entry) => entry.is_active !== false).map((entry) => entry.model));
    ui.orderModel.innerHTML =
      `<option value="">كل الموديلات</option>` +
      models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("");
    renderOrderItemOptions();
  }

  function renderOrderItemOptions() {
    const selectedModel = ui.orderModel.value || "";
    const items = state.items
      .filter((entry) => entry.is_active !== false)
      .filter((entry) => !selectedModel || entry.model === selectedModel)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));

    ui.orderItem.innerHTML =
      `<option value="">اختر الصنف</option>` +
      items
        .map(
          (entry) =>
            `<option value="${escapeHtml(entry.code)}">${escapeHtml(entry.code)} | ${escapeHtml(entry.name)}</option>`
        )
        .join("");
  }

  async function onAddOrderLine() {
    const customer = findCustomer(state.orderFilters.customerCode);
    const item = state.items.find((entry) => entry.code === ui.orderItem.value);
    const qty = Number(ui.orderQty.value || 0);

    if (!customer) {
      notify("اختر العميل أولًا.", "error");
      return;
    }
    if (!item) {
      notify("اختر الصنف أولًا.", "error");
      return;
    }
    if (qty <= 0) {
      notify("الكمية يجب أن تكون أكبر من صفر.", "error");
      return;
    }

    setBusy(ui.addOrderLine, true, "جارٍ الإضافة...");
    try {
      const result = await apiRequest("/api/orders/line", {
        method: "POST",
        body: Object.assign(
          {
            orderCode: state.orderDraft.code || "",
            customer,
            item,
            qty
          },
          locationPayload("order")
        )
      });
      state.orderDraft.id = result.orderId;
      state.orderDraft.code = result.orderCode;
      state.orderDraft.lines = result.lines || [];
      state.lastCompletedOrder = null;
      renderOrderLines();
      ui.orderItem.value = "";
      ui.orderQty.value = "1";
      notify("تمت إضافة البند.", "success");
    } catch (error) {
      notify(error.message || "تعذر إضافة البند.", "error");
    } finally {
      setBusy(ui.addOrderLine, false, "إضافة البند");
    }
  }

  function renderOrderLines() {
    const totalQty = state.orderDraft.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
    ui.orderCodeLabel.textContent = state.orderDraft.code
      ? "كود الطلبية: " + state.orderDraft.code
      : "لا توجد طلبية مفتوحة الآن";
    ui.orderCodeBadge.textContent = state.orderDraft.code || "لم يبدأ بعد";
    ui.orderLinesCount.textContent = String(state.orderDraft.lines.length);
    ui.orderTotalQty.textContent = formatNumber(totalQty);

    const status = state.lastCompletedOrder
      ? state.lastCompletedOrder.status
      : state.orderDraft.id
        ? "draft"
        : "";
    ui.orderStatusBadge.textContent = status ? statusLabel(status) : "جاهزة";
    ui.orderStatusBadge.className = status ? statusClass(status) : "pill pill-draft";

    if (state.lastCompletedOrder) {
      ui.orderCompleteBanner.textContent = `تم حفظ الطلبية ${state.lastCompletedOrder.order_code} وحالتها الآن ${statusLabel(
        state.lastCompletedOrder.status
      )}.`;
      ui.orderCompleteBanner.classList.remove("hidden");
    } else {
      ui.orderCompleteBanner.classList.add("hidden");
    }

    if (!state.orderDraft.lines.length) {
      ui.orderLines.innerHTML = `<tr><td colspan="4" class="empty-state">لا توجد بنود بعد</td></tr>`;
      return;
    }

    ui.orderLines.innerHTML = state.orderDraft.lines
      .map(
        (line) => `
          <tr>
            <td>${escapeHtml(line.item_code)} | ${escapeHtml(line.item_name)}</td>
            <td>${escapeHtml(line.unit)}</td>
            <td>${escapeHtml(formatNumber(line.qty))}</td>
            <td><button class="btn btn-soft line-delete" data-id="${escapeHtml(line.id)}" type="button">حذف</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".line-delete")).forEach((button) => {
      button.addEventListener("click", function () {
        deleteOrderLine(button.dataset.id);
      });
    });
  }

  async function deleteOrderLine(lineId) {
    try {
      const result = await apiRequest("/api/orders/line/" + encodeURIComponent(lineId), { method: "DELETE" });
      state.orderDraft.lines = result.lines || [];
      renderOrderLines();
      notify("تم حذف البند.", "success");
    } catch (error) {
      notify(error.message || "تعذر حذف البند.", "error");
    }
  }

  async function onConfirmOrder() {
    if (!state.orderDraft.id || !state.orderDraft.lines.length) {
      notify("أضف بندًا واحدًا على الأقل قبل تأكيد الطلبية.", "error");
      return;
    }

    setBusy(ui.confirmOrder, true, "جارٍ التأكيد...");
    try {
      const result = await apiRequest("/api/orders/confirm", {
        method: "POST",
        body: {
          orderId: state.orderDraft.id,
          orderCode: state.orderDraft.code
        }
      });
      state.lastCompletedOrder = result.order || { order_code: state.orderDraft.code, status: "confirmed" };
      state.orderDraft = { id: "", code: "", lines: [] };
      state.locations.order = emptyLocation();
      await Promise.all([loadHomeSummary(), state.ordersUnlocked ? onLoadOrdersSilently() : Promise.resolve()]);
      renderHomeSummary();
      renderOrderLines();
      renderLocationSummary("order");
      notify("تم تأكيد الطلبية وحفظها.", "success");
    } catch (error) {
      notify(error.message || "تعذر تأكيد الطلبية.", "error");
    } finally {
      setBusy(ui.confirmOrder, false, "تأكيد الطلبية");
    }
  }

  async function onCancelOrder() {
    if (!state.orderDraft.id) {
      notify("لا توجد طلبية مفتوحة.", "error");
      return;
    }

    setBusy(ui.cancelOrder, true, "جارٍ الإلغاء...");
    try {
      const result = await apiRequest("/api/orders/cancel", {
        method: "POST",
        body: {
          orderId: state.orderDraft.id,
          orderCode: state.orderDraft.code
        }
      });
      state.lastCompletedOrder = result.order || { order_code: state.orderDraft.code, status: "cancelled" };
      state.orderDraft = { id: "", code: "", lines: [] };
      state.locations.order = emptyLocation();
      await Promise.all([loadHomeSummary(), state.ordersUnlocked ? onLoadOrdersSilently() : Promise.resolve()]);
      renderHomeSummary();
      renderOrderLines();
      renderLocationSummary("order");
      notify("تم إلغاء الطلبية.", "success");
    } catch (error) {
      notify(error.message || "تعذر إلغاء الطلبية.", "error");
    } finally {
      setBusy(ui.cancelOrder, false, "إلغاء الطلبية");
    }
  }

  async function onUnlockOrders() {
    setBusy(ui.unlockOrders, true, "جارٍ التحقق...");
    try {
      const result = await apiRequest("/api/screen-access", {
        method: "POST",
        body: { scope: "orders", password: ui.ordersPassword.value }
      });
      state.ordersScreenToken = result.screenToken || "";
      state.ordersUnlocked = true;
      ui.ordersLock.classList.add("hidden");
      ui.ordersPanel.classList.remove("hidden");
      renderOrdersRepSelect();
      notify("تم فتح شاشة عرض الطلبيات.", "success");
    } catch (error) {
      notify(error.message || "كلمة المرور غير صحيحة.", "error");
    } finally {
      setBusy(ui.unlockOrders, false, "فتح الشاشة");
    }
  }

  async function onLoadOrders() {
    setBusy(ui.loadOrders, true, "جارٍ التحميل...");
    try {
      await onLoadOrdersSilently();
      notify(`تم تحميل ${state.ordersList.length} طلبية.`, "success");
    } catch (error) {
      notify(error.message || "تعذر تحميل الطلبيات.", "error");
    } finally {
      setBusy(ui.loadOrders, false, "تحميل الطلبيات");
    }
  }

  async function onLoadOrdersSilently() {
    const params = new URLSearchParams();
    if (ui.ordersFrom.value) params.set("from", ui.ordersFrom.value);
    if (ui.ordersTo.value) params.set("to", ui.ordersTo.value);
    if (state.ordersRepFilter) params.set("rep", state.ordersRepFilter);
    const suffix = params.toString() ? "?" + params.toString() : "";
    const result = await apiRequest("/api/orders" + suffix, {}, { "x-screen-token": state.ordersScreenToken });
    state.ordersList = result.orders || [];
    state.ordersSummary = result.summaryByRep || [];
    renderOrdersSummaryTable();
    renderOrdersTable();
  }

  function renderOrdersRepSelect() {
    const reps = unique(state.customers.map((entry) => entry.rep)).filter(Boolean);
    ui.ordersRepFilter.innerHTML =
      `<option value="">جميع المندوبين</option>` +
      reps.map((rep) => `<option value="${escapeHtml(rep)}">${escapeHtml(rep)}</option>`).join("");
    ui.ordersRepFilter.value = state.ordersRepFilter;
  }

  function renderOrdersSummaryTable() {
    if (!state.ordersSummary.length) {
      ui.ordersSummaryTable.innerHTML = `<tr><td colspan="3" class="empty-state">لا توجد بيانات ملخصة بعد</td></tr>`;
      return;
    }

    ui.ordersSummaryTable.innerHTML = state.ordersSummary
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.rep || "غير محدد")}</td>
            <td>${escapeHtml(String(row.orders_count || 0))}</td>
            <td><button class="btn btn-soft summary-view" data-rep="${escapeHtml(row.rep || "")}" type="button">عرض الطلبات</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".summary-view")).forEach((button) => {
      button.addEventListener("click", function () {
        state.ordersRepFilter = button.dataset.rep;
        ui.ordersRepFilter.value = state.ordersRepFilter;
        renderOrdersTable();
      });
    });
  }

  function renderOrdersTable() {
    const filtered = state.ordersRepFilter
      ? state.ordersList.filter((order) => (order.rep || "") === state.ordersRepFilter)
      : state.ordersList;

    ui.ordersListCaption.textContent = state.ordersRepFilter
      ? `عرض طلبيات المندوب: ${state.ordersRepFilter}`
      : "عرض كل الطلبيات المحمّلة";

    if (!filtered.length) {
      ui.ordersTable.innerHTML = `<tr><td colspan="5" class="empty-state">لا توجد طلبيات مطابقة</td></tr>`;
      return;
    }

    ui.ordersTable.innerHTML = filtered
      .map(
        (order) => `
          <tr>
            <td>${escapeHtml(order.order_code || "")}</td>
            <td>${escapeHtml(order.customer_name || "")}</td>
            <td>${escapeHtml(formatDate(order.created_at))}</td>
            <td><span class="${statusClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span></td>
            <td><button class="btn btn-soft order-details" data-code="${escapeHtml(order.order_code || "")}" type="button">عرض</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".order-details")).forEach((button) => {
      button.addEventListener("click", function () {
        showOrderDetails(button.dataset.code);
      });
    });
  }

  async function showOrderDetails(orderCode) {
    try {
      const result = await apiRequest("/api/orders/" + encodeURIComponent(orderCode), {}, { "x-screen-token": state.ordersScreenToken });
      renderOrderDetailsDialog(result.order, result.lines || []);
      ui.detailsDialog.showModal();
    } catch (error) {
      notify(error.message || "تعذر تحميل تفاصيل الطلبية.", "error");
    }
  }

  function renderOrderDetailsDialog(order, lines) {
    const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
    ui.detailsTitle.textContent = `تفاصيل الطلبية: ${order.order_code || ""}`;
    ui.orderDetailsContent.innerHTML = `
      <div class="detail-hero">
        <section class="detail-banner">
          <p class="eyebrow">Order Snapshot</p>
          <h3>${escapeHtml(order.order_code || "")}</h3>
          <p>${escapeHtml(order.customer_name || "")} • ${escapeHtml(order.rep || "بدون مندوب")}</p>
          <div class="badge-row" style="margin-top:12px">
            <span class="${statusClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
            <span class="pill pill-accent">عدد البنود: ${escapeHtml(String(lines.length))}</span>
            <span class="pill pill-confirmed">إجمالي الكمية: ${escapeHtml(formatNumber(totalQty))}</span>
          </div>
        </section>
        <div class="detail-cards">
          <article class="detail-card">
            <h4>معلومات العميل</h4>
            <p class="muted">${escapeHtml(order.customer_code || "")}</p>
            <strong>${escapeHtml(order.customer_name || "")}</strong>
          </article>
          <article class="detail-card">
            <h4>الوقت والحالة</h4>
            <p class="muted">تاريخ الإنشاء</p>
            <strong>${escapeHtml(formatDate(order.created_at))}</strong>
          </article>
        </div>
      </div>

      <section class="detail-info-grid">
        <article class="detail-info-item">
          <span>المندوب</span>
          <strong>${escapeHtml(order.rep || "--")}</strong>
        </article>
        <article class="detail-info-item">
          <span>التصنيف</span>
          <strong>${escapeHtml(order.category || "--")}</strong>
        </article>
        <article class="detail-info-item">
          <span>القطاع</span>
          <strong>${escapeHtml(order.sector || "--")}</strong>
        </article>
        <article class="detail-info-item">
          <span>المنطقة</span>
          <strong>${escapeHtml(order.area || "--")}</strong>
        </article>
      </section>

      <section class="detail-card">
        <h4>العنوان والموقع</h4>
        <div class="detail-map-box">
          <p><strong>العنوان المسجل:</strong> ${escapeHtml(order.arabic_address || order.address || "لا يوجد عنوان")}</p>
          <p><strong>الإحداثيات:</strong> ${escapeHtml(
            order.lat && order.lng ? `${order.lat}, ${order.lng}` : "غير متوفر"
          )}</p>
          ${
            safeHref(order.map_url)
              ? `<a class="map-link" href="${escapeHtml(safeHref(order.map_url))}" target="_blank" rel="noreferrer">عرض على الخريطة</a>`
              : `<span class="muted">لا يوجد رابط خريطة</span>`
          }
        </div>
      </section>

      <section class="detail-card">
        <h4>الأصناف المطلوبة</h4>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>كود الصنف</th>
                <th>اسم الصنف</th>
                <th>الموديل</th>
                <th>الوحدة</th>
                <th>الكمية</th>
              </tr>
            </thead>
            <tbody>
              ${
                lines.length
                  ? lines
                      .map(
                        (line) => `
                          <tr>
                            <td>${escapeHtml(line.item_code || "")}</td>
                            <td>${escapeHtml(line.item_name || "")}</td>
                            <td>${escapeHtml(line.model || "--")}</td>
                            <td>${escapeHtml(line.unit || "--")}</td>
                            <td>${escapeHtml(formatNumber(line.qty))}</td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="5" class="empty-state">لا توجد بنود</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderCustomersTable() {
    const needle = state.customerSearch.toLowerCase();
    const rows = state.customers.filter((row) => {
      if (!needle) return true;
      return [row.code, row.name, row.rep, row.area].some((value) => String(value || "").toLowerCase().includes(needle));
    });

    if (!rows.length) {
      ui.customersTable.innerHTML = `<tr><td colspan="6" class="empty-state">لا توجد نتائج</td></tr>`;
      return;
    }

    ui.customersTable.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.code || "")}</td>
            <td>${escapeHtml(row.name || "")}</td>
            <td>${escapeHtml(row.rep || "--")}</td>
            <td>${escapeHtml(row.area || "--")}</td>
            <td><span class="${row.is_active === false ? "pill pill-cancelled" : "pill pill-confirmed"}">${escapeHtml(
              row.is_active === false ? "غير نشط" : "نشط"
            )}</span></td>
            <td><button class="btn btn-soft customer-edit" data-code="${escapeHtml(row.code || "")}" type="button">تعديل</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".customer-edit")).forEach((button) => {
      button.addEventListener("click", function () {
        fillCustomerEditor(button.dataset.code);
      });
    });
  }

  function fillCustomerEditor(code) {
    const customer = findCustomer(code);
    if (!customer) {
      return;
    }

    state.customerEditorCode = customer.code;
    ui.customerFormTitle.textContent = `تعديل العميل: ${customer.code}`;
    ui.customerCode.value = customer.code || "";
    ui.customerCode.disabled = true;
    ui.customerName.value = customer.name || "";
    ui.customerRep.value = customer.rep || "";
    ui.customerCategory.value = customer.category || "";
    ui.customerSector.value = customer.sector || "";
    ui.customerArea.value = customer.area || "";
    ui.customerAddress.value = customer.address || "";
    ui.customerPhone.value = customer.phone || "";
    ui.customerEmail.value = customer.email || "";
    ui.customerActive.value = customer.is_active === false ? "false" : "true";
    ui.customerSubmit.textContent = "حفظ التعديل";
    setPage("customers");
  }

  function resetCustomerEditor() {
    state.customerEditorCode = "";
    ui.customerForm.reset();
    ui.customerFormTitle.textContent = "عميل جديد";
    ui.customerCode.disabled = false;
    ui.customerActive.value = "true";
    ui.customerSubmit.textContent = "حفظ العميل";
  }

  async function onSubmitCustomer(event) {
    event.preventDefault();
    const payload = {
      code: ui.customerCode.value.trim(),
      name: ui.customerName.value.trim(),
      rep: ui.customerRep.value.trim(),
      category: ui.customerCategory.value.trim(),
      sector: ui.customerSector.value.trim(),
      area: ui.customerArea.value.trim(),
      address: ui.customerAddress.value.trim(),
      phone: ui.customerPhone.value.trim(),
      email: ui.customerEmail.value.trim(),
      isActive: ui.customerActive.value === "true"
    };

    if (!payload.code || !payload.name) {
      notify("كود العميل واسم العميل مطلوبان.", "error");
      return;
    }

    setBusy(ui.customerSubmit, true, "جارٍ الحفظ...");
    try {
      if (state.customerEditorCode) {
        await apiRequest("/api/customers/" + encodeURIComponent(state.customerEditorCode), {
          method: "PUT",
          body: payload
        });
        notify("تم تحديث بيانات العميل.", "success");
      } else {
        await apiRequest("/api/customers", { method: "POST", body: payload });
        notify("تمت إضافة العميل.", "success");
      }
      resetCustomerEditor();
      await refreshLookupsAndLists();
    } catch (error) {
      notify(error.message || "تعذر حفظ العميل.", "error");
    } finally {
      setBusy(ui.customerSubmit, false, state.customerEditorCode ? "حفظ التعديل" : "حفظ العميل");
    }
  }

  function renderItemsTable() {
    const needle = state.itemSearch.toLowerCase();
    const rows = state.items.filter((row) => {
      if (!needle) return true;
      return [row.code, row.name, row.model].some((value) => String(value || "").toLowerCase().includes(needle));
    });

    if (!rows.length) {
      ui.itemsTable.innerHTML = `<tr><td colspan="6" class="empty-state">لا توجد نتائج</td></tr>`;
      return;
    }

    ui.itemsTable.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.code || "")}</td>
            <td>${escapeHtml(row.name || "")}</td>
            <td>${escapeHtml(row.model || "--")}</td>
            <td>${escapeHtml(formatCurrency(row.price || 0))}</td>
            <td><span class="${row.is_active === false ? "pill pill-cancelled" : "pill pill-confirmed"}">${escapeHtml(
              row.is_active === false ? "غير نشط" : "نشط"
            )}</span></td>
            <td><button class="btn btn-soft item-edit" data-code="${escapeHtml(row.code || "")}" type="button">تعديل</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".item-edit")).forEach((button) => {
      button.addEventListener("click", function () {
        fillItemEditor(button.dataset.code);
      });
    });
  }

  function fillItemEditor(code) {
    const item = state.items.find((entry) => entry.code === code);
    if (!item) return;

    state.itemEditorCode = item.code;
    ui.itemFormTitle.textContent = `تعديل المنتج: ${item.code}`;
    ui.itemCode.value = item.code || "";
    ui.itemCode.disabled = true;
    ui.itemName.value = item.name || "";
    ui.itemModel.value = item.model || "";
    ui.itemUnit.value = item.unit || "";
    ui.itemPrice.value = item.price || 0;
    ui.itemDescription.value = item.description || "";
    ui.itemActive.value = item.is_active === false ? "false" : "true";
    ui.itemSubmit.textContent = "حفظ التعديل";
    setPage("items");
  }

  function resetItemEditor() {
    state.itemEditorCode = "";
    ui.itemForm.reset();
    ui.itemFormTitle.textContent = "منتج جديد";
    ui.itemCode.disabled = false;
    ui.itemActive.value = "true";
    ui.itemSubmit.textContent = "حفظ المنتج";
  }

  async function onSubmitItem(event) {
    event.preventDefault();
    const payload = {
      code: ui.itemCode.value.trim(),
      name: ui.itemName.value.trim(),
      model: ui.itemModel.value.trim(),
      unit: ui.itemUnit.value.trim(),
      description: ui.itemDescription.value.trim(),
      price: Number(ui.itemPrice.value || 0),
      isActive: ui.itemActive.value === "true"
    };

    if (!payload.code || !payload.name) {
      notify("كود المنتج واسم المنتج مطلوبان.", "error");
      return;
    }

    setBusy(ui.itemSubmit, true, "جارٍ الحفظ...");
    try {
      if (state.itemEditorCode) {
        await apiRequest("/api/items/" + encodeURIComponent(state.itemEditorCode), {
          method: "PUT",
          body: payload
        });
        notify("تم تحديث المنتج.", "success");
      } else {
        await apiRequest("/api/items", { method: "POST", body: payload });
        notify("تمت إضافة المنتج.", "success");
      }
      resetItemEditor();
      await refreshLookupsAndLists();
    } catch (error) {
      notify(error.message || "تعذر حفظ المنتج.", "error");
    } finally {
      setBusy(ui.itemSubmit, false, state.itemEditorCode ? "حفظ التعديل" : "حفظ المنتج");
    }
  }

  async function onUnlockDashboard() {
    setBusy(ui.unlockDashboard, true, "جارٍ التحقق...");
    try {
      await apiRequest("/api/screen-access", {
        method: "POST",
        body: { scope: "dashboard", password: ui.dashboardPassword.value }
      });
      state.dashboardUnlocked = true;
      ui.dashboardLock.classList.add("hidden");
      ui.dashboardPanel.classList.remove("hidden");
      notify("تم فتح لوحة التحليلات.", "success");
    } catch (error) {
      notify(error.message || "كلمة المرور غير صحيحة.", "error");
    } finally {
      setBusy(ui.unlockDashboard, false, "فتح اللوحة");
    }
  }

  async function onLoadDashboard() {
    setBusy(ui.loadDashboard, true, "جارٍ التحميل...");
    try {
      state.dashboardPayload = await apiRequest("/api/dashboard", {
        method: "POST",
        body: {
          from: ui.dashboardFrom.value || null,
          to: ui.dashboardTo.value || null,
          rep: ui.dashboardRep.value.trim() || null,
          payKind: ui.dashboardPayKind.value.trim() || null
        }
      });
      renderDashboard(state.dashboardPayload);
      notify("تم تحميل لوحة التحليلات.", "success");
    } catch (error) {
      notify(error.message || "تعذر تحميل لوحة التحليلات.", "error");
    } finally {
      setBusy(ui.loadDashboard, false, "تحميل البيانات");
    }
  }

  async function onLoadProductionDashboard() {
    setBusy(ui.loadProductionDashboard, true, "جارٍ تحميل الإنتاج...");
    try {
      const body = {
        from: ui.productionFrom.value || null,
        to: ui.productionTo.value || null,
        source: ui.productionSource.value || null
      };
      state.productionFilters = body;
      state.productionPayload = await apiRequest("/api/production-dashboard", {
        method: "POST",
        body
      });
      renderProductionDashboard(state.productionPayload);
      notify("تم تحميل لوحة الإنتاج.", "success");
    } catch (error) {
      notify(error.message || "تعذر تحميل بيانات الإنتاج.", "error");
    } finally {
      setBusy(ui.loadProductionDashboard, false, "تحميل الإنتاج");
    }
  }

  async function onLoadFieldAnalytics() {
    setBusy(ui.loadFieldAnalytics, true, "جارٍ التحميل...");
    try {
      const body = {
        from: ui.fieldFrom.value || null,
        to: ui.fieldTo.value || null,
        rep: ui.fieldRep.value.trim() || null,
        payKind: ui.fieldPayKind.value.trim() || null
      };
      state.fieldFilters = body;
      const [analytics, movements] = await Promise.all([
        apiRequest("/api/dashboard", {
          method: "POST",
          body
        }),
        apiRequest("/api/field-movements", {
          method: "POST",
          body: Object.assign({ page: 1, pageSize: 10 }, body)
        })
      ]);
      state.fieldAnalyticsPayload = analytics;
      state.fieldMovementsPayload = movements;
      state.fieldMovementsPage = 1;
      renderFieldAnalytics(state.fieldAnalyticsPayload, state.fieldMovementsPayload);
      notify("تم تحميل تحليل الزيارات والتحصيلات.", "success");
    } catch (error) {
      notify(error.message || "تعذر تحميل التحليل.", "error");
    } finally {
      setBusy(ui.loadFieldAnalytics, false, "تحميل التحليل");
    }
  }

  function setDashboardChartView(view, skipRender) {
    state.dashboardChartView = view || "trend";
    ui.dashboardChartButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.dashboardChart === state.dashboardChartView);
    });
    Object.keys(ui.dashboardChartCards).forEach((key) => {
      const card = ui.dashboardChartCards[key];
      if (card) {
        card.classList.toggle("hidden", key !== state.dashboardChartView);
      }
    });
    if (state.dashboardPayload && !skipRender) {
      renderCharts(state.dashboardPayload);
    }
  }

  function renderDashboard(payload) {
    if (!payload) {
      ui.dashboardMetrics.innerHTML = "";
      ui.topCustomersList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.topItemsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.latestActivityList.innerHTML = emptyInline("لا توجد بيانات بعد");
      destroyCharts();
      return;
    }

    ui.dashboardMetrics.innerHTML = [
      metricCard("الزيارات", payload.visitsCount),
      metricCard("التحصيلات", payload.collectionsCount),
      metricCard("إجمالي التحصيل", formatCurrency(payload.collectionsTotal)),
      metricCard("متوسط التحصيل", formatCurrency(payload.averageCollection)),
      metricCard("الطلبيات", payload.ordersCount),
      metricCard("معدل التأكيد", `${formatNumber(payload.orderConfirmationRate)}%`),
      metricCard("Confirmed", payload.confirmedOrders),
      metricCard("Cancelled", payload.cancelledOrders)
    ].join("");

    ui.topCustomersList.innerHTML = renderScoreList(payload.topCustomers, "عملية");
    ui.topItemsList.innerHTML = renderScoreList(payload.topItems, "كمية");
    ui.latestActivityList.innerHTML = renderLatestActivity(payload.latestOrders, payload.latestCollections);

    setDashboardChartView(state.dashboardChartView, true);
    renderCharts(payload);
  }

  function renderProductionDashboard(payload) {
    if (!payload) {
      ui.productionMetrics.innerHTML = "";
      ui.productionItemsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.productionDestinationsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.productionRecordsTable.innerHTML = `<tr><td colspan="10" class="empty-state">لا توجد بيانات بعد</td></tr>`;
      destroyProductionCharts();
      return;
    }

    ui.productionMetrics.innerHTML = [
      metricCard("إجمالي الكمية", formatNumber(payload.totalQuantity || 0)),
      metricCard("إجمالي الدست", formatNumber(payload.totalDozens || 0)),
      metricCard("عدد السجلات", payload.recordsCount || 0),
      metricCard("عدد القصص", payload.storiesCount || 0),
      metricCard("عدد الموديلات", payload.modelsCount || 0),
      metricCard("عدد الخطوط", payload.linesCount || 0)
    ].join("");

    ui.productionItemsList.innerHTML = renderScoreList(payload.topItems, "كمية");
    ui.productionDestinationsList.innerHTML = renderScoreList(payload.topDestinations, "كمية");
    ui.productionRecordsTable.innerHTML = renderProductionRecords(payload.recentRecords || []);
    renderProductionCharts(payload);
  }

  function renderFieldAnalytics(payload, movementsPayload) {
    if (!payload) {
      ui.fieldMetrics.innerHTML = "";
      ui.fieldInsightsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.fieldTypesList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.fieldLatestList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.fieldMovementsTable.innerHTML = `<tr><td colspan="6" class="empty-state">لا توجد بيانات بعد</td></tr>`;
      if (state.charts.fieldCollections) {
        state.charts.fieldCollections.destroy();
        delete state.charts.fieldCollections;
      }
      if (state.charts.fieldRepCollections) {
        state.charts.fieldRepCollections.destroy();
        delete state.charts.fieldRepCollections;
      }
      return;
    }

    ui.fieldMetrics.innerHTML = [
      metricCard("إجمالي الزيارات", payload.visitsCount || 0),
      metricCard("عدد التحصيلات", payload.collectionsCount || 0),
      metricCard("قيمة التحصيل", formatCurrency(payload.collectionsTotal || 0)),
      metricCard("متوسط التحصيل", formatCurrency(payload.averageCollection || 0))
    ].join("");

    ui.fieldInsightsList.innerHTML = [
      insightListItem("عدد الزيارات", payload.visitsCount || 0, "زيارة"),
      insightListItem("عدد التحصيلات", payload.collectionsCount || 0, "عملية"),
      insightListItem("إجمالي التحصيل", formatCurrency(payload.collectionsTotal || 0), "خلال الفترة"),
      insightListItem("المتوسط", formatCurrency(payload.averageCollection || 0), "لكل عملية")
    ].join("");

    ui.fieldTypesList.innerHTML = renderScoreList(payload.collectionsByType, "عملية");
    ui.fieldLatestList.innerHTML = renderLatestCollectionList(payload.latestCollections);
      renderMovementsTable(movementsPayload || null);
    renderFieldCharts(payload);
  }

  function renderProductionRecords(rows) {
    if (!rows || !rows.length) {
      return `<tr><td colspan="10" class="empty-state">لا توجد سجلات مطابقة</td></tr>`;
    }
    return rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td>${escapeHtml(row.source || "--")}</td>
            <td>${escapeHtml(row.lineName || "--")}</td>
            <td>${escapeHtml(row.storyNo || "--")}</td>
            <td>${escapeHtml(row.modelCode || "--")}</td>
            <td>${escapeHtml(row.itemName || "--")}</td>
            <td>${escapeHtml(row.color || "--")}</td>
            <td>${escapeHtml(row.size || "--")}</td>
            <td>${escapeHtml(formatNumber(row.quantity || 0))}</td>
            <td>${escapeHtml(row.destination || "--")}</td>
          </tr>
        `
      )
      .join("");
  }

  function metricCard(label, value) {
    return `
      <article class="metric-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderScoreList(rows, suffix) {
    if (!rows || !rows.length) {
      return emptyInline("لا توجد بيانات");
    }

    return rows
      .map(
        (row) => `
          <article class="list-item">
            <div>
              <strong>${escapeHtml(row.label || row.rep || "--")}</strong>
              <small>${escapeHtml(suffix)}</small>
            </div>
            <span class="pill pill-accent">${escapeHtml(formatNumber(row.total || 0))}</span>
          </article>
        `
      )
      .join("");
  }

  function renderLatestActivity(orders, collections) {
    const orderRows = (orders || []).map((row) => ({
      title: row.order_code,
      subtitle: `${row.customer_name || ""} • ${row.rep || ""}`,
      metric: statusLabel(row.status),
      tone: statusClass(row.status),
      date: row.created_at
    }));
    const collectionRows = (collections || []).map((row) => ({
      title: row.customer_name,
      subtitle: `${row.collection_type || ""} • ${row.rep || ""}`,
      metric: formatCurrency(row.amount || 0),
      tone: "pill pill-confirmed",
      date: row.created_at
    }));

    const merged = orderRows.concat(collectionRows).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
    if (!merged.length) {
      return emptyInline("لا توجد أنشطة");
    }

    return merged
      .map(
        (entry) => `
          <article class="list-item">
            <div>
              <strong>${escapeHtml(entry.title || "--")}</strong>
              <small>${escapeHtml(entry.subtitle || "")} • ${escapeHtml(formatDate(entry.date))}</small>
            </div>
            <span class="${entry.tone}">${escapeHtml(entry.metric || "--")}</span>
          </article>
        `
      )
      .join("");
  }

  function renderLatestCollectionList(collections) {
    if (!collections || !collections.length) {
      return emptyInline("لا توجد تحصيلات");
    }
    return collections
      .slice(0, 6)
      .map(
        (row) => `
          <article class="list-item">
            <div>
              <strong>${escapeHtml(row.customer_name || "--")}</strong>
              <small>${escapeHtml(row.collection_type || "")} • ${escapeHtml(row.rep || "")} • ${escapeHtml(
                formatDate(row.created_at)
              )}</small>
            </div>
            <span class="pill pill-confirmed">${escapeHtml(formatCurrency(row.amount || 0))}</span>
          </article>
        `
      )
      .join("");
  }

  function insightListItem(label, value, hint) {
    return `
      <article class="list-item">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <small>${escapeHtml(hint)}</small>
        </div>
        <span class="pill pill-accent">${escapeHtml(String(value))}</span>
      </article>
    `;
  }

  function renderCharts(payload) {
    destroyCharts();
    if (!window.Chart) {
      notify("لم يتم تحميل مكتبة الرسوم البيانية، لكن البيانات متاحة.", "info");
      return;
    }

    const activeView = state.dashboardChartView || "trend";
    const timeline = uniqueTimeline(payload.dailyOrders, payload.dailyCollections);

    if (activeView === "trend") {
      state.charts.trend = new window.Chart(ui.trendChart, {
        type: "line",
        data: {
          labels: timeline,
          datasets: [
            {
              label: "الطلبيات",
              data: mapSeries(timeline, payload.dailyOrders),
              borderColor: "#0d4f8b",
              backgroundColor: "rgba(13, 79, 139, 0.16)",
              tension: 0.35,
              fill: true
            },
            {
              label: "التحصيلات",
              data: mapSeries(timeline, payload.dailyCollections),
              borderColor: "#1b8c7a",
              backgroundColor: "rgba(27, 140, 122, 0.14)",
              tension: 0.35,
              fill: true
            }
          ]
        },
        options: chartOptions()
      });
      return;
    }

    if (activeView === "status") {
      state.charts.status = new window.Chart(ui.statusChart, {
        type: "doughnut",
        data: {
          labels: (payload.statusBreakdown || []).map((row) => row.label),
          datasets: [
            {
              data: (payload.statusBreakdown || []).map((row) => row.total),
              backgroundColor: ["#1f7a4d", "#a64c28", "#a33141"]
            }
          ]
        },
        options: chartOptions({ cutout: "68%" })
      });
      return;
    }

    if (activeView === "rep") {
      state.charts.rep = new window.Chart(ui.repOrdersChart, {
        type: "bar",
        data: {
          labels: (payload.ordersByRep || []).map((row) => row.rep || "غير محدد"),
          datasets: [
            {
              label: "عدد الطلبيات",
              data: (payload.ordersByRep || []).map((row) => row.total),
              backgroundColor: "#a64c28",
              borderRadius: 12
            }
          ]
        },
        options: chartOptions({ indexAxis: "y" })
      });
      return;
    }

    state.charts.collectionType = new window.Chart(ui.collectionTypeChart, {
      type: "pie",
      data: {
        labels: (payload.collectionsByType || []).map((row) => row.label || "غير محدد"),
        datasets: [
          {
            data: (payload.collectionsByType || []).map((row) => row.total),
            backgroundColor: ["#0d4f8b", "#1b8c7a", "#d18a1d", "#a64c28"]
          }
        ]
      },
      options: chartOptions()
    });
  }

  function renderFieldCharts(payload) {
    if (state.charts.fieldCollections) state.charts.fieldCollections.destroy();
    if (state.charts.fieldRepCollections) state.charts.fieldRepCollections.destroy();
    if (!window.Chart) {
      return;
    }

    state.charts.fieldCollections = new window.Chart(ui.fieldCollectionsChart, {
      type: "bar",
      data: {
        labels: (payload.dailyCollections || []).map((row) => row.day),
        datasets: [
          {
            label: "قيمة التحصيل",
            data: (payload.dailyCollections || []).map((row) => row.total),
            backgroundColor: "#1b8c7a",
            borderRadius: 10
          }
        ]
      },
      options: chartOptions()
    });

    state.charts.fieldRepCollections = new window.Chart(ui.fieldRepCollectionsChart, {
      type: "bar",
      data: {
        labels: (payload.collectionsByRep || []).map((row) => row.rep || "غير محدد"),
        datasets: [
          {
            label: "إجمالي التحصيل",
            data: (payload.collectionsByRep || []).map((row) => row.total),
            backgroundColor: "#a64c28",
            borderRadius: 10
          }
        ]
      },
      options: chartOptions()
    });
  }

  function renderProductionCharts(payload) {
    destroyProductionCharts();
    if (!window.Chart) {
      return;
    }

    state.charts.productionDaily = new window.Chart(ui.productionDailyChart, {
      type: "line",
      data: {
        labels: (payload.dailyQuantity || []).map((row) => row.label),
        datasets: [
          {
            label: "الكمية",
            data: (payload.dailyQuantity || []).map((row) => row.total),
            borderColor: "#0d4f8b",
            backgroundColor: "rgba(13, 79, 139, 0.14)",
            tension: 0.32,
            fill: true
          }
        ]
      },
      options: chartOptions()
    });

    state.charts.productionSource = new window.Chart(ui.productionSourceChart, {
      type: "doughnut",
      data: {
        labels: (payload.bySource || []).map((row) => row.label),
        datasets: [
          {
            data: (payload.bySource || []).map((row) => row.total),
            backgroundColor: ["#0d4f8b", "#1b8c7a", "#a64c28", "#d18a1d"]
          }
        ]
      },
      options: chartOptions({ cutout: "62%" })
    });

    state.charts.productionLines = new window.Chart(ui.productionLinesChart, {
      type: "bar",
      data: {
        labels: (payload.topLines || []).map((row) => row.label),
        datasets: [
          {
            label: "الكمية",
            data: (payload.topLines || []).map((row) => row.total),
            backgroundColor: "#a64c28",
            borderRadius: 10
          }
        ]
      },
      options: chartOptions({ indexAxis: "y" })
    });
  }

  function renderMovementsTable(payload) {
    const rows = (payload && payload.movementRows) || [];
    const currentPage = (payload && payload.currentPage) || 1;
    const totalPages = (payload && payload.totalPages) || 0;

    if (!rows.length) {
      ui.fieldMovementsTable.innerHTML = `<tr><td colspan="10" class="empty-state">لا توجد تحركات مطابقة</td></tr>`;
      ui.fieldPageIndicator.textContent = "صفحة 0 من 0";
      ui.fieldPrevPage.disabled = true;
      ui.fieldNextPage.disabled = true;
      return;
    }

    ui.fieldMovementsTable.innerHTML = rows
      .map((row) => {
        const day = formatDay(row.created_at);
        const time = formatTime(row.created_at);
        const movementLabel =
          row.movement_type === "collection"
            ? "تحصيل"
            : row.movement_type === "order"
              ? "طلبية"
              : "زيارة";
        const movementTone =
          row.movement_type === "collection"
            ? "pill pill-confirmed movement-type"
            : row.movement_type === "order"
              ? "pill pill-accent movement-type"
              : "pill pill-draft movement-type";
        return `
          <tr>
            <td>${escapeHtml(row.rep || "--")}</td>
            <td>${escapeHtml(day)}</td>
            <td>${escapeHtml(time)}</td>
            <td>${escapeHtml(row.customer_name || "--")}</td>
            <td><span class="${movementTone}">${escapeHtml(movementLabel)}</span></td>
            <td>${escapeHtml(formatCurrency(row.amount || 0))}</td>
            <td>${escapeHtml(row.cheque_number || "--")}</td>
            <td>${escapeHtml(row.bank_name || "--")}</td>
            <td>${escapeHtml(row.due_date || "--")}</td>
            <td>${renderChequeImageCell(row)}</td>
          </tr>
        `;
      })
      .join("");

    Array.from(document.querySelectorAll(".cheque-thumb-link")).forEach((button) => {
      button.addEventListener("click", async function () {
        await openChequeImage(button.dataset.id || "");
      });
    });

    ui.fieldPageIndicator.textContent = `صفحة ${currentPage} من ${totalPages}`;
    ui.fieldPrevPage.disabled = currentPage <= 1;
    ui.fieldNextPage.disabled = currentPage >= totalPages;
  }

  async function changeFieldMovementsPage(step) {
    const currentPayload = state.fieldMovementsPayload;
    if (!currentPayload || !(currentPayload.totalPages > 1)) {
      return;
    }

    const nextPage = (currentPayload.currentPage || 1) + step;
    if (nextPage < 1 || nextPage > (currentPayload.totalPages || 1)) {
      return;
    }

    try {
      ui.fieldPrevPage.disabled = true;
      ui.fieldNextPage.disabled = true;
      const nextPayload = await apiRequest("/api/field-movements", {
        method: "POST",
        body: Object.assign({ page: nextPage, pageSize: currentPayload.pageSize || 10 }, state.fieldFilters || {})
      });
      state.fieldMovementsPayload = nextPayload;
      state.fieldMovementsPage = nextPayload.currentPage || nextPage;
      renderMovementsTable(nextPayload);
    } catch (error) {
      notify(error.message || "تعذر تحميل باقي البيانات.", "error");
      renderMovementsTable(currentPayload);
    }
  }

  async function exportFieldMovementsExcel() {
    const currentPayload = state.fieldMovementsPayload;
    if (!currentPayload || !(currentPayload.totalCount > 0)) {
      notify("لا توجد بيانات لتصديرها.", "error");
      return;
    }

    let rows = currentPayload.movementRows || [];
    try {
      const exportPayload = await apiRequest("/api/field-movements", {
        method: "POST",
        body: Object.assign({ exportAll: true, pageSize: 50000 }, state.fieldFilters || {})
      });
      rows = exportPayload.movementRows || [];
    } catch (error) {
      notify("تم الاعتماد على الصفحة الحالية فقط في التصدير.", "info");
    }

    if (!rows.length) {
      notify("لا توجد بيانات لتصديرها.", "error");
      return;
    }
    const exportRows = rows.map((row) => ({
      "المندوب": row.rep || "",
      "اليوم": formatDay(row.created_at),
      "الوقت": formatTime(row.created_at),
      "اسم العميل": row.customer_name || "",
      "النوع":
        row.movement_type === "collection"
          ? "تحصيل"
          : row.movement_type === "order"
            ? "طلبية"
            : "زيارة",
      "قيمة التحصيل": Number(row.amount || 0),
      "رقم الشيك": row.cheque_number || "",
      "اسم البنك": row.bank_name || "",
      "تاريخ الاستحقاق": row.due_date || "",
      "العنوان": row.arabic_address || "",
      "صورة الشيك": row.has_cheque_image ? "مرفقة داخل النظام" : "لا توجد صورة"
    }));

    const stamp = new Date().toISOString().slice(0, 10);

    try {
      if (window.XLSX) {
        const worksheet = window.XLSX.utils.json_to_sheet(exportRows);
        const workbook = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(workbook, worksheet, "Movements");
        window.XLSX.writeFile(workbook, `field-movements-${stamp}.xlsx`);
        notify("تم تصدير ملف Excel بنجاح.", "success");
        return;
      }

      downloadCsvFallback(exportRows, `field-movements-${stamp}.csv`);
      notify("تم تصدير الملف بصيغة CSV لأن مكتبة Excel غير متاحة.", "success");
    } catch (error) {
      notify(error.message || "تعذر تصدير الملف.", "error");
    }
  }

  function renderChequeImageCell(movement) {
    if (!movement.has_cheque_image || movement.movement_type !== "collection") {
      return `<span class="muted">--</span>`;
    }
    return `
      <button class="cheque-thumb-link" data-id="${escapeHtml(movement.movement_id || "")}" type="button">
        <span class="cheque-thumb-placeholder">عرض</span>
      </button>
    `;
  }

  async function openChequeImage(collectionId) {
    if (!collectionId) {
      return;
    }
    const result = await apiRequest("/api/collections/" + encodeURIComponent(collectionId) + "/cheque-image");
    if (!result.chequeImage) {
      notify("لا توجد صورة شيك محفوظة لهذا التحصيل.", "error");
      return;
    }
    ui.chequePreviewImage.src = result.chequeImage;
    ui.chequeImageDialog.showModal();
  }

  function chartOptions(extra) {
    return Object.assign(
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              font: { family: "Tajawal", size: 13 }
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { family: "Tajawal" } },
            grid: { color: "rgba(113, 79, 45, 0.06)" }
          },
          y: {
            ticks: { font: { family: "Tajawal" } },
            grid: { color: "rgba(113, 79, 45, 0.06)" }
          }
        }
      },
      extra || {}
    );
  }

  function destroyCharts() {
    ["trend", "status", "rep", "collectionType"].forEach((key) => {
      if (state.charts[key] && typeof state.charts[key].destroy === "function") {
        state.charts[key].destroy();
      }
      delete state.charts[key];
    });
  }

  function destroyProductionCharts() {
    ["productionDaily", "productionSource", "productionLines"].forEach((key) => {
      if (state.charts[key] && typeof state.charts[key].destroy === "function") {
        state.charts[key].destroy();
      }
      delete state.charts[key];
    });
  }

  async function captureLocation(scope, button) {
    if (!navigator.geolocation) {
      notify("المتصفح لا يدعم تحديد الموقع.", "error");
      return;
    }

    setBusy(button, true, "جارٍ الالتقاط...");
    try {
      const coords = await getCurrentPosition();
      const address = await reverseGeocodeArabic(coords.latitude, coords.longitude);
      state.locations[scope] = {
        lat: coords.latitude,
        lng: coords.longitude,
        arabicAddress: address.displayName,
        mapUrl: `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`,
        status: "جاهز"
      };

      if (scope === "order" && state.orderDraft.id) {
        await apiRequest("/api/orders/location", {
          method: "POST",
          body: Object.assign(
            {
              orderId: state.orderDraft.id,
              orderCode: state.orderDraft.code
            },
            locationPayload("order")
          )
        });
      }

      renderLocationSummary(scope);
      notify("تم التقاط الموقع والعنوان بالعربية.", "success");
    } catch (error) {
      notify(error.message || "تعذر التقاط الموقع.", "error");
    } finally {
      setBusy(button, false, "التقاط الموقع");
    }
  }

  function renderLocationSummary(scope) {
    const hostMap = {
      visit: ui.visitLocationSummary,
      collection: ui.collectionLocationSummary,
      order: ui.orderLocationSummary
    };
    const host = hostMap[scope];
    if (!host) return;
    const loc = state.locations[scope];
    if (!loc.lat || !loc.lng) {
      host.innerHTML = `<div class="empty-inline">لم يتم التقاط الموقع بعد</div>`;
      return;
    }

    host.innerHTML = `
      <div class="location-line"><strong>الإحداثيات:</strong> <span>${escapeHtml(
        `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`
      )}</span></div>
      <div class="location-line"><strong>العنوان:</strong> <span>${escapeHtml(loc.arabicAddress || "غير متوفر")}</span></div>
      ${safeHref(loc.mapUrl) ? `<div class="location-line"><a class="map-link" href="${escapeHtml(safeHref(loc.mapUrl))}" target="_blank" rel="noreferrer">فتح على الخريطة</a></div>` : ""}
    `;
  }

  function locationPayload(scope) {
    const loc = state.locations[scope] || {};
    return {
      lat: loc.lat || null,
      lng: loc.lng || null,
      arabicAddress: loc.arabicAddress || "",
      mapUrl: loc.mapUrl || ""
    };
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(new Error(geoErrorMessage(error))),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  }

  async function reverseGeocodeArabic(lat, lng) {
    const url =
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ar&lat=" +
      encodeURIComponent(lat) +
      "&lon=" +
      encodeURIComponent(lng);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) {
      throw new Error("تم تحديد الإحداثيات لكن تعذر جلب العنوان العربي.");
    }
    const data = await response.json();
    return {
      displayName: data.display_name || `${lat}, ${lng}`
    };
  }

  function geoErrorMessage(error) {
    if (!error) return "تعذر تحديد الموقع.";
    if (error.code === 1) return "تم رفض صلاحية الموقع من المتصفح.";
    if (error.code === 2) return "تعذر الوصول إلى GPS أو الشبكة.";
    if (error.code === 3) return "انتهت مهلة تحديد الموقع.";
    return error.message || "تعذر تحديد الموقع.";
  }

  async function apiRequest(path, options, extraHeaders) {
    const opts = options || {};
    const response = await fetch(apiBaseUrl + path, {
      method: opts.method || "GET",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        state.token ? { Authorization: "Bearer " + state.token } : {},
        extraHeaders || {}
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });

    const text = await response.text();
    const data = safeJson(text);
    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        reflectSession();
        throw new Error("انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجددًا.");
      }
      throw new Error((data && data.message) || "حدث خطأ في الطلب.");
    }
    return data;
  }

  function notify(message, tone) {
    ui.globalAlert.textContent = message;
    ui.globalAlert.classList.remove("hidden");
    if (tone === "error") {
      ui.globalAlert.style.background = "rgba(255, 233, 236, 0.95)";
      ui.globalAlert.style.border = "1px solid rgba(163, 49, 65, 0.2)";
      return;
    }
    if (tone === "success") {
      ui.globalAlert.style.background = "rgba(232, 248, 238, 0.95)";
      ui.globalAlert.style.border = "1px solid rgba(31, 122, 77, 0.18)";
      return;
    }
    ui.globalAlert.style.background = "rgba(255, 248, 233, 0.95)";
    ui.globalAlert.style.border = "1px solid rgba(166, 76, 40, 0.16)";
  }

  function normalizeCustomer(entry) {
    return {
      code: entry.code || "",
      name: entry.name || "",
      rep: entry.rep || "",
      category: entry.category || "",
      sector: entry.sector || "",
      area: entry.area || "",
      address: entry.address || "",
      phone: entry.phone || "",
      email: entry.email || "",
      is_active: entry.is_active !== false
    };
  }

  function normalizeItem(entry) {
    return {
      code: entry.code || "",
      name: entry.name || "",
      model: entry.model || "",
      unit: entry.unit || "",
      description: entry.description || "",
      price: Number(entry.price || 0),
      is_active: entry.is_active !== false
    };
  }

  function findCustomer(code) {
    return state.customers.find((entry) => entry.code === code) || null;
  }

  function emptyFilters() {
    return { rep: "", category: "", sector: "", area: "", customerCode: "" };
  }

  function emptyLocation() {
    return { lat: null, lng: null, arabicAddress: "", mapUrl: "", status: "" };
  }

  function unique(values) {
    return Array.from(
      new Set(
        values
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "ar"));
  }

  function uniqueTimeline() {
    const days = new Set();
    Array.from(arguments)
      .flat()
      .forEach((row) => {
        if (row && row.day) {
          days.add(row.day);
        }
      });
    return Array.from(days).sort();
  }

  function mapSeries(labels, rows) {
    const map = new Map((rows || []).map((row) => [row.day, Number(row.total || 0)]));
    return labels.map((label) => map.get(label) || 0);
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent;
    }
    button.disabled = busy;
    button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
  }

  function statusLabel(status) {
    if (status === "confirmed") return "مؤكدة";
    if (status === "cancelled") return "ملغية";
    if (status === "draft") return "مسودة";
    return status || "--";
  }

  function statusClass(status) {
    if (status === "confirmed") return "pill pill-confirmed";
    if (status === "cancelled") return "pill pill-cancelled";
    return "pill pill-draft";
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDay(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  }

  function formatTime(value) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function safeJson(text) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return { message: text };
    }
  }

  async function readFileAsDataUrl(file) {
    if (file.type.startsWith("image/")) {
      try {
        return await compressImageFile(file, 1280, 0.72);
      } catch (_error) {
      }
    }
    return readFileDirect(file);
  }

  function readFileDirect(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("تعذر قراءة صورة الشيك."));
      };
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file, maxSide, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function () {
        const image = new Image();
        image.onload = function () {
          const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * ratio));
          const height = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("تعذر تجهيز الصورة."));
            return;
          }
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.onerror = function () {
          reject(new Error("تعذر معالجة الصورة."));
        };
        image.src = String(reader.result || "");
      };
      reader.onerror = function () {
        reject(new Error("تعذر قراءة صورة الشيك."));
      };
      reader.readAsDataURL(file);
    });
  }

  function emptyInline(message) {
    return `<div class="empty-inline">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safeHref(url) {
    const s = String(url || "").trim();
    return s.startsWith("https://") || s.startsWith("http://") ? s : null;
  }
})();
