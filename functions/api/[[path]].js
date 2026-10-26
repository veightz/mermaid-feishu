// Workers 里没有 window / global；elkjs（beautiful-mermaid 的布局引擎）需要其中之一当 $wnd。
// 放在单独模块里，保证它在 core.js（及 elkjs）初始化之前执行。
import './_global-shim.js'
// Pages Functions：/api/render、/api/themes、/api/health
// 只用 beautiful-mermaid（纯 TS、无 DOM），与网页共用 src/shared/core.js 的清理和 HTML 生成逻辑。
import {
  SITE_URL, MAX_SOURCE_BYTES, DEFAULT_THEME, THEMES, BM_TYPES,
  themeList, isBMSupported, diagramType, renderBM, cleanSvg, buildHtmlWidget, svgDims, byteLength,
  LAYOUTS, parseLayout, resolveLayout, elkPalette,
  parseDirection, applyDirection,
} from '../../src/shared/core.js'
import { isFlowchart, renderChatGPTFlowchart } from '../../src/shared/chatgpt.js'

const VERSION = '1.0.0'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

function json(status, obj, extra = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS, ...extra },
  })
}
const fail = (status, code, error, more = {}) => json(status, { ok: false, code, error, ...more })

async function readInput(request, url) {
  const q = url.searchParams
  let input = {
    code: q.get('code'), format: q.get('format'), theme: q.get('theme'),
    layout: q.get('layout') ?? undefined, direction: q.get('direction') ?? undefined,
  }
  if (request.method === 'POST') {
    const len = Number(request.headers.get('content-length') || 0)
    if (len > MAX_SOURCE_BYTES * 4) return { tooLarge: true }
    const text = await request.text()
    if (text.length > MAX_SOURCE_BYTES * 4) return { tooLarge: true }
    const ct = request.headers.get('content-type') || ''
    if (ct.includes('application/json') || /^\s*\{/.test(text)) {
      let body
      try { body = JSON.parse(text) } catch { return { badJson: true } }
      input = {
        code: body.code ?? input.code, format: body.format ?? input.format,
        theme: body.theme ?? input.theme, layout: body.layout ?? input.layout,
        direction: body.direction ?? input.direction,
      }
    } else {
      input.code = text // 纯文本 body 直接当 Mermaid 源码
    }
  }
  return { input }
}

async function handleRender(request, url) {
  const { input, tooLarge, badJson } = await readInput(request, url)
  if (tooLarge) return fail(413, 'too_large', `输入超过 ${MAX_SOURCE_BYTES / 1024}KB 上限 / Source exceeds ${MAX_SOURCE_BYTES / 1024}KB limit`)
  if (badJson) return fail(400, 'bad_json', '请求体不是合法 JSON / Request body is not valid JSON')
  let code = typeof input.code === 'string' ? input.code.replace(/^\s*```(?:mermaid)?\s*\n([\s\S]*?)\n?```\s*$/, '$1') : ''
  const format = String(input.format || 'svg').toLowerCase()
  const theme = input.theme || DEFAULT_THEME
  const asJson = ['1', 'true'].includes(url.searchParams.get('json') || '')

  if (!code.trim()) return fail(400, 'empty', '缺少 code（Mermaid 源码）/ Missing "code" (Mermaid source)')
  if (byteLength(code) > MAX_SOURCE_BYTES) return fail(413, 'too_large', `源码超过 ${MAX_SOURCE_BYTES / 1024}KB 上限 / Source exceeds ${MAX_SOURCE_BYTES / 1024}KB limit`, { bytes: byteLength(code) })
  if (format === 'png') return fail(501, 'png_not_supported', 'PNG 请在网页上生成', { web: SITE_URL })
  if (!['svg', 'html'].includes(format)) return fail(400, 'bad_format', `format 只能是 svg 或 html / format must be "svg" or "html"`)
  if (!THEMES[theme]) return fail(400, 'bad_theme', `未知主题 ${theme} / Unknown theme`, { themes: themeList().map((t) => t.id) })

  if (parseLayout(input.layout) === false) return fail(400, 'bad_layout', `layout 只能是 default、elk 或 auto（不填 = 跟随主题）/ layout must be "default", "elk" or "auto"`, { layouts: ['auto', ...LAYOUTS] })
  if (parseDirection(input.direction) === false) return fail(400, 'bad_direction', `direction 只能是 tb、lr、bt、rl 或 auto（不填 = 不改写源码）/ direction must be "tb", "lr", "bt", "rl" or "auto"`, { directions: ['auto', 'tb', 'lr', 'bt', 'rl'] })
  // direction：在布局前改写 flowchart/graph 头行的走向（LR↔TB 等）；非流程图忽略
  const dirApplied = applyDirection(code, input.direction)
  code = dirApplied.code
  // 布局与配色独立：不填 / auto 时跟随主题（chatgpt → elk，其他 → default）；ELK 只对 flowchart / graph 生效
  const layout = resolveLayout(theme, input.layout)
  const useCG = layout === 'elk' && isFlowchart(code)
  if (!useCG && !isBMSupported(code)) {
    const type = diagramType(code) || 'unknown'
    return fail(422, 'unsupported_diagram',
      `该图类型（${type}）API 暂不支持，请到网页 ${SITE_URL} 渲染（网页会自动回退官方 mermaid.js）。/ Diagram type "${type}" is not supported by the API; please render it on the website ${SITE_URL}.`,
      { type, supported: BM_TYPES, web: SITE_URL })
  }

  let svg, renderer = 'beautiful-mermaid', cgError = null
  try {
    if (useCG) {
      // ELK 布局流程图：与网页同一条管线（src/shared/chatgpt.js），配色按主题映射；失败时退回 beautiful-mermaid（与网页一致）
      try { svg = cleanSvg(await renderChatGPTFlowchart(code, elkPalette(theme)), THEMES[theme].bg); renderer = 'chatgpt-elk' } catch (e) { svg = null; cgError = String((e && e.message) || e).slice(0, 200) }
    }
    if (!svg) svg = cleanSvg(renderBM(code, theme), THEMES[theme].bg)
  } catch (e) {
    return fail(400, 'syntax_error', `Mermaid 语法错误 / Mermaid syntax error: ${(e && e.message) || e}`)
  }
  const { width, height } = svgDims(svg)
  const data = format === 'html' ? buildHtmlWidget(svg, THEMES[theme].bg) : svg
  const usedLayout = renderer === 'chatgpt-elk' ? 'elk' : 'default'
  const meta = {
    'X-Renderer': renderer, 'X-Theme': theme, 'X-Layout': usedLayout,
    ...(dirApplied.direction ? { 'X-Direction': dirApplied.direction } : {}),
    ...(dirApplied.rewritten ? { 'X-Direction-Rewritten': '1' } : {}),
    'X-Width': String(width), 'X-Height': String(height),
    ...(cgError ? { 'X-Fallback-Reason': encodeURIComponent(cgError) } : {}),
  }
  if (asJson) {
    return json(200, {
      ok: true, format, renderer, theme, layout: usedLayout,
      ...(dirApplied.direction ? { direction: dirApplied.direction } : {}),
      ...(dirApplied.rewritten ? { code: dirApplied.code } : {}),
      width, height, bytes: byteLength(data),
      ...(cgError ? { note: `ELK 布局失败，已改用 beautiful-mermaid：${cgError}` } : {}),
      data,
    }, meta)
  }
  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': format === 'html' ? 'text/html; charset=utf-8' : 'image/svg+xml; charset=utf-8',
      'Cache-Control': request.method === 'GET' ? 'public, max-age=300' : 'no-store',
      ...CORS, ...meta,
    },
  })
}

export async function onRequest({ request }) {
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const path = url.pathname.replace(/\/+$/, '')
  try {
    if (path === '/api/health') return json(200, { ok: true, service: 'mermaid-feishu', version: VERSION, renderer: 'beautiful-mermaid + chatgpt-elk', time: new Date().toISOString() })
    if (path === '/api/themes') {
      if (request.method !== 'GET') return fail(405, 'method_not_allowed', '只支持 GET / GET only')
      return json(200, {
        ok: true, default: DEFAULT_THEME, defaultLayout: 'elk',
        layouts: ['auto', ...LAYOUTS], directions: ['auto', 'tb', 'lr', 'bt', 'rl'],
        themes: themeList(),
      })
    }
    if (path === '/api/render') {
      if (!['GET', 'POST'].includes(request.method)) return fail(405, 'method_not_allowed', '只支持 GET / POST')
      return await handleRender(request, url)
    }
    return fail(404, 'not_found', `未知接口 / Unknown endpoint. 文档 / Docs: ${SITE_URL}/SKILL.md`)
  } catch (e) {
    return fail(500, 'internal', `服务内部错误 / Internal error: ${(e && e.message) || e}`)
  }
}
