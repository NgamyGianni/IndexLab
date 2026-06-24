// ── Editorial design system ───────────────────────────────────────────────────
// Token KEYS are kept identical to the original theme so every existing inline
// style across App.jsx re-skins for free. Only the VALUES change (paper/ink/
// hairline editorial palette) plus a few additions: accent, accentSoft, serif,
// scrim.  Green #22c55e / red #ef4444 stay reserved for financial P&L only —
// the accent is UI chrome.

export const ACCENT      = "#1f3aff";          // ink-cobalt, chrome only
export const ACCENT_SOFT = "rgba(31,58,255,.08)";
export const SERIF       = "'Fraunces',Georgia,'Times New Roman',serif";
export const SANS        = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";

// Type scale (px) — Fraunces lives on the top end, Inter below.
export const TYPE = { xs:9, sm:11, base:13, md:15, lg:19, xl:28, xxl:48, hero:72 };

export function getTheme(dark){
  return dark ? {
    // Editorial Dark
    bg:"#0b0b0d", bg1:"#121214", bg2:"#161618",
    b1:"#222225", b2:"#33333a", b3:"#4a4a52",
    t1:"#f5f3ec", t2:"#bbb8af", t3:"#86837b", t4:"#615f59", t5:"#454340", t6:"#2c2b29",
    b1_20:"#22222520", b2_20:"#33333a20", b2_44:"#33333a44",
    accent:ACCENT, accentSoft:"rgba(110,130,255,.14)", serif:SERIF, sans:SANS,
    scrim:"rgba(4,4,6,.72)", glow:"rgba(110,130,255,.16)",
  } : {
    // Editorial Light (primary)
    bg:"#fbfbf9", bg1:"#f3f1ea", bg2:"#ffffff",
    b1:"#eae6db", b2:"#ddd8cc", b3:"#b6b0a2",
    t1:"#16150f", t2:"#3b3833", t3:"#6b6862", t4:"#8d897f", t5:"#b6b1a6", t6:"#dcd7cb",
    b1_20:"#eae6db40", b2_20:"#ddd8cc40", b2_44:"#ddd8cc88",
    accent:ACCENT, accentSoft:ACCENT_SOFT, serif:SERIF, sans:SANS,
    scrim:"rgba(22,21,15,.42)", glow:"rgba(31,58,255,.10)",
  };
}

// Full editorial stylesheet. Superset of the original — every class name is
// preserved so the JSX keeps working; values are re-tuned to the editorial
// language (hairlines, whitespace, serif display, accent focus, reduced-motion).
export function buildCss(T){
  return `
    *{box-sizing:border-box;margin:0;padding:0;font-family:${T.sans};}
    ::selection{background:${T.accentSoft};color:${T.t1};}
    ::-webkit-scrollbar{width:6px;height:6px;} ::-webkit-scrollbar-thumb{background:${T.b2};border-radius:3px;}
    ::-webkit-scrollbar-thumb:hover{background:${T.b3};}
    body{background:${T.bg};color:${T.t1};-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}

    /* ── Editorial type utilities ── */
    .serif{font-family:${T.serif};font-optical-sizing:auto;}
    .display{font-family:${T.serif};font-weight:340;letter-spacing:-.018em;line-height:.98;}
    .eyebrow{font-size:9px;letter-spacing:3.5px;text-transform:uppercase;color:${T.t4};font-weight:500;}
    a,.u-link{color:${T.accent};text-decoration:none;}

    /* ── Focus (accessibility) ── */
    :focus-visible{outline:2px solid ${T.accent};outline-offset:2px;border-radius:3px;}

    .chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;border:1px solid ${T.b2};background:transparent;color:${T.t3};cursor:pointer;font-size:11px;transition:border-color .18s,color .18s,background .18s;white-space:nowrap;}
    .chip:hover{border-color:${T.t1};color:${T.t1};background:${T.bg1};}
    .chip.used{opacity:.25;pointer-events:none;}
    .pill{padding:5px 13px;border-radius:999px;border:1px solid ${T.b2};background:transparent;color:${T.t4};cursor:pointer;font-size:12px;font-weight:500;transition:all .18s;}
    .pill.active{background:${T.t1};color:${T.bg};border-color:${T.t1};font-weight:600;}
    .pill:hover:not(.active){border-color:${T.t2};color:${T.t2};}
    .w-in{width:62px;background:${T.bg};border:1px solid ${T.b2};color:${T.t1};border-radius:6px;padding:4px 7px;font-size:12px;text-align:right;outline:none;transition:border-color .18s;font-variant-numeric:tabular-nums;}
    .w-in:focus{border-color:${T.accent};}
    .run{position:relative;width:100%;padding:14px;border:none;border-radius:8px;background:${T.t1};color:${T.bg};font-weight:600;font-size:14px;cursor:pointer;transition:transform .25s cubic-bezier(.2,.7,.2,1),box-shadow .25s,opacity .15s;letter-spacing:-.1px;overflow:hidden;}
    .run:hover{transform:translateY(-1px);box-shadow:0 10px 26px ${T.glow};}
    .run:active{transform:translateY(0);}
    .run:disabled{opacity:.22;cursor:not-allowed;transform:none;box-shadow:none;}
    .card{background:transparent;border:none;border-radius:0;padding:0 0 16px;}
    .arow{background:${T.bg2};border:1px solid ${T.b1};border-radius:10px;padding:9px 11px;display:flex;align-items:center;gap:8px;margin-bottom:6px;transition:border-color .18s,transform .18s,box-shadow .18s;}
    .arow:hover{border-color:${T.b3};transform:translateX(2px);}
    .tag{font-size:9px;padding:2px 7px;border-radius:999px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;}
    .mode-btn{flex:1;padding:9px 4px;border-radius:8px;border:1px solid ${T.b1};background:transparent;color:${T.t4};cursor:pointer;font-size:10px;transition:all .18s;text-align:center;line-height:1.5;}
    .mode-btn.active{border-color:${T.t1};background:${T.t1};color:${T.bg};}
    .mode-btn:hover:not(.active){border-color:${T.b3};color:${T.t2};}
    .tab-btn{position:relative;padding:10px 16px;border:none;background:transparent;color:${T.t4};cursor:pointer;font-size:12px;font-weight:500;transition:color .2s;white-space:nowrap;}
    .tab-btn::after{content:"";position:absolute;left:16px;right:16px;bottom:0;height:2px;background:${T.accent};transform:scaleX(0);transform-origin:left;transition:transform .28s cubic-bezier(.2,.7,.2,1);}
    .tab-btn.active{color:${T.t1};font-weight:600;}
    .tab-btn.active::after{transform:scaleX(1);}
    .tab-btn:hover:not(.active){color:${T.t2};}
    .save-btn{padding:7px 15px;border-radius:999px;border:1px solid ${T.b2};background:transparent;color:${T.t2};cursor:pointer;font-size:11px;font-weight:500;transition:all .18s;white-space:nowrap;}
    .save-btn:hover{border-color:${T.t1};color:${T.t1};transform:translateY(-1px);}
    .save-btn:disabled{opacity:.3;cursor:not-allowed;transform:none;}
    .del-btn{background:none;border:none;color:${T.b3};cursor:pointer;font-size:14px;padding:0 4px;transition:color .15s,transform .15s;}
    .del-btn:hover{color:#ef4444;transform:scale(1.15);}

    .modal-bg{position:fixed;inset:0;background:${T.scrim};backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;animation:modalIn .22s ease;}
    .modal{background:${T.bg2};border:1px solid ${T.b2};border-radius:14px;padding:26px;width:100%;max-width:380px;box-shadow:0 30px 80px ${T.scrim};animation:cardUp .3s cubic-bezier(.2,.7,.2,1);}
    .drawer-overlay{position:fixed;inset:0;background:${T.scrim};backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:40;animation:modalIn .2s ease;}
    .drawer{position:fixed;bottom:0;left:0;right:0;background:${T.bg2};border-top:1px solid ${T.b2};border-radius:20px 20px 0 0;z-index:50;max-height:85vh;overflow-y:auto;padding:18px;animation:drawerUp .32s cubic-bezier(.2,.7,.2,1);}
    .notif{position:fixed;top:18px;right:18px;z-index:100;padding:11px 18px;border-radius:10px;font-family:${T.sans};font-size:11px;box-shadow:0 12px 32px ${T.scrim};animation:notifIn .26s cubic-bezier(.2,.7,.2,1);}

    @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes modalIn{from{opacity:0}to{opacity:1}}
    @keyframes cardUp{from{opacity:0;transform:translateY(14px) scale(.99)}to{opacity:1;transform:none}}
    @keyframes drawerUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes notifIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}

    .metric-section{margin-bottom:0;}
    .metric-group-title{font-size:8px;color:${T.t5};letter-spacing:3.5px;text-transform:uppercase;padding:10px 0 6px;border-bottom:1px solid ${T.b1};margin-bottom:6px;font-weight:600;}
    input[type=number]::-webkit-inner-spin-button{opacity:.4;}

    @media(max-width:480px){
      .card{padding:9px 11px;}
      .pill{padding:3px 9px;font-size:10px;}
      .tab-btn{padding:8px 10px;font-size:10px;}
    }
    @media(max-width:420px){
      .tab-btn{padding:8px 7px;font-size:9px;}
    }

    /* ── Sidebar (desktop) ── */
    .sidebar{position:fixed;top:0;left:0;width:200px;height:100vh;background:${T.bg2};border-right:1px solid ${T.b1};display:flex;flex-direction:column;z-index:20;overflow:hidden;}
    .sidebar-logo{padding:24px 20px 20px;border-bottom:1px solid ${T.b1};flex-shrink:0;}
    .sidebar-nav{flex:1;padding:14px 0;overflow-y:auto;}
    .nav-item{position:relative;display:flex;align-items:center;gap:11px;padding:13px 20px;cursor:pointer;font-family:${T.sans};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${T.t5};transition:color .2s,background .2s;border:none;background:none;width:100%;text-align:left;}
    .nav-item::before{content:"";position:absolute;left:0;top:50%;height:0;width:2px;background:${T.t1};transform:translateY(-50%);transition:height .26s cubic-bezier(.2,.7,.2,1);}
    .nav-item:hover{color:${T.t2};background:${T.bg1};}
    .nav-item.active{color:${T.t1};background:${T.bg1};font-weight:600;}
    .nav-item.active::before{height:60%;}
    .sidebar-bottom{padding:8px 0 10px;border-top:1px solid ${T.b1};flex-shrink:0;}
    .sidebar-btn{display:flex;align-items:center;gap:9px;padding:10px 20px;cursor:pointer;font-family:${T.sans};font-size:9px;letter-spacing:.6px;color:${T.t5};background:none;border:none;width:100%;text-align:left;transition:color .15s;white-space:nowrap;}
    .sidebar-btn:hover{color:${T.t2};}

    /* ── Mobile header ── */
    .mobile-header{position:sticky;top:0;z-index:20;background:${T.bg2};border-bottom:1px solid ${T.b1};padding:11px 15px;display:flex;align-items:center;gap:8px;flex-shrink:0;}

    /* ── Bottom nav (mobile) ── */
    .bottom-nav{position:fixed;bottom:0;left:0;right:0;background:${T.bg2};border-top:1px solid ${T.b1};display:flex;z-index:20;padding-bottom:env(safe-area-inset-bottom,0px);}
    .bottom-nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:11px 4px 9px;cursor:pointer;font-size:8px;letter-spacing:.6px;text-transform:uppercase;color:${T.t5};background:none;border:none;transition:color .18s;}
    .bottom-nav-item.active{color:${T.t1};}

    /* ── Compact (Bloomberg) mode ── */
    .compact .card{padding:0 0 16px;}
    .compact .arow{padding:6px 9px;margin-bottom:4px;}
    .compact .chip{padding:2px 8px;font-size:9px;}
    .compact .pill{padding:2px 9px;font-size:10px;}
    .compact .metric-group-title{padding:5px 0 3px;font-size:7px;}
    .compact .kpi-value{font-size:24px !important;}
    .compact .kpi-secondary{font-size:13px !important;}

    /* ── KPI numbers (editorial serif display) ── */
    .kpi-hero{font-family:${T.serif};font-size:40px;font-weight:360;letter-spacing:-.02em;line-height:.96;font-variant-numeric:tabular-nums;}
    .kpi-sub{font-size:11px;color:${T.t4};font-weight:400;letter-spacing:.4px;text-transform:uppercase;margin-top:5px;}
    .kpi-grid{display:flex;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid ${T.b1};}
    .kpi-cell{flex:1;padding:0 22px;border-right:1px solid ${T.b1};}
    .kpi-cell:first-child{padding-left:0;}
    .kpi-cell:last-child{border-right:none;}
    .kpi-val{font-family:${T.serif};font-size:27px;font-weight:380;letter-spacing:-.015em;font-variant-numeric:tabular-nums;line-height:1;}
    .kpi-lbl{font-size:10px;color:${T.t4};font-weight:400;letter-spacing:.5px;text-transform:uppercase;margin-bottom:7px;}
    @media(max-width:900px){.kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0;padding-bottom:0;border-bottom:none;border:1px solid ${T.b1};border-radius:10px;overflow:hidden;} .kpi-cell{padding:15px 17px;border-right:1px solid ${T.b1};border-bottom:1px solid ${T.b1};} .kpi-cell:nth-child(2){border-right:none;} .kpi-cell:nth-child(3){border-bottom:none;} .kpi-cell:last-child{border-right:none;border-bottom:none;}}

    /* ── Motion primitives (GSAP sets/clears these) ── */
    .reveal-init{opacity:0;transform:translateY(18px);}
    .magnetic{will-change:transform;}

    /* ── Reduced motion: honour the user's OS preference ── */
    @media(prefers-reduced-motion:reduce){
      *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important;scroll-behavior:auto !important;}
      .reveal-init{opacity:1 !important;transform:none !important;}
    }
  `;
}
