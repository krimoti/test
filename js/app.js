'use strict';
/* ═══ M13-16: Tabs, Modals, Wizard, App ════════════════════════ */

const Tabs = {
  show(id, btn) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-'+id);
    if(panel) panel.classList.add('active');
    if(id==='canvas')     setTimeout(()=>CV.resize(), 40);
    else if(id==='bom')      Panels.renderBOM();
    else if(id==='cutlist')  Panels.renderCutList();
    else if(id==='routes')   Panels.renderRoutes();
    else if(id==='engdwg')   Panels.renderEngDwg();
    else if(id==='connlib')  CLE.render();
    else if(id==='production') Panels.renderProduction();
    else if(id==='analyze')  AzModal.open();
    else if(id==='harness')  HV.render();
    else if(id==='drawing')  renderDrawingPanel();
  }
};

const AzModal = {
  open() { document.getElementById('az-modal').classList.add('open'); },
  close() {
    document.getElementById('az-modal').classList.remove('open');
    Tabs.show('canvas', document.querySelector('[data-tab="canvas"]'));
  }
};

const MapModal = {
  open() {
    document.getElementById('map-modal').classList.add('open');
    MapE.reset();
    setTimeout(() => MapE.init(window._AZ?.last), 60);
  },
  close() { document.getElementById('map-modal').classList.remove('open'); }
};

const Wizard = {
  open() {
    const old = document.getElementById('wiz-modal'); if(old) old.remove();
    const opts = Object.values(CL.all).map(c=>`<option value="${c.id}">${esc(c.short)} — ${esc(c.name)}</option>`).join('');
    const m = document.createElement('div'); m.id='wiz-modal';
    m.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9200;display:flex;align-items:center;justify-content:center';
    m.innerHTML=`<div style="background:var(--bg1);border:2px solid var(--c2);padding:20px;width:420px;border-radius:var(--radius)">
      <div style="font-size:10px;color:var(--c2);font-weight:bold;margin-bottom:12px;letter-spacing:2px">⚡ QUICK SETUP WIZARD</div>
      <div class="prop-row"><div class="label">FROM CONNECTOR</div><select id="wiz-from" class="field">${opts}</select></div>
      <div class="prop-row"><div class="label">TO CONNECTOR</div><select id="wiz-to" class="field">${opts}</select></div>
      <div class="prop-row"><div class="label">CABLE LENGTH (mm)</div><input type="number" id="wiz-len" class="field" value="${Store.get().meta.cableLength}"></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-ok" style="flex:1" onclick="Wizard.apply()">✓ CREATE</button>
        <button class="btn btn-err" onclick="document.getElementById('wiz-modal').remove()">CANCEL</button>
      </div>
    </div>`;
    document.body.appendChild(m);
  },
  apply() {
    const fromId=document.getElementById('wiz-from')?.value;
    const toId=document.getElementById('wiz-to')?.value;
    const len=+document.getElementById('wiz-len')?.value||500;
    if(!fromId||!toId){toast('Select connectors',true);return;}
    Store.pushUndo();
    const S=Store.get(), fl=CL.byId(fromId), tl=CL.byId(toId);
    const fe={id:uid(),kind:'connector',connId:fromId,label:'P'+S.nextLabel,x:80,y:120,side:'left',notes:''};
    const te={id:uid(),kind:'connector',connId:toId,label:'P'+(S.nextLabel+1),x:340,y:120,side:'right',notes:''};
    const wires=fl.pinout.slice(0,Math.min(fl.pinout.length,tl.pinout.length)).map((pin,i)=>{
      const tp=tl.pinout[i];
      const p1=CV.pinPos(fe,pin.id)||{x:140,y:130+i*18};
      const p2=CV.pinPos(te,tp.id)||{x:340,y:130+i*18};
      return{id:uid(),fromEl:fe.id,fromPin:pin.id,toEl:te.id,toPin:tp.id,
        color:hex6(pin.c||'#888888'),gauge:pin.g||'22AWG',signal:pin.sig||'',
        cutLength:len,active:true,routePts:CV.ortho(p1,p2)};
    });
    Store.set({elements:[...S.elements,fe,te],wires:[...S.wires,...wires],nextLabel:S.nextLabel+2});
    Store.setMeta({cableLength:len});Store.save();CV.fit();
    document.getElementById('wiz-modal')?.remove();
    toast(`Created ${fl.short}→${tl.short} with ${wires.length} wires`);
  }
};

/* ── Harness View ── */
const HV = {
  render() {
    const wrap = document.getElementById('hv-canvas'); if(!wrap) return;
    const S = Store.get(), els = S.elements.filter(e=>e.kind==='connector');
    if(!els.length) {
      wrap.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--t3);font-size:9px;font-family:Courier New">Add connectors in CANVAS tab</div>';
      return;
    }
    const W=800, GAP=60, BW=80, PIN_H=18, PAD=20;
    const connH = id => { const lib=CL.byId(id); return lib?Math.max(44,lib.pinout.length*PIN_H):44; };
    const left=els.filter(e=>e.side!=='right'), right=els.filter(e=>e.side==='right');
    const pos={};
    let y=GAP; left.forEach(e=>{const h=connH(e.connId);pos[e.id]={x:PAD,y,w:BW,h,side:'left'};y+=h+GAP;});
    y=GAP; right.forEach(e=>{const h=connH(e.connId);pos[e.id]={x:W-BW-PAD,y,w:BW,h,side:'right'};y+=h+GAP;});
    const totalH=Math.max(y, 200);
    const pinY=(p,connId,pinId)=>{
      const lib=CL.byId(connId);if(!lib)return p.y+p.h/2;
      const n=lib.pinout.length,gap=p.h/(n+1);
      const idx=lib.pinout.findIndex(x=>String(x.id)===String(pinId));
      return p.y+(idx>=0?gap*(idx+1):p.h/2);
    };
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${totalH}" style="width:100%;height:100%;background:var(--canvas-bg);display:block">`;
    S.wires.filter(w=>w.active!==false).forEach(w=>{
      const fp=pos[w.fromEl],tp=pos[w.toEl];if(!fp||!tp)return;
      const feEl=els.find(e=>e.id===w.fromEl),teEl=els.find(e=>e.id===w.toEl);
      const y1=pinY(fp,feEl?.connId,w.fromPin),y2=pinY(tp,teEl?.connId,w.toPin);
      const x1=fp.side==='right'?fp.x:fp.x+fp.w,x2=tp.side==='right'?tp.x+tp.w:tp.x;
      const mx=(x1+x2)/2,col=hex6(w.color||'#888888');
      svg+=`<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="1.5" opacity=".85"/>`;
      if(w.signal){const my=(y1+y2)/2,tw=w.signal.length*5;
        svg+=`<rect x="${mx-tw/2-3}" y="${my-7}" width="${tw+6}" height="13" fill="rgba(10,10,10,.8)" rx="2"/>
          <text x="${mx}" y="${my+4}" text-anchor="middle" font-size="7" font-family="Courier New" fill="${col}">${esc(w.signal)}</text>`;}
    });
    els.forEach(el=>{
      const p=pos[el.id];if(!p)return;
      const lib=CL.byId(el.connId),bc=lib?.type==='CIRC'?'#6ab0e8':'#68c880';
      const n=lib?.pinout?.length||4,gap=p.h/(n+1);
      svg+=`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="3" fill="rgba(26,26,26,.95)" stroke="${bc}" stroke-width="1.5"/>
        <text x="${p.x+p.w/2}" y="${p.y+12}" text-anchor="middle" font-size="8" font-weight="bold" font-family="Courier New" fill="#d4b870">${esc(el.label||'?')}</text>
        <text x="${p.x+p.w/2}" y="${p.y+22}" text-anchor="middle" font-size="6" font-family="Courier New" fill="#68c880">${esc(lib?.short||'')}</text>`;
      lib?.pinout?.forEach((pin,i)=>{
        const py=p.y+gap*(i+1),px=p.side==='right'?p.x+p.w:p.x;
        svg+=`<circle cx="${px}" cy="${py}" r="3" fill="${hex6(pin.c||'#888888')}"/>
          <text x="${p.side==='right'?px-5:px+5}" y="${py+3}" text-anchor="${p.side==='right'?'end':'start'}" font-size="6" font-family="Courier New" fill="#888">${esc(String(pin.id))} ${esc(pin.n)}</text>`;
      });
    });
    svg+=`</svg>`;
    wrap.innerHTML=svg;
  }
};

/* ── Drawing Panel schematic ── */
function renderDrawingPanel() {
  const el=document.getElementById('drawing-body');if(!el)return;
  const S=Store.get(),m=S.meta,wires=S.wires.filter(w=>w.active!==false),connEls=S.elements.filter(e=>e.kind==='connector');
  if(!wires.length&&!connEls.length){el.innerHTML='<div style="color:var(--t3);font-size:9px;padding:20px;text-align:center">Add connectors and wires in CANVAS tab</div>';return;}
  const W=700,n=wires.length||1,svgH=Math.max(120,n*22+80);
  const c1=connEls[0]?.label||'P1',c2=connEls[connEls.length>1?connEls.length-1:0]?.label||'P2';
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${svgH}" style="width:100%;max-width:700px;display:block;margin:0 auto">
    <rect x="20" y="30" width="70" height="${Math.max(60,n*22)}" rx="3" fill="#1a1a1a" stroke="#68c880" stroke-width="1.5"/>
    <text x="55" y="46" text-anchor="middle" font-size="9" font-weight="bold" font-family="Courier New" fill="#d4b870">${esc(c1)}</text>
    <rect x="${W-90}" y="30" width="70" height="${Math.max(60,n*22)}" rx="3" fill="#1a1a1a" stroke="#68c880" stroke-width="1.5"/>
    <text x="${W-55}" y="46" text-anchor="middle" font-size="9" font-weight="bold" font-family="Courier New" fill="#d4b870">${esc(c2)}</text>`;
  wires.forEach((w,i)=>{
    const y=50+i*22,col=hex6(w.color||'#888');
    svg+=`<line x1="90" y1="${y}" x2="${W-90}" y2="${y}" stroke="${col}" stroke-width="1.5"/>
      <circle cx="90" cy="${y}" r="2.5" fill="${col}"/>
      <circle cx="${W-90}" cy="${y}" r="2.5" fill="${col}"/>`;
    const lbl=`${w.gauge||'22AWG'} ${iecAbbr(w.color||'')}${w.signal?' · '+w.signal:''}`;
    svg+=`<text x="${W/2}" y="${y-4}" text-anchor="middle" font-size="7" font-family="Courier New" fill="${col}">${esc(lbl)}</text>`;
    if(w.fromPin!=null) svg+=`<text x="94" y="${y+4}" font-size="6" font-family="Courier New" fill="#888">${w.fromPin}</text>`;
    if(w.toPin!=null)   svg+=`<text x="${W-94}" y="${y+4}" text-anchor="end" font-size="6" font-family="Courier New" fill="#888">${w.toPin}</text>`;
  });
  svg+=`</svg>`;
  el.innerHTML=`<div style="max-width:740px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-size:10px;color:var(--c4);letter-spacing:2px">SCHEMATIC</span>
      <span style="font-size:7px;color:var(--t3)">${esc(m.dwgNo)} Rev ${esc(m.rev)} | ${esc(m.title)}</span>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--b2);padding:12px;border-radius:var(--radius)">${svg}</div>
    <div style="font-size:7px;color:var(--t3);text-align:center;padding:4px">LENGTH: ${m.cableLength}mm ±${m.lengthTol}mm | ${wires.length} WIRES | ${connEls.length} CONNECTORS</div>
  </div>`;
}

/* ═══ APP INIT ═══════════════════════════════════════════════ */
const App = {
  init() {
    Store.load();
    Engine.init();

    // Sync meta to topbar
    Store.sub(S => {
      const m=S.meta;
      const map={len:m.cableLength,tol:m.lengthTol,title:m.title,dwg:m.dwgNo,pn:m.pn,rev:m.rev};
      for(const [id,v] of Object.entries(map)) {
        const el=document.getElementById('tb-'+id);
        if(el && el.value!==String(v||'')) el.value=v||'';
      }
    });

    // Meta inputs
    ['len','tol','title','dwg','pn','rev'].forEach(id => {
      const el=document.getElementById('tb-'+id); if(!el) return;
      el.addEventListener('input', () => {
        Store.setMeta({
          cableLength: +document.getElementById('tb-len').value||500,
          lengthTol:   +document.getElementById('tb-tol').value||20,
          title:        document.getElementById('tb-title').value||'',
          dwgNo:        document.getElementById('tb-dwg').value||'',
          pn:           document.getElementById('tb-pn').value||'',
          rev:          document.getElementById('tb-rev').value||'A',
        });
        Store.save();
      });
    });

    // Tabs
    document.querySelectorAll('.tab[data-tab]').forEach(btn =>
      btn.addEventListener('click', () => Tabs.show(btn.dataset.tab, btn)));

    // Canvas tools
    document.querySelectorAll('.tool[data-tool]').forEach(btn =>
      btn.addEventListener('click', () => CV.setTool(btn.dataset.tool)));

    // Top bar buttons
    document.getElementById('btn-new').addEventListener('click', () => {
      if(!confirm('New project? All data will be cleared.')) return;
      try{localStorage.removeItem('hp23');}catch(_){}
      Store.reset(); Engine.clear(); MapE.reset(); SB.render(); CV.fit(); toast('New project');
    });
    document.getElementById('btn-import').addEventListener('click', () => {
      const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
      inp.onchange=()=>{
        const rdr=new FileReader();
        rdr.onload=ev=>{
          try{const d=JSON.parse(ev.target.result);if(!confirm('Import? Replaces current data.'))return;Store.pushUndo();Store.restore(d);SB.render();toast('Imported');}
          catch(e){toast('Error: '+e.message,true);}
        };
        if(inp.files[0])rdr.readAsText(inp.files[0]);
      };
      document.body.appendChild(inp);inp.click();document.body.removeChild(inp);
    });
    document.getElementById('btn-export').addEventListener('click', () => {
      const d=Store.snap();
      const b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(b);
      a.download=`harness_${d.meta.dwgNo||'project'}.json`;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      toast('Exported JSON');
    });
    document.getElementById('btn-excel').addEventListener('click', ()=>Excel.export());
    document.getElementById('btn-save').addEventListener('click', ()=>{Store.save();toast('Saved');});
    document.getElementById('btn-wizard').addEventListener('click', ()=>Wizard.open());

    // Analyze drop zone
    const drop=document.getElementById('az-drop'), finp=document.getElementById('az-file');
    if(drop){
      drop.onclick=()=>finp?.click();
      drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragover');};
      drop.ondragleave=()=>drop.classList.remove('dragover');
      drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragover');
        if(e.dataTransfer.files[0])Engine.storeFile(e.dataTransfer.files[0]);};
    }
    if(finp) finp.onchange=function(){if(this.files[0])Engine.storeFile(this.files[0]);this.value='';};

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); Store.undo(); }
      if((e.ctrlKey||e.metaKey) && e.key==='y') { e.preventDefault(); Store.redo(); }
      if((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); Store.save(); toast('Saved'); }
      if(e.key==='Escape') {
        if(document.getElementById('map-modal').classList.contains('open')) MapModal.close();
        else if(document.getElementById('az-modal').classList.contains('open')) AzModal.close();
        else CV.setTool('select');
      }
    });

    // Auto-rerender open panel on data change
    Store.sub(() => {
      const active=document.querySelector('.panel.active'); if(!active)return;
      const id=active.id.replace('panel-','');
      if(id==='bom') Panels.renderBOM();
      else if(id==='cutlist') Panels.renderCutList();
      else if(id==='routes')  Panels.renderRoutes();
      else if(id==='harness') HV.render();
      else if(id==='drawing') renderDrawingPanel();
    });

    CV.init();
    SB.render();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
