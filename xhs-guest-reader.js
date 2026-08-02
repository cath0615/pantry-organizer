const fs = require("fs");
const path = require("path");

const GUEST_PROFILE_DIR = path.join(__dirname, ".xhs-guest-profile");

async function readXhsAsGuest(url, options = {}) {
  const playwright = options.playwright;
  if (!playwright) {
    return {
      ok: false,
      finalUrl: url,
      text: "",
      title: "",
      media: [],
      sourceType: options.sourceType || "article",
      error: "Playwright is not installed",
      code: "PLAYWRIGHT_MISSING"
    };
  }

  fs.mkdirSync(GUEST_PROFILE_DIR, { recursive: true });
  let context;
  try {
    context = await playwright.chromium.launchPersistentContext(GUEST_PROFILE_DIR, {
      headless: false,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      executablePath: options.executablePath,
      args: ["--no-first-run", "--disable-dev-shm-usage"]
    });
    await context.clearCookies();

    const page = context.pages()[0] || (await context.newPage());
    const videoUrls = new Set();
    page.on("response", (response) => {
      const responseUrl = response.url();
      const contentType = response.headers()["content-type"] || "";
      if (/\.mp4(\?|$)/i.test(responseUrl)
        || /\.m3u8(\?|$)/i.test(responseUrl)
        || contentType.includes("video/")
        || contentType.includes("application/vnd.apple.mpegurl")) {
        videoUrls.add(responseUrl);
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(options.settleMs || 4500);
    await gentleScroll(page);

    const snapshot = await page.evaluate(() => {
      const meta = (name) => document.querySelector(`meta[property="${name}"]`)?.getAttribute("content")
        || document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")
        || "";
      const noteState = window.__INITIAL_STATE__?.noteData;
      const post = noteState?.data?.noteData || noteState?.normalNotePreloadData || {};
      const media = Array.from(document.querySelectorAll("img, video, source"))
        .map((node) => ({
          tag: node.tagName.toLowerCase(),
          src: node.currentSrc || node.src || node.getAttribute("src") || "",
          poster: node.poster || "",
          alt: node.alt || ""
        }))
        .filter((item) => item.src || item.poster || item.alt)
        .slice(0, 80);
      return {
        title: document.title || meta("og:title") || meta("twitter:title"),
        description: meta("description") || meta("og:description"),
        postTitle: typeof post.title === "string" ? post.title : "",
        postDescription: typeof post.desc === "string" ? post.desc : "",
        bodyText: document.body ? document.body.innerText : "",
        canonical: document.querySelector('link[rel="canonical"]')?.href || location.href,
        url: location.href,
        media
      };
    });

    const text = snapshot.postDescription
      ? preservePostText([snapshot.postTitle || snapshot.title, snapshot.postDescription].filter(Boolean).join("\n"))
      : cleanXhsText([snapshot.title, snapshot.description, snapshot.bodyText].join("\n"));
    const hasVideo = snapshot.media.some((item) => item.tag === "video" || item.src.includes(".mp4") || item.poster);
    return {
      ok: text.length > 0,
      finalUrl: snapshot.canonical || snapshot.url || page.url(),
      text,
      title: snapshot.title || "",
      media: snapshot.media,
      videoUrls: [...videoUrls].slice(0, 20),
      sourceType: hasVideo ? "video" : options.sourceType || "article",
      browser: "guest-mobile-system-chrome",
      error: "",
      code: "OK"
    };
  } catch (error) {
    return {
      ok: false,
      finalUrl: url,
      text: "",
      title: "",
      media: [],
      videoUrls: [],
      sourceType: options.sourceType || "article",
      error: error.message,
      code: "PLAYWRIGHT_READ_FAILED"
    };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function gentleScroll(page) {
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.wheel(0, 520).catch(() => {});
    await page.waitForTimeout(650);
  }
}

function preservePostText(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^[ \t]+$/gm, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function cleanXhsText(text) {
  const blocked = [
    "打开小红书",
    "看看你感兴趣的内容",
    "小红书",
    "登录",
    "注册",
    "打开App",
    "立即打开",
    "打开App查看更多",
    "展开全文",
    "展开",
    "关注",
    "发弹幕"
  ];
  const stopPatterns = [
    /^\d+条精选评论$/,
    /^查看更多$/,
    /^打开小红书查看全部精彩评论$/,
    /^热门推荐$/,
    /^@.+的热门笔记$/,
    /^打开小红书查看Ta的更多笔记$/,
    /^说点什么/
  ];
  const seen = new Set();
  const lines = [];
  for (const rawLine of String(text || "").replace(/\r/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.length <= 1) continue;
    if (/^\d+$/.test(line) || /^\d+\/\d+$/.test(line) || /^\d{2}-\d{2}(\s|$)/.test(line)) continue;
    if (stopPatterns.some((pattern) => pattern.test(line))) break;
    if (blocked.includes(line)) continue;
    const key = line.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

module.exports = { GUEST_PROFILE_DIR, readXhsAsGuest };
