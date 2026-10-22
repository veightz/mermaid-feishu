export const FEISHU_WIDTH = 820 // 飞书正文大约 820 CSS px

export function svgSize(svgText) {
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement
  return { w: parseFloat(svg.getAttribute('width')) || 0, h: parseFloat(svg.getAttribute('height')) || 0 }
}

/** 计算 PNG 像素尺寸：宽度不超过 820 CSS px，再乘倍率 */
export function pngSize(svgText, scale) {
  const { w, h } = svgSize(svgText)
  const cssW = Math.min(w, FEISHU_WIDTH)
  const ratio = w ? cssW / w : 1
  return { width: Math.round(cssW * scale), height: Math.round(h * ratio * scale), cssW, ratio }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'sync'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG 无法加载为图片'))
    img.src = src
  })
}

/** SVG → PNG Blob。把 SVG 的 width/height 直接设为目标像素，让浏览器按矢量重绘，避免放大模糊。 */
export async function svgToPngBlob(svgText, scale, bg) {
  const { width, height } = pngSize(svgText, scale)
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  const data = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  if (document.fonts && document.fonts.ready) await document.fonts.ready
  const img = await loadImage(data)
  if (img.decode) { try { await img.decode() } catch {} }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg || '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('PNG 生成失败')
  return blob
}

export async function copyPng(blobPromise) {
  if (!navigator.clipboard || !window.ClipboardItem) throw new Error('当前浏览器不支持写入图片到剪贴板')
  try {
    // 传 Promise：Safari 要求在用户点击的同一个调用栈里发起 write
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
  } catch (e) {
    // 少数浏览器不接受 Promise，退回到传 Blob
    const blob = await blobPromise
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  }
}

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'; ta.style.opacity = '0'
  document.body.appendChild(ta); ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  if (!ok) throw new Error('复制失败')
}

export function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// ---------- 干净的独立 SVG（给飞书画板导入 / HTML 小组件） ----------
const PAINT_PROPS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color']
const CSS_PROPS = ['opacity', 'fill-opacity', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'font-family', 'font-size', 'font-weight']

/**
 * 把 SVG 里所有 CSS 变量 / color-mix 解析成具体颜色，写回成属性；
 * 去掉 @import、自定义属性和依赖变量的声明，补齐 xmlns / viewBox / width / height。
 */
export function flattenSvg(svgText, bg) {
  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none'
  host.innerHTML = svgText
  document.body.appendChild(host)
  try {
    const svg = host.querySelector('svg')
    const all = [svg, ...svg.querySelectorAll('*')]
    const snapshot = all.map((el) => {
      const cs = getComputedStyle(el)
      const vals = {}
      for (const p of PAINT_PROPS) vals[p] = cs.getPropertyValue(p)
      for (const p of CSS_PROPS) vals[p] = cs.getPropertyValue(p)
      return vals
    })
    all.forEach((el, i) => {
      const vals = snapshot[i]
      const usesVar = (v) => v && /var\(|color-mix/.test(v)
      // 1) 依赖变量的属性 / 内联样式 → 换成计算值
      for (const p of [...PAINT_PROPS, ...CSS_PROPS]) {
        const attr = el.getAttribute(p)
        if (usesVar(attr)) el.setAttribute(p, vals[p])
      }
      const style = el.getAttribute('style')
      if (style != null) {
        const kept = style.split(';').map((d) => d.trim()).filter((d) => d.includes(':') && !d.startsWith('--') && !usesVar(d))
        if (kept.length) el.setAttribute('style', kept.join(';')); else el.removeAttribute('style')
      }
      // 2) 颜色统一写成属性（覆盖 class 规则里用变量的情况）
      if (!['style', 'defs', 'title', 'desc', 'marker', 'linearGradient', 'radialGradient', 'clipPath', 'mask', 'filter', 'metadata'].includes(el.localName) || el === svg) {
        for (const p of ['fill', 'stroke']) {
          const v = vals[p]
          if (v && !el.hasAttribute(p) && el !== svg) el.setAttribute(p, v)
        }
        if (vals['stop-color'] && el.localName === 'stop' && !el.hasAttribute('stop-color')) el.setAttribute('stop-color', vals['stop-color'])
      }
    })
    // 3) 清理 <style>：去掉 @import、自定义属性、依赖变量的声明
    for (const st of svg.querySelectorAll('style')) {
      let css = st.textContent
        .replace(/@import[^;]*;/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[{;\s])--[\w-]+\s*:[^;{}]*(;|(?=\}))/g, '$1')
      css = css.replace(/([\w-]+)\s*:([^;{}]*)(;|(?=\}))/g, (m, prop, val) => (/var\(|color-mix/.test(val) ? '' : m))
      css = css.replace(/[^{}]+\{\s*\}/g, '').replace(/\n\s*\n+/g, '\n').trim()
      if (css) st.textContent = '\n' + css + '\n'; else st.remove()
    }
    // 4) 根节点规范化
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    if (svg.querySelector('[href],[*|href]') || /xlink:/.test(svg.innerHTML)) svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'))
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    svg.setAttribute('style', `background-color:${bg}`)
    let out = new XMLSerializer().serializeToString(svg)
    if (!out.startsWith('<?xml')) out = '<?xml version="1.0" encoding="UTF-8"?>\n' + out
    return out
  } finally {
    host.remove()
  }
}

export const HTML_WIDGET_LIMIT = 500 * 1024

/** 飞书 HTML 小组件：自包含 HTML，内联 SVG，无外部脚本/字体，居中、按 820px 自适应 */
export function buildHtmlWidget(flatSvg, bg, fontStack) {
  const doc = new DOMParser().parseFromString(flatSvg, 'image/svg+xml')
  const svg = doc.documentElement
  const w = parseFloat(svg.getAttribute('width')) || 820
  const cssW = Math.min(w, FEISHU_WIDTH)
  svg.setAttribute('width', '100%')
  svg.removeAttribute('height')
  svg.setAttribute('style', `display:block;width:100%;max-width:${cssW}px;height:auto;margin:0 auto;background-color:${bg}`)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  const inline = new XMLSerializer().serializeToString(svg)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mermaid</title>
<style>
html,body{margin:0;padding:0;background:${bg};}
body{font-family:${fontStack};}
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
