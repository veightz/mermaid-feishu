// Preview interaction only: the rendered SVG and Mermaid source remain unchanged.
export function createSvgViewport(container, resetButton, { zoomInButton = null, zoomOutButton = null } = {}) {
  const MIN_ZOOM = 0.25, MAX_ZOOM = 4
  const abort = new AbortController()
  const listen = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: abort.signal })
  let svg = null, baseWidth = 0, baseHeight = 0
  let zoom = 1, x = 0, y = 0, drag = null, gesture = null

  function paint() {
    if (!svg) return
    svg.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    resetButton.textContent = `${Math.round(zoom * 100)}% · 重置`
    resetButton.title = '恢复到 100% 并居中'
    if (zoomInButton) zoomInButton.disabled = zoom >= MAX_ZOOM
    if (zoomOutButton) zoomOutButton.disabled = zoom <= MIN_ZOOM
  }
  function reset() {
    endDrag()
    gesture = null
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
    // Preserve the original width-fit size; tall diagrams need their full height.
    baseWidth = Math.min(width, container.clientWidth)
    baseHeight = baseWidth * height / width
    container.style.height = `${Math.max(120, baseHeight + 32)}px`
    Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', width: `${baseWidth}px`, height: `${baseHeight}px`, maxWidth: 'none', margin: '0', transformOrigin: '0 0' })
    reset()
  }
  function setSvg(next) {
    endDrag()
    svg = next
    resetButton.hidden = !svg
    for (const button of [zoomInButton, zoomOutButton]) {
      if (button) { button.hidden = !svg; button.disabled = !svg }
    }
    fit()
  }
  function endDrag() {
    if (!drag) return
    const id = drag.id
    drag = null
    container.classList.remove('mf-panning')
    if (container.hasPointerCapture(id)) container.releasePointerCapture(id)
  }
  function zoomAt(value, clientX, clientY) {
    if (!svg || !Number.isFinite(value) || value <= 0) return
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
    const rect = container.getBoundingClientRect()
    const ax = Number.isFinite(clientX) ? clientX - rect.left - container.clientLeft : container.clientWidth / 2
    const ay = Number.isFinite(clientY) ? clientY - rect.top - container.clientTop : container.clientHeight / 2
    x = ax - (ax - x) * next / zoom
    y = ay - (ay - y) * next / zoom
    zoom = next
    paint()
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
  listen(window, 'blur', () => { endDrag(); gesture = null })
  listen(container, 'contextmenu', (event) => { if (svg) event.preventDefault() })
  listen(container, 'wheel', (event) => {
    if (!svg || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    // Safari may also emit wheel events during its native pinch gesture.
    if (gesture) return
    endDrag()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1)
    const step = Math.max(-Math.log(1.35), Math.min(Math.log(1.35), -delta * 0.006))
    zoomAt(zoom * Math.exp(step), event.clientX, event.clientY)
  }, { passive: false })
  // Chromium trackpad pinch uses ctrl+wheel; Safari exposes GestureEvent.scale.
  listen(container, 'gesturestart', (event) => {
    if (!svg) return
    event.preventDefault()
    endDrag()
    gesture = { zoom }
  }, { passive: false })
  listen(container, 'gesturechange', (event) => {
    if (!gesture) return
    event.preventDefault()
    if (!(event.scale > 0)) return
    zoomAt(gesture.zoom * event.scale ** 2, event.clientX, event.clientY)
  }, { passive: false })
  listen(container, 'gestureend', (event) => {
    if (!gesture) return
    event.preventDefault()
    gesture = null
  }, { passive: false })
  function zoomBy(factor) {
    if (!svg || !Number.isFinite(factor) || factor <= 0) return
    endDrag()
    gesture = null
    zoomAt(zoom * factor)
  }
  // Explicit ownership lets shared HTML wrappers skip their legacy wheel adapter.
  for (const button of [zoomInButton, zoomOutButton]) {
    if (button) button.dataset.mfZoomOwner = 'viewport'
  }
  if (zoomInButton) listen(zoomInButton, 'click', () => zoomBy(1.25))
  if (zoomOutButton) listen(zoomOutButton, 'click', () => zoomBy(1 / 1.25))
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
  return { setSvg, reset, zoomBy, dispose() {
    endDrag(); observer.disconnect(); abort.abort()
    for (const button of [zoomInButton, zoomOutButton]) {
      if (button) delete button.dataset.mfZoomOwner
    }
  } }
}
