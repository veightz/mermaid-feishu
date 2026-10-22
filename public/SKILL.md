---
name: mermaid-feishu
description: 把 Mermaid 源码渲染成适合飞书文档的好看 SVG 或自包含 HTML（中文字体清晰、低饱和浅色主题、按飞书正文 820px 宽适配）。当你要把 Markdown 里的 mermaid 图（流程图、时序图、状态图、类图、ER 图、XY 图）转成图片/画板/HTML 小组件放进飞书文档时使用。Turn Mermaid into clean SVG/HTML for Feishu (Lark) docs.
---

# Mermaid 转飞书（mermaid-feishu）

一个无需鉴权的 HTTP API + 网页，把 Mermaid 渲染成**适合贴进飞书文档**的输出：

- **SVG**：干净的独立 SVG（`xmlns` / `viewBox` / `width` / `height` 齐全，颜色已全部写死，无 CSS 变量、无外部字体、无 `foreignObject`），适合导入**飞书画板**。
- **HTML**：自包含 HTML（内联 SVG + 内联样式 + 系统中文字体，无外部脚本/字体），居中、按 820px 自适应，背景跟随主题，适合贴进**飞书 HTML 小组件**（上限 500KB）。
- **PNG**：API 不提供。请让用户打开网页 <https://mermaid-feishu.pages.dev> 点「复制 PNG」，直接粘进飞书正文（飞书文档的图片不支持 SVG）。网页导出的 PNG = 图的原始尺寸 × 倍率（2x/3x），最长边不超过 4096px（超出等比缩小，但倍率不低于 1x；为保住 1x 最长边可放宽到 8192px，1x 仍超过 8192px 时缩到 8192px）。飞书正文约 820px 宽，原始宽度 > 1200px 的图贴进去字会变小：生成 `flowchart LR` 时，如果节点多、链条长，优先用 `flowchart TB`。

渲染器：服务端只用 [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid)（MIT，纯 TypeScript、无 DOM）。网页版额外支持回退官方 mermaid.js。

## Base URL

```
https://mermaid-feishu.pages.dev
```

CORS：`Access-Control-Allow-Origin: *`。无需鉴权。

## 接口

### `POST /api/render`

请求体 JSON：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `code` | string | 是 | Mermaid 源码（可带 ```` ```mermaid ```` 围栏，会自动去掉）。UTF-8 不超过 **50KB** |
| `format` | `"svg"` \| `"html"` | 否 | 默认 `svg`。`png` 会返回 501 |
| `theme` | string | 否 | 默认 `feishu-light`，见下方主题列表 |

也可以直接用纯文本 body 发送源码（`Content-Type: text/plain`），`format` / `theme` 走查询参数。

查询参数 `?json=1`：返回 JSON 包装 `{ ok, format, renderer, theme, width, height, bytes, data }`，`data` 为 SVG 或 HTML 字符串。

默认返回原始内容：

- `format=svg` → `Content-Type: image/svg+xml; charset=utf-8`
- `format=html` → `Content-Type: text/html; charset=utf-8`

响应头还带 `X-Renderer`（`beautiful-mermaid`，或 `theme=chatgpt` 的流程图为 `chatgpt-elk`）、`X-Theme`、`X-Width`、`X-Height`（CSS 像素）。

### `GET /api/render?code=...&format=...&theme=...`

同上，适合短源码（记得 URL 编码，例如 `encodeURIComponent`）。也支持 `&json=1`。

### `GET /api/themes`

返回 `{ ok, default, themes: [{ id, name, background, dark }] }`。

### `GET /api/health`

返回 `{ ok: true, service, version, renderer, time }`。

## 主题列表

| id | 名称 | 背景 | 说明 |
| --- | --- | --- | --- |
| `feishu-light` | 飞书白（**默认**） | `#FFFFFF` | 白底、细线、低饱和，最适合飞书正文 |
| `feishu-gray` | 飞书浅灰 | `#F5F6F7` | 浅灰底、细线、低饱和 |
| `soft-sage` | 淡雅灰绿 | `#FFFFFF` | 白底、灰绿点缀 |
| `feishu-blue` | 飞书画板蓝 | `#FFFFFF` | 仿飞书画板流程图：统一浅蓝圆角块 `#DCE9F7`（无明显边框）、蓝色文字；判断节点画成白底蓝色虚线圆角框（不是菱形）；细灰正交连线 + 圆角拐弯 + 小开口箭头；「是/否」为白底蓝边胶囊。单色，不分支着色 |
| `chatgpt` | ChatGPT 风 | `#FFFFFF` | 仿 ChatGPT 对话里的 Mermaid 预览。**流程图 / graph** 用 ELK 分层布局（与 ChatGPT 相同的排版与正交连线走向）：浅蓝圆角块 `#E5F3FF`、深蓝文字 `#004F99`、判断节点画成虚线圆角框（不是菱形）、5px 圆角拐弯的细灰连线 + 开口箭头、「是/否」胶囊标签。网页和 API 输出相同（`X-Renderer: chatgpt-elk`）。其他图类型照常渲染，只换浅蓝配色 |
| `notion-blocks` | Notion 色块 | `#F7F6F3` | 暖米白底；节点按分支 / 分组 / 角色填充 Notion 风浅色块（蓝/绿/橙/紫/粉/棕/灰，判断节点为浅琥珀） |
| `latte-blocks` | Catppuccin Latte 色块 | `#EFF1F5` | Catppuccin Latte 底色 + mauve/blue/green/peach/pink/teal/lavender 浅色块 |
| `rose-pine-dawn` | Rosé Pine Dawn 色块 | `#FAF4ED` | 暖纸色底 + pine/iris/rose/foam/love 浅色块 |
| `nord-snow` | Nord 雪原色块 | `#ECEFF4` | Nord Snow Storm 底 + Frost/Aurora 浅色块 |
| `solarized-paper` | Solarized 纸色块 | `#FDF6E3` | Solarized base3 纸色底 + blue/cyan/green/violet/orange/magenta/red 浅色块 |
| `zinc-light` | 简洁浅色 | `#FFFFFF` | |
| `github-light` | GitHub 浅色 | `#FFFFFF` | |
| `nord-light` | Nord 浅色 | `#ECEFF4` | |
| `tokyo-night-light` | Tokyo Night 浅色 | `#D5D6DB` | |
| `catppuccin-latte` | Catppuccin Latte | `#EFF1F5` | |
| `solarized-light` | Solarized 浅色 | `#FDF6E3` | |
| `zinc-dark` | 简洁深色 | `#18181B` | 深色 |
| `github-dark` | GitHub 深色 | `#0D1117` | 深色 |
| `tokyo-night` | Tokyo Night | `#1A1B26` | 深色 |
| `tokyo-night-storm` | Tokyo Night Storm | `#24283B` | 深色 |
| `catppuccin-mocha` | Catppuccin Mocha | `#1E1E2E` | 深色 |
| `nord` | Nord | `#2E3440` | 深色 |
| `dracula` | Dracula | `#282A36` | 深色 |
| `solarized-dark` | Solarized 深色 | `#002B36` | 深色 |
| `one-dark` | One Dark | `#282C34` | 深色 |

以 `GET /api/themes` 的返回为准。飞书文档建议用前三个浅色主题；想要非纯白底、带浅色块填充的效果，用 5 个「色块」主题（`notion-blocks` 等）。

色块主题的规则：流程图 / 状态图按分支着色（从根开始，单线沿用同色，遇到分叉每个分支换一种色块；判断节点固定浅琥珀；同一 subgraph 内的节点同色、分组底色更浅）；时序图每个参与者、类图每个类、ER 图每个实体各一种色块。色块取自 Radix Colors：填充 step 3–4、边框 step 7、文字 step 11–12。

## 支持的图类型

| 图类型 | 首行关键字 | API（服务端） | 网页 |
| --- | --- | --- | --- |
| 流程图 | `graph` / `flowchart`（TD/LR/BT/RL） | ✅ | ✅ |
| 时序图 | `sequenceDiagram` | ✅ | ✅ |
| 状态图 | `stateDiagram-v2` / `stateDiagram` | ✅ | ✅ |
| 类图 | `classDiagram` | ✅ | ✅ |
| ER 图 | `erDiagram` | ✅ | ✅ |
| XY 图（柱状/折线） | `xychart-beta` | ✅ | ✅ |
| 甘特图、饼图、思维导图、时间线、Git 图、象限图、旅程图、C4 等 | `gantt` / `pie` / `mindmap` / `timeline` / … | ❌ 返回 422 | ✅（回退官方 mermaid.js） |

注意：beautiful-mermaid 对看不懂的行会尽量跳过而不是报错，所以 API 返回 200 不代表源码完全符合官方语法；需要严格校验时请在网页上看黄色「语法提示」。

## 限制

- 源码 UTF-8 不超过 **50KB**（51200 字节），否则 413。
- HTML 小组件在飞书里上限 500KB；常见图在 5–70KB 之间。返回 JSON 时可看 `bytes`。
- 无 PNG（501）。
- 无鉴权、无存储；源码不会被保存。

## 请求示例

SVG（原始内容，保存成文件）：

```bash
curl -s https://mermaid-feishu.pages.dev/api/render \
  -H 'Content-Type: application/json' \
  -d '{"code":"flowchart TD\n  A[提交需求] --> B{评审通过?}\n  B -->|是| C[开发]\n  B -->|否| D[退回修改]","theme":"feishu-light"}' \
  -o diagram.svg
```

HTML 小组件：

```bash
curl -s https://mermaid-feishu.pages.dev/api/render \
  -H 'Content-Type: application/json' \
  -d '{"code":"sequenceDiagram\n  用户->>网站: 粘贴 Mermaid\n  网站-->>用户: 返回 SVG","format":"html"}' \
  -o widget.html
```

JSON 模式：

```bash
curl -s 'https://mermaid-feishu.pages.dev/api/render?json=1' \
  -H 'Content-Type: application/json' \
  -d '{"code":"stateDiagram-v2\n  [*] --> 草稿\n  草稿 --> 已发布: 发布","format":"svg"}'
```

GET（短源码）：

```bash
curl -s 'https://mermaid-feishu.pages.dev/api/render?format=svg&theme=feishu-gray&code=graph%20LR%3B%20A%5B%E5%BC%80%E5%A7%8B%5D%20--%3E%20B%5B%E7%BB%93%E6%9D%9F%5D' -o lr.svg
```

纯文本 body（直接上传 .mmd 文件）：

```bash
curl -s 'https://mermaid-feishu.pages.dev/api/render?format=html&theme=feishu-light' \
  -H 'Content-Type: text/plain' --data-binary @diagram.mmd -o widget.html
```

## 响应示例

`200`，`format=svg`：

```
HTTP/2 200
content-type: image/svg+xml; charset=utf-8
x-renderer: beautiful-mermaid
x-theme: feishu-light
x-width: 188
x-height: 414

<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 187.56 413.69" width="188" height="414" style="background-color:#FFFFFF">
<style>
text { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', ... sans-serif; }
</style>
...
</svg>
```

`200`，`format=html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mermaid</title>
<style>
html,body{margin:0;padding:0;background:#FFFFFF;}
body{font-family:-apple-system, ... sans-serif;}
.mf-wrap{box-sizing:border-box;max-width:820px;margin:0 auto;padding:16px 12px;display:flex;justify-content:center;}
</style>
</head>
<body>
<div class="mf-wrap">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 200" width="100%" style="display:block;width:100%;max-width:280px;height:auto;margin:0 auto;background-color:#FFFFFF" preserveAspectRatio="xMidYMid meet">...</svg>
</div>
</body>
</html>
```

`200`，`?json=1`：

```json
{
  "ok": true,
  "format": "svg",
  "renderer": "beautiful-mermaid",
  "theme": "feishu-light",
  "width": 280,
  "height": 200,
  "bytes": 2524,
  "data": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" ...</svg>"
}
```

错误统一是 JSON：`{ ok: false, code, error, ... }`。

`422` 不支持的图类型：

```json
{
  "ok": false,
  "code": "unsupported_diagram",
  "error": "该图类型（gantt）API 暂不支持，请到网页 https://mermaid-feishu.pages.dev 渲染（网页会自动回退官方 mermaid.js）。/ Diagram type \"gantt\" is not supported by the API; please render it on the website https://mermaid-feishu.pages.dev.",
  "type": "gantt",
  "supported": ["flowchart", "graph", "sequenceDiagram", "stateDiagram-v2", "stateDiagram", "classDiagram", "erDiagram", "xychart-beta"],
  "web": "https://mermaid-feishu.pages.dev"
}
```

`501` PNG：

```json
{ "ok": false, "code": "png_not_supported", "error": "PNG 请在网页上生成", "web": "https://mermaid-feishu.pages.dev" }
```

`413` 超过 50KB：

```json
{ "ok": false, "code": "too_large", "error": "源码超过 50KB 上限 / Source exceeds 50KB limit", "bytes": 86682 }
```

`400` 其他错误（`code` 为 `empty` / `bad_json` / `bad_format` / `bad_theme` / `syntax_error`）：

```json
{ "ok": false, "code": "bad_theme", "error": "未知主题 foo / Unknown theme", "themes": ["feishu-light", "feishu-gray", "..."] }
```

## 在飞书里怎么用

| 想放到哪里 | 用什么 | 怎么做 |
| --- | --- | --- |
| 飞书文档正文（最常见） | **PNG** | 让用户打开 <https://mermaid-feishu.pages.dev>，粘贴源码，点「复制 PNG」（2x/3x），回到飞书 `⌘/Ctrl + V`。也可以在网页 URL 里带 `?example=flowchart` 打开示例 |
| 飞书 HTML 小组件 | **HTML**（`format=html`） | 把返回的整段 HTML 粘进小组件代码框；保持在 500KB 以内 |
| 飞书画板 | **SVG**（`format=svg`） | 把 SVG 文件导入画板（或把 SVG 文本另存为 `.svg` 再导入） |
| 飞书「文本绘图」小组件 | Mermaid 源码 | 直接粘贴源码（飞书自带渲染，样式不可控） |

建议：给用户回复时同时附上 Mermaid 源码，方便以后修改。

## 安装（给 Agent）

把本文件保存为 `skills/mermaid-feishu/SKILL.md`：

```bash
mkdir -p skills/mermaid-feishu
curl -s https://mermaid-feishu.pages.dev/SKILL.md -o skills/mermaid-feishu/SKILL.md
```

其他入口：<https://mermaid-feishu.pages.dev/llms.txt>。源码：<https://github.com/veightz/mermaid-feishu>（MIT）。
