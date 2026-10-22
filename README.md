# Mermaid 转飞书

把 Markdown 里的 Mermaid 图渲染得好看一点，再一键复制成高清 PNG 粘进飞书文档。

在线使用：<https://mermaid-feishu.pages.dev>

## 怎么用

1. 左边粘贴 Mermaid 源码（不用带 ```` ```mermaid ```` 围栏），右边实时预览。
2. 右上角选主题、选倍率（2x / 3x）。默认主题是「飞书白」。
   - 浅色（细线、低饱和，适合飞书文档）：`feishu-light` 飞书白（默认，白底）、`feishu-gray` 飞书浅灰（浅灰底）、`soft-sage` 淡雅灰绿
   - 画板风：`feishu-blue` 飞书画板蓝（白底、统一浅蓝圆角块、判断节点为蓝色虚线圆角框、细灰圆角连线、「是/否」胶囊标签，仿飞书画板流程图）
   - 色块（非纯白底，节点按分支 / 分组 / 角色填充低饱和浅色块）：`notion-blocks` Notion 色块、`latte-blocks` Catppuccin Latte 色块、`rose-pine-dawn` Rosé Pine Dawn 色块、`nord-snow` Nord 雪原色块、`solarized-paper` Solarized 纸色块
   - beautiful-mermaid 自带 15 个：`zinc-light` `github-light` `nord-light` `tokyo-night-light` `catppuccin-latte` `solarized-light` `zinc-dark` `github-dark` `tokyo-night` `tokyo-night-storm` `catppuccin-mocha` `nord` `dracula` `solarized-dark` `one-dark`
3. 点按钮：
   - **复制 PNG**：把高清 PNG 写进剪贴板，去飞书文档里直接 `⌘/Ctrl + V`。剪贴板不可用时自动改为下载。
   - **下载 PNG**：保存成文件，再拖进飞书。
   - **复制 SVG**：复制干净的独立 SVG（带 `xmlns` / `viewBox` / `width` / `height`，CSS 变量和 `color-mix` 都已换成具体颜色，没有外部字体，不用 `foreignObject`），可以导入飞书画板。注意飞书文档的「图片」不支持 SVG。
   - **复制为 HTML 小组件**：复制一段自包含 HTML（内联 SVG + 内联样式 + 系统中文字体，无外部脚本/字体），居中、按 820px 自适应、背景跟随主题，贴进飞书 HTML 小组件。超过小组件 500 KB 上限时会提示。
   - **复制源码**：复制 Mermaid 源码，可以贴进飞书自带的「文本绘图」小组件。
4. 源码会自动保存在本机浏览器（localStorage），刷新不丢。也可以用 `?example=flowchart` 这样的链接直接打开示例。

## 渲染器

全部在浏览器里渲染，不上传任何内容。

| 图类型 | 渲染器 |
| --- | --- |
| 流程图 `graph` / `flowchart` | beautiful-mermaid |
| 时序图 `sequenceDiagram` | beautiful-mermaid |
| 状态图 `stateDiagram-v2` | beautiful-mermaid |
| 类图 `classDiagram` | beautiful-mermaid |
| ER 图 `erDiagram` | beautiful-mermaid |
| XY 图 `xychart-beta` | beautiful-mermaid |
| 其他（甘特图、饼图、思维导图、时间线、Git 图……） | 回退官方 mermaid.js（主题颜色按所选主题生成） |

beautiful-mermaid 报错时也会回退 mermaid.js。预览标题旁的小标签会显示这次用的是哪个渲染器。
beautiful-mermaid 对看不懂的行会静默跳过，所以页面还会用官方解析器再检查一遍，有问题时显示黄色「语法提示」。

## 给 Agent 用的 API

无需鉴权、CORS 开放，完整说明见 [SKILL.md](https://mermaid-feishu.pages.dev/SKILL.md)（也有 [llms.txt](https://mermaid-feishu.pages.dev/llms.txt)）。

- `POST /api/render`：JSON `{ code, format: "svg" | "html", theme? }`，返回 `image/svg+xml` 或 `text/html`；`?json=1` 返回 JSON 包装。也支持 `GET /api/render?code=&format=&theme=`。
- `GET /api/themes`、`GET /api/health`。
- 服务端只用 beautiful-mermaid（Cloudflare Pages Functions，代码在 `functions/`，和网页共用 `src/shared/core.js`）。甘特图、饼图等返回 422，请用网页；`format=png` 返回 501（PNG 请在网页上生成）；源码上限 50KB（413）。

```bash
curl -s https://mermaid-feishu.pages.dev/api/render -H 'Content-Type: application/json' \
  -d '{"code":"flowchart LR\n  A[开始] --> B[结束]","format":"svg"}' -o diagram.svg
```

## PNG 尺寸与中文字体

- PNG 尺寸 = 图的原始尺寸 × 倍率（2x / 3x），不再缩到 820px 宽，所以宽图也清晰。
- 最长边上限 4096px：超出时等比缩小，界面上会显示实际倍率（例如「实际 2.57x」）。
- 飞书正文宽约 820px，贴进去的图会缩到正文宽度。原始宽度超过约 1200px 的图，贴进去后字会明显变小；网页会给出提示，`flowchart LR` / `RL` 的图建议改成 `TB`。
- SVG 转 PNG 时浏览器拿不到网页字体，所以统一用系统中文字体栈：
  `PingFang SC / Hiragino Sans GB / Microsoft YaHei / Noto Sans CJK SC / Source Han Sans SC …`
  macOS、Windows、装了 Noto CJK 的 Linux 都能清晰显示中文。beautiful-mermaid 默认的 Google Fonts `@import` 已去掉（国内慢、`<img>` 里也加载不到）。

## 已知限制

- 复制图片到剪贴板需要 HTTPS 和一次点击，并且需要浏览器支持 `ClipboardItem`（Chrome / Edge / Safari 13.1+ / Firefox 127+）。不行时自动下载 PNG。
- 剪贴板里的 PNG 不带「倍率」信息，飞书按像素宽度显示（最多铺满正文）。小图用 3x 时贴进去会偏大，可以在飞书里拖小。
- Safari 有时第一次复制会慢一点（要先生成图片）；如果提示失败，再点一次或用「下载 PNG」。

## 开发

```bash
npm install
npm run dev      # 本地开发
npm run build    # 产物在 dist/
```

推送到 `main` 后，GitHub Actions 会自动构建并部署到 Cloudflare Pages（项目 `mermaid-feishu`），需要仓库 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。

## 许可

本项目代码 MIT。依赖：

- [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid)（MIT，Craft Docs）
- [mermaid](https://github.com/mermaid-js/mermaid)（MIT）
- [Vite](https://vitejs.dev)（MIT，仅构建用）

### 配色致谢

色块主题的颜色值来自以下公开配色，仅复用色值：

- [Radix Colors](https://www.radix-ui.com/colors)（MIT，© 2021 Radix / WorkOS）：所有色块的填充 / 边框 / 文字色阶（`src/shared/radix.js`）
- [Notion](https://www.notion.so) 的文字与背景色（`#37352F` / `#F7F6F3` 等）：`notion-blocks`
- [Catppuccin](https://github.com/catppuccin/catppuccin) Latte（MIT）：`latte-blocks`
- [Rosé Pine](https://github.com/rose-pine/rose-pine-palette) Dawn（MIT）：`rose-pine-dawn`
- [Nord](https://www.nordtheme.com)（MIT）Snow Storm / Frost / Aurora：`nord-snow`
- [Solarized](https://ethanschoonover.com/solarized/)（MIT）Light：`solarized-paper`
