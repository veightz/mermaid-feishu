// 渲染结果进 DOM 前的 SVG 消毒：源码可能来自外部链接/postMessage，这里兜底去掉一切可执行/外连内容。
// 用 <template> 解析（惰性文档，不执行脚本、不加载资源），再按黑名单清理：
// 危险元素整删；on* 事件属性删；href/xlink:href/src/action 等只留站内锚点 #id；
// style 属性/元素里的 url(非 #)、@import、expression、javascript: 删。
const BAD_EL = /^(script|iframe|object|embed|frame|frameset|link|meta|base|form|input|button|textarea|select|audio|video|source|track|img|image|use|animate|animatemotion|animatetransform|set|handler|listener|portal)$/i
const URL_ATTR = /^(href|xlink:href|src|srcset|action|formaction|data|poster|background|lowsrc|dynsrc|from|to|values|by|attributename)$/i
const BAD_CSS = /@import|expression\s*\(|javascript:|behavior\s*:|-moz-binding|url\s*\(\s*(?!['"]?#)[^)]*\)/gi
export function sanitizeSvg(markup) {
  const t = document.createElement('template')
  t.innerHTML = String(markup)
  const all = t.content.querySelectorAll('*')
  for (const el of all) {
    if (BAD_EL.test(el.localName)) {
      // <use href="#id"> 是站内引用，安全保留；其余一律删
      const h = el.getAttribute('href') || el.getAttribute('xlink:href')
      if (el.localName.toLowerCase() === 'use' && h && /^#[\w:.-]+$/.test(h)) { strip(el, true); continue }
      el.remove(); continue
    }
    strip(el, false)
    if (el.localName.toLowerCase() === 'style') el.textContent = el.textContent.replace(BAD_CSS, '')
  }
  return t.innerHTML
}
function strip(el, keepHref) {
  for (const a of [...el.attributes]) {
    const n = a.name.toLowerCase(), v = a.value
    if (n.startsWith('on')) el.removeAttribute(a.name)
    else if (URL_ATTR.test(n)) { if (!(keepHref || /^#[\w:.-]*$/.test(v.trim())) || /attributename/.test(n)) el.removeAttribute(a.name) }
    else if (n === 'style') el.setAttribute('style', v.replace(BAD_CSS, ''))
    else if (/javascript:|data:|vbscript:/i.test(v.replace(/[\s\u0000-\u001f]/g, '')) && n !== 'd' && n !== 'points') el.removeAttribute(a.name)
  }
}
