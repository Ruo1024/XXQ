import { THREE, P, mat, mesh, box, cylinder, beam, wire, group, between, random, fence, sign } from './core.js';

export function createRoute() {
  const curve=new THREE.CatmullRomCurve3([
    [-10.1,0,-6.8],[-9.8,0,-4.1],[-8.2,0,-1.5],[-5.5,0,0],[0,0,0],[5.5,0,0],[8.2,0,-1.5],[9.8,0,-4.1],[10.1,0,-7.4]
  ].map(p=>new THREE.Vector3(...p)),false,'catmullrom',.35);
  curve.arcLengthDivisions=1500;
  const length=curve.getLength();
  const point=s=>{
    if(s<0)return curve.getPointAt(0).addScaledVector(curve.getTangentAt(0),s);
    if(s>length)return curve.getPointAt(1).addScaledVector(curve.getTangentAt(1),s-length);
    return curve.getPointAt(s/length);
  };
  const tangent=s=>curve.getTangentAt(THREE.MathUtils.clamp(s/length,0,1));
  const nearest=(x,z)=>{let best=0,min=Infinity;for(let s=0;s<length;s+=.025){const p=point(s),d=(x-p.x)**2+(z-p.z)**2;if(d<min){best=s;min=d;}}return best;};
  return {curve,length,point,tangent,nearest};
}
export function ribbon(parent, curve, width, y, material, offset=0, segments=200, thickness=0) {
  const vertices=[],indices=[];
  for(let i=0;i<=segments;i++){
    const p=curve.getPointAt(i/segments),t=curve.getTangentAt(i/segments),n=new THREE.Vector3(t.z,0,-t.x);
    for(const side of [-1,1])vertices.push(THREE.MathUtils.clamp(p.x+n.x*(offset+side*width/2),-11.96,11.96),y,THREE.MathUtils.clamp(p.z+n.z*(offset+side*width/2),-11.96,11.96));
  }
  for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();
  const top=mesh(parent,geo,material);
  if(thickness)for(const side of [-1,1]){
    const verts=[],idx=[];
    for(let i=0;i<=segments;i++){
      const p=curve.getPointAt(i/segments),t=curve.getTangentAt(i/segments),nx=t.z,nz=-t.x;
      for(const h of [y-thickness,y])verts.push(THREE.MathUtils.clamp(p.x+nx*(offset+side*width/2),-11.96,11.96),h,THREE.MathUtils.clamp(p.z+nz*(offset+side*width/2),-11.96,11.96));
    }
    for(let i=0;i<segments;i++){let a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();mesh(parent,g,mat('#a7b1a7',{side:THREE.DoubleSide}));
  }
  return top;
}
export function makeRailway(parent,route) {
  // End the physical track inside the dark chambers, before the hillside tapers to ground.
  const start=2.25,end=route.length-2.5;
  const trackCurve=new THREE.Curve();
  trackCurve.getPoint=t=>route.point(start+(end-start)*t);
  trackCurve.getTangent=t=>route.tangent(start+(end-start)*t);

  ribbon(parent,trackCurve,1.89,.11,mat('#a4aba5'),0,250,.065);
  ribbon(parent,trackCurve,1.64,.135,mat('#969f99'),0,250);
  for(let s=start;s<end;s+=.36){
    const p=route.point(s),t=route.tangent(s),angle=Math.atan2(t.x,t.z);
    const sleeper=box(parent,1.46,.11,.14,p.x,.175,p.z,mat('#7c7669'),.014);sleeper.rotation.y=angle;
    for(const side of [-1,1]){
      const x=p.x+t.z*.49*side,z=p.z-t.x*.49*side;
      const plate=box(parent,.19,.035,.19,x,.241,z,mat('#5c6460'));plate.rotation.y=angle;
    }
  }
  for(const side of [-1,1]) {
    ribbon(parent,trackCurve,.085,.254,mat('#5a6562'),side*.49,350,.09);
    ribbon(parent,trackCurve,.071,.282,mat('#c5ccc2'),side*.49,350);
  }
  const stoneGeo=new THREE.IcosahedronGeometry(1,0),stoneMat=mat('#b6bcb0'),n=2100,dummy=new THREE.Object3D();
  const stones=new THREE.InstancedMesh(stoneGeo,stoneMat,n);stones.receiveShadow=true;
  for(let i=0;i<n;i++){
    const s=start+random()*(end-start),p=route.point(s),t=route.tangent(s),o=(random()-.5)*1.86;
    dummy.position.set(p.x+t.z*o,.145,p.z-t.x*o);dummy.rotation.set(random()*3,random()*3,random()*3);
    dummy.scale.set(between(.035,.085),between(.018,.04),between(.03,.08));dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
    stones.setColorAt(i,new THREE.Color(['#b0b4a9','#989f98','#c0c3b6','#a4aba3'][i%4]));
  }parent.add(stones);
}
export function makeRoads(parent) {
  const roads=[
    new THREE.CatmullRomCurve3([[-12,0,5.1],[-8.8,0,4.1],[-5,0,4.35],[0,0,4.7],[4.8,0,5.2],[8.4,0,5.8],[12,0,6]].map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5),
    new THREE.CatmullRomCurve3([[3.7,0,12],[3.8,0,8.3],[5.35,0,3.4],[5.45,0,0],[5.45,0,-4.6],[4.8,0,-7.25]].map(p=>new THREE.Vector3(...p)),false,'catmullrom',.3)
  ];
  const samples=[];
  for(let ri=0;ri<roads.length;ri++){
    const c=roads[ri],len=c.getLength();
    ribbon(parent,c,2.04,.076,mat('#d0d6c9'),0,180,.033);
    ribbon(parent,c,1.86,.085+ri*.002,mat(P.road));
    for(let s=0;s<len;s+=.25)samples.push(c.getPointAt(s/len));
    for(let s=.4;s<len-.3;s+=.98){
      const p=c.getPointAt(s/len),t=c.getTangentAt(s/len);
      if((p.x>2.6&&p.x<6.8&&p.z>3.6&&p.z<6.5)||(ri===1&&p.z>-1.9&&p.z<1.9))continue;
      const d=box(parent,.045,.008,.42,p.x,.099,p.z,mat('#e5e5cc'));d.rotation.y=Math.atan2(t.x,t.z);
    }
    for(let side of [-1,1])for(let s=.12;s<len;s+=.22){
      const p=c.getPointAt(s/len),t=c.getTangentAt(s/len);
      if((p.x>2.8&&p.x<6.4&&p.z>3.65&&p.z<6.2)||(ri===1&&Math.abs(p.z)<1.22))continue;
      const d=box(parent,.036,.009,.225,p.x+t.z*.76*side,.101,p.z-t.x*.76*side,mat('#dbe1d1'));d.rotation.y=Math.atan2(t.x,t.z);
    }
  }
  // Station approach and irregular stepping stones are raised, shallow solids.
  box(parent,2.1,.04,1.8,3.88,.078,-5.5,mat(P.pavement),.07);
  for(let i=0;i<8;i++)box(parent,.48,.028,.52,-3.15+i*.52,.083,-6.65,mat('#d3d3bd'),.035);
  for(let i=0;i<5;i++)box(parent,.5,.015,.09,5.45,.11,-3.35+i*.17,mat('#e8e6d0'));
  return samples;
}
function crossbuck(g,y) {
  for(const a of [-Math.PI/4,Math.PI/4]){
    const b=box(g,.1,1.04,.065,0,y,0,mat(P.yellow),.014);b.rotation.z=a;
    for(const side of [-1,1]){
      const d=box(g,.105,.22,.07,-Math.sin(a)*side*.35,y+Math.cos(a)*side*.35,.001,mat(P.dark));d.rotation.z=a;
    }
  }
}
export function makeCrossing(parent) {
  const root=group(parent,5.45,0,-.02);
  box(root,1.86,.17,2.06,0,.15,0,mat('#acb4a8'),.025);
  for(let i=0;i<11;i++){
    const z=-.91+i*.182;
    if(Math.abs(Math.abs(z)-.49)<.095)continue;
    box(root,1.79,.045,.15,0,.257,z,mat(i%2?'#b7bbae':'#c3c6b8'),.008);
  }
  const gates=[],lights=[];
  for(const side of [-1,1]){
    const g=group(root,side*1.24,0,side===-1?1.43:-1.43,side===-1?0:Math.PI);
    box(g,.39,.20,.38,0,.16,0,mat(P.concrete),.035);
    cylinder(g,.052,.065,2.9,0,1.56,0,mat(P.yellow),10);
    for(let y=.42;y<2.48;y+=.35)cylinder(g,.066,.066,.15,0,y,0,mat(P.dark),10);
    crossbuck(g,2.78);
    beam(g,[-.38,2.23,0],[.38,2.23,0],.038,mat(P.dark));
    for(const lr of [-1,1]){
      const housing=cylinder(g,.18,.185,.13,lr*.28,2.22,.015,mat(P.dark),16);housing.rotation.x=Math.PI/2;
      const red=new THREE.MeshStandardMaterial({color:'#ad655b',emissive:'#ed6151',emissiveIntensity:0,roughness:.6});
      const lens=cylinder(g,.129,.129,.022,lr*.28,2.22,.089,red,16);lens.rotation.x=Math.PI/2;
      const hood=mesh(g,new THREE.CylinderGeometry(.19,.19,.16,14,1,true,0,Math.PI),mat(P.dark),lr*.28,2.255,.06);hood.rotation.x=Math.PI/2;hood.rotation.z=Math.PI/2;
      lights.push({material:red,index:lr===-1?0:1});lens.userData.dynamic=true;
    }
    box(g,.27,.39,.29,0,.83,0,mat('#dabf76'),.035);
    const hinge=group(g,0,1.09,0);hinge.userData.dynamic=true;
    box(hinge,2.48,.082,.08,1.14,0,0,mat(P.yellow),.015);
    for(let x=.06;x<2.3;x+=.29)box(hinge,.14,.087,.086,x,0,0,mat(P.dark));
    box(hinge,.32,.19,.21,-.19,0,0,mat(P.dark),.03);
    gates.push(hinge);
    box(g,.27,.18,.065,0,1.68,.09,mat('#eee3bf'),.015);
  }
  for(const side of [-1,1]){
    box(root,1.5,.012,.12,0,.113,side*2.03,mat('#ece8d1'));
    fence(root,[side*1.45,0,side*2.0],[side*1.45,0,side*3.1],.58,mat('#e2e5cf'));
  }
  // Track circuit cabinet, junction box and a small signal beyond the crossing.
  box(root,.56,.85,.43,1.75,.5,-1.68,mat('#c5d0bf'),.035);
  box(root,.58,.065,.48,1.75,.94,-1.68,mat('#a0b2a2'),.02);
  for(let i=0;i<5;i++)box(root,.3,.023,.015,1.75,.29+i*.085,-1.453,mat('#879a8e'));
  box(root,.19,.3,.16,-2.0,.22,.91,mat(P.stone),.025);
  const state={closed:0};
  return {
    update(time,close,dt){
      state.closed=THREE.MathUtils.damp(state.closed,close?1:0,1.45,dt);
      for(const g of gates)g.rotation.z=(1-state.closed)*1.43;
      for(const light of lights){const on=close&&Math.floor(time*1.65)%2===light.index;light.material.emissiveIntensity=on?2.1:0;light.material.color.set(on?'#f28670':'#985a55');}
    },
    getState:()=>({closed:state.closed,angle:(1-state.closed)*1.43,lights:lights.map(l=>l.material.emissiveIntensity)})
  };
}
export function makeUtilities(parent,route) {
  const poleMaterial=mat('#a1ad9b'),black=mat('#576d68');
  const positions=[[-8.1,1.17],[-3.9,1.25],[2.8,1.27],[7.3,-.65]];
  for(let i=0;i<positions.length;i++){
    const [x,z]=positions[i];
    cylinder(parent,.074,.12,3.57,x,1.815,z,poleMaterial,10);
    cylinder(parent,.135,.145,.53,x,.3,z,mat('#b7bba7'),8);
    beam(parent,[x,3.31,z+.12],[x,3.31,z-1.7],.035,black);
    beam(parent,[x,2.78,z],[x,3.31,z-1.6],.024,black);
    for(const dz of [-.04,-1.58]){
      cylinder(parent,.065,.065,.16,x,3.41,z+dz,mat(P.cream),7);
      for(let k=0;k<3;k++)cylinder(parent,.084,.084,.018,x,3.36+k*.048,z+dz,mat(P.cream),8);
    }
    box(parent,.2,.12,.16,x,1.2,z+.075,mat(P.white),.015);
  }
  for(let i=0;i<positions.length-1;i++){
    const [x,z]=positions[i],[nx,nz]=positions[i+1];
    wire(parent,[[x,3.31,z-1.58],[(x+nx)/2,3.04,(z+nz)/2-1.58],[nx,3.31,nz-1.58]],.014,black,36);
    wire(parent,[[x,3.54,z-1.58],[(x+nx)/2,3.39,(z+nz)/2-1.58],[nx,3.54,nz-1.58]],.013,black,36);
    for(let t=.2;t<1;t+=.23){const xx=THREE.MathUtils.lerp(x,nx,t),zz=THREE.MathUtils.lerp(z,nz,t)-1.58;beam(parent,[xx,3.31-.24*Math.sin(t*Math.PI),zz],[xx,3.54-.15*Math.sin(t*Math.PI),zz],.009,black,.009,4);}
  }
  const streetPoles=[[-10.1,5.3],[-4.05,5.55],[2.6,6.46],[7.65,5.4],[6.8,-5.65]];
  for(const [x,z]of streetPoles){
    cylinder(parent,.076,.105,4.3,x,2.19,z,mat('#9b9b85'),10);
    for(const y of [3.8,4.16]){
      beam(parent,[x-.52,y,z],[x+.52,y,z],.041,black);
      for(const dx of [-.42,0,.42]){cylinder(parent,.055,.055,.12,x+dx,y+.07,z,mat(P.cream),7);cylinder(parent,.07,.07,.025,x+dx,y+.11,z,mat(P.cream),7);}
    }
    cylinder(parent,.19,.19,.46,x+.23,3.2,z,mat('#afbbb0'),12);
    wire(parent,[[x,3.45,z],[x+.35,3.5,z],[x+.26,3.02,z]],.014,black,8);
    for(let y=.3;y<1.3;y+=.27)cylinder(parent,.109,.109,.14,x,y,z,mat('#c3b475'),8);
  }
  for(let i=0;i<streetPoles.length-1;i++){
    const [x,z]=streetPoles[i],[xx,zz]=streetPoles[i+1];
    for(const offset of [-.4,0,.4])wire(parent,[[x+offset,4.26,z],[(x+xx)/2+offset,3.85,(z+zz)/2],[xx+offset,4.26,zz]],.012,black,32);
  }
}

