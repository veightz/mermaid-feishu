// 回归检查：用 API 处理函数渲染若干示例 × 主题 × 布局，输出到目录；可与基线目录逐字节对比。
// 用法：node scripts/check-layout.mjs <outDir> [--layouts]
import { mkdirSync, writeFileSync } from 'node:fs'
import { onRequest } from '../functions/api/[[path]].js'

const out = process.argv[2] || '/tmp/mf-out'
const withLayouts = process.argv.includes('--layouts')
mkdirSync(out, { recursive: true })
const SAMPLES = {
  flow: 'flowchart TD\n  A[提交需求] --> B{评审通过?}\n  B -->|是| C[开发]\n  B -->|否| D[退回修改]\n  D --> A',
  lr: 'graph LR; A[开始] --> B[处理] --> C[结束]',
  sub: 'flowchart TB\n  subgraph fe [前端]\n    A[页面] --> B[API 客户端]\n  end\n  subgraph be [后端]\n    C[网关] --> D[(数据库)]\n  end\n  B --> C\n  C -.-> E([日志])',
  seq: 'sequenceDiagram\n  Alice->>Bob: 你好\n  Bob-->>Alice: 收到',
  state: 'stateDiagram-v2\n  [*] --> 草稿\n  草稿 --> 已发布\n  已发布 --> [*]',
}
const THEMES = ['feishu-light', 'feishu-gray', 'soft-sage', 'feishu-blue', 'chatgpt', 'notion-blocks', 'github-dark']
const LAYOUTS = withLayouts ? [undefined, 'auto', 'default', 'elk'] : [undefined]
let n = 0, bad = 0
for (const [name, code] of Object.entries(SAMPLES)) for (const theme of THEMES) for (const layout of LAYOUTS) {
  const res = await onRequest({ request: new Request('https://x/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, theme, format: 'svg', ...(layout ? { layout } : {}) }) }) })
  const body = await res.text()
  const ok = res.status === 200 && /^(<\?xml[^>]*>\s*)?<svg\b/.test(body)
  if (!ok) { bad++; console.log('FAIL', name, theme, layout, res.status, body.slice(0, 200)) }
  writeFileSync(`${out}/${name}.${theme}${layout ? '.' + layout : ''}.svg`, body)
  if (withLayouts) console.log(ok ? 'ok ' : 'BAD', name.padEnd(5), theme.padEnd(13), String(layout).padEnd(9), res.headers.get('x-renderer'), res.headers.get('x-layout') || '')
  n++
}
if (withLayouts) {
  // 非法 layout → 400 bad_layout；GET 参数 / 大小写 / auto 也要能用
  const call = (u, init) => onRequest({ request: new Request('https://x' + u, init) })
  const r1 = await call('/api/render', { method: 'POST', body: JSON.stringify({ code: SAMPLES.flow, layout: 'dagre' }) })
  const j1 = await r1.json(); if (r1.status !== 400 || j1.code !== 'bad_layout') { bad++; console.log('BAD bad_layout', r1.status, j1) } else console.log('ok  invalid layout → 400 bad_layout')
  const r2 = await call('/api/render?theme=feishu-light&layout=ELK&code=' + encodeURIComponent(SAMPLES.flow))
  if (r2.headers.get('x-layout') !== 'elk') { bad++; console.log('BAD GET layout=ELK', r2.status) } else console.log('ok  GET layout=ELK → elk')
  const r3 = await call('/api/themes'); const j3 = await r3.json()
  if (!j3.layouts || j3.themes.find((t) => t.id === 'chatgpt').defaultLayout !== 'elk') { bad++; console.log('BAD themes', j3.layouts) } else console.log('ok  /api/themes layouts', j3.layouts.join(','))
}
console.log(`${n} renders, ${bad} failures → ${out}`)
process.exit(bad ? 1 : 0)
