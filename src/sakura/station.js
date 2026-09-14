import { THREE, P, mat, mesh, box, sphere, cylinder, beam, wire, group, gable, fence, sign, between } from './core.js';
import { bush } from './landscape.js';

const timber=mat(P.wood), darkWood=mat(P.woodDark), cream=mat(P.cream), glass=mat(P.glass), teal=mat(P.roof);
function windowFrame(g,x,y,z,w=.7,h=.82,side=1) {
  const win=group(g,x,y,z,side===-1?Math.PI:0);
  box(win,w+.1,h+.11,.085,0,0,0,darkWood,.018);
  box(win,w,h,.016,0,0,.051,glass,.015);
  box(win,w-.06,.045,.021,0,0,.065,mat(P.woodLight));
  box(win,.043,h,.021,0,0,.066,mat(P.woodLight));
  box(win,w+.2,.075,.16,0,-h/2-.055,.05,mat(P.woodLight),.015);
  const reflection=box(win,.045,h*.68,.007,-w*.27,.045,.07,mat('#95b4ad'));reflection.rotation.z=-.15;
}
export function flowerBox(g,x,y,z,width=1.25) {
  box(g,width,.24,.36,x,y+.13,z,mat('#b08464'),.025);
  for(const dx of [-width*.34,width*.34])box(g,.042,.27,.373,x+dx,y+.13,z,mat('#d2ac7e'));
  box(g,width-.09,.026,.28,x,y+.254,z,mat('#766f58'));
  for(let i=0;i<9;i++){
    const xx=x-width*.42+i*width*.104;
    beam(g,[xx,y+.24,z],[xx,y+.43+Math.sin(i)*.03,z],.009,mat(P.hedge),.008,4);
    for(let j=0;j<4;j++)sphere(g,.051,xx+Math.cos(j*1.57)*.037,y+.45+Math.sin(i)*.025,z+Math.sin(j*1.57)*.037,mat(i%3===0?'#edc57c':i%2?'#f4d9de':'#db94ae'),[1,.66,1],0);
    sphere(g,.07,xx,y+.32,z+.02,mat('#81a579'),[1,.42,.63],0);
  }
}
export function bench(g,x,y,z,width=1.5,rotation=0) {
  const b=group(g,x,y,z,rotation);
  for(let i=0;i<4;i++)box(b,width,.055,.092,0,.37,-.16+i*.102,mat(P.woodLight),.012);
  for(let i=0;i<3;i++)box(b,width,.081,.052,0,.56+i*.098,-.195,mat(P.woodLight),.015);
  for(const dx of [-width*.34,width*.34]){
    beam(b,[dx,0,.13],[dx,.39,.1],.037,mat(P.dark));beam(b,[dx,0,-.17],[dx,.83,-.22],.035,mat(P.dark));
    beam(b,[dx,.25,.15],[dx,.25,-.2],.025,mat(P.dark));
    wire(b,[[dx,.4,.17],[dx,.57,.12],[dx,.56,-.16]],.021,mat(P.dark),8);
  }
}
function stationClock(g,x,y,z) {
  const rim=cylinder(g,.29,.29,.095,x,y,z,mat(P.dark),32);rim.rotation.x=Math.PI/2;
  const face=cylinder(g,.251,.251,.012,x,y,z+.055,mat(P.white),32);face.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,b=box(g,.021,i%3===0?.065:.033,.012,x+Math.sin(a)*.213,y+Math.cos(a)*.213,z+.067,mat(P.dark));b.rotation.z=-a;
  }
  const minute=box(g,.016,.20,.014,x-.079,y+.047,z+.077,mat(P.dark));minute.rotation.z=1.02;
  const hour=box(g,.022,.14,.014,x+.024,y+.057,z+.084,mat(P.dark));hour.rotation.z=-.42;
  sphere(g,.03,x,y,z+.09,mat(P.dark),[1,1,.4],1);
}
function lamp(g,x,z,height=2.75) {
  const metal=mat('#6d8073');
  cylinder(g,.038,.053,height,x,height/2,z,metal,9);
  cylinder(g,.12,.14,.11,x,.08,z,mat(P.concrete),8);
  wire(g,[[x,height-.08,z],[x,height+.15,z],[x+.35,height+.19,z],[x+.45,height-.03,z]],.03,metal,12);
  cylinder(g,.17,.25,.095,x+.45,height-.055,z,metal,16);
  cylinder(g,.14,.145,.11,x+.45,height-.14,z,mat('#fff0c3',{emissive:'#d3b37e',emissiveIntensity:.1}),12);
}
export function makeStation(parent) {
  const platform=group(parent);
  box(platform,10.05,.56,2.12,-1.45,.32,-1.94,mat('#bbbfaf'),.045);
  box(platform,10.11,.075,2.19,-1.45,.632,-1.94,mat('#dbdac5'),.025);
  for(let x=-6.2;x<3.5;x+=.46)box(platform,.015,.38,.018,x,.32,-.868,mat('#a3ad9e'));
  box(platform,9.65,.025,.16,-1.45,.679,-.987,mat('#e5cb80'),.014);
  for(let x=-6.1;x<3.3;x+=.17)for(const z of [-1.02,-.97])sphere(platform,.018,x,.699,z,mat('#f6dda0'),[1,.38,1],0);
  for(let x=-5.9;x<3.3;x+=1.23)box(platform,.018,.008,1.65,x,.674,-1.98,mat('#c6c8b6'));
  for(let i=0;i<4;i++)box(platform,.43,.16*(i+1),1.29,4.24-i*.34,.08*(i+1),-2.03,mat('#cbcdbb'),.018);
  for(const z of [-2.72,-1.4])beam(platform,[4.46,.65,z],[3.26,1.24,z],.026,mat(P.roofDark));
  fence(platform,[-6.4,.67,-2.95],[-3.8,.67,-2.95],.73,mat('#77948a'));
  fence(platform,[.0,.67,-2.95],[3.4,.67,-2.95],.73,mat('#77948a'));
  // Thin, slightly pitched canopy with rafters, brackets and a contrasting fascia.
  const canopy=group(parent,-1.4,0,-1.99,Math.PI/2);
  gable(canopy,2.5,9.68,.39,3.04,mat('#b6beaa'),mat('#5b999c'),mat('#527e7c'));
  for(const x of [-5.76,-2.95,.0,2.72]){
    for(const z of [-2.73,-1.24]){
      box(parent,.09,2.40,.095,x,1.85,z,mat('#e2d7bb'),.015);
      box(parent,.16,.12,.16,x,.77,z,mat('#a4b3a0'),.015);
      beam(parent,[x,2.65,z],[x+(x<0?.33:-.33),3.04,z],.035,mat(P.woodLight));
    }
    beam(parent,[x,3.01,-3.09],[x,3.01,-.72],.05,mat('#668b7f'));
  }
  box(parent,9.8,.12,.06,-1.4,3.055,-.71,mat('#4e7876'));
  box(parent,9.8,.10,.06,-1.4,3.055,-3.27,mat('#4e7876'));
  for(const x of [-4.5,-1.2,1.4]){
    box(parent,.56,.075,.13,x,2.96,-1.9,mat('#f4e9cc'),.025);
    box(parent,.68,.065,.22,x,3.012,-1.9,mat('#647c71'),.018);
  }
  bench(platform,-4.4,.68,-2.38,1.65);
  bench(platform,1.8,.68,-2.38,1.6);
  sign(parent,'さ く ら',1.43,.5,1.02,2.56,-.756,{subtitle:'SAKURA'});
  beam(parent,[.5,2.82,-.79],[.5,3.06,-.79],.013,mat(P.dark));
  beam(parent,[1.55,2.82,-.79],[1.55,3.06,-.79],.013,mat(P.dark));
  stationClock(parent,-2.95,2.59,-1.13);
  const st=group(parent,-2.15,.065,-4.67);
  box(st,4.05,.18,2.66,0,.08,0,mat('#b8bdac'),.055);
  box(st,3.8,2.34,2.38,0,1.3,0,cream,.045);
  box(st,3.87,.63,2.43,0,.45,0,timber,.02);
  for(const z of [-1.22,1.22]){
    for(let x=-1.83;x<=1.9;x+=.25)box(st,.022,.60,.022,x,.45,z,mat('#926b51'));
    for(const x of [-1.83,-.68,.68,1.83])box(st,.092,2.3,.084,x,1.3,z,darkWood,.01);
    box(st,3.88,.092,.078,0,2.37,z,darkWood);
  }
  gable(st,4.15,2.68,.92,2.48,cream,teal,mat(P.roofDark));
  // Entrance under the gable, ticket window, small timetable and timber shutters.
  box(st,1.21,1.83,.09,.18,1.11,1.236,darkWood,.02);
  for(const x of [-.13,.46]){
    box(st,.55,1.65,.025,x,1.10,1.291,mat('#91a29a'),.012);
    box(st,.48,.88,.018,x,1.35,1.308,glass);
    for(let j=0;j<4;j++)box(st,.022,.89,.02,x-.17+j*.115,1.35,1.325,mat(P.woodLight));
    box(st,.035,.18,.035,x+(x<0?.20:-.20),.97,1.338,mat(P.white),.01);
  }
  windowFrame(st,-1.22,1.39,1.23,.73,.83);
  box(st,.87,.09,.30,-1.22,.93,1.34,mat(P.woodLight),.02);
  sign(st,'桜 春 駅',1.66,.40,.05,2.19,1.27,{stripe:false});
  sign(st,'時刻表',.46,.63,1.28,1.42,1.265,{stripe:false,subtitle:'06  12  24  48'});
  const side=group(st,1.94,0,-.1,Math.PI/2);windowFrame(side,0,1.5,0,1.22,.85);
  const back=group(st,0,0,-1.225,Math.PI);windowFrame(back,-.9,1.45,0,.95,.9);windowFrame(back,.85,1.45,0,.95,.9);
  flowerBox(st,-1.3,0,1.55,.95);flowerBox(st,1.35,0,1.55,.75);
  // Rain gutter, curved downspout and a little chimney ventilator.
  wire(st,[[-2.17,2.45,-1.38],[-2.17,2.45,1.39]],.044,mat(P.roofDark),8);
  wire(st,[[-2.17,2.45,-1.29],[-2.12,2.19,-1.29],[-2.05,.16,-1.29],[-2.2,.11,-1.29]],.034,mat(P.roofDark),10);
  box(st,.36,.47,.40,1.02,3.03,-.69,mat('#b0b5a4'),.025);
  box(st,.48,.08,.51,1.02,3.29,-.69,mat(P.roofDark),.03);
  // Free-standing platform sign, noticeboard, refuse bins, flower planters and station garden.
  for(const x of [-5.75,-4.67])cylinder(parent,.036,.045,1.49,x,1.38,-2.76,mat('#c4cbb9'),8);
  sign(parent,'さくら',1.45,.43,-5.2,1.96,-2.73,{subtitle:'← HARU       AOBA →'});
  const board=group(parent,1.50,0,-4.60);
  for(const x of [-.54,.54])box(board,.07,1.7,.1,x,.9,0,darkWood);
  box(board,1.3,.91,.12,0,1.31,0,darkWood,.025);
  box(board,1.13,.77,.016,0,1.31,.072,mat('#c6c7b0'));
  for(let i=0;i<3;i++){
    box(board,.27,.46,.015,-.34+i*.34,1.36,.088,mat(i===1?'#ecd5c6':'#f4ecd5'));
    for(let j=0;j<4;j++)box(board,.19,.015,.012,-.34+i*.34,1.5-j*.095,.099,mat(i===1?'#aeb28d':'#9daf9c'));
  }
  const boardRoof=box(board,1.47,.075,.31,0,1.84,0,teal,.025);boardRoof.rotation.x=-.12;
  for(let i=0;i<2;i++){
    box(parent,.34,.55,.34,2.90+i*.4,.95,-2.69,mat(i?'#809a8b':'#b4c2aa'),.035);
    box(parent,.25,.052,.19,2.90+i*.4,1.237,-2.66,mat(P.dark),.022);
  }
  flowerBox(parent,-6.1,.67,-1.68,.68);flowerBox(parent,3.10,.67,-1.55,.6);
  bench(parent,.75,.065,-6.08,1.65,Math.PI);
  lamp(parent,3.62,-3.0);lamp(parent,-5.64,-5.63,2.5);
  fence(parent,[-5.7,.06,-6.58],[-3.85,.06,-6.58],.62,mat('#c7c6aa'));
  fence(parent,[.15,.06,-6.65],[3.25,.06,-6.65],.62,mat('#c7c6aa'));
  for(const [x,z]of [[-5.85,-4.4],[-5.88,-5.18],[.82,-5.9],[3.23,-5.78],[-3.25,-7.26]])bush(parent,x,z,.42,0,'#8aab74');
}

function house(parent,x,z,w,d,rotation=0,roofColor=P.roof) {
  const g=group(parent,x,.065,z,rotation);
  box(g,w+.3,.18,d+.3,0,.07,0,mat('#bcbda9'),.05);
  box(g,w,1.91,d,0,1.09,0,mat('#eee0c5'),.035);
  box(g,w+.025,.5,d+.025,0,.43,0,mat('#bca386'),.02);
  for(const xx of [-w/2+.06,w/2-.06])for(const zz of [-d/2-.012,d/2+.012])box(g,.09,1.97,.08,xx,1.05,zz,darkWood);
  gable(g,w+.32,d+.2,.92,2.10,mat('#ded6b9'),mat(roofColor),mat(P.roofDark));
  for(const xx of [-w*.26,w*.26])windowFrame(g,xx,1.25,d/2+.016,.72,.76);
  box(g,.62,1.45,.075,.0,.9,d/2+.026,darkWood,.012);
  box(g,.5,1.29,.025,0,.91,d/2+.073,mat('#a8b4a1'));
  for(let i=0;i<4;i++)box(g,.017,.72,.018,-.17+i*.113,1.14,d/2+.092,mat(P.woodLight));
  box(g,.025,.13,.031,.18,.78,d/2+.096,cream,.009);
  box(g,1.0,.12,.58,0,.08,d/2+.25,mat('#c9c7b3'),.025);
  const awning=box(g,1.16,.09,.63,0,1.79,d/2+.29,mat(roofColor),.025);awning.rotation.x=.09;
  for(const side of [-1,1]){
    const sg=group(g,side*w/2,0,0,side*Math.PI/2);windowFrame(sg,0,1.35,0,.9,.76);
  }
  windowFrame(g,-.7,1.4,-d/2-.013,.8,.85,-1);windowFrame(g,.7,1.4,-d/2-.013,.8,.85,-1);
  const air=group(g,w/2+.20,0,-.6);
  box(air,.30,.52,.72,0,.44,0,mat('#cbd0bc'),.025);
  for(let j=0;j<6;j++)box(air,.013,.022,.50,.156,.29+j*.06,0,mat('#98a796'));
  wire(g,[[w/2+.03,.8,-.6],[w/2+.11,1.2,-.6],[w/2+.04,1.5,-.6]],.025,mat(P.cream),10);
  flowerBox(g,-w*.31,0,d/2+.41,.65);
  return g;
}
export function makeNeighborhood(parent) {
  house(parent,-6.54,7.0,3.15,2.30,Math.PI,'#668f90');
  house(parent,6.60,8.30,2.6,2.35,-Math.PI/2,'#a8878a');
  const shed=group(parent,-3.12,.065,7.9,.12);
  box(shed,1.52,1.26,1.52,0,.69,0,mat('#c3aa89'),.02);
  for(let i=0;i<10;i++)box(shed,.015,1.22,.018,-.70+i*.155,.7,.767,mat('#a5896c'));
  gable(shed,1.73,1.68,.40,1.36,mat('#cbb596'),mat('#859b96'),mat('#617f7b'));
  box(shed,.58,1.06,.042,-.23,.6,.78,mat('#9c866c'),.01);
  box(shed,.08,.05,.05,-.04,.62,.81,mat(P.dark));
  windowFrame(shed,.45,.93,.79,.34,.38);
  for(let i=0;i<3;i++)box(shed,.08,.63,.09,.92,.34,-.28+i*.17,mat('#ba8d63'));
  // Kitchen garden with raised beds, cabbage rosettes and a tiny water tap.
  box(parent,2.3,.085,1.45,-3.1,.10,10.15,mat('#a8a985'),.04);
  for(let r=0;r<3;r++){
    box(parent,2.07,.07,.26,-3.1,.16,9.7+r*.4,mat('#8a8263'),.045);
    for(let c=0;c<8;c++){
      const x=-4+c*.26,z=9.7+r*.4;
      for(let k=0;k<4;k++)sphere(parent,.105,x+Math.cos(k*1.57)*.045,.245,z+Math.sin(k*1.57)*.05,mat(k%2?'#7ea578':'#a1bd83'),[1,.5,1],1);
    }
  }
  fence(parent,[-4.45,.07,9.33],[-4.45,.07,11.1],.45,mat('#bca780'));
  fence(parent,[-4.45,.07,11.1],[-1.84,.07,11.1],.45,mat('#bca780'));
  wire(parent,[[-1.84,.09,9.53],[-1.84,.55,9.53],[-1.71,.57,9.53],[-1.66,.5,9.53]],.025,mat(P.roofDark),10);
  cylinder(parent,.14,.12,.19,-1.63,.17,9.64,mat('#97b8ac'),12);
  fence(parent,[-8.5,.065,5.54],[-5.1,.065,5.54],.55,mat('#b7ad91'));
  fence(parent,[-8.5,.065,5.54],[-8.5,.065,8.20],.55,mat('#b7ad91'));
  fence(parent,[5.0,.065,10.16],[7.9,.065,10.16],.6,mat('#bdc6ab'));
  flowerBox(parent,5.43,.065,6.77,.78);
  // Drainage channel, metal grates, equipment hut and storage by the rail corridor.
  box(parent,6.1,.045,.25,-2.70,.087,3.17,mat('#7f9690'),.015);
  for(const z of [3.00,3.34])box(parent,6.4,.1,.10,-2.70,.1,z,mat('#bdc6b3'),.015);
  for(const x of [-4.5,-1.0])for(let i=0;i<7;i++)box(parent,.032,.04,.3,x+i*.06,.13,3.17,mat('#657f77'));
  const hut=group(parent,-8.54,.065,-.23,.3);
  box(hut,1.03,1.09,.83,0,.56,0,mat('#bac6af'),.045);
  gable(hut,1.19,.99,.24,1.11,mat('#bdc9b3'),mat('#7e9990'),mat('#607f77'));
  box(hut,.48,.82,.04,0,.44,.44,mat('#94ad9a'),.015);
  for(let i=0;i<5;i++)box(hut,.31,.025,.018,0,.65+i*.065,.465,mat('#6e8c7c'));
  box(hut,.04,.085,.031,.16,.40,.465,mat(P.dark));
  for(const [x,z,r]of [[-9.7,6.7,.5],[-9.4,7.3,.5],[-5.1,8.6,.37],[7.9,9.9,.45],[7.0,6.6,.32],[.3,7.8,.48],[.7,8.1,.36],[-11,0,.4],[-.4,-7.2,.43]])bush(parent,x,z,r);
  for(const [x,z]of [[-10.7,6.8],[-.6,7.6],[8,10.1],[7.4,3.2],[-5.7,1.8],[-4.9,2.2]])sphere(parent,.29,x,.15,z,mat('#b3b9a5'),[1.3,.6,.95],0);
  // Small red postbox and a circular convex mirror belong to the physical neighborhood.
  const post=group(parent,3.99,.07,-4.23);
  cylinder(post,.038,.047,.67,0,.36,0,mat(P.dark),8);
  box(post,.32,.39,.28,0,.83,0,mat('#be7e72'),.06);
  box(post,.18,.025,.017,0,.91,.15,mat('#725c53'));
  sign(post,'〒',.12,.1,0,.79,.155,{stripe:false,color:'#f4ead5',background:'#be7e72'});
  cylinder(parent,.03,.047,1.75,4.03,.94,3.51,mat('#bc996c'),8);
  const mirror=cylinder(parent,.25,.25,.075,4.03,1.92,3.51,mat('#d4ae7b'),24);mirror.rotation.x=Math.PI/2;mirror.rotation.z=-.15;
  const disk=cylinder(parent,.215,.215,.012,4.03,1.92,3.554,mat('#9bb8b4'),24);disk.rotation.x=Math.PI/2;
  for(let i=0;i<4;i++){box(parent,.18,.29,.15,-7.1+i*.27,.21,8.45,mat(i%2?'#b9a07b':'#a18568'),.02);}
}

