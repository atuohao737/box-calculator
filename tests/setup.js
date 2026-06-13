// 测试环境初始化 - 使用间接 eval 在全局作用域执行 IIFE 模块
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src/js');

// 已改为 window.ModuleName = (function() { ... })();
// 使用间接 eval 在全局作用域执行
const moduleFiles = [
  'app-state.js',
  'packing-engine.js',
  'storage-manager.js',
  'visualizer-3d.js',
  'ui-renderer.js',
  'app.js',
];

for (const file of moduleFiles) {
  const filePath = path.join(srcDir, file);
  const code = fs.readFileSync(filePath, 'utf-8');
  // 间接 eval：在全局作用域执行
  (0, eval)(code);
}
