const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const PORT = Number(process.env.PORT || 5173);
const PUBLIC_DIR = __dirname;
const XHS_PROJECT_DIR = process.env.XHS_READER_DIR || "/Users/josh/Documents/Codex/2026-06-26/wo";
const DEFAULT_XHS_LIKED_URL = "https://www.xiaohongshu.com/user/profile/5909e6ed82ec39715860d419?tab=liked";
const { readXhsWithPlaywright, PROFILE_DIR, SYSTEM_CHROME_PATH } = require(path.join(XHS_PROJECT_DIR, "xhs-reader"));
let xhsLikedSession = null;

function getXhsPlaywright() {
  try {
    return require(path.join(XHS_PROJECT_DIR, "node_modules", "playwright"));
  } catch {
    return null;
  }
}

function xhsDesktopContextOptions() {
  return {
    headless: false,
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    executablePath: fs.existsSync(SYSTEM_CHROME_PATH) ? SYSTEM_CHROME_PATH : undefined,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--disable-dev-shm-usage"]
  };
}

function pickPrimaryImages(media, limit = 40) {
  const seen = new Set();
  const candidates = [];
  const items = media || [];
  const hasVideo = items.some((item) => item?.tag === "video");
  let sawPrimaryImage = false;
  let sawVideo = false;

  for (const item of items) {
    if (!item) continue;
    if (item.tag === "video") {
      sawVideo = true;
      continue;
    }
    if (item.tag !== "img" || !item.src) continue;

    const src = String(item.src).replace(/^http:/i, "https:");
    const isAvatar = src.includes("sns-avatar");
    const isComment = src.includes("comment/");
    const isSticker = src.includes("picasso-static");
    const isXhsImage = src.includes("xhscdn.com");
    const isPrimaryLike = isXhsImage && !isAvatar && !isComment && !isSticker;

    if (isAvatar && sawPrimaryImage) break;
    if (hasVideo && !sawVideo) continue;
    if (!isPrimaryLike) continue;
    if (seen.has(src)) continue;
    seen.add(src);
    candidates.push(src);
    sawPrimaryImage = true;
    if (candidates.length >= limit) break;
  }

  return candidates;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const requestUrlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const safePath = requestUrlPath === "/" ? "/index.html" : requestUrlPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml"
    };
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleXhsPreview(req, res) {
  const payload = await readBody(req);
  const url = String(payload.url || "").trim();
  if (!/^https?:\/\//.test(url)) {
    sendJson(res, 400, { ok: false, error: "Invalid URL" });
    return;
  }

  const result = await readXhsWithPlaywright(url, { sourceType: "article", settleMs: 6000 });
  const imageOptions = pickPrimaryImages(result.media, 40);
  const coverUrl = imageOptions[0] || "";
  const coverData = coverUrl ? await imageUrlToDataUrl(coverUrl).catch(() => "") : "";
  const recipeText = extractRecipeText(result.text || "", result.title || "");
  sendJson(res, 200, {
    ok: Boolean(result.ok || result.title || coverData),
    title: cleanPreviewTitle(result.title || ""),
    finalUrl: result.finalUrl || url,
    coverUrl,
    coverData,
    imageOptions: imageOptions.map((imageUrl, index) => ({ index: index + 1, url: imageUrl })),
    ingredients: recipeText.ingredients,
    steps: recipeText.steps,
    rawText: recipeText.rawText,
    error: result.error || ""
  });
}

async function handleXhsImageData(req, res) {
  const payload = await readBody(req);
  const urls = Array.isArray(payload.urls) ? payload.urls.slice(0, 6) : [];
  const photos = [];
  for (const value of urls) {
    const url = String(value || "").trim();
    if (!/^https:\/\/[^/]*xhscdn\.com\//i.test(url)) continue;
    const data = await imageUrlToDataUrl(url).catch(() => "");
    if (data) photos.push(data);
  }
  sendJson(res, 200, { ok: true, photos });
}

async function clickVisibleXhsText(page, labels) {
  return page.evaluate((targetLabels) => {
    const candidates = [...document.querySelectorAll('a, button, [role="tab"], [role="button"], span, div')];
    const element = candidates.find((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return targetLabels.includes(node.textContent?.trim())
        && rect.width > 0
        && rect.height > 0
        && style.visibility !== "hidden"
        && style.display !== "none";
    });
    if (!element) return false;
    element.click();
    return true;
  }, labels);
}

async function clickXhsProfileLikedTab(page) {
  return page.evaluate(() => {
    const isVisible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0
        && rect.height > 0
        && style.visibility !== "hidden"
        && style.display !== "none";
    };
    const candidates = [...document.querySelectorAll('a, button, [role="tab"], [role="button"], span, div')]
      .filter((node) => ["点赞", "赞过"].includes(node.textContent?.trim()) && isVisible(node));
    const tab = candidates.find((node) => {
      let parent = node.parentElement;
      for (let depth = 0; parent && depth < 4; depth += 1, parent = parent.parentElement) {
        const text = parent.textContent || "";
        if (text.includes("笔记") && text.includes("收藏")) return true;
      }
      return false;
    });
    if (!tab) return false;
    tab.click();
    return true;
  });
}

async function openXhsLikedPage(page, likedUrl) {
  await page.goto(likedUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);

  if (await clickXhsProfileLikedTab(page)) {
    await page.waitForTimeout(2500);
    return true;
  }

  if (await clickVisibleXhsText(page, ["我"])) {
    await page.waitForTimeout(2500);
  }
  if (await clickXhsProfileLikedTab(page)) {
    await page.waitForTimeout(2500);
    return true;
  }
  return false;
}

async function waitForXhsLogin(page, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !page.isClosed()) {
    const loggedIn = await page.evaluate(() => {
      const isVisible = (node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0
          && rect.height > 0
          && style.visibility !== "hidden"
          && style.display !== "none";
      };
      const loginPanelVisible = [...document.querySelectorAll("body *")].some((node) => {
        const text = node.textContent?.trim();
        return ["手机号登录", "登录后推荐更懂你的笔记"].includes(text) && isVisible(node);
      });
      const profileLinkVisible = [...document.querySelectorAll('a[href*="/user/profile/"]')].some(isVisible);
      return profileLinkVisible && !loginPanelVisible;
    }).catch(() => false);
    if (loggedIn) {
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function handleXhsLikedRecipes(req, res) {
  const payload = await readBody(req);
  const limit = Math.max(1, Math.min(Number(payload.limit) || 10, 30));
  const likedUrl = String(payload.url || DEFAULT_XHS_LIKED_URL).trim();
  const playwright = getXhsPlaywright();
  if (!playwright) {
    sendJson(res, 500, { ok: false, error: "Playwright is not installed" });
    return;
  }

  let context;
  let keepSessionOpen = false;
  try {
    if (xhsLikedSession?.context) {
      context = xhsLikedSession.context;
    } else {
      context = await playwright.chromium.launchPersistentContext(PROFILE_DIR, xhsDesktopContextOptions());
      xhsLikedSession = { context };
    }
    const page = context.pages()[0] || (await context.newPage());
    let clickedLiked = await openXhsLikedPage(page, likedUrl);
    if (!clickedLiked) {
      await page.goto("https://www.xiaohongshu.com/explore", {
        waitUntil: "domcontentloaded",
        timeout: 60_000
      });
      await page.waitForTimeout(2000);
      if (await clickVisibleXhsText(page, ["登录"])) {
        await page.waitForTimeout(1000);
      }
      const loggedIn = await waitForXhsLogin(page);
      if (!loggedIn) {
        keepSessionOpen = true;
        sendJson(res, 200, {
          ok: false,
          needsLogin: true,
          error: "等待登录超时。请在弹出的桌面版小红书完成登录，然后重新点击抓取点赞。"
        });
        return;
      }
      clickedLiked = await openXhsLikedPage(page, likedUrl);
      if (!clickedLiked) {
        keepSessionOpen = true;
        sendJson(res, 200, {
          ok: false,
          error: "已经登录，但没有找到“点赞”标签。请确认弹出的页面是你的个人主页。"
        });
        return;
      }
    }

    const items = new Map();
    for (let attempt = 0; attempt < 8 && items.size < limit; attempt += 1) {
      const found = await page.locator("section.note-item[data-note-id]").evaluateAll((cards) => cards.map((card) => {
        const link = card.querySelector('a.cover[href*="xsec_token="], a.title[href*="xsec_token="]');
        if (!link) return null;
        return {
          url: new URL(link.getAttribute("href"), location.origin).href,
          title: card.querySelector("a.title")?.textContent?.trim() || ""
        };
      }).filter(Boolean));
      for (const item of found) {
        if (!item.url || items.has(item.url)) continue;
        items.set(item.url, item);
        if (items.size >= limit) break;
      }
      if (items.size >= limit) break;
      await page.mouse.wheel(0, 800).catch(() => {});
      await page.waitForTimeout(900);
    }

    if (!items.size) {
      keepSessionOpen = true;
      sendJson(res, 200, { ok: false, needsLogin: true, error: "没有找到点赞列表。请确认弹出的桌面版小红书已登录并能看到“笔记 / 收藏 / 点赞”，然后再点击一次抓取点赞。" });
      return;
    }
    sendJson(res, 200, { ok: true, items: [...items.values()].slice(0, limit) });
    await context.close().catch(() => {});
    xhsLikedSession = null;
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "读取点赞列表失败" });
  } finally {
    if (context && !keepSessionOpen && xhsLikedSession?.context === context) {
      await context.close().catch(() => {});
      xhsLikedSession = null;
    }
  }
}

function xhsNoteIdFromUrl(value) {
  try {
    const pathname = new URL(value).pathname;
    return pathname.match(/^\/(?:explore|discovery\/item)\/([^/]+)/)?.[1]
      || pathname.match(/^\/user\/profile\/[^/]+\/([^/]+)/)?.[1]
      || "";
  } catch {
    return "";
  }
}

async function handleXhsUnlike(req, res) {
  const payload = await readBody(req);
  const noteId = xhsNoteIdFromUrl(String(payload.url || "").trim());
  if (!/^[a-zA-Z0-9]+$/.test(noteId)) {
    sendJson(res, 400, { ok: false, error: "Invalid Xiaohongshu post URL" });
    return;
  }
  const playwright = getXhsPlaywright();
  if (!playwright) {
    sendJson(res, 500, { ok: false, error: "Playwright is not installed" });
    return;
  }

  let context;
  try {
    context = await playwright.chromium.launchPersistentContext(PROFILE_DIR, xhsDesktopContextOptions());
    const page = context.pages()[0] || (await context.newPage());
    const opened = await openXhsLikedPage(page, DEFAULT_XHS_LIKED_URL);
    if (!opened) {
      sendJson(res, 200, { ok: false, error: "没有找到点赞页面，请确认小红书仍处于登录状态" });
      return;
    }

    let card = null;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const candidate = page.locator(`section.note-item[data-note-id="${noteId}"]`);
      if (await candidate.count()) {
        card = candidate.first();
        break;
      }
      await page.mouse.wheel(0, 900).catch(() => {});
      await page.waitForTimeout(700);
    }
    if (!card) {
      sendJson(res, 200, { ok: false, error: "点赞列表中没有找到这篇帖子，可能已经取消点赞" });
      return;
    }

    const activeLike = card.locator(".like-wrapper.like-active");
    if (!(await activeLike.count())) {
      sendJson(res, 200, { ok: true, alreadyUnliked: true });
      return;
    }
    if (payload.dryRun === true) {
      sendJson(res, 200, { ok: true, found: true, active: true, dryRun: true });
      return;
    }

    await activeLike.first().click({ timeout: 10_000 });
    await page.waitForTimeout(1200);
    const stillActive = await card.locator(".like-wrapper.like-active").count().catch(() => 0);
    if (stillActive) {
      sendJson(res, 200, { ok: false, error: "取消点赞没有生效，请稍后重试" });
      return;
    }
    sendJson(res, 200, { ok: true, unliked: true });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "取消点赞失败" });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

function extractRecipeText(text, title = "") {
  const rawText = collapseDuplicatePostText(text, title);
  return {
    ingredients: "",
    steps: rawText,
    rawText
  };
}

function collapseDuplicatePostText(text, title = "") {
  const rawText = String(text || "").trim();
  if (!rawText) return "";

  const firstLine = rawText.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  const titleCandidates = [
    String(title || "").replace(/\s*-\s*小红书.*$/i, "").trim(),
    firstLine.replace(/\s*-\s*小红书.*$/i, "").trim()
  ].filter((value) => value.length >= 6);

  for (const candidate of titleCandidates) {
    const occurrences = [];
    let fromIndex = 0;
    while (fromIndex < rawText.length) {
      const index = rawText.indexOf(candidate, fromIndex);
      if (index < 0) break;
      occurrences.push(index);
      fromIndex = index + candidate.length;
    }
    if (occurrences.length >= 2) return removeTrailingPostMetadata(rawText.slice(occurrences[occurrences.length - 1]).trim());
  }

  return removeTrailingPostMetadata(rawText);
}

function removeTrailingPostMetadata(text) {
  let cleaned = String(text || "").trim();
  cleaned = cleaned.replace(/\s+(?:\d+\s*(?:分钟前|小时前|天前)|刚刚|昨天|前天)\s*$/, "").trim();
  cleaned = cleaned.replace(/\s+\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*$/, "").trim();
  cleaned = cleaned.replace(/\s*#[^\s#]+(?:\s*#[^\s#]+)*\s*$/, "").trim();
  return cleaned;
}

function cleanPostText(text) {
  const stopPatterns = [
    /^\d+条精选评论$/,
    /^查看更多$/,
    /^打开小红书查看全部精彩评论$/,
    /^热门推荐$/,
    /^@.+的热门笔记$/,
    /^打开小红书查看Ta的更多笔记$/,
    /^说点什么/
  ];
  const lines = [];
  for (const rawLine of String(text || "").replace(/\r/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (stopPatterns.some((pattern) => pattern.test(line))) break;
    lines.push(line);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractNumberedSteps(text) {
  const normalized = normalizeStepMarkers(text);
  const markerPattern = /(?:^|[\n\s。；;])@@STEP_(\d{1,2})@@\s*/g;
  const markers = [];
  let match;
  while ((match = markerPattern.exec(normalized))) {
    markers.push({ number: Number(match[1]), start: match.index, contentStart: markerPattern.lastIndex });
  }
  if (markers.length < 2) return [];

  const steps = [];
  const seenSteps = new Set();
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const end = index + 1 < markers.length ? markers[index + 1].start : normalized.length;
    const step = cleanStepText(normalized.slice(marker.contentStart, end));
    const stepKey = step.replace(/\s+/g, " ").trim();
    if (!isLikelyStep(step) || seenSteps.has(stepKey)) continue;
    seenSteps.add(stepKey);
    steps.push(`${steps.length + 1}. ${step}`);
  }
  return uniqueValues(steps).slice(0, 18);
}

function normalizeStepMarkers(text) {
  const circled = {
    "①": 1,
    "②": 2,
    "③": 3,
    "④": 4,
    "⑤": 5,
    "⑥": 6,
    "⑦": 7,
    "⑧": 8,
    "⑨": 9,
    "⑩": 10
  };
  return String(text || "")
    .replace(/([1-9]|10)\uFE0F?\u20E3/g, (_, number) => ` @@STEP_${number}@@ `)
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (value) => ` @@STEP_${circled[value]}@@ `)
    .replace(/(^|[\n\s。；;])第?\s*([1-9]\d?)\s*[\.、)：:)）-]\s*/g, (_, prefix, number) => `${prefix}@@STEP_${number}@@ `);
}

function cleanStepText(value) {
  const withoutMarkers = String(value || "")
    .replace(/@@STEP_\d{1,2}@@/g, "")
    .split(/\s+#/)[0]
    .split(/\n\d{4}-\d{2}-\d{2}/)[0];
  const withoutRepeatedRecipeBlock = withoutMarkers.replace(
    /[。！？][ \t]+[^\u3400-\u9fffA-Za-z0-9\s]{1,4}(?=[\u3400-\u9fff])/g,
    (match) => match.slice(0, 1)
  );
  const headingIndex = withoutRepeatedRecipeBlock.search(
    /(?:\n|\\n)\s*[^。！？\n]{0,60}(?:馅料|糯米皮|米皮|饼皮|面团|内馅|夹心|酱汁|食材|材料|用料)/
  );
  const cleaned = headingIndex >= 0 ? withoutRepeatedRecipeBlock.slice(0, headingIndex) : withoutRepeatedRecipeBlock;
  return cleaned
    .replace(/\s+/g, " ")
    .replace(/^[：:，,、。；;\s-]+/, "")
    .replace(/[ \t]+([，。；])/g, "$1")
    .trim();
}

function isLikelyStep(step) {
  if (!step || step.length < 2 || step.length > 220) return false;
  if (/^(评论|推荐|收藏|点赞|关注|展开|打开小红书)/.test(step)) return false;
  return /[\u3400-\u9fff]/.test(step);
}

function extractIngredients(text) {
  const lines = String(text || "")
    .split(/\n|。|；|;/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "ㅤ");
  const ingredients = [];
  let inIngredientSection = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*•]\s*/, "").trim();
    if (isIngredientSectionStart(line)) {
      inIngredientSection = true;
      const inline = extractInlineIngredientText(line);
      if (inline) addIngredientCandidates(ingredients, inline);
      continue;
    }
    if (!inIngredientSection) continue;
    if (isIngredientSectionEnd(line)) break;
    addIngredientCandidates(ingredients, line);
  }
  if (!ingredients.length) {
    ingredients.push(...extractMeasuredIngredients(extractTextBeforeFirstStep(text)));
  }
  return uniqueValues(ingredients).slice(0, 24);
}

function extractTextBeforeFirstStep(text) {
  const normalized = normalizeStepMarkers(text);
  const markerIndex = normalized.indexOf("@@STEP_");
  return markerIndex >= 0 ? normalized.slice(0, markerIndex) : normalized;
}

function isIngredientSectionStart(line) {
  const plain = stripDecorativePrefix(line);
  return /^(材料|食材|调料|配料|用料|准备)[：:\s]*$/.test(plain) || /^(材料|食材|调料|配料|用料|准备)[：:\s]/.test(plain) || isIngredientGroupHeading(plain);
}

function extractInlineIngredientText(line) {
  const plain = stripDecorativePrefix(line);
  if (!/^(材料|食材|调料|配料|用料|准备)[：:\s]/.test(plain)) return "";
  return plain.replace(/^(材料|食材|调料|配料|用料|准备)[：:\s]*/, "").trim();
}

function stripDecorativePrefix(line) {
  return String(line || "").replace(/^[^\u3400-\u9fffA-Za-z0-9]+/, "").trim();
}

function isIngredientGroupHeading(line) {
  const plain = stripDecorativePrefix(line)
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[；;：:]\s*$/, "")
    .trim();
  if (!plain || /^(做法|步骤|教程|参考食谱|制作|操作|tips?|小贴士)/i.test(plain)) return false;
  if (/(?:\d+(?:\.\d+)?|[一二两三四五六七八九十半]+)\s*(?:g|kg|克|斤|ml|毫升|升|颗|个|只|枚|片|根|条|块|勺|大勺|小勺|茶匙|汤匙|杯|碗|包|袋|盒|罐|撮|滴)/i.test(plain)) return false;
  return /(馅料|糯米皮|米皮|饼皮|面团|内馅|夹心|奶油|酱汁|淋面|装饰|配料区|材料区)/.test(plain);
}

function isIngredientSectionEnd(line) {
  if (!line) return true;
  const plain = stripDecorativePrefix(line);
  if (/^#/.test(plain)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(plain)) return true;
  if (/^(做法|步骤|教程|参考食谱|制作|操作|tips?|小贴士|评论|收藏|点赞|打开小红书)/i.test(plain)) return true;
  if (/^(?:第?\s*)?[1-9]\d?\s*[\.、)：:)）-]/.test(plain)) return true;
  if (/^([1-9]|10)\uFE0F?\u20E3/.test(plain) || /^[①②③④⑤⑥⑦⑧⑨⑩]/.test(plain)) return true;
  return false;
}

function addIngredientCandidates(ingredients, value) {
  const normalized = String(value || "").replace(/^(材料|食材|调料|配料|用料|准备)[：:\s]*/, "").trim();
  for (const item of normalized.split(/[，,、]/)) {
    const ingredient = cleanIngredientText(item);
    if (!isLikelyIngredient(ingredient)) continue;
    ingredients.push(ingredient);
  }
}

function cleanIngredientText(value) {
  return String(value || "")
    .replace(/^[-*•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyIngredient(value) {
  if (!value || value.length < 2 || value.length > 80) return false;
  if (/^#/.test(value)) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (/^(做法|步骤|教程|参考食谱|制作|操作|tips?|小贴士)/i.test(value)) return false;
  if (/(此配方|可做\s*\d+|份量|成品数量)/.test(value)) return false;
  return /[\u3400-\u9fffA-Za-z]/.test(value);
}

function extractMeasuredIngredients(text) {
  const normalized = String(text || "")
    .replace(/@@STEP_\d{1,2}@@/g, " ")
    .replace(/([1-9]|10)\uFE0F?\u20E3/g, " ")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/\s+/g, " ");
  const ingredients = [];
  const amountAfterName = /([\u3400-\u9fffA-Za-z][\u3400-\u9fffA-Za-z\s]{0,12}?)(\d+(?:-\d+)?(?:\.\d+)?\s*(?:g|kg|克|斤|ml|mL|毫升|升|颗|个|只|枚|片|根|条|块|勺|大勺|小勺|茶匙|汤匙|杯|碗|包|袋|盒|罐|撮|滴)|少许|适量)/gi;
  const amountBeforeName = /((?:\d+(?:-\d+)?(?:\.\d+)?|[一二两三四五六七八九十半]+)\s*(?:g|kg|克|斤|ml|mL|毫升|升|颗|个|只|枚|片|根|条|块|勺|大勺|小勺|茶匙|汤匙|杯|碗|包|袋|盒|罐|撮|滴))\s*([\u3400-\u9fffA-Za-z][\u3400-\u9fffA-Za-z\s]{0,12})/gi;
  collectMeasuredIngredientMatches(ingredients, normalized, amountAfterName, (match) => `${match[1].trim()} ${match[2].trim()}`);
  collectMeasuredIngredientMatches(ingredients, normalized, amountBeforeName, (match) => `${match[2].trim()} ${match[1].trim()}`);
  return ingredients;
}

function collectMeasuredIngredientMatches(ingredients, text, pattern, format) {
  let match;
  while ((match = pattern.exec(text))) {
    const ingredient = cleanMeasuredIngredientText(format(match));
    if (!isLikelyMeasuredIngredient(ingredient)) continue;
    ingredients.push(ingredient);
  }
}

function cleanMeasuredIngredientText(value) {
  const normalized = cleanIngredientText(value)
    .replace(/^(加|加入|放入|倒入|用|把|和|再|先|然后|最后|一份)/, "")
    .trim();
  const parts = normalized.split(/\s+/);
  if (parts.length < 2) return normalized;
  const amount = parts[parts.length - 1];
  const name = parts
    .slice(0, -1)
    .join("")
    .split(/用|加|放|倒|切|搅|揉|混|和|，|,/)[0]
    .trim();
  return name ? `${name} ${amount}` : normalized;
}

function isLikelyMeasuredIngredient(value) {
  if (!isLikelyIngredient(value)) return false;
  if (/(分钟|小时|度|烤|煮|炒|搅拌|打碎|揉|切|腌制|混合|均匀|流动|浓稠|省略)/.test(value)) return false;
  return /\d|[一二两三四五六七八九十半]/.test(value);
}

function uniqueValues(values) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    const key = value.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function cleanPreviewTitle(value) {
  return String(value || "")
    .replace(/\s*-\s*小红书.*$/, "")
    .replace(/\s*\|\s*小红书.*$/, "")
    .trim();
}

function imageUrlToDataUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(
      url,
      {
        headers: {
          referer: "https://www.xiaohongshu.com/",
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        }
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          imageUrlToDataUrl(new URL(response.headers.location, url).href).then(resolve, reject);
          response.resume();
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Image request failed: ${response.statusCode}`));
          response.resume();
          return;
        }
        const contentType = response.headers["content-type"] || "image/jpeg";
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(`data:${contentType};base64,${Buffer.concat(chunks).toString("base64")}`));
      }
    );
    request.setTimeout(20000, () => {
      request.destroy(new Error("Image request timed out"));
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && parsed.pathname === "/api/xhs-preview") {
      await handleXhsPreview(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/xhs-image-data") {
      await handleXhsImageData(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/xhs-liked") {
      await handleXhsLikedRecipes(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/xhs-unlike") {
      await handleXhsUnlike(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Pantry Organizer running at http://localhost:${PORT}`);
});
