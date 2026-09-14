import { THREE, P, mat, windMat, mesh, box, sphere, beam, group, between, random, rng, cylinder } from './core.js';

export function makeBase(parent) {
  box(parent,24,.64,24,0,-.66,0,mat(P.base),.23);
  box(parent,23.92,.13,23.92,0,-.31,0,mat(P.earth),.1);
  box(parent,24,.29,24,0,-.125,0,mat(P.grass),.18);
  box(parent,23.94,.045,23.94,0,.025,0,mat(P.grassLight),.04);
  // The thin reveal around the plinth makes the whole world read as one collectible object.
  for(const side of [-1,1]) {
    box(parent,23.4,.032,.025,0,-.71,side*12.006,mat('#c4baa5'));
    box(parent,.025,.032,23.4,side*12.006,-.71,0,mat('#c4baa5'));
  }
}
function sweepSurface(sections, rows, material, parent) {
  const points=[],indices=[];
  for(const sec of sections) for(const p of rows(sec)) points.push(...p);
  const width=rows(sections[0]).length;
  for(let s=0;s<sections.length-1;s++) for(let j=0;j<width-1;j++) {
    const a=s*width+j,b=a+width;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
  return mesh(parent,geo,material);
}

export function makeTunnel(parent, route, side, large=false) {
  const tunnelLength=large?6.05:5.45;
  const entryS=side===-1?tunnelLength:route.length-tunnelLength;
  const dir=side===-1?-1:1;
  const baseRadius=large?2.57:2.26, baseHeight=large?4.6:3.8;
  const sections=[];
  const at=(s,t)=>{
    const p=route.point(s), tangent=route.tangent(s).multiplyScalar(-dir);
    return {p,t,tangent,right:new THREE.Vector3(tangent.z,0,-tangent.x),
      r:baseRadius*Math.sqrt(Math.max(0,1-t*t))*(1+Math.sin(t*Math.PI)*.06),
      h:baseHeight*Math.sqrt(Math.max(0,1-t*t))*(1+Math.sin(t*Math.PI)*.035)};
  };
  for(let i=0;i<=26;i++) sections.push(at(entryS+dir*tunnelLength*i/26,i/26));
  const outerRow=sec=>Array.from({length:37},(_,j)=>{
    const a=j/36*Math.PI;
    const x=Math.cos(a)*sec.r, y=Math.sin(a)*sec.h;
    return [sec.p.x+sec.right.x*x,y+.065,sec.p.z+sec.right.z*x];
  });
  const innerRow=sec=>{
    const a=[[1.08,.04]];
    for(let j=0;j<=36;j++)a.push([Math.cos(j/36*Math.PI)*1.08,1.65+Math.sin(j/36*Math.PI)*1.50]);
    a.push([-1.08,.04]);
    return a.map(([x,y])=>[sec.p.x+sec.right.x*x,y,sec.p.z+sec.right.z*x]);
  };
  const green=mat(large?'#76aa64':'#89bb6e',{side:THREE.DoubleSide});
  sweepSurface(sections,outerRow,green,parent);
  sweepSurface(sections.filter(s=>s.t<=.54),innerRow,mat('#485f58',{side:THREE.DoubleSide}),parent);
  const entry=sections[0];
  // Solid sculpted arch face; its bottom is open so rails physically pass through it.
  const face=new THREE.Shape();
  face.moveTo(baseRadius,0);
  for(let j=0;j<=36;j++)face.lineTo(Math.cos(j/36*Math.PI)*baseRadius,Math.sin(j/36*Math.PI)*baseHeight);
  face.lineTo(-1.08,0);face.lineTo(-1.08,1.65);
  for(let j=36;j>=0;j--)face.lineTo(Math.cos(j/36*Math.PI)*1.08,1.65+Math.sin(j/36*Math.PI)*1.50);
  face.lineTo(1.08,0);face.closePath();
  const g=group(parent,entry.p.x,.065,entry.p.z,Math.atan2(entry.tangent.x,entry.tangent.z));
  mesh(g,new THREE.ShapeGeometry(face,36),green,0,0,.005);
  const stone=mat('#d9decb'),stone2=mat('#c8d2bf');
  for(const s of [-1,1]) {
    box(g,.29,1.66,.37,s*1.23,.82,.09,stone,.035);
    box(g,.54,.18,.62,s*1.28,.10,.14,stone2,.025);
    for(let y=.38;y<1.4;y+=.37)box(g,.295,.018,.018,s*1.23,y,.284,mat('#b3beac'));
  }
  for(let i=0;i<17;i++) {
    const a=i*Math.PI/17+.008,b=(i+1)*Math.PI/17-.008;
    const sh=new THREE.Shape();
    sh.moveTo(Math.cos(a)*1.09,1.59+Math.sin(a)*1.55);
    sh.lineTo(Math.cos(a)*1.38,1.59+Math.sin(a)*1.84);
    sh.absellipse(0,1.59,1.38,1.84,a,b,false);
    sh.lineTo(Math.cos(b)*1.09,1.59+Math.sin(b)*1.55);
    sh.absellipse(0,1.59,1.09,1.55,b,a,true);sh.closePath();
    mesh(g,new THREE.ExtrudeGeometry(sh,{depth:.3,bevelEnabled:false}),i%3?stone:stone2,0,0,-.06);
  }
  box(g,.62,.28,.13,0,3.61,.08,mat('#b3c4aa'),.035);
  for(let i=0;i<4;i++)box(g,.035,.09,.025,-.13+i*.085,3.615,.16,mat('#7b927d'));
  // Low retaining wings and a narrow rim tie the portal to the surrounding ground.
  for(const side of [-1,1]) for(let i=0;i<4;i++) {
    box(g,.44,.38-i*.06,.38,side*(1.56+i*.39),(.38-i*.06)/2,.24+i*.16,stone2,.045);
  }
  const end=sections.filter(s=>s.t<=.54).at(-1);
  const cap=new THREE.Shape();
  cap.moveTo(-1.07,0);cap.lineTo(1.07,0);cap.lineTo(1.07,1.65);
  cap.absellipse(0,1.65,1.07,1.50,0,Math.PI,false);cap.closePath();
  const endGroup=group(parent,end.p.x,0,end.p.z,Math.atan2(end.tangent.x,end.tangent.z));
  mesh(endGroup,new THREE.ShapeGeometry(cap),new THREE.MeshBasicMaterial({color:'#2b403e',side:THREE.DoubleSide}));
  // Mounded moss and tiny shrubs are actual volumes on the hill surface.
  const rr=rng(large?886:334);
  for(let i=0;i<34;i++) {
    const t=.03+rr()*.90,sec=at(entryS+dir*tunnelLength*t,t),angle=.22+rr()*2.7;
    const p=new THREE.Vector3(sec.p.x+sec.right.x*Math.cos(angle)*sec.r,Math.sin(angle)*sec.h+.08,sec.p.z+sec.right.z*Math.cos(angle)*sec.r);
    const leaf= sphere(parent,.10+rr()*.19,p.x,p.y,p.z,mat(['#a0c586','#a9cc8c','#7fae76','#b2ce90'][i%4]),[1.4,.29,1.0],1);
    leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(sec.right.x*Math.cos(angle),Math.sin(angle)*.85,sec.right.z*Math.cos(angle)).normalize());
  }
  return {entryS,entry:entry.p,outward:entry.tangent};
}
const blooms=['#f6bfd7','#f1a5c6','#e995b9','#ffdfeb','#efb0cd','#facbdf','#d98db0'].map(c=>windMat(c,.042));
const bark=mat(P.bark);
export const treeLocations=[
  [-9.7,8.7,4.2,1.85],[-10.35,2.6,3.75,1.65],[-7.6,2.75,3.0,1.35],
  [-6.7,-6.5,4.6,1.9],[-6.8,-9.45,4.0,1.7],[-3.6,-9.65,4.65,1.95],
  [-.15,-9.55,5.0,2.05],[3.4,-9.35,4.2,1.75],[6.1,-8.85,3.95,1.6],
  [-4.85,-6.9,3.5,1.55],[2.7,-6.5,3.8,1.6],
  [9.55,8.7,4.6,1.92],[10.25,4.5,3.45,1.5],[9.75,2.35,2.65,1.15],
  [-1.35,9.55,3.5,1.65],[-4.0,10.3,2.5,1.2],
  [1.25,-7.75,2.75,1.25],[-10.0,-10.35,2.3,1.02],[9.5,-10.45,2.45,1.13],
  [6.75,10.5,2.55,1.2],[-10.9,10.7,2.4,.95],[-6.35,8.9,2.9,1.35],
].map(([x,z,height,radius])=>{
  // Lift and broaden the flowering canopy. Keep openings around the railway readable.
  const besideRailway=Math.abs(x)>7 && z>0 && z<5;
  return [x,z,height*(besideRailway?1.12:1.18),radius*(besideRailway?1.12:1.20)];
});
export function makeTree(parent,x,z,height,radius,seed) {
  const rand=rng(seed),rr=(a,b)=>a+(b-a)*rand();
  const leanX=rr(-.35,.35),leanZ=rr(-.25,.25);
  const p0=[x,.04,z],p1=[x+leanX*.4,height*.3,z+leanZ*.5],p2=[x+leanX,height*.64,z+leanZ];
  beam(parent,p0,p1,height*.047,bark,height*.034,8);
  beam(parent,p1,p2,height*.034,bark,height*.013,7);
  for(let i=0;i<5;i++) {
    const a=i/5*Math.PI*2+rr(-.3,.3),len=radius*rr(.63,.96);
    const start=[p1[0],height*rr(.34,.46),p1[2]];
    const elbow=[x+Math.cos(a)*len*.58,height*rr(.55,.65),z+Math.sin(a)*len*.58];
    const tip=[x+Math.cos(a)*len,height*rr(.71,.84),z+Math.sin(a)*len];
    beam(parent,start,elbow,height*.022,bark,height*.016,7);
    beam(parent,elbow,tip,height*.016,bark,height*.004,6);
    const twig=[tip[0]+Math.cos(a+.8)*.3,tip[1]+.34,tip[2]+Math.sin(a+.8)*.3];
    beam(parent,elbow,twig,height*.012,bark,.008,5);
  }
  // Nested lobes make an airy, uneven canopy with a real silhouette at every angle.
  const clusters=[];
  clusters.push([x+leanX,height*.84,z+leanZ,radius*.66]);
  for(let i=0;i<8;i++) {
    const a=i/8*Math.PI*2+rr(-.18,.18),d=radius*rr(.44,.73);
    clusters.push([x+Math.cos(a)*d,height*rr(.66,.85),z+Math.sin(a)*d,radius*rr(.40,.56)]);
  }
  for(let i=0;i<clusters.length;i++) {
    const [cx,cy,cz,r]=clusters[i];
    sphere(parent,r,cx,cy,cz,blooms[(i+seed)%blooms.length],[rr(.87,1.13),rr(.66,.85),rr(.92,1.1)],2);
    for(let j=0;j<13;j++) {
      const a=rr(0,Math.PI*2),v=rr(-.25,.9),d=r*rr(.62,.87);
      const b=sphere(parent,r*rr(.25,.40),cx+Math.cos(a)*d,cy+v*r*.64,cz+Math.sin(a)*d,blooms[(i+j+seed+1)%blooms.length],[1,rr(.7,.97),rr(.83,1.13)],1);
      b.rotation.set(rr(0,2),rr(0,3),rr(0,2));
    }
  }
  for(let i=0;i<5;i++)beam(parent,[x,.14,z],[x+Math.cos(i*1.26)*.28,.055,z+Math.sin(i*1.26)*.28],height*.028,bark,.012,6);
}
export function makeTrees(parent) {treeLocations.forEach((p,i)=>makeTree(parent,...p,137+i*61));}
export function bush(parent,x,z,r=.4,y=0,color=P.hedge) {
  for(let i=0;i<3;i++)sphere(parent,r*(.66+i*.08),x+(i-1)*r*.46,y+r*.48,z+(i%2)*r*.24,mat(color),[1,.84,.9],1);
}

export function makeMeadow(parent, roads, route) {
  const rand=rng(9042), dummy=new THREE.Object3D();
  const acceptable=(x,z)=>{
    if(Math.abs(x)>11.65||Math.abs(z)>11.65)return false;
    if(z<-1&&Math.abs(x)>6.9)return false;
    if(x>-6.6&&x<4.2&&z<-.65&&z>-6.5)return false;
    if(x>-8.6&&x<-4.0&&z>5.1&&z<8.5)return false;
    if(x>4.7&&x<8.1&&z>6.1&&z<10.1)return false;
    if(x>-4.0&&x<-2.1&&z>6.9&&z<9)return false;
    for(const p of roads) if(Math.hypot(x-p.x,z-p.z)<1.14)return false;
    for(let s=0;s<route.length;s+=.45){const p=route.point(s);if(Math.hypot(x-p.x,z-p.z)<1.05)return false;}
    return true;
  };
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.026,0,0,.026,0,0,.035,.21,.014,0,.15,-.025,0,0,-.029,0,0,.029],3));
  geometry.setIndex([0,1,2,3,4,5]);geometry.computeVertexNormals();
  const grassMaterial=mat('#68a052',{side:THREE.DoubleSide}).clone();
  grassMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uWind={value:0};
    grassMaterial.userData.shader=shader;
    shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.x += sin(uWind*0.8+instanceMatrix[3].x*0.7+instanceMatrix[3].z)*position.y*.09;
    `);
  };
  const blades=new THREE.InstancedMesh(geometry,grassMaterial,2400);
  blades.receiveShadow=true;let n=0;
  for(let i=0;i<11000&&n<2400;i++) {
    const x=(rand()-.5)*23.5,z=(rand()-.5)*23.5;if(!acceptable(x,z))continue;
    dummy.position.set(x,.052,z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.setScalar(.34+rand()*.39);dummy.updateMatrix();
    blades.setMatrixAt(n++,dummy.matrix);
  }
  blades.count=n;parent.add(blades);
  const petalGeo=new THREE.SphereGeometry(1,5,3),littleFlowers=new THREE.InstancedMesh(petalGeo,mat('#f9eddf'),600);
  let f=0;for(let i=0;i<2400&&f<600;i++){
    const x=(rand()-.5)*23.2,z=(rand()-.5)*23.2;if(!acceptable(x,z))continue;
    dummy.position.set(x,.079,z);dummy.rotation.set(0,rand()*6,0);dummy.scale.set(.035+rand()*.028,.025,.035);dummy.updateMatrix();littleFlowers.setMatrixAt(f,dummy.matrix);
    littleFlowers.setColorAt(f,new THREE.Color(f%4===0?'#ecc092':f%3===0?'#edbfd2':'#fbf1d3'));f++;
  }littleFlowers.count=f;parent.add(littleFlowers);
  const fallen=new THREE.InstancedMesh(new THREE.CircleGeometry(1,5),mat('#f7cbda',{side:THREE.DoubleSide}),1500);let fi=0;
  for(const [x,z,h,r]of treeLocations)for(let j=0;j<68;j++){
    const a=rand()*6.28,d=Math.sqrt(rand())*r*1.2,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
    if(Math.abs(px)>11.78||Math.abs(pz)>11.78)continue;
    dummy.position.set(px,.065,pz);dummy.rotation.set(-Math.PI/2,0,rand()*6);dummy.scale.set(.025+rand()*.027,.018+rand()*.018,1);dummy.updateMatrix();fallen.setMatrixAt(fi++,dummy.matrix);
  }fallen.count=fi;parent.add(fallen);
  return t=>{if(grassMaterial.userData.shader)grassMaterial.userData.shader.uniforms.uWind.value=t;};
}

export function makePetals(parent) {
  const rand=rng(649),count=900,dummy=new THREE.Object3D();
  const shape=new THREE.Shape();shape.moveTo(0,-.06);shape.bezierCurveTo(-.065,-.015,-.065,.055,-.012,.067);shape.lineTo(0,.052);shape.lineTo(.012,.067);shape.bezierCurveTo(.065,.055,.065,-.015,0,-.06);
  const geo=new THREE.ShapeGeometry(shape,4);
  const petals=new THREE.InstancedMesh(geo,mat('#fff6fb',{side:THREE.DoubleSide}),count);
  petals.name='falling-sakura-petals';
  petals.userData.dynamic=true;petals.frustumCulled=false;parent.add(petals);
  const records=Array.from({length:count},(_,i)=>{
    const [tx,tz,height,radius]=treeLocations[Math.floor(rand()*treeLocations.length)];
    // Share the fall between the crowns and the open air above the station and road.
    const fromTree=rand()<.5,angle=rand()*Math.PI*2,spread=radius*(.45+rand()*.95);
    petals.setColorAt(i,new THREE.Color(['#f6b3cf','#eda0c3','#fff0f6','#e994ba'][i%4]));
    return {
      x:THREE.MathUtils.clamp(fromTree?tx+Math.cos(angle)*spread:(rand()-.5)*21,-10.2,10.2),
      z:THREE.MathUtils.clamp(fromTree?tz+Math.sin(angle)*spread:(rand()-.5)*21,-10.2,10.2),
      top:fromTree?height*(.90+rand()*.22)+.35:3.4+rand()*3.8,
      offset:rand(),phase:rand()*Math.PI*2,speed:.25+rand()*.325,
      scale:.78+rand()*.72,drift:(rand()-.5)*1.6,
    };
  });
  return time=>{
    for(let i=0;i<count;i++){
      const p=records[i],progress=(p.offset+time*p.speed/p.top)%1,y=p.top*(1-progress);
      dummy.position.set(p.x+Math.sin(time*.50+p.phase)*.68+p.drift*progress,y+.1,p.z+Math.sin(time*.36+p.phase)*.54+.55*progress);
      dummy.rotation.set(Math.sin(time*.90+p.phase)*1.1,time*.50+p.phase,Math.cos(time*.72+p.phase));
      dummy.scale.setScalar(p.scale*Math.min(1,progress*12,(1-progress)*12));dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);
    }petals.instanceMatrix.needsUpdate=true;
  };
}

