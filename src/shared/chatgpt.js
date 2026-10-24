// 「ChatGPT 风」流程图：beautiful-mermaid 解析 → 自带字宽表量字 → elkjs（layered）布局 → 自己输出干净 SVG。
// 纯 JS、不依赖 DOM：网页和 Pages Functions 跑的是同一份代码，所以两边布局完全一致。
// 只借鉴 ChatGPT Mermaid 预览的设计参数（尺寸、颜色、ELK 选项），代码全部自写。
import { parseMermaid } from 'beautiful-mermaid'
import ELK from 'elkjs-093/lib/elk.bundled.js'

export const CG = {
  bg: '#FFFFFF',
  node: '#E5F3FF', nodeStroke: '#CEDAE5', text: '#004F99',
  decision: '#F5FAFF', decisionStroke: '#8DB0DA',
  line: '#AEB9C5', arrow: '#9AA6B3',
  chip: '#F5FAFF', chipStroke: '#A9C4E4', chipText: '#004F99',
  group: '#F7F7F7', groupStroke: '#DEDEDE', groupText: '#414141',
  font: `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  // 字号：ChatGPT 的 CSS 写的是 16px，但对照 Veight 的截图（折行位置、节点宽高比）实际按 14px 排版，这里取 14px
  nodeFont: 14, nodeSpacing: 0, edgeFont: 13, edgeSpacing: -0.08, weight: 600,
  lineH: 1.1, // 每行 1.1em
  padX: 36, padY: 16, minH: 60, radius: 16, wrap: 200,
  chipPadX: 12, chipMinH: 26, chipR: 13,
  corner: 5, pullback: 8, margin: 16,
}

// ---------- 量字：CJK / 全角 = 1em；拉丁字母、数字、标点用字宽表（单位：1/1000 em，按半粗体系统字估） ----------
const W = {}
;(() => {
  const set = (chars, w) => { for (const c of chars) W[c] = w }
  set(' ', 278); set('0123456789', 580); set('$#_', 580); set('%', 900); set('&', 700); set('@', 1000)
  set('ABEKPSVXY', 690); set('CDHNRU', 745); set('GOQ', 790); set('FTZ', 640); set('L', 590); set('M', 860); set('W', 960); set('IJ', 300); set('J', 520)
  set('abdeghnopqu', 580); set('ckvxyz', 530); set('s', 520); set('fjilt', 260); set('r', 360); set('t', 330); set('f', 320); set('m', 860); set('w', 760)
  set('.,:;\'|!', 280); set('"', 400); set('-()[]{}', 340); set('/\\', 300); set('*', 400); set('+=<>~^', 600); set('?', 580); set('`', 340)
})()
const isWide = (c) => /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6\u3000-\u303F]/.test(c) || c.codePointAt(0) > 0x1F000
export function textWidth(s, size, spacing = 0) {
  let w = 0, n = 0
  for (const c of s) { w += isWide(c) ? 1000 : (W[c] ?? 600); n++ }
  return (w / 1000) * size + spacing * n
}

/** 按 mermaid 的方式折行：先按空格切词，贪心装行；单个词超宽时再按字符切。 */
export function wrapText(label, size, spacing, max) {
  const out = []
  for (const para of String(label).split(/\n|<br\s*\/?>/i)) {
    const words = para.split(' ').filter((w, i, a) => w !== '' || a.length === 1)
    let line = ''
    const fits = (s) => textWidth(s, size, spacing) <= max
    for (const word of words) {
      const cand = line ? line + ' ' + word : word
      if (fits(cand)) { line = cand; continue }
      if (line) { out.push(line); line = '' }
      if (fits(word)) { line = word; continue }
      for (const ch of word) { // 超长词按字符切
        if (fits(line + ch) || !line) line += ch
        else { out.push(line); line = ch }
      }
    }
    out.push(line)
  }
  return out
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n2 = (v) => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? 0 : r }
const dirOf = (d) => ({ LR: 'RIGHT', RL: 'LEFT', BT: 'UP', TB: 'DOWN', TD: 'DOWN' }[d] || 'DOWN')
const decodeEnt = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

function measureNode(label) {
  const lines = wrapText(decodeEnt(label), CG.nodeFont, CG.nodeSpacing, CG.wrap)
  const tw = Math.max(0, ...lines.map((l) => textWidth(l, CG.nodeFont, CG.nodeSpacing)))
  const th = CG.nodeFont * 1.2 + (lines.length - 1) * CG.nodeFont * CG.lineH
  return { lines, width: tw + CG.padX * 2, height: Math.max(CG.minH, th + CG.padY * 2) }
}
function measureChip(label) {
  if (!label) return { lines: [], width: 0, height: 0 }
  const lines = decodeEnt(label).split(/\n|<br\s*\/?>/i)
  const tw = Math.max(...lines.map((l) => textWidth(l, CG.edgeFont, CG.edgeSpacing)))
  const th = CG.edgeFont * 1.2 + (lines.length - 1) * CG.edgeFont * CG.lineH
  return { lines, width: tw + CG.chipPadX * 2, height: Math.max(CG.chipMinH, th + 8) }
}

const ROOT_OPTIONS = {
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.algorithm': 'layered',
  'nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.mergeEdges': 'false',
  'spacing.baseValue': '40',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'false',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.unnecessaryBendpoints': 'true',
  'elk.layered.wrapping.multiEdge.improveCuts': 'true',
  'elk.layered.wrapping.multiEdge.improveWrappedEdges': 'true',
  'elk.layered.edgeRouting.selfLoopDistribution': 'EQUALLY',
  'elk.layered.mergeHierarchyEdges': 'true',
}

export function isFlowchart(code) {
  for (const raw of code.split('\n')) {
    const l = raw.trim()
    if (!l || l.startsWith('%%')) continue
    return /^(flowchart|graph)\b/.test(l)
  }
  return false
}

let elk = null
// elkjs 的打包版在「有 self、没有 document」的环境（Cloudflare Workers）里会误以为自己在 Web Worker 里，
// 不导出同步的 FakeWorker。创建实例时临时藏起 self，让它走普通模块分支；浏览器（有 document）不受影响。
function createElk() {
  const g = globalThis
  const hide = typeof g.document === 'undefined' && 'self' in g
  const saved = g.self
  if (hide) { try { delete g.self } catch {} }
  try { return new ELK() } finally { if (hide && !('self' in g)) g.self = saved }
}
/** Mermaid 流程图 → ELK 布局 SVG 字符串（默认 ChatGPT 配色；传 palette 可换配色）（不含 xml 头，颜色都是具体值） */
export async function renderChatGPTFlowchart(code, palette = null) {
  const P = palette ? { ...CG, ...palette } : CG // 配色可替换（布局与尺寸参数不变）
  const g = parseMermaid(code)
  if (!g || !g.nodes || !g.nodes.size) throw new Error('没有解析到节点（ChatGPT 风只支持 flowchart / graph）')
  elk = elk || createElk()

  // 子图：节点 → 最内层子图
  const parentOf = new Map(), groups = new Map()
  const walk = (sg, parent) => {
    groups.set(sg.id, { sg, parent })
    for (const c of sg.children || []) walk(c, sg.id)
    for (const id of sg.nodeIds || []) if (!parentOf.has(id) || isDeeper(sg.id, parentOf.get(id))) parentOf.set(id, sg.id)
  }
  const depth = (id) => { let d = 0; while (id && groups.get(id)) { id = groups.get(id).parent; d++ } return d }
  const isDeeper = (a, b) => depth(a) > depth(b)
  for (const sg of g.subgraphs || []) walk(sg, null)

  const info = new Map()
  const elkNodes = new Map()
  const makeGroup = (id) => {
    if (elkNodes.has(id)) return elkNodes.get(id)
    const { sg } = groups.get(id)
    const lab = sg.label ? measureChip(sg.label) : null
    const n = {
      id: 'g:' + id, children: [], labels: lab ? [{ text: sg.label, width: lab.width + 24, height: lab.height + 16 }] : [],
      layoutOptions: { 'spacing.baseValue': '30', 'nodeLabels.placement': '[H_CENTER, V_TOP, INSIDE]', 'elk.layered.mergeEdges': 'false', 'nodePlacement.strategy': 'BRANDES_KOEPF', 'elk.hierarchyHandling': 'INCLUDE_CHILDREN', ...(sg.direction ? { 'elk.direction': dirOf(sg.direction) } : {}) },
    }
    elkNodes.set(id, n)
    const p = groups.get(id).parent
    ;(p ? makeGroup(p).children : root.children).push(n)
    return n
  }
  const root = { id: 'root', layoutOptions: { ...ROOT_OPTIONS, 'elk.direction': dirOf(g.direction) }, children: [], edges: [] }
  for (const sg of g.subgraphs || []) makeGroup(sg.id)
  for (const node of g.nodes.values()) {
    if (groups.has(node.id)) continue // 子图 id 作为端点时不当普通节点
    const m = measureNode(node.label ?? node.id)
    info.set(node.id, { ...m, shape: node.shape })
    const n = { id: node.id, width: m.width, height: m.height }
    const p = parentOf.get(node.id)
    ;(p ? makeGroup(p).children : root.children).push(n)
  }
  const ref = (id) => (groups.has(id) ? 'g:' + id : id)
  g.edges.forEach((e, i) => {
    const chip = measureChip(e.label)
    root.edges.push({
      id: 'e' + i, sources: [ref(e.source)], targets: [ref(e.target)],
      labels: [{ text: e.label || '', width: chip.width, height: chip.height, layoutOptions: { 'edgeLabels.inline': 'true', 'edgeLabels.placement': 'CENTER' } }],
    })
  })

  const out = await elk.layout(root)

  // ---------- 收集绝对坐标 ----------
  const boxes = new Map() // id → {x,y,w,h}
  const groupBoxes = []
  const visit = (n, ox, oy) => {
    for (const c of n.children || []) {
      const x = ox + c.x, y = oy + c.y
      if (c.id.startsWith('g:')) { groupBoxes.push({ id: c.id.slice(2), x, y, w: c.width, h: c.height, label: c.labels?.[0] }); boxes.set(c.id, { x, y, w: c.width, h: c.height }); visit(c, x, y) }
      else boxes.set(c.id, { x, y, w: c.width, h: c.height })
    }
  }
  visit(out, 0, 0)
  const edgeOffset = (e) => { // ELK：边坐标相对于其所在容器（这里都在 root；保险起见按 container 处理）
    const c = e.container && e.container !== 'root' ? boxes.get(e.container) : null
    return c ? [c.x, c.y] : [0, 0]
  }

  const parts = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const grow = (x, y, w = 0, h = 0) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h) }

  // 子图
  const textAttrs = (size, spacing, color) => `font-size="${size}" font-weight="${P.weight}" letter-spacing="${spacing}" fill="${color}" text-anchor="middle"`
  const textBlock = (lines, cx, cy, size, spacing, color) => {
    const lh = size * CG.lineH
    const y0 = cy - ((lines.length - 1) * lh) / 2
    return lines.map((l, i) => `<text x="${n2(cx)}" y="${n2(y0 + i * lh)}" dy="0.35em" ${textAttrs(size, spacing, color)}>${esc(l)}</text>`).join('')
  }
  for (const b of groupBoxes) {
    grow(b.x, b.y, b.w, b.h)
    const lab = b.label?.text ? textBlock(decodeEnt(b.label.text).split(/\n|<br\s*\/?>/i), b.x + b.w / 2, b.y + 8 + (b.label.height - 16) / 2, CG.edgeFont, CG.edgeSpacing, P.groupText) : ''
    parts.push(`<g class="cg-group" data-id="${esc(b.id)}"><rect x="${n2(b.x)}" y="${n2(b.y)}" width="${n2(b.w)}" height="${n2(b.h)}" rx="${CG.radius}" ry="${CG.radius}" fill="${P.group}" stroke="${P.groupStroke}" stroke-width="1"/>${lab}</g>`)
  }

  // 连线
  const edgeParts = [], chipParts = []
  for (const [i, e] of (out.edges || []).entries()) {
    const src = g.edges[i]
    const s = e.sections?.[0]
    if (!s) continue
    const [ox, oy] = edgeOffset(e)
    let pts = [s.startPoint, ...(s.bendPoints || []), s.endPoint].map((p) => [p.x + ox, p.y + oy])
    pts = pts.filter((p, k) => k === 0 || Math.abs(p[0] - pts[k - 1][0]) > 1e-6 || Math.abs(p[1] - pts[k - 1][1]) > 1e-6)
    if (pts.length < 2) continue
    const tips = []
    if (src.hasArrowEnd) { const r = pull(pts, pts.length - 1, pts.length - 2); pts = r.pts; tips.push(r.tip) }
    if (src.hasArrowStart) { const r = pull(pts, 0, 1); pts = r.pts; tips.push(r.tip) }
    for (const p of pts) grow(p[0], p[1])
    const dash = src.style === 'dotted' ? ' stroke-dasharray="3 3"' : ''
    const sw = src.style === 'thick' ? 2 : 1
    edgeParts.push(`<path class="cg-edge" data-from="${esc(src.source)}" data-to="${esc(src.target)}" d="${roundedPath(pts, CG.corner)}" fill="none" stroke="${P.line}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${dash}/>` +
      tips.map((t) => `<path d="${t}" fill="none" stroke="${P.arrow}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`).join(''))
    const lab = e.labels?.[0]
    if (src.label && lab) {
      const x = lab.x + ox, y = lab.y + oy
      const chip = measureChip(src.label)
      grow(x, y, lab.width, lab.height)
      chipParts.push(`<g class="cg-label"><rect x="${n2(x)}" y="${n2(y)}" width="${n2(lab.width)}" height="${n2(lab.height)}" rx="${CG.chipR}" ry="${CG.chipR}" fill="${P.chip}" stroke="${P.chipStroke}" stroke-width="1"/>${textBlock(chip.lines, x + lab.width / 2, y + lab.height / 2, CG.edgeFont, CG.edgeSpacing, P.chipText)}</g>`)
    }
  }

  // 节点
  const nodeParts = []
  for (const [id, m] of info) {
    const b = boxes.get(id); if (!b) continue
    grow(b.x, b.y, b.w, b.h)
    const dec = m.shape === 'diamond' || m.shape === 'hexagon'
    const r = m.shape === 'stadium' || m.shape === 'circle' || m.shape === 'doublecircle' ? Math.min(b.h, b.w) / 2 : CG.radius
    const shape = dec
      ? `<rect x="${n2(b.x)}" y="${n2(b.y)}" width="${n2(b.w)}" height="${n2(b.h)}" rx="${r}" ry="${r}" fill="${P.decision}" stroke="${P.decisionStroke}" stroke-width="1" stroke-dasharray="2 2"/>`
      : `<rect x="${n2(b.x)}" y="${n2(b.y)}" width="${n2(b.w)}" height="${n2(b.h)}" rx="${n2(r)}" ry="${n2(r)}" fill="${P.node}" stroke="${P.nodeStroke}" stroke-width="1"/>`
    nodeParts.push(`<g class="cg-node" data-id="${esc(id)}" data-shape="${esc(m.shape)}">${shape}${textBlock(m.lines, b.x + b.w / 2, b.y + b.h / 2, CG.nodeFont, CG.nodeSpacing, P.text)}</g>`)
  }

  const M = CG.margin
  const tx = -minX + M, ty = -minY + M
  const width = Math.ceil(maxX - minX + 2 * M), height = Math.ceil(maxY - minY + 2 * M)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color:${P.bg}" font-family="${esc(CG.font)}" data-renderer="chatgpt-elk">` +
    `<g transform="translate(${n2(tx)} ${n2(ty)})">` +
    `<g class="cg-groups">${parts.join('')}</g><g class="cg-edges">${edgeParts.join('')}</g><g class="cg-labels">${chipParts.join('')}</g><g class="cg-nodes">${nodeParts.join('')}</g>` +
    `</g></svg>`
}

/** 箭头端回缩 8px，返回新折线和开口箭头路径（尖端在原端点前 4px） */
function pull(pts, end, prev) {
  pts = pts.map((p) => p.slice())
  const [ex, ey] = pts[end], [px, py] = pts[prev]
  const dx = px - ex, dy = py - ey, l = Math.hypot(dx, dy)
  if (!l) return { pts, tip: '' }
  const ux = dx / l, uy = dy / l
  const back = Math.min(CG.pullback, Math.max(0, l / 2 - 4))
  pts[end] = [ex + ux * back, ey + uy * back]
  const tx = pts[end][0] - ux * 4, ty = pts[end][1] - uy * 4 // 尖端
  const a = 4.5 / Math.SQRT2
  // 两翼：沿反方向退 a，再向两侧偏 a
  const bx = tx + ux * a, by = ty + uy * a
  const w1 = [bx - uy * a, by + ux * a], w2 = [bx + uy * a, by - ux * a]
  const tip = `M ${n2(pts[end][0])} ${n2(pts[end][1])} L ${n2(tx)} ${n2(ty)} M ${n2(w1[0])} ${n2(w1[1])} L ${n2(tx)} ${n2(ty)} L ${n2(w2[0])} ${n2(w2[1])}`
  return { pts, tip }
}

function roundedPath(pts, r) {
  let d = `M ${n2(pts[0][0])} ${n2(pts[0][1])}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1]
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y)
    const rr = Math.min(r, l1 / 2, l2 / 2)
    if (rr < 0.5) { d += ` L ${n2(x)} ${n2(y)}`; continue }
    const ax = x - ((x - px) / l1) * rr, ay = y - ((y - py) / l1) * rr
    const bx = x + ((nx - x) / l2) * rr, by = y + ((ny - y) / l2) * rr
    d += ` L ${n2(ax)} ${n2(ay)} Q ${n2(x)} ${n2(y)} ${n2(bx)} ${n2(by)}`
  }
  const [lx, ly] = pts[pts.length - 1]
  return d + ` L ${n2(lx)} ${n2(ly)}`
}
