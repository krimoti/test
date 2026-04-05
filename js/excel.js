'use strict';
const Excel={
  export(){
    const r=window._AZ?.last,S=Store.get();
    const bom=r?.bom||S.bomItems.map(it=>({item:it.item,pn:it.pn,desc:it.desc,qty:it.qty,unit:it.unit,category:it.cat}));
    const wires=r?.wires||S.wires.filter(w=>w.active!==false).map(w=>({
      fromConn:S.elements.find(e=>e.id===w.fromEl)?.label||'',fromPin:w.fromPin,
      toConn:S.elements.find(e=>e.id===w.toEl)?.label||'',toPin:w.toPin,
      color:w.color,awg:w.gauge,signal:w.signal,shield:false}));
    const m=r||{...S.meta,drawingNo:S.meta.dwgNo};
    const ops=r?.productionOps||Production.generate({bom,wires,shields:r?.shields||[],
      cableLength:S.meta.cableLength,tolerance:'±'+S.meta.lengthTol+'mm',connectors:[]});
    const total=ops.reduce((a,o)=>a+o.total_time,0);
    const e=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const cell=v=>{const s=v===null||v===undefined?'':v,n=!isNaN(+s)&&String(s).trim()!=='';return`<Cell><Data ss:Type="${n?'Number':'String'}">${e(String(s))}</Data></Cell>`;};
    const sheet=(name,rows)=>`<Worksheet ss:Name="${e(name.slice(0,31))}"><Table>${rows.map(r2=>'<Row>'+r2.map(cell).join('')+'</Row>').join('\n')}</Table></Worksheet>`;
    const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheet('Drawing Info',[['DRAWING INFORMATION',''],['Drawing Number',m.drawingNo||m.dwgNo||''],['Revision',m.rev||''],['Title',m.title||''],['Part Number',m.pn||''],['Company',m.company||''],['Drawn By',m.drawn||m.drawnBy||''],['Date',m.date||''],['Cable Length (mm)',m.cableLength||''],['Tolerance',m.tolerance||('±'+S.meta.lengthTol+'mm')],['Confidence',(m.confidence?.overall||0)+'%'],['Connectors',(m.connectors||[]).join(', ')]])}
${sheet('BOM',[['ITEM','P/N','DESCRIPTION','QTY','UNIT','CATEGORY'],...bom.map(it=>[it.item,it.pn||'',it.desc||'',it.qty||1,it.unit||'PC',it.category||'']),[],...[['Total items:',bom.length]]])}
${sheet('Wire Table',[['#','FROM CONN','FROM PIN','TO CONN','TO PIN','COLOR','AWG','SIGNAL','CUT LENGTH (mm)','SHIELD'],...wires.map((w,i)=>[i+1,w.fromConn||'',w.fromPin||'',w.toConn||'',w.toPin||'',w.color||'',w.awg||'',w.signal||'',m.cableLength||'',w.shield?'YES':''])])}
${sheet('PIN-OUT Map',[['CONNECTOR','PIN','SIGNAL','COLOR','AWG','MATES TO'],...Object.entries(m.pinOut||{}).flatMap(([conn,pins])=>Object.entries(pins).sort((a,b)=>+a[0]-+b[0]).map(([pin,info])=>[conn,pin,info.signal||'',info.color||'',info.awg||'',info.matesTo||'']))])}
${sheet('Shield-Drain',[['TYPE','TERMINATES TO','PIN','COMPONENT','RAW'],...(m.shields||[]).map(sh=>[sh.type||'SHIELD',sh.terminatesTo||'',sh.pin||'',sh.component||'',sh.raw||''])])}
${sheet('Work Instructions',[['#','PHASE','OPERATION','DETAIL / STANDARD','TOOLS','QTY','UNIT','STD TIME (min)','TOTAL (min)','REF'],...ops.map(op=>[op.num||'',op.phase||'',op.operation||'',(op.detail||'')+((op.standard)?' | ✓ '+op.standard:''),op.tools||'',op.qty||'',op.unit||'',op.std_time||'',op.total_time||'',op.ref||'']),[],...[['','','TOTAL STANDARD TIME','','','','','',total.toFixed(1),'IPC/WHMA-A-620'],['','','+ 15% efficiency','','','','','',(total*1.15).toFixed(1),''],['','','TOTAL HOURS','','','','','',(total/60).toFixed(2)+'h','']]])}
${sheet('Notes-Details',[['SECTION','CONTENT'],...(m.notes||[]).map((n,i)=>['NOTE '+(i+1),n]),...Object.entries(m.details||{}).flatMap(([k,d])=>(d.lines||[]).map(l=>['DETAIL '+k,l]))])}
${sheet('Dimensions',[['VALUE (mm)','DESCRIPTION','SOURCE'],...(m.dimensions||[[S.meta.cableLength||0,'Cable length','Store']]).map(d=>[d.value||d[0]||'',d.raw||d[1]||'',d.source||d[2]||'']),[m.tolerance||('±'+S.meta.lengthTol+'mm'),'Tolerance','Title block']])}
</Workbook>`;
    const blob=new Blob(['\uFEFF'+xml],{type:'application/vnd.ms-excel;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=(m.drawingNo||m.dwgNo||'harness')+'_'+new Date().toISOString().slice(0,10)+'.xls';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
    toast(`Exported ${bom.length} BOM + ${wires.length} wires + ${ops.length} ops → Excel`);}
};
