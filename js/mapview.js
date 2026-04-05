'use strict';
const MapE=(()=>{
  let cvBG,ctxBG,cvOV,ctxOV,scale=1.5,panX=0,panY=0,panning=false,panStart={};
  let imgEl=null,viewport=null,table={},hotspots=[],selected=null,highlights={},showBalloons=true;
  const w2s=(wx,wy)=>({x:wx*scale+panX,y:wy*scale+panY});
  const s2w=(sx,sy)=>({x:(sx-panX)/scale,y:(sy-panY)/scale});
  function buildTable(r){table={};hotspots=[];if(!r?.bom?.length)return;
    const vw=viewport?.width||900,vh=viewport?.height||640,n=r.bom.length;
    const cols=Math.max(1,Math.ceil(Math.sqrt(n))),rows=Math.max(1,Math.ceil(n/cols));
    r.bom.forEach((it,i)=>{const id=String(it.item||i+1),col=i%cols,row=Math.floor(i/cols);
      const bx=vw*.15+col*(vw*.55/cols)+(vw*.55/cols)/2,by=vh*.20+row*(vh*.45/rows)+(vh*.45/rows)/2;
      const br=Math.min(vw*.55/cols,vh*.45/rows)*.22;
      table[id]={id,x:bx,y:by,r:br,item:it.item||i+1,bom:it,fromOCR:false};hotspots.push({id});});}
  function drawBG(){if(!cvBG)return;const W=cvBG.width,H=cvBG.height;
    ctxBG.clearRect(0,0,W,H);ctxBG.fillStyle='#111';ctxBG.fillRect(0,0,W,H);
    if(imgEl)ctxBG.drawImage(imgEl,panX,panY,imgEl.width*scale,imgEl.height*scale);
    else{ctxBG.fillStyle='#1a1a1a';ctxBG.fillRect(W/2-180,H/2-28,360,56);
      ctxBG.fillStyle='#444';ctxBG.font='11px Courier New';ctxBG.textAlign='center';
      ctxBG.fillText('Click LOAD FILE to display drawing',W/2,H/2-4);
      ctxBG.fillStyle='#2a2a2a';ctxBG.font='9px Courier New';
      ctxBG.fillText('Or upload via ANALYZE tab',W/2,H/2+16);ctxBG.textAlign='left';}}
  function drawOV(){if(!cvOV)return;ctxOV.clearRect(0,0,cvOV.width,cvOV.height);if(!showBalloons)return;
    Object.values(table).forEach(en=>{const{x:sx,y:sy}=w2s(en.x,en.y),sr=Math.max(9,en.r*scale);
      const isSel=selected===en.id,isHi=!!highlights[en.id],hasBOM=!!(en.bom?.pn);
      ctxOV.beginPath();ctxOV.arc(sx,sy,sr,0,Math.PI*2);
      if(isSel){ctxOV.fillStyle='rgba(212,184,112,.4)';ctxOV.strokeStyle='#d4b870';ctxOV.lineWidth=2.5;}
      else if(isHi){ctxOV.fillStyle='rgba(106,176,232,.3)';ctxOV.strokeStyle='#6ab0e8';ctxOV.lineWidth=2;}
      else if(hasBOM){ctxOV.fillStyle='rgba(104,200,128,.15)';ctxOV.strokeStyle='#68c880';ctxOV.lineWidth=1.5;}
      else{ctxOV.fillStyle='rgba(200,64,64,.15)';ctxOV.strokeStyle='#c04040';ctxOV.lineWidth=1.5;}
      ctxOV.fill();ctxOV.stroke();
      const col=isSel?'#d4b870':isHi?'#6ab0e8':hasBOM?'#68c880':'#c04040';
      ctxOV.fillStyle=col;ctxOV.font=`bold ${Math.max(9,Math.round(sr*.7))}px Courier New`;
      ctxOV.textAlign='center';ctxOV.textBaseline='middle';ctxOV.fillText(String(en.item),sx,sy);});}
  function resize(){const wrap=document.getElementById('map-canvas-wrap');if(!wrap||!cvBG)return;
    cvBG.width=cvOV.width=Math.max(100,wrap.clientWidth);cvBG.height=cvOV.height=Math.max(100,wrap.clientHeight);}
  function showTooltip(en){const t=document.getElementById('map-tooltip');if(!t)return;const it=en.bom||{};
    t.innerHTML=`<div style="font-size:6px;color:var(--c7);margin-bottom:2px">ITEM #${en.item}${en.fromOCR?' ✓':' ~'}</div>
      <div style="font-size:9px;font-weight:bold;color:var(--c4)">${esc(it.pn||'—')}</div>
      <div style="font-size:7px;color:var(--t2);margin-bottom:2px">${esc(it.desc||'—')}</div>
      <div style="font-size:7px;color:var(--t3)">QTY: ${it.qty||'—'} ${it.unit||''} · ${it.category||it.cat||''}</div>`;}
  function buildList(r){const el=document.getElementById('map-bom-list');if(!el||!r?.bom)return;
    el.innerHTML=r.bom.map((it,i)=>{const id=String(it.item||i+1),en=table[id];
      const col=en?.fromOCR?'var(--c3)':en?'#3a6030':'var(--c5)';
      return`<div onclick="MapE.onTableClick('${id}')" data-bid="${id}"
        style="padding:4px 8px;cursor:pointer;border-bottom:1px solid var(--b1);display:flex;align-items:center;gap:5px;transition:background .1s"
        onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background=''">
        <span style="width:20px;height:20px;border-radius:50%;border:1.5px solid ${col};color:${col};font-size:7px;font-weight:bold;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${it.item||i+1}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:7.5px;font-weight:bold;color:var(--c4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.pn||'—')}</div>
          <div style="font-size:6.5px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.desc||'—')}</div>
        </div>
        <span style="font-size:6.5px;color:var(--t3);flex-shrink:0">${it.qty||''} ${it.unit||''}</span></div>`;}).join('');}
  function animPan(tx,ty){let sx=panX,sy=panY,step=0;const dx=tx-sx,dy=ty-sy,steps=14;
    const tick=()=>{step++;const t=step/steps,e=t<.5?2*t*t:-1+(4-2*t)*t;
      panX=sx+dx*e;panY=sy+dy*e;drawBG();drawOV();if(step<steps)requestAnimationFrame(tick);};
    requestAnimationFrame(tick);}
  return{
    init(r){cvBG=document.getElementById('map-cv-bg');ctxBG=cvBG.getContext('2d');
      cvOV=document.getElementById('map-cv-ov');ctxOV=cvOV.getContext('2d');
      resize();buildTable(r||{});buildList(r||{});
      const az=window._AZ_FILE;
      if(az?.dataURL&&!imgEl){const img=new Image();
        img.onload=()=>{imgEl=img;viewport={width:img.width,height:img.height};
          const W=cvBG.width,H=cvBG.height;scale=Math.min(W/img.width,H/img.height)*.92;
          panX=(W-img.width*scale)/2;panY=(H-img.height*scale)/2;
          drawBG();buildTable(r||{});drawOV();};img.src=az.dataURL;}
      else{drawBG();drawOV();}
      if(cvOV._wired)return;cvOV._wired=true;
      cvOV.addEventListener('wheel',e=>{e.preventDefault();const rect=cvOV.getBoundingClientRect();
        const mx=e.clientX-rect.left,my=e.clientY-rect.top,f=e.deltaY<0?1.15:.87;
        const ns=Math.max(.05,Math.min(10,scale*f));panX=mx-(mx-panX)*(ns/scale);panY=my-(my-panY)*(ns/scale);scale=ns;drawBG();drawOV();},{passive:false});
      cvOV.addEventListener('mousedown',e=>{if(e.button===1||e.altKey){panning=true;panStart={x:e.clientX,y:e.clientY,px:panX,py:panY};cvOV.style.cursor='grabbing';}});
      cvOV.addEventListener('mousemove',e=>{if(!panning)return;panX=panStart.px+(e.clientX-panStart.x);panY=panStart.py+(e.clientY-panStart.y);drawBG();drawOV();});
      cvOV.addEventListener('mouseup',()=>{panning=false;cvOV.style.cursor='crosshair';});
      cvOV.addEventListener('click',e=>{const rect=cvOV.getBoundingClientRect(),w=s2w(e.clientX-rect.left,e.clientY-rect.top);
        let hit=null;hotspots.forEach(hs=>{const en=table[hs.id];if(!en)return;if((w.x-en.x)**2+(w.y-en.y)**2<=en.r**2)hit=en;});
        if(hit){selected=hit.id;highlights={[hit.id]:true};showTooltip(hit);
          document.querySelectorAll('[data-bid]').forEach(row=>{const s=row.dataset.bid===hit.id;row.style.background=s?'var(--bg3)':'';row.style.borderLeft=s?'3px solid var(--c4)':'';});
        }else{selected=null;highlights={};const t=document.getElementById('map-tooltip');if(t)t.textContent='Click a balloon or BOM row';}drawOV();});
      window.addEventListener('resize',()=>{resize();drawBG();drawOV();});},
    onTableClick(id){const en=table[String(id)];if(!en)return;selected=String(id);highlights={[String(id)]:true};showTooltip(en);
      document.querySelectorAll('[data-bid]').forEach(row=>{const s=row.dataset.bid===String(id);row.style.background=s?'var(--bg3)':'';row.style.borderLeft=s?'3px solid var(--c4)':'';});
      if(cvOV)animPan(cvOV.width/2-en.x*scale,cvOV.height/2-en.y*scale);drawOV();},
    zoom(f){const W=cvOV?cvOV.width/2:400,H=cvOV?cvOV.height/2:300,ns=Math.max(.05,Math.min(10,scale*f));
      panX=W-(W-panX)*(ns/scale);panY=H-(H-panY)*(ns/scale);scale=ns;drawBG();drawOV();},
    fit(){if(!viewport||!cvBG)return;const W=cvBG.width,H=cvBG.height;
      scale=Math.min(W/viewport.width,H/viewport.height)*.92;panX=(W-viewport.width*scale)/2;panY=(H-viewport.height*scale)/2;drawBG();drawOV();},
    toggleBalloons(){showBalloons=!showBalloons;drawOV();},
    loadFile(file){if(!file)return;window._AZ_FILE=window._AZ_FILE||{};const rdr=new FileReader();
      rdr.onload=ev=>{const img=new Image();img.onload=()=>{imgEl=img;viewport={width:img.width,height:img.height};
        window._AZ_FILE.dataURL=ev.target.result;const W=cvBG.width,H=cvBG.height;
        scale=Math.min(W/img.width,H/img.height)*.92;panX=(W-img.width*scale)/2;panY=(H-img.height*scale)/2;
        drawBG();drawOV();document.getElementById('map-file-lbl').textContent=file.name;};img.src=ev.target.result;};
      rdr.readAsDataURL(file);},
    reset(){table={};hotspots=[];selected=null;highlights={};imgEl=null;viewport=null;}
  };
})();
