// ============================================================
// Module: Visualizer3D — 3D 可视化
// ============================================================
window.Visualizer3D = (function() {
  'use strict';
  try {
  let scene, camera, renderer, crateGroup, boxGroup;
  let threeWrap;
  const SCALE = 1 / 100;
  let wireframeMode = false, crateVisible = true, orientationMarkers = true, crateDashedMode = false;
  let crateDashedGroup = null; // 虚线边框组

  let isMouseDown = false, isRightDown = false;
  let lastMouse = { x: 0, y: 0 };
  let spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 22 };
  let target = null;  // 延迟初始化，THREE 可能尚未加载
  let panOffset = null;

  // Raycaster hover 检测
  let raycaster, hoverMouse;
  let instancedMeshMeta = []; // { mesh, meta[] } — 每个 InstancedMesh 附带每个实例的元数据
  let hoverTooltipEl;
  let hoverHighlightGroup = null;  // 高亮边框组
  let currentHoverInstance = null; // 当前高亮的 { mesh, instanceId } 或 { group }

  // 触摸支持
  let touchStartDist = 0;
  let touchStartSpherical = null;
  let touchCount = 0;

  function init() {
    if (renderer) return;
    if (typeof THREE === 'undefined') {
      console.warn('Three.js not loaded yet, retrying in 500ms...');
      setTimeout(init, 500);
      return;
    }
    threeWrap = document.getElementById('three-canvas-wrap');
    const w = threeWrap.clientWidth || 800;
    const h = threeWrap.clientHeight || 500;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1e2e);

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
    camera.position.set(12, 10, 18);
    camera.lookAt(0, 0, 0);

    // 延迟初始化 THREE 依赖的顶层变量
    if (!target) target = new THREE.Vector3(0, 0, 0);
    if (!panOffset) panOffset = new THREE.Vector3();

    // 初始化 Raycaster 和 hover 相关
    raycaster = new THREE.Raycaster();
    hoverMouse = new THREE.Vector2();
    hoverTooltipEl = document.getElementById('box-hover-tooltip');

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    threeWrap.appendChild(renderer.domElement);
    console.log('[V3] 渲染器初始化完成, 尺寸:', w, 'x', h, ', WebGL:', !!renderer.capabilities);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x6080ff, 0.3);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(30, 30, 0x2a3050, 0x252a3d);
    scene.add(grid);

    crateGroup = new THREE.Group();
    boxGroup = new THREE.Group();
    scene.add(crateGroup);
    scene.add(boxGroup);

    // 木箱虚线边框组（始终可见，不受 crateVisible 影响）
    crateDashedGroup = new THREE.Group();
    scene.add(crateDashedGroup);

    // 高亮边框组（始终在顶层渲染）
    hoverHighlightGroup = new THREE.Group();
    scene.add(hoverHighlightGroup);

    setupControls();
    animate();

    window.addEventListener('resize', () => {
      if (!threeWrap) return;
      const w2 = threeWrap.clientWidth, h2 = threeWrap.clientHeight;
      if (w2 > 0 && h2 > 0) {
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
        renderer.setSize(w2, h2);
      }
    });
  }

  function animate() {
    requestAnimationFrame(animate);
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function setupControls() {
    const canvas = renderer.domElement;
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // 鼠标事件
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) isMouseDown = true;
      if (e.button === 2) isRightDown = true;
      lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { isMouseDown = false; isRightDown = false; });
    window.addEventListener('mousemove', e => {
      if (!isMouseDown && !isRightDown) return;
      const dx = e.clientX - lastMouse.x, dy = e.clientY - lastMouse.y;
      lastMouse = { x: e.clientX, y: e.clientY };
      if (isMouseDown) {
        spherical.theta -= dx * 0.005;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.005));
        updateCamera();
      }
      if (isRightDown) {
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up).normalize();
        panOffset.addScaledVector(right, -dx * 0.02);
        panOffset.addScaledVector(camera.up, dy * 0.02);
        updateCamera();
      }
    });

    // Hover 检测 — 独立 mousemove，不在拖拽时触发
    canvas.addEventListener('mousemove', e => {
      if (isMouseDown || isRightDown) return;
      handleHover(e);
    });
    canvas.addEventListener('mouseleave', () => {
      hideHover();
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      spherical.radius = Math.max(2, Math.min(200, spherical.radius + e.deltaY * 0.02));
      updateCamera();
    }, { passive: false });

    // 触摸事件
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      touchCount = e.touches.length;
      if (touchCount === 1) {
        isMouseDown = true;
        lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (touchCount === 2) {
        isMouseDown = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
        touchStartSpherical = { ...spherical };
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && isMouseDown) {
        const dx = e.touches[0].clientX - lastMouse.x;
        const dy = e.touches[0].clientY - lastMouse.y;
        lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        spherical.theta -= dx * 0.005;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.005));
        updateCamera();
      } else if (e.touches.length === 2 && touchStartSpherical) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (touchStartDist > 0) {
          spherical.radius = Math.max(2, Math.min(200, touchStartSpherical.radius * (touchStartDist / dist)));
          updateCamera();
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      isMouseDown = false;
      touchStartDist = 0;
      touchStartSpherical = null;
      touchCount = 0;
    });
  }

  function updateCamera() {
    if (!camera) return;
    const t = panOffset.clone().add(target);
    camera.position.set(
      t.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
      t.y + spherical.radius * Math.cos(spherical.phi),
      t.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
    );
    camera.lookAt(t);
  }

  function resetCamera() {
    spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 22 };
    panOffset.set(0, 0, 0);
    updateCamera();
  }

  function toggleWireframe() {
    wireframeMode = !wireframeMode;
    if (boxGroup) boxGroup.traverse(obj => { if (obj.isMesh && obj.material) obj.material.wireframe = wireframeMode; });
  }

  function toggleCrateVis() {
    crateVisible = !crateVisible;
    if (crateGroup) crateGroup.visible = crateVisible;
    // 如果打开了实体木箱，关闭虚线模式
    if (crateVisible && crateDashedMode) {
      crateDashedMode = false;
      if (crateDashedGroup) {
        crateDashedGroup.children.forEach(function(child) {
          child.visible = false;
        });
      }
    }
  }

  function toggleOrientationMarkers() {
    orientationMarkers = !orientationMarkers;
    // 重新渲染当前场景以应用/移除标记
    const S = AppState;
    if (S.currentMode === 'single' && S.calcResults.length > 0) {
      renderSingleScene(S.calcResults[S.currentSchemeIdx]);
    } else if (S.currentMode === 'mixed' && S.mixResult) {
      renderMixedScene(S.mixResult);
    }
  }

  function toggleCrateDashed() {
    crateDashedMode = !crateDashedMode;
    if (crateDashedGroup) {
      crateDashedGroup.visible = true; // 组始终可见
      crateDashedGroup.children.forEach(function(child) {
        child.visible = crateDashedMode;
      });
    }
    // 如果开启了虚线模式，同时隐藏实体木箱
    if (crateDashedMode && crateGroup) {
      crateGroup.visible = false;
      crateVisible = false;
    } else if (crateGroup) {
      crateGroup.visible = true;
      crateVisible = true;
    }
    return crateDashedMode;
  }

  // 根据旋转后的尺寸，计算原始模型的3D旋转角度
  // 原始模型: BoxGeometry(origL, origH, origW)，方向标在Y+顶面
  // 需要旋转后使模型在X/Y/Z轴的尺寸变为 curL/curH/curW
  // 返回 { rotX, rotY, rotZ } 欧拉角(弧度)
  function getBoxRotation(origL, origW, origH, curL, curW, curH) {
    // 不旋转的情况
    if (curL === origL && curW === origW && curH === origH) {
      return { rotX: 0, rotY: 0, rotZ: 0 };
    }

    // 原始轴到当前轴的映射
    // 原始: X=origL, Y=origH, Z=origW
    // 当前: X=curL, Y=curH, Z=curW

    // 找出 curL 来自原始哪个轴
    let srcX, srcY, srcZ;
    if (curL === origL) srcX = 'x';
    else if (curL === origW) srcX = 'z';
    else srcX = 'y'; // curL === origH

    if (curH === origH) srcY = 'y';
    else if (curH === origL) srcY = 'x';
    else srcY = 'z'; // curH === origW

    if (curW === origW) srcZ = 'z';
    else if (curW === origL) srcZ = 'x';
    else srcZ = 'y'; // curW === origH

    // 根据轴映射确定旋转
    // 使用欧拉角：绕X轴(roll), 绕Y轴(yaw), 绕Z轴(pitch)
    let rotX = 0, rotY = 0, rotZ = 0;

    if (srcY === 'y') {
      // Y轴不变，只有XZ面的旋转（绕Y轴旋转）
      if (srcX === 'x' && srcZ === 'z') { rotY = 0; }          // 不变
      else if (srcX === 'z' && srcZ === 'x') { rotY = Math.PI / 2; } // X↔Z交换：绕Y转90°
    } else if (srcY === 'x') {
      // 原始Y变成了当前X → 绕Z轴转-90°
      rotZ = -Math.PI / 2;
      if (srcZ === 'z') { /* Y→X, X→Y, Z不变: 绕Z转-90° */ }
      else if (srcZ === 'y') { rotX = Math.PI / 2; } // Y→X, Z→Y, X→Z
    } else if (srcY === 'z') {
      // 原始Y变成了当前Z → 绕X轴转90°
      rotX = Math.PI / 2;
      if (srcX === 'x') { /* Y→Z, X不变, Z→Y: 绕X转90° */ }
      else if (srcX === 'y') { rotZ = Math.PI / 2; } // Y→Z, Z→X, X→Y
    }

    // 更精确的处理：直接根据轴映射构建旋转矩阵逻辑
    // 简化方案：根据常见的6种排列直接匹配
    // [origL, origW, origH] → [curL, curW, curH]

    // 使用简单的查找表
    const key = `${curL},${curW},${curH}`;
    const rotations = {};

    // 情况1: [l, w, h] — 不变
    rotations[`${origL},${origW},${origH}`] = [0, 0, 0];

    // 情况2: [l, h, w] — 绕X轴旋转，Y和Z交换 (原始顶面→前面)
    rotations[`${origL},${origH},${origW}`] = [Math.PI / 2, 0, 0];

    // 情况3: [w, l, h] — 绕Y轴旋转90°，X和Z交换 (原始顶面仍为顶面，但长宽交换)
    rotations[`${origW},${origL},${origH}`] = [0, Math.PI / 2, 0];

    // 情况4: [w, h, l] — 原始X→Z, 原始Y→X, 原始Z→Y
    rotations[`${origW},${origH},${origL}`] = [0, Math.PI / 2, Math.PI / 2];

    // 情况5: [h, l, w] — 原始X→Y, 原始Y→Z, 原始Z→X
    rotations[`${origH},${origL},${origW}`] = [Math.PI / 2, 0, Math.PI / 2];

    // 情况6: [h, w, l] — 原始X→Y, 原始Y→X, 原始Z→Z (绕Z轴转90°)
    rotations[`${origH},${origW},${origL}`] = [0, 0, Math.PI / 2];

    if (rotations[key]) {
      return { rotX: rotations[key][0], rotY: rotations[key][1], rotZ: rotations[key][2] };
    }

    return { rotX: 0, rotY: 0, rotZ: 0 };
  }

  // 创建纸箱完整模型：原始尺寸的BoxGeometry + 方向标在原始顶面(Y+)
  // origL, origW, origH 是原始尺寸(未乘SCALE)
  // color 是 THREE.Color
  // withMarker: 是否包含方向标
  function createBoxModel(origL, origW, origH, color, withMarker) {
    const group = new THREE.Group();
    const s = SCALE;
    const bL = origL * s, bW = origW * s, bH = origH * s;

    // 纸箱主体
    const boxGeom = new THREE.BoxGeometry(bL - 0.05, bH - 0.05, bW - 0.05);
    const boxMat = new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: 0.95, roughness: 0.6, metalness: 0.1 });
    const boxMesh = new THREE.Mesh(boxGeom, boxMat);
    boxMesh.castShadow = true;
    group.add(boxMesh);

    // 线框
    const edgeGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(bL - 0.03, bH - 0.03, bW - 0.03));
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const edgeLine = new THREE.LineSegments(edgeGeom, edgeMat);
    group.add(edgeLine);

    // 方向标（在原始顶面 Y+ 上方悬浮，避免与顶面重合）
    if (withMarker) {
      const radius = Math.min(bL, bW) * 0.14;
      const floatOffset = 0.06; // 悬浮在顶面上方

      // 白色填充圆（底层）
      const whiteShape = new THREE.Shape();
      whiteShape.absarc(0, 0, radius + 0.025, 0, Math.PI * 2, false);
      const whiteGeom = new THREE.ShapeGeometry(whiteShape);
      const whiteMesh = new THREE.Mesh(whiteGeom, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      whiteMesh.rotation.x = -Math.PI / 2;
      whiteMesh.position.y = bH / 2 + floatOffset;
      group.add(whiteMesh);

      // 黑色实心圆
      const circleShape = new THREE.Shape();
      circleShape.absarc(0, 0, radius, 0, Math.PI * 2, false);
      const circleGeom = new THREE.ShapeGeometry(circleShape);
      const circleMesh = new THREE.Mesh(circleGeom, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      circleMesh.rotation.x = -Math.PI / 2;
      circleMesh.position.y = bH / 2 + floatOffset + 0.002;
      group.add(circleMesh);

      // 白色细描边
      const outlineShape = new THREE.Shape();
      outlineShape.absarc(0, 0, radius + 0.015, 0, Math.PI * 2, false);
      const holePath = new THREE.Path();
      holePath.absarc(0, 0, radius - 0.01, 0, Math.PI * 2, true);
      outlineShape.holes.push(holePath);
      const outlineGeom = new THREE.ShapeGeometry(outlineShape);
      const outlineMesh = new THREE.Mesh(outlineGeom, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      outlineMesh.rotation.x = -Math.PI / 2;
      outlineMesh.position.y = bH / 2 + floatOffset + 0.002;
      group.add(outlineMesh);
    }

    return group;
  }

  function clearScene() {
    if (!scene) return;
    while (crateGroup.children.length) crateGroup.remove(crateGroup.children[0]);
    while (boxGroup.children.length) boxGroup.remove(boxGroup.children[0]);
    while (crateDashedGroup.children.length) crateDashedGroup.remove(crateDashedGroup.children[0]);
    clearHoverHighlight();
    instancedMeshMeta = [];
    hideHoverTooltip();
  }

  // Hover 检测：用 Raycaster 检测纸箱，显示 tooltip + 高亮边框
  function handleHover(e) {
    if (!raycaster || !camera || !threeWrap) return;
    const rect = threeWrap.getBoundingClientRect();
    hoverMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    hoverMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(hoverMouse, camera);

    // 检测 boxGroup 下所有物体（InstancedMesh + 独立 Group）
    const allObjects = [];
    // InstancedMesh 模式
    instancedMeshMeta.forEach(function(entry) { allObjects.push(entry.mesh); });
    // 独立 Group 模式（方向标）
    boxGroup.children.forEach(function(child) {
      if (child.isGroup) {
        child.children.forEach(function(mesh) {
          if (mesh.isMesh) allObjects.push(mesh);
        });
      }
    });

    const intersects = raycaster.intersectObjects(allObjects, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const hitObj = hit.object;

      // 判断是 InstancedMesh 还是普通 Mesh
      if (hitObj.isInstancedMesh && hit.instanceId !== undefined) {
        // InstancedMesh 模式
        const mesh = hitObj;
        const instanceId = hit.instanceId;
        const metaEntry = instancedMeshMeta.find(function(m) { return m.mesh === mesh; });
        if (!metaEntry || instanceId >= metaEntry.meta.length) { hideHover(); return; }

        const info = metaEntry.meta[instanceId];
        showHoverTooltip(e.clientX, e.clientY, info);

        // 从实例矩阵获取位置
        if (!currentHoverInstance || currentHoverInstance.type !== 'instance' ||
            currentHoverInstance.mesh !== mesh || currentHoverInstance.instanceId !== instanceId) {
          createInstancedHighlight(mesh, instanceId);
          currentHoverInstance = { type: 'instance', mesh: mesh, instanceId: instanceId };
        }
      } else if (hitObj.isMesh && hitObj.parent && hitObj.parent.parent === boxGroup) {
        // 独立 Group 模式
        var boxGroupObj = hitObj.parent; // 纸箱的 Group
        var boxPos = boxGroupObj.position;
        var boxScale = boxGroupObj.scale;
        // 获取纸箱尺寸：从几何体 bounding box
        var geom = hitObj.geometry;
        if (geom.boundingBox === null) geom.computeBoundingBox();
        var bb = geom.boundingBox;
        var size = new THREE.Vector3();
        bb.getSize(size);

        // 用 Group 上的位置和旋转创建高亮
        if (!currentHoverInstance || currentHoverInstance.type !== 'group' ||
            currentHoverInstance.group !== boxGroupObj) {
          createGroupHighlight(boxPos, size, boxScale, boxGroupObj.rotation);
          currentHoverInstance = { type: 'group', group: boxGroupObj };
        }

        // 简单的 tooltip 信息
        showHoverTooltip(e.clientX, e.clientY, { name: '纸箱', l: Math.round(size.x * 100), w: Math.round(size.z * 100), h: Math.round(size.y * 100), rotated: false });
      } else {
        hideHover();
      }
    } else {
      hideHover();
    }
  }

  function hideHover() {
    hideHoverTooltip();
    clearHoverHighlight();
    currentHoverInstance = null;
  }

  function showHoverTooltip(clientX, clientY, info) {
    if (!hoverTooltipEl) return;
    const nameHtml = info.name ? '<div class="ht-name">' + escapeHtml(info.name) + '</div>' : '';
    const rotatedHtml = info.rotated ? '<div class="ht-rotated">↻ 旋转放置</div>' : '';
    hoverTooltipEl.innerHTML = nameHtml +
      '<div class="ht-dims">长(L): ' + info.l + 'mm &nbsp; 宽(W): ' + info.w + 'mm &nbsp; 高(H): ' + info.h + 'mm</div>' +
      rotatedHtml;

    // 定位 tooltip，避免超出屏幕
    const rect = hoverTooltipEl.getBoundingClientRect();
    let left = clientX + 15;
    let top = clientY + 10;
    if (left + 200 > window.innerWidth) left = clientX - 210;
    if (top + 60 > window.innerHeight) top = clientY - 70;
    hoverTooltipEl.style.left = left + 'px';
    hoverTooltipEl.style.top = top + 'px';
    hoverTooltipEl.classList.add('visible');
  }

  function hideHoverTooltip() {
    if (hoverTooltipEl) hoverTooltipEl.classList.remove('visible');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // Hover 高亮边框
  // ============================================================
  function clearHoverHighlight() {
    if (hoverHighlightGroup) {
      while (hoverHighlightGroup.children.length) {
        hoverHighlightGroup.remove(hoverHighlightGroup.children[0]);
      }
    }
  }

  // InstancedMesh 模式：根据实例矩阵获取位置，创建高亮边框
  function createInstancedHighlight(mesh, instanceId) {
    clearHoverHighlight();
    // 从 meta 中找到对应的尺寸信息
    var metaEntry = instancedMeshMeta.find(function(m) { return m.mesh === mesh; });
    if (!metaEntry || !metaEntry.dims) return;
    var dims = metaEntry.dims; // { l, w, h } 场景空间尺寸

    var dummy = new THREE.Object3D();
    mesh.getMatrixAt(instanceId, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    // 使用实际的纸箱尺寸创建边框（略大一点避免 z-fighting）
    var pad = 0.06;
    var edgeGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(dims.l + pad, dims.h + pad, dims.w + pad));
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
    var edgeLine = new THREE.LineSegments(edgeGeom, edgeMat);
    edgeLine.position.copy(dummy.position);
    edgeLine.quaternion.copy(dummy.quaternion);
    hoverHighlightGroup.add(edgeLine);
  }

  // 独立 Group 模式：根据位置和尺寸创建高亮边框
  function createGroupHighlight(pos, size, scale, rotation) {
    clearHoverHighlight();
    var hs = size.clone().multiply(scale).addScalar(0.06);
    var edgeGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(hs.x, hs.y, hs.z));
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
    var edgeLine = new THREE.LineSegments(edgeGeom, edgeMat);
    edgeLine.position.copy(pos);
    if (rotation) edgeLine.rotation.copy(rotation);
    hoverHighlightGroup.add(edgeLine);
  }

  function drawCrate(cL, cW, cH) {
    const s = SCALE;
    const geom = new THREE.BoxGeometry(cL * s, cH * s, cW * s);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b6914, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cL * s / 2, cH * s / 2, cW * s / 2);
    crateGroup.add(mesh);
    const edges = new THREE.EdgesGeometry(geom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xd4a017 }));
    line.position.copy(mesh.position);
    crateGroup.add(line);

    // 虚线边框（始终添加，受 crateDashedMode 控制可见性）
    const dashedGeom = new THREE.EdgesGeometry(geom);
    const dashedMat = new THREE.LineDashedMaterial({ color: 0xd4a017, dashSize: 0.2, gapSize: 0.1, transparent: true, opacity: 0.6 });
    const dashedLine = new THREE.LineSegments(dashedGeom, dashedMat);
    dashedLine.position.copy(mesh.position);
    dashedLine.computeLineDistances(); // 必须调用才能显示虚线
    dashedLine.visible = crateDashedMode;
    crateDashedGroup.add(dashedLine);
  }

  function setCamera(cL, cW, cH) {
    const s = SCALE;
    target.set(cL * s / 2, cH * s / 2, cW * s / 2);
    const maxDim = Math.max(cL, cW, cH) * s;
    spherical.radius = maxDim * 2.2;
    panOffset.set(0, 0, 0);
    updateCamera();
  }

  function renderSingleScene(cr) {
    if (!scene) { console.warn('[V3] renderSingleScene: scene 未初始化'); return; }
    clearScene();
    if (!cr || !cr.result) { console.warn('[V3] renderSingleScene: 无计算结果', cr); return; }
    const { crateL, crateW, crateH, result, box } = cr;
    console.log('[V3] renderSingleScene: 木箱', crateL, crateW, crateH, '纸箱:', box.name, result.count, '个');
    const s = SCALE;

    drawCrate(crateL, crateW, crateH);
    const color = new THREE.Color(box.color);
    const total = result.positions.length;
    const showMarkers = orientationMarkers && total <= 200;

    // 按旋转后的尺寸分组
    const dimGroups = new Map();
    result.positions.forEach((p, i) => {
      const key = p.l + '-' + p.w + '-' + p.h;
      if (!dimGroups.has(key)) dimGroups.set(key, { l: p.l, w: p.w, h: p.h, items: [] });
      dimGroups.get(key).items.push({ ...p, idx: i });
    });

    for (const [, g] of dimGroups) {
      const gbL = g.l * s, gbW = g.w * s, gbH = g.h * s;
      const gCount = g.items.length;
      const isRotatedGroup = !(g.l === box.l && g.w === box.w && g.h === box.h);

      if (showMarkers) {
        // 有方向标模式：每个纸箱用独立的 Group，带3D旋转
        const rot = getBoxRotation(box.l, box.w, box.h, g.l, g.w, g.h);
        // 旋转过的纸箱使用同色系稍深一点的颜色，正放保持原色
        const groupColor = isRotatedGroup ? color.clone().offsetHSL(0.04, 0, -0.08) : color;
        const markerModel = createBoxModel(box.l, box.w, box.h, groupColor, true);
        g.items.forEach((p, i) => {
          const boxClone = markerModel.clone(true);
          // 应用3D旋转
          boxClone.rotation.set(rot.rotX, rot.rotY, rot.rotZ);
          // 放置位置：用旋转后的尺寸计算中心点
          boxClone.position.set(p.x * s + gbL / 2, p.z * s + gbH / 2, p.y * s + gbW / 2);
          boxGroup.add(boxClone);
        });
      } else {
        // 无方向标模式（大量纸箱）：用 InstancedMesh 提升性能
        // 旋转过的纸箱使用同色系稍深一点的颜色，正放保持原色
        const gColor = isRotatedGroup ? color.clone().offsetHSL(0.04, 0, -0.08) : color;
        const boxGeom = new THREE.BoxGeometry(gbL - 0.05, gbH - 0.05, gbW - 0.05);
        const boxMat = new THREE.MeshStandardMaterial({ color: gColor, transparent: true, opacity: 0.95, roughness: 0.6, metalness: 0.1 });
        const instMesh = new THREE.InstancedMesh(boxGeom, boxMat, gCount);
        const dummy = new THREE.Object3D();
        g.items.forEach((p, i) => {
          dummy.position.set(p.x * s + gbL / 2, p.z * s + gbH / 2, p.y * s + gbW / 2);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          instMesh.setMatrixAt(i, dummy.matrix);
        });
        instMesh.instanceMatrix.needsUpdate = true;
        instMesh.castShadow = true;
        boxGroup.add(instMesh);
        // 存储元数据用于 hover 检测
        const metaArr = g.items.map(p => ({
          l: box.l, w: box.w, h: box.h,
          name: box.name,
          rotated: p.rotated || false
        }));
        instancedMeshMeta.push({
          mesh: instMesh,
          meta: metaArr,
          dims: { l: gbL, w: gbW, h: gbH }
        });
      }
    }

    setCamera(crateL, crateW, crateH);

    const mainCount = result.xCount * result.yCount * result.zCount;
    const tailCount = result.count - mainCount;
    const tailInfo = tailCount > 0 ? '<br>含旋转填充: <b style="color:#fa8c16">+' + tailCount + ' 个</b>' : '';
    const info = document.getElementById('canvas-info');
    info.innerHTML = '<b>' + escapeHtml(box.name) + '</b><br>装入: <b>' + result.count + ' 个</b><br>主排列: ' + result.xCount + '×' + result.yCount + '×' + result.zCount + tailInfo + '<br>利用率: <b>' + (result.utilRate * 100).toFixed(1) + '%</b>';
    document.getElementById('legend-overlay').style.display = 'none';
    wireframeMode = false;
  }

  function renderMixedScene(mr) {
    if (!scene) return;
    clearScene();
    const { placed } = mr;
    const crateL = mr.displayCrateL || mr.crateL_raw || (mr.crateL + (mr.gap || 0) * 2) || 1200;
    const crateW = mr.displayCrateW || mr.crateW_raw || (mr.crateW + (mr.gap || 0) * 2) || 1000;
    const crateH = mr.displayCrateH || mr.crateH_raw || (mr.crateH + (mr.gap || 0) * 2) || 800;
    const s = SCALE;

    drawCrate(crateL, crateW, crateH);

    const groups = {};
    placed.forEach((p, i) => {
      const dimKey = p.boxIdx + '-' + p.l + '-' + p.w + '-' + p.h;
      if (!groups[dimKey]) groups[dimKey] = [];
      groups[dimKey].push({ ...p, globalIdx: i });
    });

    const showMarkers = orientationMarkers && placed.length <= 200;

    Object.entries(groups).forEach(([dimKey, items]) => {
      const bx = items[0];
      const bL = bx.l * s, bW = bx.w * s, bH = bx.h * s;
      const origL = bx.origL || bx.l;
      const origW = bx.origW || bx.w;
      const origH = bx.origH || bx.h;
      const baseColor = new THREE.Color(bx.color);
      const isRotatedGroup = !(bx.l === origL && bx.w === origW && bx.h === origH);

      if (showMarkers) {
        // 有方向标模式：每个纸箱用独立 Group，带3D旋转
        // 旋转过的纸箱使用同色系稍深一点的颜色，正放保持原色
        const color = isRotatedGroup ? baseColor.clone().offsetHSL(0.04, 0, -0.08) : baseColor;
        const rot = getBoxRotation(origL, origW, origH, bx.l, bx.w, bx.h);
        const baseModel = createBoxModel(origL, origW, origH, color, true);

        items.forEach((p, i) => {
          const boxClone = baseModel.clone(true);
          boxClone.rotation.set(rot.rotX, rot.rotY, rot.rotZ);
          boxClone.position.set(p.x * s + bL / 2, p.z * s + bH / 2, p.y * s + bW / 2);
          boxGroup.add(boxClone);
        });
      } else {
        // 无方向标模式：用 InstancedMesh
        // 旋转过的纸箱使用同色系稍深一点的颜色，正放保持原色
        const color = isRotatedGroup ? baseColor.clone().offsetHSL(0.04, 0, -0.08) : baseColor;
        const geom = new THREE.BoxGeometry(bL - 0.05, bH - 0.05, bW - 0.05);
        const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.95, roughness: 0.6, metalness: 0.1 });
        const instMesh = new THREE.InstancedMesh(geom, mat, items.length);
        const dummy = new THREE.Object3D();
        items.forEach((p, i) => {
          dummy.position.set(p.x * s + bL / 2, p.z * s + bH / 2, p.y * s + bW / 2);
          dummy.updateMatrix();
          instMesh.setMatrixAt(i, dummy.matrix);
        });
        instMesh.instanceMatrix.needsUpdate = true;
        instMesh.castShadow = true;
        boxGroup.add(instMesh);
        // 存储元数据用于 hover 检测
        const metaArr = items.map(p => ({
          l: p.origL || bx.l, w: p.origW || bx.w, h: p.origH || bx.h,
          name: bx.name || '',
          rotated: p.rotated || false
        }));
        instancedMeshMeta.push({
          mesh: instMesh,
          meta: metaArr,
          dims: { l: bL, w: bW, h: bH }
        });
      }
    });

    setCamera(crateL, crateW, crateH);

    const info = document.getElementById('canvas-info');
    const breakdownHtml = mr.breakdown.filter(b => b.count > 0).map(b => {
      return escapeHtml(b.box.name) + ': <b>' + b.count + '个</b>';
    }).join('<br>');
    info.innerHTML = '<b>🎲 混装方案</b><br>总装入: <b>' + mr.totalCount + ' 个</b><br>' + breakdownHtml + '<br>利用率: <b style="color:#52c41a">' + (mr.utilRate * 100).toFixed(1) + '%</b>';

    const legendEl = document.getElementById('legend-overlay');
    legendEl.style.display = 'block';
    legendEl.innerHTML = mr.breakdown.filter(b => b.count > 0).map(b =>
      '<div class="legend-item"><div class="legend-dot" style="background:' + b.box.color + '"></div>' + escapeHtml(b.box.name) + ': ' + b.count + '个</div>'
    ).join('');
    wireframeMode = false;
  }

  function isReady() { return !!renderer; }

  function resizeIfNeeded() {
    if (!renderer || !threeWrap) return;
    const w2 = threeWrap.clientWidth, h2 = threeWrap.clientHeight;
    if (w2 > 0 && h2 > 0) {
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    }
  }

  return { init, isReady, resizeIfNeeded, clearScene, renderSingleScene, renderMixedScene, resetCamera, toggleWireframe, toggleCrateVis, toggleOrientationMarkers, toggleCrateDashed };
  } catch(e) {
    console.error('[Visualizer3D] 模块初始化失败 (THREE可能未加载):', e.message);
    // 返回一个降级对象，所有方法为空操作
    var noop = function() {};
    return {
      init: function(cb) { if (cb) setTimeout(cb, 100); },
      isReady: function() { return false; },
      resizeIfNeeded: noop, clearScene: noop,
      renderSingleScene: noop, renderMixedScene: noop,
      resetCamera: noop, toggleWireframe: noop,
      toggleCrateVis: noop, toggleOrientationMarkers: noop, toggleCrateDashed: noop
    };
  }
})();
