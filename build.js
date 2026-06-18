// build.js — 自定义构建脚本
// 将 src/index.html + 外部 CSS/JS 内联为单个 HTML 文件
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, 'src');
const DIST_DIR = path.resolve(__dirname, 'dist');
const DOCS_DIR = path.resolve(__dirname, 'docs');
const HTML_FILE = path.join(SRC_DIR, 'index.html');
const CSS_FILE = path.join(SRC_DIR, 'css', 'style.css');
const THREE_FILE = path.join(SRC_DIR, 'lib', 'three.min.js');
const OUTPUT_FILE = path.join(DIST_DIR, 'index.html');

// 确保 dist 目录存在
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
// 确保 docs 目录存在
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

// 读取 CSS
const cssContent = fs.readFileSync(CSS_FILE, 'utf-8');

// 读取 Three.js（本地库）
const threeContent = fs.readFileSync(THREE_FILE, 'utf-8');

// 读取 HTML
let html = fs.readFileSync(HTML_FILE, 'utf-8');

// 替换 CSS link 为内联 <style>
html = html.replace(
  /<link rel="stylesheet" href="css\/style\.css">/,
  function() { return '<style>' + cssContent + '</style>'; }
);

// 内联 Three.js（替换 <script src="lib/three.min.js"> 为内联脚本）
html = html.replace(
  /<script src="lib\/three\.min\.js"><\/script>/,
  function() { return '<script>\n' + threeContent + '\n</script>'; }
);

// 内联所有模块脚本 <script src="js/xxx.js">
html = html.replace(
  /<script src="js\/([^"]+\.js)"><\/script>/g,
  function(match, filename) {
    const filePath = path.join(SRC_DIR, 'js', filename);
    if (!fs.existsSync(filePath)) {
      console.warn('[WARN] 文件未找到:', filePath);
      return match;
    }
    const jsContent = fs.readFileSync(filePath, 'utf-8');
    return '<script>\n' + jsContent + '\n</script>';
  }
);

// 写入 dist/
fs.writeFileSync(OUTPUT_FILE, html, 'utf-8');

// 同时同步到 docs/ (GitHub Pages 部署目录)
const DOCS_OUTPUT = path.join(DOCS_DIR, 'index.html');
fs.writeFileSync(DOCS_OUTPUT, html, 'utf-8');

const stats = fs.statSync(OUTPUT_FILE);
const sizeKB = (stats.size / 1024).toFixed(1);
console.log('✅ 构建完成: ' + OUTPUT_FILE);
console.log('   文件大小: ' + sizeKB + ' KB');
console.log('   Three.js 版本: r' + getThreeVersion());
console.log('   (Three.js 内联: 约 619 KB)');

function getThreeVersion() {
  const match = threeContent.match(/r\d+/);
  return match ? match[0] : '152';
}
