/* Strahd's workspace borrows the live feed nodes while its profile is active. */
function setupRavenloft(slots) {
  const root = document.getElementById('ravenloftTemplate').content.firstElementChild.cloneNode(true);
  const legacy = document.querySelector('.shell');
  const mounts = Object.entries(slots).flatMap(([id, elements]) => {
    const destination = root.querySelector('#' + id);
    return [elements].flat().map((element) => {
      const anchor = document.createComment('legacy mount');
      element.before(anchor);
      return { element, anchor, destination };
    });
  });

  const scene = root.querySelector('#rvScene');
  const motion = root.querySelector('#rvMotion');
  const motionKey = 'portaNAG.strahd.pauseMotion';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let initialized = false;
  let previewJournal;
  let setClouds = null;
  try { paused = localStorage.getItem(motionKey) === 'true'; } catch {}

  function resetParallax() {
    for (const depth of ['near', 'far']) {
      scene.style.removeProperty('--rv-' + depth + '-x');
      scene.style.removeProperty('--rv-' + depth + '-y');
    }
  }

  function useArt(image, name) {
    image.dataset.rvArt = name;
    const extension = paused || reduced.matches ? 'png' : 'gif';
    const source = 'art/strahd/' + name + '.' + extension;
    if (image.getAttribute('src') !== source) image.src = source;
  }

  function updateMotion() {
    root.classList.toggle('rv-still', paused);
    motion.setAttribute('aria-pressed', String(paused));
    if (paused || reduced.matches) resetParallax();
    root.querySelectorAll('[data-rv-art]').forEach((image) => useArt(image, image.dataset.rvArt));
    setClouds?.(!root.hidden, !paused && !reduced.matches);
  }

  motion.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem(motionKey, String(paused)); } catch {}
    updateMotion();
  });
  reduced.addEventListener('change', updateMotion);
  document.addEventListener('pointermove', (event) => {
    if (root.hidden || paused || reduced.matches || event.pointerType === 'touch') return;
    const x = Math.max(0, Math.min(1, event.clientX / window.innerWidth)) - 0.5;
    const y = Math.max(0, Math.min(1, event.clientY / window.innerHeight)) - 0.5;
    for (const [depth, factor] of [['near', 8], ['far', 3]]) {
      scene.style.setProperty('--rv-' + depth + '-x', (x * factor) + 'px');
      scene.style.setProperty('--rv-' + depth + '-y', (y * factor * 0.65) + 'px');
    }
  }, { capture: true, passive: true });
  document.documentElement.addEventListener('pointerleave', resetParallax);
  window.addEventListener('blur', resetParallax);

  legacy.after(root);

  return {
    show(active) {
      if (active && !initialized) {
        previewJournal = setupFieldJournal(root);
        setClouds = setupStrahdClouds(root.querySelector('.rv-clouds'));
        updateMotion();
        initialized = true;
      }

      if (root.hidden === !active) return;
      for (const { element, anchor, destination } of mounts) {
        if (active) destination.append(element);
        else anchor.after(element);
      }
      legacy.hidden = active;
      // The legacy .shell has an explicit display rule.
      legacy.style.display = active ? 'none' : '';
      root.hidden = !active;
      setClouds?.(active, !paused && !reduced.matches);
      if (!active) resetParallax();
    },

    motionPaused({ includeInactive = false } = {}) {
      return (includeInactive || !root.hidden) && (paused || reduced.matches);
    },
    useArt,
    previewJournal: (pane) => previewJournal(pane),

    empty(title, copy = '') {
      const box = document.createElement('div');
      box.className = 'empty-state';
      const glyph = document.createElement('img');
      glyph.className = 'rv-empty-glyph';
      glyph.alt = '';
      useArt(glyph, 'sigil');
      glyph.setAttribute('aria-hidden', 'true');
      const heading = document.createElement('strong');
      heading.className = 'rv-empty-title';
      heading.textContent = title;
      box.append(glyph, heading);
      if (copy) {
        const detail = document.createElement('span');
        detail.className = 'rv-empty-copy';
        detail.textContent = copy;
        box.append(detail);
      }
      return box;
    }
  };
}

function setupFieldJournal(root) {
  const legacyKey = 'portaNAG.strahd.fieldJournal';
  const entryPrefix = 'portaNAG.strahd.journal.entry.';
  const selectedKey = 'portaNAG.strahd.journal.selected';
  const sortKey = 'portaNAG.strahd.journal.sort';
  const legacyDeletedKey = 'portaNAG.strahd.journal.legacyDeleted';
  const generationKey = 'portaNAG.strahd.journal.generation';
  const backupFormat = 'portanag-field-journal';
  const menu = root.querySelector('#rvEntryMenu');
  const sort = root.querySelector('#rvEntrySort');
  const newEntry = root.querySelector('#rvNewEntry');
  const back = root.querySelector('#rvBackToNote');
  const openMenu = root.querySelector('#rvOpenEntryMenu');
  const confirmation = root.querySelector('#rvDeleteEntry');
  const cancelDelete = root.querySelector('#rvCancelDelete');
  const expand = root.querySelector('#rvExpandNote');
  const list = root.querySelector('#rvEntryList');
  const empty = root.querySelector('#rvJournalEmpty');
  const editor = root.querySelector('#rvEntryEditor');
  const title = root.querySelector('#rvEntryName');
  const created = root.querySelector('#rvEntryCreated');
  const note = root.querySelector('#rvNote');
  const saveStatus = root.querySelector('#rvSaveStatus');
  const backupToggle = root.querySelector('#rvOpenJournalBackup');
  const backupPane = root.querySelector('#rvJournalBackup');
  const backupBack = root.querySelector('#rvCloseJournalBackup');
  const backupActions = root.querySelector('#rvBackupActions');
  const exportButton = root.querySelector('#rvExportJournal');
  const importButton = root.querySelector('#rvImportJournal');
  const fileInput = root.querySelector('#rvJournalBackupFile');
  const restorePrompt = root.querySelector('#rvRestoreJournal');
  const restoreHeading = root.querySelector('#rvRestoreJournalTitle');
  const currentCount = root.querySelector('#rvCurrentEntryCount');
  const proposedCount = root.querySelector('#rvProposedEntryCount');
  const restoreChangesLabel = root.querySelector('#rvRestoreChangesLabel');
  const restoreChanges = root.querySelector('#rvRestoreChanges');
  const cancelRestore = root.querySelector('#rvCancelJournalRestore');
  const backupStatus = root.querySelector('#rvJournalBackupStatus');
  const formatButtons = [...root.querySelectorAll('[data-format]')];
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
  const entries = new Map();
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const commands = { bold: 'bold', italic: 'italic', list: 'insertUnorderedList', heading: 'formatBlock' };
  let activeEntry = null;
  let lastSelection = null;
  let pendingDeletion = null;
  let deleteTrigger = null;
  let generation = null;
  let pendingImport = null;
  let returnToEditor = false;

  function storedEntryPrefix(value = generation) {
    return value === null ? entryPrefix : `portaNAG.strahd.journal.restored.${value}.`;
  }

  function journalEntryKeys(prefix) {
    const keys = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }

  function setStatus(message) {
    if (saveStatus.textContent !== message) saveStatus.textContent = message;
  }

  function saveEntry(entry) {
    try {
      if (localStorage.getItem(generationKey) !== generation) throw new Error('Journal changed');
      localStorage.setItem(storedEntryPrefix() + entry.id, JSON.stringify(entry));
      setStatus('Saved locally');
    } catch {
      setStatus('Unable to save locally');
    }
  }

  function entryName(entry) {
    return entry.title.trim() || 'Untitled entry';
  }

  function dateLabel(entry, showLabel = false) {
    const date = entry.createdAt && new Date(entry.createdAt);
    const time = document.createElement(date && Number.isFinite(+date) ? 'time' : 'span');
    time.className = 'rv-entry-date';
    if (time.tagName === 'TIME') {
      time.dateTime = entry.createdAt;
      time.textContent = (showLabel ? 'Created ' : '') + dateFormat.format(date);
    } else {
      time.textContent = 'Creation date unavailable';
    }
    return time;
  }

  function compareDates(a, b, oldestFirst = false) {
    const first = a.createdAt ? Date.parse(a.createdAt) : NaN;
    const second = b.createdAt ? Date.parse(b.createdAt) : NaN;
    if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
    if (!Number.isFinite(second)) return -1;
    return oldestFirst ? first - second : second - first;
  }

  function orderedEntries() {
    return [...entries.values()].sort((a, b) => {
      const nameOrder = collator.compare(entryName(a), entryName(b));
      if (sort.value === 'name-asc' && nameOrder) return nameOrder;
      if (sort.value === 'name-desc' && nameOrder) return -nameOrder;
      return compareDates(a, b, sort.value === 'oldest') || nameOrder || a.id.localeCompare(b.id);
    });
  }

  function renderEntries() {
    list.replaceChildren();
    empty.hidden = entries.size > 0;
    sort.disabled = entries.size < 2;
    back.hidden = !activeEntry;

    for (const entry of orderedEntries()) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const name = document.createElement('strong');
      const remove = document.createElement('button');
      button.type = remove.type = 'button';
      button.className = 'rv-entry-option';
      button.setAttribute('aria-pressed', String(activeEntry === entry));
      name.textContent = entryName(entry);
      button.append(name, dateLabel(entry));
      button.addEventListener('click', () => {
        openEntry(entry);
        openMenu.focus();
      });

      remove.className = 'rv-button rv-entry-delete';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', 'Delete ' + entryName(entry));
      remove.addEventListener('click', () => {
        pendingDeletion = entry;
        deleteTrigger = remove;
        root.querySelector('#rvDeletePrompt').textContent = `Delete “${entryName(entry)}”?`;
        confirmation.hidden = false;
        cancelDelete.focus();
      });

      item.append(button, remove);
      list.append(item);
    }
  }

  function dismissDelete() {
    confirmation.hidden = true;
    pendingDeletion = null;
    deleteTrigger = null;
  }

  function showMenu() {
    dismissDelete();
    editor.hidden = true;
    menu.hidden = false;
    renderEntries();
  }

  function updatePlaceholder() {
    note.toggleAttribute('data-empty', !note.textContent && !note.querySelector('li'));
  }

  function updateFormatButtons() {
    for (const button of formatButtons) {
      const command = commands[button.dataset.format];
      const pressed = lastSelection && (command === 'formatBlock'
        ? /^h[3-5]$/i.test(document.queryCommandValue(command))
        : document.queryCommandState(command));
      button.setAttribute('aria-pressed', String(!!pressed));
    }
  }

  function openEntry(entry) {
    dismissDelete();
    menu.hidden = true;
    editor.hidden = false;
    if (activeEntry === entry) return;

    activeEntry = entry;
    lastSelection = null;
    title.value = entry.title;
    created.replaceChildren(dateLabel(entry, true));
    note.replaceChildren(cleanJournalContent(entry.html));
    updatePlaceholder();
    updateFormatButtons();
    try { localStorage.setItem(selectedKey, entry.id); } catch {}
  }

  function loadEntries() {
    entries.clear();
    try {
      generation = localStorage.getItem(generationKey);
      const prefix = storedEntryPrefix();
      for (const key of journalEntryKeys(prefix)) {
        try {
          const entry = JSON.parse(localStorage.getItem(key));
          if (entry && typeof entry.title === 'string' && typeof entry.html === 'string') {
            entries.set(key.slice(prefix.length), { ...entry, id: key.slice(prefix.length) });
          }
        } catch {
          setStatus('Some entries could not be loaded');
        }
      }
      const legacy = generation === null && localStorage.getItem(legacyKey);
      if (legacy && legacy.trim() && !localStorage.getItem(legacyDeletedKey) && !entries.has('legacy')) {
        const content = document.createElement('div');
        renderJournalMarkdown(content, legacy);
        const entry = { id: 'legacy', title: 'Previous field journal', createdAt: null, html: content.innerHTML };
        entries.set(entry.id, entry);
        saveEntry(entry);
      }
      const savedSort = localStorage.getItem(sortKey);
      if ([...sort.options].some((option) => option.value === savedSort)) sort.value = savedSort;
      return localStorage.getItem(selectedKey);
    } catch {
      setStatus('Local saving unavailable');
      return null;
    }
  }

  function showJournal(preferEditor) {
    backupPane.hidden = true;
    backupToggle.setAttribute('aria-expanded', 'false');
    if (preferEditor && activeEntry) openEntry(activeEntry);
    else showMenu();
  }

  const initialEntry = entries.get(loadEntries());
  if (initialEntry) openEntry(initialEntry);
  else showMenu();

  function setBackupStatus(message, error = false) {
    backupStatus.toggleAttribute('data-error', error);
    backupStatus.textContent = message;
  }

  function resetRestore() {
    pendingImport = null;
    fileInput.value = '';
    importButton.disabled = false;
    restorePrompt.hidden = true;
    restoreChanges.replaceChildren();
    backupActions.hidden = false;
  }

  function closeBackup() {
    resetRestore();
    showJournal(returnToEditor);
    backupToggle.focus();
  }

  backupToggle.addEventListener('click', () => {
    if (!backupPane.hidden) {
      closeBackup();
      return;
    }
    returnToEditor = !editor.hidden;
    dismissDelete();
    editor.hidden = menu.hidden = true;
    backupPane.hidden = false;
    backupToggle.setAttribute('aria-expanded', 'true');
    setBackupStatus('');
    backupBack.focus();
  });
  backupBack.addEventListener('click', closeBackup);

  function cleanJournalHTML(html) {
    const holder = document.createElement('div');
    holder.append(cleanJournalContent(html));
    return holder.innerHTML;
  }

  function isWellFormedString(value) {
    return typeof value === 'string' && !/[\uD800-\uDFFF]/u.test(value);
  }

  function validateBackup(source) {
    const backup = JSON.parse(source);
    if (backup?.format !== backupFormat || backup.version !== 1 || !Array.isArray(backup.entries)) {
      throw new Error('Invalid journal backup');
    }
    const restored = new Map();
    for (const entry of backup.entries) {
      if (!entry || !isWellFormedString(entry.id) || !entry.id || restored.has(entry.id) ||
          !isWellFormedString(entry.title) || !isWellFormedString(entry.html) ||
          (entry.createdAt !== null && (!isWellFormedString(entry.createdAt) || !Number.isFinite(Date.parse(entry.createdAt))))) {
        throw new Error('Invalid journal entry');
      }
      const { id, title, createdAt, html } = entry;
      restored.set(id, { id, title, createdAt, html: cleanJournalHTML(html) });
    }
    return restored;
  }

  function renderEntryVersion(label, entry) {
    const version = document.createElement('div');
    version.className = 'rv-restore-entry-version';
    const heading = document.createElement('strong');
    heading.textContent = label + ' – ' + entryName(entry);
    const body = document.createElement('div');
    body.className = 'rv-restore-entry-body';
    body.append(cleanJournalContent(entry.html));
    if (!body.textContent.trim()) body.textContent = 'Empty note';
    version.append(heading, dateLabel(entry, true), body);
    return version;
  }

  function renderRestorePreview(restored) {
    currentCount.textContent = entries.size.toLocaleString();
    proposedCount.textContent = restored.size.toLocaleString();
    const changes = [];
    for (const id of new Set([...entries.keys(), ...restored.keys()])) {
      const before = entries.get(id);
      const after = restored.get(id);
      if (before && after && before.title === after.title &&
          (before.createdAt ?? null) === after.createdAt &&
          (before.html === after.html || cleanJournalHTML(before.html) === after.html)) continue;
      changes.push({ before, after, entry: after || before });
    }

    changes.sort((a, b) => compareDates(a.entry, b.entry) || a.entry.id.localeCompare(b.entry.id));
    restoreChangesLabel.textContent = changes.length
      ? `Showing ${Math.min(changes.length, 5)} of ${changes.length} changed entries, newest first.`
      : 'No entry changes found.';
    restoreChanges.hidden = changes.length === 0;
    for (const { before, after, entry } of changes.slice(0, 5)) {
      const item = document.createElement('li');
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      const changeType = document.createElement('span');
      changeType.className = 'rv-restore-change-type';
      changeType.textContent = !before ? 'Added' : !after ? 'Removed' : 'Edited';
      summary.append(changeType, entryName(entry), dateLabel(entry));
      details.append(summary);
      if (before) details.append(renderEntryVersion('Current', before));
      if (after) details.append(renderEntryVersion('Backup', after));
      item.append(details);
      restoreChanges.append(item);
    }
  }

  exportButton.addEventListener('click', () => {
    const backup = {
      format: backupFormat,
      version: 1,
      entries: [...entries.values()].map(({ id, title, createdAt, html }) => ({
        id, title, createdAt: typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)) ? createdAt : null, html
      }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `field-journal-${new Date().toISOString().slice(0, 10)}.json`;
    backupPane.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupStatus('Backup exported.');
  });

  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    importButton.disabled = true;
    setBackupStatus('Checking backup...');
    try {
      const bytes = await file.arrayBuffer();
      if (fileInput.files[0] !== file) return;
      pendingImport = validateBackup(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      renderRestorePreview(pendingImport);
    } catch {
      if (fileInput.files[0] !== file) return;
      resetRestore();
      setBackupStatus('This file is not a valid field journal backup.', true);
      importButton.focus();
      return;
    }
    setBackupStatus('');
    backupActions.hidden = true;
    restorePrompt.hidden = false;
    restoreHeading.focus();
  });

  cancelRestore.addEventListener('click', () => {
    resetRestore();
    importButton.focus();
  });

  function replaceStoredEntries(restored) {
    const previousPrefix = storedEntryPrefix();
    const nextGeneration = crypto.getRandomValues(new Uint32Array(3)).join('-');
    const nextPrefix = storedEntryPrefix(nextGeneration);
    const stagedKeys = [];
    try {
      // Publish the new set with one write after every entry has been staged.
      for (const entry of restored.values()) {
        const key = nextPrefix + entry.id;
        localStorage.setItem(key, JSON.stringify(entry));
        stagedKeys.push(key);
      }
      if (localStorage.getItem(generationKey) !== generation) throw new Error('Journal changed');
      localStorage.setItem(generationKey, nextGeneration);
    } catch {
      for (const key of stagedKeys) {
        try { localStorage.removeItem(key); } catch {}
      }
      return false;
    }

    generation = nextGeneration;
    try {
      for (const key of journalEntryKeys(previousPrefix)) localStorage.removeItem(key);
    } catch {}
    return true;
  }

  function refreshJournal(selectedId) {
    activeEntry = null;
    lastSelection = null;
    const selected = entries.get(selectedId);
    if (selected) {
      openEntry(selected);
    } else {
      title.value = '';
      created.replaceChildren();
      note.replaceChildren();
    }

    if (backupPane.hidden) showJournal(returnToEditor);
    else editor.hidden = menu.hidden = true;
    if (!selected) returnToEditor = false;
  }

  root.querySelector('#rvConfirmJournalRestore').addEventListener('click', () => {
    const restored = pendingImport;
    if (!restored) return;
    resetRestore();
    if (!replaceStoredEntries(restored)) {
      setBackupStatus('Could not restore the backup. Your journal was kept.', true);
      importButton.focus();
      return;
    }

    const selectedId = activeEntry?.id;
    entries.clear();
    for (const [id, entry] of restored) entries.set(id, entry);
    refreshJournal(selectedId);
    setStatus('Journal restored');
    setBackupStatus('Journal restored.');
    backupBack.focus();
  });

  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage || event.key !== generationKey || event.newValue === generation) return;
    if (backupPane.hidden) returnToEditor = !editor.hidden;
    const restoreWasPending = !restorePrompt.hidden || importButton.disabled;
    resetRestore();
    refreshJournal(loadEntries());
    setStatus('Journal updated in another tab');
    if (!backupPane.hidden) {
      setBackupStatus('Journal updated in another tab.');
      if (restoreWasPending) importButton.focus();
    }
  });

  newEntry.addEventListener('click', () => {
    const id = crypto.getRandomValues(new Uint32Array(3)).join('-');
    const entry = { id, title: '', createdAt: new Date().toISOString(), html: '' };
    entries.set(id, entry);
    saveEntry(entry);
    openEntry(entry);
    title.focus();
  });

  openMenu.addEventListener('click', () => {
    showMenu();
    (list.querySelector('[aria-pressed="true"]') || newEntry).focus();
  });
  back.addEventListener('click', () => {
    openEntry(activeEntry);
    openMenu.focus();
  });

  sort.addEventListener('change', () => {
    dismissDelete();
    renderEntries();
    try { localStorage.setItem(sortKey, sort.value); } catch {}
  });

  cancelDelete.addEventListener('click', () => {
    deleteTrigger?.focus();
    dismissDelete();
  });
  root.querySelector('#rvConfirmDelete').addEventListener('click', () => {
    const entry = pendingDeletion;
    if (!entry) return;
    try {
      if (localStorage.getItem(generationKey) !== generation) throw new Error('Journal changed');
      if (entry.id === 'legacy' && generation === null) localStorage.setItem(legacyDeletedKey, 'true');
      localStorage.removeItem(storedEntryPrefix() + entry.id);
    } catch {
      setStatus('Unable to delete this entry');
      return;
    }
    entries.delete(entry.id);
    if (activeEntry === entry) {
      activeEntry = null;
      lastSelection = null;
      title.value = '';
      note.replaceChildren();
      try { localStorage.removeItem(selectedKey); } catch {}
    }
    dismissDelete();
    renderEntries();
    newEntry.focus();
    setStatus('Entry deleted');
  });

  expand.addEventListener('click', () => {
    note.style.removeProperty('height');
    const expanded = note.classList.toggle('rv-note-expanded');
    expand.setAttribute('aria-pressed', String(expanded));
    expand.textContent = expanded ? 'Shrink note' : 'Expand note';
  });

  title.addEventListener('input', () => {
    activeEntry.title = title.value;
    saveEntry(activeEntry);
  });

  function saveBody() {
    activeEntry.html = cleanJournalHTML(note.innerHTML);
    updatePlaceholder();
    saveEntry(activeEntry);
  }

  function rememberSelection() {
    const selection = document.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!note.contains(range.commonAncestorContainer)) return;
    lastSelection = range.cloneRange();
    updateFormatButtons();
  }

  document.addEventListener('selectionchange', rememberSelection);
  note.addEventListener('input', () => {
    saveBody();
    rememberSelection();
  });

  // The browser's editing commands keep formatting in the native undo history.
  function format(kind) {
    const range = lastSelection;
    note.focus();
    const selection = document.getSelection();
    if (range && note.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const command = commands[kind];
    const block = /^h[3-5]$/i.test(document.queryCommandValue('formatBlock')) ? 'p' : 'h3';
    document.execCommand(command, false, command === 'formatBlock' ? block : null);
    rememberSelection();
  }

  for (const button of formatButtons) {
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => format(button.dataset.format));
  }
  note.addEventListener('keydown', (event) => {
    const shortcut = { b: 'bold', i: 'italic' }[event.key.toLowerCase()];
    if ((event.ctrlKey || event.metaKey) && !event.altKey && shortcut) {
      event.preventDefault();
      rememberSelection();
      format(shortcut);
    }
  });
  note.addEventListener('paste', (event) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  });
  note.addEventListener('drop', (event) => event.preventDefault());

  return (pane) => {
    if (pane === 'register' && menu.hidden) renderEntries();
    const journal = root.querySelector('#rvJournal');
    journal.dataset.tourPane = pane;
    return () => { delete journal.dataset.tourPane; };
  };
}

const journalFormattingTags = new Set(['BR', 'DIV', 'P', 'H3', 'H4', 'H5', 'B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI']);
const inlineFormattingTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR']);

function cleanJournalContent(html) {
  return cleanFormattedContent(html, journalFormattingTags);
}

function cleanFormattedContent(html, tags) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const discarded = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);
  const content = document.createDocumentFragment();

  function copyChildren(source, destination) {
    for (const child of source.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        destination.append(child.textContent);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.namespaceURI === 'http://www.w3.org/1999/xhtml' && !discarded.has(child.tagName)) {
        if (child.tagName === 'BR' && tags === inlineFormattingTags) {
          const spacer = document.createElement('span');
          spacer.className = 'flavor-text-break';
          spacer.setAttribute('aria-hidden', 'true');
          destination.append(spacer);
        }
        const target = tags.has(child.tagName) ? document.createElement(child.tagName.toLowerCase()) : destination;
        copyChildren(child, target);
        if (target !== destination) destination.append(target);
      }
    }
  }

  copyChildren(template.content, content);
  return content;
}

function renderJournalMarkdown(target, source) {
  target.replaceChildren();
  let list = null;
  let paragraph = null;

  // Construct nodes from the small formatting subset. Pasted HTML stays text.
  function appendInline(parent, text) {
    const pattern = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*)/g;
    let end = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(text.slice(end, match.index));
      const styled = document.createElement(match[2] ? 'strong' : 'em');
      styled.textContent = match[2] || match[3];
      parent.append(styled);
      end = match.index + match[0].length;
    }
    parent.append(text.slice(end));
  }

  for (const line of source.split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (!bullet) list = null;
    if (!line.trim() || heading || bullet) paragraph = null;

    if (heading) {
      const element = document.createElement('h' + (heading[1].length + 2));
      appendInline(element, heading[2]);
      target.append(element);
    } else if (bullet) {
      if (!list) {
        list = document.createElement('ul');
        target.append(list);
      }
      const item = document.createElement('li');
      appendInline(item, bullet[1]);
      list.append(item);
    } else if (line.trim()) {
      if (paragraph) paragraph.append(document.createElement('br'));
      else {
        paragraph = document.createElement('p');
        target.append(paragraph);
      }
      appendInline(paragraph, line);
    }
  }
}
