function setupDeviceTour(getProfile, previews) {
  const dialog = document.getElementById('deviceTour');
  const spotlight = dialog.querySelector('.device-tour-spotlight');
  const card = dialog.querySelector('.device-tour-card');
  const counter = document.getElementById('tourStep');
  const title = document.getElementById('tourTitle');
  const text = document.getElementById('tourText');
  const back = document.getElementById('tourBack');
  const next = document.getElementById('tourNext');
  const launchers = [...document.querySelectorAll('[data-tour-launch]')];
  const seen = new Set();
  let steps = [];
  let index = 0;
  let target;
  let frame = 0;
  let returnFocus;
  let scrollBefore;
  let scene;
  let leaveScene;

  function enterScene(name) {
    if (scene === name) return;
    leaveScene?.();
    scene = name;
    leaveScene = name && previews[name]();
  }

  function stepsFor(profile) {
    const strahd = profile === 'strahd';
    return [
      { selector: strahd ? '#rvTitle' : '.device-header h1', title: 'Welcome to PORTA-NAG',
        text: 'Use this briefing to learn where to track paths and check for updates. You can skip it anytime or replay it from the ? button.' },
      { selector: '#profileToggleBtn', title: 'Switch profiles',
        text: 'Switch to the profile named on the button. Each profile has its own objective feed and remembers which paths you track.' },
      ...(strahd ? [{ selector: '#rvMotion', title: 'Pause motion',
        text: 'Use this toggle to still the animated art and skip the glitch when switching profiles.' }] : []),
      { selector: '.status-strip', title: 'Check the feed status',
        text: 'Check when the feed last synced, whether an update is waiting, and how many paths you track.' },
      { selector: '#refreshBtn', title: 'Sync and acknowledge updates',
        text: 'Sync pulls the latest objectives. When new or changed objectives are highlighted, use Clear highlights (CLR) to acknowledge them.' },
      ...(strahd ? [
        { selector: '#rvOpenMap', title: 'Explore Barovia',
          text: 'Open the atlas here to plan a route or find your next lead.' },
        { scene: 'map', selector: '.rv-map-board', content: true, title: 'Find your bearings',
          text: 'Solid lines mark roads. Dashed lines mark trails. Select a named landmark to read about it and see which paths lead there.' },
        { scene: 'map', selector: '.rv-map-zoom', title: 'Zoom and pan',
          text: 'Zoom with +, −, or the mouse wheel. Once zoomed in, drag open ground to pan. With the map focused, arrow keys pan and + or − zooms. Fit brings all of Barovia back into view.' },
        { scene: 'map', selector: '.rv-map-tools label', title: 'Find a path',
          text: 'Use Path markers to show or hide the path icons. Follow an icon’s line to its landmark. Look under Across Barovia for paths that range across the region.' },
        { scene: 'map', selector: '.rv-map-details', content: true, title: 'Read a lead and track it',
          prepare() {
            const marker = document.querySelector('.rv-map-marker');
            const landmark = document.querySelector('.rv-map-landmark');
            const example = document.getElementById('rvMapMarkers').checked && marker || landmark;
            example?.dispatchEvent(new MouseEvent('click'));
          },
          text: 'Choose a path marker, or select a path from a landmark’s details. Read its description here. Track path adds its objectives to your feed. Untrack path removes them from view.' },
        { selector: '#rvOpenBomb', title: 'Inspect the arcane bomb',
          text: 'Open the schematic here to see which pieces the party has secured and which path supplies each one.' },
        { scene: 'bomb', selector: '.rv-bomb-board', content: true, title: 'Read the assembly status',
          text: 'Each label reports progress from its linked path. Check the casing and ignition for recovery, the payload for charge, the optional runewords for inscription, and the rolling cradle for a recruited wagoneer.' },
        { scene: 'bomb', selector: '.rv-bomb-callout[data-part="ignition"]', title: 'Trace a component',
          text: 'Hover over a part or its label to light up its lines. Select either to keep the part highlighted. The ignition is selected here.' },
        { scene: 'bomb', selector: '#rvBombDescription', content: true, title: 'Follow the component’s path',
          text: 'Read the selected component’s lead below the drawing. Select the path tile to track its objectives. Select it again to untrack them. The schematic stays open. When the required paths are complete, look on the map for the wagon’s route to Ravenloft.' }
      ] : []),
      { selector: strahd ? '#rvPathSlot' : '#pathList', content: true, title: 'Choose paths to track',
        text: 'Select a path in the registry to show its objectives. Select it again to untrack it. You can also reopen paths from the archive.' },
      ...(strahd ? [{ selector: '#rvRegistry .rv-compact-paths', title: 'Grid view',
        text: 'Turn on Grid view to show paths as larger icons in a three-column grid. Hover over an icon to identify the path, or select it to track its objectives. Turn Grid view off to see names, objective counts, and integrity again.' }] : []),
      { selector: strahd ? '#rvThreadSlot' : '#threadDisplay', content: true, title: 'Read your objectives',
        text: 'Track a path to show its checkpoints here. Use + and - to expand or collapse nested checkpoints. Completion, failure, and update badges show what changed.' },
      ...(strahd ? [
        { scene: 'register', selector: '#rvEntryMenu', content: true, title: 'Open the entry register',
          text: 'New entry starts a dated note. Select a saved title to reopen it. Sort by creation date or name to find an older lead. Delete asks you to confirm before removing an entry.' },
        { scene: 'editor', selector: '#rvEntryName', title: 'Name your field note',
          text: 'Give the entry a name you’ll recognize in the register. Write your notes below. The journal saves edits as you type in this browser.' },
        { scene: 'editor', selector: '.rv-editor', title: 'Format your notes',
          text: 'Select text to make it bold or italic, turn a line into a heading, or start a bulleted list. Expand note gives you more writing room. Entry register takes you back to the list.' },
        { scene: 'editor', selector: '#rvOpenJournalBackup', title: 'Keep a backup',
          text: 'The disk opens Journal backup. Clearing browser data can erase your notes, so keep an exported copy somewhere you can find it.' },
        { scene: 'backup', selector: '#rvExportJournal', title: 'Export your journal',
          text: 'Export journal downloads all entries together as a JSON file. Keep the file to restore these notes later or carry them to another browser.' },
        { scene: 'backup', selector: '#rvImportJournal', title: 'Review before restoring',
          text: 'Import backup checks the file and previews entry counts and up to five recent changes. Cancel keeps your current entries. Overwrite journal replaces them with the backup and cannot be undone.' }
      ] : [])
    ].filter(step => step.scene || document.querySelector(step.selector)?.getClientRects().length);
  }

  function contentHeight() {
    return Math.max(48, dialog.clientHeight - card.offsetHeight - 48);
  }

  function place() {
    if (!dialog.open || !target) return;
    const gap = 12;
    const width = dialog.clientWidth;
    const height = dialog.clientHeight;
    const rect = target.getBoundingClientRect();
    const left = Math.max(2, rect.left - 4);
    const top = Math.max(2, rect.top - 4);
    const right = Math.min(width - 2, rect.right + 4);
    const limit = steps[index].content ? top + contentHeight() : height;
    const bottom = Math.min(height - 2, rect.bottom + 4, limit);
    Object.assign(spotlight.style, {
      left: left + 'px', top: top + 'px',
      width: Math.max(0, right - left) + 'px', height: Math.max(0, bottom - top) + 'px'
    });
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    let x = Math.min(width - cardWidth - gap, Math.max(gap, (left + right - cardWidth) / 2));
    let y = Math.min(height - cardHeight - gap, Math.max(gap, (top + bottom - cardHeight) / 2));
    if (bottom + gap + cardHeight <= height - gap) y = bottom + gap;
    else if (top - gap - cardHeight >= gap) y = top - gap - cardHeight;
    else if (right + gap + cardWidth <= width - gap) x = right + gap;
    else if (left - gap - cardWidth >= gap) x = left - gap - cardWidth;
    else y = top > height - bottom ? gap : height - cardHeight - gap;
    card.style.left = x + 'px';
    card.style.top = y + 'px';
  }

  function queuePlacement() {
    if (!dialog.open || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      place();
    });
  }

  const sizes = new ResizeObserver(queuePlacement);

  function showStep() {
    const step = steps[index];
    enterScene(step.scene);
    step.prepare?.();
    target = document.querySelector(step.selector);
    if (!step.content && target.getBoundingClientRect().height > window.innerHeight * .58) {
      target = target.querySelector('.rv-panel-head, .panel-title') || target;
    }
    counter.textContent = 'FIELD BRIEFING / ' + (index + 1) + ' OF ' + steps.length;
    title.textContent = step.title;
    text.textContent = step.text;
    back.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? 'Finish' : 'Next';
    const rect = target.getBoundingClientRect();
    const cardRoom = card.offsetHeight + 24;
    const cramped = step.content && rect.top < cardRoom && window.innerHeight - rect.bottom < cardRoom;
    if (cramped || rect.top < 8 || rect.bottom > window.innerHeight - 8 || target.closest('.rv-map-dialog')) {
      const block = step.content && (cramped || rect.height > contentHeight()) ? 'start' : 'center';
      target.scrollIntoView({ block, inline: 'nearest', behavior: 'instant' });
    }
    sizes.disconnect();
    sizes.observe(target);
    sizes.observe(card);
    place();
  }

  function open(launcher) {
    if (dialog.open || document.querySelector('.profile-corruption')) return;
    const profile = getProfile();
    steps = stepsFor(profile);
    if (!steps.length) return;
    index = 0;
    returnFocus = launcher;
    scrollBefore = [window.scrollX, window.scrollY];
    dialog.dataset.profile = profile;
    dialog.showModal();
    showStep();
    next.focus({ preventScroll: true });
    seen.add(profile);
    try { localStorage.setItem('portaNAG.tour.seen.' + profile, 'true'); } catch {}
  }

  for (const launcher of launchers) launcher.addEventListener('click', () => open(launcher));
  document.getElementById('tourSkip').addEventListener('click', () => dialog.close());
  back.addEventListener('click', () => {
    index--;
    showStep();
    if (back.disabled) next.focus({ preventScroll: true });
  });
  next.addEventListener('click', () => {
    if (index === steps.length - 1) dialog.close();
    else {
      index++;
      showStep();
    }
  });
  dialog.addEventListener('close', () => {
    sizes.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    enterScene(undefined);
    window.scrollTo(...scrollBefore);
    returnFocus?.focus({ preventScroll: true });
  });
  window.addEventListener('resize', queuePlacement);
  window.addEventListener('scroll', queuePlacement, { capture: true, passive: true });
  return {
    offer() {
      const profile = getProfile();
      if (seen.has(profile)) return;
      try { if (localStorage.getItem('portaNAG.tour.seen.' + profile)) return; } catch {}
      open(launchers.find(launcher => launcher.getClientRects().length));
    }
  };
}
