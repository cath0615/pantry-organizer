const DB_NAME = "pantry-organizer";
const DB_VERSION = 1;
const STORE_NAME = "items";
const DEFAULT_CATEGORIES = ["调料", "干货", "速食", "零食", "冷藏", "冷冻", "罐头", "烘焙", "饮品", "其他"];
const DEFAULT_LOCATIONS = ["方便面柜", "零食柜", "工具柜", "烘焙柜", "储物柜", "调料柜", "冰箱"];
const QUANTITY_UNITS = "瓶|包|袋|罐|盒|个|斤|克|g|kg|ml|l|升|毫升|板|条|片|块|枚|根|支|箱|组|套|杯";
const STORAGE_KEY = "pantry-organizer-fallback";
const CATEGORIES_KEY = "pantry-organizer-categories";
const LOCATIONS_KEY = "pantry-organizer-locations";
const MEAL_PLANNER_KEY = "pantry-organizer-meal-planner";
const RECIPES_KEY = "pantry-organizer-recipes";
const BACKUP_CHUNK_SIZE = 180000;
const CHUNK_PREFIX = "PANTRY_BACKUP_PART";
const QUANTITY_PHRASE = `(?:数量|数目|有)?\\s*[一二两三四五六七八九十百\\d]+(?:\\.\\d+)?\\s*(?:${QUANTITY_UNITS})`;
const WEEK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const MEAL_SLOTS = [
  { id: "breakfast", label: "早饭" },
  { id: "lunch", label: "中饭" },
  { id: "dinner", label: "晚饭" }
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
  recipes: [],
  recipeQuery: "",
  recipeTag: "all",
  mealPlanner: {
    meals: {},
    ideas: "",
    shopping: ""
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
  manageCategoriesButton: $("manageCategoriesButton"),
  mealDayTabs: $("mealDayTabs"),
  mealGrid: $("mealGrid"),
  mealIdeasNote: $("mealIdeasNote"),
  shoppingNote: $("shoppingNote"),
  clearMealPlanButton: $("clearMealPlanButton"),
  clearMealNotesButton: $("clearMealNotesButton"),
  recipeLinkInput: $("recipeLinkInput"),
  recipeTagsInput: $("recipeTagsInput"),
  saveRecipeLinkButton: $("saveRecipeLinkButton"),
  clearRecipeLinkButton: $("clearRecipeLinkButton"),
  addRecipeButton: $("addRecipeButton"),
  recipeSearchInput: $("recipeSearchInput"),
  recipeTagFilter: $("recipeTagFilter"),
  exportRecipesButton: $("exportRecipesButton"),
  importRecipesInput: $("importRecipesInput"),
  recipeList: $("recipeList"),
  recipeEmptyState: $("recipeEmptyState"),
  recipeCount: $("recipeCount"),
  recipeDialog: $("recipeDialog"),
  recipeForm: $("recipeForm"),
  recipeDialogTitle: $("recipeDialogTitle"),
  recipeId: $("recipeId"),
  recipeCoverData: $("recipeCoverData"),
  recipeCoverInput: $("recipeCoverInput"),
  recipeCoverPreview: $("recipeCoverPreview"),
  recipeCoverPreviewImage: $("recipeCoverPreviewImage"),
  removeRecipeCoverButton: $("removeRecipeCoverButton"),
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
  exportCsvButton: $("exportCsvButton"),
  copyBackupButton: $("copyBackupButton"),
  copyChunkButton: $("copyChunkButton"),
  prevChunkButton: $("prevChunkButton"),
  nextChunkButton: $("nextChunkButton"),
  downloadBackupButton: $("downloadBackupButton"),
  importTextButton: $("importTextButton"),
  backupOutput: $("backupOutput"),
  backupStatus: $("backupStatus"),
  chunkStatus: $("chunkStatus"),
  categoryNameInput: $("categoryNameInput"),
  addCategoryButton: $("addCategoryButton"),
  categoryList: $("categoryList"),
  importFileInput: $("importFileInput"),
  toast: $("toast")
};

init();

async function init() {
  loadCategories();
  loadLocations();
  renderMealPlanner();
  loadMealPlanner();
  loadRecipes();
  bindEvents();
  setupSpeech();
  setupServiceWorker();
  await initStorage();
  await loadItems();
  syncCategoriesFromItems();
  syncLocationsFromItems();
  refreshCategoryControls();
  refreshLocationControls();
  renderCategoryList();
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
  on(els.manageCategoriesButton, "click", () => openCategoryManager());
  on(els.mealDayTabs, "click", switchMealDay);
  on(els.mealGrid, "input", saveMealPlanner);
  on(els.mealIdeasNote, "input", saveMealPlanner);
  on(els.shoppingNote, "input", saveMealPlanner);
  on(els.clearMealPlanButton, "click", clearMealPlan);
  on(els.clearMealNotesButton, "click", clearMealNotes);
  on(els.saveRecipeLinkButton, "click", saveRecipeFromLinkInput);
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
  on(els.exportRecipesButton, "click", exportRecipes);
  on(els.importRecipesInput, "change", importRecipes);
  on(els.recipeForm, "submit", handleRecipeSubmit);
  on(els.deleteRecipeButton, "click", deleteCurrentRecipe);
  on(els.closeRecipeDialogButton, "click", () => els.recipeDialog.close());
  on(els.recipeCoverInput, "change", handleRecipeCoverInput);
  on(els.removeRecipeCoverButton, "click", removeCurrentRecipeCover);
  on(els.addRecipeCategoryButton, "click", addRecipeCategoryFromDialog);
  on(els.recipeCategoryInput, "keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addRecipeCategoryFromDialog();
  });
  on(els.recipeSelectedTags, "click", removeRecipeCategoryFromDialog);
  on(els.addBlankButton, "click", () => openItemDialog());
  on(els.itemForm, "submit", handleItemSubmit);
  on(els.deleteItemButton, "click", deleteCurrentItem);
  on(els.closeItemDialogButton, "click", () => els.itemDialog.close());
  on(els.itemPhotoInput, "change", handlePhotoInput);
  on(els.removePhotoButton, "click", removeCurrentPhoto);
  on(els.backupButton, "click", () => {
    openBackupDialog();
  });
  on(els.exportJsonButton, "click", exportJson);
  on(els.exportCsvButton, "click", exportCsv);
  on(els.copyBackupButton, "click", copyBackupText);
  on(els.copyChunkButton, "click", copyCurrentChunk);
  on(els.prevChunkButton, "click", () => showBackupChunk(state.activeChunkIndex - 1));
  on(els.nextChunkButton, "click", () => showBackupChunk(state.activeChunkIndex + 1));
  on(els.downloadBackupButton, "click", downloadBackupText);
  on(els.importTextButton, "click", importJsonFromTextArea);
  on(els.importFileInput, "change", importJson);
  on(els.voiceButton, "click", toggleSpeech);
  on(els.addCategoryButton, "click", addCategoryFromInput);
  on(els.categoryNameInput, "keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addCategoryFromInput();
  });
  on(els.categoryList, "click", deleteCategoryFromList);
}

function switchTab(event) {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  const activeTab = button.dataset.tab;
  for (const tabButton of els.appTabs.querySelectorAll("button[data-tab]")) {
    const isActive = tabButton.dataset.tab === activeTab;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  }
  for (const panel of document.querySelectorAll("[data-tab-panel]")) {
    panel.classList.toggle("is-active", panel.dataset.tabPanel === activeTab);
  }
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
  for (const tabButton of els.mealDayTabs.querySelectorAll("button[data-day]")) {
    const isActive = tabButton.dataset.day === state.activeMealDay;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  }
  for (const card of els.mealGrid.querySelectorAll(".meal-day-card")) {
    card.classList.toggle("is-active", card.dataset.day === state.activeMealDay);
  }
}

function loadMealPlanner() {
  if (!els.mealGrid) return;
  try {
    const saved = JSON.parse(localStorage.getItem(MEAL_PLANNER_KEY) || "{}");
    state.mealPlanner = {
      meals: saved.meals || {},
      ideas: saved.ideas || "",
      shopping: saved.shopping || ""
    };
  } catch {
    state.mealPlanner = { meals: {}, ideas: "", shopping: "" };
  }

  for (const input of els.mealGrid.querySelectorAll(".meal-input")) {
    const key = mealKey(input.dataset.day, input.dataset.meal);
    input.value = state.mealPlanner.meals[key] || "";
  }
  if (els.mealIdeasNote) els.mealIdeasNote.value = state.mealPlanner.ideas;
  if (els.shoppingNote) els.shoppingNote.value = state.mealPlanner.shopping;
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
    ideas: els.mealIdeasNote?.value || "",
    shopping: els.shoppingNote?.value || ""
  };
  localStorage.setItem(MEAL_PLANNER_KEY, JSON.stringify(state.mealPlanner));
}

function clearMealPlan() {
  if (!els.mealGrid) return;
  for (const input of els.mealGrid.querySelectorAll(".meal-input")) input.value = "";
  saveMealPlanner();
  showToast("已清空计划");
}

function clearMealNotes() {
  if (els.mealIdeasNote) els.mealIdeasNote.value = "";
  if (els.shoppingNote) els.shoppingNote.value = "";
  saveMealPlanner();
  showToast("已清空备忘");
}

function mealKey(day, meal) {
  return `${day}:${meal}`;
}

function loadRecipes() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECIPES_KEY) || "[]");
    state.recipes = Array.isArray(saved) ? saved.map(normalizeRecipe).filter((recipe) => recipe.title) : [];
  } catch {
    state.recipes = [];
  }
}

function saveRecipes() {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(state.recipes));
}

async function saveRecipeFromLinkInput() {
  const text = els.recipeLinkInput.value.trim();
  if (!text) {
    showToast("先粘贴链接");
    return;
  }
  const url = extractRecipeUrl(text);
  if (!url) {
    showToast("没有找到链接");
    return;
  }
  const existing = state.recipes.find((recipe) => recipe.url === url);
  let preview = null;
  if (!existing) {
    showToast("正在抓取封面");
    preview = await fetchRecipePreview(url);
  }
  openRecipeDialog({
    ...(existing || {}),
    id: existing?.id || "",
    title: existing?.title || extractRecipeTitle(text) || preview?.title || "未命名菜谱",
    url: preview?.finalUrl || url,
    tags: existing?.tags || parseTags(els.recipeTagsInput.value),
    coverData: existing?.coverData || preview?.coverData || "",
    sourceText: text
  });
  showToast(existing ? "已打开已有菜谱" : "确认后保存");
}

async function fetchRecipePreview(url) {
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
  showToast("未连接本地抓取服务");
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
  if (els.recipeTagsInput) els.recipeTagsInput.value = "";
}

function extractRecipeUrl(text) {
  const match = text.match(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com|xhs\.cn|xhsurl\.com)\/[^\s，。；;,）)】]+/i);
  return match ? match[0] : "";
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
  card.innerHTML = `
    <div class="recipe-thumb recipe-thumb-placeholder"></div>
    <div class="recipe-card-content">
      <button class="recipe-title-button" type="button"></button>
      <div class="recipe-tags"></div>
      <p class="recipe-summary"></p>
      <a class="recipe-link" target="_blank" rel="noopener">打开链接</a>
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
  const summary = [recipe.ingredients, recipe.notes, recipe.steps].filter(Boolean).join(" · ");
  const summaryElement = card.querySelector(".recipe-summary");
  summaryElement.textContent = summary.slice(0, 120);
  summaryElement.classList.toggle("is-hidden", !summary);
  const link = card.querySelector(".recipe-link");
  link.href = recipe.url || "#";
  link.classList.toggle("is-hidden", !recipe.url);
  return card;
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
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
}

function openRecipeDialog(recipe = null) {
  const isEditing = Boolean(recipe?.id);
  const isDraftFromLink = Boolean(recipe && recipe.url && !recipe.id);
  els.recipeDialogTitle.textContent = isDraftFromLink ? "确认菜谱" : isEditing ? "编辑菜谱" : "手动添加";
  els.recipeId.value = recipe?.id || "";
  els.recipeTitle.value = recipe?.title || "";
  els.recipeUrl.value = recipe?.url || "";
  setRecipeDialogTags(recipe?.tags || []);
  if (els.recipeCategoryInput) els.recipeCategoryInput.value = "";
  els.recipeIngredients.value = recipe?.ingredients || "";
  els.recipeSteps.value = recipe?.steps || "";
  els.recipeNotes.value = recipe?.notes || "";
  setRecipeCoverPreview(recipe?.coverData || "");
  if (els.recipeCoverInput) els.recipeCoverInput.value = "";
  els.deleteRecipeButton.classList.toggle("is-hidden", !isEditing);
  els.recipeDialog.showModal();
  window.setTimeout(() => els.recipeTitle?.focus(), 80);
}

async function handleRecipeSubmit(event) {
  event.preventDefault();
  await waitForPendingPhotos();
  const id = els.recipeId.value || createId();
  const existing = state.recipes.find((recipe) => recipe.id === id);
  const recipe = normalizeRecipe({
    id,
    title: els.recipeTitle.value,
    url: els.recipeUrl.value,
    tags: getRecipeDialogTags(),
    ingredients: els.recipeIngredients.value,
    steps: els.recipeSteps.value,
    notes: els.recipeNotes.value,
    coverData: els.recipeCoverData.value,
    sourceText: existing?.sourceText || "",
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
  saveRecipes();
  els.recipeDialog.close();
  renderRecipes();
  showToast("菜谱已保存");
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
  saveRecipes();
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
    recipes: state.recipes
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
    const existingById = new Map(state.recipes.map((recipe) => [recipe.id, recipe]));
    const existingByUrl = new Map(state.recipes.filter((recipe) => recipe.url).map((recipe) => [recipe.url, recipe]));
    for (const item of incoming) {
      const recipe = normalizeRecipe({ ...item, id: item.id || createId() });
      const existing = existingById.get(recipe.id) || (recipe.url ? existingByUrl.get(recipe.url) : null);
      if (existing) state.recipes = state.recipes.map((current) => (current.id === existing.id ? { ...existing, ...recipe } : current));
      else state.recipes.push(recipe);
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
    sourceText: String(recipe.sourceText || "").trim(),
    createdAt: recipe.createdAt || new Date().toISOString(),
    updatedAt: recipe.updatedAt || recipe.createdAt || new Date().toISOString()
  };
}

function openBackupDialog() {
  renderCategoryList();
  els.backupDialog.showModal();
}

function openCategoryManager() {
  openBackupDialog();
  window.setTimeout(() => els.categoryNameInput?.focus(), 80);
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
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
  const previousItemCategory = els.itemCategory.value || "其他";

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
  els.itemCategory.value = state.categories.includes(previousItemCategory) ? previousItemCategory : "其他";
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

function renderCategoryList() {
  els.categoryList.replaceChildren();
  for (const category of state.categories) {
    const chip = document.createElement("span");
    const isDefault = DEFAULT_CATEGORIES.includes(category);
    chip.className = `category-chip${isDefault ? " is-default" : ""}`;
    chip.innerHTML = `<span></span><button type="button" aria-label="删除分类">×</button>`;
    chip.querySelector("span").textContent = category;
    chip.querySelector("button").dataset.category = category;
    els.categoryList.append(chip);
  }
}

function addCategoryFromInput() {
  const category = normalizeCategoryName(els.categoryNameInput.value);
  if (!category) {
    showToast("先输入分类名");
    return;
  }
  if (state.categories.includes(category)) {
    showToast("这个分类已经有了");
    return;
  }
  state.categories = orderCategories([...state.categories, category]);
  saveCategories();
  refreshCategoryControls();
  renderCategoryList();
  els.categoryNameInput.value = "";
  showToast("已添加分类");
}

function deleteCategoryFromList(event) {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  const category = button.dataset.category;
  if (DEFAULT_CATEGORIES.includes(category)) {
    showToast("默认分类会保留");
    return;
  }
  if (state.items.some((item) => item.category === category)) {
    showToast("这个分类还在使用中");
    return;
  }
  state.categories = state.categories.filter((existing) => existing !== category);
  saveCategories();
  refreshCategoryControls();
  renderCategoryList();
  render();
  showToast("已删除分类");
}

function ensureCategory(value) {
  const category = normalizeCategoryName(value) || "其他";
  if (!state.categories.includes(category)) {
    state.categories = orderCategories([...state.categories, category]);
    saveCategories();
    refreshCategoryControls();
    renderCategoryList();
  }
  return category;
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
    const locationSelect = card.querySelector('select[data-field="location"]');
    locationSelect.append(new Option("未设置", ""));
    for (const location of getLocationOptions()) {
      locationSelect.append(new Option(location, location));
    }
    for (const input of card.querySelectorAll("[data-field]")) {
      const field = input.dataset.field;
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
  els.itemCategory.value = item?.category || "其他";
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
    category: els.itemCategory.value,
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
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: state.categories,
    locations: state.locations,
    items: state.items
  };
  const content = JSON.stringify(payload);
  state.fullBackupText = content;
  state.backupChunks = makeBackupChunks(content);
  showBackupChunk(0);
  updateBackupStatus(content, true);
  showToast(state.backupChunks.length > 1 ? "分段 JSON 已生成" : "JSON 已生成");
}

function exportCsv() {
  const header = ["name", "category", "expireDate", "quantity", "unit", "location", "opened", "notes"];
  const rows = state.items.map((item) => header.map((key) => csvCell(item[key])).join(","));
  const content = [header.join(","), ...rows].join("\n");
  state.fullBackupText = content;
  state.backupChunks = [];
  state.activeChunkIndex = 0;
  els.backupOutput.value = content;
  updateBackupStatus(content, false);
  updateChunkStatus("CSV 不包含图片，不需要分段。");
  showToast("CSV 已生成，可以复制");
}

function updateBackupStatus(content, includesPhotos) {
  const photoCount = state.items.filter((item) => item.photoData).length;
  const size = formatBytes(new Blob([content]).size);
  const photoText = includesPhotos ? `包含 ${photoCount} 张图片` : "CSV 不包含图片";
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

function showBackupChunk(index) {
  if (!state.backupChunks.length) return;
  state.activeChunkIndex = Math.max(0, Math.min(index, state.backupChunks.length - 1));
  els.backupOutput.value = state.backupChunks[state.activeChunkIndex];
  if (state.backupChunks.length === 1) {
    updateChunkStatus("备份较小，可以直接复制或下载。");
    return;
  }
  updateChunkStatus(`正在显示第 ${state.activeChunkIndex + 1}/${state.backupChunks.length} 段。请逐段复制保存。`);
}

function updateChunkStatus(message) {
  if (els.chunkStatus) els.chunkStatus.textContent = message;
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    await importBackupText(text);
  } catch {
    showToast("导入失败");
  } finally {
    event.target.value = "";
  }
}

async function importJsonFromTextArea() {
  try {
    await importBackupText(els.backupOutput.value);
  } catch {
    showToast("导入失败");
  }
}

async function importBackupText(text) {
  const payload = JSON.parse(restoreChunkedBackup(text).trim());
  const incoming = Array.isArray(payload) ? payload : payload.items;
  if (!Array.isArray(incoming)) throw new Error("Invalid backup");
  if (Array.isArray(payload.categories)) {
    state.categories = orderCategories([...state.categories, ...payload.categories]);
    saveCategories();
    refreshCategoryControls();
    renderCategoryList();
  }
  if (Array.isArray(payload.locations)) {
    state.locations = orderLocations([...state.locations, ...payload.locations]);
    saveLocations();
    refreshLocationControls();
  }
  for (const item of incoming) {
    await saveItem(normalizeItem({ ...item, id: item.id || createId() }));
  }
  await loadItems();
  syncCategoriesFromItems();
  syncLocationsFromItems();
  refreshCategoryControls();
  refreshLocationControls();
  renderCategoryList();
  render();
  showToast(`导入了 ${incoming.length} 条`);
}

async function copyBackupText() {
  const text = state.backupChunks.length > 1 ? els.backupOutput.value.trim() : (state.fullBackupText || els.backupOutput.value).trim();
  if (!text) {
    showToast("先生成 JSON");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制");
  } catch {
    els.backupOutput.focus();
    els.backupOutput.select();
    showToast("已选中文本");
  }
}

async function copyCurrentChunk() {
  const text = els.backupOutput.value.trim();
  if (!text) {
    showToast("先生成 JSON");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(state.backupChunks.length > 1 ? `已复制第 ${state.activeChunkIndex + 1} 段` : "已复制");
  } catch {
    els.backupOutput.focus();
    els.backupOutput.select();
    showToast("已选中当前段");
  }
}

function downloadBackupText() {
  const text = (state.fullBackupText || els.backupOutput.value).trim();
  if (!text) {
    showToast("先生成 JSON");
    return;
  }
  const isJson = text.startsWith("{") || text.startsWith("[");
  const filename = isJson ? `pantry-backup-${todaySlug()}.txt` : `pantry-backup-${todaySlug()}.csv`;
  downloadTextFile(filename, text);
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
    navigator.serviceWorker.register("./sw.js").catch(() => {});
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
