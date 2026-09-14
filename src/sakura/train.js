import { THREE, P, mat, mesh, box, cylinder, beam, wire, group, sign, batchStatic } from './core.js';

function carriage(parent,cabSide=1,panto=false) {
  const c=group(parent);c.userData.dynamic=true;
  const white=mat(P.train),silver=mat('#d8dce1'),dark=mat('#435463'),glass=mat('#416477'),teal=mat('#48a7b1'),pink=mat('#e895b2');
  box(c,3.91,1.29,1.28,0,1.18,0,white,.14);
  box(c,3.86,.20,1.32,0,.574,0,mat('#9ca7b1'),.055);
  box(c,3.96,.205,1.25,0,1.884,0,silver,.105);
  box(c,3.8,.055,1.11,0,1.993,0,mat('#edf0f4'),.025);
  for(const side of [-1,1]){
    const z=side*.645;
    box(c,3.87,.118,.024,0,.879,z,pink,.014);
    box(c,3.87,.067,.026,0,.748,z,teal,.012);
    box(c,3.75,.024,.022,0,1.728,z,mat('#b9c2cc'));
    for(const x of [-1.18,1.18]){
      box(c,.46,1.08,.033,x,1.15,z+side*.011,mat('#aeb9c5'),.024);
      box(c,.405,1.019,.015,x,1.155,z+side*.032,mat('#fff8f3'),.02);
      box(c,.29,.41,.025,x,1.421,z+side*.05,glass,.023);
      box(c,.009,.58,.01,x,.944,z+side*.051,mat('#9daebb'));
      box(c,.025,.065,.018,x+.125,1.13,z+side*.063,mat('#718897'));
      box(c,.37,.025,.058,x,.638,z+side*.055,mat('#788d9c'));
      box(c,.039,.33,.008,x-.081,1.44,z+side*.065,mat('#9abccd'));
    }
    for(const x of [-.63,0,.63]){
      box(c,.52,.566,.042,x,1.398,z+side*.01,mat('#8295a6'),.035);
      box(c,.466,.51,.020,x,1.399,z+side*.037,glass,.035);
      box(c,.020,.49,.011,x,1.4,z+side*.054,mat('#d2dce5'));
      const refl=box(c,.044,.40,.005,x-.145,1.413,z+side*.053,mat('#9dc1d4'));refl.rotation.z=-.14;
      box(c,.45,.030,.021,x,1.164,z+side*.051,mat('#c7d2dc'));
    }
    const x=cabSide*1.7;
    box(c,.37,.53,.036,x,1.404,z+side*.015,mat('#8596a5'),.028);
    box(c,.31,.465,.018,x,1.411,z+side*.039,glass,.025);
    box(c,.065,.2,.016,cabSide*1.92,1.02,z+side*.043,mat('#d4dae1'),.01);
    // Small, physical maintenance lettering and a ventilation grill.
    for(let i=0;i<4;i++)box(c,.045,.032,.009,-.20+i*.095,.648,z+side*.024,mat('#7a8d9f'));
  }
  const front=group(c,cabSide*1.954,0,0,cabSide*Math.PI/2);
  box(front,1.105,.67,.045,0,1.427,.005,mat('#597586'),.065);
  box(front,1.003,.53,.024,0,1.439,.035,glass,.046);
  box(front,.035,.515,.025,0,1.44,.051,mat('#dce4ea'));
  for(const x of [-.252,.252]){
    const refl=box(front,.06,.40,.007,x-.13,1.468,.052,mat('#adcbdc'));refl.rotation.z=-.15;
    beam(front,[x-.15,1.216,.067],[x+.05,1.32,.067],.010,mat('#354e50'),.01,5);
  }
  box(front,1.18,.116,.045,0,.883,.023,pink,.02);
  box(front,1.18,.066,.047,0,.75,.024,teal,.015);
  for(const x of [-.42,.42]){
    box(front,.19,.14,.055,x,1.02,.04,mat('#91a0ad'),.025);
    box(front,.143,.09,.025,x,1.024,.078,mat(cabSide===1?'#fff1c5':'#df9a94',{emissive:cabSide===1?'#e4c98f':'#bb6b65',emissiveIntensity:.35}),.015);
  }
  sign(front,'桜 春',.56,.13,0,1.806,.01,{background:'#4e6867',color:'#e5e8d6',stripe:false});
  box(front,.59,.11,.26,0,.531,.16,dark,.025);
  box(front,.21,.11,.27,0,.466,.24,mat('#81938a'),.035);
  for(const x of [-.39,.39])wire(front,[[x,.60,.08],[x,.40,.17],[x+.06,.35,.13]],.022,dark,8);
  // Accordion bellows at the internal end and a visible coupler underneath.
  const innerX=-cabSide*2.0;
  box(c,.22,1.02,.91,innerX,1.13,0,mat('#78828e'),.065);
  for(let i=0;i<4;i++)box(c,.022,1.02,.93,innerX-.083+i*.055,1.13,0,mat('#526862'),.014);
  box(c,.25,.08,.17,innerX,.46,0,mat('#415854'),.015);
  // Two bogies, eight steel wheels, springs, underfloor electrical and air equipment.
  for(const x of [-1.20,1.20]){
    box(c,.84,.16,1.01,x,.453,0,dark,.045);
    for(const dx of [-.24,.24]){
      beam(c,[x+dx,.429,-.62],[x+dx,.429,.62],.055,mat('#6e7d73'),.055,8);
      for(const side of [-1,1]){
        const wheel=cylinder(c,.177,.177,.105,x+dx,.426,side*.535,mat('#3f5350'),16);wheel.rotation.x=Math.PI/2;
        const hub=cylinder(c,.080,.080,.11,x+dx,.426,side*.56,mat('#9aab9d'),12);hub.rotation.x=Math.PI/2;
      }
    }
    for(const side of [-1,1]){
      box(c,.69,.072,.07,x,.432,side*.62,mat('#7c8e82'),.018);
      for(let i=0;i<3;i++)box(c,.16,.028,.077,x,.494+i*.029,side*.62,mat('#adc0ad'));
    }
  }
  box(c,.78,.26,.78,-.26,.474,0,mat('#82958c'),.03);
  box(c,.30,.20,.66,.49,.48,0,mat('#afbbae'),.025);
  for(let i=0;i<6;i++)box(c,.024,.15,.023,-.55+i*.106,.476,.403,mat('#586f64'));
  const tank=cylinder(c,.113,.113,.59,.62,.49,-.4,mat('#697e74'),12);tank.rotation.z=Math.PI/2;
  for(const x of [-.85,.86]){
    box(c,.62,.195,.72,x,2.075,.0,mat('#d2d7df'),.065);
    box(c,.50,.032,.55,x,2.182,.0,mat('#e7ecf3'),.02);
    for(let i=0;i<6;i++)box(c,.36,.02,.024,x,2.205,-.205+i*.077,mat('#899aaa'));
  }
  if(panto){
    for(const x of [-.23,.23])for(const z of [-.39,.09])cylinder(c,.055,.055,.14,x,2.08,z,mat('#ede7cc'),8);
    box(c,.69,.06,.49,0,2.17,-.15,mat('#5f786f'),.018);
    for(const z of [-.34,.02]){
      beam(c,[-.28,2.2,z],[.25,2.60,z],.022,dark);
      beam(c,[.25,2.60,z],[-.13,3.015,z],.019,dark);
      beam(c,[.28,2.2,z],[-.25,2.60,z],.022,dark);
      beam(c,[-.25,2.60,z],[-.13,3.015,z],.019,dark);
    }
    beam(c,[-.13,3.035,-.63],[-.13,3.035,.37],.026,mat('#576e65'));
    beam(c,[-.13,3.065,-.47],[-.13,3.065,.23],.041,mat('#8fa294'));
  }else{
    box(c,.45,.095,.60,0,2.063,0,mat('#d4dde7'),.035);
  }
  beam(c,[cabSide*1.64,2.0,.25],[cabSide*1.64,2.29,.25],.015,dark);
  batchStatic(c);
  return c;
}
export function makeTrain(parent,route,tunnels) {
  const root=group(parent);root.name='two-car-sakura-train';root.userData.dynamic=true;
  const cars=[carriage(root,1,true),carriage(root,-1,false)];
  const planes=tunnels.map(t=>{
    const inside=t.entry.clone().addScaledVector(t.outward,-1.65);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(t.outward,inside);
  });
  const cloned=new Map();
  root.traverse(o=>{if(o.isMesh){if(!cloned.has(o.material.uuid)){const m=o.material.clone();m.clippingPlanes=planes;m.clipShadows=true;cloned.set(o.material.uuid,m);}o.material=cloned.get(o.material.uuid);}});
  const stop=route.nearest(1.70,0),crossS=route.nearest(5.45,0),speed=1.14;
  const spacing=4.19,hiddenEnd=route.length+6.1,hiddenStart=-3.5;
  const dwell=12,departTime=(hiddenEnd-stop)/speed,arriveTime=(stop-hiddenStart)/speed,cycle=dwell+departTime+arriveTime;
  let state={};
  function update(time){
    const t=time%cycle;let s,phase;
    if(t<dwell){s=stop;phase='station';}
    else if(t<dwell+departTime){s=stop+(t-dwell)*speed;phase='departing';}
    else {s=hiddenStart+(t-dwell-departTime)*speed;phase='arriving';}
    // Before departure the gate gets a three-second warning. It reopens after the rear cab clears.
    const lead=s+1.98,rear=s-spacing-1.98;
    const close=(phase==='station'&&t>dwell-3.3)||(phase==='departing'&&lead>crossS-2.5&&rear<crossS+1.4);
    cars.forEach((c,i)=>{
      const cs=s-i*spacing,p=route.point(cs),tangent=route.tangent(cs);
      c.visible=cs+2.15>tunnels[0].entryS-1.65 && cs-2.15<tunnels[1].entryS+1.65;
      c.position.set(p.x,0,p.z);c.rotation.y=-Math.atan2(tangent.z,tangent.x);
    });
    state={phase,headDistance:s,leadDistance:lead,rearDistance:rear,crossingDistance:crossS,close,cycleTime:t,cycleDuration:cycle};
    return state;
  }
  update(0);
  return {update,getState:()=>state};
}

