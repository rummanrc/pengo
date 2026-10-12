"use strict";
const APP_VERSION = "1.0.0";
const Platform = {
  version: APP_VERSION,
  isNative: typeof window !== "undefined" && !!window.KnowKanjiNative,
  isCapacitor: typeof window !== "undefined" && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()),
  get nativePlatform() {
    if (this.isNative) return typeof window.KnowKanjiNative.getPlatform === "function" ? window.KnowKanjiNative.getPlatform() : "android";
    return this.isCapacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : "web";
  },
  get isNativeApp() { return this.isNative || this.isCapacitor; },
  get isAndroidApp() { return this.nativePlatform === "android"; },
  get isIOSApp() { return this.nativePlatform === "ios"; },
  backingStoreNote() {
    return this.isNativeApp
      ? "Progress is stored privately on this device (WebView localStorage). Export a backup before uninstalling."
      : "Progress is stored privately in this browser (localStorage). Export a backup before switching devices.";
  },
  async exportJson(filename, text) {
    if (window.KnowKanjiNative && typeof window.KnowKanjiNative.exportJson === "function") {
      window.KnowKanjiNative.exportJson(filename, text);
      return true;
    }
    try {
      if (navigator.share && navigator.canShare) {
        const file = new File([text], filename, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return true; }
      }
    } catch (e) { }
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    return true;
  },
  receiveImport(text) {
    if (typeof window.importBackupText === "function") window.importBackupText(text);
  },
  setDarkTheme(dark) {
    if (window.KnowKanjiNative && typeof window.KnowKanjiNative.setDarkTheme === "function") {
      window.KnowKanjiNative.setDarkTheme(!!dark);
    }
  },
  handleBackPress() {
    const h = String(location.hash || "#/");
    if (h && h !== "#/" && h !== "#") { history.back(); return true; }
    return false;
  }
};
window.Platform = Platform;
window.APP_VERSION = APP_VERSION;
