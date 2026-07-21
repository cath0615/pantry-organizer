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
  sendJson(res, 200, {
    ok: Boolean(result.ok || result.title || coverData),
    title: cleanPreviewTitle(result.title || ""),
    finalUrl: result.finalUrl || url,
    coverUrl,
    coverData,
    error: result.error || ""
  });
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
