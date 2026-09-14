import * as THREE from 'three';
import gsap from 'gsap';
import { ArrowLeft, ArrowRight, createIcons, Diamond, Play } from 'lucide';
import './home.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const wrapIndex = (value, length) => {
  if (!length) return 0;
  return ((value % length) + length) % length;
};

const escapeText = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const getRelativeIndex = (index, activeIndex, length) => {
  let distance = index - activeIndex;
  if (distance > length / 2) distance -= length;
  if (distance < -length / 2) distance += length;
  return distance;
};

const getAssetLabel = (work) => {
  if (work.posterStatus === 'final') return '';
  if (work.posterStatus === 'missing' || !work.poster) return 'MISSING MEDIA';
  return 'PLACEHOLDER MEDIA';
};

const parseFocalPoint = (value = '50% 50%') => {
  const [rawX = '50%', rawY = '50%'] = String(value).trim().split(/\s+/);
  return {
    x: clamp(Number.parseFloat(rawX) / 100 || 0.5, 0, 1),
    y: clamp(Number.parseFloat(rawY) / 100 || 0.5, 0, 1),
  };
};

const applyTextureCover = (texture, targetAspect, focalPoint) => {
  const image = texture.image;
  if (!image?.width || !image?.height) return;
  const imageAspect = image.width / image.height;
  const focal = parseFocalPoint(focalPoint);
  let repeatX = 1;
  let repeatY = 1;

  if (imageAspect > targetAspect) repeatX = targetAspect / imageAspect;
  else repeatY = imageAspect / targetAspect;

  texture.repeat.set(repeatX, repeatY);
  texture.offset.set((1 - repeatX) * focal.x, (1 - repeatY) * (1 - focal.y));
  texture.needsUpdate = true;
};

const getPosterWorldTarget = (relativeIndex) => {
  const targets = {
    '-3': { x: -9.8, y: -0.25, z: -12.5, scale: 0.34, rotationY: 0.2, opacity: 0.055 },
    '-2': { x: -6.2, y: -0.22, z: -9.3, scale: 0.44, rotationY: 0.16, opacity: 0.1 },
    '-1': { x: -2.35, y: -0.08, z: -5.2, scale: 0.61, rotationY: 0.11, opacity: 0.24 },
    0: { x: 1.82, y: 0.95, z: -2.15, scale: 1.05, rotationY: -0.045, opacity: 1 },
    1: { x: 6.55, y: -0.06, z: -5.55, scale: 0.61, rotationY: -0.12, opacity: 0.24 },
    2: { x: 10.2, y: -0.2, z: -9.6, scale: 0.43, rotationY: -0.17, opacity: 0.1 },
    3: { x: 13.2, y: -0.3, z: -12.8, scale: 0.34, rotationY: -0.21, opacity: 0.055 },
  };
  return targets[String(clamp(relativeIndex, -3, 3))];
};

const NETWORK_SHAPES = ['cloud', 'arc', 'helix', 'wing', 'ring'];
const DEFAULT_NETWORK_SHAPES = Object.freeze({
  afterglow: 0,
  tide: 1,
  ember: 2,
  glass: 3,
  signal: 4,
});

const hashText = (value = '') => {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const solveMinimumAssignment = (costs) => {
  const size = costs.length;
  const rowPotential = new Array(size + 1).fill(0);
  const columnPotential = new Array(size + 1).fill(0);
  const matchedRow = new Array(size + 1).fill(0);
  const previousColumn = new Array(size + 1).fill(0);

  for (let row = 1; row <= size; row += 1) {
    matchedRow[0] = row;
    let column = 0;
    const minimum = new Array(size + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array(size + 1).fill(false);
    do {
      used[column] = true;
      const activeRow = matchedRow[column];
      let delta = Number.POSITIVE_INFINITY;
      let nextColumn = 0;
      for (let candidate = 1; candidate <= size; candidate += 1) {
        if (used[candidate]) continue;
        const reducedCost = costs[activeRow - 1][candidate - 1]
          - rowPotential[activeRow]
          - columnPotential[candidate];
        if (reducedCost < minimum[candidate]) {
          minimum[candidate] = reducedCost;
          previousColumn[candidate] = column;
        }
        if (minimum[candidate] < delta) {
          delta = minimum[candidate];
          nextColumn = candidate;
        }
      }
      for (let candidate = 0; candidate <= size; candidate += 1) {
        if (used[candidate]) {
          rowPotential[matchedRow[candidate]] += delta;
          columnPotential[candidate] -= delta;
        } else {
          minimum[candidate] -= delta;
        }
      }
      column = nextColumn;
    } while (matchedRow[column] !== 0);

    do {
      const nextColumn = previousColumn[column];
      matchedRow[column] = matchedRow[nextColumn];
      column = nextColumn;
    } while (column !== 0);
  }

  const assignment = new Array(size).fill(0);
  for (let column = 1; column <= size; column += 1) {
    assignment[matchedRow[column] - 1] = column - 1;
  }
  return assignment;
};

const assignTopologyByShortestTravel = (nodes, topology) => {
  const costs = nodes.map((node, nodeIndex) => topology.points.map((point, pointIndex) => (
    node.base.distanceToSquared(point) + nodeIndex * 1e-7 + pointIndex * 1e-9
  )));
  const assignment = solveMinimumAssignment(costs);
  const targetToNode = new Array(assignment.length);
  assignment.forEach((targetIndex, nodeIndex) => { targetToNode[targetIndex] = nodeIndex; });
  return {
    assignment,
    targetToNode,
    edges: topology.edges.map(([start, end]) => [targetToNode[start], targetToNode[end]]),
  };
};

const createNetworkTopology = (work, workIndex = 0, motion = {}) => {
  const seed = hashText(work?.id || `work-${workIndex}`);
  const mappedShape = DEFAULT_NETWORK_SHAPES[String(work?.id || '')];
  const shapeIndex = Number.isInteger(mappedShape) ? mappedShape : seed % NETWORK_SHAPES.length;
  const shape = NETWORK_SHAPES[shapeIndex];
  const depthStrength = clamp(numberOr(motion.networkMorphDepth, 2.1) / 2.1, 0, 2.15);
  const foregroundDepth = clamp(numberOr(motion.networkForegroundDepth, 2.4), 0, 5);
  const tilt = THREE.MathUtils.degToRad(clamp(numberOr(motion.networkMorphRotation, 16), 0, 38) * 0.42);
  const points = Array.from({ length: 12 }, (_, index) => {
    const t = index / 11;
    const angle = t * Math.PI * 2;
    const jitter = (((seed >>> (index % 16)) & 7) - 3) * 0.035;
    if (shape === 'arc') {
      const arc = -0.72 * Math.PI + t * 1.42 * Math.PI;
      return new THREE.Vector3(-3.35 + Math.cos(arc) * 3.85, 0.15 + Math.sin(arc) * 3.1, -6.4 + Math.sin(arc * 1.4) * 2.4 + jitter);
    }
    if (shape === 'helix') {
      const helix = t * Math.PI * 3.3;
      const radius = 2.15 + Math.sin(t * Math.PI) * 1.05;
      return new THREE.Vector3(-3.25 + Math.cos(helix) * radius, -2.8 + t * 5.8, -6.2 + Math.sin(helix) * 3.1 + jitter);
    }
    if (shape === 'wing') {
      const wing = -0.94 + t * 1.88;
      const radius = 3.15 + (index % 4) * 0.66;
      return new THREE.Vector3(
        -1.05 - Math.cos(wing) * radius,
        -0.05 + Math.sin(wing) * radius * 1.16,
        -6.1 + Math.sin(wing * 1.7) * 2.75 + jitter,
      );
    }
    if (shape === 'ring') {
      return new THREE.Vector3(-3.15 + Math.cos(angle) * 3.7, 0.2 + Math.sin(angle) * 2.9, -6.2 + Math.sin(angle + 0.65) * 3.15 + jitter);
    }
    const column = index % 4;
    const row = Math.floor(index / 4);
    return new THREE.Vector3(
      -6.65 + column * 2.05 + Math.sin(index * 1.7 + seed) * 0.22,
      -2.05 + row * 2.15 + Math.cos(index * 1.3) * 0.32,
      -8.2 + ((index * 5 + seed) % 7) * 0.78 + jitter,
    );
  });
  points.forEach((point, index) => {
    point.z = -6.2 + (point.z + 6.2) * depthStrength;
    if (index % 5 === 0) point.z += foregroundDepth * 0.52;
    const relativeX = point.x + 3.2;
    const relativeZ = point.z + 6.2;
    point.x = -3.2 + relativeX * Math.cos(tilt) + relativeZ * Math.sin(tilt);
    point.z = -6.2 - relativeX * Math.sin(tilt) + relativeZ * Math.cos(tilt);
    point.x = Math.min(point.x, 0.35);
  });
  const edgeSets = [
    [[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [4, 8], [5, 9], [6, 10], [7, 11], [8, 9], [9, 10], [10, 11], [1, 6]],
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [0, 3], [2, 5], [4, 7], [6, 9], [8, 11], [1, 6], [5, 10]],
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [0, 4], [1, 5], [2, 7], [3, 8], [4, 9], [5, 10], [6, 11]],
    [[0, 4], [0, 5], [0, 6], [1, 5], [1, 6], [1, 7], [2, 6], [2, 7], [2, 8], [3, 7], [3, 8], [3, 9], [4, 8], [5, 9], [6, 10], [7, 11], [8, 11], [9, 10]],
    [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]],
  ];
  return { id: work?.id || `work-${workIndex}`, shape, points, edges: edgeSets[shapeIndex] };
};

const createHomeScene = (host, initialMotion, initialWorks) => {
  let motion = initialMotion;
  let works = initialWorks;
  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    host.classList.add('is-webgl-unavailable');
    return {
      update() {},
      updateMotion() {},
      updateWorks() {},
      resize() {},
      destroy() {},
    };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  host.dataset.renderEngine = 'three-webgl';

  const home = host.closest('.ff-home');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xe8ebf0, 0.041);

  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 90);
  camera.position.set(0, 2.2, 9.2);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xaeb7c3, 2.1);
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
  keyLight.position.set(-5, 10, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -10;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 42;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.radius = 7;
  const rimLight = new THREE.DirectionalLight(0xc8d7e8, 1.1);
  rimLight.position.set(9, 3, -8);
  scene.add(hemisphere, keyLight, rimLight);

  const snowGeometry = new THREE.PlaneGeometry(42, 32, 96, 76);
  const snowPositions = snowGeometry.attributes.position;
  for (let index = 0; index < snowPositions.count; index += 1) {
    const x = snowPositions.getX(index);
    const y = snowPositions.getY(index);
    const ridge = Math.sin(x * 0.48 + y * 0.19) * 0.28;
    const drift = Math.sin(y * 0.34 - x * 0.17) * 0.42;
    const detail = Math.cos(x * 1.26 + y * 0.84) * 0.07;
    snowPositions.setZ(index, ridge + drift + detail);
  }
  snowGeometry.computeVertexNormals();
  const snowMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6f7f9,
    roughness: 0.88,
    metalness: 0.015,
  });
  const snow = new THREE.Mesh(snowGeometry, snowMaterial);
  snow.rotation.x = -Math.PI / 2;
  snow.position.set(1.5, -3.02, -5.2);
  snow.receiveShadow = true;
  scene.add(snow);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const networkGroup = new THREE.Group();
  const networkNodeGeometry = new THREE.IcosahedronGeometry(0.075, 1);
  const networkNodeMaterial = new THREE.MeshBasicMaterial({
    color: 0x718092,
    transparent: true,
    opacity: 0.58,
    depthWrite: true,
  });
  const networkLineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const previousNetworkLineMaterial = networkLineMaterial.clone();
  previousNetworkLineMaterial.opacity = 0;
  const posterLinkMaterial = new THREE.LineBasicMaterial({
    color: 0x66798e,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  let activeTopology = createNetworkTopology(initialWorks?.[0], 0, initialMotion);
  let networkMorphStart = performance.now();
  let networkMorphSequence = 0;
  let networkMorphProgress = 1;
  const networkNodes = activeTopology.points.map((point, index) => {
    const material = networkNodeMaterial.clone();
    const mesh = new THREE.Mesh(networkNodeGeometry, material);
    const scale = index % 4 === 0 ? 1.45 : index % 3 === 0 ? 1.15 : 0.82;
    mesh.scale.setScalar(scale);
    networkGroup.add(mesh);
    return {
      base: point.clone(),
      morphFrom: point.clone(),
      morphTo: point.clone(),
      current: point.clone(),
      amplitude: 0.2 + (index % 5) * 0.04,
      phase: 0.45 + index * 0.72,
      parallax: 0.12 + (index % 5) * 0.035,
      scale,
      material,
      mesh,
    };
  });
  let networkEdges = activeTopology.edges;
  let previousNetworkEdges = activeTopology.edges;
  const posterLinkCount = 3;
  const networkLinePositions = new Float32Array(networkEdges.length * 6);
  const networkLineColors = new Float32Array(networkEdges.length * 6);
  const networkLineGeometry = new THREE.BufferGeometry();
  const networkLineAttribute = new THREE.BufferAttribute(networkLinePositions, 3);
  const networkLineColorAttribute = new THREE.BufferAttribute(networkLineColors, 3);
  networkLineAttribute.setUsage(THREE.DynamicDrawUsage);
  networkLineColorAttribute.setUsage(THREE.DynamicDrawUsage);
  networkLineGeometry.setAttribute('position', networkLineAttribute);
  networkLineGeometry.setAttribute('color', networkLineColorAttribute);
  const networkLines = new THREE.LineSegments(networkLineGeometry, networkLineMaterial);
  const previousNetworkLinePositions = new Float32Array(18 * 6);
  const previousNetworkLineColors = new Float32Array(18 * 6);
  const previousNetworkLineGeometry = new THREE.BufferGeometry();
  const previousNetworkLineAttribute = new THREE.BufferAttribute(previousNetworkLinePositions, 3);
  const previousNetworkLineColorAttribute = new THREE.BufferAttribute(previousNetworkLineColors, 3);
  previousNetworkLineAttribute.setUsage(THREE.DynamicDrawUsage);
  previousNetworkLineColorAttribute.setUsage(THREE.DynamicDrawUsage);
  previousNetworkLineGeometry.setAttribute('position', previousNetworkLineAttribute);
  previousNetworkLineGeometry.setAttribute('color', previousNetworkLineColorAttribute);
  const previousNetworkLines = new THREE.LineSegments(previousNetworkLineGeometry, previousNetworkLineMaterial);
  const posterLinkPositions = new Float32Array(posterLinkCount * 6);
  const posterLinkGeometry = new THREE.BufferGeometry();
  const posterLinkAttribute = new THREE.BufferAttribute(posterLinkPositions, 3);
  posterLinkAttribute.setUsage(THREE.DynamicDrawUsage);
  posterLinkGeometry.setAttribute('position', posterLinkAttribute);
  const posterLinks = new THREE.LineSegments(posterLinkGeometry, posterLinkMaterial);
  networkGroup.add(previousNetworkLines, networkLines, posterLinks);
  scene.add(networkGroup);
  host.dataset.networkNodes = String(networkNodes.length);
  host.dataset.networkConnections = String(networkEdges.length + posterLinkCount);
  host.dataset.networkTopology = activeTopology.shape;
  host.dataset.networkMorphSequence = '0';
  host.dataset.networkMorphProgress = '1';

  const particleCount = 190;
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    const offset = index * 3;
    particlePositions[offset] = (Math.random() - 0.5) * 25;
    particlePositions[offset + 1] = Math.random() * 8 - 1.8;
    particlePositions[offset + 2] = Math.random() * -20 + 2;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xb5c0cc,
    size: 0.035,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  const posterRoot = new THREE.Group();
  scene.add(posterRoot);
  const textureLoader = new THREE.TextureLoader();
  const posterWidth = 3.38;
  const posterHeight = 5.95;
  const posterAspect = posterWidth / posterHeight;
  const posterEntries = [];
  let texturesReady = 0;
  let destroyed = false;
  let activeIndex = 0;

  const disposePosterEntries = () => {
    posterEntries.splice(0).forEach((entry) => {
      entry.texture?.dispose();
      entry.frontGeometry.dispose();
      entry.slabGeometry.dispose();
      entry.frontMaterial.dispose();
      entry.slabMaterial.dispose();
      posterRoot.remove(entry.group);
    });
  };

  const createPosterEntry = (work, index) => {
    const group = new THREE.Group();
    group.userData.workIndex = index;
    const slabGeometry = new THREE.BoxGeometry(posterWidth + 0.11, posterHeight + 0.11, 0.18);
    const slabMaterial = new THREE.MeshStandardMaterial({
      color: 0xaeb6c2,
      roughness: 0.42,
      metalness: 0.22,
      transparent: true,
      opacity: 0,
    });
    const slab = new THREE.Mesh(slabGeometry, slabMaterial);
    slab.castShadow = true;
    slab.receiveShadow = true;

    const frontGeometry = new THREE.PlaneGeometry(posterWidth, posterHeight);
    const frontMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(work.accent || '#b8bec7'),
      roughness: 0.68,
      metalness: 0.01,
      transparent: true,
      opacity: 0,
    });
    const front = new THREE.Mesh(frontGeometry, frontMaterial);
    front.position.z = 0.096;
    front.castShadow = true;
    group.add(slab, front);
    posterRoot.add(group);

    const entry = {
      group,
      slab,
      front,
      slabGeometry,
      slabMaterial,
      frontGeometry,
      frontMaterial,
      texture: null,
      target: getPosterWorldTarget(getRelativeIndex(index, activeIndex, works.length)),
      velocity: new THREE.Vector3(),
      rotationVelocity: new THREE.Vector3(),
      desiredPosition: new THREE.Vector3(),
      desiredRotation: new THREE.Vector3(),
      springDelta: new THREE.Vector3(),
    };
    posterEntries.push(entry);

    if (work.poster) {
      textureLoader.load(
        work.poster,
        (texture) => {
          if (destroyed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
          applyTextureCover(texture, posterAspect, work.posterFocalPoint || work.mediaFocalPoint);
          entry.texture = texture;
          entry.frontMaterial.map = texture;
          entry.frontMaterial.color.set(0xffffff);
          entry.frontMaterial.needsUpdate = true;
          texturesReady += 1;
          if (texturesReady === 1) home?.classList.add('has-webgl-posters');
        },
        undefined,
        () => {
          entry.frontMaterial.color.set(work.accent || '#8f98a4');
        },
      );
    }

    return entry;
  };

  const redirectNetwork = (nextActiveIndex, immediate = false) => {
    const topology = createNetworkTopology(works[nextActiveIndex], nextActiveIndex, motion);
    const mapping = assignTopologyByShortestTravel(networkNodes, topology);
    previousNetworkEdges = networkEdges;
    activeTopology = topology;
    networkEdges = mapping.edges;
    const availableTargets = new Set(topology.points.map((_, index) => index));
    posterConnectorNodeIndices = [2.4, 0, -2.4].map((targetY) => {
      const targetIndex = [...availableTargets].sort((left, right) => {
        const leftPoint = topology.points[left];
        const rightPoint = topology.points[right];
        const leftCost = Math.abs(leftPoint.y - targetY) * 0.72 - leftPoint.x;
        const rightCost = Math.abs(rightPoint.y - targetY) * 0.72 - rightPoint.x;
        return leftCost - rightCost;
      })[0];
      availableTargets.delete(targetIndex);
      return mapping.targetToNode[targetIndex];
    });
    networkNodes.forEach((node, index) => {
      // `current` already contains float, pointer and foreground offsets. Reusing it as the
      // structural origin would add those offsets again on the next frame and create a snap.
      node.morphFrom.copy(node.base);
      node.morphTo.copy(topology.points[mapping.assignment[index]]);
      if (immediate) node.base.copy(node.morphTo);
    });
    networkMorphProgress = immediate || reducedMotion ? 1 : 0;
    networkMorphStart = immediate || reducedMotion ? Number.NEGATIVE_INFINITY : performance.now();
    if (!immediate) networkMorphSequence += 1;
    host.dataset.networkTopology = topology.shape;
    host.dataset.networkAssignment = mapping.assignment.join(',');
    host.dataset.networkMorphSequence = String(networkMorphSequence);
    host.dataset.networkMorphProgress = String(networkMorphProgress);
  };

  const updatePosterTargets = (nextActiveIndex, immediate = false) => {
    const indexChanged = nextActiveIndex !== activeIndex;
    const switchDirection = indexChanged
      ? Math.sign(getRelativeIndex(nextActiveIndex, activeIndex, Math.max(1, posterEntries.length))) || 1
      : 0;
    activeIndex = nextActiveIndex;
    if (indexChanged && !immediate) {
      host.dataset.posterSwitchKick = clamp(numberOr(motion.homePosterSwitchKick, 1.15), 0, 2.4).toFixed(3);
    }
    posterEntries.forEach((entry, index) => {
      const relativeIndex = getRelativeIndex(index, activeIndex, posterEntries.length);
      entry.target = getPosterWorldTarget(relativeIndex);
      entry.slab.castShadow = relativeIndex === 0;
      entry.front.castShadow = relativeIndex === 0;
      if (!immediate) {
        if (indexChanged) {
          const distance = Math.abs(relativeIndex);
          const influence = distance === 0 ? 1 : distance === 1 ? 0.62 : 0.3;
          const kick = clamp(numberOr(motion.homePosterSwitchKick, 1.15), 0, 2.4);
          entry.velocity.x += -switchDirection * kick * influence;
          entry.velocity.y += (relativeIndex === 0 ? 0.18 : -0.08) * kick * influence;
          entry.velocity.z += (relativeIndex === 0 ? 0.42 : -0.12) * kick * influence;
          entry.rotationVelocity.y += switchDirection * kick * 0.12 * influence;
        }
        return;
      }
      entry.group.position.set(entry.target.x, entry.target.y, entry.target.z);
      entry.group.scale.setScalar(entry.target.scale);
      entry.group.rotation.y = entry.target.rotationY;
      entry.group.rotation.x = 0;
      entry.group.rotation.z = 0;
      entry.velocity.set(0, 0, 0);
      entry.rotationVelocity.set(0, 0, 0);
      entry.frontMaterial.opacity = entry.target.opacity;
      entry.slabMaterial.opacity = entry.target.opacity;
    });
    if (indexChanged || immediate) redirectNetwork(activeIndex, immediate);
  };

  const updateWorks = (nextWorks) => {
    works = Array.isArray(nextWorks) ? nextWorks : [];
    texturesReady = 0;
    home?.classList.remove('has-webgl-posters');
    disposePosterEntries();
    works.forEach(createPosterEntry);
    host.dataset.posterMeshes = String(works.length);
    updatePosterTargets(clamp(activeIndex, 0, Math.max(0, works.length - 1)), true);
  };

  const pointer = new THREE.Vector2(0, 0);
  const smoothedPointer = new THREE.Vector2(0, 0);
  let routeOffset = 0;
  let targetRouteOffset = 0;
  let animationFrame = 0;
  let previousTime = performance.now();

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const networkAnchors = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let posterConnectorNodeIndices = [4, 6, 11];
  const farNetworkColor = new THREE.Color(0xc5ccd5);
  const nearNetworkColor = new THREE.Color(0x42586d);
  const depthColor = new THREE.Color();
  const networkDepth = (point) => clamp((point.z + 11.5) / 10.5, 0, 1);
  const writeNetworkColor = (colors, vertexOffset, point) => {
    depthColor.lerpColors(farNetworkColor, nearNetworkColor, networkDepth(point));
    colors[vertexOffset] = depthColor.r;
    colors[vertexOffset + 1] = depthColor.g;
    colors[vertexOffset + 2] = depthColor.b;
  };
  const writeNetworkLine = (lineIndex, start, end) => {
    const offset = lineIndex * 6;
    networkLinePositions[offset] = start.x;
    networkLinePositions[offset + 1] = start.y;
    networkLinePositions[offset + 2] = start.z;
    networkLinePositions[offset + 3] = end.x;
    networkLinePositions[offset + 4] = end.y;
    networkLinePositions[offset + 5] = end.z;
    writeNetworkColor(networkLineColors, offset, start);
    writeNetworkColor(networkLineColors, offset + 3, end);
  };
  const writePreviousNetworkLine = (lineIndex, start, end) => {
    const offset = lineIndex * 6;
    previousNetworkLinePositions[offset] = start.x;
    previousNetworkLinePositions[offset + 1] = start.y;
    previousNetworkLinePositions[offset + 2] = start.z;
    previousNetworkLinePositions[offset + 3] = end.x;
    previousNetworkLinePositions[offset + 4] = end.y;
    previousNetworkLinePositions[offset + 5] = end.z;
    writeNetworkColor(previousNetworkLineColors, offset, start);
    writeNetworkColor(previousNetworkLineColors, offset + 3, end);
  };
  const writePosterLink = (lineIndex, start, end) => {
    const offset = lineIndex * 6;
    posterLinkPositions[offset] = start.x;
    posterLinkPositions[offset + 1] = start.y;
    posterLinkPositions[offset + 2] = start.z;
    posterLinkPositions[offset + 3] = end.x;
    posterLinkPositions[offset + 4] = end.y;
    posterLinkPositions[offset + 5] = end.z;
  };

  const updateNetwork = (time) => {
    const timeSeconds = time * 0.001;
    const morphDelay = reducedMotion ? 0 : clamp(numberOr(motion.networkMorphDelay, 0.12), 0, 0.8);
    const morphDuration = reducedMotion ? 0.12 : clamp(numberOr(motion.networkMorphDuration, 1.05), 0.35, 2.4);
    const morphElapsed = (time - networkMorphStart) / 1000 - morphDelay;
    networkMorphProgress = clamp(morphElapsed / morphDuration, 0, 1);
    const morphAttack = clamp(numberOr(motion.networkMorphAttack, 1.15), 0.35, 2.8);
    const timeBias = clamp((morphAttack - 1.15) * 0.1, -0.08, 0.16);
    const warpedProgress = clamp(
      networkMorphProgress + timeBias * networkMorphProgress * (1 - networkMorphProgress),
      0,
      1,
    );
    const pathProgress = warpedProgress ** 3 * (warpedProgress * (warpedProgress * 6 - 15) + 10);
    networkGroup.rotation.set(0, 0, 0);
    networkGroup.position.z = 0;
    const floatStrength = clamp(numberOr(motion.networkFloatStrength, 1), 0, 2);
    const floatSpeed = clamp(numberOr(motion.networkFloatSpeed, 1), 0.2, 2.8);
    const pointerInfluence = clamp(numberOr(motion.networkPointerInfluence, 1), 0, 3);
    const activePosterFrontZ = (posterEntries[activeIndex]?.group.position.z ?? -2.15) + 0.12;
    let frontNodeCount = 0;
    networkNodes.forEach((node, index) => {
      const motionScale = reducedMotion ? 0.12 : 1;
      node.base.lerpVectors(node.morphFrom, node.morphTo, pathProgress);
      const floatY = Math.sin(timeSeconds * floatSpeed * (0.34 + (index % 4) * 0.055) + node.phase)
        * node.amplitude
        * motionScale
        * floatStrength;
      const driftX = Math.cos(timeSeconds * floatSpeed * 0.21 + node.phase * 0.7)
        * node.amplitude
        * 0.24
        * motionScale
        * floatStrength;
      const depthResponse = clamp((12 + node.base.z) / 8, 0.1, 1);
      let nodeZ = node.base.z
        - smoothedPointer.x * node.parallax * 0.15 * pointerInfluence;
      node.current.set(
        node.base.x + driftX - smoothedPointer.x * node.parallax * depthResponse * pointerInfluence,
        node.base.y + floatY + smoothedPointer.y * node.parallax * 0.62 * pointerInfluence,
        nodeZ,
      );
      node.mesh.position.copy(node.current);
      const pulse = reducedMotion ? 1 : 1 + Math.sin(timeSeconds * floatSpeed * 0.8 + node.phase) * 0.16;
      const connectorBoost = posterConnectorNodeIndices.includes(index) ? 1.16 : 1;
      const depthFactor = networkDepth(node.current);
      node.mesh.scale.setScalar(node.scale * pulse * connectorBoost * THREE.MathUtils.lerp(0.68, 1.48, depthFactor));
      node.material.opacity = THREE.MathUtils.lerp(0.2, 0.82, depthFactor);
      node.material.color.lerpColors(farNetworkColor, nearNetworkColor, depthFactor);
      if (node.current.z + networkGroup.position.z > activePosterFrontZ) frontNodeCount += 1;
    });

    networkEdges.forEach(([startIndex, endIndex], lineIndex) => {
      writeNetworkLine(lineIndex, networkNodes[startIndex].current, networkNodes[endIndex].current);
    });
    previousNetworkEdges.forEach(([startIndex, endIndex], lineIndex) => {
      writePreviousNetworkLine(lineIndex, networkNodes[startIndex].current, networkNodes[endIndex].current);
    });

    const activePoster = posterEntries[activeIndex];
    if (activePoster) {
      const posterScale = activePoster.group.scale.x || activePoster.target.scale || 1;
      const posterPosition = activePoster.group.position;
      networkAnchors[0].set(
        posterPosition.x - posterWidth * posterScale * 0.46,
        posterPosition.y + posterHeight * posterScale * 0.36,
        posterPosition.z + 0.08,
      );
      networkAnchors[1].set(
        posterPosition.x + posterWidth * posterScale * 0.48,
        posterPosition.y + posterHeight * posterScale * 0.08,
        posterPosition.z + 0.08,
      );
      networkAnchors[2].set(
        posterPosition.x + posterWidth * posterScale * 0.32,
        posterPosition.y - posterHeight * posterScale * 0.42,
        posterPosition.z + 0.08,
      );
      posterConnectorNodeIndices.forEach((nodeIndex, anchorIndex) => {
        const linkIndex = anchorIndex;
        writePosterLink(linkIndex, networkNodes[nodeIndex].current, networkAnchors[anchorIndex]);
      });
    } else {
      for (let index = 0; index < posterLinkCount; index += 1) {
        writePosterLink(index, networkNodes[index].current, networkNodes[index].current);
      }
    }

    networkLineAttribute.needsUpdate = true;
    networkLineColorAttribute.needsUpdate = true;
    previousNetworkLineAttribute.needsUpdate = true;
    previousNetworkLineColorAttribute.needsUpdate = true;
    posterLinkAttribute.needsUpdate = true;
    const pointerOpacity = (Math.abs(smoothedPointer.x) + Math.abs(smoothedPointer.y)) * 0.035;
    networkLineMaterial.opacity = (0.18 + pointerOpacity) * (0.38 + pathProgress * 0.62);
    previousNetworkLineMaterial.opacity = (0.18 + pointerOpacity) * (1 - pathProgress) * 0.78;
    posterLinkMaterial.opacity = (0.3 + pointerOpacity) * (0.48 + Math.abs(networkMorphProgress - 0.5));
    host.dataset.networkMorphProgress = networkMorphProgress.toFixed(3);
    host.dataset.networkFrontNodeCount = String(frontNodeCount);
    host.dataset.networkForegroundNodes = String(frontNodeCount);
  };

  const render = (time) => {
    const delta = Math.min((time - previousTime) / 16.667, 3);
    const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    const damping = clamp(numberOr(motion.homeDamping, 0.095), 0.02, 0.24);
    const pointerGainX = clamp(numberOr(motion.homePointerX, 1), 0, 1.6);
    const pointerGainY = clamp(numberOr(motion.homePointerY, 0.72), 0, 1.3);
    const posterEase = 1 - Math.pow(0.9, delta);
    const posterAttraction = clamp(numberOr(motion.homePosterAttraction, 0.78), 0, 1.6);
    const posterTilt = THREE.MathUtils.degToRad(clamp(numberOr(motion.homePosterTilt, 6.5), 0, 14));
    const posterDepth = clamp(numberOr(motion.homePosterDepth, 0.46), 0, 1.2);
    const posterSpring = clamp(numberOr(motion.homePosterSpring, 38), 12, 72);
    const posterDrag = clamp(numberOr(motion.homePosterDrag, 10.5), 4, 20);

    smoothedPointer.lerp(pointer, 1 - Math.pow(1 - damping, delta));
    routeOffset += (targetRouteOffset - routeOffset) * (1 - Math.pow(0.91, delta));

    camera.position.x = routeOffset + smoothedPointer.x * pointerGainX * 0.68;
    camera.position.y = 2.2 - smoothedPointer.y * pointerGainY * 0.42;
    camera.lookAt(routeOffset * 0.2, 0.52 - smoothedPointer.y * 0.08, -3.9);
    snow.position.x = 1.5 + smoothedPointer.x * -0.18;
    particles.position.x = smoothedPointer.x * -0.26;
    particles.rotation.y = time * 0.000014;

    posterEntries.forEach((entry, index) => {
      const target = entry.target;
      const relativeIndex = getRelativeIndex(index, activeIndex, posterEntries.length);
      const distance = Math.abs(relativeIndex);
      const influence = distance === 0 ? 1 : distance === 1 ? 0.45 : 0.18;
      const attractionX = clamp(smoothedPointer.x * posterAttraction * -0.72 * influence, -0.94, 0.94);
      const attractionY = clamp(smoothedPointer.y * posterAttraction * 0.46 * influence, -0.58, 0.58);
      const depthLift = posterDepth * influence * Math.min(1, Math.hypot(smoothedPointer.x, smoothedPointer.y));
      const desiredPosition = entry.desiredPosition.set(target.x + attractionX, target.y + attractionY, target.z + depthLift);
      const spring = distance === 0 ? posterSpring : posterSpring * 0.82;
      const drag = distance === 0 ? posterDrag : posterDrag * 1.1;
      entry.springDelta.copy(desiredPosition).sub(entry.group.position);
      entry.velocity.addScaledVector(entry.springDelta, spring * deltaSeconds);
      entry.velocity.multiplyScalar(Math.exp(-drag * deltaSeconds));
      entry.group.position.addScaledVector(entry.velocity, deltaSeconds * 4.4);
      const nextScale = entry.group.scale.x + (target.scale - entry.group.scale.x) * posterEase;
      entry.group.scale.setScalar(nextScale);
      const desiredRotation = entry.desiredRotation.set(
        smoothedPointer.y * posterTilt * influence,
        target.rotationY - smoothedPointer.x * posterTilt * influence,
        smoothedPointer.x * posterTilt * influence * 0.16,
      );
      entry.springDelta.set(entry.group.rotation.x, entry.group.rotation.y, entry.group.rotation.z);
      desiredRotation.sub(entry.springDelta);
      entry.rotationVelocity.addScaledVector(desiredRotation, spring * deltaSeconds);
      entry.rotationVelocity.multiplyScalar(Math.exp(-drag * deltaSeconds));
      entry.group.rotation.x += entry.rotationVelocity.x * deltaSeconds * 4.1;
      entry.group.rotation.y += entry.rotationVelocity.y * deltaSeconds * 4.1;
      entry.group.rotation.z += entry.rotationVelocity.z * deltaSeconds * 4.1;
      entry.frontMaterial.opacity += (target.opacity - entry.frontMaterial.opacity) * posterEase;
      entry.slabMaterial.opacity += (target.opacity - entry.slabMaterial.opacity) * posterEase;
      entry.group.visible = entry.frontMaterial.opacity > 0.018;
      if (distance === 0) {
        host.dataset.activePosterX = attractionX.toFixed(3);
        host.dataset.activePosterY = attractionY.toFixed(3);
        host.dataset.activePosterDepth = depthLift.toFixed(3);
        host.dataset.activePosterRotateX = THREE.MathUtils.radToDeg(entry.group.rotation.x).toFixed(2);
        host.dataset.activePosterRotateY = THREE.MathUtils.radToDeg(entry.group.rotation.y - target.rotationY).toFixed(2);
        host.dataset.activePosterVelocity = entry.velocity.length().toFixed(4);
        host.dataset.posterSettleError = entry.group.position.distanceTo(desiredPosition).toFixed(4);
      }
    });

    updateNetwork(time);

    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(render);
  };

  updateWorks(works);
  resize();
  animationFrame = requestAnimationFrame(render);

  return {
    update(nextPointer, nextActiveIndex) {
      pointer.copy(nextPointer);
      if (nextActiveIndex !== activeIndex) updatePosterTargets(nextActiveIndex);
      targetRouteOffset = nextActiveIndex * -0.075 * numberOr(motion.homeCameraTravel, 1.3);
    },
    updateMotion(nextMotion) {
      motion = nextMotion || motion;
    },
    updateWorks,
    resize,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      home?.classList.remove('has-webgl-posters');
      disposePosterEntries();
      snowGeometry.dispose();
      snowMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      networkLineGeometry.dispose();
      previousNetworkLineGeometry.dispose();
      networkLineMaterial.dispose();
      previousNetworkLineMaterial.dispose();
      posterLinkGeometry.dispose();
      posterLinkMaterial.dispose();
      networkNodeGeometry.dispose();
      networkNodes.forEach((node) => node.material.dispose());
      networkNodeMaterial.dispose();
      scene.remove(networkGroup);
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.renderEngine;
      delete host.dataset.posterMeshes;
      delete host.dataset.networkNodes;
      delete host.dataset.networkConnections;
      delete host.dataset.networkTopology;
      delete host.dataset.networkMorphSequence;
      delete host.dataset.networkMorphProgress;
      delete host.dataset.activePosterX;
      delete host.dataset.activePosterY;
      delete host.dataset.activePosterDepth;
      delete host.dataset.activePosterRotateX;
      delete host.dataset.activePosterRotateY;
      delete host.dataset.activePosterVelocity;
      delete host.dataset.posterSwitchKick;
      delete host.dataset.posterSettleError;
      delete host.dataset.networkFrontNodeCount;
      delete host.dataset.networkForegroundNodes;
    },
  };
};

const createMarkup = (project) => `
  <section class="ff-home" aria-label="FLOWFRAME 作品画廊">
    <div class="ff-home__atmosphere" aria-hidden="true">
      <div class="ff-home__snow"></div>
      <div class="ff-home__mist"></div>
    </div>
    <div class="ff-home__scene" aria-hidden="true"></div>

    <header class="ff-home__header">
      <a class="ff-home__brand" href="#/" aria-label="FLOWFRAME 首页">
        <i class="ff-home__brand-mark" data-lucide="diamond" aria-hidden="true"></i>
        <span>${escapeText(project.title || 'FLOWFRAME')}</span>
      </a>
      <span class="ff-home__section-label">GALLERY</span>
      <div class="ff-home__header-actions">
        <button class="ff-home__sound-label" type="button" data-home-sound aria-pressed="true">SOUND ON</button>
        ${typeof project.assetNotice === 'string' ? `<span class="ff-home__prototype-label">${escapeText(project.assetNotice)}</span>` : ''}
      </div>
    </header>

    <main class="ff-home__main">
      <section class="ff-home__copy" aria-live="polite">
        <p class="ff-home__counter"><span data-home-current>01</span><i>/</i><span data-home-total>01</span></p>
        <h1 data-home-title>—</h1>
        <p class="ff-home__title-en" data-home-title-en>—</p>
        <p class="ff-home__meta" data-home-meta>—</p>
        <div class="ff-home__actions">
          <button class="ff-home__enter" type="button" data-home-enter>
            <i class="ff-home__enter-icon" data-lucide="play" aria-hidden="true"></i>
            <span>ENTER MIX</span>
          </button>
          <button class="ff-home__sakura" type="button" data-home-sakura aria-label="进入春日樱花铁路场景">
            <span class="ff-home__sakura-petals" aria-hidden="true">
              <i></i><i></i><i></i><i></i><i></i><i></i>
            </span>
            <span class="ff-home__sakura-mark" aria-hidden="true">✿</span>
            <span>SAKURA RAILWAY</span>
          </button>
        </div>
      </section>

      <section class="ff-home__gallery" aria-label="作品海报">
        <div class="ff-home__camera" data-home-camera></div>
      </section>
    </main>

    <footer class="ff-home__footer">
      <div class="ff-home__progress" aria-hidden="true"><span data-home-progress></span></div>
      <div class="ff-home__navigation">
        <button type="button" data-home-prev aria-label="上一个作品"><i data-lucide="arrow-left" aria-hidden="true"></i></button>
        <span>SCROLL / ARROW KEYS</span>
        <button type="button" data-home-next aria-label="下一个作品"><i data-lucide="arrow-right" aria-hidden="true"></i></button>
      </div>
      <button class="ff-home__studio" type="button" data-home-studio hidden>OPEN STUDIO</button>
    </footer>
  </section>
`;

const createPosterMarkup = (work, index) => {
  const assetLabel = getAssetLabel(work);
  const hasPosterPath = Boolean(work.poster);
  return `
    <button
      class="ff-home__poster"
      type="button"
      data-home-poster="${index}"
      aria-label="${escapeText(work.title || work.titleEn || `作品 ${index + 1}`)}"
    >
      <span class="ff-home__poster-surface">
        ${hasPosterPath ? `<img src="${escapeText(work.poster)}" alt="" draggable="false" data-home-poster-image>` : ''}
        <span class="ff-home__poster-fallback" ${hasPosterPath ? 'hidden' : ''}>
          <small>${assetLabel || 'MISSING MEDIA'}</small>
          <strong>${escapeText(work.title || work.titleEn || 'UNTITLED')}</strong>
          <em>${escapeText(work.titleEn || '')}</em>
        </span>
        ${assetLabel ? `<span class="ff-home__asset-badge">${assetLabel}</span>` : ''}
        <span class="ff-home__poster-caption">
          <small>${escapeText(work.index || String(index + 1).padStart(2, '0'))}</small>
          <span>${escapeText(work.titleEn || work.title || 'UNTITLED')}</span>
          <em>BY FLOWFRAME</em>
        </span>
      </span>
    </button>
  `;
};

/**
 * 挂载桌面端首页体验。
 * 传入的 root 由应用外壳管理，本模块只清理自己创建的内容和事件。
 */
export const mountHome = ({ root, project, onOpenWork, onOpenStudio, onOpenSakura, audioController }) => {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('mountHome 需要有效的 root 元素。');
  }

  let currentProject = project || { title: 'FLOWFRAME', motion: {}, works: [] };
  let works = Array.isArray(currentProject.works) ? currentProject.works : [];
  let activeIndex = 0;
  let destroyed = false;
  let wheelLocked = false;
  let wheelUnlockTimer = 0;
  const pointerTarget = new THREE.Vector2(0, 0);
  const pointerCurrent = new THREE.Vector2(0, 0);

  root.innerHTML = createMarkup(currentProject);
  root.classList.add('ff-home-root');
  createIcons({
    icons: { ArrowLeft, ArrowRight, Diamond, Play },
    root,
    attrs: { 'stroke-width': 1.5 },
  });

  const home = root.querySelector('.ff-home');
  const sceneHost = root.querySelector('.ff-home__scene');
  const cameraRig = root.querySelector('[data-home-camera]');
  const title = root.querySelector('[data-home-title]');
  const titleEn = root.querySelector('[data-home-title-en]');
  const meta = root.querySelector('[data-home-meta]');
  const current = root.querySelector('[data-home-current]');
  const total = root.querySelector('[data-home-total]');
  const progress = root.querySelector('[data-home-progress]');
  const enter = root.querySelector('[data-home-enter]');
  const sakura = root.querySelector('[data-home-sakura]');
  const previous = root.querySelector('[data-home-prev]');
  const next = root.querySelector('[data-home-next]');
  const studio = root.querySelector('[data-home-studio]');
  const soundButton = root.querySelector('[data-home-sound]');
  const motion = currentProject.motion || {};
  const homeScene = createHomeScene(sceneHost, motion, works);
  const posterMotion = new WeakMap();
  let posterMotionTime = performance.now();
  const syncOverlayMotion = () => {
    const currentMotion = currentProject.motion || {};
    home.style.setProperty('--home-overlay-fade-out', `${clamp(numberOr(currentMotion.homeOverlayFadeOut, 0.18), 0.05, 0.8)}s`);
    home.style.setProperty('--home-overlay-fade-in', `${clamp(numberOr(currentMotion.homeOverlayFadeIn, 0.28), 0.05, 1.2)}s`);
  };
  syncOverlayMotion();
  const updateSoundState = (state) => {
    const isOn = state === 'playing' || state === 'armed';
    const isUnavailable = state === 'missing' || state === 'error';
    soundButton.textContent = isUnavailable ? 'SOUND N/A' : isOn ? 'SOUND ON' : 'SOUND OFF';
    soundButton.setAttribute('aria-pressed', String(isOn));
    soundButton.dataset.soundState = state;
  };
  const unsubscribeSound = audioController?.subscribe?.(updateSoundState) || (() => {});
  const toggleSound = () => audioController?.toggle?.();
  const syncAudioTrack = (work) => audioController?.setTrack?.(work?.audioSrc, { id: work?.id });
  const openSakura = typeof onOpenSakura === 'function' ? onOpenSakura : () => {};

  const openActiveWork = () => {
    const work = works[activeIndex];
    if (work && typeof onOpenWork === 'function') onOpenWork(work.id);
  };

  const updateCopy = (direction = 0) => {
    const work = works[activeIndex];
    if (!work) {
      syncAudioTrack(null);
      title.textContent = '暂无作品';
      titleEn.textContent = 'NO WORKS';
      meta.textContent = '请先在 Studio 添加作品';
      current.textContent = '00';
      total.textContent = '00';
      enter.disabled = true;
      progress.style.transform = 'scaleX(0)';
      return;
    }

    syncAudioTrack(work);
    enter.disabled = false;
    current.textContent = work.index || String(activeIndex + 1).padStart(2, '0');
    total.textContent = String(works.length).padStart(2, '0');
    title.textContent = work.title || '未命名作品';
    titleEn.textContent = work.titleEn || 'UNTITLED';
    meta.textContent = [work.category, work.year].filter(Boolean).join('  ·  ');
    progress.style.transform = `scaleX(${(activeIndex + 1) / works.length})`;

    gsap.fromTo(
      [current, title, titleEn, meta],
      { y: direction === 0 ? 8 : direction * 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.58, stagger: 0.045, ease: 'power3.out', overwrite: true },
    );
  };

  const updatePosters = (direction = 0) => {
    const posterNodes = cameraRig.querySelectorAll('[data-home-poster]');
    posterNodes.forEach((poster, index) => {
      const offset = getRelativeIndex(index, activeIndex, works.length);
      const distance = Math.abs(offset);
      let state = posterMotion.get(poster);
      if (!state) {
        state = { offset, targetOffset: offset, velocity: 0, settledAt: 0 };
        posterMotion.set(poster, state);
        poster.style.setProperty('--poster-offset', String(offset));
        poster.style.setProperty('--poster-distance', String(distance));
      } else {
        state.targetOffset = offset;
        state.settledAt = 0;
        if (direction) {
          const kick = clamp(numberOr(currentProject.motion?.homePosterSwitchKick, 1.15), 0, 2.4);
          const influence = distance === 0 ? 1 : distance === 1 ? 0.62 : 0.3;
          state.velocity += -direction * kick * influence;
        }
      }
      poster.classList.remove('is-overlay-ready');
      poster.style.setProperty(
        '--poster-focus',
        String(works[index]?.posterFocalPoint || works[index]?.mediaFocalPoint || '58% 50%'),
      );
      poster.dataset.offset = String(clamp(offset, -3, 3));
      poster.classList.toggle('is-active', offset === 0);
      poster.classList.toggle('is-distant', distance > 2);
      poster.tabIndex = distance <= 1 ? 0 : -1;
      poster.setAttribute('aria-current', offset === 0 ? 'true' : 'false');
    });

    homeScene.update(pointerTarget, activeIndex);
    gsap.fromTo(
      cameraRig,
      { xPercent: activeIndex === 0 ? 0 : clamp(activeIndex, -1, 1) * -0.7 },
      { xPercent: 0, duration: 1.15, ease: 'power3.inOut', overwrite: true },
    );
  };

  const setActive = (nextIndex, direction = 0) => {
    if (!works.length) return;
    const normalized = wrapIndex(nextIndex, works.length);
    if (normalized === activeIndex && direction !== 0) return;
    activeIndex = normalized;
    updatePosters(direction);
    updateCopy(direction);
  };

  const step = (direction) => setActive(activeIndex + direction, direction);

  const bindPosterErrors = () => {
    cameraRig.querySelectorAll('[data-home-poster-image]').forEach((image) => {
      const revealFallback = () => {
        image.hidden = true;
        image.closest('.ff-home__poster-surface')?.querySelector('.ff-home__poster-fallback')?.removeAttribute('hidden');
        image.closest('.ff-home__poster')?.classList.add('has-missing-image');
      };
      if (image.complete && image.naturalWidth === 0) revealFallback();
      image.addEventListener('error', revealFallback, { once: true });
    });
  };

  const renderPosters = () => {
    cameraRig.innerHTML = works.map(createPosterMarkup).join('');
    bindPosterErrors();
    updatePosters(0);
    updateCopy(0);
  };

  const onPosterClick = (event) => {
    const poster = event.target.closest('[data-home-poster]');
    if (!poster) return;
    const index = Number(poster.dataset.homePoster);
    if (index === activeIndex) openActiveWork();
    else {
      const offset = getRelativeIndex(index, activeIndex, works.length);
      setActive(index, Math.sign(offset));
    }
  };

  const onWheel = (event) => {
    if (Math.abs(event.deltaY) < 12 || wheelLocked) return;
    event.preventDefault();
    wheelLocked = true;
    step(event.deltaY > 0 ? 1 : -1);
    window.clearTimeout(wheelUnlockTimer);
    wheelUnlockTimer = window.setTimeout(() => {
      wheelLocked = false;
    }, 720);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Enter' && event.target === document.body) {
      openActiveWork();
    }
  };

  const onPointerMove = (event) => {
    const rect = home.getBoundingClientRect();
    pointerTarget.set(
      clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
      clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
    );
  };

  const onPointerLeave = () => pointerTarget.set(0, 0);

  let pointerFrame = 0;
  const animatePointer = (time = performance.now()) => {
    const deltaSeconds = Math.min(Math.max((time - posterMotionTime) / 1000, 0), 0.05);
    posterMotionTime = time;
    const damping = clamp(numberOr(currentProject.motion?.homeDamping, 0.095), 0.02, 0.24);
    const posterSpring = clamp(numberOr(currentProject.motion?.homePosterSpring, 38), 12, 72);
    const posterDrag = clamp(numberOr(currentProject.motion?.homePosterDrag, 10.5), 4, 20);
    const overlayDelay = clamp(numberOr(currentProject.motion?.homeOverlayDelay, 0.08), 0, 0.8);
    pointerCurrent.lerp(pointerTarget, damping);
    home.style.setProperty('--pointer-x', pointerCurrent.x.toFixed(4));
    home.style.setProperty('--pointer-y', pointerCurrent.y.toFixed(4));
    cameraRig.querySelectorAll('[data-home-poster]').forEach((poster) => {
      const state = posterMotion.get(poster);
      if (!state) return;
      state.velocity += (state.targetOffset - state.offset) * posterSpring * deltaSeconds;
      state.velocity *= Math.exp(-posterDrag * deltaSeconds);
      state.offset += state.velocity * deltaSeconds * 4.4;
      if (Math.abs(state.targetOffset - state.offset) < 0.0005 && Math.abs(state.velocity) < 0.0005) {
        state.offset = state.targetOffset;
        state.velocity = 0;
      }
      const overlaySettled = Math.abs(state.targetOffset - state.offset) < 0.025
        && Math.abs(state.velocity) < 0.055;
      if (overlaySettled) {
        if (!state.settledAt) state.settledAt = time;
      } else {
        state.settledAt = 0;
      }
      const overlayReady = poster.classList.contains('is-active')
        && overlaySettled
        && time - state.settledAt >= overlayDelay * 1000;
      poster.classList.toggle('is-overlay-ready', overlayReady);
      poster.style.setProperty('--poster-offset', state.offset.toFixed(5));
      poster.style.setProperty('--poster-distance', Math.abs(state.offset).toFixed(5));
    });
    homeScene.update(pointerCurrent, activeIndex);
    pointerFrame = requestAnimationFrame(animatePointer);
  };

  cameraRig.addEventListener('click', onPosterClick);
  enter.addEventListener('click', openActiveWork);
  sakura.addEventListener('click', openSakura);
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  soundButton.addEventListener('click', toggleSound);
  home.addEventListener('wheel', onWheel, { passive: false });
  home.addEventListener('pointermove', onPointerMove);
  home.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', homeScene.resize);

  // Studio 保留为独立原型路由。主页不显示开发入口，避免破坏方案 1 构图。

  renderPosters();
  pointerFrame = requestAnimationFrame(animatePointer);

  gsap.fromTo(
    home,
    { opacity: 0, scale: 1.012 },
    { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out', clearProps: 'scale' },
  );

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(pointerFrame);
      window.clearTimeout(wheelUnlockTimer);
      cameraRig.removeEventListener('click', onPosterClick);
      enter.removeEventListener('click', openActiveWork);
      sakura.removeEventListener('click', openSakura);
      soundButton.removeEventListener('click', toggleSound);
      unsubscribeSound();
      home.removeEventListener('wheel', onWheel);
      home.removeEventListener('pointermove', onPointerMove);
      home.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', homeScene.resize);
      gsap.killTweensOf([home, cameraRig, current, title, titleEn, meta]);
      homeScene.destroy();
      root.classList.remove('ff-home-root');
      root.innerHTML = '';
    },
    updateProject(nextProject) {
      if (!nextProject || destroyed) return;
      const activeId = works[activeIndex]?.id;
      currentProject = nextProject;
      works = Array.isArray(currentProject.works) ? currentProject.works : [];
      syncOverlayMotion();
      homeScene.updateMotion(currentProject.motion);
      homeScene.updateWorks(works);
      const preservedIndex = works.findIndex((work) => work.id === activeId);
      activeIndex = preservedIndex >= 0 ? preservedIndex : clamp(activeIndex, 0, Math.max(0, works.length - 1));
      renderPosters();
    },
  };
};

export default mountHome;
