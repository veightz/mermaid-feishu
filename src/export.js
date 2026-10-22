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
