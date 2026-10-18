/* Geometry-only checks in the KanjiVG 109 × 109 writing square. No storage. */
(function (root) {
  'use strict';
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function length(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
    return total;
  }
  function valid(points) {
    return Array.isArray(points) && points.length >= 2 && points.every(function (p) {
      return p && Number.isFinite(p.x) && Number.isFinite(p.y);
    });
  }
  // Equal arc-length samples keep drawing speed and event frequency out of grading.
  function resample(points, count) {
    var cumulative = [0];
    for (var i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
    var total = cumulative[cumulative.length - 1], out = [], cursor = 1;
    for (var n = 0; n < count; n++) {
      var target = total * n / (count - 1);
      while (cursor < points.length - 1 && cumulative[cursor] < target) cursor++;
      var span = cumulative[cursor] - cumulative[cursor - 1];
      var t = span ? (target - cumulative[cursor - 1]) / span : 0;
      out.push({ x: points[cursor - 1].x + (points[cursor].x - points[cursor - 1].x) * t,
        y: points[cursor - 1].y + (points[cursor].y - points[cursor - 1].y) * t });
    }
    return out;
  }
  function matches(input, reference) {
    var expected = length(reference), actual = length(input);
    if (expected < 0.5 || actual < Math.max(1, expected * 0.55) || actual > expected * 1.65) return false;
    var end = reference[reference.length - 1], start = reference[0];
    var drawnEnd = input[input.length - 1], drawnStart = input[0];
    if (distance(start, end) > Math.max(.5, expected * .25) &&
        (end.x - start.x) * (drawnEnd.x - drawnStart.x) + (end.y - start.y) * (drawnEnd.y - drawnStart.y) <= 0) return false;
    var endpointTolerance = Math.min(10, Math.max(4, expected * 0.22));
    if (distance(input[0], reference[0]) > endpointTolerance ||
        distance(input[input.length - 1], reference[reference.length - 1]) > endpointTolerance) return false;
    var a = resample(input, 32), b = resample(reference, 32);
    var errors = a.map(function (p, i) { return distance(p, b[i]); });
    var tolerance = Math.min(7, Math.max(3, expected * 0.14));
    return errors.reduce(function (sum, value) { return sum + value; }, 0) / errors.length <= tolerance &&
      Math.max.apply(null, errors) <= tolerance * 2;
  }
  function grade(input, reference) {
    if (!valid(input) || !valid(reference)) return { ok: false, reason: 'short' };
    if (matches(input, reference)) return { ok: true };
    if (matches(input.slice().reverse(), reference)) return { ok: false, reason: 'direction' };
    if (length(input) < length(reference) * 0.55) return { ok: false, reason: 'short' };
    return { ok: false, reason: 'shape' };
  }
  var api = { grade: grade, resample: resample, length: length };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Writing = api;
})(typeof window !== 'undefined' ? window : globalThis);
