# Mermaid 转飞书

把 Markdown 里的 Mermaid 图渲染得好看一点，再一键复制成高清 PNG 粘进飞书文档。

在线使用：<https://mermaid-feishu.pages.dev>

## 怎么用

1. 左边粘贴 Mermaid 源码（不用带 ```` ```mermaid ```` 围栏），右边实时预览。
2. 右上角选配色、布局、走向、倍率（2x / 3x）。默认配色是「ChatGPT 风」，布局默认「ELK 分层」。流程图还可点「左右 LR / 上下 TB」改写源码走向（宽图提示里的「改为上下 TB」是同一动作）。布局只影响流程图 / graph，其他图类型只换配色。
   - 浅色（细线、低饱和，适合飞书文档）：`feishu-light` 飞书白、`feishu-gray` 飞书浅灰、`soft-sage` 淡雅灰绿
   - 画板风：`feishu-blue` 飞书画板蓝（白底、统一浅蓝圆角块、判断节点为蓝色虚线圆角框、细灰圆角连线、「是/否」胶囊标签，仿飞书画板流程图）
   - `chatgpt` ChatGPT 风（**默认**）：仿 ChatGPT 对话里的 Mermaid 预览。流程图 / graph 默认走 ELK 分层布局，其他图类型仍用原渲染器、只换浅蓝配色
   - 色块（非纯白底，节点按分支 / 分组 / 角色填充低饱和浅色块）：`notion-blocks` Notion 色块、`latte-blocks` Catppuccin Latte 色块、`rose-pine-dawn` Rosé Pine Dawn 色块、`nord-snow` Nord 雪原色块、`solarized-paper` Solarized 纸色块
   - beautiful-mermaid 自带 15 个：`zinc-light` `github-light` `nord-light` `tokyo-night-light` `catppuccin-latte` `solarized-light` `zinc-dark` `github-dark` `tokyo-night` `tokyo-night-storm` `catppuccin-mocha` `nord` `dracula` `solarized-dark` `one-dark`
3. 点按钮：
   - **复制 PNG**：把高清 PNG 写进剪贴板，去飞书文档里直接 `⌘/Ctrl + V`。剪贴板不可用时自动改为下载。
   - **下载 PNG**：保存成文件，再拖进飞书。
   - **复制 SVG**：复制干净的独立 SVG（带 `xmlns` / `viewBox` / `width` / `height`，CSS 变量和 `color-mix` 都已换成具体颜色，没有外部字体，不用 `foreignObject`），可以导入飞书画板。注意飞书文档的「图片」不支持 SVG。
   - **复制为 HTML 小组件**：复制一段自包含 HTML（内联 SVG + 内联样式 + 系统中文字体，无外部脚本/字体），按容器可用宽度自适应、背景跟随主题，贴进飞书 HTML 小组件。超过小组件 500 KB 上限时会提示。
   - **复制源码**：复制 Mermaid 源码，可以贴进飞书自带的「文本绘图」小组件。
4. 源码会自动保存在本机浏览器（localStorage），刷新不丢。也可以用 `?example=flowchart` 这样的链接直接打开示例。

## 离线 HTML 小组件的预览操作

通过网页、API 导出的 HTML，以及 `npm run build:widget` 生成的通用小组件和 `/embed` 页面，都支持：

- 按住鼠标右键拖动图形。
- 在图形上按 Ctrl / ⌘ + 滚轮缩放，鼠标指向的位置保持不动；缩放范围为 25%–400%。普通滚轮继续滚动文档。
- Mac 触控板双指捏合缩放（兼容 Ctrl+wheel 和 Safari GestureEvent 两种事件）。
- 点击左上角的缩放百分比，或双击图形空白处，恢复到 100% 并居中。
- 源码默认折叠，开关在 Copy Mermaid 左侧，展开后位于图形上方。离线流程图支持编辑重绘；静态图显示只读源码。

画布和工具栏撑满容器可用宽度，底部不显示常驻操作提示。100% 对应图形按可用宽度适配后的初始视图，长图保留完整高度；放大后可右键拖动查看。重新绘图、切换方向或调整容器宽度时会恢复初始视图。平移和缩放只改变预览，不修改 Mermaid 源码，也不保存为图形内容；打印时显示完整图形。

交互共用 `src/shared/offline/viewport.js`；静态 HTML 通过 `static-widget-controls.js` 内联同一交互函数，离线流程图由 `offline/app.js` 连接渲染结果，`offline/widget.js` 提供工具栏和样式。修改后运行 `npm run build:offline` 更新仓库中的引擎负载，再运行 `npm run build:widget` 生成可粘贴进飞书的 HTML。

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

布局选「ELK 分层」（或配色选「ChatGPT 风」且布局为「跟随配色」）时，流程图 / graph 改走自带的 ELK 管线（`src/shared/chatgpt.js`）：beautiful-mermaid 只负责解析，
用内置字宽表量字（中日韩字符按 1em，拉丁字母/数字查表），交给 elkjs 0.9.3 的 `layered` 算法布局（选项与 ChatGPT 的 Mermaid 预览一致：
`BRANDES_KOEPF`、`mergeEdges=false`、`considerModelOrder=NODES_AND_EDGES`、正交连线），再直接输出不含 `foreignObject` 的 SVG。
整条管线纯 JS、不碰 DOM，网页和 API 跑同一份代码，所以两边输出的 SVG 逐字节相同。这条管线失败时退回 beautiful-mermaid。
设计参数（圆角 16、内边距 16/36、最小高 60、判断节点虚线框、5px 圆角拐弯、胶囊标签、配色）参考 ChatGPT 的预览样式，代码为本项目自写。
配色和布局是两个独立开关：ELK 布局搭配其他配色时，节点 / 判断框 / 连线 / 胶囊 / 分组按该主题的颜色映射（色块主题统一用第一种色块，不按分支着色）；
ChatGPT 配色搭配默认布局时，用 beautiful-mermaid 原布局 + ChatGPT 浅蓝配色。

beautiful-mermaid 报错时也会回退 mermaid.js。预览标题旁的小标签会显示这次用的是哪个渲染器。
beautiful-mermaid 对看不懂的行会静默跳过，所以页面还会用官方解析器再检查一遍，有问题时显示黄色「语法提示」。

## 给 Agent 用的 API

无需鉴权、CORS 开放，完整说明见 [SKILL.md](https://mermaid-feishu.pages.dev/SKILL.md)（也有 [llms.txt](https://mermaid-feishu.pages.dev/llms.txt)）。

- `POST /api/render`：JSON `{ code, format: "svg" | "html", theme?, layout?, direction? }`（默认 theme=`chatgpt`；`layout`：`default` / `elk` / `auto`；`direction`：`tb` / `lr` / `bt` / `rl` / `auto`，在渲染前改写 flowchart 走向），返回 `image/svg+xml` 或 `text/html`；`?json=1` 返回 JSON 包装。也支持 `GET /api/render?code=&format=&theme=&layout=&direction=`。
- `GET /api/themes`、`GET /api/health`。
- 服务端只用 beautiful-mermaid（Cloudflare Pages Functions，代码在 `functions/`，和网页共用 `src/shared/core.js`）。甘特图、饼图等返回 422，请用网页；`format=png` 返回 501（PNG 请在网页上生成）；源码上限 50KB（413）。

```bash
curl -s https://mermaid-feishu.pages.dev/api/render -H 'Content-Type: application/json' \
  -d '{"code":"flowchart LR\n  A[开始] --> B[结束]","format":"svg"}' -o diagram.svg
```

## PNG 尺寸与中文字体

- PNG 尺寸 = 图的原始尺寸 × 倍率（2x / 3x），不再缩到 820px 宽，所以宽图也清晰。
- 最长边上限 4096px：超出时等比缩小，界面上会显示实际倍率（例如「实际 2.70x」）。
- 倍率保底 1x：要保住 1x 会超过 4096px 时，放宽到 1x 为止，最长边最多 8192px；连 1x 都超过 8192px 时，缩到最长边 = 8192px。这种超长图本来就不适合贴进飞书，网页会给出宽图提示。
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

### 共享引擎 HTML 块与独立查看器

需要小体积、可编辑的 HTML 块，并复用已部署的引擎时，使用 [tools/html-block](tools/html-block/README.md)。包含全屏、独立查看、中文布局切换和缩放按钮；发布地址与文档配置由调用方提供。
