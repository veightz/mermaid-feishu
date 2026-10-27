// 「ChatGPT 风」流程图：beautiful-mermaid 解析 → 自带字宽表量字 → elkjs（layered）布局 → 自己输出干净 SVG。
// 纯 JS、不依赖 DOM：网页和 Pages Functions 跑的是同一份代码，所以两边布局完全一致。
// 只借鉴 ChatGPT Mermaid 预览的设计参数（尺寸、颜色、ELK 选项），代码全部自写。
import { parseMermaid } from 'beautiful-mermaid'
import ELK from 'elkjs-093/lib/elk.bundled.js'
import { renderChatGPTGraph } from './chatgpt-core.js'

export { CG, ROOT_OPTIONS, textWidth, wrapText, renderChatGPTGraph } from './chatgpt-core.js'

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
  const g = parseMermaid(code)
  if (!g || !g.nodes || !g.nodes.size) throw new Error('没有解析到节点（ChatGPT 风只支持 flowchart / graph）')
  elk = elk || createElk()
  return renderChatGPTGraph(g, elk, palette)
}
