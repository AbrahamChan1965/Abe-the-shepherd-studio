// 帖撒罗尼迦城内棋盘 · 数值模拟
'use strict';
const NODES=['A','K','J','S','N','L','G','U']; // 亚里达古 加力普家 耶孙 西公都 尼肯 尊贵妇女 虔敬希腊人 阿迦特
const EDGES=[['A','K'],['A','J'],['K','J'],['J','S'],['J','N'],['J','L'],['S','L'],['N','G'],['N','U']];
const ADJ={}; NODES.forEach(n=>ADJ[n]=[]); EDGES.forEach(([a,b])=>{ADJ[a].push(b);ADJ[b].push(a);});
let rng; function seedRng(s){ rng=()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }
const pick=a=>a[Math.floor(rng()*a.length)];

function params(diff){
  const L=diff==='light';
  return {
    AP:3, startOil:{A:4,J:4,K:3,S:3,N:3,L:3,G:3,U:2}, startBread:8,
    isoDays:L?4:4,              // 多少天没人碰，灯油 -1
    griefSpread:L?0.20:0.24, griefDrain:L?0.4:0.45,    // 没有指望的忧伤扩散机率
    rumorSpread:L?0.30:0.40,
    windHits:L?2:2,             // 逼迫打到几户
    upkeepBase:2,
    workGain:2,
    gatherAP:2, gatherAway:3,
    chronic:L?0.15:0.2,
    loveRule:true,              // 4:9：被两盏亮灯夹着的暗灯会自己亮一点
    grace:L?0.12:0.08,          // 每天出现恩典事件的机率
    letterOrder:['these','work','light','holy'],
  };
}
// 阶段：第一阶段 9 天（保罗离开）；第二阶段 6 天（提摩太在城里，AP+2）；跳过若干星期（只结算一次）；
// 第三阶段：信差在路上（17–24 天）；第四阶段：信到，5–9 天后「那一夜」（不预告）
function newGame(diff,seed,courierDays){
  seedRng(seed); const P=params(diff);
  const g={P,diff,day:0,phase:1,bread:P.startBread,nodes:{},log:[],abilities:{},timothy:0,hist:[],collapsed:false,
    courier:courierDays||Math.round(17+rng()*7), finalAfter:Math.round(5+rng()*4), letterDay:null, ended:false,
    stats:{starve:0,actions:{}}};
  NODES.forEach(n=>g.nodes[n]={oil:P.startOil[n],tags:new Set(),untouched:0,zeroDays:0,withdrawn:false,hope:false,pausedUntil:0,prayed:[]});
  return g;
}
const lit=(g,n)=>{ const x=g.nodes[n]; return !x.withdrawn&&x.oil>=2; };
function addTag(g,n,t){ const x=g.nodes[n]; if(x.withdrawn) return; if(x.hope&&(t==='grief'||t==='rumor')) return; if(t==='weak'&&x.holy) return; x.tags.add(t); }
function upkeep(g){ let u=g.P.upkeepBase; NODES.forEach(n=>{ const x=g.nodes[n]; if(x.tags.has('idle')&&!g.abilities.work) u++; if(x.tags.has('weak')) u+=0.5; }); return Math.ceil(u); }
function income(g){ let i=0; NODES.forEach(n=>{ const x=g.nodes[n]; if(!x.withdrawn&&x.oil>=2&&!x.tags.has('idle')&&!x.tags.has('weak')) i+=0.34; if(g.abilities.work&&x.tags.has('idle')) i+=0.5; }); return Math.floor(i); }

// ---------- 行动 ----------
function act(g,a){
  const N=g.nodes; g.stats.actions[a.t]=(g.stats.actions[a.t]||0)+1;
  if(a.t==='work'){ g.bread+=g.P.workGain; return 1; }
  if(a.t==='gather'){ const host=a.host||'J'; const cost=host==='J'?g.P.gatherAP:g.P.gatherAway; if(g.bread<1) return 0; g.bread--;
    [host,...ADJ[host]].forEach(n=>{ const x=N[n]; if(x.withdrawn) return; x.oil=Math.min(5,x.oil+(n===host?2:1)); x.untouched=0; if(n===host) x.tags.delete('rumor'); if(x.tags.has('grief')&&!g.abilities.these) x.pausedUntil=Math.max(x.pausedUntil,g.day); }); return cost; }
  if(a.t==='visit'){ const x=N[a.n]; x.untouched=0;
    if(x.withdrawn){ x.withdrawn=false; x.oil=1; x.zeroDays=0; return 1; }
    const c=a.care;
    if(c==='comfort'){ if(x.tags.has('grief')){ if(g.abilities.these){ x.tags.delete('grief'); x.hope=true; x.oil=Math.min(5,x.oil+1); } else x.pausedUntil=g.day+1; } else x.oil=Math.min(5,x.oil+1); return 1; }
    if(c==='refute'){ if(x.tags.has('rumor')) x.tags.delete('rumor'); return 1; }
    const want={admonish:'idle',encourage:'faint',support:'weak'}[c];
    if(want&&x.tags.has(want)){ x.tags.delete(want); x.oil=Math.min(5,x.oil+1); if(c==='support') g.bread--; if(g.abilities.holy&&want==='weak') x.holy=true; }
    else if(want&&[...x.tags].some(t=>['idle','faint','weak'].includes(t))){ x.oil=Math.max(0,x.oil-1); } // 对错了人，会伤人（5:14）
    else x.oil=Math.min(5,x.oil+1);
    return 1; }
  return 1;
}
// ---------- 事件 ----------
function drawEvent(g){
  const d=g.day, N=g.nodes;
  if(d<=2) return; // 头两天：教学，没有事件
  if(g.phase===1&&d===6){ addTag(g,'N','grief'); g.log.push('埃拉睡了'); return; }
  if(g.phase===2&&g.pday===3){ addTag(g,'K','grief'); g.log.push('加力普睡了'); return; }
  const alive=NODES.filter(n=>!N[n].withdrawn); if(!alive.length) return;
  if(rng()<g.P.grace){ if(rng()<.5){ g.bread+=3; } else { const low=alive.slice().sort((a,b)=>N[a].oil-N[b].oil)[0]; N[low].oil=Math.min(5,N[low].oil+2); } return; }
  const r=rng();
  if(r<0.35){ for(let i=0;i<g.P.windHits;i++){ const n=pick(alive); if(g.abilities.light) continue; if(N[n].oil<=1) N[n].oil=Math.max(0,N[n].oil-1); } }  // 逼迫：灯≥2 不受伤
  else if(r<0.55) addTag(g,pick(alive),'rumor');
  else if(r<0.72){ const cand=alive.filter(n=>N[n].oil<=2); if(cand.length) addTag(g,pick(cand),'weak'); }
  else if(r<0.86){ if(g.phase>=2){ const n=pick(alive); if(!g.abilities.work) addTag(g,n,'idle'); } else addTag(g,pick(alive),'faint'); }
  else addTag(g,pick(alive),'faint');
}
// ---------- 一天结束 ----------
function endDay(g){
  const N=g.nodes,P=g.P;
  // 4:9 弟兄相爱：暗灯若有两个亮灯邻居，自己亮一点（不是玩家做的）
  if(P.loveRule) NODES.forEach(n=>{ const x=N[n]; if(x.withdrawn||x.oil>=3) return; if(ADJ[n].filter(m=>N[m].oil>=4&&!N[m].withdrawn).length>=2) x.oil+=1; });
  // 孤立
  NODES.forEach(n=>{ const x=N[n]; x.untouched++; if(x.untouched>P.isoDays){ x.oil=Math.max(0,x.oil-1); x.untouched=1; } });
  // 没有指望的忧伤：每户每天 -1 油（陪伴则暂停）；全城每天最多扩散到一户
  let spread=false;
  NODES.forEach(n=>{ const x=N[n]; if(!x.tags.has('grief')||x.withdrawn) return; if(x.pausedUntil>=g.day) return; if(rng()<P.griefDrain) x.oil=Math.max(0,x.oil-1);
    if(!spread&&rng()<P.griefSpread){ const t=ADJ[n].filter(m=>!N[m].tags.has('grief')&&!N[m].withdrawn&&!N[m].hope); if(t.length){ addTag(g,pick(t),'grief'); spread=true; } } });
  // 流言
  NODES.forEach(n=>{ const x=N[n]; if(!x.tags.has('rumor')||x.withdrawn) return; x.oil=Math.max(0,x.oil-(rng()<.5?1:0)); if(rng()<P.rumorSpread){ const t=ADJ[n].filter(m=>!N[m].withdrawn); if(t.length) addTag(g,pick(t),'rumor'); } });
  // 软弱、灰心、不守规矩的慢性消耗
  NODES.forEach(n=>{ const x=N[n]; if(x.withdrawn) return; if((x.tags.has('faint')||x.tags.has('weak'))&&rng()<g.P.chronic) x.oil=Math.max(0,x.oil-1); });
  // 饼
  g.bread+=income(g)-upkeep(g);
  if(g.bread<0){ g.bread=0; g.stats.starve++; const alive=NODES.filter(n=>!N[n].withdrawn).sort((a,b)=>N[a].oil-N[b].oil); if(alive.length) addTag(g,alive[0],'weak'); }
  // 余烬与退到暗处
  NODES.forEach(n=>{ const x=N[n]; if(x.withdrawn) return; if(x.oil===0){ if(++x.zeroDays>=3){ x.withdrawn=true; x.tags.clear(); } } else x.zeroDays=0; });
  // 保罗的祷告：延迟 1–3 天到达，不保证每次都看得见
  NODES.forEach(n=>{ const x=N[n]; x.prayed=x.prayed.filter(p=>{ if(--p.t<=0){ if(!x.withdrawn&&rng()<.75) x.oil=Math.min(5,x.oil+1); return false; } return true; }); });
  const standing=NODES.filter(n=>lit(g,n)&&!N[n].tags.has('grief')).length;
  const dark=NODES.filter(n=>N[n].withdrawn||N[n].oil===0).length;
  if(!g.letterDay&&dark>=4) g.collapsed=true;
  g.hist.push({d:g.day,phase:g.phase,standing,dark,bread:g.bread});
}
// ---------- 保罗的回合（每三天一次） ----------
function paulTurn(g,policy){
  const N=g.nodes;
  if(policy==='none') return;
  // 保罗看到的是 6 天前的消息：用最旧的记录挑选祷告对象
  const old=g.hist[Math.max(0,g.hist.length-6)];
  const targets=NODES.filter(n=>!N[n].withdrawn).sort((a,b)=>N[a].oil-N[b].oil);
  const t=policy==='random'?pick(NODES):targets[0];
  if(t&&N[t]) N[t].prayed.push({t:1+Math.floor(rng()*3)});
}
// ---------- 玩家策略 ----------
function chooseActions(g,policy){
  const N=g.nodes, acts=[]; let ap=g.P.AP+(g.timothy>0?2:0);
  const add=a=>{ const c=act(g,a); ap-=c; acts.push(a); };
  const careFor=x=>x.tags.has('grief')?'comfort':x.tags.has('rumor')?'refute':x.tags.has('idle')?'admonish':x.tags.has('weak')?'support':x.tags.has('faint')?'encourage':'comfort';
  let guard=0;
  while(ap>0&&guard++<10){
    if(policy==='work'){ add({t:'work'}); continue; }
    if(policy==='gather'){ if(ap>=2&&g.bread>=1) add({t:'gather'}); else add({t:'work'}); continue; }
    if(policy==='novice'&&rng()<.35){ const r=rng(); if(r<.4) add({t:'work'}); else if(r<.55&&ap>=2&&g.bread>=1) add({t:'gather'}); else { const n=pick(NODES); add({t:'visit',n,care:pick(['comfort','admonish','encourage','support'])}); } continue; }
    if(policy==='random'){ const r=rng(); if(r<.33) add({t:'work'}); else if(r<.5&&ap>=2&&g.bread>=1) add({t:'gather'}); else { const n=pick(NODES); const cares=['comfort','admonish','encourage','support','refute']; add({t:'visit',n,care:pick(cares)}); } continue; }
    // balanced：第一次玩、认真但不完美的人
    const need=upkeep(g)-income(g);
    if(g.bread<need+1){ add({t:'work'}); continue; }
    const hasGrief=NODES.filter(n=>N[n].tags.has('grief')&&!N[n].withdrawn&&N[n].pausedUntil<g.day).sort((a,b)=>N[a].oil-N[b].oil);
    if(hasGrief.length>=2&&ap>=2&&g.bread>=1&&!acts.some(a=>a.t==='gather')){ const host=NODES.filter(n=>!N[n].withdrawn).sort((a,b)=>([b,...ADJ[b]].filter(m=>hasGrief.includes(m)).length)-([a,...ADJ[a]].filter(m=>hasGrief.includes(m)).length))[0]; const cost=host==='J'?2:3; if(ap>=cost){ add({t:'gather',host}); continue; } }
    if(hasGrief.length){ add({t:'visit',n:hasGrief[0],care:'comfort'}); continue; }
    const withdrawn=NODES.filter(n=>N[n].withdrawn);
    if(withdrawn.length&&rng()<.6){ add({t:'visit',n:withdrawn[0]}); continue; }
    const lowNearJ=['J',...ADJ.J].filter(n=>!N[n].withdrawn&&(N[n].oil<=2||N[n].untouched>=g.P.isoDays-1)).length;
    if(lowNearJ>=3&&ap>=2&&g.bread>=1&&!acts.some(a=>a.t==='gather')){ add({t:'gather'}); continue; }
    const tagged=NODES.filter(n=>!N[n].withdrawn&&N[n].tags.size).sort((a,b)=>N[a].oil-N[b].oil);
    if(tagged.length){ const n=tagged[0]; let care=careFor(N[n]); if(policy==='novice'&&rng()<.3) care=pick(['comfort','admonish','encourage','support']); if(g.diff!=='light'&&!g.abilities.discern&&['admonish','support'].includes(care)&&rng()<.3) care=care==='admonish'?'support':'admonish'; add({t:'visit',n,care}); continue; }
    const iso=NODES.filter(n=>!N[n].withdrawn).sort((a,b)=>N[b].untouched-N[a].untouched||N[a].oil-N[b].oil)[0];
    if(iso&&(N[iso].untouched>=g.P.isoDays-1||N[iso].oil<=2)){ add({t:'visit',n:iso,care:'comfort'}); continue; }
    add({t:'work'});
  }
  return acts;
}
function playDay(g,policy){ g.day++; drawEvent(g); chooseActions(g,policy); endDay(g); if(g.timothy>0) g.timothy--; }
function run(diff,policy,seed,paulPolicy,courier){
  const g=newGame(diff,seed,courier); const pp=paulPolicy||(policy==='random'?'random':'smart');
  // 第一阶段：保罗离开后 9 天
  g.phase=1; for(let i=0;i<9;i++){ playDay(g,policy); if(g.day%3===0) paulTurn(g,pp); }
  // 第二阶段：提摩太在城里 6 天
  g.phase=2; g.timothy=6; for(g.pday=1;g.pday<=6;g.pday++){ playDay(g,policy); if(g.day%3===0) paulTurn(g,pp); }
  // 几个星期过去：提摩太南下、保罗写信（只结算一次孤立与忧伤，不翻事件）
  g.phase=2.5; for(let i=0;i<2;i++) endDay(g);
  // 第三阶段：信差在路上
  g.phase=3; for(let i=0;i<g.courier;i++){ playDay(g,policy); if(g.day%3===0) paulTurn(g,pp); }
  // 第四阶段：信到；每天化为行动一段；那一夜不预告
  g.phase=4; g.letterDay=g.day; let k=0;
  for(let i=0;i<g.finalAfter;i++){ const ab=g.P.letterOrder[k++]; if(ab) g.abilities[ab]=true; if(i===1) g.abilities.discern=true; playDay(g,policy); }
  const N=g.nodes;
  const standing=NODES.filter(n=>lit(g,n)&&!N[n].tags.has('grief')).length;
  const minBefore=Math.min(...g.hist.filter(h=>h.d<g.letterDay).map(h=>h.standing));
  return {hist:g.hist,letterDay:g.letterDay,standing,minBefore,collapsed:g.collapsed,days:g.day,starve:g.stats.starve,actions:g.stats.actions,courier:g.courier};
}
module.exports={run,NODES};
if(require.main===module&&process.argv[2]==='courier'){
  for(const d of ['light','medium']) for(const p of ['balanced','novice']) for(const c of [16,20,24,28]){ const R=[]; for(let s=1;s<=1500;s++) R.push(run(d,p,s*7919,null,c)); const avg=k=>(R.reduce((a,r)=>a+r[k],0)/R.length).toFixed(2); console.log(d,p,'信差',c,'天 → 站立',avg('standing'),'信前崩溃',(R.filter(r=>r.collapsed).length/R.length*100).toFixed(1)+'%'); }
  process.exit(0);
}
if(require.main===module&&process.argv[2]==='trace'){
  for(const d of ['light','medium']){ const S={}; for(let s=1;s<=1000;s++){ const r=run(d,process.argv[3]||'balanced',s*7919); r.hist.forEach(h=>{ (S[h.d]=S[h.d]||[]).push(h.standing); }); }
    console.log(d,Object.keys(S).map(k=>k+':'+(S[k].reduce((a,b)=>a+b,0)/S[k].length).toFixed(1)).join(' ')); }
  process.exit(0);
}
if(require.main===module){
  const diffs=['light','medium'], pols=['balanced','novice','random','work','gather'];
  for(const d of diffs) for(const p of pols){
    const R=[]; for(let s=1;s<=2000;s++) R.push(run(d,p,s*7919));
    const avg=k=>(R.reduce((a,r)=>a+r[k],0)/R.length).toFixed(2);
    const dist=[0,0,0,0]; R.forEach(r=>dist[r.standing>=7?0:r.standing>=5?1:r.standing>=3?2:3]++);
    const coll=R.filter(r=>r.collapsed).length/R.length;
    const acts={}; R.forEach(r=>{ for(const k in r.actions) acts[k]=(acts[k]||0)+r.actions[k]; }); const tot=Object.values(acts).reduce((a,b)=>a+b,0);
    console.log(`${d.padEnd(6)} ${p.padEnd(8)} 站立 avg=${avg('standing')}/8  7-8:${(dist[0]/20).toFixed(0)}% 5-6:${(dist[1]/20).toFixed(0)}% 3-4:${(dist[2]/20).toFixed(0)}% ≤2:${(dist[3]/20).toFixed(0)}%  信前崩溃=${(coll*100).toFixed(1)}%  信前最低=${avg('minBefore')}  饥荒天=${avg('starve')}  天数=${avg('days')}  行动:${Object.entries(acts).map(([k,v])=>k+' '+(v/tot*100).toFixed(0)+'%').join(' ')}`);
  }
}
