// /view：纯预览页。源码来自链接 hash（#c= / #m= / #pako: / #base64: / #src=）、?src=<url>、或 postMessage；
// 用站点同一条渲染管线（render.js：ChatGPT 风 + ELK），可缩放 / 拖动 / 切 LR·TB / 复制 SVG / Copy Mermaid。
import './view.css'
import { sanitizeSvg } from './shared/sanitize-svg.js'
import { render, THEMES, DEFAULT_THEME } from './render.js'
import { cleanSvg, parseLayout, detectFlowHeader, setFlowDirection, isHorizontalDir, FLOW_DIRECTIONS } from './shared/core.js'
import { copyText } from './export.js'
import { decodeViewHash, sourceFromMessage, buildViewUrl, buildEditorUrl, MAX_VIEW_SOURCE } from './shared/viewlink.js'

const $ = (id) => document.getElementById(id)
const vp = $('vp'), cv = $('cv'), stateEl = $('state')
const q = new URLSearchParams(location.search)
const theme = THEMES[q.get('theme')] ? q.get('theme') : DEFAULT_THEME
const layout = parseLayout(q.get('layout')) || 'elk'
let dir = (q.get('dir') || '').toUpperCase(); if (dir === 'TD') dir = 'TB'; if (!FLOW_DIRECTIONS.includes(dir)) dir = ''
const V = { code: '', svg: '', clean: '', format: '' }
window.__view = V

function toast(t, ms = 1800) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true }, ms) }
function showState(text, err = false, detail = '') {
  stateEl.hidden = false
  stateEl.className = 'state' + (err ? ' err' : '')
  stateEl.textContent = text
  if (detail) { const pre = document.createElement('pre'); pre.textContent = detail; stateEl.appendChild(document.createElement('br')); stateEl.appendChild(pre) }
}
function titleOf(code) {
  const body = code.split('\n').slice(1).join('\n')
  const m = /\w\s*(?:\(\[|\[\[|\(\(|\[\(|\{\{|\[|\(|\{|>)\s*"?([^\]\)\}"\n]+?)"?\s*(?:\]\)|\]\]|\)\)|\)\]|\}\}|\]|\)|\})/.exec(body)
  const t = m ? m[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim() : ''
  return t ? t.slice(0, 40) : 'Mermaid 预览'
}

// ---------- 缩放 / 拖动 ----------
let S = 1, X = 0, Y = 0, natW = 0, natH = 0
const ZMIN = 0.05, ZMAX = 8
function apply() { cv.style.transform = `translate(${X}px,${Y}px) scale(${S})`; $('zoom-val').textContent = Math.round(S * 100) + '%' }
function fit() {
  if (!natW) return
  const W = innerWidth, H = innerHeight, pad = 24, top = 56
  S = Math.min((W - pad * 2) / natW, (H - top - pad) / natH, 2)
  S = Math.max(ZMIN, S)
  X = (W - natW * S) / 2; Y = top + (H - top - pad - natH * S) / 2
  apply()
}
function zoomAt(f, cx, cy) {
  const ns = Math.min(ZMAX, Math.max(ZMIN, S * f)); f = ns / S
  X = cx - (cx - X) * f; Y = cy - (cy - Y) * f; S = ns; apply()
}
vp.addEventListener('wheel', (e) => {
  e.preventDefault()
  const k = e.ctrlKey ? 0.01 : 0.0015 // 触控板捏合（ctrlKey）步长小，鼠标滚轮按 deltaY 平滑缩放
  zoomAt(Math.exp(-e.deltaY * k), e.clientX, e.clientY)
}, { passive: false })
const ptrs = new Map(); let last = null
vp.addEventListener('pointerdown', (e) => { vp.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); vp.classList.add('drag'); last = null })
vp.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return
  const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (ptrs.size === 1) { X += e.clientX - prev.x; Y += e.clientY - prev.y; apply(); return }
  const [a, b] = [...ptrs.values()]
  const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
  if (last) { X += cx - last.cx; Y += cy - last.cy; zoomAt(d / last.d, cx, cy) }
  last = { d, cx, cy }
})
const up = (e) => { ptrs.delete(e.pointerId); last = null; if (!ptrs.size) vp.classList.remove('drag') }
vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up)
vp.addEventListener('contextmenu', (e) => e.preventDefault())
addEventListener('resize', () => { if (fitted) fit() })
let fitted = true
vp.addEventListener('pointerdown', () => { fitted = false })
vp.addEventListener('wheel', () => { fitted = false })
$('zoom-in').onclick = () => { fitted = false; zoomAt(1.25, innerWidth / 2, innerHeight / 2) }
$('zoom-out').onclick = () => { fitted = false; zoomAt(0.8, innerWidth / 2, innerHeight / 2) }
$('zoom-val').onclick = () => { fitted = false; zoomAt(1 / S, innerWidth / 2, innerHeight / 2) }
$('fit').onclick = () => { fitted = true; fit() }
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA') return
  if (e.key === '0') $('fit').click()
  else if (e.key === '+' || e.key === '=') $('zoom-in').click()
  else if (e.key === '-') $('zoom-out').click()
})

// ---------- 渲染 ----------
let seq = 0
async function show(code, format) {
  const my = ++seq
  $('empty').hidden = true
  if (code.length > MAX_VIEW_SOURCE) return showState(`源码超过 ${MAX_VIEW_SOURCE / 1024}KB 上限`, true)
  if (dir && detectFlowHeader(code)) code = setFlowDirection(code, dir) || code
  showState('正在排版…')
  let res
  try { res = await render(code, theme, layout) } catch (e) {
    if (my !== seq) return
    cv.innerHTML = ''; natW = 0; $('tools').hidden = true
    return showState('无法渲染这份 Mermaid：', true, String((e && e.message) || e))
  }
  if (my !== seq) return
  const bg = THEMES[theme].bg
  V.code = code; V.svg = res.svg; V.format = format; V.renderer = res.renderer
  res.svg = sanitizeSvg(res.svg)
  V.svg = res.svg
  V.clean = cleanSvg(res.svg, bg)
  document.body.style.background = bg
  cv.innerHTML = res.svg // 已在上面 sanitizeSvg 过
  const svg = cv.querySelector('svg')
  const vb = svg.viewBox && svg.viewBox.baseVal
  natW = parseFloat(svg.getAttribute('width')) || (vb && vb.width) || 800
  natH = parseFloat(svg.getAttribute('height')) || (vb && vb.height) || 600
  svg.setAttribute('width', natW); svg.setAttribute('height', natH)
  svg.style.maxWidth = 'none'
  stateEl.hidden = true
  $('tools').hidden = false
  const info = detectFlowHeader(code)
  $('flip').hidden = !info
  if (info) { const d = info.dir === 'TD' ? 'TB' : info.dir; $('flip').textContent = isHorizontalDir(d) ? 'LR → TB' : 'TB → LR' }
  $('edit').href = buildEditorUrl(location.origin, code)
  const t = titleOf(code); $('title').textContent = t; document.title = t === 'Mermaid 预览' ? t : `${t} · Mermaid 预览`
  $('note').hidden = !res.note; $('note').textContent = res.note || ''
  fitted = true; fit()
}
$('flip').onclick = () => {
  const info = detectFlowHeader(V.code); if (!info) return
  const d = info.dir === 'TD' ? 'TB' : info.dir
  dir = isHorizontalDir(d) ? 'TB' : 'LR'
  const url = buildViewUrl(location.origin + location.pathname, V.code, { theme, layout, dir })
  history.replaceState(null, '', url) // 链接跟着走向更新，复制地址栏即可分享
  show(V.code, V.format)
}
$('copy-svg').onclick = async () => { try { await copyText(V.clean); toast('SVG 已复制') } catch (e) { toast('复制失败：' + (e.message || e)) } }
$('copy-src').onclick = async () => { try { await copyText(V.code); toast('Mermaid 源码已复制') } catch (e) { toast('复制失败：' + (e.message || e)) } }

// ---------- 源码来源 ----------
function waitForMessage() {
  showState('等待源码…（由打开本页的窗口通过 postMessage 发送）')
  const target = window.opener || (window.parent !== window ? window.parent : null)
  if (target) { try { target.postMessage({ type: 'mf-view-ready' }, '*') } catch { /* 跨域 opener 被浏览器隔离时忽略 */ } }
  setTimeout(() => { if (!V.code && !gotMessage) showEmpty('没有收到源码（打开本页的窗口可能已关闭）。') }, 5000)
}
let gotMessage = false
addEventListener('message', (e) => {
  if (e.data && typeof e.data === 'object' && e.data.type === 'mf-view-ready') return
  const code = sourceFromMessage(e.data) // 只当文本渲染，不执行任何内容
  if (!code) return
  gotMessage = true
  show(code, 'message')
})
function showEmpty(msg) {
  stateEl.hidden = true; $('tools').hidden = true; cv.innerHTML = ''; natW = 0
  const f = $('empty'); f.hidden = false
  if (msg) f.querySelector('p').textContent = msg + ' 也可以直接粘贴 Mermaid 源码，点「预览」。'
  $('paste').focus()
}
$('empty').addEventListener('submit', (e) => {
  e.preventDefault()
  const code = $('paste').value
  if (!code.trim()) return
  history.replaceState(null, '', buildViewUrl(location.origin + location.pathname, code, { theme: q.get('theme') || undefined, layout: q.get('layout') || undefined, dir: dir || undefined }))
  show(code, 'paste')
})
// ?src= 只接受绝对 https:// 地址；不带 Cookie；边读边限 200KB
export function checkSrcUrl(u) {
  let url
  try { url = new URL(String(u)) } catch { return null } // 相对路径在这里就会失败
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
  return url.href
}
async function fromUrlParam(u) {
  const href = checkSrcUrl(u)
  if (!href) return showState('?src= 只支持完整的 https:// 链接', true, `收到：${String(u).slice(0, 300)}\n不支持 http:、相对路径、data:、blob:、javascript:、file: 等地址。`)
  showState('正在从链接读取源码…')
  let res
  try { res = await fetch(href, { mode: 'cors', credentials: 'omit', redirect: 'follow', referrerPolicy: 'no-referrer' }) } catch (e) {
    return showState(`读取 ?src= 失败：${href}`, true, '可能原因：对方不允许跨域（CORS），或网络不通。\nGitHub 用 raw.githubusercontent.com、Gist 用 gist.githubusercontent.com 的 raw 链接。\n' + String(e.message || e))
  }
  if (res.url && !/^https:/i.test(res.url)) return showState('?src= 被重定向到非 https 地址，已拒绝', true, res.url)
  if (!res.ok) return showState(`读取 ?src= 失败：HTTP ${res.status}`, true, href)
  const tooBig = () => showState(`?src= 文件超过 ${MAX_VIEW_SOURCE / 1024}KB 上限`, true, href)
  const len = +res.headers.get('content-length') || 0
  if (len > MAX_VIEW_SOURCE * 4) return tooBig()
  let text = ''
  if (res.body && res.body.getReader) {
    const rd = res.body.getReader(), dec = new TextDecoder()
    let n = 0
    for (;;) {
      const { done, value } = await rd.read()
      if (done) break
      n += value.byteLength
      if (n > MAX_VIEW_SOURCE * 4) { try { rd.cancel() } catch {} return tooBig() }
      text += dec.decode(value, { stream: true })
      if (text.length > MAX_VIEW_SOURCE) { try { rd.cancel() } catch {} return tooBig() }
    }
    text += dec.decode()
  } else text = await res.text()
  if (text.length > MAX_VIEW_SOURCE) return tooBig()
  return show(text.replace(/^\s*```(?:mermaid)?\s*\n([\s\S]*?)\n?```\s*$/, '$1'), 'url')
}
async function load() {
  let r
  try { r = await decodeViewHash(location.hash) } catch (e) { return showState('链接里的源码无法解析：', true, String(e.message || e)) }
  if (r && r.code != null) return show(r.code, r.format)
  if (r && r.wait) return waitForMessage()
  if (q.get('src')) return fromUrlParam(q.get('src'))
  if (window.opener) return waitForMessage()
  showEmpty()
}
addEventListener('hashchange', () => { if (location.hash && location.hash !== '#wait') load() })
load()
