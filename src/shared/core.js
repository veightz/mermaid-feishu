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

export const DEFAULT_THEME = 'feishu-light'
export const THEMES = { ...CUSTOM_THEMES, ...BLOCK_THEMES, ...BM_THEMES }
export const THEME_LABELS = {
  'feishu-light': '飞书白（默认）', 'feishu-gray': '飞书浅灰', 'soft-sage': '淡雅灰绿',
  'notion-blocks': 'Notion 色块', 'latte-blocks': 'Catppuccin Latte 色块', 'rose-pine-dawn': 'Rosé Pine Dawn 色块', 'nord-snow': 'Nord 雪原色块', 'solarized-paper': 'Solarized 纸色块',
  'zinc-light': '简洁浅色', 'github-light': 'GitHub 浅色', 'nord-light': 'Nord 浅色', 'tokyo-night-light': 'Tokyo Night 浅色',
  'catppuccin-latte': 'Catppuccin Latte', 'solarized-light': 'Solarized 浅色', 'zinc-dark': '简洁深色', 'github-dark': 'GitHub 深色',
  'tokyo-night': 'Tokyo Night', 'tokyo-night-storm': 'Tokyo Night Storm', 'catppuccin-mocha': 'Catppuccin Mocha', nord: 'Nord',
  dracula: 'Dracula', 'solarized-dark': 'Solarized 深色', 'one-dark': 'One Dark',
}
export const themeColors = (t) => { const { soft, blocks, decision, ...c } = t; return c }
export function themeList() {
  return Object.keys(THEME_LABELS).filter((id) => THEMES[id]).map((id) => ({ id, name: THEME_LABELS[id], background: THEMES[id].bg, dark: isDark(THEMES[id].bg) }))
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
  const svg = theme.blocks ? colorize(postProcessBM(raw), theme, code) : postProcessBM(raw)
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

/** 飞书 HTML 小组件：自包含 HTML，内联 SVG，无外部脚本/字体，居中、按 820px 自适应 */
export function buildHtmlWidget(clean, bg) {
  const { width } = svgDims(clean)
  const cssW = Math.min(width || FEISHU_WIDTH, FEISHU_WIDTH)
  const inline = clean.replace(/^\s*<\?xml[^>]*>\s*/, '').replace(/<svg\b[^>]*>/, (tag) => {
    tag = setAttr(tag, 'width', '100%')
    tag = removeAttr(tag, 'height')
    tag = setAttr(tag, 'preserveAspectRatio', 'xMidYMid meet')
    return setAttr(tag, 'style', `display:block;width:100%;max-width:${cssW}px;height:auto;margin:0 auto;background-color:${bg}`)
  })
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mermaid</title>
<style>
html,body{margin:0;padding:0;background:${bg};}
body{font-family:${CJK_STACK};}
.mf-wrap{box-sizing:border-box;max-width:820px;margin:0 auto;padding:16px 12px;display:flex;justify-content:center;}
</style>
</head>
<body>
<div class="mf-wrap">
${inline}
</div>
</body>
</html>
`
}

export function byteLength(s) { return new TextEncoder().encode(s).length }
