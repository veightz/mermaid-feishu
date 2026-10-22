// 前端和 Pages Functions 共用的核心逻辑：不依赖 DOM，Workers 里也能跑。
import { renderMermaidSVG, THEMES as BM_THEMES } from 'beautiful-mermaid'

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
export const DEFAULT_THEME = 'feishu-light'
export const THEMES = { ...CUSTOM_THEMES, ...BM_THEMES }
export const THEME_LABELS = {
  'feishu-light': '飞书白（默认）', 'feishu-gray': '飞书浅灰', 'soft-sage': '淡雅灰绿',
  'zinc-light': '简洁浅色', 'github-light': 'GitHub 浅色', 'nord-light': 'Nord 浅色', 'tokyo-night-light': 'Tokyo Night 浅色',
  'catppuccin-latte': 'Catppuccin Latte', 'solarized-light': 'Solarized 浅色', 'zinc-dark': '简洁深色', 'github-dark': 'GitHub 深色',
  'tokyo-night': 'Tokyo Night', 'tokyo-night-storm': 'Tokyo Night Storm', 'catppuccin-mocha': 'Catppuccin Mocha', nord: 'Nord',
  dracula: 'Dracula', 'solarized-dark': 'Solarized 深色', 'one-dark': 'One Dark',
}
export const themeColors = (t) => { const { soft, ...c } = t; return c }
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
export function preprocessBM(code) {
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
  return normalizeRootString(postProcessBM(raw), theme.bg)
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
