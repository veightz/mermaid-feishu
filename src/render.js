import {
  THEMES, DEFAULT_THEME, CJK_STACK, isBMSupported, renderBM, mix, isDark,
} from './shared/core.js'

export { THEMES, DEFAULT_THEME, CJK_STACK }

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
  const palette = t.soft
    ? ['#8DA2C4', '#9DBBA4', '#D4B48C', '#AFA1C9', '#C9A0A0', '#94BCC9', '#CFC48E', '#C4A3B8', '#8FB8B1', '#A9AEB6', '#7F93B3', '#A7C29A']
    : ['#3370ff', '#34c724', '#ff8800', '#7f3bf5', '#f54a45', '#14c0ff', '#ffc60a', '#f14bae', '#00b8a9', '#8f959e', '#245bdb', '#2ea121']
  if (t.blocks) {
    // 色块主题：饼图用各色块 step 7，甘特图用色块填充 + 边框
    const bs = [...t.blocks, t.decision]
    bs.slice(0, 12).forEach((b, i) => { palette[i] = b.pie })
    const [b0, b1] = t.blocks
    Object.assign(vars, {
      primaryColor: b0.fill, primaryBorderColor: b0.border, primaryTextColor: b0.text,
      sectionBkgColor: b0.tint, sectionBkgColor2: t.bg, altSectionBkgColor: t.bg,
      taskBkgColor: b0.hdr, taskBorderColor: b0.border, taskTextColor: b0.text, taskTextDarkColor: b0.text, taskTextOutsideColor: fg,
      activeTaskBkgColor: b1.hdr, activeTaskBorderColor: b1.border,
      doneTaskBkgColor: t.decision.hdr, doneTaskBorderColor: t.decision.border,
      gridColor: mix(fg, bg, 0.12), todayLineColor: t.decision.border,
      pieOuterStrokeColor: t.line, pieStrokeColor: bg,
    })
  }
  palette.forEach((c, i) => { vars['pie' + (i + 1)] = c })
  vars.pieSectionTextColor = t.soft ? fg : '#ffffff'
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
    maxTextSize: 200000,
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
  const theme = THEMES[themeName] || THEMES[DEFAULT_THEME]
  let bmError = null
  if (isBMSupported(code)) {
    try {
      return { svg: normalizeSvg(renderBM(code, themeName), theme.bg), renderer: 'beautiful-mermaid' }
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
