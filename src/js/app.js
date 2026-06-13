// ============================================================
// Module: App — 应用主控制器（对外暴露的公共 API）
// ============================================================
window.App = (function() {
  'use strict';
  try {
  const S = AppState;
  const PE = PackingEngine;
  const SM = StorageManager;
  const V3 = Visualizer3D;
  const UI = UIRenderer;

  // 主题切换
  function toggleTheme() {
    var body = document.body;
    var btn = document.getElementById('btn-theme-toggle');
    body.classList.toggle('dark-theme');
    var isDark = body.classList.contains('dark-theme');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    try { localStorage.setItem('box-calc-theme', isDark ? 'dark' : 'light'); } catch(e) {}
  }

  function initTheme() {
    var saved = 'light';
    try { saved = localStorage.getItem('box-calc-theme') || 'light'; } catch(e) {}
    if (saved === 'dark') {
      document.body.classList.add('dark-theme');
      var btn = document.getElementById('btn-theme-toggle');
      if (btn) btn.textContent = '☀️';
    }
  }

  // 侧边栏（移动端）
  function openSidebar() {
    document.getElementById('sidebar-panel').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');
  }

  function closeSidebar() {
    document.getElementById('sidebar-panel').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  }

  // 模式切换
  function setMode(mode) {
    var prevMode = S.currentMode;
    S.currentMode = mode;
    document.getElementById('mode-btn-single').classList.toggle('active', mode === 'single');
    document.getElementById('mode-btn-mixed').classList.toggle('active', mode === 'mixed');
    document.getElementById('mode-btn-reverse').classList.toggle('active', mode === 'reverse');
    document.getElementById('mode-single-hint').style.display = mode === 'single' ? 'block' : 'none';
    document.getElementById('mode-mixed-hint').style.display = mode === 'mixed' ? 'block' : 'none';
    document.getElementById('mode-reverse-hint').style.display = mode === 'reverse' ? 'block' : 'none';
    // 策略选择器仅在混装模式显示
    document.getElementById('strategy-row').style.display = mode === 'mixed' ? 'flex' : 'none';
    // 反推模式下显示标准木箱库区域
    var reverseCrateArea = document.getElementById('reverse-crate-area');
    var normalCrateArea = document.getElementById('single-crate-area');
    var multiCrateArea = document.getElementById('multi-crate-area');
    var batchBtn = document.getElementById('batch-mode-btn');
    if (mode === 'reverse') {
      if (reverseCrateArea) reverseCrateArea.style.display = '';
      if (normalCrateArea) normalCrateArea.style.display = 'none';
      if (multiCrateArea) multiCrateArea.style.display = 'none';
      if (batchBtn) batchBtn.style.display = 'none';
      document.getElementById('single-crate-actions').style.display = 'none';
    } else {
      if (reverseCrateArea) reverseCrateArea.style.display = 'none';
      if (normalCrateArea) normalCrateArea.style.display = S.batchMode ? 'none' : '';
      if (multiCrateArea) multiCrateArea.style.display = S.batchMode ? '' : 'none';
      if (batchBtn) batchBtn.style.display = '';
      document.getElementById('single-crate-actions').style.display = S.batchMode ? 'none' : '';
    }
    // 从反推模式切到其他模式时，清空需求数量输入框
    // 反推模式的"需求数量"=总需求数（跨多个木箱），混装/单品模式的"需求数量"=每木箱限制
    // 两者语义不同，残留值会导致计算异常
    if (prevMode === 'reverse' && mode !== 'reverse') {
      document.querySelectorAll('.qty-input').forEach(function(el) { el.value = ''; });
    }
    UI.renderBoxList();
  }

  // 优化策略切换
  function setStrategy(strategy) {
    S.mixStrategy = strategy;
    document.getElementById('strategy-btn-count').classList.toggle('active', strategy === 'count');
    document.getElementById('strategy-btn-util').classList.toggle('active', strategy === 'util');
  }

  // 纸箱管理
  function addBox(l, w, h, name) {
    var id = S.addBox(l, w, h, name);
    UI.renderBoxList();
    return id;
  }

  function removeBox(id) {
    S.removeBox(id);
    UI.renderBoxList();
  }

  function updateBoxName(id, name) {
    S.updateBoxName(id, name);
  }

  // 规格管理
  function saveCurrentBoxSpec(boxId) {
    const b = S.boxes.find(x => x.id === boxId);
    if (!b) return;
    const l = parseFloat(document.getElementById('bl-' + b.id)?.value) || b.l;
    const w = parseFloat(document.getElementById('bw-' + b.id)?.value) || b.w;
    const h = parseFloat(document.getElementById('bh-' + b.id)?.value) || b.h;
    if (!l || !w || !h || l <= 0) { alert('请先填写完整的纸箱尺寸'); return; }
    const name = document.getElementById('bn-' + b.id)?.value || b.name;
    const weight = parseFloat(document.getElementById('bwt-' + b.id)?.value) || '';
    const specs = SM.loadBoxSpecs();
    specs.push({ id: Date.now(), name, l, w, h, color: b.color, qty: '', keepUpright: false, weight, createdAt: new Date().toISOString() });
    SM.saveBoxSpecs(specs);
    UI.flashMsg('纸箱规格已保存');
  }

  function deleteBoxSpec(specId) {
    const specs = SM.loadBoxSpecs().filter(function(s) { return s.id !== specId; });
    SM.saveBoxSpecs(specs);
    UI.renderSpecManagerContent();
    UI.flashMsg('纸箱规格已删除');
  }

  function importBoxSpec(specId) {
    const specs = SM.loadBoxSpecs();
    const spec = specs.find(function(s) { return s.id === specId; });
    if (!spec) return;
    const id = ++S.boxIdCounter;
    const colorIdx = S.boxes.length % S.BOX_COLORS.length;
    S.boxes.push({ id, l: spec.l, w: spec.w, h: spec.h, name: spec.name, color: S.BOX_COLORS[colorIdx], qty: '', keepUpright: spec.keepUpright || false, weight: spec.weight || '' });
    UI.renderBoxList();
    closeSpecManager();
    UI.flashMsg('已导入: ' + spec.name);
  }

  function saveCrateSpec() {
    const cL = parseFloat(document.getElementById('c-l').value);
    const cW = parseFloat(document.getElementById('c-w').value);
    const cH = parseFloat(document.getElementById('c-h').value);
    const maxW = parseFloat(document.getElementById('c-max-weight').value) || 0;
    if (!cL || !cW || !cH || cL <= 0) { alert('请先填写完整的木箱尺寸'); return; }
    const specs = SM.loadCrateSpecs();
    specs.push({ id: Date.now(), name: '木箱 ' + cL + '×' + cW + '×' + cH, l: cL, w: cW, h: cH, maxWeight: maxW, createdAt: new Date().toISOString() });
    SM.saveCrateSpecs(specs);
    UI.flashMsg('木箱尺寸已保存');
  }

  function importCrateSpec(specId) {
    const specs = SM.loadCrateSpecs();
    const spec = specs.find(s => s.id === specId);
    if (!spec) return;
    document.getElementById('c-l').value = spec.l;
    document.getElementById('c-w').value = spec.w;
    document.getElementById('c-h').value = spec.h;
    document.getElementById('c-max-weight').value = spec.maxWeight || '';
    updateCrateVol();
    closeSpecManager();
    UI.flashMsg('已导入: ' + spec.name);
  }

  function deleteCrateSpec(specId) {
    const specs = SM.loadCrateSpecs().filter(function(s) { return s.id !== specId; });
    SM.saveCrateSpecs(specs);
    UI.renderSpecManagerContent();
    UI.flashMsg('木箱尺寸已删除');
  }

  function showSpecManager(defaultTab) {
    S.specManagerTab = defaultTab || 'box';
    document.getElementById('spec-manager-modal').style.display = 'flex';
    switchSpecTab(S.specManagerTab);
  }

  function closeSpecManager(e) {
    if (e) {
      const overlay = document.getElementById('spec-manager-modal');
      if (e.target !== overlay) return;
    }
    document.getElementById('spec-manager-modal').style.display = 'none';
  }

  function switchSpecTab(tab) {
    S.specManagerTab = tab;
    document.getElementById('modal-tab-box').classList.toggle('active', tab === 'box');
    document.getElementById('modal-tab-crate').classList.toggle('active', tab === 'crate');
    UI.renderSpecManagerContent();
  }

  // ============================================================
  // 批量模式管理
  // ============================================================
  function toggleBatchMode() {
    S.batchMode = !S.batchMode;
    const btn = document.getElementById('batch-mode-btn');
    const addBtn = document.getElementById('crate-add-btn');
    const singleArea = document.getElementById('single-crate-area');
    const multiArea = document.getElementById('multi-crate-area');
    const singleActions = document.getElementById('single-crate-actions');

    if (S.batchMode) {
      btn.classList.add('active-btn');
      btn.textContent = '📋 批量 ✓';
      addBtn.style.display = '';
      singleArea.style.display = 'none';
      multiArea.style.display = '';
      singleActions.style.display = 'none';
      // 如果没有木箱，从当前单木箱读取并创建第一个
      if (S.crates.length === 0) {
        const l = parseFloat(document.getElementById('c-l').value) || 1200;
        const w = parseFloat(document.getElementById('c-w').value) || 1000;
        const h = parseFloat(document.getElementById('c-h').value) || 800;
        const mw = parseFloat(document.getElementById('c-max-weight').value) || '';
        S.addCrate(l, w, h, '木箱 ' + l + '×' + w + '×' + h, mw);
      }
      renderCrateList();
    } else {
      btn.classList.remove('active-btn');
      btn.textContent = '📋 批量';
      addBtn.style.display = 'none';
      singleArea.style.display = '';
      multiArea.style.display = 'none';
      singleActions.style.display = '';
      // 恢复单木箱输入
      if (S.crates.length > 0) {
        const c = S.crates[0];
        document.getElementById('c-l').value = c.l || 1200;
        document.getElementById('c-w').value = c.w || 1000;
        document.getElementById('c-h').value = c.h || 800;
        document.getElementById('c-max-weight').value = c.maxWeight || '';
        updateCrateVol();
      }
    }
    UI.renderBoxList(); // 刷新纸箱列表（混装数量行显示）
  }

  function addCrateUI(l, w, h, name, maxW) {
    const id = S.addCrate(l, w, h, name, maxW);
    renderCrateList();
    return id;
  }

  function removeCrateUI(id) {
    S.removeCrate(id);
    renderCrateList();
  }

  function renderCrateList() {
    const list = document.getElementById('crate-list');
    const empty = document.getElementById('crate-list-empty');
    const crates = S.crates;

    if (crates.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = crates.map(function(c) {
      const vol = (parseFloat(c.l) > 0 && parseFloat(c.w) > 0 && parseFloat(c.h) > 0)
        ? ' | 容积: ' + (c.l * c.w * c.h / 1e6).toFixed(0) + ' cm³'
        : '';
      return '<div class="crate-item">' +
        '<div class="crate-item-header">' +
          '<span class="crate-label">' +
            '<span class="color-dot" style="background:' + c.color + '"></span>' +
            '<input id="cn-' + c.id + '" value="' + (c.name || '').replace(/"/g, '&quot;') + '"' +
              ' style="border:none;background:transparent;font-size:13px;font-weight:500;outline:none;min-width:60px;max-width:120px;cursor:text;padding:2px 4px;border-radius:4px"' +
              ' onchange="App.updateCrateNameUI(' + c.id + ', this.value)"' +
              ' onfocus="this.style.background=\'#f0f5ff\';this.style.outline=\'1px solid #1677ff\'"' +
              ' onblur="this.style.background=\'transparent\';this.style.outline=\'none\'"' +
              ' title="点击编辑名称">' +
          '</span>' +
          '<button class="remove-btn" onclick="App.removeCrateUI(' + c.id + ')">×</button>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field-group"><label>长 L (mm)</label><input type="number" id="cl-' + c.id + '" value="' + c.l + '" min="1" oninput="App.updateCrateVolUI(' + c.id + ')"></div>' +
          '<div class="field-group"><label>宽 W (mm)</label><input type="number" id="cw-' + c.id + '" value="' + c.w + '" min="1" oninput="App.updateCrateVolUI(' + c.id + ')"></div>' +
          '<div class="field-group"><label>高 H (mm)</label><input type="number" id="ch-' + c.id + '" value="' + c.h + '" min="1" oninput="App.updateCrateVolUI(' + c.id + ')"></div>' +
        '</div>' +
        '<div class="crate-vol-info" id="cvol-' + c.id + '">' + vol + '</div>' +
        '<div class="form-row two" style="margin-top:4px">' +
          '<div class="field-group"><label>最大承重 (kg)</label><input type="number" id="cmw-' + c.id + '" value="' + (c.maxWeight || '') + '" min="0" placeholder="不限制" step="0.1"></div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function updateCrateVolUI(id) {
    const elL = document.getElementById('cl-' + id);
    const elW = document.getElementById('cw-' + id);
    const elH = document.getElementById('ch-' + id);
    const volEl = document.getElementById('cvol-' + id);
    if (!elL || !elW || !elH || !volEl) return;
    const l = parseFloat(elL.value) || 0;
    const w = parseFloat(elW.value) || 0;
    const h = parseFloat(elH.value) || 0;
    let text = '';
    if (l > 0 && w > 0 && h > 0) {
      text = '容积: ' + (l * w * h / 1e6).toFixed(0) + ' cm³ = ' + (l * w * h / 1e9).toFixed(4) + ' m³';
    }
    volEl.textContent = text;
  }

  function updateCrateNameUI(id, name) {
    S.updateCrateName(id, name);
  }

  function batchImportCrates() {
    const specs = SM.loadCrateSpecs();
    if (specs.length === 0) { alert('木箱规格库为空，请先在管理中保存木箱尺寸'); return; }
    // 选中当前已有的木箱尺寸，避免重复导入
    const existingKeys = new Set(S.crates.map(function(c) {
      return c.l + '|' + c.w + '|' + c.h;
    }));
    let added = 0;
    specs.forEach(function(spec) {
      const key = spec.l + '|' + spec.w + '|' + spec.h;
      if (!existingKeys.has(key)) {
        S.addCrate(spec.l, spec.w, spec.h, spec.name, spec.maxWeight || '');
        existingKeys.add(key);
        added++;
      }
    });
    renderCrateList();
    UI.flashMsg('已导入 ' + added + ' 个木箱规格' + (specs.length - added > 0 ? '（跳过 ' + (specs.length - added) + ' 个重复）' : ''));
  }

  // ============================================================
  // 计算进度管理
  // ============================================================
  var _calcStartTime = 0;
  var _calcTimerInterval = null;
  var _calcCancelled = false;

  function showCalcProgress(subText) {
    var overlay = document.getElementById('calc-overlay');
    var sub = document.getElementById('calc-progress-sub');
    var bar = document.getElementById('calc-progress-bar');
    var timeEl = document.getElementById('calc-progress-time');
    var title = document.getElementById('calc-progress-title');
    _calcCancelled = false;
    if (overlay) overlay.classList.add('show');
    if (title) title.textContent = '正在计算...';
    if (sub) sub.textContent = subText || '请稍候';
    if (bar) bar.style.width = '0%';
    if (timeEl) timeEl.textContent = '0.0s';
    _calcStartTime = Date.now();
    _calcTimerInterval = setInterval(function() {
      var elapsed = ((Date.now() - _calcStartTime) / 1000).toFixed(1);
      if (timeEl) timeEl.textContent = elapsed + 's';
    }, 100);
  }

  function updateCalcProgress(current, total, subText) {
    var sub = document.getElementById('calc-progress-sub');
    var bar = document.getElementById('calc-progress-bar');
    var pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (sub) sub.textContent = subText || '';
    if (bar) bar.style.width = pct + '%';
  }

  function hideCalcProgress() {
    _calcCancelled = false;
    var overlay = document.getElementById('calc-overlay');
    if (overlay) overlay.classList.remove('show');
    if (_calcTimerInterval) { clearInterval(_calcTimerInterval); _calcTimerInterval = null; }
  }

  function cancelCalc() {
    _calcCancelled = true;
    var title = document.getElementById('calc-progress-title');
    if (title) title.textContent = '已取消';
    var sub = document.getElementById('calc-progress-sub');
    if (sub) sub.textContent = '正在结束计算...';
    setTimeout(function() { hideCalcProgress(); }, 300);
  }

  // ============================================================
  // 计算（支持批量模式，含进度显示）
  // ============================================================
  function calculate() {
    // 反推模式走独立计算流程
    if (S.currentMode === 'reverse') {
      calcReverse();
      return;
    }

    var errDiv = document.getElementById('calc-error');
    errDiv.style.display = 'none';
    errDiv.innerHTML = '';

    var gap = parseFloat(document.getElementById('opt-gap').value) || 0;
    var layerGap = parseFloat(document.getElementById('opt-layer-gap').value) || 0;
    var allowRotate = document.getElementById('opt-rotate').checked;
    var retryCount = parseInt(document.getElementById('opt-retry').value) || 10;

    S.syncFromDOM();
    var currentBoxes = S.getBoxValues();
    if (currentBoxes.length === 0) { UI.showError('请至少添加一种纸箱'); return; }
    var activeBoxes = currentBoxes.filter(b => b.enabled !== false);
    if (activeBoxes.length === 0) { UI.showError('请至少勾选一种纸箱参与计算'); return; }

    var errors = [];
    for (var ei = 0; ei < activeBoxes.length; ei++) {
      var b = activeBoxes[ei];
      if (!b.l || !b.w || !b.h || b.l <= 0 || b.w <= 0 || b.h <= 0)
        errors.push(UI.escapeHtml(b.name) + ' 的尺寸不完整');
    }
    if (errors.length) { UI.showError(errors.join('<br>')); return; }

    // 获取木箱列表
    var crateList;
    if (S.batchMode) {
      crateList = S.getCrateValues();
      if (crateList.length === 0) { UI.showError('请至少添加一种木箱规格'); return; }
      for (var ci2 = 0; ci2 < crateList.length; ci2++) {
        var c2 = crateList[ci2];
        if (!c2.l || !c2.w || !c2.h || c2.l <= 0 || c2.w <= 0 || c2.h <= 0) {
          UI.showError('木箱 "' + UI.escapeHtml(c2.name) + '" 尺寸不完整'); return;
        }
      }
    } else {
      crateList = S.getCrateValues();
      if (!crateList[0].l || !crateList[0].w || !crateList[0].h) {
        UI.showError('请正确填写木箱尺寸（必须大于0）'); return;
      }
    }

    // 显示进度条，然后用 setTimeout 让浏览器先渲染
    var modeLabel = S.currentMode === 'single' ? '单品对比' : '混装';
    var totalCrates = crateList.length;
    showCalcProgress(modeLabel + ' · 准备计算...');

    setTimeout(function() {
      _doCalculate(crateList, activeBoxes, gap, layerGap, allowRotate, retryCount, totalCrates, modeLabel);
    }, 60);
  }

  function _doCalculate(crateList, activeBoxes, gap, layerGap, allowRotate, retryCount, totalCrates, modeLabel) {
    S.batchResults = [];
    S.calcResults = [];
    S.mixResult = null;

    var ci = 0;

    function finishCrate(crCalcResults, crMixResult) {
      S.batchResults.push({
        crate: crateList[ci],
        calcResults: crCalcResults,
        mixResult: crMixResult
      });
      ci++;
      if (ci < crateList.length) {
        setTimeout(processNextCrate, 0);
      } else {
        finishCalc();
      }
    }

    function processNextCrate() {
      try {
        if (ci >= crateList.length || _calcCancelled) {
          finishCalc();
          return;
        }

        var crate = crateList[ci];
        var cL = parseFloat(crate.l);
        var cW = parseFloat(crate.w);
        var cH = parseFloat(crate.h);
        var maxWeight = parseFloat(crate.maxWeight) || 0;

        var progressText = modeLabel + ' · 正在计算 ' + (ci + 1) + '/' + totalCrates + ' 号木箱';
        updateCalcProgress(ci + 1, totalCrates, progressText);

        if (S.currentMode === 'single') {
          var sortedBoxes = activeBoxes.slice().sort(function(a, b2) {
            var wa = parseFloat(a.weight) || 0, wb = parseFloat(b2.weight) || 0;
            return wb - wa;
          });
          var crCalcResults = sortedBoxes.map(function(b) {
            var res = PE.calcPacking(cL, cW, cH, b.l, b.w, b.h, gap, layerGap, allowRotate, b.keepUpright);
            var bw = parseFloat(b.weight) || 0;
            var totalWeight = res ? res.count * bw : 0;
            var weightLimited = maxWeight > 0 && totalWeight > maxWeight;
            if (res && weightLimited) {
              var maxCountByWeight = Math.floor(maxWeight / bw);
              res.weightLimited = true;
              res.originalCount = res.count;
              res.maxWeight = maxWeight;
              res.totalWeight = maxWeight;
              res.weightRate = 1.0;
              if (maxCountByWeight < res.count) {
                res.count = maxCountByWeight;
                var volRatio = maxCountByWeight / res.originalCount;
                res.utilRate = res.utilRate * volRatio;
              }
            } else if (res && maxWeight > 0) {
              res.totalWeight = totalWeight;
              res.maxWeight = maxWeight;
              res.weightRate = totalWeight / maxWeight;
              res.weightLimited = false;
            }
            return { box: b, crateL: cL, crateW: cW, crateH: cH, gap: gap, result: res };
          });
          var bestIdx = 0;
          for (var i = 1; i < crCalcResults.length; i++) {
            var a2 = crCalcResults[i].result, b3 = crCalcResults[bestIdx].result;
            if (!b3 || (a2 && a2.count > b3.count)) bestIdx = i;
            else if (a2 && b3 && a2.count === b3.count && a2.utilRate > b3.utilRate) bestIdx = i;
          }
          if (crCalcResults[bestIdx] && crCalcResults[bestIdx].result) crCalcResults[bestIdx].isBest = true;
          finishCrate(crCalcResults, null);
        } else {
          // 混装模式 — 异步重试，每条重试后让出主线程
          var sortedBoxes2 = activeBoxes.slice().sort(function(a, b2) {
            var wa = parseFloat(a.weight) || 0, wb = parseFloat(b2.weight) || 0;
            return wb - wa;
          });
          var boxConfigs = sortedBoxes2.map(function(b) {
            var qtyRaw = b.qty;
            var qty = (qtyRaw === '' || qtyRaw === undefined || qtyRaw === null) ? null : Math.max(1, parseInt(qtyRaw) || 1);
            return { box: b, qty: qty };
          });

          var mixBest = null;
          var mixRound = 0;
          var maxRounds = Math.max(1, Math.min(50, retryCount || 10));
          var isUtilStrat = S.mixStrategy === 'util';
          var mixIndices = boxConfigs.map(function(_, i) { return i; });

          // 第一轮：体积降序
          mixBest = PE.calcMixedPackingOnce(cL, cW, cH, boxConfigs, gap, allowRotate, null);
          if (!mixBest || mixBest.totalCount === 0) {
            finishCrate([], null);
            return;
          }
          // 空间优先 → 智能组合探索
          if (isUtilStrat) {
            var freeCount = 0;
            for (var fi = 0; fi < boxConfigs.length; fi++) {
              if (boxConfigs[fi].qty === null) freeCount++;
            }
            if (freeCount >= 2 && freeCount <= 3) {
              var explorer = PE.exploreCombinations(cL, cW, cH, boxConfigs, gap, allowRotate);
              if (explorer && explorer.utilRate > mixBest.utilRate) mixBest = explorer;
            }
          }
          mixRound = 1;

          runNextRetry();

          function runNextRetry() {
            if (_calcCancelled) { finishCrate([], null); return; }
            // 更新进度显示（使用小数推进来反映重试进度）
            var crateProgress = ci + 1 + (mixRound - 1) / maxRounds;
            updateCalcProgress(crateProgress, totalCrates, '混装 · 重试 ' + mixRound + '/' + maxRounds);

            if (mixRound >= maxRounds) {
              var filled = PE.fillGaps(mixBest, boxConfigs, cL, cW, cH, gap, allowRotate);
              if (filled) mixBest = filled;
              if (mixBest) {
                mixBest.displayCrateL = cL;
                mixBest.displayCrateW = cW;
                mixBest.displayCrateH = cH;
                mixBest.strategy = S.mixStrategy;
                if (maxWeight > 0) {
                  var tW = 0;
                  (mixBest.placed || []).forEach(function(p) {
                    var bw2 = parseFloat(boxConfigs[p.boxIdx] && boxConfigs[p.boxIdx].box && boxConfigs[p.boxIdx].box.weight) || 0;
                    tW += bw2;
                  });
                  mixBest.totalWeight = tW;
                  mixBest.maxWeight = maxWeight;
                  mixBest.weightRate = tW / maxWeight;
                  mixBest.weightOverLimit = tW > maxWeight;
                }
              }
              finishCrate([], mixBest);
              return;
            }

            mixRound++;

            // Fisher-Yates 洗牌
            var shuffled = mixIndices.slice();
            for (var si = shuffled.length - 1; si > 0; si--) {
              var sj = Math.floor(Math.random() * (si + 1));
              var tmp = shuffled[si]; shuffled[si] = shuffled[sj]; shuffled[sj] = tmp;
            }
            // 同体积段随机化
            var shuffledByVol = mixIndices.slice().sort(function(ai, bi) {
              var vA = boxConfigs[ai].box.l * boxConfigs[ai].box.w * boxConfigs[ai].box.h;
              var vB = boxConfigs[bi].box.l * boxConfigs[bi].box.w * boxConfigs[bi].box.h;
              if (Math.abs(vA - vB) < 100) return Math.random() - 0.5;
              return vB - vA;
            });

            var candidate = PE.calcMixedPackingOnce(cL, cW, cH, boxConfigs, gap, allowRotate, shuffledByVol);
            if (candidate) {
              if (isUtilStrat) {
                if (candidate.utilRate > mixBest.utilRate + 0.0001 ||
                    (Math.abs(candidate.utilRate - mixBest.utilRate) < 0.0001 && candidate.totalCount > mixBest.totalCount)) {
                  mixBest = candidate;
                }
              } else {
                if (candidate.totalCount > mixBest.totalCount ||
                    (candidate.totalCount === mixBest.totalCount && candidate.utilRate > mixBest.utilRate)) {
                  mixBest = candidate;
                }
              }
            }

            setTimeout(runNextRetry, 0);
          }
        }
      } catch(e) {
        hideCalcProgress();
        console.error('[App] 计算出错:', e);
      }
    }

    function finishCalc() {
      try {
        // 批量模式下标记推荐
        if (S.batchMode && S.batchResults.length > 1) {
          markBatchRecommendations();
        }

        // 非批量模式，把第一个结果赋给旧字段以兼容渲染
        if (!S.batchMode && S.batchResults.length > 0) {
          var br = S.batchResults[0];
          S.calcResults = br.calcResults;
          S.mixResult = br.mixResult;
        }

        SM.saveHistory({ mode: S.currentMode, calcResults: S.calcResults, mixResult: S.mixResult, batchResults: S.batchMode ? S.batchResults : null, timestamp: Date.now() });
        UI.renderResults();
        UI.renderSchemaTabs();
        S.currentSchemeIdx = 0;
        S.batchActiveCrateIdx = 0;

        var isVisualActive = document.getElementById('panel-visual').classList.contains('active');
        if (isVisualActive && V3.isReady()) {
          if (S.currentMode === 'mixed' && S.mixResult) {
            V3.renderMixedScene(S.mixResult);
          } else if (S.calcResults.length > 0) {
            V3.renderSingleScene(S.calcResults[0]);
          }
        }
        closeSidebar();
        switchTab('results');
      } finally {
        hideCalcProgress();
      }
    }

    // 启动计算
    processNextCrate();
  }

  // 批量推荐逻辑
  function markBatchRecommendations() {
    // 找最优利用率
    let bestUtilIdx = 0;
    let bestUtilVal = 0;
    let bestCountIdx = 0;
    let bestCountVal = 0;

    S.batchResults.forEach(function(br, i) {
      let maxCount = 0, maxUtil = 0;
      if (S.currentMode === 'single') {
        br.calcResults.forEach(function(cr) {
          if (cr.result && cr.result.count > maxCount) maxCount = cr.result.count;
          if (cr.result && cr.result.utilRate > maxUtil) maxUtil = cr.result.utilRate;
        });
      } else {
        if (br.mixResult) {
          maxCount = br.mixResult.totalCount;
          maxUtil = br.mixResult.utilRate;
        }
      }
      br._maxCount = maxCount;
      br._maxUtil = maxUtil;

      if (maxUtil > bestUtilVal) { bestUtilVal = maxUtil; bestUtilIdx = i; }
      if (maxCount > bestCountVal) { bestCountVal = maxCount; bestCountIdx = i; }
    });

    if (S.batchResults[bestUtilIdx]) S.batchResults[bestUtilIdx]._bestUtil = true;
    if (S.batchResults[bestCountIdx]) S.batchResults[bestCountIdx]._bestCount = true;
  }

  // Tab 切换
  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab).classList.add('active');

    // 更新移动端底部 tab
    document.querySelectorAll('.mtab').forEach(t => {
      t.classList.toggle('active', t.dataset.mtab === tab);
    });

    if (tab === 'visual') {
      setTimeout(function() {
        if (!V3.isReady()) {
          V3.init();
        } else {
          V3.resizeIfNeeded();
        }
        // 批量模式
        if (S.batchMode && S.batchResults && S.batchResults.length > 0) {
          const br = S.batchResults[S.batchActiveCrateIdx];
          if (br) {
            if (S.currentMode === 'mixed' && br.mixResult) {
              V3.renderMixedScene(br.mixResult);
            } else if (br.calcResults.length > 0) {
              // 单品模式下取装箱数最多的纸箱方案渲染3D
              var bestCr = br.calcResults.reduce(function(a, b) {
                return (a.result && a.result.count) > (b.result && b.result.count) ? a : b;
              });
              V3.renderSingleScene(bestCr);
            }
          }
        } else if (S.currentMode === 'single' && S.calcResults.length > 0) {
          V3.renderSingleScene(S.calcResults[S.currentSchemeIdx]);
        } else if (S.currentMode === 'mixed' && S.mixResult) {
          V3.renderMixedScene(S.mixResult);
        }
      }, 60);
    }
    if (tab === 'history') UI.renderHistoryList();
  }

  function switchToVisual(idx) {
    S.currentSchemeIdx = idx;
    switchTab('visual');
    document.querySelectorAll('.scheme-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  }

  function switchScheme(idx) {
    S.currentSchemeIdx = idx;
    if (S.batchMode && S.batchResults && S.batchResults.length > 0) {
      const br = S.batchResults[S.batchActiveCrateIdx];
      if (br && br.calcResults.length > idx) {
        V3.renderSingleScene(br.calcResults[idx]);
      }
    } else {
      V3.renderSingleScene(S.calcResults[idx]);
    }
    document.querySelectorAll('.scheme-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
  }

  // 历史记录
  function loadHistory(idx) {
    const hist = SM.loadHistoryRaw();
    const entry = hist[idx];
    if (!entry) return;
    S.currentMode = entry.mode || 'single';
    // 先恢复 batchMode 和 batchResults，setMode 依赖 batchMode 来决定显示哪种木箱输入区
    S.batchResults = entry.batchResults || [];
    S.batchMode = entry.batchResults ? true : false;
    setMode(S.currentMode);
    S.calcResults = entry.calcResults || [];
    S.mixResult = entry.mixResult || null;
    // 如果 batchMode 已开启，同步按钮状态
    if (S.batchMode) {
      var batchBtn = document.getElementById('batch-mode-btn');
      if (batchBtn) batchBtn.classList.add('active');
    }
    const ref = S.batchResults.length > 0 ? S.batchResults[0] : (entry.calcResults?.[0] || (entry.mixResult ? {
      crateL: entry.mixResult.displayCrateL || entry.mixResult.crateL_raw || entry.mixResult.crateL,
      crateW: entry.mixResult.displayCrateW || entry.mixResult.crateW_raw || entry.mixResult.crateW,
      crateH: entry.mixResult.displayCrateH || entry.mixResult.crateH_raw || entry.mixResult.crateH
    } : null));
    if (ref) {
      document.getElementById('c-l').value = ref.crateL || ref.l;
      document.getElementById('c-w').value = ref.crateW || ref.w;
      document.getElementById('c-h').value = ref.crateH || ref.h;
      updateCrateVol();
    }
    UI.renderResults();
    UI.renderSchemaTabs();
    switchTab('results');
  }

  function deleteHistory(idx) {
    SM.deleteHistory(idx);
    UI.renderHistoryList();
  }

  function clearHistoryConfirm() {
    if (confirm('确定清空所有历史记录？')) {
      SM.clearHistory();
      UI.renderHistoryList();
    }
  }

  // 工具
  function clearAll() {
    S.reset();
    UI.renderBoxList();
    document.getElementById('results-content').innerHTML = '<div class="no-result"><div class="nr-icon">📐</div><h3>等待计算</h3><p>在左侧填写木箱和纸箱尺寸，点击"开始计算"</p></div>';
    document.getElementById('scheme-tabs').innerHTML = '<span style="font-size:12px;color:#bbb">请先计算</span>';
    ['c-l','c-w','c-h'].forEach(function(id) { document.getElementById(id).value = id === 'c-l' ? '1200' : id === 'c-w' ? '1000' : '800'; });
    document.getElementById('c-max-weight').value = '';
    // 重置批量模式UI
    document.getElementById('single-crate-area').style.display = '';
    document.getElementById('multi-crate-area').style.display = 'none';
    document.getElementById('single-crate-actions').style.display = '';
    document.getElementById('batch-mode-btn').classList.remove('active-btn');
    document.getElementById('batch-mode-btn').textContent = '📋 批量';
    document.getElementById('crate-add-btn').style.display = 'none';
    document.getElementById('crate-list').innerHTML = '';
    document.getElementById('crate-list-empty').style.display = 'none';
    updateCrateVol();
    // 重置反推模式UI
    document.getElementById('reverse-crate-area').style.display = 'none';
    document.getElementById('reverse-crate-list').innerHTML = '';
    S.reverseCrateList = [];
    if (V3.isReady()) V3.clearScene();
  }

  // ============================================================
  // 反推模式
  // ============================================================
  function addReverseCrate(l, w, h, name, maxW) {
    l = l || ''; w = w || ''; h = h || ''; name = name || ''; maxW = maxW || '';
    var id = Date.now();
    S.reverseCrateList.push({ id: id, l: l, w: w, h: h, name: name, maxWeight: maxW });
    renderReverseCrateList();
  }

  function removeReverseCrate(id) {
    S.reverseCrateList = S.reverseCrateList.filter(function(c) { return c.id !== id; });
    renderReverseCrateList();
  }

  function renderReverseCrateList() {
    var listEl = document.getElementById('reverse-crate-list');
    if (!listEl) return;
    if (S.reverseCrateList.length === 0) {
      listEl.innerHTML = '<div style="color:#bbb;font-size:12px;text-align:center;padding:16px 0">暂无标准木箱，请添加或从规格库导入</div>';
      return;
    }
    listEl.innerHTML = S.reverseCrateList.map(function(c, i) {
      return '<div class="crate-item" style="position:relative">' +
        '<div class="box-item-header">' +
          '<span class="box-label">' +
            '<span style="font-size:11px;color:#bbb;font-weight:600;margin-right:4px">#' + (i + 1) + '</span>' +
            '<input id="rcn-' + c.id + '" value="' + (c.name || '').replace(/"/g, '&quot;') + '"' +
              ' style="border:none;background:transparent;font-size:13px;font-weight:500;outline:none;min-width:60px;max-width:140px;cursor:text;padding:2px 4px;border-radius:4px;color:var(--text-input)"' +
              ' onchange="App.updateReverseCrateName(' + c.id + ', this.value)"' +
              ' onfocus="this.style.background=\'var(--bg-section-hover)\';this.style.outline=\'1px solid #1677ff\'"' +
              ' onblur="this.style.background=\'transparent\';this.style.outline=\'none\'" title="点击编辑名称">' +
          '</span>' +
          '<button onclick="App.removeReverseCrate(' + c.id + ')" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:16px;padding:2px 4px;border-radius:4px;transition:color 0.2s" onmouseover="this.style.color=\'#ff4d4f\'" onmouseout="this.style.color=\'#ccc\'" title="删除">×</button>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field-group"><label>长 L (mm)</label><input type="number" id="rcl-' + c.id + '" value="' + (c.l || '') + '" min="1" style="width:100%" onchange="App.updateReverseCrateDim(' + c.id + ', \'l\', this.value)"></div>' +
          '<div class="field-group"><label>宽 W (mm)</label><input type="number" id="rcw-' + c.id + '" value="' + (c.w || '') + '" min="1" style="width:100%" onchange="App.updateReverseCrateDim(' + c.id + ', \'w\', this.value)"></div>' +
          '<div class="field-group"><label>高 H (mm)</label><input type="number" id="rch-' + c.id + '" value="' + (c.h || '') + '" min="1" style="width:100%" onchange="App.updateReverseCrateDim(' + c.id + ', \'h\', this.value)"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:4px">' +
          '<label style="font-size:11px;color:#888;display:flex;align-items:center;gap:4px">承重(kg): <input type="number" id="rcmw-' + c.id + '" value="' + (c.maxWeight || '') + '" min="0" step="0.1" placeholder="不限制" style="width:80px;border:1px solid #d9d9d9;border-radius:4px;padding:2px 4px;font-size:11px;background:var(--bg-input);color:var(--text-input)" onchange="App.updateReverseCrateDim(' + c.id + ', \'maxWeight\', this.value)"></label>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function updateReverseCrateName(id, name) {
    var c = S.reverseCrateList.find(function(x) { return x.id === id; });
    if (c) c.name = name;
  }

  function updateReverseCrateDim(id, key, val) {
    var c = S.reverseCrateList.find(function(x) { return x.id === id; });
    if (c) c[key] = val;
  }

  function batchImportReverseCrates() {
    var specs = SM.loadCrateSpecs();
    if (specs.length === 0) {
      UI.showError('木箱规格库为空，请先在规格管理中保存木箱尺寸');
      return;
    }
    specs.forEach(function(s) {
      // 避免重复导入
      var exists = S.reverseCrateList.some(function(c) {
        return c.l === s.l && c.w === s.w && c.h === s.h;
      });
      if (!exists) {
        S.reverseCrateList.push({ id: Date.now() + Math.random(), l: s.l, w: s.w, h: s.h, name: s.name || '', maxWeight: s.maxWeight || '' });
      }
    });
    renderReverseCrateList();
    UI.flashMsg('已导入 ' + specs.length + ' 种木箱规格');
  }

  function calcReverse() {
    // 清除旧的错误提示
    var errDiv = document.getElementById('calc-error');
    if (errDiv) { errDiv.style.display = 'none'; errDiv.innerHTML = ''; }

    // 获取纸箱列表
    S.syncFromDOM();
    var currentBoxes = S.getBoxValues();
    if (currentBoxes.length === 0) { UI.showError('请至少添加一种纸箱'); return; }
    var activeBoxes = currentBoxes.filter(function(b) { return b.enabled !== false; });
    if (activeBoxes.length === 0) { UI.showError('请至少勾选一种纸箱参与计算'); return; }

    // 验证纸箱尺寸
    for (var i = 0; i < activeBoxes.length; i++) {
      var b = activeBoxes[i];
      if (!b.l || !b.w || !b.h || b.l <= 0 || b.w <= 0 || b.h <= 0) {
        UI.showError(UI.escapeHtml(b.name) + ' 的尺寸不完整'); return;
      }
    }

    // 验证纸箱需求数量
    var noQtyBoxes = [];
    for (var qi = 0; qi < activeBoxes.length; qi++) {
      var bq = activeBoxes[qi];
      var qtyNum = parseInt(String(bq.qty).trim(), 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        noQtyBoxes.push(UI.escapeHtml(bq.name));
      }
    }
    if (noQtyBoxes.length > 0) {
      UI.showError('以下纸箱未填写需求数量：<br><b>' + noQtyBoxes.join('</b>、<b>') + '</b><br><span style="font-size:12px;color:#888">请为每个纸箱填写需要装入的数量</span>');
      return;
    }

    // 获取反推木箱列表
    var crateList = [];
    S.reverseCrateList.forEach(function(c) {
      var cl = parseFloat(c.l) || 0;
      var cw = parseFloat(c.w) || 0;
      var ch = parseFloat(c.h) || 0;
      var cmw = parseFloat(c.maxWeight) || 0;
      if (cl > 0 && cw > 0 && ch > 0) {
        crateList.push({ id: c.id, l: cl, w: cw, h: ch, name: c.name || ('木箱' + (crateList.length + 1)), maxWeight: cmw });
      }
    });

    if (crateList.length === 0) { UI.showError('请至少添加一种标准木箱尺寸'); return; }

    var gap = parseFloat(document.getElementById('opt-gap').value) || 0;
    var allowRotate = document.getElementById('opt-rotate').checked;

    // 构建纸箱配置
    var boxConfigs = activeBoxes.map(function(b) {
      var qtyRaw = b.qty;
      var qty = (qtyRaw === '' || qtyRaw === undefined || qtyRaw === null) ? null : Math.max(1, parseInt(qtyRaw) || 1);
      return { box: b, qty: qty };
    });

    // 显示进度条
    showCalcProgress('木箱反推 · 准备计算...');

    setTimeout(function() {
      try {
        updateCalcProgress(1, 1, '木箱反推 · 正在计算 ' + crateList.length + ' 种木箱');

        // 对每种木箱尺寸运行FFD反推
        var allResults = PE.calcReverseCompare(crateList, boxConfigs, gap, allowRotate);

        // 只展示推荐的最佳方案（数量最少）
        S.reverseResult = allResults.length > 0 ? allResults[0] : null;
        S.reverseAllResults = allResults;
        S.reverseActiveCrateIdx = 0;

        UI.renderReverseResults();

        // 保存历史
        SM.saveHistory({ mode: 'reverse', reverseResult: S.reverseResult, timestamp: Date.now() });

        // 渲染3D
        var isVisualActive = document.getElementById('panel-visual').classList.contains('active');
        if (isVisualActive && V3.isReady() && S.reverseResult && S.reverseResult.crates.length > 0) {
          UI.selectReverseCrate(0);
        }

        closeSidebar();
        switchTab('results');

        // 滚动到结果区域，让用户看到变化
        if (S.reverseResult && S.reverseResult.crates.length > 0) {
          setTimeout(function() {
            var resultsEl = document.getElementById('results-content');
            if (resultsEl) {
              resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              // 闪烁高亮效果
              resultsEl.style.transition = 'box-shadow 0.3s';
              resultsEl.style.boxShadow = '0 0 0 3px #1677ff';
              setTimeout(function() {
                resultsEl.style.boxShadow = 'none';
              }, 600);
            }
          }, 200);
        }
      } finally {
        hideCalcProgress();
      }
    }, 60);
  }

  function selectReverseCrate(idx) {
    UI.selectReverseCrate(idx);
  }

  function exportResult() {
    const s = S;
    // 反推模式导出
    if (s.currentMode === 'reverse' && s.reverseResult) {
      var rr = s.reverseResult;
      var text = '=== 木箱反推计算结果 ===\n';
      text += '木箱尺寸: ' + rr.crateL + ' × ' + rr.crateW + ' × ' + rr.crateH + ' mm\n';
      text += '需要木箱数量: ' + rr.totalCrates + ' 个\n';
      text += '总装纸箱数: ' + rr.totalBoxCount + ' 个\n';
      text += '总体空间利用率: ' + (rr.totalUtilRate * 100).toFixed(1) + '%\n\n';
      rr.crates.forEach(function(c, i) {
        text += '--- 木箱 #' + (i + 1) + ' ---\n';
        text += '装入纸箱: ' + c.totalCount + ' 个\n';
        text += '空间利用率: ' + (c.utilRate * 100).toFixed(1) + '%\n';
        if (c.maxWeight > 0) text += '载重: ' + (c.totalWeight || 0).toFixed(1) + ' / ' + c.maxWeight + ' kg\n';
        var summary = {};
        c.boxes.forEach(function(b) {
          var key = b.box.name || ('纸箱' + b.box.id);
          if (!summary[key]) summary[key] = 0;
          summary[key]++;
        });
        Object.keys(summary).forEach(function(k) {
          text += '  ' + k + ': ' + summary[k] + ' 个\n';
        });
        text += '\n';
      });
      downloadText(text, '木箱反推');
      return;
    }
    // 批量模式导出
    if (s.batchMode && s.batchResults && s.batchResults.length > 0) {
      let text = '=== 装箱计算结果（批量对比' + (s.currentMode === 'mixed' ? ' · 混装' : ' · 单品') + '）===\n';
      text += '纸箱数量: ' + s.boxes.filter(function(b) { return b.enabled !== false; }).length + ' 种\n';
      text += '对比木箱: ' + s.batchResults.length + ' 种\n\n';
      s.batchResults.forEach(function(br, i) {
        text += '--- ' + br.crate.name + ' (' + br.crate.l + '×' + br.crate.w + '×' + br.crate.h + ' mm) ---\n';
        if (s.currentMode === 'single') {
          br.calcResults.forEach(function(cr) {
            text += '  ' + cr.box.name + ': ';
            if (cr.result) {
              text += cr.result.count + ' 个, 利用率 ' + (cr.result.utilRate * 100).toFixed(1) + '%';
              if (cr.result.maxWeight > 0) text += ', 载重 ' + (cr.result.totalWeight || 0).toFixed(1) + '/' + cr.result.maxWeight + ' kg';
            } else { text += '无法装入'; }
            text += '\n';
          });
        } else {
          if (br.mixResult && br.mixResult.totalCount > 0) {
            text += '  总数: ' + br.mixResult.totalCount + ' 个, 利用率: ' + (br.mixResult.utilRate * 100).toFixed(1) + '%\n';
            br.mixResult.breakdown.filter(function(b) { return b.count > 0; }).forEach(function(b) {
              text += '  ' + b.box.name + ': ' + b.count + ' 个';
              if (b.requested !== null) text += ' / 需求 ' + b.requested + ' 个';
              text += '\n';
            });
          } else { text += '  无法装入\n'; }
        }
        text += '\n';
      });
      downloadText(text, '装箱计算_批量对比');
      return;
    }

    if (s.currentMode === 'single') {
      if (!s.calcResults || s.calcResults.length === 0) { alert('没有可导出的结果，请先计算'); return; }
      const best = s.calcResults.find(r => r.isBest) || s.calcResults[0];
      let text = '=== 装箱计算结果（单品对比模式）===\n';
      text += '木箱尺寸（内径）: ' + best.crateL + ' × ' + best.crateW + ' × ' + best.crateH + ' mm\n\n';
      s.calcResults.forEach(function(cr) {
        text += '--- ' + cr.box.name + ' ---\n';
        text += '原始尺寸: ' + (cr.box.origL||cr.box.l) + ' × ' + (cr.box.origW||cr.box.w) + ' × ' + (cr.box.origH||cr.box.h) + ' mm\n';
        if (cr.result) {
          text += '实际方向: ' + cr.result.bL + ' × ' + cr.result.bW + ' × ' + cr.result.bH + ' mm' + (cr.result.isRotated ? ' (旋转)' : '') + '\n';
          text += '装入数量: ' + cr.result.count + ' 个\n';
          text += '排列方式: ' + cr.result.xCount + ' × ' + cr.result.yCount + ' × ' + cr.result.zCount + '\n';
          const tailFill = cr.result.count - cr.result.xCount * cr.result.yCount * cr.result.zCount;
          if (tailFill > 0) text += '旋转填充增额: +' + tailFill + ' 个\n';
          text += '空间利用率: ' + (cr.result.utilRate * 100).toFixed(1) + '%\n';
          if (cr.result.maxWeight > 0) {
            text += '载重: ' + (cr.result.totalWeight || 0).toFixed(1) + ' / ' + cr.result.maxWeight + ' kg (' + ((cr.result.weightRate || 0) * 100).toFixed(0) + '%)\n';
            if (cr.result.weightLimited) text += '⚠️ 受承重限制，原始可装: ' + cr.result.originalCount + ' 个\n';
          }
        } else { text += '无法装入（尺寸超限）\n'; }
        text += '\n';
      });
      downloadText(text, '装箱计算_单品');
    } else {
      const mr = s.mixResult;
      if (!mr || mr.totalCount === 0) { alert('没有可导出的结果，请先计算'); return; }
      let text = '=== 装箱计算结果（混装模式）===\n';
      text += '木箱尺寸（内径）: ' + mr.crateL + ' × ' + mr.crateW + ' × ' + mr.crateH + ' mm\n';
      text += '优化策略: ' + (mr.strategy === 'util' ? '空间优先（最大化空间利用率）' : '数量优先（最大化装箱数量）') + '\n';
      text += '总装入数量: ' + mr.totalCount + ' 个\n';
      text += '空间利用率: ' + (mr.utilRate * 100).toFixed(1) + '%\n';
      if (mr.maxWeight > 0) {
        text += '载重: ' + (mr.totalWeight || 0).toFixed(1) + ' / ' + mr.maxWeight + ' kg (' + ((mr.weightRate || 0) * 100).toFixed(0) + '%)\n';
        if (mr.weightOverLimit) text += '⚠️ 总重量超过木箱最大承重\n';
      }
      text += '\n';
      text += '各类纸箱明细:\n';
      mr.breakdown.filter(function(b) { return b.count > 0; }).forEach(function(b) {
        text += '  ' + b.box.name + ' (' + b.box.l + '×' + b.box.w + '×' + b.box.h + ' mm): ' + b.count + ' 个';
        if (b.requested !== null) text += ' / 需求 ' + b.requested + ' 个';
        text += '\n';
      });
      downloadText(text, '装箱计算_混装');
    }
  }

  function downloadText(text, prefix) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = prefix + '_' + new Date().toLocaleDateString('zh-CN').replace(/\//g,'') + '.txt';
    a.click();
  }

  function updateCrateVol() {
    const l = parseFloat(document.getElementById('c-l').value);
    const w = parseFloat(document.getElementById('c-w').value);
    const h = parseFloat(document.getElementById('c-h').value);
    const maxW = parseFloat(document.getElementById('c-max-weight').value) || 0;
    const el = document.getElementById('crate-vol-display');
    let text = '';
    if (l > 0 && w > 0 && h > 0) {
      text = '内容积: ' + (l * w * h / 1e9).toFixed(4) + ' m³ = ' + (l * w * h / 1e6).toFixed(0) + ' cm³';
    }
    if (maxW > 0) {
      text += (text ? ' | ' : '') + '最大承重: ' + maxW + ' kg';
    }
    el.textContent = text;
  }

  // 3D 控制
  function resetCamera() { V3.resetCamera(); }
  function toggleWireframe() { V3.toggleWireframe(); }
  function toggleCrateVis() {
    V3.toggleCrateVis();
  }
  function toggleOrientationMarkers() { V3.toggleOrientationMarkers(); }
  function toggleCrateDashed() {
    V3.toggleCrateDashed();
  }

  // 初始化
  function init() {
    if (App._initialized) {
      console.warn('[App] 已初始化，跳过重复调用');
      return;
    }
    App._initialized = true;
    try {
      // 加载已保存的纸箱规格（去重：相同名称+尺寸只留一个）
      let savedSpecs = SM.loadBoxSpecs();
      if (savedSpecs.length > 0) {
        // 去重（防止旧版重复保存导致的问题）
        const seen = new Set();
        savedSpecs = savedSpecs.filter(function(spec) {
          const key = spec.name + '|' + spec.l + '|' + spec.w + '|' + spec.h;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // 写回去重后的规格
        SM.saveBoxSpecs(savedSpecs);

        savedSpecs.forEach(function(spec, i) {
          const id = ++S.boxIdCounter;
          const colorIdx = i % S.BOX_COLORS.length;
          S.boxes.push({
            id, l: spec.l, w: spec.w, h: spec.h,
            name: spec.name, color: S.BOX_COLORS[colorIdx],
            qty: spec.qty || '', keepUpright: spec.keepUpright || false,
            weight: spec.weight || ''
          });
        });
        UI.renderBoxList();
      }
      updateCrateVol();
      UI.renderHistoryList();

      // 确保初始状态正确（单品模式下隐藏策略选择器）
      var strategyRow = document.getElementById('strategy-row');
      if (strategyRow) strategyRow.style.display = S.currentMode === 'mixed' ? 'flex' : 'none';

      // 旋转开关联动
      var optRotate = document.getElementById('opt-rotate');
      if (optRotate) {
        function updateUprightLabels() {
          var enabled = optRotate.checked;
          document.querySelectorAll('[id^="ku-label-"]').forEach(function(el) {
            el.style.opacity = enabled ? '1' : '0.4';
            el.style.pointerEvents = enabled ? 'auto' : 'none';
            var inp = el.querySelector('input');
            if (inp) inp.disabled = !enabled;
          });
        }
        optRotate.addEventListener('change', updateUprightLabels);
        updateUprightLabels();
      }

      // 木箱尺寸输入联动
      ['c-l','c-w','c-h'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', updateCrateVol);
      });

      // 初始化主题
      initTheme();

      console.log('[App] 初始化完成 - 模式:', S.currentMode);
    } catch(e) {
      console.error('[App] 初始化失败:', e.message, e.stack);
    }
  }

  return {
    init, setMode, setStrategy, addBox, removeBox, updateBoxName,
    saveCurrentBoxSpec, deleteBoxSpec, importBoxSpec,
    saveCrateSpec, importCrateSpec, deleteCrateSpec,
    showSpecManager, closeSpecManager, switchSpecTab,
    calculate, switchTab, switchToVisual, switchScheme,
    loadHistory, deleteHistory, clearHistoryConfirm,
    clearAll, exportResult, updateCrateVol,
    resetCamera, toggleWireframe, toggleCrateVis, toggleOrientationMarkers, toggleCrateDashed,
    openSidebar, closeSidebar, cancelCalc, toggleTheme,
    // 批量模式
    toggleBatchMode, addCrateUI, removeCrateUI, updateCrateVolUI, updateCrateNameUI,
    batchImportCrates, selectBatchCrate: function(idx, switchTo3D) { UI.selectBatchCrate(idx, switchTo3D); }, toggleBoxEnabled: function(id, checked) { S.toggleBoxEnabled(id, checked); },
    // 反推模式
    addReverseCrate, removeReverseCrate, updateReverseCrateName, updateReverseCrateDim,
    batchImportReverseCrates, selectReverseCrate: function(idx) { UI.selectReverseCrate(idx); }
  };
  } catch(e) {
    console.error('[App] 模块初始化失败:', e.message, e.stack);
    return {
      init: function() { console.error('[App] 模块未正确初始化'); },
      setMode: function(){}, setStrategy: function(){}, addBox: function(){},
      removeBox: function(){}, updateBoxName: function(){},
      saveCurrentBoxSpec: function(){}, deleteBoxSpec: function(){}, importBoxSpec: function(){},
      saveCrateSpec: function(){}, importCrateSpec: function(){}, deleteCrateSpec: function(){},
      showSpecManager: function(){}, closeSpecManager: function(){}, switchSpecTab: function(){},
      calculate: function(){}, switchTab: function(){}, switchToVisual: function(){}, switchScheme: function(){},
      loadHistory: function(){}, deleteHistory: function(){}, clearHistoryConfirm: function(){},
      clearAll: function(){}, exportResult: function(){}, updateCrateVol: function(){},
      resetCamera: function(){}, toggleWireframe: function(){}, toggleCrateVis: function(){}, toggleOrientationMarkers: function(){}, toggleCrateDashed: function(){},
      openSidebar: function(){}, closeSidebar: function(){},
      toggleBatchMode: function(){}, addCrateUI: function(){}, removeCrateUI: function(){},
      updateCrateVolUI: function(){}, updateCrateNameUI: function(){},
      batchImportCrates: function(){}, selectBatchCrate: function(){}, toggleBoxEnabled: function(){},
      addReverseCrate: function(){}, removeReverseCrate: function(){}, updateReverseCrateName: function(){}, updateReverseCrateDim: function(){},
      batchImportReverseCrates: function(){}, selectReverseCrate: function(){}
    };
  }
})();
