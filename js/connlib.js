'use strict';
const CL=(()=>{
  const mkp=(id,n,sig,g,c)=>({id,n,sig,g,c});
  const pwrp=n=>Array.from({length:n},(_,i)=>mkp(i+1,'P'+(i+1),'DATA','22AWG','#888888'));
  const BUILTIN={
    DB9M:{id:'DB9M',name:'D-SUB 9 Male',short:'DB9M',pn:'',cat:'Serial',type:'RECT',builtin:true,
      pinout:[mkp(1,'DCD','DATA','22AWG','#888'),mkp(2,'RXD','DATA','22AWG','#3498db'),
        mkp(3,'TXD','DATA','22AWG','#e67e22'),mkp(4,'DTR','DATA','22AWG','#6ab0e8'),
        mkp(5,'GND','GND','22AWG','#222'),mkp(6,'DSR','DATA','22AWG','#888'),
        mkp(7,'RTS','DATA','22AWG','#888'),mkp(8,'CTS','DATA','22AWG','#888'),mkp(9,'RI','DATA','22AWG','#888')]},
    DB9F:{id:'DB9F',name:'D-SUB 9 Female',short:'DB9F',pn:'',cat:'Serial',type:'RECT',builtin:true,pinout:pwrp(9)},
    DB25M:{id:'DB25M',name:'D-SUB 25 Male',short:'DB25M',pn:'',cat:'Serial',type:'RECT',builtin:true,pinout:pwrp(25)},
    DB25F:{id:'DB25F',name:'D-SUB 25 Female',short:'DB25F',pn:'',cat:'Serial',type:'RECT',builtin:true,pinout:pwrp(25)},
    RJ45:{id:'RJ45',name:'RJ45 8P8C',short:'RJ45',pn:'',cat:'Network',type:'RECT',builtin:true,
      pinout:[mkp(1,'TX+','DATA','24AWG','#e8a840'),mkp(2,'TX-','DATA','24AWG','#888'),
        mkp(3,'RX+','DATA','24AWG','#68c880'),mkp(4,'BI3+','DATA','24AWG','#6ab0e8'),
        mkp(5,'BI3-','DATA','24AWG','#6ab0e8'),mkp(6,'RX-','DATA','24AWG','#68c880'),
        mkp(7,'BI4+','DATA','24AWG','#a0522d'),mkp(8,'BI4-','DATA','24AWG','#a0522d')]},
    USBA:{id:'USBA',name:'USB Type-A',short:'USB-A',pn:'',cat:'USB',type:'RECT',builtin:true,
      pinout:[mkp(1,'VCC','PWR','22AWG','#cc0000'),mkp(2,'D-','DATA','28AWG','#e8e8e8'),mkp(3,'D+','DATA','28AWG','#68c880'),mkp(4,'GND','GND','22AWG','#222')]},
    USBC:{id:'USBC',name:'USB Type-C',short:'USB-C',pn:'',cat:'USB',type:'RECT',builtin:true,pinout:pwrp(12)},
    XLR3M:{id:'XLR3M',name:'XLR 3P Male',short:'XLR3M',pn:'NC3MXX',cat:'Audio',type:'CIRC',builtin:true,
      pinout:[mkp(1,'GND','GND','22AWG','#222'),mkp(2,'HOT','SIG','22AWG','#cc0000'),mkp(3,'COLD','SIG','22AWG','#888')]},
    XLR3F:{id:'XLR3F',name:'XLR 3P Female',short:'XLR3F',pn:'NC3FXX',cat:'Audio',type:'CIRC',builtin:true,
      pinout:[mkp(1,'GND','GND','22AWG','#222'),mkp(2,'HOT','SIG','22AWG','#cc0000'),mkp(3,'COLD','SIG','22AWG','#888')]},
    MF2P:{id:'MF2P',name:'Micro-Fit 2P',short:'MF2P',pn:'43025-0200',cat:'Molex',type:'RECT',builtin:true,
      pinout:[mkp(1,'VCC','PWR','22AWG','#cc0000'),mkp(2,'GND','GND','22AWG','#222')]},
    MF4P:{id:'MF4P',name:'Micro-Fit 4P',short:'MF4P',pn:'43025-0400',cat:'Molex',type:'RECT',builtin:true,
      pinout:[mkp(1,'VCC','PWR','22AWG','#cc0000'),mkp(2,'GND','GND','22AWG','#222'),mkp(3,'SIG1','DATA','24AWG','#6ab0e8'),mkp(4,'SIG2','DATA','24AWG','#68c880')]},
    MF6P:{id:'MF6P',name:'Micro-Fit 6P',short:'MF6P',pn:'43025-0600',cat:'Molex',type:'RECT',builtin:true,pinout:pwrp(6)},
    MF8P:{id:'MF8P',name:'Micro-Fit 8P',short:'MF8P',pn:'43025-0800',cat:'Molex',type:'RECT',builtin:true,pinout:pwrp(8)},
    MF12P:{id:'MF12P',name:'Micro-Fit 12P',short:'MF12P',pn:'43025-1200',cat:'Molex',type:'RECT',builtin:true,pinout:pwrp(12)},
    PH2P:{id:'PH2P',name:'JST PH 2P',short:'PH2P',pn:'B2B-PH-K',cat:'JST',type:'RECT',builtin:true,pinout:[mkp(1,'+','PWR','24AWG','#cc0000'),mkp(2,'-','GND','24AWG','#222')]},
    PH3P:{id:'PH3P',name:'JST PH 3P',short:'PH3P',pn:'B3B-PH-K',cat:'JST',type:'RECT',builtin:true,pinout:pwrp(3)},
    XH2P:{id:'XH2P',name:'JST XH 2P',short:'XH2P',pn:'B2B-XH-A',cat:'JST',type:'RECT',builtin:true,pinout:[mkp(1,'+','PWR','22AWG','#cc0000'),mkp(2,'-','GND','22AWG','#222')]},
    XH4P:{id:'XH4P',name:'JST XH 4P',short:'XH4P',pn:'B4B-XH-A',cat:'JST',type:'RECT',builtin:true,pinout:pwrp(4)},
    DT2P:{id:'DT2P',name:'Deutsch DT 2P',short:'DT2P',pn:'DT06-2S',cat:'Deutsch',type:'RECT',builtin:true,pinout:[mkp(1,'A','PWR','20AWG','#cc0000'),mkp(2,'B','GND','20AWG','#222')]},
    DT4P:{id:'DT4P',name:'Deutsch DT 4P',short:'DT4P',pn:'DT06-4S',cat:'Deutsch',type:'RECT',builtin:true,pinout:pwrp(4)},
    DT6P:{id:'DT6P',name:'Deutsch DT 6P',short:'DT6P',pn:'DT06-6S',cat:'Deutsch',type:'RECT',builtin:true,pinout:pwrp(6)},
    DTM4S:{id:'DTM4S',name:'DTM 4P Socket',short:'DTM4S',pn:'DTM06-4S',cat:'Amphenol',type:'RECT',builtin:true,pinout:pwrp(4)},
    DTM4P:{id:'DTM4P',name:'DTM 4P Pin',short:'DTM4P',pn:'DTM04-4P',cat:'Amphenol',type:'RECT',builtin:true,pinout:pwrp(4)},
    MS13P:{id:'MS13P',name:'MIL-SPEC 13P',short:'MS13P',pn:'D38999/26WB35PN',cat:'MIL',type:'CIRC',builtin:true,pinout:pwrp(13)},
  };
  return{
    get all(){const m={...BUILTIN};Store.get().customConns.forEach(c=>{m[c.id]=c;});return m;},
    byId:id=>CL.all[id]||null,
    addCustom(c){Store.pushUndo();const cc=[...Store.get().customConns];const i=cc.findIndex(x=>x.id===c.id);if(i>=0)cc[i]=c;else cc.push(c);Store.set({customConns:cc});},
    removeCustom(id){Store.pushUndo();Store.set({customConns:Store.get().customConns.filter(c=>c.id!==id)});}
  };
})();
