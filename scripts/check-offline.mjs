// 离线小组件解析器 + 裁剪版 ELK 与站点 ELK 管线逐字节对比（node scripts/check-offline.mjs）
import fs from 'fs'
const R=new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const site = await import(R+'/src/shared/chatgpt.js')
const { parseFlowchart } = await import(R+'/src/shared/offline/flow-parser.js')
const V=R+'/vendor/elk-layered-trim/'
const w={exports:{}}; new Function('module','exports','self','document', fs.readFileSync(V+'elk-layered-trim.worker.min.js','utf8')).call({},w,w.exports,undefined,{})
const a={exports:{}}; new Function('module','exports', fs.readFileSync(V+'elk-api.js','utf8')).call({},a,a.exports)
const ELK=a.exports.default||a.exports, W=w.exports.Worker||w.exports.default
const elk=new ELK({algorithms:['layered'],workerFactory:()=>new W()})
const { EXAMPLES } = await import(R+'/src/examples.js')
const extra = fs.existsSync(R+'/scripts/offline-samples.json')?JSON.parse(fs.readFileSync(R+'/scripts/offline-samples.json','utf8')):[]
let same=0, diff=0
for (const ex of [...EXAMPLES, ...extra]) {
  if (!site.isFlowchart(ex.code)) continue
  for (const dir of ['', 'LR', 'TB']) {
    const code = dir ? ex.code.replace(/^(\s*(?:flowchart|graph))(\s+\w+)?/m, `$1 ${dir}`) : ex.code
    let s1, s2, warn
    try { s1 = await site.renderChatGPTFlowchart(code) } catch (e) { s1 = 'ERR '+e.message }
    try { const r = parseFlowchart(code); warn=r.warnings; s2 = await site.renderChatGPTGraph(r.graph, elk) } catch (e) { s2 = 'ERR '+e.message }
    const ok = s1===s2
    ok?same++:diff++
    console.log(ok?'SAME':'DIFF', ex.id, dir||'(orig)', s1.length, s2.length, warn&&warn.length?JSON.stringify(warn):'')
  }
}
console.log({same,diff})
