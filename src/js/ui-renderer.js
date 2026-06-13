// ============================================================
// Module: UIRenderer — UI 渲染
// ============================================================
window.UIRenderer = (function() {
  'use strict';
  try {

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderBoxList() {
    const s = AppState;
    s.syncFromDOM();
    s.boxes = s.getBoxValues();
    const list = document.getElementById('box-list');
    const empty = document.getElementById('box-list-empty');
    const isMixed = s.currentMode === 'mixed';
    const isReverse = s.currentMode === 'reverse';

    if (s.boxes.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = s.boxes.map(b => {
      return '<div class="box-item' + (b.enabled === false ? ' box-item-disabled' : '') + '" id="box-item-' + b.id + '">' +
        '<div class="box-item-header">' +
          '<label class="box-check-label" title="勾选后参与计算">' +
            '<input type="checkbox" class="box-checkbox" id="bc-' + b.id + '" ' + (b.enabled !== false ? 'checked' : '') + ' onchange="App.toggleBoxEnabled(' + b.id + ', this.checked)">' +
          '</label>' +
          '<span class="box-label">' +
            '<span class="color-dot" style="background:' + b.color + '"></span>' +
            '<input id="bn-' + b.id + '" value="' + (b.name || '').replace(/"/g, '&quot;') + '"' +
              ' style="border:none;background:transparent;font-size:13px;font-weight:500;outline:none;min-width:60px;max-width:140px;cursor:text;padding:2px 4px;border-radius:4px"' +
              ' onchange="App.updateBoxName(' + b.id + ', this.value)"' +
              ' onfocus="this.style.background=\'#f0f5ff\';this.style.outline=\'1px solid #1677ff\'"' +
              ' onblur="this.style.background=\'transparent\';this.style.outline=\'none\'"' +
              ' title="点击编辑名称">' +
          '</span>' +
          '<button class="spec-del-btn" onclick="App.saveCurrentBoxSpec(' + b.id + ')" title="保存当前纸箱尺寸到规格库">💾 保存</button>' +
          '<button class="remove-btn" onclick="App.removeBox(' + b.id + ')">×</button>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="field-group"><label>长 L (mm)</label><input type="number" id="bl-' + b.id + '" value="' + b.l + '" min="1"></div>' +
          '<div class="field-group"><label>宽 W (mm)</label><input type="number" id="bw-' + b.id + '" value="' + b.w + '" min="1"></div>' +
          '<div class="field-group"><label>高 H (mm)</label><input type="number" id="bh-' + b.id + '" value="' + b.h + '" min="1"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">' +
          '<label id="ku-label-' + b.id + '" style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;cursor:pointer;user-select:none" title="勾选后纸箱始终保持正放">' +
            '<input type="checkbox" id="bu-' + b.id + '" ' + (b.keepUpright ? 'checked' : '') + ' style="cursor:pointer;margin:0">' +
            '保持正放（禁止竖放）' +
          '</label>' +
          '<label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888">重量(kg): <input type="number" id="bwt-' + b.id + '" value="' + (b.weight || '') + '" min="0" step="0.01" placeholder="0" style="width:60px;border:1px solid #d9d9d9;border-radius:4px;padding:2px 4px;font-size:11px"></label>' +
        '</div>' +
        ((isMixed || isReverse) ? '<div class="qty-row"><label>需求数量:</label><input type="number" id="bq-' + b.id + '" class="qty-input" value="' + (b.qty || '') + '" min="1"' + (isReverse ? ' placeholder="必填"' : ' placeholder="不限"') + '><span class="qty-hint">' + (isReverse ? '反推模式下必须填写数量' : '留空 = 尽量多') + '</span></div>' : '') +
      '</div>';
    }).join('');
  }

  function renderResults() {
    const s = AppState;
    const cont = document.getElementById('results-content');

    // 反推模式
    if (s.currentMode === 'reverse' && s.reverseResult) {
      renderReverseResults();
      return;
    }

    // 批量模式
    if (s.batchMode && s.batchResults && s.batchResults.length > 0) {
      renderBatchResults();
      return;
    }

    // 单木箱模式（兼容旧版）
    if (s.currentMode === 'single') {
      if (!s.calcResults || s.calcResults.length === 0) {
        cont.innerHTML = '<div class="no-result"><div class="nr-icon">📐</div><h3>等待计算</h3><p>请先添加纸箱并计算</p></div>';
        return;
      }
      const hasAny = s.calcResults.some(r => r.result && r.result.count > 0);
      if (!hasAny) {
        cont.innerHTML = '<div class="no-result"><div class="nr-icon">😅</div><h3>无法装入</h3><p>所有纸箱尺寸均超过木箱内径，请检查参数</p></div>';
        return;
      }
      const best = s.calcResults.find(r => r.isBest);
      cont.innerHTML = '<div style="margin-bottom:12px;font-size:13px;color:#666">共计算 <b style="color:#333">' + s.calcResults.length + '</b> 种纸箱方案，最优方案：<b style="color:#1677ff">' + (best ? best.box.name : '--') + '</b> 可装 <b style="color:#1677ff">' + (best && best.result ? best.result.count : 0) + '</b> 个</div>' +
        '<div class="result-grid">' + s.calcResults.map((cr, idx) => renderSingleCard(cr, idx)).join('') + '</div>';
    } else {
      const mr = s.mixResult;
      if (!mr || mr.totalCount === 0) {
        cont.innerHTML = '<div class="no-result"><div class="nr-icon">😅</div><h3>无法装入</h3><p>所有纸箱尺寸均超过木箱内径，请检查参数</p></div>';
        return;
      }
      cont.innerHTML = renderMixedCard(mr);
    }
  }

  // 批量结果渲染（卡片风格）
  function renderBatchResults() {
    const s = AppState;
    const cont = document.getElementById('results-content');
    const brs = s.batchResults;

    if (!brs || brs.length === 0) {
      cont.innerHTML = '<div class="no-result"><div class="nr-icon">📐</div><h3>等待计算</h3><p>请先添加纸箱和木箱并计算</p></div>';
      return;
    }

    const isMixed = s.currentMode === 'mixed';

    // 按利用率降序排列
    const sorted = [...brs].sort(function(a, b) {
      return (b._maxUtil || 0) - (a._maxUtil || 0);
    });

    const summaryText = isMixed
      ? '混装模式 · 共对比 <b>' + brs.length + '</b> 种木箱'
      : '单品对比模式 · 共对比 <b>' + brs.length + '</b> 种木箱';

    // 总体概览
    var html = '';
    html += '<div style="background:linear-gradient(135deg,#f0f5ff,#e6f7ff);border-radius:12px;padding:16px;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:18px">📋</span><span style="font-weight:600;font-size:15px">批量对比结果</span></div>';
    html += '<div style="font-size:13px;color:#555">' + summaryText + '</div>';
    html += '</div>';

    // 卡片列表
    html += '<div style="display:flex;flex-direction:column;gap:12px">';
    sorted.forEach(function(br, i) {
      var maxCount = br._maxCount || 0;
      var maxUtil = br._maxUtil || 0;
      var utilPct = (maxUtil * 100).toFixed(1);
      var utilColor = maxUtil > 0.7 ? '#52c41a' : maxUtil > 0.4 ? '#fa8c16' : '#ff4d4f';
      var vol = (br.crate.l * br.crate.w * br.crate.h / 1e9).toFixed(4);

      // 获取原始索引（在 brs 中的位置，而不是 sorted 中的位置）
      var origIdx = brs.indexOf(br);
      var isActive = origIdx === s.batchActiveCrateIdx;
      var crateHeaderBg = isActive ? '#e6f4ff' : '#fafafa';
      var crateHeaderBorder = isActive ? '#1677ff' : '#e8e8e8';

      // 最佳标记
      var bestBadges = '';
      if (br._bestUtil) bestBadges += '<span class="batch-best-badge" style="background:#52c41a">⭐ 最佳利用率</span>';
      if (br._bestCount) bestBadges += '<span class="batch-best-badge" style="background:#1677ff">📊 最多数量</span>';

      // 混装模式卡片点击进入3D视图；单品模式只有各行纸箱的3D按钮可进入
      var cardOnClick = s.currentMode === 'mixed'
        ? 'App.selectBatchCrate(' + origIdx + ', true)'
        : 'App.selectBatchCrate(' + origIdx + ')';
      html += '<div class="result-card" style="cursor:pointer;border:2px solid ' + crateHeaderBorder + '" onclick="' + cardOnClick + '">';
      html += '<div class="result-card-header" style="background:' + crateHeaderBg + '">';
      html += '<div class="rc-title">📦 ' + escapeHtml(br.crate.name) + '</div>';
      html += '<div style="font-size:12px;color:#888">' + br.crate.l + '×' + br.crate.w + '×' + br.crate.h + ' mm</div>';
      html += '</div>';

      // 最佳标记（如果有）
      if (bestBadges) {
        html += '<div style="padding:0 12px 8px 12px;display:flex;gap:6px;flex-wrap:wrap">' + bestBadges + '</div>';
      }

      // 关键指标
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 10px 12px;font-size:13px">';
      html += '<div><span style="color:#888">' + (s.currentMode === 'mixed' ? '总装箱数' : '最多装箱数') + '</span><br><b style="color:#1677ff;font-size:16px">' + (maxCount || '-') + '</b> 个</div>';
      html += '<div><span style="color:#888">容积</span><br><b>' + vol + '</b> m³</div>';
      html += '</div>';

      // 每种纸箱的装箱明细
      var breakdownHtml = '';
      if (s.currentMode === 'mixed' && br.mixResult && br.mixResult.breakdown) {
        // 混装模式：简单列表
        br.mixResult.breakdown.forEach(function(item) {
          if (item.count > 0) {
            var dotColor = item.box && item.box.color ? item.box.color : '#888';
            breakdownHtml += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0">' +
              '<span class="color-dot" style="background:' + dotColor + ';width:8px;height:8px;flex-shrink:0"></span>' +
              escapeHtml(item.box ? item.box.name : '纸箱') + ' <b style="color:#1677ff">' + item.count + '</b> 个</div>';
          }
        });
      } else if (br.calcResults) {
        // 单品模式：三列布局 - 纸箱 | 利用率 | 3D
        breakdownHtml += '<div style="display:flex;flex-direction:column;gap:6px">';
        br.calcResults.forEach(function(cr, ci) {
          if (cr.result && cr.result.count > 0) {
            var isBest = cr.isBest;
            var boxUtilPct = (cr.result.utilRate * 100).toFixed(1);
            var boxUtilColor = cr.result.utilRate > 0.7 ? '#52c41a' : cr.result.utilRate > 0.4 ? '#fa8c16' : '#ff4d4f';
            breakdownHtml +=
              '<div style="display:grid;grid-template-columns:1fr 80px 44px;align-items:center;gap:6px;font-size:12px;padding:4px 0;border-bottom:1px solid #f5f5f5">' +
                // 第一列：纸箱名 + 数量
                '<div style="display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden">' +
                  '<span class="color-dot" style="background:' + cr.box.color + ';width:8px;height:8px;flex-shrink:0"></span>' +
                  '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(cr.box.name) + '</span>' +
                  '<b style="color:#1677ff;flex-shrink:0">' + cr.result.count + '</b>' +
                  (isBest ? ' <span style="font-size:10px;color:#52c41a;flex-shrink:0">⭐</span>' : '') +
                '</div>' +
                // 第二列：单个纸箱的利用率进度条
                '<div style="display:flex;align-items:center;gap:4px">' +
                  '<div style="flex:1;height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden">' +
                    '<div style="height:100%;width:' + boxUtilPct + '%;background:' + boxUtilColor + ';border-radius:3px;transition:width 0.3s"></div>' +
                  '</div>' +
                  '<span style="font-size:10px;font-weight:600;color:' + boxUtilColor + ';flex-shrink:0">' + boxUtilPct + '%</span>' +
                '</div>' +
                // 第三列：3D按钮
                '<button class="btn-outline btn-xs" style="text-align:center" onclick="event.stopPropagation();App.selectBatchBox(' + origIdx + ',' + ci + ')" title="查看3D布局">3D</button>' +
              '</div>';
          }
        });
        breakdownHtml += '</div>';
      }
      if (breakdownHtml) {
        html += '<div style="padding:0 12px 10px 12px;border-top:1px solid #f0f0f0;padding-top:10px">';
        html += '<div style="display:grid;grid-template-columns:1fr 80px 44px;gap:6px;font-size:11px;color:#888;margin-bottom:4px">';
        html += '<span>纸箱组成</span><span style="text-align:center">利用率</span><span></span>';
        html += '</div>';
        html += breakdownHtml;
        html += '</div>';
      }
      // 单品模式每行已有各纸箱的利用率，移除底部总进度条
      // 混装模式保留总利用率进度条
      if (s.currentMode === 'mixed') {
      // 利用率进度条
      html += '<div style="padding:0 12px 12px 12px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin-bottom:2px">' +
          '<span>空间利用率</span><span style="font-weight:600;color:' + utilColor + '">' + utilPct + '%</span>' +
        '</div>' +
        '<div class="batch-util-bar"><div class="batch-util-fill" style="width:' + utilPct + '%;background:' + utilColor + '"></div></div>' +
      '</div>';
      }

      // 如果无法装入
      if (maxCount === 0) {
        html += '<div style="color:#ff4d4f;font-size:12px;padding:0 12px 12px 12px">⚠ 纸箱尺寸超过木箱内径，无法装入</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    cont.innerHTML = html;
  }

  function selectBatchCrate(idx, switchTo3D) {
    const S = AppState;
    S.batchActiveCrateIdx = idx;
    const br = S.batchResults[idx];
    if (!br) return;

    // 重新渲染卡片，更新高亮状态
    renderBatchResults();

    // 点击结果卡片时自动切换到3D视图
    if (switchTo3D) {
      const V3 = Visualizer3D;
      if (typeof App !== 'undefined' && App.switchTab) {
        App.switchTab('visual');
      }
      // 单品模式下取装箱数最多的纸箱方案渲染3D
      var bestCr = br.calcResults.length > 0 ? br.calcResults.reduce(function(a, b) {
        return (a.result && a.result.count) > (b.result && b.result.count) ? a : b;
      }) : null;
      (function renderWhenReady(retries) {
        if (V3 && V3.isReady()) {
          if (S.currentMode === 'mixed' && br.mixResult) {
            V3.renderMixedScene(br.mixResult);
          } else if (bestCr) {
            V3.renderSingleScene(bestCr);
          }
        } else if (retries < 15) {
          setTimeout(function() { renderWhenReady(retries + 1); }, 80);
        }
      })(0);
    }
  }

  // 批量单品模式下，点击纸箱跳转到对应3D视图
  function selectBatchBox(crateIdx, boxIdx) {
    const S = AppState;
    S.batchActiveCrateIdx = crateIdx;
    const br = S.batchResults[crateIdx];
    if (!br || !br.calcResults || !br.calcResults[boxIdx]) return;
    renderBatchResults();

    const V3 = Visualizer3D;
    // 手动切换到3D标签页（不调 App.switchTab，避免其内部的自动渲染覆盖）
    document.querySelectorAll('.tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === 'visual');
    });
    document.querySelectorAll('.view-panel').forEach(function(p) {
      p.classList.remove('active');
    });
    var visualPanel = document.getElementById('panel-visual');
    if (visualPanel) visualPanel.classList.add('active');
    document.querySelectorAll('.mtab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.mtab === 'visual');
    });

    // 自己控制 V3 初始化和渲染
    (function renderWhenReady(retries) {
      if (V3 && V3.isReady()) {
        V3.renderSingleScene(br.calcResults[boxIdx]);
      } else {
        if (!V3 || !V3.isReady()) V3.init();
        if (retries < 15) {
          setTimeout(function() { renderWhenReady(retries + 1); }, 80);
        }
      }
    })(0);
  }

  // ============================================================
  // 反推结果渲染
  // ============================================================
  function renderReverseResults() {
    var s = AppState;
    var rr = s.reverseResult;
    if (!rr || !rr.crates || rr.crates.length === 0) {
      document.getElementById('results-content').innerHTML = '<div class="no-result"><div class="nr-icon">📐</div><h3>等待计算</h3><p>点击"开始计算"进行木箱反推</p></div>';
      return;
    }
    var crates = rr.crates;
    var html = '';

    // 总体概览
    html += '<div style="background:linear-gradient(135deg,#f0f5ff,#e6f7ff);border-radius:12px;padding:16px;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:18px">🔄</span><span style="font-weight:600;font-size:15px">木箱反推结果</span></div>';
    html += '<div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:#555">';
    html += '<span>木箱尺寸: <b>' + rr.crateL + '×' + rr.crateW + '×' + rr.crateH + ' mm</b></span>';
    html += '<span>需要数量: <b style="color:#1677ff;font-size:16px">' + rr.totalCrates + '</b> 个</span>';
    html += '<span>总装纸箱: <b>' + rr.totalBoxCount + '</b> 个</span>';
    html += '<span>总体利用率: <b style="color:#52c41a">' + (rr.totalUtilRate * 100).toFixed(1) + '%</b></span>';
    html += '</div></div>';

    // 每个木箱的详情卡片
    html += '<div style="display:flex;flex-direction:column;gap:12px">';
    crates.forEach(function(c, ci) {
      var crateHeaderBg = ci === s.reverseActiveCrateIdx ? '#e6f4ff' : '#fafafa';
      var crateHeaderBorder = ci === s.reverseActiveCrateIdx ? '#1677ff' : '#e8e8e8';
      var utilPct = (c.utilRate * 100).toFixed(1);
      var utilColor = c.utilRate > 0.7 ? '#52c41a' : c.utilRate > 0.4 ? '#fa8c16' : '#ff4d4f';
      html += '<div class="result-card" style="cursor:pointer;border:2px solid ' + crateHeaderBorder + '" onclick="App.selectReverseCrate(' + ci + ')">';
      html += '<div class="result-card-header" style="background:' + crateHeaderBg + '">';
      html += '<div class="rc-title">📦 木箱 #' + (ci + 1) + '</div>';
      html += '<div style="font-size:12px;color:#888">装 ' + c.totalCount + ' 个纸箱</div>';
      html += '</div>';

      // 利用率进度条
      html += '<div style="padding:0 12px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin-bottom:2px">' +
          '<span>空间利用率</span><span style="font-weight:600;color:' + utilColor + '">' + utilPct + '%</span>' +
        '</div>' +
        '<div class="batch-util-bar"><div class="batch-util-fill" style="width:' + utilPct + '%;background:' + utilColor + '"></div></div>' +
      '</div>';

      // 纸箱明细
      html += '<div style="padding:8px 12px;font-size:12px">';
      // 按纸箱种类汇总
      var boxSummary = {};
      c.boxes.forEach(function(b) {
        var key = b.box.name || ('纸箱' + b.box.id);
        if (!boxSummary[key]) boxSummary[key] = { count: 0, color: b.box.color, dims: b.box.l + '×' + b.box.w + '×' + b.box.h };
        boxSummary[key].count++;
      });
      var keys = Object.keys(boxSummary);
      keys.forEach(function(k) {
        var bs = boxSummary[k];
        html += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span class="color-dot" style="background:' + bs.color + ';width:8px;height:8px;flex-shrink:0"></span>' + k + ' <span style="color:#888">' + bs.dims + '</span> ×<b>' + bs.count + '</b></div>';
      });
      if (c.overflowCount > 0) {
        html += '<div style="color:#ff4d4f;margin-top:4px">⚠ 还有 ' + c.overflowCount + ' 个纸箱无法装入</div>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    document.getElementById('results-content').innerHTML = html;
  }

  function selectReverseCrate(idx) {
    var s = AppState;
    s.reverseActiveCrateIdx = idx;
    renderReverseResults();
    var rr = s.reverseResult;
    if (!rr || !rr.crates || !rr.crates[idx]) return;
    var c = rr.crates[idx];
    const V3 = Visualizer3D;
    // 构造混装结果格式供3D渲染
    var positions = c.boxes.map(function(b) {
      return {
        x: b.pos.x, y: b.pos.y, z: b.pos.z,
        l: b.pos.l, w: b.pos.w, h: b.pos.h,
        rotated: b.pos.rotated,
        boxIdx: b.boxIdx,
        color: b.box.color,
        name: b.box.name,
        origL: b.box.l, origW: b.box.w, origH: b.box.h
      };
    });
    // 构建 breakdown 用于图例和颜色映射
    var breakdownMap = {};
    c.boxes.forEach(function(b) {
      var key = b.boxIdx;
      if (!breakdownMap[key]) breakdownMap[key] = { box: b.box, count: 0 };
      breakdownMap[key].count++;
    });
    var breakdown = Object.keys(breakdownMap).map(function(k) { return breakdownMap[k]; });
    breakdown.sort(function(a, bb) { return bb.count - a.count; });

    var mixResultFor3D = {
      crateL: rr.crateL, crateW: rr.crateW, crateH: rr.crateH,
      displayCrateL: rr.crateL, displayCrateW: rr.crateW, displayCrateH: rr.crateH,
      placed: positions,
      totalCount: c.totalCount,
      utilRate: c.utilRate,
      crateUtilRate: c.utilRate,
      breakdown: breakdown,
      boxes: c.boxes.map(function(b) { return b.box; }),
      reverseCrateIdx: idx,
      gap: rr.gap || 0
    };
    // 无论当前在哪个tab，都切换到3D视图
    if (typeof App !== 'undefined' && App.switchTab) {
      App.switchTab('visual');
    }
    // 延迟渲染，确保 V3 初始化完成后再执行
    // 第一次切换到3D标签时 V3.init() 在 switchTab 的 setTimeout(60ms) 中执行
    (function renderWhenReady(retries) {
      if (V3 && V3.isReady()) {
        V3.renderMixedScene(mixResultFor3D);
      } else if (retries < 15) {
        setTimeout(function() { renderWhenReady(retries + 1); }, 80);
      }
    })(0);
  }

  function renderSingleCard(cr, idx) {
    const { box, result, isBest, crateL, crateW, crateH } = cr;
    if (!result || result.count === 0) {
      return '<div class="result-card"><div class="result-card-header"><div class="rc-title"><span class="color-dot" style="background:' + box.color + '"></span>' + escapeHtml(box.name) + '</div></div><div style="color:#ff4d4f;font-size:13px;background:#fff2f0;border-radius:8px;padding:10px">纸箱尺寸超过木箱内径，无法装入</div></div>';
    }
    const util = (result.utilRate * 100).toFixed(1);
    const utilColor = result.utilRate > 0.7 ? '#52c41a' : result.utilRate > 0.4 ? '#fa8c16' : '#ff4d4f';
    const tailFill = result.count - result.xCount * result.yCount * result.zCount;

    // 重量信息
    let weightHtml = '';
    if (result.maxWeight > 0) {
      const wtRate = ((result.weightRate || 0) * 100).toFixed(0);
      const wtColor = (result.weightRate || 0) > 0.9 ? '#fa8c16' : '#52c41a';
      weightHtml = '<div class="stat-item"><div class="stat-val" style="color:' + wtColor + '">' + wtRate + '%</div><div class="stat-lbl">载重率 (' + (result.totalWeight || 0).toFixed(1) + '/' + result.maxWeight + ' kg)</div></div>';
    }

    // 重量超限警告
    let weightWarn = '';
    if (result.weightLimited) {
      weightWarn = '<div style="margin-top:8px;background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:8px;font-size:12px;color:#875800">⚠️ 承重限制：原始可装 ' + result.originalCount + ' 个（共 ' + (result.originalCount * (parseFloat(box.weight) || 0)).toFixed(1) + ' kg），超出木箱最大承重 ' + result.maxWeight + ' kg，已限制为 ' + result.count + ' 个</div>';
    }

    return '<div class="result-card ' + (isBest ? 'best' : '') + '" onclick="App.switchToVisual(' + idx + ')">' +
      '<div class="result-card-header">' +
        '<div class="rc-title"><span class="color-dot" style="background:' + box.color + '"></span>' + escapeHtml(box.name) +
          (result.isRotated ? '<span class="tag-rotate">↻ 旋转</span>' : '') +
          (isBest ? '<span class="best-badge">最优</span>' : '') +
        '</div>' +
        '<div class="rc-meta">' + (result.origL || box.l) + '×' + (result.origW || box.w) + '×' + (result.origH || box.h) + ' mm</div>' +
      '</div>' +
      '<div class="stat-row ' + (result.maxWeight > 0 ? 'four' : '') + '">' +
        '<div class="stat-item"><div class="stat-val">' + result.count + '</div><div class="stat-lbl">装箱数量（个）</div></div>' +
        '<div class="stat-item"><div class="stat-val" style="color:' + utilColor + '">' + util + '%</div><div class="stat-lbl">空间利用率</div></div>' +
        weightHtml +
      '</div>' +
      '<div class="util-bar"><div class="util-fill" style="width:' + util + '%;background:' + utilColor + '"></div></div>' +
      weightWarn +
      '<div class="arrange-detail">' +
        '<div style="font-size:11px;color:#aaa;margin-bottom:6px">实际摆放方向</div>' +
        '<div class="arr-row"><span class="arr-label">纸箱尺寸（实际）</span><span class="arr-val">' + result.bL + '×' + result.bW + '×' + result.bH + ' mm</span></div>' +
        '<div class="arr-row"><span class="arr-label">排列（X × Y × Z）</span><span class="arr-val">' + result.xCount + ' × ' + result.yCount + ' × ' + result.zCount + '</span></div>' +
        (tailFill > 0 ? '<div class="arr-row"><span class="arr-label">旋转填充增额</span><span class="arr-val" style="color:#fa8c16">+' + tailFill + ' 个</span></div>' : '') +
        '<div class="arr-row"><span class="arr-label">木箱内容积</span><span class="arr-val">' + (crateL * crateW * crateH / 1e9).toFixed(3) + ' m³</span></div>' +
      '</div>' +
      '<div style="margin-top:8px;font-size:11px;color:#aaa;text-align:right">点击查看3D视图 →</div>' +
    '</div>';
  }

  function renderMixedCard(mr) {
    const util = (mr.utilRate * 100).toFixed(1);
    const utilColor = mr.utilRate > 0.7 ? '#52c41a' : mr.utilRate > 0.4 ? '#fa8c16' : '#ff4d4f';
    const displayL = mr.displayCrateL || mr.crateL_raw || mr.crateL + (mr.gap||0)*2 || 1200;
    const displayW = mr.displayCrateW || mr.crateW_raw || mr.crateW + (mr.gap||0)*2 || 1000;
    const displayH = mr.displayCrateH || mr.crateH_raw || mr.crateH + (mr.gap||0)*2 || 800;
    const crateVol = (displayL * displayW * displayH / 1e9).toFixed(3);

    const placedByBoxIdx = {};
    (mr.placed || []).forEach(p => {
      if (!placedByBoxIdx[p.boxIdx]) placedByBoxIdx[p.boxIdx] = { rotated: 0, dims: new Set() };
      if (p.rotated) placedByBoxIdx[p.boxIdx].rotated++;
      placedByBoxIdx[p.boxIdx].dims.add(p.l + '×' + p.w + '×' + p.h);
    });

    const breakdownRows = mr.breakdown.filter(b => b.count > 0).map((b, i) => {
      const pct = (b.count / mr.totalCount * 100).toFixed(0);
      const reqStr = b.requested !== null ? '(需求:' + b.requested + ')' : '';
      let dimInfo = '';
      if (placedByBoxIdx[i] && placedByBoxIdx[i].dims.size > 1) {
        dimInfo = '<br><span style="color:#fa8c16;font-size:10px">🔄 含' + placedByBoxIdx[i].rotated + '个旋转 | ' + Array.from(placedByBoxIdx[i].dims).join(' | ') + '</span>';
      }
      return '<div class="mix-breakdown-row">' +
        '<div class="mbd-name"><span class="color-dot" style="background:' + b.box.color + '"></span><span>' + escapeHtml(b.box.name) + ' <span style="color:#bbb;font-size:11px">' + b.box.l + '×' + b.box.w + '×' + b.box.h + ' mm ' + reqStr + '</span></span>' + dimInfo + '</div>' +
        '<div class="mbd-count">' + b.count + ' 个</div>' +
        '<div class="mbd-pct">' + pct + '%</div>' +
      '</div>';
    }).join('');

    const unmet = mr.breakdown.filter(b => b.requested !== null && b.count < b.requested);
    const unmetHtml = unmet.length > 0
      ? '<div style="margin-top:8px;background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:8px;font-size:12px;color:#875800">⚠️ 以下纸箱未能完全满足需求：' + unmet.map(b => escapeHtml(b.box.name) + ' 差 ' + (b.requested - b.count) + ' 个').join('、') + '</div>' : '';

    const strategyLabel = mr.strategy === 'util' ? '<span class="tag-strategy util">📐 空间优先</span>' : '<span class="tag-strategy">📊 数量优先</span>';
    const strategyHint = mr.strategy === 'util'
      ? '<div style="margin-top:8px;background:#f6ffed;border:1px solid #b7eb8f;border-radius:8px;padding:8px;font-size:12px;color:#135200">💡 空间优先策略：智能组合探索已启用，在多种纸箱之间寻找最优搭配比例，追求最高空间利用率</div>'
      : '<div style="margin-top:8px;background:#e6f4ff;border:1px solid #91caff;border-radius:8px;padding:8px;font-size:12px;color:#0958d9">💡 数量优先策略：优先装入尽可能多的纸箱，适合发货最大化场景</div>';

    // 重量信息
    let weightWarnMixed = '';
    if (mr.maxWeight > 0) {
      const wtRate = ((mr.weightRate || 0) * 100).toFixed(0);
      const wtColor = (mr.weightRate || 0) > 0.9 ? '#fa8c16' : '#52c41a';
      weightWarnMixed = '<div style="margin-top:8px;font-size:12px;color:#555">📦 载重: <b style="color:' + wtColor + '">' + (mr.totalWeight || 0).toFixed(1) + ' / ' + mr.maxWeight + ' kg (' + wtRate + '%)</b></div>';
      if (mr.weightOverLimit) {
        weightWarnMixed += '<div style="margin-top:4px;background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:8px;font-size:12px;color:#875800">⚠️ 总重量超过木箱最大承重 ' + mr.maxWeight + ' kg，建议减少纸箱数量或分箱装载</div>';
      }
    }

    return '<div style="margin-bottom:12px;font-size:13px;color:#666">混装模式 · 旋转优化 · 智能组合探索 <span class="tag-mixed">混装</span>' + strategyLabel + '</div>' +
      '<div class="result-grid">' +
        '<div class="result-card mixed-card" onclick="App.switchToVisual(0)" style="cursor:pointer">' +
          '<div class="result-card-header">' +
            '<div class="rc-title">🎲 混装方案 <span class="mixed-badge">混装</span>' + strategyLabel + '</div>' +
            '<div class="rc-meta">' + displayL + '×' + displayW + '×' + displayH + ' mm 木箱</div>' +
          '</div>' +
          '<div class="stat-row four">' +
            '<div class="stat-item"><div class="stat-val">' + mr.totalCount + '</div><div class="stat-lbl">总装箱数</div></div>' +
            '<div class="stat-item"><div class="stat-val" style="color:' + utilColor + '">' + util + '%</div><div class="stat-lbl">空间利用率</div></div>' +
            '<div class="stat-item"><div class="stat-val">' + mr.breakdown.filter(b => b.count > 0).length + '</div><div class="stat-lbl">纸箱种类</div></div>' +
            '<div class="stat-item"><div class="stat-val">' + crateVol + '</div><div class="stat-lbl">木箱容积(m³)</div></div>' +
          '</div>' +
          '<div class="util-bar"><div class="util-fill" style="width:' + util + '%;background:' + utilColor + '"></div></div>' +
          weightWarnMixed +
          '<div class="mix-breakdown" style="margin-top:12px"><div class="mix-breakdown-header">各类纸箱明细</div>' + breakdownRows + '</div>' +
          unmetHtml + strategyHint +
          '<div style="margin-top:8px;font-size:11px;color:#aaa;text-align:right">点击查看3D视图 →</div>' +
        '</div>' +
      '</div>';
  }

  function renderSchemaTabs() {
    const s = AppState;
    const cont = document.getElementById('scheme-tabs');
    // 批量模式：混装显示木箱选择标签，单品模式不显示（通过纸箱3D按钮切换）
    if (s.batchMode && s.batchResults && s.batchResults.length > 0) {
      if (s.currentMode === 'mixed') {
        cont.innerHTML = s.batchResults.map(function(br, i) {
          return '<button class="scheme-tab ' + (i === s.batchActiveCrateIdx ? 'active' : '') + '" onclick="App.selectBatchCrate(' + i + ', true)">' +
            '<span class="color-dot" style="background:' + br.crate.color + '"></span>' +
            escapeHtml(br.crate.name) + ' ' + (br._maxCount > 0 ? '<b>' + br._maxCount + '个</b>' : '×') +
          '</button>';
        }).join('');
      } else {
        cont.innerHTML = '<span style="font-size:12px;color:#bbb">点击纸箱的 3D 按钮查看布局</span>';
      }
      return;
    }

    if (s.currentMode === 'single') {
      if (!s.calcResults || s.calcResults.length === 0) {
        cont.innerHTML = '<span style="font-size:12px;color:#bbb">请先计算</span>';
        return;
      }
      cont.innerHTML = s.calcResults.map((cr, i) =>
        '<button class="scheme-tab ' + (i === s.currentSchemeIdx ? 'active' : '') + '" onclick="App.switchScheme(' + i + ')">' +
          '<span class="color-dot" style="background:' + cr.box.color + '"></span>' +
          escapeHtml(cr.box.name) + ' ' + (cr.result ? '<b>' + cr.result.count + '个</b>' : '×') +
        '</button>').join('');
    } else {
      const mr = s.mixResult;
      if (!mr) { cont.innerHTML = '<span style="font-size:12px;color:#bbb">请先计算</span>'; return; }
      cont.innerHTML = '<button class="scheme-tab active">🎲 混装方案 <b>' + mr.totalCount + '个</b></button>';
    }
  }

  function renderHistoryList() {
    const cont = document.getElementById('history-list-content');
    const hist = StorageManager.loadHistoryRaw();
    if (hist.length === 0) {
      cont.innerHTML = '<div class="empty-state"><div class="es-icon">🕰️</div><p>还没有历史记录</p></div>';
      return;
    }
    cont.innerHTML = '<div class="history-list">' + hist.map((entry, i) => {
      const d = new Date(entry.timestamp);
      const timeStr = (d.getMonth()+1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
      let crateStr = '--', bestCount = 0, modeTag = '';
      if (entry.mode === 'mixed' && entry.mixResult) {
        const mr = entry.mixResult;
        crateStr = (mr.displayCrateL || mr.crateL_raw || mr.crateL) + '×' + (mr.displayCrateW || mr.crateW_raw || mr.crateW) + '×' + (mr.displayCrateH || mr.crateH_raw || mr.crateH);
        bestCount = mr.totalCount;
        const stratLabel = mr.strategy === 'util' ? '空间优先' : '数量优先';
        modeTag = ' <span style="color:#1677ff;font-size:11px">[混装·' + stratLabel + ']</span>';
      } else if (entry.calcResults && entry.calcResults.length > 0) {
        const best = entry.calcResults.find(r => r.isBest) || entry.calcResults[0];
        crateStr = best ? best.crateL + '×' + best.crateW + '×' + best.crateH : '--';
        bestCount = best && best.result ? best.result.count : 0;
      }
      return '<div class="history-item" onclick="App.loadHistory(' + i + ')">' +
        '<div class="hi-time">' + timeStr + '</div>' +
        '<div class="hi-info"><b>木箱 ' + crateStr + ' mm</b>' + modeTag + '</div>' +
        '<div class="hi-count">最多 ' + bestCount + ' 个</div>' +
        '<button class="history-del" onclick="event.stopPropagation();App.deleteHistory(' + i + ')">×</button>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderSpecManagerContent() {
    const s = AppState;
    const body = document.getElementById('spec-manager-body');
    body.innerHTML = '';

    if (s.specManagerTab === 'box') {
      const specs = StorageManager.loadBoxSpecs();
      if (specs.length === 0) {
        body.innerHTML = '<div class="modal-empty">暂无保存的纸箱规格<br><span style="font-size:11px">在纸箱卡片底部点击"💾 保存规格"来添加</span></div>';
        return;
      }
      let html = '<table class="spec-table"><thead><tr><th>名称</th><th>尺寸 (mm)</th><th>重量(kg)</th><th style="width:130px">操作</th></tr></thead><tbody>';
      specs.forEach(function(s) {
        html += '<tr><td>' + (s.name || '') + '</td><td><span class="dim-mono">' + s.l + '×' + s.w + '×' + s.h + '</span></td><td>' + (s.weight || '-') + '</td>' +
          '<td><button class="btn-table import" onclick="App.importBoxSpec(' + s.id + ')">📥 导入</button>' +
          '<button class="btn-table delete" onclick="App.deleteBoxSpec(' + s.id + ')">🗑 删除</button></td></tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    } else {
      const specs = StorageManager.loadCrateSpecs();
      if (specs.length === 0) {
        body.innerHTML = '<div class="modal-empty">暂无保存的木箱尺寸<br><span style="font-size:11px">在木箱尺寸区域点击"💾 保存尺寸"来添加</span></div>';
        return;
      }
      let html = '<table class="spec-table"><thead><tr><th>名称</th><th>尺寸 (mm)</th><th>承重(kg)</th><th style="width:130px">操作</th></tr></thead><tbody>';
      specs.forEach(function(s) {
        html += '<tr><td>' + (s.name || '') + '</td><td><span class="dim-mono">' + s.l + '×' + s.w + '×' + s.h + '</span></td><td>' + (s.maxWeight || '-') + '</td>' +
          '<td><button class="btn-table import" onclick="App.importCrateSpec(' + s.id + ')">📥 导入</button>' +
          '<button class="btn-table delete" onclick="App.deleteCrateSpec(' + s.id + ')">🗑 删除</button></td></tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    }
  }

  function showError(msg) {
    const errDiv = document.getElementById('calc-error');
    errDiv.innerHTML = '<div class="alert alert-error">' + msg + '</div>';
    errDiv.style.display = 'block';
  }

  function flashMsg(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity 0.4s;opacity:1';
    document.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 400); }, 1800);
  }

  return { renderBoxList, renderResults, renderSchemaTabs, renderHistoryList, renderSpecManagerContent, showError, flashMsg, renderBatchResults, selectBatchCrate, selectBatchBox, renderReverseResults, selectReverseCrate, escapeHtml };
  } catch(e) {
    console.error('[UIRenderer] 模块初始化失败:', e.message);
    var noop = function() {};
    return {
      renderBoxList: noop, renderResults: noop, renderSchemaTabs: noop,
      renderHistoryList: noop, renderSpecManagerContent: noop,
      showError: function(m) { console.error(m); }, flashMsg: function(m) { console.log(m); },
      renderBatchResults: noop, selectBatchCrate: noop,
      renderReverseResults: noop, selectReverseCrate: noop
    };
  }
})();
