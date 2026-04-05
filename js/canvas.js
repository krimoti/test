'use strict';
const CV=(()=>{
  let main,ctx,hov,hctx,tool='select',wireStart=null,drag=null,panning=false,panStart={},selected=null;
  const w2s=(wx,wy)=>{const{zoom:z,panX,panY}=Store.get().view;return{x:wx*z+panX,y:wy*z+panY};};
  const s2w=(sx,sy)=>{const{zoom:z,panX,panY}=Store.get().view;return{x:(sx-panX)/z,y:(sy-panY)/z};};
  function ortho(p1,p2){if(!p1||!p2)return[];const mx=(p1.x+p2.x)/2;return[p1,{x:mx,y:p1.y},{x:mx,y:p2.y},p2];}
  function pinPos(el,pinId){
    const lib=CL.byId(el.connId);if(!lib)return null;
    const n=lib.pinout.length,bw=60,bh=Math.max(44,n*18),gap=bh/(n+1);
    const idx=lib.pinout.findIndex(p=>String(p.id)===String(pinId));if(idx<0)return null;
    const px=el.side==='right'?el.x+bw:el.x;return{x:px,y:el.y+gap*(idx+1)};
  }
  function snapPin(wx,wy){
    const S=Store.get(),R=(tool==='wire'?22:8)/S.view.zoom;
    let best=null,bestD=Infinity;
    S.elements.forEach(el=>{const lib=CL.byId(el.connId);if(!lib)return;
      lib.pinout.forEach(pin=>{const pp=pinPos(el,pin.id);if(!pp)return;
        const d=(wx-pp.x)**2+(wy-pp.y)**2;if(d<R*R&&d<bestD){bestD=d;best={el,pin,pos:pp};}});});
    return best;
  }
  function hitEl(wx,wy){
    const S=Store.get();
    return[...S.elements].reverse().find(el=>{const lib=CL.byId(el.connId);if(!lib)return false;
      const n=lib.pinout.length,bw=60,bh=Math.max(44,n*18);
      return wx>=el.x&&wx<=el.x+bw&&wy>=el.y&&wy<=el.y+bh;})||null;
  }
  function hitWire(wx,wy){
    const S=Store.get(),T=8/S.view.zoom;
    return[...S.wires].reverse().find(w=>{const pts=w.routePts||[];
      for(let i=0;i<pts.length-1;i++){
        const ax=pts[i].x,ay=pts[i].y,bx=pts[i+1].x,by=pts[i+1].y;
        const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;if(l2<.1)continue;
        const t=clamp(((wx-ax)*dx+(wy-ay)*dy)/l2,0,1);
        if(Math.sqrt((wx-ax-t*dx)**2+(wy-ay-t*dy)**2)<T)return true;}
    })||null;
  }
  function drawGrid(){
    const S=Store.get(),{zoom:z,panX:px,panY:py}=S.view,step=20,W=main.width,H=main.height;
    ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
    ctx.lineWidth=.5;const ox=((px%(step*z))+step*z)%(step*z),oy=((py%(step*z))+step*z)%(step*z);
    ctx.beginPath();
    for(let x=ox;x<W;x+=step*z){ctx.moveTo(x,0);ctx.lineTo(x,H);}
    for(let y=oy;y<H;y+=step*z){ctx.moveTo(0,y);ctx.lineTo(W,y);}
    ctx.stroke();
  }
  function drawConnector(el){
    const S=Store.get(),z=S.view.zoom,lib=CL.byId(el.connId);if(!lib)return;
    const n=lib.pinout.length,bw=60,bh=Math.max(44,n*18),gap=bh/(n+1);
    const sp=w2s(el.x,el.y),isSel=selected&&selected.id===el.id;
    const scol=isSel?'#d4b870':lib.type==='CIRC'?'#6ab0e8':'#68c880';
    ctx.fillStyle=isSel?'rgba(212,184,112,.18)':'rgba(255,255,255,.03)';
    ctx.strokeStyle=scol;ctx.lineWidth=(isSel?2:1)/z;
    if(lib.type==='CIRC'){const r=bh*z/2;ctx.beginPath();ctx.arc(sp.x+bw*z/2,sp.y+r,r,0,Math.PI*2);ctx.fill();ctx.stroke();}
    else{ctx.fillRect(sp.x,sp.y,bw*z,bh*z);ctx.strokeRect(sp.x,sp.y,bw*z,bh*z);}
    ctx.fillStyle=isSel?'#d4b870':'#e8e0c8';ctx.font=`bold ${clamp(10*z,7,13)}px Courier New`;
    ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(el.label||'?',sp.x+bw*z/2,sp.y+3*z);
    ctx.font=`${clamp(7*z,5,9)}px Courier New`;ctx.fillStyle='#68c880';
    ctx.fillText(lib.short,sp.x+bw*z/2,sp.y+15*z);
    lib.pinout.forEach((pin,i)=>{
      const py2=sp.y+gap*(i+1)*z,px2=el.side==='right'?sp.x+bw*z:sp.x,pc=hex6(pin.c||'#888');
      ctx.beginPath();ctx.arc(px2,py2,3.5*z,0,Math.PI*2);ctx.fillStyle=pc;ctx.fill();
      ctx.fillStyle='#888';ctx.font=`${clamp(6*z,5,8)}px Courier New`;
      ctx.textAlign=el.side==='right'?'left':'right';ctx.textBaseline='middle';
      ctx.fillText(`${pin.id} ${pin.n}`,el.side==='right'?px2+5*z:px2-5*z,py2);
    });
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }
  function drawWire(w){
    const S=Store.get(),z=S.view.zoom,pts=w.routePts;if(!pts||pts.length<2)return;
    const col=hex6(w.color||'#888888'),isSel=selected&&selected.id===w.id;
    ctx.strokeStyle=isSel?'#fff':col;ctx.lineWidth=(isSel?3:1.5)/z;
    ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    pts.forEach((p,i)=>{const{x,y}=w2s(p.x,p.y);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
    if(w.signal&&pts.length>=2){
      const m=pts[Math.floor(pts.length/2)],{x:mx,y:my}=w2s(m.x,m.y);
      ctx.font=`${clamp(7*z,5,9)}px Courier New`;const tw=ctx.measureText(w.signal).width;
      ctx.fillStyle='rgba(8,8,8,.7)';ctx.fillRect(mx-tw/2-3,my-6,tw+6,12);
      ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(w.signal,mx,my);
      ctx.textAlign='left';
    }
  }
  function render(){
    if(!main)return;
    ctx.clearRect(0,0,main.width,main.height);
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
    ctx.fillRect(0,0,main.width,main.height);drawGrid();
    const S=Store.get();S.wires.filter(w=>w.active!==false).forEach(w=>drawWire(w));
    S.elements.forEach(el=>drawConnector(el));
  }
  function onDown(e){
    if(e.button===1||(e.button===0&&e.altKey)){
      panning=true;const v=Store.get().view;panStart={x:e.clientX,y:e.clientY,px:v.panX,py:v.panY};
      main.style.cursor='grabbing';return;
    }
    const rect=main.getBoundingClientRect(),w=s2w(e.clientX-rect.left,e.clientY-rect.top);
    if(tool==='select'){
      const el=hitEl(w.x,w.y);
      if(el){selected=el;drag={id:el.id,ox:w.x-el.x,oy:w.y-el.y};Props.show(el,'el');}
      else{const wi=hitWire(w.x,w.y);selected=wi||null;if(wi)Props.show(wi,'wire');else Props.clear();}
      render();
    }
    if(tool==='wire'){
      const snap=snapPin(w.x,w.y);
      if(!wireStart){wireStart={pos:snap?snap.pos:w,snap};}
      else{
        const endSnap=snapPin(w.x,w.y);Store.pushUndo();
        const S=Store.get(),p1=wireStart.pos,p2=endSnap?endSnap.pos:w;
        const nw={id:uid(),fromEl:wireStart.snap?.el.id||null,fromPin:wireStart.snap?.pin.id||null,
          toEl:endSnap?.el.id||null,toPin:endSnap?.pin.id||null,
          color:hex6(wireStart.snap?.pin.c||'#888888'),gauge:wireStart.snap?.pin.g||'22AWG',
          signal:wireStart.snap?.pin.sig||'',cutLength:S.meta.cableLength||500,
          active:true,routePts:ortho(p1,p2)};
        Store.set({wires:[...S.wires,nw]});wireStart=null;Store.save();
        hctx.clearRect(0,0,hov.width,hov.height);
      }
    }
  }
  function onMove(e){
    if(panning){const v=Store.get().view;Store.set({view:{...v,panX:panStart.px+(e.clientX-panStart.x),panY:panStart.py+(e.clientY-panStart.y)}});return;}
    if(drag){
      const rect=main.getBoundingClientRect(),w=s2w(e.clientX-rect.left,e.clientY-rect.top);
      const S=Store.get();
      const els=S.elements.map(el=>el.id===drag.id?{...el,x:w.x-drag.ox,y:w.y-drag.oy}:el);
      const wires=S.wires.map(wi=>{
        if(wi.fromEl!==drag.id&&wi.toEl!==drag.id)return wi;
        const fe=els.find(x=>x.id===wi.fromEl),te=els.find(x=>x.id===wi.toEl);
        const p1=fe?pinPos(fe,wi.fromPin):wi.routePts?.[0],p2=te?pinPos(te,wi.toPin):wi.routePts?.slice(-1)[0];
        return{...wi,routePts:ortho(p1,p2)};});
      Store.set({elements:els,wires});return;
    }
    if(wireStart){
      const rect=main.getBoundingClientRect(),w=s2w(e.clientX-rect.left,e.clientY-rect.top);
      const snap=snapPin(w.x,w.y),p2=snap?snap.pos:w,pts=ortho(wireStart.pos,p2);
      const S=Store.get(),z=S.view.zoom;
      hctx.clearRect(0,0,hov.width,hov.height);
      if(pts.length>=2){hctx.strokeStyle='rgba(106,176,232,.6)';hctx.lineWidth=1.5/z;hctx.setLineDash([6/z,4/z]);
        hctx.beginPath();pts.forEach((p,i)=>{const{x,y}=w2s(p.x,p.y);i===0?hctx.moveTo(x,y):hctx.lineTo(x,y);});
        hctx.stroke();hctx.setLineDash([]);}
    }
  }
  function onUp(){if(drag)Store.save();drag=null;panning=false;main.style.cursor='crosshair';render();}
  function onRight(e){
    e.preventDefault();if(wireStart){wireStart=null;hctx.clearRect(0,0,hov.width,hov.height);return;}
    const rect=main.getBoundingClientRect(),w=s2w(e.clientX-rect.left,e.clientY-rect.top);
    const el=hitEl(w.x,w.y);
    if(el&&confirm(`Delete ${el.label}?`)){Store.pushUndo();const S=Store.get();
      Store.set({elements:S.elements.filter(x=>x.id!==el.id),wires:S.wires.filter(x=>x.fromEl!==el.id&&x.toEl!==el.id)});Store.save();return;}
    const wi=hitWire(w.x,w.y);
    if(wi&&confirm(`Delete wire${wi.signal?' ('+wi.signal+')':''}?`)){Store.pushUndo();Store.set({wires:Store.get().wires.filter(x=>x.id!==wi.id)});Store.save();}
  }
  function onWheel(e){
    e.preventDefault();const rect=main.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const S=Store.get(),f=e.deltaY<0?1.1:.909,nz=clamp(S.view.zoom*f,.08,8);
    Store.set({view:{zoom:nz,panX:mx-(mx-S.view.panX)*(nz/S.view.zoom),panY:my-(my-S.view.panY)*(nz/S.view.zoom)}});
  }
  function resize(){if(!main)return;const w=document.getElementById('canvas-wrap');main.width=hov.width=w.clientWidth||900;main.height=hov.height=w.clientHeight||600;render();}
  return{
    init(){main=document.getElementById('cv-main');ctx=main.getContext('2d');
      hov=document.getElementById('cv-hover');hctx=hov.getContext('2d');
      main.addEventListener('mousedown',onDown);main.addEventListener('mousemove',onMove);
      main.addEventListener('mouseup',onUp);main.addEventListener('contextmenu',onRight);
      main.addEventListener('wheel',onWheel,{passive:false});
      main.addEventListener('dragover',e=>e.preventDefault());
      main.addEventListener('drop',e=>{e.preventDefault();const connId=e.dataTransfer.getData('connId');if(!connId)return;
        const rect=main.getBoundingClientRect(),w=s2w(e.clientX-rect.left,e.clientY-rect.top);
        Store.pushUndo();const S=Store.get();
        Store.set({elements:[...S.elements,{id:uid(),kind:'connector',connId,label:'P'+S.nextLabel,x:w.x,y:w.y,side:'left',notes:''}],nextLabel:S.nextLabel+1});Store.save();});
      window.addEventListener('resize',resize);Store.sub(render);resize();},
    render,resize,ortho,pinPos,
    setTool(t){tool=t;wireStart=null;document.querySelectorAll('.tool[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));main.style.cursor=t==='pan'?'grab':'crosshair';},
    fit(){const S=Store.get();if(!S.elements.length){Store.set({view:{zoom:1,panX:60,panY:60}});return;}
      const xs=S.elements.map(e=>e.x),ys=S.elements.map(e=>e.y);
      const mn={x:Math.min(...xs)-20,y:Math.min(...ys)-20},mx={x:Math.max(...xs)+80,y:Math.max(...ys)+80};
      const z=clamp(Math.min(main.width/(mx.x-mn.x),main.height/(mx.y-mn.y))*.9,.1,3);
      Store.set({view:{zoom:z,panX:-mn.x*z+20,panY:-mn.y*z+20}});},
    zoom1(){Store.set({view:{...Store.get().view,zoom:1}});},
    routeAll(){const S=Store.get();Store.pushUndo();
      const wires=S.wires.map(w=>{const fe=S.elements.find(e=>e.id===w.fromEl),te=S.elements.find(e=>e.id===w.toEl);
        if(!fe||!te)return w;const p1=pinPos(fe,w.fromPin),p2=pinPos(te,w.toPin);return{...w,routePts:ortho(p1,p2)};});
      Store.set({wires});Store.save();toast('Routes updated');}
  };
})();
