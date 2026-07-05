import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Play,
  Volume2,
  VolumeX,
  createIcons,
} from 'lucide';

gsap.registerPlugin(ScrollTrigger);

const CARD_WIDTH = 1.9;
const CARD_HEIGHT = 2.72;
const CARD_FRAME = 0.08;

const works = [
  {
    id: 'afterglow',
    index: '01',
    title: '余晖航线',
    meta: 'Cinema Loop / 2026',
    tags: ['Bloom', 'Scroll Camera', 'Raycaster'],
    palette: ['#ff6f4d', '#ffd166', '#1f7a8c', '#101014'],
    description:
      '以暖色光带和低空粒子构成城市夜航视效，强调封面点击、悬停发光和镜头推进后的作品进入感。',
    specs: ['片元混合转场', '封面发光反馈', '宽屏画册叙事'],
  },
  {
    id: 'tide',
    index: '02',
    title: '潮汐信号',
    meta: 'Interactive Album / 2026',
    tags: ['Texture', 'Fog', 'Motion'],
    palette: ['#2dd4bf', '#0ea5e9', '#f8fafc', '#071013'],
    description:
      '通过冷色纹理、雾效和滚动镜头展示水面信号的层次，适合扩展为 WebGL 图片位移转场。',
    specs: ['雾化空间', '流媒体封面', '响应式详情'],
  },
  {
    id: 'ember',
    index: '03',
    title: '暗火档案',
    meta: 'Visual Stream / 2026',
    tags: ['Particles', 'Depth', 'Sound'],
    palette: ['#ef4444', '#f97316', '#f5f5f4', '#120d0b'],
    description:
      '以暗场、高反差和粒子轨迹组织强烈的影像封面，呈现类似电影片头的作品浏览节奏。',
    specs: ['粒子层', '点击音效', '封面透视'],
  },
  {
    id: 'glass',
    index: '04',
    title: '玻璃季风',
    meta: 'Gallery Motion / 2026',
    tags: ['Reflection', 'GSAP', '3D Layout'],
    palette: ['#a7f3d0', '#60a5fa', '#fef3c7', '#0a1018'],
    description:
      '使用透明感色块和高光边缘模拟玻璃介质，配合镜头侧移展现立体画廊的空间连续性。',
    specs: ['滚动叙事', '镜头侧移', '材质高光'],
  },
  {
    id: 'signal',
    index: '05',
    title: '频谱广场',
    meta: 'Media Grid / 2026',
    tags: ['Grid', 'Hover Scale', 'Post FX'],
    palette: ['#facc15', '#22c55e', '#38bdf8', '#10130f'],
    description:
      '将流媒体封面抽象为频谱式色块，以空间网格和亮度变化表现作品集合的节奏。',
    specs: ['空间封面墙', '后期辉光', '模块化数据'],
  },
  {
    id: 'orbit',
    index: '06',
    title: '轨道切片',
    meta: 'WebGL Study / 2026',
    tags: ['Morphing', 'Album', 'Responsive'],
    palette: ['#c084fc', '#fb7185', '#f9fafb', '#10071a'],
    description:
      '围绕环形轨迹布置影像视觉，后续可加入案例 1 式的片元着色器转场和折叠错觉。',
    specs: ['图像序列', '画册切换', '移动端适配'],
  },
];

const els = {
  canvas: document.querySelector('#galleryCanvas'),
  introPanel: document.querySelector('.intro-panel'),
  workPanel: document.querySelector('.work-panel'),
  openActiveWork: document.querySelector('#openActiveWork'),
  soundToggle: document.querySelector('#soundToggle'),
  workIndex: document.querySelector('#workIndex'),
  workTitle: document.querySelector('#workTitle'),
  workMeta: document.querySelector('#workMeta'),
  workDescription: document.querySelector('#workDescription'),
  workTags: document.querySelector('#workTags'),
  railProgress: document.querySelector('#railProgress'),
  railItems: document.querySelector('#railItems'),
  hoverLabel: document.querySelector('#hoverLabel'),
};

class GalleryExperience {
  constructor() {
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.pointer = new THREE.Vector2(10, 10);
    this.clickPointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.coverMeshes = [];
    this.activeIndex = 0;
    this.focusedIndex = null;
    this.focusBlend = 0;
    this.hovered = null;
    this.scrollProgress = 0;
    this.soundEnabled = false;
    this.audio = null;
    this.cameraTarget = new THREE.Vector3(0, 1.7, 0);
    this.galleryViewPosition = new THREE.Vector3();
    this.galleryViewTarget = new THREE.Vector3();
    this.focusViewPosition = new THREE.Vector3();
    this.focusViewTarget = new THREE.Vector3();
    this.desiredCameraPosition = new THREE.Vector3();
    this.desiredCameraTarget = new THREE.Vector3();
    this.routeCurveStart = new THREE.Vector3();
    this.routeCurveEnd = new THREE.Vector3();
    this.tmpQuaternion = new THREE.Quaternion();
    this.tmpNormal = new THREE.Vector3();
    this.galleryProgress = 0;
    this.motionProgress = 0;
    this.presentationProgress = 0;
    this.jumpRoute = null;
    this.cardGroups = [];
  }

  init() {
    createIcons({
      icons: {
        Play,
        Volume2,
        VolumeX,
      },
    });

    this.buildScene();
    this.buildGallery();
    this.buildRail();
    this.updateWorkPanel(0);
    this.bindEvents();
    this.setupScroll();
    this.resize();
    this.render();
  }

  buildScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050506');
    this.scene.fog = new THREE.Fog('#050506', 5, 22);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 80);
    this.camera.position.set(-0.45, 2.05, 6.15);

    this.renderer = new THREE.WebGLRenderer({
      canvas: els.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.62,
      0.55,
      0.18,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    const ambient = new THREE.HemisphereLight('#f8fafc', '#101014', 1.25);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(4, 7, 5);
    this.scene.add(key);

    const rim = new THREE.PointLight('#7dd3fc', 32, 18);
    rim.position.set(-5, 3, 2);
    this.scene.add(rim);

    const warm = new THREE.PointLight('#fb923c', 18, 16);
    warm.position.set(5, 2, -4);
    this.scene.add(warm);

    this.galleryGroup = new THREE.Group();
    this.scene.add(this.galleryGroup);
  }

  buildGallery() {
    this.addArchitecture();
    this.addParticles();

    works.forEach((work, index) => {
      const lane = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const x = lane * 2.18;
      const z = row * -3.3 + 0.45;
      const rotationY = lane === -1 ? Math.PI * 0.17 : -Math.PI * 0.17;
      const card = new THREE.Group();
      card.position.set(x, 1.75, z);
      card.rotation.y = rotationY;
      const visual = new THREE.Group();
      card.add(visual);
      card.userData.visual = visual;
      this.galleryGroup.add(card);
      this.cardGroups.push(card);

      const coverTexture = this.createCoverTexture(work);
      const coverMaterial = new THREE.MeshStandardMaterial({
        map: coverTexture,
        emissive: new THREE.Color('#ffffff'),
        emissiveMap: coverTexture,
        emissiveIntensity: 0.22,
        roughness: 0.38,
        metalness: 0.08,
        transparent: true,
      });
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT), coverMaterial);
      cover.position.z = 0.04;
      cover.userData = { work, index, card, visual, baseScale: 1 };
      visual.add(cover);
      this.coverMeshes.push(cover);

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: '#19191d',
        roughness: 0.24,
        metalness: 0.54,
        transparent: true,
      });
      const horizontalFrame = new THREE.BoxGeometry(CARD_WIDTH + CARD_FRAME * 2, CARD_FRAME, 0.12);
      const verticalFrame = new THREE.BoxGeometry(CARD_FRAME, CARD_HEIGHT + CARD_FRAME * 2, 0.12);
      [
        [horizontalFrame, 0, CARD_HEIGHT / 2 + CARD_FRAME / 2],
        [horizontalFrame, 0, -CARD_HEIGHT / 2 - CARD_FRAME / 2],
        [verticalFrame, -CARD_WIDTH / 2 - CARD_FRAME / 2, 0],
        [verticalFrame, CARD_WIDTH / 2 + CARD_FRAME / 2, 0],
      ].forEach(([geometry, frameX, frameY]) => {
        const framePart = new THREE.Mesh(geometry, frameMaterial);
        framePart.position.set(frameX, frameY, 0);
        visual.add(framePart);
      });

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(CARD_WIDTH + 0.36, CARD_HEIGHT + 0.36),
        new THREE.MeshBasicMaterial({
          color: work.palette[1],
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.position.z = -0.07;
      visual.add(glow);

      card.userData.materials = [
        { material: coverMaterial, baseOpacity: 1 },
        { material: frameMaterial, baseOpacity: 1 },
        { material: glow.material, baseOpacity: 0.08 },
      ];
    });
  }

  addArchitecture() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 26, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#080809',
        roughness: 0.72,
        metalness: 0.2,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -4.7;
    this.galleryGroup.add(floor);

    const centerLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 20),
      new THREE.MeshBasicMaterial({
        color: '#f8fafc',
        transparent: true,
        opacity: 0.2,
      }),
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(0, 0.012, -4.8);
    this.galleryGroup.add(centerLine);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: '#111114',
      roughness: 0.68,
      metalness: 0.16,
    });

    [-4.35, 4.35].forEach((x) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.8, 20), wallMaterial);
      wall.position.set(x, 2.2, -4.7);
      this.galleryGroup.add(wall);
    });

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(9.2, 0.12, 20),
      new THREE.MeshStandardMaterial({
        color: '#0c0c0e',
        roughness: 0.55,
        metalness: 0.24,
      }),
    );
    ceiling.position.set(0, 4.55, -4.7);
    this.galleryGroup.add(ceiling);

    for (let i = 0; i < 8; i += 1) {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.04, 1.25),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? '#fef3c7' : '#bae6fd',
        }),
      );
      light.position.set(0, 4.46, 3.6 - i * 2.35);
      this.galleryGroup.add(light);
    }
  }

  addParticles() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorA = new THREE.Color('#f8fafc');
    const colorB = new THREE.Color('#f59e0b');
    const colorC = new THREE.Color('#38bdf8');

    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = Math.random() * 4 + 0.2;
      positions[i * 3 + 2] = -Math.random() * 17 + 3;

      const color = i % 3 === 0 ? colorA : i % 3 === 1 ? colorB : colorC;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.galleryGroup.add(this.particles);
  }

  createCoverTexture(work) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, work.palette[0]);
    gradient.addColorStop(0.48, work.palette[3]);
    gradient.addColorStop(1, work.palette[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 34; i += 1) {
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.random() * 0.14;
      ctx.strokeStyle = i % 2 ? work.palette[2] : '#ffffff';
      ctx.lineWidth = 4 + Math.random() * 18;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((i / 34) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, 120 + i * 17, 44 + i * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 0.78;
    ctx.fillStyle = 'rgba(5, 5, 6, 0.42)';
    ctx.fillRect(74, 76, canvas.width - 148, canvas.height - 152);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 2;
    ctx.strokeRect(92, 94, canvas.width - 184, canvas.height - 188);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 76px "PingFang SC", "Microsoft YaHei", sans-serif';
    wrapCanvasText(ctx, work.title, 118, 262, 780, 92);

    ctx.font = '500 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
    ctx.fillText(work.meta, 118, 408);

    ctx.font = '800 180px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillText(work.index, 110, 1110);

    ctx.fillStyle = work.palette[1];
    ctx.fillRect(118, 1174, 260, 9);
    ctx.fillStyle = work.palette[2];
    ctx.fillRect(118, 1202, 168, 9);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  buildRail() {
    works.forEach((work, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rail-item';
      button.innerHTML = `<span>${work.index}</span><strong>${work.title}</strong>`;
      button.addEventListener('click', () => {
        this.routeToProgress(index / Math.max(works.length - 1, 1));
      });
      els.railItems.appendChild(button);
    });
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    window.addEventListener('pointerleave', () => this.clearHover());
    window.addEventListener('wheel', () => this.cancelJumpRoute(), { passive: true });
    window.addEventListener('touchstart', () => this.cancelJumpRoute(), { passive: true });
    window.addEventListener('click', (event) => {
      if (event.target.closest('button, a')) {
        return;
      }

      if (this.focusedIndex !== null) {
        this.clearFocus();
        return;
      }

      const hit = this.getCoverHit(event.clientX, event.clientY);
      if (hit) {
        this.focusWork(hit.object.userData.index);
      }
    });

    els.openActiveWork.addEventListener('click', () => {
      if (this.focusedIndex !== null) {
        this.clearFocus();
        return;
      }
      this.focusWork(this.activeIndex);
    });
    els.soundToggle.addEventListener('click', () => this.toggleSound());
    document.querySelector('a[href="#gallery"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.routeToProgress(0);
    });
    document.querySelector('a[href="#collection"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.routeToProgress(0.5);
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.clearFocus();
      }
    });
  }

  setupScroll() {
    ScrollTrigger.create({
      start: 0,
      end: () => document.documentElement.scrollHeight - window.innerHeight,
      scrub: 1,
      onUpdate: (self) => {
        this.scrollProgress = self.progress;
        this.galleryProgress = THREE.MathUtils.clamp(self.progress, 0, 1);
        const scrollIndex = Math.round(this.galleryProgress * (works.length - 1));
        const index = this.focusedIndex ?? scrollIndex;
        this.updateWorkPanel(index, this.galleryProgress);
      },
    });
  }

  routeToProgress(progress) {
    const targetProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const targetIndex = Math.round(targetProgress * (works.length - 1));
    const sourceIndex = this.focusedIndex ?? Math.round(this.motionProgress * (works.length - 1));
    const distance = Math.abs(targetIndex - sourceIndex);

    this.clearFocus();

    if (distance <= 1) {
      this.cancelJumpRoute();
      this.scrollToProgress(targetProgress, 'smooth');
      return;
    }

    this.startJumpRoute(targetProgress, targetIndex, distance);
  }

  scrollToProgress(progress, behavior = 'smooth') {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: maxScroll * THREE.MathUtils.clamp(progress, 0, 1),
      behavior,
    });
    ScrollTrigger.update();
  }

  startJumpRoute(targetProgress, targetIndex, distance) {
    const targetPosition = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();
    this.getGalleryViewForProgress(targetProgress, targetPosition, targetLookAt, 0);

    const routeType = distance >= 3 ? 'skip' : 'bridge';
    const midpoint = routeType === 'skip' ? 0.48 : 0.5;
    const midPosition = this.camera.position.clone().lerp(targetPosition, midpoint);
    midPosition.x *= routeType === 'skip' ? 0.16 : 0.35;
    midPosition.y = Math.max(this.camera.position.y, targetPosition.y) + (routeType === 'skip' ? 0.92 : 0.52);

    const midTarget = this.cameraTarget.clone().lerp(targetLookAt, midpoint);
    midTarget.x *= routeType === 'skip' ? 0.22 : 0.45;
    midTarget.y += routeType === 'skip' ? 0.24 : 0.12;

    this.jumpRoute = {
      elapsed: 0,
      duration: THREE.MathUtils.clamp(0.62 + distance * 0.16, 0.82, 1.38),
      startProgress: this.motionProgress,
      targetProgress,
      targetIndex,
      routeType,
      startPosition: this.camera.position.clone(),
      startTarget: this.cameraTarget.clone(),
      midPosition,
      midTarget,
      targetPosition,
      targetLookAt,
    };

    this.scrollToProgress(targetProgress, 'auto');
    this.updateWorkPanel(targetIndex, targetProgress);
  }

  cancelJumpRoute() {
    this.jumpRoute = null;
  }

  onPointerMove(event) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    els.hoverLabel.style.transform = `translate(${event.clientX + 18}px, ${event.clientY + 18}px)`;
  }

  getCoverHit(clientX, clientY) {
    this.clickPointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.clickPointer, this.camera);
    const [hit] = this.raycaster.intersectObjects(this.coverMeshes, false);
    return hit ?? null;
  }

  updateHover() {
    if (this.focusedIndex !== null || this.focusBlend > 0.08) {
      this.clearHover();
      return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const [hit] = this.raycaster.intersectObjects(this.coverMeshes, false);

    if (!hit) {
      this.clearHover();
      return;
    }

    if (this.hovered === hit.object) {
      return;
    }

    this.clearHover();
    this.hovered = hit.object;
    const { work } = hit.object.userData;
    gsap.to(hit.object.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.28, ease: 'power2.out' });
    gsap.to(hit.object.material, { emissiveIntensity: 0.72, duration: 0.28, ease: 'power2.out' });
    els.hoverLabel.textContent = `${work.index} ${work.title}`;
    els.hoverLabel.classList.add('is-visible');
    this.playPulse(260, 0.03);
  }

  clearHover() {
    if (!this.hovered) {
      els.hoverLabel.classList.remove('is-visible');
      return;
    }

    gsap.to(this.hovered.scale, { x: 1, y: 1, z: 1, duration: 0.22, ease: 'power2.out' });
    gsap.to(this.hovered.material, { emissiveIntensity: 0.22, duration: 0.22, ease: 'power2.out' });
    this.hovered = null;
    els.hoverLabel.classList.remove('is-visible');
  }

  updateWorkPanel(index, progress = this.galleryProgress) {
    if (index === this.activeIndex && els.workTitle.textContent !== 'Loading') {
      els.railProgress.style.height = `${progress * 100}%`;
      return;
    }

    const shouldAnimatePanel = els.workTitle.textContent !== 'Loading';
    this.activeIndex = index;
    const work = works[index];
    els.workIndex.textContent = `${work.index} / ${String(works.length).padStart(2, '0')}`;
    els.workTitle.textContent = work.title;
    els.workMeta.textContent = work.meta;
    els.workDescription.textContent = work.description;
    els.workTags.innerHTML = work.tags.map((tag) => `<span>${tag}</span>`).join('');
    els.railProgress.style.height = `${progress * 100}%`;

    document.querySelectorAll('.rail-item').forEach((item, itemIndex) => {
      item.classList.toggle('is-active', itemIndex === index);
    });

    if (shouldAnimatePanel && this.focusedIndex === null) {
      els.workPanel.animate(
        [
          { opacity: 0.72, transform: 'translate3d(0, 8px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
        ],
        {
          duration: 260,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      );
    }
  }

  focusWork(index) {
    this.cancelJumpRoute();
    this.focusedIndex = THREE.MathUtils.clamp(index, 0, works.length - 1);
    this.clearHover();
    this.updateWorkPanel(this.focusedIndex, this.galleryProgress);
    this.scrollToProgress(this.focusedIndex / Math.max(works.length - 1, 1));
    document.body.classList.add('is-focused');
    els.openActiveWork.querySelector('span').textContent = '返回浏览';
    this.playPulse(140, 0.08);
  }

  clearFocus() {
    if (this.focusedIndex === null) {
      return;
    }
    this.focusedIndex = null;
    document.body.classList.remove('is-focused');
    els.openActiveWork.querySelector('span').textContent = '聚焦当前作品';
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    els.soundToggle.innerHTML = this.soundEnabled
      ? '<i data-lucide="volume-2"></i>'
      : '<i data-lucide="volume-x"></i>';
    createIcons({ icons: { Volume2, VolumeX } });

    if (this.soundEnabled && !this.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audio = new AudioContext();
    }
    this.playPulse(180, 0.1);
  }

  playPulse(frequency, volume) {
    if (!this.soundEnabled || !this.audio) {
      return;
    }

    const now = this.audio.currentTime;
    const oscillator = this.audio.createOscillator();
    const gain = this.audio.createGain();
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain);
    gain.connect(this.audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  }

  getGalleryViewForProgress(progress, outPosition, outTarget, pointerInfluence = 1) {
    const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const segment = clampedProgress * (works.length - 1);
    const lowerIndex = Math.floor(segment);
    const upperIndex = Math.min(lowerIndex + 1, works.length - 1);
    const localProgress = THREE.MathUtils.smootherstep(segment - lowerIndex, 0, 1);
    const lowerWork = this.coverMeshes[lowerIndex] ?? this.coverMeshes[0];
    const upperWork = this.coverMeshes[upperIndex] ?? lowerWork;
    const lowerPosition = lowerWork.userData.card.position;
    const upperPosition = upperWork.userData.card.position;
    const focusX = THREE.MathUtils.lerp(lowerPosition.x, upperPosition.x, localProgress);
    const focusZ = THREE.MathUtils.lerp(lowerPosition.z, upperPosition.z, localProgress);
    const corridorSway = Math.sin(clampedProgress * Math.PI * 2) * 0.16;
    const galleryX = focusX * 0.16 + corridorSway;
    const x = galleryX;
    const y = 2.02 + Math.sin(clampedProgress * Math.PI * 2) * 0.12;
    const z = focusZ + 5.65;
    const pointerLift = this.pointer.y * 0.12 * pointerInfluence;

    outPosition.set(x + this.pointer.x * 0.14 * pointerInfluence, y + pointerLift, z);
    outTarget.set(focusX * 0.1, 1.68, focusZ - 0.35);
  }

  updateGalleryView(delta) {
    if (this.jumpRoute) {
      this.updateJumpRoute(delta);
      return;
    }

    this.getGalleryViewForProgress(this.galleryProgress, this.galleryViewPosition, this.galleryViewTarget);
    this.motionProgress = this.galleryProgress;
    this.presentationProgress = this.galleryProgress;
  }

  updateJumpRoute(delta) {
    const route = this.jumpRoute;
    route.elapsed += delta;
    const routeProgress = THREE.MathUtils.clamp(route.elapsed / route.duration, 0, 1);
    const eased = THREE.MathUtils.smootherstep(routeProgress, 0, 1);

    this.routeCurveStart.copy(route.startPosition).lerp(route.midPosition, eased);
    this.routeCurveEnd.copy(route.midPosition).lerp(route.targetPosition, eased);
    this.galleryViewPosition.copy(this.routeCurveStart).lerp(this.routeCurveEnd, eased);

    this.routeCurveStart.copy(route.startTarget).lerp(route.midTarget, eased);
    this.routeCurveEnd.copy(route.midTarget).lerp(route.targetLookAt, eased);
    this.galleryViewTarget.copy(this.routeCurveStart).lerp(this.routeCurveEnd, eased);

    this.motionProgress = THREE.MathUtils.lerp(route.startProgress, route.targetProgress, eased);
    this.presentationProgress = route.targetProgress;

    if (routeProgress >= 1) {
      this.jumpRoute = null;
      this.getGalleryViewForProgress(route.targetProgress, this.galleryViewPosition, this.galleryViewTarget);
      this.motionProgress = route.targetProgress;
      this.presentationProgress = route.targetProgress;
    }
  }

  updateFocusView() {
    const index = this.focusedIndex ?? this.activeIndex;
    const mesh = this.coverMeshes[index] ?? this.coverMeshes[0];
    mesh.updateWorldMatrix(true, false);
    mesh.getWorldPosition(this.focusViewTarget);
    mesh.getWorldQuaternion(this.tmpQuaternion);

    this.tmpNormal.set(0, 0, 1).applyQuaternion(this.tmpQuaternion).normalize();
    const focusFov = this.getFocusFov();
    const distance = this.getFocusDistance(focusFov);
    this.focusViewPosition.copy(this.focusViewTarget).addScaledVector(this.tmpNormal, distance);
    this.focusViewPosition.y += this.camera.aspect < 0.72 ? 0.05 : 0.1;
    return focusFov;
  }

  getFocusFov() {
    return this.camera.aspect < 0.72 ? 64 : 50;
  }

  getFocusDistance(fov) {
    const frameWidth = CARD_WIDTH + CARD_FRAME * 2 + 0.24;
    const frameHeight = CARD_HEIGHT + CARD_FRAME * 2 + 0.2;
    const margin = this.camera.aspect < 0.72 ? 1.08 : 1.06;
    const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(fov) * 0.5);
    const fitHeight = (frameHeight * margin) / (2 * halfFovTangent);
    const fitWidth = (frameWidth * margin) / (2 * halfFovTangent * this.camera.aspect);
    return Math.max(fitHeight, fitWidth, 2.75);
  }

  syncCamera(elapsed, delta) {
    this.galleryGroup.rotation.y = Math.sin(elapsed * 0.12) * 0.018;
    if (this.particles) {
      this.particles.rotation.y = elapsed * 0.025;
      this.particles.position.y = Math.sin(elapsed * 0.55) * 0.045;
    }

    this.updateGalleryView(delta);
    const targetBlend = this.focusedIndex === null ? 0 : 1;
    const blendDamping = 1 - Math.exp(-delta * (targetBlend ? 4.8 : 5.6));
    this.focusBlend += (targetBlend - this.focusBlend) * blendDamping;
    if (Math.abs(this.focusBlend - targetBlend) < 0.001) {
      this.focusBlend = targetBlend;
    }

    const easedFocus = THREE.MathUtils.smootherstep(this.focusBlend, 0, 1);
    this.updateFocusedCardTilt(easedFocus, delta);
    const focusFov = this.updateFocusView();
    this.updateCardPresentation(easedFocus, delta);
    this.desiredCameraPosition.copy(this.galleryViewPosition).lerp(this.focusViewPosition, easedFocus);
    this.desiredCameraTarget.copy(this.galleryViewTarget).lerp(this.focusViewTarget, easedFocus);

    const cameraDamping = 1 - Math.exp(-delta * 7.2);
    this.camera.position.lerp(this.desiredCameraPosition, cameraDamping);
    this.cameraTarget.lerp(this.desiredCameraTarget, cameraDamping);

    const desiredFov = THREE.MathUtils.lerp(46, focusFov, easedFocus);
    if (Math.abs(this.camera.fov - desiredFov) > 0.01) {
      this.camera.fov += (desiredFov - this.camera.fov) * cameraDamping;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.cameraTarget);
  }

  updateCardPresentation(easedFocus, delta) {
    const focusIndex = this.focusedIndex ?? this.activeIndex;
    const segment = this.presentationProgress * (works.length - 1);
    const damping = 1 - Math.exp(-delta * 8.5);

    this.cardGroups.forEach((group, index) => {
      const distanceFromScrollFocus = Math.abs(index - segment);
      const galleryVisibility = 1 - THREE.MathUtils.smootherstep(distanceFromScrollFocus, 0.45, 1.05);
      const galleryOpacity = 0.02 + galleryVisibility * 0.98;
      const focusOpacity = index === focusIndex ? 1 : THREE.MathUtils.lerp(1, 0.02, easedFocus);
      const targetOpacity = THREE.MathUtils.lerp(galleryOpacity, focusOpacity, easedFocus);
      group.userData.materials?.forEach(({ material, baseOpacity }) => {
        material.opacity += (baseOpacity * targetOpacity - material.opacity) * damping;
      });
    });
  }

  updateFocusedCardTilt(easedFocus, delta) {
    const damping = 1 - Math.exp(-delta * 8);
    const maxTiltX = 0.055;
    const maxTiltY = 0.075;

    this.cardGroups.forEach((group, index) => {
      const visual = group.userData.visual;
      if (!visual) {
        return;
      }

      const tiltStrength = index === this.focusedIndex ? easedFocus : 0;
      const targetX = -this.pointer.y * maxTiltX * tiltStrength;
      const targetY = this.pointer.x * maxTiltY * tiltStrength;
      const targetZ = this.pointer.x * 0.012 * tiltStrength;
      const targetOffsetX = this.pointer.x * 0.035 * tiltStrength;
      const targetOffsetY = this.pointer.y * 0.026 * tiltStrength;

      visual.rotation.x += (targetX - visual.rotation.x) * damping;
      visual.rotation.y += (targetY - visual.rotation.y) * damping;
      visual.rotation.z += (targetZ - visual.rotation.z) * damping;
      visual.position.x += (targetOffsetX - visual.position.x) * damping;
      visual.position.y += (targetOffsetY - visual.position.y) * damping;
    });
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  render() {
    this.timer.update();
    const elapsed = this.timer.getElapsed();
    const delta = Math.min(this.timer.getDelta(), 0.05);
    this.syncCamera(elapsed, delta);
    this.updateHover();
    this.composer.render();
    window.requestAnimationFrame(() => this.render());
  }
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = [...text];
  let line = '';
  chars.forEach((char) => {
    const testLine = `${line}${char}`;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
      return;
    }
    line = testLine;
  });
  ctx.fillText(line, x, y);
}

const app = new GalleryExperience();
app.init();

if (import.meta.env.DEV) {
  window.galleryExperience = app;
}
