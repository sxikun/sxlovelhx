import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ==========================================
// 1. 场景、相机与渲染器初始化
// 单一立体球坐标系核心，人物为主体，统一粒子流态形态变换
// ==========================================
const canvas = document.querySelector('#canvas');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06070a, 0.0006);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 195);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.8;
controls.minDistance = 40;
controls.maxDistance = 800;
controls.minPolarAngle = 0.001;
controls.maxPolarAngle = Math.PI - 0.001;

// ==========================================
// 2. 三大专属机位定义 (球面坐标系)
// 机位一 (0°): 涵馨女神 正脸写真
// 机位二 (120°): 名字“刘涵馨” 浪漫流光书法
// 机位三 (240°): 3D 脉动饱满爱心
// ==========================================
const VIEW_PORTRAIT = 0;
const VIEW_NAME = 1;
const VIEW_HEART = 2;

const VIEW_ANGLES = [
  { id: 'portrait', theta: 0, phi: Math.PI / 2, radius: 195, name: '涵馨女神' },
  { id: 'name', theta: (2 * Math.PI) / 3, phi: (75 * Math.PI) / 180, radius: 180, name: '刘涵馨' },
  { id: 'heart', theta: (4 * Math.PI) / 3, phi: (70 * Math.PI) / 180, radius: 170, name: '怦然心动' }
];

// 预先计算三大机位的标准视线方向单位向量（用于实时角度响应形变）
const VIEW_DIRS = VIEW_ANGLES.map(v => {
  return new THREE.Vector3(
    Math.sin(v.phi) * Math.sin(v.theta),
    Math.cos(v.phi),
    Math.sin(v.phi) * Math.cos(v.theta)
  ).normalize();
});

let isTransitioning = false;
let transitionProgress = 1.0;
let camStartPos = new THREE.Vector3();
let camTargetPos = new THREE.Vector3();

// DOM 元素引用
const azimuthEl = document.getElementById('azimuth-val');
const polarEl = document.getElementById('polar-val');
const btnPortrait = document.getElementById('btn-portrait');
const btnName = document.getElementById('btn-name');
const btnHeart = document.getElementById('btn-heart');
const navButtons = [btnPortrait, btnName, btnHeart];

// ==========================================
// 3. 数学生成算法：纯净 3D Taubin 参数立体心形 (无任何交错线条，绝对饱满圆融)
// ==========================================
function generateHeartPoints(totalCount) {
  const positions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 3);

  const colorDeepRed = new THREE.Color('#ff0844');
  const colorPinkGlow = new THREE.Color('#ff758c');
  const colorGoldCore = new THREE.Color('#fff2f5');

  // 心形朝向：旋转以正对机位三 (theta = 240°, phi = 70°)
  const rotY = (4 * Math.PI) / 3;
  const rotX = -0.35;
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

  const scale = 58.0;
  let count = 0;

  // 使用 Taubin 3D 隐式曲面高阶方程采样生成实心饱满爱心
  // (x^2 + y^2 + 2.25*z^2 - 1)^3 - x^2*y^3 - 0.1125*z^2*y^3 <= 0
  while (count < totalCount) {
    const x = Math.random() * 2.8 - 1.4;
    const y = Math.random() * 2.8 - 1.4;
    const z = Math.random() * 1.6 - 0.8;

    const x2 = x * x;
    const y2 = y * y;
    const z2 = z * z;
    const y3 = y * y * y;

    const a = x2 + y2 + 2.25 * z2 - 1.0;
    const val = a * a * a - x2 * y3 - 0.1125 * z2 * y3;

    if (val <= 0.0) {
      const mx = x * scale;
      const my = (y + 0.15) * scale;
      const mz = z * scale * 0.9;

      // 旋转对齐机位
      const ty = my * cosX - mz * sinX;
      const tz = my * sinX + mz * cosX;
      const finalX = mx * cosY + tz * sinY;
      const finalY = ty;
      const finalZ = -mx * sinY + tz * cosY;

      positions[count * 3] = finalX;
      positions[count * 3 + 1] = finalY;
      positions[count * 3 + 2] = finalZ;

      const dist = Math.sqrt(x2 + y2 + z2) / 1.3;
      const col = colorGoldCore.clone().lerp(colorPinkGlow, Math.min(1.0, dist * 1.1)).lerp(colorDeepRed, Math.min(1.0, dist * 1.5));

      colors[count * 3] = col.r;
      colors[count * 3 + 1] = col.g;
      colors[count * 3 + 2] = col.b;

      count++;
    }
  }

  return { positions, colors };
}

// ==========================================
// 4. 数学生成算法：三维流光书法“刘涵馨”与星尘排布
// ==========================================
function generateNamePoints(totalCount) {
  const positions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 3);

  const textCanvas = document.createElement('canvas');
  const tCtx = textCanvas.getContext('2d', { willReadFrequently: true });
  textCanvas.width = 1600;
  textCanvas.height = 650;

  tCtx.font = '600 210px "Noto Serif SC", "STKaiti", "Kaiti", "SimSun", serif';
  tCtx.fillStyle = '#ffffff';
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillText('刘 涵 馨', textCanvas.width / 2, textCanvas.height / 2 - 40);

  tCtx.font = 'italic 44px "Playfair Display", "Noto Serif SC", serif';
  tCtx.fillStyle = 'rgba(255, 230, 240, 0.95)';
  tCtx.fillText('—  To My Beloved Girl · 一生所爱  —', textCanvas.width / 2, textCanvas.height / 2 + 120);

  const tData = tCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
  const validPixels = [];

  const step = 2;
  for (let y = 0; y < textCanvas.height; y += step) {
    for (let x = 0; x < textCanvas.width; x += step) {
      const idx = (y * textCanvas.width + x) * 4;
      if (tData[idx + 3] > 40) {
        validPixels.push({
          x: (x - textCanvas.width / 2) * 0.165,
          y: -(y - textCanvas.height / 2) * 0.165,
          ratio: x / textCanvas.width
        });
      }
    }
  }

  // 名字朝向：旋转以正对机位二 (theta = 120°, phi = 75°)
  const rotY = (2 * Math.PI) / 3;
  const rotX = -0.25;
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

  const colorGold = new THREE.Color('#ffe194');
  const colorRose = new THREE.Color('#ff85a2');
  const colorLight = new THREE.Color('#ffffff');

  const textPointsCount = Math.floor(totalCount * 0.85);
  const auraPointsCount = totalCount - textPointsCount;

  // 1. 汉字笔画主体
  for (let i = 0; i < textPointsCount; i++) {
    const p = validPixels[i % validPixels.length];
    const mx = p.x + (Math.random() - 0.5) * 0.6;
    const my = p.y + (Math.random() - 0.5) * 0.6;
    const mz = (Math.random() - 0.5) * 12.0;

    const ty = my * cosX - mz * sinX;
    const tz = my * sinX + mz * cosX;
    const finalX = mx * cosY + tz * sinY;
    const finalY = ty;
    const finalZ = -mx * sinY + tz * cosY;

    positions[i * 3] = finalX;
    positions[i * 3 + 1] = finalY;
    positions[i * 3 + 2] = finalZ;

    const factor = p.ratio * 0.75 + Math.random() * 0.25;
    const col = colorGold.clone().lerp(colorRose, factor);
    if (Math.random() < 0.12) col.lerp(colorLight, 0.8);

    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  // 2. 环绕在名字周围的星轨星尘
  for (let i = 0; i < auraPointsCount; i++) {
    const idx = textPointsCount + i;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.random() * 160 + 20;
    const mx = Math.cos(theta) * r;
    const my = Math.sin(theta) * (r * 0.45);
    const mz = (Math.random() - 0.5) * 45.0;

    const ty = my * cosX - mz * sinX;
    const tz = my * sinX + mz * cosX;
    const finalX = mx * cosY + tz * sinY;
    const finalY = ty;
    const finalZ = -mx * sinY + tz * cosY;

    positions[idx * 3] = finalX;
    positions[idx * 3 + 1] = finalY;
    positions[idx * 3 + 2] = finalZ;

    const col = Math.random() > 0.4 ? colorRose : colorGold;
    colors[idx * 3] = col.r;
    colors[idx * 3 + 1] = col.g;
    colors[idx * 3 + 2] = col.b;
  }

  return { positions, colors };
}

// ==========================================
// 5. 统一核心粒子形态变换系统 (Morphing System)
// ==========================================
let masterParticles = null;
let masterMaterial = null;

const image = new Image();
image.src = '/image.jpg';
image.onload = () => {
  const imgCanvas = document.createElement('canvas');
  const ctx = imgCanvas.getContext('2d', { willReadFrequently: true });

  // 52 万高质量粒子兼顾画质与 60FPS 流畅形变
  const targetParticleCount = 520000;
  let width = image.width;
  let height = image.height;
  const scale = Math.sqrt(targetParticleCount / (width * height));
  if (scale < 1) {
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }

  imgCanvas.width = width;
  imgCanvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height).data;

  const totalCount = width * height;

  // 1. 照片位置与色彩
  const posPhoto = new Float32Array(totalCount * 3);
  const colPhoto = new Float32Array(totalCount * 3);

  const offsetX = width / 2;
  const offsetY = height / 2;
  const pScale = 0.20;

  let pIdx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = imgData[i] / 255;
      const g = imgData[i + 1] / 255;
      const b = imgData[i + 2] / 255;
      const a = imgData[i + 3] / 255;

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      const pX = (x - offsetX) * pScale;
      const pY = -(y - offsetY) * pScale;
      const pZ = luminance * 4.5;

      posPhoto[pIdx * 3] = pX;
      posPhoto[pIdx * 3 + 1] = pY;
      posPhoto[pIdx * 3 + 2] = pZ;

      colPhoto[pIdx * 3] = r;
      colPhoto[pIdx * 3 + 1] = g;
      colPhoto[pIdx * 3 + 2] = b;

      pIdx++;
    }
  }

  // 2. 名字位置与色彩
  const { positions: posName, colors: colName } = generateNamePoints(totalCount);

  // 3. 爱心位置与色彩 (饱满实心，无交错线)
  const { positions: posHeart, colors: colHeart } = generateHeartPoints(totalCount);

  // 4. 构建统一 BufferGeometry
  const geometry = new THREE.BufferGeometry();
  // 初始位置
  geometry.setAttribute('position', new THREE.BufferAttribute(posPhoto.slice(), 3));
  geometry.setAttribute('aPosPhoto', new THREE.BufferAttribute(posPhoto, 3));
  geometry.setAttribute('aPosName', new THREE.BufferAttribute(posName, 3));
  geometry.setAttribute('aPosHeart', new THREE.BufferAttribute(posHeart, 3));

  geometry.setAttribute('aColPhoto', new THREE.BufferAttribute(colPhoto, 3));
  geometry.setAttribute('aColName', new THREE.BufferAttribute(colName, 3));
  geometry.setAttribute('aColHeart', new THREE.BufferAttribute(colHeart, 3));

  // 5. 核心形变着色器 (GPU Vertex Shader 形态飞跃)
  masterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      uWeights: { value: new THREE.Vector3(1.0, 0.0, 0.0) } // (Photo, Name, Heart)
    },
    vertexShader: `
      attribute vec3 aPosPhoto;
      attribute vec3 aPosName;
      attribute vec3 aPosHeart;
      attribute vec3 aColPhoto;
      attribute vec3 aColName;
      attribute vec3 aColHeart;

      uniform vec3 uWeights;
      uniform float time;

      varying vec3 vColor;

      void main() {
        // 三态线性位置融合
        vec3 pos = aPosPhoto * uWeights.x + aPosName * uWeights.y + aPosHeart * uWeights.z;

        // 三态色彩融合
        vColor = aColPhoto * uWeights.x + aColName * uWeights.y + aColHeart * uWeights.z;

        // 视角旋转形变过渡期的流光星尘螺旋扰动 (Morphing Dispersion)
        float transitionFactor = 4.0 * (uWeights.x * uWeights.y + uWeights.y * uWeights.z + uWeights.z * uWeights.x);
        if (transitionFactor > 0.001) {
          vec3 noise = sin(pos.yzx * 0.08 + time * 2.5) * cos(pos.zxy * 0.08 + time * 2.0);
          pos += noise * (transitionFactor * 15.0);
        }

        // 心跳双拍律动 (当爱心权重较高时激活)
        if (uWeights.z > 0.05) {
          float beatCycle = fract(time * 1.25);
          float pulse = sin(beatCycle * 3.1415926);
          float heartbeat = pow(pulse, 6.0) * 0.14 + pow(sin(max(0.0, beatCycle - 0.2) * 3.1415926), 8.0) * 0.07;
          pos += pos * (heartbeat * uWeights.z * 0.7);
        }

        // 柔和微弱呼吸
        pos.z += sin(time * 1.2 + pos.x * 0.05 + pos.y * 0.05) * 0.06;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        // 点尺寸在照片时细腻紧密，在名字与爱心时微放发光
        float ptSize = 1.15 * uWeights.x + 1.45 * uWeights.y + 1.45 * uWeights.z;
        gl_PointSize = ptSize * (270.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.48) discard;
        float alpha = smoothstep(0.48, 0.42, dist);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  masterParticles = new THREE.Points(geometry, masterMaterial);
  scene.add(masterParticles);
};

// ==========================================
// 6. 星空球坐标网格与深空星尘
// ==========================================
function createCelestialRingsAndStars() {
  const ringGroup = new THREE.Group();
  const ringRadius = 150;

  // 赤道环
  const eqGeo = new THREE.RingGeometry(ringRadius - 0.25, ringRadius + 0.25, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x4a6984,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.22
  });
  const eqRing = new THREE.Mesh(eqGeo, ringMat);
  eqRing.rotation.x = Math.PI / 2;
  ringGroup.add(eqRing);

  // 三大视角的指示经度弧
  VIEW_ANGLES.forEach((v, k) => {
    const arcPoints = [];
    for (let p = 0; p <= 64; p++) {
      const phi = (p / 64) * Math.PI;
      const x = ringRadius * Math.sin(phi) * Math.sin(v.theta);
      const y = ringRadius * Math.cos(phi);
      const z = ringRadius * Math.sin(phi) * Math.cos(v.theta);
      arcPoints.push(new THREE.Vector3(x, y, z));
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMat = new THREE.LineBasicMaterial({
      color: k === 0 ? 0xffb6c1 : k === 1 ? 0xffd700 : 0xff416c,
      transparent: true,
      opacity: 0.35
    });
    ringGroup.add(new THREE.Line(arcGeo, arcMat));
  });
  scene.add(ringGroup);

  // 遥远深空星尘 (3500 颗)
  const starCount = 3500;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = 550 + Math.random() * 400;

    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);

    const brightness = 0.5 + Math.random() * 0.5;
    starColors[i * 3] = brightness;
    starColors[i * 3 + 1] = brightness * (0.85 + Math.random() * 0.15);
    starColors[i * 3 + 2] = brightness * (0.95 + Math.random() * 0.05);
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    depthWrite: false
  });

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

createCelestialRingsAndStars();

// ==========================================
// 7. 视角切换与平滑插值系统
// ==========================================
function switchView(viewIndex) {
  navButtons.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === viewIndex);
  });

  const target = VIEW_ANGLES[viewIndex];
  const tx = target.radius * Math.sin(target.phi) * Math.sin(target.theta);
  const ty = target.radius * Math.cos(target.phi);
  const tz = target.radius * Math.sin(target.phi) * Math.cos(target.theta);

  camStartPos.copy(camera.position);
  camTargetPos.set(tx, ty, tz);

  isTransitioning = true;
  transitionProgress = 0.0;
}

btnPortrait.addEventListener('click', () => switchView(VIEW_PORTRAIT));
btnName.addEventListener('click', () => switchView(VIEW_NAME));
btnHeart.addEventListener('click', () => switchView(VIEW_HEART));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 8. 主动画循环 (Animation Loop)
// 包含自由拖拽旋转时的动态视角响应形变 (Angle-Driven Morphing)
// ==========================================
const clock = new THREE.Clock();
const currentWeights = new THREE.Vector3(1.0, 0.0, 0.0);

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  // 处理按键飞跃平滑过渡
  if (isTransitioning) {
    transitionProgress += delta * 0.85; // 约 1.2 秒平滑飞跃
    if (transitionProgress >= 1.0) {
      transitionProgress = 1.0;
      isTransitioning = false;
    }

    const t = transitionProgress;
    const ease = t * t * (3.0 - 2.0 * t);
    camera.position.lerpVectors(camStartPos, camTargetPos, ease);
    controls.target.set(0, 0, 0);
  }

  controls.update();

  // 计算当前摄像机在球面坐标系中的视线方向向量
  const camDir = camera.position.clone().sub(controls.target).normalize();

  // 计算摄像机与三大标准视角的角度余弦匹配度
  const dot0 = Math.max(0.0, camDir.dot(VIEW_DIRS[0]));
  const dot1 = Math.max(0.0, camDir.dot(VIEW_DIRS[1]));
  const dot2 = Math.max(0.0, camDir.dot(VIEW_DIRS[2]));

  // 使用幂函数增强峰值聚焦（当靠近某视角时，迅速呈现该形态）
  const p0 = Math.pow(dot0, 4.5);
  const p1 = Math.pow(dot1, 4.5);
  const p2 = Math.pow(dot2, 4.5);
  const total = p0 + p1 + p2 + 0.0001;

  const targetWeights = new THREE.Vector3(p0 / total, p1 / total, p2 / total);

  // 平滑插值更新权重
  currentWeights.lerp(targetWeights, 0.12);

  if (masterMaterial) {
    masterMaterial.uniforms.time.value = elapsedTime;
    masterMaterial.uniforms.uWeights.value.copy(currentWeights);
  }

  // 实时更新顶部 HUD 球坐标指示
  const spherical = new THREE.Spherical().setFromVector3(camera.position);
  let azimuthDeg = ((spherical.theta * 180) / Math.PI) % 360;
  if (azimuthDeg < 0) azimuthDeg += 360;
  const polarDeg = (spherical.phi * 180) / Math.PI;

  azimuthEl.textContent = `${azimuthDeg.toFixed(0)}°`;
  polarEl.textContent = `${polarDeg.toFixed(0)}°`;

  // 根据当前权重自动高亮对应的按键
  if (!isTransitioning) {
    if (currentWeights.x > 0.6) {
      navButtons.forEach((b, i) => b.classList.toggle('active', i === 0));
    } else if (currentWeights.y > 0.6) {
      navButtons.forEach((b, i) => b.classList.toggle('active', i === 1));
    } else if (currentWeights.z > 0.6) {
      navButtons.forEach((b, i) => b.classList.toggle('active', i === 2));
    }
  }

  renderer.render(scene, camera);
}

animate();
