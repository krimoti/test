'use strict';
const Production=(()=>{
  const STD={
    cut_wire:{t:.5,u:'min/wire',p:'PREP',ref:'IPC-WHMA-4.1'},strip_end:{t:.5,u:'min/end',p:'PREP',ref:'IPC-WHMA-4.2'},
    install_seal:{t:.5,u:'min/seal',p:'PREP',ref:'IPC-WHMA-4.3'},apply_marker:{t:.5,u:'min/wire',p:'PREP',ref:'IPC-WHMA-4.4'},
    crimp_contact:{t:1.0,u:'min/crimp',p:'CRIMP',ref:'IPC-WHMA-5.1'},pull_test:{t:.2,u:'min/crimp',p:'CRIMP',ref:'MIL-STD-45208'},
    insert_contact:{t:.5,u:'min/pin',p:'ASSY',ref:'IPC-WHMA-5.3'},terminate_shield:{t:3.0,u:'min/shield',p:'ASSY',ref:'IPC-WHMA-6.1'},
    install_wedge:{t:1.0,u:'min/conn',p:'ASSY',ref:'IPC-WHMA-5.4'},install_backshell:{t:3.0,u:'min/conn',p:'ASSY',ref:'MIL-DTL-38999'},
    apply_heatshrink:{t:1.5,u:'min/pos',p:'ASSY',ref:'IPC-WHMA-7.1'},apply_sleeving:{t:5.0,u:'min/run',p:'ASSY',ref:'IPC-WHMA-7.2'},
    route_board:{t:5.0,u:'min/harness',p:'ASSY',ref:'IPC-WHMA-8.1'},apply_label:{t:2.0,u:'min/label',p:'ASSY',ref:'IPC-WHMA-9.1'},
    continuity_test:{t:8.0,u:'min/harness',p:'TEST',ref:'IPC-WHMA-17.1'},hipot_test:{t:5.0,u:'min/harness',p:'TEST',ref:'IPC-WHMA-17.2'},
    visual_inspect:{t:10.0,u:'min/harness',p:'QC',ref:'IPC-WHMA-3.1'},dimensional_check:{t:5.0,u:'min/harness',p:'QC',ref:'IPC-WHMA-3.2'},
    final_signoff:{t:15.0,u:'min/harness',p:'QC',ref:'IPC-WHMA-3.3'}
  };
  function op(num,key,operation,detail,standard,tools,qty,unit){
    const s=STD[key]||{t:1,u:unit||'ea',p:'ASSY',ref:''};
    return{num,phase:s.p,operation,detail,standard,tools,qty,unit:unit||s.u,std_time:s.t,total_time:qty*s.t,ref:s.ref};
  }
  return{generate(r){
    const{bom=[],wires=[],shields=[],cableLength=0,tolerance='',connectors=[]}=r;const ops=[];
    const wireBOM=bom.filter(it=>/(wire|cable)/i.test(it.category||it.cat||''));
    const contactBOM=bom.filter(it=>/(contact|pin)/i.test(it.category||it.cat||''));
    const connBOM=bom.filter(it=>/(connector|housing)/i.test(it.category||it.cat||''));
    const sealBOM=bom.filter(it=>/(seal)/i.test(it.category||it.cat||''));
    const hshrBOM=bom.filter(it=>/(shrink|tubing)/i.test(it.desc||''));
    const slvBOM=bom.filter(it=>/(sleeve|sleeving|expand)/i.test(it.desc||''));
    const bsBOM=bom.filter(it=>/(backshell|bkshl|clamp)/i.test(it.desc||''));
    const wdgBOM=bom.filter(it=>/(wedge)/i.test(it.desc||''));
    const mrkBOM=bom.filter(it=>/(marker)/i.test(it.desc||''));
    const wc=wires.length||Math.max(1,...wireBOM.map(w=>Math.round(w.qty*2)));
    const pc=contactBOM.reduce((a,c)=>a+(c.qty||0),0)||(wc*2);
    const sc2=sealBOM.reduce((a,s)=>a+(s.qty||0),0)||wc;
    const shc=shields.length||bom.filter(it=>/(shield)/i.test(it.category||'')).reduce((a,s)=>a+(s.qty||0),0);
    let n=1;
    if(wc>0){
      ops.push(op(n++,'cut_wire','CUT wire to length',`${wc} wire(s). Cable: ${cableLength}mm ${tolerance}`,'Per CUT LIST. Tolerance per title block','Wire cutter, cut board',wc,'wire'));
      ops.push(op(n++,'strip_end','STRIP wire insulation — both ends',`${wc*2} wire ends × 5mm strip`,'No nicks. 100% visual check','Calibrated wire stripper',wc*2,'end'));
    }
    if(sc2>0)ops.push(op(n++,'install_seal','INSTALL wire seal / grommet',`${sc2} seals. Slide to 50mm from end`,'Seal oriented correctly. Not pre-compressed','Seal tool',sc2,'seal'));
    if(mrkBOM.length)ops.push(op(n++,'apply_marker','APPLY ID marker tubes',`${wc} wires per signal designation`,'ID matches drawing','Heat gun',wc,'wire'));
    const fCount=contactBOM.find(c=>/female|socket/i.test(c.desc||''))?.qty||Math.floor(pc/2);
    const mCount=contactBOM.find(c=>/male|pin/i.test(c.desc||''))?.qty||Math.ceil(pc/2);
    if(fCount>0)ops.push(op(n++,'crimp_contact','CRIMP female contact onto wire',`${fCount} contacts — ${contactBOM.find(c=>/female/i.test(c.desc||''))?.pn||'Female contact'}`,'Per MIL-DTL-39029. Pull test 45N min','Calibrated crimping tool (DMC)',fCount,'crimp'));
    if(mCount>0)ops.push(op(n++,'crimp_contact','CRIMP male contact onto wire',`${mCount} contacts — ${contactBOM.find(c=>/male/i.test(c.desc||''))?.pn||'Male contact'}`,'Per MIL-DTL-39029. Pull test 45N min','Calibrated crimping tool',mCount,'crimp'));
    if(pc>0)ops.push(op(n++,'pull_test','PULL TEST each crimped contact',`100% pull test — ${pc} contacts × 45N minimum`,'MIL-STD-45208. Record all results','Calibrated pull tester',pc,'crimp'));
    if(pc>0){
      if(connBOM.length)connBOM.forEach(conn=>{const cp=Math.round((conn.qty||1)*4);ops.push(op(n++,'insert_contact',`INSERT contacts — ${conn.pn||'housing'}`,`${conn.desc||''} — verify orientation`,'Fully seated. Audible click','Insertion tool per spec',cp,'contact'));});
      else ops.push(op(n++,'insert_contact','INSERT contacts into connectors',`${pc} contacts`,'Fully seated check','Insertion tool',pc,'contact'));
    }
    if(shc>0)ops.push(op(n++,'terminate_shield','TERMINATE shield — solder sleeve',`${shc} shield termination(s). → CHASSIS GND`,'IPC/WHMA-A-620 Class 3. 360° contact. No cold joints','Heat gun 200°C. Solder sleeve tool',shc,'shield'));
    wdgBOM.forEach(w=>ops.push(op(n++,'install_wedge',`INSTALL wedgelock — ${w.pn||'wedge'}`,`${w.desc||''} × ${w.qty||1}`,'Fully seated. Retention check by feel','Wedgelock tool',w.qty||1,'pc')));
    bsBOM.forEach(bs=>ops.push(op(n++,'install_backshell',`INSTALL backshell — ${bs.pn||'backshell'}`,`${bs.desc||''} × ${bs.qty||1}. Torque per spec`,'MIL-DTL-38999 torque specification','Torque wrench. Spanner key',bs.qty||1,'pc')));
    if(slvBOM.length)ops.push(op(n++,'apply_sleeving','APPLY expandable sleeving',`${slvBOM.map(s=>s.pn).join(', ')}`,'Full coverage. Ends secured','Sleeving applicator',slvBOM.reduce((a,s)=>a+(s.qty||1),0),'run'));
    if(hshrBOM.length)ops.push(op(n++,'apply_heatshrink','APPLY heatshrink tubing',`${hshrBOM.map(s=>s.pn+' ('+s.qty+s.unit+')').join(', ')}`,'Full shrink. 2:1 or 3:1 ratio per BOM','Heat gun 200°C',hshrBOM.length,'position'));
    ops.push(op(n++,'route_board','ROUTE cable on form board',`Length: ${cableLength||'?'}mm ${tolerance}. Per routing drawing`,'All branches within tolerance. No stress at connectors','Form board. Cable clamps',1,'harness'));
    ops.push(op(n++,'apply_label','APPLY S/N label to cable','Label format per drawing NOTE','S/N sequential. Legible. Secured','Label printer. Cable tie',1,'label'));
    ops.push(op(n++,'continuity_test','CONTINUITY test — all circuits',`${wires.length||pc} circuits. FROM each pin TO corresponding pin`,'< 0.5Ω per circuit. 100% coverage. Record pass/fail','Continuity tester / flying probe',1,'harness'));
    ops.push(op(n++,'hipot_test','HI-POT insulation test — 500VDC','500VDC between circuits and shield/chassis. 1s dwell','No breakdown. > 100MΩ. Record result','Calibrated hi-pot tester. Safety interlock',1,'harness'));
    ops.push(op(n++,'visual_inspect','VISUAL INSPECTION — IPC/WHMA-A-620 Class 3','Wire colors · connector orientation · heatshrink · label · no abrasion · shield','IPC/WHMA-A-620 Class 3. Zero accepts for Class 3 defects','Magnifier 3×. Drawing. Checklist',1,'harness'));
    ops.push(op(n++,'dimensional_check','DIMENSIONAL check — cable length',`Required: ${cableLength||'?'}mm ${tolerance}`,'Within tolerance per title block','Steel tape measure / form board markings',1,'harness'));
    ops.push(op(n++,'final_signoff','FINAL QC sign-off and records','Inspector signs traveler. S/N logged. Test results filed','Full traceability. S/N in system','Traveler card. Stamp. Test record',1,'harness'));
    return ops;
  }};
})();
