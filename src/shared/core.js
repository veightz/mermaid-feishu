// 前端和 Pages Functions 共用的核心逻辑：不依赖 DOM，Workers 里也能跑。
import { renderMermaidSVG, THEMES as BM_THEMES } from 'beautiful-mermaid'
import { RADIX } from './radix.js'

export const SITE_URL = 'https://mermaid-feishu.pages.dev'
export const FEISHU_WIDTH = 820 // 飞书正文大约 820 CSS px
export const HTML_WIDGET_LIMIT = 500 * 1024 // 飞书 HTML 小组件上限
export const MAX_SOURCE_BYTES = 50 * 1024 // API 输入上限

// ---------- 主题 ----------
// 自定义浅色主题：白底 / 浅灰底、细线、低饱和，贴近飞书文档观感（soft = 饼图等用低饱和色板）
export const CUSTOM_THEMES = {
  'feishu-light': { bg: '#FFFFFF', fg: '#1F2329', line: '#BBBFC4', accent: '#7A8BA8', muted: '#646A73', surface: '#F7F8FA', border: '#DEE0E3', soft: true },
  'feishu-gray': { bg: '#F5F6F7', fg: '#1F2329', line: '#B5B9BF', accent: '#7D8A9C', muted: '#646A73', surface: '#FFFFFF', border: '#DADCE0', soft: true },
  'soft-sage': { bg: '#FFFFFF', fg: '#2B312D', line: '#BCC5BE', accent: '#7E9A86', muted: '#66706A', surface: '#F6F8F6', border: '#DCE2DD', soft: true },
}
// ---------- 色块主题（Radix Colors 色阶：填充 = step 3/4，边框 = step 7，文字 = step 11/12） ----------
function block(hue, fillStep = 3) {
  const r = RADIX[hue]
  return {
    hue,
    tint: r[fillStep - 2], // 分组底色（更浅一级）
    fill: r[fillStep - 1], // 节点填充
    hdr: r[fillStep], // 表头 / 分组标题
    badge: r[fillStep + 1],
    border: r[6], // step 7
    faint: r[7], // step 8
    sub: r[10], // step 11
    text: r[11], // step 12
    pie: r[6], // 饼图等大面积色块
  }
}
function blockTheme(base, hues, decisionHue, fillStep = 3) {
  const blocks = hues.map((h) => block(h, fillStep))
  const decision = block(decisionHue, 3) // 判断节点：固定较浅的琥珀色，避免过亮
  return { ...base, surface: blocks[0].fill, border: blocks[0].border, soft: true, blocks, decision }
}
// 5 个非纯白底的低饱和色块主题；配色来源见 README「配色致谢」
export const BLOCK_THEMES = {
  // Notion：暖米白底 + Notion 风浅色块（灰/棕/橙/黄/绿/蓝/紫/粉）
  'notion-blocks': blockTheme({ bg: '#F7F6F3', fg: '#37352F', line: '#B4B2AD', accent: '#8F8D88', muted: '#787774' },
    ['blue', 'green', 'orange', 'purple', 'pink', 'brown', 'sand'], 'amber'),
  // Catppuccin Latte：base #EFF1F5，mauve/blue/green/peach/pink/teal/lavender
  'latte-blocks': blockTheme({ bg: '#EFF1F5', fg: '#4C4F69', line: '#ACB0BE', accent: '#7C7F93', muted: '#6C6F85' },
    ['violet', 'blue', 'green', 'orange', 'pink', 'teal', 'iris'], 'amber', 4),
  // Rosé Pine Dawn：base #FAF4ED，pine/iris/rose/foam/love
  'rose-pine-dawn': blockTheme({ bg: '#FAF4ED', fg: '#575279', line: '#B9B4BF', accent: '#797593', muted: '#797593' },
    ['teal', 'plum', 'tomato', 'cyan', 'crimson', 'mauve'], 'amber'),
  // Nord Snow Storm：#ECEFF4 + Frost / Aurora
  'nord-snow': blockTheme({ bg: '#ECEFF4', fg: '#2E3440', line: '#A3ABBA', accent: '#5E81AC', muted: '#4C566A' },
    ['blue', 'cyan', 'grass', 'plum', 'orange', 'indigo', 'teal'], 'amber', 4),
  // Solarized Light：base3 #FDF6E3，blue/cyan/green/violet/orange/magenta/red
  'solarized-paper': blockTheme({ bg: '#FDF6E3', fg: '#073642', line: '#93A1A1', accent: '#586E75', muted: '#657B83' },
    ['blue', 'cyan', 'grass', 'violet', 'orange', 'pink', 'tomato'], 'amber'),
}

// 飞书画板蓝：仿飞书画板流程图——白底、统一浅蓝圆角块（无边框）、判断节点白底蓝色虚线圆角框、
// 细灰正交连线 + 圆角拐弯 + 小开口箭头、「是/否」为白底蓝边胶囊。单色，不做分支多色。
export const BOARD_THEMES = {
  'feishu-blue': {
    bg: '#FFFFFF', fg: '#1F3A5F', line: '#A5ABB5', accent: '#9AA1AC', muted: '#4A6A92', surface: '#DCE9F7', border: '#D3E3F5',
    soft: true,
    opts: { padding: 56, nodeSpacing: 32, layerSpacing: 56 },
    board: {
      node: '#DCE9F7', nodeStroke: '#D3E3F5', text: '#1A5DB0', radius: 8,
      decisionFill: '#FFFFFF', decisionStroke: '#3B82E0', decisionDash: '3 2',
      chipFill: '#FFFFFF', chipStroke: '#3B82E0', chipText: '#1A5DB0',
      hdr: '#CADCF2', inner: '#E1EBF7', badge: '#C3D7F0', line: '#A5ABB5', arrow: '#9AA1AC', corner: 8,
      minNodeH: 44, padY: 7, weight: 500, // 节点更高（单行 ≈ 44px，原 37px；多行再 +7px）、文字 500
      // XY 图：同一浅蓝色系（柱：浅蓝填充 + 稍深蓝描边；线：#4A86E8 起）
      xyFill: ['#DCE9F7', '#C9DCF3', '#E8F1FB', '#BFD5F0'],
      xyBarStroke: ['#8DB4EE', '#6E9FE6', '#A9C7F2', '#5A8FDF'],
      xyLine: ['#4A86E8', '#1A5DB0', '#7FA9EA', '#2F6BCB'],
    },
    // 仅给 mermaid.js 回退（甘特图/饼图）用的蓝色系色板
    blocks: ['blue', 'sky', 'indigo', 'cyan', 'iris', 'teal'].map((h) => block(h, 3)),
    decision: block('blue', 3),
  },
}

// ChatGPT 风：流程图 / graph 走自带的 ELK 布局管线（src/shared/chatgpt.js，网页和 API 同一份代码）；
// 其他图类型仍用原来的渲染器，只套一组 ChatGPT 风的浅蓝配色。
export const CHATGPT_THEMES = {
  chatgpt: {
    bg: '#FFFFFF', fg: '#0D2B4D', line: '#AEB9C5', accent: '#6F93BF', muted: '#4A6A92', surface: '#E5F3FF', border: '#CEDAE5',
    soft: true, chatgpt: true,
  },
}
export const isChatGPTTheme = (id) => !!(THEMES[id] && THEMES[id].chatgpt)

export const DEFAULT_THEME = 'chatgpt'
export const THEMES = { ...CUSTOM_THEMES, ...BOARD_THEMES, ...CHATGPT_THEMES, ...BLOCK_THEMES, ...BM_THEMES }
export const THEME_LABELS = {
  'feishu-light': '飞书白', 'feishu-gray': '飞书浅灰', 'soft-sage': '淡雅灰绿',
  'feishu-blue': '飞书画板蓝', chatgpt: 'ChatGPT 风（默认）', 'notion-blocks': 'Notion 色块', 'latte-blocks': 'Catppuccin Latte 色块', 'rose-pine-dawn': 'Rosé Pine Dawn 色块', 'nord-snow': 'Nord 雪原色块', 'solarized-paper': 'Solarized 纸色块',
  'zinc-light': '简洁浅色', 'github-light': 'GitHub 浅色', 'nord-light': 'Nord 浅色', 'tokyo-night-light': 'Tokyo Night 浅色',
  'catppuccin-latte': 'Catppuccin Latte', 'solarized-light': 'Solarized 浅色', 'zinc-dark': '简洁深色', 'github-dark': 'GitHub 深色',
  'tokyo-night': 'Tokyo Night', 'tokyo-night-storm': 'Tokyo Night Storm', 'catppuccin-mocha': 'Catppuccin Mocha', nord: 'Nord',
  dracula: 'Dracula', 'solarized-dark': 'Solarized 深色', 'one-dark': 'One Dark',
}
// ---------- 布局（与配色独立） ----------
// default = beautiful-mermaid 自带布局；elk = 自带 ELK 分层管线（src/shared/chatgpt.js）。只对 flowchart / graph 生效。
// 不指定（或 auto）时跟随配色：chatgpt → elk，其他 → default（与拆分前完全一致）。
export const LAYOUTS = ['default', 'elk']
export const LAYOUT_LABELS = { default: '默认', elk: 'ELK 分层（ChatGPT 式）' }
export const themeDefaultLayout = (id) => (isChatGPTTheme(id) ? 'elk' : 'default')
/** 规范化 layout 参数：undefined/''/auto → null（跟随配色）；合法值 → 小写值；非法 → false */
export function parseLayout(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim().toLowerCase()
  if (s === '' || s === 'auto') return null
  return LAYOUTS.includes(s) ? s : false
}
export const resolveLayout = (themeId, layout) => parseLayout(layout) || themeDefaultLayout(themeId)

/** ELK 管线用的配色：chatgpt 返回 null（用 chatgpt.js 里的原值）；其他主题按主题色映射 */
export function elkPalette(themeId) {
  const t = THEMES[themeId] || THEMES[DEFAULT_THEME]
  if (t.chatgpt) return null
  const { bg, fg } = t
  const line = t.line || mix(fg, bg, 0.35)
  const border = t.border || mix(fg, bg, 0.2)
  const muted = t.muted || mix(fg, bg, 0.65)
  const accent = t.accent || mix(fg, bg, 0.5)
  const base = {
    bg, node: t.surface || mix(fg, bg, 0.06), nodeStroke: border, text: fg,
    decision: bg, decisionStroke: accent,
    line, arrow: mix(fg, line, 0.25),
    chip: bg, chipStroke: border, chipText: muted,
    group: mix(fg, bg, 0.025), groupStroke: border, groupText: muted,
    weight: 500,
  }
  if (t.board) {
    const B = t.board
    return { ...base, node: B.node, nodeStroke: B.nodeStroke, text: B.text, decision: B.decisionFill, decisionStroke: B.decisionStroke,
      line: B.line, arrow: B.arrow, chip: B.chipFill, chipStroke: B.chipStroke, chipText: B.chipText, groupStroke: B.inner, weight: B.weight }
  }
  if (t.blocks) {
    const b = t.blocks[0], d = t.decision
    return { ...base, node: b.fill, nodeStroke: b.border, text: b.text, decision: d.fill, decisionStroke: d.border, chipStroke: b.border, chipText: b.sub }
  }
  return base
}

export const themeColors = (t) => { const { soft, blocks, decision, board, opts, chatgpt, ...c } = t; return { ...c, ...(opts || {}) } }
export function themeList() {
  return Object.keys(THEME_LABELS).filter((id) => THEMES[id]).map((id) => ({ id, name: THEME_LABELS[id], background: THEMES[id].bg, dark: isDark(THEMES[id].bg), defaultLayout: themeDefaultLayout(id) }))
}

// 中文优先的系统字体栈：SVG 以 <img> 栅格化或在别处打开时拿不到网页字体，只用系统字体。
export const CJK_STACK = `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei', 'Segoe UI', sans-serif`
export const MONO_STACK = `'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans Mono CJK SC', 'Noto Sans CJK SC', monospace`

// ---------- 图类型 ----------
export const BM_TYPES = ['flowchart', 'graph', 'sequenceDiagram', 'stateDiagram-v2', 'stateDiagram', 'classDiagram', 'erDiagram', 'xychart-beta']
const BM_HEADERS = /^(graph|flowchart|stateDiagram(-v2)?|sequenceDiagram|classDiagram|erDiagram|xychart(-beta)?)\b/

export function firstLine(code) {
  for (const raw of code.split('\n')) {
    const l = raw.trim()
    if (!l || l.startsWith('%%')) continue
    if (l === '---') return '' // front-matter
    return l
  }
  return ''
}
export function diagramType(code) { return (firstLine(code).split(/[\s;]+/)[0] || '').trim() }
export function isBMSupported(code) { return BM_HEADERS.test(firstLine(code)) }

// ---------- 流程图走向（LR ↔ TB 等；网页与 API 共用） ----------
export const FLOW_DIRECTIONS = ['TB', 'LR', 'BT', 'RL']
/** 去掉开头的 YAML front-matter（--- ... ---），便于找 flowchart 头 */
export function stripFrontMatter(code) {
  return String(code).replace(/^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/, '')
}
/**
 * 定位首个 flowchart/graph 头行。
 * 返回 { lineIndex, kind, dir, implied }；dir 缺省时按 Mermaid 默认视为 TB；非流程图返回 null。
 */
export function detectFlowHeader(code) {
  const lines = String(code).split('\n')
  let i = 0
  if ((lines[0] || '').trim() === '---') {
    i = 1
    while (i < lines.length && lines[i].trim() !== '---') i++
    if (i < lines.length) i++
  }
  for (; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l || l.startsWith('%%')) continue
    const m = /^(flowchart|graph)(?:\s+(TB|TD|BT|LR|RL))?(?=\s|;|$)/i.exec(l)
    if (!m) return null
    const rawDir = (m[2] || 'TB').toUpperCase()
    return { lineIndex: i, kind: m[1].toLowerCase(), dir: rawDir, implied: !m[2] }
  }
  return null
}
/** 规范化 direction 参数：auto/空 → null；tb/td/lr/bt/rl → 大写；非法 → false */
export function parseDirection(v) {
  if (v === undefined || v === null) return null
  const s = String(v).trim().toLowerCase()
  if (s === '' || s === 'auto') return null
  const map = { tb: 'TB', td: 'TB', bt: 'BT', lr: 'LR', rl: 'RL' }
  return map[s] || false
}
/** 水平？LR/RL */
export const isHorizontalDir = (d) => { const x = String(d || 'TB').toUpperCase(); return x === 'LR' || x === 'RL' }
/**
 * 改写源码里第一个 flowchart/graph 的方向。成功返回新源码；非流程图返回 null。
 * target: TB|TD|BT|LR|RL（TD 写成 TB）
 */
export function setFlowDirection(code, target) {
  const dir = String(target).toUpperCase() === 'TD' ? 'TB' : String(target).toUpperCase()
  if (!FLOW_DIRECTIONS.includes(dir)) return null
  const info = detectFlowHeader(code)
  if (!info) return null
  const lines = String(code).split('\n')
  const line = lines[info.lineIndex]
  const next = line.replace(/^(\s*)(flowchart|graph)(?:\s+(TB|TD|BT|LR|RL))?(?=\s|;|$)/i, `$1$2 ${dir}`)
  if (next === line && info.dir === dir) return code
  lines[info.lineIndex] = next
  return lines.join('\n')
}
/** 一键翻转：LR/RL → TB，TB/TD/BT → LR */
export function flipFlowDirection(code) {
  const info = detectFlowHeader(code)
  if (!info) return null
  const d = info.dir === 'TD' ? 'TB' : info.dir
  return setFlowDirection(code, isHorizontalDir(d) ? 'TB' : 'LR')
}
/**
 * 按 API/控件的 direction 参数改写源码。
 * 返回 { ok, code, direction, rewritten }；ok=false 表示参数非法。
 * 非流程图时忽略 direction（不改写、不报错）。
 */
export function applyDirection(code, directionParam) {
  const d = parseDirection(directionParam)
  if (d === false) return { ok: false }
  const info = detectFlowHeader(code)
  if (!info) return { ok: true, code, direction: null, rewritten: false }
  if (d === null) {
    const cur = info.dir === 'TD' ? 'TB' : info.dir
    return { ok: true, code, direction: cur, rewritten: false }
  }
  const next = setFlowDirection(code, d)
  return { ok: true, code: next ?? code, direction: d, rewritten: !!(next && next !== code) }
}


// ---------- beautiful-mermaid 渲染 ----------
const FONT_TOKEN = '__MF_CJK__'

// beautiful-mermaid 不会去掉 xychart 轴标签两边的引号，而官方 mermaid 要求中文标签加引号。
// 流程图支持用 ; 分隔语句（如 `graph LR; A --> B`），beautiful-mermaid 不认，这里拆成多行（括号/引号/|标签| 内的 ; 不拆）
function splitSemicolons(code) {
  let out = '', depth = 0, quote = false, pipe = false
  for (const ch of code) {
    if (ch === '"') quote = !quote
    else if (!quote && ch === '|') pipe = !pipe
    else if (!quote && !pipe && '[({'.includes(ch)) depth++
    else if (!quote && !pipe && '])}'.includes(ch)) depth = Math.max(0, depth - 1)
    if (ch === ';' && !quote && !pipe && depth === 0) { out += '\n'; continue }
    if (ch === '\n') { quote = false; pipe = false; depth = 0 }
    out += ch
  }
  return out
}

export function preprocessBM(code) {
  if (/^\s*(graph|flowchart)\b/.test(firstLine(code)) && code.includes(';')) code = splitSemicolons(code)
  if (!/^\s*xychart/m.test(code)) return code
  return code.replace(/^(\s*[xy]-axis\b[^\[\n]*)\[([^\]\n]*)\]/gm, (_, head, items) =>
    head + '[' + items.split(',').map((x) => x.trim().replace(/^"(.*)"$/, '$1')).join(', ') + ']')
}

function postProcessBM(svg) {
  return svg
    // 去掉 Google Fonts 的 @import：国内访问慢，且 <img> / 画板里也加载不到
    .replace(/^\s*@import url\([^)]*\);\s*$/gm, '')
    .replace(new RegExp(`'${FONT_TOKEN}', system-ui, sans-serif`, 'g'), CJK_STACK)
    .replace(/\.mono \{ font-family: [^}]*\}/g, `.mono { font-family: ${MONO_STACK}; }`)
}

/** beautiful-mermaid → SVG（保留 CSS 变量，适合网页预览）。宽高取整并铺背景。 */
export function renderBM(code, themeId) {
  const theme = THEMES[themeId] || THEMES[DEFAULT_THEME]
  const raw = renderMermaidSVG(preprocessBM(code), { ...themeColors(theme), font: FONT_TOKEN })
  const svg = theme.board ? boardStyle(postProcessBM(raw), theme) : theme.blocks ? colorize(postProcessBM(raw), theme, code) : postProcessBM(raw)
  return normalizeRootString(svg, theme.bg)
}

// ---------- 色块上色（后处理 SVG：按分支 / 分组 / 角色给节点不同的浅色块） ----------
function blockVars(b, kind) {
  const m = {
    'var(--_node-fill)': kind === 'box' ? b.tint : b.fill,
    'var(--_group-hdr)': b.hdr,
    'var(--_node-stroke)': b.border,
    'var(--_inner-stroke)': b.border,
    'var(--_text)': b.text,
    'var(--_text-sec)': kind === 'subgraph' ? b.sub : b.text,
    'var(--_text-muted)': b.sub,
    'var(--_text-faint)': b.faint,
    'var(--_key-badge)': b.badge,
    'var(--_group-fill)': b.tint,
  }
  return m
}
function paint(inner, b, kind) {
  const m = blockVars(b, kind)
  return inner.replace(/var\(--_[\w-]+\)/g, (v) => m[v] || v)
}
function bbox(inner) {
  let m = /<rect\b[^>]*?\sx="([-\d.]+)"[^>]*?\sy="([-\d.]+)"[^>]*?\swidth="([\d.]+)"[^>]*?\sheight="([\d.]+)"/.exec(inner)
  if (m) { const [x, y, w, h] = m.slice(1).map(Number); return { x, y, w, h } }
  m = /<polygon\b[^>]*?\spoints="([^"]+)"/.exec(inner)
  if (m) {
    const pts = m[1].trim().split(/\s+/).map((p) => p.split(',').map(Number))
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
    const x = Math.min(...xs), y = Math.min(...ys)
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
  }
  m = /<circle\b[^>]*?\scx="([-\d.]+)"[^>]*?\scy="([-\d.]+)"[^>]*?\sr="([\d.]+)"/.exec(inner)
  if (m) { const [cx, cy, r] = m.slice(1).map(Number); return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r } }
  return null
}
const GROUP_RE = /<g class="(node|subgraph|actor|class-node|entity)"([^>]*)>([\s\S]*?)<\/g>/g
const dataAttr = (attrs, name) => { const m = new RegExp(`data-${name}="([^"]*)"`).exec(attrs); return m ? m[1] : null }

export function colorize(svg, theme, code = '') {
  const blocks = theme.blocks
  const groups = []
  for (const m of svg.matchAll(GROUP_RE)) {
    groups.push({ kind: m[1], id: dataAttr(m[2], 'id'), shape: dataAttr(m[2], 'shape'), box: bbox(m[3]) })
  }
  const nodeColor = new Map() // id → block
  const subColor = new Map()
  let next = 0
  const fresh = () => blocks[next++ % blocks.length]

  const nodes = groups.filter((g) => g.kind === 'node')
  if (nodes.length) {
    // 分组：每个 subgraph 一种色块，组内节点跟随（取包含它的最小分组）
    const subs = groups.filter((g) => g.kind === 'subgraph' && g.box)
    for (const sg of subs.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)) subColor.set(sg.id, fresh())
    const inside = (n) => {
      if (!n.box) return null
      const cx = n.box.x + n.box.w / 2, cy = n.box.y + n.box.h / 2
      let best = null
      for (const sg of subs) {
        const b = sg.box
        if (cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.h && (!best || b.w * b.h < best.box.w * best.box.h)) best = sg
      }
      return best
    }
    for (const n of nodes) { const sg = inside(n); if (sg) nodeColor.set(n.id, subColor.get(sg.id)) }
    // 分支：从根节点出发，单出边沿用父色，分叉时每个分支换一种色块
    const out = new Map(), indeg = new Map()
    for (const m of svg.matchAll(/class="edge"[^>]*?data-from="([^"]*)"[^>]*?data-to="([^"]*)"/g)) {
      if (!out.has(m[1])) out.set(m[1], [])
      if (!out.get(m[1]).includes(m[2])) out.get(m[1]).push(m[2])
      indeg.set(m[2], (indeg.get(m[2]) || 0) + 1)
    }
    const byPos = [...nodes].sort((a, b) => (a.box?.y ?? 0) - (b.box?.y ?? 0) || (a.box?.x ?? 0) - (b.box?.x ?? 0))
    const plain = (id) => { const n = nodes.find((x) => x.id === id); return n && /^state-(start|end)$/.test(n.shape || '') }
    const visit = (start) => {
      const queue = [start]
      while (queue.length) {
        const u = queue.shift()
        const kids = (out.get(u) || []).filter((k) => !nodeColor.has(k))
        for (const k of kids) {
          nodeColor.set(k, kids.length === 1 && !plain(u) ? nodeColor.get(u) : fresh())
          queue.push(k)
        }
      }
    }
    for (const n of byPos) {
      if (nodeColor.has(n.id) || (indeg.get(n.id) || 0) > 0) continue
      if (!plain(n.id)) nodeColor.set(n.id, fresh()); else nodeColor.set(n.id, null)
      visit(n.id)
    }
    for (const n of byPos) if (!nodeColor.has(n.id)) { nodeColor.set(n.id, fresh()); visit(n.id) }
  }
  // 时序图参与者 / 类 / ER 实体：按出现顺序轮换色块
  const roleColor = new Map()
  for (const g of groups) if (['actor', 'class-node', 'entity'].includes(g.kind) && !roleColor.has(g.id)) roleColor.set(g.id, blocks[roleColor.size % blocks.length])

  return svg.replace(GROUP_RE, (whole, kind, attrs, inner) => {
    const id = dataAttr(attrs, 'id'), shape = dataAttr(attrs, 'shape')
    let b = null, k = kind
    if (kind === 'subgraph') b = subColor.get(id)
    else if (kind === 'node') {
      if (/^state-(start|end)$/.test(shape || '')) return whole
      b = shape === 'diamond' ? theme.decision : nodeColor.get(id)
    } else { b = roleColor.get(id); k = kind === 'actor' ? 'node' : 'box' }
    return b ? `<g class="${kind}"${attrs}>${paint(inner, b, k)}</g>` : whole
  })
}

// ---------- 根节点（字符串版） ----------
function getAttr(tag, name) {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? m[1] : null
}
function setAttr(tag, name, value) {
  const re = new RegExp(`(\\s)${name}="[^"]*"`)
  if (re.test(tag)) return tag.replace(re, `$1${name}="${value}"`)
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${value}"$1>`)
}
function removeAttr(tag, name) { return tag.replace(new RegExp(`\\s${name}="[^"]*"`), '') }

export function svgDims(svg) {
  const tag = (/<svg\b[^>]*>/.exec(svg) || [''])[0]
  let w = parseFloat(getAttr(tag, 'width')), h = parseFloat(getAttr(tag, 'height'))
  const vb = (getAttr(tag, 'viewBox') || '').split(/[\s,]+/).map(Number)
  if (vb.length === 4 && vb.every(Number.isFinite)) {
    if (!(w > 0) || /%/.test(getAttr(tag, 'width') || '')) w = vb[2]
    if (!(h > 0) || /%/.test(getAttr(tag, 'height') || '')) h = vb[3]
  }
  return { width: Math.ceil(w || 0), height: Math.ceil(h || 0) }
}

function normalizeRootString(svg, bg) {
  const { width, height } = svgDims(svg)
  return svg.replace(/<svg\b[^>]*>/, (tag) => {
    if (!getAttr(tag, 'viewBox')) tag = setAttr(tag, 'viewBox', `0 0 ${width} ${height}`)
    tag = setAttr(tag, 'width', String(width))
    tag = setAttr(tag, 'height', String(height))
    const style = (getAttr(tag, 'style') || '').replace(/max-width:[^;]*;?/g, '').replace(/;?\s*$/, '')
    return setAttr(tag, 'style', (style ? style + ';' : '') + `background-color:${bg}`)
  })
}

// ---------- 颜色 ----------
const NAMED = { white: [255, 255, 255], black: [0, 0, 0] }
export function parseColor(c) {
  c = (c || '').trim().toLowerCase()
  if (NAMED[c]) return NAMED[c]
  let m = /^#([0-9a-f]{3,8})$/.exec(c)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((x) => x + x).join('')
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(c)
  if (m) return [m[1], m[2], m[3]].map(Number)
  return null
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
export function mix(a, b, t) { // t = a 的占比
  const A = parseColor(a), B = parseColor(b)
  if (!A || !B) return a
  return toHex(A.map((v, i) => v * t + B[i] * (1 - t)))
}
export function isDark(bg) {
  const c = parseColor(bg); if (!c) return false
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) < 128
}

// ---------- CSS 变量 / color-mix 求值（字符串版，不依赖浏览器） ----------
function matchParen(s, open) { // s[open] === '('
  let d = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') d++
    else if (s[i] === ')') { d--; if (d === 0) return i }
  }
  return -1
}
function splitTop(s) {
  const out = []; let d = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') d++
    if (ch === ')') d--
    if (ch === ',' && d === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}
function resolveVars(value, defs, depth = 0) {
  if (depth > 20) return value
  let guard = 0
  for (;;) {
    const i = value.indexOf('var(')
    if (i < 0 || guard++ > 200) break
    const close = matchParen(value, i + 3)
    if (close < 0) break
    const [name, ...rest] = splitTop(value.slice(i + 4, close))
    const fb = rest.join(',').trim()
    const key = name.trim()
    const rep = defs[key] !== undefined ? resolveVars(defs[key], defs, depth + 1) : fb ? resolveVars(fb, defs, depth + 1) : ''
    value = value.slice(0, i) + rep + value.slice(close + 1)
  }
  return evalColorMix(value)
}
function evalColorMix(value) {
  let guard = 0
  for (;;) {
    const i = value.lastIndexOf('color-mix(')
    if (i < 0 || guard++ > 200) break
    const close = matchParen(value, i + 9)
    if (close < 0) break
    const parts = splitTop(value.slice(i + 10, close)).map((x) => x.trim())
    const cols = parts.slice(1).map((p) => { const m = /^(.*?)\s+([\d.]+)%$/.exec(p); return m ? { c: m[1], p: +m[2] } : { c: p, p: null } })
    let out = 'none'
    if (cols.length === 2) {
      let [a, b] = cols
      let pa = a.p, pb = b.p
      if (pa == null && pb == null) { pa = 50; pb = 50 } else if (pa == null) pa = 100 - pb; else if (pb == null) pb = 100 - pa
      const A = parseColor(a.c), B = parseColor(b.c)
      if (A && B) out = toHex(A.map((v, k) => (v * pa + B[k] * pb) / (pa + pb)))
    }
    value = value.slice(0, i) + out + value.slice(close + 1)
  }
  return value
}
const dynamic = (v) => /var\(|color-mix\(/.test(v)

/**
 * 干净的独立 SVG（飞书画板导入 / HTML 小组件 / API 输出共用）：
 * 解析所有 CSS 变量和 color-mix 成具体颜色；去掉 @import、自定义属性；
 * 补齐 xmlns / viewBox / width / height；根节点铺背景色。
 */
export function cleanSvg(svg, bg) {
  svg = svg.replace(/^\s*<\?xml[^>]*>\s*/, '')
  // 1) 收集变量定义（根 style 属性 + 各 <style> 块）
  const defs = {}
  const rootTag = (/<svg\b[^>]*>/.exec(svg) || [''])[0]
  const blocks = []
  svg.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_, css) => { blocks.push(css); return _ })
  for (const css of blocks) for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) defs[m[1]] = m[2].trim()
  for (const m of (getAttr(rootTag, 'style') || '').matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) defs[m[1]] = m[2].trim()

  // 2) 处理 <style> 块（先挖出来，避免属性正则误伤）
  const stash = []
  svg = svg.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (_, open, css, close) => {
    css = css.replace(/@import[^;]*;/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    css = css.replace(/([{;\s])--[\w-]+\s*:[^;{}]*;?/g, '$1')
    css = css.replace(/([\w-]+)\s*:\s*([^;{}]+)/g, (m, prop, val) => (dynamic(val) ? `${prop}: ${resolveVars(val, defs)}` : m))
    css = css.replace(/[^{}]+\{\s*;?\s*\}/g, '').replace(/\n\s*\n+/g, '\n').trim()
    stash.push(css ? `${open}\n${css}\n${close}` : '')
    return `\u0000STYLE${stash.length - 1}\u0000`
  })

  // 3) 属性里的 var()/color-mix → 具体值；style 属性去掉自定义属性
  svg = svg.replace(/(\s)([\w:-]+)="([^"]*)"/g, (m, sp, name, val) => {
    if (name === 'style') {
      const kept = val.split(';').map((d) => d.trim()).filter((d) => d.includes(':') && !d.startsWith('--'))
        .map((d) => { const k = d.indexOf(':'); const p = d.slice(0, k).trim(), v = d.slice(k + 1).trim(); return dynamic(v) ? `${p}:${resolveVars(v, defs)}` : `${p}:${v}` })
      return kept.length ? `${sp}style="${kept.join(';')}"` : ''
    }
    return dynamic(val) ? `${sp}${name}="${resolveVars(val, defs)}"` : m
  })
  svg = svg.replace(/\u0000STYLE(\d+)\u0000/g, (_, i) => stash[+i])

  // 4) 根节点
  const { width, height } = svgDims(svg)
  svg = svg.replace(/<svg\b[^>]*>/, (tag) => {
    tag = setAttr(tag, 'xmlns', 'http://www.w3.org/2000/svg')
    if (/xlink:href/.test(svg)) tag = setAttr(tag, 'xmlns:xlink', 'http://www.w3.org/1999/xlink')
    if (!getAttr(tag, 'viewBox')) tag = setAttr(tag, 'viewBox', `0 0 ${width} ${height}`)
    tag = setAttr(tag, 'width', String(width))
    tag = setAttr(tag, 'height', String(height))
    return setAttr(tag, 'style', `background-color:${bg}`)
  })
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + svg
}

/** 把干净 SVG 收成适合 HTML 小组件的内联片段 */
function inlineSvgForWidget(clean, bg) {
  const { width } = svgDims(clean)
  const cssW = Math.min(width || FEISHU_WIDTH, FEISHU_WIDTH)
  return clean.replace(/^\s*<\?xml[^>]*>\s*/, '').replace(/<svg\b[^>]*>/, (tag) => {
    tag = setAttr(tag, 'width', '100%')
    tag = removeAttr(tag, 'height')
    tag = setAttr(tag, 'preserveAspectRatio', 'xMidYMid meet')
    return setAttr(tag, 'style', `display:block;width:100%;max-width:${cssW}px;height:auto;margin:0 auto;background-color:${bg}`)
  })
}

/**
 * 飞书 HTML 小组件：自包含离线 HTML，内联 SVG，无外部字体 / 无网络请求，居中、按 820px 自适应。
 * opts:
 *   primaryDir / secondaryDir — 流程图走向
 *   source / secondarySource — Mermaid 源码（嵌入 <script type="text/plain"> + 只读「源码」折叠面板）
 * 若传入 second（另一走向 SVG）：左上角浮层「LR / TB」纯 CSS 切换两张图；源码面板也按 radio 同步显示对应走向。
 * 右上角浮层「Copy Mermaid」复制当前可见走向的源码（有脚本时写剪贴板；失败弹窗手选）。
 * 浮层按钮与源码面板 @media print 隐藏。
 */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
/** <script type="text/plain"> 内容仍会被 HTML 解析器找 </script>，需拆开 */
function escapeScriptPlain(s) {
  return String(s).replace(/<\/(script)/gi, '<\\/$1')
}

function sourcePanel(label, text, extraClass = '') {
  const cls = extraClass ? `mf-src ${extraClass}` : 'mf-src'
  return `<details class="${cls}">
<summary>源码${label ? `（${label}）` : ''}</summary>
<pre class="mf-src-pre" tabindex="0">${escapeHtml(text)}</pre>
</details>`
}

export function buildHtmlWidget(clean, bg, second = null, opts = {}) {
  const primaryDir = (opts.primaryDir || 'TB').toUpperCase()
  const secondaryDir = (opts.secondaryDir || (primaryDir === 'LR' || primaryDir === 'RL' ? 'TB' : 'LR')).toUpperCase()
  const source = opts.source != null ? String(opts.source) : ''
  const secondarySource = opts.secondarySource != null ? String(opts.secondarySource) : source
  const primary = inlineSvgForWidget(clean, bg)
  const hasDual = !!second
  const secondary = hasDual ? inlineSvgForWidget(second, bg) : ''

  // opts.viewUrl：右上角加「新窗口查看」（/view 链接，纯 <a>，无脚本）；不传则与原输出逐字节相同（API 不传）
  const viewUrl = opts.viewUrl ? String(opts.viewUrl) : ''
  const copyBtnOnly = `<button type="button" class="mf-btn mf-copy" id="mf-copy" title="复制当前可见图的 Mermaid 源码">Copy Mermaid</button>`
  const copyBtn = viewUrl
    ? `<div class="mf-tr"><a class="mf-btn mf-view" id="mf-view" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener" title="在新窗口打开可缩放的纯预览（需联网）">新窗口查看</a>${copyBtnOnly}</div>`
    : copyBtnOnly
  const flipBtns = hasDual ? `<label class="mf-btn mf-flip" for="mf-d-b" title="切换为 ${secondaryDir}">LR / TB</label>
<label class="mf-btn mf-flip" for="mf-d-a" title="切换为 ${primaryDir}">LR / TB</label>` : ''

  const srcScripts = source
    ? (hasDual
      ? `<script type="text/plain" id="mermaid-source-a">${escapeScriptPlain(source)}</script>
<script type="text/plain" id="mermaid-source-b">${escapeScriptPlain(secondarySource)}</script>`
      : `<script type="text/plain" id="mermaid-source">${escapeScriptPlain(source)}</script>`)
    : ''

  // 只读源码面板：双走向时两个 details，用同一组 radio 纯 CSS 切换可见性（打开态各自保留）
  const srcPanels = source
    ? (hasDual
      ? `${sourcePanel(primaryDir, source, 'mf-src-a')}
${sourcePanel(secondaryDir, secondarySource, 'mf-src-b')}`
      : sourcePanel('', source))
    : ''

  const dialog = source
    ? `<dialog class="mf-dlg" id="mf-copy-dlg">
<form method="dialog" class="mf-dlg-body">
<p class="mf-dlg-title">选中下方文字后复制</p>
<textarea id="mf-copy-ta" readonly rows="10"></textarea>
<menu><button value="close" type="submit">关闭</button></menu>
</form>
</dialog>`
    : ''

  const copyScript = source
    ? `<script>
(function(){
  var btn=document.getElementById('mf-copy');
  if(!btn)return;
  function un(t){return t.replace(/<\\\\\\\/(script)/gi,'<\/$1');}
  function src(){
    var a=document.getElementById('mermaid-source-a');
    var b=document.getElementById('mermaid-source-b');
    var one=document.getElementById('mermaid-source');
    if(a&&b){
      var rb=document.getElementById('mf-d-b');
      return un((rb&&rb.checked?b:a).textContent);
    }
    return one?un(one.textContent):'';
  }
  function toast(ok){
    var t=document.createElement('div');
    t.className='mf-toast';
    t.textContent=ok?'已复制':'复制失败，请手选';
    document.body.appendChild(t);
    setTimeout(function(){t.remove()},1600);
  }
  function showDlg(text){
    var d=document.getElementById('mf-copy-dlg');
    var ta=document.getElementById('mf-copy-ta');
    if(!d||!ta)return;
    ta.value=text;
    if(d.showModal)d.showModal(); else d.setAttribute('open','');
    try{ta.focus();ta.select();}catch(e){}
  }
  function fallbackCopy(text){
    try{
      var ta=document.createElement('textarea');
      ta.value=text;ta.setAttribute('readonly','');
      ta.style.cssText='position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);ta.select();
      var ok=document.execCommand('copy');
      document.body.removeChild(ta);
      if(ok){toast(true);return;}
    }catch(e){}
    showDlg(text);toast(false);
  }
  btn.addEventListener('click',function(){
    var text=src();
    if(!text){showDlg('');return;}
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){toast(true);},function(){fallbackCopy(text);});
    }else fallbackCopy(text);
  });
})();
</script>`
    : ''

  const cssCommon = `
html,body{margin:0;padding:0;background:${bg};}
body{font-family:${CJK_STACK};}
.mf-wrap{box-sizing:border-box;max-width:820px;margin:0 auto;padding:16px 12px;position:relative;}
.mf-btn{position:absolute;z-index:2;top:10px;font:12px/1.2 ${CJK_STACK};padding:5px 10px;border:1px solid rgba(51,112,255,.35);border-radius:6px;background:rgba(255,255,255,.82);color:#2b5cb8;cursor:pointer;user-select:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);box-shadow:0 1px 3px rgba(0,0,0,.06);}
.mf-btn:hover{background:rgba(240,244,255,.95);border-color:#3370ff;}
.mf-flip{left:10px;display:none;}
.mf-copy{right:10px;}
.mf-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(31,35,41,.92);color:#fff;padding:6px 14px;border-radius:8px;font-size:13px;z-index:9;pointer-events:none;}
.mf-dlg{border:1px solid #e5e6eb;border-radius:10px;padding:0;max-width:min(560px,92vw);width:92vw;box-shadow:0 8px 28px rgba(0,0,0,.18);}
.mf-dlg::backdrop{background:rgba(0,0,0,.35);}
.mf-dlg-body{margin:0;padding:14px 16px 12px;display:flex;flex-direction:column;gap:8px;}
.mf-dlg-title{margin:0;font-size:14px;font-weight:600;color:#1f2329;}
.mf-dlg textarea{width:100%;box-sizing:border-box;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;border:1px solid #e5e6eb;border-radius:6px;padding:8px;resize:vertical;min-height:140px;background:#fafbfc;}
.mf-dlg menu{margin:0;padding:0;display:flex;justify-content:flex-end;}
.mf-dlg menu button{font:13px ${CJK_STACK};padding:5px 14px;border:1px solid #e5e6eb;border-radius:6px;background:#fff;cursor:pointer;}
.mf-src{margin:12px 0 0;font-size:13px;color:#646a73;border:1px solid #e5e6eb;border-radius:8px;background:rgba(247,248,250,.9);padding:0 10px 8px;}
.mf-src summary{cursor:pointer;user-select:none;padding:8px 2px;font-weight:500;color:#4e5969;list-style:none;}
.mf-src summary::-webkit-details-marker{display:none;}
.mf-src summary::before{content:'▸ ';color:#8f959e;}
.mf-src[open] summary::before{content:'▾ ';}
.mf-src-pre{margin:0;padding:8px 10px;border-radius:6px;background:#fff;border:1px solid #e5e6eb;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#1f2329;white-space:pre-wrap;word-break:break-word;max-height:280px;overflow:auto;tab-size:2;}
@media print{.mf-btn,.mf-toast,.mf-dlg,.mf-src{display:none!important;}}
${viewUrl ? `.mf-tr{position:absolute;z-index:2;top:10px;right:10px;display:flex;gap:6px;}.mf-tr .mf-btn{position:static;text-decoration:none;}` : ''}
`.trim()

  if (!hasDual) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mermaid</title>
<style>
${cssCommon}
.mf-diagram{display:flex;justify-content:center;width:100%;}
</style>
</head>
<body>
${srcScripts}
<div class="mf-wrap">
${copyBtn}
<div class="mf-diagram">${primary}</div>
${srcPanels}
</div>
${dialog}
${copyScript}
</body>
</html>
`
  }

  const cssDual = `
.mf-wrap input[name="mf-dir"]{position:absolute;opacity:0;pointer-events:none;width:0;height:0;}
.mf-pane{display:flex;justify-content:center;}
.mf-pane-b{display:none;}
.mf-src-a,.mf-src-b{display:none;}
#mf-d-a:checked ~ .mf-flip[for="mf-d-b"]{display:inline-flex;align-items:center;}
#mf-d-b:checked ~ .mf-flip[for="mf-d-a"]{display:inline-flex;align-items:center;}
#mf-d-a:checked ~ .mf-pane-a{display:flex;}
#mf-d-a:checked ~ .mf-pane-b{display:none;}
#mf-d-b:checked ~ .mf-pane-a{display:none;}
#mf-d-b:checked ~ .mf-pane-b{display:flex;}
#mf-d-a:checked ~ .mf-src-a{display:block;}
#mf-d-b:checked ~ .mf-src-b{display:block;}
@media print{.mf-flip{display:none!important;}}
`.trim()

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mermaid</title>
<style>
${cssCommon}
${cssDual}
</style>
</head>
<body>
${srcScripts}
<div class="mf-wrap">
<input type="radio" name="mf-dir" id="mf-d-a" checked>
<input type="radio" name="mf-dir" id="mf-d-b">
${flipBtns}
${copyBtn}
<div class="mf-pane mf-pane-a">${primary}</div>
<div class="mf-pane mf-pane-b">${secondary}</div>
${srcPanels}
</div>
${dialog}
${copyScript}
</body>
</html>
`
}


export function byteLength(s) { return new TextEncoder().encode(s).length }


// ---------- 飞书画板风（board 主题）后处理 ----------
const num = (v) => Math.round(v * 100) / 100
function parsePoints(str) { return str.trim().split(/\s+/).map((p) => p.split(',').map(Number)) }
function roundedPath(pts, r) {
  if (pts.length < 2) return ''
  let d = `M ${num(pts[0][0])} ${num(pts[0][1])}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1]
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y)
    const rr = Math.min(r, l1 / 2, l2 / 2)
    if (rr < 0.5) { d += ` L ${num(x)} ${num(y)}`; continue }
    const ax = x - ((x - px) / l1) * rr, ay = y - ((y - py) / l1) * rr
    const bx = x + ((nx - x) / l2) * rr, by = y + ((ny - y) / l2) * rr
    d += ` L ${num(ax)} ${num(ay)} Q ${num(x)} ${num(y)} ${num(bx)} ${num(by)}`
  }
  const [lx, ly] = pts[pts.length - 1]
  return d + ` L ${num(lx)} ${num(ly)}`
}
function estTextWidth(t, size = 13) {
  let w = 0
  for (const ch of t) w += /[\u2E80-\uFFFF]/.test(ch) ? size : /[A-Z]/.test(ch) ? size * 0.68 : size * 0.56
  return w
}
const decodeEnt = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

function setWeight(tag, w) {
  return /font-weight="/.test(tag) ? tag.replace(/font-weight="[^"]*"/, `font-weight="${w}"`) : tag.replace(/^<text\b/, `<text font-weight="${w}"`)
}
/** 节点加高后：贴在旧上/下边的端点挪到新上/下边（同一竖直段一起挪，保持正交） */
function extendEnd(pts, g) {
  if (pts.length < 2) return pts
  const [e, q] = pts
  const top = Math.abs(e[1] - g.y) < 1.5, bot = Math.abs(e[1] - (g.y + g.h)) < 1.5
  if (!top && !bot) return pts
  const ny = top ? g.ny : g.ny + g.nh
  const out = pts.map((p) => p.slice())
  out[0][1] = ny
  // 第一段若是水平的（极少见），补一个竖直小段
  if (Math.abs(e[1] - q[1]) < 0.5) out.splice(1, 0, [e[0], e[1]])
  return out
}

/** 把连接判断节点的端点挪到新圆角矩形的边上；必要时加一个小折线，保持正交 */
function reattach(pts, rect, dia) {
  // pts[0] 是贴着节点的端点
  if (pts.length < 2) return pts
  const [e, q] = pts
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2
  const horizontal = Math.abs(e[1] - q[1]) < 0.5
  const vertical = Math.abs(e[0] - q[0]) < 0.5
  if (horizontal) {
    const side = q[0] < cx ? rect.x : rect.x + rect.w
    const sy = (rect.h / 2 - 8) / (dia.h / 2 || 1)
    const yt = cy + (e[1] - cy) * Math.max(0, Math.min(1, sy))
    if (Math.abs(yt - e[1]) < 0.5) return [[side, e[1]], ...pts.slice(1)]
    const dir = q[0] < cx ? -1 : 1
    let xk = side + dir * 14
    if ((q[0] - xk) * dir < 4) xk = (q[0] + side) / 2
    return [[side, yt], [xk, yt], [xk, e[1]], ...pts.slice(1)]
  }
  if (vertical) {
    const side = q[1] < cy ? rect.y : rect.y + rect.h
    const sx = (rect.w / 2 - 10) / (dia.w / 2 || 1)
    const xt = cx + (e[0] - cx) * Math.max(0, Math.min(1, sx))
    if (Math.abs(xt - e[0]) < 0.5) return [[e[0], side], ...pts.slice(1)]
    const dir = q[1] < cy ? -1 : 1
    let yk = side + dir * 14
    if ((q[1] - yk) * dir < 4) yk = (q[1] + side) / 2
    return [[xt, side], [xt, yk], [e[0], yk], ...pts.slice(1)]
  }
  return pts
}

export function boardStyle(svg, theme) {
  const B = theme.board
  // 1) 判断节点：菱形 → 白底蓝色虚线圆角矩形
  const decisions = new Map()
  svg = svg.replace(/<g class="node"([^>]*data-shape="diamond"[^>]*)>([\s\S]*?)<\/g>/g, (whole, attrs, inner) => {
    const id = dataAttr(attrs, 'id')
    const dia = bbox(inner)
    if (!dia) return whole
    const texts = inner.match(/<text\b[^>]*>[\s\S]*?<\/text>/g) || []
    const label = decodeEnt((dataAttr(attrs, 'label') || '').replace(/<br\s*\/?>/g, '\n'))
    const longest = Math.max(...label.split('\n').map((l) => estTextWidth(l)), 40)
    const w = Math.min(dia.w, Math.max(longest + 48, 110))
    const h = Math.max(B.minNodeH, texts.length * 18 + 26)
    const rect = { x: dia.x + (dia.w - w) / 2, y: dia.y + (dia.h - h) / 2, w, h }
    decisions.set(id, { rect, dia })
    const shape = `<rect x="${num(rect.x)}" y="${num(rect.y)}" width="${num(w)}" height="${num(h)}" rx="${B.radius}" ry="${B.radius}" fill="${B.decisionFill}" stroke="${B.decisionStroke}" stroke-width="1" stroke-dasharray="${B.decisionDash}" />`
    const t = texts.map((x) => setWeight(x.replace(/fill="[^"]*"/, `fill="${B.text}"`), B.weight)).join('\n  ')
    return `<g class="node"${attrs}>\n  ${shape}\n  ${t}\n</g>`
  })
  const grown = new Map()
  // 2) 普通节点：统一浅蓝圆角块，几乎无边框；文字蓝色
  svg = svg.replace(/<g class="node"([^>]*)>([\s\S]*?)<\/g>/g, (whole, attrs, inner) => {
    const shape = dataAttr(attrs, 'shape') || ''
    if (shape === 'diamond' || /^state-(start|end)$/.test(shape)) return whole
    inner = inner
      .replace(/fill="var\(--_node-fill\)"/g, `fill="${B.node}"`)
      .replace(/stroke="var\(--_node-stroke\)"/g, `stroke="${B.nodeStroke}"`)
      .replace(/fill="var\(--_text\)"/g, `fill="${B.text}"`)
    if (shape === 'rectangle' || shape === 'rounded' || shape === '' || shape === 'stadium') {
      if (shape !== 'stadium') inner = inner.replace(/(<rect\b[^>]*?)\srx="[^"]*"\s+ry="[^"]*"/, `$1 rx="${B.radius}" ry="${B.radius}"`)
      // 加高：上下各加 padY（单行至少 minNodeH），居中扩展；记下新旧框给连线重新贴边
      inner = inner.replace(/<rect\b([^>]*?)\/>/, (r, ra) => {
        const g = (n) => parseFloat(new RegExp(`\\s${n}="([-\\d.]+)"`).exec(ra)?.[1] ?? 'NaN')
        const x = g('x'), y = g('y'), w = g('width'), h = g('height')
        if (![x, y, w, h].every(Number.isFinite)) return r
        const nh = Math.max(B.minNodeH, h + B.padY), ny = y - (nh - h) / 2
        grown.set(dataAttr(attrs, 'id'), { x, y, w, h, ny, nh })
        const pill = shape === 'stadium' ? ` rx="${num(nh / 2)}" ry="${num(nh / 2)}"` : ''
        return `<rect${ra.replace(pill ? /\s(y|height|rx|ry)="[^"]*"/g : /\s(y|height)="[^"]*"/g, '')} y="${num(ny)}" height="${num(nh)}"${pill} />`
      })
    }
    inner = inner.replace(/<text\b[^>]*>/g, (t) => setWeight(t, B.weight))
    return `<g class="node"${attrs}>${inner}</g>`
  })
  // 3) 连线：端点贴到判断节点新边框上；正交折线 → 圆角路径
  svg = svg.replace(/<polyline class="edge"([^>]*?)\spoints="([^"]*)"([^>]*?)\/>/g, (whole, a1, pts, a2) => {
    const attrs = a1 + a2
    let p = parsePoints(pts)
    const from = decisions.get(dataAttr(attrs, 'from')), to = decisions.get(dataAttr(attrs, 'to'))
    if (from) p = reattach(p, from.rect, from.dia)
    if (to) p = reattach(p.slice().reverse(), to.rect, to.dia).reverse()
    const gf = grown.get(dataAttr(attrs, 'from')), gt = grown.get(dataAttr(attrs, 'to'))
    if (gf) p = extendEnd(p, gf)
    if (gt) p = extendEnd(p.slice().reverse(), gt).reverse()
    const rest = attrs.replace(/\sstroke="[^"]*"/, '').replace(/\sfill="[^"]*"/, '')
    return `<path class="edge"${rest} d="${roundedPath(p, B.corner)}" fill="none" stroke="${B.line}" />`
  })
  // 4) 「是/否」标签：白底蓝边胶囊
  svg = svg.replace(/<g class="edge-label"([^>]*)>([\s\S]*?)<\/g>/g, (whole, attrs, inner) => {
    inner = inner.replace(/<rect\b([^>]*?)\/>/, (r, ra) => {
      const g = (n) => parseFloat(new RegExp(`\\s${n}="([-\\d.]+)"`).exec(ra)?.[1] || '0')
      let x = g('x'), y = g('y'), w = g('width'), h = g('height')
      const nh = Math.min(h, 22), nw = Math.max(w, nh * 1.9) // 胶囊：高 ≤ 22，宽 ≥ 1.9 倍高
      x += (w - nw) / 2; y += (h - nh) / 2
      const keep = ra.replace(/\s(x|y|width|height|rx|ry|fill|stroke|stroke-width)="[^"]*"/g, '')
      return `<rect${keep} x="${num(x)}" y="${num(y)}" width="${num(nw)}" height="${num(nh)}" rx="${num(nh / 2)}" ry="${num(nh / 2)}" fill="${B.chipFill}" stroke="${B.chipStroke}" stroke-width="1" />`
    }).replace(/fill="var\(--_text[\w-]*\)"/g, `fill="${B.chipText}"`).replace(/font-weight="\d+"/, 'font-weight="500"')
    return `<g class="edge-label"${attrs}>${inner}</g>`
  })
  // 5) 小开口箭头
  const chevron = (id, orient) => `<marker id="${id}" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="${orient}" markerUnits="userSpaceOnUse">
    <polyline points="2 1.2, 6.5 4, 2 6.8" fill="none" stroke="${B.arrow}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
  </marker>`
  svg = svg.replace(/<marker id="arrowhead"[\s\S]*?<\/marker>/, chevron('arrowhead', 'auto'))
    .replace(/<marker id="arrowhead-start"[\s\S]*?<\/marker>/, chevron('arrowhead-start', 'auto-start-reverse'))
  // 6) XY 图：柱/线/点/图例改成同一浅蓝色系
  const ci = (i) => +i % B.xyLine.length
  // 折线按出现顺序取色（第一条线 #4A86E8），柱子按柱序取色
  const lineIdx = [...new Set([...svg.matchAll(/class="xychart-line xychart-color-(\d+)"/g)].map((m) => m[1]))]
  const li = (i) => (lineIdx.includes(i) ? lineIdx.indexOf(i) : +i) % B.xyLine.length
  svg = svg
    .replace(/\.xychart-bar\.xychart-color-(\d+)\s*\{[^}]*\}/g, (m, i) => `.xychart-bar.xychart-color-${i} { stroke: ${B.xyBarStroke[ci(i)]}; fill: ${B.xyFill[ci(i)]}; }`)
    .replace(/\.xychart-color-(\d+), line\.xychart-color-\1\s*\{[^}]*\}/g, (m, i) => `.xychart-color-${i}, line.xychart-color-${i} { stroke: ${B.xyLine[li(i)]}; }`)
    .replace(/circle\.xychart-color-(\d+)\s*\{[^}]*\}/g, (m, i) => `circle.xychart-color-${i} { fill: ${B.xyLine[li(i)]}; }`)
  // 7) 其他图（时序/类/ER/状态）：表头、内线、徽标改成蓝色系；文字 500
  svg = svg.replace(/(<g class="(?:actor|class-node|entity)"[^>]*>)([\s\S]*?)(<\/g>)/g, (m, a, inner, z) => a + inner.replace(/<text\b[^>]*>/g, (t) => /font-weight="(6|7)00"/.test(t) ? t : setWeight(t, B.weight)) + z)
  return svg
    .replace(/var\(--_group-hdr\)/g, B.hdr)
    .replace(/var\(--_inner-stroke\)/g, B.inner)
    .replace(/var\(--_key-badge\)/g, B.badge)
}
