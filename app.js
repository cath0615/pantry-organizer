const DB_NAME = "pantry-organizer";
const DB_VERSION = 3;
const STORE_NAME = "items";
const RECIPES_STORE_NAME = "recipes";
const RECIPE_QUEUE_STORE_NAME = "recipe-confirm-queue";
const DEFAULT_CATEGORIES = ["调料", "干货", "速食", "零食", "冷藏", "冷冻", "罐头", "烘焙", "饮品", "其他"];
const DEFAULT_LOCATIONS = ["方便面柜", "零食柜", "工具柜", "烘焙柜", "储物柜", "调料柜", "冰箱"];
const QUANTITY_UNITS = "瓶|包|袋|罐|盒|个|斤|克|g|kg|ml|l|升|毫升|板|条|片|块|枚|根|支|箱|组|套|杯";
const STORAGE_KEY = "pantry-organizer-fallback";
const CATEGORIES_KEY = "pantry-organizer-categories";
const LOCATIONS_KEY = "pantry-organizer-locations";
const MEAL_PLANNER_KEY = "pantry-organizer-meal-planner";
const RECIPES_KEY = "pantry-organizer-recipes";
const RECIPE_QUEUE_KEY = "pantry-organizer-recipe-confirm-queue";
const PLANNED_RECIPES_KEY = "pantry-organizer-planned-recipes";
const SYNC_SETTINGS_KEY = "pantry-organizer-github-sync";
const DEFAULT_SYNC_OWNER = "cath0615";
const DEFAULT_SYNC_REPO = "pantry-organizer-data";
const DEFAULT_SYNC_BRANCH = "main";
const DEFAULT_SYNC_PATH = "pantry-data.json";
const SYNC_TARGETS = {
  all: { label: "全部", file: null },
  pantry: { label: "库存", file: "pantry-items.json" },
  meal: { label: "Meal Plan", file: "meal-plan.json" },
  recipes: { label: "Recipes", file: "recipes-data.json" }
};
const CUSTOM_CATEGORY_VALUE = "__custom_category__";
const BACKUP_CHUNK_SIZE = 180000;
const CHUNK_PREFIX = "PANTRY_BACKUP_PART";
const QUANTITY_PHRASE = `(?:数量|数目|有)?\\s*[一二两三四五六七八九十百\\d]+(?:\\.\\d+)?\\s*(?:${QUANTITY_UNITS})`;
const WEEK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const FRIDGE_STORAGE_TYPES = [
  { id: "chilled", label: "冷藏" },
  { id: "frozen", label: "冷冻" }
];
const FRIDGE_CATEGORIES = ["蔬菜", "水果", "奶制品", "蛋/豆制品", "肉/海鲜", "其他"];
const DEFAULT_SHOPPING_CATEGORY = "未分类";
const MEAL_SLOTS = [
  { id: "breakfast", label: "早饭" },
  { id: "lunch", label: "中饭" },
  { id: "dinner", label: "晚饭" }
];
const RECIPE_TAG_RULES = [
  { tag: "低卡", pattern: /低卡|低脂|低糖|无糖|0糖|零糖|无油|0油|少油|减脂|减肥|轻食|高蛋白|生酮|控糖/i },
  { tag: "甜品", pattern: /甜品|甜点|蛋糕|布丁|慕斯|毛巾卷|米糕|发糕|年糕|糕点|麻薯|糯米糍|司康|曲奇|饼干|派|挞|提拉米苏|奶冻|雪媚娘|千层|巴斯克|芝士蛋糕|可丽饼|松饼|舒芙蕾/i },
  { tag: "面包", pattern: /面包|吐司|贝果|欧包|餐包|佛卡夏|碱水|可颂|牛角包|法棍|sourdough|bagel/i },
  { tag: "鸡肉", pattern: /鸡肉|鸡腿|鸡胸|鸡翅|鸡爪|鸡丁|鸡排|鸡块|鸡柳|鸡胗|鸡肝|整鸡|半鸡|chicken/i },
  { tag: "牛肉", pattern: /牛肉|牛腩|牛排|牛仔骨|肥牛|牛肋|牛舌|牛尾|牛柳|牛丸|牛筋|牛百叶|牛杂|beef|short ribs?/i },
  { tag: "海鲜", pattern: /鱼(?!香)|虾|蟹|螃蟹|扇贝|干贝|贝柱|蛤蜊|花蛤|青口|贻贝|生蚝|牡蛎|鱿鱼|章鱼|墨鱼|鳕鱼|三文鱼|salmon|tuna|cod|shrimp|prawn|crab|scallop|seafood/i }
];

const state = {
  items: [],
  drafts: [],
  categories: [...DEFAULT_CATEGORIES],
  locations: [...DEFAULT_LOCATIONS],
  status: "all",
  category: "all",
  location: "all",
  sort: "expiryAsc",
  query: "",
  db: null,
  fallback: false,
  recognition: null,
  listening: false,
  pendingPhotoTasks: new Set(),
  backupChunks: [],
  activeChunkIndex: 0,
  fullBackupText: "",
  activeMealDay: WEEK_DAYS[0],
  activeFridgeStorage: FRIDGE_STORAGE_TYPES[0].id,
  activeFridgeCategory: FRIDGE_CATEGORIES[0],
  recipes: [],
  recipeQuery: "",
  recipeTag: "all",
  recipeSort: "updatedDesc",
  recipeView: "library",
  recipeConfirmQueue: [],
  recipeConfirmTotal: 0,
  currentRecipeDraft: null,
  currentRecipeSourceText: "",
  currentRecipeImageOptions: [],
  currentRecipePhotos: [],
  recipeDialogSnapshot: "",
  plannedRecipes: [],
  activeTab: "pantry",
  mealPlanner: {
    meals: {},
    fridge: "",
    fridgeSections: {},
    fridgeStorage: {},
    ideas: "",
    shopping: "",
    shoppingItems: [],
    shoppingCategories: [DEFAULT_SHOPPING_CATEGORY]
  }
};

const $ = (id) => document.getElementById(id);
const on = (element, eventName, handler) => {
  if (element) element.addEventListener(eventName, handler);
};

const els = {
  quickInput: $("quickInput"),
  parseButton: $("parseButton"),
  clearInputButton: $("clearInputButton"),
  voiceButton: $("voiceButton"),
  voiceLabel: $("voiceLabel"),
  appTabs: $("appTabs"),
  draftPanel: $("draftPanel"),
  draftList: $("draftList"),
  saveDraftButton: $("saveDraftButton"),
  discardDraftButton: $("discardDraftButton"),
  itemList: $("itemList"),
  emptyState: $("emptyState"),
  searchInput: $("searchInput"),
  statusFilter: $("statusFilter"),
  categoryFilter: $("categoryFilter"),
  locationFilter: $("locationFilter"),
  sortSelect: $("sortSelect"),
  mealDayTabs: $("mealDayTabs"),
  mealGrid: $("mealGrid"),
  fridgeStorageTabs: $("fridgeStorageTabs"),
  fridgeCategoryTabs: $("fridgeCategoryTabs"),
  fridgeNote: $("fridgeNote"),
  mealIdeasNote: $("mealIdeasNote"),
  shoppingCategoryInput: $("shoppingCategoryInput"),
  shoppingCategoryOptions: $("shoppingCategoryOptions"),
  shoppingItemInput: $("shoppingItemInput"),
  addShoppingItemButton: $("addShoppingItemButton"),
  shoppingReminderList: $("shoppingReminderList"),
  shoppingReminderEmpty: $("shoppingReminderEmpty"),
  clearMealPlanButton: $("clearMealPlanButton"),
  clearMealIdeasButton: $("clearMealIdeasButton"),
  clearShoppingNoteButton: $("clearShoppingNoteButton"),
  recipeLinkInput: $("recipeLinkInput"),
  recipeSubTabs: $("recipeSubTabs"),
  saveRecipeLinkButton: $("saveRecipeLinkButton"),
  clearRecipeLinkButton: $("clearRecipeLinkButton"),
  likedRecipeLimit: $("likedRecipeLimit"),
  fetchLikedRecipesButton: $("fetchLikedRecipesButton"),
  resumeRecipeConfirmButton: $("resumeRecipeConfirmButton"),
  addRecipeButton: $("addRecipeButton"),
  recipeSearchInput: $("recipeSearchInput"),
  recipeTagFilter: $("recipeTagFilter"),
  recipeSortSelect: $("recipeSortSelect"),
  exportRecipesButton: $("exportRecipesButton"),
  importRecipesInput: $("importRecipesInput"),
  recipeList: $("recipeList"),
  recipeEmptyState: $("recipeEmptyState"),
  recipeCount: $("recipeCount"),
  plannedRecipesView: $("plannedRecipesView"),
  plannedRecipeList: $("plannedRecipeList"),
  plannedRecipeEmptyState: $("plannedRecipeEmptyState"),
  plannedRecipeCount: $("plannedRecipeCount"),
  recipeDialog: $("recipeDialog"),
  recipeForm: $("recipeForm"),
  recipeDialogTitle: $("recipeDialogTitle"),
  recipeId: $("recipeId"),
  recipeCoverData: $("recipeCoverData"),
  recipeCoverInput: $("recipeCoverInput"),
  recipeCoverPreview: $("recipeCoverPreview"),
  recipeCoverPreviewImage: $("recipeCoverPreviewImage"),
  removeRecipeCoverButton: $("removeRecipeCoverButton"),
  recipePhotoInput: $("recipePhotoInput"),
  recipePhotoGallery: $("recipePhotoGallery"),
  recipeImageViewer: $("recipeImageViewer"),
  recipeImageViewerImage: $("recipeImageViewerImage"),
  recipeTitle: $("recipeTitle"),
  recipeUrl: $("recipeUrl"),
  recipeTags: $("recipeTags"),
  recipeCategoryInput: $("recipeCategoryInput"),
  recipeCategoryOptions: $("recipeCategoryOptions"),
  addRecipeCategoryButton: $("addRecipeCategoryButton"),
  recipeSelectedTags: $("recipeSelectedTags"),
  recipeIngredients: $("recipeIngredients"),
  recipeSteps: $("recipeSteps"),
  recipeNotes: $("recipeNotes"),
  deleteRecipeButton: $("deleteRecipeButton"),
  closeRecipeDialogButton: $("closeRecipeDialogButton"),
  totalCount: $("totalCount"),
  soonCount: $("soonCount"),
  expiredCount: $("expiredCount"),
  addBlankButton: $("addBlankButton"),
  itemDialog: $("itemDialog"),
  itemForm: $("itemForm"),
  dialogTitle: $("dialogTitle"),
  itemId: $("itemId"),
  itemPhotoData: $("itemPhotoData"),
  itemPhotoInput: $("itemPhotoInput"),
  photoPreview: $("photoPreview"),
  photoPreviewImage: $("photoPreviewImage"),
  removePhotoButton: $("removePhotoButton"),
  itemName: $("itemName"),
  itemCategory: $("itemCategory"),
  itemCustomCategory: $("itemCustomCategory"),
  itemExpireDate: $("itemExpireDate"),
  itemQuantity: $("itemQuantity"),
  itemUnit: $("itemUnit"),
  itemLocation: $("itemLocation"),
  itemNotes: $("itemNotes"),
  itemOpened: $("itemOpened"),
  deleteItemButton: $("deleteItemButton"),
  closeItemDialogButton: $("closeItemDialogButton"),
  backupButton: $("backupButton"),
  backupDialog: $("backupDialog"),
  exportJsonButton: $("exportJsonButton"),
  downloadBackupButton: $("downloadBackupButton"),
  importTextButton: $("importTextButton"),
  backupStatus: $("backupStatus"),
  githubOwner: $("githubOwner"),
  githubRepo: $("githubRepo"),
  githubBranch: $("githubBranch"),
  githubPath: $("githubPath"),
  githubToken: $("githubToken"),
  saveSyncSettingsButton: $("saveSyncSettingsButton"),
  syncUploadCurrentButton: $("syncUploadCurrentButton"),
  syncDownloadCurrentButton: $("syncDownloadCurrentButton"),
  syncUploadButton: $("syncUploadButton"),
  syncDownloadButton: $("syncDownloadButton"),
  syncStatus: $("syncStatus"),
  toast: $("toast")
};

init();

async function init() {
  loadCategories();
  loadLocations();
  loadSyncSettings();
  renderMealPlanner();
  loadMealPlanner();
  loadPlannedRecipes();
  bindEvents();
  setupSpeech();
  setupServiceWorker();
  await initStorage();
  await loadRecipes();
  await loadRecipeConfirmQueue();
  await loadItems();
  syncCategoriesFromItems();
  syncLocationsFromItems();
  refreshCategoryControls();
  refreshLocationControls();
  render();
  renderRecipes();
}

function bindEvents() {
  on(els.parseButton, "click", handleParse);
  on(els.clearInputButton, "click", () => {
    els.quickInput.value = "";
    els.quickInput.focus();
  });
  on(els.saveDraftButton, "click", saveDrafts);
  on(els.discardDraftButton, "click", clearDrafts);
  on(els.appTabs, "click", switchTab);
  on(els.searchInput, "input", () => {
    state.query = els.searchInput.value.trim().toLowerCase();
    render();
  });
  on(els.statusFilter, "click", (event) => {
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    state.status = button.dataset.status;
    render();
  });
  on(els.categoryFilter, "change", () => {
    state.category = els.categoryFilter.value;
    render();
  });
  on(els.locationFilter, "change", () => {
    state.location = els.locationFilter.value;
    render();
  });
  on(els.sortSelect, "change", () => {
    state.sort = els.sortSelect.value;
    render();
  });
  on(els.mealDayTabs, "click", switchMealDay);
  on(els.mealGrid, "input", saveMealPlanner);
  on(els.fridgeStorageTabs, "click", switchFridgeStorage);
  on(els.fridgeCategoryTabs, "click", switchFridgeCategory);
  on(els.fridgeNote, "input", saveFridgeNote);
  on(els.mealIdeasNote, "input", saveMealPlanner);
  on(els.addShoppingItemButton, "click", addShoppingReminder);
  on(els.shoppingItemInput, "keydown", handleShoppingReminderInput);
  on(els.shoppingReminderList, "change", handleShoppingReminderChange);
  on(els.shoppingReminderList, "focusout", handleShoppingCategoryBlur);
  on(els.shoppingReminderList, "keydown", handleShoppingCategoryKeydown);
  on(els.shoppingReminderList, "click", removeShoppingReminder);
  on(els.clearMealPlanButton, "click", clearMealPlan);
  on(els.clearMealIdeasButton, "click", clearMealIdeas);
  on(els.clearShoppingNoteButton, "click", clearShoppingNote);
  on(els.saveRecipeLinkButton, "click", saveRecipeFromLinkInput);
  on(els.fetchLikedRecipesButton, "click", fetchLikedRecipes);
  on(els.resumeRecipeConfirmButton, "click", resumeRecipeConfirmQueue);
  on(els.recipeSubTabs, "click", switchRecipeView);
  on(els.clearRecipeLinkButton, "click", clearRecipeLinkInput);
  on(els.addRecipeButton, "click", () => openRecipeDialog());
  on(els.recipeSearchInput, "input", () => {
    state.recipeQuery = els.recipeSearchInput.value.trim().toLowerCase();
    renderRecipes();
  });
  on(els.recipeTagFilter, "change", () => {
    state.recipeTag = els.recipeTagFilter.value;
    renderRecipes();
  });
  on(els.recipeSortSelect, "change", () => {
    state.recipeSort = els.recipeSortSelect.value;
    renderRecipes();
  });
  on(els.exportRecipesButton, "click", exportRecipes);
  on(els.importRecipesInput, "change", importRecipes);
  on(els.recipeForm, "submit", handleRecipeSubmit);
  on(els.recipeDialog, "cancel", handleRecipeDialogCancel);
  on(els.recipeDialog, "click", handleRecipeDialogBackdropClick);
  on(els.recipeList, "click", handleRecipeListAction);
  on(els.plannedRecipeList, "click", handlePlannedRecipeAction);
  on(els.plannedRecipeList, "input", updatePlannedRecipeDetails);
  on(els.deleteRecipeButton, "click", deleteCurrentRecipe);
  on(els.closeRecipeDialogButton, "click", closeRecipeDialog);
  on(els.recipeCoverInput, "change", handleRecipeCoverInput);
  on(els.removeRecipeCoverButton, "click", removeCurrentRecipeCover);
  on(els.recipePhotoInput, "change", handleRecipePhotoInput);
  on(els.recipePhotoGallery, "click", removeRecipePhoto);
  on(els.recipePhotoGallery, "click", openRecipeImageFromGallery);
  on(els.recipeCoverPreviewImage, "click", () => openRecipeImageViewer(els.recipeCoverPreviewImage?.src));
  on(els.addRecipeCategoryButton, "click", addRecipeCategoryFromDialog);
  on(els.recipeCategoryInput, "keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addRecipeCategoryFromDialog();
  });
  on(els.recipeSelectedTags, "click", removeRecipeCategoryFromDialog);
  on(els.addBlankButton, "click", () => openItemDialog());
  on(els.itemForm, "submit", handleItemSubmit);
  on(els.itemDialog, "click", handleItemDialogBackdropClick);
  on(els.itemCategory, "change", () => updateCustomCategoryVisibility());
  on(els.deleteItemButton, "click", deleteCurrentItem);
  on(els.closeItemDialogButton, "click", () => els.itemDialog.close());
  on(els.itemPhotoInput, "change", handlePhotoInput);
  on(els.removePhotoButton, "click", removeCurrentPhoto);
  on(els.backupButton, "click", () => {
    openBackupDialog();
  });
  on(els.exportJsonButton, "click", exportJson);
  on(els.downloadBackupButton, "click", downloadBackupText);
  on(els.importTextButton, "click", importJsonFromTextArea);
  on(els.saveSyncSettingsButton, "click", saveSyncSettingsFromForm);
  on(els.syncUploadCurrentButton, "click", () => uploadGithubSync(currentSyncTarget()));
  on(els.syncDownloadCurrentButton, "click", () => downloadGithubSync(currentSyncTarget()));
  on(els.syncUploadButton, "click", () => uploadGithubSync("all"));
  on(els.syncDownloadButton, "click", () => downloadGithubSync("all"));
  on(els.voiceButton, "click", toggleSpeech);
}

function switchTab(event) {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  const activeTab = button.dataset.tab;
  state.activeTab = activeTab;
  for (const tabButton of els.appTabs.querySelectorAll("button[data-tab]")) {
    const isActive = tabButton.dataset.tab === activeTab;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  }
  for (const panel of document.querySelectorAll("[data-tab-panel]")) {
    panel.classList.toggle("is-active", panel.dataset.tabPanel === activeTab);
  }
  updateCurrentSyncHint();
}

function renderMealPlanner() {
  if (!els.mealGrid) return;
  renderMealDayTabs();
  els.mealGrid.replaceChildren();

  for (const day of WEEK_DAYS) {
    const card = document.createElement("article");
    card.className = "meal-day-card";
    card.dataset.day = day;
    card.classList.toggle("is-active", day === state.activeMealDay);

    const title = document.createElement("h3");
    title.textContent = day;
    card.append(title);

    const slots = document.createElement("div");
    slots.className = "meal-slots";

    for (const meal of MEAL_SLOTS) {
      const label = document.createElement("label");
      label.className = "meal-slot";
      label.textContent = meal.label;

      const textarea = document.createElement("textarea");
      textarea.className = "meal-input";
      textarea.rows = 2;
      textarea.dataset.day = day;
      textarea.dataset.meal = meal.id;
      textarea.placeholder = "未定";

      label.append(textarea);
      slots.append(label);
    }

    card.append(slots);
    els.mealGrid.append(card);
  }
}

function renderMealDayTabs() {
  if (!els.mealDayTabs) return;
  els.mealDayTabs.replaceChildren();
  for (const day of WEEK_DAYS) {
    const button = document.createElement("button");
    const isActive = day === state.activeMealDay;
    button.type = "button";
    button.role = "tab";
    button.dataset.day = day;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.textContent = day;
    els.mealDayTabs.append(button);
  }
}

function switchMealDay(event) {
  const button = event.target.closest("button[data-day]");
  if (!button) return;
  state.activeMealDay = button.dataset.day;
  switchMealDayTo(state.activeMealDay);
}

function loadMealPlanner() {
  if (!els.mealGrid) return;
  try {
    const saved = JSON.parse(localStorage.getItem(MEAL_PLANNER_KEY) || "{}");
    const shoppingItems = normalizeShoppingReminders(saved.shoppingItems, saved.shopping);
    const fridgeStorage = normalizeFridgeStorage(saved.fridgeStorage, saved.fridgeSections, saved.fridge);
    state.mealPlanner = {
      meals: saved.meals || {},
      fridge: fridgeSectionText(fridgeStorage.chilled),
      fridgeSections: fridgeStorage.chilled,
      fridgeStorage,
      ideas: saved.ideas || "",
      shopping: shoppingReminderText(shoppingItems),
      shoppingItems,
      shoppingCategories: normalizeShoppingCategories(saved.shoppingCategories, shoppingItems)
    };
  } catch {
    state.mealPlanner = {
      meals: {},
      fridge: "",
      fridgeSections: normalizeFridgeSections(),
      fridgeStorage: normalizeFridgeStorage(),
      ideas: "",
      shopping: "",
      shoppingItems: [],
      shoppingCategories: [DEFAULT_SHOPPING_CATEGORY]
    };
  }

  for (const input of els.mealGrid.querySelectorAll(".meal-input")) {
    const key = mealKey(input.dataset.day, input.dataset.meal);
    input.value = state.mealPlanner.meals[key] || "";
  }
  renderFridgeControls();
  if (els.mealIdeasNote) els.mealIdeasNote.value = state.mealPlanner.ideas;
  renderShoppingCategories();
  renderShoppingReminders();
}

function saveMealPlanner() {
  if (!els.mealGrid) return;
  const meals = {};
  for (const input of els.mealGrid.querySelectorAll(".meal-input")) {
    const value = input.value.trim();
    if (!value) continue;
    meals[mealKey(input.dataset.day, input.dataset.meal)] = value;
  }
  state.mealPlanner = {
    meals,
    fridge: fridgeSectionText(state.mealPlanner.fridgeStorage.chilled),
    fridgeSections: state.mealPlanner.fridgeStorage.chilled,
    fridgeStorage: state.mealPlanner.fridgeStorage,
    ideas: els.mealIdeasNote?.value || "",
    shopping: shoppingReminderText(state.mealPlanner.shoppingItems),
    shoppingItems: state.mealPlanner.shoppingItems,
    shoppingCategories: state.mealPlanner.shoppingCategories
  };
  localStorage.setItem(MEAL_PLANNER_KEY, JSON.stringify(state.mealPlanner));
}

function clearMealPlan() {
  if (!els.mealGrid) return;
  for (const input of els.mealGrid.querySelectorAll(".meal-input")) input.value = "";
  saveMealPlanner();
  showToast("已清空计划");
}

function clearMealIdeas() {
  if (els.mealIdeasNote) els.mealIdeasNote.value = "";
  saveMealPlanner();
  showToast("已清空想吃");
}

function clearShoppingNote() {
  state.mealPlanner.shoppingItems = [];
  if (els.shoppingItemInput) els.shoppingItemInput.value = "";
  saveMealPlanner();
  renderShoppingReminders();
  showToast("已清空要买");
}

function normalizeFridgeSections(sections, legacyText = "") {
  const normalized = Object.fromEntries(FRIDGE_CATEGORIES.map((category) => [category, ""]));
  if (sections && typeof sections === "object" && !Array.isArray(sections)) {
    for (const category of FRIDGE_CATEGORIES) normalized[category] = String(sections[category] || "");
  } else if (legacyText) {
    normalized["其他"] = String(legacyText);
  }
  return normalized;
}

function normalizeFridgeStorage(storage, legacySections, legacyText = "") {
  const hasStorage = storage && typeof storage === "object" && !Array.isArray(storage);
  return {
    chilled: hasStorage && storage.chilled
      ? normalizeFridgeSections(storage.chilled)
      : normalizeFridgeSections(legacySections, legacyText),
    frozen: hasStorage && storage.frozen ? normalizeFridgeSections(storage.frozen) : normalizeFridgeSections()
  };
}

function fridgeSectionText(sections = {}) {
  return FRIDGE_CATEGORIES
    .filter((category) => String(sections[category] || "").trim())
    .map((category) => `${category}：\n${String(sections[category]).trim()}`)
    .join("\n\n");
}

function saveFridgeNote() {
  state.mealPlanner.fridgeStorage[state.activeFridgeStorage][state.activeFridgeCategory] = els.fridgeNote?.value || "";
  saveMealPlanner();
}

function switchFridgeStorage(event) {
  const button = event.target.closest("button[data-fridge-storage]");
  if (!button) return;
  state.activeFridgeStorage = button.dataset.fridgeStorage;
  renderFridgeControls();
}

function switchFridgeCategory(event) {
  const button = event.target.closest("button[data-fridge-category]");
  if (!button) return;
  state.activeFridgeCategory = button.dataset.fridgeCategory;
  renderFridgeControls();
}

function renderFridgeControls() {
  if (!els.fridgeStorageTabs || !els.fridgeCategoryTabs || !els.fridgeNote) return;
  if (!FRIDGE_STORAGE_TYPES.some((type) => type.id === state.activeFridgeStorage)) {
    state.activeFridgeStorage = FRIDGE_STORAGE_TYPES[0].id;
  }
  if (!FRIDGE_CATEGORIES.includes(state.activeFridgeCategory)) state.activeFridgeCategory = FRIDGE_CATEGORIES[0];

  els.fridgeStorageTabs.replaceChildren();
  for (const storageType of FRIDGE_STORAGE_TYPES) {
    const button = document.createElement("button");
    const isActive = storageType.id === state.activeFridgeStorage;
    button.type = "button";
    button.dataset.fridgeStorage = storageType.id;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(isActive));
    button.textContent = storageType.label;
    els.fridgeStorageTabs.append(button);
  }

  els.fridgeCategoryTabs.replaceChildren();
  for (const category of FRIDGE_CATEGORIES) {
    const button = document.createElement("button");
    const isActive = category === state.activeFridgeCategory;
    button.type = "button";
    button.dataset.fridgeCategory = category;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(isActive));
    button.textContent = category;
    els.fridgeCategoryTabs.append(button);
  }
  const sections = state.mealPlanner.fridgeStorage[state.activeFridgeStorage];
  const storageLabel = FRIDGE_STORAGE_TYPES.find((type) => type.id === state.activeFridgeStorage)?.label || "冷藏";
  els.fridgeNote.value = sections[state.activeFridgeCategory] || "";
  els.fridgeNote.setAttribute("aria-label", `${storageLabel}快用：${state.activeFridgeCategory}`);
}

function normalizeShoppingReminders(items, legacyText = "") {
  const source = Array.isArray(items)
    ? items
    : String(legacyText || "").split(/\r?\n/).map((text) => ({ text, done: false }));
  return source
    .map((item) => (typeof item === "string" ? { text: item, done: false } : item))
    .map((item) => ({
      id: item.id || createId(),
      text: String(item.text || "").trim(),
      done: Boolean(item.done),
      category: String(item.category || DEFAULT_SHOPPING_CATEGORY).trim() || DEFAULT_SHOPPING_CATEGORY
    }))
    .filter((item) => item.text);
}

function normalizeShoppingCategories(categories, items = []) {
  return [...new Set([
    DEFAULT_SHOPPING_CATEGORY,
    ...(Array.isArray(categories) ? categories : []),
    ...items.map((item) => item.category)
  ].map((category) => String(category || "").trim()).filter(Boolean))];
}

function shoppingReminderText(items = []) {
  return items.map((item) => item.text).join("\n");
}

function addShoppingReminder() {
  const text = els.shoppingItemInput?.value.trim() || "";
  if (!text) return;
  const category = els.shoppingCategoryInput?.value.trim() || DEFAULT_SHOPPING_CATEGORY;
  state.mealPlanner.shoppingCategories = normalizeShoppingCategories(
    [...state.mealPlanner.shoppingCategories, category],
    state.mealPlanner.shoppingItems
  );
  state.mealPlanner.shoppingItems.push({ id: createId(), text, done: false, category });
  els.shoppingItemInput.value = "";
  saveMealPlanner();
  renderShoppingCategories();
  renderShoppingReminders();
  els.shoppingItemInput.focus();
}

function handleShoppingReminderInput(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addShoppingReminder();
}

function handleShoppingReminderChange(event) {
  const input = event.target.closest("input[data-shopping-reminder-id]");
  if (input) {
    const item = state.mealPlanner.shoppingItems.find((entry) => entry.id === input.dataset.shoppingReminderId);
    if (!item) return;
    item.done = input.checked;
    saveMealPlanner();
    renderShoppingReminders();
    return;
  }

  const categoryInput = event.target.closest("input[data-shopping-category-id]");
  if (categoryInput) {
    changeShoppingReminderCategory(categoryInput.dataset.shoppingCategoryId, categoryInput.value);
    return;
  }

  const fridgeSelect = event.target.closest("select[data-shopping-fridge-id]");
  if (fridgeSelect?.value) moveShoppingReminderToFridge(fridgeSelect.dataset.shoppingFridgeId, fridgeSelect.value);
}

function handleShoppingCategoryBlur(event) {
  const input = event.target.closest("input[data-shopping-category-id]");
  if (input) changeShoppingReminderCategory(input.dataset.shoppingCategoryId, input.value);
}

function handleShoppingCategoryKeydown(event) {
  const input = event.target.closest("input[data-shopping-category-id]");
  if (!input || event.key !== "Enter") return;
  event.preventDefault();
  changeShoppingReminderCategory(input.dataset.shoppingCategoryId, input.value);
}

function changeShoppingReminderCategory(itemId, nextCategory) {
  const item = state.mealPlanner.shoppingItems.find((entry) => entry.id === itemId);
  const category = String(nextCategory || "").trim();
  if (!item || !category) {
    renderShoppingReminders();
    return;
  }
  item.category = category;
  state.mealPlanner.shoppingCategories = normalizeShoppingCategories(
    [...state.mealPlanner.shoppingCategories, category],
    state.mealPlanner.shoppingItems
  );
  saveMealPlanner();
  renderShoppingCategories();
  renderShoppingReminders();
}

function moveShoppingReminderToFridge(itemId, targetValue) {
  const item = state.mealPlanner.shoppingItems.find((entry) => entry.id === itemId);
  const [storageId, fridgeCategory] = String(targetValue || "").split("::");
  const storageType = FRIDGE_STORAGE_TYPES.find((type) => type.id === storageId);
  if (!item || !storageType || !FRIDGE_CATEGORIES.includes(fridgeCategory)) return;
  const sections = state.mealPlanner.fridgeStorage[storageId];
  const currentText = sections[fridgeCategory] || "";
  const currentItems = currentText.split(/\r?\n/).map((text) => text.trim()).filter(Boolean);
  const isDuplicate = currentItems.includes(item.text);
  if (!isDuplicate) {
    sections[fridgeCategory] = [currentText.trimEnd(), item.text].filter(Boolean).join("\n");
  }
  state.mealPlanner.shoppingItems = state.mealPlanner.shoppingItems.filter((entry) => entry.id !== itemId);
  saveMealPlanner();
  renderFridgeControls();
  renderShoppingReminders();
  showToast(isDuplicate
    ? `${item.text} 已在${storageType.label}快用，已从购物清单移除`
    : `${item.text} 已移到${storageType.label} · ${fridgeCategory}`);
}

function removeShoppingReminder(event) {
  const button = event.target.closest("button[data-shopping-reminder-id]");
  if (!button) return;
  state.mealPlanner.shoppingItems = state.mealPlanner.shoppingItems
    .filter((item) => item.id !== button.dataset.shoppingReminderId);
  saveMealPlanner();
  renderShoppingReminders();
}

function renderShoppingReminders() {
  if (!els.shoppingReminderList) return;
  els.shoppingReminderList.replaceChildren();
  const categories = normalizeShoppingCategories(state.mealPlanner.shoppingCategories, state.mealPlanner.shoppingItems);
  for (const category of categories) {
    const items = state.mealPlanner.shoppingItems.filter((item) => item.category === category);
    if (!items.length) continue;
    const group = document.createElement("section");
    group.className = "shopping-reminder-group";
    const heading = document.createElement("h3");
    heading.textContent = category;
    group.append(heading);
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "shopping-reminder-item";
      row.classList.toggle("is-done", item.done);

      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.done;
      checkbox.dataset.shoppingReminderId = item.id;
      const text = document.createElement("span");
      text.textContent = item.text;
      label.append(checkbox, text);

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "icon-button small";
      removeButton.dataset.shoppingReminderId = item.id;
      removeButton.setAttribute("aria-label", `移除 ${item.text}`);
      removeButton.textContent = "×";

      const actions = document.createElement("div");
      actions.className = "shopping-reminder-item-actions";

      const categoryInput = document.createElement("input");
      categoryInput.value = item.category;
      categoryInput.setAttribute("list", "shoppingCategoryOptions");
      categoryInput.dataset.shoppingCategoryId = item.id;
      categoryInput.setAttribute("aria-label", `修改 ${item.text} 的购物分类`);

      const fridgeSelect = document.createElement("select");
      fridgeSelect.dataset.shoppingFridgeId = item.id;
      fridgeSelect.setAttribute("aria-label", `将 ${item.text} 移到冷藏或冷冻快用`);
      fridgeSelect.append(new Option("移到冷藏/冷冻…", ""));
      for (const storageType of FRIDGE_STORAGE_TYPES) {
        const group = document.createElement("optgroup");
        group.label = storageType.label;
        for (const fridgeCategory of FRIDGE_CATEGORIES) {
          group.append(new Option(fridgeCategory, `${storageType.id}::${fridgeCategory}`));
        }
        fridgeSelect.append(group);
      }

      actions.append(categoryInput, fridgeSelect);
      row.append(label, removeButton, actions);
      group.append(row);
    }
    els.shoppingReminderList.append(group);
  }
  els.shoppingReminderEmpty?.classList.toggle("is-hidden", state.mealPlanner.shoppingItems.length > 0);
}

function renderShoppingCategories() {
  if (!els.shoppingCategoryOptions) return;
  els.shoppingCategoryOptions.replaceChildren();
  for (const category of state.mealPlanner.shoppingCategories) {
    const option = document.createElement("option");
    option.value = category;
    els.shoppingCategoryOptions.append(option);
  }
}

function mealKey(day, meal) {
  return `${day}:${meal}`;
}

async function loadRecipes() {
  if (!state.fallback && state.db?.objectStoreNames.contains(RECIPES_STORE_NAME)) {
    const saved = await storeRequestFor(RECIPES_STORE_NAME, "readonly", (store) => store.getAll());
    if (saved.length) {
      state.recipes = saved.map(normalizeRecipe).filter((recipe) => recipe.title);
      return;
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(RECIPES_KEY) || "[]");
    state.recipes = Array.isArray(saved) ? saved.map(normalizeRecipe).filter((recipe) => recipe.title) : [];
    if (state.recipes.length && !state.fallback && state.db?.objectStoreNames.contains(RECIPES_STORE_NAME)) {
      await saveRecipes();
      localStorage.removeItem(RECIPES_KEY);
    }
  } catch {
    state.recipes = [];
  }
}

async function saveRecipes() {
  try {
    if (!state.fallback && state.db?.objectStoreNames.contains(RECIPES_STORE_NAME)) {
      await storeRequestFor(RECIPES_STORE_NAME, "readwrite", (store) => {
        store.clear();
        for (const recipe of state.recipes) store.put(recipe);
      });
      return;
    }
    localStorage.setItem(RECIPES_KEY, JSON.stringify(state.recipes));
  } catch (error) {
    if (error?.name === "QuotaExceededError") showToast("手机本地空间不足，请删除旧备份或清理浏览器数据");
    else showToast("菜谱保存失败");
  }
}

function loadPlannedRecipes() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLANNED_RECIPES_KEY) || "[]");
    state.plannedRecipes = Array.isArray(saved) ? saved.map(normalizePlannedRecipe).filter((item) => item.recipeId) : [];
  } catch {
    state.plannedRecipes = [];
  }
}

function savePlannedRecipes() {
  localStorage.setItem(PLANNED_RECIPES_KEY, JSON.stringify(state.plannedRecipes));
}

function switchRecipeView(event) {
  const button = event.target.closest("button[data-recipe-view]");
  if (!button) return;
  state.recipeView = button.dataset.recipeView;
  for (const tabButton of els.recipeSubTabs.querySelectorAll("button[data-recipe-view]")) {
    const isActive = tabButton.dataset.recipeView === state.recipeView;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  }
  const showLibrary = state.recipeView === "library";
  for (const element of [document.querySelector(".recipe-capture"), document.querySelector(".recipe-toolbar"), document.querySelector(".recipes-section")]) {
    if (element) element.classList.toggle("is-hidden", !showLibrary);
  }
  els.plannedRecipesView?.classList.toggle("is-hidden", showLibrary);
  if (!showLibrary) renderPlannedRecipes();
}

async function saveRecipeFromLinkInput() {
  const text = els.recipeLinkInput.value.trim();
  if (!text) {
    showToast("先粘贴链接");
    return;
  }
  const urls = extractRecipeUrls(text);
  if (urls.length > 1) {
    await saveRecipeLinkBatch(text, urls);
    return;
  }
  const url = urls[0] || "";
  if (!url) {
    showToast("没有找到链接");
    return;
  }
  const existing = findRecipeByUrl(url);
  let preview = null;
  if (existing) {
    const refresh = window.confirm(`这个链接已经保存过：\n${existing.title}\n\n是否重新抓取并更新这条菜谱？`);
    if (refresh) {
      showToast("正在重新抓取并更新");
      preview = await fetchRecipePreview(url);
      if (!preview) return;
    }
  } else {
    showToast("正在抓取封面和步骤");
    preview = await fetchRecipePreview(url);
  }
  const draftTitle = existing?.title || preview?.title || extractRecipeTitle(text) || "未命名菜谱";
  const draftIngredients = preview ? preview.ingredients || "" : existing?.ingredients || "";
  const draftSteps = preview?.steps || existing?.steps || "";
  const draftSourceText = preview?.rawText || existing?.sourceText || text;
  openRecipeDialog({
    ...(existing || {}),
    id: existing?.id || "",
    title: draftTitle,
    url: preview?.finalUrl || existing?.url || url,
    tags: existing?.tags?.length ? existing.tags : inferRecipeTags({ title: draftTitle, ingredients: draftIngredients, steps: draftSteps, sourceText: draftSourceText }),
    ingredients: draftIngredients,
    steps: draftSteps,
    notes: existing?.notes || "",
    coverData: preview?.coverData || existing?.coverData || "",
    photos: existing?.photos || [],
    imageOptions: preview?.imageOptions || [],
    sourceText: draftSourceText
  });
  showToast(existing && preview ? "重新抓取完成，保存后会更新原菜谱" : existing ? "已打开已有菜谱" : "确认后保存");
}

async function fetchLikedRecipes() {
  const limit = Math.max(1, Math.min(Number(els.likedRecipeLimit?.value) || 10, 30));
  if (els.fetchLikedRecipesButton) els.fetchLikedRecipesButton.disabled = true;
  showToast(`正在读取点赞列表前 ${limit} 个`);
  try {
    const response = await fetch(getLikedRecipesEndpoint(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit })
    });
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.items) || !data.items.length) {
      showToast(data.error || "没有找到点赞帖子");
      return;
    }
    const urls = data.items.map((item) => item.url).filter(Boolean);
    showToast(`找到 ${urls.length} 个点赞帖子，开始逐个确认`);
    await saveRecipeLinkBatch(
      data.items.map((item) => `${item.title || ""} ${item.url}`).join("\n"),
      urls,
      { unlikeAfterSave: true }
    );
  } catch {
    showToast("读取点赞失败，请确认 npm start 和小红书登录状态");
  } finally {
    if (els.fetchLikedRecipesButton) els.fetchLikedRecipesButton.disabled = false;
  }
}

function getLikedRecipesEndpoint() {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return `${window.location.origin}/api/xhs-liked`;
  return "http://127.0.0.1:5173/api/xhs-liked";
}

function getXhsUnlikeEndpoint() {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return `${window.location.origin}/api/xhs-unlike`;
  return "http://127.0.0.1:5173/api/xhs-unlike";
}

async function unlikeXhsRecipe(url) {
  try {
    const response = await fetch(getXhsUnlikeEndpoint(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await response.json();
    return Boolean(response.ok && data.ok);
  } catch {
    return false;
  }
}

async function saveRecipeLinkBatch(text, urls, options = {}) {
  const drafts = [];
  let skipped = 0;
  let failed = 0;
  els.saveRecipeLinkButton.disabled = true;

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    let existing = findRecipeByUrl(url);
    if (existing) {
      const refresh = window.confirm(`第 ${index + 1}/${urls.length} 个链接已经保存过：\n${existing.title}\n\n是否重新抓取并更新？`);
      if (!refresh) {
        skipped += 1;
        continue;
      }
    }
    showToast(`${existing ? "正在重新抓取" : "正在抓"} 第 ${index + 1}/${urls.length} 个`);
    const preview = await fetchRecipePreview(url, { quiet: true });
    if (!preview) {
      failed += 1;
      continue;
    }
    const finalUrl = preview.finalUrl || url;
    const duplicate = findRecipeByUrl(finalUrl);
    if (duplicate && (!existing || duplicate.id !== existing.id)) {
      const refresh = window.confirm(`这个链接也匹配到已保存菜谱：\n${duplicate.title}\n\n是否更新它？`);
      if (!refresh) {
        skipped += 1;
        continue;
      }
      existing = duplicate;
    }
    const now = new Date().toISOString();
    const title = existing?.title || preview.title || extractRecipeTitle(text) || "未命名菜谱";
    const ingredients = preview.ingredients || "";
    const steps = preview.steps || "";
    const sourceText = preview.rawText || text;
    drafts.push({
      ...(existing || {}),
      id: existing?.id || "",
      title,
      url: finalUrl,
      tags: existing?.tags?.length ? existing.tags : inferRecipeTags({ title, ingredients, steps, sourceText }),
      ingredients,
      steps,
      notes: existing?.notes || "",
      coverData: preview.coverData || existing?.coverData || "",
      photos: existing?.photos || [],
      imageOptions: preview.imageOptions || [],
      sourceText,
      unlikeAfterSave: Boolean(options.unlikeAfterSave),
      createdAt: existing?.createdAt || now
    });
  }

  els.saveRecipeLinkButton.disabled = false;
  if (drafts.length) {
    clearRecipeLinkInput();
    await startRecipeConfirmQueue(drafts);
    showToast(`抓取完成：待确认 ${drafts.length}，重复 ${skipped}，失败 ${failed}`);
    return;
  }
  showToast(`批量完成：新增 0，重复 ${skipped}，失败 ${failed}`);
}

async function startRecipeConfirmQueue(drafts) {
  const pending = [...state.recipeConfirmQueue];
  const seen = new Set(pending.map((draft) => recipeUrlKey(draft.url)).filter(Boolean));
  const additions = drafts.filter((draft) => {
    const key = recipeUrlKey(draft.url);
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  });
  state.recipeConfirmQueue = [...pending, ...additions];
  state.recipeConfirmTotal = state.recipeConfirmQueue.length;
  state.currentRecipeDraft = null;
  await saveRecipeConfirmQueue();
  openNextRecipeDraft();
}

function openNextRecipeDraft() {
  const draft = state.recipeConfirmQueue.shift();
  if (!draft) {
    state.recipeConfirmTotal = 0;
    state.currentRecipeDraft = null;
    clearRecipeConfirmQueueStorage();
    updateResumeRecipeConfirmButton();
    return;
  }
  state.currentRecipeDraft = draft;
  const current = state.recipeConfirmTotal - state.recipeConfirmQueue.length;
  openRecipeDialog(draft, { title: `确认菜谱 ${current}/${state.recipeConfirmTotal}` });
  updateResumeRecipeConfirmButton();
}

async function closeRecipeDialog() {
  if (state.currentRecipeDraft) {
    await pauseRecipeConfirmQueue();
    return;
  }
  if (!confirmRecipeDialogClose()) return;
  state.recipeDialogSnapshot = "";
  els.recipeDialog.close();
}

function handleRecipeDialogBackdropClick(event) {
  if (event.target !== els.recipeDialog) return;
  if (state.currentRecipeDraft) {
    showToast("批量确认中，点右上角 × 可以暂停并保留进度");
    return;
  }
  closeRecipeDialog();
}

function handleRecipeDialogCancel(event) {
  if (state.currentRecipeDraft) {
    event.preventDefault();
    pauseRecipeConfirmQueue();
    return;
  }
  if (!confirmRecipeDialogClose()) {
    event.preventDefault();
    return;
  }
  state.recipeDialogSnapshot = "";
}

function handleItemDialogBackdropClick(event) {
  if (event.target === els.itemDialog) els.itemDialog.close();
}

function getRecipeDialogValues() {
  return JSON.stringify({
    title: els.recipeTitle?.value || "",
    url: els.recipeUrl?.value || "",
    tags: getRecipeDialogTags(),
    ingredients: els.recipeIngredients?.value || "",
    steps: els.recipeSteps?.value || "",
    notes: els.recipeNotes?.value || "",
    coverData: els.recipeCoverData?.value || "",
    coverFile: els.recipeCoverInput?.files?.[0]?.name || "",
    photos: state.currentRecipePhotos,
    selectedImageOptions: getSelectedRecipeImageOptions().map((item) => item.index)
  });
}

function confirmRecipeDialogClose() {
  if (!state.recipeDialogSnapshot || getRecipeDialogValues() === state.recipeDialogSnapshot) return true;
  return window.confirm("当前菜谱有未保存的修改，确定要退出吗？\n\n点击“取消”继续编辑，点击“确定”退出。");
}

function captureCurrentRecipeDraft() {
  if (!state.currentRecipeDraft) return null;
  return {
    ...state.currentRecipeDraft,
    id: els.recipeId.value || "",
    title: els.recipeTitle.value,
    url: els.recipeUrl.value,
    tags: getRecipeDialogTags(),
    ingredients: els.recipeIngredients?.value || "",
    steps: els.recipeSteps.value,
    notes: els.recipeNotes.value,
    coverData: els.recipeCoverData.value,
    photos: [...state.currentRecipePhotos],
    imageOptions: [...state.currentRecipeImageOptions],
    selectedImageOptions: getSelectedRecipeImageOptions().map((item) => item.index),
    sourceText: state.currentRecipeSourceText
  };
}

async function pauseRecipeConfirmQueue() {
  const current = captureCurrentRecipeDraft();
  if (current) state.recipeConfirmQueue.unshift(current);
  state.currentRecipeDraft = null;
  state.recipeDialogSnapshot = "";
  els.recipeDialog.close();
  await saveRecipeConfirmQueue();
  updateResumeRecipeConfirmButton();
  showToast(`已暂停，${state.recipeConfirmQueue.length} 个待确认菜谱已保留`);
}

function resumeRecipeConfirmQueue() {
  if (!state.recipeConfirmQueue.length || els.recipeDialog.open) return;
  openNextRecipeDraft();
}

async function loadRecipeConfirmQueue() {
  let record = null;
  try {
    if (!state.fallback && state.db?.objectStoreNames.contains(RECIPE_QUEUE_STORE_NAME)) {
      record = await storeRequestFor(RECIPE_QUEUE_STORE_NAME, "readonly", (store) => store.get("pending"));
    } else {
      record = JSON.parse(localStorage.getItem(RECIPE_QUEUE_KEY) || "null");
    }
  } catch {
    record = null;
  }
  const drafts = Array.isArray(record?.drafts) ? record.drafts : [];
  state.recipeConfirmQueue = drafts;
  state.recipeConfirmTotal = Math.max(Number(record?.total) || 0, drafts.length);
  state.currentRecipeDraft = null;
  updateResumeRecipeConfirmButton();
  if (drafts.length) showToast(`还有 ${drafts.length} 个菜谱待确认`);
}

async function saveRecipeConfirmQueue() {
  const drafts = [...state.recipeConfirmQueue];
  if (!drafts.length) {
    await clearRecipeConfirmQueueStorage();
    updateResumeRecipeConfirmButton();
    return;
  }
  const record = {
    id: "pending",
    drafts,
    total: Math.max(state.recipeConfirmTotal, drafts.length),
    updatedAt: new Date().toISOString()
  };
  try {
    if (!state.fallback && state.db?.objectStoreNames.contains(RECIPE_QUEUE_STORE_NAME)) {
      await storeRequestFor(RECIPE_QUEUE_STORE_NAME, "readwrite", (store) => store.put(record));
    } else {
      localStorage.setItem(RECIPE_QUEUE_KEY, JSON.stringify(record));
    }
  } catch {
    showToast("待确认菜谱暂存失败，请保持当前页面打开");
  }
  updateResumeRecipeConfirmButton();
}

async function clearRecipeConfirmQueueStorage() {
  try {
    if (!state.fallback && state.db?.objectStoreNames.contains(RECIPE_QUEUE_STORE_NAME)) {
      await storeRequestFor(RECIPE_QUEUE_STORE_NAME, "readwrite", (store) => store.delete("pending"));
    } else {
      localStorage.removeItem(RECIPE_QUEUE_KEY);
    }
  } catch {
    // A stale queue can be overwritten the next time a batch starts.
  }
}

function updateResumeRecipeConfirmButton() {
  if (!els.resumeRecipeConfirmButton) return;
  const pending = state.recipeConfirmQueue.length;
  els.resumeRecipeConfirmButton.classList.toggle("is-hidden", pending === 0 || Boolean(state.currentRecipeDraft));
  els.resumeRecipeConfirmButton.textContent = pending ? `继续确认（${pending}）` : "继续确认";
}

async function fetchRecipePreview(url, options = {}) {
  const endpoints = getRecipePreviewEndpoints();
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 30000);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      window.clearTimeout(timer);
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.ok) return data;
    } catch {
      // The local helper is optional; GitHub Pages still works without it.
    }
  }
  if (!options.quiet) showToast("GitHub Pages 不能自动抓封面，可在弹窗里上传");
  return null;
}

function getRecipePreviewEndpoints() {
  const endpoints = [];
  if (location.protocol === "http:" && /^(localhost|127\.0\.0\.1|::1)$/.test(location.hostname)) {
    endpoints.push(`${location.origin}/api/xhs-preview`);
  }
  endpoints.push("http://127.0.0.1:5173/api/xhs-preview");
  return [...new Set(endpoints)];
}

function clearRecipeLinkInput() {
  if (els.recipeLinkInput) els.recipeLinkInput.value = "";
}

function extractRecipeUrl(text) {
  return extractRecipeUrls(text)[0] || "";
}

function extractRecipeUrls(text) {
  const matches = String(text || "").match(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com|xhs\.cn|xhsurl\.com)\/[^\s，。；;,）)】]+/gi) || [];
  return [...new Set(matches.map((url) => url.trim()))];
}

function findRecipeByUrl(url) {
  const key = recipeUrlKey(url);
  if (!key) return null;
  return state.recipes.find((recipe) => recipeUrlKey(recipe.url) === key) || null;
}

function recipeUrlKey(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes("xiaohongshu.com")) {
      const noteMatch = url.pathname.match(/^\/(?:discovery\/item|explore)\/([^/]+)/)
        || url.pathname.match(/^\/user\/profile\/[^/]+\/([^/]+)/);
      if (noteMatch) return `${host}/note/${noteMatch[1]}`;
      return `${host}${url.pathname}`;
    }
    return `${host}${url.pathname}${url.search}`;
  } catch {
    return String(value || "").trim();
  }
}

function extractRecipeTitle(text) {
  const withoutUrl = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/复制.*?小红书/g, " ")
    .replace(/打开.*?小红书/g, " ")
    .replace(/快来看/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const bracketMatch = withoutUrl.match(/[《【「](.*?)[》】」]/);
  if (bracketMatch?.[1]) return cleanRecipeTitle(bracketMatch[1]);
  const lines = text
    .split(/\n|。|！|!/)
    .map((line) => cleanRecipeTitle(line.replace(/https?:\/\/\S+/g, "").replace(/#\S+/g, "")))
    .filter((line) => line && !/小红书|复制|打开|点击|链接|分享/.test(line));
  return lines[0] || cleanRecipeTitle(withoutUrl);
}

function cleanRecipeTitle(value) {
  return String(value || "")
    .replace(/^\d+\s*/, "")
    .replace(/\s+[-|｜]\s*[^-|｜]*?(小红书|你的生活兴趣社区|$).*/, "")
    .replace(/\s+\|\s*小红书.*/, "")
    .replace(/\s+-\s*[^-]+$/, "")
    .replace(/^[\s:：,，.。-]+|[\s:：,，.。-]+$/g, "")
    .slice(0, 48);
}

function parseTags(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[，,、\s]+/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 18))
    )
  ];
}

function inferRecipeTags(recipe) {
  const haystack = [recipe.title, recipe.ingredients, recipe.steps, recipe.notes, recipe.sourceText].filter(Boolean).join(" ");
  return RECIPE_TAG_RULES.filter((rule) => rule.pattern.test(haystack)).map((rule) => rule.tag);
}

function renderRecipes() {
  if (!els.recipeList) return;
  const filtered = state.recipes.filter(matchesRecipeFilters).sort(compareRecipes);
  refreshRecipeTagFilter();
  els.recipeCount.textContent = `${filtered.length}/${state.recipes.length}`;
  els.recipeList.innerHTML = "";
  for (const recipe of filtered) {
    els.recipeList.append(renderRecipeCard(recipe));
  }
  els.recipeEmptyState.classList.toggle("is-hidden", filtered.length > 0);
  renderPlannedRecipes();
}

function refreshRecipeTagFilter() {
  if (!els.recipeTagFilter) return;
  const previous = els.recipeTagFilter.value || state.recipeTag;
  const tags = getRecipeTags();
  els.recipeTagFilter.replaceChildren(new Option("所有分类", "all"));
  for (const tag of tags) {
    els.recipeTagFilter.append(new Option(tag, tag));
  }
  els.recipeTagFilter.value = tags.includes(previous) ? previous : "all";
  state.recipeTag = els.recipeTagFilter.value;
  refreshRecipeCategoryOptions(tags);
}

function getRecipeTags() {
  return [...new Set(state.recipes.flatMap((recipe) => recipe.tags || []))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function refreshRecipeCategoryOptions(tags = getRecipeTags()) {
  if (!els.recipeCategoryOptions) return;
  els.recipeCategoryOptions.replaceChildren();
  for (const tag of tags) {
    els.recipeCategoryOptions.append(new Option(tag, tag));
  }
}

function renderRecipeCard(recipe) {
  const card = document.createElement("article");
  card.className = "recipe-card";
  card.dataset.recipeId = recipe.id;
  card.innerHTML = `
    <div class="recipe-thumb recipe-thumb-placeholder"></div>
    <div class="recipe-card-content">
      <button class="recipe-title-button" type="button"></button>
      <div class="recipe-tags"></div>
      <p class="recipe-meta-line"></p>
      <div class="recipe-card-actions">
        <button class="ghost-button compact" type="button" data-plan-recipe="${recipe.id}">准备做</button>
        <a class="recipe-link" target="_blank" rel="noopener">打开链接</a>
      </div>
    </div>
  `;
  const thumb = card.querySelector(".recipe-thumb");
  if (recipe.coverData) {
    const image = document.createElement("img");
    image.className = "recipe-thumb";
    image.alt = "";
    image.src = recipe.coverData;
    thumb.replaceWith(image);
  } else {
    thumb.textContent = recipe.title.slice(0, 1) || "菜";
  }
  const titleButton = card.querySelector(".recipe-title-button");
  titleButton.textContent = recipe.title;
  titleButton.addEventListener("click", () => openRecipeDialog(recipe));
  const tags = card.querySelector(".recipe-tags");
  for (const tag of recipe.tags || []) {
    const chip = document.createElement("span");
    chip.className = "pill";
    chip.textContent = tag;
    tags.append(chip);
  }
  tags.classList.toggle("is-hidden", !recipe.tags?.length);
  const metaLine = card.querySelector(".recipe-meta-line");
  const doneCount = Number(recipe.doneCount || 0);
  metaLine.textContent = doneCount ? `做过 ${doneCount} 次` : "";
  metaLine.classList.toggle("is-hidden", !doneCount);
  const link = card.querySelector(".recipe-link");
  link.href = recipe.url || "#";
  link.classList.toggle("is-hidden", !recipe.url);
  return card;
}

function highlightImportedRecipes(ids) {
  if (!ids.length || !els.recipeList) return;
  const idSet = new Set(ids);
  for (const card of els.recipeList.querySelectorAll("[data-recipe-id]")) {
    if (!idSet.has(card.dataset.recipeId)) continue;
    card.classList.add("is-newly-imported");
    window.setTimeout(() => card.classList.remove("is-newly-imported"), 5000);
  }
}

function handleRecipeListAction(event) {
  const button = event.target.closest("button[data-plan-recipe]");
  if (button) {
    addRecipeToPlan(button.dataset.planRecipe);
    return;
  }
  if (event.target.closest("button, a, input, textarea, select, label")) return;
  const card = event.target.closest("[data-recipe-id]");
  if (!card) return;
  const recipe = state.recipes.find((item) => item.id === card.dataset.recipeId);
  if (recipe) openRecipeDialog(recipe);
}

function addRecipeToPlan(recipeId) {
  const recipe = state.recipes.find((item) => item.id === recipeId);
  if (!recipe) return;
  const existing = state.plannedRecipes.find((item) => item.recipeId === recipeId && item.status !== "done");
  if (existing) {
    showToast("已经在准备做里");
    return;
  }
  state.plannedRecipes.unshift(
    normalizePlannedRecipe({
      id: createId(),
      recipeId,
      plannedDate: "",
      notes: "",
      status: "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  );
  savePlannedRecipes();
  renderPlannedRecipes();
  showToast("已加入准备做");
}

function switchRecipeViewTo(view) {
  state.recipeView = view;
  for (const tabButton of els.recipeSubTabs.querySelectorAll("button[data-recipe-view]")) {
    const isActive = tabButton.dataset.recipeView === view;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  }
  const showLibrary = view === "library";
  for (const element of [document.querySelector(".recipe-capture"), document.querySelector(".recipe-toolbar"), document.querySelector(".recipes-section")]) {
    if (element) element.classList.toggle("is-hidden", !showLibrary);
  }
  els.plannedRecipesView?.classList.toggle("is-hidden", showLibrary);
}

function renderPlannedRecipes() {
  if (!els.plannedRecipeList) return;
  const active = state.plannedRecipes
    .filter((item) => item.status !== "done")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  els.plannedRecipeCount.textContent = `${active.length}`;
  els.plannedRecipeList.replaceChildren();
  for (const item of active) {
    const recipe = state.recipes.find((candidate) => candidate.id === item.recipeId);
    if (!recipe) continue;
    els.plannedRecipeList.append(renderPlannedRecipeCard(item, recipe));
  }
  els.plannedRecipeEmptyState.classList.toggle("is-hidden", active.length > 0);
}

function renderPlannedRecipeCard(item, recipe) {
  const card = document.createElement("article");
  card.className = "recipe-card planned-recipe-card";
  card.dataset.plannedRecipeId = item.id;
  card.innerHTML = `
    <div class="recipe-thumb recipe-thumb-placeholder"></div>
    <div class="recipe-card-content">
      <button class="recipe-title-button" type="button"></button>
      <div class="planned-recipe-fields">
        <label>备注<textarea data-planned-field="notes" rows="2"></textarea></label>
        <div class="planned-meal-controls">
          <label>星期<select data-planned-meal-day>${WEEK_DAYS.map((day) => `<option value="${day}">${day}</option>`).join("")}</select></label>
          <label>餐次<select data-planned-meal-slot>${MEAL_SLOTS.map((meal) => `<option value="${meal.id}">${meal.label}</option>`).join("")}</select></label>
        </div>
      </div>
      <div class="recipe-card-actions">
        <button class="primary-button compact" type="button" data-planned-action="meal">加入 Meal Plan</button>
        <button class="ghost-button compact" type="button" data-planned-action="done">已做</button>
        <button class="ghost-button compact" type="button" data-planned-action="remove">移除</button>
        <a class="recipe-link" target="_blank" rel="noopener">打开链接</a>
      </div>
    </div>
  `;
  const thumb = card.querySelector(".recipe-thumb");
  if (recipe.coverData) {
    const image = document.createElement("img");
    image.className = "recipe-thumb";
    image.alt = "";
    image.src = recipe.coverData;
    thumb.replaceWith(image);
  } else {
    thumb.textContent = recipe.title.slice(0, 1) || "菜";
  }
  const titleButton = card.querySelector(".recipe-title-button");
  titleButton.textContent = recipe.title;
  titleButton.addEventListener("click", () => openRecipeDialog(recipe));
  card.querySelector('[data-planned-field="notes"]').value = item.notes || "";
  card.querySelector("[data-planned-meal-day]").value = state.activeMealDay;
  card.querySelector("[data-planned-meal-slot]").value = "dinner";
  const link = card.querySelector(".recipe-link");
  link.href = recipe.url || "#";
  link.classList.toggle("is-hidden", !recipe.url);
  return card;
}

function updatePlannedRecipeDetails(event) {
  const field = event.target.closest("[data-planned-field]");
  if (!field) return;
  const card = field.closest("[data-planned-recipe-id]");
  const item = state.plannedRecipes.find((planned) => planned.id === card?.dataset.plannedRecipeId);
  if (!item) return;
  item[field.dataset.plannedField] = field.value;
  item.updatedAt = new Date().toISOString();
  savePlannedRecipes();
}

function handlePlannedRecipeAction(event) {
  const button = event.target.closest("button[data-planned-action]");
  if (!button) return;
  const card = button.closest("[data-planned-recipe-id]");
  const id = card?.dataset.plannedRecipeId;
  const item = state.plannedRecipes.find((planned) => planned.id === id);
  if (!item) return;
  if (button.dataset.plannedAction === "meal") {
    addPlannedRecipeToMealPlan(card, item);
    return;
  }
  if (button.dataset.plannedAction === "done") {
    markPlannedRecipeDone(id, item);
    return;
  }
  if (button.dataset.plannedAction === "remove") {
    state.plannedRecipes = state.plannedRecipes.filter((planned) => planned.id !== id);
  }
  savePlannedRecipes();
  renderPlannedRecipes();
}

function addPlannedRecipeToMealPlan(card, item) {
  const recipe = state.recipes.find((candidate) => candidate.id === item.recipeId);
  if (!recipe) return;
  const day = card.querySelector("[data-planned-meal-day]")?.value || state.activeMealDay;
  const meal = card.querySelector("[data-planned-meal-slot]")?.value || "dinner";
  const input = [...els.mealGrid.querySelectorAll(".meal-input")].find(
    (candidate) => candidate.dataset.day === day && candidate.dataset.meal === meal
  );
  if (!input) return;
  const existingLines = input.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!existingLines.includes(recipe.title)) {
    existingLines.push(recipe.title);
    input.value = existingLines.join("\n");
    saveMealPlanner();
  }
  state.activeMealDay = day;
  switchMealDayTo(day);
  const mealLabel = MEAL_SLOTS.find((slot) => slot.id === meal)?.label || "";
  showToast(`已加入 ${day}${mealLabel}`);
}

function markPlannedRecipeDone(plannedId, item) {
  const now = new Date().toISOString();
  state.recipes = state.recipes.map((recipe) => {
    if (recipe.id !== item.recipeId) return recipe;
    return {
      ...recipe,
      doneCount: Number(recipe.doneCount || 0) + 1,
      lastCookedAt: now,
      updatedAt: now
    };
  });
  state.plannedRecipes = state.plannedRecipes.filter((planned) => planned.id !== plannedId);
  saveRecipes();
  savePlannedRecipes();
  renderRecipes();
  showToast("已记录做过一次");
}

function switchMealDayTo(day) {
  if (!els.mealDayTabs || !els.mealGrid) return;
  for (const tabButton of els.mealDayTabs.querySelectorAll("button[data-day]")) {
    const isActive = tabButton.dataset.day === day;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  }
  for (const card of els.mealGrid.querySelectorAll(".meal-day-card")) {
    card.classList.toggle("is-active", card.dataset.day === day);
  }
}

function matchesRecipeFilters(recipe) {
  const haystack = [recipe.title, recipe.url, recipe.tags?.join(" "), recipe.ingredients, recipe.steps, recipe.notes]
    .join(" ")
    .toLowerCase();
  if (state.recipeQuery && !haystack.includes(state.recipeQuery)) return false;
  if (state.recipeTag !== "all" && !recipe.tags?.includes(state.recipeTag)) return false;
  return true;
}

function compareRecipes(a, b) {
  if (state.recipeSort === "doneDesc") {
    return Number(b.doneCount || 0) - Number(a.doneCount || 0) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  }
  if (state.recipeSort === "doneAsc") {
    return Number(a.doneCount || 0) - Number(b.doneCount || 0) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  }
  if (state.recipeSort === "lastCookedDesc") {
    return String(b.lastCookedAt || "").localeCompare(String(a.lastCookedAt || "")) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  }
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function openRecipeDialog(recipe = null, options = {}) {
  const isEditing = Boolean(recipe?.id);
  const isDraftFromLink = Boolean(recipe && recipe.url && !recipe.id);
  els.recipeDialogTitle.textContent = options.title || (isDraftFromLink ? "确认菜谱" : isEditing ? "编辑菜谱" : "手动添加");
  els.recipeId.value = recipe?.id || "";
  els.recipeTitle.value = recipe?.title || "";
  els.recipeUrl.value = recipe?.url || "";
  state.currentRecipeSourceText = recipe?.sourceText || "";
  state.currentRecipeImageOptions = Array.isArray(recipe?.imageOptions) ? recipe.imageOptions : [];
  state.currentRecipePhotos = Array.isArray(recipe?.photos) ? [...recipe.photos] : [];
  setRecipeDialogTags(recipe?.tags || []);
  if (els.recipeCategoryInput) els.recipeCategoryInput.value = "";
  if (els.recipeIngredients) els.recipeIngredients.value = recipe?.ingredients || "";
  els.recipeSteps.value = recipe?.steps || "";
  els.recipeNotes.value = recipe?.notes || "";
  setRecipeCoverPreview(recipe?.coverData || "");
  if (els.recipeCoverInput) els.recipeCoverInput.value = "";
  if (els.recipePhotoInput) els.recipePhotoInput.value = "";
  renderRecipePhotoGallery();
  els.deleteRecipeButton.classList.toggle("is-hidden", !isEditing);
  state.recipeDialogSnapshot = getRecipeDialogValues();
  els.recipeDialog.showModal();
  window.setTimeout(() => els.recipeTitle?.focus(), 80);
}

async function handleRecipeSubmit(event) {
  event.preventDefault();
  await waitForPendingPhotos();
  await loadSelectedRecipeImages();
  const id = els.recipeId.value || createId();
  const existing = state.recipes.find((recipe) => recipe.id === id);
  const recipe = normalizeRecipe({
    id,
    title: els.recipeTitle.value,
    url: els.recipeUrl.value,
    tags: getRecipeDialogTags(),
    ingredients: els.recipeIngredients?.value || "",
    steps: els.recipeSteps.value,
    notes: els.recipeNotes.value,
    coverData: els.recipeCoverData.value,
    photos: state.currentRecipePhotos,
    sourceText: existing?.sourceText || state.currentRecipeSourceText || els.recipeLinkInput?.value.trim() || "",
    doneCount: existing?.doneCount || 0,
    lastCookedAt: existing?.lastCookedAt || "",
    createdAt: existing?.createdAt || new Date().toISOString()
  });
  recipe.updatedAt = new Date().toISOString();
  if (!recipe.title) {
    showToast("先填写菜名");
    return;
  }
  if (existing) state.recipes = state.recipes.map((item) => (item.id === id ? recipe : item));
  else {
    recipe.sourceText = recipe.sourceText || els.recipeLinkInput?.value.trim() || "";
    state.recipes.unshift(recipe);
    clearRecipeLinkInput();
  }
  const unlikeUrl = state.currentRecipeDraft?.unlikeAfterSave ? recipe.url : "";
  saveRecipes();
  const isBatchConfirming = Boolean(state.currentRecipeDraft) || state.recipeConfirmTotal > 0;
  state.currentRecipeDraft = null;
  state.recipeDialogSnapshot = "";
  els.recipeDialog.close();
  renderRecipes();
  let unlikeSucceeded = null;
  if (unlikeUrl) {
    showToast("菜谱已保存，正在取消小红书点赞");
    unlikeSucceeded = await unlikeXhsRecipe(unlikeUrl);
  }
  if (state.recipeConfirmQueue.length) {
    await saveRecipeConfirmQueue();
    const status = unlikeSucceeded === false ? "已保存，但取消点赞失败" : unlikeSucceeded ? "已保存并取消点赞" : "已保存";
    showToast(`${status}，剩余 ${state.recipeConfirmQueue.length} 个待确认`);
    window.setTimeout(openNextRecipeDraft, 120);
  } else if (isBatchConfirming) {
    state.recipeConfirmTotal = 0;
    await clearRecipeConfirmQueueStorage();
    updateResumeRecipeConfirmButton();
    showToast(unlikeSucceeded === false ? "菜谱已保存，但取消点赞失败" : "批量确认完成");
  } else {
    showToast("菜谱已保存");
  }
}

function setRecipeDialogTags(tags) {
  const normalized = parseTags(Array.isArray(tags) ? tags.join(" ") : tags);
  if (els.recipeTags) els.recipeTags.value = normalized.join("，");
  renderRecipeDialogTags(normalized);
}

function getRecipeDialogTags() {
  return parseTags(els.recipeTags?.value || "");
}

function addRecipeCategoryFromDialog() {
  const next = parseTags(els.recipeCategoryInput?.value || "");
  if (!next.length) {
    showToast("先输入分类");
    return;
  }
  const tags = [...new Set([...getRecipeDialogTags(), ...next])];
  setRecipeDialogTags(tags);
  els.recipeCategoryInput.value = "";
}

function removeRecipeCategoryFromDialog(event) {
  const button = event.target.closest("button[data-recipe-tag]");
  if (!button) return;
  const tags = getRecipeDialogTags().filter((tag) => tag !== button.dataset.recipeTag);
  setRecipeDialogTags(tags);
}

function renderRecipeDialogTags(tags = getRecipeDialogTags()) {
  if (!els.recipeSelectedTags) return;
  els.recipeSelectedTags.replaceChildren();
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = "category-chip";
    chip.innerHTML = `<span></span><button type="button" aria-label="移除分类">×</button>`;
    chip.querySelector("span").textContent = tag;
    chip.querySelector("button").dataset.recipeTag = tag;
    els.recipeSelectedTags.append(chip);
  }
}

function deleteCurrentRecipe() {
  const id = els.recipeId.value;
  if (!id) return;
  state.recipes = state.recipes.filter((recipe) => recipe.id !== id);
  state.plannedRecipes = state.plannedRecipes.filter((item) => item.recipeId !== id);
  saveRecipes();
  savePlannedRecipes();
  els.recipeDialog.close();
  renderRecipes();
  showToast("菜谱已删除");
}

async function handleRecipeCoverInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const task = trackPhotoTask(compressImageFile(file));
  try {
    const coverData = await task;
    setRecipeCoverPreview(coverData);
    showToast("封面已添加");
  } catch {
    showToast("封面读取失败");
  }
}

async function handleRecipePhotoInput(event) {
  const files = [...(event.target.files || [])].slice(0, 6);
  if (!files.length) return;
  try {
    const photos = await Promise.all(files.map((file) => trackPhotoTask(compressImageFile(file))));
    state.currentRecipePhotos.push(...photos.filter(Boolean));
    renderRecipePhotoGallery();
    showToast(`${photos.length} 张图片已添加`);
  } catch {
    showToast("图片读取失败");
  } finally {
    if (els.recipePhotoInput) els.recipePhotoInput.value = "";
  }
}

function removeRecipePhoto(event) {
  const button = event.target.closest("button[data-recipe-photo-index]");
  if (!button) return;
  state.currentRecipePhotos.splice(Number(button.dataset.recipePhotoIndex), 1);
  renderRecipePhotoGallery();
}

function openRecipeImageFromGallery(event) {
  const image = event.target.closest("img");
  if (image) openRecipeImageViewer(image.src, image.alt);
}

function openRecipeImageViewer(src, alt = "菜谱图片") {
  if (!src || !els.recipeImageViewer || !els.recipeImageViewerImage) return;
  els.recipeImageViewerImage.src = src;
  els.recipeImageViewerImage.alt = alt;
  els.recipeImageViewer.showModal();
}

function getSelectedRecipeImageOptions() {
  if (!els.recipePhotoGallery) return [];
  const selected = new Set(
    [...els.recipePhotoGallery.querySelectorAll("input[data-recipe-image-option]:checked")]
      .map((input) => Number(input.dataset.recipeImageOption))
  );
  return state.currentRecipeImageOptions.filter((item) => selected.has(Number(item.index)));
}

async function loadSelectedRecipeImages() {
  const selected = getSelectedRecipeImageOptions();
  if (!selected.length) return 0;
  try {
    const response = await fetch(getRecipeImageDataEndpoint(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls: selected.map((item) => item.url) })
    });
    if (!response.ok) {
      showToast("附加图片下载失败，其他内容仍可保存");
      return 0;
    }
    const data = await response.json();
    const photos = Array.isArray(data.photos) ? data.photos : [];
    state.currentRecipePhotos.push(...photos);
    if (photos.length < selected.length) showToast(`只保存了 ${photos.length}/${selected.length} 张附加图片`);
    return photos.length;
  } catch {
    showToast("附加图片保存失败，其他内容仍可保存");
    return 0;
  }
}

function renderRecipePhotoGallery() {
  if (!els.recipePhotoGallery) return;
  els.recipePhotoGallery.replaceChildren();
  state.currentRecipePhotos.forEach((photoData, index) => {
    const item = document.createElement("div");
    item.className = "recipe-extra-photo";
    item.innerHTML = `<img alt="已保存的菜谱图片"><button type="button" class="icon-button small" data-recipe-photo-index="${index}" aria-label="移除图片">×</button>`;
    item.querySelector("img").src = photoData;
    els.recipePhotoGallery.append(item);
  });
  const selectedOptions = new Set(state.currentRecipeDraft?.selectedImageOptions || []);
  for (const option of state.currentRecipeImageOptions) {
    const label = document.createElement("label");
    label.className = "recipe-image-option";
    const checked = selectedOptions.has(Number(option.index)) ? "checked" : "";
    label.innerHTML = `<img alt="帖子第 ${option.index} 张图片"><span><input type="checkbox" data-recipe-image-option="${option.index}" ${checked} ${option.index === 1 ? "disabled" : ""}> ${option.index === 1 ? "封面" : `保存第 ${option.index} 张`}</span>`;
    label.querySelector("img").src = option.url;
    els.recipePhotoGallery.append(label);
  }
}

function getRecipeImageDataEndpoint() {
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return `${window.location.origin}/api/xhs-image-data`;
  return "http://127.0.0.1:5173/api/xhs-image-data";
}

function removeCurrentRecipeCover() {
  setRecipeCoverPreview("");
  if (els.recipeCoverInput) els.recipeCoverInput.value = "";
}

function setRecipeCoverPreview(coverData) {
  if (els.recipeCoverData) els.recipeCoverData.value = coverData || "";
  if (els.recipeCoverPreview) els.recipeCoverPreview.classList.toggle("is-empty", !coverData);
  if (els.recipeCoverPreviewImage) els.recipeCoverPreviewImage.src = coverData || "";
}

function exportRecipes() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes: state.recipes,
    plannedRecipes: state.plannedRecipes
  };
  downloadTextFile(`recipes-backup-${todaySlug()}.json`, JSON.stringify(payload));
  showToast("Recipe JSON 已下载");
}

async function importRecipes(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const incoming = Array.isArray(payload) ? payload : payload.recipes;
    if (!Array.isArray(incoming)) throw new Error("Invalid recipe backup");
    mergeRecipes(incoming);
    if (Array.isArray(payload.plannedRecipes)) {
      mergePlannedRecipes(payload.plannedRecipes);
      savePlannedRecipes();
    }
    saveRecipes();
    renderRecipes();
    showToast(`导入了 ${incoming.length} 个菜谱`);
  } catch {
    showToast("Recipe 导入失败");
  } finally {
    event.target.value = "";
  }
}

function mergeRecipes(incoming) {
  const existingById = new Map(state.recipes.map((recipe) => [recipe.id, recipe]));
  const existingByUrl = new Map(state.recipes.filter((recipe) => recipe.url).map((recipe) => [recipe.url, recipe]));
  const existingByUrlKey = new Map(state.recipes.filter((recipe) => recipe.url).map((recipe) => [recipeUrlKey(recipe.url), recipe]));
  for (const item of incoming) {
    const recipe = normalizeRecipe({ ...item, id: item.id || createId() });
    const existing = existingById.get(recipe.id) || (recipe.url ? existingByUrl.get(recipe.url) || existingByUrlKey.get(recipeUrlKey(recipe.url)) : null);
    if (existing) {
      state.recipes = state.recipes.map((current) => (current.id === existing.id ? { ...existing, ...recipe } : current));
    } else {
      state.recipes.push(recipe);
    }
  }
}

function mergePlannedRecipes(incoming) {
  const existingById = new Map(state.plannedRecipes.map((item) => [item.id, item]));
  for (const item of incoming) {
    const planned = normalizePlannedRecipe({ ...item, id: item.id || createId() });
    const existing = existingById.get(planned.id);
    if (existing) {
      state.plannedRecipes = state.plannedRecipes.map((current) => (current.id === existing.id ? { ...existing, ...planned } : current));
    } else {
      state.plannedRecipes.push(planned);
    }
  }
}

function normalizeRecipe(recipe) {
  return {
    id: recipe.id || createId(),
    title: cleanRecipeTitle(recipe.title || "") || "未命名菜谱",
    url: String(recipe.url || "").trim(),
    tags: parseTags(Array.isArray(recipe.tags) ? recipe.tags.join(" ") : recipe.tags),
    ingredients: String(recipe.ingredients || "").trim(),
    steps: String(recipe.steps || "").trim(),
    notes: String(recipe.notes || "").trim(),
    coverData: recipe.coverData || "",
    photos: Array.isArray(recipe.photos) ? recipe.photos.filter(Boolean) : [],
    sourceText: String(recipe.sourceText || "").trim(),
    doneCount: Number(recipe.doneCount || 0),
    lastCookedAt: String(recipe.lastCookedAt || "").trim(),
    createdAt: recipe.createdAt || new Date().toISOString(),
    updatedAt: recipe.updatedAt || recipe.createdAt || new Date().toISOString()
  };
}

function normalizePlannedRecipe(item) {
  return {
    id: item.id || createId(),
    recipeId: String(item.recipeId || "").trim(),
    plannedDate: String(item.plannedDate || "").trim(),
    notes: String(item.notes || "").trim(),
    status: item.status === "done" ? "done" : "planned",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
  };
}

function openBackupDialog() {
  updateCurrentSyncHint();
  els.backupDialog.showModal();
}

async function initStorage() {
  if (!("indexedDB" in window)) {
    state.fallback = true;
    return;
  }

  try {
    state.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("expireDate", "expireDate", { unique: false });
          store.createIndex("category", "category", { unique: false });
        }
        if (!db.objectStoreNames.contains(RECIPES_STORE_NAME)) {
          db.createObjectStore(RECIPES_STORE_NAME, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(RECIPE_QUEUE_STORE_NAME)) {
          db.createObjectStore(RECIPE_QUEUE_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    state.fallback = true;
    showToast("已切换到备用本地存储");
  }
}

async function loadItems() {
  if (state.fallback) {
    state.items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return;
  }

  state.items = await storeRequest("readonly", (store) => store.getAll());
}

async function saveItem(item) {
  const now = new Date().toISOString();
  const next = {
    ...item,
    updatedAt: now,
    createdAt: item.createdAt || now
  };

  if (state.fallback) {
    const index = state.items.findIndex((existing) => existing.id === next.id);
    if (index >= 0) state.items[index] = next;
    else state.items.push(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    return next;
  }

  await storeRequest("readwrite", (store) => store.put(next));
  return next;
}

async function removeItem(id) {
  if (state.fallback) {
    state.items = state.items.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    return;
  }

  await storeRequest("readwrite", (store) => store.delete(id));
}

function storeRequest(mode, action) {
  return storeRequestFor(STORE_NAME, mode, action);
}

function storeRequestFor(storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = action(store);
    if (request?.onsuccess !== undefined) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
    }
  });
}

function handleParse() {
  const text = els.quickInput.value.trim();
  if (!text) {
    showToast("先输入一点内容");
    return;
  }

  state.drafts = parsePantryText(text);
  for (const draft of state.drafts) {
    draft.category = ensureCategory(draft.category);
    draft.location = ensureLocation(draft.location);
  }
  renderDrafts();
  els.draftPanel.classList.toggle("is-hidden", state.drafts.length === 0);
  if (state.drafts.length) showToast(`整理出 ${state.drafts.length} 条`);
}

function parsePantryText(text) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/[，、；;]/g, "，")
    .replace(/。/g, "，")
    .trim();
  const chunks = splitItems(normalized);
  const sharedLocation = extractLocation(normalized);
  const sharedNotes = extractNotes(normalized);
  const sharedQuantity = extractQuantity(normalized);

  return chunks.map((chunk) => {
    const dateInfo = extractDate(chunk) || extractDate(normalized);
    const opened = /开封|打开|已开/.test(chunk);
    const quantityInfo = extractQuantity(chunk) || sharedQuantity;
    const cleanName = extractName(chunk);
    const location = extractLocation(chunk) || sharedLocation || "";
    const category = categoryForLocation(location) || extractCategory(chunk) || extractCategory(normalized) || guessCategory(chunk);
    return {
      id: createId(),
      name: cleanName || chunk.slice(0, 18) || "未命名",
      category,
      expireDate: dateInfo?.date || "",
      expireDatePrecision: dateInfo?.precision || "unknown",
      quantity: quantityInfo?.quantity || "",
      unit: quantityInfo?.unit || "",
      location,
      opened,
      notes: extractNotes(chunk) || sharedNotes || "",
      rawText: chunk
    };
  });
}

function splitItems(text) {
  const cleaned = text.replace(/^(我)?(今天|刚刚)?(买了|买|有|新增|添加)/, "");
  const clauses = cleaned
    .split("，")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isDetailClause(part));
  const datedClauses = clauses.filter((part) => /过期|到期|保质期|用完|\d{4}\s*[-/.年]|\d{1,2}\s*月|明年|后年|今年/.test(part));

  if (datedClauses.length === 1 && clauses.length > 1) return [clauses.join("，")];
  if (datedClauses.length) return datedClauses.slice(0, 8);

  const byConnector = cleaned
    .split(/(?:还有|另外|以及|和|跟|、)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isDetailClause(part));
  return (byConnector.length ? byConnector : clauses).slice(0, 8);
}

function isDetailClause(text) {
  return /^(都)?(放在|放到|放|位置|备注|开封|已开封|数量|分类|种类|类别)/.test(text.trim());
}

function extractName(text) {
  let value = text
    .replace(/^(我)?(今天|刚刚)?(买了|买|有|新增|添加)/, "")
    .replace(/(明年|今年|后年|下个月|这个月|月底|年底|春节前|过年前).*/, "")
    .replace(/\d{4}\s*[年/.-]\s*\d{1,2}.*/, "")
    .replace(/\d{1,2}\s*月.*/, "")
    .replace(/(过期|到期|保质期|用完|放在|放|备注|数量|开封).*/, "")
    .replace(new RegExp(QUANTITY_PHRASE, "ig"), "")
    .replace(/(?:分类|种类|类别)(?:是|为|:|：)?\s*[^，,。；;]+/, "")
    .trim();
  value = value.replace(/^[，,、\s]+|[，,、\s]+$/g, "");
  return value;
}

function extractDate(text) {
  const today = new Date();
  const year = today.getFullYear();

  let match = text.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})(?:\s*[-/.月]\s*(\d{1,2}))?/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = match[3] ? Number(match[3]) : lastDayOfMonth(y, m);
    return { date: toDateInput(y, m, d), precision: match[3] ? "day" : "month" };
  }

  match = text.match(/(明年|今年|后年)?\s*([一二两三四五六七八九十\d]{1,3})\s*月(?:\s*([一二两三四五六七八九十\d]{1,3})\s*(?:日|号))?/);
  if (match) {
    const offset = match[1] === "明年" ? 1 : match[1] === "后年" ? 2 : 0;
    const y = year + offset;
    const m = parseChineseNumber(match[2]);
    const d = match[3] ? parseChineseNumber(match[3]) : lastDayOfMonth(y, m);
    return { date: toDateInput(y, m, d), precision: match[3] ? "day" : "month" };
  }

  if (/明年.*(年底|年末)/.test(text)) return { date: `${year + 1}-12-31`, precision: "year" };
  if (/今年.*(年底|年末)/.test(text)) return { date: `${year}-12-31`, precision: "year" };
  if (/下个月/.test(text)) {
    const next = new Date(year, today.getMonth() + 1, 1);
    return {
      date: toDateInput(next.getFullYear(), next.getMonth() + 1, lastDayOfMonth(next.getFullYear(), next.getMonth() + 1)),
      precision: "month"
    };
  }
  if (/春节前|过年前/.test(text)) return { date: `${year + 1}-02-01`, precision: "unknown" };
  return null;
}

function extractLocation(text) {
  const match = text.match(new RegExp(`(?:放在|放到|放|位置是|在)([^，,。；;]+?)(?:$|，|,|。|；|;|备注|过期|到期|保质期|${QUANTITY_PHRASE}|\\d{4}\\s*[-/.年]|\\d{1,2}\\s*月|明年|今年|后年)`));
  return match ? cleanLocation(match[1]) : "";
}

function cleanLocation(value) {
  const trimmed = String(value || "").trim();
  const cabinetMatch = trimmed.match(/(.+?柜|冰箱)/);
  if (cabinetMatch) return normalizeLocationName(cabinetMatch[1]);
  return normalizeLocationName(
    trimmed
      .replace(/^(放在|放到|放|位置是|在)/, "")
      .replace(new RegExp(`${QUANTITY_PHRASE}.*`, "i"), "")
      .replace(/\d{4}\s*[-/.年]\s*\d{1,2}(?:\s*[-/.月]\s*\d{1,2})?.*/, "")
      .replace(/(明年|今年|后年|下个月|这个月|\d{1,2}\s*月).*/, "")
      .replace(/(过期|到期|保质期).*/, "")
  );
}

function extractNotes(text) {
  const match = text.match(/备注(?:是|:|：)?([^，,。；;]+)/);
  return match ? match[1].trim() : "";
}

function extractCategory(text) {
  const match = text.match(/(?:分类|种类|类别)(?:是|为|:|：)?\s*([^，,。；;]+)/);
  return match ? cleanCategory(match[1]) : "";
}

function cleanCategory(value) {
  return normalizeCategoryName(
    String(value || "")
      .replace(/(放在|放到|放|位置是|位置|在).*/, "")
      .replace(new RegExp(`${QUANTITY_PHRASE}.*`, "i"), "")
      .replace(/\d{4}\s*[-/.年]\s*\d{1,2}(?:\s*[-/.月]\s*\d{1,2})?.*/, "")
      .replace(/(明年|今年|后年|下个月|这个月|\d{1,2}\s*月).*/, "")
      .replace(/(过期|到期|保质期|备注).*/, "")
  );
}

function extractQuantity(text) {
  const match = text.match(new RegExp(`(?:数量|数目|有)?\\s*([一二两三四五六七八九十百\\d]+(?:\\.\\d+)?)\\s*(${QUANTITY_UNITS})`, "i"));
  return match ? { quantity: parseChineseNumber(match[1]), unit: match[2] } : null;
}

function guessCategory(text) {
  if (/酱油|生抽|老抽|醋|盐|糖|胡椒|花椒|八角|桂皮|孜然|辣椒|豆瓣|味淋|料酒|蚝油|香油|调料|香料|酱/.test(text)) return "调料";
  if (/零食|薯片|饼干|曲奇|糖果|巧克力|坚果|海苔|果冻|辣条|爆米花|小吃/.test(text)) return "零食";
  if (/速食|方便面|泡面|拉面|自热|即食|罐装粥|八宝粥|麦片|燕麦杯|螺蛳粉|酸辣粉/.test(text)) return "速食";
  if (/木耳|香菇|米|面|粉|豆|干货|紫菜|海带/.test(text)) return "干货";
  if (/牛奶|酸奶|奶酪|鸡蛋|豆腐|冷藏/.test(text)) return "冷藏";
  if (/冷冻|冻|冰箱冷冻|速冻/.test(text)) return "冷冻";
  if (/罐头|罐/.test(text)) return "罐头";
  if (/面粉|酵母|泡打粉|黄油|烘焙/.test(text)) return "烘焙";
  if (/茶|咖啡|饮料|果汁|酒/.test(text)) return "饮品";
  return "其他";
}

function categoryForLocation(location) {
  if (normalizeLocationName(location) === "零食柜") return "零食";
  return "";
}

function loadCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "[]");
    state.categories = orderCategories([...DEFAULT_CATEGORIES, ...saved]);
  } catch {
    state.categories = [...DEFAULT_CATEGORIES];
  }
}

function saveCategories() {
  const custom = state.categories.filter((category) => !DEFAULT_CATEGORIES.includes(category));
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(custom));
}

function syncCategoriesFromItems() {
  let changed = false;
  for (const item of state.items) {
    if (!item.category || state.categories.includes(item.category)) continue;
    state.categories = orderCategories([...state.categories, item.category]);
    changed = true;
  }
  if (changed) saveCategories();
}

function refreshCategoryControls() {
  const previousFilter = els.categoryFilter.value || state.category;
  const previousItemCategory = getItemDialogCategory();

  els.categoryFilter.replaceChildren(new Option("所有分类", "all"));
  for (const category of state.categories) {
    els.categoryFilter.append(new Option(category, category));
  }
  els.categoryFilter.value = state.categories.includes(previousFilter) ? previousFilter : "all";
  state.category = els.categoryFilter.value;

  els.itemCategory.replaceChildren();
  for (const category of state.categories) {
    els.itemCategory.append(new Option(category, category));
  }
  els.itemCategory.append(new Option("新分类...", CUSTOM_CATEGORY_VALUE));
  setItemCategoryControl(previousItemCategory);
}

function refreshLocationControls() {
  if (!els.locationFilter) return;
  const previousLocation = els.locationFilter.value || state.location;
  const locations = getLocationOptions();
  els.locationFilter.replaceChildren(new Option("所有位置", "all"));
  for (const location of locations) {
    els.locationFilter.append(new Option(location, location));
  }
  els.locationFilter.value = locations.includes(previousLocation) ? previousLocation : "all";
  state.location = els.locationFilter.value;
  refreshItemLocationOptions();
}

function getLocationOptions() {
  const fromItems = state.items.map((item) => normalizeLocationName(item.location)).filter(Boolean);
  return orderLocations([...DEFAULT_LOCATIONS, ...state.locations, ...fromItems]);
}

function loadLocations() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCATIONS_KEY) || "[]");
    state.locations = orderLocations([...DEFAULT_LOCATIONS, ...saved]);
  } catch {
    state.locations = [...DEFAULT_LOCATIONS];
  }
}

function saveLocations() {
  const custom = state.locations.filter((location) => !DEFAULT_LOCATIONS.includes(location));
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(custom));
}

function syncLocationsFromItems() {
  let changed = false;
  for (const item of state.items) {
    const location = normalizeLocationName(item.location);
    if (!location || state.locations.includes(location)) continue;
    state.locations = orderLocations([...state.locations, location]);
    changed = true;
  }
  if (changed) saveLocations();
}

function ensureLocation(value) {
  const location = normalizeLocationName(value);
  if (!location) return "";
  if (!state.locations.includes(location)) {
    state.locations = orderLocations([...state.locations, location]);
    saveLocations();
    refreshLocationControls();
  }
  return location;
}

function refreshItemLocationOptions(selectedValue = null) {
  if (!els.itemLocation) return;
  const previousLocation = selectedValue ?? els.itemLocation.value ?? "";
  const locations = getLocationOptions();
  els.itemLocation.replaceChildren(new Option("未设置", ""));
  for (const location of locations) {
    els.itemLocation.append(new Option(location, location));
  }
  if (previousLocation && !locations.includes(previousLocation)) {
    els.itemLocation.append(new Option(previousLocation, previousLocation));
  }
  els.itemLocation.value = previousLocation && [...locations, previousLocation].includes(previousLocation) ? previousLocation : "";
}

function orderLocations(locations) {
  const unique = [...new Set(locations.map(normalizeLocationName).filter(Boolean))];
  return unique.sort((a, b) => {
    const aIndex = DEFAULT_LOCATIONS.indexOf(a);
    const bIndex = DEFAULT_LOCATIONS.indexOf(b);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return a.localeCompare(b, "zh-Hans-CN");
  });
}

function ensureCategory(value) {
  const category = normalizeCategoryName(value) || "其他";
  if (!state.categories.includes(category)) {
    state.categories = orderCategories([...state.categories, category]);
    saveCategories();
    refreshCategoryControls();
  }
  return category;
}

function setItemCategoryControl(category) {
  const normalized = normalizeCategoryName(category) || "其他";
  if (state.categories.includes(normalized)) {
    els.itemCategory.value = normalized;
    if (els.itemCustomCategory) els.itemCustomCategory.value = "";
  } else {
    els.itemCategory.value = CUSTOM_CATEGORY_VALUE;
    if (els.itemCustomCategory) els.itemCustomCategory.value = normalized;
  }
  updateCustomCategoryVisibility();
}

function getItemDialogCategory() {
  if (els.itemCategory?.value === CUSTOM_CATEGORY_VALUE) {
    return els.itemCustomCategory?.value || "";
  }
  return els.itemCategory?.value || "其他";
}

function updateCustomCategoryVisibility() {
  if (!els.itemCustomCategory || !els.itemCategory) return;
  const isCustom = els.itemCategory.value === CUSTOM_CATEGORY_VALUE;
  els.itemCustomCategory.classList.toggle("is-hidden", !isCustom);
}

function normalizeCategoryName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 16);
}

function normalizeLocationName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function orderCategories(categories) {
  const unique = [...new Set(categories.map(normalizeCategoryName).filter(Boolean))];
  const defaultsWithoutOther = DEFAULT_CATEGORIES.filter((category) => category !== "其他");
  const custom = unique.filter((category) => !DEFAULT_CATEGORIES.includes(category)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  return [...defaultsWithoutOther, ...custom, "其他"];
}

function render() {
  const filtered = state.items.filter(matchesFilters).sort(compareItems);
  const soon = state.items.filter((item) => getExpiryStatus(item.expireDate) === "soon").length;
  const expired = state.items.filter((item) => getExpiryStatus(item.expireDate) === "expired").length;

  els.totalCount.textContent = state.items.length;
  els.soonCount.textContent = soon;
  els.expiredCount.textContent = expired;

  for (const button of els.statusFilter.querySelectorAll("button")) {
    button.classList.toggle("is-active", button.dataset.status === state.status);
  }

  els.itemList.innerHTML = "";
  for (const item of filtered) {
    els.itemList.append(renderItemCard(item));
  }
  els.emptyState.classList.toggle("is-hidden", filtered.length > 0);
}

function renderItemCard(item) {
  const button = document.createElement("button");
  const status = getExpiryStatus(item.expireDate);
  button.className = "item-card";
  button.type = "button";
  button.addEventListener("click", () => openItemDialog(item));
  button.innerHTML = `
    <div class="item-thumb item-thumb-placeholder"></div>
    <div class="item-card-content">
      <div class="item-topline">
        <span class="item-name"></span>
        <span class="date-pill ${status}"></span>
      </div>
      <div class="meta-row">
        <span class="pill"></span>
        <span class="item-meta"></span>
      </div>
      <p class="item-notes"></p>
    </div>
  `;
  const thumb = button.querySelector(".item-thumb");
  if (item.photoData) {
    const image = document.createElement("img");
    image.className = "item-thumb";
    image.alt = "";
    image.src = item.photoData;
    thumb.replaceWith(image);
  } else {
    thumb.textContent = item.name.slice(0, 1) || "食";
  }
  button.querySelector(".item-name").textContent = item.name;
  button.querySelector(".date-pill").textContent = formatExpiry(item.expireDate);
  button.querySelector(".pill").textContent = item.category || "其他";
  button.querySelector(".item-meta").textContent = [formatQuantity(item), item.location, item.opened ? "已开封" : ""]
    .filter(Boolean)
    .join(" · ");
  const notes = button.querySelector(".item-notes");
  notes.textContent = item.notes || "";
  notes.classList.toggle("is-hidden", !item.notes);
  return button;
}

function renderDrafts() {
  els.draftList.innerHTML = "";
  state.drafts.forEach((draft, index) => {
    const card = document.createElement("div");
    card.className = "draft-card";
    card.innerHTML = `
      <section class="draft-photo-field" aria-label="草稿图片">
        <div class="draft-photo-preview is-empty">
          <span>无图片</span>
          <img alt="草稿图片预览" />
        </div>
        <div class="photo-actions">
          <label class="file-button compact">
            拍照/选图
            <input class="draft-photo-input" type="file" accept="image/*" capture="environment" />
          </label>
          <button class="ghost-button compact draft-photo-remove" type="button">移除图片</button>
        </div>
      </section>
      <div class="two-col">
        <label>名称<input data-field="name" /></label>
        <label>分类<select data-field="category"></select></label>
        <label class="draft-custom-category is-hidden">新分类<input data-custom-category /></label>
      </div>
      <div class="two-col">
        <label>过期日期<input data-field="expireDate" type="date" /></label>
        <label>数量<input data-field="quantity" type="number" min="0" step="0.1" /></label>
      </div>
      <div class="two-col">
        <label>单位<input data-field="unit" /></label>
        <label>位置<select data-field="location"></select></label>
      </div>
      <label>备注<textarea data-field="notes" rows="2"></textarea></label>
      <label class="checkbox-row"><input data-field="opened" type="checkbox" /><span>已开封</span></label>
    `;
    updateDraftPhotoPreview(card, draft.photoData || "");
    const photoInput = card.querySelector(".draft-photo-input");
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      draft.photoPending = true;
      const task = trackPhotoTask(compressImageFile(file));
      draft.photoTask = task;
      try {
        draft.photoData = await task;
        updateDraftPhotoPreview(card, draft.photoData);
        showToast("图片已添加");
      } catch {
        showToast("图片读取失败");
      } finally {
        draft.photoPending = false;
      }
    });
    card.querySelector(".draft-photo-remove").addEventListener("click", () => {
      draft.photoData = "";
      photoInput.value = "";
      updateDraftPhotoPreview(card, "");
    });
    const categorySelect = card.querySelector('select[data-field="category"]');
    categorySelect.append(...state.categories.map((category) => new Option(category, category)));
    categorySelect.append(new Option("新分类...", CUSTOM_CATEGORY_VALUE));
    const customCategoryInput = card.querySelector("[data-custom-category]");
    const customCategoryField = card.querySelector(".draft-custom-category");
    const syncDraftCategoryControl = () => {
      const isCustom = categorySelect.value === CUSTOM_CATEGORY_VALUE;
      customCategoryField.classList.toggle("is-hidden", !isCustom);
      draft.category = isCustom ? customCategoryInput.value : categorySelect.value;
    };
    if (state.categories.includes(draft.category)) {
      categorySelect.value = draft.category;
    } else {
      categorySelect.value = CUSTOM_CATEGORY_VALUE;
      customCategoryInput.value = draft.category || "";
      customCategoryField.classList.remove("is-hidden");
    }
    categorySelect.addEventListener("change", syncDraftCategoryControl);
    customCategoryInput.addEventListener("input", syncDraftCategoryControl);
    const locationSelect = card.querySelector('select[data-field="location"]');
    locationSelect.append(new Option("未设置", ""));
    for (const location of getLocationOptions()) {
      locationSelect.append(new Option(location, location));
    }
    for (const input of card.querySelectorAll("[data-field]")) {
      const field = input.dataset.field;
      if (field === "category" && input.tagName === "SELECT") continue;
      if (input.type === "checkbox") input.checked = Boolean(draft[field]);
      else input.value = draft[field] ?? "";
      input.addEventListener("input", () => {
        draft[field] = input.type === "checkbox" ? input.checked : input.value;
      });
    }
    els.draftList.append(card);
    if (index === 0) card.querySelector("input").focus();
  });
}

function updateDraftPhotoPreview(card, photoData) {
  const preview = card.querySelector(".draft-photo-preview");
  const image = preview.querySelector("img");
  preview.classList.toggle("is-empty", !photoData);
  image.src = photoData || "";
}

async function saveDrafts() {
  await waitForPendingPhotos();
  const valid = state.drafts.filter((draft) => draft.name.trim());
  for (const draft of valid) {
    await saveItem(normalizeItem(draft));
  }
  await loadItems();
  refreshLocationControls();
  clearDrafts();
  els.quickInput.value = "";
  render();
  showToast(`保存了 ${valid.length} 条`);
}

function clearDrafts() {
  state.drafts = [];
  els.draftList.innerHTML = "";
  els.draftPanel.classList.add("is-hidden");
}

function openItemDialog(item = null) {
  const isEditing = Boolean(item);
  els.dialogTitle.textContent = isEditing ? "编辑" : "手动添加";
  els.itemId.value = item?.id || "";
  setPhotoPreview(item?.photoData || "");
  if (els.itemPhotoInput) els.itemPhotoInput.value = "";
  els.itemName.value = item?.name || "";
  setItemCategoryControl(item?.category || "其他");
  els.itemExpireDate.value = item?.expireDate || "";
  els.itemQuantity.value = item?.quantity ?? "";
  els.itemUnit.value = item?.unit || "";
  refreshItemLocationOptions(item?.location || "");
  els.itemLocation.value = item?.location || "";
  els.itemNotes.value = item?.notes || "";
  els.itemOpened.checked = Boolean(item?.opened);
  els.deleteItemButton.classList.toggle("is-hidden", !isEditing);
  els.itemDialog.showModal();
}

async function handleItemSubmit(event) {
  event.preventDefault();
  await waitForPendingPhotos();
  const item = normalizeItem({
    id: els.itemId.value || createId(),
    name: els.itemName.value,
    category: getItemDialogCategory(),
    expireDate: els.itemExpireDate.value,
    quantity: els.itemQuantity.value,
    unit: els.itemUnit.value,
    location: els.itemLocation.value,
    notes: els.itemNotes.value,
    opened: els.itemOpened.checked,
    photoData: els.itemPhotoData?.value || "",
    createdAt: state.items.find((existing) => existing.id === els.itemId.value)?.createdAt
  });
  await saveItem(item);
  await loadItems();
  refreshLocationControls();
  els.itemDialog.close();
  render();
  showToast("已保存");
}

async function deleteCurrentItem() {
  const id = els.itemId.value;
  if (!id) return;
  await removeItem(id);
  await loadItems();
  refreshLocationControls();
  els.itemDialog.close();
  render();
  showToast("已删除");
}

function normalizeItem(item) {
  const location = ensureLocation(item.location);
  const category = ensureCategory(categoryForLocation(location) || item.category);
  return {
    id: item.id || createId(),
    name: String(item.name || "").trim(),
    category,
    expireDate: item.expireDate || "",
    expireDatePrecision: item.expireDatePrecision || (item.expireDate ? "day" : "unknown"),
    quantity: item.quantity === "" || item.quantity == null ? "" : Number(item.quantity),
    unit: String(item.unit || "").trim(),
    location,
    opened: Boolean(item.opened),
    notes: String(item.notes || "").trim(),
    photoData: item.photoData || "",
    rawText: item.rawText || "",
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null
  };
}

function matchesFilters(item) {
  const haystack = [item.name, item.category, item.location, item.notes, item.unit].join(" ").toLowerCase();
  if (state.query && !haystack.includes(state.query)) return false;
  if (state.category !== "all" && item.category !== state.category) return false;
  if (state.location !== "all" && item.location !== state.location) return false;
  if (state.status !== "all" && getExpiryStatus(item.expireDate) !== state.status) return false;
  return true;
}

function compareByExpiry(a, b) {
  if (!a.expireDate && !b.expireDate) return a.name.localeCompare(b.name, "zh-Hans-CN");
  if (!a.expireDate) return 1;
  if (!b.expireDate) return -1;
  return a.expireDate.localeCompare(b.expireDate);
}

function compareItems(a, b) {
  if (state.sort === "expiryDesc") return compareByExpiry(b, a);
  if (state.sort === "nameAsc") return a.name.localeCompare(b.name, "zh-Hans-CN");
  if (state.sort === "updatedDesc") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  return compareByExpiry(a, b);
}

function getExpiryStatus(date) {
  if (!date) return "none";
  const today = startOfDay(new Date());
  const expires = startOfDay(new Date(`${date}T00:00:00`));
  const diff = Math.round((expires - today) / 86400000);
  if (diff < 0) return "expired";
  if (diff <= 30) return "soon";
  return "ok";
}

function formatExpiry(date) {
  if (!date) return "无日期";
  const status = getExpiryStatus(date);
  const diff = Math.round((startOfDay(new Date(`${date}T00:00:00`)) - startOfDay(new Date())) / 86400000);
  if (status === "expired") return `过期 ${Math.abs(diff)} 天`;
  if (status === "soon") return diff === 0 ? "今天到期" : `${diff} 天后`;
  return date;
}

function formatQuantity(item) {
  if (item.quantity === "" || item.quantity == null) return "";
  return `${item.quantity}${item.unit || ""}`;
}

async function handlePhotoInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const task = trackPhotoTask(compressImageFile(file));
  try {
    const photoData = await task;
    setPhotoPreview(photoData);
    showToast("图片已添加");
  } catch {
    showToast("图片读取失败");
  }
}

function removeCurrentPhoto() {
  setPhotoPreview("");
  els.itemPhotoInput.value = "";
}

function setPhotoPreview(photoData) {
  if (els.itemPhotoData) els.itemPhotoData.value = photoData || "";
  if (els.photoPreview) els.photoPreview.classList.toggle("is-empty", !photoData);
  if (els.photoPreviewImage) els.photoPreviewImage.src = photoData || "";
}

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Invalid image"));
      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function trackPhotoTask(task) {
  state.pendingPhotoTasks.add(task);
  task.finally(() => state.pendingPhotoTasks.delete(task));
  return task;
}

async function waitForPendingPhotos() {
  if (!state.pendingPhotoTasks.size) return;
  showToast("正在处理图片");
  await Promise.allSettled([...state.pendingPhotoTasks]);
}

function exportJson() {
  const payload = buildBackupPayload();
  const content = JSON.stringify(payload);
  state.fullBackupText = content;
  state.backupChunks = makeBackupChunks(content);
  updateBackupStatus(content, true);
  showToast("JSON 已生成，可以下载");
}

function updateBackupStatus(content, includesPhotos) {
  const photoCount = state.items.filter((item) => item.photoData).length;
  const size = formatBytes(new Blob([content]).size);
  const photoText = includesPhotos ? `包含 ${photoCount} 张图片` : "不包含图片";
  if (els.backupStatus) {
    els.backupStatus.textContent = `${state.items.length} 个物品，${photoText}，备份大小 ${size}`;
  }
}

function makeBackupChunks(content) {
  if (content.length <= BACKUP_CHUNK_SIZE) return [content];
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const total = Math.ceil(content.length / BACKUP_CHUNK_SIZE);
  const chunks = [];
  for (let index = 0; index < total; index += 1) {
    const part = content.slice(index * BACKUP_CHUNK_SIZE, (index + 1) * BACKUP_CHUNK_SIZE);
    chunks.push(`${CHUNK_PREFIX} ${id} ${index + 1}/${total}\n${part}`);
  }
  return chunks;
}

async function importJsonFromTextArea() {
  const text = window.prompt("粘贴 JSON 备份内容");
  if (!text?.trim()) return;
  try {
    await importBackupText(text);
  } catch {
    showToast("导入失败");
  }
}

async function importBackupText(text) {
  const payload = JSON.parse(restoreChunkedBackup(text).trim());
  const result = await applyBackupPayload(payload, { requireItems: true });
  showToast(formatImportResult(result));
}

function buildBackupPayload() {
  return buildSyncPayload("all");
}

function buildSyncPayload(target = "all") {
  const base = {
    version: 2,
    syncTarget: target,
    exportedAt: new Date().toISOString()
  };
  if (target === "pantry") {
    return { ...base, categories: state.categories, locations: state.locations, items: state.items };
  }
  if (target === "meal") {
    return { ...base, mealPlanner: state.mealPlanner };
  }
  if (target === "recipes") {
    return { ...base, recipes: state.recipes, plannedRecipes: state.plannedRecipes };
  }
  return {
    ...base,
    categories: state.categories,
    locations: state.locations,
    mealPlanner: state.mealPlanner,
    recipes: state.recipes,
    plannedRecipes: state.plannedRecipes,
    items: state.items
  };
}

async function applyBackupPayload(payload, options = {}) {
  const requireItems = options.requireItems ?? false;
  const incomingItems = Array.isArray(payload) ? payload : payload.items;
  const incomingRecipes = Array.isArray(payload?.recipes) ? payload.recipes : [];
  const incomingPlannedRecipes = Array.isArray(payload?.plannedRecipes) ? payload.plannedRecipes : [];
  let importedMealPlanner = false;
  if (requireItems && !Array.isArray(incomingItems)) throw new Error("Invalid backup");
  if (Array.isArray(payload.categories)) {
    state.categories = orderCategories([...state.categories, ...payload.categories]);
    saveCategories();
    refreshCategoryControls();
  }
  if (Array.isArray(payload.locations)) {
    state.locations = orderLocations([...state.locations, ...payload.locations]);
    saveLocations();
    refreshLocationControls();
  }
  if (Array.isArray(incomingItems)) {
    for (const item of incomingItems) {
      await saveItem(normalizeItem({ ...item, id: item.id || createId() }));
    }
    await loadItems();
    syncCategoriesFromItems();
    syncLocationsFromItems();
  }
  if (incomingRecipes.length) {
    mergeRecipes(incomingRecipes);
    saveRecipes();
  }
  if (incomingPlannedRecipes.length) {
    mergePlannedRecipes(incomingPlannedRecipes);
    savePlannedRecipes();
  }
  if (payload?.mealPlanner && typeof payload.mealPlanner === "object") {
    const shoppingItems = normalizeShoppingReminders(
      payload.mealPlanner.shoppingItems,
      payload.mealPlanner.shopping
    );
    const fridgeStorage = normalizeFridgeStorage(
      payload.mealPlanner.fridgeStorage,
      payload.mealPlanner.fridgeSections,
      payload.mealPlanner.fridge
    );
    state.mealPlanner = {
      meals: payload.mealPlanner.meals || {},
      fridge: fridgeSectionText(fridgeStorage.chilled),
      fridgeSections: fridgeStorage.chilled,
      fridgeStorage,
      ideas: payload.mealPlanner.ideas || "",
      shopping: shoppingReminderText(shoppingItems),
      shoppingItems,
      shoppingCategories: normalizeShoppingCategories(payload.mealPlanner.shoppingCategories, shoppingItems)
    };
    localStorage.setItem(MEAL_PLANNER_KEY, JSON.stringify(state.mealPlanner));
    loadMealPlanner();
    importedMealPlanner = true;
  }
  refreshCategoryControls();
  refreshLocationControls();
  render();
  renderRecipes();
  return {
    items: Array.isArray(incomingItems) ? incomingItems.length : 0,
    recipes: incomingRecipes.length,
    plannedRecipes: incomingPlannedRecipes.length,
    mealPlanner: importedMealPlanner
  };
}

function downloadBackupText() {
  const text = (state.fullBackupText || "").trim();
  if (!text) {
    showToast("先生成 JSON");
    return;
  }
  const filename = `pantry-backup-${todaySlug()}.json`;
  downloadTextFile(filename, text);
}

function loadSyncSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(SYNC_SETTINGS_KEY) || "{}");
  } catch {
    saved = {};
  }
  if (els.githubOwner) els.githubOwner.value = saved.owner || DEFAULT_SYNC_OWNER;
  if (els.githubRepo) els.githubRepo.value = saved.repo || DEFAULT_SYNC_REPO;
  if (els.githubBranch) els.githubBranch.value = saved.branch || DEFAULT_SYNC_BRANCH;
  if (els.githubPath) els.githubPath.value = saved.path || DEFAULT_SYNC_PATH;
  if (els.githubToken) els.githubToken.value = saved.token || "";
}

function readSyncSettings() {
  return {
    owner: els.githubOwner?.value.trim() || "",
    repo: els.githubRepo?.value.trim() || "",
    branch: els.githubBranch?.value.trim() || DEFAULT_SYNC_BRANCH,
    path: (els.githubPath?.value.trim() || DEFAULT_SYNC_PATH).replace(/^\/+/, ""),
    token: els.githubToken?.value.trim() || ""
  };
}

function saveSyncSettingsFromForm() {
  const settings = readSyncSettings();
  if (!settings.owner || !settings.repo || !settings.token) {
    showToast("先填 Owner、Repo 和 Token");
    updateSyncStatus("Owner、Repo、Token 是必填。");
    return;
  }
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(settings));
  updateSyncStatus("同步设置已保存在这台设备。");
  showToast("同步设置已保存");
}

async function uploadGithubSync(target = "all") {
  const settings = syncSettingsForTarget(readSyncSettings(), target);
  if (!validateSyncSettings(settings)) return;
  saveSyncSettings(readSyncSettings());
  setSyncButtonsDisabled(true);
  const label = syncTargetLabel(target);
  updateSyncStatus(`正在上传${label}...`);
  try {
    const existing = await fetchGithubContent(settings, { allowMissing: true });
    const content = JSON.stringify(buildSyncPayload(target));
    const body = {
      message: `Update ${target} sync ${new Date().toISOString()}`,
      content: encodeBase64Utf8(content),
      branch: settings.branch
    };
    if (existing?.sha) body.sha = existing.sha;
    const response = await fetch(githubContentUrl(settings), {
      method: "PUT",
      headers: githubHeaders(settings),
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(await githubErrorMessage(response));
    updateSyncStatus(`已上传${label}到 ${settings.path}`);
    showToast(`已上传${label}`);
  } catch (error) {
    updateSyncStatus(error.message || "上传失败");
    showToast("GitHub 上传失败");
  } finally {
    setSyncButtonsDisabled(false);
  }
}

async function downloadGithubSync(target = "all") {
  const settings = syncSettingsForTarget(readSyncSettings(), target);
  if (!validateSyncSettings(settings)) return;
  saveSyncSettings(readSyncSettings());
  setSyncButtonsDisabled(true);
  const label = syncTargetLabel(target);
  updateSyncStatus(`正在同步${label}...`);
  try {
    const remote = await fetchGithubContent(settings);
    const payload = JSON.parse(decodeBase64Utf8(remote.content || ""));
    const result = await applyBackupPayload(payload, { requireItems: false });
    updateSyncStatus(`${label}同步完成：${formatSyncResult(result)}。`);
    showToast(`${label}同步完成`);
  } catch (error) {
    updateSyncStatus(error.message || "同步失败");
    showToast("GitHub 同步失败");
  } finally {
    setSyncButtonsDisabled(false);
  }
}

function saveSyncSettings(settings) {
  localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(settings));
}

function validateSyncSettings(settings) {
  if (!settings.owner || !settings.repo || !settings.path || !settings.token) {
    showToast("先填完整 GitHub Sync 设置");
    updateSyncStatus("Owner、Repo、File path、Token 都需要填写。");
    return false;
  }
  return true;
}

function currentSyncTarget() {
  if (state.activeTab === "meal") return "meal";
  if (state.activeTab === "recipes") return "recipes";
  return "pantry";
}

function syncSettingsForTarget(settings, target) {
  const file = SYNC_TARGETS[target]?.file;
  if (!file) return settings;
  return { ...settings, path: pathBesideSyncFile(settings.path, file) };
}

function pathBesideSyncFile(basePath, filename) {
  const parts = String(basePath || DEFAULT_SYNC_PATH)
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);
  parts.pop();
  return [...parts, filename].join("/") || filename;
}

function syncTargetLabel(target) {
  return SYNC_TARGETS[target]?.label || SYNC_TARGETS.all.label;
}

function updateCurrentSyncHint() {
  const label = syncTargetLabel(currentSyncTarget());
  updateSyncStatus(`当前 tab 是 ${label}。可以只上传/同步当前，也可以上传/同步全部。`);
}

async function fetchGithubContent(settings, options = {}) {
  const response = await fetch(`${githubContentUrl(settings)}?ref=${encodeURIComponent(settings.branch)}`, {
    headers: githubHeaders(settings)
  });
  if (response.status === 404 && options.allowMissing) return null;
  if (!response.ok) throw new Error(await githubErrorMessage(response));
  const data = await response.json();
  if (data.content) return data;
  if (!data.git_url) return data;
  const blobResponse = await fetch(data.git_url, { headers: githubHeaders(settings) });
  if (!blobResponse.ok) throw new Error(await githubErrorMessage(blobResponse));
  const blob = await blobResponse.json();
  return { ...data, content: blob.content || "" };
}

function githubContentUrl(settings) {
  return `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${settings.path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function githubHeaders(settings) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${settings.token}`,
    "content-type": "application/json"
  };
}

async function githubErrorMessage(response) {
  try {
    const data = await response.json();
    return data?.message ? `GitHub: ${data.message}` : `GitHub 请求失败 ${response.status}`;
  } catch {
    return `GitHub 请求失败 ${response.status}`;
  }
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function setSyncButtonsDisabled(disabled) {
  for (const button of [
    els.saveSyncSettingsButton,
    els.syncUploadCurrentButton,
    els.syncDownloadCurrentButton,
    els.syncUploadButton,
    els.syncDownloadButton
  ]) {
    if (button) button.disabled = disabled;
  }
}

function updateSyncStatus(message) {
  if (els.syncStatus) els.syncStatus.textContent = message;
}

function formatImportResult(result) {
  const parts = [];
  if (result.items) parts.push(`${result.items} 个库存`);
  if (result.recipes) parts.push(`${result.recipes} 个菜谱`);
  if (result.plannedRecipes) parts.push(`${result.plannedRecipes} 个准备做`);
  if (result.mealPlanner) parts.push("Meal Plan");
  return parts.length ? `导入了 ${parts.join("，")}` : "没有发现可导入的数据";
}

function formatSyncResult(result) {
  const parts = [];
  if (result.items) parts.push(`${result.items} 个库存`);
  if (result.recipes) parts.push(`${result.recipes} 个菜谱`);
  if (result.plannedRecipes) parts.push(`${result.plannedRecipes} 个准备做`);
  if (result.mealPlanner) parts.push("Meal Plan");
  return parts.length ? parts.join("，") : "没有新数据";
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function restoreChunkedBackup(text) {
  const trimmed = text.trim();
  if (!trimmed.includes(CHUNK_PREFIX)) return trimmed;
  const matches = [...trimmed.matchAll(/PANTRY_BACKUP_PART\s+(\S+)\s+(\d+)\/(\d+)\n([\s\S]*?)(?=\nPANTRY_BACKUP_PART\s+\S+\s+\d+\/\d+\n|$)/g)];
  if (!matches.length) return trimmed;
  const id = matches[0][1];
  const total = Number(matches[0][3]);
  const parts = new Array(total);
  for (const match of matches) {
    if (match[1] !== id) throw new Error("Mixed backup chunks");
    parts[Number(match[2]) - 1] = match[4];
  }
  if (parts.some((part) => part == null)) throw new Error("Missing backup chunk");
  return parts.join("");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function todaySlug() {
  return new Date().toISOString().slice(0, 10);
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.voiceButton.disabled = true;
    els.voiceLabel.textContent = "不可用";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join("");
    els.quickInput.value = transcript;
  };
  recognition.onend = () => {
    state.listening = false;
    els.voiceButton.classList.remove("is-listening");
    els.voiceLabel.textContent = "语音";
  };
  recognition.onerror = () => showToast("语音识别失败");
  state.recognition = recognition;
}

function toggleSpeech() {
  if (!state.recognition) return;
  if (state.listening) {
    state.recognition.stop();
    return;
  }
  state.listening = true;
  els.voiceButton.classList.add("is-listening");
  els.voiceLabel.textContent = "听写中";
  state.recognition.start();
}

function setupServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 1700);
}

function toDateInput(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function parseChineseNumber(value) {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value.includes("百")) {
    const [hundreds, rest = ""] = value.split("百");
    return (digits[hundreds] || 1) * 100 + (rest ? parseChineseNumber(rest) : 0);
  }
  if (value === "十") return 10;
  if (value.startsWith("十")) return 10 + (digits[value[1]] || 0);
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (digits[tens] || 1) * 10 + (digits[ones] || 0);
  }
  return digits[value] || Number(value) || 0;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
