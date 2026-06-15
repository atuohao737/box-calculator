# Box Calculator 代码审核报告

**审核日期**: 2026-06-15  
**审核范围**: packing-engine.js, app.js, app-state.js, storage-manager.js, visualizer-3d.js, ui-renderer.js, index.html, style.css  
**审核人**: Software Architect Agent

---

## 项目概况

| 指标 | 值 |
|------|-----|
| 模块数 | 6 个 IIFE |
| 代码行数 | ~3800 行 JS + ~800 行 CSS + ~400 行 HTML |
| 依赖 | Three.js (CDN), 零框架 |
| 架构 | 全局 IIFE + window 挂载 + 直接 DOM 操作 |

---

## P0 — 严重问题（影响正确性或数据安全）

### P0-1: 枚举搜索在 Node 环境静默跳过，测试永远无法覆盖 enum 分支 ✅ 已修复

**文件**: `packing-engine.js:430`, `packing-engine.js:1058`

~~```js
if (allowRotate && typeof process === 'undefined') {
  var enumR = calcEnumPacking(...);
```~~

**修复方案**:
- `calcEnumPacking` 新增 `timeLimit` 参数（默认15秒）
- `calcPacking` 和 `calcMixedPacking` 新增 `options` 参数，可传 `{ enumTimeLimit: N }` 控制枚举搜索时间
- 删除 `typeof process === 'undefined'` 环境嗅探，浏览器和测试走同一代码路径
- 测试中传 `{ enumTimeLimit: 50 }` 短超时，确保测试可覆盖 enum 分支且不超时
- 新增 `calcEnumPacking` 单元测试（碰撞检测、边界检查、无旋转场景）

### P0-2: bestSumApprox 重复枚举逻辑 ✅ 已修复

**文件**: `packing-engine.js:108-137`

~~`bestSumApprox(target, d1, d2)` 中做了两次循环（先 d1 为主再 d2 为主）~~

**修复方案**:
- 删除第二个冗余循环（数学上 `max a+b s.t. a*d1+b*d2≤target` 单次遍历 a 即可完备枚举）
- 修复 `maxB = Math.floor(target / d1)` → 不再需要此变量
- 更新注释说明单次遍历的数学等价性

### P0-3: 顶层 Z 轴填充不考虑与已有纸箱的重叠 ✅ 已修复

**文件**: `packing-engine.js:951-1055`（混装模式顶层填充）

~~顶填时直接在 `maxTop` 层铺网格，不考虑碰撞检测~~

**修复方案**:
- 重写顶填逻辑：逐个生成候选位置，对每个候选执行3D碰撞检测（与已有纸箱 + 本次已放入的顶填纸箱）
- 新增 `ov3dTop()` 辅助函数做 AABB 重叠检测
- 每种朝向都尝试，选碰撞后有效放置数最多的朝向
- 只放置不冲突的纸箱，避免重叠和飘空

---

## P1 — 重要问题（影响可维护性/健壮性）

### P1-1: calcEnumPacking 代码极度压缩，变量名语义丢失

**文件**: `packing-engine.js:25-99`

枚举搜索是整个项目的核心差异化算法，但代码写得极度压缩：
- `ov2` → `overlap2D`
- `cands2D` → `candidates2D`
- `t0`, `tMax`, `stall` → 无语义
- `rk`, `rj`, `rl2`, `rw2`, `rh2` → 嵌套循环中的变量名无区分度
- `fx2`, `fy2`, `zo2` → 嵌套深处的缩写

**建议**: 至少对 enum 函数做一次可读性重构，变量名使用完整英文

### P1-2: calcMixedPacking 函数过长（~300行），职责不清

**文件**: `packing-engine.js:833-1138`

这个函数同时承担：
1. 单箱降级判断
2. 多轮重试
3. 智能组合探索
4. 间隙填充
5. 顶层网格填充
6. 枚举搜索增强（策略 A + 策略 B）

应拆分为独立函数，`calcMixedPacking` 只做编排

### P1-3: App 降级对象手动维护 24+ 个空方法

**文件**: `app.js:1198-1217`

整个 return 对象被 try-catch 包裹，catch 中返回一个手动维护的空方法对象。每次添加新 API 都需要同步两边，极易遗漏。

**建议**: 用 `new Proxy()` 或在 return 时动态生成降级对象

### P1-4: AppState syncFromDOM 直接读取 DOM

**文件**: `app-state.js:46-77`

`syncFromDOM()` 遍历所有 boxes 逐个 `getElementById` 读取值。这是一个脆弱的单向绑定——任何 DOM 结构变更都会导致静默失败（读取到 undefined）。

**建议**: 表单数据走事件驱动更新（input event → 更新 state），而非每次计算前批量扫 DOM

### P1-5: exploreCombinations 可能阻塞 UI

**文件**: `packing-engine.js:582-830`

3种纸箱时，三层嵌套循环的步长最小为1，最大可能迭代次数 = `maxA * maxB * maxC`，在极端情况下（小纸箱、大木箱）可达数万次，阻塞主线程。

**建议**: 将 `exploreCombinations` 也改为异步或 Web Worker 执行

### P1-6: HTML 拼接中的 XSS 风险

**文件**: `ui-renderer.js:30-62`, `app.js:268-295`

多处 HTML 拼接使用了用户输入但未 escape：
- `renderBoxList`: `b.name` 通过 `replace(/"/g, '&quot;')` 处理了双引号，但未处理 `<` 和 `>`
- `renderCrateList`: 同上
- `renderReverseCrateList`: 同上

虽然 `UIRenderer.escapeHtml()` 函数已存在，但并未在所有拼接处使用

**建议**: 统一使用 `escapeHtml()` 包裹所有用户输入字段

### P1-7: _enumOrient 污染 boxConfigs 输入

**文件**: `packing-engine.js:1067-1076`

```js
ebc._enumOrient = [parseInt(ps[0]), parseInt(ps[1]), parseInt(ps[2])];
ebc._enumCount = enumR.count;
```

枚举搜索直接在传入的 `boxConfigs` 元素上挂载私有属性（`_enumOrient`, `_enumCount`），这违反了纯函数原则——同一个 `boxConfigs` 对象被多次调用时，旧属性会残留

**建议**: 在函数入口做深拷贝，或通过返回值传递偏好信息

### P1-8: calcPacking 中 DSAP 和 enum 的位置优先级不明确

**文件**: `packing-engine.js:240-438`

当前流程：网格 → DSAP → 枚举搜索，每层用数量/利用率做比较取最优。但：
- DSAP 的 `validCount` 比较只看了单层，未考虑 Z 堆叠后的总数
- 枚举搜索会完全覆盖 DSAP 的结果（因为 enum 通常更好）
- 三种算法的结果结构不统一（DSAP 的 positions 结构与 enum 不同）

**建议**: 统一结果结构，或明确分层策略：enum > DSAP > 网格

---

## P2 — 建议改进

### P2-1: IIFE 模块 → ES Module

6 个 `window.XXX = (function() { ... })()` IIFE 模块应迁移为 ES Module，获得：
- Tree shaking
- 明确的依赖关系
- IDE 自动补全
- 测试时可单独 import

### P2-2: 重复的统计循环

`fillGaps`、混装顶层填充、`calcMixedPacking` 的 enum 策略 B 中都有类似的"遍历 placed 数组计算 totalCount/usedVol/breakdown"逻辑。应抽取为公共函数 `updateResultStats(result, boxConfigs)`

### P2-3: 三种层算法（DSAP/Strip/FreePlace）仍有残留导出

`packing-engine.js:1511` 导出了 `calcDSAPLayer, bestSumApprox, canFitCell, buildDSAPGrid`，但 strip 和 free place 的函数已被删除。应清理不再使用的导出

### P2-4: CSS 变量已建立但 HTML 内联 style 泛滥

`style.css` 定义了 `--bg-input`, `--text-input` 等 CSS 变量，但 `ui-renderer.js` 和 `app.js` 的 HTML 拼接中大量使用硬编码颜色（如 `background:#f0f5ff`, `color:#1677ff`），导致暗色模式下这些元素不会跟随主题变化

### P2-5: 容积单位误标

**文件**: `app.js:270`, `app.js:309`

```js
'容积: ' + (c.l * c.w * c.h / 1e6).toFixed(0) + ' cm³'
```

mm³ / 1e6 = cm³，但后面的 `1e9 → m³` 是对的。问题是 `cm³` 对于木箱来说数值太大（如 1200×1000×800 = 960,000 cm³），不如改为 dm³ 或直接 m³

### P2-6: visualizer-3d.js 的 hover 检测对 Group 模式的 tooltip 尺寸不准

**文件**: `visualizer-3d.js:494`

```js
showHoverTooltip(e.clientX, e.clientY, { 
  name: '纸箱', 
  l: Math.round(size.x * 100),  // *100 是因为 SCALE=1/100
  w: Math.round(size.z * 100), 
  h: Math.round(size.y * 100), 
  rotated: false 
});
```

`size` 来自几何体 bounding box（已减去 0.05 的间隙），但显示给用户的是原始尺寸，两者不完全一致。应从 meta 数据中获取精确尺寸

---

## 架构评估

### 整体评分: 6/10

| 维度 | 评分 | 说明 |
|------|------|------|
| 正确性 | 7/10 | 核心算法可用，但 enum 顶填和 bestSumApprox 有逻辑缺陷 |
| 可维护性 | 5/10 | 单文件 1512 行算法 + 魔法变量名 + 职责不清的长函数 |
| 健壮性 | 6/10 | 有降级处理，但 DOM-State 耦合、XSS 风险、环境嗅探等问题 |
| 性能 | 7/10 | InstancedMesh 3D 优化好，但 enum/组合搜索可能阻塞 UI |
| 安全性 | 5/10 | escapeHtml 未全覆盖，localStorage 无加密 |

### 架构建议路线图

```
Phase 1 (1-2天): 修 P0
├── enum 顶填增加碰撞检测
├── bestSumApprox 合并循环
└── enum 环境嗅探改为参数注入

Phase 2 (3-5天): 修 P1
├── calcMixedPacking 拆分函数
├── enum 函数可读性重构
├── HTML 拼接全面 escapeHtml
├── _enumOrient 改为返回值传递
└── exploreCombinations 异步化

Phase 3 (1-2周): 架构升级
├── IIFE → ES Module
├── DOM-State 解耦（事件驱动）
├── 重复逻辑抽取公共函数
├── 枚举搜索迁移 Web Worker
└── 统一结果数据结构
```
