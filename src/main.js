import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowLeft,
  ArrowRight,
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
  creditsPanel: document.querySelector('#credits'),
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
  albumView: document.querySelector('#albumView'),
  closeAlbum: document.querySelector('#closeAlbum'),
  prevImage: document.querySelector('#prevImage'),
  nextImage: document.querySelector('#nextImage'),
  albumImage: document.querySelector('#albumImage'),
  albumCount: document.querySelector('#albumCount'),
  albumIndex: document.querySelector('#albumIndex'),
  albumTitle: document.querySelector('#albumTitle'),
  albumDescription: document.querySelector('#albumDescription'),
  albumSpecs: document.querySelector('#albumSpecs'),
};

class GalleryExperience {
  constructor() {
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.pointer = new THREE.Vector2(10, 10);
    this.raycaster = new THREE.Raycaster();
    this.coverMeshes = [];
    this.activeIndex = 0;
    this.albumImageIndex = 0;
    this.hovered = null;
    this.scrollProgress = 0;
    this.soundEnabled = false;
    this.audio = null;
    this.albumAssets = new Map();
    this.cameraTarget = new THREE.Vector3(0, 1.7, 0);
    this.galleryProgress = 0;
    this.finalProgress = 0;
    this.cardGroups = [];
    this.cardMaterials = [];
  }

  init() {
    createIcons({
      icons: {
        ArrowLeft,
        ArrowRight,
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
      this.cardMaterials.push({ material: coverMaterial, baseOpacity: 1 });
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT), coverMaterial);
      cover.position.z = 0.04;
      cover.userData = { work, index, baseScale: 1 };
      card.add(cover);
      this.coverMeshes.push(cover);

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: '#19191d',
        roughness: 0.24,
        metalness: 0.54,
        transparent: true,
      });
      this.cardMaterials.push({ material: frameMaterial, baseOpacity: 1 });
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
        card.add(framePart);
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
      this.cardMaterials.push({ material: glow.material, baseOpacity: 0.08 });
      glow.position.z = -0.07;
      card.add(glow);
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
        this.scrollToProgress((index / Math.max(works.length - 1, 1)) * 0.88);
      });
      els.railItems.appendChild(button);
    });
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    window.addEventListener('pointerleave', () => this.clearHover());
    window.addEventListener('click', () => {
      if (this.hovered && !document.body.classList.contains('album-open')) {
        this.openAlbum(this.hovered.userData.index);
      }
    });

    els.openActiveWork.addEventListener('click', () => this.openAlbum(this.activeIndex));
    els.closeAlbum.addEventListener('click', () => this.closeAlbum());
    els.prevImage.addEventListener('click', () => this.shiftAlbumImage(-1));
    els.nextImage.addEventListener('click', () => this.shiftAlbumImage(1));
    els.soundToggle.addEventListener('click', () => this.toggleSound());
    document.querySelector('a[href="#credits"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.scrollToProgress(1);
    });
    document.querySelector('a[href="#gallery"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.scrollToProgress(0);
    });
    document.querySelector('a[href="#collection"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.scrollToProgress(0.5);
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeAlbum();
      }
      if (document.body.classList.contains('album-open') && event.key === 'ArrowRight') {
        this.shiftAlbumImage(1);
      }
      if (document.body.classList.contains('album-open') && event.key === 'ArrowLeft') {
        this.shiftAlbumImage(-1);
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
        this.galleryProgress = THREE.MathUtils.clamp(self.progress / 0.88, 0, 1);
        this.finalProgress = THREE.MathUtils.smoothstep(self.progress, 0.86, 0.98);
        const index = Math.round(this.galleryProgress * (works.length - 1));
        this.updateWorkPanel(index, this.galleryProgress);
        this.updateFinalStage();
      },
    });
  }

  scrollToProgress(progress) {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({
      top: maxScroll * THREE.MathUtils.clamp(progress, 0, 1),
      behavior: 'smooth',
    });
  }

  onPointerMove(event) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    els.hoverLabel.style.transform = `translate(${event.clientX + 18}px, ${event.clientY + 18}px)`;
  }

  updateHover() {
    if (document.body.classList.contains('album-open') || this.finalProgress > 0.4) {
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

    if (shouldAnimatePanel && !document.body.classList.contains('is-final-stage')) {
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

  updateFinalStage() {
    const finalVisible = this.finalProgress > 0.55;
    const cardFade = 1 - THREE.MathUtils.smootherstep(this.finalProgress, 0.28, 0.78);
    document.body.classList.toggle('is-final-stage', finalVisible);
    els.creditsPanel.style.opacity = this.finalProgress.toFixed(3);
    els.creditsPanel.style.transform = `translate3d(0, ${(1 - this.finalProgress) * 18}px, 0)`;
    els.creditsPanel.style.pointerEvents = finalVisible ? 'auto' : 'none';
    this.cardMaterials.forEach(({ material, baseOpacity }) => {
      material.opacity = baseOpacity * cardFade;
    });
    this.cardGroups.forEach((group) => {
      group.visible = cardFade > 0.02;
    });
  }

  openAlbum(index) {
    this.activeIndex = index;
    this.albumImageIndex = 0;
    const work = works[index];
    this.ensureAlbumAssets(work);
    this.applyAlbumContent(work);
    document.body.classList.add('album-open');
    els.albumView.setAttribute('aria-hidden', 'false');
    this.playPulse(140, 0.08);
  }

  closeAlbum() {
    if (!document.body.classList.contains('album-open')) {
      return;
    }
    document.body.classList.remove('album-open');
    els.albumView.setAttribute('aria-hidden', 'true');
  }

  shiftAlbumImage(direction) {
    const work = works[this.activeIndex];
    this.ensureAlbumAssets(work);
    const assets = this.albumAssets.get(work.id);
    this.albumImageIndex = (this.albumImageIndex + direction + assets.length) % assets.length;
    els.albumImage.classList.remove('is-ready');
    window.setTimeout(() => this.applyAlbumImage(work), 90);
    this.playPulse(direction > 0 ? 420 : 320, 0.05);
  }

  applyAlbumContent(work) {
    els.albumIndex.textContent = work.index;
    els.albumTitle.textContent = work.title;
    els.albumDescription.textContent = work.description;
    els.albumSpecs.innerHTML = work.specs.map((spec) => `<span>${spec}</span>`).join('');
    this.applyAlbumImage(work);
  }

  applyAlbumImage(work) {
    const assets = this.albumAssets.get(work.id);
    const image = assets[this.albumImageIndex];
    els.albumImage.src = image.url;
    els.albumImage.alt = `${work.title} 画册图 ${this.albumImageIndex + 1}`;
    els.albumCount.textContent = `${String(this.albumImageIndex + 1).padStart(2, '0')} / ${String(assets.length).padStart(2, '0')}`;
    window.requestAnimationFrame(() => els.albumImage.classList.add('is-ready'));
  }

  ensureAlbumAssets(work) {
    if (this.albumAssets.has(work.id)) {
      return;
    }
    const assets = [0, 1, 2].map((frame) => ({
      url: createAlbumImage(work, frame),
    }));
    this.albumAssets.set(work.id, assets);
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

  syncCamera(elapsed, delta) {
    const segment = this.galleryProgress * (works.length - 1);
    const lowerIndex = Math.floor(segment);
    const upperIndex = Math.min(lowerIndex + 1, works.length - 1);
    const localProgress = THREE.MathUtils.smootherstep(segment - lowerIndex, 0, 1);
    const lowerWork = this.coverMeshes[lowerIndex] ?? this.coverMeshes[0];
    const upperWork = this.coverMeshes[upperIndex] ?? lowerWork;
    const lowerPosition = lowerWork.parent.position;
    const upperPosition = upperWork.parent.position;
    const focusX = THREE.MathUtils.lerp(lowerPosition.x, upperPosition.x, localProgress);
    const focusZ = THREE.MathUtils.lerp(lowerPosition.z, upperPosition.z, localProgress);
    const finalEase = THREE.MathUtils.smootherstep(this.finalProgress, 0, 1);
    const finalPullback = finalEase * 2.2;
    const corridorSway = Math.sin(this.galleryProgress * Math.PI * 2) * 0.16;
    const galleryX = focusX * 0.16 + corridorSway;
    const x = THREE.MathUtils.lerp(galleryX, 0, finalEase);
    const y = 2.02 + Math.sin(this.galleryProgress * Math.PI * 2) * 0.12 + finalEase * 0.42;
    const z = focusZ + 5.65 + finalPullback;
    const pointerLift = this.pointer.y * 0.12;
    const damping = 1 - Math.exp(-delta * 7.2);

    this.camera.position.x += (x + this.pointer.x * 0.14 - this.camera.position.x) * damping;
    this.camera.position.y += (y + pointerLift - this.camera.position.y) * damping;
    this.camera.position.z += (z - this.camera.position.z) * damping;

    const desiredLookAt = new THREE.Vector3(
      THREE.MathUtils.lerp(focusX * 0.1, 0, finalEase),
      1.68 + finalEase * 0.12,
      focusZ - 0.35,
    );
    this.cameraTarget.lerp(desiredLookAt, damping);
    this.camera.lookAt(this.cameraTarget);

    this.galleryGroup.rotation.y = Math.sin(elapsed * 0.12) * 0.018;
    if (this.particles) {
      this.particles.rotation.y = elapsed * 0.025;
      this.particles.position.y = Math.sin(elapsed * 0.55) * 0.045;
    }
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

function createAlbumImage(work, frame) {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, work.palette[(frame + 0) % work.palette.length]);
  gradient.addColorStop(0.55, work.palette[3]);
  gradient.addColorStop(1, work.palette[(frame + 1) % work.palette.length]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 42; i += 1) {
    const size = 80 + i * 18;
    ctx.globalAlpha = 0.035 + (i % 6) * 0.011;
    ctx.strokeStyle = i % 2 ? work.palette[1] : work.palette[2];
    ctx.lineWidth = 5 + (i % 5) * 3;
    ctx.beginPath();
    ctx.ellipse(
      canvas.width * (0.28 + frame * 0.18),
      canvas.height * 0.52,
      size * 1.6,
      size * 0.55,
      (i + frame) * 0.16,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
  ctx.fillRect(70, 70, canvas.width - 140, canvas.height - 140);

  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 132px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText(work.title, 124, 270);

  ctx.font = '500 34px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.fillText(`${work.meta}  /  Frame ${String(frame + 1).padStart(2, '0')}`, 132, 342);

  ctx.font = '900 260px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.075)';
  ctx.fillText(`${work.index}.${frame + 1}`, 112, 845);

  ctx.fillStyle = work.palette[1];
  ctx.fillRect(132, 760, 410, 12);
  ctx.fillStyle = work.palette[2];
  ctx.fillRect(132, 800, 260, 12);

  return canvas.toDataURL('image/jpeg', 0.88);
}

const app = new GalleryExperience();
app.init();

if (import.meta.env.DEV) {
  window.galleryExperience = app;
}
