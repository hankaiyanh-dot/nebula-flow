/* Dependency-free playback and load control, shared by browser and logic tests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NebulaCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function PlaybackClock(){this.step=1000/60;this.last=null;this.simCarry=0;this.drawCarry=0;this.sinceDraw=0;this.time=0;}
PlaybackClock.prototype.reset=function(){this.last=null;this.drawCarry=0;this.sinceDraw=0;};
PlaybackClock.prototype.advance=function(now,fps){
 if(this.last===null){this.last=now;return{steps:0,stepMs:this.step,draw:false,drawMs:0,alpha:this.simCarry/this.step};}
 var dt=Math.max(0,Math.min(250,now-this.last));this.last=now;this.simCarry+=dt;this.drawCarry+=dt;this.sinceDraw+=dt;
 var steps=Math.floor((this.simCarry+1e-6)/this.step);this.simCarry=Math.max(0,this.simCarry-steps*this.step);this.time+=steps*this.step;
 var period=fps>0?1000/fps:0,draw=!period||this.drawCarry+1e-6>=period,drawMs=0;
 if(draw){if(period)this.drawCarry=Math.max(0,this.drawCarry-Math.floor((this.drawCarry+1e-6)/period)*period);else this.drawCarry=0;drawMs=this.sinceDraw;this.sinceDraw=0;}
 return{steps:steps,stepMs:this.step,draw:draw,drawMs:drawMs,alpha:this.simCarry/this.step};
};
function QualityController(){this.level=1;this.ema=0;this.pressure=0;this.recovery=0;}
QualityController.prototype.observe=function(cost,budget,dt){
 if(!isFinite(cost)||cost<0)return false;budget=Math.max(4,Math.min(16.667,budget));dt=Math.max(0,Math.min(250,dt));
 this.ema=this.ema?this.ema*.92+cost*.08:cost;var previous=this.level;
 if(this.ema>budget*.8){this.pressure+=dt;this.recovery=0;}else if(this.ema<budget*.45){this.recovery+=dt;this.pressure=Math.max(0,this.pressure-dt);}else{this.pressure=Math.max(0,this.pressure-dt*.5);this.recovery=0;}
 if(this.pressure>=2500){this.level=Math.max(.55,Math.round((this.level-.15)*100)/100);this.pressure=0;this.recovery=0;}
 if(this.recovery>=6000){this.level=Math.min(1,Math.round((this.level+.15)*100)/100);this.pressure=0;this.recovery=0;}
 return this.level!==previous;
};
return{PlaybackClock:PlaybackClock,QualityController:QualityController};
});
