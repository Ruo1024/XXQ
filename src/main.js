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

// 画册卡片的统一尺寸。所有镜头距离、边框和点击检测都基于这组尺寸计算。
const CARD_WIDTH = 1.9;
const CARD_HEIGHT = 2.72;
const CARD_FRAME = 0.08;
const DEFAULT_CAMERA_FOV = 46;
const MAX_FRAME_DELTA = 0.05;
const DETAIL_ROUTE_PREFIX = '#/works/';

/**
 * 页面展示的数据源。
 * coverImage、posterSrc、videoSrc 预留给后续动漫封面、人物插画和混剪视频素材。
 */
const works = [
  {
    id: 'afterglow',
    index: '01',
    title: '余晖航线',
    meta: 'AMV / Character Cut / 2026',
    category: '热血剪辑',
    duration: '03:42',
    tags: ['AMV', 'Character Cut', 'Warm Light'],
    palette: ['#f25f4c', '#f8d08a', '#2f6f73', '#0b0b0d'],
    accentColor: '#f8d08a',
    transitionMood: 'sharp',
    coverImage: '',
    posterSrc: '',
    videoSrc: '',
    logline: '夕阳、追逐和高燃副歌被剪成一段持续推进的角色开场。',
    shortDescription: '夕阳、追逐和高燃副歌被剪成一段持续推进的角色开场。',
    infoDescription:
      '这一组混剪以角色从静止到爆发的情绪推进为主，封面、视频和关键帧都可以按同一条暖色光线组织。',
    description:
      '暖色光带包裹人物轮廓，封面像一张未放映的番剧海报，等待进入完整混剪。',
    synopsis:
      '以角色奔跑、转身、对峙和爆发镜头串成一条由低到高的情绪线，让第一秒的静默和最后的高光形成对照。',
    mixDirection:
      '节奏上从慢推镜头进入，副歌处使用短促切点和暖色拖影，结尾保留半秒静止，给角色一个海报式落点。',
    credits: [
      ['Mood', 'Hot-blooded / sunset'],
      ['Cut', 'Build-up to chorus'],
      ['Color', 'Amber edge light'],
    ],
    frameNotes: [
      ['00:08', '角色逆光', '用大片暗部让第一束余晖成为视线入口。'],
      ['01:16', '奔跑切点', '步伐、鼓点和镜头横移在同一帧落下。'],
      ['02:54', '高光定格', '最后一击不继续闪切，留给观众确认人物姿态。'],
    ],
  },
  {
    id: 'tide',
    index: '02',
    title: '潮汐信号',
    meta: 'AMV / Emotional Loop / 2026',
    category: '治愈剪辑',
    duration: '02:58',
    tags: ['AMV', 'Soft Cut', 'Blue Tone'],
    palette: ['#58d7c7', '#7db8ff', '#f5f0e8', '#071013'],
    accentColor: '#7db8ff',
    transitionMood: 'soft',
    coverImage: '',
    posterSrc: '',
    videoSrc: '',
    logline: '把日常、海风和眼神停顿剪成一段低频的蓝色回声。',
    shortDescription: '把日常、海风和眼神停顿剪成一段低频的蓝色回声。',
    infoDescription:
      '这一页适合放入日常向或治愈向混剪素材，画面稳定期尽量让角色表情和环境声感成为主角。',
    description:
      '低饱和蓝绿色建立安静气质，人物插画区域预留给后续封面素材。',
    synopsis:
      '混剪重心不在剧情推进，而在相似动作与相似景别之间寻找呼吸，让观众感到时间被海潮轻轻拉长。',
    mixDirection:
      '镜头之间使用柔边溶解和轻微漂浮，音乐弱拍处保留角色眼神，避免过多速度感破坏治愈气质。',
    credits: [
      ['Mood', 'Quiet / ocean'],
      ['Cut', 'Breathing interval'],
      ['Color', 'Cyan and pale cream'],
    ],
    frameNotes: [
      ['00:12', '水面反光', '先给环境，再进入人物，建立低声量开场。'],
      ['01:03', '眼神停顿', '切点刻意慢半拍，让情绪落下。'],
      ['02:21', '蓝色回声', '相似构图重复一次，像副歌后的回潮。'],
    ],
  },
  {
    id: 'ember',
    index: '03',
    title: '暗火档案',
    meta: 'AMV / Dark Action / 2026',
    category: '暗黑剪辑',
    duration: '03:18',
    tags: ['AMV', 'Dark Cut', 'Impact'],
    palette: ['#c2413a', '#f36b36', '#eee7dc', '#120d0b'],
    accentColor: '#f36b36',
    transitionMood: 'grain',
    coverImage: '',
    posterSrc: '',
    videoSrc: '',
    logline: '暗红颗粒和火星残影把对战镜头整理成一份角色档案。',
    shortDescription: '暗红颗粒和火星残影把对战镜头整理成一份角色档案。',
    infoDescription:
      '这一组更适合悬疑、战斗或反派角色混剪，用暗部和瞬间颗粒制造压迫，而不是让特效持续盖住素材。',
    description:
      '暗场和高反差保留角色神秘感，适合后续填入悬疑或战斗向人物封面。',
    synopsis:
      '镜头选择更偏近景、手部、武器和眼睛，让角色不靠对白也能建立危险感。',
    mixDirection:
      '每个重拍只给一个主动作，避免全程闪白；颗粒与红色边缘只在切换瞬间出现，稳定后画面保持清晰。',
    credits: [
      ['Mood', 'Dark / tense'],
      ['Cut', 'Impact accents'],
      ['Color', 'Deep red grain'],
    ],
    frameNotes: [
      ['00:06', '黑场开眼', '开场用最少信息建立压迫感。'],
      ['01:28', '火星残影', '动作之后才出现残影，强调受力而不是装饰。'],
      ['02:45', '沉默收束', '结尾留出呼吸，降低连续冲击后的疲劳。'],
    ],
  },
  {
    id: 'glass',
    index: '04',
    title: '玻璃季风',
    meta: 'AMV / Sci-Fi Slice / 2026',
    category: '科幻剪辑',
    duration: '03:05',
    tags: ['AMV', 'Refraction', 'Clean Cut'],
    palette: ['#9edfc7', '#73a7ef', '#f2dfad', '#0a1018'],
    accentColor: '#73a7ef',
    transitionMood: 'scan',
    coverImage: '',
    posterSrc: '',
    videoSrc: '',
    logline: '用玻璃折射、高光边缘和干净切点组织一段未来感人物混剪。',
    shortDescription: '用玻璃折射、高光边缘和干净切点组织一段未来感人物混剪。',
    infoDescription:
      '这一页适合科幻、机甲、都市夜景等素材，切换时给一点折射和扫描，阅读时保持画面干净。',
    description:
      '封面更像一张冷静的角色视觉板，人物、机械和城市光源都可以自然接入。',
    synopsis:
      '每组镜头都像隔着透明介质观看角色，冷暖高光在人物边缘交错，形成轻科幻的距离感。',
    mixDirection:
      '转场使用细长折射带，切换时短暂拉开画面层次；稳定段落只保留微弱高光，保证人物细节可读。',
    credits: [
      ['Mood', 'Clean / future'],
      ['Cut', 'Side movement'],
      ['Color', 'Blue glass highlight'],
    ],
    frameNotes: [
      ['00:18', '玻璃边缘', '用高光作为人物轮廓的第二条线。'],
      ['01:37', '侧移镜头', '让空间关系连续，避免机械地换镜头。'],
      ['02:50', '冷暖交界', '最后一段用暖色破开冷调，形成情绪转折。'],
    ],
  },
  {
    id: 'signal',
    index: '05',
    title: '频谱广场',
    meta: 'AMV / Rhythm Grid / 2026',
    category: '节奏剪辑',
    duration: '02:36',
    tags: ['AMV', 'Beat Sync', 'Scan Line'],
    palette: ['#e6c84f', '#5fcf7b', '#62bde8', '#10130f'],
    accentColor: '#e6c84f',
    transitionMood: 'scan',
    coverImage: '',
    posterSrc: '',
    videoSrc: '',
    logline: '把舞台、街区和节拍切成一组明亮但克制的频谱格。',
    shortDescription: '把舞台、街区和节拍切成一组明亮但克制的频谱格。',
    infoDescription:
      '这一组以节拍为核心，但详情页不做全程闪烁，只让节点转场服务音乐结构。',
    description:
      '更适合音乐感强的群像混剪，封面以格线和色块暗示节拍结构。',
    synopsis:
      '人物不是单个主角，而是被节拍组织成群像；每个转场都像频谱柱在下一拍重新排列。',
    mixDirection:
      '扫描线只在节奏节点出现，其他时间保留画面干净；用短暂停顿突出副歌前的空拍。',
    credits: [
      ['Mood', 'Rhythmic / bright'],
      ['Cut', 'Beat grid'],
      ['Color', 'Yellow and cyan'],
    ],
    frameNotes: [
      ['00:10', '空拍入场', '先空一拍，再让画面和音乐同时进入。'],
      ['01:02', '群像格线', '用规则布局稳定多角色信息。'],
      ['02:12', '频谱收束', '所有色块回到中心，形成完整段落。'],
    ],
  },
  {
    id: 'orbit',
    index: '06',
    title: '轨道切片',
    meta: 'AMV / Romance Orbit / 2026',
    category: '青春剪辑',
    duration: '03:24',
    tags: ['AMV', 'Soft Orbit', 'Memory'],
    palette: ['#a98de8', '#f08aa0', '#f5efe8', '#10071a'],
    accentColor: '#f08aa0',
    transitionMood: 'soft',
    coverImage: '',
    posterSrc: '',
    videoSrc: '',
    logline: '用环形遮罩和浅色光晕把回忆、告白和擦肩剪成一条轨道。',
    shortDescription: '用环形遮罩和浅色光晕把回忆、告白和擦肩剪成一条轨道。',
    infoDescription:
      '这一页适合青春、恋爱或回忆向混剪，让柔边遮罩和慢速视差建立记忆感。',
    description:
      '人物插画可以放在画面中心，周围用弧形光带表达记忆环绕。',
    synopsis:
      '这条混剪更像回忆片段的排列：相遇、错过、回望和靠近都沿同一条轨道循环出现。',
    mixDirection:
      '使用慢速旋转和柔边遮罩，不追求强冲击；每次副歌前让角色视线对齐，形成情绪确认。',
    credits: [
      ['Mood', 'Romance / memory'],
      ['Cut', 'Circular recall'],
      ['Color', 'Violet and rose'],
    ],
    frameNotes: [
      ['00:14', '擦肩而过', '用相反方向的运动制造错过感。'],
      ['01:44', '弧形回忆', '圆形遮罩让多个时间点像同一段记忆。'],
      ['03:02', '视线对齐', '结尾只保留角色眼神和浅色光晕。'],
    ],
  },
];

const WORK_COUNT = works.length;
const LAST_WORK_INDEX = WORK_COUNT - 1;

// 统一收集 DOM 节点，避免在动画循环里反复 querySelector。
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
  focusEnterHint: document.querySelector('#focusEnterHint'),
  detailPage: document.querySelector('#detailPage'),
  workVisualStage: document.querySelector('#workVisualStage'),
  workMediaCurrent: document.querySelector('#workMediaCurrent'),
  workMediaNext: document.querySelector('#workMediaNext'),
  workVisualMask: document.querySelector('#workVisualMask'),
  detailBack: document.querySelector('#detailBack'),
  detailSound: document.querySelector('#detailSound'),
  workCopy: document.querySelector('#workCopy'),
  detailKicker: document.querySelector('#detailKicker'),
  detailCategory: document.querySelector('#detailCategory'),
  detailTitle: document.querySelector('#detailTitle'),
  detailLogline: document.querySelector('#detailLogline'),
  detailPlay: document.querySelector('#detailPlay'),
  detailInfoToggle: document.querySelector('#detailInfoToggle'),
  detailInfoClose: document.querySelector('#detailInfoClose'),
  detailPlayerClose: document.querySelector('#detailPlayerClose'),
  workInfo: document.querySelector('#workInfo'),
  workPlayer: document.querySelector('#workPlayer'),
  detailInfoIndex: document.querySelector('#detailInfoIndex'),
  detailInfoTitle: document.querySelector('#detailInfoTitle'),
  detailInfoDescription: document.querySelector('#detailInfoDescription'),
  detailFrameStrip: document.querySelector('#detailFrameStrip'),
  detailDirection: document.querySelector('#detailDirection'),
  detailPrev: document.querySelector('#detailPrev'),
  detailPrevTitle: document.querySelector('#detailPrevTitle'),
  detailNext: document.querySelector('#detailNext'),
  detailNextTitle: document.querySelector('#detailNextTitle'),
  detailCount: document.querySelector('#detailCount'),
  detailPlayerStatus: document.querySelector('#detailPlayerStatus'),
};

class GalleryExperience {
  constructor() {
    // Three.js 输入与交互状态。
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.pointer = new THREE.Vector2(10, 10);
    this.clickPointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.coverMeshes = [];

    // 页面状态：activeIndex 代表当前滚动段，focusedIndex 代表正在镜头聚焦的作品。
    this.activeIndex = 0;
    this.focusedIndex = null;
    this.focusBlend = 0;
    this.hovered = null;
    this.scrollProgress = 0;
    this.soundEnabled = false;
    this.audio = null;
    this.isDetailOpen = false;
    this.detailIndex = null;
    this.detailTransitioning = false;
    this.detailTimeline = null;
    this.isPlayerOpen = false;
    this.isInfoOpen = false;

    // 镜头相关的 Vector3 会在每一帧复用，减少动画循环中的临时对象创建。
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
    // lucide 的图标通过 data-lucide 属性声明，初始化时统一替换为 SVG。
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
    this.renderDetail(0);
    this.bindEvents();
    this.setupScroll();
    this.handleRoute();
    this.resize();
    this.render();
  }

  buildScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050506');
    this.scene.fog = new THREE.Fog('#050506', 5, 22);

    // 透视相机负责制造空间纵深。FOV 会在聚焦卡片时动态变窄或变宽。
    this.camera = new THREE.PerspectiveCamera(
      DEFAULT_CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      80,
    );
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

    // EffectComposer 把正常渲染、Bloom 辉光、输出通道串起来。
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.36,
      0.42,
      0.22,
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

    const warm = new THREE.PointLight('#f8d08a', 14, 16);
    warm.position.set(5, 2, -4);
    this.scene.add(warm);

    this.galleryGroup = new THREE.Group();
    this.scene.add(this.galleryGroup);
  }

  buildGallery() {
    this.addArchitecture();
    this.addParticles();

    // 每个作品是一组 3D 对象：外层 card 决定空间位置，内层 visual 用来做鼠标跟随倾斜。
    works.forEach((work, index) => {
      const lane = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const x = lane * 2.04;
      const z = row * -3.15 + 0.55;
      const rotationY = lane === -1 ? Math.PI * 0.1 : -Math.PI * 0.1;
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
      // userData 用来把点击检测得到的 mesh 反查到作品数据和所在 card。
      cover.userData = { work, index, card, visual, baseScale: 1 };
      visual.add(cover);
      this.coverMeshes.push(cover);

      const frameMaterial = new THREE.MeshStandardMaterial({
        color: '#101012',
        roughness: 0.42,
        metalness: 0.24,
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
          opacity: 0.05,
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
    // 地面、墙体和顶灯只负责建立空间参照，不参与交互。
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 26, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#070707',
        roughness: 0.86,
        metalness: 0.12,
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
        opacity: 0.11,
      }),
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(0, 0.012, -4.8);
    this.galleryGroup.add(centerLine);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: '#111114',
      roughness: 0.8,
      metalness: 0.08,
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
    const count = 420;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorA = new THREE.Color('#f8fafc');
    const colorB = new THREE.Color('#f59e0b');
    const colorC = new THREE.Color('#38bdf8');

    // 用 BufferGeometry 一次性提交所有粒子的位置和颜色，性能比创建 900 个 Mesh 更好。
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
      size: 0.018,
      vertexColors: true,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.galleryGroup.add(this.particles);
  }

  createCoverTexture(work) {
    // 未填入真实动漫素材时，用 Canvas 生成一张接近海报/人物插画版式的占位封面。
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1400;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, work.palette[3]);
    gradient.addColorStop(0.48, '#121215');
    gradient.addColorStop(1, work.palette[0]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const accentGradient = ctx.createRadialGradient(650, 420, 40, 650, 420, 640);
    accentGradient.addColorStop(0, `${work.accentColor}cc`);
    accentGradient.addColorStop(0.38, `${work.palette[0]}66`);
    accentGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = accentGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 20; i += 1) {
      ctx.save();
      ctx.globalAlpha = 0.045 + Math.random() * 0.09;
      ctx.strokeStyle = i % 2 ? work.accentColor : '#ffffff';
      ctx.lineWidth = 2 + Math.random() * 7;
      ctx.translate(canvas.width * 0.58, canvas.height * 0.47);
      ctx.rotate((i / 20) * Math.PI * 1.45);
      ctx.beginPath();
      ctx.ellipse(0, 0, 96 + i * 22, 24 + i * 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(590, 664);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.08)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 182, 246, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(248, 250, 252, 0.16)';
    ctx.beginPath();
    ctx.arc(0, -248, 108, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `${work.palette[0]}55`;
    ctx.beginPath();
    ctx.moveTo(-208, 358);
    ctx.quadraticCurveTo(0, 216, 226, 358);
    ctx.lineTo(250, 520);
    ctx.lineTo(-244, 520);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(5, 5, 6, 0.28)';
    ctx.fillRect(68, 74, canvas.width - 136, canvas.height - 148);

    ctx.strokeStyle = 'rgba(248, 245, 235, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(86, 92, canvas.width - 172, canvas.height - 184);
    ctx.strokeStyle = `${work.accentColor}cc`;
    ctx.beginPath();
    ctx.moveTo(86, 1198);
    ctx.lineTo(362, 1198);
    ctx.stroke();

    ctx.fillStyle = 'rgba(248, 245, 235, 0.88)';
    ctx.font = '600 28px Inter, Arial, sans-serif';
    ctx.fillText(`FF-${work.index}`, 116, 150);
    ctx.font = '500 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(work.category, 236, 150);

    ctx.fillStyle = '#fff9ec';
    ctx.font = '700 92px "PingFang SC", "Microsoft YaHei", sans-serif';
    wrapCanvasText(ctx, work.title, 116, 1028, 770, 104);

    ctx.font = '500 27px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255, 249, 236, 0.7)';
    wrapCanvasText(ctx, work.logline, 118, 1188, 764, 42);

    ctx.font = '800 168px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 249, 236, 0.06)';
    ctx.fillText(work.index, 642, 324);

    ctx.font = '600 24px Inter, Arial, sans-serif';
    ctx.fillStyle = `${work.accentColor}dd`;
    ctx.fillText(work.transitionMood.toUpperCase(), 118, 1288);

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
        this.routeToProgress(index / Math.max(LAST_WORK_INDEX, 1));
      });
      els.railItems.appendChild(button);
    });
  }

  bindEvents() {
    // 鼠标位置会同时驱动悬停检测、镜头轻微视差和聚焦卡片的微交互。
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    window.addEventListener('pointerleave', () => this.clearHover());
    window.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    window.addEventListener('touchstart', () => this.cancelJumpRoute(), { passive: true });
    window.addEventListener('click', (event) => {
      if (this.isDetailOpen) {
        return;
      }

      if (event.target.closest('button, a')) {
        return;
      }

      if (this.focusedIndex !== null) {
        const hit = this.getCoverHit(event.clientX, event.clientY);
        if (hit?.object.userData.index === this.focusedIndex && this.focusBlend > 0.72) {
          this.openWorkDetail(this.focusedIndex);
          return;
        }

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
    els.detailSound.addEventListener('click', () => this.toggleSound());
    els.detailPrev.addEventListener('click', () => this.goToAdjacentDetail(-1));
    els.detailNext.addEventListener('click', () => this.goToAdjacentDetail(1));
    els.detailBack.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.hash = '#/';
    });
    els.detailPlay.addEventListener('click', () => this.openPlayer());
    els.detailPlayerClose.addEventListener('click', () => this.closePlayer());
    els.detailInfoToggle.addEventListener('click', () => this.toggleInfo());
    els.detailInfoClose.addEventListener('click', () => this.toggleInfo(false));
    document.querySelector('a[href="#gallery"]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.routeToProgress(0);
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.isDetailOpen) {
          if (this.isPlayerOpen) {
            this.closePlayer();
            return;
          }

          if (this.isInfoOpen) {
            this.toggleInfo(false);
            return;
          }

          window.location.hash = '#/';
          return;
        }
        this.clearFocus();
      }

      if (!this.isDetailOpen) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.goToAdjacentDetail(-1);
      }

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.goToAdjacentDetail(1);
      }
    });

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  onWheel(event) {
    if (!this.isDetailOpen) {
      this.cancelJumpRoute();
      return;
    }

    if (this.isPlayerOpen || this.isInfoOpen) {
      return;
    }

    event.preventDefault();
    if (this.detailTransitioning || Math.abs(event.deltaY) < 18) {
      return;
    }

    this.goToAdjacentDetail(event.deltaY > 0 ? 1 : -1);
  }

  setupScroll() {
    // ScrollTrigger 把页面滚动进度转换为 0 到 1 的 galleryProgress。
    ScrollTrigger.create({
      start: 0,
      end: () => document.documentElement.scrollHeight - window.innerHeight,
      scrub: 1,
      onUpdate: (self) => {
        this.scrollProgress = self.progress;
        this.galleryProgress = THREE.MathUtils.clamp(self.progress, 0, 1);
        const scrollIndex = Math.round(this.galleryProgress * LAST_WORK_INDEX);
        const index = this.focusedIndex ?? scrollIndex;
        this.updateWorkPanel(index, this.galleryProgress);
      },
    });
  }

  handleRoute() {
    const hash = window.location.hash || '#/';

    if (hash.startsWith(DETAIL_ROUTE_PREFIX)) {
      const id = decodeURIComponent(hash.slice(DETAIL_ROUTE_PREFIX.length));
      const index = works.findIndex((work) => work.id === id);
      if (index === -1) {
        window.location.hash = '#/';
        return;
      }
      if (this.isDetailOpen && this.detailIndex === index) {
        return;
      }

      if (this.isDetailOpen) {
        const source = this.detailIndex ?? this.activeIndex;
        const direction = index >= source ? 1 : -1;
        this.transitionWorkDetail(index, direction);
      } else {
        this.showDetail(index);
      }
      return;
    }

    this.hideDetail();
  }

  openWorkDetail(index) {
    const work = works[index];
    if (!work) {
      return;
    }

    this.detailTransitioning = true;
    document.body.classList.add('is-entering-detail');
    this.playPulse(90, 0.12);
    window.setTimeout(() => {
      window.location.hash = `${DETAIL_ROUTE_PREFIX}${encodeURIComponent(work.id)}`;
    }, 180);
  }

  showDetail(index) {
    const targetIndex = THREE.MathUtils.clamp(index, 0, LAST_WORK_INDEX);
    this.detailIndex = targetIndex;
    this.isDetailOpen = true;
    this.detailTransitioning = true;
    this.isPlayerOpen = false;
    this.isInfoOpen = false;
    this.cancelJumpRoute();
    this.clearFocus();
    this.scrollToProgress(targetIndex / Math.max(LAST_WORK_INDEX, 1), 'auto');
    this.renderWorkDetail(targetIndex, els.workMediaCurrent);

    els.detailPage.setAttribute('aria-hidden', 'false');
    els.workInfo.setAttribute('aria-hidden', 'true');
    els.workPlayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-entering-detail');
    document.body.classList.add('is-detail');
    document.body.classList.remove('is-detail-playing', 'is-detail-info');

    this.animateDetailIntro();
  }

  hideDetail() {
    if (!this.isDetailOpen && !document.body.classList.contains('is-detail')) {
      return;
    }

    this.isDetailOpen = false;
    this.detailIndex = null;
    this.detailTransitioning = false;
    this.isPlayerOpen = false;
    this.isInfoOpen = false;
    this.detailTimeline?.kill();
    els.detailPage.setAttribute('aria-hidden', 'true');
    els.workInfo.setAttribute('aria-hidden', 'true');
    els.workPlayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-detail', 'is-entering-detail', 'is-detail-playing', 'is-detail-info');
    els.detailPlay.classList.remove('is-playing');
    els.detailPlay.querySelector('span').textContent = 'PLAY';
    ScrollTrigger.refresh();
  }

  goToAdjacentDetail(direction) {
    if (!this.isDetailOpen || this.detailTransitioning) {
      return;
    }

    const source = this.detailIndex ?? this.activeIndex;
    const nextIndex = (source + direction + WORK_COUNT) % WORK_COUNT;
    const nextWork = works[nextIndex];
    this.playPulse(direction > 0 ? 180 : 130, 0.08);
    window.location.hash = `${DETAIL_ROUTE_PREFIX}${encodeURIComponent(nextWork.id)}`;
  }

  renderDetail(index) {
    this.renderWorkDetail(index, els.workMediaCurrent);
  }

  renderWorkDetail(index, mediaLayer = els.workMediaCurrent) {
    const work = works[index];
    if (!work) {
      return;
    }

    const prevWork = works[(index - 1 + WORK_COUNT) % WORK_COUNT];
    const nextWork = works[(index + 1) % WORK_COUNT];
    els.detailPage.style.setProperty('--detail-accent', work.accentColor);
    els.detailPage.style.setProperty('--detail-accent-soft', `${work.accentColor}33`);
    els.detailPage.style.setProperty('--detail-dark', work.palette[3]);
    els.detailKicker.textContent = `#${work.index.padStart(3, '0')}`;
    els.detailCategory.textContent = `${work.meta} / ${work.duration}`;
    els.detailTitle.textContent = work.title;
    els.detailLogline.textContent = work.shortDescription || work.logline;
    els.detailInfoIndex.textContent = `#${work.index.padStart(3, '0')} / INFO`;
    els.detailInfoTitle.textContent = `${work.title} / Mix Notes`;
    els.detailInfoDescription.textContent = work.infoDescription || work.synopsis;
    els.detailDirection.textContent = work.mixDirection;
    els.detailCount.textContent = `${work.index.padStart(3, '0')} / ${String(WORK_COUNT).padStart(3, '0')}`;
    els.detailPrevTitle.textContent = prevWork.title;
    els.detailNextTitle.textContent = nextWork.title;
    els.detailPlayerStatus.textContent = `${work.title} / preview`;

    this.renderMediaLayer(mediaLayer, work);
    els.detailPage.dataset.mood = work.transitionMood;

    els.detailFrameStrip.innerHTML = work.frameNotes
      .map(
        ([time, label, note]) => `
          <article class="work-frame-note">
            <p>${time}</p>
            <h4>${label}</h4>
            <span>${note}</span>
          </article>
        `,
      )
      .join('');
  }

  renderMediaLayer(layer, work) {
    layer.innerHTML = '';
    layer.style.setProperty('--poster-a', work.palette[0]);
    layer.style.setProperty('--poster-b', work.palette[1]);
    layer.style.setProperty('--poster-c', work.palette[2]);
    layer.style.setProperty('--poster-d', work.palette[3]);
    layer.style.setProperty('--detail-accent', work.accentColor);
    layer.dataset.mood = work.transitionMood;

    if (work.videoSrc) {
      const video = document.createElement('video');
      video.className = 'work-media';
      video.src = work.videoSrc;
      video.poster = work.posterSrc || work.coverImage;
      video.muted = !this.soundEnabled;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      layer.appendChild(video);
      video.play?.().catch(() => {});
      return;
    }

    if (work.posterSrc || work.coverImage) {
      const image = document.createElement('img');
      image.className = 'work-media';
      image.src = work.posterSrc || work.coverImage;
      image.alt = `${work.title} cover`;
      layer.appendChild(image);
      return;
    }

    const fallback = document.createElement('div');
    fallback.className = 'work-media-fallback';
    fallback.innerHTML = `
      <span>${work.index}</span>
      <strong>${work.title}</strong>
      <small>${work.meta}</small>
    `;
    layer.appendChild(fallback);
  }

  animateDetailIntro() {
    this.detailTimeline?.kill();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 0.01 : 1.05;

    this.detailTimeline = gsap.timeline({
      defaults: {
        ease: 'power3.inOut',
      },
      onComplete: () => {
        this.detailTransitioning = false;
      },
    });

    this.detailTimeline.fromTo(
      els.workMediaCurrent,
      { autoAlpha: 0, scale: 1.08, filter: 'blur(12px)' },
      { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration },
    );
    this.detailTimeline.fromTo(
      els.workCopy.children,
      { autoAlpha: 0, y: 26 },
      { autoAlpha: 1, y: 0, duration: 0.58, stagger: 0.08, ease: 'power3.out' },
      '-=0.45',
    );
    this.detailTimeline.fromTo(
      els.detailPage.querySelectorAll('.work-hud, .work-navi'),
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.36, stagger: 0.05 },
      '-=0.36',
    );
  }

  transitionWorkDetail(nextIndex, direction = 1) {
    if (!this.isDetailOpen || this.detailTransitioning) {
      return;
    }

    const targetIndex = THREE.MathUtils.clamp(nextIndex, 0, LAST_WORK_INDEX);
    if (targetIndex === this.detailIndex) {
      return;
    }

    this.detailTransitioning = true;
    this.closePlayer();
    this.toggleInfo(false);
    this.detailTimeline?.kill();
    this.renderWorkDetail(targetIndex, els.workMediaNext);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 0.01 : 0.9;
    const xOffset = direction > 0 ? 46 : -46;

    gsap.set(els.workMediaNext, { autoAlpha: 1, scale: 1.045, x: xOffset, filter: 'blur(6px)' });
    gsap.set(els.workVisualMask, { autoAlpha: 0.62, xPercent: direction > 0 ? -115 : 115 });

    this.detailTimeline = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => {
        const oldCurrent = els.workMediaCurrent;
        const oldNext = els.workMediaNext;
        oldCurrent.innerHTML = oldNext.innerHTML;
        oldCurrent.style.cssText = oldNext.style.cssText;
        oldCurrent.dataset.mood = oldNext.dataset.mood;
        oldCurrent.classList.add('is-active');
        oldNext.innerHTML = '';
        oldNext.removeAttribute('style');
        oldNext.classList.remove('is-active');
        gsap.set(oldCurrent, { clearProps: 'opacity,visibility,transform,filter' });
        gsap.set(oldNext, { clearProps: 'opacity,visibility,transform,filter' });
        gsap.set(els.workVisualMask, { clearProps: 'opacity,visibility,transform' });
        this.detailIndex = targetIndex;
        this.detailTransitioning = false;
      },
    });

    this.detailTimeline
      .to(els.workMediaCurrent, { autoAlpha: 0, scale: 0.985, x: -xOffset * 0.45, duration }, 0)
      .to(els.workMediaNext, { scale: 1, x: 0, filter: 'blur(0px)', duration }, 0)
      .to(els.workVisualMask, { xPercent: direction > 0 ? 115 : -115, duration: duration * 0.82 }, 0.04)
      .fromTo(
        els.workCopy.children,
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.055, ease: 'power3.out' },
        duration * 0.42,
      );
  }

  openPlayer() {
    if (!this.isDetailOpen || this.detailTransitioning) {
      return;
    }

    this.isPlayerOpen = true;
    this.toggleInfo(false);
    els.workPlayer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-detail-playing');
    els.detailPlay.classList.add('is-playing');
    els.detailPlay.querySelector('span').textContent = 'PLAYING';
    this.syncDetailMediaSound();
    this.playPulse(220, 0.09);
  }

  closePlayer() {
    if (!this.isPlayerOpen && !document.body.classList.contains('is-detail-playing')) {
      return;
    }

    this.isPlayerOpen = false;
    els.workPlayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-detail-playing');
    els.detailPlay.classList.remove('is-playing');
    els.detailPlay.querySelector('span').textContent = 'PLAY';
  }

  toggleInfo(force) {
    if (!this.isDetailOpen) {
      return;
    }

    const nextState = typeof force === 'boolean' ? force : !this.isInfoOpen;
    this.isInfoOpen = nextState;
    if (nextState) {
      this.closePlayer();
    }
    els.workInfo.setAttribute('aria-hidden', nextState ? 'false' : 'true');
    document.body.classList.toggle('is-detail-info', nextState);
  }

  syncDetailMediaSound() {
    els.detailPage.querySelectorAll('video').forEach((video) => {
      video.muted = !this.soundEnabled;
    });
  }

  routeToProgress(progress) {
    const targetProgress = THREE.MathUtils.clamp(progress, 0, 1);
    const targetIndex = Math.round(targetProgress * LAST_WORK_INDEX);
    const sourceIndex = this.focusedIndex ?? Math.round(this.motionProgress * LAST_WORK_INDEX);
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

    // 相邻卡片用滚动惯性即可；跨越较多作品时使用贝塞尔式中间点，避免镜头沿长廊硬拖过去。
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
    // Raycaster 会从屏幕点击位置发出一条射线，命中哪个 cover mesh 就打开哪个作品。
    this.clickPointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.clickPointer, this.camera);
    const [hit] = this.raycaster.intersectObjects(this.coverMeshes, false);
    return hit ?? null;
  }

  updateHover() {
    if (this.isDetailOpen) {
      this.clearHover();
      return;
    }

    // 聚焦动画期间不做悬停放大，避免两个动画同时抢同一个卡片缩放。
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

    // 右侧信息面板和右侧轨道共用 activeIndex，保证文字、进度和 3D 镜头状态一致。
    const shouldAnimatePanel = els.workTitle.textContent !== 'Loading';
    this.activeIndex = index;
    const work = works[index];
    els.workIndex.textContent = `${work.index} / ${String(WORK_COUNT).padStart(2, '0')}`;
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
    this.focusedIndex = THREE.MathUtils.clamp(index, 0, LAST_WORK_INDEX);
    this.clearHover();
    this.updateWorkPanel(this.focusedIndex, this.galleryProgress);
    this.scrollToProgress(this.focusedIndex / Math.max(LAST_WORK_INDEX, 1));
    document.body.classList.add('is-focused');
    els.focusEnterHint.classList.add('is-visible');
    els.openActiveWork.querySelector('span').textContent = '返回浏览';
    this.playPulse(140, 0.08);
  }

  clearFocus() {
    if (this.focusedIndex === null) {
      return;
    }
    this.focusedIndex = null;
    document.body.classList.remove('is-focused');
    els.focusEnterHint.classList.remove('is-visible');
    els.openActiveWork.querySelector('span').textContent = '聚焦当前封面';
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    els.soundToggle.innerHTML = this.soundEnabled
      ? '<i data-lucide="volume-2"></i>'
      : '<i data-lucide="volume-x"></i>';
    createIcons({ icons: { Volume2, VolumeX } });
    els.detailSound.textContent = this.soundEnabled ? 'Sound on' : 'Sound off';
    this.syncDetailMediaSound();

    if (this.soundEnabled && !this.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audio = new AudioContext();
    }
    this.playPulse(180, 0.1);
  }

  playPulse(frequency, volume) {
    // 交互音效非常短，只作为点击/悬停反馈；未开启声音时不会创建音频节点。
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
    const segment = clampedProgress * LAST_WORK_INDEX;
    const lowerIndex = Math.floor(segment);
    const upperIndex = Math.min(lowerIndex + 1, LAST_WORK_INDEX);
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

    // 镜头位置和看向点分开计算：位置决定站在哪里，看向点决定看哪里。
    outPosition.set(x + this.pointer.x * 0.14 * pointerInfluence, y + pointerLift, z);
    outTarget.set(focusX * 0.1, 1.68, focusZ - 0.35);
  }

  updateGalleryView(delta) {
    if (this.jumpRoute) {
      this.updateJumpRoute(delta);
      return;
    }

    // 没有跳转路线时，普通镜头完全跟随页面滚动进度。
    this.getGalleryViewForProgress(this.galleryProgress, this.galleryViewPosition, this.galleryViewTarget);
    this.motionProgress = this.galleryProgress;
    this.presentationProgress = this.galleryProgress;
  }

  updateJumpRoute(delta) {
    const route = this.jumpRoute;
    route.elapsed += delta;
    const routeProgress = THREE.MathUtils.clamp(route.elapsed / route.duration, 0, 1);
    const eased = THREE.MathUtils.smootherstep(routeProgress, 0, 1);

    // 两段 lerp 组合成二次贝塞尔效果：start -> mid -> target。
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

    // 卡片法线代表它“正面朝向”的方向，镜头沿法线前进即可站到卡片正前方。
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
    // 根据 FOV 和屏幕宽高比反推安全距离，保证聚焦后的卡片完整进入画面。
    const frameWidth = CARD_WIDTH + CARD_FRAME * 2 + 0.24;
    const frameHeight = CARD_HEIGHT + CARD_FRAME * 2 + 0.2;
    const margin = this.camera.aspect < 0.72 ? 1.08 : 1.06;
    const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(fov) * 0.5);
    const fitHeight = (frameHeight * margin) / (2 * halfFovTangent);
    const fitWidth = (frameWidth * margin) / (2 * halfFovTangent * this.camera.aspect);
    return Math.max(fitHeight, fitWidth, 2.75);
  }

  syncCamera(elapsed, delta) {
    // 轻微摆动让场景保持“活着”的感觉，但幅度很小，避免影响阅读。
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

    // galleryView 是普通浏览镜头，focusView 是卡片正前方镜头，focusBlend 决定两者混合比例。
    this.desiredCameraPosition.copy(this.galleryViewPosition).lerp(this.focusViewPosition, easedFocus);
    this.desiredCameraTarget.copy(this.galleryViewTarget).lerp(this.focusViewTarget, easedFocus);

    // 指数阻尼让不同帧率下的镜头速度更稳定，避免直接 setPosition 造成卡顿感。
    const cameraDamping = 1 - Math.exp(-delta * 7.2);
    this.camera.position.lerp(this.desiredCameraPosition, cameraDamping);
    this.cameraTarget.lerp(this.desiredCameraTarget, cameraDamping);

    const desiredFov = THREE.MathUtils.lerp(DEFAULT_CAMERA_FOV, focusFov, easedFocus);
    if (Math.abs(this.camera.fov - desiredFov) > 0.01) {
      this.camera.fov += (desiredFov - this.camera.fov) * cameraDamping;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.cameraTarget);
  }

  updateCardPresentation(easedFocus, delta) {
    const focusIndex = this.focusedIndex ?? this.activeIndex;
    const segment = this.presentationProgress * LAST_WORK_INDEX;
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
      // 聚焦卡片根据鼠标方向做少量旋转和平移，形成“跟手”的近景反馈。
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
    const delta = Math.min(this.timer.getDelta(), MAX_FRAME_DELTA);
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
