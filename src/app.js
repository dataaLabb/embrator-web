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
    users: [],
    lookupsReady: false,
    usersLoaded: false,
    visit: emptyFilters(),
    collection: emptyFilters(),
    orderFilters: emptyFilters(),
    orderDraft: { id: "", code: "", lines: [], status: "", notes: "" },
    ordersUnlocked: false,
    ordersScreenToken: "",
    dashboardUnlocked: false,
    ordersList: [],
    ordersSummary: [],
    ordersRepFilter: "",
    dashboardPayload: null,
    dashboardChartView: "trend",
    productionPayload: null,
    productionSourceTab: "",
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
    customersPage: 1,
    itemEditorCode: "",
    itemSearch: "",
    itemsPage: 1,
    itemVariantRows: [],
    userEditorId: "",
    userSearch: "",
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
    ui.adminOnlyNodes = Array.from(document.querySelectorAll("[data-admin-only]"));

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
    ui.orderColor = document.getElementById("order-color");
    ui.orderSize = document.getElementById("order-size");
    ui.orderUnit = document.getElementById("order-unit");
    ui.orderQty = document.getElementById("order-qty");
    ui.orderNotes = document.getElementById("order-notes");
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
    ui.exportOrders = document.getElementById("export-orders");
    ui.showAllOrders = document.getElementById("show-all-orders");
    ui.ordersSummaryTable = document.getElementById("orders-summary-table");
    ui.ordersTable = document.getElementById("orders-table");
    ui.ordersListCaption = document.getElementById("orders-list-caption");

    ui.customerForm = document.getElementById("customer-form");
    ui.customerFormTitle = document.getElementById("customer-form-title");
    ui.customerFormReset = document.getElementById("customer-form-reset");
    ui.customerBranchCode = document.getElementById("customer-branch-code");
    ui.customerCode = document.getElementById("customer-code");
    ui.customerName = document.getElementById("customer-name");
    ui.customerRep = document.getElementById("customer-rep");
    ui.customerRepCode = document.getElementById("customer-rep-code");
    ui.customerCategory = document.getElementById("customer-category");
    ui.customerCategory1 = document.getElementById("customer-category1");
    ui.customerCategory2 = document.getElementById("customer-category2");
    ui.customerCategory3 = document.getElementById("customer-category3");
    ui.customerCategory4 = document.getElementById("customer-category4");
    ui.customerCategory5 = document.getElementById("customer-category5");
    ui.customerSector = document.getElementById("customer-sector");
    ui.customerSectorCode = document.getElementById("customer-sector-code");
    ui.customerArea = document.getElementById("customer-area");
    ui.customerAreaCode = document.getElementById("customer-area-code");
    ui.customerAddress = document.getElementById("customer-address");
    ui.customerPhone = document.getElementById("customer-phone");
    ui.customerMobile = document.getElementById("customer-mobile");
    ui.customerFax = document.getElementById("customer-fax");
    ui.customerEmail = document.getElementById("customer-email");
    ui.customerType = document.getElementById("customer-type");
    ui.customerDiscount = document.getElementById("customer-discount");
    ui.customerCreditLimit = document.getElementById("customer-credit-limit");
    ui.customerReceivablesCreditLimit = document.getElementById("customer-receivables-credit-limit");
    ui.customerBouncedCount = document.getElementById("customer-bounced-count");
    ui.customerCreditLimitExceeded = document.getElementById("customer-credit-limit-exceeded");
    ui.customerMaxOpenInvoices = document.getElementById("customer-max-open-invoices");
    ui.customerTermsCredit = document.getElementById("customer-terms-credit");
    ui.customerReceivablesTerms = document.getElementById("customer-receivables-terms");
    ui.customerParentCode = document.getElementById("customer-parent-code");
    ui.customerActive = document.getElementById("customer-active");
    ui.customerSubmit = document.getElementById("customer-submit");
    ui.refreshCustomers = document.getElementById("refresh-customers");
    ui.customersSearch = document.getElementById("customers-search");
    ui.customersTable = document.getElementById("customers-table");
    ui.customersPager = document.getElementById("customers-pager");

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
    ui.itemVariants = document.getElementById("item-variants");
    ensureItemVariantEditor();
    ui.itemVariantColor = document.getElementById("item-variant-color");
    ui.itemVariantSize = document.getElementById("item-variant-size");
    ui.itemVariantUnit = document.getElementById("item-variant-unit");
    ui.itemAddVariant = document.getElementById("item-add-variant");
    ui.itemVariantsTable = document.getElementById("item-variants-table");
    ui.itemSubmit = document.getElementById("item-submit");
    ui.refreshItems = document.getElementById("refresh-items");
    ui.itemsSearch = document.getElementById("items-search");
    ui.itemsTable = document.getElementById("items-table");
    ui.itemsPager = document.getElementById("items-pager");

    ui.userForm = document.getElementById("user-form");
    ui.userFormTitle = document.getElementById("user-form-title");
    ui.userFormReset = document.getElementById("user-form-reset");
    ui.userFullName = document.getElementById("user-full-name");
    ui.userLoginEmail = document.getElementById("user-login-email");
    ui.userPassword = document.getElementById("user-password");
    ui.userActive = document.getElementById("user-active");
    ui.userSubmit = document.getElementById("user-submit");
    ui.refreshUsers = document.getElementById("refresh-users");
    ui.usersSearch = document.getElementById("users-search");
    ui.usersTable = document.getElementById("users-table");

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
    ui.loadProductionDashboard = document.getElementById("load-production-dashboard");
    ui.productionHeadlineTitle = document.getElementById("production-headline-title");
    ui.productionHeadlineCaption = document.getElementById("production-headline-caption");
    ui.productionOverallTotal = document.getElementById("production-overall-total");
    ui.productionOverviewBoard = document.getElementById("production-overview-board");
    ui.productionSourceButtons = Array.from(document.querySelectorAll("[data-production-source]"));
    ui.productionLineFilter = document.getElementById("production-line-filter");
    ui.productionColorFilter = document.getElementById("production-color-filter");
    ui.productionSizeFilter = document.getElementById("production-size-filter");
    ui.productionMonthFilter = document.getElementById("production-month-filter");
    ui.productionModelFilter = document.getElementById("production-model-filter");
    ui.productionMetrics = document.getElementById("production-metrics");
    ui.productionDailyChart = document.getElementById("production-monthly-chart") || document.getElementById("production-daily-chart");
    ui.productionSourceChart =
      document.getElementById("production-destinations-chart") || document.getElementById("production-source-chart");
    ui.productionLinesChart = document.getElementById("production-lines-chart");
    ui.productionModelsList = document.getElementById("production-models-list");
    ui.productionItemsList = document.getElementById("production-items-list");
    ui.productionDestinationsList = document.getElementById("production-destinations-list");
    ui.productionSizesList = document.getElementById("production-sizes-list");
    ui.productionColorsList = document.getElementById("production-colors-list");
    ui.productionRecordsTable = document.getElementById("production-records-table");
    ui.productionLegacySource = document.getElementById("production-source");
    if (ui.productionLegacySource && ui.productionLegacySource.closest(".field")) {
      ui.productionLegacySource.closest(".field").classList.add("hidden");
    }

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

  function ensureItemVariantEditor() {
    const textarea = document.getElementById("item-variants");
    if (!textarea || document.getElementById("item-variants-table")) {
      return;
    }

    const hostLabel = textarea.closest("label");
    if (hostLabel) {
      hostLabel.classList.add("hidden");
    }

    const wrapper = document.createElement("div");
    wrapper.className = "field field-span stack-gap";
    wrapper.innerHTML = `
      <span>&#1605;&#1578;&#1594;&#1610;&#1585;&#1575;&#1578; &#1575;&#1604;&#1605;&#1606;&#1578;&#1580;</span>
      <div class="filters-grid compact-grid">
        <label class="field">
          <span>&#1575;&#1604;&#1604;&#1608;&#1606;</span>
          <input id="item-variant-color" type="text" />
        </label>
        <label class="field">
          <span>&#1575;&#1604;&#1605;&#1602;&#1575;&#1587;</span>
          <input id="item-variant-size" type="text" />
        </label>
        <label class="field">
          <span>&#1575;&#1604;&#1608;&#1581;&#1583;&#1577;</span>
          <input id="item-variant-unit" type="text" />
        </label>
        <div class="field field-button">
          <span>&nbsp;</span>
          <button id="item-add-variant" class="btn btn-soft" type="button">&#1573;&#1590;&#1575;&#1601;&#1577; &#1575;&#1604;&#1605;&#1578;&#1594;&#1610;&#1585;</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>&#1575;&#1604;&#1603;&#1608;&#1583;</th>
              <th>&#1575;&#1604;&#1604;&#1608;&#1606;</th>
              <th>&#1575;&#1604;&#1605;&#1602;&#1575;&#1587;</th>
              <th>&#1575;&#1604;&#1608;&#1581;&#1583;&#1577;</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="item-variants-table">
            <tr>
              <td colspan="5" class="empty-state">&#1604;&#1575; &#1578;&#1608;&#1580;&#1583; &#1605;&#1578;&#1594;&#1610;&#1585;&#1575;&#1578; &#1576;&#1593;&#1583;</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    if (hostLabel && hostLabel.parentNode) {
      hostLabel.parentNode.insertBefore(wrapper, hostLabel.nextSibling);
    }
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
    ui.orderItem.addEventListener("change", renderOrderColorOptions);
    ui.orderColor.addEventListener("change", renderOrderVariantDetails);
    ui.orderQty.addEventListener("change", function () {
      const nextQty = Math.max(1, Math.round(Number(ui.orderQty.value || 1)));
      ui.orderQty.value = String(nextQty);
    });
    ui.addOrderLine.addEventListener("click", onAddOrderLine);
    ui.confirmOrder.addEventListener("click", onConfirmOrder);
    ui.cancelOrder.addEventListener("click", onCancelOrder);

    ui.unlockOrders.addEventListener("click", onUnlockOrders);
    ui.loadOrders.addEventListener("click", onLoadOrders);
    ui.exportOrders.addEventListener("click", exportOrdersExcel);
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
    ui.customerRep.addEventListener("change", () => syncCustomerSectorOptions());
    ui.customerSector.addEventListener("change", () => syncCustomerAreaOptions());
    ui.customerArea.addEventListener("change", () => syncCustomerAreaCode());
    ui.refreshCustomers.addEventListener("click", refreshLookupsAndLists);
    ui.customersSearch.addEventListener("input", function () {
      state.customerSearch = ui.customersSearch.value.trim();
      state.customersPage = 1;
      renderCustomersTable();
    });

    ui.itemForm.addEventListener("submit", onSubmitItem);
    ui.itemFormReset.addEventListener("click", resetItemEditor);
    ui.itemAddVariant.addEventListener("click", onAddItemVariant);
    ui.itemCode.addEventListener("input", renderItemVariantRows);
    ui.itemUnit.addEventListener("input", function () {
      if (ui.itemVariantUnit && !ui.itemVariantUnit.value.trim()) {
        ui.itemVariantUnit.value = ui.itemUnit.value.trim();
      }
    });
    ui.refreshItems.addEventListener("click", refreshLookupsAndLists);
    ui.itemsSearch.addEventListener("input", function () {
      state.itemSearch = ui.itemsSearch.value.trim();
      state.itemsPage = 1;
      renderItemsTable();
    });

    ui.userForm.addEventListener("submit", onSubmitUser);
    ui.userFormReset.addEventListener("click", resetUserEditor);
    ui.refreshUsers.addEventListener("click", refreshUsersList);
    ui.usersSearch.addEventListener("input", function () {
      state.userSearch = ui.usersSearch.value.trim();
      renderUsersTable();
    });

    ui.unlockDashboard.addEventListener("click", onUnlockDashboard);
    ui.loadDashboard.addEventListener("click", onLoadDashboard);
    ui.loadProductionDashboard.addEventListener("click", onLoadProductionDashboard);
    ui.productionSourceButtons.forEach((button) => {
      button.addEventListener("click", function () {
        state.productionSourceTab = button.dataset.productionSource || "";
        setActiveProductionSourceTab();
        onLoadProductionDashboard();
      });
    });
    [ui.productionLineFilter, ui.productionColorFilter, ui.productionSizeFilter, ui.productionMonthFilter].forEach((element) => {
      if (!element) return;
      element.addEventListener("change", onLoadProductionDashboard);
    });
    if (ui.productionModelFilter) {
      ui.productionModelFilter.addEventListener("change", onLoadProductionDashboard);
    }
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
    applyAdminAccessControls();
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

  async function refreshUsersList() {
    try {
      await loadUsers(true);
      renderUsersTable();
      notify("تم تحديث قائمة المستخدمين.", "success");
    } catch (error) {
      notify(error.message || "تعذر تحميل المستخدمين.", "error");
    }
  }

  function renderAll() {
    applyAdminAccessControls();
    renderAllFilterGroups();
    renderCustomerEditorOptions();
    renderOrderModelOptions();
    renderOrderLines();
    renderHomeSummary();
    renderOrdersRepSelect();
    renderOrdersSummaryTable();
    renderOrdersTable();
    renderCustomersTable();
    renderItemVariantRows();
    renderItemsTable();
    renderUsersTable();
    renderLocationSummary("visit");
    renderLocationSummary("collection");
    renderLocationSummary("order");
    renderProductionDashboardV2(state.productionPayload);
    renderDashboard(state.dashboardPayload);
    renderFieldAnalytics(state.fieldAnalyticsPayload, state.fieldMovementsPayload);
    setDashboardChartView(state.dashboardChartView);
    setActiveProductionSourceTab();
    syncTransferField();
    setPage(state.currentPage);
  }

  function reflectSession() {
    const loggedIn = Boolean(state.token);
    ui.loginScreen.classList.toggle("hidden", loggedIn);
    ui.appScreen.classList.toggle("hidden", !loggedIn);
    applyAdminAccessControls();
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
    state.users = [];
    state.lookupsReady = false;
    state.usersLoaded = false;
    state.visit = emptyFilters();
    state.collection = emptyFilters();
    state.orderFilters = emptyFilters();
    state.orderDraft = { id: "", code: "", lines: [], status: "", notes: "" };
    state.ordersUnlocked = false;
    state.ordersScreenToken = "";
    state.dashboardUnlocked = false;
    state.ordersList = [];
    state.ordersSummary = [];
    state.ordersRepFilter = "";
    state.dashboardPayload = null;
    state.productionPayload = null;
    state.productionSourceTab = "";
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
    state.itemVariantRows = [];
    state.userEditorId = "";
    state.userSearch = "";
    if (ui.orderNotes) ui.orderNotes.value = "";
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_EMAIL);
  }

  function setPage(pageName) {
    if (pageName === "users" && !isAdminUser()) {
      pageName = "home";
    }
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
      users: "إدارة المستخدمين",
      "production-dashboard": "لوحة الإنتاج",
      dashboard: "لوحة التحليلات",
      "field-analytics": "تحليل الزيارات والتحصيلات"
    };
    ui.screenTitle.textContent = titles[pageName] || "Embrator";

    if (pageName === "production-dashboard" && !state.productionPayload && state.token) {
      onLoadProductionDashboard();
    }
    if (pageName === "users" && isAdminUser() && !state.usersLoaded && state.token) {
      refreshUsersList();
    }
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

  function isAdminUser() {
    return String(state.userEmail || "").toLowerCase() === "admin@embrator.com";
  }

  function applyAdminAccessControls() {
    const visible = isAdminUser();
    ui.adminOnlyNodes.forEach((node) => {
      node.classList.toggle("hidden", !visible);
    });
    if (!visible && state.currentPage === "users") {
      state.currentPage = "home";
    }
  }

  async function loadUsers(force) {
    if (!isAdminUser()) {
      state.users = [];
      state.usersLoaded = false;
      return;
    }
    if (state.usersLoaded && !force) {
      return;
    }

    const payload = await apiRequest("/api/users");
    state.users = (payload.users || []).map(normalizeUser).sort((a, b) => {
      const dateDiff = String(b.created_at || "").localeCompare(String(a.created_at || ""));
      if (dateDiff !== 0) return dateDiff;
      return String(a.email || "").localeCompare(String(b.email || ""), "ar");
    });
    state.usersLoaded = true;
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
    renderOrderCustomerFilters();
  }

  function renderOrderCustomerFilters() {
    const activeCustomers = state.customers.filter((entry) => entry.is_active !== false);
    const scoped = scopedCustomers(activeCustomers, state.orderFilters);
    const selectedCustomer = findCustomer(state.orderFilters.customerCode);

    ui.orderCustomerFilters.innerHTML = [
      buildSelect("order-rep", "المندوب", unique(activeCustomers.map((entry) => entry.rep)), state.orderFilters.rep),
      buildSelect("order-sector", "القطاع", unique(scoped.byCategory.map((entry) => entry.sector)), state.orderFilters.sector),
      buildSelect("order-area", "المنطقة", unique(scoped.bySector.map((entry) => entry.area)), state.orderFilters.area),
      buildSelect(
        "order-customer",
        "اسم العميل",
        scoped.final.map((entry) => ({ value: entry.code, label: entry.name })),
        state.orderFilters.customerCode
      ),
      `
        <label class="field">
          <span>كود العميل</span>
          <input id="order-customer-code" type="text" value="${escapeHtml((selectedCustomer && selectedCustomer.code) || "")}" readonly />
        </label>
      `
    ].join("");

    bindFilterChange(ui.orderCustomerFilters, "order-rep", (value) => {
      state.orderFilters.rep = value;
      state.orderFilters.category = "";
      state.orderFilters.sector = "";
      state.orderFilters.area = "";
      state.orderFilters.customerCode = "";
      renderAllFilterGroups();
    });
    bindFilterChange(ui.orderCustomerFilters, "order-sector", (value) => {
      state.orderFilters.sector = value;
      state.orderFilters.area = "";
      state.orderFilters.customerCode = "";
      renderAllFilterGroups();
    });
    bindFilterChange(ui.orderCustomerFilters, "order-area", (value) => {
      state.orderFilters.area = value;
      state.orderFilters.customerCode = "";
      renderAllFilterGroups();
    });
    bindFilterChange(ui.orderCustomerFilters, "order-customer", (value) => {
      state.orderFilters.customerCode = value;
      renderAllFilterGroups();
    });
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

  function fillNativeSelect(select, options, selectedValue, placeholder) {
    if (!select) return;
    const list = (options || []).map((option) => (typeof option === "string" ? { value: option, label: option } : option));
    select.innerHTML =
      `<option value="">${escapeHtml(placeholder || "Choose")}</option>` +
      list
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
    select.value = selectedValue || "";
  }

  function renderCustomerEditorOptions(prefill) {
    const current = prefill || {
      rep: ui.customerRep ? ui.customerRep.value : "",
      repCode: ui.customerRepCode ? ui.customerRepCode.value : "",
      sector: ui.customerSector ? ui.customerSector.value : "",
      sectorCode: ui.customerSectorCode ? ui.customerSectorCode.value : "",
      area: ui.customerArea ? ui.customerArea.value : "",
      areaCode: ui.customerAreaCode ? ui.customerAreaCode.value : ""
    };
    const reps = unique(state.customers.map((entry) => entry.rep).filter(Boolean)).map((rep) => {
      const match = state.customers.find((entry) => entry.rep === rep && entry.rep_code);
      return { value: rep, label: rep, code: match ? match.rep_code : "" };
    });
    fillNativeSelect(ui.customerRep, reps, current.rep, "اختر المندوب");
    syncCustomerSectorOptions(current);
  }

  function syncCustomerSectorOptions(prefill) {
    const current = prefill || {
      sector: ui.customerSector ? ui.customerSector.value : "",
      sectorCode: ui.customerSectorCode ? ui.customerSectorCode.value : "",
      area: ui.customerArea ? ui.customerArea.value : "",
      areaCode: ui.customerAreaCode ? ui.customerAreaCode.value : ""
    };
    const selectedRep = ui.customerRep ? ui.customerRep.value : "";
    const repRows = state.customers.filter((entry) => !selectedRep || entry.rep === selectedRep);
    const repMeta = repRows.find((entry) => entry.rep_code);
    if (ui.customerRepCode) {
      ui.customerRepCode.value = repMeta ? repMeta.rep_code || "" : current.repCode || "";
    }

    const sectors = unique(repRows.map((entry) => entry.sector).filter(Boolean)).map((sector) => {
      const match = repRows.find((entry) => entry.sector === sector && entry.sector_code);
      return { value: sector, label: sector, code: match ? match.sector_code : "" };
    });
    fillNativeSelect(ui.customerSector, sectors, current.sector, "اختر القطاع");
    syncCustomerAreaOptions(current);
  }

  function syncCustomerAreaOptions(prefill) {
    const current = prefill || {
      area: ui.customerArea ? ui.customerArea.value : "",
      areaCode: ui.customerAreaCode ? ui.customerAreaCode.value : ""
    };
    const selectedRep = ui.customerRep ? ui.customerRep.value : "";
    const selectedSector = ui.customerSector ? ui.customerSector.value : "";
    const rows = state.customers.filter(
      (entry) => (!selectedRep || entry.rep === selectedRep) && (!selectedSector || entry.sector === selectedSector)
    );
    const sectorMeta = rows.find((entry) => entry.sector_code);
    if (ui.customerSectorCode) {
      ui.customerSectorCode.value = sectorMeta ? sectorMeta.sector_code || "" : "";
    }

    const areas = unique(rows.map((entry) => entry.area).filter(Boolean)).map((area) => {
      const match = rows.find((entry) => entry.area === area && entry.area_code);
      return { value: area, label: area, code: match ? match.area_code : "" };
    });
    fillNativeSelect(ui.customerArea, areas, current.area, "اختر المنطقة");
    syncCustomerAreaCode(current.areaCode);
  }

  function syncCustomerAreaCode(fallbackCode) {
    const selectedRep = ui.customerRep ? ui.customerRep.value : "";
    const selectedSector = ui.customerSector ? ui.customerSector.value : "";
    const selectedArea = ui.customerArea ? ui.customerArea.value : "";
    const row = state.customers.find(
      (entry) =>
        (!selectedRep || entry.rep === selectedRep) &&
        (!selectedSector || entry.sector === selectedSector) &&
        (!selectedArea || entry.area === selectedArea) &&
        entry.area_code
    );
    if (ui.customerAreaCode) {
      ui.customerAreaCode.value = row ? row.area_code || "" : String(fallbackCode || "");
    }
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

  function orderSizePayload() {
    const size = String(ui.orderSize.value || "").trim().toUpperCase();
    const qty = Number(ui.orderQty.value || 0);
    return {
      sizeS: size === "S" ? qty : 0,
      sizeM: size === "M" ? qty : 0,
      sizeL: size === "L" ? qty : 0,
      sizeXl: size === "XL" ? qty : 0,
      size2xl: size === "2XL" ? qty : 0,
      size3xl: size === "3XL" ? qty : 0,
      size4xl: size === "4XL" ? qty : 0
    };
  }

  function orderSizesTotal(payload) {
    return [
      payload.sizeS,
      payload.sizeM,
      payload.sizeL,
      payload.sizeXl,
      payload.size2xl,
      payload.size3xl,
      payload.size4xl
    ].reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function syncOrderQtyFromSizes() {
    ui.orderQty.value = String(orderSizesTotal(orderSizePayload()));
  }

  function resetOrderVariantInputs() {
    ui.orderColor.innerHTML = '<option value="">Choose Color</option>';
    ui.orderColor.value = "";
    ui.orderSize.innerHTML = '<option value="">Choose Size</option>';
    ui.orderSize.value = "";
    ui.orderUnit.innerHTML = '<option value="">Choose Unit</option>';
    ui.orderUnit.value = "";
    ui.orderQty.value = "1";
  }

  function lineSizesSummary(line) {
    const pairs = [
      ["S", line.size_s],
      ["M", line.size_m],
      ["L", line.size_l],
      ["XL", line.size_xl],
      ["2XL", line.size_2xl],
      ["3XL", line.size_3xl],
      ["4XL", line.size_4xl]
    ].filter((entry) => Number(entry[1] || 0) > 0);
    return pairs.length
      ? pairs.map((entry) => `${entry[0]}: ${formatNumber(entry[1])}`).join(" | ")
      : "--";
  }

  function singleSizeLabel(line) {
    const pairs = [
      ["S", line.size_s],
      ["M", line.size_m],
      ["L", line.size_l],
      ["XL", line.size_xl],
      ["2XL", line.size_2xl],
      ["3XL", line.size_3xl],
      ["4XL", line.size_4xl]
    ].filter((entry) => Number(entry[1] || 0) > 0);
    return pairs.length === 1 ? pairs[0][0] : lineSizesSummary(line);
  }

  function renderOrderItemOptions() {
    const selectedModel = ui.orderModel.value || "";
    const items = state.items
      .filter((entry) => entry.is_active !== false)
      .filter((entry) => !selectedModel || entry.model === selectedModel)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));

    ui.orderItem.innerHTML =
      `<option value="">Choose Item</option>` +
      items
        .map(
          (entry) =>
            `<option value="${escapeHtml(entry.code)}">${escapeHtml(entry.code)} | ${escapeHtml(entry.name)}</option>`
        )
        .join("");
    resetOrderVariantInputs();
  }

  function renderOrderColorOptions() {
    const item = state.items.find((entry) => entry.code === ui.orderItem.value);
    const colors = unique(
      (item && Array.isArray(item.variants) ? item.variants : [])
        .map((variant) => String(variant.color || "").trim())
        .filter(Boolean)
    );

    if (!colors.length) {
      ui.orderColor.innerHTML = '<option value="">No Color</option>';
      ui.orderColor.value = "";
      renderOrderVariantDetails();
      return;
    }

    ui.orderColor.innerHTML =
      '<option value="">Choose Color</option>' +
      colors.map((color) => `<option value="${escapeHtml(color)}">${escapeHtml(color)}</option>`).join("");
    renderOrderVariantDetails();
  }

  function renderOrderVariantDetails() {
    const item = state.items.find((entry) => entry.code === ui.orderItem.value);
    const selectedColor = String(ui.orderColor.value || "").trim();
    const variants = item && Array.isArray(item.variants)
      ? item.variants.filter((variant) => !selectedColor || String(variant.color || "").trim() === selectedColor)
      : [];
    const sizes = unique(variants.map((variant) => String(variant.size || "").trim()).filter(Boolean));
    const units = unique(variants.map((variant) => String(variant.unit || item.unit || "").trim()).filter(Boolean));

    ui.orderSize.innerHTML =
      '<option value="">Choose Size</option>' +
      sizes.map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join("");
    ui.orderUnit.innerHTML =
      '<option value="">Choose Unit</option>' +
      units.map((unit) => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join("");

    if (sizes.length === 1) ui.orderSize.value = sizes[0];
    if (units.length === 1) ui.orderUnit.value = units[0];
  }

  async function onAddOrderLine() {
    const customer = findCustomer(state.orderFilters.customerCode);
    const item = state.items.find((entry) => entry.code === ui.orderItem.value);
    const sizes = orderSizePayload();
    const qty = orderSizesTotal(sizes);

    if (!customer) {
      notify("Choose customer first.", "error");
      return;
    }
    if (!item) {
      notify("Choose item first.", "error");
      return;
    }
    if (!ui.orderSize.value) {
      notify("Choose size first.", "error");
      return;
    }
    if (!ui.orderUnit.value) {
      notify("Choose unit first.", "error");
      return;
    }
    if (qty <= 0) {
      notify("Enter a valid quantity.", "error");
      return;
    }

    setBusy(ui.addOrderLine, true, "Adding...");
    try {
      const result = await apiRequest("/api/orders/line", {
        method: "POST",
        body: Object.assign(
          {
            orderCode: state.orderDraft.code || "",
            customer,
            item: Object.assign({}, item, { unit: ui.orderUnit.value }),
            color: ui.orderColor.value.trim(),
            notes: ui.orderNotes.value.trim(),
            qty,
            sizeS: sizes.sizeS,
            sizeM: sizes.sizeM,
            sizeL: sizes.sizeL,
            sizeXl: sizes.sizeXl,
            size2xl: sizes.size2xl,
            size3xl: sizes.size3xl,
            size4xl: sizes.size4xl
          },
          locationPayload("order")
        )
      });
      state.orderDraft.id = result.orderId;
      state.orderDraft.code = result.orderCode;
      state.orderDraft.status = result.orderStatus || state.orderDraft.status || "draft";
      state.orderDraft.notes = ui.orderNotes.value.trim();
      state.orderDraft.lines = result.lines || [];
      state.lastCompletedOrder = null;
      renderOrderLines();
      ui.orderQty.value = "1";
      notify("Line added.", "success");
    } catch (error) {
      notify(error.message || "Could not add line.", "error");
    } finally {
      setBusy(ui.addOrderLine, false, "Add Line");
    }
  }

  function renderOrderLines() {
    const totalQty = state.orderDraft.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
    ui.orderCodeLabel.textContent = state.orderDraft.code
      ? "Order Code: " + state.orderDraft.code
      : "No open order yet";
    ui.orderCodeBadge.textContent = state.orderDraft.code || "Not started";
    ui.orderLinesCount.textContent = String(state.orderDraft.lines.length);
    ui.orderTotalQty.textContent = formatNumber(totalQty);

    const status = state.lastCompletedOrder
      ? state.lastCompletedOrder.status
      : state.orderDraft.status || (state.orderDraft.id ? "draft" : "");
    ui.orderStatusBadge.textContent = status ? statusLabel(status) : "Ready";
    ui.orderStatusBadge.className = status ? statusClass(status) : "pill pill-draft";

    if (state.lastCompletedOrder) {
      ui.orderCompleteBanner.textContent = `Order ${state.lastCompletedOrder.order_code} saved with status ${statusLabel(
        state.lastCompletedOrder.status
      )}.`;
      ui.orderCompleteBanner.classList.remove("hidden");
    } else {
      ui.orderCompleteBanner.classList.add("hidden");
    }

    if (!state.orderDraft.lines.length) {
      ui.orderLines.innerHTML = '<tr><td colspan="8" class="empty-state">No lines yet</td></tr>';
      return;
    }

    ui.orderLines.innerHTML = state.orderDraft.lines
      .map(
        (line) => `
          <tr>
            <td>${escapeHtml(line.item_code || "")}</td>
            <td>${escapeHtml(line.model || "--")}</td>
            <td>${escapeHtml(line.item_name || "")}</td>
            <td>${escapeHtml(line.color || "--")}</td>
            <td>${escapeHtml(singleSizeLabel(line))}</td>
            <td>${escapeHtml(line.unit || "--")}</td>
            <td>${escapeHtml(formatNumber(line.qty))}</td>
            <td><button class="btn btn-soft line-delete" data-id="${escapeHtml(line.id)}" type="button">Delete</button></td>
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
          orderCode: state.orderDraft.code,
          notes: ui.orderNotes.value.trim()
        }
      });
      state.lastCompletedOrder = result.order || { order_code: state.orderDraft.code, status: "confirmed" };
      state.orderDraft = { id: "", code: "", lines: [], status: "", notes: "" };
      state.locations.order = emptyLocation();
      ui.orderNotes.value = "";
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
          orderCode: state.orderDraft.code,
          notes: ui.orderNotes.value.trim()
        }
      });
      state.lastCompletedOrder = result.order || { order_code: state.orderDraft.code, status: "cancelled" };
      state.orderDraft = { id: "", code: "", lines: [], status: "", notes: "" };
      state.locations.order = emptyLocation();
      ui.orderNotes.value = "";
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

  function filteredOrdersList() {
    return state.ordersRepFilter
      ? state.ordersList.filter((order) => (order.rep || "") === state.ordersRepFilter)
      : state.ordersList.slice();
  }

  function renderOrdersTable() {
    const filtered = filteredOrdersList();

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
    if (isAdminUser()) {
      Array.from(ui.ordersTable.querySelectorAll("tr")).forEach((row, index) => {
        const order = filtered[index];
        const actionCell = row.lastElementChild;
        if (!order || !actionCell || actionCell.querySelector(".order-edit")) {
          return;
        }
        actionCell.insertAdjacentHTML(
          "beforeend",
          ` <button class="btn btn-soft order-edit" data-code="${escapeHtml(order.order_code || "")}" type="button">Edit</button>
            <button class="btn btn-soft order-delete" data-code="${escapeHtml(order.order_code || "")}" type="button">Delete</button>`
        );
      });
      Array.from(document.querySelectorAll(".order-edit")).forEach((button) => {
        button.addEventListener("click", function () {
          loadOrderForEditing(button.dataset.code);
        });
      });
      Array.from(document.querySelectorAll(".order-delete")).forEach((button) => {
        button.addEventListener("click", function () {
          deleteOrder(button.dataset.code);
        });
      });
    }
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

  async function loadOrderForEditing(orderCode) {
    try {
      const result = await apiRequest("/api/orders/" + encodeURIComponent(orderCode), {}, { "x-screen-token": state.ordersScreenToken });
      const order = result.order || {};
      state.orderDraft = {
        id: order.id || "",
        code: order.order_code || "",
        lines: result.lines || [],
        status: order.status || "",
        notes: order.notes || ""
      };
      state.orderFilters.rep = order.rep || "";
      state.orderFilters.category = order.category || "";
      state.orderFilters.sector = order.sector || "";
      state.orderFilters.area = order.area || "";
      state.orderFilters.customerCode = order.customer_code || "";
      state.locations.order = {
        lat: order.lat || "",
        lng: order.lng || "",
        arabicAddress: order.arabic_address || "",
        mapUrl: order.map_url || ""
      };
      ui.orderNotes.value = order.notes || "";
      state.lastCompletedOrder = null;
      renderAllFilterGroups();
      renderOrderLines();
      renderLocationSummary("order");
      setPage("orders-entry");
      notify("Order loaded for editing.", "success");
    } catch (error) {
      notify(error.message || "Could not open order for editing.", "error");
    }
  }

  async function deleteOrder(orderCode) {
    try {
      await apiRequest("/api/orders/" + encodeURIComponent(orderCode), { method: "DELETE" }, { "x-screen-token": state.ordersScreenToken });
      if (state.orderDraft.code === orderCode) {
        state.orderDraft = { id: "", code: "", lines: [], status: "", notes: "" };
        state.locations.order = emptyLocation();
        ui.orderNotes.value = "";
        renderOrderLines();
        renderLocationSummary("order");
      }
      await onLoadOrdersSilently();
      notify("Order deleted.", "success");
    } catch (error) {
      notify(error.message || "Could not delete order.", "error");
    }
  }

  async function exportOrdersExcel() {
    const rows = filteredOrdersList();
    if (!rows.length) {
      notify("No orders to export.", "error");
      return;
    }
    if (!window.XLSX) {
      notify("Excel export library is not loaded.", "error");
      return;
    }
    setBusy(ui.exportOrders, true, "Exporting...");
    try {
      const details = await Promise.all(
        rows.map((order) =>
          apiRequest("/api/orders/" + encodeURIComponent(order.order_code), {}, { "x-screen-token": state.ordersScreenToken })
        )
      );

      const exportRows = details.flatMap((payload) => {
        const order = payload.order || {};
        const lines = Array.isArray(payload.lines) ? payload.lines : [];
        if (!lines.length) {
          return [{
            order_code: order.order_code || "",
            customer_code: order.customer_code || "",
            customer_name: order.customer_name || "",
            rep: order.rep || "",
            status: statusLabel(order.status),
            created_at: order.created_at ? new Date(order.created_at).toLocaleString("en-CA") : "",
            notes: order.notes || "",
            address: order.arabic_address || order.address || "",
            item_code: "",
            model: "",
            item_name: "",
            color: "",
            unit: "",
            qty: 0,
            size_s: 0,
            size_m: 0,
            size_l: 0,
            size_xl: 0,
            size_2xl: 0,
            size_3xl: 0,
            size_4xl: 0
          }];
        }

        return lines.map((line) => ({
          order_code: order.order_code || "",
          customer_code: order.customer_code || "",
          customer_name: order.customer_name || "",
          rep: order.rep || "",
          status: statusLabel(order.status),
          created_at: order.created_at ? new Date(order.created_at).toLocaleString("en-CA") : "",
          notes: order.notes || "",
          address: order.arabic_address || order.address || "",
          item_code: line.item_code || "",
          model: line.model || "",
          item_name: line.item_name || "",
          color: line.color || "",
          unit: line.unit || "",
          qty: Number(line.qty || 0),
          size_s: Number(line.size_s || 0),
          size_m: Number(line.size_m || 0),
          size_l: Number(line.size_l || 0),
          size_xl: Number(line.size_xl || 0),
          size_2xl: Number(line.size_2xl || 0),
          size_3xl: Number(line.size_3xl || 0),
          size_4xl: Number(line.size_4xl || 0)
        }));
      });

      const worksheet = window.XLSX.utils.json_to_sheet(exportRows);
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      window.XLSX.writeFile(workbook, `orders-${stamp}.xlsx`);
      notify("Orders exported.", "success");
    } catch (error) {
      notify(error.message || "Could not export orders.", "error");
    } finally {
      setBusy(ui.exportOrders, false, "تصدير Excel");
    }
  }

  function renderOrderDetailsDialog(order, lines) {
    const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
    const createdAt = order.created_at || "";
    const mapUrl = safeHref(order.map_url);
    ui.detailsTitle.textContent = `Order Details: ${order.order_code || ""}`;
    ui.orderDetailsContent.innerHTML = `
      <section class="order-sheet">
        <header class="order-sheet-header">
          <h2>&#1578;&#1601;&#1575;&#1589;&#1610;&#1604; &#1575;&#1604;&#1591;&#1604;&#1576;&#1610;&#1577;: ${escapeHtml(order.order_code || "")}</h2>
          <div class="actions-row compact-actions">
            <button class="btn btn-soft order-sheet-print" type="button">&#1591;&#1576;&#1575;&#1593;&#1577;</button>
            <button class="btn btn-soft order-sheet-back" type="button">&#1575;&#1604;&#1593;&#1608;&#1583;&#1577;</button>
          </div>
        </header>

        <div class="order-sheet-separator"></div>

        <section class="order-sheet-card order-sheet-info">
          <div class="order-sheet-card-head">
            <h3>&#1605;&#1593;&#1604;&#1608;&#1605;&#1575;&#1578; &#1575;&#1604;&#1591;&#1604;&#1576;&#1610;&#1577;</h3>
            <span class="${statusClass(order.status)}">${escapeHtml(statusLabel(order.status))}</span>
          </div>

          <div class="order-sheet-meta">
            <div class="order-sheet-meta-side">
              <p><strong>&#1575;&#1604;&#1605;&#1606;&#1583;&#1608;&#1576;:</strong> ${escapeHtml(order.rep || "--")}</p>
              <p><strong>&#1575;&#1604;&#1578;&#1575;&#1585;&#1610;&#1582;:</strong> ${escapeHtml(formatDay(createdAt))}</p>
              <p><strong>&#1575;&#1604;&#1608;&#1602;&#1578;:</strong> ${escapeHtml(formatTime(createdAt))}</p>
            </div>
            <div class="order-sheet-meta-side">
              <p><strong>&#1575;&#1604;&#1593;&#1605;&#1610;&#1604;:</strong> ${escapeHtml(order.customer_name || "--")}</p>
              <p><strong>&#1603;&#1608;&#1583; &#1575;&#1604;&#1593;&#1605;&#1610;&#1604;:</strong> ${escapeHtml(order.customer_code || "--")}</p>
              <p><strong>&#1593;&#1583;&#1583; &#1575;&#1604;&#1576;&#1606;&#1608;&#1583;:</strong> ${escapeHtml(String(lines.length))}</p>
            </div>
          </div>

          <div class="order-sheet-address">
            <p><strong>&#1575;&#1604;&#1593;&#1606;&#1608;&#1575;&#1606;:</strong> ${escapeHtml(order.arabic_address || order.address || "No address")}</p>
            <p><strong>&#1605;&#1604;&#1575;&#1581;&#1592;&#1575;&#1578;:</strong> ${escapeHtml(order.notes || "--")}</p>
            <div class="order-sheet-map-row">
              <p><strong>&#1575;&#1604;&#1605;&#1608;&#1602;&#1593;:</strong> ${
                mapUrl
                  ? `<a class="map-link map-link-solid" href="${escapeHtml(mapUrl)}" target="_blank" rel="noreferrer">&#1593;&#1585;&#1590; &#1593;&#1604;&#1609; &#1575;&#1604;&#1582;&#1585;&#1610;&#1591;&#1577;</a>`
                  : `<span class="muted">&#1604;&#1575; &#1610;&#1608;&#1580;&#1583; &#1585;&#1575;&#1576;&#1591; &#1582;&#1585;&#1610;&#1591;&#1577;</span>`
              }</p>
              <p><strong>&#1573;&#1580;&#1605;&#1575;&#1604;&#1610; &#1575;&#1604;&#1603;&#1605;&#1610;&#1577;:</strong> ${escapeHtml(formatNumber(totalQty))}</p>
            </div>
          </div>
        </section>

        <section class="order-sheet-items">
          <div class="order-sheet-items-head">
            <h3>&#1575;&#1604;&#1571;&#1589;&#1606;&#1575;&#1601; &#1575;&#1604;&#1605;&#1591;&#1604;&#1608;&#1576;&#1577;</h3>
          </div>
          <div class="table-wrap order-sheet-table-wrap">
            <table class="order-sheet-table">
              <thead>
                <tr>
                  <th>&#1603;&#1608;&#1583; &#1575;&#1604;&#1589;&#1606;&#1601;</th>
                  <th>&#1575;&#1604;&#1605;&#1608;&#1583;&#1610;&#1604;</th>
                  <th>&#1575;&#1587;&#1605; &#1575;&#1604;&#1589;&#1606;&#1601;</th>
                  <th>&#1575;&#1604;&#1604;&#1608;&#1606;</th>
                  <th>&#1575;&#1604;&#1608;&#1581;&#1583;&#1577;</th>
                  <th>S</th>
                  <th>M</th>
                  <th>L</th>
                  <th>XL</th>
                  <th>2XL</th>
                  <th>3XL</th>
                  <th>4XL</th>
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
                              <td>${escapeHtml(line.model || "--")}</td>
                              <td>${escapeHtml(line.item_name || "")}</td>
                              <td>${escapeHtml(line.color || "--")}</td>
                              <td>${escapeHtml(line.unit || "--")}</td>
                              <td>${escapeHtml(formatNumber(line.size_s || 0))}</td>
                              <td>${escapeHtml(formatNumber(line.size_m || 0))}</td>
                              <td>${escapeHtml(formatNumber(line.size_l || 0))}</td>
                              <td>${escapeHtml(formatNumber(line.size_xl || 0))}</td>
                              <td>${escapeHtml(formatNumber(line.size_2xl || 0))}</td>
                              <td>${escapeHtml(formatNumber(line.size_3xl || 0))}</td>
                              <td>${escapeHtml(formatNumber(line.size_4xl || 0))}</td>
                            </tr>
                          `
                        )
                        .join("")
                    : `<tr><td colspan="12" class="empty-state">&#1604;&#1575; &#1578;&#1608;&#1580;&#1583; &#1576;&#1606;&#1608;&#1583;</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </section>
      </section>
    `;

    const backButton = ui.orderDetailsContent.querySelector(".order-sheet-back");
    const printButton = ui.orderDetailsContent.querySelector(".order-sheet-print");
    if (backButton) {
      backButton.addEventListener("click", function () {
        ui.detailsDialog.close();
      });
    }
    if (printButton) {
      printButton.addEventListener("click", function () {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          notify("Allow popups to print the order.", "error");
          return;
        }
        printWindow.document.write(`
          <html>
            <head>
              <title>${escapeHtml(order.order_code || "order")}</title>
              <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 24px; }
                table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                th, td { border: 1px solid #d7dbe4; padding: 8px; text-align: right; }
                .order-sheet-back, .order-sheet-print { display: none; }
              </style>
            </head>
            <body>${ui.orderDetailsContent.innerHTML}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      });
    }
  }

  function renderCustomersTable() {
    const pageSize = 10;
    const needle = state.customerSearch.toLowerCase();
    const filteredRows = state.customers.filter((row) => {
      if (!needle) return true;
      return [row.code, row.name, row.rep, row.sector, row.area, row.mobile, row.customer_type].some((value) =>
        String(value || "").toLowerCase().includes(needle)
      );
    });

    if (!filteredRows.length) {
      ui.customersTable.innerHTML = '<tr><td colspan="9" class="empty-state">No results</td></tr>';
      renderTablePager(ui.customersPager, 1, 1, () => {});
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    state.customersPage = Math.min(Math.max(state.customersPage, 1), totalPages);
    const pageStart = (state.customersPage - 1) * pageSize;
    const rows = filteredRows.slice(pageStart, pageStart + pageSize);

    ui.customersTable.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.code || "")}</td>
            <td>${escapeHtml(row.name || "")}</td>
            <td>${escapeHtml(row.rep || "--")}</td>
            <td>${escapeHtml(row.sector || "--")}</td>
            <td>${escapeHtml(row.area || "--")}</td>
            <td>${escapeHtml(row.mobile || row.phone || "--")}</td>
            <td>${escapeHtml(row.customer_type || "--")}</td>
            <td><span class="${row.is_active === false ? "pill pill-cancelled" : "pill pill-confirmed"}">${escapeHtml(
              row.is_active === false ? "Inactive" : "Active"
            )}</span></td>
            <td><button class="btn btn-soft customer-edit" data-code="${escapeHtml(row.code || "")}" type="button">Edit</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".customer-edit")).forEach((button) => {
      button.addEventListener("click", function () {
        fillCustomerEditor(button.dataset.code);
      });
    });

    renderTablePager(ui.customersPager, state.customersPage, totalPages, (page) => {
      state.customersPage = page;
      renderCustomersTable();
    });
  }

  function fillCustomerEditor(code) {
    const customer = findCustomer(code);
    if (!customer) {
      return;
    }

    state.customerEditorCode = customer.code;
    ui.customerFormTitle.textContent = `تعديل العميل: ${customer.code}`;
    ui.customerBranchCode.value = customer.branch_code || "";
    ui.customerCode.value = customer.code || "";
    ui.customerCode.disabled = true;
    ui.customerName.value = customer.name || "";
    renderCustomerEditorOptions({
      rep: customer.rep || "",
      repCode: customer.rep_code || "",
      sector: customer.sector || "",
      sectorCode: customer.sector_code || "",
      area: customer.area || "",
      areaCode: customer.area_code || ""
    });
    ui.customerCategory.value = customer.category || "";
    ui.customerCategory1.value = customer.category1 || "";
    ui.customerCategory2.value = customer.category2 || "";
    ui.customerCategory3.value = customer.category3 || "";
    ui.customerCategory4.value = customer.category4 || "";
    ui.customerCategory5.value = customer.category5 || "";
    ui.customerAddress.value = customer.address || "";
    ui.customerPhone.value = customer.phone || "";
    ui.customerMobile.value = customer.mobile || "";
    ui.customerFax.value = customer.fax || "";
    ui.customerEmail.value = customer.email || "";
    ui.customerType.value = customer.customer_type || "";
    ui.customerDiscount.value = customer.discount || "";
    ui.customerCreditLimit.value = customer.credit_limit || "";
    ui.customerReceivablesCreditLimit.value = customer.receivables_credit_limit || "";
    ui.customerBouncedCount.value = customer.bounced_receivables_count || "";
    ui.customerCreditLimitExceeded.value = customer.credit_limit_exceeded || "";
    ui.customerMaxOpenInvoices.value = customer.max_open_invoices || "";
    ui.customerTermsCredit.value = customer.terms_credit || "";
    ui.customerReceivablesTerms.value = customer.receivables_terms || "";
    ui.customerParentCode.value = customer.parent_customer_code || "";
    ui.customerActive.value = customer.is_active === false ? "false" : "true";
    ui.customerSubmit.textContent = "حفظ التعديل";
    setPage("customers");
  }

  function renderTablePager(host, currentPage, totalPages, onChange) {
    if (!host) return;
    if (totalPages <= 1) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML = `
      <button class="btn btn-soft pager-prev" type="button" ${currentPage <= 1 ? "disabled" : ""}>السابق</button>
      <span class="muted">صفحة ${escapeHtml(String(currentPage))} من ${escapeHtml(String(totalPages))}</span>
      <button class="btn btn-soft pager-next" type="button" ${currentPage >= totalPages ? "disabled" : ""}>التالي</button>
    `;

    const prev = host.querySelector(".pager-prev");
    const next = host.querySelector(".pager-next");
    if (prev) prev.addEventListener("click", () => onChange(currentPage - 1));
    if (next) next.addEventListener("click", () => onChange(currentPage + 1));
  }

  function resetCustomerEditor() {
    state.customerEditorCode = "";
    ui.customerForm.reset();
    ui.customerFormTitle.textContent = "عميل جديد";
    ui.customerCode.disabled = false;
    renderCustomerEditorOptions({ rep: "", repCode: "", sector: "", sectorCode: "", area: "", areaCode: "" });
    ui.customerActive.value = "true";
    ui.customerSubmit.textContent = "حفظ العميل";
  }

  async function onSubmitCustomer(event) {
    event.preventDefault();
    const payload = {
      branchCode: ui.customerBranchCode.value.trim(),
      code: ui.customerCode.value.trim(),
      name: ui.customerName.value.trim(),
      rep: ui.customerRep.value.trim(),
      repCode: ui.customerRepCode.value.trim(),
      category: ui.customerCategory.value.trim(),
      category1: ui.customerCategory1.value.trim(),
      category2: ui.customerCategory2.value.trim(),
      category3: ui.customerCategory3.value.trim(),
      category4: ui.customerCategory4.value.trim(),
      category5: ui.customerCategory5.value.trim(),
      sector: ui.customerSector.value.trim(),
      sectorCode: ui.customerSectorCode.value.trim(),
      area: ui.customerArea.value.trim(),
      areaCode: ui.customerAreaCode.value.trim(),
      address: ui.customerAddress.value.trim(),
      phone: ui.customerPhone.value.trim(),
      mobile: ui.customerMobile.value.trim(),
      fax: ui.customerFax.value.trim(),
      email: ui.customerEmail.value.trim(),
      customerType: ui.customerType.value.trim(),
      discount: ui.customerDiscount.value.trim(),
      creditLimit: ui.customerCreditLimit.value.trim(),
      receivablesCreditLimit: ui.customerReceivablesCreditLimit.value.trim(),
      bouncedReceivablesCount: ui.customerBouncedCount.value.trim(),
      creditLimitExceeded: ui.customerCreditLimitExceeded.value.trim(),
      maxOpenInvoices: ui.customerMaxOpenInvoices.value.trim(),
      termsCredit: ui.customerTermsCredit.value.trim(),
      receivablesTerms: ui.customerReceivablesTerms.value.trim(),
      parentCustomerCode: ui.customerParentCode.value.trim(),
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

  function formatVariantsForTextarea(variants) {
    return (Array.isArray(variants) ? variants : [])
      .map((variant) => [variant.color || "", variant.size || "", variant.unit || ""].join(" | "))
      .join("\n");
  }

  function syncHiddenVariantsField() {
    if (ui.itemVariants) {
      ui.itemVariants.value = formatVariantsForTextarea(state.itemVariantRows);
    }
  }

  function renderItemVariantRows() {
    if (!ui.itemVariantsTable) {
      return;
    }
    if (!state.itemVariantRows.length) {
      ui.itemVariantsTable.innerHTML = '<tr><td colspan="5" class="empty-state">No variants yet</td></tr>';
      syncHiddenVariantsField();
      return;
    }

    const currentCode = ui.itemCode ? ui.itemCode.value.trim() : "";
    ui.itemVariantsTable.innerHTML = state.itemVariantRows
      .map(
        (variant, index) => `
          <tr>
            <td>${escapeHtml(currentCode || "--")}</td>
            <td>${escapeHtml(variant.color || "--")}</td>
            <td>${escapeHtml(variant.size || "--")}</td>
            <td>${escapeHtml(variant.unit || "--")}</td>
            <td><button class="btn btn-soft item-variant-delete" data-index="${escapeHtml(String(index))}" type="button">Delete</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".item-variant-delete")).forEach((button) => {
      button.addEventListener("click", function () {
        const index = Number(button.dataset.index);
        state.itemVariantRows = state.itemVariantRows.filter((_, rowIndex) => rowIndex !== index);
        renderItemVariantRows();
      });
    });
    syncHiddenVariantsField();
  }

  function onAddItemVariant() {
    const candidate = normalizeVariant({
      color: ui.itemVariantColor.value.trim(),
      size: ui.itemVariantSize.value.trim(),
      unit: (ui.itemVariantUnit.value || ui.itemUnit.value || "").trim()
    });

    if (!candidate.color && !candidate.size && !candidate.unit) {
      notify("Enter color, size, or unit first.", "error");
      return;
    }

    state.itemVariantRows = state.itemVariantRows.concat(candidate);
    renderItemVariantRows();
    ui.itemVariantColor.value = "";
    ui.itemVariantSize.value = "";
    ui.itemVariantUnit.value = ui.itemUnit.value.trim();
  }

  function parseVariantsTextarea(text, fallbackUnit) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        return normalizeVariant({
          color: parts[0] || "",
          size: parts[1] || "",
          unit: parts[2] || fallbackUnit || ""
        });
      })
      .filter((variant) => variant.color || variant.size || variant.unit);
  }

  function flattenItemsForTable() {
    return state.items.flatMap((item) => {
      const variants = Array.isArray(item.variants) && item.variants.length ? item.variants : [{ color: "", size: "", unit: item.unit || "" }];
      return variants.map((variant) => ({
        code: item.code || "",
        name: item.name || "",
        model: item.model || "",
        color: variant.color || "",
        size: variant.size || "",
        unit: variant.unit || item.unit || "",
        price: item.price || 0,
        is_active: item.is_active !== false
      }));
    });
  }

  function renderItemsTable() {
    const itemsTableHead = ui.itemsTable && ui.itemsTable.closest("table")
      ? ui.itemsTable.closest("table").querySelector("thead tr")
      : null;
    if (itemsTableHead) {
      itemsTableHead.innerHTML = `
        <th>Code</th>
        <th>Product</th>
        <th>Model</th>
        <th>Color</th>
        <th>Size</th>
        <th>Unit</th>
        <th>Price</th>
        <th>Status</th>
        <th>Actions</th>
      `;
    }
    const pageSize = 10;
    const needle = state.itemSearch.toLowerCase();
    const filteredRows = flattenItemsForTable().filter((row) => {
      if (!needle) return true;
      return [row.code, row.name, row.model, row.color, row.size, row.unit].some((value) =>
        String(value || "").toLowerCase().includes(needle)
      );
    });

    if (!filteredRows.length) {
      ui.itemsTable.innerHTML = '<tr><td colspan="9" class="empty-state">No results</td></tr>';
      renderTablePager(ui.itemsPager, 1, 1, () => {});
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    state.itemsPage = Math.min(Math.max(state.itemsPage, 1), totalPages);
    const pageStart = (state.itemsPage - 1) * pageSize;
    const rows = filteredRows.slice(pageStart, pageStart + pageSize);

    ui.itemsTable.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.code || "")}</td>
            <td>${escapeHtml(row.name || "")}</td>
            <td>${escapeHtml(row.model || "--")}</td>
            <td>${escapeHtml(row.color || "--")}</td>
            <td>${escapeHtml(row.size || "--")}</td>
            <td>${escapeHtml(row.unit || "--")}</td>
            <td>${escapeHtml(formatCurrency(row.price || 0))}</td>
            <td><span class="${row.is_active === false ? "pill pill-cancelled" : "pill pill-confirmed"}">${escapeHtml(
              row.is_active === false ? "Inactive" : "Active"
            )}</span></td>
            <td><button class="btn btn-soft item-edit" data-code="${escapeHtml(row.code || "")}" type="button">Edit</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".item-edit")).forEach((button) => {
      button.addEventListener("click", function () {
        fillItemEditor(button.dataset.code);
      });
    });

    renderTablePager(ui.itemsPager, state.itemsPage, totalPages, (page) => {
      state.itemsPage = page;
      renderItemsTable();
    });
  }

  function fillItemEditor(code) {
    const item = state.items.find((entry) => entry.code === code);
    if (!item) return;

    state.itemEditorCode = item.code;
    ui.itemFormTitle.textContent = `Edit Product: ${item.code}`;
    ui.itemCode.value = item.code || "";
    ui.itemCode.disabled = true;
    ui.itemName.value = item.name || "";
    ui.itemModel.value = item.model || "";
    ui.itemUnit.value = item.unit || "";
    ui.itemPrice.value = item.price || 0;
    ui.itemDescription.value = item.description || "";
    state.itemVariantRows = Array.isArray(item.variants) ? item.variants.map(normalizeVariant) : [];
    renderItemVariantRows();
    ui.itemVariantUnit.value = item.unit || "";
    ui.itemActive.value = item.is_active === false ? "false" : "true";
    ui.itemSubmit.textContent = "Save Changes";
    setPage("items");
  }

  function resetItemEditor() {
    state.itemEditorCode = "";
    ui.itemForm.reset();
    ui.itemFormTitle.textContent = "New Product";
    ui.itemCode.disabled = false;
    state.itemVariantRows = [];
    renderItemVariantRows();
    ui.itemActive.value = "true";
    ui.itemSubmit.textContent = "Save Product";
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
      variants: state.itemVariantRows.slice(),
      isActive: ui.itemActive.value === "true"
    };

    if (!payload.code || !payload.name) {
      notify("Product code and name are required.", "error");
      return;
    }

    setBusy(ui.itemSubmit, true, "Saving...");
    try {
      if (state.itemEditorCode) {
        await apiRequest("/api/items/" + encodeURIComponent(state.itemEditorCode), {
          method: "PUT",
          body: payload
        });
        notify("Product updated.", "success");
      } else {
        await apiRequest("/api/items", { method: "POST", body: payload });
        notify("Product added.", "success");
      }
      resetItemEditor();
      await refreshLookupsAndLists();
    } catch (error) {
      notify(error.message || "Could not save product.", "error");
    } finally {
      setBusy(ui.itemSubmit, false, state.itemEditorCode ? "Save Changes" : "Save Product");
    }
  }

  function renderUsersTable() {

    if (!ui.usersTable) {
      return;
    }
    if (!isAdminUser()) {
      ui.usersTable.innerHTML = `<tr><td colspan="5" class="empty-state">إدارة المستخدمين متاحة لحساب الأدمن فقط</td></tr>`;
      return;
    }

    const needle = state.userSearch.toLowerCase();
    const rows = state.users.filter((row) => {
      if (!needle) return true;
      return [row.full_name, row.email].some((value) => String(value || "").toLowerCase().includes(needle));
    });

    if (!rows.length) {
      ui.usersTable.innerHTML = `<tr><td colspan="5" class="empty-state">لا توجد نتائج</td></tr>`;
      return;
    }

    ui.usersTable.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.full_name || "--")}</td>
            <td>${escapeHtml(row.email || "")}</td>
            <td><span class="${row.is_active === false ? "pill pill-cancelled" : "pill pill-confirmed"}">${escapeHtml(
              row.is_active === false ? "غير نشط" : "نشط"
            )}</span></td>
            <td>${escapeHtml(formatDay(row.created_at))}</td>
            <td><button class="btn btn-soft user-edit" data-id="${escapeHtml(row.id || "")}" type="button">تعديل</button></td>
          </tr>
        `
      )
      .join("");

    Array.from(document.querySelectorAll(".user-edit")).forEach((button) => {
      button.addEventListener("click", function () {
        fillUserEditor(button.dataset.id);
      });
    });
  }

  function fillUserEditor(id) {
    const user = state.users.find((entry) => entry.id === id);
    if (!user) {
      return;
    }

    state.userEditorId = user.id;
    ui.userFormTitle.textContent = `تعديل المستخدم: ${user.email}`;
    ui.userFullName.value = user.full_name || "";
    ui.userLoginEmail.value = user.email || "";
    ui.userPassword.value = "";
    ui.userActive.value = user.is_active === false ? "false" : "true";
    ui.userSubmit.textContent = "حفظ التعديل";
    setPage("users");
  }

  function resetUserEditor() {
    state.userEditorId = "";
    ui.userForm.reset();
    ui.userFormTitle.textContent = "مستخدم جديد";
    ui.userActive.value = "true";
    ui.userSubmit.textContent = "حفظ المستخدم";
  }

  async function onSubmitUser(event) {
    event.preventDefault();
    const payload = {
      fullName: ui.userFullName.value.trim(),
      email: ui.userLoginEmail.value.trim(),
      password: ui.userPassword.value,
      isActive: ui.userActive.value === "true"
    };

    if (!payload.email) {
      notify("البريد الإلكتروني مطلوب.", "error");
      return;
    }
    if (!state.userEditorId && !payload.password) {
      notify("كلمة المرور مطلوبة عند إنشاء مستخدم جديد.", "error");
      return;
    }

    const idleLabel = state.userEditorId ? "حفظ التعديل" : "حفظ المستخدم";
    setBusy(ui.userSubmit, true, "جارٍ الحفظ...");
    try {
      if (state.userEditorId) {
        await apiRequest("/api/users/" + encodeURIComponent(state.userEditorId), {
          method: "PUT",
          body: payload
        });
        notify("تم تحديث بيانات المستخدم.", "success");
      } else {
        await apiRequest("/api/users", { method: "POST", body: payload });
        notify("تمت إضافة المستخدم.", "success");
      }
      resetUserEditor();
      await refreshUsersList();
    } catch (error) {
      notify(error.message || "تعذر حفظ المستخدم.", "error");
    } finally {
      setBusy(ui.userSubmit, false, idleLabel);
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
        source: state.productionSourceTab || null,
        line: ui.productionLineFilter ? ui.productionLineFilter.value || null : null,
        color: ui.productionColorFilter ? ui.productionColorFilter.value || null : null,
        size: ui.productionSizeFilter ? ui.productionSizeFilter.value || null : null,
        month: ui.productionMonthFilter ? ui.productionMonthFilter.value || null : null,
        model: ui.productionModelFilter ? ui.productionModelFilter.value.trim() || null : null
      };
      state.productionFilters = body;
      state.productionPayload = await apiRequest("/api/production-dashboard-v2", {
        method: "POST",
        body
      });
      renderProductionDashboardV2(state.productionPayload);
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

function renderProductionDashboardV2(payload) {
    if (!payload) {
      ui.productionMetrics.innerHTML = "";
      if (ui.productionOverviewBoard) ui.productionOverviewBoard.innerHTML = "";
      if (ui.productionOverallTotal) ui.productionOverallTotal.textContent = "--";
      if (ui.productionModelsList) ui.productionModelsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      if (ui.productionItemsList) ui.productionItemsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      if (ui.productionDestinationsList) ui.productionDestinationsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      if (ui.productionSizesList) ui.productionSizesList.innerHTML = emptyInline("لا توجد بيانات بعد");
      if (ui.productionColorsList) ui.productionColorsList.innerHTML = emptyInline("لا توجد بيانات بعد");
      ui.productionRecordsTable.innerHTML = `<tr><td colspan="11" class="empty-state">لا توجد بيانات بعد</td></tr>`;
      destroyProductionCharts();
      return;
    }

    syncProductionStaticCopy();
    renderProductionOverviewV2(payload);
    hydrateProductionFiltersV2(payload.filterOptions || {});

    ui.productionMetrics.innerHTML = [
      metricCard("إجمالي الدستة", formatNumber(payload.totalDozens || 0)),
      metricCard("عدد السجلات", payload.recordsCount || 0),
      metricCard("عدد القصص", payload.storiesCount || 0),
      metricCard("عدد الموديلات", payload.modelsCount || 0),
      metricCard("عدد الخطوط", payload.linesCount || 0),
      metricCard("متوسط الدستة/سجل", formatNumber(payload.averageDozensPerRecord || 0)),
      metricCard("إجمالي الدستة للفترة", formatNumber(payload.overallTotalDozens || 0))
    ].join("");

    if (ui.productionModelsList) ui.productionModelsList.innerHTML = renderScoreList(payload.topModels, "دستة", formatNumber);
    if (ui.productionItemsList) ui.productionItemsList.innerHTML = renderScoreList(payload.topItems, "دستة", formatNumber);
    if (ui.productionDestinationsList) ui.productionDestinationsList.innerHTML = renderScoreList(payload.topDestinations, "دستة", formatNumber);
    if (ui.productionSizesList) ui.productionSizesList.innerHTML = renderScoreList(payload.sizeBreakdown, "دستة", formatNumber);
    if (ui.productionColorsList) ui.productionColorsList.innerHTML = renderScoreList(payload.topColors, "دستة", formatNumber);
    ui.productionRecordsTable.innerHTML = renderProductionRecordsV2(payload.recentRecords || []);
    renderProductionChartsV2(payload);
  }

  function syncProductionStaticCopy() {
    setProductionSectionCopy("لوحة الإنتاج", "شاشة تنفيذية تفاعلية تقرأ من Google Sheets، وتبني كل المقارنات والوصف على عمود الكمية بالدستة.");
    setProductionCardCopy(ui.productionDailyChart, "الإنتاج الشهري بالدستة", "اتجاه الإنتاج خلال الشهور اعتمادًا على الكمية بالدستة فقط.");
    setProductionCardCopy(ui.productionSourceChart, "توزيع الوجهات بالدستة", "أكثر الجهات استقبالًا للإنتاج داخل التبويب الحالي بالدستة.");
    setProductionCardCopy(ui.productionLinesChart, "أفضل الخطوط بالدستة", "الخطوط الأعلى إنتاجًا على أساس الكمية بالدستة.");
    setProductionCardCopy(ui.productionItemsList, "أفضل الأصناف", "مقارنة الأصناف مبنية على الكمية بالدستة.");
    setProductionCardCopy(ui.productionDestinationsList, "أفضل الوجهات", "ترتيب الجهات والأقسام يتم بالدستة.");
    syncProductionTableHeaders();
  }

  function setProductionSectionCopy(title, text) {
    const page = document.querySelector('[data-page="production-dashboard"]');
    if (!page) return;
    const heading = page.querySelector(".section-head h2");
    const paragraph = page.querySelector(".section-head p");
    if (heading) heading.textContent = title;
    if (paragraph) paragraph.textContent = text;
  }

  function setProductionCardCopy(anchor, title, text) {
    if (!anchor) return;
    const card = anchor.closest(".sub-card");
    if (!card) return;
    const heading = card.querySelector("h3");
    const paragraph = card.querySelector(".muted");
    if (heading) heading.textContent = title;
    if (paragraph) paragraph.textContent = text;
  }

  function syncProductionTableHeaders() {
    const table = ui.productionRecordsTable ? ui.productionRecordsTable.closest("table") : null;
    if (!table) return;
    const headers = Array.from(table.querySelectorAll("thead th"));
    const values = ["التاريخ", "التشغيل", "اسم الخط", "رقم القصة", "كود الموديل", "الصنف", "اللون", "المقاس", "الدستة", "الكمية", "موجه إلى"];
    headers.forEach((header, index) => {
      if (values[index]) header.textContent = values[index];
    });
    const head = table.closest(".sub-card");
    if (head) {
      const title = head.querySelector("h3");
      const text = head.querySelector(".muted");
      if (title) title.textContent = "أحدث سجلات الإنتاج";
      if (text) text.textContent = "السجل يعرض الدستة كمرجع أساسي، مع إبقاء الكمية الخام للمراجعة فقط.";
    }
  }

function renderProductionOverviewV2(payload) {
    if (ui.productionHeadlineTitle) {
      ui.productionHeadlineTitle.textContent =
        payload.selectedSource && payload.selectedSource !== "الكل"
          ? `إنتاج ${payload.selectedSource}`
          : "إنتاج مجموعة سماقية إخوان";
    }
    if (ui.productionHeadlineCaption) {
      ui.productionHeadlineCaption.textContent =
        payload.selectedSource && payload.selectedSource !== "الكل"
          ? `اللوحة الحالية تخص ${payload.selectedSource} وجميع المقارنات فيها بالدستة.`
          : "الرئيسية تعرض توزيع الإنتاج على الجاهز والداخلي ووينكز بالدستة.";
    }
    if (ui.productionOverallTotal) {
      ui.productionOverallTotal.textContent = formatNumber(
        payload.selectedSource && payload.selectedSource !== "الكل"
          ? payload.totalDozens || 0
          : payload.overallTotalDozens || 0
      );
    }
    if (ui.productionOverviewBoard) {
      ui.productionOverviewBoard.innerHTML = (payload.sourceCards || []).map(renderProductionSourceColumnV2).join("");
      ui.productionOverviewBoard.querySelectorAll("[data-production-source-card]").forEach((card) => {
        card.addEventListener("click", function () {
          state.productionSourceTab = card.dataset.productionSourceCard || "";
          setActiveProductionSourceTab();
          onLoadProductionDashboard();
        });
      });
    }
    setActiveProductionSourceTab();
  }

function renderProductionSourceColumnV2(card) {
    const isActive = card.source === state.productionSourceTab;
    const flowRows = (card.topDestinations && card.topDestinations.length ? card.topDestinations : card.topLines || []).slice(0, 6);
    return `
      <article class="production-source-column ${isActive ? "active" : ""}" data-production-source-card="${escapeHtml(card.source)}">
        <header>
          <span>${escapeHtml(card.source)}</span>
          <strong>${escapeHtml(formatNumber(card.totalDozens || 0))}</strong>
        </header>
        <div class="production-source-meta">
          <small>إجمالي الدستة</small>
          <small>سجلات: ${escapeHtml(String(card.recordsCount || 0))}</small>
        </div>
        <div class="production-flow-list">
          ${
            flowRows.length
              ? flowRows
                  .map(
                    (row) => `
                      <div class="production-flow-step">
                        <span>${escapeHtml(row.label || "--")}</span>
                        <strong>${escapeHtml(formatNumber(row.total || 0))}</strong>
                      </div>
                    `
                  )
                  .join("")
              : `<div class="production-flow-step"><span>لا توجد بيانات</span><strong>0</strong></div>`
          }
        </div>
      </article>
    `;
  }

  function renderProductionOverviewFlowV2(payload) {
    const sourceCards = Array.isArray(payload.sourceCards) ? payload.sourceCards : [];
    const cardsBySource = new Map(sourceCards.map((card) => [card.source, card]));
    const readyCard = cardsBySource.get("Ø§Ù„Ø¬Ø§Ù‡Ø²") || emptyProductionSourceCardV2("Ø§Ù„Ø¬Ø§Ù‡Ø²");
    const menCard = cardsBySource.get("Ø¯Ø§Ø®Ù„ÙŠ") || emptyProductionSourceCardV2("Ø¯Ø§Ø®Ù„ÙŠ");
    const wingsCard = cardsBySource.get("ÙˆÙŠÙ†ÙƒØ²") || emptyProductionSourceCardV2("ÙˆÙŠÙ†ÙƒØ²");
    const selectedSource = payload.selectedSource && payload.selectedSource !== "Ø§Ù„ÙƒÙ„" ? payload.selectedSource : "";
    const internalTotal = Number((menCard.totalDozens || 0) + (wingsCard.totalDozens || 0));
    const displayTotal = selectedSource === "Ø§Ù„Ø¬Ø§Ù‡Ø²"
      ? Number(readyCard.totalDozens || 0)
      : selectedSource === "ÙˆÙŠÙ†ÙƒØ²"
        ? Number(wingsCard.totalDozens || 0)
        : selectedSource === "Ø¯Ø§Ø®Ù„ÙŠ"
          ? internalTotal
          : Number((readyCard.totalDozens || 0) + internalTotal);

    if (ui.productionHeadlineTitle) {
      ui.productionHeadlineTitle.textContent = selectedSource
        ? `Ø¥Ù†ØªØ§Ø¬ ${selectedSource}`
        : "Ø¥Ù†ØªØ§Ø¬ Ù…Ø¬Ù…ÙˆØ¹Ø© Ø³Ù…Ø§Ù‚ÙŠØ© Ø¥Ø®ÙˆØ§Ù†";
    }
    if (ui.productionHeadlineCaption) {
      ui.productionHeadlineCaption.textContent = selectedSource
        ? `Ø§Ù„ØªØ¯ÙÙ‚ Ø§Ù„Ø­Ø§Ù„ÙŠ Ù…Ø±ØªØ¨ Ø¨Ø§Ù„Ø¯Ø³ØªØ© Ù„Ù…Ø³Ø§Ø± ${selectedSource}.`
        : "Ø§Ù„ØªØ¯ÙÙ‚ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ Ù…Ø±ØªØ¨ Ø¨Ø§Ù„Ø¯Ø³ØªØ© ÙˆÙ…Ø¨Ù†ÙŠ Ø¹Ù„Ù‰ Ù†ÙØ³ ØªØ±ØªÙŠØ¨ Ø®Ø·ÙˆØ· Ø§Ù„Ø¥Ù†ØªØ§Ø¬.";
    }
    if (ui.productionOverallTotal) {
      ui.productionOverallTotal.textContent = formatRoundedNumber(displayTotal || 0);
    }
    if (ui.productionOverviewBoard) {
      ui.productionOverviewBoard.innerHTML = renderProductionFlowBoardMarkupV2({
        selectedSource,
        readyCard,
        menCard,
        wingsCard,
        internalTotal
      });
      ui.productionOverviewBoard.querySelectorAll("[data-production-source-card]").forEach((card) => {
        card.addEventListener("click", function () {
          state.productionSourceTab = card.dataset.productionSourceCard || "";
          setActiveProductionSourceTab();
          onLoadProductionDashboard();
        });
      });
    }
    setActiveProductionSourceTab();
  }

  function emptyProductionSourceCardV2(source) {
    return { source, totalDozens: 0, destinationTotals: [], lineTotals: [] };
  }

  function normalizeProductionFlowTokenV2(value) {
    return String(value || "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[()]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function productionFlowValueV2(card, aliases) {
    const targets = aliases.map(normalizeProductionFlowTokenV2);
    const resolve = (rows) =>
      (Array.isArray(rows) ? rows : [])
        .filter((row) => {
          const label = normalizeProductionFlowTokenV2(row.label || "");
          return targets.some((target) => label.includes(target) || target.includes(label));
        })
        .reduce((sum, row) => sum + Number(row.total || 0), 0);
    const destinationTotal = resolve(card.destinationTotals);
    return destinationTotal > 0 ? destinationTotal : resolve(card.lineTotals);
  }

  function productionFlowStepMarkupV2(label, value, className) {
    return `
      <div class="production-flow-node ${className || ""}">
        <strong>${escapeHtml(formatRoundedNumber(value || 0))}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
    `;
  }

  function renderProductionFlowChainMarkupV2(card, steps, className) {
    return `
      <div class="production-flow-chain ${className || ""}">
        ${steps
          .map(
            (step, index) => `
              <div class="production-flow-chain-item ${index < steps.length - 1 ? "with-arrow" : ""}">
                ${productionFlowStepMarkupV2(step.label, productionFlowValueV2(card, step.aliases), className)}
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderProductionFlowBoardMarkupV2(context) {
    const readySteps = [
      { label: "Ø§Ù„Ù‚Øµ Ø§Ù„Ø¬Ø§Ù‡Ø²", aliases: ["Ø§Ù„Ù‚Øµ Ø§Ù„Ø¬Ø§Ù‡Ø²", "Ù‚Øµ Ø§Ù„Ø¬Ø§Ù‡Ø²"] },
      { label: "ÙƒÙ†ØªØ±ÙˆÙ„", aliases: ["ÙƒÙ†ØªØ±ÙˆÙ„", "Ø§Ù„ÙƒÙ†ØªØ±ÙˆÙ„"] },
      { label: "ØªØ´ØºÙŠÙ„ Ø§Ù„Ø¨Ù†Ø·Ù„ÙˆÙ†", aliases: ["ØªØ´ØºÙŠÙ„ Ø§Ù„Ø¨Ù†Ø·Ù„ÙˆÙ†"] },
      { label: "ØªØ´ØºÙŠÙ„ Ø§Ù„ØªÙŠÙˆØ¨", aliases: ["ØªØ´ØºÙŠÙ„ Ø§Ù„ØªÙŠÙˆØ¨"] },
      { label: "ÙØ±Ø² Ø§Ù„Ø¬Ø§Ù‡Ø²", aliases: ["ÙØ±Ø² Ø§Ù„Ø¬Ø§Ù‡Ø²", "Ø§Ù„ÙØ±Ø²"] },
      { label: "ØªØ³Ù„ÙŠÙ…Ø§Øª Ø§Ù„Ø¬Ø§Ù‡Ø²", aliases: ["ØªØ³Ù„ÙŠÙ…Ø§Øª Ø§Ù„Ø¬Ø§Ù‡Ø²"] }
    ];
    const wingsSteps = [
      { label: "Ø§Ù„Ù‚Øµ", aliases: ["Ø§Ù„Ù‚Øµ"] },
      { label: "ÙƒÙ†ØªØ±ÙˆÙ„", aliases: ["ÙƒÙ†ØªØ±ÙˆÙ„", "Ø§Ù„ÙƒÙ†ØªØ±ÙˆÙ„"] },
      { label: "Ø®Ø· Ø§Ù„Ø¨ÙŠØ¨ÙŠ", aliases: ["Ø®Ø· Ø§Ù„Ø¨ÙŠØ¨ÙŠ", "Ø®Ø· Ø§Ù„Ø¨ÙŠØªÙŠ"] },
      { label: "Ù‚Ù†Ø§Ù„Ø© ÙˆÙŠÙ†ÙƒØ²", aliases: ["Ù‚Ù†Ø§Ù„Ø© ÙˆÙŠÙ†ÙƒØ²", "ÙØªØ§Ù„Ø© ÙˆÙŠÙ†ÙƒØ²", "Ù‚Ù†Ø§Ù†Ù‡ ÙˆÙŠÙ†ÙƒØ²"] },
      { label: "Ø´ÙˆÙŠØª ÙˆÙŠÙ†ÙƒØ²", aliases: ["Ø´ÙˆÙŠØª ÙˆÙŠÙ†ÙƒØ²", "Ø´ÙˆÙŠØª ÙˆÙŠÙ†ÙƒØ²"] },
      { label: "Ø§Ù„ÙØ±Ø²", aliases: ["Ø§Ù„ÙØ±Ø²"] },
      { label: "ØªØ³Ù„ÙŠÙ…Ø§Øª ÙˆÙŠÙ†ÙƒØ²", aliases: ["ØªØ³Ù„ÙŠÙ…Ø§Øª ÙˆÙŠÙ†ÙƒØ²"] }
    ];
    const menMainSteps = [
      { label: "Ø§Ù„Ù‚Øµ", aliases: ["Ø§Ù„Ù‚Øµ"] },
      { label: "Ø§Ù„ÙƒÙ†ØªØ±ÙˆÙ„", aliases: ["Ø§Ù„ÙƒÙ†ØªØ±ÙˆÙ„", "ÙƒÙ†ØªØ±ÙˆÙ„"] },
      { label: "ØªØ´ØºÙŠÙ„ Ø´ÙˆÙŠØª", aliases: ["ØªØ´ØºÙŠÙ„ Ø´ÙˆÙŠØª", "ØªØ´ØºÙŠÙ„ Ø´ÙˆØ±Øª", "ØªØ´ØºÙŠÙ„ Ø´ÙˆØ¨Øª"] },
      { label: "Ø³ÙŠÙˆØ±", aliases: ["Ø³ÙŠÙˆØ±"] },
      { label: "Ø³ÙŠÙˆØ± Ù…ØªÙ†ÙˆØ¹", aliases: ["Ø³ÙŠÙˆØ± Ù…ØªÙ†ÙˆØ¹"] },
      { label: "Ø¬ÙˆÙƒØ± Ø¨ÙŠØ±Ø§ÙŠØ±", aliases: ["Ø¬ÙˆÙƒØ± Ø¨ÙŠØ±Ø§ÙŠØ±", "Ø¬ÙˆÙƒØ±", "Ø¨ÙŠØ±Ø§ÙŠØ±"] },
      { label: "Ø³Ù„ÙŠØ¨", aliases: ["Ø³Ù„ÙŠØ¨"] },
      { label: "Ù‡Ø§Ù Ø´ÙˆÙŠØª", aliases: ["Ù‡Ø§Ù Ø´ÙˆÙŠØª", "Ù‡Ø§Ù Ø´ÙˆØ±Øª"] },
      { label: "Ù‡ÙˆØª Ù…Ø§Ù† ÙØ§Ù†Ù„Ø©", aliases: ["Ù‡ÙˆØª Ù…Ø§Ù† ÙØ§Ù†Ù„Ø©", "Ù‡ÙˆØª Ù…Ø§Ù† Ù‚Ù†Ø§Ù„Ø©"] },
      { label: "Ø§Ù„ÙØ±Ø²", aliases: ["Ø§Ù„ÙØ±Ø²"] },
      { label: "ØªØ³Ù„ÙŠÙ…Ø§Øª Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠ", aliases: ["ØªØ³Ù„ÙŠÙ…Ø§Øª Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠ"] }
    ];
    const menSideSteps = [
      { label: "Ù†Øµ ÙƒÙ…", aliases: ["Ù†Øµ ÙƒÙ…"] },
      { label: "Ù†Øµ ÙƒÙ… Ù…ØªÙØ±Ø¹", aliases: ["Ù†Øµ ÙƒÙ… Ù…ØªÙØ±Ø¹"] },
      { label: "Ù‡ÙˆØª Ù…Ø§Ù† ÙƒÙ„Ø³ÙˆÙ†", aliases: ["Ù‡ÙˆØª Ù…Ø§Ù† ÙƒÙ„Ø³ÙˆÙ†", "Ù‡ÙˆØª Ù…Ø§Ù† ÙƒÙ„ÙˆØª"] },
      { label: "Ù‡Ø§Ù Ø´ÙˆÙŠØª Ø´ÙˆØ±ØªÙŠÙ†", aliases: ["Ù‡Ø§Ù Ø´ÙˆÙŠØª Ø´ÙˆØ±ØªÙŠÙ†", "Ù‡Ø§Ù Ø´ÙˆØ±Øª Ø´ÙˆØ±ØªÙŠÙ†"] }
    ];

    const allView = !context.selectedSource;
    const showReady = allView || context.selectedSource === "Ø§Ù„Ø¬Ø§Ù‡Ø²";
    const showInternal = allView || context.selectedSource === "Ø¯Ø§Ø®Ù„ÙŠ";
    const showWingsOnly = context.selectedSource === "ÙˆÙŠÙ†ÙƒØ²";

    const readyBlock = showReady
      ? `
        <section class="production-lane ready-lane" data-production-source-card="Ø§Ù„Ø¬Ø§Ù‡Ø²">
          <div class="production-lane-total">${productionFlowStepMarkupV2("Ø§Ù„Ø¬Ø§Ù‡Ø²", context.readyCard.totalDozens || 0, "lane-total")}</div>
          ${renderProductionFlowChainMarkupV2(context.readyCard, readySteps, "ready-chain")}
        </section>
      `
      : "";

    const wingsBlock = `
      <section class="production-sub-lane wings-lane" data-production-source-card="ÙˆÙŠÙ†ÙƒØ²">
        <div class="production-lane-total">${productionFlowStepMarkupV2("ÙˆÙŠÙ†ÙƒØ²", context.wingsCard.totalDozens || 0, "lane-total")}</div>
        ${renderProductionFlowChainMarkupV2(context.wingsCard, wingsSteps, "wings-chain")}
      </section>
    `;

    const menBlock = `
      <section class="production-sub-lane men-lane" data-production-source-card="Ø¯Ø§Ø®Ù„ÙŠ">
        <div class="production-lane-total">${productionFlowStepMarkupV2("Ø±Ø¬Ø§Ù„ÙŠ", context.menCard.totalDozens || 0, "lane-total")}</div>
        <div class="production-men-grid">
          <div class="production-men-side side-left">
            ${menSideSteps.slice(0, 2).map((step) => productionFlowStepMarkupV2(step.label, productionFlowValueV2(context.menCard, step.aliases), "minor-node")).join("")}
          </div>
          ${renderProductionFlowChainMarkupV2(context.menCard, menMainSteps, "men-chain")}
          <div class="production-men-side side-right">
            ${menSideSteps.slice(2).map((step) => productionFlowStepMarkupV2(step.label, productionFlowValueV2(context.menCard, step.aliases), "minor-node")).join("")}
          </div>
        </div>
      </section>
    `;

    if (showWingsOnly) {
      return `<div class="production-flowboard single-source">${wingsBlock}</div>`;
    }

    const internalBlock = showInternal
      ? `
        <section class="production-internal-group" data-production-source-card="Ø¯Ø§Ø®Ù„ÙŠ">
          <div class="production-internal-total">${productionFlowStepMarkupV2("Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠ", context.internalTotal || 0, "lane-total internal-total")}</div>
          <div class="production-internal-split">
            ${wingsBlock}
            ${menBlock}
          </div>
        </section>
      `
      : "";

    return `
      <div class="production-flowboard ${allView ? "overview-mode" : "single-source"}">
        ${internalBlock}
        ${readyBlock}
      </div>
    `;
  }

  function syncProductionStaticCopy() {
    setProductionSectionCopy(
      "\u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u0646\u062A\u0627\u062C",
      "\u0634\u0627\u0634\u0629 \u062A\u0646\u0641\u064A\u0630\u064A\u0629 \u062A\u0641\u0627\u0639\u0644\u064A\u0629 \u062A\u0642\u0631\u0623 \u0645\u0646 Google Sheets\u060C \u0648\u062A\u0628\u0646\u064A \u0643\u0644 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0627\u062A \u0648\u0627\u0644\u0648\u0635\u0641 \u0639\u0644\u0649 \u0639\u0645\u0648\u062F \u0627\u0644\u0643\u0645\u064A\u0629 \u0628\u0627\u0644\u062F\u0633\u062A\u0629."
    );
    setProductionCardCopy(
      ui.productionDailyChart,
      "\u0627\u0644\u0625\u0646\u062A\u0627\u062C \u0627\u0644\u0634\u0647\u0631\u064A \u0628\u0627\u0644\u062F\u0633\u062A\u0629",
      "\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0625\u0646\u062A\u0627\u062C \u062E\u0644\u0627\u0644 \u0627\u0644\u0634\u0647\u0648\u0631 \u0627\u0639\u062A\u0645\u0627\u062F\u064B\u0627 \u0639\u0644\u0649 \u0627\u0644\u0643\u0645\u064A\u0629 \u0628\u0627\u0644\u062F\u0633\u062A\u0629 \u0641\u0642\u0637."
    );
    setProductionCardCopy(
      ui.productionSourceChart,
      "\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0648\u062C\u0647\u0627\u062A \u0628\u0627\u0644\u062F\u0633\u062A\u0629",
      "\u0623\u0643\u062B\u0631 \u0627\u0644\u062C\u0647\u0627\u062A \u0627\u0633\u062A\u0642\u0628\u0627\u0644\u064B\u0627 \u0644\u0644\u0625\u0646\u062A\u0627\u062C \u062F\u0627\u062E\u0644 \u0627\u0644\u062A\u0628\u0648\u064A\u0628 \u0627\u0644\u062D\u0627\u0644\u064A \u0628\u0627\u0644\u062F\u0633\u062A\u0629."
    );
    setProductionCardCopy(
      ui.productionLinesChart,
      "\u0623\u0641\u0636\u0644 \u0627\u0644\u062E\u0637\u0648\u0637 \u0628\u0627\u0644\u062F\u0633\u062A\u0629",
      "\u0627\u0644\u062E\u0637\u0648\u0637 \u0627\u0644\u0623\u0639\u0644\u0649 \u0625\u0646\u062A\u0627\u062C\u064B\u0627 \u0639\u0644\u0649 \u0623\u0633\u0627\u0633 \u0627\u0644\u0643\u0645\u064A\u0629 \u0628\u0627\u0644\u062F\u0633\u062A\u0629."
    );
    setProductionCardCopy(
      ui.productionItemsList,
      "\u0623\u0641\u0636\u0644 \u0627\u0644\u0623\u0635\u0646\u0627\u0641",
      "\u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0645\u0628\u0646\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0643\u0645\u064A\u0629 \u0628\u0627\u0644\u062F\u0633\u062A\u0629."
    );
    setProductionCardCopy(
      ui.productionDestinationsList,
      "\u0623\u0641\u0636\u0644 \u0627\u0644\u0648\u062C\u0647\u0627\u062A",
      "\u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u062C\u0647\u0627\u062A \u0648\u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u064A\u062A\u0645 \u0628\u0627\u0644\u062F\u0633\u062A\u0629."
    );
    syncProductionTableHeaders();
  }

  function syncProductionTableHeaders() {
    const table = ui.productionRecordsTable ? ui.productionRecordsTable.closest("table") : null;
    if (!table) return;
    const headers = Array.from(table.querySelectorAll("thead th"));
    const values = [
      "\u0627\u0644\u062A\u0627\u0631\u064A\u062E",
      "\u0627\u0644\u062A\u0634\u063A\u064A\u0644",
      "\u0627\u0633\u0645 \u0627\u0644\u062E\u0637",
      "\u0631\u0642\u0645 \u0627\u0644\u0642\u0635\u0629",
      "\u0643\u0648\u062F \u0627\u0644\u0645\u0648\u062F\u064A\u0644",
      "\u0627\u0644\u0635\u0646\u0641",
      "\u0627\u0644\u0644\u0648\u0646",
      "\u0627\u0644\u0645\u0642\u0627\u0633",
      "\u0627\u0644\u062F\u0633\u062A\u0629",
      "\u0627\u0644\u0643\u0645\u064A\u0629",
      "\u0645\u0648\u062C\u0647 \u0625\u0644\u0649"
    ];
    headers.forEach((header, index) => {
      if (values[index]) header.textContent = values[index];
    });
    const head = table.closest(".sub-card");
    if (head) {
      const title = head.querySelector("h3");
      const text = head.querySelector(".muted");
      if (title) title.textContent = "\u0623\u062D\u062F\u062B \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0625\u0646\u062A\u0627\u062C";
      if (text) {
        text.textContent =
          "\u0627\u0644\u0633\u062C\u0644 \u064A\u0639\u0631\u0636 \u0627\u0644\u062F\u0633\u062A\u0629 \u0643\u0645\u0631\u062C\u0639 \u0623\u0633\u0627\u0633\u064A\u060C \u0645\u0639 \u0625\u0628\u0642\u0627\u0621 \u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u062E\u0627\u0645 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0641\u0642\u0637.";
      }
    }
  }

  function normalizeProductionFlowTokenV2(value) {
    return String(value || "")
      .replace(/[\u0623\u0625\u0622]/g, "\u0627")
      .replace(/\u0649/g, "\u064A")
      .replace(/\u0629/g, "\u0647")
      .replace(/[()]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function renderProductionOverviewFlowV2(payload) {
    const SOURCE_ALL = "\u0627\u0644\u0643\u0644";
    const SOURCE_READY = "\u0627\u0644\u062C\u0627\u0647\u0632";
    const SOURCE_INTERNAL = "\u062F\u0627\u062E\u0644\u064A";
    const SOURCE_WINGS = "\u0648\u064A\u0646\u0643\u0632";

    const sourceCards = Array.isArray(payload.sourceCards) ? payload.sourceCards : [];
    const cardsBySource = new Map(sourceCards.map((card) => [card.source, card]));
    const readyCard = cardsBySource.get(SOURCE_READY) || emptyProductionSourceCardV2(SOURCE_READY);
    const menCard = cardsBySource.get(SOURCE_INTERNAL) || emptyProductionSourceCardV2(SOURCE_INTERNAL);
    const wingsCard = cardsBySource.get(SOURCE_WINGS) || emptyProductionSourceCardV2(SOURCE_WINGS);
    const selectedSource = payload.selectedSource && payload.selectedSource !== SOURCE_ALL ? payload.selectedSource : "";
    const internalTotal = Number((menCard.totalDozens || 0) + (wingsCard.totalDozens || 0));

    const displayTotal =
      selectedSource === SOURCE_READY
        ? Number(readyCard.totalDozens || 0)
        : selectedSource === SOURCE_WINGS
          ? Number(wingsCard.totalDozens || 0)
          : selectedSource === SOURCE_INTERNAL
            ? internalTotal
            : Number((readyCard.totalDozens || 0) + internalTotal);

    if (ui.productionHeadlineTitle) {
      ui.productionHeadlineTitle.textContent = selectedSource
        ? `\u0625\u0646\u062A\u0627\u062C ${selectedSource}`
        : "\u0625\u0646\u062A\u0627\u062C \u0645\u062C\u0645\u0648\u0639\u0629 \u0633\u0645\u0627\u0642\u064A\u0629 \u0625\u062E\u0648\u0627\u0646";
    }
    if (ui.productionHeadlineCaption) {
      ui.productionHeadlineCaption.textContent = selectedSource
        ? `\u0627\u0644\u062A\u062F\u0641\u0642 \u0627\u0644\u062D\u0627\u0644\u064A \u0645\u0631\u062A\u0628 \u0628\u0627\u0644\u062F\u0633\u062A\u0629 \u0644\u0645\u0633\u0627\u0631 ${selectedSource}.`
        : "\u0627\u0644\u062A\u062F\u0641\u0642 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0645\u0631\u062A\u0628 \u0628\u0627\u0644\u062F\u0633\u062A\u0629 \u0648\u0645\u0628\u0646\u064A \u0639\u0644\u0649 \u0646\u0641\u0633 \u062A\u0631\u062A\u064A\u0628 \u062E\u0637\u0648\u0637 \u0627\u0644\u0625\u0646\u062A\u0627\u062C.";
    }
    if (ui.productionOverallTotal) {
      ui.productionOverallTotal.textContent = formatRoundedNumber(displayTotal || 0);
    }
    if (ui.productionOverviewBoard) {
      ui.productionOverviewBoard.innerHTML = renderProductionFlowBoardMarkupV2({
        selectedSource,
        readyCard,
        menCard,
        wingsCard,
        internalTotal
      });
      ui.productionOverviewBoard.querySelectorAll("[data-production-source-card]").forEach((card) => {
        card.addEventListener("click", function () {
          state.productionSourceTab = card.dataset.productionSourceCard || "";
          setActiveProductionSourceTab();
          onLoadProductionDashboard();
        });
      });
    }
    setActiveProductionSourceTab();
  }

  function renderProductionFlowBoardMarkupV2(context) {
    const SOURCE_READY = "\u0627\u0644\u062C\u0627\u0647\u0632";
    const SOURCE_INTERNAL = "\u062F\u0627\u062E\u0644\u064A";
    const SOURCE_WINGS = "\u0648\u064A\u0646\u0643\u0632";

    const readySteps = [
      { label: "\u0627\u0644\u0642\u0635 \u0627\u0644\u062C\u0627\u0647\u0632", aliases: ["\u0627\u0644\u0642\u0635 \u0627\u0644\u062C\u0627\u0647\u0632", "\u0642\u0635 \u0627\u0644\u062C\u0627\u0647\u0632"] },
      { label: "\u0643\u0646\u062A\u0631\u0648\u0644", aliases: ["\u0643\u0646\u062A\u0631\u0648\u0644", "\u0627\u0644\u0643\u0646\u062A\u0631\u0648\u0644"] },
      { label: "\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0628\u0646\u0637\u0644\u0648\u0646", aliases: ["\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0628\u0646\u0637\u0644\u0648\u0646"] },
      { label: "\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062A\u0648\u0628", aliases: ["\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062A\u0648\u0628"] },
      { label: "\u0641\u0631\u0632 \u0627\u0644\u062C\u0627\u0647\u0632", aliases: ["\u0641\u0631\u0632 \u0627\u0644\u062C\u0627\u0647\u0632", "\u0627\u0644\u0641\u0631\u0632"] },
      { label: "\u062A\u0633\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u062C\u0627\u0647\u0632", aliases: ["\u062A\u0633\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u062C\u0627\u0647\u0632"] }
    ];

    const wingsSteps = [
      { label: "\u0627\u0644\u0642\u0635", aliases: ["\u0627\u0644\u0642\u0635"] },
      { label: "\u0643\u0646\u062A\u0631\u0648\u0644", aliases: ["\u0643\u0646\u062A\u0631\u0648\u0644", "\u0627\u0644\u0643\u0646\u062A\u0631\u0648\u0644"] },
      { label: "\u062E\u0637 \u0627\u0644\u0628\u064A\u0628\u064A", aliases: ["\u062E\u0637 \u0627\u0644\u0628\u064A\u0628\u064A", "\u062E\u0637 \u0627\u0644\u0628\u064A\u062A\u064A"] },
      { label: "\u0641\u062A\u0627\u0644\u0629 \u0648\u064A\u0646\u0643\u0632", aliases: ["\u0641\u062A\u0627\u0644\u0629 \u0648\u064A\u0646\u0643\u0632", "\u0642\u0646\u0627\u0644\u0629 \u0648\u064A\u0646\u0643\u0632", "\u0642\u0646\u0627\u0646\u0647 \u0648\u064A\u0646\u0643\u0632"] },
      { label: "\u0634\u0648\u064A\u062A \u0648\u064A\u0646\u0643\u0632", aliases: ["\u0634\u0648\u064A\u062A \u0648\u064A\u0646\u0643\u0632"] },
      { label: "\u0627\u0644\u0641\u0631\u0632", aliases: ["\u0627\u0644\u0641\u0631\u0632"] },
      { label: "\u062A\u0633\u0644\u064A\u0645\u0627\u062A \u0648\u064A\u0646\u0643\u0632", aliases: ["\u062A\u0633\u0644\u064A\u0645\u0627\u062A \u0648\u064A\u0646\u0643\u0632"] }
    ];

    const menMainSteps = [
      { label: "\u0627\u0644\u0642\u0635", aliases: ["\u0627\u0644\u0642\u0635"] },
      { label: "\u0627\u0644\u0643\u0646\u062A\u0631\u0648\u0644", aliases: ["\u0627\u0644\u0643\u0646\u062A\u0631\u0648\u0644", "\u0643\u0646\u062A\u0631\u0648\u0644"] },
      { label: "\u062A\u0634\u063A\u064A\u0644 \u0634\u0648\u064A\u062A", aliases: ["\u062A\u0634\u063A\u064A\u0644 \u0634\u0648\u064A\u062A", "\u062A\u0634\u063A\u064A\u0644 \u0634\u0648\u0631\u062A", "\u062A\u0634\u063A\u064A\u0644 \u0634\u0648\u0628\u062A"] },
      { label: "\u0633\u064A\u0648\u0631", aliases: ["\u0633\u064A\u0648\u0631"] },
      { label: "\u0633\u064A\u0648\u0631 \u0645\u062A\u0646\u0648\u0639", aliases: ["\u0633\u064A\u0648\u0631 \u0645\u062A\u0646\u0648\u0639"] },
      { label: "\u062C\u0648\u0643\u0631 \u0628\u0631\u0627\u064A\u0631", aliases: ["\u062C\u0648\u0643\u0631 \u0628\u0631\u0627\u064A\u0631", "\u062C\u0648\u0643\u0631", "\u0628\u0631\u0627\u064A\u0631"] },
      { label: "\u0633\u0644\u064A\u0628", aliases: ["\u0633\u0644\u064A\u0628"] },
      { label: "\u0647\u0627\u0641 \u0634\u0648\u064A\u062A", aliases: ["\u0647\u0627\u0641 \u0634\u0648\u064A\u062A", "\u0647\u0627\u0641 \u0634\u0648\u0631\u062A"] },
      { label: "\u0647\u0648\u062A \u0645\u0627\u0646 \u0641\u0627\u0646\u0644\u0629", aliases: ["\u0647\u0648\u062A \u0645\u0627\u0646 \u0641\u0627\u0646\u0644\u0629", "\u0647\u0648\u062A \u0645\u0627\u0646 \u0642\u0646\u0627\u0644\u0629"] },
      { label: "\u0627\u0644\u0641\u0631\u0632", aliases: ["\u0627\u0644\u0641\u0631\u0632"] },
      { label: "\u062A\u0633\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A", aliases: ["\u062A\u0633\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u062F\u0627\u062E\u0644\u064A"] }
    ];

    const menSideSteps = [
      { label: "\u0646\u0635 \u0643\u0645", aliases: ["\u0646\u0635 \u0643\u0645"] },
      { label: "\u0646\u0635 \u0643\u0645 \u0645\u062A\u0641\u0631\u0639", aliases: ["\u0646\u0635 \u0643\u0645 \u0645\u062A\u0641\u0631\u0639"] },
      { label: "\u0647\u0648\u062A \u0645\u0627\u0646 \u0643\u0644\u0633\u0648\u0646", aliases: ["\u0647\u0648\u062A \u0645\u0627\u0646 \u0643\u0644\u0633\u0648\u0646", "\u0647\u0648\u062A \u0645\u0627\u0646 \u0643\u0644\u0648\u062A"] },
      { label: "\u0647\u0627\u0641 \u0634\u0648\u064A\u062A \u0634\u0648\u0631\u062A\u064A\u0646", aliases: ["\u0647\u0627\u0641 \u0634\u0648\u064A\u062A \u0634\u0648\u0631\u062A\u064A\u0646", "\u0647\u0627\u0641 \u0634\u0648\u0631\u062A \u0634\u0648\u0631\u062A\u064A\u0646"] }
    ];

    const allView = !context.selectedSource;
    const showReady = allView || context.selectedSource === SOURCE_READY;
    const showInternal = allView || context.selectedSource === SOURCE_INTERNAL;
    const showWingsOnly = context.selectedSource === SOURCE_WINGS;

    const readyBlock = showReady
      ? `
        <section class="production-lane ready-lane" data-production-source-card="${SOURCE_READY}">
          <div class="production-lane-total">${productionFlowStepMarkupV2(SOURCE_READY, context.readyCard.totalDozens || 0, "lane-total")}</div>
          ${renderProductionFlowChainMarkupV2(context.readyCard, readySteps, "ready-chain")}
        </section>
      `
      : "";

    const wingsBlock = `
      <section class="production-sub-lane wings-lane" data-production-source-card="${SOURCE_WINGS}">
        <div class="production-lane-total">${productionFlowStepMarkupV2(SOURCE_WINGS, context.wingsCard.totalDozens || 0, "lane-total")}</div>
        ${renderProductionFlowChainMarkupV2(context.wingsCard, wingsSteps, "wings-chain")}
      </section>
    `;

    const menBlock = `
      <section class="production-sub-lane men-lane" data-production-source-card="${SOURCE_INTERNAL}">
        <div class="production-lane-total">${productionFlowStepMarkupV2("\u0631\u062C\u0627\u0644\u064A", context.menCard.totalDozens || 0, "lane-total")}</div>
        <div class="production-men-grid">
          <div class="production-men-side side-left">
            ${menSideSteps.slice(0, 2).map((step) => productionFlowStepMarkupV2(step.label, productionFlowValueV2(context.menCard, step.aliases), "minor-node")).join("")}
          </div>
          ${renderProductionFlowChainMarkupV2(context.menCard, menMainSteps, "men-chain")}
          <div class="production-men-side side-right">
            ${menSideSteps.slice(2).map((step) => productionFlowStepMarkupV2(step.label, productionFlowValueV2(context.menCard, step.aliases), "minor-node")).join("")}
          </div>
        </div>
      </section>
    `;

    if (showWingsOnly) {
      return `<div class="production-flowboard single-source">${wingsBlock}</div>`;
    }

    const internalBlock = showInternal
      ? `
        <section class="production-internal-group" data-production-source-card="${SOURCE_INTERNAL}">
          <div class="production-internal-total">${productionFlowStepMarkupV2(SOURCE_INTERNAL, context.internalTotal || 0, "lane-total internal-total")}</div>
          <div class="production-internal-split">
            ${wingsBlock}
            ${menBlock}
          </div>
        </section>
      `
      : "";

    return `
      <div class="production-flowboard ${allView ? "overview-mode" : "single-source"}">
        ${internalBlock}
        ${readyBlock}
      </div>
    `;
  }

  function hydrateProductionFiltersV2(filterOptions) {
    populateSelectV2(ui.productionLineFilter, filterOptions.lines || [], state.productionFilters && state.productionFilters.line);
    populateSelectV2(ui.productionColorFilter, filterOptions.colors || [], state.productionFilters && state.productionFilters.color);
    populateSelectV2(ui.productionSizeFilter, filterOptions.sizes || [], state.productionFilters && state.productionFilters.size);
    populateSelectV2(
      ui.productionMonthFilter,
      (filterOptions.months || []).map((value) => ({ value, label: formatMonthKeyV2(value) })),
      state.productionFilters && state.productionFilters.month
    );
    if (ui.productionModelFilter && state.productionFilters && typeof state.productionFilters.model === "string") {
      ui.productionModelFilter.value = state.productionFilters.model;
    }
  }

  function populateSelectV2(select, options, selectedValue) {
    if (!select) return;
    const normalized = (options || []).map((entry) =>
      typeof entry === "string" ? { value: entry, label: entry } : entry
    );
    const current = typeof selectedValue === "string" ? selectedValue : "";
    select.innerHTML = [`<option value="">الكل</option>`]
      .concat(
        normalized.map(
          (entry) =>
            `<option value="${escapeHtml(entry.value)}" ${entry.value === current ? "selected" : ""}>${escapeHtml(entry.label)}</option>`
        )
      )
      .join("");
  }

  function formatMonthKeyV2(value) {
    const raw = String(value || "");
    if (!/^\d{4}-\d{2}$/.test(raw)) return raw || "--";
    const date = new Date(`${raw}-01T00:00:00`);
    return new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(date);
  }

function renderProductionRecordsV2(rows) {
    if (!rows || !rows.length) {
      return `<tr><td colspan="11" class="empty-state">لا توجد سجلات مطابقة</td></tr>`;
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
            <td>${escapeHtml(formatNumber(row.dozens || 0))}</td>
            <td>${escapeHtml(formatNumber(row.quantity || 0))}</td>
            <td>${escapeHtml(row.destination || "--")}</td>
          </tr>
        `
      )
      .join("");
  }

  function setActiveProductionSourceTab() {
    if (!ui.productionSourceButtons) return;
    ui.productionSourceButtons.forEach((button) => {
      button.classList.toggle("active", (button.dataset.productionSource || "") === (state.productionSourceTab || ""));
    });
  }

  function renderProductionChartsV2(payload) {
    destroyProductionCharts();
    if (!window.Chart) return;

    state.charts.productionDaily = new window.Chart(ui.productionDailyChart, {
      type: "line",
      data: {
        labels: (payload.monthlyDozens || []).map((row) => formatMonthKeyV2(row.label)),
        datasets: [
          {
            label: "الدستة",
            data: (payload.monthlyDozens || []).map((row) => row.total),
            borderColor: "#0d4f8b",
            backgroundColor: "rgba(13, 79, 139, 0.15)",
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: chartOptions()
    });

    state.charts.productionSource = new window.Chart(ui.productionSourceChart, {
      type: "doughnut",
      data: {
        labels: (payload.topDestinations || []).map((row) => row.label),
        datasets: [
          {
            data: (payload.topDestinations || []).map((row) => row.total),
            backgroundColor: ["#0d4f8b", "#1b8c7a", "#a64c28", "#d18a1d", "#6d3ea8", "#e06292"]
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
            label: "الدستة",
            data: (payload.topLines || []).map((row) => row.total),
            backgroundColor: "#a64c28",
            borderRadius: 10
          }
        ]
      },
      options: chartOptions({ indexAxis: "y" })
    });
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

function renderScoreList(rows, suffix, formatterFn) {
    if (!rows || !rows.length) {
      return emptyInline("لا توجد بيانات");
    }

    const formatter = typeof formatterFn === "function" ? formatterFn : formatNumber;

    return rows
      .map(
        (row) => `
          <article class="list-item">
            <div>
              <strong>${escapeHtml(row.label || row.rep || "--")}</strong>
              <small>${escapeHtml(suffix)}</small>
            </div>
            <span class="pill pill-accent">${escapeHtml(formatter(row.total || 0))}</span>
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
      throw new Error(extractApiErrorMessage(response, data, text));
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
      rep_code: entry.rep_code || "",
      category: entry.category || "",
      category1: entry.category1 || "",
      category2: entry.category2 || "",
      category3: entry.category3 || "",
      category4: entry.category4 || "",
      category5: entry.category5 || "",
      sector: entry.sector || "",
      sector_code: entry.sector_code || "",
      area: entry.area || "",
      area_code: entry.area_code || "",
      branch_code: entry.branch_code || "",
      address: entry.address || "",
      phone: entry.phone || "",
      mobile: entry.mobile || "",
      fax: entry.fax || "",
      email: entry.email || "",
      customer_type: entry.customer_type || "",
      discount: entry.discount || "",
      credit_limit: entry.credit_limit || "",
      receivables_credit_limit: entry.receivables_credit_limit || "",
      bounced_receivables_count: entry.bounced_receivables_count || "",
      credit_limit_exceeded: entry.credit_limit_exceeded || "",
      max_open_invoices: entry.max_open_invoices || "",
      terms_credit: entry.terms_credit || "",
      receivables_terms: entry.receivables_terms || "",
      parent_customer_code: entry.parent_customer_code || "",
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
      variants: Array.isArray(entry.variants) ? entry.variants.map(normalizeVariant) : [],
      is_active: entry.is_active !== false
    };
  }

  function normalizeVariant(entry) {
    return {
      color: entry.color || "",
      size: entry.size || "",
      unit: entry.unit || ""
    };
  }

  function normalizeUser(entry) {
    return {
      id: entry.id || "",
      email: entry.email || "",
      full_name: entry.full_name || "",
      is_active: entry.is_active !== false,
      created_at: entry.created_at || ""
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

  function formatRoundedNumber(value) {
    return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)));
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
      return null;
    }
  }

  function isLikelyHtml(text) {
    if (!text) return false;
    const sample = String(text).trim().slice(0, 200).toLowerCase();
    return (
      sample.startsWith("<!doctype html") ||
      sample.startsWith("<html") ||
      sample.includes("<head") ||
      sample.includes("<body")
    );
  }

  function extractApiErrorMessage(response, data, text) {
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return "الخدمة غير متاحة حاليًا من الخادم. حاول مرة أخرى بعد قليل.";
    }

    const message = data && typeof data.message === "string" ? data.message.trim() : "";
    if (message && !isLikelyHtml(message)) {
      return message;
    }

    if (isLikelyHtml(text)) {
      return "الخادم أعاد صفحة خطأ غير متوقعة. حاول مرة أخرى بعد قليل.";
    }

    return "حدث خطأ في الطلب.";
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
