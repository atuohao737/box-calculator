// ============================================================
// Module: StorageManager — 本地存储管理
// ============================================================
window.StorageManager = (function() {
  'use strict';
  const KEY_BOX = 'box-calc-saved-box-specs';
  const KEY_CRATE = 'box-calc-saved-crate-specs';
  const KEY_HISTORY = 'box-calc-history';

  function loadBoxSpecs() {
    try { return JSON.parse(localStorage.getItem(KEY_BOX) || '[]'); }
    catch(e) { return []; }
  }

  function saveBoxSpecs(specs) {
    localStorage.setItem(KEY_BOX, JSON.stringify(specs));
  }

  function loadCrateSpecs() {
    try { return JSON.parse(localStorage.getItem(KEY_CRATE) || '[]'); }
    catch(e) { return []; }
  }

  function saveCrateSpecs(specs) {
    localStorage.setItem(KEY_CRATE, JSON.stringify(specs));
  }

  function saveHistory(entry) {
    let hist = loadHistoryRaw();
    hist.unshift(entry);
    if (hist.length > 50) hist = hist.slice(0, 50);
    try { localStorage.setItem(KEY_HISTORY, JSON.stringify(hist)); } catch(e) {}
  }

  function loadHistoryRaw() {
    try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]'); } catch(e) { return []; }
  }

  function deleteHistory(idx) {
    let hist = loadHistoryRaw();
    hist.splice(idx, 1);
    localStorage.setItem(KEY_HISTORY, JSON.stringify(hist));
  }

  function clearHistory() {
    localStorage.removeItem(KEY_HISTORY);
  }

  return { loadBoxSpecs, saveBoxSpecs, loadCrateSpecs, saveCrateSpecs, saveHistory, loadHistoryRaw, deleteHistory, clearHistory };
})();
