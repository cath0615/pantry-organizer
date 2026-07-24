const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const PORT = Number(process.env.PORT || 5173);
const PUBLIC_DIR = __dirname;
const XHS_PROJECT_DIR = process.env.XHS_READER_DIR || "/Users/josh/Documents/Codex/2026-06-26/wo";
const { readXhsWithPlaywright } = require(path.join(XHS_PROJECT_DIR, "xhs-reader"));

function pickPrimaryImages(media, limit = 4) {
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

    const src = item.src;
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
    if (candidates.length >= limit || hasVideo) break;
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
  const coverUrl = pickPrimaryImages(result.media, 1)[0] || "";
  const coverData = coverUrl ? await imageUrlToDataUrl(coverUrl).catch(() => "") : "";
  const recipeText = extractRecipeText(result.text || "");
  sendJson(res, 200, {
    ok: Boolean(result.ok || result.title || coverData),
    title: cleanPreviewTitle(result.title || ""),
    finalUrl: result.finalUrl || url,
    coverUrl,
    coverData,
    ingredients: recipeText.ingredients,
    steps: recipeText.steps,
    rawText: recipeText.rawText,
    error: result.error || ""
  });
}

function extractRecipeText(text) {
  const rawText = cleanPostText(text);
  return {
    ingredients: extractIngredients(rawText).join("\n"),
    steps: extractNumberedSteps(rawText).join("\n"),
    rawText
  };
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
  let expected = markers[0].number === 1 ? 1 : markers[0].number;
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    if (index > 0 && marker.number !== expected) break;
    const end = index + 1 < markers.length ? markers[index + 1].start : normalized.length;
    const step = cleanStepText(normalized.slice(marker.contentStart, end));
    if (isLikelyStep(step)) steps.push(step);
    expected += 1;
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
  return withoutMarkers
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
    .filter(Boolean);
  const ingredients = [];
  for (const line of lines) {
    if (!/^(材料|食材|调料|配料|用料|准备)[：:\s]/.test(line)) continue;
    const normalized = line.replace(/^(材料|食材|调料|配料|用料|准备)[：:\s]*/, "").trim();
    for (const item of normalized.split(/[，,、]/)) {
      const ingredient = item.trim();
      if (ingredient.length < 2 || ingredient.length > 80) continue;
      ingredients.push(ingredient);
    }
  }
  return uniqueValues(ingredients).slice(0, 24);
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
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Pantry Organizer running at http://localhost:${PORT}`);
});
