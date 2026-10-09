
(function(){'use strict';
var doc=document,win=window;
var nativeFrame=win.requestAnimationFrame||win.webkitRequestAnimationFrame;
var nextFrame=function(fn){return nativeFrame?nativeFrame.call(win,fn):setTimeout(function(){fn(clock());},33);};
var cancelFrame=function(id){var fn=win.cancelAnimationFrame||win.webkitCancelAnimationFrame;if(nativeFrame&&fn)fn.call(win,id);else clearTimeout(id);};
function el(id){return doc.getElementById(id);}
var canvas=el('view'),ctx=null;
try{ctx=canvas.getContext&&canvas.getContext('2d',{alpha:false});}catch(e){ctx=null;}if(!ctx){try{ctx=canvas.getContext&&canvas.getContext('2d');}catch(e){ctx=null;}}
if(!ctx){el('fallbackText').className='no-canvas';}
var SCENES=[{id:'nebula',name:'自然星云',hue:187},{id:'aurora',name:'极光长流',hue:161},{id:'deep',name:'深空尘埃',hue:220},{id:'orbit',name:'星环轨道',hue:278},{id:'vortex',name:'旋涡风暴',hue:210},{id:'nova',name:'超新星',hue:23}];
var scene='nebula',sceneIndex=0,particles=[],bgStars=[],rings=[],W=0,H=0,dpr=1,last=0,raf=0,fps=60,ema=60,elapsed=0,visible=true,paused=false,touring=false,tourAt=0,tourPeriod=14500,qualityStep=1,coverage=100,densityTick=0,drawn=0,seed=13.314,mouseDown=false,pointerX=0,pointerY=0,lastTouch=0,lastWave=0,activePointer=null,dragSession=null,dragMarks=[],tapCount=0,dragCount=0,dragImpulseCount=0,ignoreMouseUntil=0,showCopy=true,drawer=null,controlsOpen=false,toastTimer=0;
var defaults={density:100,speed:100,trail:78,quality:'auto',palette:'auto',waves:true,hud:false,interactive:true,strength:100,brightness:100,showui:false,audio:false,parallax:false,customcolor:false,colorHue:190,renderscale:100};
var hueCurrent=null,bgLayer=null,coverageGrid=[],lastHudAt=-250,lastPaletteHue=null;
var playback=new win.NebulaCore.PlaybackClock(),loadControl=new win.NebulaCore.QualityController(),hostPaused=false,hostMode=!!win.__NebulaWallpaper,hostFPS=60,initialized=false,frameNumber=0,simulationSteps=0,tailCount=0,hostEvents={general:0,user:0,pause:0},audioLevel=0,audioTarget=0,audioRegistered=false,lastRenderCost=0,lastSimulationCost=0,simulationCostSinceDraw=0,pendingHostProperties=null;
var opts={};
function copy(a){var out={},k;for(k in a)if(Object.prototype.hasOwnProperty.call(a,k))out[k]=a[k];return out;}
function getStore(k){try{return win.localStorage.getItem(k);}catch(e){return null;}}
function setStore(k,v){try{win.localStorage.setItem(k,v);}catch(e){}}
function limit(n,a,b){return Math.max(a,Math.min(b,n));}
function number(n,d){n=Number(n);return isFinite(n)?n:d;}
function frac(n){return n-Math.floor(n);}
function rnd(a){return frac(Math.sin(a*127.1+seed*19.7)*43758.5453123);}
function load(){opts=copy(defaults);var data;try{data=JSON.parse(getStore('nebula_flow_v15_settings')||getStore('nebula_flow_v14_settings')||getStore('nebula_flow_v13_settings')||getStore('nebula_flow_v12_settings')||getStore('nebula_flow_v11_settings')||getStore('nebula_flow_v1_settings')||'null');if(!getStore('nebula_flow_v15_settings')&&!getStore('nebula_flow_v12_settings')&&!getStore('nebula_flow_v11_settings')&&data) data.hud=false;}catch(e){data=null;}if(data&&typeof data==='object'){for(var k in defaults)if(Object.prototype.hasOwnProperty.call(data,k))opts[k]=data[k];}opts.density=limit(number(opts.density,100),50,160);opts.speed=limit(number(opts.speed,100),30,170);opts.trail=limit(number(opts.trail,45),0,100);if(['auto','high','low'].indexOf(opts.quality)<0)opts.quality='auto';if(['auto','ice','purple','gold'].indexOf(opts.palette)<0)opts.palette='auto';opts.brightness=limit(number(opts.brightness,100),30,140);opts.strength=limit(number(opts.strength,100),0,200);opts.renderscale=limit(number(opts.renderscale,100),50,150);opts.colorHue=(number(opts.colorHue,190)%360+360)%360;var booleans=['waves','hud','interactive','audio','showui','parallax','customcolor'];for(var j=0;j<booleans.length;j++){var key=booleans[j];if(typeof opts[key]!=='boolean')opts[key]=defaults[key];}var s=getStore('nebula_flow_v1_scene');for(var i=0;i<SCENES.length;i++)if(SCENES[i].id===s){scene=s;sceneIndex=i;break;}}
load();
function save(){setStore('nebula_flow_v15_settings',JSON.stringify(opts));}
function toast(t){el('toast').textContent=t;el('toast').className='show';clearTimeout(toastTimer);toastTimer=setTimeout(function(){el('toast').className='';},1500);}
function syncControls(){el('controls').className=controlsOpen?'controls':'controls hidden';el('menuBtn').setAttribute('aria-expanded',controlsOpen||drawer?'true':'false');el('menuBtn').setAttribute('aria-label',controlsOpen||drawer?'收起控制':'展开控制');el('menuBtn').textContent=controlsOpen||drawer?'×':'✦';}
function setDrawer(name){if(name==='settings'&&hostMode){toast('请在 Wallpaper Engine 的属性面板调整设置');return;}var hadDrawer=!!drawer;if(name){clearTimeout(toastTimer);el('toast').className='';controlsOpen=false;}drawer=name;el('mask').className=name?'open':'';el('mask').setAttribute('aria-hidden',name?'false':'true');el('examplesPane').className=name==='examples'?'':'hidden';el('settingsPane').className=name==='settings'?'':'hidden';el('drawerTitle').textContent=name==='settings'?'设置与工具 · v1.5.0':'选择一个宇宙';syncControls();if(name)el('closeDrawer').focus();else if(initialized&&hadDrawer)el('menuBtn').focus();}
function updateBtns(){var nodes=doc.querySelectorAll('[data-scene]');for(var i=0;i<nodes.length;i++){var on=nodes[i].getAttribute('data-scene')===scene;nodes[i].setAttribute('aria-pressed',on?'true':'false');}el('currentScene').textContent=SCENES[sceneIndex].name;el('tourBtn').textContent=touring?'■ 停止':'▶ 巡演';el('tourBtn').className=touring?'primary tour-dock touring':'primary tour-dock';el('drawerTourBtn').textContent=touring?'■ 停止巡演':'▶ 自动巡演';el('tourProgress').className=touring?'progress active':'progress';}
function densityTarget(){var areaFactor=limit(W*H/(390*820),.6,2.5);var base=opts.quality==='high'?2300:1700;var baseline=limit(base*areaFactor,400,opts.quality==='high'?4400:3000);return Math.round(Math.max(400,baseline*opts.density/100));}
function footprint(id,i,u,v){var q=i%20,x=u,y=v,a,r;
  if(id==='aurora'&&q<7){x=u;y=.45+.16*Math.sin(u*10+seed*1.2)+(v-.5)*.21;}
  if(id==='deep'&&q<5){x=.12+.76*u;y=.2+.6*v;}
  if(id==='orbit'&&q<8){a=u*6.2831853*1.4+v*.4;r=.24+.19*v;x=.5+Math.cos(a)*r;y=.5+Math.sin(a)*r*.67;}
  if(id==='vortex'&&q<7){a=u*14.7+v*1.2;r=.08+.43*v;x=.5+Math.cos(a)*r;y=.5+Math.sin(a)*r*.79;}
  if(id==='nova'&&q<7){a=Math.floor(u*12)*.5236+(v-.5)*.12;r=.07+.43*v;x=.5+Math.cos(a)*r;y=.5+Math.sin(a)*r*.85;}
  return {x:limit(x,.008,.992)*W,y:limit(y,.008,.992)*H};
}
function layout(id,reseed){var n=densityTarget(),i,p,u,v,fp,old=particles.length;if(reseed)particles=[];for(i=0;i<n;i++){
    u=frac((i+.5)*.7548776662466927+seed*.017+(rnd(i+92)-.5)*.009);v=frac((i+.5)*.5698402909980532+seed*.011+(rnd(i+411)-.5)*.009);
    fp=footprint(id,i,u,v);p=particles[i];if(!p){p={x:u*W,y:v*H,vx:0,vy:0,homeX:fp.x,homeY:fp.y,tx:fp.x,ty:fp.y,u:u,v:v,seed:rnd(i+4)*6.28,tw:rnd(i+781),size:.72+rnd(i+72)*.88,type:i%17};particles.push(p);}else{p.tx=fp.x;p.ty=fp.y;}
  }
  particles.length=n;
  if(reseed){for(i=0;i<n;i++){p=particles[i];p.x=p.tx+(rnd(i+930)-.5)*11;p.y=p.ty+(rnd(i+94)-.5)*11;p.homeX=p.tx;p.homeY=p.ty;}}
}
function buildBg(){bgStars=[];var n=Math.round(limit(W*H/700,220,1400));
  if(!bgLayer)bgLayer=doc.createElement('canvas');bgLayer.width=canvas.width;bgLayer.height=canvas.height;
  var bg=null;try{bg=bgLayer.getContext('2d');}catch(e){}if(bg&&bg.setTransform)bg.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  for(var i=0;i<n;i++){var star={x:rnd(i+1282)*W,y:rnd(i+1547)*H,size:i%17===0?1.2:.65,a:.10+rnd(i+2300)*.30};bgStars.push(star);if(bg){bg.fillStyle='rgba(157,193,235,'+star.a+')';bg.fillRect(star.x,star.y,star.size,star.size);}}
  if(!bg)bgLayer=null;
}
function resize(){var prevW=W,prevH=H;
  /* CSS owns viewport size. Read the final rendered box after layout; older browser safe. */
  var rect=canvas.getBoundingClientRect();
  W=Math.max(1,Math.round(rect.width||doc.documentElement.clientWidth||win.innerWidth||320));
  H=Math.max(1,Math.round(rect.height||doc.documentElement.clientHeight||win.innerHeight||568));
  var oldCount=particles.length;
  var low=opts.quality==='low'||(opts.quality==='auto'&&qualityStep<.75);
  dpr=Math.max(.5,Math.min(number(win.devicePixelRatio,1),opts.quality==='high'?1.5:1.25))*opts.renderscale/100;
  var level=opts.quality==='auto'?loadControl.level:1;
  var maxPixels=(opts.quality==='low'?2100000:opts.quality==='high'?10000000:4200000)*level*level;
  var factor=Math.min(dpr,Math.sqrt(maxPixels/(W*H)));
  var cw=Math.max(1,Math.round(W*factor)),ch=Math.max(1,Math.round(H*factor));
  if(canvas.width!==cw)canvas.width=cw;
  if(canvas.height!==ch)canvas.height=ch;
  if(ctx&&ctx.setTransform)ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  if(oldCount&&prevW&&prevH){for(var i=0;i<oldCount;i++){var p=particles[i];p.x*=W/prevW;p.y*=H/prevH;if(isFinite(p.prevX))p.prevX*=W/prevW;if(isFinite(p.prevY))p.prevY*=H/prevH;p.homeX*=W/prevW;p.homeY*=H/prevH;p.tx*=W/prevW;p.ty*=H/prevH;}}
  layout(scene,!oldCount);buildBg();if(ctx)render(0,true);
}

function switchScene(id,fromTour){var i;for(i=0;i<SCENES.length;i++)if(SCENES[i].id===id)break;if(i>=SCENES.length)return;if(!fromTour)stopTour();scene=id;sceneIndex=i;layout(scene,false);setStore('nebula_flow_v1_scene',scene);updateBtns();setDrawer(null);toast('✦ '+SCENES[i].name+' · 平滑转场');el('copy').className='center-copy fade';showCopy=false;}
function tourStart(){if(touring){stopTour();toast('巡演已停止');return;}touring=true;paused=false;el('pauseBtn').textContent='Ⅱ';el('pauseBtn').setAttribute('aria-label','暂停动画');tourAt=elapsed;restartTime();updateBtns();toast('柔和巡演已开启 · 不中断粒子流');setDrawer(null);}
function stopTour(){if(!touring)return;touring=false;updateBtns();}
function clock(){return (win.performance&&win.performance.now)?win.performance.now():Date.now();}
function pulse(x,y,force){if(!ctx||hostPaused||paused)return;force=force||1;rings.push({x:x,y:y,t:0,max:48+force*28});if(rings.length>9)rings.shift();for(var i=0;i<particles.length;i++){var p=particles[i],dx=p.x-x,dy=p.y-y,r2=dx*dx+dy*dy;if(r2<26000&&r2>2){var d=Math.sqrt(r2),imp=(1-d/162)*Math.min(13,10*force);p.vx+=dx/d*imp;p.vy+=dy/d*imp;}}if(opts.waves){var w=doc.createElement('div');w.className='wave';w.style.left=x+'px';w.style.top=y+'px';el('touchLayer').appendChild(w);setTimeout(function(){if(w.parentNode)w.parentNode.removeChild(w);},700);}}
function pointerPoint(e){var r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function down(x,y){if(!opts.interactive||hostPaused||paused||mouseDown)return;stopTour();canvas.focus();mouseDown=true;pointerX=x;pointerY=y;dragSession={x:x,y:y,startX:x,startY:y,downAt:clock(),dragged:false};el('copy').className='center-copy fade';}
function applyDrag(x0,y0,x1,y1){if(!opts.interactive||hostPaused||paused)return;var sx=x1-x0,sy=y1-y0,dist=Math.sqrt(sx*sx+sy*sy);if(dist<.5)return;
  var nx=-sy/dist,ny=sx/dist,rad=113,rad2=rad*rad,s2=dist*dist;
  dragImpulseCount++;
  for(var i=0;i<particles.length;i++){
    var p=particles[i],t=limit(((p.x-x0)*sx+(p.y-y0)*sy)/s2,0,1),dx=p.x-(x0+sx*t),dy=p.y-(y0+sy*t),r2=dx*dx+dy*dy;
    if(r2>=rad2)continue;
    var side=dx*nx+dy*ny;
    if(Math.abs(side)<.5)side=(p.seed>3.1?1:-1)*.5;
    var sign=side>=0?1:-1;
    var falloff=1-r2/rad2;falloff*=falloff;
    /* Brush parts stars across the swipe in two diverging sheets; no attraction. */
    var shove=Math.min(4.8,1.4+dist*.075)*falloff*opts.strength/100;
    p.vx+=nx*sign*shove+(sx/dist)*.09*shove;
    p.vy+=ny*sign*shove+(sy/dist)*.09*shove;
    p.vx=limit(p.vx,-10,10);p.vy=limit(p.vy,-10,10);
  }
  dragMarks.push({x0:x0,y0:y0,x1:x1,y1:y1,t:0});
  if(dragMarks.length>65)dragMarks.splice(0,dragMarks.length-65);
}

function move(x,y){if(!mouseDown||!dragSession)return;var s=dragSession,dx=x-s.x,dy=y-s.y;pointerX=x;pointerY=y;
  if(!s.dragged&&Math.sqrt((x-s.startX)*(x-s.startX)+(y-s.startY)*(y-s.startY))>=9){s.dragged=true;dragCount++;}
  if(s.dragged){var distance=Math.sqrt(dx*dx+dy*dy),steps=Math.min(8,Math.max(1,Math.ceil(distance/22)));for(var j=1;j<=steps;j++){var ax=s.x+dx*(j-1)/steps,ay=s.y+dy*(j-1)/steps,bx=s.x+dx*j/steps,by=s.y+dy*j/steps;applyDrag(ax,ay,bx,by);}}
  s.x=x;s.y=y;
}
function endInput(cancel,x,y){if(!mouseDown||!dragSession)return;var s=dragSession;if(typeof x==='number'&&typeof y==='number')move(x,y);mouseDown=false;dragSession=null;
  if(!cancel&&!s.dragged&&clock()-s.downAt<500){tapCount++;pulse(s.x,s.y,1);}
}
function attachInputs(){if(win.PointerEvent){canvas.addEventListener('pointerdown',function(e){if(mouseDown||e.isPrimary===false||e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();var p=pointerPoint(e);activePointer=e.pointerId;down(p.x,p.y);try{if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);}catch(ignore){}});
  canvas.addEventListener('pointermove',function(e){if(opts.parallax){var hover=pointerPoint(e);pointerX=hover.x;pointerY=hover.y;}if(!mouseDown||e.pointerId!==activePointer)return;e.preventDefault();var evs=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():null;if(evs&&evs.length){for(var i=Math.max(0,evs.length-12);i<evs.length;i++){var cp=pointerPoint(evs[i]);move(cp.x,cp.y);}}var p=pointerPoint(e);move(p.x,p.y);});
  canvas.addEventListener('pointerup',function(e){if(e.pointerId!==activePointer)return;var p=pointerPoint(e);endInput(false,p.x,p.y);activePointer=null;});
  function abort(e){if(activePointer!==null&&e.pointerId!==activePointer)return;endInput(true);activePointer=null;}
  canvas.addEventListener('pointercancel',abort);canvas.addEventListener('lostpointercapture',abort);
 }else{
  var touchId=null;
  function getTouch(list){for(var j=0;j<list.length;j++)if(list[j].identifier===touchId)return list[j];return null;}
  function touchPoint(t){var r=canvas.getBoundingClientRect();return{x:t.clientX-r.left,y:t.clientY-r.top};}
  canvas.addEventListener('touchstart',function(e){if(touchId!==null||!e.changedTouches.length)return;e.preventDefault();var t=e.changedTouches[0];touchId=t.identifier;ignoreMouseUntil=Date.now()+900;var p=touchPoint(t);down(p.x,p.y);},{passive:false});
  canvas.addEventListener('touchmove',function(e){var t=getTouch(e.touches);if(!t)return;e.preventDefault();var p=touchPoint(t);move(p.x,p.y);},{passive:false});
  canvas.addEventListener('touchend',function(e){var t=getTouch(e.changedTouches);if(!t)return;var p=touchPoint(t);endInput(false,p.x,p.y);touchId=null;ignoreMouseUntil=Date.now()+900;});
  canvas.addEventListener('touchcancel',function(e){if(touchId===null)return;endInput(true);touchId=null;ignoreMouseUntil=Date.now()+900;});
  canvas.addEventListener('mousedown',function(e){if(Date.now()<ignoreMouseUntil||e.button!==0)return;var p=pointerPoint(e);down(p.x,p.y);});
  win.addEventListener('mousemove',function(e){if(!mouseDown)return;var p=pointerPoint(e);move(p.x,p.y);});
  win.addEventListener('mouseup',function(e){if(Date.now()<ignoreMouseUntil)return;var p=pointerPoint(e);endInput(false,p.x,p.y);});
  win.addEventListener('blur',function(){endInput(true);touchId=null;});
 }}
function hue(){if(opts.customcolor)return opts.colorHue;var base=SCENES[sceneIndex].hue;return opts.palette==='ice'?190:opts.palette==='purple'?275:opts.palette==='gold'?36:base;}
var colors={};function palette(k){var desired=hue();if(hueCurrent===null)hueCurrent=desired;var dh=((desired-hueCurrent+540)%360)-180;hueCurrent=(hueCurrent+dh*(1-Math.pow(.971,k))+360)%360;
  if(lastPaletteHue!==null&&Math.abs(((hueCurrent-lastPaletteHue+540)%360)-180)<.3)return;lastPaletteHue=hueCurrent;
  var h=hueCurrent;for(var i=0;i<6;i++){var hh=((h+(i-2)*13)%360+360)%360;colors[i]='hsla('+hh+',94%,'+(67+i%3*6)+'%,.80)';}colors.dim='hsla('+h+',83%,64%,.48)';colors.strong='hsla('+h+',97%,83%,.95)';
}
function render(dt,clear,renderAlpha){if(!ctx)return;var k=limit(dt/16.67,0,15),baseAlpha=opts.trail===0?1:limit(.30-opts.trail*.0025,.055,.30),alpha=clear?1:1-Math.pow(1-baseAlpha,k);
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='rgba(2,6,17,'+alpha+')';ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=.63;if(bgLayer)ctx.drawImage(bgLayer,0,0,W,H);else for(var b=0;b<bgStars.length;b++){var star=bgStars[b];ctx.fillStyle='rgba(157,193,235,'+star.a+')';ctx.fillRect(star.x,star.y,star.size,star.size);}ctx.globalAlpha=1;
  palette(k);var elapsedT=elapsed*.001,occupancy=coverageGrid,cols=12,rows=18,sampleCoverage=++densityTick>=90,light=opts.quality==='low',tailStride=light?10:4,visibleCount=0;tailCount=0;
  if(sampleCoverage)for(var q=0;q<cols*rows;q++)occupancy[q]=0;
  for(var i=0;i<particles.length;i++){
    var p=particles[i];
    if(p.x<1||p.x>=W-1||p.y<1||p.y>=H-1)continue;var interp=typeof renderAlpha==='number'?renderAlpha:1;var px=clear?p.x:number(p.prevX,p.x)+(p.x-number(p.prevX,p.x))*interp,py=clear?p.y:number(p.prevY,p.y)+(p.y-number(p.prevY,p.y))*interp;visibleCount++;if(sampleCoverage)occupancy[limit(Math.floor(py/H*rows),0,rows-1)*cols+limit(Math.floor(px/W*cols),0,cols-1)]++;
    var twinkle=limit((.78+.20*Math.sin(elapsedT*1.5+p.seed*3.1))*(1+audioLevel*.15),0,1);
    var size=p.size*(p.type===0?1.35:1);
    /* Restore visible comet tails: motion vector streak, scaled by saved trail preference. */
    if(opts.trail>0 && i%tailStride===0){
      var motion=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
      if(motion>.12){
        var tail=Math.min(light?18:33,(4.5+motion*3.2)*(0.55+opts.trail*.016));
        var direction=motion>0?1/motion:0;
        ctx.strokeStyle=colors[i%6];ctx.lineWidth=Math.max(.52,size*.67);
        ctx.globalAlpha=Math.min(.59,(.22+opts.trail*.0032)*twinkle);
        ctx.beginPath();ctx.moveTo(px-p.vx*direction*tail,py-p.vy*direction*tail);ctx.lineTo(px,py);ctx.stroke();tailCount++;
      }
    }
    ctx.fillStyle=colors[i%6];ctx.globalAlpha=twinkle;
    if(p.type%6===0){ctx.fillRect(px-size*.5,py-size*.5,size*1.55,size*1.55);}else ctx.fillRect(px,py,size,size);
    if(p.type===0&&opts.quality!=='low'){ctx.globalAlpha=.18;ctx.fillStyle=colors.strong;ctx.fillRect(px-1.8,py-1.8,3.6,3.6);if(i%51===0){ctx.strokeStyle=colors[i%6];ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(px-p.vx*5,py-p.vy*5);ctx.lineTo(px,py);ctx.stroke();}}
  }
  ctx.globalAlpha=1;drawn=visibleCount;
  for(var d=dragMarks.length-1;d>=0;d--){var mark=dragMarks[d];mark.t+=dt;var life=1-mark.t/550;if(life<=0){dragMarks.splice(d,1);continue;}ctx.globalAlpha=life*.22;ctx.strokeStyle=colors.strong;ctx.lineWidth=1.7*life+.35;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(mark.x0,mark.y0);ctx.lineTo(mark.x1,mark.y1);ctx.stroke();}ctx.globalAlpha=1;

  for(var j=rings.length-1;j>=0;j--){var ring=rings[j];ring.t+=dt;var stage=limit(ring.t/550,0,1);if(stage>=1){rings.splice(j,1);continue;}ctx.strokeStyle='rgba(107,226,255,'+((1-stage)*.45)+')';ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(ring.x,ring.y,ring.max*stage+4,0,6.2831853);ctx.stroke();}
  if(sampleCoverage){var nonempty=0;for(j=0;j<occupancy.length;j++)if(occupancy[j]>1)nonempty++;coverage=Math.round(nonempty/occupancy.length*100);densityTick=0;if(opts.hud)el('coverageStatus').textContent='屏幕分布 '+coverage+'% · '+drawn+' 粒子';}
  if(drawn===0){layout(scene,true);toast('已自动恢复粒子画面');}
}
function simulate(dt){elapsed+=dt;simulationSteps++;audioLevel+=(audioTarget-audioLevel)*.08;
  var baseF=opts.speed/100*(1+audioLevel*.12),elapsedT=elapsed*.001,k=dt/16.67,follow=.009*k,adapt=1-Math.pow(.984,k),damping=Math.pow(.91,k);
  for(var i=0;i<particles.length;i++){
    var p=particles[i];p.prevX=p.x;p.prevY=p.y;p.homeX+=(p.tx-p.homeX)*adapt;p.homeY+=(p.ty-p.homeY)*adapt;
    var a=p.seed+elapsedT*.38*baseF, dx=p.homeX-W*.5,dy=p.homeY-H*.5,r=Math.sqrt(dx*dx+dy*dy)+1;
    var offX=Math.sin(a+p.homeY*.008)*13+Math.cos(elapsedT*.34+p.homeX*.006)*6;
    var offY=Math.cos(a*.8+p.homeX*.007)*12+Math.sin(elapsedT*.29+p.homeY*.01)*6;
    if(scene==='aurora'){offX+=Math.sin(elapsedT*.45+p.homeY*.009)*6;offY+=Math.sin(p.homeX*.016+elapsedT*.82)*18;}
    else if(scene==='deep'){offX*=.47;offY*=.47;}
    else if(scene==='orbit'){offX+=-dy/(r)*14*Math.sin(elapsedT*.22+p.seed);offY+=dx/r*14*Math.cos(elapsedT*.22+p.seed);}
    else if(scene==='vortex'){offX+=-dy/(r)*19;offY+=dx/r*19;}
    else if(scene==='nova'){offX+=dx/r*21*Math.sin(elapsedT*.6+p.seed);offY+=dy/r*21*Math.sin(elapsedT*.6+p.seed);}
    /* v1.5.0: coherent idle streamlines. A moving elliptical path per star keeps
       motion visible without user input while anchored distribution prevents gaps.
       This is continuous, frame-time based movement (not intermittent pulses). */
    var driftRate=(scene==='deep'?.37:scene==='vortex'?.73:scene==='aurora'?.52:.56)*baseF;
    var orbitPhase=elapsedT*driftRate+p.seed*.47+p.u*2.1;
    var flowRadius=(scene==='deep'?37:scene==='aurora'?87:scene==='vortex'?97:scene==='orbit'?74:scene==='nova'?60:69)*(.76+(p.type%7)*.052);
    offX+=Math.cos(orbitPhase)*flowRadius+Math.sin(orbitPhase*.47+p.v*4.0)*15;
    offY+=Math.sin(orbitPhase*.91+p.v*1.4)*flowRadius*.74;
    if(opts.parallax){var depth=.65+(p.type%3)*.17;offX+=(pointerX/W-.5)*12*depth;offY+=(pointerY/H-.5)*9*depth;}
    var targetX=p.homeX+offX,targetY=p.homeY+offY,ax=(targetX-p.x)*follow,ay=(targetY-p.y)*follow;
    p.vx=(p.vx+ax)*damping;p.vy=(p.vy+ay)*damping;
    p.x+=p.vx*k;p.y+=p.vy*k;
    if(!isFinite(p.x)||!isFinite(p.y)||p.x< -W*.15||p.x>W*1.15||p.y< -H*.15||p.y>H*1.15){p.x=p.prevX=p.homeX;p.y=p.prevY=p.homeY;p.vx=p.vy=0;}
  }
}

function tick(now){raf=0;if(!visible||!ctx||paused||hostPaused)return;raf=nextFrame(tick);
  var frame=playback.advance(now,hostFPS),t=clock();for(var step=0;step<frame.steps;step++)simulate(frame.stepMs);lastSimulationCost=clock()-t;simulationCostSinceDraw+=lastSimulationCost;
  if(!frame.draw)return;t=clock();
  if(touring){var progress=(elapsed-tourAt)/tourPeriod;if(progress>=1){tourAt=elapsed;switchScene(SCENES[(sceneIndex+1)%SCENES.length].id,true);progress=0;}el('tourProgress').style.transform='scaleX('+limit(progress,0,1)+')';}
  try{render(frame.drawMs,false,frame.alpha);}catch(error){paused=true;stopLoop();el('fallbackText').className='no-canvas';el('fallbackText').textContent='动画已暂停：'+error.message;return;}
  lastRenderCost=clock()-t;frameNumber++;fps=1000/Math.max(1,frame.drawMs);ema=1000/((1000/ema)*.92+frame.drawMs*.08);
  if(opts.quality==='auto'){
    /* Measure the configured workload cycle, not the slower observed draw cycle.
       Simulation accumulated across missed draws is normalized separately; a
       costly render cannot hide itself by delaying the following frame. */
    var targetPeriod=hostFPS>0?1000/hostFPS:1000/60;
    var normalizedCost=(lastRenderCost+simulationCostSinceDraw*Math.min(1,targetPeriod/Math.max(1,frame.drawMs)))*Math.min(1,(1000/60)/targetPeriod);
    if(loadControl.observe(normalizedCost,targetPeriod,frame.drawMs)){qualityStep=loadControl.level;resize();}
  }
  simulationCostSinceDraw=0;if(opts.hud&&elapsed-lastHudAt>=250){lastHudAt=elapsed;el('fpsStatus').textContent=Math.round(ema)+' FPS · 2D '+(opts.quality==='low'?'省电':opts.quality==='high'?'高清':'自动');}
}
function stopLoop(){if(raf){cancelFrame(raf);raf=0;}}
function restartTime(){last=0;playback.reset();simulationCostSinceDraw=0;if(!visible||paused||hostPaused){stopLoop();return;}if(ctx&&!raf)raf=nextFrame(tick);}
function setQuality(){resize();restartTime();}
function bind(){var all=doc.querySelectorAll('[data-scene]');for(var i=0;i<all.length;i++)(function(button){button.addEventListener('click',function(){switchScene(button.getAttribute('data-scene'),false);});})(all[i]);el('examplesBtn').addEventListener('click',function(){setDrawer('examples');});el('menuBtn').addEventListener('click',function(){var open=!(controlsOpen||drawer);setDrawer(null);controlsOpen=open;syncControls();});el('settingsBtn').addEventListener('click',function(){setDrawer('settings');});el('closeDrawer').addEventListener('click',function(){setDrawer(null);});el('mask').addEventListener('click',function(e){if(e.target===this)setDrawer(null);});el('drawerSettingsBtn').addEventListener('click',function(){setDrawer('settings');});el('settingsExamplesBtn').addEventListener('click',function(){setDrawer('examples');});el('tourBtn').addEventListener('click',tourStart);el('drawerTourBtn').addEventListener('click',tourStart);el('pauseBtn').addEventListener('click',function(){paused=!paused;if(!paused&&ctx)el('fallbackText').className='no-canvas hidden';this.textContent=paused?'▶':'Ⅱ';this.setAttribute('aria-label',paused?'继续动画':'暂停动画');stopTour();restartTime();toast(paused?'动画已暂停':'动画已继续');});el('pulseBtn').addEventListener('click',function(){pulse(W*.5,H*.48,2);setDrawer(null);toast('能量脉冲已释放');});el('randomBtn').addEventListener('click',function(){switchScene(SCENES[Math.floor(Math.random()*SCENES.length)].id,false);});
  var keys=['density','speed','trail','quality','palette','waves','hud'];for(i=0;i<keys.length;i++)(function(k){var ctrl=el(k);ctrl.addEventListener(k==='waves'||k==='hud'||k==='quality'||k==='palette'?'change':'input',function(){opts[k]=this.type==='checkbox'?this.checked:this.type==='range'?Number(this.value):this.value;save();if(k==='density'||k==='quality'){if(k==='density')layout(scene,false);else setQuality();}if(k==='hud'){el('status').style.display=opts.hud?'':'none';lastHudAt=-250;}});})(keys[i]);
  el('saveBtn').addEventListener('click',function(){if(!ctx){toast('当前浏览器不支持画面保存');return;}try{var a=doc.createElement('a');a.download='nebula-flow-v1.5.0-'+Date.now()+'.png';a.href=canvas.toDataURL('image/png');a.click();toast('已生成 PNG 截图');}catch(e){toast('当前浏览器不支持图片下载');}});
  el('fullBtn').addEventListener('click',function(){var fn=doc.documentElement.requestFullscreen||doc.documentElement.webkitRequestFullscreen;if(!fn){toast('当前浏览器暂不支持全屏');return;}try{var r=fn.call(doc.documentElement);if(r&&r.catch)r.catch(function(){toast('浏览器未允许全屏');});}catch(e){toast('浏览器未允许全屏');}});
  el('resetBtn').addEventListener('click',function(){opts=copy(defaults);stopTour();seed+=.1;for(var j=0;j<keys.length;j++){var id=keys[j],v=el(id);if(v.type==='checkbox')v.checked=opts[id];else v.value=opts[id];}save();qualityStep=1;loadControl=new win.NebulaCore.QualityController();resize();switchScene('nebula',false);el('status').style.display=opts.hud?'':'none';applyPresentation();toast('设置已恢复默认');});
  win.addEventListener('blur',function(){endInput(true);if(activePointer!==null){try{canvas.releasePointerCapture(activePointer);}catch(ignore){}activePointer=null;}});win.addEventListener('resize',function(){resize();restartTime();});if(win.visualViewport&&win.visualViewport.addEventListener){win.visualViewport.addEventListener('resize',function(){resize();restartTime();});}doc.addEventListener('visibilitychange',function(){visible=!doc.hidden;restartTime();});win.addEventListener('keydown',function(e){if(e.key==='Escape'){controlsOpen=false;setDrawer(null);return;}if(drawer||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key===' '||e.key==='Spacebar'){if(/BUTTON|SUMMARY/.test(e.target.tagName))return;e.preventDefault();el('pauseBtn').click();}var n=Number(e.key);if(n>=1&&n<=6)switchScene(SCENES[n-1].id,false);});attachInputs();}
function start(){var keys=['density','speed','trail','quality','palette','waves','hud'];for(var i=0;i<keys.length;i++){var c=el(keys[i]);if(c.type==='checkbox')c.checked=opts[keys[i]];else c.value=opts[keys[i]];}el('status').style.display=opts.hud?'':'none';updateBtns();bind();initialized=true;applyPresentation();if(pendingHostProperties){var initialProperties=pendingHostProperties;pendingHostProperties=null;win.wallpaperPropertyListener.applyUserProperties(initialProperties,true);}if(ctx){resize();el('coverageStatus').textContent='星点引擎就绪';restartTime();setTimeout(function(){if(showCopy){el('copy').className='center-copy fade';showCopy=false;}},2400);}else{el('fpsStatus').textContent='此浏览器不支持 Canvas';}win.__NebulaDebug={state:function(){return{build:'1.5.0',scene:scene,particles:particles.length,drawn:drawn,fps:Math.round(ema),coverage:coverage,paused:paused,touring:touring,canvasWidth:canvas.width,canvasHeight:canvas.height,logicalWidth:W,logicalHeight:H,quality:opts.quality,options:copy(opts),pointer:{x:pointerX,y:pointerY},hostMode:hostMode,hostPaused:hostPaused,targetFPS:hostFPS,hostEvents:copy(hostEvents),qualityLevel:loadControl.level,frames:frameNumber,simulationSteps:simulationSteps,tails:tailCount,renderCost:lastRenderCost,simulationCost:lastSimulationCost,audioLevel:audioLevel,elapsed:Math.round(elapsed),frameScheduled:!!raf,backgroundCached:!!bgLayer,gesture:{taps:tapCount,drags:dragCount,impulses:dragImpulseCount,active:mouseDown,strokes:dragMarks.length}};},sample:function(){return particles.slice(0,64).map(function(p){return{x:p.x,y:p.y,vx:p.vx,vy:p.vy};});},audio:receiveAudio,select:function(id){switchScene(id,false);},tour:tourStart,pulse:pulse,reset:function(){el('resetBtn').click();}};}
/* Wallpaper Engine callbacks are installed synchronously, outside load events. */
function applyPresentation(){doc.body.className=hostMode&&!opts.showui?'wallpaper-mode':'';canvas.style.filter=opts.brightness===100?'none':'brightness('+opts.brightness/100+')';if(hostMode&&!opts.showui){controlsOpen=false;setDrawer(null);}}
function receiveAudio(samples){if(!opts.audio||!samples||typeof samples.length!=='number'){audioTarget=0;return;}var n=0,total=0;for(var i=0;i<16;i++){var a=Number(samples[i]),b=Number(samples[i+64]);if(isFinite(a)){total+=limit(a,0,1);n++;}if(isFinite(b)){total+=limit(b,0,1);n++;}}audioTarget=n?limit(total/n,0,1):0;}
function enableAudio(){if(!audioRegistered&&typeof win.wallpaperRegisterAudioListener==='function'){win.wallpaperRegisterAudioListener(receiveAudio);audioRegistered=true;}if(!opts.audio)audioTarget=0;}
function parseColor(value){var rgb=String(value).trim().split(/\s+/).map(Number);if(rgb.length!==3||rgb.some(function(n){return!isFinite(n);}))return null;var r=limit(rgb[0],0,1),g=limit(rgb[1],0,1),b=limit(rgb[2],0,1),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;}return(h+360)%360;}
win.wallpaperPropertyListener={
 applyGeneralProperties:function(properties){hostEvents.general++;hostMode=true;if(properties&&typeof properties.fps==='number'&&isFinite(properties.fps))hostFPS=properties.fps<=0?0:limit(properties.fps,1,240);applyPresentation();restartTime();},
 applyUserProperties:function(properties,replay){if(!replay)hostEvents.user++;hostMode=true;properties=properties||{};if(!initialized){pendingHostProperties=pendingHostProperties||{};for(var pendingKey in properties)if(Object.prototype.hasOwnProperty.call(properties,pendingKey))pendingHostProperties[pendingKey]=properties[pendingKey];}var needsLayout=false,needsResize=false,keys=['speed','density','trail','brightness','strength','renderscale'],ranges={speed:[30,170],density:[50,160],trail:[0,100],brightness:[30,140],strength:[0,200],renderscale:[50,150]};
  for(var i=0;i<keys.length;i++){var k=keys[i];if(properties[k]){opts[k]=limit(number(properties[k].value,defaults[k]),ranges[k][0],ranges[k][1]);if(k==='density')needsLayout=true;if(k==='renderscale')needsResize=true;}}
  var bools=['interactive','audio','showui','parallax','customcolor'];for(i=0;i<bools.length;i++){k=bools[i];if(properties[k])opts[k]=properties[k].value===true;}
  if(properties.quality&&['auto','high','low'].indexOf(properties.quality.value)>=0){opts.quality=properties.quality.value;loadControl=new win.NebulaCore.QualityController();qualityStep=1;needsResize=true;}
  if(properties.palette&&['auto','ice','purple','gold'].indexOf(properties.palette.value)>=0)opts.palette=properties.palette.value;
  if(properties.color){var color=parseColor(properties.color.value);if(color!==null)opts.colorHue=color;}
  if(!opts.interactive){endInput(true);activePointer=null;}
  if(initialized){if(needsResize)resize();else if(needsLayout)layout(scene,false);if(properties.scene)switchScene(properties.scene.value,false);if(properties.tour){if(properties.tour.value===true&&!touring)tourStart();else if(properties.tour.value!==true)stopTour();}
   var controls=['speed','density','trail','quality','palette'];for(i=0;i<controls.length;i++){k=controls[i];el(k).value=opts[k];}}
  applyPresentation();enableAudio();save();
 },
 setPaused:function(value){hostEvents.pause++;hostPaused=value===true;endInput(true);activePointer=null;restartTime();}
};
enableAudio();

try{start();}catch(e){el('fallbackText').className='no-canvas';el('fallbackText').textContent='星云引擎启动失败，可继续打开示例与设置：'+e.message;}
})();
