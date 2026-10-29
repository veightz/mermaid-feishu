import { createSvgViewport } from './offline/viewport.js'

// Serialized into static HTML exports; keep this function self-contained.
function initStaticWidget(createViewport) {
  const get = (id) => document.getElementById(id)
  const out = get('mf-out'), reset = get('mf-reset-view')
  const viewport = createViewport(out, reset, { zoomInButton: get('mf-zoom-in'), zoomOutButton: get('mf-zoom-out') })
  const flip = get('mf-flip'), edit = get('mf-edit'), panel = get('mf-src')
  function show() {
    const alternate = get('mf-d-b')?.checked
    if (flip) {
      const target = alternate ? flip.dataset.primaryDir : flip.dataset.secondaryDir
      flip.textContent = target === 'LR' || target === 'RL' ? '切换为横向' : '切换为纵向'
    }
    const panes = out.querySelectorAll('.mf-pane')
    panes.forEach((pane, index) => { pane.hidden = index !== (alternate ? 1 : 0) })
    viewport.setSvg(out.querySelector('.mf-pane:not([hidden]) svg'))
    if (panel) {
      const source = get(alternate ? 'mermaid-source-b' : 'mermaid-source-a') || get('mermaid-source')
      get('mf-source-text').textContent = source.textContent.replace(/<\\\/(script)/gi, '</$1')
    }
  }
  if (flip) flip.addEventListener('click', () => {
    get(get('mf-d-b').checked ? 'mf-d-a' : 'mf-d-b').checked = true
    show()
  })
  if (edit) edit.addEventListener('click', () => {
    panel.hidden = !panel.hidden
    edit.textContent = panel.hidden ? '查看源码' : '收起源码'
    edit.setAttribute('aria-expanded', String(!panel.hidden))
  })
  show()
}

export function staticWidgetControls() {
  return `<script>(${initStaticWidget.toString()})(${createSvgViewport.toString()});</script>`
}
