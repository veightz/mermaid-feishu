// 通用「飞书 Mermaid 渲染插件」：一个自包含离线 HTML，贴进飞书 /HTML 块后粘贴任意 flowchart 源码即可重绘。
// npm run build:widget → dist-widget/feishu-mermaid-widget.html（vite build 会清空 dist/，所以单独放）
import { mkdirSync, writeFileSync } from 'fs'
import { buildOfflineWidget } from '../src/shared/offline/widget.js'

export const EXAMPLE = `flowchart TB
  A([开始]) --> B{条件满足?}
  B -->|是| C[执行操作]
  B -->|否| D[跳过]
  C --> E([结束])
  D --> E`

const FEISHU_RATIO = 1.184 // 实测：本地 407,090 B 的文件飞书计为 482,068 B
const html = buildOfflineWidget(EXAMPLE, { generic: true })
const bytes = Buffer.byteLength(html)
const out = new URL('../dist-widget/feishu-mermaid-widget.html', import.meta.url)
mkdirSync(new URL('.', out), { recursive: true })
writeFileSync(out, html)
const est = Math.round(bytes * FEISHU_RATIO)
console.log(`${out.pathname}: ${bytes} B（飞书估计 ≈ ${est} B / ${(est / 1024).toFixed(1)} KB）`)
if (bytes * FEISHU_RATIO >= 490 * 1000) { console.error('超出预算：本地 × 1.184 应 < 490KB'); process.exit(1) }
