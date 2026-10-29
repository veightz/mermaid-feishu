(() => {
  const directionButton = document.getElementById('mf-flip');
  function nameDirection() {
    const raw = directionButton.textContent.trim();
    const label = raw === 'LR → TB' ? '切换为纵向' : raw === 'TB → LR' ? '切换为横向' : null;
    if (!label) return;
    directionButton.textContent = label;
    directionButton.title = label + '布局';
    directionButton.setAttribute('aria-label', label + '布局');
  }
  new MutationObserver(nameDirection).observe(directionButton, {childList: true, characterData: true, subtree: true});
  nameDirection();
  const configNode = document.getElementById('mf-cfg');
  const config = JSON.parse(configNode.textContent);
  const box = document.querySelector('.mf');
  const out = document.getElementById('mf-out');
  const toolbar = document.querySelector('.mf-tr');
  const notice = document.createElement('div');
  notice.id = 'mf-view-notice';
  notice.setAttribute('role', 'status');
  notice.style.cssText = 'font-size:13px;color:#646a73;padding:4px 0;overflow-wrap:anywhere';
  toolbar.parentElement.after(notice);
  const message = text => { notice.textContent = text; };
  const style = document.createElement('style');
  style.textContent = `.mf:fullscreen{background:#fff;overflow:auto;width:100%;height:100%;padding:16px 20px}.mf:fullscreen .mf-out,.mf-standalone .mf-out{height:var(--mf-view-height,70vh)!important}.mf-standalone{max-width:none;width:100%;padding:18px 24px}.mf-view-link{display:inline-block;text-decoration:none}.mf-view-head{font-size:19px;color:#1f2329;margin:0 0 12px;font-weight:600}`;
  document.head.append(style);
  const full = document.createElement('button');
  full.className = 'mf-b'; full.type = 'button'; full.id = 'mf-fullscreen';
  full.textContent = '全屏查看'; toolbar.prepend(full);
  let link;
  function currentSource() {
    return document.getElementById('mf-ta').value || document.getElementById('mermaid-source').textContent;
  }
  function viewerLink() {
    const bytes = new TextEncoder().encode(currentSource());
    if (bytes.length > 20000) return null;
    const url = new URL(config.viewerUrl);
    url.hash = 'src=' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return url.href;
  }
  function syncLink() {
    if (!link) return;
    const url = viewerLink();
    link.href = url || config.viewerUrl;
    link.title = url ? '带入当前源码快照，不回写文档' : '源码较长，请复制后在独立页面粘贴';
  }
  if (config.viewerUrl && !config.standalone) {
    link = document.createElement('a');
    link.className = 'mf-b mf-view-link'; link.id = 'mf-open-viewer';
    link.textContent = '独立查看'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    toolbar.prepend(link); syncLink();
    link.addEventListener('click', () => {
      syncLink();
      if (!viewerLink()) message('源码较长：请点击“复制 Mermaid”，在独立页面粘贴后重绘。');
    });
    document.getElementById('mf-ta').addEventListener('input', syncLink);
  }
  function fitHeight() {
    if (!config.standalone && !document.fullscreenElement) return;
    const top = out.getBoundingClientRect().top;
    box.style.setProperty('--mf-view-height', Math.max(160, innerHeight - top - 20) + 'px');
  }
  full.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled && box.requestFullscreen) await box.requestFullscreen();
      else { message(link ? '当前宿主不允许全屏，请点“独立查看”。' : '当前宿主不允许全屏，可使用浏览器窗口放大或图内缩放。'); return; }
    } catch (_) {
      message(link ? '全屏请求未获允许，请点“独立查看”。' : '全屏请求未获允许，请使用图内缩放。');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    full.textContent = document.fullscreenElement ? '退出全屏' : '全屏查看';
    fitHeight();
    document.getElementById('mf-reset-view').click();
  });
  addEventListener('resize', fitHeight);
  if (config.standalone) {
    box.classList.add('mf-standalone');
    const heading = document.createElement('h1');
    heading.className = 'mf-view-head'; heading.textContent = 'Mermaid 独立查看'; box.prepend(heading);
    config.embed = true; // Standalone source is a snapshot, never shared page-wide storage.
    configNode.textContent = JSON.stringify(config);
    try {
      const href = window.magic?.parentHref || location.href;
      const encoded = new URL(href).hash.match(/(?:^#|&)src=([^&]*)/);
      if (encoded) {
        if (encoded[1].length > 30000) throw Error('链接内容过长');
        const binary = atob(decodeURIComponent(encoded[1]).replace(/-/g, '+').replace(/_/g, '/'));
        const source = new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
        if (!source.trim()) throw Error('源码为空');
        document.getElementById('mermaid-source').textContent = source;
        message('已带入源码快照。这里的修改不会自动写回原文档，请复制后保存。');
      } else message('点击“编辑源码”粘贴 Mermaid 后重绘；这里的修改不会自动写回原文档。');
    } catch (_) { message('未能读取链接中的源码，请点击“编辑源码”手动粘贴。'); }
  }
  new ResizeObserver(fitHeight).observe(document.querySelector('.mf-toolbar'));
  new MutationObserver(fitHeight).observe(document.getElementById('mf-src'), {attributes:true, attributeFilter:['hidden']});
  requestAnimationFrame(fitHeight);
})();
