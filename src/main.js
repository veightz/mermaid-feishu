import './style.css'
import { render, validate, THEMES, DEFAULT_THEME } from './render.js'
import { EXAMPLES } from './examples.js'
import { buildViewUrl, decodeViewHash, VIEW_URL_SOFT_LIMIT } from './shared/viewlink.js'
import { pngSize, svgSize, svgToPngBlob, copyPng, copyText, download, cleanSvg, buildHtmlWidget, HTML_WIDGET_LIMIT, PNG_MAX_SIDE, PNG_HARD_MAX_SIDE } from './export.js'
import { THEME_LABELS, LAYOUTS, LAYOUT_LABELS, themeDefaultLayout, parseLayout, firstLine, detectFlowHeader, setFlowDirection, flipFlowDirection, isHorizontalDir, elkPalette } from './shared/core.js'

const $ = (id) => document.getElementById(id)
const els = {
  source: $('source'), stage: $('stage'), error: $('error'), renderer: $('renderer'), size: $('size'),
  theme: $('theme'), layout: $('layout'), flowDir: $('flow-dir'), compare: $('compare'), compareOrient: $('compare-orient'), zoom: $('zoom'), zoomVal: $('zoom-val'), scale: $('scale'),
  wideHint: $('wide-hint'), example: $('example'), toast: $('toast'),
  stageSingle: $('stage-single'), compareWrap: $('compare-wrap'),
  stageDefault: $('stage-default'), stageElk: $('stage-elk'),
  rendererDefault: $('renderer-default'), rendererElk: $('renderer-elk'),
  sizeDefault: $('size-default'), sizeElk: $('size-elk'),
  footSingle: $('foot-single'), footCompare: $('foot-compare'),
  copyViewLink: $('copy-view-link'), openView: $('open-view'),
  copyPng: $('copy-png'), downloadPng: $('download-png'), copySvg: $('copy-svg'), copySrc: $('copy-src'), copyHtml: $('copy-html'),
}
const LS = { src: 'mf.source', theme: 'mf.theme', layout: 'mf.layout', scale: 'mf.scale', zoom: 'mf.zoom', compare: 'mf.compare', compareOrient: 'mf.compareOrient', previewMode: 'mf.previewMode' }

const SCALE_STEPS = [2, 3] // 与 #scale 选项一致
const state = {
  svg: '', renderer: '', theme: DEFAULT_THEME, layout: 'elk', scale: 2, zoom: 1, ok: false, compare: false, compareOrient: 'row', previewMode: 'svg',
  // compare 两侧：{ svg, flat, renderer, note }
  panes: { default: null, elk: null },
}
// 对比开关时抬高一档倍率；关掉时若期间没手动改过倍率则还原
let scaleBeforeCompare = null
let scaleTouchedDuringCompare = false

function applyScale(n, { persist = true } = {}) {
  state.scale = SCALE_STEPS.includes(n) ? n : SCALE_STEPS[0]
  els.scale.value = String(state.scale)
  if (persist) store(LS.scale, String(state.scale))
  updateSize()
  if (state.compare) {
    if (state.panes.default?.svg) els.sizeDefault.textContent = sizeLabel(state.panes.default.svg)
    if (state.panes.elk?.svg) els.sizeElk.textContent = sizeLabel(state.panes.elk.svg)
  }
}
function bumpScaleOne() {
  const i = SCALE_STEPS.indexOf(state.scale)
  const next = SCALE_STEPS[Math.min(SCALE_STEPS.length - 1, Math.max(0, i) + 1)]
  if (next !== state.scale) applyScale(next)
}

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
// 布局：「跟随配色」（auto，默认）= ChatGPT 配色用 ELK、其他用默认布局；手动选了 default / elk 就固定不变
els.layout.add(new Option('跟随配色', 'auto'))
for (const id of LAYOUTS) els.layout.add(new Option(LAYOUT_LABELS[id], id))
function syncLayoutLabel() {
  els.layout.options[0].text = `跟随配色（${themeDefaultLayout(state.theme) === 'elk' ? 'ELK' : '默认'}）`
}
for (const ex of EXAMPLES) { if (!ex?.id) continue; els.example.add(new Option(ex.name, ex.id)) }

state.theme = THEMES[load(LS.theme)] ? load(LS.theme) : DEFAULT_THEME
state.scale = load(LS.scale) === '3' ? 3 : 2
state.layout = parseLayout(load(LS.layout)) || 'elk'
state.compare = load(LS.compare) === '1'
state.compareOrient = load(LS.compareOrient) === 'col' ? 'col' : 'row'
els.theme.value = state.theme
els.layout.value = state.layout
els.compare.checked = state.compare
syncLayoutLabel()
els.scale.value = String(state.scale)
{
  const z = Number(load(LS.zoom))
  state.zoom = (Number.isFinite(z) && z >= 0.5 && z <= 4) ? Math.round(z * 100) / 100 : 1
}
els.zoom.value = String(Math.round(state.zoom * 100))
applyPreviewZoom()
els.source.value = load(LS.src) ?? EXAMPLES[0].code
applyCompareChrome()

// URL ?example=xxx；?compare=1；?compareOrient=row|col
const q = new URLSearchParams(location.search)
const qEx = q.get('example')
if (qEx) { const ex = EXAMPLES.find((e) => e.id === qEx); if (ex) els.source.value = ex.code }
if (q.get('compare') === '1') { state.compare = true; els.compare.checked = true; store(LS.compare, '1') }
else if (q.get('compare') === '0') { state.compare = false; els.compare.checked = false; store(LS.compare, '0') }
const qOrient = (q.get('compareOrient') || '').toLowerCase()
if (qOrient === 'row' || qOrient === 'col') { state.compareOrient = qOrient; store(LS.compareOrient, qOrient) }
applyCompareChrome()

// 链接带源码：#c= / #m=（lz-string）、#pako: / #base64:（mermaid.live）、#src=（base64url）——「在编辑器中打开」用；读完去掉 hash，之后的编辑照常存本机
const hashLoad = location.hash.length > 1 ? decodeViewHash(location.hash).then((r) => {
  if (!r || r.code == null) return false
  els.source.value = r.code
  store(LS.src, r.code)
  history.replaceState(null, '', location.pathname + location.search)
  return true
}).catch((e) => { setTimeout(() => toast('链接里的源码无法解析：' + (e.message || e), 4000), 300); return false }) : null

const ZOOM_MIN = 0.5, ZOOM_MAX = 4
const STAGE_BASE_W = 820 // 飞书正文约 820px

// svg 的固有宽度（viewBox / width 属性），用于“适应宽度”基准
function svgNaturalWidth(svg) {
  const vb = svg.viewBox && svg.viewBox.baseVal
  const wAttr = parseFloat(svg.getAttribute('width'))
  if (Number.isFinite(wAttr) && wAttr > 0 && !/%/.test(svg.getAttribute('width') || '')) return wAttr
  if (vb && vb.width > 0) return vb.width
  return STAGE_BASE_W
}

// 100% = 适应宽度（不超过固有宽度、820px 和预览区宽度）；之后按缩放倍数直接放大像素宽度
function sizeStageSvg(stage) {
  const svg = stage.querySelector(':scope > svg, :scope > img')
  if (!svg) return
  const wrap = stage.closest('.stage-wrap')
  if (!svg.dataset.natW) svg.dataset.natW = String(svg.tagName === 'IMG' ? STAGE_BASE_W : svgNaturalWidth(svg))
  const nat = Number(svg.dataset.natW)
  let avail = STAGE_BASE_W
  if (wrap && wrap.clientWidth > 0) {
    const cs = getComputedStyle(wrap)
    avail = Math.min(STAGE_BASE_W, wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
  }
  const fit = Math.max(40, Math.min(nat, avail))
  svg.style.width = `${Math.round(fit * state.zoom)}px`
  svg.style.height = 'auto'
  svg.style.maxWidth = 'none'
}

function applyPreviewZoom() {
  const z = state.zoom
  document.documentElement.style.setProperty('--preview-zoom', String(z))
  els.zoomVal.textContent = `${Math.round(z * 100)}%`
  for (const el of document.querySelectorAll('.stage-zoom')) sizeStageSvg(el)
}

// 立即设置缩放（滑杆 / 重置 / 动画每帧）。只改 svg 像素宽度，不重新渲染图。
// anchor: { wrap, clientX, clientY } —— 保持鼠标下的图上点不动
function setZoom(z, anchor, { round = true, persist = true } = {}) {
  z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, round ? Math.round(z * 100) / 100 : z))
  if (z === state.zoom) return
  let rel = null
  if (anchor && anchor.wrap) {
    const svg = anchor.wrap.querySelector('.stage-zoom > svg, .stage-zoom > img')
    if (svg) {
      const r = svg.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) rel = { svg, fx: (anchor.clientX - r.left) / r.width, fy: (anchor.clientY - r.top) / r.height }
    }
  }
  state.zoom = z
  els.zoom.value = String(Math.round(z * 100))
  if (persist) store(LS.zoom, String(Math.round(z * 100) / 100))
  applyPreviewZoom()
  if (rel) {
    const w = anchor.wrap
    const r = rel.svg.getBoundingClientRect()
    w.scrollLeft += (r.left + rel.fx * r.width) - anchor.clientX
    w.scrollTop += (r.top + rel.fy * r.height) - anchor.clientY
  }
}

// Ctrl/⌘+滚轮 / 触控板捏合：连续缩放 zoom *= exp(-deltaY * k)，rAF 约 120ms 缓动到目标
const WHEEL_K = 0.0015
const WHEEL_MAX_STEP = Math.log(1.1) // 单个事件最多 ±10%（鼠标滚轮一格）
const zoomAnim = { target: null, anchor: null, raf: 0, last: 0 }
function normWheelDelta(e, wrap) {
  if (e.deltaMode === 1) return e.deltaY * 16 // 行
  if (e.deltaMode === 2) return e.deltaY * (wrap?.clientHeight || 800) // 页
  return e.deltaY
}
function wheelZoom(e, wrap) {
  const dy = normWheelDelta(e, wrap)
  const step = Math.max(-WHEEL_MAX_STEP, Math.min(WHEEL_MAX_STEP, -dy * WHEEL_K))
  const from = zoomAnim.target ?? state.zoom
  zoomAnim.target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, from * Math.exp(step)))
  zoomAnim.anchor = { wrap, clientX: e.clientX, clientY: e.clientY }
  if (!zoomAnim.raf) { zoomAnim.last = performance.now(); zoomAnim.raf = requestAnimationFrame(zoomTick) }
}
function zoomTick(now) {
  // rAF 时间戳是帧开始时间，可能早于滚轮事件时刻 → 夹到 [0, 64]
  const dt = Math.max(0, Math.min(64, now - zoomAnim.last))
  zoomAnim.last = now
  const t = zoomAnim.target
  // 指数缓动：时间常数 40ms ≈ 120ms 内走完 95%
  let z = t + (state.zoom - t) * Math.exp(-dt / 40)
  const done = Math.abs(z - t) < 0.002
  if (done) z = t
  setZoom(z, zoomAnim.anchor, { round: false, persist: done })
  if (done) { zoomAnim.target = null; zoomAnim.raf = 0; return }
  zoomAnim.raf = requestAnimationFrame(zoomTick)
}
function cancelZoomAnim() { if (zoomAnim.raf) cancelAnimationFrame(zoomAnim.raf); zoomAnim.raf = 0; zoomAnim.target = null }

// svg 换了内容 / 预览区尺寸变了 → 重新计算像素宽度
{
  const mo = new MutationObserver((muts) => {
    const seen = new Set()
    for (const m of muts) { const st = m.target.closest?.('.stage-zoom') || m.target; if (st.classList?.contains('stage-zoom')) seen.add(st) }
    for (const st of seen) sizeStageSvg(st)
  })
  const ro = new ResizeObserver(() => applyPreviewZoom())
  for (const st of document.querySelectorAll('.stage-zoom')) {
    mo.observe(st, { childList: true })
    const wrap = st.closest('.stage-wrap')
    if (wrap) ro.observe(wrap)
  }
}

// 预览区拖拽平移：右键 / 中键 / 空格+左键（参考飞书画板）；每个预览区独立滚动
{
  let spaceDown = false
  let drag = null
  const isTyping = (t) => t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)
  const wraps = () => document.querySelectorAll('.stage-wrap')
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || isTyping(e.target)) return
    if (!spaceDown) { spaceDown = true; for (const w of wraps()) w.classList.add('pan-ready') }
    if (e.target === document.body || e.target.closest?.('.stage-wrap')) e.preventDefault()
  })
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return
    spaceDown = false
    for (const w of wraps()) w.classList.remove('pan-ready')
  })
  window.addEventListener('blur', () => { spaceDown = false; for (const w of wraps()) w.classList.remove('pan-ready') })

  for (const wrap of wraps()) {
    wrap.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return
      const ok = e.button === 2 || e.button === 1 || (e.button === 0 && spaceDown)
      if (!ok) return
      e.preventDefault()
      drag = { wrap, id: e.pointerId, x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop, moved: false }
      try { wrap.setPointerCapture(e.pointerId) } catch {}
      wrap.classList.add('panning')
    })
    wrap.addEventListener('pointermove', (e) => {
      if (!drag || drag.wrap !== wrap || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true
      wrap.scrollLeft = drag.sl - dx
      wrap.scrollTop = drag.st - dy
    })
    const end = (e) => {
      if (!drag || drag.wrap !== wrap) return
      try { wrap.releasePointerCapture(drag.id) } catch {}
      wrap.classList.remove('panning')
      drag = null
    }
    wrap.addEventListener('pointerup', end)
    wrap.addEventListener('pointercancel', end)
    wrap.addEventListener('lostpointercapture', end)
    // 预览区内不弹右键菜单（右键用于拖拽）；中键不触发自动滚动
    wrap.addEventListener('contextmenu', (e) => e.preventDefault())
    wrap.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault() })
    wrap.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault() })
    // Ctrl/⌘ + 滚轮：以鼠标位置为锚点缩放，并同步滑杆
    wrap.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      wheelZoom(e, wrap)
    }, { passive: false })
    // 双击空白处：重置
    wrap.addEventListener('dblclick', (e) => {
      if (e.target.closest('svg text, svg foreignObject')) return
      resetPreviewView()
    })
  }
}

function resetPreviewView() {
  cancelZoomAnim()
  setZoom(1)
  for (const w of document.querySelectorAll('.stage-wrap')) { w.scrollLeft = 0; w.scrollTop = 0 }
}

function setCompareOrient(orient) {
  state.compareOrient = orient === 'col' ? 'col' : 'row'
  store(LS.compareOrient, state.compareOrient)
  applyCompareChrome()
}

function applyCompareChrome() {
  document.body.classList.toggle('compare', state.compare)
  document.body.classList.toggle('compare-row', state.compare && state.compareOrient === 'row')
  document.body.classList.toggle('compare-col', state.compare && state.compareOrient === 'col')
  document.body.dataset.compareOrient = state.compare ? state.compareOrient : ''
  els.stageSingle.hidden = state.compare
  els.compareWrap.hidden = !state.compare
  els.footSingle.hidden = state.compare
  els.footCompare.hidden = !state.compare
  els.compareOrient.hidden = !state.compare
  for (const btn of els.compareOrient.querySelectorAll('.seg-btn')) {
    const on = btn.dataset.orient === state.compareOrient
    btn.classList.toggle('active', on)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  }
  els.layout.disabled = state.compare
  els.layout.title = state.compare ? '对比模式下同时显示默认与 ELK，布局选择暂不可用' : '只影响流程图 / graph；其他图类型只换配色'
  const side = state.compareOrient === 'col' ? '下方' : '右侧'
  const tip = state.compare ? `（对比模式：复制${side} ELK）` : ''
  els.copyPng.title = '复制 PNG 到剪贴板，直接粘贴进飞书' + tip
  els.copySvg.title = '干净的独立 SVG，可导入飞书画板' + tip
  els.downloadPng.title = '剪贴板不可用时下载 PNG' + tip
  els.copyHtml.title = '自包含 HTML，贴进飞书 HTML 小组件（≤ 500KB）' + tip
}

function sizeLabel(svg) {
  if (!svg) return ''
  const s = pngSize(svg, state.scale)
  const eff = `${+s.scale.toFixed(2)}x`
  return !s.capped ? `PNG ${s.width}×${s.height}px（${state.scale}x）`
    : s.atLimit ? `PNG ${s.width}×${s.height}px（实际 ${s.scale.toFixed(2)}x）`
    : `PNG ${s.width}×${s.height}px（实际 ${eff}）`
}

function fillPane(which, res) {
  const stage = which === 'default' ? els.stageDefault : els.stageElk
  const badge = which === 'default' ? els.rendererDefault : els.rendererElk
  const size = which === 'default' ? els.sizeDefault : els.sizeElk
  stage.innerHTML = res?.svg || ''
  badge.textContent = res?.renderer || ''
  badge.className = 'badge' + (res?.renderer === 'mermaid.js' ? ' fallback' : '')
  size.textContent = res?.svg ? sizeLabel(res.svg) : ''
  state.panes[which] = res ? { svg: res.svg, flat: null, renderer: res.renderer, note: res.note || null } : null
}

function clearStages() {
  els.stage.innerHTML = ''
  els.stageDefault.innerHTML = ''
  els.stageElk.innerHTML = ''
  els.renderer.textContent = ''
  els.size.textContent = ''
  els.rendererDefault.textContent = ''
  els.rendererElk.textContent = ''
  els.sizeDefault.textContent = ''
  els.sizeElk.textContent = ''
  state.svg = ''
  state.flat = null
  state.panes = { default: null, elk: null }
}

// ---------- 渲染 ----------
let renderSeq = 0
async function update() {
  const my = ++renderSeq
  const code = els.source.value
  store(LS.src, code)
  if (!code.trim()) {
    clearStages()
    els.error.hidden = true; els.wideHint.hidden = true; els.flowDir.hidden = true; setOk(false)
    return
  }
  try {
    if (state.compare) {
      const [resD, resE] = await Promise.all([
        render(code, state.theme, 'default'),
        render(code, state.theme, 'elk'),
      ])
      if (my !== renderSeq) return
      fillPane('default', resD)
      fillPane('elk', resE)
      // 顶部按钮 / 单预览状态以 ELK 为准（对比时右侧）
      state.svg = resE.svg
      state.flat = null
      state.renderer = resE.renderer
      els.renderer.textContent = `对比 · ${resD.renderer} | ${resE.renderer}`
      els.renderer.className = 'badge'
      els.renderer.title = state.compareOrient === 'col' ? '上：默认布局 · 下：ELK；顶部复制按钮取 ELK' : '左：默认布局 · 右：ELK；顶部复制按钮取右侧 ELK'
      els.size.textContent = ''
      const notes = [resD.note, resE.note].filter(Boolean)
      els.error.hidden = !notes.length
      els.error.textContent = notes.join('\n')
      els.error.classList.toggle('warn', !!notes.length)
      if (resE.renderer === 'beautiful-mermaid' || resE.renderer === 'chatgpt-elk') {
        validate(code).then((msg) => {
          if (my !== renderSeq || !msg) return
          els.error.hidden = false
          els.error.classList.add('warn')
          els.error.textContent = '语法提示（已尽量渲染，官方解析器报错）：' + msg
          document.body.dataset.warn = '1'
        })
      }
      delete document.body.dataset.warn
      updateWideHint(code, resE.svg)
      setOk(true)
      document.body.dataset.renderer = resE.renderer
      document.body.dataset.status = 'ok'
      document.body.dataset.compare = '1'
    } else {
      const res = await render(code, state.theme, state.layout)
      if (my !== renderSeq) return
      state.svg = res.svg
      state.flat = null
      state.renderer = res.renderer
      state.panes = { default: null, elk: null }
      els.stage.innerHTML = res.svg
      els.renderer.textContent = res.renderer
      els.renderer.className = 'badge' + (res.renderer === 'mermaid.js' ? ' fallback' : '')
      els.renderer.title = res.renderer === 'mermaid.js' ? (res.note || 'beautiful-mermaid 不支持此类图，已回退官方 mermaid.js') : '主渲染器'
      els.error.hidden = !res.note
      els.error.textContent = res.note || ''
      els.error.classList.toggle('warn', !!res.note)
      if (res.renderer === 'beautiful-mermaid' || res.renderer === 'chatgpt-elk') {
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
      updateWideHint(code, state.svg)
      setOk(true)
      document.body.dataset.renderer = res.renderer
      document.body.dataset.status = 'ok'
      delete document.body.dataset.compare
      refreshPreviewMode()
    }
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
  for (const b of els.compareWrap.querySelectorAll('button[data-copy]')) b.disabled = !ok
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
  // 对比模式下刷新两侧尺寸标签
  if (state.compare) {
    if (state.panes.default?.svg) els.sizeDefault.textContent = sizeLabel(state.panes.default.svg)
    if (state.panes.elk?.svg) els.sizeElk.textContent = sizeLabel(state.panes.elk.svg)
  }
}
/** 同步顶栏「左右 LR / 上下 TB」；非流程图时隐藏 */
function syncFlowDir(code) {
  const info = detectFlowHeader(code || els.source.value)
  if (!info) {
    els.flowDir.hidden = true
    delete document.body.dataset.flowDir
    return null
  }
  els.flowDir.hidden = false
  const dir = info.dir === 'TD' ? 'TB' : info.dir
  const horiz = isHorizontalDir(dir)
  document.body.dataset.flowDir = dir
  for (const btn of els.flowDir.querySelectorAll('.seg-btn')) {
    const on = (btn.dataset.dir === 'LR' && horiz) || (btn.dataset.dir === 'TB' && !horiz)
    btn.classList.toggle('active', on)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  }
  return info
}

/** 改写源码走向并重渲染；target 为 TB/LR，或 'flip' */
function applyFlowDir(target) {
  const code = els.source.value
  const next = target === 'flip' ? flipFlowDirection(code) : setFlowDirection(code, target)
  if (next == null) { toast('当前不是流程图，无法改走向'); return }
  if (next === code) return
  els.source.value = next
  store(LS.src, next)
  const d = detectFlowHeader(next)?.dir
  toast(isHorizontalDir(d) ? '已改为左右 LR' : '已改为上下 TB')
  update()
}

/** 宽图提示：原始宽度 > 1200px 时显示；LR/RL 可一键改成 TB */
const WIDE_LIMIT = 1200
function updateWideHint(code, svg) {
  syncFlowDir(code)
  const { w } = svgSize(svg || state.svg)
  if (w <= WIDE_LIMIT) { els.wideHint.hidden = true; delete document.body.dataset.wide; return }
  const info = detectFlowHeader(code)
  const horiz = info && isHorizontalDir(info.dir)
  if (horiz) {
    const cur = info.dir === 'TD' ? 'TB' : info.dir
    els.wideHint.innerHTML = `图较宽，贴进飞书后字会变小，建议改成从上到下 <button type="button" class="hint-action" data-flow-dir="TB" title="把源码里的 ${cur} 改成 TB">改为上下 TB</button>`
    document.body.dataset.wide = 'lr'
  } else {
    els.wideHint.textContent = `图较宽（约 ${Math.round(w)}px），贴进飞书后字会变小，可以考虑拆成几张小图或减少同一行的节点`
    document.body.dataset.wide = 'generic'
  }
  els.wideHint.hidden = false
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
els.theme.addEventListener('change', () => { state.theme = els.theme.value; store(LS.theme, state.theme); syncLayoutLabel(); update() })
els.flowDir.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-dir]')
  if (!btn) return
  applyFlowDir(btn.dataset.dir)
})
els.wideHint.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-flow-dir]')
  if (!btn) return
  applyFlowDir(btn.dataset.flowDir)
})
els.layout.addEventListener('change', () => { state.layout = els.layout.value; store(LS.layout, state.layout); update() })
els.compare.addEventListener('change', () => {
  state.compare = els.compare.checked
  store(LS.compare, state.compare ? '1' : '0')
  if (state.compare) {
    scaleBeforeCompare = state.scale
    scaleTouchedDuringCompare = false
    bumpScaleOne() // 2x→3x；已是最高档则不动
  } else {
    // 关掉对比：清掉双栏残留，避免「看起来还在对比」
    fillPane('default', null)
    fillPane('elk', null)
    if (scaleBeforeCompare != null && !scaleTouchedDuringCompare) applyScale(scaleBeforeCompare)
    scaleBeforeCompare = null
  }
  applyCompareChrome()
  update()
})
els.zoom.addEventListener('input', () => {
  cancelZoomAnim()
  state.zoom = Number(els.zoom.value) / 100
  store(LS.zoom, String(state.zoom))
  applyPreviewZoom()
})
$('zoom-reset').addEventListener('click', resetPreviewView)
els.compareOrient.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-orient]')
  if (!btn) return
  setCompareOrient(btn.dataset.orient)
})
els.scale.addEventListener('change', () => { queueMicrotask(() => { if (state.previewMode === 'png') refreshPreviewMode() }) })
els.scale.addEventListener('change', () => {
  if (state.compare) scaleTouchedDuringCompare = true
  applyScale(Number(els.scale.value))
})
els.example.addEventListener('change', () => {
  const ex = EXAMPLES.find((e) => e.id === els.example.value)
  if (ex) { els.source.value = ex.code; update() }
  els.example.value = ''
})

// ---------- 复制 / 下载 ----------
function pngName(which) {
  const svg = which ? state.panes[which]?.svg : state.svg
  const tag = which ? `-${which}` : ''
  return `mermaid${tag}-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}@${+pngSize(svg || state.svg, state.scale).scale.toFixed(2)}x.png`
}
function flat(which) {
  if (which) {
    const p = state.panes[which]
    if (!p) return ''
    if (!p.flat) p.flat = cleanSvg(p.svg, THEMES[state.theme].bg)
    return p.flat
  }
  if (!state.flat) state.flat = cleanSvg(state.svg, THEMES[state.theme].bg)
  return state.flat
}
let offlineWidgetPromise = null
const VIEW_BASE = location.origin + '/view'
function viewUrl(code = els.source.value) {
  const info = detectFlowHeader(code)
  return buildViewUrl(VIEW_BASE, code, { theme: state.theme, layout: state.compare ? 'elk' : state.layout, dir: info ? info.dir : undefined })
}
async function htmlWidget() {
  const bg = THEMES[state.theme].bg
  const primary = state.compare ? flat('elk') : flat()
  const src = els.source.value
  const info = detectFlowHeader(src)
  if (!info) return buildHtmlWidget(primary, bg, null, { source: src, viewUrl: viewUrl(src) })
  // ELK 流程图：小组件自带裁剪版 ELK，在飞书里离线排版（可切 LR/TB、可编辑源码重绘）；约 380KB，按需加载
  if (primary.includes('data-renderer="chatgpt-elk"')) {
    try {
      const { buildOfflineWidget } = await (offlineWidgetPromise ||= import('./shared/offline/widget.js'))
      const html = buildOfflineWidget(src, { palette: elkPalette(state.theme), bg, viewBase: VIEW_BASE, theme: state.theme })
      if (new Blob([html]).size <= HTML_WIDGET_LIMIT) return html
    } catch (e) { console.warn('离线小组件生成失败，改用静态版', e) }
  }
  // 流程图（非 ELK）：再渲另一走向，HTML 里用纯 CSS 切换（无需 script）；源码一并嵌入供 Copy Mermaid
  const cur = info.dir === 'TD' ? 'TB' : info.dir
  const other = isHorizontalDir(cur) ? 'TB' : 'LR'
  const otherCode = setFlowDirection(src, other)
  if (!otherCode || otherCode === src) return buildHtmlWidget(primary, bg, null, { source: src, viewUrl: viewUrl(src) })
  try {
    const res = await render(otherCode, state.theme, state.compare ? 'elk' : state.layout)
    const second = cleanSvg(res.svg, bg)
    return buildHtmlWidget(primary, bg, second, {
      primaryDir: cur, secondaryDir: other,
      source: src, secondarySource: otherCode, viewUrl: viewUrl(src),
    })
  } catch {
    return buildHtmlWidget(primary, bg, null, { source: src, viewUrl: viewUrl(src) })
  }
}
function makePng(which) {
  const svg = which ? flat(which) : flat()
  return svgToPngBlob(svg, state.scale, THEMES[state.theme].bg)
}

els.copyPng.addEventListener('click', async () => {
  if (!state.ok) return
  const which = state.compare ? 'elk' : null
  const p = makePng(which)
  try {
    await copyPng(p)
    toast(state.compare ? `已复制${state.compareOrient === 'col' ? '下方' : '右侧'} ELK 的 PNG ✓` : 'PNG 已复制，去飞书里直接粘贴 ✓')
  } catch (e) {
    try { download(await p, pngName(which)); toast('剪贴板不可用，已改为下载 PNG：' + (e.message || e), 4000) }
    catch (e2) { toast('PNG 生成失败：' + (e2.message || e2), 4000) }
  }
})
els.downloadPng.addEventListener('click', async () => {
  if (!state.ok) return
  const which = state.compare ? 'elk' : null
  try { download(await makePng(which), pngName(which)) } catch (e) { toast('PNG 生成失败：' + (e.message || e), 4000) }
})
els.copySvg.addEventListener('click', async () => {
  if (!state.ok) return
  const which = state.compare ? 'elk' : null
  try {
    await copyText(flat(which))
    toast(state.compare ? `已复制${state.compareOrient === 'col' ? '下方' : '右侧'} ELK 的 SVG` : '独立 SVG 已复制，可导入飞书画板（飞书文档图片不支持 SVG）', 3000)
  } catch (e) { toast('复制失败：' + e.message) }
})
els.copyHtml.addEventListener('click', async () => {
  if (!state.ok) return
  try {
    const html = await htmlWidget()
    const size = new Blob([html]).size
    await copyText(html)
    const kb = (size / 1024).toFixed(1)
    const hasToggle = html.includes('mf-d-a')
    const offline = html.includes('id="mf-eng"')
    if (size > HTML_WIDGET_LIMIT) {
      els.error.hidden = false; els.error.classList.add('warn')
      els.error.textContent = `HTML 已复制，但有 ${kb} KB，超过飞书 HTML 小组件 500 KB 上限，可能贴不进去。建议改用 PNG。`
      toast(`HTML ${kb} KB，超过 500 KB 上限！`, 4000)
    } else {
      toast(offline ? `HTML 小组件已复制（离线 ELK：可切 LR/TB、改源码重绘，${kb} KB）` : hasToggle ? `HTML 小组件已复制（含 LR/TB 切换，${kb} KB）` : `HTML 小组件代码已复制（${kb} KB）`, offline ? 3500 : undefined)
    }
  } catch (e) { toast('复制失败：' + (e.message || e)) }
})
els.copyViewLink.addEventListener('click', async () => {
  const u = viewUrl()
  try { await copyText(u); toast(u.length > VIEW_URL_SOFT_LIMIT ? `查看链接已复制（${u.length} 字符，较长，部分聊天工具可能截断）` : '查看链接已复制：打开即是纯预览页', 3000) } catch (e) { toast('复制失败：' + e.message) }
})
els.openView.addEventListener('click', () => {
  const code = els.source.value
  const u = viewUrl(code)
  if (u.length <= VIEW_URL_SOFT_LIMIT) { window.open(u, '_blank', 'noopener'); return }
  // 太长：开 /view#wait，等它 ready 再 postMessage 源码
  const wu = new URL(u); wu.searchParams.delete('c')
  const w = window.open(wu.href + '#wait', '_blank')
  if (!w) { toast('浏览器拦截了新窗口'); return }
  const onMsg = (e) => { if (e.source === w && e.data && e.data.type === 'mf-view-ready') { w.postMessage({ type: 'mermaid', code }, '*'); removeEventListener('message', onMsg) } }
  addEventListener('message', onMsg)
})
els.copySrc.addEventListener('click', async () => {
  try { await copyText(els.source.value); toast('Mermaid 源码已复制，可粘进飞书「文本绘图」') } catch (e) { toast('复制失败：' + e.message) }
})

els.compareWrap.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-copy]')
  if (!btn || !state.ok) return
  const which = btn.dataset.which
  const kind = btn.dataset.copy
  if (!state.panes[which]?.svg) return
  try {
    if (kind === 'png') {
      const p = makePng(which)
      try {
        await copyPng(p)
        toast(`已复制「${which === 'elk' ? 'ELK' : '默认'}」PNG ✓`)
      } catch (err) {
        download(await p, pngName(which))
        toast('剪贴板不可用，已改为下载 PNG', 3000)
      }
    } else {
      await copyText(flat(which))
      toast(`已复制「${which === 'elk' ? 'ELK' : '默认'}」SVG`)
    }
  } catch (err) {
    toast('复制失败：' + (err.message || err), 3000)
  }
})

// 给自动化测试用
window.__mf = { state, render, makePng, pngSize, EXAMPLES, update, flat, htmlWidget }

update()
if (hashLoad) hashLoad.then((ok) => { if (ok) update() })


// ---------- 预览模式：PNG / SVG / HTML（只影响屏幕预览，不改导出 / API）----------
// 对比模式下禁用（固定 SVG）：两栏各自渲染 HTML/PNG 代价大，且 HTML 小组件只按 ELK 一侧导出
const previewEls = {
  seg: $('preview-mode'), pngWrap: $('stage-png-wrap'), png: $('stage-png'),
  htmlWrap: $('stage-html-wrap'), iframe: $('stage-html'),
}
let previewSeq = 0
let pngUrl = null
{
  const m = load(LS.previewMode)
  if (m === 'png' || m === 'svg' || m === 'html') state.previewMode = m
}
function effectivePreviewMode() { return state.compare ? 'svg' : state.previewMode }
function syncPreviewModeChrome() {
  const mode = effectivePreviewMode()
  for (const btn of previewEls.seg.querySelectorAll('.seg-btn')) {
    const on = btn.dataset.mode === mode
    btn.classList.toggle('active', on)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    btn.disabled = state.compare && btn.dataset.mode !== 'svg'
  }
  previewEls.seg.title = state.compare ? '对比模式下预览固定为 SVG' : '预览显示：SVG（实时）/ PNG（导出效果）/ HTML（小组件效果）'
  document.body.dataset.previewMode = mode
  if (state.compare) { previewEls.pngWrap.hidden = true; previewEls.htmlWrap.hidden = true; return }
  els.stageSingle.hidden = mode !== 'svg'
  previewEls.pngWrap.hidden = mode !== 'png'
  previewEls.htmlWrap.hidden = mode !== 'html'
}
// 给 srcdoc 末尾补一段只用于预览的高度上报脚本（导出的 HTML 不含它）
const HEIGHT_PING = `<script>(function(){function s(){parent.postMessage({mfWidgetHeight:Math.ceil(document.documentElement.scrollHeight)},'*')}addEventListener('load',s);new ResizeObserver(s).observe(document.documentElement);document.addEventListener('click',function(){setTimeout(s,30)});})();<\/script>`
window.addEventListener('message', (e) => {
  if (e.source !== previewEls.iframe.contentWindow) return
  const h = e.data && e.data.mfWidgetHeight
  if (Number.isFinite(h) && h > 0) previewEls.iframe.style.height = `${Math.min(h, 20000)}px`
})
async function refreshPreviewMode() {
  syncPreviewModeChrome()
  const mode = effectivePreviewMode()
  const my = ++previewSeq
  if (mode === 'svg' || !state.ok || !state.svg) return
  if (mode === 'png') {
    try {
      const blob = await makePng(null)
      if (my !== previewSeq) return
      if (pngUrl) URL.revokeObjectURL(pngUrl)
      pngUrl = URL.createObjectURL(blob)
      const img = new Image()
      img.alt = '导出 PNG 预览'
      // CSS 尺寸 = svg 尺寸（PNG 像素 ÷ 实际倍率），这样和 SVG 预览一样大
      const s = pngSize(flat(), state.scale)
      img.dataset.natW = String(Math.max(1, s.width / s.scale))
      img.src = pngUrl
      await img.decode().catch(() => {})
      if (my !== previewSeq) return
      previewEls.png.replaceChildren(img)
      sizeStageSvg(previewEls.png)
      previewEls.pngWrap.title = `实际导出 PNG：${s.width}×${s.height}px`
    } catch (e) {
      previewEls.png.innerHTML = `<div class="stage-msg">PNG 生成失败：${String(e.message || e).replace(/</g, '&lt;')}</div>`
    }
    return
  }
  if (mode === 'html') {
    try {
      const html = await htmlWidget()
      if (my !== previewSeq) return
      previewEls.iframe.style.height = ''
      previewEls.iframe.srcdoc = html.includes('</body>') ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, HEIGHT_PING + '</body>') : html + HEIGHT_PING
    } catch (e) {
      previewEls.iframe.srcdoc = `<p style="font:13px sans-serif;color:#d83931;padding:16px">HTML 生成失败：${String(e.message || e).replace(/</g, '&lt;')}</p>`
    }
  }
}
previewEls.seg.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mode]')
  if (!btn || btn.disabled || state.compare) return
  state.previewMode = btn.dataset.mode
  store(LS.previewMode, state.previewMode)
  refreshPreviewMode()
})
els.compare.addEventListener('change', () => syncPreviewModeChrome())
syncPreviewModeChrome()
window.__mf.refreshPreviewMode = refreshPreviewMode
