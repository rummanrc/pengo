/* Guided tracing derived at runtime from the bundled KanjiVG paths.
   KanjiVG © Ulrich Apel, CC BY-SA 3.0; source notices remain in resources/.
   This UI never grades SRS or changes learned state. */
'use strict';
const WritingUI = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  function html() {
    return '<section class="card writing-card" id="writingCard" aria-labelledby="writingTitle">' +
      '<div class="writing-heading"><div><h2 id="writingTitle">Write it yourself</h2>' +
      '<p class="explain">Trace each stroke with your finger, stylus, or mouse.</p></div>' +
      '<button class="btn primary" id="writingStart" disabled aria-expanded="false" aria-controls="writingPanel">Writing practice</button></div>' +
      '<p class="explain" id="writingAvailability" role="status">Loading writing guides…</p>' +
      '<div id="writingPanel" hidden></div></section>';
  }
  function unavailable(host, message) {
    if (host) host.querySelector('#writingAvailability').textContent = message;
  }
  function element(name, attributes) {
    const node = document.createElementNS(NS, name);
    Object.keys(attributes || {}).forEach(key => node.setAttribute(key, attributes[key]));
    return node;
  }
  function pathData(points) {
    return points.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ');
  }
  function ready(host, sourceSVG, sourcePaths, character) {
    if (!host || !sourcePaths.length) { unavailable(host, 'Writing guides are unavailable for this kanji.'); return; }
    const start = host.querySelector('#writingStart'), panel = host.querySelector('#writingPanel');
    host.querySelector('#writingAvailability').textContent = 'Follow the blue stroke from its numbered starting point. Each stroke is checked as you lift.';
    let initialized = false, references, board, guides, ink, marker, status, count, undo;
    let accepted = [], retries = 0, active = null, attempt = null;
    function release() {
      const previous = active;
      active = null;
      if (previous && board.hasPointerCapture(previous.id)) board.releasePointerCapture(previous.id);
    }
    function cancel() {
      release();
      if (attempt) attempt.remove();
      attempt = null;
    }
    function update(message, kind) {
      const current = accepted.length, complete = current === references.length;
      host.dataset.writingState = complete ? 'complete' : 'active';
      count.textContent = complete ? 'All ' + references.length + ' strokes complete' : 'Stroke ' + (current + 1) + ' of ' + references.length;
      status.textContent = message || (complete ? 'Correct! You wrote ' + character + ' in the right stroke order. ' +
        (retries ? retries + (retries === 1 ? ' retry.' : ' retries.') : 'All strokes matched!') :
        'Start at ' + (current + 1) + ' and follow the blue stroke. Lift after each stroke.');
      status.dataset.kind = kind || (complete ? 'success' : 'hint');
      undo.disabled = current === 0;
      guides.replaceChildren(); marker.replaceChildren();
      references.forEach((points, i) => {
        if (i >= current) guides.appendChild(element('path', { d: pathData(points), class: i === current ? 'writing-next' : 'writing-guide' }));
      });
      if (!complete) {
        const points = references[current], first = points[0];
        marker.appendChild(element('circle', { cx: first.x, cy: first.y, r: 4.5 }));
        const label = element('text', { x: first.x, y: first.y + 1.6, 'text-anchor': 'middle' });
        label.textContent = String(current + 1); marker.appendChild(label);
        // A short arrow previews direction without animating or moving the board.
        const tip = Writing.resample(points, 12)[1];
        const angle = Math.atan2(tip.y - first.y, tip.x - first.x);
        const end = { x: first.x + Math.cos(angle) * 11, y: first.y + Math.sin(angle) * 11 };
        marker.appendChild(element('path', { d: 'M' + (first.x + Math.cos(angle) * 5) + ',' + (first.y + Math.sin(angle) * 5) +
          'L' + end.x + ',' + end.y + 'm' + (-3 * Math.cos(angle - .6)) + ',' + (-3 * Math.sin(angle - .6)) +
          'M' + end.x + ',' + end.y + 'l' + (-3 * Math.cos(angle + .6)) + ',' + (-3 * Math.sin(angle + .6)), class: 'writing-arrow' }));
      }
    }
    function position(event) {
      return new DOMPoint(event.clientX, event.clientY).matrixTransform(board.getScreenCTM().inverse());
    }
    function appendPoint(event) {
      const p = position(event), last = active.points[active.points.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= .25) active.points.push({ x: p.x, y: p.y });
      attempt.setAttribute('d', pathData(active.points));
    }
    function initialize() {
      // Include nested SVG transforms, then normalize every diagram to 109 units.
      const vb = sourceSVG.viewBox.baseVal, inverse = sourceSVG.getScreenCTM().inverse();
      references = sourcePaths.map(path => {
        const length = path.getTotalLength(), transform = inverse.multiply(path.getScreenCTM());
        const samples = Math.max(32, Math.ceil(length * 2));
        return Array.from({ length: samples }, (_, i) => {
          const p = path.getPointAtLength(length * i / (samples - 1)).matrixTransform(transform);
          return { x: (p.x - vb.x) * 109 / vb.width, y: (p.y - vb.y) * 109 / vb.height };
        });
      });
      if (references.some(points => Writing.length(points) < .5)) throw new Error('Empty stroke');
      panel.innerHTML = '<div class="writing-layout"><div class="writing-board-wrap"></div><div class="writing-help">' +
        '<p class="writing-count" id="writingCount"></p>' +
        '<p id="writingInstructions">Trace the blue guide from the numbered dot, in the arrow’s direction. Keep each stroke in one movement.</p>' +
        '<p class="writing-feedback" id="writingFeedback" role="status" aria-live="polite" aria-atomic="true"></p>' +
        '<div class="writing-controls"><button class="btn" id="writingUndo" disabled>Undo last stroke</button>' +
        '<button class="btn soft" id="writingReset">Start again</button></div>' +
        '<p class="explain">Guided tracing checks stroke order, direction, and approximate shape. It does not judge calligraphy or change your quiz score.</p></div></div>';
      board = element('svg', { viewBox: '0 0 109 109', class: 'writing-board', role: 'img',
        'aria-label': 'Drawing area for ' + character, 'aria-describedby': 'writingInstructions' });
      board.appendChild(element('path', { d: 'M54.5 0V109M0 54.5H109', class: 'writing-grid' }));
      guides = element('g'); ink = element('g'); marker = element('g', { class: 'writing-marker' });
      board.append(guides, ink, marker); panel.querySelector('.writing-board-wrap').appendChild(board);
      status = panel.querySelector('#writingFeedback'); count = panel.querySelector('#writingCount'); undo = panel.querySelector('#writingUndo');
      board.addEventListener('pointerdown', event => {
        if (active || accepted.length === references.length || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        if (attempt) attempt.remove();
        active = { id: event.pointerId, points: [] };
        attempt = element('path', { class: 'writing-ink' }); ink.appendChild(attempt);
        board.setPointerCapture(event.pointerId); appendPoint(event);
      });
      board.addEventListener('pointermove', event => {
        if (!active || active.id !== event.pointerId) return;
        event.preventDefault();
        // Bound memory and reject unusually long scribbles without freezing the UI.
        if (active.points.length >= 2048) { cancel(); retries++; update('Try a single, steady stroke along the blue guide.', 'retry'); return; }
        appendPoint(event);
      });
      board.addEventListener('pointerup', event => {
        if (!active || active.id !== event.pointerId) return;
        event.preventDefault(); appendPoint(event);
        const points = active.points, result = Writing.grade(points, references[accepted.length]);
        release();
        if (result.ok) {
          attempt.setAttribute('class', 'writing-ink writing-accepted');
          accepted.push({ points, node: attempt }); attempt = null; update();
        } else {
          retries++; attempt.setAttribute('class', 'writing-ink writing-error');
          const other = references.findIndex((ref, i) => i !== accepted.length && Writing.grade(points, ref).ok);
          update(result.reason === 'direction' ? 'Try the other direction. Start at the numbered dot and follow the arrow.' :
            other >= 0 ? 'That matches stroke ' + (other + 1) + '. Follow the blue stroke ' + (accepted.length + 1) + ' first.' :
            result.reason === 'short' ? 'Keep going along the whole blue stroke before lifting.' :
            'Not quite yet. Follow the blue guide from its starting dot to its end.', 'retry');
        }
      });
      ['pointercancel', 'lostpointercapture'].forEach(name => board.addEventListener(name, event => {
        if (active && active.id === event.pointerId) { cancel(); update('Drawing interrupted. Try this stroke again.'); }
      }));
      undo.addEventListener('click', () => { cancel(); const last = accepted.pop(); if (last) last.node.remove(); update(); });
      panel.querySelector('#writingReset').addEventListener('click', () => {
        cancel(); accepted = []; retries = 0; ink.replaceChildren(); update();
      });
      initialized = true; update();
    }
    start.disabled = false;
    start.addEventListener('click', () => {
      if (!initialized) {
        try { initialize(); }
        catch (error) { panel.replaceChildren(); start.disabled = true; unavailable(host, 'Writing guides could not be prepared. Try reopening this kanji.'); return; }
      }
      cancel();
      panel.hidden = !panel.hidden;
      start.setAttribute('aria-expanded', String(!panel.hidden));
      start.textContent = panel.hidden ? 'Writing practice' : 'Close practice';
    });
  }
  return { html, unavailable, ready };
})();
