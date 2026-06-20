# 批量模式代码索引

## 状态层 — `src/js/app-state.js`

| 行号 | 代码 | 说明 |
|------|------|------|
| 15 | `let batchResults = [];` | 批量计算结果数组 `[{crate, calcResults, mixResult}]` |
| 21 | `let batchMode = false;` | 批量模式开关 |
| 22 | `let batchActiveCrateIdx = 0;` | 当前选中的木箱索引 |
| 65 | `if (batchMode) { ... }` | `getCrateValues()` 中批量模式读取多木箱 |
| 104 | `if (batchMode && crates.length > 0) { ... }` | `setCrateValues()` 批量模式写入多木箱 |
| 122 | `batchResults = [];` | `clearResults()` 清空结果 |
| 124 | `batchMode = false; batchActiveCrateIdx = 0;` | `clearResults()` 重置开关 |
| 143-156 | getter/setter | `batchResults`, `batchMode`, `batchActiveCrateIdx` 对外接口 |

---

## 算法引擎 — `src/js/packing-engine.js`

无直接 batch 相关代码（batch 由 app.js 循环调用算法）

---

## 主控制器 — `src/js/app.js`

| 行号 | 函数/代码 | 说明 |
|------|-----------|------|
| 61-73 | `setMode()` | 切换模式时控制批量按钮、多木箱输入区显隐 |
| 195-203 | `toggleBatchMode()` | 切换批量模式开关，切换UI面板 |
| 312 | `batchImportCrates()` | 从规格库批量导入木箱尺寸 |
| 427-461 | `calculate()` (batch分支) | 遍历所有木箱，逐个调用算法，存入 `batchResults` |
| 573-574 | `markBatchRecommendations()` | 标记最佳利用率和最多数量 |
| 584 | `saveHistory()` | 保存历史时附带 batchResults |
| 588 | `batchActiveCrateIdx = 0` | 计算后重置选中索引 |
| 610-638 | `markBatchRecommendations()` | 标记最佳利用率和最多数量 |
| 660-661 | `render3DScene()` | 批量模式下读 batchResults 渲染3D |
| 693-694 | `render2DScene()` | 批量模式下读 batchResults 渲染2D |
| 730-731 | `switchTo2D()` | 批量模式下切换到2D |
| 747-758 | `loadHistory()` | 恢复历史时还原 batchMode + batchResults |
| 798-799 | `setMode()` | 恢复历史后重置批量按钮状态 |
| 868 | `batchImportReverseCrates()` | 反推模式从规格库批量导入 |
| 1030-1034 | `generateReport()` | 报告中包含批量对比数据 |
| 1225-1226 | 公开API | `toggleBatchMode, batchImportCrates, selectBatchCrate, selectBatchBox, selectBatchBox2D` |
| 1245-1247 | 降级API | 同上函数的空实现 |

---

## UI渲染 — `src/js/ui-renderer.js`

| 行号 | 函数/代码 | 说明 |
|------|-----------|------|
| 76-77 | `renderResults()` | 批量模式分支入口 |
| 106-249 | `renderBatchResults()` | **核心**：渲染批量对比卡片列表 |
| 109 | `const brs = s.batchResults` | 读批量结果 |
| 119-121 | `sorted` | 按利用率降序排列 |
| 145 | `s.batchActiveCrateIdx` | 当前高亮卡片 |
| 151-152 | bestBadges | 最佳利用率 / 最多数量标签 |
| 155-157 | cardOnClick | 卡片点击回调（混装进3D，单品高亮） |
| 169-173 | 关键指标区 | 最多装箱数 + 容积 |
| 176-228 | 纸箱明细区 | 单品：flex行（纸箱名+数量+利用率条+按钮）混装：简单列表 |
| 216-217 | 3D/2D按钮 | `selectBatchBox` / `selectBatchBox2D` |
| 229-237 | 利用率进度条 | 混装模式底部总利用率条 |
| 256-289 | `selectBatchCrate()` | 点击卡片切换选中木箱，渲染3D |
| 291-323 | `selectBatchBox()` | 点击3D按钮渲染单纸箱3D |
| 325-343 | `selectBatchBox2D()` | 点击2D按钮渲染单纸箱俯视图 |
| 598-607 | `renderSchemaTabs()` | 批量模式下渲染木箱Tab切换 |
| 712 | 导出 | `renderBatchResults, selectBatchCrate, selectBatchBox` |

---

## HTML模板 — `src/index.html`

| 行号 | 代码 | 说明 |
|------|------|------|
| 47 | `#batch-mode-btn` | 📋 批量按钮，onclick=`App.toggleBatchMode()` |
| 76 | `#multi-crate-area` | 多木箱输入区（批量模式显示） |
| 80 | `App.batchImportCrates()` | 📥 批量导入按钮 |
| 94 | `App.batchImportReverseCrates()` | 反推模式批量导入 |

---

## CSS样式 — `src/css/style.css`

| 行号 | 选择器 | 说明 |
|------|--------|------|
| 92-101 | `.batch-compare-table` | 对比表格样式（含排序、hover、选中行） |
| 102 | `.batch-best-badge` | 最佳标记徽章 |
| 103 | `.batch-rec-label` | 推荐标签 |
| 104-105 | `.batch-util-bar` / `.batch-util-fill` | 利用率进度条 |
| 106-107 | `.batch-detail-section` / `.batch-detail-title` | 详情区块 |

---

## 数据流

```
用户点击📋批量 → toggleBatchMode() → batchMode=true
  → UI：隐藏单木箱输入区，显示多木箱输入区
  → 用户添加多个木箱尺寸

用户点击"开始计算" → calculate()
  → batchMode分支：遍历所有木箱
  → 每个木箱：调用算法(calcPacking/calcMixedPacking)
  → 结果存入 batchResults[]
  → markBatchRecommendations() 标记最佳
  → 保存历史(含batchResults)

渲染 → renderResults()
  → batchMode分支 → renderBatchResults()
  → 卡片列表：利用率降序，最佳标签，纸箱明细，3D/2D按钮

交互 → selectBatchCrate(idx) → 高亮卡片 + 渲染3D
     → selectBatchBox(crateIdx, boxIdx) → 渲染单纸箱3D
     → selectBatchBox2D(crateIdx, boxIdx) → 渲染单纸箱2D俯视图
```
