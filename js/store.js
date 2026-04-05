'use strict';
/* ═══ M1 — STORE ═══════════════════════════════════════════ */
const Store = (() => {
  const DEF = () => ({
    meta: { title:"CABLE ASS'Y", dwgNo:'DWG-001', pn:'PN-00001',
      rev:'A', company:'', drawn:'', cableLength:500, lengthTol:20 },
    elements:[], wires:[], bomItems:[], customConns:[],
    view:{zoom:1, panX:60, panY:60}, nextLabel:1, _undo:[], _redo:[]
  });
  let S = DEF();
  const subs = [];
  const notify = () => subs.forEach(f => f(S));
  return {
    get: () => S,
    sub: fn => subs.push(fn),
    set(p) { Object.assign(S, p); notify(); },
    setMeta(p) { S.meta = {...S.meta, ...p}; notify(); },
    snap() {
      const {meta,elements,wires,bomItems,customConns,nextLabel} = S;
      return JSON.parse(JSON.stringify({meta,elements,wires,bomItems,customConns,nextLabel}));
    },
    restore(d) { Object.assign(S, d); notify(); },
    pushUndo() { S._undo.push(this.snap()); if(S._undo.length>80) S._undo.shift(); S._redo=[]; },
    undo() { if(!S._undo.length) return; S._redo.push(this.snap()); this.restore(S._undo.pop()); },
    redo() { if(!S._redo.length) return; S._undo.push(this.snap()); this.restore(S._redo.pop()); },
    save() { try { localStorage.setItem('hp23', JSON.stringify(this.snap())); } catch(_) {} },
    load() { try { const d=JSON.parse(localStorage.getItem('hp23')||'null'); if(d) this.restore(d); } catch(_) {} },
    reset() { S = DEF(); notify(); }
  };
})();
