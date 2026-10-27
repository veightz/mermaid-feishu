// 飞书离线小组件的运行时：打包进 lzma 负载，在小组件里解压后执行。
// 依赖解压脚本先放好 window.MFElk = { ELK, Worker }（裁剪版 GWT ELK，只含 layered）。
import { renderChatGPTGraph } from '../chatgpt-core.js'
import { parseFlowchart } from './flow-parser.js'

const $ = (id) => document.getElementById(id)
const FEISHU_W = 820

function setDir(code, dir) {
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l || l.startsWith('%%')) continue
    if (!/^(flowchart|graph)\b/i.test(l)) return code
    lines[i] = lines[i].replace(/^(\s*)(flowchart|graph)(?:\s+(TB|TD|BT|LR|RL))?(?=\s|;|$)/i, `$1$2 ${dir}`)
    return lines.join('\n')
  }
  return code
}
function curDir(code) {
  const m = /^\s*(?:flowchart|graph)(?:\s+(TB|TD|BT|LR|RL))?/im.exec(code.replace(/^\s*%%.*$/gm, ''))
  const d = ((m && m[1]) || 'TB').toUpperCase()
  return d === 'TD' ? 'TB' : d
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// 持久化：飞书 HTML 块里 localStorage 不可用，优先 window.magic.store；都没有就只在本次打开有效
function store() {
  const m = window.magic && window.magic.store
  if (m) {
    const get = m.get || m.getItem, set = m.set || m.setItem
    if (typeof get === 'function' && typeof set === 'function') return { get: (k) => get.call(m, k), set: (k, v) => set.call(m, k, v), kind: '文档' }
  }
  try { const t = '__mf'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return { get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), kind: '本机' } } catch (e) { return null }
}

function boot() {
  const out = $('mf-out'), warn = $('mf-warn'), ta = $('mf-ta'), msg = $('mf-msg'), flip = $('mf-flip')
  const cfg = JSON.parse($('mf-cfg').textContent || '{}')
  const original = $('mermaid-source').textContent.replace(/<\\\/(script)/gi, '</$1').replace(/<\\!--/g, '<!--')
  const KEY = 'mf-src-' + hash(original)
  const S = store()
  const elk = new window.MFElk.ELK({ algorithms: ['layered'], workerFactory: () => new window.MFElk.Worker() })
  let busy = 0, drawn = ''
  const say = (t) => { msg.textContent = t || '' }

  async function draw(src, { persist = false } = {}) {
    const my = ++busy
    let res
    try { res = parseFlowchart(src) } catch (e) { showWarn([], '无法绘制：' + (e.message || e)); return false }
    try {
      let svg = await renderChatGPTGraph(res.graph, elk, cfg.palette || null)
      if (my !== busy) return false
      const w = +(/width="([\d.]+)"/.exec(svg) || [])[1] || FEISHU_W
      svg = svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height|style)="[^"]*"/g, '').replace(/>$/, ` width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;max-width:${Math.min(w, FEISHU_W)}px;height:auto;margin:0 auto">`))
      out.innerHTML = svg
      drawn = src
      flip.textContent = curDir(src) === 'LR' || curDir(src) === 'RL' ? 'LR → TB' : 'TB → LR'
      flip.hidden = false
      showWarn(res.warnings)
      if (persist && S) {
        try { await S.set(KEY, src === original ? '' : src); say(src === original ? '已还原' : `已重绘 · 已保存到${S.kind}`) } catch (e) { say('已重绘（保存失败，关闭后会还原）') }
      } else if (persist) say('已重绘（此环境无法保存，关闭后会还原）')
      return true
    } catch (e) {
      showWarn(res.warnings, '排版失败：' + (e.message || e))
      return false
    }
  }
  function showWarn(list, err) {
    const items = (err ? [`<li class="mf-err">${esc(err)}</li>`] : []).concat(list.map((w) => `<li>${esc(w)}</li>`))
    warn.innerHTML = items.length ? `<b>${err ? '出错了' : '离线版提示'}</b><ul>${items.join('')}</ul>` : ''
    warn.hidden = !items.length
  }

  flip.onclick = () => {
    const base = ta.value === drawn ? drawn : ta.value
    const next = setDir(base, curDir(base) === 'LR' || curDir(base) === 'RL' ? 'TB' : 'LR')
    ta.value = next
    draw(next, { persist: true })
  }
  $('mf-go').onclick = () => { say('排版中…'); draw(ta.value, { persist: true }) }
  if ($('mf-clr')) $('mf-clr').onclick = () => { ta.value = ''; ta.focus(); say('粘贴 Mermaid 后点「重绘」') }
  $('mf-rs').onclick = () => { ta.value = original; draw(original, { persist: true }) }
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('mf-go').click() } })

  $('mf-copy').onclick = () => {
    const text = ta.value
    const fallback = () => {
      let ok = false
      try { ta.focus(); ta.select(); ok = document.execCommand('copy') } catch (e) {}
      if (!ok) { $('mf-src').open = true; ta.focus(); ta.select() }
      toast(ok ? '已复制' : '请按 ⌘C / Ctrl+C 复制已选中的源码')
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('已复制'), fallback)
    else fallback()
  }
  function toast(t) {
    const d = document.createElement('div')
    d.className = 'mf-toast'; d.textContent = t
    document.body.appendChild(d)
    setTimeout(() => d.remove(), 1800)
  }

  ;(async () => {
    let saved = null
    if (S) { try { saved = await S.get(KEY) } catch (e) {} }
    if (typeof saved === 'string' && saved.trim() && saved !== original) {
      ta.value = saved
      if (await draw(saved)) { $('mf-src').open = true; say(`已载入上次编辑的版本（点「${$('mf-rs').textContent}」回到原始源码）`); return }
    }
    ta.value = original
    draw(original)
  })()
}

window.MFOffline = { boot, parseFlowchart }
