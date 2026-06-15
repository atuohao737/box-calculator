// PackingEngine 算法测试
import { describe, it, expect } from 'vitest';

const PE = window.PackingEngine;

// 测试环境枚举搜索短超时，避免15秒搜索导致测试超时
const ENUM_FAST = { enumTimeLimit: 50 };

// ============================================================
// getRotations — 旋转枚举
// ============================================================
describe('PackingEngine - getRotations', () => {
  it('不允许旋转时只返回一种方向', () => {
    const rots = PE.getRotations(300, 200, 150, false, false);
    expect(rots).toHaveLength(1);
    expect(rots[0]).toEqual([300, 200, 150]);
  });

  it('允许旋转返回最多6种方向（去重后）', () => {
    const rots = PE.getRotations(200, 300, 400, true, false);
    // 3个不同尺寸 → 6种排列不重复
    expect(rots.length).toBe(6);
    expect(rots).toContainEqual([200, 300, 400]);
    expect(rots).toContainEqual([200, 400, 300]);
    expect(rots).toContainEqual([300, 200, 400]);
    expect(rots).toContainEqual([300, 400, 200]);
    expect(rots).toContainEqual([400, 200, 300]);
    expect(rots).toContainEqual([400, 300, 200]);
  });

  it('正方体去重只返回1种方向', () => {
    const rots = PE.getRotations(100, 100, 100, true, false);
    expect(rots).toHaveLength(1);
    expect(rots[0]).toEqual([100, 100, 100]);
  });

  it('keepUpright 保持高度不变', () => {
    const rots = PE.getRotations(300, 200, 150, true, true);
    // 所有旋转结果的高度(第3个元素)都应保持 150
    rots.forEach(r => expect(r[2]).toBe(150));
  });

  it('两个维度相同时返回3种', () => {
    const rots = PE.getRotations(300, 200, 200, true, false);
    expect(rots.length).toBe(3);
  });
});

// ============================================================
// calcPacking — 单品网格层叠
// ============================================================
describe('PackingEngine - calcPacking 单品网格层叠', { timeout: 30000 }, () => {
  it('标准纸箱 300x200x150 装入 1200x1000x800 木箱', () => {
    const result = PE.calcPacking(1200, 1000, 800, 300, 200, 150, 0, 0, true, false, ENUM_FAST);
    expect(result).not.toBeNull();
    // FreePlace 2D自由装箱优化后变为 6x6x2=72+32(z填)=104
    expect(result.count).toBe(104);
    expect(result.zCount).toBe(2);
    // 利用率 = 104 * (300*200*150) / (1200*1000*800) ≈ 0.975 (含Z轴填充)
    const expectedUtil = (104 * 300 * 200 * 150) / (1200 * 1000 * 800);
    expect(result.utilRate).toBeCloseTo(expectedUtil, 5);
  });

  it('纸箱尺寸超过木箱时返回 null', () => {
    const result = PE.calcPacking(100, 100, 100, 200, 50, 50, 0, 0, true, false, ENUM_FAST);
    expect(result).toBeNull();
  });

  it('带留边空隙 20mm', () => {
    const result = PE.calcPacking(1200, 1000, 800, 300, 200, 150, 20, 0, true, false, ENUM_FAST);
    expect(result).not.toBeNull();
    // DSAP 混排优化后 83 个
    expect(result.count).toBe(83);
  });

  it('带层间间距 10mm', () => {
    const result = PE.calcPacking(1200, 1000, 800, 300, 200, 150, 0, 10, true, false, ENUM_FAST);
    expect(result).not.toBeNull();
    // 层间间距每层多10mm = (150+10)*4+150=790 < 800 → 5层
    // 实际上 150*5 + 10*4 = 790 < 800 → 可装5层
    // 但若带间距，每层高度 = 150 + 10 = 160
    // 800 / 160 = 5 → 5层
    // 所以结果还是 4x5x5=100
    // 实际上有间距时没有影响，因为800 - 5*150 = 50 > 4*10
    expect(result.count).toBe(100);
  });

  it('keepUpright 禁止倒置时高度保持', () => {
    const result = PE.calcPacking(600, 500, 400, 300, 200, 150, 0, 0, true, true, ENUM_FAST);
    expect(result).not.toBeNull();
    // 禁止倒置: 高度必须保持 150
    const rots = PE.getRotations(300, 200, 150, true, true);
    const hasHeightMatch = rots.some(r => r[0] === result.bL && r[1] === result.bW && r[2] === result.bH);
    expect(hasHeightMatch).toBe(true);
    expect(result.bH).toBe(150);
  });

  it('不旋转时只使用原始方向', () => {
    const result = PE.calcPacking(1200, 1000, 800, 300, 200, 150, 0, 0, false, false);
    expect(result).not.toBeNull();
    // 不旋转应该只有 [300,200,150] 方向
    expect(result.bL).toBe(300);
    expect(result.bW).toBe(200);
    expect(result.bH).toBe(150);
  });

  it('result 包含 positions 数组，数量与 count 一致', () => {
    const result = PE.calcPacking(1200, 1000, 800, 300, 200, 150, 0, 0, true, false, ENUM_FAST);
    expect(result.positions).toHaveLength(result.count);
  });

  it('留边过大导致无法装入时返回 null', () => {
    // 留边500mm → 有效空间 200x0x0，完全装不下 300x200x150
    const result = PE.calcPacking(1200, 1000, 800, 300, 200, 150, 500, 0, true, false, ENUM_FAST);
    expect(result).toBeNull();
  });

  it('尾余填充增加数量', () => {
    // 设计一个尺寸，主排列后有尾余空间
    // 木箱 600x600x400，纸箱 250x200x150
    // 主排列: 2x3x2 = 12 (500占用X, 600占Y)
    // X尾余: 600-2*250=100 → 装不下200mm
    // Y尾余: 600-3*200=0
    // 实际上只有主排列
    const result = PE.calcPacking(600, 600, 400, 250, 200, 150, 0, 0, true, false, ENUM_FAST);
    expect(result).not.toBeNull();
    expect(result.count).toBeGreaterThanOrEqual(12);
  });

  it('positions 中所有纸箱在木箱有效范围内', () => {
    const result = PE.calcPacking(1200, 1000, 800, 300, 200, 150, 10, 5, true, false, ENUM_FAST);
    expect(result).not.toBeNull();
    const mL = 1200 - 10 * 2, mW = 1000 - 10 * 2, mH = 800 - 10 * 2;
    result.positions.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeGreaterThanOrEqual(0);
      expect(p.x + p.l).toBeLessThanOrEqual(mL + 10 * 2); // gap + 主空间
      expect(p.y + p.w).toBeLessThanOrEqual(mW + 10 * 2);
      expect(p.z + p.h).toBeLessThanOrEqual(mH + 10 * 2);
    });
  });
});

// ============================================================
// calcMixedPacking — 混装算法
// ============================================================
describe('PackingEngine - calcMixedPacking 混装模式', { timeout: 60000 }, () => {
  it('单一纸箱无限数量时使用网格层叠而非空间分割', () => {
    const boxConfig = [{ box: { id: 1, l: 300, w: 200, h: 150, color: '#4f9cf9', name: '箱A', keepUpright: false }, qty: null }];
    const result = PE.calcMixedPacking(1200, 1000, 800, boxConfig, 0, true, 10, 'count', ENUM_FAST);
    expect(result).not.toBeNull();
    // 单一纸箱应退化为网格层叠：4x5x5=100，加Z轴顶层填充后=104
    expect(result.totalCount).toBe(104);
    // 104 * (300*200*150) / (1200*1000*800)
    expect(result.utilRate).toBeCloseTo(0.975, 3);
  });

  it('两种纸箱混装（指定数量）', () => {
    const boxConfig = [
      { box: { id: 1, l: 300, w: 200, h: 150, color: '#4f9cf9', name: '大箱', keepUpright: false }, qty: 10 },
      { box: { id: 2, l: 100, w: 100, h: 100, color: '#52c41a', name: '小箱', keepUpright: false }, qty: 20 },
    ];
    const result = PE.calcMixedPacking(1200, 1000, 800, boxConfig, 0, true, 10, 'count', ENUM_FAST);
    expect(result).not.toBeNull();
    // 至少能放入10个大箱（指定数量的大箱）
    expect(result.totalCount).toBeGreaterThanOrEqual(10);
    // 两种纸箱类型都在breakdown中
    expect(result.breakdown.length).toBe(2);
    // 大箱至少放了10个
    expect(result.breakdown[0].count).toBeGreaterThanOrEqual(10);
  });

  it('纸箱太大无法装入时返回空结果', () => {
    const boxConfig = [
      { box: { id: 1, l: 2000, w: 2000, h: 2000, color: '#4f9cf9', name: '超大', keepUpright: false }, qty: null },
    ];
    const result = PE.calcMixedPacking(1200, 1000, 800, boxConfig, 0, true, 10, 'count', ENUM_FAST);
    expect(result).toBeNull();
  });

  it('量优先实际比空间优先装得多（通常情况）', { timeout: 30000 }, () => {
    // 混装3种纸箱，无数量限制
    const boxConfig = [
      { box: { id: 1, l: 150, w: 100, h: 80, color: '#4f9cf9', name: '小箱A', keepUpright: false }, qty: null },
      { box: { id: 2, l: 120, w: 120, h: 100, color: '#52c41a', name: '小箱B', keepUpright: false }, qty: null },
    ];
    const countResult = PE.calcMixedPacking(1200, 1000, 800, boxConfig, 0, true, 10, 'count', ENUM_FAST);
    const utilResult = PE.calcMixedPacking(1200, 1000, 800, boxConfig, 0, true, 10, 'util', ENUM_FAST);
    expect(countResult).not.toBeNull();
    expect(utilResult).not.toBeNull();
    // 数量优先的总数 ≥ 空间优先的总数
    expect(countResult.totalCount).toBeGreaterThanOrEqual(utilResult.totalCount);
  });

  it('positions 中所有纸箱在边界内', { timeout: 30000 }, () => {
    const crateL = 1000, crateW = 800, crateH = 600;
    const boxConfig = [
      { box: { id: 1, l: 200, w: 150, h: 100, color: '#4f9cf9', name: '箱A', keepUpright: false }, qty: 5 },
      { box: { id: 2, l: 150, w: 100, h: 80, color: '#52c41a', name: '箱B', keepUpright: false }, qty: 10 },
    ];
    const result = PE.calcMixedPacking(crateL, crateW, crateH, boxConfig, 10, true, 10, 'count', ENUM_FAST);
    expect(result).not.toBeNull();
    result.placed.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeGreaterThanOrEqual(0);
      expect(p.x + p.l).toBeLessThanOrEqual(crateL);
      expect(p.y + p.w).toBeLessThanOrEqual(crateW);
      expect(p.z + p.h).toBeLessThanOrEqual(crateH);
    });
  });
});

// ============================================================
// splitSpaceFull — 空间分割
// ============================================================
describe('PackingEngine - splitSpaceFull 空间分割', () => {
  it('纸箱放在角落产生3个新空间', () => {
    // 空间 1000x800x600, 纸箱 300x200x150 放在原点
    const spaces = PE.splitSpaceFull(
      { x: 0, y: 0, z: 0, l: 1000, w: 800, h: 600 },
      0, 0, 0, 300, 200, 150
    );
    // 产生X/Y/Z方向3个新空间
    expect(spaces.length).toBe(3);
    // X方向: x=300, y=0, z=0, l=700, w=800, h=600
    expect(spaces.some(s => s.l === 700 && s.w === 800 && s.h === 600)).toBe(true);
    // Y方向: x=0, y=200, z=0, l=300, w=600, h=600
    expect(spaces.some(s => s.l === 300 && s.w === 600 && s.h === 600)).toBe(true);
    // Z方向: x=0, y=0, z=150, l=300, w=200, h=450
    expect(spaces.some(s => s.l === 300 && s.w === 200 && s.h === 450)).toBe(true);
  });

  it('纸箱完全填充空间时不产生新空间', () => {
    const spaces = PE.splitSpaceFull(
      { x: 0, y: 0, z: 0, l: 300, w: 200, h: 150 },
      0, 0, 0, 300, 200, 150
    );
    expect(spaces).toHaveLength(0);
  });

  it('各空间尺寸都大于0', () => {
    const spaces = PE.splitSpaceFull(
      { x: 0, y: 0, z: 0, l: 500, w: 400, h: 300 },
      100, 100, 100, 200, 150, 100
    );
    spaces.forEach(s => {
      expect(s.l).toBeGreaterThan(0);
      expect(s.w).toBeGreaterThan(0);
      expect(s.h).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// calcReverse — 木箱反推（FFD）
// ============================================================
describe('PackingEngine - calcReverse 木箱反推', () => {
  it('指定数量纸箱且全部能装入时只需1个木箱', () => {
    const crateL = 1200, crateW = 1000, crateH = 800;
    const boxConfig = [
      { box: { id: 1, l: 300, w: 200, h: 150, color: '#4f9cf9', name: '箱A', keepUpright: false, weight: '' }, qty: 10 },
    ];
    const result = PE.calcReverse(crateL, crateW, crateH, boxConfig, 0, true, 0);
    expect(result).not.toBeNull();
    expect(result.totalCrates).toBe(1);
    expect(result.totalBoxCount).toBe(10);
  });

  it('大量纸箱需要多个木箱', () => {
    const crateL = 600, crateW = 500, crateH = 400;
    // 300x200x150 纸箱，一个木箱最多装... 2x2x2=8个（一层2个X，2个Y，高400/150≈2层）
    const boxConfig = [
      { box: { id: 1, l: 300, w: 200, h: 150, color: '#4f9cf9', name: '箱A', keepUpright: false, weight: '' }, qty: 20 },
    ];
    const result = PE.calcReverse(crateL, crateW, crateH, boxConfig, 0, true, 0);
    expect(result).not.toBeNull();
    expect(result.totalCrates).toBeGreaterThan(1);
    expect(result.totalBoxCount).toBe(20);
  });

  it('反推结果包含每个木箱的详细数据', () => {
    const crateL = 1200, crateW = 1000, crateH = 800;
    const boxConfig = [
      { box: { id: 1, l: 300, w: 200, h: 150, color: '#4f9cf9', name: '箱A', keepUpright: false, weight: '' }, qty: 50 },
    ];
    const result = PE.calcReverse(crateL, crateW, crateH, boxConfig, 0, true, 0);
    expect(result.crates.length).toBe(result.totalCrates);
    result.crates.forEach(c => {
      expect(c.boxes.length).toBeGreaterThan(0);
      expect(c.utilRate).toBeGreaterThan(0);
      expect(c.totalCount).toBe(c.boxes.length);
    });
  });
});

// ============================================================
// calcEnumPacking — 枚举搜索
// ============================================================
describe('PackingEngine - calcEnumPacking 枚举搜索', { timeout: 30000 }, () => {
  it('360x280x210 装入 1020x1020x930 (短超时)', () => {
    // 师傅案例：至少应该放得下比网格更多的纸箱
    const result = PE.calcEnumPacking(1020, 1020, 930, 360, 280, 210, 0, true, false, 200);
    expect(result).not.toBeNull();
    expect(result.count).toBeGreaterThan(0);
    // 所有纸箱不超出木箱边界
    const cL = 1020, cW = 1020, cH = 930;
    result.positions.forEach(p => {
      expect(p.x + p.l).toBeLessThanOrEqual(cL + 0.1);
      expect(p.y + p.w).toBeLessThanOrEqual(cW + 0.1);
      expect(p.z + p.h).toBeLessThanOrEqual(cH + 0.1);
    });
    // 无重叠
    for (let i = 0; i < result.positions.length; i++) {
      for (let j = i + 1; j < result.positions.length; j++) {
        const a = result.positions[i], b = result.positions[j];
        const overlap = a.x < b.x + b.l && a.x + a.l > b.x &&
                        a.y < b.y + b.w && a.y + a.w > b.y &&
                        a.z < b.z + b.h && a.z + a.h > b.z;
        expect(overlap).toBe(false);
      }
    }
  });

  it('不旋转时也能运行', () => {
    const result = PE.calcEnumPacking(600, 500, 400, 300, 200, 150, 0, false, false, 100);
    expect(result).not.toBeNull();
    expect(result.count).toBeGreaterThan(0);
  });

  it('纸箱无法装入时返回 null', () => {
    const result = PE.calcEnumPacking(100, 100, 100, 200, 200, 200, 0, true, false, 50);
    expect(result).toBeNull();
  });
});

// ============================================================
// calcReverseCompare — 反推对比
// ============================================================
describe('PackingEngine - calcReverseCompare 反推对比', () => {
  it('多种木箱排序后推荐最优方案', () => {
    const crateList = [
      { id: 1, l: 1200, w: 1000, h: 800, name: '大箱', maxWeight: 0 },
      { id: 2, l: 800, w: 600, h: 500, name: '中箱', maxWeight: 0 },
    ];
    const boxConfig = [
      { box: { id: 1, l: 300, w: 200, h: 150, color: '#4f9cf9', name: '箱A', keepUpright: false, weight: '' }, qty: 30 },
    ];
    const results = PE.calcReverseCompare(crateList, boxConfig, 0, true);
    expect(results.length).toBe(2);
    // 第一个应该是推荐的（木箱数量最少）
    expect(results[0].recommended).toBe(true);
    expect(results[0].totalCrates).toBeLessThanOrEqual(results[1].totalCrates);
  });

  it('每种木箱的计算结果结构完整', () => {
    const crateList = [
      { id: 1, l: 1200, w: 1000, h: 800, name: '标箱', maxWeight: 0 },
    ];
    const boxConfig = [
      { box: { id: 1, l: 300, w: 200, h: 150, color: '#4f9cf9', name: '箱A', keepUpright: false, weight: '' }, qty: 10 },
    ];
    const results = PE.calcReverseCompare(crateList, boxConfig, 0, true);
    expect(results).toHaveLength(1);
    expect(results[0].crateName).toBe('标箱');
    expect(results[0].totalCrates).toBeGreaterThan(0);
    expect(results[0].totalBoxCount).toBe(10);
  });
});
