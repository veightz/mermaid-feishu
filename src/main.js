import './style.css'
import { render, validate, THEMES, DEFAULT_THEME } from './render.js'
import { EXAMPLES } from './examples.js'
import { pngSize, svgSize, svgToPngBlob, copyPng, copyText, download, cleanSvg, buildHtmlWidget, HTML_WIDGET_LIMIT, PNG_MAX_SIDE, PNG_HARD_MAX_SIDE } from './export.js'
import { THEME_LABELS, LAYOUTS, LAYOUT_LABELS, themeDefaultLayout, parseLayout, firstLine } from './shared/core.js'

const $ = (id) => document.getElementById(id)
const els = {
  source: $('source'), stage: $('stage'), error: $('error'), renderer: $('renderer'), size: $('size'),
  theme: $('theme'), layout: $('layout'), compare: $('compare'), compareOrient: $('compare-orient'), scale: $('scale'),
  wideHint: $('wide-hint'), example: $('example'), toast: $('toast'),
  stageSingle: $('stage-single'), compareWrap: $('compare-wrap'),
  stageDefault: $('stage-default'), stageElk: $('stage-elk'),
  rendererDefault: $('renderer-default'), rendererElk: $('renderer-elk'),
  sizeDefault: $('size-default'), sizeElk: $('size-elk'),
  footSingle: $('foot-single'), footCompare: $('foot-compare'),
  copyPng: $('copy-png'), downloadPng: $('download-png'), copySvg: $('copy-svg'), copySrc: $('copy-src'), copyHtml: $('copy-html'),
}
const LS = { src: 'mf.source', theme: 'mf.theme', layout: 'mf.layout', scale: 'mf.scale', compare: 'mf.compare', compareOrient: 'mf.compareOrient' }

const SCALE_STEPS = [2, 3] // 与 #scale 选项一致
const state = {
  svg: '', renderer: '', theme: DEFAULT_THEME, layout: 'auto', scale: 2, ok: false, compare: false, compareOrient: 'row',
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
els.layout.add(new Option('', 'auto'))
for (const id of LAYOUTS) els.layout.add(new Option(LAYOUT_LABELS[id], id))
function syncLayoutLabel() {
  els.layout.options[0].text = `跟随配色（${themeDefaultLayout(state.theme) === 'elk' ? 'ELK' : '默认'}）`
}
for (const ex of EXAMPLES) els.example.add(new Option(ex.name, ex.id))

state.theme = THEMES[load(LS.theme)] ? load(LS.theme) : DEFAULT_THEME
state.scale = load(LS.scale) === '3' ? 3 : 2
state.layout = parseLayout(load(LS.layout)) || 'auto'
state.compare = load(LS.compare) === '1'
state.compareOrient = load(LS.compareOrient) === 'col' ? 'col' : 'row'
els.theme.value = state.theme
els.layout.value = state.layout
els.compare.checked = state.compare
syncLayoutLabel()
els.scale.value = String(state.scale)
els.source.value = load(LS.src) ?? EXAMPLES[0].code
applyCompareChrome()

// URL ?example=xxx；?compare=1；?compareOrient=row|col
const q = new URLSearchParams(location.search)
const qEx = q.get('example')
if (qEx) { const ex = EXAMPLES.find((e) => e.id === qEx); if (ex) els.source.value = ex.code }
if (q.get('compare') === '1') { state.compare = true; els.compare.checked = true }
const qOrient = (q.get('compareOrient') || '').toLowerCase()
if (qOrient === 'row' || qOrient === 'col') { state.compareOrient = qOrient; store(LS.compareOrient, qOrient) }
applyCompareChrome()

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
    els.error.hidden = true; els.wideHint.hidden = true; setOk(false)
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
/** 宽图提示：原始宽度 > 1200px 时显示；LR/RL 流程图建议改成 TB */
const WIDE_LIMIT = 1200
function updateWideHint(code, svg) {
  const { w } = svgSize(svg || state.svg)
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
els.theme.addEventListener('change', () => { state.theme = els.theme.value; store(LS.theme, state.theme); syncLayoutLabel(); update() })
els.layout.addEventListener('change', () => { state.layout = els.layout.value; store(LS.layout, state.layout); update() })
els.compare.addEventListener('change', () => {
  state.compare = els.compare.checked
  store(LS.compare, state.compare ? '1' : '0')
  if (state.compare) {
    scaleBeforeCompare = state.scale
    scaleTouchedDuringCompare = false
    bumpScaleOne() // 2x→3x；已是最高档则不动
  } else if (scaleBeforeCompare != null && !scaleTouchedDuringCompare) {
    applyScale(scaleBeforeCompare)
    scaleBeforeCompare = null
  } else {
    scaleBeforeCompare = null
  }
  applyCompareChrome()
  update()
})
els.compareOrient.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-orient]')
  if (!btn) return
  setCompareOrient(btn.dataset.orient)
})
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
function htmlWidget() { return buildHtmlWidget(flat(), THEMES[state.theme].bg) }
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
    const html = state.compare
      ? buildHtmlWidget(flat('elk'), THEMES[state.theme].bg)
      : htmlWidget()
    const size = new Blob([html]).size
    await copyText(html)
    const kb = (size / 1024).toFixed(1)
    if (size > HTML_WIDGET_LIMIT) {
      els.error.hidden = false; els.error.classList.add('warn')
      els.error.textContent = `HTML 已复制，但有 ${kb} KB，超过飞书 HTML 小组件 500 KB 上限，可能贴不进去。建议改用 PNG。`
      toast(`HTML ${kb} KB，超过 500 KB 上限！`, 4000)
    } else {
      toast(state.compare ? `已复制${state.compareOrient === 'col' ? '下方' : '右侧'} ELK 的 HTML（${kb} KB）` : `HTML 小组件代码已复制（${kb} KB）`)
    }
  } catch (e) { toast('复制失败：' + (e.message || e)) }
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
