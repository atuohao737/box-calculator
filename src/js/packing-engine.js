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
        if (zCount > 1 && layerGap > 0) h += layerGap;
      }
      let totalCount = xCount * yCount * zCount;
      const positions = [];
      const zhAtLevel = (z) => {
        let zz = gap;
        for (let i = 0; i < z; i++) { zz += bH; if (i < zCount - 1 && layerGap > 0) zz += layerGap; }
        return zz;
      };

      for (let z = 0; z < zCount; z++) {
        const zh = zhAtLevel(z);
        for (let x = 0; x < xCount; x++) {
          for (let y = 0; y < yCount; y++) {
            positions.push({ x: gap + x * bL, y: gap + y * bW, z: zh, l: bL, w: bW, h: bH, rotated: false });
          }
        }
      }

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
      const rots = getRotations(bc.box.l, bc.box.w, bc.box.h, allowRotate, keepUpright);
      const validRots = rots.filter(r => r[0] <= cL && r[1] <= cW && r[2] <= cH);
      return { ...bc, validRots, placed: 0 };
    }).filter(bc => bc.validRots.length > 0);

    if (boxList.length === 0) return { placed: [], totalCount: 0, utilRate: 0, breakdown: [] };

    let spaces = [{ x: gap, y: gap, z: gap, l: cL, w: cW, h: cH }];
    const placed = [];

    // 使用传入的排序顺序
    const sortedIndices = sortOrder || boxList.map((_, i) => i).sort((a, b) => {
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
          rotated: isRotated
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

    // 后续轮次：随机打乱顺序
    const boxIndices = boxConfigs.map((_, i) => i);
    for (let r = 1; r < rounds; r++) {
      // Fisher-Yates 洗牌
      const shuffled = [...boxIndices];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // 还需要按体积降序的变体：先打乱同体积段再试
      const shuffledByVol = [...boxIndices].sort((a, b) => {
        const volA = boxConfigs[a].box.l * boxConfigs[a].box.w * boxConfigs[a].box.h;
        const volB = boxConfigs[b].box.l * boxConfigs[b].box.w * boxConfigs[b].box.h;
        if (Math.abs(volA - volB) < 100) return Math.random() - 0.5;
        return volB - volA;
      });

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
                  rotated: isRot
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

  return { getRotations, calcPacking, calcMixedPacking, splitSpaceFull, exploreCombinations, calcReverse, calcReverseCompare, fillGaps };
})();
