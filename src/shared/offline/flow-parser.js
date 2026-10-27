// 飞书离线小组件用的手写 flowchart 解析器（不依赖 beautiful-mermaid）。
// 节点 / 连线的识别规则与插入顺序刻意对齐 beautiful-mermaid 的 parseFlowchart，保证同一份源码在站点和离线版里排出同样的 ELK 布局。
// 与 BM 不同的是：识别不了的内容一律记进 warnings（界面上显示），不会悄悄丢掉连线。

const ARROW = /^(<)?(-->|-\.->|==>|---|-\.-|===|~~~)(?:\|([^|]*)\|)?/
const TEXT_ARROW = /^(<)?(--|-\.|==)\s+(.+?)\s+(-->|---|\.->|-\.-|==>|===)/
const NODE_PATTERNS = [
  [/^([\w-]+)\(\(\((.+?)\)\)\)/, 'doublecircle'],
  [/^([\w-]+)\(\[(.+?)\]\)/, 'stadium'],
  [/^([\w-]+)\(\((.+?)\)\)/, 'circle'],
  [/^([\w-]+)\[\[(.+?)\]\]/, 'subroutine'],
  [/^([\w-]+)\[\((.+?)\)\]/, 'cylinder'],
  [/^([\w-]+)\[\/(.+?)\\\]/, 'trapezoid'],
  [/^([\w-]+)\[\\(.+?)\/\]/, 'trapezoid-alt'],
  [/^([\w-]+)>(.+?)\]/, 'asymmetric'],
  [/^([\w-]+)\{\{(.+?)\}\}/, 'hexagon'],
  [/^([\w-]+)\[(.+?)\]/, 'rectangle'],
  [/^([\w-]+)\((.+?)\)/, 'rounded'],
  [/^([\w-]+)\{(.+?)\}/, 'diamond'],
]
// 画法上与圆角矩形相同的形状（ChatGPT 风本身也这么画）：解析照常，只提示一次
const PLAIN_SHAPES = { subroutine: '[[ ]]', cylinder: '[( )]', trapezoid: '[/ \\]', 'trapezoid-alt': '[\\ /]', asymmetric: '> ]' }

export function normalizeLabel(label) {
  const unquoted = label.startsWith('"') && label.endsWith('"') ? label.slice(1, -1) : label
  return unquoted
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/<\/?(?:sub|sup|small|mark)\s*>/gi, '')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*(?!\*)/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
}

// `graph LR; A --> B` 这种 ; 分隔写法拆成多行（括号 / 引号 / |标签| 里的 ; 不拆）——与站点 preprocessBM 相同
function splitSemicolons(code) {
  let out = '', depth = 0, quote = false, pipe = false
  for (const ch of code) {
    if (ch === '"') quote = !quote
    else if (!quote && ch === '|') pipe = !pipe
    else if (!quote && !pipe && '[({'.includes(ch)) depth++
    else if (!quote && !pipe && '])}'.includes(ch)) depth = Math.max(0, depth - 1)
    if (ch === ';' && !quote && !pipe && depth === 0) { out += '\n'; continue }
    if (ch === '\n') { quote = false; pipe = false; depth = 0 }
    out += ch
  }
  return out
}

/**
 * Mermaid flowchart 源码 → { graph, warnings }
 * graph 与 beautiful-mermaid 的 MermaidGraph 同形（direction / nodes Map / edges / subgraphs），可直接交给 renderChatGPTGraph。
 * 子图分组框暂不画：里面的节点和连线照常排版，并给出提示。
 */
export function parseFlowchart(code) {
  const warnings = []
  const warned = new Set()
  const warnOnce = (key, msg) => { if (!warned.has(key)) { warned.add(key); warnings.push(msg) } }
  let text = String(code).replace(/\r\n?/g, '\n').replace(/^\s*---\n[\s\S]*?\n---[ \t]*\n/, '')
  if (text.includes(';')) text = splitSemicolons(text)
  const lines = text.split('\n').map((l, i) => [l.trim(), i + 1]).filter(([l]) => l && !l.startsWith('%%'))
  if (!lines.length) throw new Error('源码是空的')
  const head = lines[0][0].match(/^(?:graph|flowchart)(?:\s+(TD|TB|LR|BT|RL))?\s*$/i)
  if (!head) throw new Error(`第一行应为 flowchart / graph 加方向（如 flowchart LR），实际是：${lines[0][0].slice(0, 60)}`)
  const graph = { direction: (head[1] || 'TB').toUpperCase(), nodes: new Map(), edges: [], subgraphs: [], classDefs: new Map(), classAssignments: new Map(), nodeStyles: new Map(), linkStyles: new Map() }
  const subgraphIds = new Set()
  let depth = 0

  const consumeNode = (s) => {
    for (const [re, shape] of NODE_PATTERNS) {
      const m = s.match(re)
      if (m) {
        if (!graph.nodes.has(m[1])) graph.nodes.set(m[1], { id: m[1], label: normalizeLabel(m[2]), shape })
        if (PLAIN_SHAPES[shape]) warnOnce('shape-' + shape, `形状 ${PLAIN_SHAPES[shape]} 按普通矩形绘制`)
        return { id: m[1], rest: stripClass(s.slice(m[0].length)) }
      }
    }
    const m = s.match(/^(\w+(?:-\w+)*)/) // 与 Mermaid 一致：a-->b 的 id 是 a（BM 会误吞成 a--）
    if (!m) return null
    if (!graph.nodes.has(m[1])) graph.nodes.set(m[1], { id: m[1], label: m[1], shape: 'rectangle' })
    return { id: m[1], rest: stripClass(s.slice(m[0].length)) }
  }
  const stripClass = (s) => {
    const m = s.match(/^:::([\w][\w-]*)/)
    if (!m) return s
    warnOnce('class', '节点样式（:::class / classDef / class / style）暂不支持，已按默认配色绘制')
    return s.slice(m[0].length)
  }
  const consumeGroup = (s) => {
    const first = consumeNode(s)
    if (!first) return null
    const ids = [first.id]
    let rest = first.rest.trim()
    while (rest.startsWith('&')) {
      const n = consumeNode(rest.slice(1).trim())
      if (!n) break
      ids.push(n.id)
      rest = n.rest.trim()
    }
    return { ids, rest }
  }

  for (let k = 1; k < lines.length; k++) {
    const [line, no] = lines[k]
    if (/^(classDef|class|style)\s/.test(line)) { warnOnce('class', '节点样式（:::class / classDef / class / style）暂不支持，已按默认配色绘制'); continue }
    if (/^linkStyle\s/.test(line)) { warnOnce('linkStyle', '连线样式（linkStyle）暂不支持，已按默认样式绘制'); continue }
    if (/^(click|accTitle|accDescr)\b/.test(line)) { warnOnce('click', `第 ${no} 行：${line.split(/\s/)[0]} 交互 / 无障碍语句已忽略`); continue }
    if (/^direction\s+(TD|TB|LR|BT|RL)\s*$/i.test(line)) { if (depth) warnOnce('sgdir', '子图内的 direction 暂不支持，按整图方向排版'); continue }
    const sg = line.match(/^subgraph\s+(.+)$/)
    if (sg) {
      depth++
      const r = sg[1].trim(), bm = r.match(/^([\w-]+)\s*\[(.+)\]$/)
      subgraphIds.add(bm ? bm[1] : r.replace(/\s+/g, '_').replace(/[^\w]/g, ''))
      warnOnce('subgraph', '子图（subgraph）分组框离线版暂不绘制：里面的节点和连线照常排版')
      continue
    }
    if (line === 'end') { if (depth) depth--; else warnOnce('end' + no, `第 ${no} 行：多余的 end，已忽略`); continue }

    const first = consumeGroup(line)
    if (!first) { warnings.push(`第 ${no} 行无法识别，已跳过：${line.slice(0, 80)}`); continue }
    let rest = first.rest, prev = first.ids
    while (rest.length) {
      let style, start, end, label
      const am = rest.match(ARROW)
      if (am) {
        if (am[2] === '~~~') {
          const next = consumeGroup(rest.slice(am[0].length).trim())
          warnOnce('invisible', '不可见连线（~~~）离线版不参与排版，也不绘制')
          if (!next) break
          rest = next.rest; prev = next.ids
          continue
        }
        start = !!am[1]; const op = am[2]
        label = am[3] && am[3].trim() ? normalizeLabel(am[3].trim()) : undefined
        style = op === '-.->' || op === '-.-' ? 'dotted' : op === '==>' || op === '===' ? 'thick' : 'solid'
        end = op.endsWith('>')
        rest = rest.slice(am[0].length).trim()
      } else {
        const tm = rest.match(TEXT_ARROW)
        if (!tm) break
        start = !!tm[1]
        label = tm[3].trim() ? normalizeLabel(tm[3].trim()) : undefined
        const o = tm[2], c = tm[4]
        style = o === '-.' || c === '.->' || c === '-.-' ? 'dotted' : o === '==' || c === '==>' || c === '===' ? 'thick' : 'solid'
        end = c.endsWith('>')
        rest = rest.slice(tm[0].length).trim()
      }
      const next = consumeGroup(rest)
      if (!next) { warnings.push(`第 ${no} 行：连线缺少终点，已跳过：${line.slice(0, 80)}`); rest = ''; break }
      rest = next.rest
      for (const s of prev) for (const t of next.ids) graph.edges.push({ source: s, target: t, label, style, hasArrowStart: start, hasArrowEnd: end })
      prev = next.ids
    }
    if (rest.trim()) warnings.push(`第 ${no} 行有无法识别的部分，已跳过：${rest.trim().slice(0, 60)}`)
  }
  for (const e of graph.edges) for (const id of [e.source, e.target]) if (subgraphIds.has(id)) warnOnce('sgedge-' + id, `连线指向子图「${id}」：离线版按普通节点绘制`)
  if (!graph.nodes.size) throw new Error('没有解析到节点')
  return { graph, warnings }
}
