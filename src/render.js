import { renderMermaidSVG, THEMES } from 'beautiful-mermaid'

export { THEMES }

// 中文优先的系统字体栈：SVG 以 <img> 栅格化时拿不到网页字体，只能用系统字体，
// 所以这里只列各平台自带/常见的中文字体，不依赖任何网络字体。
export const CJK_STACK = `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei', 'Segoe UI', sans-serif`
export const MONO_STACK = `'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans Mono CJK SC', 'Noto Sans CJK SC', monospace`

// beautiful-mermaid 支持的图（按首行关键字判断）
const BM_HEADERS = /^(graph|flowchart|stateDiagram(-v2)?|sequenceDiagram|classDiagram|erDiagram|xychart(-beta)?)\b/

function firstLine(code) {
  for (const raw of code.split('\n')) {
    const l = raw.trim()
    if (!l || l.startsWith('%%')) continue
    if (l === '---') return '' // front-matter，交给 mermaid.js
    return l
  }
  return ''
}

const FONT_TOKEN = '__MF_CJK__'

// beautiful-mermaid 不会去掉 xychart 轴标签两边的引号，而官方 mermaid 要求中文标签加引号。
// 这里在交给 beautiful-mermaid 前去掉 [ ... ] 里的引号，两边写法都能好看。
function preprocessBM(code) {
  if (!/^\s*xychart/m.test(code)) return code
  return code.replace(/^(\s*[xy]-axis\b[^\[\n]*)\[([^\]\n]*)\]/gm, (_, head, items) =>
    head + '[' + items.split(',').map((x) => x.trim().replace(/^"(.*)"$/, '$1')).join(', ') + ']')
}

function postProcessBM(svg) {
  return svg
    // 去掉 Google Fonts 的 @import：国内访问慢，且 <img> 里也加载不到
    .replace(/^\s*@import url\([^)]*\);\s*$/gm, '')
    .replace(new RegExp(`'${FONT_TOKEN}', system-ui, sans-serif`, 'g'), CJK_STACK)
    .replace(/\.mono \{ font-family: [^}]*\}/g, `.mono { font-family: ${MONO_STACK}; }`)
}

// ---------- 颜色工具（给 mermaid.js 回退生成 base 主题变量） ----------
function hex(c) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c || '')
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
function mix(a, b, t) { // t = a 的占比
  const A = hex(a), B = hex(b)
  if (!A || !B) return a
  return '#' + A.map((v, i) => Math.round(v * t + B[i] * (1 - t)).toString(16).padStart(2, '0')).join('')
}
function isDark(bg) {
  const c = hex(bg); if (!c) return false
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) < 128
}

function mermaidThemeVars(t) {
  const { bg, fg } = t
  const accent = t.accent || mix(fg, bg, 0.85)
  const vars = {
    darkMode: isDark(bg),
    background: bg,
    fontFamily: CJK_STACK,
    fontSize: '14px',
    primaryColor: t.surface || mix(fg, bg, 0.05),
    primaryTextColor: fg,
    primaryBorderColor: t.border || mix(fg, bg, 0.25),
    secondaryColor: mix(accent, bg, 0.14),
    secondaryTextColor: fg,
    secondaryBorderColor: mix(accent, bg, 0.4),
    tertiaryColor: mix(fg, bg, 0.03),
    tertiaryTextColor: fg,
    tertiaryBorderColor: mix(fg, bg, 0.2),
    lineColor: t.line || mix(fg, bg, 0.5),
    textColor: fg,
    titleColor: fg,
    mainBkg: t.surface || mix(fg, bg, 0.05),
    nodeBorder: t.border || mix(fg, bg, 0.25),
    // 甘特图
    sectionBkgColor: mix(accent, bg, 0.08),
    altSectionBkgColor: bg,
    sectionBkgColor2: mix(fg, bg, 0.04),
    taskBkgColor: mix(accent, bg, 0.55),
    taskBorderColor: accent,
    taskTextColor: isDark(mix(accent, bg, 0.55)) ? '#ffffff' : fg,
    taskTextDarkColor: fg,
    taskTextOutsideColor: fg,
    activeTaskBkgColor: mix(accent, bg, 0.3),
    activeTaskBorderColor: accent,
    doneTaskBkgColor: mix(fg, bg, 0.18),
    doneTaskBorderColor: mix(fg, bg, 0.35),
    gridColor: mix(fg, bg, 0.15),
    todayLineColor: accent,
    // 饼图
    pieStrokeColor: bg,
    pieOuterStrokeColor: mix(fg, bg, 0.2),
    pieTitleTextColor: fg,
    pieSectionTextColor: isDark(bg) ? fg : '#ffffff',
    pieLegendTextColor: fg,
  }
  // 饼图色板：多色相，深浅主题通用
  const palette = ['#3370ff', '#34c724', '#ff8800', '#7f3bf5', '#f54a45', '#14c0ff', '#ffc60a', '#f14bae', '#00b8a9', '#8f959e', '#245bdb', '#2ea121']
  palette.forEach((c, i) => { vars['pie' + (i + 1)] = c })
  vars.pieSectionTextColor = '#ffffff'
  return vars
}

let mermaidPromise = null
function loadMermaid() {
  if (!mermaidPromise) mermaidPromise = import('mermaid').then((m) => m.default)
  return mermaidPromise
}

let seq = 0
async function renderWithMermaid(code, theme) {
  const mermaid = await loadMermaid()
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    themeVariables: mermaidThemeVars(theme),
    fontFamily: CJK_STACK,
    // 不用 foreignObject（HTML 标签），保证能稳定栅格化成 PNG
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: false },
    sequence: { useMaxWidth: false },
    gantt: { useMaxWidth: false, useWidth: 820, barHeight: 26, barGap: 8, topPadding: 56, leftPadding: 90, fontSize: 13, sectionFontSize: 14 },
    pie: { useMaxWidth: false },
    class: { htmlLabels: false, useMaxWidth: false },
    state: { useMaxWidth: false },
    er: { useMaxWidth: false },
  })
  await mermaid.parse(code) // 语法错误在这里抛出
  const { svg } = await mermaid.render('mf-' + ++seq, code)
  return normalizeSvg(svg, theme.bg)
}

// 统一给 SVG 写上明确的 width/height/viewBox，并铺上背景色
export function normalizeSvg(svgText, bg) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.nodeName !== 'svg') throw new Error('渲染结果不是 SVG')
  let w = parseFloat(svg.getAttribute('width'))
  let h = parseFloat(svg.getAttribute('height'))
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  if (vb.length === 4 && vb.every(Number.isFinite)) {
    if (!(w > 0) || /%/.test(svg.getAttribute('width') || '')) w = vb[2]
    if (!(h > 0) || /%/.test(svg.getAttribute('height') || '')) h = vb[3]
  } else if (w > 0 && h > 0) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  }
  svg.setAttribute('width', String(Math.ceil(w)))
  svg.setAttribute('height', String(Math.ceil(h)))
  const style = (svg.getAttribute('style') || '').replace(/max-width:[^;]*;?/g, '')
  svg.setAttribute('style', `${style};background-color:${bg}`.replace(/^;/, ''))
  return new XMLSerializer().serializeToString(svg)
}

/**
 * 渲染 Mermaid。优先 beautiful-mermaid，不支持或报错时回退 mermaid.js。
 * 返回 { svg, renderer, note }
 */
export async function render(code, themeName) {
  const theme = THEMES[themeName] || THEMES['zinc-light']
  const head = firstLine(code)
  let bmError = null
  if (BM_HEADERS.test(head)) {
    try {
      const raw = renderMermaidSVG(preprocessBM(code), { ...theme, font: FONT_TOKEN })
      return { svg: normalizeSvg(postProcessBM(raw), theme.bg), renderer: 'beautiful-mermaid' }
    } catch (e) {
      bmError = e
    }
  }
  try {
    const svg = await renderWithMermaid(code, theme)
    return {
      svg,
      renderer: 'mermaid.js',
      note: bmError ? `beautiful-mermaid 渲染失败，已回退：${bmError.message}` : null,
    }
  } catch (e) {
    const msg = (e && (e.message || e.str)) || String(e)
    const err = new Error(bmError ? `${msg}\n\n（beautiful-mermaid：${bmError.message}）` : msg)
    throw err
  }
}

/** 用官方解析器做一次语法检查（beautiful-mermaid 会静默跳过看不懂的行） */
export async function validate(code) {
  const mermaid = await loadMermaid()
  try { await mermaid.parse(code); return null } catch (e) { return (e && (e.message || e.str)) || String(e) }
}
