// 飞书离线 HTML 小组件（流程图 · ELK 版）：页面里自带裁剪版 ELK（只含 layered）+ 手写解析器 + ChatGPT 风画图，
// 打开时离线排版；可切 LR/TB、编辑源码后重绘、复制 Mermaid。不发任何网络请求。
import { LZMA_DECODER, ENGINE_ALPHABET, ENGINE_LEN, ENGINE_B85 } from './engine-payload.js'

const STACK = `-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif`
const MONO = `ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`

const escScript = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')
// JSON 放进 <script type="application/json">：< 转义即可避开 </script> 与 <!--
const jsonScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

/**
 * @param {string} source  Mermaid flowchart 源码
 * @param {object} [opts]  { palette, bg, generic }：palette 为 ChatGPT 风配色覆盖（与站点 elkPalette 相同），bg 为背景色；
 *   generic=true：通用「飞书 Mermaid 渲染插件」——源码面板平时收起（工具栏「编辑源码」按钮，在 Copy Mermaid 左边），展开后在图上方，主流程是「粘贴 Mermaid → 重绘」
 */
function srcPanel(generic) {
  if (generic) {
    // 通用版：平时收起，只在顶部工具栏留「编辑源码」按钮；展开后整宽面板在工具栏下方
    return `<div class="mf-src" id="mf-src" hidden><div class="mf-hd"><b>粘贴 Mermaid 流程图，点「重绘」（⌘/Ctrl+Enter）</b><button type="button" id="mf-close">收起</button></div><textarea id="mf-ta" spellcheck="false" autocomplete="off" placeholder="flowchart LR&#10;  A[开始] --&gt; B{判断}"></textarea>
<div class="mf-row"><button type="button" id="mf-go">重绘</button><button type="button" id="mf-clr">清空</button><button type="button" id="mf-rs">还原示例</button><span id="mf-msg"></span></div></div>
`
  }
  return `<details class="mf-src" id="mf-src"><summary>源码（可编辑，改完点「重绘」）</summary><textarea id="mf-ta" spellcheck="false" autocomplete="off"></textarea>
<div class="mf-row"><button type="button" id="mf-go">重绘</button><button type="button" id="mf-rs">还原</button><span id="mf-msg"></span></div></details>
`
}

export function buildOfflineWidget(source, opts = {}) {
  const palette = opts.palette || null
  const bg = opts.bg || (palette && palette.bg) || '#ffffff'
  const generic = !!opts.generic
  const css = `html,body{margin:0;background:${bg}}body{font-family:${STACK}}[hidden]{display:none!important}
.mf{box-sizing:border-box;max-width:820px;margin:0 auto;padding:16px 12px;position:relative}
.mf-b{position:absolute;z-index:2;top:10px;font:12px/1.2 ${STACK};padding:5px 10px;border:1px solid rgba(51,112,255,.35);border-radius:6px;background:rgba(255,255,255,.82);color:#2b5cb8;cursor:pointer;backdrop-filter:blur(4px);box-shadow:0 1px 3px rgba(0,0,0,.06)}
.mf-b:hover{background:rgba(240,244,255,.95);border-color:#3370ff}
#mf-flip{left:10px}#mf-copy{right:10px}
.mf-out{min-height:60px}
.mf-st{padding:36px 0;text-align:center;color:#8f959e;font-size:13px}
.mf-warn{margin:10px 0 0;padding:8px 12px;border:1px solid #f5d48a;background:#fffaeb;border-radius:8px;font-size:12px;color:#7a5a00}
.mf-warn ul{margin:4px 0 0;padding-left:18px}.mf-err{color:#d83931}
.mf-src{margin:12px 0 0;font-size:13px;color:#646a73;border:1px solid #e5e6eb;border-radius:8px;background:rgba(247,248,250,.9);padding:0 10px 8px}
.mf-src summary{cursor:pointer;user-select:none;padding:8px 2px;font-weight:500;color:#4e5969}
.mf-src textarea{display:block;width:100%;box-sizing:border-box;min-height:180px;font:12px/1.55 ${MONO};color:#1f2329;border:1px solid #e5e6eb;border-radius:6px;padding:8px 10px;resize:vertical;tab-size:2;background:#fff}
.mf-row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
.mf-row button{font:13px ${STACK};padding:4px 14px;border:1px solid #d0d3d9;border-radius:6px;background:#fff;cursor:pointer}
#mf-go{background:#10a37f;border-color:#10a37f;color:#fff}
#mf-msg{font-size:12px;color:#8f959e}
.mf-tr{position:absolute;z-index:2;top:10px;right:10px;display:flex;gap:6px}.mf-tr .mf-b{position:static}
.mf-gen .mf-src{margin:30px 0 12px;border-color:#10a37f;background:#f3fbf8;padding:0 10px 8px}
.mf-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 2px;color:#0b7a5f}
.mf-hd button{font:12px ${STACK};padding:3px 10px;border:1px solid #d0d3d9;border-radius:6px;background:#fff;color:#4e5969;cursor:pointer}
.mf-gen .mf-src textarea{min-height:150px}
.mf-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:rgba(31,35,41,.92);color:#fff;padding:6px 14px;border-radius:8px;font-size:13px;z-index:9;pointer-events:none}
@media print{.mf-b,.mf-warn,.mf-src,.mf-toast{display:none!important}}`
  const boot = `(function(){var st=document.getElementById('mf-st');function go(){try{var A=${JSON.stringify(ENGINE_ALPHABET)},T=[],i,j,v,b,s=document.getElementById('mf-eng').textContent.replace(/\\s/g,''),o=new Array(s.length/5*4),p=0;for(i=0;i<85;i++)T[A.charCodeAt(i)]=i;for(i=0;i<s.length;i+=5){v=0;for(j=0;j<5;j++)v=v*85+T[s.charCodeAt(i+j)];for(j=3;j>=0;j--){b=v%256;v=(v-b)/256;o[p+j]=b>127?b-256:b}p+=4}o.length=${ENGINE_LEN};eval(LZMA.decompress(o))}catch(e){st.textContent='离线排版引擎加载失败：'+(e&&e.message||e)}}setTimeout(go,20)})();`
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mermaid</title>
<style>${css}</style></head><body>
<div class="mf${generic ? ' mf-gen' : ''}">
<button type="button" class="mf-b" id="mf-flip" hidden title="切换走向并离线重新排版">LR / TB</button>
${generic ? '<div class="mf-tr"><button type="button" class="mf-b" id="mf-edit" title="展开源码：粘贴 Mermaid 后重绘">编辑源码</button>' : ''}<button type="button" class="mf-b" id="mf-copy" title="复制 Mermaid 源码">Copy Mermaid</button>${generic ? '</div>' : ''}
${generic ? srcPanel(true) : ''}<div class="mf-out" id="mf-out"><div class="mf-st" id="mf-st">正在离线排版…</div></div>
<div class="mf-warn" id="mf-warn" hidden></div>
${generic ? '' : srcPanel(false)}</div>
<script type="text/plain" id="mermaid-source">${escScript(source)}</script>
<script type="application/json" id="mf-cfg">${jsonScript({ palette })}</script>
<script>${LZMA_DECODER}</script>
<script type="application/octet-stream" id="mf-eng">${ENGINE_B85}</script>
<script>${boot}</script>
</body></html>
`
}
