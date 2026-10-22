import './style.css'
import { render, validate, THEMES, DEFAULT_THEME } from './render.js'
import { EXAMPLES } from './examples.js'
import { pngSize, svgSize, svgToPngBlob, copyPng, copyText, download, cleanSvg, buildHtmlWidget, HTML_WIDGET_LIMIT, PNG_MAX_SIDE, PNG_HARD_MAX_SIDE } from './export.js'
import { THEME_LABELS, firstLine } from './shared/core.js'

const $ = (id) => document.getElementById(id)
const els = {
  source: $('source'), stage: $('stage'), error: $('error'), renderer: $('renderer'), size: $('size'),
  theme: $('theme'), scale: $('scale'), wideHint: $('wide-hint'), example: $('example'), toast: $('toast'),
  copyPng: $('copy-png'), downloadPng: $('download-png'), copySvg: $('copy-svg'), copySrc: $('copy-src'), copyHtml: $('copy-html'),
}
const LS = { src: 'mf.source', theme: 'mf.theme', scale: 'mf.scale' }

const state = { svg: '', renderer: '', theme: DEFAULT_THEME, scale: 2, ok: false }

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

state.theme = THEMES[load(LS.theme)] ? load(LS.theme) : DEFAULT_THEME
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
    els.stage.innerHTML = ''; els.error.hidden = true; els.wideHint.hidden = true; setOk(false); els.renderer.textContent = ''; els.size.textContent = ''
    return
  }
  try {
    const res = await render(code, state.theme)
    if (my !== renderSeq) return
    state.svg = res.svg
    state.flat = null
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
    updateWideHint(code)
    setOk(true)
    document.body.dataset.renderer = res.renderer
    document.body.dataset.status = 'ok'
  } catch (e) {
    if (my !== renderSeq) return
    els.error.hidden = false
    els.error.classList.remove('warn')
    els.error.textContent = '语法错误：' + (e.message || e)
    setOk(false)
    els.wideHint.hidden = true
    document.body.dataset.status = 'error'
  }
}
function setOk(ok) {
  state.ok = ok
  for (const b of [els.copyPng, els.downloadPng, els.copySvg, els.copyHtml]) b.disabled = !ok
}
function updateSize() {
  if (!state.svg) return
  const s = pngSize(state.svg, state.scale)
  const eff = `${+s.scale.toFixed(2)}x`
  els.size.textContent = !s.capped ? `PNG ${s.width}×${s.height}px（${state.scale}x）`
    : s.atLimit ? `PNG ${s.width}×${s.height}px（实际 ${s.scale.toFixed(2)}x，最长边已限制为 ${s.limit}px）`
    : `PNG ${s.width}×${s.height}px（实际 ${eff}：倍率保底 1x，最长边放宽到 ${Math.max(s.width, s.height)}px）`
  els.size.title = !s.capped ? '图的原始尺寸 × 倍率'
    : s.limit === PNG_MAX_SIDE ? `按 ${state.scale}x 会超过 ${PNG_MAX_SIDE}px，已等比缩小到 ${s.scale.toFixed(2)}x`
    : s.scale >= 1 - 1e-9 ? `倍率保底 1x：最长边超过 ${PNG_MAX_SIDE}px 时放宽，最多 ${PNG_HARD_MAX_SIDE}px`
    : `1x 也超过 ${PNG_HARD_MAX_SIDE}px，已等比缩小到最长边 ${PNG_HARD_MAX_SIDE}px（${s.scale.toFixed(2)}x）`
  document.body.dataset.pngW = String(s.width); document.body.dataset.pngH = String(s.height)
  document.body.dataset.pngScale = s.scale.toFixed(3)
}
/** 宽图提示：原始宽度 > 1200px 时显示；LR/RL 流程图建议改成 TB */
const WIDE_LIMIT = 1200
function updateWideHint(code) {
  const { w } = svgSize(state.svg)
  if (w <= WIDE_LIMIT) { els.wideHint.hidden = true; delete document.body.dataset.wide; return }
  const m = /^(?:flowchart|graph)\s+(LR|RL)\b/i.exec(firstLine(code.replace(/^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/, '')))
  els.wideHint.textContent = m
    ? `图较宽，贴进飞书后字会变小，可以把 \`${m[1].toUpperCase()}\` 改成 \`TB\``
    : `图较宽（约 ${Math.round(w)}px），贴进飞书后字会变小，可以考虑拆成几张小图或减少同一行的节点`
  els.wideHint.hidden = false
  document.body.dataset.wide = m ? 'lr' : 'generic'
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
function pngName() { return `mermaid-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}@${+pngSize(state.svg, state.scale).scale.toFixed(2)}x.png` }
function flat() {
  if (!state.flat) state.flat = cleanSvg(state.svg, THEMES[state.theme].bg)
  return state.flat
}
function htmlWidget() { return buildHtmlWidget(flat(), THEMES[state.theme].bg) }
function makePng() { return svgToPngBlob(flat(), state.scale, THEMES[state.theme].bg) }

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
  try { await copyText(flat()); toast('独立 SVG 已复制，可导入飞书画板（飞书文档图片不支持 SVG）', 3000) } catch (e) { toast('复制失败：' + e.message) }
})
els.copyHtml.addEventListener('click', async () => {
  if (!state.ok) return
  try {
    const html = htmlWidget()
    const size = new Blob([html]).size
    await copyText(html)
    const kb = (size / 1024).toFixed(1)
    if (size > HTML_WIDGET_LIMIT) {
      els.error.hidden = false; els.error.classList.add('warn')
      els.error.textContent = `HTML 已复制，但有 ${kb} KB，超过飞书 HTML 小组件 500 KB 上限，可能贴不进去。建议改用 PNG。`
      toast(`HTML ${kb} KB，超过 500 KB 上限！`, 4000)
    } else {
      toast(`HTML 小组件代码已复制（${kb} KB）`)
    }
  } catch (e) { toast('复制失败：' + (e.message || e)) }
})
els.copySrc.addEventListener('click', async () => {
  try { await copyText(els.source.value); toast('Mermaid 源码已复制，可粘进飞书「文本绘图」') } catch (e) { toast('复制失败：' + e.message) }
})

// 给自动化测试用
window.__mf = { state, render, makePng, pngSize, EXAMPLES, update, flat, htmlWidget }

update()
