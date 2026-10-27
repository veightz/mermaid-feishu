// ChatGPT 风流程图的「量字 + ELK 建图 + 画 SVG」核心：不依赖解析器、不依赖具体 ELK 打包。
// 站点（chatgpt.js：beautiful-mermaid 解析 + 完整 elkjs）与飞书离线小组件（自写解析器 + 裁剪版 ELK）共用这一份，保证同图同布局。
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

export const ROOT_OPTIONS = {
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.algorithm': 'layered',
  'nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.mergeEdges': 'false',
  'spacing.baseValue': '40',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '16',
  'elk.layered.spacing.edgeNodeBetweenLayers': '28',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '18',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'false',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.unnecessaryBendpoints': 'true',
  // 尽量拉直正交折线，减少钻石节点出口旁的微小错位
  'elk.layered.nodePlacement.bk.edgeStraightening': 'IMPROVE_STRAIGHTNESS',
  'elk.layered.wrapping.multiEdge.improveCuts': 'true',
  'elk.layered.wrapping.multiEdge.improveWrappedEdges': 'true',
  'elk.layered.edgeRouting.selfLoopDistribution': 'EQUALLY',
  'elk.layered.mergeHierarchyEdges': 'true',
}

/**
 * 已解析的流程图（beautiful-mermaid 的 MermaidGraph 形状：direction / nodes Map / edges / subgraphs）→ ELK 布局 → SVG 字符串。
 * elk：任意带 layout(graph) → Promise 的 ELK 实例。
 */
export async function renderChatGPTGraph(g, elk, palette = null) {
  const P = palette ? { ...CG, ...palette } : CG // 配色可替换（布局与尺寸参数不变）
  if (!g || !g.nodes || !g.nodes.size) throw new Error('没有解析到节点（ChatGPT 风只支持 flowchart / graph）')

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

  // 连线（箭头尖端单独收集，画在节点之后，避免被填充盖住）
  const edgeParts = [], chipParts = [], arrowParts = []
  for (const [i, e] of (out.edges || []).entries()) {
    const src = g.edges[i]
    const s = e.sections?.[0]
    if (!s) continue
    const [ox, oy] = edgeOffset(e)
    let pts = [s.startPoint, ...(s.bendPoints || []), s.endPoint].map((p) => [p.x + ox, p.y + oy])
    pts = pts.filter((p, k) => k === 0 || Math.abs(p[0] - pts[k - 1][0]) > 1e-6 || Math.abs(p[1] - pts[k - 1][1]) > 1e-6)
    if (pts.length < 2) continue
    // 先清折线，再把端点贴回节点边框，最后画箭头（尖端落在边框上）
    pts = simplifyOrtho(pts)
    if (pts.length < 2) continue
    const boxOf = (id) => boxes.get(id) || boxes.get('g:' + id)
    if (boxOf(src.target)) pts[pts.length - 1] = snapToBox(pts[pts.length - 1], boxOf(src.target), pts[pts.length - 2])
    if (boxOf(src.source)) pts[0] = snapToBox(pts[0], boxOf(src.source), pts[1])
    const tips = []
    if (src.hasArrowEnd) { const r = pull(pts, pts.length - 1, pts.length - 2); pts = r.pts; tips.push(r.tip) }
    if (src.hasArrowStart) { const r = pull(pts, 0, 1); pts = r.pts; tips.push(r.tip) }
    for (const p of pts) grow(p[0], p[1])
    const dash = src.style === 'dotted' ? ' stroke-dasharray="3 3"' : ''
    const sw = src.style === 'thick' ? 2 : 1
    edgeParts.push(`<path class="cg-edge" data-from="${esc(src.source)}" data-to="${esc(src.target)}" d="${roundedPath(pts, CG.corner)}" fill="none" stroke="${P.line}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="butt"${dash}/>`)
    for (const t of tips) if (t) arrowParts.push(`<path d="${t}" fill="none" stroke="${P.arrow}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`)
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
    `<g class="cg-groups">${parts.join('')}</g><g class="cg-edges">${edgeParts.join('')}</g><g class="cg-labels">${chipParts.join('')}</g><g class="cg-nodes">${nodeParts.join('')}</g><g class="cg-arrows">${arrowParts.join('')}</g>` +
    `</g></svg>`
}

/** 把端点吸附到节点矩形边框（ELK 口位 / 折线清理后可能略有偏移） */
function snapToBox(pt, box, fromPt) {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2
  const [fx, fy] = fromPt
  // 从边外靠近：根据来向选边
  if (Math.abs(fx - cx) * box.h >= Math.abs(fy - cy) * box.w) {
    const x = fx >= cx ? box.x + box.w : box.x
    const y = Math.max(box.y, Math.min(box.y + box.h, pt[1]))
    return [x, y]
  }
  const y = fy >= cy ? box.y + box.h : box.y
  const x = Math.max(box.x, Math.min(box.x + box.w, pt[0]))
  return [x, y]
}

/**
 * 开口箭头：尖端落在节点边框上（再沿边框法向微探 0.5px，贴上 1px stroke / 虚线框），
 * 折线端点回退到箭头根部，避免线头盖住尖或留出空隙。
 */
function pull(pts, end, prev) {
  pts = pts.map((p) => p.slice())
  const [ex, ey] = pts[end], [px, py] = pts[prev]
  const dx = px - ex, dy = py - ey, l = Math.hypot(dx, dy)
  if (!l) return { pts, tip: '' }
  const ux = dx / l, uy = dy / l // 沿边离开节点（边外 → 远离框）
  // 尖端贴在描边外侧（框边 + 0.5px stroke/2），节点后绘制时仍可见并顶住虚线/实线框
  const tx = ex + ux * 0.5, ty = ey + uy * 0.5
  const arrowLen = 6 // 尖端 → 折线端（箭头深度）
  const back = Math.min(Math.max(arrowLen, 6), Math.max(0, l / 2 - 1))
  pts[end] = [tx + ux * back, ty + uy * back]
  const a = 4.2 / Math.SQRT2
  const bx = tx + ux * 4, by = ty + uy * 4
  const w1 = [bx - uy * a, by + ux * a], w2 = [bx + uy * a, by - ux * a]
  const tip = `M ${n2(pts[end][0])} ${n2(pts[end][1])} L ${n2(tx)} ${n2(ty)} M ${n2(w1[0])} ${n2(w1[1])} L ${n2(tx)} ${n2(ty)} L ${n2(w2[0])} ${n2(w2[1])}`
  return { pts, tip }
}

/** 正交折线清理：去重、共线点、过短错位（钻石口旁几像素阶梯） */
function simplifyOrtho(pts, jog = 8, eps = 1.25) {
  if (!pts || pts.length < 2) return pts
  const nearly = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps
  const dedupe = (arr) => {
    const o = [arr[0].slice()]
    for (let i = 1; i < arr.length; i++) {
      if (!nearly(o[o.length - 1], arr[i])) o.push(arr[i].slice())
      else o[o.length - 1] = arr[i].slice()
    }
    return o
  }
  let out = dedupe(pts.map((p) => p.slice()))
  // 共线（同向）中间点
  const dropColinear = (arr) => {
    if (arr.length < 3) return arr
    const o = [arr[0].slice()]
    for (let i = 1; i < arr.length - 1; i++) {
      const a = o[o.length - 1], b = arr[i], c = arr[i + 1]
      const abx = b[0] - a[0], aby = b[1] - a[1]
      const bcx = c[0] - b[0], bcy = c[1] - b[1]
      const lab = Math.hypot(abx, aby), lbc = Math.hypot(bcx, bcy)
      if (lab < eps) continue
      const cross = abx * bcy - aby * bcx
      const dot = abx * bcx + aby * bcy
      if (Math.abs(cross) <= eps * Math.max(lab, lbc, 1) && dot >= -eps) continue // 共线同向
      o.push(b.slice())
    }
    o.push(arr[arr.length - 1].slice())
    return dedupe(o)
  }
  // 竖-短横-竖 / 横-短竖-横 → 拉直
  const dropMicroJog = (arr) => {
    if (arr.length < 4) return arr
    const o = []
    let i = 0
    while (i < arr.length) {
      if (i + 3 < arr.length) {
        const a = arr[i], b = arr[i + 1], c = arr[i + 2], d = arr[i + 3]
        const abx = b[0] - a[0], aby = b[1] - a[1]
        const bcx = c[0] - b[0], bcy = c[1] - b[1]
        const cdx = d[0] - c[0], cdy = d[1] - c[1]
        const lab = Math.hypot(abx, aby), lbc = Math.hypot(bcx, bcy), lcd = Math.hypot(cdx, cdy)
        const abV = Math.abs(abx) <= eps, abH = Math.abs(aby) <= eps
        const bcV = Math.abs(bcx) <= eps, bcH = Math.abs(bcy) <= eps
        const cdV = Math.abs(cdx) <= eps, cdH = Math.abs(cdy) <= eps
        if (abV && bcH && cdV && lbc <= jog && lab > eps && lcd > eps) {
          // 只改当前竖段 a→d 的 x，绝不改写上一段拐角
          const x = lab >= lcd ? a[0] : d[0]
          const last = o[o.length - 1]
          if (last && Math.abs(last[0] - a[0]) <= eps && Math.abs(last[1] - a[1]) <= eps) o[o.length - 1] = [x, a[1]]
          else o.push([x, a[1]])
          o.push([x, d[1]])
          i += 4
          continue
        }
        if (abH && bcV && cdH && lbc <= jog && lab > eps && lcd > eps) {
          const y = lab >= lcd ? a[1] : d[1]
          const last = o[o.length - 1]
          if (last && Math.abs(last[0] - a[0]) <= eps && Math.abs(last[1] - a[1]) <= eps) o[o.length - 1] = [a[0], y]
          else o.push([a[0], y])
          o.push([d[0], y])
          i += 4
          continue
        }
      }
      // 末端短 stub：…→A→B→C 且 B→C 很短、几乎正交错位
      if (i + 2 === arr.length - 1 && i + 2 < arr.length) {
        const a = arr[i], b = arr[i + 1], c = arr[i + 2]
        const abx = b[0] - a[0], aby = b[1] - a[1]
        const bcx = c[0] - b[0], bcy = c[1] - b[1]
        const lbc = Math.hypot(bcx, bcy)
        const abV = Math.abs(abx) <= eps, abH = Math.abs(aby) <= eps
        if (lbc <= jog && abV && Math.abs(c[0] - a[0]) <= jog) {
          if (!o.length) o.push([a[0], a[1]])
          o.push([a[0], c[1]])
          i += 3
          continue
        }
        if (lbc <= jog && abH && Math.abs(c[1] - a[1]) <= jog) {
          if (!o.length) o.push([a[0], a[1]])
          o.push([c[0], a[1]])
          i += 3
          continue
        }
      }
      o.push(arr[i].slice())
      i++
    }
    return dedupe(o)
  }
  for (let pass = 0; pass < 4; pass++) {
    const n = out.length
    out = dropMicroJog(dropColinear(out))
    if (out.length === n) break
  }
  return out.length >= 2 ? out : pts
}

function roundedPath(pts, r) {
  if (!pts || pts.length < 2) return ''
  if (pts.length === 2) return `M ${n2(pts[0][0])} ${n2(pts[0][1])} L ${n2(pts[1][0])} ${n2(pts[1][1])}`
  let d = `M ${n2(pts[0][0])} ${n2(pts[0][1])}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1]
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y)
    if (l1 < 1e-6 || l2 < 1e-6) { d += ` L ${n2(x)} ${n2(y)}`; continue }
    // 转向幅度：共线同向不圆角
    const ux = (x - px) / l1, uy = (y - py) / l1
    const vx = (nx - x) / l2, vy = (ny - y) / l2
    const turn = Math.abs(ux * vy - uy * vx) // |sin θ|
    if (turn < 0.08) { d += ` L ${n2(x)} ${n2(y)}`; continue } // ≈0°/180°
    // 邻段太短：不圆角（短于约 2r）
    if (l1 < r * 2 || l2 < r * 2) {
      const rr = Math.min(r, l1 / 2, l2 / 2)
      if (rr < 1.25) { d += ` L ${n2(x)} ${n2(y)}`; continue }
      const ax = x - ux * rr, ay = y - uy * rr
      const bx = x + vx * rr, by = y + vy * rr
      d += ` L ${n2(ax)} ${n2(ay)} Q ${n2(x)} ${n2(y)} ${n2(bx)} ${n2(by)}`
      continue
    }
    const rr = Math.min(r, l1 / 2, l2 / 2)
    const ax = x - ux * rr, ay = y - uy * rr
    const bx = x + vx * rr, by = y + vy * rr
    d += ` L ${n2(ax)} ${n2(ay)} Q ${n2(x)} ${n2(y)} ${n2(bx)} ${n2(by)}`
  }
  const [lx, ly] = pts[pts.length - 1]
  return d + ` L ${n2(lx)} ${n2(ly)}`
}

