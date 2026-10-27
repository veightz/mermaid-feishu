// Preview interaction only: the rendered SVG and Mermaid source remain unchanged.
export function createSvgViewport(container, resetButton) {
  const MIN_ZOOM = 0.25, MAX_ZOOM = 4, MAX_HEIGHT = 640
  const abort = new AbortController()
  const listen = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: abort.signal })
  let svg = null, baseWidth = 0, baseHeight = 0
  let zoom = 1, x = 0, y = 0, drag = null

  function paint() {
    if (!svg) return
    svg.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    resetButton.textContent = `${Math.round(zoom * 100)}% · 重置`
  }
  function reset() {
    endDrag()
    zoom = 1
    x = (container.clientWidth - baseWidth) / 2
    y = 16
    paint()
  }
  function fit() {
    if (!svg) return
    const box = svg.viewBox.baseVal
    const width = box.width || Number(svg.getAttribute('width'))
    const height = box.height || Number(svg.getAttribute('height'))
    if (!(width > 0 && height > 0 && container.clientWidth > 0)) return
    baseWidth = Math.min(width, container.clientWidth, 820)
    baseHeight = baseWidth * height / width
    container.style.height = `${Math.max(120, Math.min(baseHeight + 32, MAX_HEIGHT))}px`
    Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', width: `${baseWidth}px`, height: `${baseHeight}px`, maxWidth: 'none', margin: '0', transformOrigin: '0 0' })
    reset()
  }
  function setSvg(next) {
    endDrag()
    svg = next
    resetButton.hidden = !svg
    fit()
  }
  function endDrag() {
    if (!drag) return
    const id = drag.id
    drag = null
    container.classList.remove('mf-panning')
    if (container.hasPointerCapture(id)) container.releasePointerCapture(id)
  }

  listen(container, 'pointerdown', (event) => {
    if (!svg || event.pointerType !== 'mouse' || event.button !== 2 || drag) return
    event.preventDefault()
    drag = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y }
    try { container.setPointerCapture(event.pointerId) } catch { endDrag(); return }
    container.classList.add('mf-panning')
  })
  listen(container, 'pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return
    if (!(event.buttons & 2)) { endDrag(); return }
    x = drag.x + event.clientX - drag.clientX
    y = drag.y + event.clientY - drag.clientY
    paint()
  })
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(container, name, (event) => {
    if (drag?.id === event.pointerId) endDrag()
  })
  listen(window, 'blur', endDrag)
  listen(container, 'contextmenu', (event) => { if (svg) event.preventDefault() })
  listen(container, 'wheel', (event) => {
    if (!svg || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    endDrag()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1)
    const step = Math.max(-Math.log(1.1), Math.min(Math.log(1.1), -delta * 0.0015))
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * Math.exp(step)))
    const rect = container.getBoundingClientRect()
    const ax = event.clientX - rect.left - container.clientLeft
    const ay = event.clientY - rect.top - container.clientTop
    x = ax - (ax - x) * next / zoom
    y = ay - (ay - y) * next / zoom
    zoom = next
    paint()
  }, { passive: false })
  listen(resetButton, 'click', reset)
  listen(container, 'dblclick', (event) => {
    if (event.target.closest('svg text, svg foreignObject')) return
    reset()
  })
  // Refit only when the available width changes; setting the preview height also
  // notifies ResizeObserver and must not reset an in-progress drag or zoom.
  let lastWidth = container.clientWidth
  const observer = new ResizeObserver(() => {
    if (lastWidth === container.clientWidth) return
    lastWidth = container.clientWidth
    fit()
  })
  observer.observe(container)
  return { setSvg, reset, dispose() { endDrag(); observer.disconnect(); abort.abort() } }
}
