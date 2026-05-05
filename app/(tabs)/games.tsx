import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal,
  SafeAreaView, ActivityIndicator, Linking, Animated, Easing,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";

// Shared sound helper injected into every game
const SND = `var _A=null,SON=true;function snd(f,d,t){if(!SON)return;try{if(!_A||_A.state==="closed")_A=new(window.AudioContext||window.webkitAudioContext)();if(_A.state==="suspended")_A.resume();var o=_A.createOscillator(),g=_A.createGain();o.connect(g);g.connect(_A.destination);o.type=t||"sine";o.frequency.value=f;g.gain.setValueAtTime(0.06,_A.currentTime);g.gain.exponentialRampToValueAtTime(0.001,_A.currentTime+d/1000);o.start();o.stop(_A.currentTime+d/1000);}catch(e){}}`;
const SND_BTN = `<button onclick="SON=!SON;this.textContent=SON?'🔊':'🔇'" style="position:fixed;top:10px;right:10px;font-size:20px;background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:4px 8px;cursor:pointer;z-index:99">🔊</button>`;

const SNAKE_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;touch-action:none;}
body{background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:100vh;font-family:-apple-system,sans-serif;padding:12px;}
h1{color:#4ade80;font-size:26px;font-weight:800;margin-bottom:4px;}
.info{color:#94a3b8;font-size:13px;margin-bottom:10px;display:flex;gap:20px;}
canvas{background:#1e293b;border-radius:12px;border:2px solid #334155;display:block;}
.msg{color:#fbbf24;font-size:18px;font-weight:700;margin:10px 0;min-height:26px;text-align:center;}
.btn{background:#4ade80;color:#0f172a;border:none;border-radius:10px;padding:10px 28px;font-size:15px;font-weight:700;cursor:pointer;}
.dpad{display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,56px);gap:6px;margin-top:14px;}
.dp{width:56px;height:56px;background:#1e3a5f;border:none;border-radius:10px;font-size:22px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;}
.dp:active{background:#2563eb;}
</style></head><body>
${SND_BTN}
<h1>Snake</h1>
<div class="info"><span>Score: <span id="sc">0</span></span><span>Best: <span id="bs">0</span></span></div>
<canvas id="c" width="280" height="280"></canvas>
<div class="msg" id="msg">Tap Play to start!</div>
<button class="btn" id="playBtn" onclick="startGame()">Play</button>
<div class="dpad">
  <div></div><button class="dp" onclick="setDir('up')">&#9650;</button><div></div>
  <button class="dp" onclick="setDir('left')">&#9664;</button>
  <button class="dp" onclick="setDir('down')">&#9660;</button>
  <button class="dp" onclick="setDir('right')">&#9654;</button>
</div>
<script>
${SND}
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
var SKIN=window.SKIN||'#4ade80',SKIN2=window.SKIN2||'#86efac';
var COLS=14,ROWS=14,CW=280/COLS,CH=280/ROWS;
var snake,food,dir,nextDir,score,best=0,running=false,timer;
function setDir(d){
  if(d==='up'&&dir!=='down')nextDir='up';
  else if(d==='down'&&dir!=='up')nextDir='down';
  else if(d==='left'&&dir!=='right')nextDir='left';
  else if(d==='right'&&dir!=='left')nextDir='right';
}
function startGame(){
  snake=[{x:7,y:7},{x:6,y:7},{x:5,y:7}];
  dir='right';nextDir='right';score=0;running=true;
  document.getElementById('msg').textContent='';
  document.getElementById('sc').textContent='0';
  clearInterval(timer);placeFood();draw();
  snd(660,80);
  timer=setInterval(tick,130);
}
function placeFood(){
  do{food={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)};}
  while(snake.some(function(s){return s.x===food.x&&s.y===food.y;}));
}
function tick(){
  if(!running)return;
  dir=nextDir;
  var head={x:snake[0].x,y:snake[0].y};
  if(dir==='up')head.y--;else if(dir==='down')head.y++;
  else if(dir==='left')head.x--;else head.x++;
  if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||snake.some(function(s){return s.x===head.x&&s.y===head.y;})){
    running=false;clearInterval(timer);
    snd(180,350,'sawtooth');
    document.getElementById('msg').textContent='Game Over! Score: '+score;
    return;
  }
  snake.unshift(head);
  if(head.x===food.x&&head.y===food.y){
    score+=10;if(score>best)best=score;
    snd(880,70);
    document.getElementById('sc').textContent=score;
    document.getElementById('bs').textContent=best;
    placeFood();
  }else{snake.pop();}
  draw();
}
function draw(){
  ctx.fillStyle='#1e293b';ctx.fillRect(0,0,280,280);
  snake.forEach(function(s,i){
    ctx.fillStyle=i===0?SKIN2:SKIN;
    ctx.beginPath();ctx.roundRect(s.x*CW+1,s.y*CH+1,CW-2,CH-2,3);ctx.fill();
  });
  ctx.fillStyle='#f87171';
  ctx.beginPath();ctx.arc(food.x*CW+CW/2,food.y*CH+CH/2,CW/2-1,0,Math.PI*2);ctx.fill();
}
var sx,sy;
canvas.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
canvas.addEventListener('touchend',function(e){
  if(!running)return;
  var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
  if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
  if(Math.abs(dx)>Math.abs(dy)){setDir(dx>0?'right':'left');}else{setDir(dy>0?'down':'up');}
});
</script></body></html>`;

const MEMORY_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,sans-serif;background:#f0fdf4;display:flex;flex-direction:column;align-items:center;padding:16px;min-height:100vh;}
h1{font-size:24px;font-weight:800;color:#166534;margin-bottom:6px;}
.info{display:flex;gap:20px;margin-bottom:14px;color:#374151;font-size:14px;font-weight:600;}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;max-width:320px;}
.card{aspect-ratio:1;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:30px;border:none;-webkit-tap-highlight-color:transparent;transition:transform 0.12s;}
.card:active{transform:scale(0.9);}
.card.back{background:#16a34a;}
.card.front{background:#fff;border:2px solid #86efac;}
.card.matched{background:#dcfce7;border:2px solid #4ade80;opacity:0.7;}
.btn{background:#16a34a;color:#fff;border:none;border-radius:10px;padding:10px 28px;font-size:15px;font-weight:700;cursor:pointer;margin-top:14px;}
.win{font-size:20px;font-weight:700;color:#16a34a;margin-top:10px;text-align:center;}
</style></head><body>
${SND_BTN}
<h1>Memory Match</h1>
<div class="info">
  <span>Moves: <span id="moves">0</span></span>
  <span>Pairs: <span id="pairs">0</span>/8</span>
</div>
<div class="grid" id="grid"></div>
<div class="win" id="win"></div>
<button class="btn" onclick="init()">New Game</button>
<script>
${SND}
var EMOJIS=['dog','cat','rabbit','bear','fox','panda','lion','tiger'];
var FACES={'dog':'🐶','cat':'🐱','rabbit':'🐰','bear':'🐻','fox':'🦊','panda':'🐼','lion':'🦁','tiger':'🐯'};
var flipped=[],matched=0,moves=0,locked=false,cards=[];
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function init(){
  flipped=[];matched=0;moves=0;locked=false;
  document.getElementById('moves').textContent='0';
  document.getElementById('pairs').textContent='0';
  document.getElementById('win').textContent='';
  var deck=shuffle(EMOJIS.concat(EMOJIS));
  var grid=document.getElementById('grid');
  grid.innerHTML='';cards=[];
  deck.forEach(function(name,i){
    var btn=document.createElement('button');
    btn.className='card back';
    btn.dataset.name=name;
    btn.dataset.idx=i;
    btn.onclick=function(){flip(btn);};
    grid.appendChild(btn);
    cards.push(btn);
  });
}
function flip(card){
  if(locked||card.classList.contains('front')||card.classList.contains('matched'))return;
  snd(440,40,'triangle');
  card.classList.remove('back');card.classList.add('front');
  card.textContent=FACES[card.dataset.name];
  flipped.push(card);
  if(flipped.length===2){
    locked=true;moves++;
    document.getElementById('moves').textContent=moves;
    if(flipped[0].dataset.name===flipped[1].dataset.name){
      snd(740,100);
      flipped[0].classList.add('matched');flipped[1].classList.add('matched');
      matched++;document.getElementById('pairs').textContent=matched;
      flipped=[];locked=false;
      if(matched===8){snd(1046,400);document.getElementById('win').textContent='You Win! '+moves+' moves!';}
    }else{
      snd(220,130,'square');
      setTimeout(function(){
        flipped[0].classList.remove('front');flipped[0].classList.add('back');flipped[0].textContent='';
        flipped[1].classList.remove('front');flipped[1].classList.add('back');flipped[1].textContent='';
        flipped=[];locked=false;
      },900);
    }
  }
}
init();
</script></body></html>`;

const WHACK_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,sans-serif;background:#fef9c3;display:flex;flex-direction:column;align-items:center;padding:16px;min-height:100vh;}
h1{font-size:26px;font-weight:800;color:#92400e;margin-bottom:8px;}
.info{display:flex;gap:24px;margin-bottom:16px;}
.info span{font-size:16px;font-weight:600;color:#374151;}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;max-width:300px;}
.hole{aspect-ratio:1;border-radius:50%;background:#a16207;cursor:pointer;border:none;font-size:44px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:transform 0.1s;}
.hole:active{transform:scale(0.88);}
.hole.empty{background:#78350f;}
.btn{background:#d97706;color:#fff;border:none;border-radius:10px;padding:10px 28px;font-size:15px;font-weight:700;cursor:pointer;margin-top:16px;}
.result{font-size:18px;font-weight:700;color:#92400e;margin-top:10px;text-align:center;}
</style></head><body>
${SND_BTN}
<h1>Whack-A-Mole!</h1>
<div class="info">
  <span>Score: <span id="sc">0</span></span>
  <span>Time: <span id="tm">30</span>s</span>
</div>
<div class="grid" id="grid"></div>
<div class="result" id="result"></div>
<button class="btn" id="startBtn" onclick="startGame()">Start Game</button>
<script>
${SND}
var holes=[],moleIdx=-1,score=0,timeLeft=30,running=false,moleTimer,cTimer;
function buildGrid(){
  var grid=document.getElementById('grid');
  grid.innerHTML='';holes=[];
  for(var i=0;i<9;i++){
    var div=document.createElement('button');
    div.className='hole empty';
    div.dataset.i=i;
    (function(idx,el){
      el.onclick=function(){
        if(!running||moleIdx!==idx)return;
        snd(900,60);
        score++;document.getElementById('sc').textContent=score;
        el.textContent='';el.className='hole empty';
        moleIdx=-1;clearTimeout(moleTimer);
        showMole();
      };
    })(i,div);
    holes.push(div);grid.appendChild(div);
  }
}
function showMole(){
  if(!running)return;
  var idx;do{idx=Math.floor(Math.random()*9);}while(idx===moleIdx);
  if(moleIdx>=0&&holes[moleIdx]){holes[moleIdx].textContent='';holes[moleIdx].className='hole empty';}
  moleIdx=idx;
  holes[idx].className='hole';holes[idx].textContent='🦔';
  var delay=Math.max(500,1200-score*25);
  moleTimer=setTimeout(function(){
    if(moleIdx===idx){holes[idx].textContent='';holes[idx].className='hole empty';moleIdx=-1;showMole();}
  },delay);
}
function startGame(){
  score=0;timeLeft=30;running=true;moleIdx=-1;
  document.getElementById('sc').textContent='0';
  document.getElementById('tm').textContent='30';
  document.getElementById('result').textContent='';
  document.getElementById('startBtn').disabled=true;
  buildGrid();showMole();
  cTimer=setInterval(function(){
    timeLeft--;document.getElementById('tm').textContent=timeLeft;
    if(timeLeft<=0){
      clearInterval(cTimer);clearTimeout(moleTimer);
      running=false;moleIdx=-1;
      snd(180,350,'sawtooth');
      holes.forEach(function(h){h.textContent='';h.className='hole empty';});
      document.getElementById('startBtn').disabled=false;
      document.getElementById('result').textContent='Game Over! Final Score: '+score;
    }
  },1000);
}
buildGrid();
</script></body></html>`;

const FLAPPY_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;touch-action:none;}
body{background:#87CEEB;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,sans-serif;overflow:hidden;position:relative;}
canvas{border-radius:12px;border:3px solid rgba(255,255,255,0.5);}
#overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:10px;}
#overlay h2{font-size:28px;font-weight:800;}
#overlay p{font-size:15px;opacity:0.85;}
#overlay button{background:#fff;color:#22c55e;border:none;border-radius:12px;padding:12px 32px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;}
</style></head><body>
${SND_BTN}
<canvas id="c"></canvas>
<div id="overlay">
  <div style="font-size:56px">🐦</div>
  <h2>Flappy Bird</h2>
  <p>Tap screen or press Space to flap!</p>
  <button onclick="startGame()">Play</button>
</div>
<script>
${SND}
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
var W,H,bird,pipes,score,best=0,running=false,aId,frame,GAP=130,SPEED=2.8,PIPE_W=52,INT=90;
function resize(){W=Math.min(320,window.innerWidth-4);H=Math.min(500,window.innerHeight-4);canvas.width=W;canvas.height=H;}
resize();
function startGame(){
  document.getElementById('overlay').style.display='none';
  bird={x:80,y:H/2,v:0,r:14};pipes=[];score=0;frame=0;running=true;
  snd(660,80);
  cancelAnimationFrame(aId);loop();
}
function flap(){if(running){bird.v=-7.5;snd(440,55);}}
canvas.addEventListener('touchstart',flap,{passive:true});
canvas.addEventListener('click',flap);
document.addEventListener('keydown',function(e){if(e.code==='Space'){e.preventDefault();flap();}});
function loop(){
  if(!running)return;
  aId=requestAnimationFrame(loop);
  frame++;bird.v+=0.42;bird.y+=bird.v;
  if(frame%INT===0){
    var top=Math.random()*(H-GAP-100)+50;
    pipes.push({x:W,top:top,btm:top+GAP,ok:false});
  }
  pipes.forEach(function(p){p.x-=SPEED;});
  pipes=pipes.filter(function(p){return p.x>-PIPE_W;});
  for(var i=0;i<pipes.length;i++){
    var p=pipes[i];
    if(!p.ok&&p.x+PIPE_W<bird.x){p.ok=true;score++;snd(660,70);}
    if(bird.x+bird.r>p.x&&bird.x-bird.r<p.x+PIPE_W&&(bird.y-bird.r<p.top||bird.y+bird.r>p.btm)){endGame();return;}
  }
  if(bird.y+bird.r>H||bird.y-bird.r<0){endGame();return;}
  draw();
}
function draw(){
  ctx.fillStyle='#87CEEB';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#22c55e';
  pipes.forEach(function(p){
    ctx.beginPath();ctx.roundRect(p.x,0,PIPE_W,p.top,6);ctx.fill();
    ctx.beginPath();ctx.roundRect(p.x,p.btm,PIPE_W,H-p.btm,6);ctx.fill();
    ctx.fillStyle='#15803d';
    ctx.beginPath();ctx.roundRect(p.x-4,p.top-18,PIPE_W+8,20,4);ctx.fill();
    ctx.beginPath();ctx.roundRect(p.x-4,p.btm,PIPE_W+8,20,4);ctx.fill();
    ctx.fillStyle='#22c55e';
  });
  ctx.font='28px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('🐦',bird.x,bird.y);
  ctx.fillStyle='#fff';ctx.font='bold 20px -apple-system';ctx.textAlign='left';
  ctx.fillText(score,14,28);
}
function endGame(){
  running=false;if(score>best)best=score;
  snd(180,350,'sawtooth');
  var ov=document.getElementById('overlay');
  ov.innerHTML='<div style="font-size:48px">💥</div><h2>Game Over!</h2><p>Score: '+score+' | Best: '+best+'</p><button onclick="startGame()">Try Again</button>';
  ov.style.display='flex';ov.style.flexDirection='column';ov.style.alignItems='center';ov.style.justifyContent='center';ov.style.gap='10px';
}
</script></body></html>`;

const BREAKOUT_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;touch-action:none;}
body{background:#1a0533;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,sans-serif;overflow:hidden;}
canvas{border-radius:10px;border:2px solid #7c3aed;display:block;}
.ui{color:#fff;font-size:14px;margin-bottom:8px;display:flex;gap:20px;}
.btn{background:#7c3aed;color:#fff;border:none;border-radius:10px;padding:10px 28px;font-size:15px;font-weight:700;cursor:pointer;margin-top:10px;}
#msg{color:#fbbf24;font-size:18px;font-weight:700;margin:8px 0;min-height:24px;text-align:center;}
</style></head><body>
${SND_BTN}
<div class="ui"><span>Score: <span id="sc">0</span></span><span>Lives: <span id="lv">3</span></span><span>Best: <span id="bs">0</span></span></div>
<canvas id="c"></canvas>
<div id="msg">Tap Play to start!</div>
<button class="btn" onclick="startGame()">Play</button>
<script>
${SND}
var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
var SKIN=window.SKIN||'#a78bfa';
var W=Math.min(300,window.innerWidth-8),H=Math.min(380,window.innerHeight-120);
canvas.width=W;canvas.height=H;
var bx,by,bdx,bdy,px,py,pw,ph=12,br=8,score,lives,best=0,bricks,running=false,aId;
var ROWS=5,COLS=7,BPAD=4,bw;
var COLORS=['#f87171','#fb923c','#facc15','#4ade80','#60a5fa','#c084fc','#f472b6'];
function makeBricks(){
  bw=Math.floor((W-BPAD*(COLS+1))/COLS);var bh=22;bricks=[];
  for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++){
    bricks.push({x:BPAD+c*(bw+BPAD),y:40+r*(bh+BPAD),w:bw,h:bh,color:COLORS[r],alive:true});
  }
}
function startGame(){
  pw=70;ph=12;bx=W/2;by=H-50;br=8;
  bdx=3.2*(Math.random()>0.5?1:-1);bdy=-3.5;
  px=(W-pw)/2;py=H-20;
  score=0;lives=3;running=true;
  snd(660,80);
  document.getElementById('sc').textContent='0';
  document.getElementById('lv').textContent='3';
  document.getElementById('msg').textContent='';
  makeBricks();cancelAnimationFrame(aId);loop();
}
function loop(){
  if(!running)return;
  aId=requestAnimationFrame(loop);
  bx+=bdx;by+=bdy;
  if(bx-br<0){bx=br;bdx=Math.abs(bdx);snd(440,30);}
  if(bx+br>W){bx=W-br;bdx=-Math.abs(bdx);snd(440,30);}
  if(by-br<0){by=br;bdy=Math.abs(bdy);snd(440,30);}
  if(by+br>py&&by-br<py+ph&&bx>px&&bx<px+pw){
    snd(500,35);
    bdy=-Math.abs(bdy);
    var rel=(bx-(px+pw/2))/(pw/2);
    bdx=rel*4;
  }
  if(by+br>H){lives--;document.getElementById('lv').textContent=lives;snd(220,200,'sawtooth');if(lives<=0){endGame('Game Over!');return;}bx=W/2;by=H-50;bdx=3.2*(Math.random()>0.5?1:-1);bdy=-3.5;}
  bricks.forEach(function(b){
    if(!b.alive)return;
    if(bx+br>b.x&&bx-br<b.x+b.w&&by+br>b.y&&by-br<b.y+b.h){
      b.alive=false;score+=10;document.getElementById('sc').textContent=score;
      snd(820,40,'square');
      if(by<b.y+b.h/2||by>b.y+b.h/2)bdy=-bdy;else bdx=-bdx;
    }
  });
  if(bricks.every(function(b){return !b.alive;})){snd(1046,400);endGame('You Win!');return;}
  draw();
}
function draw(){
  ctx.fillStyle='#1a0533';ctx.fillRect(0,0,W,H);
  bricks.forEach(function(b){
    if(!b.alive)return;
    ctx.fillStyle=b.color;ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,4);ctx.fill();
  });
  ctx.fillStyle=SKIN;ctx.beginPath();ctx.roundRect(px,py,pw,ph,8);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();
}
function endGame(msg){
  running=false;if(score>best)best=score;document.getElementById('bs').textContent=best;
  if(msg==='Game Over!')snd(180,300,'sawtooth');
  document.getElementById('msg').textContent=msg+' Score: '+score;
}
var touchX=null;
canvas.addEventListener('touchstart',function(e){touchX=e.touches[0].clientX;},{passive:true});
canvas.addEventListener('touchmove',function(e){
  if(touchX===null)return;
  var dx=e.touches[0].clientX-touchX;
  touchX=e.touches[0].clientX;
  px=Math.max(0,Math.min(W-pw,px+dx));
},{passive:true});
draw();
</script></body></html>`;

const TIC_TAC_TOE_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,sans-serif;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;}
h1{font-size:28px;font-weight:800;color:#1e293b;margin-bottom:8px;}
.status{font-size:16px;color:#64748b;margin-bottom:24px;font-weight:500;}
.board{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px;}
.cell{width:100px;height:100px;background:#fff;border-radius:16px;border:2px solid #e2e8f0;font-size:44px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform 0.1s;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
.cell:active{transform:scale(0.93);}
.btn{background:#2563eb;color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:16px;font-weight:700;cursor:pointer;}
.winner{color:#059669;font-weight:700;font-size:20px;}
.draw{color:#d97706;}
</style></head><body>
${SND_BTN}
<h1>Tic-Tac-Toe</h1>
<div class="status" id="status">Player X turn</div>
<div class="board" id="board"></div>
<button class="btn" onclick="resetGame()">New Game</button>
<script>
${SND}
var board=Array(9).fill(''),current='X',gameOver=false;
var wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function render(){
  var b=document.getElementById('board');
  b.innerHTML=board.map(function(v,i){
    var sym=v==='X'?'&#10006;':v==='O'?'&#9711;':'';
    return '<div class="cell" onclick="play('+i+')" style="'+(v?'background:'+(v==='X'?'#EFF6FF':'#FFF0F0')+'':'')+'">'+sym+'</div>';
  }).join('');
}
function checkWinner(){
  for(var k=0;k<wins.length;k++){var a=wins[k][0],b=wins[k][1],c=wins[k][2];if(board[a]&&board[a]===board[b]&&board[a]===board[c])return board[a];}
  return board.every(function(v){return v;})?'draw':null;
}
function play(i){
  if(board[i]||gameOver)return;
  snd(current==='X'?700:520,55,'triangle');
  board[i]=current;var w=checkWinner();
  if(w){gameOver=true;
    if(w==='draw'){snd(300,200,'triangle');document.getElementById('status').innerHTML='<span class="draw">Draw! Tie game</span>';}
    else{snd(1046,350);document.getElementById('status').innerHTML='<span class="winner">Player '+w+' Wins! 🎉</span>';}
  }else{current=current==='X'?'O':'X';document.getElementById('status').textContent='Player '+current+' turn';}
  render();
}
function resetGame(){board=Array(9).fill('');current='X';gameOver=false;document.getElementById('status').textContent='Player X turn';render();}
render();
</script></body></html>`;

const GAME_2048_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;margin:0;padding:0;touch-action:none;}
body{font-family:-apple-system,sans-serif;background:#faf8ef;display:flex;flex-direction:column;align-items:center;padding:20px;}
h1{font-size:36px;font-weight:800;color:#776e65;margin-bottom:4px;}
.score-row{display:flex;gap:10px;margin-bottom:16px;}
.score-box{background:#bbada0;border-radius:8px;padding:8px 16px;text-align:center;}
.score-label{font-size:11px;color:#eee4da;font-weight:600;text-transform:uppercase;}
.score-val{font-size:20px;font-weight:800;color:#fff;}
.grid{background:#bbada0;border-radius:12px;padding:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;max-width:340px;}
.tile{width:100%;aspect-ratio:1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;transition:all 0.1s;}
.btn{background:#8f7a66;color:#f9f6f2;border:none;border-radius:10px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;margin-top:16px;}
.msg{font-size:20px;font-weight:700;color:#f67c5f;margin-top:12px;}
</style></head><body>
${SND_BTN}
<h1>2048</h1>
<div class="score-row">
  <div class="score-box"><div class="score-label">Score</div><div class="score-val" id="score">0</div></div>
  <div class="score-box"><div class="score-label">Best</div><div class="score-val" id="best">0</div></div>
</div>
<div class="grid" id="grid"></div>
<div class="msg" id="msg"></div>
<button class="btn" onclick="init()">New Game</button>
<script>
${SND}
var COLS={0:'#cdc1b4',2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',1024:'#edc53f',2048:'#edc22e'};
var TC={0:'#776e65',2:'#776e65',4:'#776e65',8:'#f9f6f2',16:'#f9f6f2',32:'#f9f6f2',64:'#f9f6f2',128:'#f9f6f2',256:'#f9f6f2',512:'#f9f6f2',1024:'#f9f6f2',2048:'#f9f6f2'};
var grid,score=0,best=0;
function init(){grid=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];score=0;document.getElementById('msg').textContent='';addTile();addTile();render();}
function addTile(){var empty=[];for(var r=0;r<4;r++)for(var c=0;c<4;c++)if(!grid[r][c])empty.push([r,c]);if(!empty.length)return;var rc=empty[Math.floor(Math.random()*empty.length)];grid[rc[0]][rc[1]]=Math.random()<0.9?2:4;}
function render(){var g=document.getElementById('grid');g.innerHTML=grid.reduce(function(a,row){return a.concat(row);},[]).map(function(v){var bg=COLS[v]||'#3c3a32';var tc=TC[v]||'#fff';var fs=v>999?'16px':v>99?'20px':'24px';return '<div class="tile" style="background:'+bg+';color:'+tc+';font-size:'+fs+'">'+(v||'')+'</div>';}).join('');document.getElementById('score').textContent=score;document.getElementById('best').textContent=best;}
function slide(row){var r=row.filter(function(v){return v;});for(var i=0;i<r.length-1;i++)if(r[i]===r[i+1]){score+=r[i]*2;if(score>best)best=score;snd(r[i]>=512?880:660,50,'triangle');if(r[i]*2===2048){snd(1046,500);document.getElementById('msg').textContent='You Win! 🎉';}r[i]*=2;r.splice(i+1,1);}while(r.length<4)r.push(0);return r;}
function move(dir){var moved=false;if(dir==='l'||dir==='r'){for(var r=0;r<4;r++){var row=dir==='r'?grid[r].slice().reverse():grid[r].slice();var slid=slide(row);if(dir==='r')slid.reverse();if(slid.join()!==grid[r].join())moved=true;grid[r]=slid;}}else{for(var c=0;c<4;c++){var col=grid.map(function(row){return row[c];});if(dir==='d')col.reverse();var slid=slide(col);if(dir==='d')slid.reverse();if(slid.join()!==col.join())moved=true;slid.forEach(function(v,r){grid[r][c]=v;});}}if(moved){addTile();render();if(!canMove()){snd(180,350,'sawtooth');document.getElementById('msg').textContent='Game Over!';}}}
function canMove(){for(var r=0;r<4;r++)for(var c=0;c<4;c++){if(!grid[r][c])return true;if(c<3&&grid[r][c]===grid[r][c+1])return true;if(r<3&&grid[r][c]===grid[r+1][c])return true;}return false;}
var sx,sy;
document.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
document.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<30)return;Math.abs(dx)>Math.abs(dy)?move(dx>0?'r':'l'):move(dy>0?'d':'u');});
document.addEventListener('keydown',function(e){var m={'ArrowLeft':'l','ArrowRight':'r','ArrowUp':'u','ArrowDown':'d'};if(m[e.key])move(m[e.key]);});
init();
</script></body></html>`;

const MINESWEEPER_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;touch-action:none;}
body{font-family:-apple-system,sans-serif;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;padding:14px;min-height:100vh;}
h1{font-size:24px;font-weight:800;color:#1e293b;margin-bottom:6px;}
.info{display:flex;gap:20px;margin-bottom:10px;align-items:center;}
.info span{font-size:15px;font-weight:600;color:#475569;}
.grid{display:grid;gap:3px;margin-bottom:12px;}
.cell{width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;cursor:pointer;border:none;-webkit-tap-highlight-color:transparent;}
.cell.hidden{background:#94a3b8;}
.cell.hidden:active{background:#64748b;}
.cell.revealed{background:#e2e8f0;cursor:default;}
.cell.mine{background:#ef4444;}
.cell.flagged{background:#f59e0b;}
.btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;margin:4px;}
.msg{font-size:18px;font-weight:700;margin:8px 0;text-align:center;min-height:26px;}
.win{color:#059669;} .lose{color:#ef4444;}
.hint{font-size:12px;color:#94a3b8;text-align:center;margin-top:4px;}
.n1{color:#2563eb;}.n2{color:#059669;}.n3{color:#ef4444;}.n4{color:#7c3aed;}.n5{color:#b45309;}.n6{color:#0891b2;}.n7{color:#1e293b;}.n8{color:#475569;}
</style></head><body>
${SND_BTN}
<h1>Minesweeper</h1>
<div class="info">
  <span>Mines: <span id="mct">0</span></span>
  <span>Time: <span id="tm">0</span>s</span>
  <button class="btn" onclick="init()">New</button>
</div>
<div class="grid" id="grid"></div>
<div class="msg" id="msg"></div>
<div class="hint">Long press to place a flag</div>
<script>
${SND}
var ROWS=9,COLS=9,MINES=10;
var cells,mines,revealed,flagged,firstClick,gameOver,timer,seconds;
function init(){
  cells=[];mines=new Set();revealed=new Set();flagged=new Set();
  firstClick=true;gameOver=false;seconds=0;
  clearInterval(timer);document.getElementById('tm').textContent='0';
  document.getElementById('msg').textContent='';
  document.getElementById('mct').textContent=MINES;
  var grid=document.getElementById('grid');
  grid.innerHTML='';
  grid.style.gridTemplateColumns='repeat('+COLS+',32px)';
  for(var i=0;i<ROWS*COLS;i++){
    var cell=document.createElement('div');
    cell.className='cell hidden';
    cell.dataset.i=i;
    (function(idx,el){
      el.onclick=function(){reveal(idx);};
      var pt;
      el.addEventListener('touchstart',function(e){pt=setTimeout(function(){toggleFlag(idx);},500);},{passive:true});
      el.addEventListener('touchend',function(){clearTimeout(pt);},{passive:true});
      el.oncontextmenu=function(e){e.preventDefault();toggleFlag(idx);};
    })(i,cell);
    cells.push(cell);grid.appendChild(cell);
  }
}
function placeMines(safe){
  var positions=[];
  for(var i=0;i<ROWS*COLS;i++)if(i!==safe)positions.push(i);
  for(var m=0;m<MINES;m++){var idx=Math.floor(Math.random()*positions.length);mines.add(positions.splice(idx,1)[0]);}
}
function neighbors(idx){var r=Math.floor(idx/COLS),c=idx%COLS,nb=[];for(var dr=-1;dr<=1;dr++)for(var dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;var nr=r+dr,nc=c+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS)nb.push(nr*COLS+nc);}return nb;}
function countMines(idx){return neighbors(idx).filter(function(n){return mines.has(n);}).length;}
function reveal(idx){
  if(gameOver||flagged.has(idx)||revealed.has(idx))return;
  if(firstClick){firstClick=false;placeMines(idx);timer=setInterval(function(){seconds++;document.getElementById('tm').textContent=seconds;},1000);}
  if(mines.has(idx)){
    clearInterval(timer);gameOver=true;
    snd(150,400,'sawtooth');
    mines.forEach(function(m){cells[m].className='cell mine';cells[m].textContent='💣';});
    document.getElementById('msg').innerHTML='<span class="lose">💥 Boom! You hit a mine!</span>';return;
  }
  var queue=[idx];
  while(queue.length){
    var cur=queue.shift();
    if(revealed.has(cur))continue;
    revealed.add(cur);
    var cnt=countMines(cur);
    cells[cur].className='cell revealed';
    if(cnt>0){cells[cur].textContent=cnt;cells[cur].classList.add('n'+cnt);}
    else{neighbors(cur).forEach(function(n){if(!revealed.has(n)&&!mines.has(n))queue.push(n);});}
  }
  snd(440,25);
  if(revealed.size===ROWS*COLS-MINES){clearInterval(timer);gameOver=true;snd(1046,350);document.getElementById('msg').innerHTML='<span class="win">🎉 You Win! '+seconds+'s</span>';}
}
function toggleFlag(idx){
  if(gameOver||revealed.has(idx))return;
  if(flagged.has(idx)){flagged.delete(idx);cells[idx].className='cell hidden';cells[idx].textContent='';}
  else{flagged.add(idx);cells[idx].className='cell flagged';cells[idx].textContent='🚩';snd(520,35,'square');}
  document.getElementById('mct').textContent=MINES-flagged.size;
}
init();
</script></body></html>`;

const WORDLE_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,sans-serif;background:#fff;display:flex;flex-direction:column;align-items:center;padding:12px;min-height:100vh;user-select:none;}
h1{font-size:26px;font-weight:800;color:#1a1a1b;border-bottom:1px solid #d3d6da;width:100%;text-align:center;padding-bottom:10px;margin-bottom:12px;letter-spacing:4px;}
.board{display:flex;flex-direction:column;gap:5px;margin-bottom:14px;}
.row{display:flex;gap:5px;}
.tile{width:52px;height:52px;border:2px solid #d3d6da;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#1a1a1b;text-transform:uppercase;transition:background 0.3s;}
.tile.tbd{border-color:#878a8c;animation:pop 0.1s ease;}
@keyframes pop{0%{transform:scale(1);}50%{transform:scale(1.12);}100%{transform:scale(1);}}
.tile.correct{background:#6aaa64;border-color:#6aaa64;color:#fff;}
.tile.present{background:#c9b458;border-color:#c9b458;color:#fff;}
.tile.absent{background:#787c7e;border-color:#787c7e;color:#fff;}
.msg{min-height:28px;font-size:16px;font-weight:700;color:#1a1a1b;text-align:center;margin-bottom:8px;}
.kbd{display:flex;flex-direction:column;gap:6px;width:100%;max-width:340px;}
.krow{display:flex;gap:4px;justify-content:center;}
.key{height:44px;min-width:32px;padding:0 6px;border-radius:4px;background:#d3d6da;border:none;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;text-transform:uppercase;-webkit-tap-highlight-color:transparent;flex:1;max-width:40px;}
.key.wide{min-width:52px;max-width:60px;font-size:11px;}
.key.correct{background:#6aaa64;color:#fff;}
.key.present{background:#c9b458;color:#fff;}
.key.absent{background:#787c7e;color:#fff;}
.btn{background:#6aaa64;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;margin-top:10px;}
</style></head><body>
${SND_BTN}
<h1>Wordle</h1>
<div class="board" id="board"></div>
<div class="msg" id="msg">Guess the 5-letter word!</div>
<div class="kbd" id="kbd"></div>
<button class="btn" id="newBtn" onclick="newGame()" style="display:none">Play Again</button>
<script>
${SND}
var WORDS=["about","above","abuse","actor","acute","admit","adopt","adult","after","again","agent","agree","ahead","alarm","album","alert","alike","align","alive","alley","allow","alone","along","aloud","angel","anger","angle","angry","ankle","annoy","apple","apply","arena","argue","arise","armor","array","arrow","aside","asset","audio","audit","avoid","awake","award","aware","awful","baker","basic","basis","batch","beach","began","being","below","bench","blade","blast","blaze","bleed","bless","blind","block","blood","bloom","blown","blues","blunt","board","bonus","boost","booth","bound","boxer","brain","brand","brave","bread","break","breed","brick","bride","brief","bring","broad","broke","brook","brown","brush","buddy","build","built","burst","buyer","cabin","candy","carry","catch","cause","chair","chaos","charm","chart","chase","cheap","check","cheek","cheer","child","china","civic","civil","claim","class","clean","clear","click","climb","cling","clock","close","cloud","coach","coast","color","coral","could","count","court","cover","crack","craft","crash","cream","creek","crime","cross","crowd","cruel","crush","curve","cycle","daily","dance","death","delta","dense","depth","devil","dirty","dizzy","dodge","doubt","dough","draft","drain","drama","dream","dress","dried","drift","drink","drive","drops","drove","drown","eagle","early","earth","eight","elite","enemy","enjoy","enter","equal","error","essay","evade","event","every","exact","extra","faint","faith","fancy","fatal","fault","feast","fewer","fiber","field","fight","final","first","fixed","flame","flare","flask","fleet","flesh","float","flood","floor","fluid","focus","force","forge","forum","found","frame","frank","fraud","fresh","front","frost","froze","fruit","fully","funny","fuzzy","ghost","giant","given","glare","gleam","gloom","glory","gloss","glove","grace","grade","grain","grand","grant","graph","grasp","grass","great","greed","green","greet","grief","grill","grind","groan","group","grove","grown","guess","guide","guild","guilt","happy","harsh","heart","heard","heavy","herbs","hobby","honor","horse","hotel","house","human","image","inner","input","issue","jewel","judge","juice","kayak","knife","knock","labor","large","laser","later","layer","learn","least","legal","level","light","limit","linen","liver","local","lodge","logic","loose","lower","lunar","magic","manor","maple","mayor","medal","media","mercy","merge","merit","metal","meter","might","minor","minus","mixed","model","month","moral","movie","mural","music","naive","needs","nerve","night","noble","noise","north","noted","novel","nurse","ocean","often","onion","opera","order","other","outer","ozone","paint","panic","paper","pasta","patch","peace","pearl","phone","photo","piano","pilot","pinch","pizza","place","plain","plant","plaza","point","polar","power","press","price","pride","prime","print","probe","proof","prose","proud","prove","pulse","punch","pupil","purse","queen","query","quest","quick","quiet","quote","radar","radio","raise","rally","ranch","rapid","ratio","reach","ready","realm","rebel","refer","relax","risky","river","roast","robot","rocky","round","route","royal","ruler","rumor","rural","salad","sauce","scale","scary","scene","scent","score","scout","seize","sense","serve","seven","shall","shame","shape","share","shark","sharp","shell","shift","shine","shirt","shock","shore","shout","shown","shrug","sight","sixth","sized","skill","skull","slate","slice","slide","slope","smell","smile","smoke","solar","solid","solve","sorry","sound","space","spare","spark","speak","spend","spice","spike","spine","spoil","spoon","sport","spray","squad","stack","staff","stage","stain","stale","stalk","stall","stamp","stand","stare","start","state","steal","steam","steel","stick","still","stock","stone","story","stove","strap","straw","stray","strip","stuck","study","stump","style","sugar","suite","sunny","super","surge","swamp","swear","sweat","sweep","sweet","swift","swipe","swirl","sword","taste","teach","terms","theme","thick","thing","think","three","tiger","tight","tired","title","today","token","total","touch","tough","towel","toxic","trace","track","trade","trail","train","trash","treat","trend","trial","tribe","trick","tried","trout","truck","truly","trust","truth","twice","twist","uncle","under","union","unite","until","valid","valor","value","vapor","vault","venue","verse","viral","virus","visit","vital","vivid","vocal","voice","voter","waste","watch","water","weary","weave","weird","whale","wheat","wheel","white","whole","wider","witch","woman","world","worry","worse","worst","worth","would","wound","write","yield","young","youth"];
var TARGET,guesses,currentGuess,gameOver,maxGuesses=6;
var keyState={};
function newGame(){
  TARGET=WORDS[Math.floor(Math.random()*WORDS.length)];
  guesses=[];currentGuess='';gameOver=false;keyState={};
  document.getElementById('msg').textContent='Guess the 5-letter word!';
  document.getElementById('newBtn').style.display='none';
  buildBoard();buildKeyboard();
}
function buildBoard(){
  var board=document.getElementById('board');board.innerHTML='';
  for(var r=0;r<maxGuesses;r++){
    var row=document.createElement('div');row.className='row';row.id='row'+r;
    for(var c=0;c<5;c++){var tile=document.createElement('div');tile.className='tile';tile.id='t'+r+c;row.appendChild(tile);}
    board.appendChild(row);
  }
  restoreGuesses();
}
function restoreGuesses(){
  guesses.forEach(function(g,r){
    var result=scoreGuess(g);
    for(var c=0;c<5;c++){var t=document.getElementById('t'+r+c);t.textContent=g[c];t.className='tile '+result[c];}
  });
  updateCurrent();
}
function buildKeyboard(){
  var rows=[['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['Enter','z','x','c','v','b','n','m','Del']];
  var kbd=document.getElementById('kbd');kbd.innerHTML='';
  rows.forEach(function(row){
    var krow=document.createElement('div');krow.className='krow';
    row.forEach(function(k){
      var btn=document.createElement('button');
      btn.className='key'+(k.length>1?' wide':'');
      btn.textContent=k==='Del'?'Del':k;
      btn.dataset.k=k;
      btn.onclick=function(){handleKey(k);};
      krow.appendChild(btn);
    });
    kbd.appendChild(krow);
  });
}
function scoreGuess(guess){
  var result=Array(5).fill('absent');var targetLeft=TARGET.split('');
  for(var i=0;i<5;i++)if(guess[i]===TARGET[i]){result[i]='correct';targetLeft[i]=null;}
  for(var i=0;i<5;i++){if(result[i]!=='correct'){var j=targetLeft.indexOf(guess[i]);if(j>=0){result[i]='present';targetLeft[j]=null;}}}
  return result;
}
function updateCurrent(){
  var row=guesses.length;if(row>=maxGuesses)return;
  for(var c=0;c<5;c++){var t=document.getElementById('t'+row+c);t.textContent=c<currentGuess.length?currentGuess[c]:'';t.className=c<currentGuess.length?'tile tbd':'tile';}
}
function handleKey(key){
  if(gameOver)return;
  if(key==='Enter'){
    if(currentGuess.length<5){snd(220,80,'square');document.getElementById('msg').textContent='Not enough letters!';return;}
    if(!WORDS.includes(currentGuess)){snd(220,130,'square');document.getElementById('msg').textContent='Not in word list!';return;}
    var result=scoreGuess(currentGuess);var row=guesses.length;
    for(var c=0;c<5;c++){
      var t=document.getElementById('t'+row+c);t.className='tile '+result[c];
      var cls=result[c];
      if(!keyState[currentGuess[c]]||cls==='correct'||(cls==='present'&&keyState[currentGuess[c]]==='absent'))keyState[currentGuess[c]]=cls;
    }
    guesses.push(currentGuess);
    updateKeyColors();
    if(currentGuess===TARGET){gameOver=true;snd(1046,450);document.getElementById('msg').textContent='Genius! 🎉 You got it!';document.getElementById('newBtn').style.display='inline-block';}
    else if(guesses.length>=maxGuesses){gameOver=true;snd(180,300,'sawtooth');document.getElementById('msg').textContent='The word was: '+TARGET.toUpperCase();document.getElementById('newBtn').style.display='inline-block';}
    else{snd(660,60);document.getElementById('msg').textContent='';}
    currentGuess='';updateCurrent();
  }else if(key==='Del'||key==='Backspace'){currentGuess=currentGuess.slice(0,-1);updateCurrent();}
  else if(currentGuess.length<5&&key.length===1&&key.match(/[a-z]/i)){snd(440,25);currentGuess+=key.toLowerCase();updateCurrent();}
}
function updateKeyColors(){
  Object.keys(keyState).forEach(function(k){
    var btns=document.querySelectorAll('[data-k="'+k+'"]');
    btns.forEach(function(b){b.className=b.className.replace('correct','').replace('present','').replace('absent','')+' '+keyState[k];});
  });
}
document.addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey)return;handleKey(e.key==='Backspace'?'Del':e.key.toLowerCase());});
newGame();
</script></body></html>`;

type Game = {
  id: string; title: string; description: string; emoji: string;
  color: string; bg: string; border: string; offline: boolean;
  html?: string; url?: string; badge?: string;
};

const OFFLINE_GAMES: Game[] = [
  { id: "tictactoe", title: "Tic-Tac-Toe", description: "Classic X vs O — 2 player", emoji: "✖️", color: "#7C3AED", bg: "#F3EEFF", border: "#DDD6FE", offline: true, html: TIC_TAC_TOE_HTML },
  { id: "2048", title: "2048", description: "Swipe to merge tiles", emoji: "🔢", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", offline: true, html: GAME_2048_HTML },
  { id: "snake", title: "Snake", description: "Eat apples, grow longer!", emoji: "🐍", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", offline: true, html: SNAKE_HTML },
  { id: "memory", title: "Memory Match", description: "Match emoji pairs — tap to flip!", emoji: "🃏", color: "#DB2777", bg: "#FDF2F8", border: "#FBCFE8", offline: true, html: MEMORY_HTML },
  { id: "whack", title: "Whack-A-Mole", description: "Tap the moles before they hide!", emoji: "🔨", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", offline: true, html: WHACK_HTML },
  { id: "flappy", title: "Flappy Bird", description: "Tap to flap — avoid the pipes!", emoji: "🐦", color: "#0891B2", bg: "#F0FDFF", border: "#A5F3FC", offline: true, html: FLAPPY_HTML },
  { id: "breakout", title: "Breakout", description: "Smash bricks with the ball!", emoji: "🧱", color: "#7C3AED", bg: "#F3EEFF", border: "#DDD6FE", offline: true, html: BREAKOUT_HTML },
  { id: "minesweeper", title: "Minesweeper", description: "Find all mines — long press to flag!", emoji: "💣", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", offline: true, html: MINESWEEPER_HTML },
  { id: "wordle", title: "Wordle", description: "Guess the 5-letter word in 6 tries!", emoji: "🟩", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", offline: true, html: WORDLE_HTML },
];

const STORE_GAMES: { id: string; title: string; description: string; emoji: string; color: string; bg: string; border: string; url: string }[] = [
  { id: "sg1", title: "Subway Surfers", description: "Run, dodge trains & collect coins!", emoji: "🏃", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", url: "https://play.google.com/store/apps/details?id=com.kiloo.subwaysurf" },
  { id: "sg2", title: "Candy Crush Saga", description: "Match colourful candy puzzles", emoji: "🍬", color: "#DB2777", bg: "#FDF2F8", border: "#FBCFE8", url: "https://play.google.com/store/apps/details?id=com.king.candycrushsaga" },
  { id: "sg3", title: "Among Us!", description: "Find the impostors — social deduction!", emoji: "👾", color: "#7C3AED", bg: "#F3EEFF", border: "#DDD6FE", url: "https://play.google.com/store/apps/details?id=com.innersloth.spacemafia" },
  { id: "sg4", title: "Clash of Clans", description: "Build villages & battle clans", emoji: "⚔️", color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", url: "https://play.google.com/store/apps/details?id=com.supercell.clashofclans" },
  { id: "sg5", title: "PUBG Mobile", description: "Battle royale — be the last one standing", emoji: "🪂", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", url: "https://play.google.com/store/apps/details?id=com.tencent.ig" },
  { id: "sg6", title: "Minecraft", description: "Build, craft & survive in block worlds", emoji: "⛏️", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", url: "https://play.google.com/store/apps/details?id=com.mojang.minecraftpe" },
  { id: "sg7", title: "Chess.com", description: "Play chess vs friends or AI", emoji: "♟️", color: "#1E293B", bg: "#F8FAFC", border: "#E2E8F0", url: "https://play.google.com/store/apps/details?id=com.chess" },
  { id: "sg8", title: "Asphalt 9: Legends", description: "Hyper-real racing action", emoji: "🏎️", color: "#2563EB", bg: "#EBF2FF", border: "#BFDBFE", url: "https://play.google.com/store/apps/details?id=com.gameloft.android.ANMP.GloftA9HM" },
];

const PLAYER_SKINS = [
  { id: "green",  label: "Green",  color: "#4ade80", color2: "#86efac" },
  { id: "blue",   label: "Blue",   color: "#60a5fa", color2: "#93c5fd" },
  { id: "red",    label: "Red",    color: "#f87171", color2: "#fca5a5" },
  { id: "purple", label: "Purple", color: "#c084fc", color2: "#d8b4fe" },
  { id: "orange", label: "Orange", color: "#fb923c", color2: "#fdba74" },
  { id: "pink",   label: "Pink",   color: "#f472b6", color2: "#f9a8d4" },
  { id: "gold",   label: "Gold",   color: "#fbbf24", color2: "#fde68a" },
  { id: "cyan",   label: "Cyan",   color: "#22d3ee", color2: "#67e8f9" },
];

// ── Battle Royale Hub ─────────────────────────────────────────────────────
type BRGame = {
  id: string; title: string; subtitle: string; tag: string; description: string;
  color: string; bg: string;
  playStoreUrl: string; liveUrl: string; maxFps: number;
  fpsSteps: { icon: string; tip: string }[];
};

const BATTLE_ROYALE_GAMES: BRGame[] = [
  {
    id: "freefire",
    title: "Free Fire",
    subtitle: "Garena",
    tag: "120 Players",
    description: "10-min intense battle royale · Most played mobile BR in the world",
    color: "#FF6B00",
    bg: "#1A0A00",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.dts.freefireth",
    liveUrl: "https://www.youtube.com/results?search_query=free+fire+max+live+gameplay&sp=EgJAAQ%3D%3D",
    maxFps: 90,
    fpsSteps: [
      { icon: "⚙️", tip: "Settings → Graphics → Frame Rate: Ultra (90 FPS on flagship)" },
      { icon: "🎨", tip: "Resolution: Smooth — unlocks highest FPS tier" },
      { icon: "🌑", tip: "Disable Shadows, Ambient Occlusion & Dynamic Lighting" },
      { icon: "📲", tip: "Enable Performance Mode in phone's battery settings" },
      { icon: "🗂️", tip: "Clear game cache before each session" },
      { icon: "📶", tip: "Use stable WiFi / 5G — reduces ping spikes" },
    ],
  },
  {
    id: "pubg",
    title: "PUBG Mobile",
    subtitle: "Krafton",
    tag: "100 Players",
    description: "30-min epic battle royale · Ultra-realistic military-grade graphics",
    color: "#F5A623",
    bg: "#120C00",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.tencent.ig",
    liveUrl: "https://www.youtube.com/results?search_query=pubg+mobile+live+pro+gameplay&sp=EgJAAQ%3D%3D",
    maxFps: 90,
    fpsSteps: [
      { icon: "⚙️", tip: "Settings → Graphics → Frame Rate: Extreme (90 FPS)" },
      { icon: "🎨", tip: "Style: Smooth — best for competitive ranked play" },
      { icon: "🌑", tip: "Disable Anti-Aliasing, Motion Blur & Shadows" },
      { icon: "📲", tip: "Enable Game Mode / Performance Mode on device" },
      { icon: "🗂️", tip: "Uninstall unused apps to free up RAM" },
      { icon: "📶", tip: "Choose nearest server region for lowest ping" },
    ],
  },
];

function LiveStreamModal({ game, onClose }: { game: BRGame | null; onClose: () => void }) {
  const [webLoading, setWebLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => { if (game) setWebLoading(true); }, [game]);
  if (!game) return null;

  return (
    <Modal visible={!!game} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000", paddingTop: insets.top || 44 }}>
        <View style={brS.liveHeader}>
          <View style={brS.liveDot} />
          <Text style={brS.liveName}>{game.title}</Text>
          <Text style={[brS.liveBadge, { color: game.color }]}>● LIVE</Text>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(game.liveUrl); }}
            style={brS.liveOpenBtn}
          >
            <Ionicons name="open-outline" size={13} color="#fff" />
            <Text style={brS.liveOpenBtnText}>YouTube</Text>
          </Pressable>
          <Pressable onPress={onClose} style={brS.liveCloseBtn} hitSlop={10}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>

        {Platform.OS !== "web" ? (
          <View style={{ flex: 1 }}>
            {webLoading && (
              <View style={brS.liveLoading}>
                <ActivityIndicator size="large" color={game.color} />
                <Text style={[brS.liveLoadingText, { color: game.color }]}>
                  Finding {game.title} Live Streams…
                </Text>
                <Pressable
                  onPress={() => { Linking.openURL(game.liveUrl); onClose(); }}
                  style={[brS.liveOpenYt, { borderColor: game.color }]}
                >
                  <Ionicons name="logo-youtube" size={18} color="#FF0000" />
                  <Text style={brS.liveOpenYtText}>Open in YouTube</Text>
                </Pressable>
              </View>
            )}
            <WebView
              source={{ uri: game.liveUrl }}
              style={{ flex: 1 }}
              onLoad={() => setWebLoading(false)}
              onError={() => setWebLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          </View>
        ) : (
          <View style={brS.liveWebFallback}>
            <Text style={{ fontSize: 56 }}>📺</Text>
            <Text style={brS.liveWebFallbackTitle}>Open on your phone</Text>
            <Text style={brS.liveWebFallbackText}>Live streams work in Expo Go on iOS/Android.</Text>
            <Pressable onPress={() => Linking.openURL(game.liveUrl)} style={[brS.liveOpenYt, { borderColor: game.color, marginTop: 8 }]}>
              <Ionicons name="logo-youtube" size={18} color="#FF0000" />
              <Text style={brS.liveOpenYtText}>Open YouTube</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function FpsGuideSheet({ game, onClose }: { game: BRGame | null; onClose: () => void }) {
  const [fps, setFps] = useState(30);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!game) return;
    setFps(30);
    let cur = 30;
    const target = game.maxFps;
    const id = setInterval(() => {
      cur = Math.min(cur + 3, target);
      setFps(cur);
      if (cur >= target) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
  }, [game]);

  if (!game) return null;
  const progress = fps / game.maxFps;
  const fpsColor = fps < 45 ? "#EF4444" : fps < 60 ? "#F59E0B" : "#10B981";

  return (
    <Modal visible={!!game} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={brS.fpsOverlay} onPress={onClose}>
        <Pressable style={[brS.fpsSheet, { paddingBottom: (insets.bottom || 20) + 14 }]} onPress={(e) => e.stopPropagation()}>
          <View style={brS.fpsHandle} />

          {/* FPS Meter */}
          <View style={brS.fpsMeterRow}>
            <View style={brS.fpsMeterLeft}>
              <Text style={[brS.fpsBigNum, { color: fpsColor }]}>{fps}</Text>
              <Text style={brS.fpsBigLabel}>FPS</Text>
            </View>
            <View style={brS.fpsMeterRight}>
              <Text style={[brS.fpsGameName, { color: game.color }]}>{game.title}</Text>
              <Text style={brS.fpsTarget}>Target: {game.maxFps} FPS Max</Text>
              <View style={brS.fpsBarBg}>
                <View style={[brS.fpsBarFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: fpsColor }]} />
              </View>
              <Text style={brS.fpsBarHint}>
                {fps < game.maxFps ? `+${game.maxFps - fps} FPS possible with these steps` : "🎉 Max FPS reached!"}
              </Text>
            </View>
          </View>

          <View style={brS.fpsDivider} />
          <Text style={brS.fpsStepsTitle}>⚡ How to Get Max FPS</Text>
          {game.fpsSteps.map((step, i) => (
            <View key={i} style={brS.fpsStep}>
              <Text style={brS.fpsStepIcon}>{step.icon}</Text>
              <Text style={brS.fpsStepText}>{step.tip}</Text>
            </View>
          ))}

          <Pressable onPress={onClose} style={[brS.fpsDoneBtn, { backgroundColor: game.color }]}>
            <Text style={brS.fpsDoneBtnText}>Got it! Let's play</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BattleRoyaleCard({ game, onLive, onFps }: { game: BRGame; onLive: () => void; onFps: () => void }) {
  return (
    <View style={[brS.card, { borderColor: game.color + "44" }]}>
      <View style={[brS.cardStrip, { backgroundColor: game.color }]} />
      <View style={brS.cardBody}>
        <View style={[brS.cardIconBox, { backgroundColor: game.color + "22", borderColor: game.color + "55" }]}>
          <Text style={{ fontSize: 30 }}>{game.id === "freefire" ? "🔥" : "🪂"}</Text>
        </View>
        <View style={brS.cardInfo}>
          <View style={brS.cardTitleRow}>
            <Text style={brS.cardTitle}>{game.title}</Text>
            <View style={[brS.fpsPill, { backgroundColor: game.color + "22", borderColor: game.color + "55" }]}>
              <Text style={[brS.fpsPillText, { color: game.color }]}>⚡ {game.maxFps} FPS</Text>
            </View>
          </View>
          <Text style={[brS.cardSub, { color: game.color + "BB" }]}>{game.subtitle} · {game.tag}</Text>
          <Text style={brS.cardDesc} numberOfLines={2}>{game.description}</Text>
        </View>
      </View>
      <View style={brS.cardActions}>
        <Pressable
          onPress={onLive}
          style={({ pressed }) => [brS.actBtn, brS.actBtnRed, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="play-circle" size={14} color="#fff" />
          <Text style={brS.actBtnText}>Watch Live</Text>
          <View style={brS.redPulse} />
        </Pressable>
        <Pressable
          onPress={onFps}
          style={({ pressed }) => [brS.actBtn, { backgroundColor: game.color + "22", borderWidth: 1, borderColor: game.color + "55", opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="speedometer-outline" size={14} color={game.color} />
          <Text style={[brS.actBtnText, { color: game.color }]}>FPS Guide</Text>
        </Pressable>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(game.playStoreUrl); }}
          style={({ pressed }) => [brS.actBtn, { backgroundColor: "#0A1F0A", borderWidth: 1, borderColor: "#2EB55244", opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="logo-google-playstore" size={14} color="#2EB552" />
          <Text style={[brS.actBtnText, { color: "#2EB552" }]}>Download</Text>
        </Pressable>
      </View>
    </View>
  );
}

function injectSkin(html: string, color: string, color2: string): string {
  const inject = `<script>window.SKIN='${color}';window.SKIN2='${color2}';</script>`;
  return html.replace("</head>", inject + "</head>");
}

function GameCard({ game, onPlay }: { game: Game; onPlay: () => void }) {
  return (
    <Pressable
      onPress={onPlay}
      style={({ pressed }) => [styles.card, { backgroundColor: game.bg, borderColor: game.border, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <Text style={styles.cardEmoji}>{game.emoji}</Text>
      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: game.color }]}>{game.title}</Text>
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline-outline" size={10} color="#059669" />
            <Text style={styles.offlineBadgeText}>Offline</Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>{game.description}</Text>
      </View>
      <View style={[styles.playBtn, { backgroundColor: game.color }]}>
        <Ionicons name="play" size={14} color="#FFF" />
      </View>
    </Pressable>
  );
}

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [webLoading, setWebLoading] = useState(false);
  const [skinIdx, setSkinIdx] = useState(0);
  const [liveBRGame, setLiveBRGame] = useState<BRGame | null>(null);
  const [fpsBRGame, setFpsBRGame] = useState<BRGame | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const activeSkin = PLAYER_SKINS[skinIdx];

  const handlePlay = (game: Game) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveGame(game);
    setWebLoading(true);
  };

  const gameHtml = activeGame
    ? injectSkin(activeGame.html || "", activeSkin.color, activeSkin.color2)
    : "";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Game Bar 🎮</Text>
          <Text style={styles.headerSub}>{OFFLINE_GAMES.length} offline games · FreeFire & PUBG Hub!</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{OFFLINE_GAMES.length} Games</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.skinSection}>
          <View style={styles.skinLabelRow}>
            <Ionicons name="color-palette-outline" size={14} color={activeSkin.color} />
            <Text style={[styles.skinLabel, { color: activeSkin.color }]}>Player Skin</Text>
            <Text style={styles.skinName}>{activeSkin.label}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skinRow}>
            {PLAYER_SKINS.map((skin, i) => (
              <Pressable
                key={skin.id}
                onPress={() => { setSkinIdx(i); Haptics.selectionAsync(); }}
                style={[
                  styles.skinDot,
                  { backgroundColor: skin.color },
                  skinIdx === i && styles.skinDotActive,
                ]}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🕹️</Text>
          <Text style={[styles.sectionTitle, { color: "#059669" }]}>Classic Games</Text>
          <View style={styles.offlineBadge}>
            <Ionicons name="cloud-offline-outline" size={10} color="#059669" />
            <Text style={styles.offlineBadgeText}>No Internet</Text>
          </View>
        </View>
        {OFFLINE_GAMES.map((game) => (
          <GameCard key={game.id} game={game} onPlay={() => handlePlay(game)} />
        ))}

        {/* ── Battle Royale Hub ── */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionIcon}>🔫</Text>
          <Text style={[styles.sectionTitle, { color: "#DC2626" }]}>Battle Royale Hub</Text>
          <View style={[styles.offlineBadge, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#DC2626" }} />
            <Text style={[styles.offlineBadgeText, { color: "#DC2626" }]}>LIVE</Text>
          </View>
        </View>
        {BATTLE_ROYALE_GAMES.map((game) => (
          <BattleRoyaleCard
            key={game.id}
            game={game}
            onLive={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setLiveBRGame(game); }}
            onFps={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFpsBRGame(game); }}
          />
        ))}

        {/* Play Store Downloads */}
        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <Text style={styles.sectionIcon}>📲</Text>
          <Text style={[styles.sectionTitle, { color: "#2563EB" }]}>More Games to Download</Text>
        </View>
        {STORE_GAMES.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(g.url).catch(() => {}); }}
            style={({ pressed }) => [styles.card, { backgroundColor: g.bg, borderColor: g.border, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <Text style={styles.cardEmoji}>{g.emoji}</Text>
            <View style={styles.cardInfo}>
              <View style={styles.cardTitleRow}>
                <Text style={[styles.cardTitle, { color: g.color }]}>{g.title}</Text>
                <View style={[styles.offlineBadge, { backgroundColor: "#EBF2FF", borderColor: "#BFDBFE" }]}>
                  <Ionicons name="logo-google-playstore" size={10} color="#2563EB" />
                  <Text style={[styles.offlineBadgeText, { color: "#2563EB" }]}>Play Store</Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{g.description}</Text>
            </View>
            <View style={[styles.playBtn, { backgroundColor: "#2563EB" }]}>
              <Ionicons name="open-outline" size={14} color="#FFF" />
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {activeGame && (
        <Modal visible animationType="slide" onRequestClose={() => setActiveGame(null)}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.skinIndicator, { backgroundColor: activeSkin.color }]} />
                <Text style={styles.modalEmoji}>{activeGame.emoji}</Text>
                <Text style={styles.modalTitle}>{activeGame.title}</Text>
              </View>
              <Pressable onPress={() => setActiveGame(null)} style={styles.closeBtn} hitSlop={10}>
                <Ionicons name="close" size={22} color="#1e293b" />
              </Pressable>
            </View>

            <View style={{ flex: 1, position: "relative" }}>
              {webLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={activeSkin.color} />
                  <Text style={styles.loadingText}>Loading {activeGame.title}...</Text>
                </View>
              )}
              {Platform.OS !== "web" ? (
                <WebView
                  source={{ html: gameHtml }}
                  style={{ flex: 1 }}
                  onLoad={() => setWebLoading(false)}
                  onError={() => setWebLoading(false)}
                  javaScriptEnabled
                  domStorageEnabled
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  scrollEnabled={false}
                  bounces={false}
                />
              ) : (
                <View style={styles.webFallback}>
                  <Text style={styles.webFallbackEmoji}>{activeGame.emoji}</Text>
                  <Text style={styles.webFallbackTitle}>{activeGame.title}</Text>
                  <Text style={styles.webFallbackText}>Open this app on your phone via Expo Go to play!</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      )}

      <LiveStreamModal game={liveBRGame} onClose={() => setLiveBRGame(null)} />
      <FpsGuideSheet game={fpsBRGame} onClose={() => setFpsBRGame(null)} />
    </View>
  );
}

const brS = StyleSheet.create({
  card: { backgroundColor: "#0F172A", borderRadius: 20, overflow: "hidden", borderWidth: 1, marginBottom: 0 },
  cardStrip: { height: 4 },
  cardBody: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  cardIconBox: { width: 58, height: 58, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  cardInfo: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: "#fff" },
  fpsPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  fpsPillText: { fontFamily: "Poppins_700Bold", fontSize: 10 },
  cardSub: { fontFamily: "Poppins_600SemiBold", fontSize: 11 },
  cardDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#94A3B8", lineHeight: 17 },
  cardActions: { flexDirection: "row", paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, borderRadius: 12 },
  actBtnRed: { backgroundColor: "#DC2626" },
  actBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 11, color: "#fff" },
  redPulse: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#fff", opacity: 0.8 },
  liveHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#111827" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#DC2626" },
  liveName: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },
  liveBadge: { fontFamily: "Poppins_700Bold", fontSize: 12 },
  liveOpenBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, marginRight: 6 },
  liveOpenBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#fff" },
  liveCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  liveLoading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 10, justifyContent: "center", alignItems: "center", gap: 16 },
  liveLoadingText: { fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  liveOpenYt: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5 },
  liveOpenYtText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#fff" },
  liveWebFallback: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  liveWebFallbackTitle: { fontFamily: "Poppins_700Bold", fontSize: 20, color: "#fff" },
  liveWebFallbackText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: "#94A3B8", textAlign: "center" },
  fpsOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  fpsSheet: { backgroundColor: "#0F172A", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 },
  fpsHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 4 },
  fpsMeterRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  fpsMeterLeft: { alignItems: "center", minWidth: 84 },
  fpsBigNum: { fontFamily: "Poppins_700Bold", fontSize: 54, lineHeight: 62 },
  fpsBigLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#475569", marginTop: -6 },
  fpsMeterRight: { flex: 1, gap: 5 },
  fpsGameName: { fontFamily: "Poppins_700Bold", fontSize: 16 },
  fpsTarget: { fontFamily: "Poppins_400Regular", fontSize: 12, color: "#64748B" },
  fpsBarBg: { height: 8, borderRadius: 4, backgroundColor: "#1E293B", overflow: "hidden" },
  fpsBarFill: { height: "100%", borderRadius: 4 },
  fpsBarHint: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "#64748B" },
  fpsDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
  fpsStepsTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },
  fpsStep: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  fpsStepIcon: { fontSize: 16, width: 22 },
  fpsStepText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "#CBD5E1", flex: 1, lineHeight: 20 },
  fpsDoneBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  fpsDoneBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { fontFamily: "Poppins_700Bold", fontSize: 24, color: Colors.text, letterSpacing: -0.3 },
  headerSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  headerBadge: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary },
  headerBadgeText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.primary },
  list: { paddingHorizontal: 16, gap: 10, paddingTop: 4 },
  skinSection: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, marginBottom: 4, borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  skinLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  skinLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13 },
  skinName: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, marginLeft: 2 },
  skinRow: { flexDirection: "row", gap: 10, paddingVertical: 2 },
  skinDot: { width: 32, height: 32, borderRadius: 16 },
  skinDotActive: { borderWidth: 3, borderColor: "#1e293b", transform: [{ scale: 1.15 }] },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, marginTop: 4 },
  sectionIcon: { fontSize: 14 },
  sectionTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.primary },
  card: { borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardEmoji: { fontSize: 34 },
  cardInfo: { flex: 1, gap: 4 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: "Poppins_700Bold", fontSize: 15 },
  cardDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  offlineBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#ECFDF5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#A7F3D0" },
  offlineBadgeText: { fontFamily: "Poppins_600SemiBold", fontSize: 9, color: "#059669" },
  playBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  skinIndicator: { width: 10, height: 10, borderRadius: 5 },
  modalEmoji: { fontSize: 22 },
  modalTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.text },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  loadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", gap: 12 },
  loadingText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary },
  webFallback: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 14 },
  webFallbackEmoji: { fontSize: 60 },
  webFallbackTitle: { fontFamily: "Poppins_700Bold", fontSize: 24, color: Colors.text },
  webFallbackText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
});
