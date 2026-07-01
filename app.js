const DB_NAME = "pantry-organizer";
const DB_VERSION = 1;
const STORE_NAME = "items";
const DEFAULT_CATEGORIES = ["调料", "干货", "冷藏", "冷冻", "罐头", "烘焙", "饮品", "其他"];
const STORAGE_KEY = "pantry-organizer-fallback";
const CATEGORIES_KEY = "pantry-organizer-categories";

const state = {
  items: [],
  drafts: [],
  categories: [...DEFAULT_CATEGORIES],
  status: "all",
  category: "all",
  query: "",
  db: null,
  fallback: false,
  recognition: null,
  listening: false,
  pendingPhotoTasks: new Set()
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
  draftPanel: $("draftPanel"),
  draftList: $("draftList"),
  saveDraftButton: $("saveDraftButton"),
  discardDraftButton: $("discardDraftButton"),
  itemList: $("itemList"),
  emptyState: $("emptyState"),
  searchInput: $("searchInput"),
  statusFilter: $("statusFilter"),
  categoryFilter: $("categoryFilter"),
  manageCategoriesButton: $("manageCategoriesButton"),
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
  downloadBackupButton: $("downloadBackupButton"),
  importTextButton: $("importTextButton"),
  backupOutput: $("backupOutput"),
  backupStatus: $("backupStatus"),
  categoryNameInput: $("categoryNameInput"),
  addCategoryButton: $("addCategoryButton"),
  categoryList: $("categoryList"),
  importFileInput: $("importFileInput"),
  toast: $("toast")
};

init();

async function init() {
  loadCategories();
  bindEvents();
  setupSpeech();
  setupServiceWorker();
  await initStorage();
  await loadItems();
  syncCategoriesFromItems();
  refreshCategoryControls();
  renderCategoryList();
  render();
}

function bindEvents() {
  on(els.parseButton, "click", handleParse);
  on(els.clearInputButton, "click", () => {
    els.quickInput.value = "";
    els.quickInput.focus();
  });
  on(els.saveDraftButton, "click", saveDrafts);
  on(els.discardDraftButton, "click", clearDrafts);
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
  on(els.manageCategoriesButton, "click", () => openCategoryManager());
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

  return chunks.map((chunk) => {
    const dateInfo = extractDate(chunk) || extractDate(normalized);
    const opened = /开封|打开|已开/.test(chunk);
    const quantityInfo = extractQuantity(chunk);
    const cleanName = extractName(chunk);
    return {
      id: createId(),
      name: cleanName || chunk.slice(0, 18) || "未命名",
      category: guessCategory(chunk),
      expireDate: dateInfo?.date || "",
      expireDatePrecision: dateInfo?.precision || "unknown",
      quantity: quantityInfo?.quantity || "",
      unit: quantityInfo?.unit || "",
      location: extractLocation(chunk) || sharedLocation || "",
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

  if (datedClauses.length) return datedClauses.slice(0, 8);

  const byConnector = cleaned
    .split(/(?:还有|另外|以及|和|跟|、)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isDetailClause(part));
  return (byConnector.length ? byConnector : clauses).slice(0, 8);
}

function isDetailClause(text) {
  return /^(都)?(放在|放到|放|位置|备注|开封|已开封|数量)/.test(text.trim());
}

function extractName(text) {
  let value = text
    .replace(/^(我)?(今天|刚刚)?(买了|买|有|新增|添加)/, "")
    .replace(/(明年|今年|后年|下个月|这个月|月底|年底|春节前|过年前).*/, "")
    .replace(/\d{4}\s*[年/-]\s*\d{1,2}.*/, "")
    .replace(/\d{1,2}\s*月.*/, "")
    .replace(/(过期|到期|保质期|用完|放在|放|备注|数量|开封).*/, "")
    .replace(/\d+(\.\d+)?\s*(瓶|包|袋|罐|盒|个|斤|克|g|kg|ml|l|升|毫升)/i, "")
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
  const match = text.match(/(?:放在|放到|放|位置是|在)([^，,。；;]+?)(?:$|，|,|。|；|;|备注|过期)/);
  return match ? match[1].trim() : "";
}

function extractNotes(text) {
  const match = text.match(/备注(?:是|:|：)?([^，,。；;]+)/);
  return match ? match[1].trim() : "";
}

function extractQuantity(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(瓶|包|袋|罐|盒|个|斤|克|g|kg|ml|l|升|毫升)/i);
  return match ? { quantity: Number(match[1]), unit: match[2] } : null;
}

function guessCategory(text) {
  if (/酱油|生抽|老抽|醋|盐|糖|胡椒|花椒|八角|桂皮|孜然|辣椒|豆瓣|味淋|料酒|蚝油|香油|调料|香料|酱/.test(text)) return "调料";
  if (/木耳|香菇|米|面|粉|豆|干|紫菜|海带/.test(text)) return "干货";
  if (/牛奶|酸奶|奶酪|鸡蛋|豆腐|冷藏/.test(text)) return "冷藏";
  if (/冷冻|冻|冰箱冷冻|速冻/.test(text)) return "冷冻";
  if (/罐头|罐/.test(text)) return "罐头";
  if (/面粉|酵母|泡打粉|黄油|烘焙/.test(text)) return "烘焙";
  if (/茶|咖啡|饮料|果汁|酒/.test(text)) return "饮品";
  return "其他";
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

function orderCategories(categories) {
  const unique = [...new Set(categories.map(normalizeCategoryName).filter(Boolean))];
  const defaultsWithoutOther = DEFAULT_CATEGORIES.filter((category) => category !== "其他");
  const custom = unique.filter((category) => !DEFAULT_CATEGORIES.includes(category)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  return [...defaultsWithoutOther, ...custom, "其他"];
}

function render() {
  const sorted = [...state.items].sort(compareByExpiry);
  const filtered = sorted.filter(matchesFilters);
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
        <label>位置<input data-field="location" /></label>
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
    card.querySelector("select").append(...state.categories.map((category) => new Option(category, category)));
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
  els.itemDialog.close();
  render();
  showToast("已保存");
}

async function deleteCurrentItem() {
  const id = els.itemId.value;
  if (!id) return;
  await removeItem(id);
  await loadItems();
  els.itemDialog.close();
  render();
  showToast("已删除");
}

function normalizeItem(item) {
  const category = ensureCategory(item.category);
  return {
    id: item.id || createId(),
    name: String(item.name || "").trim(),
    category,
    expireDate: item.expireDate || "",
    expireDatePrecision: item.expireDatePrecision || (item.expireDate ? "day" : "unknown"),
    quantity: item.quantity === "" || item.quantity == null ? "" : Number(item.quantity),
    unit: String(item.unit || "").trim(),
    location: String(item.location || "").trim(),
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
  if (state.status !== "all" && getExpiryStatus(item.expireDate) !== state.status) return false;
  return true;
}

function compareByExpiry(a, b) {
  if (!a.expireDate && !b.expireDate) return a.name.localeCompare(b.name, "zh-Hans-CN");
  if (!a.expireDate) return 1;
  if (!b.expireDate) return -1;
  return a.expireDate.localeCompare(b.expireDate);
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
    items: state.items
  };
  const content = JSON.stringify(payload);
  els.backupOutput.value = content;
  updateBackupStatus(content, true);
  showToast("完整 JSON 已生成");
}

function exportCsv() {
  const header = ["name", "category", "expireDate", "quantity", "unit", "location", "opened", "notes"];
  const rows = state.items.map((item) => header.map((key) => csvCell(item[key])).join(","));
  const content = [header.join(","), ...rows].join("\n");
  els.backupOutput.value = content;
  updateBackupStatus(content, false);
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
  const payload = JSON.parse(text.trim());
  const incoming = Array.isArray(payload) ? payload : payload.items;
  if (!Array.isArray(incoming)) throw new Error("Invalid backup");
  if (Array.isArray(payload.categories)) {
    state.categories = orderCategories([...state.categories, ...payload.categories]);
    saveCategories();
    refreshCategoryControls();
    renderCategoryList();
  }
  for (const item of incoming) {
    await saveItem(normalizeItem({ ...item, id: item.id || createId() }));
  }
  await loadItems();
  syncCategoriesFromItems();
  refreshCategoryControls();
  renderCategoryList();
  render();
  showToast(`导入了 ${incoming.length} 条`);
}

async function copyBackupText() {
  const text = els.backupOutput.value.trim();
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

function downloadBackupText() {
  const text = els.backupOutput.value.trim();
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
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
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
