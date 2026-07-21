# Pantry Organizer

手机优先的本地食材记录 PWA。

- 本地 IndexedDB 保存食材
- 语音/文本录入后确认保存
- 分类、搜索、备注、过期排序
- 自定义分类
- 物品图片，支持手机拍照/选图
- 一周三餐计划和两个本地备忘录
- Recipe tab：保存小红书链接、分类筛选、搜索、手动菜谱、封面和 JSON 导入导出
- 电脑本地运行 `npm start` 时，可复用本机小红书 Playwright profile 抓取菜谱标题和封面
- JSON 文本导出/导入备份

## Local Recipe Capture

电脑上添加小红书菜谱时，运行：

```bash
npm start
```

然后打开 http://localhost:5173。这个本地模式会调用 `/api/xhs-preview`，复用 `/Users/josh/Documents/Codex/2026-06-26/wo/xhs-reader.js` 和对应的小红书浏览器 profile 抓取标题/封面。GitHub Pages 版本仍然可以查看、搜索、打开链接和手动编辑。

## GitHub Pages

这是纯静态应用，可以直接用 GitHub Pages 发布。发布后用手机 Safari/Chrome 打开 HTTPS 地址，再添加到主屏幕。
