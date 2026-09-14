import './style.css';
import { THREE, P, mat, wind, batchStatic } from './core.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeBase, makeTunnel, makeTrees, makeMeadow, makePetals } from './landscape.js';
import { createRoute, makeRailway, makeRoads, makeCrossing, makeUtilities } from './railway.js';
import { makeStation, makeNeighborhood } from './station.js';
import { makeTrain } from './train.js';
import { initMusic } from './music.js';

const canvas=document.querySelector('#scene');
initMusic(canvas);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.localClippingEnabled=true;
renderer.info.autoReset=false;
const scene=new THREE.Scene();
const camera=new THREE.OrthographicCamera(-20,20,15,-15,.1,160);
camera.position.set(17,26,38);
const controls=new OrbitControls(camera,canvas);
controls.target.set(0,1.25,0);
controls.enableDamping=true;controls.dampingFactor=.075;
controls.rotateSpeed=.65;controls.zoomSpeed=.83;controls.panSpeed=.7;
controls.minZoom=.68;controls.maxZoom=3.35;
controls.minPolarAngle=.22;controls.maxPolarAngle=Math.PI*.477;
controls.screenSpacePanning=true;
controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
controls.update();
// Neutral skylight keeps white enamel clean; warmth comes from the sun, not green fill.
scene.add(new THREE.HemisphereLight('#f8f6f4','#adaeb4',1.38));
const sun=new THREE.DirectionalLight('#fff4e8',2.1);
sun.position.set(-12,22,11);sun.castShadow=true;
sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;
sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.normalBias=.035;sun.shadow.bias=-.00012;sun.shadow.radius=3;
sun.target.position.set(0,0,0);scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#edf0fa',.55);fill.position.set(10,13,-10);scene.add(fill);
const world=new THREE.Group();world.name='sakura-diorama';scene.add(world);
const route=createRoute();
makeBase(world);
const roads=makeRoads(world);
makeRailway(world,route);
const tunnels=[makeTunnel(world,route,-1),makeTunnel(world,route,1,true)];
makeStation(world);
makeNeighborhood(world);
makeTrees(world);
makeUtilities(world,route);
const meadow=makeMeadow(world,roads,route);
const crossing=makeCrossing(world);
const train=makeTrain(world,route,tunnels);
const petals=makePetals(world);
batchStatic(world);
// An invisible receiving plane gives the plinth one quiet grounding shadow.
const stage=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#7f8e89',opacity:.15}));
stage.rotation.x=-Math.PI/2;stage.position.y=-1.01;stage.receiveShadow=true;scene.add(stage);

const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,target);
composer.addPass(new RenderPass(scene,camera));
const ao=new GTAOPass(scene,camera,800,600);
ao.blendIntensity=.36;
ao.updateGtaoMaterial({radius:.42,thickness:.85,distanceFallOff:1,scale:1,samples:8});
ao.updatePdMaterial({radius:5,rings:2,samples:8});
composer.addPass(ao);
const output=new OutputPass();
// Unpremultiply before tone mapping, then restore alpha. This keeps silhouettes and
// soft shadows clean against the CSS gradient, including antialiased edge pixels.
output.material.fragmentShader=output.material.fragmentShader
  .replace('gl_FragColor = texture2D( tDiffuse, vUv );',
    'gl_FragColor = texture2D( tDiffuse, vUv ); gl_FragColor.rgb /= max(gl_FragColor.a, 0.00001);');
const outputEnd=output.material.fragmentShader.lastIndexOf('}');
output.material.fragmentShader=output.material.fragmentShader.slice(0,outputEnd)+'gl_FragColor.rgb *= gl_FragColor.a;\n'+output.material.fragmentShader.slice(outputEnd);
composer.addPass(output);
function resize(){
  const w=innerWidth,h=innerHeight,aspect=w/h;
  // Fit the whole square even on a portrait screen; zoom remains under the user's control.
  const halfH=Math.max(14.3,17.35/aspect);
  camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  composer.setSize(w,h);
  ao.setSize(Math.round(w*.75),Math.round(h*.75));
}
window.addEventListener('resize',resize);resize();
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let last=performance.now(),elapsed=0,manualTime=null,paused=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const timings=[];
function render(now){
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(!paused&&!document.hidden)elapsed+=dt*(reducedMotion.matches?.24:1);
  const t=manualTime??elapsed;
  wind.value=t;meadow(t);petals(t);
  const state=train.update(t);crossing.update(t,state.close,dt);
  controls.update();
  renderer.info.reset();
  composer.render();
  timings.push(dt*1000);if(timings.length>180)timings.shift();
}
renderer.setAnimationLoop(render);
document.addEventListener('visibilitychange',()=>{last=performance.now();});
// Local-only inspection hooks; these do not add an inspection panel to the page.
if(import.meta.env.DEV){
  window.__sakura={
    ready:true,scene,camera,controls,renderer,route,ao,
    inspect:()=>({
      train:train.getState(),crossing:crossing.getState(),
      camera:{position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom},
      render:{...renderer.info.render,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},
      frameMs:timings.reduce((a,b)=>a+b,0)/Math.max(1,timings.length),
      canvas:{width:canvas.width,height:canvas.height},
      bounds:new THREE.Box3().setFromObject(world).min.toArray()
    }),
    setTime:t=>{manualTime=t;},resume:()=>{manualTime=null;},
    setView:(x,y,z,zoom=1)=>{controls.target.set(0,1.25,0);camera.position.set(x,y,z);camera.zoom=zoom;camera.updateProjectionMatrix();controls.update();},
    pause:()=>{paused=true;},
  };
}

