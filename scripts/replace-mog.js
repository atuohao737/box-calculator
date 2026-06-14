const fs = require('fs');
const code = fs.readFileSync('src/js/packing-engine.js', 'utf-8');

const startMarker = '// 条带装箱（Strip Packing）v2：逐行填充，每行动态选择混合朝向';
const endMarker = '  // 单次混装计算（核心逻辑）';

const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx);

const replacement = 
`// 组合策略：单轴分界MOG + 条带装箱，取最优
  function calcMixedGrid(cL, cW, bL, bW) {
    var best = 0, bestPositions = null;

    // ===== 策略1：单轴X分界MOG =====
    var maxHx = Math.floor(cL / bL);
    for (var hx = 0; hx <= maxHx; hx++) {
      var remX = cL - hx * bL;
      var vx = remX >= 0 ? Math.floor(remX / bW) : 0;
      var hRows = Math.floor(cW / bW);
      var vRows = Math.floor(cW / bL);
      var total = hx * hRows + vx * vRows;
      if (total > best) {
        best = total;
        bestPositions = [];
        for (var xi = 0; xi < hx; xi++) {
          for (var yi = 0; yi < hRows; yi++) {
            bestPositions.push({ x: xi * bL, y: yi * bW, l: bL, w: bW, rotated: false });
          }
        }
        for (var xi2 = 0; xi2 < vx; xi2++) {
          for (var yi2 = 0; yi2 < vRows; yi2++) {
            bestPositions.push({ x: hx * bL + xi2 * bW, y: yi2 * bL, l: bW, w: bL, rotated: true });
          }
        }
      }
    }

    // ===== 策略2：单轴Y分界MOG（对称） =====
    var maxHy = Math.floor(cW / bW);
    for (var hy = 0; hy <= maxHy; hy++) {
      var remY = cW - hy * bW;
      var vy = remY >= 0 ? Math.floor(remY / bL) : 0;
      var hCols = Math.floor(cL / bL);
      var vCols = Math.floor(cL / bW);
      var total2 = hy * hCols + vy * vCols;
      if (total2 > best) {
        best = total2;
        bestPositions = [];
        for (var yi3 = 0; yi3 < hy; yi3++) {
          for (var xi3 = 0; xi3 < hCols; xi3++) {
            bestPositions.push({ x: xi3 * bL, y: yi3 * bW, l: bL, w: bW, rotated: false });
          }
        }
        for (var yi4 = 0; yi4 < vy; yi4++) {
          for (var xi4 = 0; xi4 < vCols; xi4++) {
            bestPositions.push({ x: xi4 * bW, y: hy * bW + yi4 * bL, l: bW, w: bL, rotated: true });
          }
        }
      }
    }

    // ===== 策略3：行内混排条带装箱 =====
    var rowHeights = [];
    if (bW > 0) rowHeights.push(bW);
    if (bL > 0 && Math.abs(bL - bW) > 0.01) rowHeights.push(bL);

    if (rowHeights.length > 0) {
      var rowCache = {};
      for (var hi = 0; hi < rowHeights.length; hi++) {
        var h = rowHeights[hi];
        var rBest = 0, rPl = [];
        var maxHx2 = Math.floor(cL / bL);
        for (var hx2 = 0; hx2 <= maxHx2; hx2++) {
          var remX2 = cL - hx2 * bL;
          var vx2 = remX2 >= 0 ? Math.floor(remX2 / bW) : 0;
          var validH = (hx2 === 0 || h >= bW) ? hx2 : 0;
          var validV = (vx2 === 0 || h >= bL) ? vx2 : 0;
          var tot = validH + validV;
          if (tot > rBest) {
            rBest = tot;
            rPl = [];
            for (var xi4 = 0; xi4 < validH; xi4++) {
              rPl.push({ x: xi4 * bL, l: bL, w: bW, rotated: false });
            }
            for (var xi5 = 0; xi5 < validV; xi5++) {
              rPl.push({ x: validH * bL + xi5 * bW, l: bW, w: bL, rotated: true });
            }
          }
        }
        rowCache[h] = { total: rBest, placements: rPl };
      }

      var maxDensity = 0;
      for (var hi2 = 0; hi2 < rowHeights.length; hi2++) {
        var d = rowCache[rowHeights[hi2]].total / rowHeights[hi2];
        if (d > maxDensity) maxDensity = d;
      }

      function dfs(y, pos) {
        if (y >= cW - 0.01) {
          if (pos.length > best) { best = pos.length; bestPositions = pos.slice(); }
          return;
        }
        var remY = cW - y;
        if (pos.length + Math.ceil(remY * maxDensity) <= best) return;

        for (var hi3 = 0; hi3 < rowHeights.length; hi3++) {
          var h3 = rowHeights[hi3];
          if (h3 > remY + 0.01) continue;
          var rr = rowCache[h3];
          if (rr.total === 0) continue;
          var nxt = pos.slice();
          for (var pi = 0; pi < rr.placements.length; pi++) {
            var pp = rr.placements[pi];
            nxt.push({ x: pp.x, y: y, l: pp.l, w: pp.w, rotated: pp.rotated });
          }
          dfs(y + h3, nxt);
        }
      }
      dfs(0, []);
    }

    return { total: best, config: null, positions: bestPositions || [] };
  }`;

fs.writeFileSync('src/js/packing-engine.js', code.substring(0, startIdx) + replacement);
console.log('Done');
