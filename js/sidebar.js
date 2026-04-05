'use strict';
const SB=(()=>{
  let _c=false,_f='';
  return{
    render(){const el=document.getElementById('sb-body');if(!el)return;
      const cats={};Object.values(CL.all).forEach(c=>{const k=c.cat||'Other';if(!cats[k])cats[k]=[];cats[k].push(c);});
      let h='';
      Object.entries(cats).sort(([a],[b])=>a.localeCompare(b)).forEach(([cat,conns])=>{
        const vis=conns.filter(c=>!_f||c.short.toLowerCase().includes(_f)||c.name.toLowerCase().includes(_f)||cat.toLowerCase().includes(_f));
        if(!vis.length)return;
        h+=`<div class="sb-cat">${esc(cat)}</div>`;
        vis.forEach(c=>{h+=`<div class="conn-item" draggable="true" ondragstart="event.dataTransfer.setData('connId','${c.id}')" title="${esc(c.name)} — ${c.pinout.length}p">
          <span class="conn-name">${esc(c.short)}</span><span class="conn-pins">${c.pinout.length}p</span>
          ${c.builtin?'':'<span style="color:var(--c6);font-size:6px">✦</span>'}
        </div>`;});
      });
      el.innerHTML=h||'<div style="color:var(--t3);font-size:7px;padding:8px">No results</div>';},
    toggle(){_c=!_c;document.getElementById('sidebar').classList.toggle('collapsed',_c);document.getElementById('sb-toggle').textContent=_c?'▶':'◀';},
    filter(v){_f=v.toLowerCase().trim();this.render();}
  };
})();
