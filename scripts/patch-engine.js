const fs = require('fs');
let code = fs.readFileSync('src/js/packing-engine.js', 'utf-8');

// 1. Add mergeSpaces + tryMerge2Spaces + calcMixedGrid after splitSpaceFull
const splitEnd = 'return result.filter(s => s.l > 0 && s.w > 0 && s.h > 0);\n  }\n\n  // 单次混装计算（核心逻辑）';

const additions = `return result.filter(s => s.l > 0 && s.w > 0 && s.h > 0);
  }

  // 空间合并
  function mergeSpaces(spaces) {
    var merged = true;
    while (merged) {
      merged = false;
      for (var i = 0; i < spaces.length; i++) {
        for (var j = i + 1; j < spaces.length; j++) {
          var m = tryMerge2Spaces(spaces[i], spaces[j]);
          if (m) { spaces.splice(j, 1); spaces.splice(i, 1, m); merged = true; break; }
        }
        if (merged) break;
      }
    }
    return spaces;
  }
  function tryMerge2Spaces(a, b) {
    var eps = 0.01;
    if (Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps &&
        Math.abs(a.l - b.l) < eps && Math.abs(a.w - b.w) < eps &&
        (Math.abs(a.z + a.h - b.z) < eps || Math.abs(b.z + b.h - a.z) < eps))
      { var z1 = Math.min(a.z,b.z); return { x:a.x, y:a.y, z:z1, l:a.l, w:a.w, h:Math.max(a.z+a.h,b.z+b.h)-z1 }; }
    if (Math.abs(a.x - b.x) < eps && Math.abs(a.z - b.z) < eps &&
        Math.abs(a.l - b.l) < eps && Math.abs(a.h - b.h) < eps &&
        (Math.abs(a.y + a.w - b.y) < eps || Math.abs(b.y + b.w - a.y) < eps))
      { var y1 = Math.min(a.y,b.y); return { x:a.x, y:y1, z:a.z, l:a.l, w:Math.max(a.y+a.w,b.y+b.w)-y1, h:a.h }; }
    if (Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps &&
        Math.abs(a.w - b.w) < eps && Math.abs(a.h - b.h) < eps &&
        (Math.abs(a.x + a.l - b.x) < eps || Math.abs(b.x + b.l - a.x) < eps))
      { var x1 = Math.min(a.x,b.x); return { x:x1, y:a.y, z:a.z, l:Math.max(a.x+a.l,b.x+b.l)-x1, w:a.w, h:a.h }; }
    return null;
  }

  // 平面混排：单轴分界MOG + 行内混排条带装箱
  function calcMixedGrid(cL, cW, bL, bW) {
    var best = 0, bestPositions = null;
    var maxHx = Math.floor(cL / bL);
    for (var hx = 0; hx <= maxHx; hx++) {
      var remX = cL - hx * bL;
      var vx = remX >= 0 ? Math.floor(remX / bW) : 0;
      var hRows = Math.floor(cW / bW);
      var vRows = Math.floor(cW / bL);
      var total = hx * hRows + vx * vRows;
      if (total > best) {
        best = total; bestPositions = [];
        for (var xi = 0; xi < hx; xi++) for (var yi = 0; yi < hRows; yi++) bestPositions.push({ x: xi*bL, y: yi*bW, l:bL, w:bW, rotated:false });
        for (var xi2 = 0; xi2 < vx; xi2++) for (var yi2 = 0; yi2 < vRows; yi2++) bestPositions.push({ x: hx*bL+xi2*bW, y: yi2*bL, l:bW, w:bL, rotated:true });
      }
    }
    var maxHy = Math.floor(cW / bW);
    for (var hy = 0; hy <= maxHy; hy++) {
      var remY = cW - hy * bW;
      var vy = remY >= 0 ? Math.floor(remY / bL) : 0;
      var hCols = Math.floor(cL / bL), vCols = Math.floor(cL / bW);
      var total2 = hy * hCols + vy * vCols;
      if (total2 > best) {
        best = total2; bestPositions = [];
        for (var yi3 = 0; yi3 < hy; yi3++) for (var xi3 = 0; xi3 < hCols; xi3++) bestPositions.push({ x: xi3*bL, y: yi3*bW, l:bL, w:bW, rotated:false });
        for (var yi4 = 0; yi4 < vy; yi4++) for (var xi4 = 0; xi4 < vCols; xi4++) bestPositions.push({ x: xi4*bW, y: hy*bW+yi4*bL, l:bW, w:bL, rotated:true });
      }
    }
    var rowHs = [];
    if (bW > 0) rowHs.push(bW);
    if (bL > 0 && Math.abs(bL-bW)>0.01) rowHs.push(bL);
    if (rowHs.length > 0) {
      var rCache = {};
      for (var hi = 0; hi < rowHs.length; hi++) {
        var h = rowHs[hi], rBest = 0, rPl = [];
        var maxHx2 = Math.floor(cL / bL);
        for (var hx2 = 0; hx2 <= maxHx2; hx2++) {
          var remX2 = cL - hx2 * bL, vx2 = remX2 >= 0 ? Math.floor(remX2 / bW) : 0;
          var vH = (hx2===0 || h>=bW) ? hx2 : 0, vV = (vx2===0 || h>=bL) ? vx2 : 0;
          if (vH+vV > rBest) { rBest = vH+vV; rPl = []; for (var xi4=0;xi4<vH;xi4++) rPl.push({x:xi4*bL,l:bL,w:bW,rotated:false}); for (var xi5=0;xi5<vV;xi5++) rPl.push({x:vH*bL+xi5*bW,l:bW,w:bL,rotated:true}); }
        }
        rCache[h] = { t: rBest, p: rPl };
      }
      var maxD = 0; for (var hi2=0;hi2<rowHs.length;hi2++) { var d = rCache[rowHs[hi2]].t/rowHs[hi2]; if (d>maxD) maxD=d; }
      function dfs(y,pos) {
        if (y >= cW - 0.01) { if (pos.length > best) { best = pos.length; bestPositions = pos.slice(); } return; }
        var remY = cW - y;
        if (pos.length + Math.ceil(remY*maxD) <= best) return;
        for (var hi3 = 0; hi3 < rowHs.length; hi3++) {
          var h3 = rowHs[hi3];
          if (h3 > remY + 0.01) continue;
          var rr = rCache[h3]; if (rr.t === 0) continue;
          var nxt = pos.slice();
          for (var pi = 0; pi < rr.p.length; pi++) { var pp = rr.p[pi]; nxt.push({x:pp.x, y:y, l:pp.l, w:pp.w, rotated:pp.rotated}); }
          dfs(y + h3, nxt);
        }
      }
      dfs(0, []);
    }
    return { total: best, config: null, positions: bestPositions || [] };
  }

  // 单次混装计算（核心逻辑）`;

code = code.replace(splitEnd, additions);

// 2. In calcPacking: replace simple grid loop with MOG logic
const oldGrid = `      for (let z = 0; z < zCount; z++) {
        const zh = zhAtLevel(z);
        for (let x = 0; x < xCount; x++) {
          for (let y = 0; y < yCount; y++) {
            positions.push({ x: gap + x * bL, y: gap + y * bW, z: zh, l: bL, w: bW, h: bH, rotated: false });
          }
        }
      }`;

const newGrid = `      var mogResult = calcMixedGrid(cL, cW, bL, bW);
      var useMog = mogResult.total > xCount * yCount;

      for (let z = 0; z < zCount; z++) {
        const zh = zhAtLevel(z);
        if (useMog) {
          for (var pi = 0; pi < mogResult.positions.length; pi++) {
            var mp = mogResult.positions[pi];
            positions.push({ x: gap + mp.x, y: gap + mp.y, z: zh, l: mp.l, w: mp.w, h: bH, rotated: mp.rotated });
          }
        } else {
          for (let x = 0; x < xCount; x++) {
            for (let y = 0; y < yCount; y++) {
              positions.push({ x: gap + x * bL, y: gap + y * bW, z: zh, l: bL, w: bW, h: bH, rotated: false });
            }
          }
        }
      }

      if (useMog) {
        totalCount = mogResult.total * zCount;
      } else {`;

code = code.replace(oldGrid, newGrid);

// 3. Add else closing brace and update Z fill
const oldZFill = `      // Z轴顶层填充（在顶部剩余高度内再排一层）
      const usedH = zCount * bH + (zCount > 1 ? (zCount - 1) * layerGap : 0);
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
      }`;

const newZFill = `      } // end else

      // Z轴顶层填充
      const usedH = zCount * bH + (zCount > 1 ? (zCount - 1) * layerGap : 0);
      const remZ = cH - usedH;
      if (remZ > 0 && zCount > 0) {
        let zFillBest = { count: 0 };
        for (const [rbL, rbW, rbH] of rotations) {
          if (rbH > remZ) continue;
          if (rbL > cL || rbW > cW) continue;
          var zMog = calcMixedGrid(cL, cW, rbL, rbW);
          var zSimple = Math.floor(cL / rbL) * Math.floor(cW / rbW);
          if (zMog.total > zSimple && zMog.total > zFillBest.count) {
            zFillBest = { count: zMog.total, positions: zMog.positions, bH: rbH, isMog: true };
          } else if (zSimple > zFillBest.count) {
            zFillBest = { count: zSimple, bL: rbL, bW: rbW, bH: rbH, fx: Math.floor(cL / rbL), fy: Math.floor(cW / rbW), isMog: false };
          }
        }
        if (zFillBest.count > 0) {
          totalCount += zFillBest.count;
          const zOffset = usedH;
          if (zFillBest.isMog) {
            for (var zi = 0; zi < zFillBest.positions.length; zi++) {
              var zpos = zFillBest.positions[zi];
              positions.push({ x: gap + zpos.x, y: gap + zpos.y, z: gap + zOffset, l: zpos.l, w: zpos.w, h: zFillBest.bH, rotated: zpos.rotated || false });
            }
          } else {
            var fx = zFillBest.fx, fy = zFillBest.fy;
            for (let x = 0; x < fx; x++) {
              for (let y = 0; y < fy; y++) {
                positions.push({ x: gap + x * zFillBest.bL, y: gap + y * zFillBest.bW, z: gap + zOffset, l: zFillBest.bL, w: zFillBest.bW, h: zFillBest.bH, rotated: true });
              }
            }
          }
        }
      }`;

code = code.replace(oldZFill, newZFill);

// 4. Add mergeSpaces call in calcMixedPackingOnce
code = code.replace(
  'spaces.push(...newSpaces);\n        spaces.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));',
  'spaces.push(...newSpaces);\n        mergeSpaces(spaces);\n        spaces.sort((a, b) => (b.l * b.w * b.h) - (a.l * a.w * a.h));'
);

fs.writeFileSync('src/js/packing-engine.js', code, 'utf-8');
console.log('Done');
