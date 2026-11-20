const arcaneBombParts = {
  casing: ['hell-s-bells', 'Recovered!', '// missing'],
  ignition: ['depth-charge', 'Recovered!', '// missing'],
  payload: ['so-many-demonic-pacts', 'Charged!', '// uncharged'],
  runewords: ['the-verse-to-curse', 'Inscribed!', '// missing'],
  cradle: ['delivery-service', 'Recruited!', '// missing']
};

function setupArcaneBomb(getPaths, isPathTracked, toggleTrackedPath, createPathIcon) {
  const dialog = document.getElementById('rvBomb');
  const launch = document.getElementById('rvOpenBomb');
  const parts = arcaneBombParts;
  const callouts = new Map(Array.from(dialog.querySelectorAll('.rv-bomb-callout'),
    (callout) => [callout.dataset.part, callout]));
  const statusAnnouncement = dialog.querySelector('.rv-bomb-status');
  const sections = new Map(Array.from(dialog.querySelectorAll('[data-bomb-section]'),
    (section) => [section.dataset.bombSection, section]));
  const details = dialog.querySelector('#rvBombDescription');
  const component = dialog.querySelector('#rvBombComponent');
  const pathButton = dialog.querySelector('#rvBombPath');
  const description = dialog.querySelector('#rvBombPathDescription');
  let selectedPart = null;
  let displayedPath;
  let displayedDescription;

  for (const [part, callout] of callouts) {
    const section = sections.get(part);
    const choose = () => {
      selectedPart = part;
      render();
    };
    callout.setAttribute('role', 'button');
    callout.setAttribute('tabindex', '0');
    callout.setAttribute('aria-controls', details.id);
    callout.addEventListener('click', choose);
    callout.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        choose();
      }
    });
    section.addEventListener('click', choose);
    for (const target of [section, callout]) {
      target.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch') return;
        section.setAttribute('data-hovered', '');
        callout.setAttribute('data-hovered', '');
      });
      target.addEventListener('pointerleave', () => {
        section.removeAttribute('data-hovered');
        callout.removeAttribute('data-hovered');
      });
    }
  }

  function render() {
    if (!dialog.open) return;
    const paths = getPaths();
    const componentStatuses = [];
    for (const [part, [pathId, ready, pending]] of Object.entries(parts)) {
      const path = paths?.find((entry) => entry.id === pathId);
      const failed = path?.failed === true;
      const active = path?.completed === true && !failed;
      const state = active ? 'active' : 'inactive';
      const status = active ? ready : failed ? 'Path failed' : paths ? pending : 'Awaiting feed';
      const callout = callouts.get(part);
      const section = sections.get(part);
      const selected = part === selectedPart;
      if (callout.dataset.state !== state) callout.dataset.state = state;
      if (section.dataset.state !== state) section.dataset.state = state;
      callout.setAttribute('aria-pressed', String(selected));
      section.toggleAttribute('data-selected', selected);
      const label = callout.querySelector('[data-bomb-status]');
      if (label.textContent !== status) label.textContent = status;
      const name = callout.querySelector('.rv-bomb-caption').textContent;
      componentStatuses.push(`${name}. ${status}.`);
      if (selected) {
        component.textContent = name;
        pathButton.hidden = !path;
        if (path && displayedPath !== path) {
          pathButton.replaceChildren(createPathIcon(path), document.createTextNode(path.title));
          pathButton.setAttribute('aria-label', `Track path: ${path.title}`);
        }
        displayedPath = path;
        pathButton.setAttribute('aria-pressed', String(!!path && isPathTracked(path.id)));
        const copy = typeof path?.mouseover === 'string' ? path.mouseover.trim() : '';
        const fallback = path ? 'No path description available.' : 'Linked path unavailable.';
        const displayKey = copy || fallback;
        if (displayedDescription !== displayKey) {
          description.replaceChildren(copy ? cleanFormattedContent(copy, inlineFormattingTags) : fallback);
          displayedDescription = displayKey;
        }
        details.hidden = false;
      }
    }
    const summary = componentStatuses.join(' ');
    if (statusAnnouncement.textContent !== summary) statusAnnouncement.textContent = summary;
  }

  launch.addEventListener('click', () => {
    dialog.returnValue = '';
    dialog.showModal();
    render();
  });
  document.getElementById('rvCloseBomb').addEventListener('click', () => dialog.close());
  pathButton.addEventListener('click', () => {
    if (displayedPath) toggleTrackedPath(displayedPath);
  });
  dialog.addEventListener('close', () => {
    for (const item of dialog.querySelectorAll('[data-hovered]')) item.removeAttribute('data-hovered');
    if (dialog.returnValue !== 'tour') launch.focus();
  });
  function preview() {
    const previousPart = selectedPart;
    selectedPart = 'ignition';
    dialog.show();
    render();
    return () => {
      dialog.close('tour');
      selectedPart = previousPart;
      details.hidden = !selectedPart;
    };
  }
  return { render, preview };
}
