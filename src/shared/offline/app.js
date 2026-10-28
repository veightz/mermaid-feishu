// 飞书离线小组件的运行时：打包进 lzma 负载，在小组件里解压后执行。
// 依赖解压脚本先放好 window.MFElk = { ELK, Worker }（裁剪版 GWT ELK，只含 layered）。
import { renderChatGPTGraph } from '../chatgpt-core.js'
import { parseFlowchart } from './flow-parser.js'
import { sanitizeSvg } from '../sanitize-svg.js'
import { buildViewUrl, VIEW_URL_SOFT_LIMIT } from '../viewlink.js'

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
  let original = $('mermaid-source').textContent.replace(/<\\\/(script)/gi, '</$1').replace(/<\\!--/g, '<!--')
  const KEY = 'mf-src-' + hash(original)
  const S = cfg.embed ? null : store() // 嵌入模式：由外层（飞书 HTML 块）负责保存
  const elk = new window.MFElk.ELK({ algorithms: ['layered'], workerFactory: () => new window.MFElk.Worker() })
  let busy = 0, drawn = ''
  const say = (t) => { msg.textContent = t || '' }
  // 源码面板：旧版是 <details>；通用版是工具栏「编辑源码」按钮 + 可收起的面板
  const src = $('mf-src'), edit = $('mf-edit')
  const openSrc = (o) => {
    if (src.tagName === 'DETAILS') { src.open = o; return }
    src.hidden = !o
    edit.textContent = o ? '收起源码' : '编辑源码'
    if (o) ta.focus()
  }
  if (edit) edit.onclick = () => openSrc(src.hidden)
  if ($('mf-close')) $('mf-close').onclick = () => openSrc(false)

  async function draw(src, { persist = false } = {}) {
    const my = ++busy
    let res
    try { res = parseFlowchart(src) } catch (e) { showWarn([], '无法绘制：' + (e.message || e)); return false }
    try {
      let svg = await renderChatGPTGraph(res.graph, elk, cfg.palette || null)
      if (my !== busy) return false
      const w = +(/width="([\d.]+)"/.exec(svg) || [])[1] || FEISHU_W
      svg = svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height|style)="[^"]*"/g, '').replace(/>$/, ` width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;max-width:${Math.min(w, FEISHU_W)}px;height:auto;margin:0 auto">`))
      out.innerHTML = sanitizeSvg(svg)
      drawn = src
      flip.textContent = curDir(src) === 'LR' || curDir(src) === 'RL' ? 'LR → TB' : 'TB → LR'
      flip.hidden = false
      showWarn(res.warnings)
      if (persist && cfg.embed) {
        if (window.parent !== window) window.parent.postMessage({ type: 'mf-save', src }, '*')
        say(src === original ? '已还原' : '已重绘 · 已交给外层保存')
      } else if (persist && S) {
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

  // 「新窗口查看」：/view#c=…（排版仍是本地离线；只有这个按钮要联网）。太长 → /view#wait + postMessage。
  // window.open 被拦（沙箱 iframe）→ 退回 <a target=_blank>；再不行就复制链接
  $('mf-view').onclick = () => {
    const code = ta.value === drawn ? drawn : (drawn || ta.value)
    const url = buildViewUrl(cfg.viewBase, code, { theme: cfg.theme, dir: curDir(code) })
    const big = url.length > VIEW_URL_SOFT_LIMIT
    const target = big ? url.slice(0, url.indexOf('#')) + '#wait' : url
    let w = null
    try { w = window.open(target, '_blank') } catch (e) { w = null }
    if (w) {
      if (big) {
        const onMsg = (e) => { if (e.source === w && e.data && e.data.type === 'mf-view-ready') { w.postMessage({ type: 'mermaid', code }, '*'); removeEventListener('message', onMsg) } }
        addEventListener('message', onMsg)
      } else { try { w.opener = null } catch (e) {} }
      return
    }
    if (!big) {
      try { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove() } catch (e) {}
    }
    // 沙箱里 <a> 也可能被静默拦截，看不出成败：同时把链接放进剪贴板
    const copied = () => toast(big ? '源码太长、此处无法开新窗口：已复制查看链接（较长）' : '已复制查看链接（若没弹出新窗口，粘贴到浏览器打开）')
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(copied, () => toast('无法打开新窗口，也无法复制链接'))
    else toast('无法打开新窗口')
  }

  $('mf-copy').onclick = () => {
    const text = ta.value
    const fallback = () => {
      let ok = false
      try { ta.focus(); ta.select(); ok = document.execCommand('copy') } catch (e) {}
      if (!ok) { openSrc(true); ta.select() }
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

  if (cfg.embed) return embedStart()
  ;(async () => {
    let saved = null
    if (S) { try { saved = await S.get(KEY) } catch (e) {} }
    if (typeof saved === 'string' && saved.trim() && saved !== original) {
      ta.value = saved
      if (await draw(saved)) { if (src.tagName === 'DETAILS') src.open = true; say(`已载入上次编辑的版本（点「${$('mf-rs').textContent}」回到原始源码）`); return }
    }
    ta.value = original
    draw(original)
  })()

  // 嵌入模式（/embed）：外层用 postMessage {type:'mf-src', src} 传源码（或 #src=base64url），
  // 本页回 {type:'mf-ready'} / {type:'mf-save', src} / {type:'mf-height', h}；1.5s 内没收到源码就画内置示例
  function embedStart() {
    const P = window.parent !== window ? window.parent : null
    let got = false
    const accept = (s) => { got = true; original = s; ta.value = s; draw(s) }
    addEventListener('message', (e) => {
      if (P && e.source !== P) return
      const d = e.data
      if (d && d.type === 'mf-src' && typeof d.src === 'string' && d.src.trim() && d.src.length <= 200 * 1024) accept(d.src)
    })
    const m = /[#&]src=([^&]*)/.exec(location.hash)
    if (m) {
      try {
        const b = atob(decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/'))
        const s = new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)))
        if (s.trim()) accept(s)
      } catch (e) { showWarn([], '#src= 解码失败（需 URL 安全 base64 的 UTF-8 文本）') }
    }
    const mf = document.querySelector('.mf')
    let last = 0
    const ping = () => { const h = Math.ceil(mf.getBoundingClientRect().height); if (P && h !== last) { last = h; P.postMessage({ type: 'mf-height', h }, '*') } }
    new ResizeObserver(ping).observe(mf)
    if (P) P.postMessage({ type: 'mf-ready' }, '*')
    setTimeout(() => { if (!got) { ta.value = original; draw(original) } }, 1500)
  }
}

window.MFOffline = { boot, parseFlowchart }
