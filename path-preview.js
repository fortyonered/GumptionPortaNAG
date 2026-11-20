function setupPathPreview(createIcon) {
  const preview = document.createElement('aside');
  const title = document.createElement('h2');
  const text = document.createElement('div');
  preview.className = 'path-preview';
  preview.hidden = true;
  preview.setAttribute('aria-hidden', 'true');
  title.className = 'path-preview-title';
  text.className = 'path-preview-text';
  document.body.append(preview);

  let anchor = null;
  let closeTimer = 0;

  function clear() {
    clearTimeout(closeTimer);
    closeTimer = 0;
    anchor = null;
    preview.hidden = true;
    preview.replaceChildren();
  }

  function place() {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const gap = 10;

    if (!anchor.isConnected || rect.bottom <= 0 || rect.top >= viewportHeight) {
      clear();
      return;
    }

    const { offsetWidth: width, offsetHeight: height } = preview;
    const clamp = (value, limit) => Math.max(gap, Math.min(value, limit - gap));
    let left = clamp(rect.left, viewportWidth - width);
    let top = clamp(rect.top, viewportHeight - height);

    if (rect.right + width + 2 * gap <= viewportWidth) left = rect.right + gap;
    else if (rect.left >= width + 2 * gap) left = rect.left - width - gap;
    else if (rect.bottom + height + 2 * gap <= viewportHeight) top = rect.bottom + gap;
    else if (rect.top >= height + 2 * gap) top = rect.top - height - gap;
    else top = clamp(rect.bottom + gap, viewportHeight - height);

    preview.style.left = left + 'px';
    preview.style.top = top + 'px';
  }

  function show(card, path, copy) {
    clearTimeout(closeTimer);
    if (anchor === card) return;
    anchor = card;
    text.replaceChildren(copy.cloneNode(true));
    const icon = createIcon(path);
    if (document.body.classList.contains('theme-strahd')) {
      title.textContent = path.title;
      preview.replaceChildren(title, icon, text);
    } else {
      preview.replaceChildren(icon, text);
    }
    preview.hidden = false;
    place();
  }

  function scheduleClose(card) {
    clearTimeout(closeTimer);
    if (anchor !== card) return;
    closeTimer = setTimeout(() => {
      if (anchor === card && !card.matches(':hover, :focus-visible') && !preview.matches(':hover')) clear();
    }, 150);
  }

  preview.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  preview.addEventListener('pointerleave', () => {
    if (anchor) scheduleClose(anchor);
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, { capture: true, passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && anchor) clear();
  });

  return {
    bind(card, path) {
      if (typeof path.mouseover !== 'string' || !path.mouseover.trim()) return;
      const copy = cleanFormattedContent(path.mouseover.trim(), inlineFormattingTags);
      const plainCopy = copy.cloneNode(true);
      for (const lineBreak of plainCopy.querySelectorAll('br')) lineBreak.replaceWith(' ');
      card.removeAttribute('title');
      if (!card.hasAttribute('aria-label')) card.setAttribute('aria-label', path.title);
      card.setAttribute('aria-description', plainCopy.textContent.trim());
      card.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') show(card, path, copy);
      });
      card.addEventListener('pointerleave', () => scheduleClose(card));
      card.addEventListener('focus', () => {
        if (card.matches(':focus-visible')) show(card, path, copy);
      });
      card.addEventListener('blur', () => {
        if (anchor === card) scheduleClose(card);
      });
    },
    clear
  };
}
