function setupBaroviaMap({ getFeed, createIcon, isTracked, togglePath, isBombReady }) {
  const dialog = document.getElementById('rvMap');
  const launch = document.getElementById('rvOpenMap');
  const svg = dialog.querySelector('svg');
  const roads = dialog.querySelector('.rv-map-roads');
  const landmarks = dialog.querySelector('.rv-map-locations');
  const markers = dialog.querySelector('.rv-map-markers');
  const details = dialog.querySelector('.rv-map-details');
  const markerToggle = document.getElementById('rvMapMarkers');
  const ns = 'http://www.w3.org/2000/svg';
  const width = 1200;
  const height = 675;
  const markerSize = 52;
  const regionalMarkerSize = markerSize * 1.3;
  const regionalLayout = { centerX: 850, y: 57, width: 310, gap: 10 };
  const landmarkControls = new Map();
  const pathControls = new Map();
  let view = { x: 0, y: 0, zoom: 1 };
  let drag = null;
  let selection = null;
  const delivery = element('g', { class: 'rv-map-delivery', 'aria-hidden': 'true' });
  svg.append(delivery);
  let deliveryAnimations = [];
  let deliveryReady = false;
  let deliveryGeneration = 0;

  function clearDelivery() {
    deliveryGeneration++;
    for (const animation of deliveryAnimations) animation.cancel();
    deliveryAnimations = [];
    delivery.replaceChildren();
    deliveryReady = false;
  }

  function updateCompletion() {
    if (!dialog.open) return;
    const ready = Boolean(isBombReady?.());
    if (!ready) {
      clearDelivery();
      return;
    }
    if (deliveryReady) return;
    clearDelivery();
    deliveryReady = true;
    const generation = deliveryGeneration;
    const { map } = getFeed();
    const locations = new Map(map.locations.map((location) => [location.id, location]));
    const stops = ['ivlis-crossroads', 'tser-falls', 'west-gate', 'ravenloft-gates', 'ravenloft'];
    const cave = locations.get('fugue-cave');
    if (!cave || stops.some((id) => !locations.has(id))) return;
    // Join the village road south of the cave, then follow published roads in either direction.
    const villageRoad = map.roads.find((road) => road.from === 'ivlis-crossroads' && road.to === 'barovia');
    const junction = villageRoad?.via?.[0] ?? [977, 552];
    const nextBend = villageRoad?.via?.[1] ?? [1008, 521];
    const roadY = junction[1] + (nextBend[1] - junction[1]) *
      (cave.x - junction[0]) / (nextBend[0] - junction[0]);
    const points = [[cave.x, cave.y], [cave.x, roadY], junction];
    const crossroads = locations.get(stops[0]);
    points.push([crossroads.x, crossroads.y]);
    for (let i = 1; i < stops.length; i++) {
      const from = stops[i - 1];
      const to = stops[i];
      const road = map.roads.find((entry) =>
        (entry.from === from && entry.to === to) || (entry.from === to && entry.to === from));
      if (!road) return;
      const via = road.via ?? [];
      points.push(...(road.from === from ? via : [...via].reverse()));
      const destination = locations.get(to);
      points.push([destination.x, destination.y]);
    }
    const route = element('path', { d: roadShape(points), fill: 'none', stroke: 'none' });
    delivery.append(route);
    const wagon = element('g', { class: 'rv-map-bomb-wagon', stroke: '#241713', 'stroke-width': 2, 'stroke-linejoin': 'round' });
    wagon.append(
      element('path', { d: 'M-18-12H15L12 3H-14Z', fill: '#bd8136' }),
      element('path', { d: 'M-17-7H14M-6-12V2M5-12V2M13-1H24L28-7', fill: 'none', stroke: '#ffe49a' }),
      element('circle', { cx: -10, cy: 6, r: 5, fill: '#211c1a', stroke: '#f2ba45' }),
      element('circle', { cx: 10, cy: 6, r: 5, fill: '#211c1a', stroke: '#f2ba45' }),
      element('circle', { cx: -3, cy: -21, r: 11, fill: '#242126', stroke: '#ffe49a' }),
      element('path', { d: 'M-8-27Q-12-23-9-20', fill: 'none', stroke: '#fff3cf' }),
      element('path', { d: 'M2-31L5-35Q12-37 12-31', fill: 'none', stroke: '#e8bc67' }),
      element('path', { d: 'M12-37V-25M6-31H18M8-35L16-27M8-27L16-35', stroke: '#f2693e' })
    );
    delivery.append(wagon);
    // Sample position and heading together so each blink is a single, crisp sprite frame.
    const routeLength = route.getTotalLength();
    const segmentCount = Math.ceil(routeLength / 40);
    const travelFrames = [];
    for (let segment = 0; segment < segmentCount; segment++) {
      const distance = (segment / (segmentCount - 1)) * routeLength;
      const position = route.getPointAtLength(distance);
      const before = route.getPointAtLength(Math.max(0, distance - 3));
      const after = route.getPointAtLength(Math.min(routeLength, distance + 3));
      const dx = after.x - before.x;
      const dy = after.y - before.y;
      const facing = dx < 0 ? -1 : 1;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI - (facing < 0 ? 180 : 0);
      const transform = `translate(${position.x}px, ${position.y}px) rotate(${angle}deg) scaleX(${facing})`;
      travelFrames.push({ offset: segment / segmentCount, transform, easing: 'steps(1, end)' });
    }
    travelFrames.push({ offset: 1, transform: travelFrames.at(-1).transform });
    route.remove();
    const flight = wagon.animate(travelFrames, {
      duration: 4200, easing: 'linear', fill: 'forwards'
    });
    deliveryAnimations.push(flight);
    const castle = locations.get('ravenloft');
    const blast = element('g', { transform: `translate(${castle.x} ${castle.y})` });
    const frames = [
      ['M0-17 5-5 17 0 5 5 0 17-5 5-17 0-5-5Z', '#fff7d2'],
      ['M0-45 10-20 31-35 25-10 48 0 25 10 33 34 10 23 0 49-10 23-35 34-25 10-48 0-25-10-34-34-10-21Z', '#f2ba45'],
      ['M0-54 14-31 39-42 35-16 56-4 36 13 44 40 16 35 0 56-15 35-43 42-36 15-57 0-35-16-41-40-14-32Z', '#d95535'],
      ['M-35 17Q-59 4-42-13Q-45-38-20-34Q-4-58 16-34Q42-42 43-15Q63 4 39 21Q19 38 0 24Q-21 41-35 17Z', '#a89b86']
    ];
    for (const [d, fill] of frames) {
      const frame = element('g', { class: 'rv-map-explosion-frame' });
      frame.append(element('path', { d, fill, stroke: '#2b1814', 'stroke-width': 3 }));
      blast.append(frame);
    }
    delivery.append(blast);
    flight.finished.then(() => {
      if (generation !== deliveryGeneration) return;
      wagon.remove();
      let finalFrame;
      for (const [index, frame] of [...blast.children].entries()) {
        const animation = frame.animate([{ opacity: 1 }, { opacity: 1 }], {
          delay: index * 150, duration: 150, endDelay: index === 3 ? 1000 : 0, fill: 'none'
        });
        deliveryAnimations.push(animation);
        finalFrame = animation;
      }
      return finalFrame.finished.then(() => {
        if (generation !== deliveryGeneration) return;
        deliveryReady = false;
        updateCompletion();
      });
    }).catch(() => {}); // Closing the map or losing a component cancels the sequence.
  }

  function element(tag, attributes = {}) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  function drawView() {
    const w = width / view.zoom;
    const h = height / view.zoom;
    view.x = Math.max(0, Math.min(width - w, view.x));
    view.y = Math.max(0, Math.min(height - h, view.y));
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${w} ${h}`);
  }

  function worldPoint(clientX, clientY) {
    return new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM().inverse());
  }

  function zoomBy(multiplier, point = { x: view.x + width / view.zoom / 2, y: view.y + height / view.zoom / 2 }) {
    const zoom = Math.max(1, Math.min(5, view.zoom * multiplier));
    const factor = view.zoom / zoom;
    view = { x: point.x - (point.x - view.x) * factor, y: point.y - (point.y - view.y) * factor, zoom };
    drawView();
  }

  function describe(location, paths, control, path = null) {
    selection?.control.removeAttribute('aria-current');
    selection = { location, paths, control, path };
    control.setAttribute('aria-current', 'true');
    const heading = document.createElement('strong');
    heading.textContent = path ? `${path.title} — ${location.name}` : location.name;
    const description = document.createElement('span');
    description.className = 'rv-map-landmark-description';
    if (path) {
      if (typeof path.mouseover === 'string' && path.mouseover.trim()) {
        description.append(cleanFormattedContent(path.mouseover.trim(), inlineFormattingTags));
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rv-button';
      const update = () => { button.textContent = isTracked(path) ? 'Untrack path' : 'Track path'; };
      update();
      button.addEventListener('click', () => {
        togglePath(path);
        update();
      });
      details.replaceChildren(heading, ...(description.hasChildNodes() ? [description] : []), button);
      return;
    }

    const prose = typeof location.description === 'string' ? location.description.trim() : '';
    if (prose) description.append(cleanFormattedContent(prose, inlineFormattingTags));
    const quests = document.createElement('span');
    quests.className = 'rv-map-landmark-quests';
    quests.textContent = paths.length ? 'Paths here' : 'No paths at this location.';
    for (const quest of paths) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rv-button';
      button.textContent = quest.title;
      button.addEventListener('click', () => {
        const marker = markerToggle.checked ? pathControls.get(quest) : null;
        describe(location, paths, marker ?? control, quest);
        details.querySelector('button').focus({ preventScroll: true });
      });
      quests.append(button);
    }
    details.replaceChildren(heading, ...(prose ? [description] : []), quests);
  }

  function interactive(group, name, action) {
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', name);
    group.addEventListener('click', action);
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    });
  }

  function markerPosition(location, occupied, routePoints) {
    const awayFromLabel = location.labelSide === 'below' ? -1 : 1;
    const directions = location.markerSide === 'north'
      ? [[1, -1], [0, -1], [-1, -1]]
      : [[1, 0], [-1, 0], [1, awayFromLabel], [-1, awayFromLabel], [0, awayFromLabel]];
    let fallback;
    for (let distance = 27; distance <= 91; distance += 16) {
      for (const [dx, dy] of directions) {
        const x = location.x + dx * distance - markerSize / 2;
        const y = location.y + dy * distance - markerSize / 2;
        const box = { left: x - 3, top: y - 3, right: x + markerSize + 3, bottom: y + markerSize + 3 };
        if (box.left < 10 || box.top < 10 || box.right > width - 10 || box.bottom > height - 10) continue;
        if (occupied.some((b) => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top)) continue;
        const candidate = { x, y, box };
        fallback ??= candidate;
        if (!routePoints.some(([px, py]) => px >= box.left && px <= box.right && py >= box.top && py <= box.bottom)) {
          return candidate;
        }
      }
    }
    return fallback;
  }

  function roadShape(points) {
    const towards = ([x, y], [otherX, otherY]) => {
      const fraction = Math.min(.35, 8 / Math.hypot(otherX - x, otherY - y));
      return [x + (otherX - x) * fraction, y + (otherY - y) * fraction];
    };
    let path = `M${points[0].join(' ')}`;
    for (let i = 1; i < points.length - 1; i++) {
      const corner = points[i];
      path += ` L${towards(corner, points[i - 1]).join(' ')} Q${corner.join(' ')} ${towards(corner, points[i + 1]).join(' ')}`;
    }
    return `${path} L${points.at(-1).join(' ')}`;
  }

  function render() {
    roads.replaceChildren();
    landmarks.replaceChildren();
    markers.replaceChildren();
    landmarkControls.clear();
    pathControls.clear();
    selection = null;
    details.textContent = 'Select a landmark or path marker for details. Drag the map after zooming in.';
    const { map, paths } = getFeed();
    const locations = new Map();
    for (const location of Array.isArray(map?.locations) ? map.locations : []) {
      if (typeof location?.id === 'string' && typeof location.name === 'string' &&
          (location.kind === 'regional' || (Number.isFinite(location.x) && Number.isFinite(location.y)))) {
        locations.set(location.id, location);
      }
    }
    if (!locations.size) {
      details.textContent = 'No map locations are published in this objective feed.';
      return;
    }

    const routePoints = [];
    for (const road of Array.isArray(map.roads) ? map.roads : []) {
      const from = locations.get(road?.from);
      const to = locations.get(road?.to);
      if (!from || !to || from.kind === 'regional' || to.kind === 'regional') continue;
      const via = Array.isArray(road.via) ? road.via.filter((point) =>
        Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) : [];
      const points = [[from.x, from.y], ...via, [to.x, to.y]];
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1];
        const [bx, by] = points[i];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 6);
        for (let step = 0; step < steps; step++) {
          routePoints.push([ax + (bx - ax) * step / steps, ay + (by - ay) * step / steps]);
        }
      }
      roads.append(element('path', {
        d: roadShape(points),
        class: road.kind === 'trail' ? 'rv-map-trail' : 'rv-map-road'
      }));
    }

    const pathsAt = new Map();
    for (const path of paths) {
      if (!locations.has(path.location)) continue;
      if (!pathsAt.has(path.location)) pathsAt.set(path.location, []);
      pathsAt.get(path.location).push(path);
    }

    const occupied = [];
    for (const location of locations.values()) {
      if (location.kind === 'regional') continue;
      const quests = pathsAt.get(location.id) || [];
      const group = element('g', { transform: `translate(${location.x} ${location.y})`, class: 'rv-map-landmark' });
      const size = location.kind === 'castle' ? 9 : location.kind === 'town' ? 7 : 5;
      let symbol;
      if (location.kind === 'hideout') {
        symbol = element('path', {
          class: 'rv-map-hideout',
          d: 'M-12-4Q-8 0-4-4L-2-2-2-6 0-4 2-6 2-2 4-4Q8 0 12-4L9 4Q4 1 0 7Q-4 1-9 4Z'
        });
      } else if (location.kind === 'junction') {
        symbol = element('circle', { r: size });
      } else {
        symbol = element('path', { d: `M0-${size} ${size} 0 0 ${size} -${size} 0Z` });
      }
      const label = element('text', {
        y: (location.labelSide === 'below' ? 21 : -13) + (Number.isFinite(location.labelOffsetY) ? location.labelOffsetY : 0),
        x: Number.isFinite(location.labelOffsetX) ? location.labelOffsetX : 0
      });
      label.textContent = location.name;
      group.append(element('circle', { r: 13, class: 'rv-map-hit' }), symbol, label);
      interactive(group, location.name, () => describe(location, quests, group));
      landmarks.append(group);
      landmarkControls.set(location.id, group);
      const box = label.getBBox();
      occupied.push(
        { left: location.x - 13, top: location.y - 13, right: location.x + 13, bottom: location.y + 13 },
        { left: location.x + box.x - 2, top: location.y + box.y - 2, right: location.x + box.x + box.width + 2, bottom: location.y + box.y + box.height + 2 }
      );
    }

    for (const [id, quests] of pathsAt) {
      const location = locations.get(id);
      if (location.kind === 'regional') {
        const { centerX, y, width, gap } = regionalLayout;
        const step = regionalMarkerSize + gap;
        const columns = Math.floor((width + gap) / step);
        const firstRowWidth = Math.min(quests.length, columns) * step - gap;
        const bracketLeft = centerX - firstRowWidth / 2 - 8;
        const bracketRight = centerX + firstRowWidth / 2 + 8;
        const bracketTop = y - 11;
        const label = element('text', { x: centerX, y: y - 23, class: 'rv-map-region-label', 'aria-hidden': 'true' });
        label.textContent = location.name.toUpperCase();
        const bracket = element('path', {
          d: `M${bracketLeft} ${bracketTop + 5} V${bracketTop} H${bracketRight} V${bracketTop + 5} M${centerX} ${bracketTop} v-6`,
          class: 'rv-map-region-bracket',
          'aria-hidden': 'true'
        });
        markers.append(label, bracket);
        quests.forEach((path, index) => {
          const row = Math.floor(index / columns);
          const rowCount = Math.min(quests.length - row * columns, columns);
          const rowWidth = rowCount * step - gap;
          const marker = element('g', { class: 'rv-map-marker' });
          const image = element('foreignObject', {
            x: centerX - rowWidth / 2 + (index % columns) * step,
            y: y + row * step,
            width: regionalMarkerSize,
            height: regionalMarkerSize
          });
          image.append(createIcon(path));
          marker.append(image);
          interactive(marker, `${path.title} — ${location.name}`, () => describe(location, quests, marker, path));
          markers.append(marker);
        });
        continue;
      }
      for (const path of quests) {
        const position = markerPosition(location, occupied, routePoints);
        if (!position) break;
        const { x, y, box } = position;
        occupied.push(box);
        const marker = element('g', { class: 'rv-map-marker' });
        const dx = x + markerSize / 2 - location.x;
        const dy = y + markerSize / 2 - location.y;
        const inset = 10 / Math.hypot(dx, dy);
        const leader = element('line', {
          x1: location.x + dx * inset, y1: location.y + dy * inset,
          x2: x + markerSize / 2, y2: y + markerSize / 2,
          class: 'rv-map-marker-leader', 'aria-hidden': 'true'
        });
        const image = element('foreignObject', { x, y, width: markerSize, height: markerSize });
        image.append(createIcon(path));
        marker.append(leader, image);
        interactive(marker, `${path.title} near ${location.name}`, () => describe(location, quests, marker, path));
        markers.append(marker);
        pathControls.set(path, marker);
      }
    }
  }

  launch.addEventListener('click', () => {
    dialog.returnValue = '';
    dialog.showModal();
    render();
    updateCompletion();
  });
  document.getElementById('rvCloseMap').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearDelivery();
    if (dialog.returnValue !== 'tour') launch.focus();
  });
  document.getElementById('rvMapIn').addEventListener('click', () => zoomBy(1.35));
  document.getElementById('rvMapOut').addEventListener('click', () => zoomBy(1 / 1.35));
  document.getElementById('rvMapFit').addEventListener('click', () => {
    view = { x: 0, y: 0, zoom: 1 };
    drawView();
  });
  markerToggle.addEventListener('change', () => {
    markers.classList.toggle('rv-map-layer-hidden', !markerToggle.checked);
    if (!markerToggle.checked && selection?.path) {
      const { location, paths } = selection;
      const landmark = landmarkControls.get(location.id);
      if (landmark) {
        describe(location, paths, landmark);
      } else {
        selection.control.removeAttribute('aria-current');
        selection = null;
        details.textContent = 'Select a landmark or path marker for details. Drag the map after zooming in.';
      }
    }
  });

  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.2 : 1 / 1.2, worldPoint(event.clientX, event.clientY));
  }, { passive: false });
  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || view.zoom === 1 || event.target.closest('[role="button"]')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    svg.setPointerCapture(drag.id);
  });
  svg.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const scale = svg.getScreenCTM().a;
    view.x -= (event.clientX - drag.x) / scale;
    view.y -= (event.clientY - drag.y) / scale;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drawView();
  });
  svg.addEventListener('lostpointercapture', () => { drag = null; });
  svg.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') zoomBy(1.35);
    else if (event.key === '-') zoomBy(1 / 1.35);
    else if (event.key.startsWith('Arrow')) {
      const step = 60 / view.zoom;
      if (event.key === 'ArrowLeft') view.x -= step;
      if (event.key === 'ArrowRight') view.x += step;
      if (event.key === 'ArrowUp') view.y -= step;
      if (event.key === 'ArrowDown') view.y += step;
      drawView();
    } else return;
    event.preventDefault();
  });
  function preview() {
    const previousView = view;
    view = { x: 0, y: 0, zoom: 1 };
    dialog.show();
    drawView();
    render();
    updateCompletion();
    return () => {
      dialog.close('tour');
      view = previousView;
      drawView();
    };
  }
  return { updateCompletion, preview };
}
