'use strict';
/* ═══════════════════════════════════════════════════════════
   M11 — ANALYSIS ENGINE  v3
   
   PDF EXTRACTION STRATEGY (100% local, no server):
   1. Load pdf.min.js + pdf.worker.min.js from local js/ folder
   2. Create Blob URL from worker → fixes file:// CORS completely
   3. Extract text from ALL pages with Y-tolerance line grouping
   4. Run 8-layer analysis pipeline
   
   Confidence target: ≥90% on AIR / Amphenol Tel-Ad drawings.
═══════════════════════════════════════════════════════════ */
const Engine = (() => {

  /* ── P/N detection v3 — all AIR/Amphenol formats ── */
  function isPN(l) {
    if(!l) return false;
    if(l.indexOf(',') >= 0) return false;
    if(/^\d{6,}$/.test(l)) return true;            // 1496820000
    if(/^\d{2,4}\.\d{4,}$/.test(l)) return true;   // 35.1244
    if(l.length <= 20 && /^[A-Z0-9]{2,}\s+\d[\d\s]{1,10}$/.test(l)) return true; // EE8 133 0
    if(l.length > 32) return false;
    if(/^[A-Z0-9][\w\-\.\/]{1,}[\-\/][A-Z0-9\-\.\/]{1,}$/.test(l)) return true;
    if(/^[A-Z]+\s+\d+[\/\-]\d+[\-\.\/]?\d*$/.test(l)) return true;
    return false;
  }

  /* ── Restore slashes lost by PDF.js rendering ── */
  function fixConn(s) {
    if(!s) return s;
    s = s.replace(/(U\d+)(ESC)/g,  '$1/$2');
    s = s.replace(/(U\d+)(J\d)/g,  '$1/$2');
    s = s.replace(/(BAT\d+)(JS)/g, '$1/$2');
    s = s.replace(/(BAT\d+)(P\d)/g,'$1/$2');
    return s.trim();
  }

  const WIRE_RE = /^(BLK|RED|WHT|BLU|BLUE|GRN|GREEN|YEL|ORG|VIO|VT|GRY|BRN|BROWN|ORN)\s+#(\d{2})(?:\s+\(([^)]+)\))?$/i;
  const CONN_RE = /^(U\d+[\/][JP]\d+|U\d+\s+[\w]+\s*\/[JP]\d+)$/;
  const CMAP = {
    BLK:'BLACK', RED:'RED', WHT:'WHITE', BLU:'BLUE', BLUE:'BLUE',
    GRN:'GREEN', GREEN:'GREEN', YEL:'YELLOW', ORG:'ORANGE', ORN:'ORANGE',
    VIO:'VIOLET', VT:'VIOLET', GRY:'GREY', BRN:'BROWN', BROWN:'BROWN'
  };
  const CHEX = {
    RED:'#e74c3c', BLACK:'#333333', WHITE:'#e8e0c8', BLUE:'#3498db',
    GREEN:'#27ae60', YELLOW:'#f1c40f', ORANGE:'#e67e22', VIOLET:'#9b59b6',
    GREY:'#888888', BROWN:'#a0522d'
  };

  function inferCat(d, p) {
    const u = (d||'').toUpperCase() + (p||'').toUpperCase();
    if(/\bWIRE\b|HOOK-UP|\bCABLE\b|TEFLON/.test(u)) return 'WIRE';
    if(/CONNECTOR|CIRCULAR|PLUG|RCPT|HOUSING/.test(u)) return 'CONNECTOR';
    if(/\bPIN\b|CONTACT|SOCKET/.test(u)) return 'CONTACT';
    if(/SHRINK|TUBING|MARKER|SLEEVE|EXPAND/.test(u)) return 'PROTECTION';
    if(/SHIELD|SOLDER SLEEVE/.test(u)) return 'SHIELD';
    if(/SEAL/.test(u)) return 'SEAL';
    if(/TERMINAL|LUG|GLAND|WEDGE|BACKSHELL|CLAMP|CODING|TORX|FRAME|CARRIER/.test(u)) return 'HARDWARE';
    return 'MATERIAL';
  }

  /* ─────────────────────────────────────────────────────
     parseBOM — AIR columnar: ITEM | P/N | DESCRIPTION | Qty | UN
     Handles: "P/N" or "PN" header, pure-numeric P/Ns, dot-separated P/Ns
  ───────────────────────────────────────────────────── */
  function parseBOM(lines) {
    let hi = -1;
    for(let i=0; i<lines.length-4; i++) {
      if(lines[i]==='ITEM' && (lines[i+1]==='P/N'||lines[i+1]==='PN') && lines[i+2]==='DESCRIPTION') {
        hi=i; break;
      }
    }
    if(hi < 0) return [];
    const ds = hi+5;
    let itemEnd = ds;
    while(itemEnd<lines.length && /^\d{1,2}$/.test(lines[itemEnd]) && +lines[itemEnd]>=1 && +lines[itemEnd]<=25)
      itemEnd++;
    const firstCount = itemEnd - ds;
    const allPNs = [];
    for(let i=itemEnd; i<Math.min(lines.length,itemEnd+60); i++) {
      if(isPN(lines[i])) allPNs.push(lines[i]);
      if(/^(ECO|Connection|3000$)/.test(lines[i])) break;
    }
    let pnRunEnd = itemEnd;
    while(pnRunEnd<lines.length && isPN(lines[pnRunEnd])) pnRunEnd++;
    const allDescs = [];
    for(let i=pnRunEnd; i<Math.min(lines.length,itemEnd+60); i++) {
      const l=lines[i];
      if(!l||/^\d{1,2}$/.test(l)||/^\d+\.?\d*\s+(PC|MT|EA|SET)$/.test(l)||isPN(l)) continue;
      if(/^(Connection|30A|S\/N|ECO)/.test(l)) continue;
      if(/^\d{1,2}\s+[A-Z][A-Z0-9\-\.\/]{3,}$/.test(l)) continue;
      if(l.length<5) continue;
      allDescs.push(l);
      if(allDescs.length>=25) break;
    }
    const inlinePNs = {};
    for(let i=itemEnd; i<Math.min(lines.length,itemEnd+60); i++) {
      const m=lines[i].match(/^(\d{1,2})\s+([A-Z][A-Z0-9\-\.\/]{3,})$/);
      if(m && +m[1]>firstCount) inlinePNs[+m[1]]=m[2];
    }
    const qtyVals = [];
    for(let i=hi; i<lines.length; i++) {
      const m=lines[i].match(/^(\d+\.?\d*)\s+(PC|MT|EA|SET)$/);
      if(m && i>hi+5) qtyVals.push({qty:+m[1], unit:m[2]});
      if(qtyVals.length>=25) break;
    }
    const tailNoPNs=[], tailQ=allPNs.slice(firstCount), tailPNMap={};
    for(let n=firstCount+1; n<=firstCount+8; n++) if(!inlinePNs[n]) tailNoPNs.push(n);
    tailNoPNs.forEach((n,i)=>{ if(i<tailQ.length) tailPNMap[n]=tailQ[i]; });
    const bom=[];
    for(let idx=0; idx<Math.max(allDescs.length,allPNs.length); idx++) {
      const item=idx+1; if(item>25) break;
      const desc=allDescs[idx]||'', qty=qtyVals[idx]||{qty:1,unit:'PC'};
      const pn = item<=firstCount ? (allPNs[idx]||'') : (inlinePNs[item]||tailPNMap[item]||'');
      if(!pn && !desc) break;
      bom.push({item, pn, desc, qty:qty.qty, unit:qty.unit, category:inferCat(desc,pn), balloonId:item});
    }
    return bom.sort((a,b)=>a.item-b.item);
  }

  /* ── Wire parser P1: color-per-line (30A style) ── */
  function parseWiresP1(lines) {
    const wires=[];
    let conn=null, pins=[], pending=[];
    const flush=()=>{
      if(!conn||!pending.length) return;
      pending.forEach((w,i)=>{ const pin=pins[i]!=null?pins[i]:(i+1);
        wires.push({...w, fromConn:conn, fromPin:pin, toConn:'', toPin:null}); });
      pending=[]; pins=[];
    };
    for(let i=0; i<lines.length; i++) {
      const l=lines[i];
      if(CONN_RE.test(l)) { flush(); conn=fixConn(l.split(',')[0].trim()); pins=[]; pending=[]; continue; }
      if(!conn) continue;
      if(/^\d{1,2}$/.test(l) && +l>=1 && +l<=20 && !pending.length) { pins.push(+l); continue; }
      const wi=l.match(WIRE_RE);
      if(wi) {
        let sig=wi[3]||'';
        if(!sig && i+1<lines.length) { const nm=lines[i+1].match(/^\(([^)]+)\)$/); if(nm){sig=nm[1];i++;} }
        const normColor = CMAP[wi[1].toUpperCase()]||wi[1].toUpperCase();
        pending.push({color:normColor, hex:CHEX[normColor]||'#888', awg:wi[2]+'AWG', signal:sig, shield:/SHIELD|DRAIN/i.test(sig)});
        continue;
      }
      if(/^(ITEM|ECO No)$/.test(l)) { flush(); conn=null; }
    }
    flush(); return wires;
  }

  /* ── Wire parser P2: BAT3JS1 / pins / colors / destinations (11A style) ── */
  function parseWiresP2(lines) {
    const wires=[];
    const SINGLE=/^[A-Z]$/;
    const COLOR_RE=/^(RED|BLK|WHT|GRN|BLU)$/i;
    const SKIP=new Set(['ITEM','SIZE','STANDARD','COMPANY','PROJECT','TITLE','DRAWN',
      'APPROVED','SIGNATURE','NAME','DATE','DESCRIPTION','ECO','REV','AMP']);
    let i=0;
    while(i<lines.length) {
      const l=lines[i];
      if(!/^[A-Z][A-Z0-9]+$/.test(l)||l.length<4||SKIP.has(l)) { i++; continue; }
      const fromConn=fixConn(l);
      let j=i+1;
      const pins=[];
      while(j<lines.length && SINGLE.test(lines[j]) && pins.length<16) { pins.push(lines[j]); j++; }
      if(pins.length<2) { i++; continue; }
      const fromColors=[];
      while(j<lines.length && COLOR_RE.test(lines[j]) && fromColors.length<pins.length) { fromColors.push(lines[j].toUpperCase()); j++; }
      while(j<lines.length && SINGLE.test(lines[j])) j++;
      const dests=[];
      while(j<lines.length && dests.length<pins.length) {
        const dm=lines[j].match(/^(\S+)\s{1,4}(VP\+|VN-)\s*$/);
        if(dm) { dests.push({conn:fixConn(dm[1]), sig:dm[2]}); j++; }
        else break;
      }
      if(!dests.length) { i++; continue; }
      for(let k=0; k<Math.min(pins.length,dests.length); k++) {
        const col=fromColors[k]||'BLK';
        const normColor=col==='RED'?'RED':col==='WHT'?'WHITE':col==='GRN'?'GREEN':col==='BLU'?'BLUE':'BLACK';
        wires.push({fromConn, fromPin:pins[k], toConn:dests[k].conn, toPin:null,
          color:normColor, hex:CHEX[normColor]||'#333', awg:'8AWG', signal:dests[k].sig, shield:false});
      }
      i=j;
    }
    return wires;
  }

  /* ── Title block ── */
  function parseMeta(lines) {
    const all=lines.join(' ');
    const meta={drawingNo:'',rev:'',pn:'',title:'',company:'',date:'',drawn:'',standard:''};
    const dw=all.match(/(\d{2,3}[A-Z]-\d{2,3}-\d{4,6}-\d{2,3})/); if(dw) meta.drawingNo=dw[1];
    const dnIdx=lines.findIndex(l=>/^Drawing Number$/i.test(l));
    if(dnIdx>=0&&lines[dnIdx+1]) { const m=lines[dnIdx+1].match(/(\d{2,3}[A-Z]-\d{2,3}-\d{4,6}-\d{2,3})/); if(m) meta.drawingNo=m[1]; }
    const rv=all.match(/Rev[_\s]?(\d{2}|\w)\b/i)||all.match(/\bREV[:\s]*(\d{1,2})\b/i);
    if(rv) meta.rev=rv[1];
    const ti=lines.findIndex(l=>/^TITLE$/i.test(l));
    if(ti>=0&&lines[ti+1]) meta.title=lines[ti+1];
    if(!meta.title) { const t=lines.find(l=>l.length>8&&l.length<80&&/CABLE|ASSEMBLY|HARNESS|WIRE/.test(l.toUpperCase())); if(t) meta.title=t; }
    if(/Amphenol/i.test(all)) meta.company='Amphenol Tel-Ad';
    else if(/\bAIR\b/.test(all)) meta.company='AIR';
    const dt=all.match(/\b(\d{2}\.\d{2}\.\d{2,4})\b/); if(dt) meta.date=dt[1];
    const drIdx=lines.findIndex(l=>/^DRAWN$/i.test(l));
    if(drIdx>=0) { for(let j=drIdx+1;j<Math.min(drIdx+6,lines.length);j++){const dl=lines[j]||'';if(dl&&!/^(APPROVED|NAME|DATE|SIGNATURE)$/i.test(dl)&&!/^\d/.test(dl)){meta.drawn=dl;break;}} }
    if(/AIR/.test(all)) meta.standard='AIR';
    if(!meta.pn&&meta.drawingNo) meta.pn=meta.drawingNo;
    return meta;
  }

  /* ── Dimensions + tolerance ── */
  function parseDims(lines) {
    const r={cableLength:0,tolerance:'',ranges:[],all:[]};
    lines.forEach(l=>{
      if(/^\d{3,4}$/.test(l.trim())){const v=+l;if(v>=100&&v<=9999&&v>r.cableLength){r.cableLength=v;r.all.push({value:v,raw:l+'mm'});}}
      const mm=l.match(/\b(\d{3,5})\s*(?:MM|mm)\b/);if(mm){const v=+mm[1];if(v>=50&&v>r.cableLength)r.cableLength=v;}
      const tol=l.match(/(\d+)-(\d+)\s*[±]\s*(\d+)\s*M?M?/i);if(tol)r.ranges.push({from:+tol[1],to:+tol[2],tol:+tol[3]});
    });
    if(r.cableLength&&!r.tolerance){const v=r.cableLength,rng=r.ranges.find(x=>v>=x.from&&v<=x.to);
      r.tolerance=rng?`±${rng.tol}mm`:v<=100?'±5mm':v<=500?'±10mm':v<=1500?'±20mm':'±25mm';}
    return r;
  }

  /* ── Shields ── */
  function parseShields(lines) {
    const shields=[];
    lines.forEach((l,i)=>{
      if(!/\bSHIELD\b|\bDRAIN\b|\bSCREEN\b/i.test(l)) return;
      const sh={type:/DRAIN/i.test(l)?'DRAIN':'SHIELD',raw:l,pin:null,terminatesTo:'CHASSIS GND',component:''};
      const ctx=lines.slice(Math.max(0,i-3),Math.min(lines.length,i+4)).join(' ');
      const pm=ctx.match(/\b([1-9]|1[0-9])\b/);if(pm)sh.pin=+pm[1];
      const cmp=lines.slice(Math.max(0,i-3),Math.min(lines.length,i+4)).find(x=>/D-436|Solder/i.test(x));if(cmp)sh.component=cmp.trim();
      shields.push(sh);
    });
    return shields;
  }

  function parseDetails(lines){const det={};let key=null;
    lines.forEach(l=>{const m=l.match(/^Detail\s+([A-Z])$/i);if(m){key=m[1].toUpperCase();det[key]={label:'Detail '+key,lines:[]};return;}
      if(key&&det[key]&&l&&!/^(Connection|U\d|S\/N)/.test(l))det[key].lines.push(l);});return det;}

  function parseNotes(lines){const notes=[];let in_=false;
    lines.forEach(l=>{if(/^NOTE:?$/i.test(l)){in_=true;return;}
      if(in_&&l.length>4&&!/^(S\/N:|COMPANY|AIR|Tolerance|RoHS|STANDARD)/.test(l))notes.push(l);
      if(/^COMPANY$/i.test(l))in_=false;});return notes;}

  /* ── Confidence scorer ── */
  function scoreResult(r) {
    const s={};
    s.titleBlock = r.drawingNo?95:r.title?60:20;
    s.bom        = r.bom.length>=15?95:r.bom.length>=8?80:r.bom.length>0?55:5;
    s.wires      = r.wires.length>=5?90:r.wires.length>0?60:10;
    s.connArea   = r.wires.some(w=>w.fromPin)?90:r.wires.length>0?55:10;
    s.shield     = r.shields.length>0?90:r.shieldMentioned?40:100;
    s.details    = Object.keys(r.details||{}).length>0?90:50;
    s.dimensions = r.cableLength>0?95:15;
    s.pinOut     = Object.values(r.pinOut||{}).some(p=>Object.keys(p).length>0)?90:15;
    s.overall    = Math.round(Object.values(s).slice(0,8).reduce((a,b)=>a+b,0)/8);
    return s;
  }

  /* ── Full analysis pipeline ── */
  function analyzeText(text, source) {
    const lines = text.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
    const meta    = parseMeta(lines);
    const bom     = parseBOM(lines);
    const wiresP1 = parseWiresP1(lines);
    const wiresP2 = parseWiresP2(lines);
    const wires   = wiresP2.length > wiresP1.length ? wiresP2 : wiresP1;
    const dims    = parseDims(lines);
    const shields = parseShields(lines);
    const details = parseDetails(lines);
    const notes   = parseNotes(lines);

    const connSet={};
    lines.forEach(l=>{ if(CONN_RE.test(l)) connSet[fixConn(l.split(',')[0].trim())]=true; });
    wires.forEach(w=>{ if(w.fromConn) connSet[w.fromConn]=true; if(w.toConn) connSet[w.toConn]=true; });
    const connectors=Object.keys(connSet).length?Object.keys(connSet):['P1','P2'];

    const pinOut={};
    connectors.forEach(c=>{pinOut[c]={};});
    wires.forEach(w=>{
      if(w.fromConn&&w.fromPin!=null){
        if(!pinOut[w.fromConn]) pinOut[w.fromConn]={};
        pinOut[w.fromConn][w.fromPin]={signal:w.signal,color:w.color,hex:w.hex,awg:w.awg,shield:w.shield,matesTo:w.toConn||''};
      }
    });

    const missing=[], warnings=[];
    if(!meta.drawingNo) missing.push('Drawing number');
    if(!meta.rev) missing.push('Revision');
    if(!bom.length) warnings.push('BOM not extracted — check text quality');
    if(!wires.length) warnings.push('No wires found');
    if(dims.cableLength===0) warnings.push('Cable length not detected');
    const shieldMentioned=lines.some(l=>/\bSHIELD\b|\bDRAIN\b/i.test(l));
    if(shieldMentioned&&!shields.length) warnings.push('SHIELD mentioned but not extracted');

    const result={
      source:source||'TEXT', pageCount:1,
      ...meta, ...dims,
      bom, wires, connectors, pinOut,
      shields, shieldMentioned, details, notes, warnings, missing
    };
    result.productionOps = typeof Production!=='undefined' ? Production.generate(result) : [];
    result.totalStdTime  = result.productionOps.reduce((a,o)=>a+o.total_time,0);
    result.confidence    = scoreResult(result);
    window._AZ.last      = result;

    // Sync to Store
    const S=Store.get();
    if(result.cableLength) Store.setMeta({cableLength:result.cableLength});
    if(result.bom.length && !S.bomItems.length) {
      Store.set({bomItems:result.bom.map((it,i)=>({
        id:uid(), item:it.item||i+1, pn:it.pn||'', desc:it.desc||'',
        qty:it.qty||1, unit:it.unit||'PC', cat:it.category||'MATERIAL'
      }))});
    }
    return result;
  }

  /* ── PDF text extraction with Y-tolerance line grouping ── */
  function pdfItemsToLines(items) {
    if(!items.length) return [];
    const rows=[];
    items.forEach(it=>{
      const y=it.transform[5];
      // 3px tolerance for same line
      const row=rows.find(r=>Math.abs(r.y-y)<=3);
      if(row) row.items.push({x:it.transform[4], text:it.str});
      else rows.push({y, items:[{x:it.transform[4], text:it.str}]});
    });
    return rows
      .sort((a,b)=>b.y-a.y)
      .map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ').trim())
      .filter(l=>l.length>0);
  }

  /* ── PDF.js initialisation (blob worker = no file:// CORS) ── */
  function initPDFjs() {
    return new Promise((resolve, reject)=>{
      if(typeof pdfjsLib !== 'undefined') { resolve(pdfjsLib); return; }
      reject(new Error('pdfjsLib not loaded'));
    });
  }

  function setBlobWorker() {
    // Create worker from already-loaded script tag (avoids file:// fetch CORS)
    if(!pdfjsLib.GlobalWorkerOptions) return;
    if(pdfjsLib.GlobalWorkerOptions.workerSrc) return;

    // Find the worker <script> that was loaded as a local file
    const scripts = Array.from(document.querySelectorAll('script'));
    const wScript = scripts.find(s => s.src && s.src.includes('pdf.worker'));

    if(wScript && wScript.src.startsWith('file://')) {
      // For file:// we can't fetch the script → use no-worker mode
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      return;
    }

    if(wScript) {
      // HTTP: fetch and create blob
      fetch(wScript.src).then(r=>r.text()).then(code=>{
        const blob=new Blob([code],{type:'application/javascript'});
        pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(blob);
      }).catch(()=>{ pdfjsLib.GlobalWorkerOptions.workerSrc=''; });
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc='';
    }
  }

  async function extractAllPages(arrayBuffer) {
    setBlobWorker();
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: false,
    }).promise;

    let allLines=[], pageCount=doc.numPages;

    // Page 1: also render to canvas for MAP VIEW
    const page1=await doc.getPage(1);
    const vp=page1.getViewport({scale:2});
    const cv=document.createElement('canvas');
    cv.width=vp.width; cv.height=vp.height;
    await page1.render({canvasContext:cv.getContext('2d'), viewport:vp}).promise;
    window._AZ_FILE.dataURL=cv.toDataURL('image/jpeg',.85);
    const pr=document.getElementById('az-preview');
    if(pr) pr.innerHTML=`<img src="${window._AZ_FILE.dataURL}" style="max-height:100px;max-width:100%;border:1px solid var(--b2)">`;

    // Extract text from all pages
    for(let p=1; p<=doc.numPages; p++) {
      const page=await doc.getPage(p);
      const tc=await page.getTextContent({normalizeWhitespace:true});
      const lines=pdfItemsToLines(tc.items);
      allLines=allLines.concat(lines);
      // Page separator (helps BOM detection)
      allLines.push('');
    }

    return {text: allLines.join('\n'), pageCount};
  }

  /* ── Results renderer ── */
  function renderResults(r) {
    const el=document.getElementById('az-results'); if(!el) return;
    const c=r.confidence||{};
    const bar=v=>`<div style="width:${v}px;height:4px;background:${v>=80?'var(--c3)':v>=60?'var(--c4)':'var(--c5)'};border-radius:2px"></div>`;
    const sRow=(lbl,v)=>`<div class="conf-row"><span class="conf-label">${lbl}</span><div class="conf-bar-wrap">${bar(v||0)}</div><span class="conf-val">${v||0}%</span></div>`;

    let h=`<div style="background:var(--bg2);border:1px solid var(--b2);border-radius:var(--radius);padding:10px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:8px;color:var(--c4);letter-spacing:2px">EXTRACTION CONFIDENCE</span>
        <span style="font-size:18px;font-weight:bold;color:${c.overall>=80?'var(--c3)':c.overall>=60?'var(--c4)':'var(--c5)'}">${c.overall||0}%</span>
        <span style="font-size:7px;color:var(--t3)">${esc(r.source||'')} · ${r.pageCount||1}p</span>
      </div>
      <div class="conf-grid">${sRow('Title Block',c.titleBlock)}${sRow('BOM / Part List',c.bom)}${sRow('Wire Table',c.wires)}${sRow('Connection Area',c.connArea)}${sRow('SHIELD/DRAIN',c.shield)}${sRow('DETAIL sections',c.details)}${sRow('Dimensions',c.dimensions)}${sRow('PIN-OUT map',c.pinOut)}</div>
    </div>`;

    const mf=[[r.drawingNo,'DWG#'],[r.rev,'REV'],[r.pn,'P/N'],[r.title,'TITLE'],
      [r.company,'COMPANY'],[r.cableLength?r.cableLength+'mm '+r.tolerance:'','LENGTH'],
      [r.date,'DATE'],[r.drawn,'DRAWN'],[r.standard,'STANDARD']];
    h+=`<div style="background:var(--bg2);border:1px solid var(--b2);border-radius:var(--radius);padding:8px;margin-bottom:6px;display:grid;grid-template-columns:1fr 1fr;gap:3px">`;
    mf.forEach(([v,k])=>{ if(v) h+=`<div><span style="font-size:6px;color:var(--t3)">${k}: </span><span style="color:var(--c4);font-size:8px">${esc(String(v))}</span></div>`; });
    h+=`</div>`;

    if(r.wires.length) {
      h+=`<div class="az-section">WIRE TABLE (${r.wires.length})</div><div style="overflow-x:auto"><table class="dt"><thead><tr><th>#</th><th>COLOR</th><th>AWG</th><th>SIGNAL</th><th>FROM</th><th>TO</th></tr></thead><tbody>`;
      r.wires.forEach((w,i)=>{ const col=w.hex||CHEX[w.color]||'#888';
        h+=`<tr><td style="color:var(--t3)">${i+1}</td><td><span class="wire-color" style="background:${col}"></span>${esc(w.color||'—')}</td><td style="font-family:Courier New">${esc(w.awg)}</td><td class="sig">${esc(w.signal)}</td><td style="font-size:7px">${esc(w.fromConn||'')}${w.fromPin!=null?' '+w.fromPin:''}</td><td style="font-size:7px">${esc(w.toConn||'')}${w.toPin!=null?' '+w.toPin:''}</td></tr>`;});
      h+=`</tbody></table></div>`;
    }
    if(r.shields.length) {
      h+=`<div class="az-section">SHIELD / DRAIN (${r.shields.length})</div>`;
      r.shields.forEach(sh=>{ h+=`<div style="font-size:7.5px;color:var(--t2);margin-bottom:3px">● <b>${esc(sh.type)}</b> → ${esc(sh.terminatesTo)}${sh.pin!=null?` (PIN ${sh.pin})`:''}${sh.component?` [${esc(sh.component)}]`:''}</div>`; });
    }
    const poKeys=Object.keys(r.pinOut||{}).filter(k=>Object.keys(r.pinOut[k]).length>0);
    if(poKeys.length) {
      h+=`<div class="az-section">PIN-OUT MAP</div><div style="display:flex;gap:8px;flex-wrap:wrap">`;
      poKeys.forEach(conn=>{
        h+=`<div style="background:var(--bg2);border:1px solid var(--b2);padding:6px;border-radius:var(--radius)"><div style="font-size:8px;color:var(--c4);font-weight:bold;margin-bottom:4px">${esc(conn)}</div>`;
        Object.entries(r.pinOut[conn]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).forEach(([pin,info])=>{ const col=info.hex||CHEX[info.color]||'#888';
          h+=`<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;font-size:7px"><span style="color:var(--t3);min-width:18px">${esc(String(pin))}</span><span style="display:inline-block;width:8px;height:8px;background:${col};border-radius:50%;flex-shrink:0"></span><span class="sig">${esc(info.signal||'—')}</span><span style="color:var(--t3)">${esc(info.awg||'')}</span></div>`;});
        h+=`</div>`;});
      h+=`</div>`;
    }
    if(r.bom.length) {
      h+=`<div class="az-section">BOM (${r.bom.length} items)</div><table class="dt"><thead><tr><th>#</th><th>P/N</th><th>DESCRIPTION</th><th>QTY</th><th>UNIT</th><th>CAT</th></tr></thead><tbody>`;
      r.bom.forEach(it=>{ h+=`<tr><td style="font-weight:bold;color:var(--c4)">${it.item}</td><td class="pn">${esc(it.pn||'—')}</td><td style="max-width:220px">${esc(it.desc||'—')}</td><td class="num">${it.qty}</td><td style="color:var(--t3)">${esc(it.unit||'PC')}</td><td><span class="tag" style="font-size:6px;border:1px solid var(--b2)">${esc(it.category||'—')}</span></td></tr>`; });
      h+=`</tbody></table>`;
    }
    if(r.notes?.length) { h+=`<div class="az-section">NOTES</div>`; r.notes.slice(0,10).forEach((n,i)=>{ h+=`<div style="font-size:7.5px;color:var(--t2);margin-bottom:2px">${i+1}. ${esc(n)}</div>`; }); }
    if(r.warnings?.length||r.missing?.length) {
      h+=`<div class="az-section" style="color:var(--c5)">WARNINGS</div>`;
      [...(r.missing||[]).map(x=>'MISSING: '+x),...(r.warnings||[])].forEach(w=>{ h+=`<div style="font-size:7.5px;color:var(--c4);margin-bottom:2px">⚠ ${esc(w)}</div>`; });
    }
    h+=`<div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--b1);margin-top:8px">
      <button class="btn btn-ok"  onclick="Engine.loadToCanvas()">▶ LOAD TO CANVAS</button>
      <button class="btn btn-info" onclick="MapModal.open()">⊞ MAP VIEW</button>
      <button class="btn btn-acc"  onclick="Excel.export()">↓ EXPORT EXCEL</button>
    </div>`;
    el.innerHTML=h;
  }

  /* ═══ PUBLIC API ═══════════════════════════════════════════ */
  return {
    init() {
      window._AZ={last:null};
      window._AZ_FILE={dataURL:null,fileName:'',type:''};
    },

    storeFile(file) {
      window._AZ_FILE.fileName=file.name;
      window._AZ_FILE.type=/\.pdf$/i.test(file.name)?'pdf':'image';
      const st=document.getElementById('az-status');

      if(window._AZ_FILE.type==='pdf') {
        if(st){st.textContent='Reading PDF…';st.style.color='var(--c4)';}
        const reader=new FileReader();
        reader.onload=ev=>{
          initPDFjs()
            .then(()=>extractAllPages(ev.target.result))
            .then(({text,pageCount})=>{
              window._AZ_FILE.pageCount=pageCount;
              const ta=document.getElementById('az-txt'); if(ta) ta.value=text.slice(0,40000);
              if(st){st.textContent=`PDF: ${pageCount}p extracted`;st.style.color='var(--c3)';}
              setTimeout(()=>this.run(),200);
            })
            .catch(e=>{
              if(st){st.textContent='PDF.js error';st.style.color='var(--c5)';}
              toast('PDF error: '+e.message+' — paste text manually',true);
              console.error('PDF.js error:',e);
            });
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader=new FileReader();
        reader.onload=ev=>{
          window._AZ_FILE.dataURL=ev.target.result;
          const pr=document.getElementById('az-preview'); if(pr) pr.innerHTML=`<img src="${ev.target.result}" style="max-height:100px;max-width:100%;border:1px solid var(--b2)">`;
          if(st){st.textContent='Image loaded';st.style.color='var(--c3)';}
        };
        reader.readAsDataURL(file);
      }
    },

    run() {
      const text=(document.getElementById('az-txt')||{}).value||'';
      if(!text.trim()) { toast('Upload PDF or paste text first',true); return; }
      const prog=document.getElementById('az-progress'), btn=document.getElementById('btn-analyze');
      if(prog) prog.textContent='Analyzing…';
      if(btn){btn.textContent='⏳';btn.disabled=true;}
      setTimeout(()=>{
        try {
          const source=window._AZ_FILE.fileName||'TEXT INPUT';
          const result=analyzeText(text, source);
          if(prog) prog.textContent=`✓ ${result.confidence.overall}% confidence`;
          const tab=document.querySelector('[data-tab="analyze"]');
          if(tab) tab.textContent=`⊞ ANALYZE ${result.confidence.overall}%`;
          renderResults(result);
        } catch(e) {
          if(prog) prog.textContent='Error';
          toast('Analysis error: '+e.message,true);
          console.error(e);
        }
        if(btn){btn.textContent='⚡ ANALYZE';btn.disabled=false;}
      },20);
    },

    clear() {
      window._AZ={last:null};
      window._AZ_FILE={dataURL:null,fileName:'',type:''};
      ['az-txt','az-preview','az-progress'].forEach(id=>{const el=document.getElementById(id);if(el){if(id==='az-txt')el.value='';else el.innerHTML='';}});
      const res=document.getElementById('az-results');
      if(res) res.innerHTML='<div style="color:var(--t3);font-size:8px;text-align:center;padding:24px">Upload PDF or paste text → ANALYZE</div>';
      const st=document.getElementById('az-status'); if(st){st.textContent='READY';st.style.color='';}
      const tab=document.querySelector('[data-tab="analyze"]'); if(tab) tab.textContent='⊞ ANALYZE';
      toast('Cleared');
    },

    loadToCanvas() {
      const r=window._AZ.last; if(!r){toast('Analyze first',true);return;}
      if(!r.wires.length&&!r.connectors.length){toast('No wires or connectors found',true);return;}
      if(!confirm('Load connectors and wires into Canvas?')) return;
      Store.pushUndo();
      const S=Store.get();
      const elements=r.connectors.map((name,i)=>{
        const lm=Object.values(CL.all).find(c=>c.short===name||c.id===name);
        return{id:uid(),kind:'connector',connId:lm?lm.id:'MF4P',label:name,x:80+i*280,y:120,side:i===0?'left':'right',notes:''};
      });
      const wires=r.wires.map((w,i)=>{
        const fe=elements.find(e=>e.label===w.fromConn)||elements[0];
        const te=elements.find(e=>e.label===w.toConn)||elements[elements.length-1];
        const p1=CV.pinPos(fe,w.fromPin)||{x:140,y:130+i*18};
        const p2=CV.pinPos(te,w.toPin)||{x:360,y:130+i*18};
        return{id:uid(),fromEl:fe?.id,fromPin:w.fromPin,toEl:te?.id,toPin:w.toPin,
          signal:w.signal||'',gauge:w.awg||'22AWG',
          color:w.hex||CHEX[w.color]||'#888888',
          cutLength:r.cableLength||S.meta.cableLength||500,
          active:true,routePts:CV.ortho(p1,p2)};
      });
      Store.set({elements,wires}); Store.save(); CV.fit();
      Tabs.show('canvas',document.querySelector('[data-tab="canvas"]'));
      toast(`Loaded ${elements.length} connectors + ${wires.length} wires`);
    }
  };
})();
