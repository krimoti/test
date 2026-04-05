'use strict';
const Props=(()=>{
  const GS=['12AWG','14AWG','16AWG','18AWG','20AWG','22AWG','24AWG','26AWG','28AWG'];
  return{
    show(obj,type){const body=document.getElementById('props-body');if(!body)return;
      let h='';
      if(type==='el')h=`<div class="prop-row"><div class="label">LABEL</div><input class="field" value="${esc(obj.label||'')}" oninput="Props.upEl('${obj.id}','label',this.value)"></div>
        <div class="prop-row"><div class="label">SIDE</div><select class="field" onchange="Props.upEl('${obj.id}','side',this.value)"><option${obj.side!=='right'?' selected':''}>left</option><option${obj.side==='right'?' selected':''}>right</option></select></div>
        <div class="prop-row"><div class="label">NOTES</div><input class="field" value="${esc(obj.notes||'')}" oninput="Props.upEl('${obj.id}','notes',this.value)"></div>
        <button class="btn btn-err" style="width:100%;margin-top:6px" onclick="Props.delEl('${obj.id}')">✕ DELETE</button>`;
      else if(type==='wire'){const sc=hex6(obj.color||'#888888');
        h=`<div class="prop-row"><div class="label">SIGNAL</div><input class="field" value="${esc(obj.signal||'')}" oninput="Props.upWire('${obj.id}','signal',this.value)"></div>
        <div class="prop-row"><div class="label">GAUGE</div><select class="field" onchange="Props.upWire('${obj.id}','gauge',this.value)">${GS.map(g=>`<option${obj.gauge===g?' selected':''}>${g}</option>`).join('')}</select></div>
        <div class="prop-row"><div class="label">COLOR</div><input type="color" value="${sc}" style="width:40px;height:24px;border:none;cursor:pointer" oninput="Props.upWire('${obj.id}','color',this.value)"> <span style="color:var(--t3);font-size:7px">${iecAbbr(sc)}</span></div>
        <div class="prop-row"><div class="label">CUT mm</div><input type="number" class="field" value="${obj.cutLength||500}" oninput="Props.upWire('${obj.id}','cutLength',+this.value)"></div>
        <div class="prop-row"><div class="label">ACTIVE</div><input type="checkbox"${obj.active!==false?' checked':''} onchange="Props.upWire('${obj.id}','active',this.checked)"></div>
        <button class="btn btn-err" style="width:100%;margin-top:6px" onclick="Props.delWire('${obj.id}')">✕ DELETE WIRE</button>`;}
      body.innerHTML=h||'<span style="color:var(--t3);font-size:7px">Select an element</span>';},
    clear(){const b=document.getElementById('props-body');if(b)b.innerHTML='<span style="color:var(--t3);font-size:7px">Select an element</span>';},
    upEl(id,k,v){Store.set({elements:Store.get().elements.map(e=>e.id===id?{...e,[k]:v}:e)});Store.save();},
    upWire(id,k,v){Store.set({wires:Store.get().wires.map(w=>w.id===id?{...w,[k]:v}:w)});Store.save();},
    delEl(id){if(!confirm('Delete connector?'))return;Store.pushUndo();const S=Store.get();
      Store.set({elements:S.elements.filter(e=>e.id!==id),wires:S.wires.filter(w=>w.fromEl!==id&&w.toEl!==id)});this.clear();Store.save();},
    delWire(id){Store.pushUndo();Store.set({wires:Store.get().wires.filter(w=>w.id!==id)});this.clear();Store.save();toast('Wire deleted');}
  };
})();
