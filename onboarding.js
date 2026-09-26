"use strict";
/* First-launch onboarding (Android app only).
   Startup sequence:
   0. Native splash (android res/drawable/splash.xml) covers the cold start.
   1. Slide 0 "Splash": pengo brand + mascot reading, loading bar.
   2. Slide 1 "Welcome": journey pitch + encouragement bubble.
   3. Slide 2 "Features": JLPT success cards + Start learning.
   Shown once (localStorage ONBOARD_KEY). The web build never shows it,
   except with ?onboarding=1 for preview. Replay via Settings. */
var ONBOARD_KEY = "pengo:onboarded:v1";
function isAndroidApp() {
  try { return !!(window.Platform && window.Platform.isAndroidApp); }
  catch (e) { return false; }
}
function onboardingPreview() {
  try { return new URLSearchParams(location.search).get("onboarding") === "1"; }
  catch (e) { return false; }
}
function shouldShowOnboarding() {
  if (onboardingPreview()) return true;
  if (!isAndroidApp()) return false;
  try { return !localStorage.getItem(ONBOARD_KEY); }
  catch (e) { return true; }
}
function markOnboarded() {
  try { localStorage.setItem(ONBOARD_KEY, "1"); } catch (e) {}
}
function showOnboarding(onDone) {
  if (document.querySelector(".ob-root")) return;
  document.body.classList.add("ob-open");
  var root = document.createElement("div");
  root.className = "ob-root";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Welcome to Pengo");
  var feats = [
    { t: "Kanji", d: "Learn with meaning, readings and examples", i: "&#26481;", c: "pink" },
    { t: "Vocabulary", d: "N5 - N1 word lists with useful examples", i: "&#x1F4DA;", c: "blue" },
    { t: "Grammar", d: "Key points with simple explanations", i: "&#x1F4D7;", c: "green" },
    { t: "Practice", d: "Quizzes and mock tests", i: "&#x2710;&#xFE0F;", c: "yellow" },
    { t: "Track Progress", d: "See your improvement", i: "&#x1F4CA;", c: "purple" }
  ];
  var idx = 0;
  var total = 3;
  function slideHtml() {
    if (idx === 0) {
      return "<div class=\"ob-slide\">" +
        "<div class=\"ob-brand\">peng<span class=\"peng-o\">o</span></div>" +
        "<p class=\"ob-tag\">Small steps. Big Japanese.</p>" +
        "<div class=\"ob-scene\" aria-hidden=\"true\"><div class=\"ob-cloud c1\"></div><div class=\"ob-cloud c2\"></div>" +
        "<div class=\"ob-fuji\"></div><div class=\"ob-fuji-cap\"></div><div class=\"ob-ice\"></div>" +
        "<img class=\"ob-mascot\" src=\"assets/pengo-mascot.png\" alt=\"\"></div>" +
        "<div class=\"ob-load\"><div class=\"ob-load-track\"><span class=\"ob-load-fill\"></span></div>" +
        "<p class=\"ob-load-lbl\">Loading...</p></div></div>";
    }
    if (idx === 1) {
      return "<div class=\"ob-slide\">" +
        "<h2 class=\"ob-title\">Learn Japanese<br>for your next journey</h2>" +
        "<p class=\"ob-sub\">Kanji &bull; Vocabulary &bull; JLPT<small>All in one place</small></p>" +
        "<div class=\"ob-scene\" aria-hidden=\"true\"><div class=\"ob-cloud c1\"></div><div class=\"ob-cloud c2\"></div>" +
        "<div class=\"ob-bubble\"><span class=\"jp\" lang=\"ja\">&#x4E00;&#x6B69;&#x305A;&#x3064;&#x3001;&#x304D;&#x3063;&#x3068;&#x3067;&#x304D;&#x308B;</span><small>You can do it!</small></div>" +
        "<div class=\"ob-fuji\"></div><div class=\"ob-fuji-cap\"></div><div class=\"ob-ice\"></div>" +
        "<img class=\"ob-mascot flip\" src=\"assets/pengo-mascot.png\" alt=\"\"></div></div>";
    }
    var rows = "";
    for (var k = 0; k < feats.length; k++) {
      var f = feats[k];
      rows += "<div class=\"ob-feat\"><span class=\"ob-feat-ico " + f.c + "\" aria-hidden=\"true\">" + f.i + "</span>" +
        "<div><b>" + f.t + "</b><span>" + f.d + "</span></div></div>";
    }
    return "<div class=\"ob-slide\">" +
      "<h2 class=\"ob-title\" style=\"font-size:1.35rem\">Everything you need<br>for JLPT success</h2>" +
      "<div class=\"ob-feats\">" + rows + "</div></div>";
  }
  function ctaLabel() {
    if (idx === 0) return "See how it works &#x2192;";
    if (idx === 1) return "Let&#x2019;s Start &#x2192;";
    return "Start learning &#x2192;";
  }
  function draw() {
    var last = idx === total - 1;
    var dots = "";
    for (var d = 0; d < total; d++) dots += "<i class=\"" + (d === idx ? "on" : "") + "\"></i>";
    root.innerHTML =
      "<div class=\"ob-phone\">" +
      "<button class=\"ob-skip\" type=\"button\">Skip</button>" +
      slideHtml() +
      "<button class=\"ob-cta\" type=\"button\">" + ctaLabel() + "</button>" +
      (idx === 0 ? "" : "<button class=\"ob-back\" type=\"button\">&#x2190; Back</button>") +
      "<div class=\"ob-dots\" aria-hidden=\"true\">" + dots + "</div></div>";
    root.querySelector(".ob-cta").addEventListener("click", function () {
      if (last) { finish(); return; }
      idx++; draw();
    });
    var back = root.querySelector(".ob-back");
    if (back) back.addEventListener("click", function () { if (idx > 0) { idx--; draw(); } });
    root.querySelector(".ob-skip").addEventListener("click", finish);
  }
  function finish() {
    markOnboarded();
    window.OBBack = null;
    root.remove();
    document.body.classList.remove("ob-open");
    if (typeof onDone === "function") onDone();
  }
  var touchX = null;
  root.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (dx < -50 && idx < total - 1) { idx++; draw(); }
    else if (dx > 50 && idx > 0) { idx--; draw(); }
  }, { passive: true });
  window.OBBack = function () {
    if (!document.body.contains(root)) return false;
    if (idx > 0) { idx--; draw(); return true; }
    return false;
  };
  document.body.appendChild(root);
  draw();
}
