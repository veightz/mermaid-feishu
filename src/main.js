import './style.css'
import { render, validate, THEMES } from './render.js'
import { EXAMPLES } from './examples.js'
import { pngSize, svgToPngBlob, copyPng, copyText, download } from './export.js'

const $ = (id) => document.getElementById(id)
const els = {
  source: $('source'), stage: $('stage'), error: $('error'), renderer: $('renderer'), size: $('size'),
  theme: $('theme'), scale: $('scale'), example: $('example'), toast: $('toast'),
  copyPng: $('copy-png'), downloadPng: $('download-png'), copySvg: $('copy-svg'), copySrc: $('copy-src'),
}
const LS = { src: 'mf.source', theme: 'mf.theme', scale: 'mf.scale' }
const THEME_LABELS = {
  'zinc-light': '简洁浅色', 'github-light': 'GitHub 浅色', 'nord-light': 'Nord 浅色', 'tokyo-night-light': 'Tokyo Night 浅色',
  'catppuccin-latte': 'Catppuccin Latte', 'solarized-light': 'Solarized 浅色', 'zinc-dark': '简洁深色', 'github-dark': 'GitHub 深色',
  'tokyo-night': 'Tokyo Night', 'tokyo-night-storm': 'Tokyo Night Storm', 'catppuccin-mocha': 'Catppuccin Mocha', nord: 'Nord',
  dracula: 'Dracula', 'solarized-dark': 'Solarized 深色', 'one-dark': 'One Dark',
}

const state = { svg: '', renderer: '', theme: 'github-light', scale: 2, ok: false }

function store(k, v) { try { localStorage.setItem(k, v) } catch {} }
function load(k) { try { return localStorage.getItem(k) } catch { return null } }

function toast(msg, ms = 2200) {
  els.toast.textContent = msg
  els.toast.hidden = false
  clearTimeout(toast.t)
  toast.t = setTimeout(() => { els.toast.hidden = true }, ms)
}

// ---------- 初始化控件 ----------
for (const name of Object.keys(THEME_LABELS)) {
  if (!THEMES[name]) continue
  els.theme.add(new Option(THEME_LABELS[name], name))
}
for (const ex of EXAMPLES) els.example.add(new Option(ex.name, ex.id))

state.theme = THEMES[load(LS.theme)] ? load(LS.theme) : 'github-light'
state.scale = load(LS.scale) === '3' ? 3 : 2
els.theme.value = state.theme
els.scale.value = String(state.scale)
els.source.value = load(LS.src) ?? EXAMPLES[0].code

// URL ?example=xxx 方便直接打开某个示例
const qEx = new URLSearchParams(location.search).get('example')
if (qEx) { const ex = EXAMPLES.find((e) => e.id === qEx); if (ex) els.source.value = ex.code }

// ---------- 渲染 ----------
let renderSeq = 0
async function update() {
  const my = ++renderSeq
  const code = els.source.value
  store(LS.src, code)
  if (!code.trim()) {
    els.stage.innerHTML = ''; els.error.hidden = true; setOk(false); els.renderer.textContent = ''; els.size.textContent = ''
    return
  }
  try {
    const res = await render(code, state.theme)
    if (my !== renderSeq) return
    state.svg = res.svg
    state.renderer = res.renderer
    els.stage.innerHTML = res.svg
    els.renderer.textContent = res.renderer
    els.renderer.className = 'badge' + (res.renderer === 'mermaid.js' ? ' fallback' : '')
    els.renderer.title = res.renderer === 'mermaid.js' ? (res.note || 'beautiful-mermaid 不支持此类图，已回退官方 mermaid.js') : '主渲染器'
    els.error.hidden = !res.note
    els.error.textContent = res.note || ''
    els.error.classList.toggle('warn', !!res.note)
    if (res.renderer === 'beautiful-mermaid') {
      validate(code).then((msg) => {
        if (my !== renderSeq || !msg) return
        els.error.hidden = false
        els.error.classList.add('warn')
        els.error.textContent = '语法提示（已尽量渲染，官方解析器报错）：' + msg
        document.body.dataset.warn = '1'
      })
    }
    delete document.body.dataset.warn
    updateSize()
    setOk(true)
    document.body.dataset.renderer = res.renderer
    document.body.dataset.status = 'ok'
  } catch (e) {
    if (my !== renderSeq) return
    els.error.hidden = false
    els.error.classList.remove('warn')
    els.error.textContent = '语法错误：' + (e.message || e)
    setOk(false)
    document.body.dataset.status = 'error'
  }
}
function setOk(ok) {
  state.ok = ok
  for (const b of [els.copyPng, els.downloadPng, els.copySvg]) b.disabled = !ok
}
function updateSize() {
  if (!state.svg) return
  const s = pngSize(state.svg, state.scale)
  els.size.textContent = `PNG ${s.width}×${s.height}px（${state.scale}x${s.ratio < 1 ? '，已缩小适配 820px' : ''}）`
}

let timer = null
els.source.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 300) })
els.source.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    const { selectionStart: s, selectionEnd: t, value } = els.source
    els.source.value = value.slice(0, s) + '  ' + value.slice(t)
    els.source.selectionStart = els.source.selectionEnd = s + 2
    clearTimeout(timer); timer = setTimeout(update, 300)
  }
})
els.theme.addEventListener('change', () => { state.theme = els.theme.value; store(LS.theme, state.theme); update() })
els.scale.addEventListener('change', () => { state.scale = Number(els.scale.value); store(LS.scale, String(state.scale)); updateSize() })
els.example.addEventListener('change', () => {
  const ex = EXAMPLES.find((e) => e.id === els.example.value)
  if (ex) { els.source.value = ex.code; update() }
  els.example.value = ''
})

// ---------- 复制 / 下载 ----------
function pngName() { return `mermaid-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}@${state.scale}x.png` }
function makePng() { return svgToPngBlob(state.svg, state.scale, THEMES[state.theme].bg) }

els.copyPng.addEventListener('click', async () => {
  if (!state.ok) return
  const p = makePng() // 立即开始，Promise 交给 ClipboardItem
  try {
    await copyPng(p)
    toast('PNG 已复制，去飞书里直接粘贴 ✓')
  } catch (e) {
    try { download(await p, pngName()); toast('剪贴板不可用，已改为下载 PNG：' + (e.message || e), 4000) }
    catch (e2) { toast('PNG 生成失败：' + (e2.message || e2), 4000) }
  }
})
els.downloadPng.addEventListener('click', async () => {
  if (!state.ok) return
  try { download(await makePng(), pngName()) } catch (e) { toast('PNG 生成失败：' + (e.message || e), 4000) }
})
els.copySvg.addEventListener('click', async () => {
  if (!state.ok) return
  try { await copyText(state.svg); toast('SVG 源码已复制（注意：飞书文档不支持 SVG 图片）', 3000) } catch (e) { toast('复制失败：' + e.message) }
})
els.copySrc.addEventListener('click', async () => {
  try { await copyText(els.source.value); toast('Mermaid 源码已复制，可粘进飞书「文本绘图」') } catch (e) { toast('复制失败：' + e.message) }
})

// 给自动化测试用
window.__mf = { state, render, makePng, pngSize, EXAMPLES, update }

update()
