"use strict";
/* Hierarchy and existing story references are separate learning views. */
function componentData() { return window.KK_COMPONENTS || { trees: {}, names: {}, stories: {} }; }
function componentNodeInfo(node) {
  var data = componentData(), info = Object.assign({}, data.names[node.c] || { c: node.c, m: '', rad: null });
  if (node.original && node.original !== node.c) {
    var original = data.names[node.original];
    if (original) info = Object.assign({}, original, { c: node.c });
    info.variantOf = node.original;
  }
  if (node.partial === 'true') info.m = (info.m || node.c) + ' (partial shape)';
  return info;
}
function learningComponents(item) {
  var tree = componentData().trees[item.k];
  return tree && tree.children && tree.children.length ? tree.children.map(componentNodeInfo) : (item.components || []);
}
function storyComponents(item) {
  return componentData().stories[item.k] || (item.mnemonic ? item.components || [] : learningComponents(item));
}
function componentTreeHTML(node, depth) {
  var row = compRow(componentNodeInfo(node));
  if (!node.children || !node.children.length || depth >= 10) return row;
  return '<div class="component-branch">' + row + '<details class="component-inside"><summary>Inside <span lang="ja">' + esc(node.c) +
    '</span>' + (node.complete ? '' : ' · smaller grouped shapes') + '</summary><div class="component-children">' +
    (node.complete ? '' : '<p class="explain">These groups explain part of the shape; other strokes remain in the parent.</p>') +
    node.children.map(function (child) { return componentTreeHTML(child, depth + 1); }).join('') + '</div></details></div>';
}
function componentsHTML(item) {
  var data = componentData(), tree = data.trees[item.k], story = data.stories[item.k];
  var structural = tree && tree.children && tree.children.length;
  return '<div class="learning-components">' +
    (story ? '<div class="story-parts"><span class="eyebrow">PARTS IN YOUR MEMORY STORY</span><div class="comp-list">' +
      story.map(compRow).join('') + '</div><p class="explain">Named cues from the mnemonic. Stories may group or reinterpret shapes.</p></div>' : '') +
    '<div class="structural-parts"><span class="eyebrow">' + (structural ? 'LARGER SHAPES FIRST' : 'COMPONENTS') + '</span>' +
    (structural ? '<p class="explain">Keep useful chunks together. Open “Inside” to explore another level.</p><div class="comp-list">' +
      tree.children.map(function (node) { return componentTreeHTML(node, 0); }).join('') + '</div>' +
      (tree.complete ? '' : '<p class="explain">Some strokes are outside these named groups.</p>') :
      '<div class="comp-list">' + (item.components || []).map(compRow).join('') + '</div>') +
    '<p class="explain component-attribution">' + (tree ? '<a href="https://kanjivg.tagaini.net/">KanjiVG</a> · © Ulrich Apel · CC BY-SA 3.0' : 'EDRDG KRADFILE fallback') +
    '. Components are learning cues, not an etymological explanation. Kangxi badges identify dictionary radicals.</p></div>' +
    (structural ? '<details class="component-inside"><summary>Compare finer parts</summary><div class="comp-list">' +
      (item.components || []).map(compRow).join('') + '</div></details>' : '') + '</div>';
}
