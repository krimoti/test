'use strict';
/* ═══ M2 — UTILS ════════════════════════════════════════════ */
const uid   = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const esc   = s  => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const hex6  = c  => { if(!c||c[0]!=='#') return '#888888'; if(c.length===4) return '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; return c.length===7?c:'#888888'; };

const COLOR_HEX = {
  BLACK:'#333333', RED:'#e74c3c', WHITE:'#e8e0c8', BLUE:'#3498db',
  GREEN:'#27ae60', YELLOW:'#f1c40f', ORANGE:'#e67e22', VIOLET:'#9b59b6',
  GREY:'#888888', BROWN:'#a0522d'
};

const IEC = {
  '#333333':'BK','#000000':'BK','#e74c3c':'RD','#cc0000':'RD',
  '#e8e0c8':'WH','#ffffff':'WH','#3498db':'BU','#0000cc':'BU',
  '#27ae60':'GN','#008000':'GN','#f1c40f':'YE','#e67e22':'OG',
  '#9b59b6':'VT','#888888':'GY','#a0522d':'BN'
};
function iecAbbr(hex) {
  if(!hex) return '';
  const h = hex.toLowerCase();
  if(IEC[h]) return IEC[h];
  let best='', bestD=Infinity;
  try {
    const r1=parseInt(h.slice(1,3),16), g1=parseInt(h.slice(3,5),16), b1=parseInt(h.slice(5,7),16);
    for(const [ch,ab] of Object.entries(IEC)) {
      const d = Math.abs(r1-parseInt(ch.slice(1,3),16))
               +Math.abs(g1-parseInt(ch.slice(3,5),16))
               +Math.abs(b1-parseInt(ch.slice(5,7),16));
      if(d < bestD) { bestD=d; best=ab; }
    }
  } catch(_) {}
  return best;
}

function toast(msg, err) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = '', 2400);
}
