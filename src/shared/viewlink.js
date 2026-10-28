// /view 查看链接：生成与解析（网页、/view、离线小组件、API 共用）。
// 生成：<base>/view?theme=&layout=&dir=#c=<lz-string compressToEncodedURIComponent(源码)>
// 解析（按顺序）：#c= / #m=（lz-string）、#pako:（mermaid.live，zlib deflate 的 JSON {code}）、#base64:（mermaid.live 旧版 JSON）、#src=（base64url UTF-8）
import LZ from 'lz-string'

export const VIEW_DEFAULTS = { theme: 'chatgpt', layout: 'elk', dir: 'TB' }
export const VIEW_URL_SOFT_LIMIT = 8000 // 超过就改走 #wait + postMessage
export const MAX_VIEW_SOURCE = 200 * 1024

export const compressCode = (code) => LZ.compressToEncodedURIComponent(String(code))

/** 生成 /view 链接。base 例如 https://mermaid-feishu.pages.dev/view；theme/layout 与默认相同时省略，dir 给了就带上 */
export function buildViewUrl(base, code, { theme, layout, dir } = {}) {
  const q = []
  if (theme && theme !== VIEW_DEFAULTS.theme) q.push('theme=' + encodeURIComponent(theme))
  if (layout && layout !== VIEW_DEFAULTS.layout) q.push('layout=' + encodeURIComponent(layout))
  if (dir) q.push('dir=' + encodeURIComponent(String(dir).toUpperCase() === 'TD' ? 'TB' : String(dir).toUpperCase()))
  return `${base}${q.length ? '?' + q.join('&') : ''}#c=${compressCode(code)}`
}
/** 编辑器链接：<origin>/#c=... */
export const buildEditorUrl = (origin, code) => `${origin}/#c=${compressCode(code)}`

const b64ToBytes = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const utf8 = (bytes) => new TextDecoder().decode(bytes)
async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('此浏览器不支持解压 #pako: 链接')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
const codeFromJson = (text) => {
  try { const j = JSON.parse(text); if (j && typeof j.code === 'string') return j.code } catch { /* 不是 JSON 就当源码 */ }
  return text
}

/**
 * 解析 location.hash。返回 { code, format } / { wait: true } / null；格式错误抛 Error（信息可直接展示）。
 */
export async function decodeViewHash(hash) {
  let h = String(hash || '').replace(/^#/, '')
  if (!h) return null
  if (h === 'wait' || h.startsWith('wait&')) return { wait: true }
  if (h.startsWith('pako:')) return { code: codeFromJson(utf8(await inflate(b64ToBytes(h.slice(5))))), format: 'pako' }
  if (h.startsWith('base64:')) return { code: codeFromJson(utf8(b64ToBytes(decodeURIComponent(h.slice(7))))), format: 'base64' }
  for (const part of h.split('&')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i), v = part.slice(i + 1)
    if (k === 'c' || k === 'm') {
      const code = LZ.decompressFromEncodedURIComponent(v)
      if (code == null || code === '') throw new Error(`#${k}= 链接内容无法解压（可能被截断）`)
      return { code, format: k }
    }
    if (k === 'src') return { code: utf8(b64ToBytes(decodeURIComponent(v))), format: 'src' }
  }
  return null
}

/** postMessage 载荷 → 源码字符串（{type:'mermaid', code} 或 {type:'mf-src', src}）；不合法返回 null */
export function sourceFromMessage(d) {
  if (!d || typeof d !== 'object') return null
  const s = d.type === 'mermaid' ? d.code : d.type === 'mf-src' ? d.src : null
  return typeof s === 'string' && s.trim() && s.length <= MAX_VIEW_SOURCE ? s : null
}
