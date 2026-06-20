// ============================================================
// Module: AppState — 全局状态管理
// ============================================================
window.AppState = (function() {
  'use strict';
  const BOX_COLORS = ['#4f9cf9','#52c41a','#fa8c16','#f759ab','#722ed1','#13c2c2','#ff4d4f','#a0d911'];
  const CRATE_COLORS = ['#e6f4ff','#f6ffed','#fff7e6','#f9f0ff','#e6fffb','#fff0f6','#fcffe6','#f0f5ff'];

  let boxes = [];
  let boxIdCounter = 0;
  let crateIdCounter = 0;
  let crates = []; // 多个木箱规格 [{id, l, w, h, name, maxWeight}]
  let calcResults = [];
  let mixResult = null;
  let batchResults = []; // 批量计算结果 [{crate, calcResults, mixResult}]
  let reverseCrateList = []; // 反推模式标准木箱库
  let currentMode = 'single'; // 'single' | 'mixed' | 'reverse'
  let currentSchemeIdx = 0;
  let specManagerTab = 'box';
  let maxWeight = ''; // 木箱最大承重(kg) - 兼容旧版单木箱
  let batchMode = false; // 批量模式开关
  let batchActiveCrateIdx = 0; // 批量结果中当前选中的木箱索引
  // 反推模式
  let reverseResult = null; // { crates: [{crate, boxCount, utilRate, weightRate, boxes:[...]}], totalCrates, totalUtilRate }
  let reverseActiveCrateIdx = 0; // 反推结果中当前选中的木箱索引

  function addBox(l, w, h, name) {
    const id = ++boxIdCounter;
    const colorIdx = boxes.length % BOX_COLORS.length;
    boxes.push({ id, l: l || '', w: w || '', h: h || '', name: name || '纸箱 ' + id, color: BOX_COLORS[colorIdx], qty: '', keepUpright: false, weight: '' });
    return id;
  }

  function removeBox(id) { boxes = boxes.filter(b => b.id !== id); }

  function getBoxValues() {
    return boxes.map(b => ({ ...b }));
  }

  function getCrateValues() {
    return crates.map(c => ({ ...c }));
  }

  // 从 DOM 同步纸箱和木箱的实时值到内存（分离 DOM 读取与状态访问）
  function syncFromDOM() {
    boxes.forEach(b => {
      const elL = document.getElementById('bl-' + b.id);
      const elW = document.getElementById('bw-' + b.id);
      const elH = document.getElementById('bh-' + b.id);
      const elN = document.getElementById('bn-' + b.id);
      const elQ = document.getElementById('bq-' + b.id);
      const elKU = document.getElementById('bu-' + b.id);
      const elC = document.getElementById('bc-' + b.id);
      const elWt = document.getElementById('bwt-' + b.id);
      b.l = elL && elL.value !== '' ? parseFloat(elL.value) : b.l;
      b.w = elW && elW.value !== '' ? parseFloat(elW.value) : b.w;
      b.h = elH && elH.value !== '' ? parseFloat(elH.value) : b.h;
      b.name = elN ? elN.value : b.name;
      b.qty = elQ ? elQ.value : (b.qty || '');
      b.keepUpright = elKU ? elKU.checked : (b.keepUpright || false);
      b.enabled = elC ? elC.checked : (b.enabled !== false);
      b.weight = elWt && elWt.value !== '' ? parseFloat(elWt.value) : (b.weight || '');
    });
    // 同步批量模式下的木箱值
    if (batchMode) {
      crates.forEach(function(c) {
        var elL = document.getElementById('cl-' + c.id);
        var elW = document.getElementById('cw-' + c.id);
        var elH = document.getElementById('ch-' + c.id);
        var elMW = document.getElementById('cmw-' + c.id);
        c.l = (elL && elL.value !== '') ? parseFloat(elL.value) : c.l;
        c.w = (elW && elW.value !== '') ? parseFloat(elW.value) : c.w;
        c.h = (elH && elH.value !== '') ? parseFloat(elH.value) : c.h;
        c.maxWeight = (elMW && elMW.value !== '') ? parseFloat(elMW.value) : (c.maxWeight || 0);
      });
    }
  }

  function updateBoxName(id, name) {
    const b = boxes.find(x => x.id === id);
    if (b) b.name = name;
  }

  function toggleBoxEnabled(id, checked) {
    const b = boxes.find(x => x.id === id);
    if (b) {
      b.enabled = checked;
      const el = document.getElementById('box-item-' + id);
      if (el) { el.classList.toggle('box-item-disabled', !checked); }
    }
  }

  // 木箱管理
  function addCrate(l, w, h, name, maxW) {
    const id = ++crateIdCounter;
    const colorIdx = crates.length % CRATE_COLORS.length;
    crates.push({ id, l: l || '', w: w || '', h: h || '', name: name || '木箱 ' + id, maxWeight: maxW || '', color: CRATE_COLORS[colorIdx] });
    return id;
  }

  function removeCrate(id) { crates = crates.filter(c => c.id !== id); }

  function getCrateValues() {
    if (batchMode && crates.length > 0) {
      return crates.map(c => ({ ...c }));
    }
    // 非批量模式，返回单木箱
    const l = parseFloat(document.getElementById('c-l').value) || 0;
    const w = parseFloat(document.getElementById('c-w').value) || 0;
    const h = parseFloat(document.getElementById('c-h').value) || 0;
    const maxW = parseFloat(document.getElementById('c-max-weight').value) || 0;
    return [{ id: 0, l, w, h, name: '木箱', maxWeight: maxW, color: '#e6f4ff' }];
  }

  function updateCrateName(id, name) {
    const c = crates.find(x => x.id === id);
    if (c) c.name = name;
  }

  function reset() {
    boxes = []; boxIdCounter = 0; crateIdCounter = 0; crates = [];
    calcResults = []; mixResult = null; batchResults = [];
    currentMode = 'single'; currentSchemeIdx = 0; maxWeight = '';
    batchMode = false; batchActiveCrateIdx = 0;
    reverseResult = null; reverseActiveCrateIdx = 0;
    reverseCrateList = [];
  }

  return {
    BOX_COLORS, CRATE_COLORS,
    get boxes() { return boxes; },
    set boxes(v) { boxes = v; },
    get boxIdCounter() { return boxIdCounter; },
    set boxIdCounter(v) { boxIdCounter = v; },
    get crateIdCounter() { return crateIdCounter; },
    set crateIdCounter(v) { crateIdCounter = v; },
    get crates() { return crates; },
    set crates(v) { crates = v; },
    get calcResults() { return calcResults; },
    set calcResults(v) { calcResults = v; },
    get mixResult() { return mixResult; },
    set mixResult(v) { mixResult = v; },
    get batchResults() { return batchResults; },
    set batchResults(v) { batchResults = v; },
    get currentMode() { return currentMode; },
    set currentMode(v) { currentMode = v; },
    get currentSchemeIdx() { return currentSchemeIdx; },
    set currentSchemeIdx(v) { currentSchemeIdx = v; },
    get specManagerTab() { return specManagerTab; },
    set specManagerTab(v) { specManagerTab = v; },
    get maxWeight() { return maxWeight; },
    set maxWeight(v) { maxWeight = v; },
    get batchMode() { return batchMode; },
    set batchMode(v) { batchMode = v; },
    get batchActiveCrateIdx() { return batchActiveCrateIdx; },
    set batchActiveCrateIdx(v) { batchActiveCrateIdx = v; },
    get reverseResult() { return reverseResult; },
    set reverseResult(v) { reverseResult = v; },
    get reverseActiveCrateIdx() { return reverseActiveCrateIdx; },
    set reverseActiveCrateIdx(v) { reverseActiveCrateIdx = v; },
    get reverseCrateList() { return reverseCrateList; },
    set reverseCrateList(v) { reverseCrateList = v; },
    addBox, removeBox, getBoxValues, updateBoxName, toggleBoxEnabled, reset,
    addCrate, removeCrate, getCrateValues, updateCrateName,
    syncFromDOM
  };
})();
