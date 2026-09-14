import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };
export const wind = { value: 0 };
export const P = {
  grass: '#78ad54', grassLight: '#83b958', grassDark: '#63984c', hedge: '#5e9263',
  cream: '#f1e7d3', base: '#e5dbc4', earth: '#b1b29c', edge: '#cec6b1',
  road: '#879aa3', pavement: '#bcc5bc', concrete: '#d3d4c4', stone: '#b4bcb0',
  wood: '#a47555', woodLight: '#c3976d', woodDark: '#795d50', bark: '#775951',
  roof: '#47838b', roofLight: '#62a19f', roofDark: '#3a6877',
  white: '#f8f3e8', train: '#fff9f4', teal: '#48a7b1', pink: '#e895b2',
  glass: '#526f78', glassLight: '#85adae', metal: '#627772', dark: '#3e5052',
  yellow: '#f1d587', red: '#e58785', blossom: '#f3bed2',
};
const gradient = new THREE.DataTexture(new Uint8Array([120, 168, 205, 236, 255]), 5, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.generateMipmaps = false;
gradient.needsUpdate = true;
const mats = new Map();
export function mat(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...options });
  mats.set(key, m);
  return m;
}
export function windMat(color, strength = 0.035) {
  const m = mat(color).clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBreeze = wind;
    shader.vertexShader = 'uniform float uBreeze;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float b = sin(uBreeze * 0.68 + position.x * 0.48 + position.z * 0.35);
      transformed.x += b * ${strength.toFixed(4)} * smoothstep(0.0, 3.0, position.y);
      transformed.z += cos(uBreeze * 0.51 + position.x * 0.3) * ${(strength * 0.45).toFixed(4)};
    `);
  };
  m.customProgramCacheKey = () => `sakura-wind-${strength}`;
  return m;
}
export function mesh(parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const cube = new THREE.BoxGeometry(1, 1, 1);
export function box(parent, w, h, d, x, y, z, material, radius = 0) {
  const m = mesh(parent, radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : cube, material, x, y, z);
  if (!radius) m.scale.set(w, h, d);
  return m;
}
export function sphere(parent, radius, x, y, z, material, scale = [1,1,1], detail = 1) {
  const m = mesh(parent, new THREE.IcosahedronGeometry(radius, detail), material, x, y, z);
  m.scale.set(...scale);
  return m;
}
export function cylinder(parent, r1, r2, h, x, y, z, material, segments = 10) {
  return mesh(parent, new THREE.CylinderGeometry(r1, r2, h, segments), material, x, y, z);
}
export function beam(parent, a, b, radius, material, endRadius = radius, segments = 8) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const m = cylinder(parent, endRadius, radius, start.distanceTo(end), mid.x, mid.y, mid.z, material, segments);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  return m;
}
export function wire(parent, points, radius = 0.015, material = mat(P.dark), segments = 26) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(parent, new THREE.TubeGeometry(c, segments, radius, 5, false), material);
}
export function group(parent, x=0, y=0, z=0, rotation=0) {
  const g = new THREE.Group();
  g.position.set(x,y,z);
  g.rotation.y = rotation;
  parent.add(g);
  return g;
}
export function rng(seed = 1) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const random = rng(48107);
export function between(a, b) { return a + (b-a) * random(); }

// An extruded gable is a volume with separate warm end walls and overhanging roof planes.
export function gable(parent, w, d, h, y, wallMaterial, roofMaterial, trim = mat(P.roofDark)) {
  const s = new THREE.Shape();
  s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(0,h); s.closePath();
  const geom = new THREE.ExtrudeGeometry(s, { depth:d, bevelEnabled:false });
  mesh(parent, geom, wallMaterial, 0, y, -d/2);
  const angle = Math.atan2(h, w/2);
  const length = Math.hypot(w/2+.18, h+.08);
  for (const side of [-1,1]) {
    const roof = box(parent,length,.13,d+.5,side*w/4,y+h/2+.07,0,roofMaterial,.035);
    roof.rotation.z = -side*angle;
    for(let z=-d/2-.18;z<=d/2+.2;z+=.24) {
      beam(parent,[0,y+h+.15,z],[side*(w/2+.2),y-.015,z],.021,trim,.021,5);
    }
  }
  beam(parent,[0,y+h+.17,-d/2-.25],[0,y+h+.17,d/2+.25],.08,trim,.08,8);
  return y+h;
}
export function fence(parent, a, b, height = .65, material = mat(P.white)) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
  const length=av.distanceTo(bv), n=Math.ceil(length/.62);
  for(let i=0;i<=n;i++) {
    const p=av.clone().lerp(bv,i/n);
    cylinder(parent,.033,.04,height,p.x,p.y+height/2,p.z,material,6);
    sphere(parent,.047,p.x,p.y+height,p.z,material,[1,.7,1],0);
  }
  for(const h of [.28,height-.13]) beam(parent,[a[0],a[1]+h,a[2]],[b[0],b[1]+h,b[2]],.026,material);
}
export function sign(parent, text, w, h, x, y, z, { color = '#526962', background = '#f7f2e4', subtitle = '', stripe = true } = {}) {
  box(parent,w+.055,h+.055,.07,x,y,z,mat(P.roofDark),.025);
  const canvas=document.createElement('canvas');
  canvas.width=768; canvas.height=Math.round(768*h/w);
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);
  if(stripe){ctx.fillStyle='#e3a4b9';ctx.fillRect(0,canvas.height*.76,768,canvas.height*.1);}
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`600 ${canvas.height*(subtitle?.44:.51)}px 'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif`;
  ctx.fillText(text,384,canvas.height*(subtitle?.33:.42));
  if(subtitle){ctx.font=`500 ${canvas.height*.16}px sans-serif`;ctx.fillText(subtitle,384,canvas.height*.63);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
  mesh(parent,new THREE.PlaneGeometry(w,h),m,x,y,z+.038,false);
}

// Share static geometry by material. Wires, roofs and tiny details remain real geometry;
// dynamic trains, crossing hinges and instanced plants keep their own scene nodes.
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const batches=new Map(),remove=[];
  root.traverse(obj=>{
    if(!obj.isMesh || obj.isInstancedMesh || Array.isArray(obj.material)) return;
    for(let p=obj;p && p!==root;p=p.parent) if(p.userData.dynamic) return;
    const key=obj.material.uuid+obj.castShadow+obj.receiveShadow;
    if(!batches.has(key)) batches.set(key,{mat:obj.material,cast:obj.castShadow,receive:obj.receiveShadow,geos:[]});
    let g=obj.geometry.clone(); if(g.index) g=g.toNonIndexed();
    g.applyMatrix4(obj.matrixWorld);
    for(const name of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
    if(!g.attributes.uv) g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(!g.attributes.normal)g.computeVertexNormals();
    batches.get(key).geos.push(g);remove.push(obj);
  });
  for(const {mat,cast,receive,geos} of batches.values()) {
    const merged=mergeGeometries(geos,false);
    if(!merged)throw new Error('Static geometry batch failed');
    const m=mesh(root,merged,mat,0,0,0,cast);m.receiveShadow=receive;
    m.name='batch:'+mat.color?.getHexString();
    geos.forEach(g=>g.dispose());
  }
  remove.forEach(m=>m.removeFromParent());
}

