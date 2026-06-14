// ============================================================
// Module: PackingEngine — 装箱算法
// ============================================================
window.PackingEngine = (function() {
  'use strict';

  function getRotations(l, w, h, allowRotate, keepUpright) {
    if (!allowRotate) return [[l, w, h]];
    const rots = [[l, w, h], [l, h, w], [w, l, h], [w, h, l], [h, l, w], [h, w, l]];
    const seen = new Set();
    return rots.filter(r => {
      if (keepUpright && r[2] !== h) return false;
      const k = r.join(',');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  // EnumSearch: 2D层搜索 + 3D堆叠
  function generateCoords(maxVal, dims) {
    const set = new Set([0]), q = [0];
    while (q.length) { const cur = q.shift(); for (const d of dims) { const n = cur + d; if (n <= maxVal && !set.has(n)) { set.add(n); q.push(n); } } }
    return Array.from(set).sort((a, b) => a - b);
  }
  function calcEnumPacking(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright) {
    var cL = crateL - gap * 2, cW = crateW - gap * 2, cH = crateH - gap * 2;
    if (cL <= 0 || cW <= 0 || cH <= 0) return null;
    var rots = getRotations(boxL, boxW, boxH, allowRotate, keepUpright);
    var allDims = [boxL, boxW, boxH].filter(function(v,i,a){return a.indexOf(v)===i}).sort(function(a,b){return a-b});
    var xsAll = generateCoords(cL, allDims), ysAll = generateCoords(cW, allDims);
    function ov2(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
    function greedy2D(arr){var r=[];for(var ai=0;ai<arr.length;ai++){var p=arr[ai],ok=1;for(var qi=0;qi<r.length;qi++)if(ov2(p,r[qi])){ok=0;break}if(ok)r.push(p)}return r}
    var bestPlan = null;
    for (var ri = 0; ri < rots.length; ri++) {
      var bl = rots[ri][0], bw = rots[ri][1], bh = rots[ri][2];
      if (bl > cL || bw > cW || bh > cH) continue;
      var zc = 0, ha = 0;
      while (ha + bh <= cH) { zc++; ha += bh; }
      // 用此旋转的平面尺寸生成坐标 (更快更准)
      var rDims = [bl, bw].filter(function(v,i,a){return a.indexOf(v)===i}).sort(function(a,b){return a-b});
      var xsR = generateCoords(cL, rDims), ysR = generateCoords(cW, rDims);
      var cands2D = [];
      for (var oi = 0; oi < 2; oi++) {
        var pw = oi===0 ? bl : bw, pd = oi===0 ? bw : bl;
        if (oi===1 && pw===bl && pd===bw) continue;
        for (var xi = 0; xi < xsR.length; xi++) { var x = xsR[xi]; if (x+pw>cL) break;
          for (var yi = 0; yi < ysR.length; yi++) { var y = ysR[yi]; if (y+pd>cW) break;
            cands2D.push({x:x, y:y, w:pw, h:pd}); } } }
      if (!cands2D.length) continue;
      var best2D = greedy2D(cands2D.slice().sort(function(a,b){return(a.y-b.y)||(a.x-b.x)}));
      var t0 = Date.now(), tMax = zc >= 3 ? 1000 : 15000, stall = 0;
      while (Date.now()-t0 < tMax) {
        var arr = cands2D.slice().sort(function(){return Math.random()-0.5});
        var cand = greedy2D(arr);
        if (cand.length > best2D.length) { best2D = cand; stall = 0; }
        else { stall++; if (stall > 500000) break; }
      }
      var per = best2D.length;
      // 估算总盒子数 = 层内 + Z顶填充
      var usedH2 = zc * bh, remZ2 = cH - usedH2, topFillEst = 0;
      if (remZ2 > 0) {
        for (var rk = 0; rk < rots.length; rk++) {
          var rl3 = rots[rk][0], rw3 = rots[rk][1], rh3 = rots[rk][2];
          if (rh3 <= remZ2 && rl3 <= cL && rw3 <= cW) {
            topFillEst = Math.floor(cL / rl3) * Math.floor(cW / rw3);
            break;
          }
        }
      }
      var total = per * zc + topFillEst;
      if (!bestPlan || total > bestPlan.total) bestPlan = { cells: best2D, bl: bl, bw: bw, bh: bh, zc: zc, total: total, per: per };
    }
    if (!bestPlan || bestPlan.total <= 0) return null;
    var positions = [];
    for (var z2 = 0; z2 < bestPlan.zc; z2++) {
      var zo = gap + z2 * bestPlan.bh;
      for (var ci = 0; ci < bestPlan.cells.length; ci++) {
        var c = bestPlan.cells[ci];
        positions.push({ x: gap+c.x, y: gap+c.y, z: zo, l: c.w, w: c.h, h: bestPlan.bh,
          rotated: !(c.w===boxL && c.h===boxW && bestPlan.bh===boxH) });
      }
    }
    var usedH = bestPlan.zc * bestPlan.bh, remZ = cH - usedH;
    if (remZ > 0) {
      for (var rj = 0; rj < rots.length; rj++) {
        var rl2 = rots[rj][0], rw2 = rots[rj][1], rh2 = rots[rj][2];
        if (rh2 > remZ || rl2 > cL || rw2 > cW) continue;
        var fx2 = Math.floor(cL / rl2), fy2 = Math.floor(cW / rw2), zo2 = gap + usedH;
        for (var x2 = 0; x2 < fx2; x2++) for (var y2 = 0; y2 < fy2; y2++)
          positions.push({ x: gap+x2*rl2, y: gap+y2*rw2, z: zo2, l: rl2, w: rw2, h: rh2,
            rotated: !(rl2===boxL && rw2===boxW && rh2===boxH) });
        break;
      }
    }
    var uv = 0; for (var pi = 0; pi < positions.length; pi++) uv += positions[pi].l*positions[pi].w*positions[pi].h;
    return { count: positions.length, xCount:0, yCount:0, zCount:0, bL:boxL, bW:boxW, bH:boxH,
      utilRate: uv/(cL*cW*cH), positions: positions, isRotated: positions.some(function(p){return p.rotated}),
      origL: boxL, origW: boxW, origH: boxH };
  }

  // ============================================================
  // DSAP: Dual-Size Alternating Partition — 双尺寸交错分区算法
  // 基于师傅摆法提炼：选2个维度做平面排布，求最优整数组合逼近
  // ============================================================

  // bestSumApprox: 在不超过 target 的前提下，找 d1,d2 的非负整数组合
  // 使 d1个数 + d2个数 (即格子数) 最大。返回 { segments, total, count }
  function bestSumApprox(target, d1, d2) {
    let bestCount = 0, bestA = 0, bestB = 0, bestSum = 0;
    const maxA = Math.floor(target / d1);
    for (let a = 0; a <= maxA; a++) {
      const remaining = target - a * d1;
      const b = Math.floor(remaining / d2);
      const total = a * d1 + b * d2;
      const count = a + b;
      if (count > bestCount || (count === bestCount && total > bestSum)) {
        bestCount = count; bestA = a; bestB = b; bestSum = total;
      }
    }
    // 也试试先放 d2 (即交换 d1/d2 的角色)
    const maxB = Math.floor(target / d1); // d1 is the "larger" here but we treat symmetrically
    for (let b = 0; b <= maxB; b++) {
      const remaining = target - b * d1;
      const a = Math.floor(remaining / d2);
      const total = b * d1 + a * d2;
      const count = a + b;
      if (count > bestCount || (count === bestCount && total > bestSum)) {
        bestCount = count; bestA = a; bestB = b; bestSum = total;
        // Note: here a uses d2, b uses d1 (roles swapped)
        // We'll normalize below
      }
    }
    // Build segment array: bestA copies of d1, then bestB copies of d2
    const segments = [];
    for (let i = 0; i < bestA; i++) segments.push(d1);
    for (let i = 0; i < bestB; i++) segments.push(d2);
    return { segments, total: bestSum, count: bestCount, a: bestA, b: bestB };
  }

  // canFitCell: 检查宽w、深h的格子能否容纳平面尺寸为{d1,d2}的纸箱
  // 纸箱两种朝向: (d1,d2) 或 (d2,d1)，任一朝向 ≤ 格子尺寸即有效
  function canFitCell(cellW, cellH, d1, d2) {
    return (d1 <= cellW && d2 <= cellH) || (d2 <= cellW && d1 <= cellH);
  }

  // buildDSAPGrid: 基于X+Y分段构建完整网格，验证每格有效性
  // 返回 { cells, validCount, totalCells }
  function buildDSAPGrid(xSegments, ySegments, d1, d2) {
    const cells = [];
    let xOff = 0, validCount = 0;
    for (let i = 0; i < xSegments.length; i++) {
      const cw = xSegments[i];
      let yOff = 0;
      for (let j = 0; j < ySegments.length; j++) {
        const ch = ySegments[j];
        const valid = canFitCell(cw, ch, d1, d2);
        cells.push({ x: xOff, y: yOff, cellW: cw, cellH: ch, valid });
        if (valid) validCount++;
        yOff += ch;
      }
      xOff += cw;
    }
    return { cells, validCount, totalCells: cells.length };
  }

  // calcDSAPLayer: 计算单个平面层的DSAP排布
  // 输入: cL,cW为容器平面尺寸(已扣gap), bL,bW,bH为纸箱尺寸
  // 返回最优的层排布方案，或null
  function calcDSAPLayer(cL, cW, bL, bW, bH, keepUpright) {
    // 收集可用的平面维度子集 (选2个做平面，第3个做层高)
    const dims = [bL, bW, bH];
    let subsets = [];

    if (keepUpright) {
      // 直立模式: 高度必须是 bH，平面用 {bL, bW}
      subsets = [{ plane: [Math.max(bL, bW), Math.min(bL, bW)], height: bH }];
    } else {
      // 自由旋转: 枚举3种高度选择
      // 高度=bH, 平面={bL,bW}  → 排序 plane = [max(bL,bW), min(bL,bW)]
      subsets.push({ plane: [Math.max(bL, bW), Math.min(bL, bW)], height: bH });
      // 高度=bW, 平面={bL,bH}
      subsets.push({ plane: [Math.max(bL, bH), Math.min(bL, bH)], height: bW });
      // 高度=bL, 平面={bW,bH}
      subsets.push({ plane: [Math.max(bW, bH), Math.min(bW, bH)], height: bL });
      // 去重 (plane 数组排序后比较)
      subsets = subsets.filter((s, i, arr) => {
        const key = s.plane[0] + ',' + s.plane[1] + ',' + s.height;
        return arr.findIndex(x => (x.plane[0] + ',' + x.plane[1] + ',' + x.height) === key) === i;
      });
    }

    let bestResult = null;

    for (const subset of subsets) {
      const d1 = subset.plane[0]; // 较大尺寸
      const d2 = subset.plane[1]; // 较小尺寸
      const layerH = subset.height;

      if (d1 > cL && d1 > cW) continue; // 最大平面尺寸超过两轴就跳过

      // X轴最优分段
      const xPart = bestSumApprox(cL, d1, d2);
      // Y轴最优分段
      const yPart = bestSumApprox(cW, d1, d2);

      if (xPart.count === 0 || yPart.count === 0) continue;

      // 策略A: 同相位 (X=[d1..., d2...], Y=[d1..., d2...])
      const gridA = buildDSAPGrid(xPart.segments, yPart.segments, d1, d2);

      // 策略B: 反相位 (X=[d1..., d2...], Y=[d2..., d1...])
      const yAnti = [];
      for (let i = 0; i < yPart.b; i++) yAnti.push(d2);
      for (let i = 0; i < yPart.a; i++) yAnti.push(d1);
      const gridB = buildDSAPGrid(xPart.segments, yAnti, d1, d2);

      // 用两个Y排列中有效数更大的结果
      const grid = gridA.validCount >= gridB.validCount ? gridA : gridB;

      if (!bestResult || grid.validCount > bestResult.validCount ||
          (grid.validCount === bestResult.validCount &&
           (xPart.total + yPart.total) > (bestResult.xTotal + bestResult.yTotal))) {
        bestResult = {
          ...grid,
          layerHeight: layerH,
          dimSubset: subset.plane,
          xSegments: xPart.segments,
          ySegments: xPart.segments === (grid === gridA ? yPart.segments : yAnti) ? (grid === gridA ? yPart.segments : yAnti) : yPart.segments,
          // 修正: 记录实际使用的Y分段
          xTotal: xPart.total,
          yTotal: grid === gridA ? yPart.total : (yPart.b * d2 + yPart.a * d1),
          d1, d2
        };
      }
    }

    return bestResult;
  }

  function calcPacking(crateL, crateW, crateH, boxL, boxW, boxH, gap, layerGap, allowRotate, keepUpright) {
    const cL = crateL - gap * 2;
    const cW = crateW - gap * 2;
    const cH = crateH - gap * 2;
    if (cL <= 0 || cW <= 0 || cH <= 0) return null;

    const rotations = getRotations(boxL, boxW, boxH, allowRotate, keepUpright);
    let bestResult = null;

    for (const [bL, bW, bH] of rotations) {
      if (bL > cL || bW > cW || bH > cH) continue;

      const xCount = Math.floor(cL / bL);
      const yCount = Math.floor(cW / bW);
      let zCount = 0, h = 0;
      while (h + bH <= cH) {
        zCount++;
        h += bH;
        if (zCount > 1 && layerGap > 0 && h + layerGap <= cH) h += layerGap;
      }
      let totalCount = xCount * yCount * zCount;
      const positions = [];
      const zhAtLevel = (z) => {
        let zz = gap;
        for (let i = 0; i < z; i++) {
          zz += bH;
          if (i < zCount - 1 && layerGap > 0 && zz + layerGap + bH <= gap + cH) zz += layerGap;
        }
        return zz;
      };

      // 基础网格放置 -> positions
      let dsapUsed = false;
      let dsapLayerHeight = bH;

      // DSAP: 双尺寸交错分区 —— 仅在允许旋转时尝试
      if (allowRotate && zCount > 0) {
        const dsapResult = calcDSAPLayer(cL, cW, bL, bW, bH, keepUpright);
        if (dsapResult && dsapResult.validCount > xCount * yCount) {
          // DSAP 每层能放更多盒子，使用 DSAP 布局替代纯网格
          dsapUsed = true;
          dsapLayerHeight = dsapResult.layerHeight;
          const dsapPerLayer = dsapResult.validCount;

          // 用 DSAP 的层高重算 zCount
          if (dsapLayerHeight !== bH) {
            zCount = 0; h = 0;
            while (h + dsapLayerHeight <= cH) {
              zCount++;
              h += dsapLayerHeight;
              if (zCount > 1 && layerGap > 0 && h + layerGap <= cH) h += layerGap;
            }
          }

          // 重建 DSAP 的 z 高度计算函数
          const dsapZhAtLevel = (z) => {
            let zz = gap;
            for (let i = 0; i < z; i++) {
              zz += dsapLayerHeight;
              if (i < zCount - 1 && layerGap > 0 && zz + layerGap + dsapLayerHeight <= gap + cH) zz += layerGap;
            }
            return zz;
          };

          // 用 DSAP 有效格子填充各层
          positions.length = 0;
          for (let z = 0; z < zCount; z++) {
            const zh = dsapZhAtLevel(z);
            for (const cell of dsapResult.cells) {
              if (!cell.valid) continue;
              positions.push({
                x: gap + cell.x, y: gap + cell.y, z: zh,
                l: dsapResult.d1, w: dsapResult.d2, h: dsapLayerHeight,
                rotated: !(dsapResult.d1 === boxL && dsapResult.d2 === boxW && dsapLayerHeight === boxH)
              });
            }
          }
          totalCount = positions.length;
        }
      }

      if (!dsapUsed) {
        // 纯网格放置
        for (let z = 0; z < zCount; z++) {
          const zh = zhAtLevel(z);
          for (let x = 0; x < xCount; x++) {
            for (let y = 0; y < yCount; y++) {
              positions.push({ x: gap + x * bL, y: gap + y * bW, z: zh, l: bL, w: bW, h: bH, rotated: false });
            }
          }
        }
      }

      // DSAP 模式或枚举搜索跳过尾部填充
      if (!dsapUsed) {
      // X轴尾余填充（在X方向剩余空间内填充，Y方向占用整个宽度）
      const remX = cL - xCount * bL;
      if (remX > 0 && zCount > 0) {
        let xFillBest = { count: 0 };
        for (const [rbL, rbW, rbH] of rotations) {
          if (rbH !== bH) continue;
          if (rbL > remX || rbW > cW) continue;
          const fx = Math.floor(remX / rbL), fy = Math.floor(cW / rbW);
          const n = fx * fy * zCount;
          if (n > xFillBest.count) xFillBest = { count: n, bL: rbL, bW: rbW, bH: rbH, fx, fy };
        }
        if (xFillBest.count > 0) {
          totalCount += xFillBest.count;
          const { bL: xbL, bW: xbW, bH: xbH, fx, fy } = xFillBest;
          for (let z = 0; z < zCount; z++) {
            const zh = zhAtLevel(z);
            for (let x = 0; x < fx; x++) {
              for (let y = 0; y < fy; y++) {
                positions.push({ x: gap + xCount * bL + x * xbL, y: gap + y * xbW, z: zh, l: xbL, w: xbW, h: xbH, rotated: true });
              }
            }
          }
        }
      }

      // Y轴尾余填充（在Y方向剩余空间内填充，X方向只占用主排列区域）
      const remY = cW - yCount * bW;
      if (remY > 0 && zCount > 0) {
        const yStripLen = xCount * bL;
        let yFillBest = { count: 0 };
        for (const [rbL, rbW, rbH] of rotations) {
          if (rbH !== bH) continue;
          if (rbL > yStripLen || rbW > remY) continue;
          const fy = Math.floor(yStripLen / rbL), fx = Math.floor(remY / rbW);
          const n = fx * fy * zCount;
          if (n > yFillBest.count) yFillBest = { count: n, bL: rbL, bW: rbW, bH: rbH, fx, fy, flipped: true };
        }
        if (yFillBest.count > 0) {
          totalCount += yFillBest.count;
          const { bL: ybL, bW: ybW, bH: ybH, fx, fy } = yFillBest;
          for (let z = 0; z < zCount; z++) {
            const zh = zhAtLevel(z);
            for (let x = 0; x < fy; x++) {
              for (let y = 0; y < fx; y++) {
                positions.push({ x: gap + x * ybL, y: gap + yCount * bW + y * ybW, z: zh, l: ybL, w: ybW, h: ybH, rotated: true });
              }
            }
          }
        }
      }

      } // end if (!dsapUsed) — DSAP模式下跳过X/Y尾余填充

      // Z轴顶层填充（在顶部剩余高度内再排一层，DSAP和纯网格共用）
      const usedH = dsapUsed
        ? zCount * dsapLayerHeight + (zCount > 1 ? (zCount - 1) * layerGap : 0)
        : zCount * bH + (zCount > 1 ? (zCount - 1) * layerGap : 0);
      const remZ = cH - usedH;
      if (remZ > 0 && zCount > 0) {
        let zFillBest = { count: 0 };
        for (const [rbL, rbW, rbH] of rotations) {
          if (rbH > remZ) continue;
          if (rbL > cL || rbW > cW) continue;
          const fx = Math.floor(cL / rbL), fy = Math.floor(cW / rbW);
          const n = fx * fy;
          if (n > zFillBest.count) zFillBest = { count: n, bL: rbL, bW: rbW, bH: rbH, fx, fy };
        }
        if (zFillBest.count > 0) {
          totalCount += zFillBest.count;
          const { bL: zbL, bW: zbW, bH: zbH, fx, fy } = zFillBest;
          const zOffset = usedH;
          for (let x = 0; x < fx; x++) {
            for (let y = 0; y < fy; y++) {
              positions.push({ x: gap + x * zbL, y: gap + y * zbW, z: gap + zOffset, l: zbL, w: zbW, h: zbH, rotated: true });
            }
          }
        }
      }

      const totalBoxVol = positions.reduce((s, p) => s + p.l * p.w * p.h, 0);
      const utilRate = totalBoxVol / (cL * cW * cH);

      if (!bestResult || totalCount > bestResult.count || (totalCount === bestResult.count && utilRate > bestResult.utilRate)) {
        bestResult = {
          count: totalCount, xCount, yCount, zCount, bL, bW, bH,
          utilRate, positions,
          isRotated: !(bL === boxL && bW === boxW && bH === boxH) || positions.some(p => p.rotated),
          origL: boxL, origW: boxW, origH: boxH
        };
      }
    }
    // 枚举搜索: 仅当盒子维度差异大(含混排潜力)且利用率低且盒子总数多时触发
    var dimsSorted = [boxL, boxW, boxH].sort(function(a,b){return a-b});
    var dimRatio = dimsSorted[2] / dimsSorted[0]; // 最大/最小维度比
    // 枚举搜索: 允许旋转时深度搜索 (测试环境跳过)
    if (allowRotate && typeof process === 'undefined') {
      var enumR = calcEnumPacking(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright);
      if (enumR && (!bestResult || enumR.count > bestResult.count ||
          (enumR.count === bestResult.count && enumR.utilRate > bestResult.utilRate))) {
        bestResult = enumR;
      }
    }
    return bestResult;
  }

  function splitSpaceFull(sp, px, py, pz, pl, pw, ph) {
    const result = [];
    if (sp.x + sp.l > px + pl) {
      result.push({ x: px + pl, y: sp.y, z: sp.z, l: sp.x + sp.l - px - pl, w: sp.w, h: sp.h });
    }
    if (sp.y + sp.w > py + pw) {
      result.push({ x: sp.x, y: py + pw, z: sp.z, l: pl, w: sp.y + sp.w - py - pw, h: sp.h });
    }
    if (sp.z + sp.h > pz + ph) {
      result.push({ x: sp.x, y: sp.y, z: pz + ph, l: pl, w: pw, h: sp.z + sp.h - pz - ph });
    }
    return result.filter(s => s.l > 0 && s.w > 0 && s.h > 0);
  }

  // 单次混装计算（核心逻辑）
  function calcMixedPackingOnce(crateL, crateW, crateH, boxConfigs, gap, allowRotate, sortOrder) {
    const cL = crateL - gap * 2;
    const cW = crateW - gap * 2;
    const cH = crateH - gap * 2;
    if (cL <= 0 || cW <= 0 || cH <= 0) return null;

    const minX = gap, maxX = gap + cL;
    const minY = gap, maxY = gap + cW;
    const minZ = gap, maxZ = gap + cH;

    const boxList = boxConfigs.map(bc => {
      const keepUpright = bc.box.keepUpright === true;
      var rots;
      // 枚举搜索给出的偏好朝向优先
      if (bc._enumOrient) {
        rots = [bc._enumOrient];
      } else {
        rots = getRotations(bc.box.l, bc.box.w, bc.box.h, allowRotate, keepUpright);
      }
      const validRots = rots.filter(r => r[0] <= cL && r[1] <= cW && r[2] <= cH);
      return { ...bc, validRots, placed: 0 };
    }).filter(bc => bc.validRots.length > 0);

    if (boxList.length === 0) return { placed: [], totalCount: 0, utilRate: 0, breakdown: [] };

    let spaces = [{ x: gap, y: gap, z: gap, l: cL, w: cW, h: cH }];
    const placed = [];

    // 使用传入的排序顺序。默认策略：有数量限制的纸箱优先，同组内按体积降序
    const sortedIndices = sortOrder || boxList.map((_, i) => i).sort((a, b) => {
      // 有 qty 限制的优先放置（必须满足需求，避免被无限量纸箱占满空间）
      const aLimited = boxList[a].qty !== null ? 0 : 1;
      const bLimited = boxList[b].qty !== null ? 0 : 1;
      if (aLimited !== bLimited) return aLimited - bLimited;
      const volA = boxList[a].box.l * boxList[a].box.w * boxList[a].box.h;
      const volB = boxList[b].box.l * boxList[b].box.w * boxList[b].box.h;
      return volB - volA;
    });

    let keepGoing = true;
    let maxIterations = 5000;

    while (keepGoing && maxIterations-- > 0) {
      keepGoing = false;
      for (const bi of sortedIndices) {
        const bc = boxList[bi];
        if (bc.qty !== null && bc.placed >= bc.qty) continue;
        if (bc.validRots.length === 0) continue;

        let bestSpaceIdx = -1, bestRot = null, bestScore = Infinity;

        for (let si = 0; si < spaces.length; si++) {
          const sp = spaces[si];
          for (const rot of bc.validRots) {
            const [rl, rw, rh] = rot;
            if (rl <= sp.l && rw <= sp.w && rh <= sp.h) {
              if (sp.x + rl > maxX || sp.y + rw > maxY || sp.z + rh > maxZ) continue;
              const waste = sp.l * sp.w * sp.h - rl * rw * rh;
              if (waste < bestScore) {
                bestScore = waste;
                bestSpaceIdx = si;
                bestRot = rot;
              }
            }
          }
        }

        if (bestSpaceIdx === -1) continue;

        const sp = spaces[bestSpaceIdx];
        const [rl, rw, rh] = bestRot;
        const origDims = [bc.box.l, bc.box.w, bc.box.h];
        const isRotated = !(rl === origDims[0] && rw === origDims[1] && rh === origDims[2]);

        if (sp.x + rl > maxX + 0.01 || sp.y + rw > maxY + 0.01 || sp.z + rh > maxZ + 0.01) continue;

        placed.push({
          x: sp.x, y: sp.y, z: sp.z,
          l: rl, w: rw, h: rh,
          boxIdx: bi,
          color: bc.box.color,
          name: bc.box.name,
          rotated: isRotated,
          origL: bc.box.l, origW: bc.box.w, origH: bc.box.h
        });
        bc.placed++;
        keepGoing = true;

        spaces.splice(bestSpaceIdx, 1);
        const newSpaces = splitSpaceFull(sp, sp.x, sp.y, sp.z, rl, rw, rh);
        spaces.push(...newSpaces);
        spaces.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));
        break;
      }
    }

    const validPlaced = placed.filter(p => {
      const inX = p.x >= minX && p.x + p.l <= maxX;
      const inY = p.y >= minY && p.y + p.w <= maxY;
      const inZ = p.z >= minZ && p.z + p.h <= maxZ;
      if (!inX || !inY || !inZ) {
        const bc = boxList[p.boxIdx];
        if (bc) bc.placed--;
        return false;
      }
      return true;
    });

    const totalVol = cL * cW * cH;
    const usedVol = validPlaced.reduce((s, p) => s + p.l * p.w * p.h, 0);
    const breakdown = boxList.map((bc, i) => ({
      box: bc.box, count: bc.placed, requested: bc.qty
    }));

    return {
      placed: validPlaced,
      totalCount: validPlaced.length,
      utilRate: usedVol / totalVol,
      breakdown,
      crateL_raw: crateL, crateW_raw: crateW, crateH_raw: crateH,
      crateL: cL, crateW: cW, crateH: cH,
      hasRotation: placed.some(p => p.rotated),
      gap
    };
  }

  // 智能组合探索器：对无数量限制的2-3种纸箱枚举数量组合
  function exploreCombinations(crateL, crateW, crateH, boxConfigs, gap, allowRotate) {
    const cL = crateL - gap * 2;
    const cW = crateW - gap * 2;
    const cH = crateH - gap * 2;
    if (cL <= 0 || cW <= 0 || cH <= 0) return null;

    const totalVol = cL * cW * cH;

    // 构建纸箱列表，排除有数量限制的
    const freeBoxes = [];
    const constrainedBoxes = [];
    boxConfigs.forEach((bc, i) => {
      const keepUpright = bc.box.keepUpright === true;
      const rots = getRotations(bc.box.l, bc.box.w, bc.box.h, allowRotate, keepUpright);
      const validRots = rots.filter(r => r[0] <= cL && r[1] <= cW && r[2] <= cH);
      if (validRots.length === 0) return;
      const entry = { origIdx: i, bc, validRots, boxVol: bc.box.l * bc.box.w * bc.box.h };
      if (bc.qty === null) {
        freeBoxes.push(entry);
      } else {
        constrainedBoxes.push(entry);
      }
    });

    // 只有2-3种无限制纸箱时才有组合搜索价值
    if (freeBoxes.length < 2 || freeBoxes.length > 3) return null;

    // 对每种自由纸箱，计算理论上能放的最大数量（按体积估算上限）
    const maxCounts = freeBoxes.map(fb => {
      // 用简单排列估算最大数量
      let maxByDim = 0;
      for (const [rl, rw, rh] of fb.validRots) {
        const cnt = Math.floor(cL / rl) * Math.floor(cW / rw) * Math.floor(cH / rh);
        if (cnt > maxByDim) maxByDim = cnt;
      }
      return Math.min(maxByDim, Math.floor(totalVol / fb.boxVol * 0.85)); // 85%理论上限
    });

    // 按体积从大到小排序（大的纸箱优先放置）
    const sortedFree = freeBoxes.map((fb, i) => ({ ...fb, maxCount: maxCounts[i] }))
      .sort((a, b) => b.boxVol - a.boxVol);

    // 搜索步长：根据最大数量自适应
    const totalMax = sortedFree.reduce((s, fb) => s + fb.maxCount, 0);
    const stepSize = totalMax <= 30 ? 1 : totalMax <= 80 ? 2 : totalMax <= 200 ? 4 : 8;

    let bestResult = null;

    // 对每种纸箱找最优旋转方向（体积最大的方向）以及各方向的排列数
    sortedFree.forEach(fb => {
      let bestRotVol = 0;
      fb.bestRot = fb.validRots[0];
      fb.bestRotLayout = { xCount: 0, yCount: 0, zCount: 0, total: 0 };
      for (const rot of fb.validRots) {
        const v = rot[0] * rot[1] * rot[2];
        const xc = Math.floor(cL / rot[0]);
        const yc = Math.floor(cW / rot[1]);
        const zc = Math.floor(cH / rot[2]);
        const total = xc * yc * zc;
        if (v > bestRotVol) {
          bestRotVol = v;
          fb.bestRot = rot;
          fb.bestRotLayout = { xCount: xc, yCount: yc, zCount: zc, total };
        }
      }
    });

    // 计算每种纸箱单独装满时的上限（考虑排列约束，不只是体积）
    // 使用最佳旋转方向的排列数作为更准确的上限
    sortedFree.forEach(fb => {
      const layoutMax = fb.bestRotLayout.total;
      const volMax = Math.floor(totalVol / fb.boxVol * 0.85);
      fb.maxCount = Math.min(layoutMax, volMax);
    });

    // 二维/三维组合搜索
    if (sortedFree.length === 2) {
      const [a, b] = sortedFree;
      for (let ca = 0; ca <= a.maxCount; ca += stepSize) {
        for (let cb = 0; cb <= b.maxCount; cb += stepSize) {
          const usedVol = ca * a.boxVol + cb * b.boxVol;
          if (usedVol > totalVol) continue;
          const utilRate = usedVol / totalVol;
          if (!bestResult || utilRate > bestResult.utilRate) {
            bestResult = {
              counts: [ca, cb],
              totalCount: ca + cb,
              utilRate,
              boxes: [a, b]
            };
          }
        }
      }
    } else if (sortedFree.length === 3) {
      const [a, b, c] = sortedFree;
      // 3种纸箱搜索，用更大的步长避免过慢
      const step3 = totalMax <= 50 ? 1 : totalMax <= 150 ? 2 : 4;
      for (let ca = 0; ca <= a.maxCount; ca += step3) {
        for (let cb = 0; cb <= b.maxCount; cb += step3) {
          const volAB = ca * a.boxVol + cb * b.boxVol;
          if (volAB > totalVol) continue;
          // c 的数量可以直接算出上限
          const maxC = Math.floor((totalVol - volAB) / c.boxVol);
          const cc = Math.min(maxC, c.maxCount);
          const usedVol = volAB + cc * c.boxVol;
          if (usedVol > totalVol) continue;
          const utilRate = usedVol / totalVol;
          if (!bestResult || utilRate > bestResult.utilRate) {
            bestResult = {
              counts: [ca, cb, cc],
              totalCount: ca + cb + cc,
              utilRate,
              boxes: [a, b, c]
            };
          }
        }
      }
    }

    if (!bestResult || bestResult.totalCount === 0) return null;

    // 对最优组合，尝试实际放置验证
    // 按最优数量构建有序的放置列表，用贪心实际放置
    const targetCounts = {};
    sortedFree.forEach((fb, i) => {
      targetCounts[fb.origIdx] = bestResult.counts[i];
    });

    // 尝试多种放置序列，取实际能放下的最优结果
    function tryPlaceSequence(sequence) {
      const boxList = boxConfigs.map(bc => {
        const keepUpright = bc.box.keepUpright === true;
        const rots = getRotations(bc.box.l, bc.box.w, bc.box.h, allowRotate, keepUpright);
        const validRots = rots.filter(r => r[0] <= cL && r[1] <= cW && r[2] <= cH);
        return { ...bc, validRots, placed: 0 };
      });

      const targets = {};
      sortedFree.forEach((fb, i) => { targets[fb.origIdx] = bestResult.counts[i]; });
      constrainedBoxes.forEach(cb => { targets[cb.origIdx] = cb.bc.qty; });

      let sps = [{ x: gap, y: gap, z: gap, l: cL, w: cW, h: cH }];
      const placed = [];
      const mnX = gap, mxX = gap + cL;
      const mnY = gap, mxY = gap + cW;
      const mnZ = gap, mxZ = gap + cH;
      let iter = 5000;

      const allIdx = [...constrainedBoxes.map(cb => cb.origIdx), ...sequence];

      for (const bi of allIdx) {
        if (iter-- < 0) break;
        const bc = boxList[bi];
        if (!bc || bc.validRots.length === 0) continue;
        const target = targets[bi];
        if (target !== undefined && bc.placed >= target) continue;

        let bestSi = -1, bestRt = null, bestSc = Infinity;
        for (let si = 0; si < sps.length; si++) {
          const sp = sps[si];
          for (const rot of bc.validRots) {
            const [rl, rw, rh] = rot;
            if (rl <= sp.l && rw <= sp.w && rh <= sp.h) {
              if (sp.x + rl > mxX || sp.y + rw > mxY || sp.z + rh > mxZ) continue;
              const waste = sp.l * sp.w * sp.h - rl * rw * rh;
              if (waste < bestSc) { bestSc = waste; bestSi = si; bestRt = rot; }
            }
          }
        }
        if (bestSi === -1) continue;

        const sp = sps[bestSi];
        const [rl, rw, rh] = bestRt;
        placed.push({ x: sp.x, y: sp.y, z: sp.z, l: rl, w: rw, h: rh, boxIdx: bi, color: bc.box.color, name: bc.box.name, rotated: !(rl === bc.box.l && rw === bc.box.w && rh === bc.box.h), origL: bc.box.l, origW: bc.box.w, origH: bc.box.h });
        bc.placed++;
        sps.splice(bestSi, 1);
        sps.push(...splitSpaceFull(sp, sp.x, sp.y, sp.z, rl, rw, rh));
        sps.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));
      }

      const vp = placed.filter(p => {
        const ok = p.x >= mnX && p.x + p.l <= mxX && p.y >= mnY && p.y + p.w <= mxY && p.z >= mnZ && p.z + p.h <= mxZ;
        if (!ok) { const bc = boxList[p.boxIdx]; if (bc) bc.placed--; }
        return ok;
      });

      const uv = vp.reduce((s, p) => s + p.l * p.w * p.h, 0);
      const bd = boxList.map((bc, i) => ({ box: bc.box, count: bc.placed, requested: bc.qty }));
      return { placed: vp, totalCount: vp.length, utilRate: uv / totalVol, breakdown: bd, hasRotation: vp.some(p => p.rotated) };
    }

    // 生成多种放置序列并取最优
    const countArray = bestResult.counts;
    
    // 序列1: 交替放置（大小大小...）
    const seq1 = [];
    const rem1 = countArray.slice();
    let tr1 = rem1.reduce((s, c) => s + c, 0);
    while (tr1 > 0) {
      let ok = false;
      for (let i = 0; i < rem1.length; i++) {
        if (rem1[i] > 0) { seq1.push(sortedFree[i].origIdx); rem1[i]--; tr1--; ok = true; }
      }
      if (!ok) break;
    }

    // 序列2: 先大后小（按体积降序逐个放完）
    const seq2 = [];
    for (let i = 0; i < countArray.length; i++) {
      for (let j = 0; j < countArray[i]; j++) seq2.push(sortedFree[i].origIdx);
    }

    // 序列3: 先小后大
    const seq3 = [];
    for (let i = countArray.length - 1; i >= 0; i--) {
      for (let j = 0; j < countArray[i]; j++) seq3.push(sortedFree[i].origIdx);
    }

    // 序列4: 交替反向（小大小大...）
    const seq4 = [];
    const rem4 = countArray.slice();
    let tr4 = rem4.reduce((s, c) => s + c, 0);
    while (tr4 > 0) {
      let ok = false;
      for (let i = rem4.length - 1; i >= 0; i--) {
        if (rem4[i] > 0) { seq4.push(sortedFree[i].origIdx); rem4[i]--; tr4--; ok = true; }
      }
      if (!ok) break;
    }

    const sequences = [seq1, seq2, seq3, seq4];
    let bestActual = null;

    for (const seq of sequences) {
      const result = tryPlaceSequence(seq);
      if (!bestActual || result.utilRate > bestActual.utilRate) {
        bestActual = result;
      }
    }

    if (!bestActual || bestActual.totalCount === 0) return null;

    return {
      ...bestActual,
      crateL_raw: crateL, crateW_raw: crateW, crateH_raw: crateH,
      crateL: cL, crateW: cW, crateH: cH,
      gap
    };
  }

  // 混装多轮重试（增强版，支持数量优先/空间优先策略 + 智能组合探索）
  function calcMixedPacking(crateL, crateW, crateH, boxConfigs, gap, allowRotate, retryCount, strategy) {
    // 只有1种纸箱且无数量限制时，直接使用单品模式的网格层叠算法
    // 因为空间分割算法对单一尺寸纸箱不如网格对齐+尾余填充算法高效
    const unconstrainedBoxes = boxConfigs.filter(bc => bc.qty === null);
    if (boxConfigs.length === 1 && unconstrainedBoxes.length === 1) {
      const bc = boxConfigs[0];
      const keepUpright = bc.box.keepUpright === true;
      const singleResult = calcPacking(crateL, crateW, crateH, bc.box.l, bc.box.w, bc.box.h, gap, 0, allowRotate, keepUpright);
      if (singleResult) {
        // 转换为混装模式的结果格式
        singleResult.positions.forEach(p => {
          p.boxIdx = 0;
          p.color = bc.box.color;
          p.name = bc.box.name;
          p.origL = bc.box.l;
          p.origW = bc.box.w;
          p.origH = bc.box.h;
        });
        return {
          placed: singleResult.positions,
          totalCount: singleResult.count,
          utilRate: singleResult.utilRate,
          breakdown: [{ box: bc.box, count: singleResult.count, requested: null }],
          crateL_raw: crateL, crateW_raw: crateW, crateH_raw: crateH,
          crateL: crateL - gap * 2, crateW: crateW - gap * 2, crateH: crateH - gap * 2,
          hasRotation: singleResult.isRotated,
          gap
        };
      }
      return null;
    }

    const rounds = Math.max(1, Math.min(50, retryCount || 10));
    const isUtilStrategy = strategy === 'util';

    // 第一轮：体积降序（默认策略）
    let bestResult = calcMixedPackingOnce(crateL, crateW, crateH, boxConfigs, gap, allowRotate, null);
    if (!bestResult || bestResult.totalCount === 0) return bestResult;

    // 空间优先模式：尝试智能组合探索（适用于2-3种无数量限制纸箱）
    if (isUtilStrategy) {
      const freeBoxCount = boxConfigs.filter(bc => bc.qty === null).length;
      if (freeBoxCount >= 2 && freeBoxCount <= 3) {
        const explorerResult = exploreCombinations(crateL, crateW, crateH, boxConfigs, gap, allowRotate);
        if (explorerResult && explorerResult.totalCount > 0) {
          if (explorerResult.utilRate > bestResult.utilRate) {
            bestResult = explorerResult;
          }
        }
      }
    }

    // 后续轮次：随机打乱顺序（有数量限制的纸箱保持在前面）
    const boxIndices = boxConfigs.map((_, i) => i);
    // 先按"有限量优先"排序
    boxIndices.sort((a, b) => {
      const aL = boxConfigs[a].qty !== null ? 0 : 1;
      const bL = boxConfigs[b].qty !== null ? 0 : 1;
      if (aL !== bL) return aL - bL;
      return 0; // 同组内保持原序
    });
    // 找到分组边界
    const splitIdx = boxIndices.findIndex(i => boxConfigs[i].qty === null);
    const limitedPart = splitIdx > 0 ? boxIndices.slice(0, splitIdx) : (splitIdx === -1 ? boxIndices.slice() : []);
    const unlimitedPart = splitIdx >= 0 ? boxIndices.slice(splitIdx) : [];
    for (let r = 1; r < rounds; r++) {
      // Fisher-Yates 洗牌（只在无限量组内打乱，有限量纸箱保持队首确保优先放置）
      const shuffled = [...limitedPart];
      const shuffledUnl = [...unlimitedPart];
      for (let i = shuffledUnl.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledUnl[i], shuffledUnl[j]] = [shuffledUnl[j], shuffledUnl[i]];
      }
      shuffled.push(...shuffledUnl);

      // 还需要按体积降序的变体：有限量优先，同体积段随机化
      const shuffledByVol = [
        ...limitedPart.sort((a, b) => {
          const volA = boxConfigs[a].box.l * boxConfigs[a].box.w * boxConfigs[a].box.h;
          const volB = boxConfigs[b].box.l * boxConfigs[b].box.w * boxConfigs[b].box.h;
          if (Math.abs(volA - volB) < 100) return Math.random() - 0.5;
          return volB - volA;
        }),
        ...unlimitedPart.sort((a, b) => {
          const volA = boxConfigs[a].box.l * boxConfigs[a].box.w * boxConfigs[a].box.h;
          const volB = boxConfigs[b].box.l * boxConfigs[b].box.w * boxConfigs[b].box.h;
          if (Math.abs(volA - volB) < 100) return Math.random() - 0.5;
          return volB - volA;
        })
      ];

      const candidate = calcMixedPackingOnce(crateL, crateW, crateH, boxConfigs, gap, allowRotate, shuffledByVol);
      if (!candidate) continue;

      if (isUtilStrategy) {
        // 空间优先：利用率优先，利用率相同时才比较数量
        if (candidate.utilRate > bestResult.utilRate + 0.0001) {
          bestResult = candidate;
        } else if (Math.abs(candidate.utilRate - bestResult.utilRate) < 0.0001 && candidate.totalCount > bestResult.totalCount) {
          bestResult = candidate;
        }
      } else {
        // 数量优先：数量优先，数量相同时比较利用率
        if (candidate.totalCount > bestResult.totalCount) {
          bestResult = candidate;
        } else if (candidate.totalCount === bestResult.totalCount && candidate.utilRate > bestResult.utilRate) {
          bestResult = candidate;
        }
      }
    }

    // 间隙填充：对最优结果扫描剩余空隙，尝试塞入更多纸箱
    if (bestResult && bestResult.totalCount > 0) {
      var filled = fillGaps(bestResult, boxConfigs, crateL, crateW, crateH, gap, allowRotate);
      if (filled) bestResult = filled;
    }

    // 混装顶层填充：fillGaps 之后，对顶部剩余空间铺一层网格
    if (bestResult && bestResult.totalCount > 0 && bestResult.placed && bestResult.placed.length > 0) {
      var pl = bestResult.placed;
      var cL2 = bestResult.crateL;
      var cW2 = bestResult.crateW;
      var cH2 = bestResult.crateH;
      var g2 = bestResult.gap;

      // 最高顶面
      var maxTop = 0;
      for (var pi3 = 0; pi3 < pl.length; pi3++) {
        var tp = pl[pi3].z + pl[pi3].h;
        if (tp > maxTop) maxTop = tp;
      }

      var remZ = (g2 + cH2) - maxTop;
      if (remZ > 0) {
        // 收集有剩余需求的纸箱
        var dem2 = [];
        for (var di3 = 0; di3 < boxConfigs.length; di3++) {
          var bc3 = boxConfigs[di3];
          var cnt3 = 0;
          for (var pj3 = 0; pj3 < pl.length; pj3++) {
            if (pl[pj3].boxIdx === di3) cnt3++;
          }
          var rem2 = bc3.qty === null ? Infinity : bc3.qty - cnt3;
          if (rem2 > 0 || bc3.qty === null) {
            dem2.push({ bc: bc3, idx: di3, remaining: bc3.qty === null ? Infinity : rem2 });
          }
        }

        if (dem2.length > 0) {
          // 体积降序
          dem2.sort(function(a, b) {
            var va = a.bc.box.l * a.bc.box.w * a.bc.box.h;
            var vb = b.bc.box.l * b.bc.box.w * b.bc.box.h;
            return vb - va;
          });

          for (var dk2 = 0; dk2 < dem2.length; dk2++) {
            var demItem = dem2[dk2];
            var bc4 = demItem.bc;
            var keepUp = bc4.box.keepUpright === true;
            var rots3 = getRotations(bc4.box.l, bc4.box.w, bc4.box.h, allowRotate, keepUp);

            var bestN = 0, bestFill = null;
            for (var ri3 = 0; ri3 < rots3.length; ri3++) {
              var r3 = rots3[ri3];
              var rl3 = r3[0], rw3 = r3[1], rh3 = r3[2];
              if (rh3 > remZ || rl3 > cL2 || rw3 > cW2) continue;
              var fx3 = Math.floor(cL2 / rl3);
              var fy3 = Math.floor(cW2 / rw3);
              var n3 = fx3 * fy3;
              if (n3 > bestN) {
                bestN = n3;
                bestFill = { rl: rl3, rw: rw3, rh: rh3, fx: fx3, fy: fy3 };
              }
            }

            if (bestFill && bestN > 0) {
              var actual = Math.min(bestN, demItem.remaining);
              if (actual > 0) {
                var origD = [bc4.box.l, bc4.box.w, bc4.box.h];
                var isRot = !(bestFill.rl === origD[0] && bestFill.rw === origD[1] && bestFill.rh === origD[2]);
                var cnt4 = 0;
                for (var x3 = 0; x3 < bestFill.fx && cnt4 < actual; x3++) {
                  for (var y3 = 0; y3 < bestFill.fy && cnt4 < actual; y3++) {
                    pl.push({
                      x: g2 + x3 * bestFill.rl,
                      y: g2 + y3 * bestFill.rw,
                      z: maxTop,
                      l: bestFill.rl, w: bestFill.rw, h: bestFill.rh,
                      boxIdx: demItem.idx,
                      color: bc4.box.color,
                      name: bc4.box.name,
                      rotated: isRot,
                      origL: bc4.box.l, origW: bc4.box.w, origH: bc4.box.h
                    });
                    cnt4++;
                  }
                }

                // 更新统计
                bestResult.totalCount = pl.length;
                var totalV = cL2 * cW2 * cH2;
                var usedV = 0;
                for (var pu2 = 0; pu2 < pl.length; pu2++) {
                  usedV += pl[pu2].l * pl[pu2].w * pl[pu2].h;
                }
                bestResult.utilRate = usedV / totalV;
                bestResult.breakdown = [];
                for (var bk2 = 0; bk2 < boxConfigs.length; bk2++) {
                  var cnt5 = 0;
                  for (var pl3 = 0; pl3 < pl.length; pl3++) {
                    if (pl[pl3].boxIdx === bk2) cnt5++;
                  }
                  bestResult.breakdown.push({ box: boxConfigs[bk2].box, count: cnt5, requested: boxConfigs[bk2].qty });
                }
                bestResult.hasRotation = pl.some(function(p) { return p.rotated; });
              }
              break; // 只填充一种纸箱类型
            }
          }
        }
      }
    }

    // === 枚举搜索增强 (浏览器环境) ===
    if (allowRotate && bestResult && bestResult.totalCount > 0 && typeof process === 'undefined') {
      for (var ei = 0; ei < boxConfigs.length; ei++) {
        var ebc = boxConfigs[ei];
        var enumR = calcEnumPacking(crateL, crateW, crateH, ebc.box.l, ebc.box.w, ebc.box.h, gap, allowRotate, ebc.box.keepUpright);
        if (enumR && enumR.count > 0 && enumR.positions.length > 0) {
          var ocs = {};
          for (var epi = 0; epi < enumR.positions.length; epi++) {
            var ok = enumR.positions[epi].l + ',' + enumR.positions[epi].w + ',' + enumR.positions[epi].h;
            ocs[ok] = (ocs[ok] || 0) + 1;
          }
          var bk = '', bc2 = 0;
          for (var k in ocs) { if (ocs[k] > bc2) { bc2 = ocs[k]; bk = k; } }
          if (bk) { var ps = bk.split(','); ebc._enumOrient = [parseInt(ps[0]), parseInt(ps[1]), parseInt(ps[2])]; }
        }
      }
      if (boxConfigs.some(function(bc) { return bc._enumOrient; })) {
        var hinted = calcMixedPackingOnce(crateL, crateW, crateH, boxConfigs, gap, allowRotate, null);
        if (hinted && hinted.totalCount > bestResult.totalCount) bestResult = hinted;
        else if (hinted && hinted.totalCount === bestResult.totalCount && hinted.utilRate > bestResult.utilRate) bestResult = hinted;
      }
    }

    return bestResult;
  }

  // ============================================================
  // 间隙填充：主算法结束后，扫描剩余空隙尝试塞入更多纸箱
  // ============================================================
  function fillGaps(result, boxConfigs, crateL, crateW, crateH, gap, allowRotate) {
    if (!result || !result.placed || result.placed.length === 0) return result;

    const cL = crateL - gap * 2;
    const cW = crateW - gap * 2;
    const cH = crateH - gap * 2;
    if (cL <= 0 || cW <= 0 || cH <= 0) return result;

    // 已放置纸箱 → occupied 列表（归一化为 [0, cL] 坐标系，与 collectKeyPoints 的 max 参数一致）
    const occupied = result.placed.map(function(p) {
      return { x: p.x - gap, y: p.y - gap, z: p.z - gap, x2: p.x + p.l - gap, y2: p.y + p.w - gap, z2: p.z + p.h - gap };
    });

    // 收集剩余需求
    const demands = [];
    for (var i = 0; i < boxConfigs.length; i++) {
      var bc = boxConfigs[i];
      var placedCount = 0;
      for (var j = 0; j < result.placed.length; j++) {
        if (result.placed[j].boxIdx === i) placedCount++;
      }
      var remaining = bc.qty === null ? Infinity : bc.qty - placedCount;
      if (remaining > 0 || bc.qty === null) {
        demands.push({ bc: bc, idx: i, remaining: bc.qty === null ? Infinity : remaining });
      }
    }
    if (demands.length === 0) return result;

    // 按纸箱体积从大到小尝试（大箱填隙更易成功）
    demands.sort(function(a, b) {
      var va = a.bc.box.l * a.bc.box.w * a.bc.box.h;
      var vb = b.bc.box.l * b.bc.box.w * b.bc.box.h;
      return vb - va;
    });

    var kp = collectKeyPoints(occupied, cL, cW, cH);
    var maxGapIter = 2000; // 防止死循环

    for (var di = 0; di < demands.length; di++) {
      var dem = demands[di];
      var bc = dem.bc;
      var keepUpright = bc.box.keepUpright === true;
      var rots = getRotations(bc.box.l, bc.box.w, bc.box.h, allowRotate, keepUpright);

      var filled = true;
      while (filled && dem.remaining > 0 && maxGapIter-- > 0) {
        filled = false;
        for (var ri = 0; ri < rots.length; ri++) {
          var rot = rots[ri];
          var rl = rot[0], rw = rot[1], rh = rot[2];
          if (rl > cL || rw > cW || rh > cH) continue;

          outer:
          for (var zi = 0; zi < kp.zs.length; zi++) {
            var z = kp.zs[zi];
            if (z + rh > cH) break;
            for (var yi = 0; yi < kp.ys.length; yi++) {
              var y = kp.ys[yi];
              if (y + rw > cW) break;
              for (var xi = 0; xi < kp.xs.length; xi++) {
                var x = kp.xs[xi];
                if (x + rl > cL) break;

                if (isOccupied(occupied, x, y, z, rl, rw, rh)) continue;
                if (!isSupported(occupied, x, y, z, rl, rw)) continue;

                // 归一化坐标系下只需检查 [0, cL] 范围，gap 已在归一化时消去
                if (x < 0 || y < 0 || z < 0) continue;
                if (x + rl > cL || y + rw > cW || z + rh > cH) continue;

                // 放置！坐标加回 gap 还原物理位置
                var isRot = !(rl === bc.box.l && rw === bc.box.w && rh === bc.box.h);
                result.placed.push({
                  x: x + gap, y: y + gap, z: z + gap,
                  l: rl, w: rw, h: rh,
                  boxIdx: dem.idx,
                  color: bc.box.color,
                  name: bc.box.name,
                  rotated: isRot,
                  origL: bc.box.l, origW: bc.box.w, origH: bc.box.h
                });
                occupied.push({ x: x, y: y, z: z, x2: x + rl, y2: y + rw, z2: z + rh });
                dem.remaining--;
                filled = true;

                // 更新离散坐标点
                if (kp.xs.indexOf(x) === -1) { kp.xs.push(x); kp.xs.sort(function(a, b) { return a - b; }); }
                if (kp.xs.indexOf(x + rl) === -1) { kp.xs.push(x + rl); kp.xs.sort(function(a, b) { return a - b; }); }
                if (kp.ys.indexOf(y) === -1) { kp.ys.push(y); kp.ys.sort(function(a, b) { return a - b; }); }
                if (kp.ys.indexOf(y + rw) === -1) { kp.ys.push(y + rw); kp.ys.sort(function(a, b) { return a - b; }); }
                if (kp.zs.indexOf(z) === -1) { kp.zs.push(z); kp.zs.sort(function(a, b) { return a - b; }); }
                if (kp.zs.indexOf(z + rh) === -1) { kp.zs.push(z + rh); kp.zs.sort(function(a, b) { return a - b; }); }

                break outer;
              }
            }
          }
        }
      }
    }

    // 更新 result 统计
    result.totalCount = result.placed.length;
    var totalVol = cL * cW * cH;
    var usedVol = 0;
    for (var pi = 0; pi < result.placed.length; pi++) {
      var p = result.placed[pi];
      usedVol += p.l * p.w * p.h;
    }
    result.utilRate = usedVol / totalVol;
    result.breakdown = [];
    for (var bi = 0; bi < boxConfigs.length; bi++) {
      var cnt = 0;
      for (var pj = 0; pj < result.placed.length; pj++) {
        if (result.placed[pj].boxIdx === bi) cnt++;
      }
      result.breakdown.push({ box: boxConfigs[bi].box, count: cnt, requested: boxConfigs[bi].qty });
    }
    result.hasRotation = result.placed.some(function(p) { return p.rotated; });

    return result;
  }

  // ============================================================
  // 反推算法：FFD (First Fit Decreasing) 多箱装箱
  // 给定纸箱清单 + 木箱尺寸，计算需要几个木箱、每个木箱装了什么
  // ============================================================
  function calcReverse(crateL, crateW, crateH, boxConfigs, gap, allowRotate, maxWeight) {
    // boxConfigs: [{box, qty}]  qty 为需求数量，null 表示不限
    // 先确定每种纸箱的实际需求数量
    var demandList = [];
    boxConfigs.forEach(function(bc) {
      var q = bc.qty;
      if (q === null || q === undefined || q === '') {
        // 不限数量，用一个大数表示（单品模式）
        demandList.push({ box: bc.box, needed: Infinity, type: 'unlimited' });
      } else {
        var n = Math.max(1, parseInt(q) || 1);
        for (var j = 0; j < n; j++) {
          demandList.push({ box: bc.box, needed: 1, type: 'unit' });
        }
      }
    });

    // 将有限数量的纸箱按体积降序排列（FFD策略）
    var limitedItems = demandList.filter(function(d) { return d.type === 'unit'; });
    limitedItems.sort(function(a, b) {
      return (b.box.l * b.box.w * b.box.h) - (a.box.l * a.box.w * a.box.h);
    });

    var unlimitedItems = demandList.filter(function(d) { return d.type === 'unlimited'; });
    unlimitedItems.sort(function(a, b) {
      return (b.box.l * b.box.w * b.box.h) - (a.box.l * a.box.w * a.box.h);
    });

    // 先装有限数量的纸箱（FFD），再对每个木箱尝试填无限数量的纸箱
    var crates = []; // [{crate: {l,w,h}, boxes: [{boxIdx, box, pos}], utilRate, weight}]
    var remaining = limitedItems.slice();

    var cL = crateL - gap * 2;
    var cW = crateW - gap * 2;
    var cH = crateH - gap * 2;
    var crateVol = cL * cW * cH;

    // 逐个木箱填充有限数量的纸箱
    while (remaining.length > 0) {
      var currentCrate = { boxes: [], usedVol: 0, totalWeight: 0 };
      var stillRemaining = [];

      for (var i = 0; i < remaining.length; i++) {
        var item = remaining[i];
        var b = item.box;
        var placed = tryPlaceItem(currentCrate, cL, cW, cH, b, gap, allowRotate, b.keepUpright);
        if (placed) {
          currentCrate.boxes.push({
            boxIdx: boxConfigs.findIndex(function(bc) { return bc.box.id === b.id; }),
            box: b,
            pos: placed
          });
          currentCrate.usedVol += (b.l * b.w * b.h);
          currentCrate.totalWeight += (parseFloat(b.weight) || 0);
        } else {
          stillRemaining.push(item);
        }
      }

      if (currentCrate.boxes.length === 0) {
        // 装不下任何纸箱了，说明某个纸箱尺寸超过木箱
        break;
      }

      // 尝试填充不限数量的纸箱
      unlimitedItems.forEach(function(uitem) {
        var ub = uitem.box;
        while (true) {
          var placed2 = tryPlaceItem(currentCrate, cL, cW, cH, ub, gap, allowRotate, ub.keepUpright);
          if (placed2) {
            currentCrate.boxes.push({
              boxIdx: boxConfigs.findIndex(function(bc) { return bc.box.id === ub.id; }),
              box: ub,
              pos: placed2
            });
            currentCrate.usedVol += (ub.l * ub.w * ub.h);
            currentCrate.totalWeight += (parseFloat(ub.weight) || 0);
          } else {
            break;
          }
        }
      });

      var utilRate = currentCrate.usedVol / crateVol;
      var weightRate = maxWeight > 0 ? currentCrate.totalWeight / maxWeight : 0;

      crates.push({
        crate: { l: crateL, w: crateW, h: crateH },
        boxes: currentCrate.boxes,
        totalCount: currentCrate.boxes.length,
        utilRate: utilRate,
        totalWeight: currentCrate.totalWeight,
        maxWeight: maxWeight,
        weightRate: weightRate,
        displayCrateL: crateL,
        displayCrateW: crateW,
        displayCrateH: crateH
      });

      remaining = stillRemaining;
    }

    // 如果还有剩余装不下的纸箱
    if (remaining.length > 0 && crates.length > 0) {
      crates[crates.length - 1].overflowCount = remaining.length;
    }

    // 计算总体统计
    var totalBoxCount = 0, totalVol = 0;
    crates.forEach(function(c) {
      totalBoxCount += c.totalCount;
      totalVol += c.usedVol;
    });
    var totalUtilRate = crates.length > 0 ? totalVol / (crateVol * crates.length) : 0;

    return {
      crates: crates,
      totalCrates: crates.length,
      totalBoxCount: totalBoxCount,
      totalUtilRate: totalUtilRate,
      crateL: crateL, crateW: crateW, crateH: crateH,
      gap: gap
    };
  }

  // 收集关键坐标点（已放置纸箱的边界 + 0点 + 容器边界），用于离散化搜索
  function collectKeyPoints(occupied, maxX, maxY, maxZ) {
    var xs = new Set([0, maxX]), ys = new Set([0, maxY]), zs = new Set([0, maxZ]);
    occupied.forEach(function(o) {
      xs.add(o.x); xs.add(o.x2);
      ys.add(o.y); ys.add(o.y2);
      zs.add(o.z); zs.add(o.z2);
    });
    // 转为排序数组
    function toSorted(set) {
      var arr = Array.from(set);
      arr.sort(function(a, b) { return a - b; });
      return arr;
    }
    return { xs: toSorted(xs), ys: toSorted(ys), zs: toSorted(zs) };
  }

  // 检查在给定位置放置纸箱是否与已占区域冲突
  function isOccupied(occupied, x, y, z, bL, bW, bH) {
    for (var i = 0; i < occupied.length; i++) {
      var o = occupied[i];
      if (x + bL > o.x && x < o.x2 && y + bW > o.y && y < o.y2 && z + bH > o.z && z < o.z2) {
        return true;
      }
    }
    return false;
  }

  // 检查在z高度，位置(x,y)是否下方有支撑
  function isSupported(occupied, x, y, z, bL, bW) {
    if (z <= 0) return true;
    for (var oi = 0; oi < occupied.length; oi++) {
      var o = occupied[oi];
      if (Math.abs(o.z2 - z) < 0.01) {
        var ox = Math.max(x, o.x), ox2 = Math.min(x + bL, o.x2);
        var oy = Math.max(y, o.y), oy2 = Math.min(y + bW, o.y2);
        if (ox < ox2 && oy < oy2) return true;
      }
    }
    return false;
  }

  // 尝试将纸箱放入已部分填充的木箱（离散化贪心放置：仅在关键坐标点搜索）
  function tryPlaceItem(crateState, cL, cW, cH, box, gap, allowRotate, keepUpright) {
    var rots = getRotations(box.l, box.w, box.h, allowRotate, keepUpright);
    var best = null;
    var bestZ = Infinity;
    var bestY = Infinity;

    // 获取已放置纸箱占用的空间
    var occupied = [];
    crateState.boxes.forEach(function(b) {
      var p = b.pos;
      occupied.push({ x: p.x, y: p.y, z: p.z, x2: p.x + p.l, y2: p.y + p.w, z2: p.z + p.h });
    });

    // 收集关键坐标点（离散化，避免逐毫米遍历）
    var kp = collectKeyPoints(occupied, cL, cW, cH);

    for (var ri = 0; ri < rots.length; ri++) {
      var r = rots[ri];
      var bL = r[0], bW = r[1], bH = r[2];
      if (bL > cL || bW > cW || bH > cH) continue;

      // 在关键z坐标上搜索（从低到高）
      for (var zi = 0; zi < kp.zs.length; zi++) {
        var z = kp.zs[zi];
        if (z + bH > cH) break;
        var foundAtZ = false;

        // 在关键y坐标上搜索
        for (var yi = 0; yi < kp.ys.length; yi++) {
          var y = kp.ys[yi];
          if (y + bW > cW) break;

          // 在关键x坐标上搜索
          for (var xi = 0; xi < kp.xs.length; xi++) {
            var x = kp.xs[xi];
            if (x + bL > cL) break;

            if (!isOccupied(occupied, x, y, z, bL, bW, bH) && isSupported(occupied, x, y, z, bL, bW)) {
              if (z < bestZ || (z === bestZ && y < bestY)) {
                best = { x: gap + x, y: gap + y, z: gap + z, l: bL, w: bW, h: bH, rotated: ri > 0 };
                bestZ = z;
                bestY = y;
                foundAtZ = true;
              }
            }
          }
        }
        if (foundAtZ) break; // 在当前z层找到了，直接跳出，找最低位置
      }
      if (best) break; // 找到了就返回，优先尝试第一个旋转方向
    }
    return best;
  }

  // 反推对比：对多种木箱尺寸分别运行FFD，给出推荐
  function calcReverseCompare(crateList, boxConfigs, gap, allowRotate) {
    var results = [];
    for (var i = 0; i < crateList.length; i++) {
      var c = crateList[i];
      var res = calcReverse(c.l, c.w, c.h, boxConfigs, gap, allowRotate, c.maxWeight || 0);
      res.crateName = c.name || ('木箱' + (i + 1));
      res.crateId = c.id;
      results.push(res);
    }
    // 推荐逻辑：数量最少优先
    results.sort(function(a, b) {
      if (a.totalCrates !== b.totalCrates) return a.totalCrates - b.totalCrates;
      return b.totalUtilRate - a.totalUtilRate;
    });
    if (results.length > 0) results[0].recommended = true;
    return results;
  }

  return { getRotations, calcPacking, calcMixedPacking, calcMixedPackingOnce, splitSpaceFull, exploreCombinations, calcReverse, calcReverseCompare, fillGaps, calcDSAPLayer, bestSumApprox, canFitCell, buildDSAPGrid, calcEnumPacking };
})();
