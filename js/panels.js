'use strict';
const Panels=(()=>{
  const GS=['12AWG','14AWG','16AWG','18AWG','20AWG','22AWG','24AWG','26AWG','28AWG'];
  const infer=(d,p)=>{
    const dU=(d||'').toUpperCase(),pU=(p||'').toUpperCase();
    if(/\bWIRE\b|TEFLON|\bCABLE\b/.test(dU))return'WIRE';
    if(/CONNECTOR|CIRCULAR|PLUG|RCPT|HOUSING/.test(dU))return'CONNECTOR';
    if(/\bPIN\b|CONTACT|FEMALE PIN|PIN MALE/.test(dU))return'CONTACT';
    if(/SHRINK|TUBING|MARKER|SLEEVE|SLEEVING|EXPAND/.test(dU))return'PROTECTION';
    if(/SHIELD|SOLDER SLEEVE/.test(dU))return'SHIELD';
    if(/SEAL/.test(dU))return'SEAL';
    if(/WEDGE|BACKSHELL|BKSHL|CLAMP|LOCK/.test(dU))return'HARDWARE';
    return'MATERIAL';
  };
  const CC={WIRE:'var(--c2)',CONNECTOR:'var(--c3)',CONTACT:'var(--c4)',PROTECTION:'var(--c6)',
    SHIELD:'var(--c3)',SEAL:'var(--c4)',HARDWARE:'var(--t2)',MATERIAL:'var(--t3)'};
  return{
    renderBOM(){const el=document.getElementById('bom-body');if(!el)return;
      const S=Store.get();
      let h=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10px;color:var(--c4);letter-spacing:2px">BILL OF MATERIALS</span>
        <div style="display:flex;gap:6px"><button class="btn btn-info" onclick="Panels.autoBOM()">⚡ AUTO</button><button class="btn btn-ok" onclick="Panels.addBOM()">+ ADD</button></div></div>
      <div style="overflow-x:auto"><table class="dt"><thead><tr><th>ITEM</th><th>P/N</th><th>DESCRIPTION</th><th>QTY</th><th>UNIT</th><th>CAT</th><th>DEL</th></tr></thead><tbody>`;
      S.bomItems.forEach((it,i)=>{const cc=CC[it.cat]||'var(--t3)';
        h+=`<tr><td style="font-weight:bold;color:var(--c4)">${it.item||i+1}</td>
          <td><input class="field pn" style="width:110px" value="${esc(it.pn||'')}" oninput="Panels.upBOM('${it.id}','pn',this.value)"></td>
          <td><input class="field" style="width:200px" value="${esc(it.desc||'')}" oninput="Panels.upBOM('${it.id}','desc',this.value)"></td>
          <td><input type="number" class="field num" style="width:55px" value="${it.qty||1}" oninput="Panels.upBOM('${it.id}','qty',+this.value)"></td>
          <td><select class="field" onchange="Panels.upBOM('${it.id}','unit',this.value)">${['PC','EA','M','MT','FT','SET'].map(u=>`<option${it.unit===u?' selected':''}>${u}</option>`).join('')}</select></td>
          <td><span class="tag" style="color:${cc};border:1px solid ${cc}22;background:${cc}11">${esc(it.cat||'—')}</span></td>
          <td><button class="btn btn-err" onclick="Panels.delBOM('${it.id}')">✕</button></td></tr>`;});
      h+=`</tbody></table></div>`;
      if(!S.bomItems.length)h+='<div style="color:var(--t3);font-size:8px;padding:12px">No BOM items. Click + ADD or ⚡ AUTO.</div>';
      el.innerHTML=h;},
    addBOM(){Store.pushUndo();const S=Store.get();
      Store.set({bomItems:[...S.bomItems,{id:uid(),item:S.bomItems.length+1,pn:'',desc:'',qty:1,unit:'PC',cat:'MATERIAL'}]});this.renderBOM();Store.save();},
    upBOM(id,k,v){const S=Store.get();
      Store.set({bomItems:S.bomItems.map(it=>it.id===id?{...it,[k]:v,cat:(k==='desc'||k==='pn')?infer(k==='desc'?v:it.desc,k==='pn'?v:it.pn):it.cat}:it)});Store.save();},
    delBOM(id){Store.pushUndo();Store.set({bomItems:Store.get().bomItems.filter(it=>it.id!==id)});this.renderBOM();Store.save();},
    autoBOM(){Store.pushUndo();const S=Store.get();const items=[];const seen={};
      S.elements.forEach(el=>{if(el.kind!=='connector')return;const lib=CL.byId(el.connId);if(!lib)return;
        const k=lib.pn||lib.id;if(seen[k]){seen[k].qty++;return;}
        const it={id:uid(),item:items.length+1,qty:1,unit:'PC',pn:lib.pn||lib.id,desc:lib.name,cat:'CONNECTOR'};seen[k]=it;items.push(it);});
      const wMap={};S.wires.forEach(w=>{const k=(w.gauge||'22AWG')+'|'+(w.color||'#888');
        if(!wMap[k])wMap[k]={gauge:w.gauge||'22AWG',color:w.color,total:0};wMap[k].total+=w.cutLength||S.meta.cableLength||500;});
      Object.values(wMap).forEach(wm=>{const lenM=Math.ceil(wm.total/1000*1.15*100)/100;
        items.push({id:uid(),item:items.length+1,qty:lenM,unit:'MT',pn:'',desc:`Wire ${wm.gauge} ${iecAbbr(wm.color||'')}`,cat:'WIRE'});});
      Store.set({bomItems:[...S.bomItems,...items]});this.renderBOM();Store.save();toast(`Generated ${items.length} BOM items`);},
    renderCutList(){const el=document.getElementById('cutlist-body');if(!el)return;
      const S=Store.get(),connEls=S.elements.filter(e=>e.kind==='connector');
      let h=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10px;color:var(--c4);letter-spacing:2px">CUT LIST (${S.wires.filter(w=>w.active!==false).length})</span>
        <button class="btn btn-ok" onclick="Panels.addWire()">+ ADD</button></div>
      <div style="overflow-x:auto"><table class="dt"><thead><tr>
        <th>ON</th><th>FROM</th><th>F.PIN</th><th>TO</th><th>T.PIN</th>
        <th>SIGNAL</th><th>GAUGE</th><th>COLOR</th><th>CUT mm</th><th>IEC</th><th>DEL</th>
      </tr></thead><tbody>`;
      S.wires.forEach(w=>{const sc=hex6(w.color||'#888888');
        const fLib=w.fromEl?CL.byId(S.elements.find(e=>e.id===w.fromEl)?.connId):null;
        const tLib=w.toEl?CL.byId(S.elements.find(e=>e.id===w.toEl)?.connId):null;
        h+=`<tr${w.active===false?' style="opacity:.45"':''}>
          <td><input type="checkbox"${w.active!==false?' checked':''} onchange="Props.upWire('${w.id}','active',this.checked)"></td>
          <td><select class="field" style="width:65px" onchange="Props.upWire('${w.id}','fromEl',this.value)"><option value="">—</option>${connEls.map(e=>`<option value="${e.id}"${w.fromEl===e.id?' selected':''}>${esc(e.label)}</option>`).join('')}</select></td>
          <td><select class="field" style="width:52px" onchange="Props.upWire('${w.id}','fromPin',this.value)"><option value="">—</option>${(fLib?fLib.pinout:[]).map(p=>`<option value="${p.id}"${String(w.fromPin)===String(p.id)?' selected':''}>${p.id} ${p.n}</option>`).join('')}</select></td>
          <td><select class="field" style="width:65px" onchange="Props.upWire('${w.id}','toEl',this.value)"><option value="">—</option>${connEls.map(e=>`<option value="${e.id}"${w.toEl===e.id?' selected':''}>${esc(e.label)}</option>`).join('')}</select></td>
          <td><select class="field" style="width:52px" onchange="Props.upWire('${w.id}','toPin',this.value)"><option value="">—</option>${(tLib?tLib.pinout:[]).map(p=>`<option value="${p.id}"${String(w.toPin)===String(p.id)?' selected':''}>${p.id} ${p.n}</option>`).join('')}</select></td>
          <td><input class="field sig" style="width:65px" value="${esc(w.signal||'')}" oninput="Props.upWire('${w.id}','signal',this.value)"></td>
          <td><select class="field" onchange="Props.upWire('${w.id}','gauge',this.value)">${GS.map(g=>`<option${w.gauge===g?' selected':''}>${g}</option>`).join('')}</select></td>
          <td><input type="color" value="${sc}" style="width:26px;height:20px;border:none;cursor:pointer;border-radius:2px" oninput="Props.upWire('${w.id}','color',this.value)"></td>
          <td><input type="number" class="field num" style="width:65px" value="${w.cutLength||500}" oninput="Props.upWire('${w.id}','cutLength',+this.value)"></td>
          <td style="color:var(--c7);font-size:7px">${iecAbbr(w.color||'')}</td>
          <td><button class="btn btn-err" onclick="Props.delWire('${w.id}')">✕</button></td></tr>`;});
      h+=`</tbody></table></div>`;el.innerHTML=h;},
    addWire(){Store.pushUndo();const S=Store.get();
      Store.set({wires:[...S.wires,{id:uid(),fromEl:'',fromPin:'',toEl:'',toPin:'',signal:'',gauge:'22AWG',color:'#888888',cutLength:S.meta.cableLength||500,active:true}]});
      this.renderCutList();Store.save();},
    renderRoutes(){const el=document.getElementById('routes-body');if(!el)return;
      const S=Store.get(),connEls=S.elements.filter(e=>e.kind==='connector');
      let h=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10px;color:var(--c4);letter-spacing:2px">WIRE ROUTES (${S.wires.length})</span>
        <button class="btn btn-ok" onclick="Panels.addWire()">+ ADD</button></div>
      <div style="overflow-x:auto"><table class="dt"><thead><tr><th>FROM</th><th>F.PIN</th><th>TO</th><th>T.PIN</th><th>SIGNAL</th><th>GAUGE</th><th>COLOR</th><th>DEL</th></tr></thead><tbody>`;
      S.wires.forEach(w=>{const sc=hex6(w.color||'#888888');
        const fLib=w.fromEl?CL.byId(S.elements.find(e=>e.id===w.fromEl)?.connId):null;
        const tLib=w.toEl?CL.byId(S.elements.find(e=>e.id===w.toEl)?.connId):null;
        h+=`<tr><td><select class="field" style="width:65px" onchange="Props.upWire('${w.id}','fromEl',this.value)"><option value="">—</option>${connEls.map(e=>`<option value="${e.id}"${w.fromEl===e.id?' selected':''}>${esc(e.label)}</option>`).join('')}</select></td>
          <td><select class="field" style="width:52px" onchange="Props.upWire('${w.id}','fromPin',this.value)"><option value="">—</option>${(fLib?fLib.pinout:[]).map(p=>`<option value="${p.id}"${String(w.fromPin)===String(p.id)?' selected':''}>${p.id} ${p.n}</option>`).join('')}</select></td>
          <td><select class="field" style="width:65px" onchange="Props.upWire('${w.id}','toEl',this.value)"><option value="">—</option>${connEls.map(e=>`<option value="${e.id}"${w.toEl===e.id?' selected':''}>${esc(e.label)}</option>`).join('')}</select></td>
          <td><select class="field" style="width:52px" onchange="Props.upWire('${w.id}','toPin',this.value)"><option value="">—</option>${(tLib?tLib.pinout:[]).map(p=>`<option value="${p.id}"${String(w.toPin)===String(p.id)?' selected':''}>${p.id} ${p.n}</option>`).join('')}</select></td>
          <td><input class="field sig" style="width:70px" value="${esc(w.signal||'')}" oninput="Props.upWire('${w.id}','signal',this.value)"></td>
          <td><select class="field" onchange="Props.upWire('${w.id}','gauge',this.value)">${GS.map(g=>`<option${w.gauge===g?' selected':''}>${g}</option>`).join('')}</select></td>
          <td><span class="wire-color" style="background:${sc}"></span>${iecAbbr(w.color||'')}</td>
          <td><button class="btn btn-err" onclick="Props.delWire('${w.id}')">✕</button></td></tr>`;});
      h+=`</tbody></table></div>`;el.innerHTML=h;},
    renderEngDwg(){const el=document.getElementById('engdwg-body');if(!el)return;
      const S=Store.get(),m=S.meta,wires=S.wires.filter(w=>w.active!==false),connEls=S.elements.filter(e=>e.kind==='connector');
      const B='1px solid #b0b0a8',today=new Date().toLocaleDateString();
      const c1=connEls[0]?.label||'P1',c2=connEls[1]?.label||'P2';
      el.innerHTML=`<div id="dwg-sheet"><div style="border:2px solid #000">
        <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #000"><tr>
          <td style="padding:5px 10px;border-right:${B};font-size:16pt;font-weight:bold;width:160px">${esc(m.company||'COMPANY')}</td>
          <td style="padding:5px 10px;font-size:13pt;font-weight:bold;text-align:center">${esc(m.title||'CABLE ASSEMBLY')}</td>
          <td style="padding:0;width:200px;border-left:${B}"><table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:2px 6px;border-bottom:${B};font-size:8pt">DWG#: <b>${esc(m.dwgNo)}</b></td><td style="padding:2px 6px;border-bottom:${B};border-left:${B};font-size:8pt">REV: <b>${esc(m.rev)}</b></td></tr>
            <tr><td style="padding:2px 6px;border-bottom:${B};font-size:8pt">P/N: <b>${esc(m.pn)}</b></td><td style="padding:2px 6px;border-bottom:${B};border-left:${B};font-size:8pt">DATE: ${today}</td></tr>
            <tr><td style="padding:2px 6px;font-size:8pt" colspan="2">DRAWN: ${esc(m.drawn||'—')}</td></tr>
          </table></td></tr></table>
        <div style="padding:12px;border-bottom:${B}">
          <div style="font-size:8pt;font-weight:bold;margin-bottom:6px">WIRE ROUTING TABLE</div>
          ${wires.length?`<table style="width:100%;border-collapse:collapse;font-size:8pt"><thead><tr style="background:#e8e8e0">
            <th style="border:${B};padding:3px 8px">${esc(c1)} PIN</th><th style="border:${B};padding:3px 8px;width:80px">WIRE</th>
            <th style="border:${B};padding:3px 8px">AWG / COLOR / SIGNAL</th><th style="border:${B};padding:3px 8px;width:80px">WIRE</th>
            <th style="border:${B};padding:3px 8px">${esc(c2)} PIN</th></tr></thead><tbody>
            ${wires.map(w=>{const col=hex6(w.color||'#888');return`<tr>
              <td style="border:${B};padding:3px 8px;text-align:center;font-weight:bold">${esc(String(w.fromPin||'—'))}</td>
              <td style="border:${B};padding:0"><div style="height:2px;background:${col};margin:10px 6px"></div></td>
              <td style="border:${B};padding:3px 8px;text-align:center"><b>${esc(w.gauge||'22AWG')}</b> <span style="display:inline-block;width:10px;height:10px;background:${col};border:1px solid #ccc;vertical-align:middle;margin:0 4px;border-radius:50%"></span>${esc(iecAbbr(w.color||''))} <i>${esc(w.signal||'')}</i></td>
              <td style="border:${B};padding:0"><div style="height:2px;background:${col};margin:10px 6px"></div></td>
              <td style="border:${B};padding:3px 8px;text-align:center;font-weight:bold">${esc(String(w.toPin||'—'))}</td></tr>`;}).join('')}
            <tr><td colspan="5" style="border:${B};padding:3px 8px;font-size:7.5pt;text-align:center;color:#666">LENGTH: ${m.cableLength}mm ±${m.lengthTol}mm | WIRES: ${wires.length}</td></tr>
            </tbody></table>`:'<p style="color:#888;font-size:8pt">No wires defined</p>'}
        </div>
        <div style="padding:12px;border-bottom:${B}">
          <div style="font-size:8pt;font-weight:bold;margin-bottom:6px">BILL OF MATERIALS</div>
          <table style="width:100%;border-collapse:collapse;font-size:8pt"><thead><tr style="background:#e8e8e0">
            <th style="border:${B};padding:3px 6px">ITEM</th><th style="border:${B};padding:3px 6px">QTY</th>
            <th style="border:${B};padding:3px 6px">UNIT</th><th style="border:${B};padding:3px 6px">PART NO.</th>
            <th style="border:${B};padding:3px 6px">DESCRIPTION</th><th style="border:${B};padding:3px 6px">CAT</th>
          </tr></thead><tbody>
            ${S.bomItems.map((it,i)=>`<tr${i%2?' style="background:#f5f5f0"':''}><td style="border:${B};padding:2px 6px;text-align:center;font-weight:bold">${it.item||i+1}</td><td style="border:${B};padding:2px 6px;text-align:center">${it.qty||1}</td><td style="border:${B};padding:2px 6px">${esc(it.unit||'PC')}</td><td style="border:${B};padding:2px 6px;font-family:Courier New">${esc(it.pn||'—')}</td><td style="border:${B};padding:2px 6px">${esc(it.desc||'—')}</td><td style="border:${B};padding:2px 6px">${esc(it.cat||'—')}</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div style="padding:6px 10px;font-size:7.5pt"><b>NOTES:</b> 1. All dimensions in MM. 2. Cable length: <b>${m.cableLength}mm ±${m.lengthTol}mm</b>. 3. Wire colors per IEC 60228.</div>
      </div></div>`;},
    renderProduction(){const el=document.getElementById('production-body');if(!el)return;
      const S=Store.get(),r=window._AZ?.last;
      const bom=r?.bom||S.bomItems.map(it=>({...it,category:it.cat}));
      const wires=r?.wires||S.wires.filter(w=>w.active!==false).map(w=>({color:w.color,awg:w.gauge,signal:w.signal,shield:false}));
      const ops=Production.generate({bom,wires,shields:r?.shields||[],cableLength:S.meta.cableLength,tolerance:'±'+S.meta.lengthTol+'mm',connectors:r?.connectors||[]});
      const total=ops.reduce((a,o)=>a+o.total_time,0);
      const PHASES=['PREP','CRIMP','ASSY','TEST','QC'];
      const PC={PREP:'var(--c2)',CRIMP:'var(--c4)',ASSY:'var(--c3)',TEST:'var(--c4)',QC:'var(--c4)'};
      let h=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <div class="stat-card"><div class="stat-lbl">STD TIME</div><div class="stat-val" style="color:var(--c3)">${total.toFixed(0)}'</div><div class="stat-sub">+15%: ${(total*1.15).toFixed(0)}' = ${(total/60).toFixed(2)}h</div></div>
        <div class="stat-card"><div class="stat-lbl">OPERATIONS</div><div class="stat-val" style="color:var(--c2)">${ops.length}</div><div class="stat-sub">${PHASES.length} phases</div></div>
        <div class="stat-card"><div class="stat-lbl">WIRES / BOM</div><div class="stat-val" style="color:var(--c4)">${wires.length} / ${bom.length}</div><div class="stat-sub">${S.meta.cableLength}mm ±${S.meta.lengthTol}mm</div></div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--b2);padding:8px;margin-bottom:10px;border-radius:var(--radius)">
        <div class="label" style="margin-bottom:6px">PHASE BREAKDOWN</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap">`;
      PHASES.forEach(ph=>{const t=ops.filter(o=>o.phase===ph).reduce((a,o)=>a+o.total_time,0),pct=total?Math.round(t/total*100):0;
        h+=`<div><div class="phase-badge ph-${ph}">${ph}</div><div style="height:4px;width:${Math.max(4,pct)}px;background:${PC[ph]};margin:3px 0;border-radius:2px"></div><div style="font-size:7px;color:var(--t3)">${t.toFixed(0)}' (${pct}%)</div></div>`;});
      h+=`</div></div>
      <div style="font-size:9px;color:var(--c4);letter-spacing:2px;margin-bottom:6px">WORK INSTRUCTIONS</div>
      <div style="overflow-x:auto"><table class="dt"><thead><tr>
        <th>#</th><th>PHASE</th><th>OPERATION</th><th>DETAIL / STANDARD</th><th>TOOLS</th><th>QTY</th><th>STD'</th><th>TOTAL'</th><th>REF</th>
      </tr></thead><tbody>`;
      ops.forEach(op=>{h+=`<tr>
        <td style="color:var(--t3)">${op.num}</td>
        <td><span class="phase-badge ph-${op.phase}">${op.phase}</span></td>
        <td style="font-weight:bold">${esc(op.operation)}</td>
        <td style="max-width:260px"><div style="font-size:7.5px">${esc(op.detail)}</div>${op.standard?`<div style="font-size:7px;color:var(--c3);margin-top:2px">✓ ${esc(op.standard)}</div>`:''}</td>
        <td style="font-size:7px;color:var(--t3);max-width:130px">${esc(op.tools||'')}</td>
        <td class="num">${op.qty} ${op.unit}</td>
        <td class="num" style="color:var(--c3)">${op.std_time.toFixed(1)}'</td>
        <td class="num" style="color:var(--c4);font-weight:bold">${op.total_time.toFixed(1)}'</td>
        <td style="font-size:7px;color:var(--t3)">${esc(op.ref||'')}</td></tr>`;});
      h+=`<tr style="background:var(--bg2);border-top:2px solid var(--c4)">
        <td colspan="6" style="color:var(--c4);font-weight:bold">TOTAL STANDARD TIME</td>
        <td class="num" style="color:var(--c3)">${(total/ops.length).toFixed(1)}'</td>
        <td class="num" style="color:var(--c4);font-size:11px;font-weight:bold">${total.toFixed(0)}'</td>
        <td style="font-size:7px;color:var(--t3)">+15%: ${(total*1.15).toFixed(0)}'</td></tr></tbody></table></div>`;
      if(bom.length){const CC2={WIRE:'var(--c2)',CONNECTOR:'var(--c3)',CONTACT:'var(--c4)',PROTECTION:'var(--c6)',SHIELD:'var(--c3)',SEAL:'var(--c4)',HARDWARE:'var(--t2)',MATERIAL:'var(--t3)'};
        h+=`<div style="font-size:9px;color:var(--c4);letter-spacing:2px;margin:12px 0 6px">PART LIST</div>
        <table class="dt"><thead><tr><th>ITEM</th><th>P/N</th><th>DESCRIPTION</th><th>QTY</th><th>UNIT</th><th>CATEGORY</th></tr></thead><tbody>`;
        bom.forEach(it=>{const cat=it.category||it.cat||'MATERIAL',cc=CC2[cat]||'var(--t3)';
          h+=`<tr><td style="font-weight:bold;color:var(--c4)">${it.item}</td><td class="pn">${esc(it.pn||'—')}</td><td>${esc(it.desc||'—')}</td><td class="num">${it.qty}</td><td style="color:var(--t3)">${esc(it.unit||'PC')}</td><td><span class="tag" style="color:${cc};border:1px solid ${cc}22;background:${cc}11">${esc(cat)}</span></td></tr>`;});
        h+=`</tbody></table>`;}
      h+=`<div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--b1)">
        <button class="btn btn-ok" onclick="Engine.loadToCanvas()">▶ LOAD TO CANVAS</button>
        <button class="btn btn-acc" onclick="Excel.export()">↓ EXPORT EXCEL</button>
        <button class="btn btn-info" onclick="MapModal.open()">⊞ MAP VIEW</button></div>`;
      el.innerHTML=h;}
  };
})();
