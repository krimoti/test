'use strict';
const CLE=(()=>{
  let _ed=null;
  const GS=['18AWG','20AWG','22AWG','24AWG','26AWG','28AWG'];
  const SIGS=['PWR','GND','DATA','SIG','CAN','CLK','NC'];
  return{
    render(){const all=CL.all,custom=Object.values(all).filter(c=>!c.builtin),builtin=Object.values(all).filter(c=>c.builtin);
      const list=document.getElementById('cle-list');if(!list)return;
      let h=`<div style="padding:6px;border-bottom:1px solid var(--b1);display:flex;gap:4px">
        <button class="btn btn-ok" style="flex:1" onclick="CLE.newConn()">+ NEW</button>
        <button class="btn btn-acc" onclick="CLE.exportJSON()">↓ JSON</button>
        <label class="btn" style="cursor:pointer">↑ IMP<input type="file" accept=".json" style="display:none" onchange="CLE.importJSON(this)"></label></div>`;
      if(custom.length){h+=`<div style="padding:4px 8px;font-size:6px;color:var(--c6);letter-spacing:2px">CUSTOM (${custom.length})</div>`;
        custom.forEach(c=>{h+=`<div class="cle-item${_ed?.id===c.id?' sel':''}" onclick="CLE.select('${c.id}')">
          <span style="color:var(--c3);font-size:8px;font-weight:bold">${esc(c.short)}</span>
          <span style="color:var(--t3);font-size:7px">${c.pinout.length}p</span>
          <span style="color:var(--t3);font-size:6px;margin-left:auto">${esc(c.cat)}</span></div>`;});}
      h+=`<div style="padding:4px 8px;font-size:6px;color:var(--t3);letter-spacing:2px;margin-top:4px">BUILT-IN (${builtin.length})</div>`;
      builtin.forEach(c=>{h+=`<div class="cle-item" style="opacity:.5"><span style="color:var(--t2);font-size:8px">${esc(c.short)}</span><span style="color:var(--t3);font-size:7px">${c.pinout.length}p</span></div>`;});
      list.innerHTML=h;if(_ed)this.renderForm();},
    newConn(){_ed={id:uid(),name:'Custom Connector',short:'CX1',cat:'Custom',type:'RECT',pn:'',builtin:false,
      pinout:[{id:1,n:'VCC',sig:'PWR',g:'22AWG',c:'#cc0000'},{id:2,n:'GND',sig:'GND',g:'22AWG',c:'#222222'},
        {id:3,n:'SIG1',sig:'DATA',g:'24AWG',c:'#6ab0e8'},{id:4,n:'SIG2',sig:'DATA',g:'24AWG',c:'#68c880'}]};this.render();},
    select(id){const c=CL.byId(id);if(!c||c.builtin)return;_ed={...c,pinout:c.pinout.map(p=>({...p}))};this.renderForm();},
    renderForm(){const frm=document.getElementById('cle-form');if(!frm||!_ed)return;const c=_ed;
      const n=c.pinout.length,bw=80,bh=Math.max(50,n*18),gap=bh/(n+1);
      let svgPins='';c.pinout.forEach((pin,i)=>{const py=10+gap*(i+1);
        svgPins+=`<circle cx="${bw+2}" cy="${py}" r="4" fill="${hex6(pin.c||'#888')}"/>
          <text x="${bw+10}" y="${py+3}" font-size="7" font-family="Courier New" fill="#888">${esc(String(pin.id))} ${esc(pin.n)}</text>`;});
      const svg=`<svg viewBox="0 0 ${bw+130} ${bh+20}" style="height:${bh+20}px">
        <rect x="2" y="10" width="${bw}" height="${bh}" fill="#1a1a1a" stroke="${c.type==='CIRC'?'#6ab0e8':'#68c880'}" rx="${c.type==='CIRC'?bh/2:3}"/>
        <text x="${bw/2+2}" y="26" text-anchor="middle" font-size="9" font-family="Courier New" fill="#d4b870">${esc(c.short)}</text>${svgPins}</svg>`;
      let h=`<div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <span style="color:var(--c4);font-size:9px;font-weight:bold">${Store.get().customConns.find(x=>x.id===c.id)?'EDIT':'NEW'}: ${esc(c.name)}</span>
        <div style="display:flex;gap:5px"><button class="btn btn-ok" onclick="CLE.save()">✓ SAVE</button><button class="btn btn-err" onclick="CLE.del()">✕ DELETE</button><button class="btn" onclick="CLE._ed=null;CLE.render()">CANCEL</button></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div><div class="label">NAME</div><input class="field" value="${esc(c.name)}" oninput="CLE._ed.name=this.value;CLE.renderForm()"></div>
        <div><div class="label">SHORT</div><input class="field" value="${esc(c.short)}" oninput="CLE._ed.short=this.value;CLE.renderForm()"></div>
        <div><div class="label">CATEGORY</div><input class="field" value="${esc(c.cat)}" oninput="CLE._ed.cat=this.value"></div>
        <div><div class="label">PART NO.</div><input class="field" value="${esc(c.pn||'')}" oninput="CLE._ed.pn=this.value"></div>
        <div><div class="label">TYPE</div><select class="field" onchange="CLE._ed.type=this.value;CLE.renderForm()"><option${c.type==='RECT'?' selected':''}>RECT</option><option${c.type==='CIRC'?' selected':''}>CIRC</option></select></div>
      </div>
      <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <span class="label">PINS (${c.pinout.length})</span>
        <div style="display:flex;gap:4px"><button class="btn btn-ok" onclick="CLE.addPin()">+ PIN</button><button class="btn" onclick="CLE.autoFill()">AUTO-FILL</button></div></div>
      <table class="dt"><thead><tr><th>#</th><th>ID</th><th>NAME</th><th>SIGNAL</th><th>GAUGE</th><th>COLOR</th><th>DEL</th></tr></thead><tbody>`;
      c.pinout.forEach((pin,i)=>{h+=`<tr>
        <td style="color:var(--t3)">${i+1}</td>
        <td><input class="field" style="width:38px" value="${esc(String(pin.id))}" oninput="CLE._ed.pinout[${i}].id=this.value;CLE.renderForm()"></td>
        <td><input class="field" style="width:65px" value="${esc(pin.n||'')}" oninput="CLE._ed.pinout[${i}].n=this.value;CLE.renderForm()"></td>
        <td><select class="field" onchange="CLE._ed.pinout[${i}].sig=this.value">${SIGS.map(s=>`<option${pin.sig===s?' selected':''}>${s}</option>`).join('')}</select></td>
        <td><select class="field" onchange="CLE._ed.pinout[${i}].g=this.value">${GS.map(g=>`<option${pin.g===g?' selected':''}>${g}</option>`).join('')}</select></td>
        <td><input type="color" value="${hex6(pin.c||'#888888')}" style="width:26px;height:20px;border:none;cursor:pointer;border-radius:2px" oninput="CLE._ed.pinout[${i}].c=this.value;CLE.renderForm()"></td>
        <td><button class="btn btn-err" onclick="CLE.rmPin(${i})">✕</button></td></tr>`;});
      h+=`</tbody></table><div style="margin-top:12px;padding:8px;background:var(--bg2);border:1px solid var(--b2);border-radius:var(--radius)">
        <div class="label" style="margin-bottom:4px">PREVIEW</div><div style="display:flex;justify-content:center">${svg}</div></div>`;
      frm.innerHTML=h;},
    addPin(){if(!_ed)return;const n=_ed.pinout.length+1;_ed.pinout.push({id:n,n:'P'+n,sig:'DATA',g:'22AWG',c:'#888888'});this.renderForm();},
    rmPin(i){if(_ed){_ed.pinout.splice(i,1);this.renderForm();}},
    autoFill(){if(!_ed)return;const sigs=['PWR','GND','SIG1','SIG2','SIG3','SIG4','SIG5','SIG6'];
      const cols=['#cc0000','#222222','#6ab0e8','#68c880','#e8a840','#c080e0','#888888','#e8e0c8'];
      _ed.pinout.forEach((p,i)=>{p.n=sigs[i]||('P'+(i+1));p.c=cols[i%cols.length];p.sig=i===0?'PWR':i===1?'GND':'DATA';});this.renderForm();},
    save(){if(!_ed)return;CL.addCustom({..._ed,pins:_ed.pinout.length});SB.render();this.render();toast('Connector saved');},
    del(){if(!_ed||!confirm('Delete connector?'))return;CL.removeCustom(_ed.id);_ed=null;SB.render();this.render();toast('Deleted');},
    exportJSON(){const cc=Store.get().customConns;if(!cc.length){toast('No custom connectors',true);return;}
      const b=new Blob([JSON.stringify({version:'hp23',connectors:cc},null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='connectors_'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a);a.click();document.body.removeChild(a);toast(`Exported ${cc.length} connectors`);},
    importJSON(inp){const f=inp.files[0];if(!f)return;const rdr=new FileReader();
      rdr.onload=ev=>{try{const d=JSON.parse(ev.target.result),nc=d.connectors||d;
        if(!Array.isArray(nc)){toast('Invalid format',true);return;}
        if(!confirm(`Import ${nc.length} connectors?`))return;
        nc.forEach(c=>CL.addCustom(c));SB.render();CLE.render();toast(`Imported ${nc.length}`);
      }catch(e){toast('Error: '+e.message,true);}};rdr.readAsText(f);inp.value='';},
    get _ed(){return _ed;},set _ed(v){_ed=v;}
  };
})();
