// ============================================================
// Module: CacheManager — 最优排布缓存
// 将用户标记的最优排布存入 localStorage，下次同参数计算时直接复用
// ============================================================
window.CacheManager = (function() {
  'use strict';
  try {

  var STORAGE_KEY = 'box-calc-optimal-cache-v1';
  var MAX_ENTRIES = 200;

  // 生成缓存键：木箱LWH + 纸箱LWH + gap + allowRotate + keepUpright
  function makeKey(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright) {
    return [
      Math.round(crateL), Math.round(crateW), Math.round(crateH),
      Math.round(boxL), Math.round(boxW), Math.round(boxH),
      Math.round((gap || 0) * 100) / 100,
      allowRotate ? '1' : '0',
      keepUpright ? '1' : '0'
    ].join('|');
  }

  function loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) {
      return {};
    }
  }

  function saveAll(data) {
    try {
      // LRU 限制条目数
      var keys = Object.keys(data);
      if (keys.length > MAX_ENTRIES) {
        keys.sort(function(a, b) { return (data[a].ts || 0) - (data[b].ts || 0); });
        var remove = keys.slice(0, keys.length - MAX_ENTRIES);
        for (var i = 0; i < remove.length; i++) delete data[remove[i]];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch(e) {
      console.warn('[CacheManager] 存储失败:', e.message);
    }
  }

  // 保存标记的最优排布
  function save(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright, result) {
    var key = makeKey(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright);
    var data = loadAll();
    data[key] = {
      count: result.count,
      utilRate: result.utilRate,
      positions: result.positions,
      isRotated: result.isRotated || false,
      origL: result.origL || boxL,
      origW: result.origW || boxW,
      origH: result.origH || boxH,
      bL: result.bL || boxL,
      bW: result.bW || boxW,
      bH: result.bH || boxH,
      xCount: result.xCount || 0,
      yCount: result.yCount || 0,
      zCount: result.zCount || 0,
      ts: Date.now()
    };
    saveAll(data);
    return true;
  }

  // 查询缓存
  function get(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright) {
    var key = makeKey(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright);
    var data = loadAll();
    var entry = data[key];
    if (!entry) return null;
    return {
      count: entry.count,
      utilRate: entry.utilRate,
      positions: entry.positions,
      isRotated: entry.isRotated,
      origL: entry.origL,
      origW: entry.origW,
      origH: entry.origH,
      bL: entry.bL,
      bW: entry.bW,
      bH: entry.bH,
      xCount: entry.xCount,
      yCount: entry.yCount,
      zCount: entry.zCount,
      ts: entry.ts
    };
  }

  // 删除指定缓存
  function remove(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright) {
    var key = makeKey(crateL, crateW, crateH, boxL, boxW, boxH, gap, allowRotate, keepUpright);
    var data = loadAll();
    delete data[key];
    saveAll(data);
  }

  // 清空所有缓存
  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
  }

  // 获取条目数
  function count() {
    return Object.keys(loadAll()).length;
  }

  return { save: save, get: get, remove: remove, clear: clear, count: count, makeKey: makeKey };

  } catch(e) {
    console.error('[CacheManager] 模块初始化失败:', e);
    return { save: function(){}, get: function(){return null}, remove: function(){}, clear: function(){}, count: function(){return 0}, makeKey: function(){return ''} };
  }
})();
