// ============================================================
// Module: Visualizer2D — 2D 俯视图可视化
// ============================================================
window.Visualizer2D = (function() {
  'use strict';
  try {

  var canvas, ctx, layerData, activeLayer, crateDims;

  function isReady() {
    return !!canvas;
  }

  function init() {
    canvas = document.getElementById('d2-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
  }

  function resize(ww, hh) {
    if (!canvas) return;
    var w = ww || 600, h = hh || 600;
    canvas.width = w;
    canvas.height = h;
  }

  // 按 Z 坐标分组为层
  function groupByLayer(positions) {
    var layerMap = {};
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      var zKey = Math.round(p.z);
      if (!layerMap[zKey]) layerMap[zKey] = [];
      layerMap[zKey].push(p);
    }
    var zKeys = Object.keys(layerMap).map(Number).sort(function(a, b) { return a - b; });
    return zKeys.map(function(z) {
      return { z: z, boxes: layerMap[z], count: layerMap[z].length };
    });
  }

  // 计算整个装箱方案的包围盒
  function computeBounds(positions) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x + p.l > maxX) maxX = p.x + p.l;
      if (p.y + p.w > maxY) maxY = p.y + p.w;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY,
      w: maxX - minX, h: maxY - minY };
  }

  // 渲染指定层
  function renderLayer(layerIdx) {
    if (!ctx || !layerData || layerIdx >= layerData.length) return;
    activeLayer = layerIdx;
    var layer = layerData[layerIdx];
    // 按坐标排序，视觉更整齐（不改算法，只改显示顺序）
    var positions = layer.boxes.slice().sort(function(a, b) {
      if (Math.abs(a.y - b.y) > 5) return a.y - b.y;
      return a.x - b.x;
    });

    var wrap = canvas.parentElement;
    var wrapW = wrap ? wrap.clientWidth : 600;
    var wrapH = wrap ? wrap.clientHeight : 600;

    // 使用木箱尺寸确定画布比例
    var cL = crateDims ? crateDims.l : 0;
    var cW = crateDims ? crateDims.w : 0;
    var gap = crateDims ? (crateDims.gap || 0) : 0;
    if (cL <= 0 || cW <= 0) {
      var b = computeBounds(positions);
      cL = b.w; cW = b.h;
    }

    var padding = 60;
    var availW = wrapW - padding * 2;
    var availH = wrapH - padding * 2;
    if (availW < 200) availW = 560;
    if (availH < 200) availH = 560;

    var scale = Math.min(availW / cL, availH / cW);

    var cw = Math.max(Math.ceil(cL * scale) + padding * 2, 300);
    var ch = Math.max(Math.ceil(cW * scale) + padding * 2, 300);
    canvas.width = cw;
    canvas.height = ch;
    ctx.clearRect(0, 0, cw, ch);

    var offsetX = (cw - cL * scale) / 2;
    var offsetY = (ch - cW * scale) / 2;

    // 木箱外框填充（浅灰底色）
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(offsetX, offsetY, cL * scale, cW * scale);

    // 木箱外框（实线，深色）
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, cL * scale, cW * scale);

    // 尺寸标注（外框边缘）
    ctx.fillStyle = '#888';
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(cL + ' mm', offsetX + cL * scale / 2, offsetY - 6);
    ctx.save();
    ctx.translate(offsetX - 8, offsetY + cW * scale / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(cW + ' mm', 0, 0);
    ctx.restore();

    // gap 标记线（如果 gap > 0）
    if (gap > 0) {
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.strokeRect(offsetX + gap * scale, offsetY + gap * scale,
        (cL - gap * 2) * scale, (cW - gap * 2) * scale);
      ctx.setLineDash([]);
    }

    // 为每种纸箱颜色归类（通过 l,w,h 组合识别同一类型）
    var typeMap = {};
    var typeOrder = [];
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      var key = p.l + 'x' + p.w + 'x' + p.h;
      if (!typeMap[key]) {
        typeMap[key] = { l: p.l, w: p.w, h: p.h, color: getColorForType(typeOrder.length), count: 0 };
        typeOrder.push(key);
      }
      typeMap[key].count++;
    }

    // 绘制每个纸箱
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      var key = p.l + 'x' + p.w + 'x' + p.h;
      var typeInfo = typeMap[key];

      var rx = offsetX + p.x * scale;
      var ry = offsetY + (cW - p.y - p.w) * scale;
      var rw = p.l * scale;
      var rh = p.w * scale;

      ctx.fillStyle = typeInfo.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = typeInfo.color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(rx, ry, rw, rh);

      var fontSize = Math.max(10, Math.min(14, rw / 4.5));
      if (rw > 35 && rh > 25) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold ' + fontSize + 'px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 2;
        ctx.fillText(p.l + '×' + p.w, rx + rw / 2, ry + rh / 2);
        ctx.shadowBlur = 0;
      }
    }

    renderLegend(typeOrder, typeMap);
  }

  function getColorForType(idx) {
    var colors = ['#4f9cf9','#52c41a','#fa8c16','#f759ab','#722ed1','#13c2c2','#ff4d4f','#a0d911'];
    return colors[idx % colors.length];
  }

  function renderLegend(typeOrder, typeMap) {
    var x = 10, y = 10;
    for (var i = 0; i < typeOrder.length; i++) {
      var key = typeOrder[i];
      var info = typeMap[key];
      ctx.fillStyle = info.color;
      ctx.fillRect(x, y + i * 22, 14, 14);
      ctx.fillStyle = '#333';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(info.l + '×' + info.w + '×' + info.h + ' ×' + info.count, x + 18, y + i * 22 + 2);
    }
  }

  // 主渲染入口
  function render(result, crateInfo) {
    if (!result || !result.positions || result.positions.length === 0) {
      clearCanvas();
      return;
    }

    init();
    var positions = result.positions;
    layerData = groupByLayer(positions);
    crateDims = crateInfo || { l: 0, w: 0, gap: 0 };

    // 渲染层选择器
    var layerTabsEl = document.getElementById('layer-tabs');
    if (layerTabsEl) {
      layerTabsEl.innerHTML = '';
      for (var i = 0; i < layerData.length; i++) {
        var ld = layerData[i];
        var tab = document.createElement('button');
        tab.className = 'layer-tab';
        tab.textContent = ld.z + 'mm (' + ld.count + '个)';
        tab.setAttribute('data-layer', i);
        tab.onclick = function() {
          var idx = parseInt(this.getAttribute('data-layer'));
          document.querySelectorAll('.layer-tab').forEach(function(t) { t.classList.remove('active'); });
          this.classList.add('active');
          renderLayer(idx);
          updateLayerInfo(idx);
        };
        layerTabsEl.appendChild(tab);
      }
    }

    // 渲染第一层
    if (layerData.length > 0) {
      var firstTab = layerTabsEl.querySelector('.layer-tab');
      if (firstTab) firstTab.classList.add('active');
      renderLayer(0);
      updateLayerInfo(0);
    }

    // 更新信息栏
    var infoEl = document.getElementById('d2-info');
    if (infoEl && layerData.length > 0) {
      infoEl.innerHTML = '共 <b>' + layerData.length + '</b> 层 · 总计 <b>' + positions.length + '</b> 个纸箱';
    }
  }

  function updateLayerInfo(idx) {
    var infoEl = document.getElementById('d2-info');
    if (!infoEl || !layerData || idx >= layerData.length) return;
    var layer = layerData[idx];
    infoEl.innerHTML = '第 <b>' + (idx + 1) + '</b> 层 · Z=' + layer.z + 'mm · <b>' + layer.count + '</b> 个纸箱 · 共 ' + layerData.length + ' 层';
  }

  function clearCanvas() {
    if (!ctx) return;
    canvas.width = canvas.width;
    var layerTabsEl = document.getElementById('layer-tabs');
    if (layerTabsEl) layerTabsEl.innerHTML = '<span style="font-size:12px;color:#bbb">请先计算</span>';
    var infoEl = document.getElementById('d2-info');
    if (infoEl) infoEl.innerHTML = '<span>点击层标签切换视图</span>';
  }

  function resizeIfNeeded() {
    if (!layerData || layerData.length === 0) return;
    if (activeLayer !== undefined) renderLayer(activeLayer);
  }

  return {
    isReady: isReady, init: init, render: render,
    clearCanvas: clearCanvas, resizeIfNeeded: resizeIfNeeded
  };

  } catch(e) {
    console.error('[Visualizer2D] 模块初始化失败:', e);
    return { isReady: function(){return false}, init: function(){}, render: function(){},
      clearCanvas: function(){}, resizeIfNeeded: function(){} };
  }
})();
