const DATA_URL = 'objectives.json';
const STORAGE_KEYS = {
  trackedPaths: 'portaNAG.trackedPaths',
  collapsedNodes: 'portaNAG.collapsedNodes',
  activeTab: 'portaNAG.activeTab'
};

const state = {
  data: null,
  trackedPaths: new Set(loadJSON(STORAGE_KEYS.trackedPaths, [])),
  collapsedNodes: new Set(loadJSON(STORAGE_KEYS.collapsedNodes, [])),
  activeTab: loadJSON(STORAGE_KEYS.activeTab, 'registry'),
  logLines: []
};

const elements = {
  tabs: [...document.querySelectorAll('.tab')],
  panes: [...document.querySelectorAll('.pane')],
  pathList: document.getElementById('pathList'),
  threadDisplay: document.getElementById('threadDisplay'),
  signalLog: document.getElementById('signalLog'),
  refreshBtn: document.getElementById('refreshBtn'),
  activePathCount: document.getElementById('activePathCount'),
  lastRefresh: document.getElementById('lastRefresh'),
  syncStatus: document.getElementById('syncStatus'),
  threadLock: document.getElementById('threadLock'),
  objectiveNodeTemplate: document.getElementById('objectiveNodeTemplate')
};

boot();

function boot() {
  wireTabs();
  applyActiveTab(state.activeTab);
  elements.refreshBtn.addEventListener('click', () => refreshData(true));
  refreshData(false);
}

function wireTabs() {
  elements.tabs.forEach((button) => {
    button.addEventListener('click', () => applyActiveTab(button.dataset.tab));
  });
}

function applyActiveTab(tabName) {
  state.activeTab = tabName;
  persistJSON(STORAGE_KEYS.activeTab, tabName);

  elements.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabName));
  elements.panes.forEach((pane) => pane.classList.toggle('active', pane.dataset.pane === tabName));
}

async function refreshData(manual = false) {
  setRefreshBusy(true);
  pushLog(manual ? 'Manual resync initiated.' : 'Establishing initial narrative link.');
  elements.syncStatus.textContent = 'PULLING FEED';

  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Feed returned ${response.status}`);
    }

    const data = await response.json();
    validateData(data);
    state.data = data;
    reconcileTrackedPaths();
    renderAll();
    elements.syncStatus.textContent = 'LINKED';
    elements.threadLock.textContent = data.systemStatus?.threadLock ?? 'STABLE';
    elements.lastRefresh.textContent = new Date().toLocaleTimeString();
    pushLog(`Objective feed synchronized from ${DATA_URL}.`);
  } catch (error) {
    console.error(error);
    elements.syncStatus.textContent = 'LINK FAULT';
    pushLog(`Sync fault: ${error.message}`, 'error');
    if (!state.data) {
      elements.pathList.innerHTML = '<div class="empty-state">NO OBJECTIVE FEED AVAILABLE</div>';
      elements.threadDisplay.innerHTML = '<div class="empty-state">UNABLE TO PROJECT THREADS</div>';
    }
  } finally {
    updateHeaderCounts();
    setRefreshBusy(false);
  }
}

function validateData(data) {
  if (!data || typeof data !== 'object') throw new Error('Malformed objective feed.');
  if (!Array.isArray(data.paths)) throw new Error('Feed is missing a paths array.');
}

function reconcileTrackedPaths() {
  const validIds = new Set(state.data.paths.map((path) => path.id));
  state.trackedPaths = new Set([...state.trackedPaths].filter((id) => validIds.has(id)));
  persistJSON(STORAGE_KEYS.trackedPaths, [...state.trackedPaths]);
}

function renderAll() {
  renderPathList();
  renderThreads();
  renderSignalLog();
  updateHeaderCounts();
}

function renderPathList() {
  elements.pathList.innerHTML = '';

  state.data.paths.forEach((path) => {
    const card = document.createElement('div');
    card.className = 'path-card';
    if (state.trackedPaths.has(path.id)) {
      card.classList.add('selected');
    }

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.trackedPaths.has(path.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.trackedPaths.add(path.id);
        pushLog(`Tracking path engaged: ${path.title}.`, 'warn');
      } else {
        state.trackedPaths.delete(path.id);
        pushLog(`Tracking path disengaged: ${path.title}.`);
      }
      persistJSON(STORAGE_KEYS.trackedPaths, [...state.trackedPaths]);
      renderAll();
    });

    const textWrap = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'path-name';
    name.textContent = path.title;

    const meta = document.createElement('div');
    meta.className = 'path-meta';
    meta.textContent = buildPathMeta(path);

    textWrap.append(name, meta);
    label.append(checkbox, textWrap);
    card.append(label);
    elements.pathList.append(card);
  });
}

function renderThreads() {
  elements.threadDisplay.innerHTML = '';

  const activePaths = state.data.paths.filter((path) => state.trackedPaths.has(path.id));
  if (!activePaths.length) {
    elements.threadDisplay.innerHTML = '<div class="empty-state">NO ACTIVE PATHS SELECTED // USE PATH REGISTRY TO PROJECT OBJECTIVES</div>';
    return;
  }

  activePaths.forEach((path) => {
    const card = document.createElement('section');
    card.className = 'thread-card';

    const header = document.createElement('div');
    header.className = 'thread-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'thread-title';
    title.textContent = path.title;

    const summary = document.createElement('div');
    summary.className = 'thread-summary';
    const counts = summarizePath(path.objectives);
    summary.textContent = `${counts.complete}/${counts.total} SIGNALS RESOLVED`;

    titleWrap.append(title, summary);
    header.append(titleWrap);

    const body = document.createElement('div');
    body.className = 'thread-body';
    path.objectives.forEach((objective, index) => {
      body.append(renderObjectiveNode(objective, `${path.id}.${index}`));
    });

    card.append(header, body);
    elements.threadDisplay.append(card);
  });
}

function renderObjectiveNode(node, nodeId) {
  const fragment = elements.objectiveNodeTemplate.content.firstElementChild.cloneNode(true);
  const row = fragment.querySelector('.objective-row');
  const toggle = fragment.querySelector('.collapse-toggle');
  const checkbox = fragment.querySelector('.checkbox');
  const text = fragment.querySelector('.objective-text');
  const flags = fragment.querySelector('.objective-flags');
  const childrenWrap = fragment.querySelector('.objective-children');

  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isCollapsed = state.collapsedNodes.has(nodeId);

  if (!hasChildren) {
    toggle.classList.add('no-children');
    toggle.textContent = '+';
    toggle.tabIndex = -1;
  } else {
    toggle.textContent = isCollapsed ? '+' : '–';
    toggle.addEventListener('click', () => {
      if (state.collapsedNodes.has(nodeId)) {
        state.collapsedNodes.delete(nodeId);
      } else {
        state.collapsedNodes.add(nodeId);
      }
      persistJSON(STORAGE_KEYS.collapsedNodes, [...state.collapsedNodes]);
      renderThreads();
    });
  }

  checkbox.classList.toggle('complete', !!node.complete);
  text.textContent = node.text;
  text.classList.toggle('complete', !!node.complete);
  text.classList.toggle('unknown', !!node.unknown);

  if (Array.isArray(node.flags) && node.flags.length) {
    flags.textContent = node.flags.join(' ');
  }

  if (isCollapsed && hasChildren) {
    fragment.classList.add('collapsed');
  }

  if (hasChildren) {
    node.children.forEach((child, index) => {
      childrenWrap.append(renderObjectiveNode(child, `${nodeId}.${index}`));
    });
  }

  row.dataset.nodeId = nodeId;
  return fragment;
}

function renderSignalLog() {
  elements.signalLog.innerHTML = '';
  state.logLines.slice(0, 16).forEach((entry) => {
    const line = document.createElement('div');
    line.className = `signal-line${entry.level ? ` ${entry.level}` : ''}`;
    line.textContent = `[${entry.time}] ${entry.message}`;
    elements.signalLog.append(line);
  });
}

function updateHeaderCounts() {
  elements.activePathCount.textContent = String(state.trackedPaths.size);
}

function buildPathMeta(path) {
  const counts = summarizePath(path.objectives);
  const tags = Array.isArray(path.tags) ? ` // ${path.tags.join(' / ')}` : '';
  return `${counts.complete}/${counts.total} resolved${tags}`;
}

function summarizePath(nodes) {
  let total = 0;
  let complete = 0;

  function walk(list) {
    list.forEach((node) => {
      total += 1;
      if (node.complete) complete += 1;
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children);
      }
    });
  }

  walk(nodes || []);
  return { total, complete };
}

function pushLog(message, level = '') {
  state.logLines.unshift({
    time: new Date().toLocaleTimeString(),
    message,
    level
  });
  renderSignalLog();
}

function setRefreshBusy(isBusy) {
  elements.refreshBtn.disabled = isBusy;
  elements.refreshBtn.classList.toggle('spinning', isBusy);
}

function persistJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
