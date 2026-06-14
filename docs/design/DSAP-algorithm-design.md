# DSAP 算法设计文档
# Dual-Size Alternating Partition (双尺寸交错分区算法)
# 基于师傅摆法的规律提炼

---

## 一、核心思想

师傅摆法的本质是：
1. 从纸箱的 3 个维度中选出 **2 个**作为平面排布尺寸
2. 在这 2 个尺寸上做**整数线性组合逼近**（类似背包问题）
3. X 轴和 Y 轴使用**相反的排列顺序**（相位错位），确保所有交叉格子都是有效朝向
4. 同一层内盒子高度相同（第三个维度），不同层可以换高度

---

## 二、算法输入/输出

### 输入
- `crateL, crateW`: 容器平面的长和宽（已扣除 gap）
- `boxDims = [L, W, H]`: 纸箱的三个维度
- `keepUpright`: 是否必须直立（高度固定为 H）

### 输出
```javascript
{
  totalCells: 16,          // 总格子数
  layout: [
    { x: 0, y: 0, cellW: 280, cellH: 210, boxW: 280, boxD: 210 },  // A型
    { x: 280, y: 0, cellW: 280, cellH: 210, boxW: 280, boxD: 210 },
    ...
  ],
  layerHeight: 360,        // 本层统一高度
  dimSubset: [280, 210],   // 选用了哪两个维度做平面
  heightDim: 360,          // 第三个维度作为高度
  phaseShift: true         // 是否用了相位错位
}
```

---

## 三、算法伪代码

### 主函数：calcDSAPLayer(crateL, crateW, boxDims, keepUpright)

```
function calcDSAPLayer(crateL, crateW, boxDims, keepUpright):
    bestResult = null
    
    // 步骤1: 枚举维度子集 (选2个做平面，1个做高度)
    subsets = getAll2DSubsets(boxDims, keepUpright)
    // 例: boxDims=[360,280,210], keepUpright=true
    // 则 subsets = [ {plane:[280,210], height:360} ]
    // 若 keepUpright=false
    // 则 subsets = [ {plane:[360,280], height:210},
    //                {plane:[360,210], height:280},
    //                {plane:[280,210], height:360} ]
    
    for each subset in subsets:
        d1 = subset.plane[0]  // 较大尺寸
        d2 = subset.plane[1]  // 较小尺寸
        h  = subset.height
        
        if h > crateH: continue  // 层高超了，跳过
        
        // 步骤2: X轴最优分段
        xSegments = bestSumApprox(crateL, d1, d2)
        // 返回: [ {count:d1的个数, segments:[d1,d1,...]}, totalWidth ]
        // 例: crateL=1020, d1=280, d2=210
        //     best: [280,280,210,210] = 980, 4 segments
        
        // 步骤3: Y轴最优分段
        ySegments = bestSumApprox(crateW, d1, d2)
        
        // 步骤4: 尝试两种相位策略
        strategies = [
            { x: xSegments, y: ySegments, shift: false },  // 同相位
            { x: xSegments, y: reverse(ySegments), shift: true }  // 反相位(错位)
        ]
        
        for each strategy:
            // 步骤5: 构建网格并验证有效性
            grid = buildGrid(strategy.x.segments, strategy.y.segments)
            validCells = countValidCells(grid, d1, d2)
            
            if validCells > bestResult.totalCells:
                bestResult = {
                    totalCells: validCells,
                    layout: grid,
                    layerHeight: h,
                    dimSubset: [d1, d2],
                    phaseShift: strategy.shift
                }
    
    return bestResult
```

---

### 子函数1：bestSumApprox(target, d1, d2) — 最优和逼近

**问题**: 找非负整数 `a, b` 使 `a×d1 + b×d2 ≤ target`，且 `a + b` 最大。

**解法**: 因为 `d1, d2` 是纸箱尺寸（通常 100~1000mm），`target` 是容器尺寸（通常 < 2000mm），
穷举 `a` 从 0 到 `floor(target/d1)` 即可，复杂度 O(target/d1) ≈ O(10)。

```
function bestSumApprox(target, d1, d2):
    maxSegments = 0
    bestA = 0, bestB = 0
    
    for a = 0 to floor(target / d1):
        remaining = target - a * d1
        b = floor(remaining / d2)
        total = a + b
        if total > maxSegments:
            maxSegments = total
            bestA = a
            bestB = b
    
    // 构建分段数组
    segments = [d1 repeated bestA times, d2 repeated bestB times]
    return { segments, totalWidth: bestA*d1 + bestB*d2, cellCount: maxSegments }
```

**优化**: 可进一步考虑交换 d1/d2 的顺序（即先放 d2 再放 d1），取格子数更多的。

---

### 子函数2：buildGrid(xSegments, ySegments) — 构建棋盘网格

```
function buildGrid(xSegments, ySegments):
    grid = []
    xOffset = 0
    
    for i, xSize in xSegments:
        yOffset = 0
        for j, ySize in ySegments:
            // 格子的底面尺寸 = (xSize, ySize)
            // 需要判断这个尺寸能否用 {d1, d2} 的有效朝向填满
            cell = {
                x: xOffset,
                y: yOffset,
                w: xSize,
                h: ySize,
                valid: canFit(xSize, ySize, d1, d2)
            }
            grid.push(cell)
            yOffset += ySize
        xOffset += xSize
    
    return grid
```

---

### 子函数3：canFit(cellW, cellH, d1, d2) — 判断格子是否有效

一个格子 `(cellW, cellH)` 有效，当且仅当存在纸箱的一种水平旋转，
使纸箱的底面完全落在格子内。

```
function canFit(cellW, cellH, d1, d2):
    // 纸箱平面尺寸是 {d1, d2} 的无序对
    // 两种朝向:
    //   A: (d1, d2)  — 宽=d1, 深=d2
    //   B: (d2, d1)  — 宽=d2, 深=d1
    
    // 格子能容纳 A 型?
    fitA = (d1 <= cellW && d2 <= cellH)
    // 格子能容纳 B 型?
    fitB = (d2 <= cellW && d1 <= cellH)
    
    return fitA || fitB
```

**关键**: 在师傅的错位方案中：
- `(280, 210)` 格子 → 放 A 型 (280×210) ✓
- `(210, 280)` 格子 → 放 B 型 (210×280) ✓
- 没有 `(280, 280)` 或 `(210, 210)` 这种无效格子！

---

## 四、集成到现有代码

### 修改点1：在 `calcPacking` 中引入 DSAP

`calcPacking` 目前是纯网格算法（`xCount * yCount`）。修改为：

```
function calcPacking(...):
    // 原有逻辑: 纯网格
    gridResult = calcPureGrid(...)
    
    // 新增: DSAP 算法
    if allowRotate:
        dsapResult = calcDSAPLayer(crateL, crateW, [boxL, boxW, boxH], keepUpright)
        if dsapResult 且 dsapResult.totalCells > gridResult.xCount * gridResult.yCount:
            return buildLayerResult(dsapResult, crateH, gap, layerGap)
    
    return gridResult
```

### 修改点2：支持多层不同高度

当前算法每层高度相同。需要改为：

```
function calcMultiLayerDSAP(crateL, crateW, crateH, boxDims, gap, layerGap):
    totalPlaced = []
    remainingH = crateH
    layerNum = 0
    
    while remainingH >= min(boxDims):
        // 对当前剩余高度，选最优的层高维度
        layerPlan = calcBestLayerForHeight(remainingH, boxDims)
        
        // 用 DSAP 排这一层
        layer = calcDSAPLayer(crateL, crateW, layerPlan.dims, ...)
        
        // 记录位置 (z 轴偏移)
        for box in layer.layout:
            box.z = crateH - remainingH + gap
            totalPlaced.push(box)
        
        remainingH -= layerPlan.height + layerGap
    
    return totalPlaced
```

---

## 五、实施步骤

### Phase 1: 基础 DSAP（单层，固定高度）
- [ ] 实现 `bestSumApprox()` — 最优和逼近
- [ ] 实现 `canFit()` — 格子有效性判断
- [ ] 实现 `buildGrid()` — 构建棋盘网格
- [ ] 实现 `calcDSAPLayer()` — 主函数
- [ ] 单元测试：验证 1020×1020 输入能输出 16 格

### Phase 2: 集成到 `calcPacking`
- [ ] 在 `calcPacking` 中调用 `calcDSAPLayer`
- [ ] 对比 DSAP vs 纯网格，选更优的
- [ ] 更新 3D 预览，正确显示 A/B 型朝向

### Phase 3: 多层变高
- [ ] 实现 `calcMultiLayerDSAP()` — 多层不同高度
- [ ] 高度选择策略：优先用最高维度，剩余高度用较小维度
- [ ] 测试：1020×1020×930 能放多少（目标：接近41个）

### Phase 4: 优化和边界处理
- [ ] gap 处理：DSAP 网格也要考虑 gap
- [ ] 不规则剩余空间：DSAP 排完后，用原有 `splitSpaceFull` 填剩余空间
- [ ] keepUpright=true 时的限制

---

## 六、预期效果

| 测试用例 | 当前算法 | DSAP 算法 | 师傅实际 | 差距 |
|---------|---------|-----------|---------|------|
| 1020×1020×930, 360×280×210 | 6/层, ~36个 | **16/层, ~41个** | ~41个 | 0% |
| 1200×1000×800, 300×200×150 | 16/层, ~64个 | 待计算 | - | - |

---

## 七、风险和限制

1. **只适用于纸箱 3 个维度差异较大的情况**（如 360, 280, 210）。
   如果 3 个维度接近（如 200, 210, 200），DSAP 优势不大。

2. **相位错位只在 X/Y 轴都用混合分段时有效**。
   如果 X 轴纯 d1，Y 轴纯 d2，则不需要错位（本来就是纯网格）。

3. **计算量微小**：枚举 3 种子集 × 穷举 ~10 个 a 值 = ~30 次运算，可忽略。

4. **与现有算法的关系**：DSAP 是**补充**而非替代。
   对于不适合 DSAP 的情况（如纸箱维度接近），回退到纯网格或 MOG 算法。

---

## 八、决策建议

我建议按 **Phase 1 → Phase 2 → 暂停 → 验证效果** 的顺序实施：

1. 先实现基础 DSAP，用单元测试验证能产出 16/层的排布
2. 集成到主流程，对比效果
3. 如果单层效果接近师傅，再决定是否做多层变高（Phase 3）

**是否按照这个方案开始实施？**
