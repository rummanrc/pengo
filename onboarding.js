"use strict";
/* First-launch onboarding (native apps).
   Startup sequence:
   0. Native splash (android res/drawable/splash.xml) covers the cold start.
   1. Slide 0 "Welcome": pengo brand, JLPT prep pitch and mascot.
   2. Slide 1 "Features": JLPT success cards + guided, interactive tour.
   Shown once (localStorage ONBOARD_KEY). The web build never shows it,
   except with ?onboarding=1 for preview. Replay via Settings. */
var ONBOARD_KEY = "pengo:onboarded:v1";
function isNativeApp() {
  try { return !!(window.Platform && window.Platform.isNativeApp); }
  catch (e) { return false; }
}
function onboardingPreview() {
  try { return new URLSearchParams(location.search).get("onboarding") === "1"; }
  catch (e) { return false; }
}
function shouldShowOnboarding() {
  if (onboardingPreview()) return true;
  if (!isNativeApp()) return false;
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
    { t: "Practice", d: "Short quizzes and recall cards", i: "&#x2710;&#xFE0F;", c: "yellow" },
    { t: "Track Progress", d: "See your improvement", i: "&#x1F4CA;", c: "purple" }
  ];
  var idx = 0;
  var total = 2;
  function slideHtml() {
    if (idx === 0) {
      return "<div class=\"ob-slide\">" +
        "<div class=\"ob-brand\">peng<span class=\"peng-o\">o</span></div>" +
        "<h2 class=\"ob-title ob-welcome-title\">Prepare for your JLPT<br>one day at a time</h2>" +
        "<p class=\"ob-sub\">Kanji &bull; Vocabulary &bull; Grammar<small>Exam prep from N5 to N1</small></p>" +
        "<div class=\"ob-scene\" aria-hidden=\"true\"><div class=\"ob-cloud c1\"></div><div class=\"ob-cloud c2\"></div>" +
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
    return "Try the guided tour &#x2192;";
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
      if (last) { finish(true); return; }
      idx++; draw();
    });
    var back = root.querySelector(".ob-back");
    if (back) back.addEventListener("click", function () { if (idx > 0) { idx--; draw(); } });
    root.querySelector(".ob-skip").addEventListener("click", function () { finish(false); });
  }
  function finish(tour) {
    if (!tour) markOnboarded();
    if (typeof studyTimeTick !== 'undefined') studyTimeTick = Date.now();
    window.OBBack = null;
    root.remove();
    document.body.classList.remove("ob-open");
    try { document.documentElement.classList.remove("ob-boot"); } catch (e) {}
    if (typeof onDone === "function") onDone(!!tour);
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
    finish(false); return true;
  };
  document.body.appendChild(root);
  draw();
}
