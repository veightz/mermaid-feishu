// 生成飞书离线小组件的引擎负载：裁剪版 ELK worker + elk-api + 小组件运行时（app.js），一起 lzma -9e + base85。
// 输出 src/shared/offline/engine-payload.js（提交到仓库）。需要本机有 xz 和 esbuild（devDependency 经 vite 自带）。
import { readFileSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { build } from 'esbuild'

const V = new URL('../vendor/elk-layered-trim/', import.meta.url)
const worker = readFileSync(new URL('elk-layered-trim.worker.min.js', V), 'utf8')
const api = readFileSync(new URL('elk-api.js', V), 'utf8')
const decoder = readFileSync(new URL('lzma-d-min.js', V), 'utf8')

const app = (await build({
  entryPoints: [new URL('../src/shared/offline/app.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'iife', minify: true, target: 'es2019', charset: 'ascii', legalComments: 'none',
})).outputFiles[0].text

// worker 代码在「无 document、有 self」时会走真·Web Worker 分支；这里藏起 self、给个假 document，让它导出同步 FakeWorker。
const payload = [
  'var __w={exports:{}};(function(module,exports,self,document){', worker, '\n}).call({},__w,__w.exports,void 0,{});',
  'var __a={exports:{}};(function(module,exports){', api, '\n}).call({},__a,__a.exports);',
  'window.MFElk={ELK:__a.exports.default||__a.exports,Worker:__w.exports.Worker||__w.exports.default};',
  app,
  'window.MFOffline.boot();',
].join('')

const lz = execFileSync('xz', ['--format=lzma', '-9e', '-c'], { input: Buffer.from(payload, 'utf8'), maxBuffer: 1 << 26 })
// base85（自定字母表，避开 " ' < > & \\ ` / %，可直接放进 <script> 原文）：比 base64 小约 6%
export const B85 = (() => { let a = ''; for (let c = 33; c < 127; c++) if (!'"\'<>&\\`/%'.includes(String.fromCharCode(c))) a += String.fromCharCode(c); return a })()
if (B85.length !== 85) throw new Error('alphabet ' + B85.length)
let b85 = ''
for (let i = 0; i < lz.length; i += 4) {
  let v = 0
  for (let j = 0; j < 4; j++) v = v * 256 + (i + j < lz.length ? lz[i + j] : 0)
  let chunk = ''
  for (let k = 0; k < 5; k++) { chunk = B85[v % 85] + chunk; v = Math.floor(v / 85) }
  b85 += chunk
}
if (/<\/script/i.test(decoder)) throw new Error('decoder contains </script')
writeFileSync(new URL('../src/shared/offline/engine-payload.js', import.meta.url),
  `// 自动生成：npm run build:offline（scripts/build-offline-engine.mjs）。勿手改。\n` +
  `// 负载原文 ${payload.length} 字节（app ${app.length}）→ lzma ${lz.length} → base85 ${b85.length}\n` +
  `export const LZMA_DECODER = ${JSON.stringify(decoder)}\n` +
  `export const ENGINE_ALPHABET = ${JSON.stringify(B85)}\n` +
  `export const ENGINE_LEN = ${lz.length}\n` +
  `export const ENGINE_B85 = ${JSON.stringify(b85)}\n`)
console.log({ payload: payload.length, app: app.length, lzma: lz.length, b85: b85.length, decoder: decoder.length })
