import { useState, useMemo, useEffect, useCallback } from "react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, Line, ComposedChart, LineChart, Legend } from "recharts";
import { I18N } from "./i18n.js";

let _priceData = null; // module-level cache for real price data

// ── Asset universe ────────────────────────────────────────────────────────────
const ASSET_PARAMS = {
  // ── Tech
  "AAPL":    { mu:0.28, sigma:0.22, name:"Apple",          type:"action", sector:"Tech",          themes:["tech","ia"],               cap:3200 },
  "MSFT":    { mu:0.24, sigma:0.19, name:"Microsoft",      type:"action", sector:"Tech",          themes:["tech","ia","cloud"],        cap:3100 },
  "NVDA":    { mu:0.80, sigma:0.55, name:"Nvidia",         type:"action", sector:"Tech",          themes:["tech","ia","semi"],         cap:2200 },
  "GOOGL":   { mu:0.20, sigma:0.21, name:"Alphabet",       type:"action", sector:"Tech",          themes:["tech","ia","cloud"],        cap:2100 },
  "META":    { mu:0.35, sigma:0.38, name:"Meta",           type:"action", sector:"Tech",          themes:["tech","ia","media"],        cap:1400 },
  "AMZN":    { mu:0.22, sigma:0.28, name:"Amazon",         type:"action", sector:"Tech",          themes:["tech","cloud","conso"],     cap:2000 },
  "ORCL":    { mu:0.18, sigma:0.20, name:"Oracle",         type:"action", sector:"Tech",          themes:["tech","cloud"],             cap:420  },
  "CRM":     { mu:0.20, sigma:0.28, name:"Salesforce",     type:"action", sector:"Tech",          themes:["tech","cloud"],             cap:290  },
  "AMD":     { mu:0.55, sigma:0.55, name:"AMD",            type:"action", sector:"Tech",          themes:["tech","ia","semi"],         cap:240  },
  "INTC":    { mu:0.04, sigma:0.28, name:"Intel",          type:"action", sector:"Tech",          themes:["tech","semi"],              cap:95   },
  // ── Finance
  "JPM":     { mu:0.16, sigma:0.20, name:"JPMorgan",       type:"action", sector:"Finance",       themes:["finance","banque"],         cap:680  },
  "GS":      { mu:0.18, sigma:0.22, name:"Goldman Sachs",  type:"action", sector:"Finance",       themes:["finance","banque"],         cap:180  },
  "BRK-B":   { mu:0.13, sigma:0.14, name:"Berkshire B",    type:"action", sector:"Finance",       themes:["finance","value"],          cap:1000 },
  "V":       { mu:0.18, sigma:0.16, name:"Visa",           type:"action", sector:"Finance",       themes:["finance","paiement"],       cap:580  },
  "MA":      { mu:0.19, sigma:0.17, name:"Mastercard",     type:"action", sector:"Finance",       themes:["finance","paiement"],       cap:490  },
  "PYPL":    { mu:0.08, sigma:0.38, name:"PayPal",         type:"action", sector:"Finance",       themes:["finance","paiement"],       cap:65   },
  // ── Santé
  "JNJ":     { mu:0.08, sigma:0.12, name:"Johnson & J.",   type:"action", sector:"Santé",         themes:["sante","pharma"],           cap:380  },
  "PFE":     { mu:0.06, sigma:0.18, name:"Pfizer",         type:"action", sector:"Santé",         themes:["sante","pharma"],           cap:140  },
  "UNH":     { mu:0.18, sigma:0.16, name:"UnitedHealth",   type:"action", sector:"Santé",         themes:["sante","assurance"],        cap:450  },
  "LLY":     { mu:0.35, sigma:0.28, name:"Eli Lilly",      type:"action", sector:"Santé",         themes:["sante","pharma","biotech"], cap:750  },
  "MRNA":    { mu:0.15, sigma:0.65, name:"Moderna",        type:"action", sector:"Santé",         themes:["sante","biotech"],          cap:45   },
  "ISRG":    { mu:0.20, sigma:0.22, name:"Intuitive Surg.",type:"action", sector:"Santé",         themes:["sante","medtech"],          cap:190  },
  // ── Énergie
  "XOM":     { mu:0.10, sigma:0.20, name:"ExxonMobil",     type:"action", sector:"Énergie",       themes:["energie","petrole"],        cap:490  },
  "CVX":     { mu:0.09, sigma:0.19, name:"Chevron",        type:"action", sector:"Énergie",       themes:["energie","petrole"],        cap:270  },
  "ENPH":    { mu:0.25, sigma:0.60, name:"Enphase Energy", type:"action", sector:"Énergie",       themes:["energie","solaire"],        cap:15   },
  "NEE":     { mu:0.10, sigma:0.16, name:"NextEra Energy", type:"action", sector:"Énergie",       themes:["energie","solaire"],        cap:130  },
  // ── Consommation
  "TSLA":    { mu:0.45, sigma:0.65, name:"Tesla",          type:"action", sector:"Conso.",        themes:["conso","ve","ia"],          cap:800  },
  "NKE":     { mu:0.10, sigma:0.20, name:"Nike",           type:"action", sector:"Conso.",        themes:["conso","luxe"],             cap:90   },
  "MC.PA":   { mu:0.14, sigma:0.20, name:"LVMH",           type:"action", sector:"Conso.",        themes:["conso","luxe","europe"],    cap:320  },
  // ── Industrie
  "BA":      { mu:0.08, sigma:0.30, name:"Boeing",         type:"action", sector:"Industrie",     themes:["industrie","defense"],      cap:110  },
  "CAT":     { mu:0.14, sigma:0.20, name:"Caterpillar",    type:"action", sector:"Industrie",     themes:["industrie"],                cap:190  },
  "LMT":     { mu:0.10, sigma:0.14, name:"Lockheed Martin",type:"action", sector:"Industrie",     themes:["industrie","defense"],      cap:120  },
  // ── Crypto
  "BTC-USD": { mu:0.60, sigma:0.80, name:"Bitcoin",        type:"crypto", sector:"Crypto",        themes:["crypto","store"],           cap:1900 },
  "ETH-USD": { mu:0.50, sigma:0.90, name:"Ethereum",       type:"crypto", sector:"Crypto",        themes:["crypto","defi"],            cap:390  },
  "SOL-USD": { mu:0.90, sigma:1.20, name:"Solana",         type:"crypto", sector:"Crypto",        themes:["crypto","defi"],            cap:85   },
  "BNB-USD": { mu:0.40, sigma:0.85, name:"BNB",            type:"crypto", sector:"Crypto",        themes:["crypto","defi"],            cap:90   },
  "XRP-USD": { mu:0.30, sigma:0.90, name:"XRP",            type:"crypto", sector:"Crypto",        themes:["crypto","paiement"],        cap:130  },
  "DOGE-USD":{ mu:0.20, sigma:1.40, name:"Dogecoin",       type:"crypto", sector:"Crypto",        themes:["crypto"],                   cap:25   },
  // ── ETF
  "SPY":     { mu:0.13, sigma:0.14, name:"S&P 500 ETF",    type:"etf",    sector:"ETF",           themes:["etf","marche"],             cap:550  },
  "QQQ":     { mu:0.18, sigma:0.18, name:"Nasdaq 100 ETF", type:"etf",    sector:"ETF",           themes:["etf","tech"],               cap:260  },
  "GLD":     { mu:0.08, sigma:0.12, name:"Gold ETF",       type:"etf",    sector:"ETF",           themes:["etf","or","refuge"],        cap:75   },
  "ARKK":    { mu:0.25, sigma:0.55, name:"ARK Innovation", type:"etf",    sector:"ETF",           themes:["etf","ia","tech"],          cap:8    },
  "XLF":     { mu:0.12, sigma:0.18, name:"Finance ETF",    type:"etf",    sector:"ETF",           themes:["etf","finance"],            cap:45   },
  "XLE":     { mu:0.08, sigma:0.20, name:"Énergie ETF",    type:"etf",    sector:"ETF",           themes:["etf","energie"],            cap:30   },
  "ICLN":    { mu:0.10, sigma:0.28, name:"Clean Energy ETF",type:"etf",   sector:"ETF",           themes:["etf","energie","solaire"],  cap:2    },
  "VWO":     { mu:0.09, sigma:0.18, name:"Marchés émergents",type:"etf",  sector:"ETF",           themes:["etf","marche"],             cap:80   },
  // ── Indices
  "^GSPC":   { mu:0.13, sigma:0.14, name:"S&P 500",        type:"indice", sector:"Indices",       themes:["indice","marche"],          cap:99000},
  "^FCHI":   { mu:0.10, sigma:0.16, name:"CAC 40",         type:"indice", sector:"Indices",       themes:["indice","europe"],          cap:3000 },
  "^GDAXI":  { mu:0.11, sigma:0.17, name:"DAX",            type:"indice", sector:"Indices",       themes:["indice","europe"],          cap:2500 },
  "^N225":   { mu:0.09, sigma:0.18, name:"Nikkei 225",     type:"indice", sector:"Indices",       themes:["indice","asie"],            cap:6000 },
  "^FTSE":   { mu:0.07, sigma:0.14, name:"FTSE 100",       type:"indice", sector:"Indices",       themes:["indice","europe"],          cap:2800 },
  // ── Immobilier
  "PLD":     { mu:0.12, sigma:0.22, name:"Prologis",        type:"action", sector:"Immobilier",   themes:["immo","logistique"],        cap:95   },
  "AMT":     { mu:0.10, sigma:0.18, name:"American Tower",  type:"action", sector:"Immobilier",   themes:["immo","telecom"],           cap:85   },
  "EQIX":    { mu:0.14, sigma:0.20, name:"Equinix",         type:"action", sector:"Immobilier",   themes:["immo","cloud"],             cap:75   },
  // ── Matériaux
  "LIN":     { mu:0.12, sigma:0.16, name:"Linde",           type:"action", sector:"Matériaux",    themes:["materiaux","industrie"],    cap:200  },
  "NEM":     { mu:0.08, sigma:0.28, name:"Newmont",         type:"action", sector:"Matériaux",    themes:["materiaux","or","refuge"],  cap:50   },
  "FCX":     { mu:0.15, sigma:0.35, name:"Freeport-McMoRan",type:"action", sector:"Matériaux",    themes:["materiaux"],               cap:60   },
  // ── Utilities
  "DUK":     { mu:0.07, sigma:0.12, name:"Duke Energy",     type:"action", sector:"Utilities",    themes:["energie","nucleaire"],      cap:80   },
  "SO":      { mu:0.07, sigma:0.12, name:"Southern Company",type:"action", sector:"Utilities",    themes:["energie","nucleaire"],      cap:75   },
  "CEG":     { mu:0.50, sigma:0.40, name:"Constellation E.",type:"action", sector:"Utilities",    themes:["energie","nucleaire"],      cap:65   },
  "XYL":     { mu:0.10, sigma:0.20, name:"Xylem",           type:"action", sector:"Utilities",    themes:["eau","industrie"],          cap:20   },
  "AWK":     { mu:0.09, sigma:0.14, name:"American Water",  type:"action", sector:"Utilities",    themes:["eau","refuge"],             cap:25   },
  // ── Télécom
  "VZ":      { mu:0.03, sigma:0.14, name:"Verizon",         type:"action", sector:"Télécom",      themes:["telecom"],                  cap:160  },
  "TMUS":    { mu:0.12, sigma:0.18, name:"T-Mobile US",     type:"action", sector:"Télécom",      themes:["telecom"],                  cap:250  },
  // ── Conso. défensive
  "PG":      { mu:0.09, sigma:0.12, name:"Procter & Gamble",type:"action", sector:"Conso. déf.", themes:["conso","refuge","value"],   cap:350  },
  "KO":      { mu:0.08, sigma:0.12, name:"Coca-Cola",       type:"action", sector:"Conso. déf.", themes:["conso","refuge","value"],   cap:270  },
  // ── Cyber
  "CRWD":    { mu:0.40, sigma:0.45, name:"CrowdStrike",     type:"action", sector:"Tech",         themes:["tech","cyber","ia"],        cap:85   },
  "PANW":    { mu:0.30, sigma:0.40, name:"Palo Alto Netw.", type:"action", sector:"Tech",         themes:["tech","cyber"],             cap:120  },
  "FTNT":    { mu:0.25, sigma:0.35, name:"Fortinet",        type:"action", sector:"Tech",         themes:["tech","cyber"],             cap:55   },
  // ── Nucléaire & Uranium
  "CCJ":     { mu:0.35, sigma:0.45, name:"Cameco",          type:"action", sector:"Énergie",      themes:["energie","nucleaire"],      cap:22   },
  // ── Space & Défense
  "LHX":     { mu:0.08, sigma:0.18, name:"L3Harris Techn.", type:"action", sector:"Industrie",    themes:["industrie","defense","space"], cap:40 },
  // ── Gaming
  "TTWO":    { mu:0.10, sigma:0.35, name:"Take-Two Interac.",type:"action", sector:"Conso.",      themes:["gaming","conso","media"],   cap:25   },
  "RBLX":    { mu:0.15, sigma:0.50, name:"Roblox",          type:"action", sector:"Tech",         themes:["gaming","tech","ia"],       cap:22   },
  // ── Fintech
  "SQ":      { mu:0.25, sigma:0.55, name:"Block (Square)",  type:"action", sector:"Finance",      themes:["finance","fintech","paiement"], cap:40 },
  "COIN":    { mu:0.55, sigma:0.85, name:"Coinbase",        type:"action", sector:"Finance",      themes:["finance","fintech","crypto"],  cap:55 },
};

// ── Storage helpers ──────────────────────────────────────────────────────────
const storage = {
  get: (key) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  del: (key) => {
    try { localStorage.removeItem(key); return true; }
    catch { return false; }
  },
};
const SECTORS = [
  { id:"all",       label:"Tous",       icon:"◈" },
  { id:"Tech",      label:"Tech",       icon:"💻" },
  { id:"Finance",   label:"Finance",    icon:"🏦" },
  { id:"Santé",     label:"Santé",      icon:"🩺" },
  { id:"Énergie",   label:"Énergie",    icon:"⚡" },
  { id:"Conso.",    label:"Conso.",     icon:"🛍" },
  { id:"Industrie", label:"Industrie",  icon:"⚙️" },
  { id:"Crypto",    label:"Crypto",     icon:"₿"  },
  { id:"ETF",       label:"ETF",        icon:"📦" },
  { id:"Indices",    label:"Indices",    icon:"📊" },
  { id:"Immobilier",label:"Immobilier", icon:"🏢" },
  { id:"Matériaux", label:"Matériaux",  icon:"⛏" },
  { id:"Utilities", label:"Utilities",  icon:"💡" },
  { id:"Télécom",   label:"Télécom",    icon:"📡" },
  { id:"Conso. déf.",label:"Conso. déf.",icon:"🛒" },
];

const THEMES = [
  { id:"ia",       label:"Intelligence Artificielle", icon:"🤖", color:"#c084fc" },
  { id:"cloud",    label:"Cloud Computing",           icon:"☁️",  color:"#38bdf8" },
  { id:"semi",     label:"Semi-conducteurs",          icon:"🔲", color:"#fb923c" },
  { id:"ve",       label:"Véhicules Électriques",     icon:"🚗", color:"#4ade80" },
  { id:"solaire",  label:"Énergie Solaire",           icon:"☀️",  color:"#facc15" },
  { id:"biotech",  label:"Biotechnologie",            icon:"🧬", color:"#f472b6" },
  { id:"defense",  label:"Défense",                  icon:"🛡",  color:"#94a3b8" },
  { id:"paiement", label:"Paiement Digital",          icon:"💳", color:"#34d399" },
  { id:"luxe",     label:"Luxe & Mode",               icon:"💎", color:"#fbbf24" },
  { id:"defi",     label:"DeFi & Web3",               icon:"⛓",  color:"#818cf8" },
  { id:"refuge",   label:"Valeurs Refuge",            icon:"🏰", color:"#d1d5db" },
  { id:"europe",    label:"Europe",                   icon:"🇪🇺", color:"#60a5fa" },
  { id:"cyber",     label:"Cybersécurité",            icon:"🛡",  color:"#f87171" },
  { id:"nucleaire", label:"Nucléaire",                icon:"⚛",  color:"#a3e635" },
  { id:"eau",       label:"Eau",                      icon:"💧", color:"#38bdf8" },
  { id:"gaming",    label:"Gaming & Metaverse",       icon:"🎮", color:"#c084fc" },
  { id:"fintech",   label:"Fintech",                  icon:"💱", color:"#34d399" },
  { id:"space",     label:"Space & Défense",          icon:"🚀", color:"#94a3b8" },
];
const BENCHMARK = { mu:0.13, sigma:0.14, name:"S&P 500" };

const BENCHMARKS = [
  { ticker:"^GSPC",   label:"S&P 500"  },
  { ticker:"^FCHI",   label:"CAC 40"   },
  { ticker:"^GDAXI",  label:"DAX"      },
  { ticker:"^FTSE",   label:"FTSE 100" },
  { ticker:"^N225",   label:"Nikkei"   },
  { ticker:"QQQ",     label:"Nasdaq"   },
  { ticker:"GLD",     label:"Gold"     },
  { ticker:"BTC-USD", label:"Bitcoin"  },
];

const TYPE_COLOR = { action:"#4ade80", crypto:"#fb923c", etf:"#38bdf8", indice:"#c084fc" };
const PORTFOLIO_COLORS = ["#4ade80","#fb923c","#38bdf8","#f472b6","#facc15","#a78bfa","#34d399","#f87171"];
const PERIOD_DAYS  = { "5J":5, "1M":21, "3M":63, "6M":126, "1A":252, "3A":756, "5A":1260 };
const PERIOD_CAL_DAYS = { "5J":7, "1M":31, "3M":91, "6M":182, "1A":365, "3A":1095, "5A":1825 };
const HORIZON_DAYS = { "6M":126, "1A":252, "3A":756, "5A":1260 };
const MODES = [
  { id:"backtest",    label:"Backtest",    icon:"◀" },
  { id:"monte_carlo", label:"Monte Carlo", icon:"⟁" },
];
const TABS = [
  { id:"builder",  label:"Constructeur" },
  { id:"compare",  label:"Comparaison"  },
  { id:"track",    label:"Suivi"        },
];

// ── Math ──────────────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed;
  return () => { s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/0xffffffff; };
}
function tickerSeed(t){ return t.split("").reduce((a,c)=>a*31+c.charCodeAt(0),7)&0x7fffffff; }
function randNormal(rng){ const u1=Math.max(rng(),1e-10),u2=rng(); return Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2); }

function generatePrices(ticker, days, seedOverride){
  const p = ASSET_PARAMS[ticker]||{mu:0.15,sigma:0.25};
  const rng = seededRng(seedOverride||tickerSeed(ticker));
  const dt=1/252; let price=100; const prices=[price];
  for(let i=0;i<days;i++){ price*=Math.exp((p.mu-0.5*p.sigma**2)*dt+p.sigma*Math.sqrt(dt)*randNormal(rng)); prices.push(price); }
  return prices;
}

function generateBenchmark(days, ticker="^GSPC"){
  if(_priceData?.raw?.[ticker]){
    const arr = _priceData.raw[ticker];
    const n = days + 1;
    if(arr.length >= n && !arr.slice(arr.length-n).some(v=>v==null)){
      const slice = arr.slice(arr.length - n);
      const base = slice[0] || 1;
      return slice.map(p => (p / base) * 100);
    }
  }
  const p = ASSET_PARAMS[ticker] || BENCHMARK;
  const rng=seededRng(tickerSeed(ticker)); const dt=1/252; let price=100; const prices=[price];
  for(let i=0;i<days;i++){ price*=Math.exp((p.mu-0.5*p.sigma**2)*dt+p.sigma*Math.sqrt(dt)*randNormal(rng)); prices.push(price); }
  return prices;
}

function getPrices(ticker, days){
  if(_priceData?.raw?.[ticker]){
    const arr = _priceData.raw[ticker];
    const n = days + 1;
    if(arr.length >= n){
      const slice = arr.slice(arr.length - n);
      if(!slice.some(v => v == null)){
        const base = slice[0] || 1;
        return slice.map(p => (p / base) * 100);
      }
    }
  }
  return generatePrices(ticker, days);
}

function getRealDates(days){
  if(!_priceData?.bdays) return null;
  const bd = _priceData.bdays;
  const n = days + 1;
  return bd.length >= n ? bd.slice(bd.length - n) : bd;
}

function portfolioReturns(assets, days){
  const ap={};
  assets.forEach(({ticker})=>{ ap[ticker]=getPrices(ticker,days); });
  return Array.from({length:days+1},(_,i)=>{
    let v=0;
    for(const {ticker,weight} of assets) v+=(ap[ticker][i]/ap[ticker][0]-1)*100*((parseFloat(weight)||0)/100);
    return v;
  });
}

function portfolioParams(assets){
  let mu=0,sigma=0;
  for(const {ticker,weight} of assets){
    const p=ASSET_PARAMS[ticker]||{mu:0.15,sigma:0.25};
    const w=(parseFloat(weight)||0)/100;
    mu+=w*p.mu; sigma+=w*p.sigma;
  }
  return {mu,sigma};
}

// ── Institutional metrics ─────────────────────────────────────────────────────
function computeMetrics(returns, benchReturns){
  const n = returns.length;
  // Fix: divide by previous value, not constant 100 (critical for crypto/high-return assets)
  const daily = returns.slice(1).map((v,i)=>(v-returns[i])/returns[i]);
  const bDaily = benchReturns ? benchReturns.slice(1).map((v,i)=>(v-benchReturns[i])/benchReturns[i]) : null;

  const totalReturn = returns[n-1]-returns[0];
  const annFactor = 252/Math.max(n-1,1);
  const annReturn = (Math.pow(1+totalReturn/100, annFactor)-1)*100;

  const mean = daily.reduce((a,b)=>a+b,0)/daily.length;
  const variance = daily.reduce((a,b)=>a+(b-mean)**2,0)/daily.length;
  const annVol = Math.sqrt(variance*252)*100;

  const rf = 0.02;
  const rfDaily = rf/252;
  const sharpe = annVol>0 ? (annReturn/100-rf)/(annVol/100) : 0;

  // Sortino (Sortino & Price 1994): MAR=rf/252, all days in denominator
  const downsideSq = daily.reduce((a,r)=>a+Math.pow(Math.min(r-rfDaily,0),2),0)/daily.length;
  const downsideDev = Math.sqrt(downsideSq*252)*100;
  const sortino = downsideDev>0 ? (annReturn/100-rf)/(downsideDev/100) : 0;

  let peak=returns[0], maxDD=0;
  for(let i=0;i<n;i++){
    if(returns[i]>peak) peak=returns[i];
    const dd=(returns[i]-peak)/peak*100;
    if(dd<maxDD) maxDD=dd;
  }
  const calmar = maxDD<0 ? -(annReturn/100)/(maxDD/100) : 0;

  const sorted = [...daily].sort((a,b)=>a-b);
  const var95 = sorted[Math.floor(0.05*sorted.length)]||0;
  const cvar95 = sorted.slice(0,Math.floor(0.05*sorted.length)).reduce((a,b)=>a+b,0)/(Math.floor(0.05*sorted.length)||1);

  // Omega ratio: Σmax(r-L,0) / Σmax(L-r,0), L=rf/252
  const oGains = daily.reduce((a,r)=>a+Math.max(r-rfDaily,0),0);
  const oLoss  = daily.reduce((a,r)=>a+Math.max(rfDaily-r,0),0);
  const omega  = oLoss>0 ? oGains/oLoss : (oGains>0 ? 999 : 1);

  let beta=1, alpha=0, correlation=0;
  if(bDaily && bDaily.length===daily.length){
    const bMean=bDaily.reduce((a,b)=>a+b,0)/bDaily.length;
    const cov=daily.reduce((a,r,i)=>a+(r-mean)*(bDaily[i]-bMean),0)/daily.length;
    const bVar=bDaily.reduce((a,r)=>a+(r-bMean)**2,0)/bDaily.length;
    beta = bVar>0 ? cov/bVar : 1;
    // Fix: use actual realized benchmark return, not hardcoded BENCHMARK.mu
    const benchTotalReturn = benchReturns[benchReturns.length-1]-benchReturns[0];
    const benchAnnReturn = (Math.pow(1+benchTotalReturn/100, annFactor)-1);
    alpha = (annReturn/100 - rf - beta*(benchAnnReturn-rf))*100;
    const stdP=Math.sqrt(variance), stdB=Math.sqrt(bVar);
    correlation = (stdP>0&&stdB>0) ? cov/(stdP*stdB) : 0;
  }

  const wins = daily.filter(r=>r>0).length;
  const winRate = (wins/daily.length*100);

  return {
    totalReturn: totalReturn.toFixed(2),
    annReturn: annReturn.toFixed(2),
    annVol: annVol.toFixed(2),
    sharpe: sharpe.toFixed(3),
    sortino: sortino.toFixed(3),
    calmar: calmar.toFixed(3),
    omega: omega>=999?"∞":omega.toFixed(3),
    maxDD: maxDD.toFixed(2),
    var95: (var95*100).toFixed(2),
    cvar95: (cvar95*100).toFixed(2),
    beta: beta.toFixed(3),
    alpha: alpha.toFixed(2),
    correlation: correlation.toFixed(3),
    winRate: winRate.toFixed(1),
  };
}

const _MOIS = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
const _MOIS_EN = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const _MOIS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
// Convert trading days to calendar days (252 trading days ≈ 365 calendar days)
function tradingToCalendar(td){ return Math.round(td * 365/252); }
function dateLabel(dayOffset, totalDays, fromNow=false, moisArr=_MOIS){
  const base=new Date(2025,4,4);
  if(!fromNow) base.setDate(base.getDate()-tradingToCalendar(totalDays));
  const d=new Date(base); d.setDate(base.getDate()+tradingToCalendar(dayOffset));
  return `${String(d.getDate()).padStart(2,"0")} ${moisArr[d.getMonth()]}`;
}

function reequalize(list){
  if(!list.length) return list;
  const w=parseFloat((100/list.length).toFixed(1));
  return list.map((a,i)=>({...a,weight:i===list.length-1?parseFloat((100-w*(list.length-1)).toFixed(1)):w}));
}

const PRESETS = Object.entries(ASSET_PARAMS)
  .map(([ticker,{name,type,sector,themes,cap}])=>({ticker,name,type,sector,themes,cap}))
  .filter((p,i,arr)=>arr.findIndex(x=>x.ticker===p.ticker)===i)
  .sort((a,b)=>(b.cap||0)-(a.cap||0));

// ── UI Helpers ────────────────────────────────────────────────────────────────
function Empty({T, label="CONFIGURE ET LANCE"}){
  return <div style={{height:280,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:T.b2}}>
    <div style={{fontSize:40}}>◈</div>
    <div style={{fontSize:10,letterSpacing:3}}>{label}</div>
  </div>;
}

function SL({children,mb=6,T}){ return <div style={{fontSize:9,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:mb}}>{children}</div>; }

// METRIC_INFO removed — descriptions now live in I18N[lang].mi keyed by short codes

// ── Inline tooltip for comparison table ──────────────────────────────────────
const TableMetricLabel = ({label, info, T})=>{
  const [open,setOpen] = useState(false);
  return(
    <div style={{display:"inline-flex",alignItems:"center",gap:5,position:"relative"}}>
      <span>{label}</span>
      {info&&(
        <button
          onMouseEnter={()=>setOpen(true)}
          onMouseLeave={()=>setOpen(false)}
          onClick={()=>setOpen(o=>!o)}
          style={{width:13,height:13,borderRadius:"50%",border:`1px solid ${T.b2}`,background:T.bg2,color:T.t4,fontSize:7,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",fontFamily:"serif",fontWeight:700,flexShrink:0,lineHeight:1}}
        >?</button>
      )}
      {open&&info&&(
        <div style={{position:"absolute",left:0,top:"100%",zIndex:9999,background:T.bg,border:`1px solid ${T.b2}`,borderRadius:8,padding:"10px 13px",width:240,boxShadow:"0 8px 32px #000c",marginTop:2,pointerEvents:"none"}}>
          <div style={{fontSize:10,color:T.t1,lineHeight:1.6,marginBottom:5}}>{info.what}</div>
          <div style={{fontSize:9,color:"#fb923c",lineHeight:1.5,marginBottom:4,background:"#fb923c10",padding:"3px 6px",borderRadius:3}}>📊 {info.how}</div>
          <div style={{fontSize:9,color:"#4ade80",lineHeight:1.5,background:"#4ade8010",padding:"3px 6px",borderRadius:3}}>✓ {info.good}</div>
        </div>
      )}
    </div>
  );
};

// ── Tooltip-enabled MetricRow ─────────────────────────────────────────────────
const MetricRow = ({label,val,color,highlight,info,T})=>{
  const [open,setOpen] = useState(false);
  return(
    <div style={{position:"relative",padding:"6px 0",borderBottom:`1px solid ${T.b2_20}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,color:T.t2}}>{label}</span>
          {info&&(
            <button
              onMouseEnter={()=>setOpen(true)}
              onMouseLeave={()=>setOpen(false)}
              onClick={()=>setOpen(o=>!o)}
              style={{width:14,height:14,borderRadius:"50%",border:`1px solid ${T.b3}`,background:T.bg2,color:T.t4,fontSize:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"serif",fontWeight:700,flexShrink:0,lineHeight:1}}
            >?</button>
          )}
        </div>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:13,fontWeight:700,color:color||T.t1,background:highlight?color+"18":"transparent",padding:highlight?"2px 8px":"0",borderRadius:4}}>{val}</div>
      </div>
      {open&&info&&(
        <div style={{position:"absolute",left:0,top:"100%",zIndex:999,background:T.bg1,border:`1px solid ${T.b3}`,borderRadius:8,padding:"10px 13px",width:260,boxShadow:"0 8px 32px #000a",marginTop:2}}>
          <div style={{fontSize:10,color:T.t1,lineHeight:1.6,marginBottom:6}}>{info.what}</div>
          <div style={{fontSize:9,color:"#fb923c",lineHeight:1.5,marginBottom:5,background:"#fb923c10",padding:"4px 7px",borderRadius:4}}>📊 {info.how}</div>
          <div style={{fontSize:9,color:"#4ade80",lineHeight:1.5,background:"#4ade8010",padding:"4px 7px",borderRadius:4}}>✓ {info.good}</div>
        </div>
      )}
    </div>
  );
};

// ── Chart Tooltips ─────────────────────────────────────────────────────────────
const ChartTooltip = ({active,payload,label,invest,T,mois})=>{
  if(!active||!payload?.length) return null;
  let displayLabel = label;
  if(mois&&label&&label.length>=10&&label[4]==='-'){
    const p = label.split('-');
    displayLabel = `${p[2]} ${mois[parseInt(p[1])-1]} ${p[0]}`;
  }
  return <div style={{background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:8,padding:"8px 14px",boxShadow:"0 4px 20px #0009"}}>
    <div style={{color:T.t4,fontSize:10,marginBottom:4}}>{displayLabel}</div>
    {payload.map(p=>(
      <div key={p.dataKey} style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:2}}>
        <span style={{fontSize:10,color:p.color}}>{p.name}</span>
        <span style={{fontSize:12,color:p.color,fontFamily:"monospace",fontWeight:700}}>
          {p.value>=0?"+":""}{parseFloat(p.value).toFixed(2)}%
          {invest>0?` · ${(invest*(1+p.value/100)).toFixed(0)}€`:""}
        </span>
      </div>
    ))}
  </div>;
};

// ── Tutorial Modal ────────────────────────────────────────────────────────────
function TutorialModal({ lang, setLang, T, onClose }) {
  const L = I18N[lang];
  const steps = L.tuto_steps;
  const total = steps.length;
  const [step, setStep] = useState(0);
  const [noShow, setNoShow] = useState(false);

  const close = useCallback(() => {
    if (noShow) { try { localStorage.setItem("indexlab_tuto_seen","1"); } catch {} }
    onClose();
  }, [noShow, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && step < total - 1) setStep(s => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep(s => s - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, close, total]);

  const cur = steps[step];
  const isLast = step === total - 1;

  const pickLang = (code) => {
    setLang(code);
    try { localStorage.setItem("indexlab_lang", code); } catch {}
  };

  return (
    <div className="modal-bg" onClick={close}>
      <div onClick={e => e.stopPropagation()} style={{
        background:T.bg2, border:`1px solid ${T.b2}`, borderRadius:14, padding:"28px 28px 22px",
        width:"100%", maxWidth:420, position:"relative", fontFamily:"'Space Mono',monospace",
        boxShadow:"0 24px 60px #0008",
      }}>
        {/* Top bar: lang flags + close */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div style={{display:"flex",gap:4}}>
            {[{code:"en",flag:"🇬🇧"},{code:"es",flag:"🇪🇸"},{code:"fr",flag:"🇫🇷"}].map(({code,flag})=>(
              <button key={code} onClick={()=>pickLang(code)} style={{
                background:lang===code?"#4ade8020":"transparent",
                border:`1px solid ${lang===code?"#4ade80":T.b1}`,
                borderRadius:5, padding:"3px 7px", cursor:"pointer", fontSize:14,
                color:T.t1, opacity:lang===code?1:0.45, lineHeight:1, transition:"all .12s",
              }}>{flag}</button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase"}}>{L.tuto_step(step+1, total)}</span>
            <button onClick={close} style={{background:"none",border:"none",color:T.t4,fontSize:18,cursor:"pointer",lineHeight:1,padding:"2px 6px"}}
              onMouseEnter={e=>{e.currentTarget.style.color="#f87171";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;}}>×</button>
          </div>
        </div>

        {/* Icon + Title */}
        <div style={{fontSize:36,marginBottom:10,lineHeight:1}}>{cur.icon}</div>
        <div style={{fontSize:15,fontWeight:700,color:T.t1,marginBottom:14,letterSpacing:-0.3}}>{cur.title}</div>

        {/* Body */}
        <div style={{fontSize:11,color:T.t2,lineHeight:1.8,marginBottom:22,whiteSpace:"pre-line",minHeight:72}}>
          {cur.body}
        </div>

        {/* Progress dots */}
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:20}}>
          {steps.map((_,i)=>(
            <div key={i} onClick={()=>setStep(i)} style={{
              width:i===step?20:7, height:7, borderRadius:4, cursor:"pointer",
              background:i===step?"#4ade80":T.b2, transition:"all .2s",
            }}/>
          ))}
        </div>

        {/* Don't show again */}
        <label style={{display:"flex",alignItems:"center",gap:7,fontSize:9,color:T.t4,cursor:"pointer",marginBottom:16,userSelect:"none"}}>
          <input type="checkbox" checked={noShow} onChange={e=>setNoShow(e.target.checked)}
            style={{accentColor:"#4ade80",cursor:"pointer"}}/>
          {L.tuto_no_show}
        </label>

        {/* Navigation */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {!isLast&&<div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep(s=>s-1)} disabled={step===0}
              style={{flex:1,padding:"8px 0",borderRadius:7,border:`1px solid ${T.b2}`,background:"transparent",color:step===0?T.t6:T.t3,cursor:step===0?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,transition:"all .12s"}}
              onMouseEnter={e=>{if(step>0){e.currentTarget.style.borderColor="#4ade80";e.currentTarget.style.color="#4ade80";}}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b2;e.currentTarget.style.color=step===0?T.t6:T.t3;}}>
              {L.tuto_prev}
            </button>
            <button onClick={()=>setStep(s=>s+1)}
              style={{flex:2,padding:"8px 0",borderRadius:7,border:"none",background:"#4ade8020",color:"#4ade80",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,transition:"all .12s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="#4ade8030";}} onMouseLeave={e=>{e.currentTarget.style.background="#4ade8020";}}>
              {L.tuto_next}
            </button>
          </div>}
          {isLast&&<div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep(s=>s-1)}
              style={{flex:1,padding:"8px 0",borderRadius:7,border:`1px solid ${T.b2}`,background:"transparent",color:T.t3,cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,transition:"all .12s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="#4ade80";e.currentTarget.style.color="#4ade80";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b2;e.currentTarget.style.color=T.t3;}}>
              {L.tuto_prev}
            </button>
          </div>}
          <button onClick={close}
            style={{width:"100%",padding:"10px 0",borderRadius:7,border:"none",background:"linear-gradient(135deg,#4ade80,#22d3ee)",color:"#071209",cursor:"pointer",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,transition:"all .12s"}}
            onMouseEnter={e=>{e.currentTarget.style.opacity="0.85";}} onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}>
            {L.tuto_close}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Locale-aware date picker ──────────────────────────────────────────────────
const _MONTH_NAMES = {
  fr:["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"],
  en:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  es:["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
};
function LocaleDateInput({ value, onChange, max, T, darkMode, lang }){
  const parts = value ? value.split('-') : ["","",""];
  const y=parseInt(parts[0])||new Date().getFullYear();
  const m=parseInt(parts[1])||new Date().getMonth()+1;
  const d=parseInt(parts[2])||new Date().getDate();
  const mNames=_MONTH_NAMES[lang]||_MONTH_NAMES.en;
  const curY=new Date().getFullYear();
  const daysInM=new Date(y,m,0).getDate();

  const selStyle={flex:1,background:T.bg,border:`1px solid ${T.b2}`,color:T.t1,borderRadius:6,padding:"7px 5px",fontFamily:"'Space Mono'",fontSize:11,outline:"none",cursor:"pointer",colorScheme:darkMode?"dark":"light"};

  const commit=(ny,nm,nd)=>{
    const maxD=new Date(ny,nm,0).getDate();
    const cd=Math.min(nd,maxD);
    const str=`${ny}-${String(nm).padStart(2,'0')}-${String(cd).padStart(2,'0')}`;
    onChange({target:{value:max&&str>max?max:str}});
  };

  const dayEl=(
    <select value={d} onChange={e=>commit(y,m,parseInt(e.target.value))} style={selStyle}>
      {Array.from({length:daysInM},(_,i)=><option key={i+1} value={i+1}>{String(i+1).padStart(2,'0')}</option>)}
    </select>
  );
  const monthEl=(
    <select value={m} onChange={e=>commit(y,parseInt(e.target.value),d)} style={selStyle}>
      {mNames.map((n,i)=><option key={i+1} value={i+1}>{n}</option>)}
    </select>
  );
  const yearEl=(
    <select value={y} onChange={e=>commit(parseInt(e.target.value),m,d)} style={{...selStyle,flex:1.3}}>
      {Array.from({length:11},(_,i)=>curY-i).map(yr=><option key={yr} value={yr}>{yr}</option>)}
    </select>
  );

  const order=lang==="en"?[monthEl,dayEl,yearEl]:[dayEl,monthEl,yearEl];
  return <div style={{display:"flex",gap:4}}>{order}</div>;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]           = useState("builder");
  const [assets,setAssets]     = useState([{ticker:"AAPL",weight:33.3},{ticker:"BTC-USD",weight:33.3},{ticker:"SPY",weight:33.4}]);
  const [mode,setMode]         = useState("backtest");
  const [period,setPeriod]     = useState("3M");
  const [horizon,setHorizon]   = useState("1A");
  const [invest,setInvest]     = useState(10000);
  const [custom,setCustom]     = useState("");
  const [panelOpen,setPanelOpen] = useState(false);
  const [isMobile,setIsMobile] = useState(false);
  const [isXS,setIsXS]         = useState(false);
  const [savedPortfolios,setSavedPortfolios] = useState([]);
  const [saveModalOpen,setSaveModalOpen] = useState(false);
  const [saveName,setSaveName] = useState("");
  const [selectedCompare,setSelectedCompare] = useState([]);
  const [storageReady,setStorageReady] = useState(false);
  const [notification,setNotification] = useState(null);
  const [pickerMode,setPickerMode] = useState("sector");
  const [activeSector,setActiveSector] = useState("all");
  const [activeTheme,setActiveTheme]   = useState(null);
  const [suggestionIdx,setSuggestionIdx] = useState(-1);
  const [customFocused,setCustomFocused] = useState(false);
  const [priceData,setPriceData] = useState(null);
  const [editingPortfolioId,setEditingPortfolioId] = useState(null);
  const [benchmark,setBenchmark] = useState("^GSPC");
  const [trackModalId,setTrackModalId] = useState(null);
  const [projHorizon,setProjHorizon]     = useState('y1');
  const [selectedTicker,setSelectedTicker]   = useState(null);
  const [selectedOptim,setSelectedOptim]     = useState(null);
  const [btStartDate,setBtStartDate] = useState(()=>new Date().toISOString().split('T')[0]);
  const [lang,setLang] = useState(()=>{ try{return localStorage.getItem("indexlab_lang")||"en";}catch{return"en";} });
  const [darkMode,setDarkMode] = useState(()=>{
    try { return localStorage.getItem("indexlab_dark")!=="false"; } catch { return true; }
  });
  const [tutorialOpen,setTutorialOpen] = useState(()=>{
    try { return !localStorage.getItem("indexlab_tuto_seen"); } catch { return true; }
  });

  useEffect(()=>{ try{localStorage.setItem("indexlab_dark",darkMode);}catch{} },[darkMode]);
  useEffect(()=>{ try{localStorage.setItem("indexlab_lang",lang);}catch{} },[lang]);

  useEffect(()=>{
    fetch('/prices.json')
      .then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(data=>{ _priceData=data; setPriceData(data); })
      .catch(()=>{}); // silently fall back to simulation
  },[]);

  useEffect(()=>{
    const check=()=>{ setIsMobile(window.innerWidth<768); setIsXS(window.innerWidth<420); };
    check(); window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{
    try {
      const saved = storage.get("indexlab_portfolios");
      if(saved) setSavedPortfolios(saved);
    } catch(e) {}
    setStorageReady(true);
  },[]);

  // ── Theme object ──────────────────────────────────────────────────────────
  const T = darkMode ? {
    bg:"#070910", bg1:"#0a0c14", bg2:"#0c0e15",
    b1:"#141824", b2:"#1e2535", b3:"#2a3045",
    t1:"#e2e8f0", t2:"#9aaabb", t3:"#7d8fa0", t4:"#677888", t5:"#546070", t6:"#425060",
    b1_20:"#14182420", b2_20:"#1e253520", b2_44:"#1e253544",
  } : {
    bg:"#f0f4f8", bg1:"#e8edf4", bg2:"#ffffff",
    b1:"#e2e8f0", b2:"#c8d4e4", b3:"#8fa3bb",
    t1:"#0f172a", t2:"#334155", t3:"#475569", t4:"#64748b", t5:"#94a3b8", t6:"#cbd5e1",
    b1_20:"#e2e8f020", b2_20:"#c8d4e420", b2_44:"#c8d4e444",
  };

  const L = I18N[lang] || I18N.fr;
  const t = (key) => L[key] ?? I18N.fr[key] ?? key;
  const mi = (k) => L.mi?.[k] ?? I18N.fr.mi?.[k];
  const moisArr = lang==="en" ? _MOIS_EN : lang==="es" ? _MOIS_ES : _MOIS;
  const benchmarkLabel = BENCHMARKS.find(b=>b.ticker===benchmark)?.label ?? benchmark;

  const notify = (msg, type="success")=>{
    setNotification({msg,type});
    setTimeout(()=>setNotification(null),2500);
  };

  const days = (()=>{
    if(priceData?.bdays){ const bd=priceData.bdays; const idx=bd.findIndex(d=>d>=btStartDate); if(idx>=0) return Math.max(1,bd.length-1-idx); }
    return PERIOD_DAYS[period];
  })();
  const hDays = HORIZON_DAYS[horizon];
  const totalW = assets.reduce((a,b)=>a+(parseFloat(b.weight)||0),0);
  const weightOk = Math.abs(totalW-100)<0.05;

  function addAsset(t){ t=t.trim().toUpperCase(); if(!t||assets.find(a=>a.ticker===t)) return; setAssets(prev=>reequalize([...prev,{ticker:t,weight:0}])); }
  function removeAsset(t){ setAssets(prev=>reequalize(prev.filter(a=>a.ticker!==t))); }
  function setWeight(t,v){ setSelectedOptim(null); setAssets(prev=>prev.map(a=>a.ticker===t?{...a,weight:parseFloat(v)||0}:a)); }

  // ── Backtest data ──
  const {chartData,assetPerfs,riskContribs,metrics,benchData} = useMemo(()=>{
    if(!assets.length||!weightOk||mode!=="backtest") return {chartData:[],assetPerfs:[],riskContribs:[],metrics:null,benchData:[]};
    const returns = portfolioReturns(assets,days);
    const benchPrices = generateBenchmark(days, benchmark);
    const bench = benchPrices.map((p,i,arr)=>(p/arr[0]-1)*100);
    const realDates = getRealDates(days);
    const pts = returns.map((v,i)=>({date:realDates?realDates[i]:dateLabel(i,days,false,moisArr),value:parseFloat(v.toFixed(3)),bench:parseFloat(bench[i].toFixed(3))}));

    const allPrices = {};
    assets.forEach(({ticker})=>{ allPrices[ticker]=getPrices(ticker,days); });

    const perfs = assets.map(({ticker,weight})=>{
      const pr = allPrices[ticker];
      const assetReturn = (pr[pr.length-1]/pr[0]-1)*100;
      const w = (parseFloat(weight)||0)/100;
      const contribution = assetReturn * w;
      return { ticker, weight, perf: assetReturn.toFixed(2), contribution: parseFloat(contribution.toFixed(3)) };
    });

    const dailyRets = {};
    assets.forEach(({ticker})=>{
      const pr = allPrices[ticker];
      dailyRets[ticker] = pr.slice(1).map((p,i)=>(p-pr[i])/pr[i]);
    });
    const n = days;
    const means = {};
    assets.forEach(({ticker})=>{ means[ticker]=dailyRets[ticker].reduce((a,b)=>a+b,0)/n; });
    const cov = {};
    assets.forEach(({ticker:ti})=>{
      cov[ti]={};
      assets.forEach(({ticker:tj})=>{
        cov[ti][tj] = dailyRets[ti].reduce((a,r,k)=>a+(r-means[ti])*(dailyRets[tj][k]-means[tj]),0)/n;
      });
    });

    let portVar = 0;
    assets.forEach(({ticker:ti,weight:wi})=>{
      assets.forEach(({ticker:tj,weight:wj})=>{
        portVar += (parseFloat(wi)||0)/100 * (parseFloat(wj)||0)/100 * cov[ti][tj];
      });
    });
    const portVol = Math.sqrt(portVar*252);
    const riskContribs = assets.map(({ticker,weight})=>{
      const w = (parseFloat(weight)||0)/100;
      let mcr = 0;
      assets.forEach(({ticker:tj,weight:wj})=>{ mcr += (parseFloat(wj)||0)/100 * cov[ticker][tj]; });
      const rc = w * mcr / (portVar||1);
      return { ticker, riskContrib: parseFloat((rc*100).toFixed(2)) };
    });

    const m = computeMetrics(returns.map(v=>100+v), bench.map(v=>100+v));
    return {chartData:pts, assetPerfs:perfs, riskContribs, metrics:m, benchData:bench};
  },[assets,period,days,mode,weightOk,priceData,lang,benchmark]);

  // ── Monte Carlo ──
  const mcData = useMemo(()=>{
    if(!assets.length||!weightOk||mode!=="monte_carlo") return [];
    const {mu,sigma}=portfolioParams(assets);
    const N=600,step=Math.max(1,Math.floor(hDays/60)),dt=1/252;
    const sims=Array.from({length:N},(_,n)=>{
      const rng=seededRng(n*999983+7); let val=0; const path=[0];
      for(let d=0;d<hDays;d++){ val+=(mu-0.5*sigma**2)*dt+sigma*Math.sqrt(dt)*randNormal(rng); if((d+1)%step===0) path.push((Math.exp(val)-1)*100); }
      return path;
    });
    return Array.from({length:sims[0].length},(_,i)=>{
      const vals=sims.map(s=>s[i]).sort((a,b)=>a-b);
      const pct=p=>vals[Math.floor(p*vals.length)];
      return {date:dateLabel(i*step,hDays,true,moisArr),p10:+pct(0.10).toFixed(2),p25:+pct(0.25).toFixed(2),median:+pct(0.50).toFixed(2),p75:+pct(0.75).toFixed(2),p90:+pct(0.90).toFixed(2)};
    });
  },[assets,mode,horizon,hDays,weightOk,lang]);


  // ── Compare data ──
  const compareData = useMemo(()=>{
    if(!selectedCompare.length) return {chart:[],metricsTable:[]};
    const activePorts = selectedCompare.map(id=>savedPortfolios.find(p=>p.id===id)).filter(Boolean);
    if(!activePorts.length) return {chart:[],metricsTable:[]};
    const allReturns = activePorts.map(p=>portfolioReturns(p.assets,days));
    const benchPrices2 = generateBenchmark(days, benchmark);
    const bench = benchPrices2.map((p,i,arr)=>(p/arr[0]-1)*100);
    const realDates2 = getRealDates(days);
    const chart = Array.from({length:days+1},(_,i)=>{
      const pt={date:realDates2?realDates2[i]:dateLabel(i,days,false,moisArr),bench:parseFloat(bench[i].toFixed(3))};
      activePorts.forEach((p,pi)=>{ pt[p.id]=parseFloat(allReturns[pi][i].toFixed(3)); });
      return pt;
    });
    const metricsTable = activePorts.map((p,pi)=>({
      id:p.id, name:p.name, color:p.color,
      m:computeMetrics(allReturns[pi].map(v=>100+v),bench.map(v=>100+v))
    }));
    const benchMetrics = computeMetrics(bench.map(v=>100+v), bench.map(v=>100+v));
    return {chart,metricsTable,benchMetrics,names:activePorts.map(p=>({id:p.id,name:p.name,color:p.color}))};
  },[selectedCompare,savedPortfolios,period,days,priceData,lang,benchmark]);

  // ── Tracking data (real perf from creation to today) ──
  const trackingData = useMemo(()=>{
    if(!savedPortfolios.length) return [];
    const calcProj=(assets)=>{
      const {mu,sigma}=portfolioParams(assets);
      const dt=1/252,projN=100,projSeed=0x3a7f9b;
      const allPaths=Array.from({length:projN},(_,n)=>{
        const rng=seededRng((projSeed+n*777777)&0x7fffffff);
        let lv=0; const path=[0];
        for(let d=0;d<1260;d++){
          lv+=(mu-0.5*sigma**2)*dt+sigma*Math.sqrt(dt)*randNormal(rng);
          path.push(parseFloat(((Math.exp(lv)-1)*100).toFixed(2)));
        }
        return path;
      });
      const medAt=idx=>{const s=allPaths.map(p=>p[Math.min(idx,p.length-1)]).sort((a,b)=>a-b);return parseFloat(s[Math.floor(s.length/2)].toFixed(2));};
      const step=Math.max(1,Math.floor(1260/80));
      const pts=[];
      for(let i=0;i<=1260;i+=step) pts.push({d:i,v:medAt(i)});
      if(pts[pts.length-1].d!==1260) pts.push({d:1260,v:medAt(1260)});
      return {y1:medAt(252),y3:medAt(756),y5:medAt(1260),pts};
    };
    if(!priceData) return savedPortfolios.map(p=>({id:p.id,name:p.name,color:p.color,savedAt:p.savedAt,assets:p.assets,error:'no_data',projection:calcProj(p.assets)}));
    const bdays = priceData.bdays;
    return savedPortfolios.map(p=>{
      const base = {id:p.id,name:p.name,color:p.color,savedAt:p.savedAt||Date.now(),assets:p.assets};
      const projection=calcProj(p.assets);
      const savedDate = p.trackingStartDate || new Date(p.savedAt||Date.now()).toISOString().split('T')[0];
      const endIdx = bdays.length-1;
      let startIdx = bdays.findIndex(d=>d>=savedDate);
      if(startIdx===-1) startIdx = endIdx; // portfolio créé après la dernière date dispo → 0 jour
      const trackDays = endIdx-startIdx;
      const lastBdayStr=bdays[endIdx];
      const futureDateStr=n=>{const d=new Date(lastBdayStr);d.setDate(d.getDate()+Math.round(n*(365/252)));return d.toISOString().slice(0,10);};
      const mkProjChart=(sv=0)=>projection.pts.map(pt=>({date:pt.d===0?lastBdayStr:futureDateStr(pt.d),proj:parseFloat((sv+pt.v).toFixed(2)),d:pt.d}));
      if(trackDays<1) return {...base,trackDays:0,error:'too_short',projection,projChartData:mkProjChart(0)};
      // Real asset prices from startIdx → today
      const ap={};
      let ok=true;
      for(const {ticker} of p.assets){
        const arr=priceData.raw[ticker];
        if(!arr){ok=false;break;}
        const slice=arr.slice(startIdx,endIdx+1);
        if(slice.length<trackDays+1||slice.some(v=>v==null)){ok=false;break;}
        const b=slice[0]||1;
        ap[ticker]=slice.map(v=>(v/b)*100);
      }
      if(!ok) return {...base,trackDays,error:'missing_assets',projection,projChartData:mkProjChart(0)};
      // Weighted portfolio actual returns
      const actualRaw=Array.from({length:trackDays+1},(_,i)=>{
        let v=0;
        for(const {ticker,weight} of p.assets) v+=(ap[ticker][i]-100)*((parseFloat(weight)||0)/100);
        return parseFloat(v.toFixed(3));
      });
      // MC median (200 paths, same duration)
      const {mu,sigma}=portfolioParams(p.assets);
      const N=200,dt=1/252,seed0=(p.savedAt||42)%0x7fffffff;
      const sims=Array.from({length:N},(_,n)=>{
        const rng=seededRng((seed0+n*999983)&0x7fffffff);
        let val=0; const path=[0];
        for(let d=0;d<trackDays;d++){
          val+=(mu-0.5*sigma**2)*dt+sigma*Math.sqrt(dt)*randNormal(rng);
          path.push(parseFloat(((Math.exp(val)-1)*100).toFixed(3)));
        }
        return path;
      });
      const mcRaw=Array.from({length:trackDays+1},(_,i)=>{
        const vals=sims.map(s=>s[i]).sort((a,b)=>a-b);
        return vals[Math.floor(0.5*vals.length)];
      });
      // Sampled chart data
      const step=Math.max(1,Math.floor(trackDays/80));
      const idxs=[];
      for(let i=0;i<=trackDays;i+=step) idxs.push(i);
      if(idxs[idxs.length-1]!==trackDays) idxs.push(trackDays);
      const chartData=idxs.map(i=>({
        date:bdays[startIdx+i]||'',
        actual:actualRaw[i], mc:mcRaw[i],
      }));
      // Forward projection chart (from actualFinal into future)
      const projChartData=mkProjChart(actualRaw[trackDays]);
      // Metrics
      const actualM=computeMetrics(actualRaw.map(v=>100+v),null);
      const mcM=computeMetrics(mcRaw.map(v=>100+v),null);
      return {
        ...base,trackDays,
        startDate:bdays[startIdx],
        actualFinal:actualRaw[trackDays],
        mcFinal:mcRaw[trackDays],
        chartData,actualM,mcM,projection,projChartData,
      };
    });
  },[savedPortfolios,priceData]);

  // ── Save / edit portfolio ──
  function savePortfolio(){
    if(!weightOk||!assets.length) return;
    const autoName = `Portfolio #${savedPortfolios.length+1} · ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}`;
    const name = saveName.trim()||autoName;
    if(editingPortfolioId){
      const updated = savedPortfolios.map(p=>p.id===editingPortfolioId?{...p,name,assets:[...assets],period,mode,trackingStartDate:btStartDate,updatedAt:Date.now()}:p);
      if(storage.set("indexlab_portfolios",updated)!==false){
        setSavedPortfolios(updated); setSaveModalOpen(false); setSaveName(""); setEditingPortfolioId(null);
        notify(t('notif_updated')(name));
      } else { notify(t('notif_err'),"error"); }
    } else {
      const color = PORTFOLIO_COLORS[savedPortfolios.length % PORTFOLIO_COLORS.length];
      const np = { id:`p_${Date.now()}`, name, assets:[...assets], color, savedAt:Date.now(), trackingStartDate:btStartDate, period, mode };
      const updated = [...savedPortfolios, np];
      if(storage.set("indexlab_portfolios",updated)!==false){
        setSavedPortfolios(updated); setSaveModalOpen(false); setSaveName("");
        notify(t('notif_saved')(name));
      } else { notify(t('notif_err'),"error"); }
    }
  }

  function loadPortfolio(p){
    setAssets(p.assets); setPeriod(p.period||"3M"); setMode(p.mode||"backtest");
    setSaveName(p.name); setEditingPortfolioId(p.id);
    setBtStartDate(p.trackingStartDate||new Date(p.savedAt||Date.now()).toISOString().split('T')[0]);
    setTab("builder"); if(isMobile) setPanelOpen(false);
    notify(t('notif_loaded')(p.name));
  }

  function deletePortfolio(id){
    const updated = savedPortfolios.filter(p=>p.id!==id);
    storage.set("indexlab_portfolios", updated);
    setSavedPortfolios(updated);
    setSelectedCompare(prev=>prev.filter(s=>s!==id));
    if(editingPortfolioId===id){ setEditingPortfolioId(null); setSaveName(""); }
  }

  function toggleCompare(id){ setSelectedCompare(prev=>prev.includes(id)?prev.filter(s=>s!==id):[...prev,id]); }

  const lastBT  = chartData[chartData.length-1]?.value??0;
  const isPos   = lastBT>=0;
  const lastMC  = mcData[mcData.length-1];
  const CH = isMobile?190:240;

  // ── CSS ──
  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Unbounded:wght@400;700;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:${T.b2};}
    body{background:${T.bg};}
    .chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;border:1px solid ${T.b2};background:transparent;color:${T.t3};cursor:pointer;font-size:10px;font-family:'Space Mono',monospace;transition:all .12s;white-space:nowrap;}
    .chip:hover{border-color:#4ade80;color:#4ade80;}
    .chip.used{opacity:.2;pointer-events:none;}
    .pill{padding:4px 11px;border-radius:5px;border:1px solid ${T.b2};background:transparent;color:${T.t5};cursor:pointer;font-family:'Space Mono',monospace;font-size:11px;transition:all .12s;}
    .pill.active{background:#4ade80;color:#0a1f0d;border-color:#4ade80;font-weight:700;}
    .pill:hover:not(.active){border-color:#4ade80;color:#4ade80;}
    .w-in{width:62px;background:${T.bg};border:1px solid ${T.b2};color:${T.t1};border-radius:4px;padding:3px 6px;font-family:'Space Mono',monospace;font-size:11px;text-align:right;outline:none;}
    .w-in:focus{border-color:#4ade80;}
    .run{width:100%;padding:12px;border:none;border-radius:7px;background:linear-gradient(135deg,#4ade80,#22d3ee);color:#071209;font-family:'Space Mono',monospace;font-weight:700;font-size:13px;cursor:pointer;transition:opacity .15s;letter-spacing:.5px;}
    .run:hover{opacity:.85;} .run:disabled{opacity:.3;cursor:not-allowed;}
    .card{background:${T.bg2};border:1px solid ${T.b1};border-radius:10px;padding:12px 15px;}
    .arow{background:${T.bg2};border:1px solid ${T.b1};border-radius:7px;padding:8px 10px;display:flex;align-items:center;gap:8px;margin-bottom:5px;transition:border-color .12s;}
    .arow:hover{border-color:${T.b2};}
    .tag{font-size:8px;padding:2px 5px;border-radius:3px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;}
    .mode-btn{flex:1;padding:7px 4px;border-radius:7px;border:1px solid ${T.b1};background:transparent;color:${T.t5};cursor:pointer;font-family:'Space Mono',monospace;font-size:9px;transition:all .15s;text-align:center;line-height:1.6;}
    .mode-btn.active{border-color:#4ade80;background:#4ade8010;color:#4ade80;}
    .mode-btn:hover:not(.active){border-color:${T.b2};color:${T.t3};}
    .tab-btn{padding:8px 16px;border:none;background:transparent;color:${T.t5};cursor:pointer;font-family:'Space Mono',monospace;font-size:11px;transition:all .12s;border-bottom:2px solid transparent;white-space:nowrap;}
    .tab-btn.active{color:#4ade80;border-bottom-color:#4ade80;}
    .tab-btn:hover:not(.active){color:${T.t2};}
    .save-btn{padding:6px 14px;border-radius:6px;border:1px solid #4ade8055;background:#4ade8010;color:#4ade80;cursor:pointer;font-family:'Space Mono',monospace;font-size:10px;transition:all .12s;white-space:nowrap;}
    .save-btn:hover{background:#4ade8022;border-color:#4ade80;}
    .save-btn:disabled{opacity:.3;cursor:not-allowed;}
    .del-btn{background:none;border:none;color:${T.b2};cursor:pointer;font-size:14px;padding:0 4px;transition:color .12s;}
    .del-btn:hover{color:#f87171;}
    .modal-bg{position:fixed;inset:0;background:#000c;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;}
    .modal{background:${T.bg2};border:1px solid ${T.b2};border-radius:12px;padding:24px;width:100%;max-width:380px;}
    .drawer-overlay{position:fixed;inset:0;background:#000a;z-index:40;}
    .drawer{position:fixed;bottom:0;left:0;right:0;background:${T.bg2};border-top:1px solid ${T.b2};border-radius:16px 16px 0 0;z-index:50;max-height:85vh;overflow-y:auto;padding:16px;}
    .notif{position:fixed;top:16px;right:16px;z-index:100;padding:10px 16px;border-radius:8px;font-family:'Space Mono',monospace;font-size:11px;animation:fadeIn .2s ease;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    .metric-section{margin-bottom:0;}
    .metric-group-title{font-size:8px;color:${T.t6};letter-spacing:3px;text-transform:uppercase;padding:8px 0 4px;border-bottom:1px solid ${T.b2};margin-bottom:4px;}
    input[type=number]::-webkit-inner-spin-button{opacity:.4;}
    @media(max-width:480px){
      .card{padding:9px 11px;}
      .pill{padding:3px 8px;font-size:10px;}
      .tab-btn{padding:8px 10px;font-size:10px;}
    }
    @media(max-width:420px){
      .tab-btn{padding:8px 7px;font-size:9px;}
    }
  `;

  const MetricsPanel = ({m,color})=>{
    if(!m) return null;
    const gr = v=>parseFloat(v)>=0?"#4ade80":"#f87171";
    const perDay = lang==="fr"?"%/j":lang==="es"?"%/d":"%/d";
    const sections=[
      { title:t('ms_rend'), rows:[
        {k:"perf",  l:t('mr_total_return'),v:`${parseFloat(m.totalReturn)>=0?"+":""}${m.totalReturn}%`,c:gr(m.totalReturn)},
        {k:"ann",   l:t('mr_ann_return'),  v:`${parseFloat(m.annReturn)>=0?"+":""}${m.annReturn}%`,  c:gr(m.annReturn)},
        {k:"alpha", l:t('mr_alpha')(benchmarkLabel), v:`${parseFloat(m.alpha)>=0?"+":""}${m.alpha}%`, c:gr(m.alpha)},
        {k:"win",   l:t('mr_win_rate'),    v:`${m.winRate}%`,c:parseFloat(m.winRate)>50?"#4ade80":"#f87171"},
      ]},
      { title:t('ms_risque'), rows:[
        {k:"vol",   l:t('mr_vol'),   v:`${m.annVol}%`,      c:"#fb923c"},
        {k:"maxdd", l:t('mr_maxdd'), v:`${m.maxDD}%`,       c:"#f87171"},
        {k:"var95", l:t('mr_var'),   v:`${m.var95}${perDay}`,c:"#f87171"},
        {k:"cvar95",l:t('mr_cvar'),  v:`${m.cvar95}${perDay}`,c:"#f87171"},
      ]},
      { title:t('ms_ratios'), rows:[
        {k:"sharpe", l:t('mr_sharpe'), v:m.sharpe, c:parseFloat(m.sharpe)>1?"#4ade80":parseFloat(m.sharpe)>0?"#fb923c":"#f87171"},
        {k:"sortino",l:t('mr_sortino'),v:m.sortino,c:parseFloat(m.sortino)>1?"#4ade80":parseFloat(m.sortino)>0?"#fb923c":"#f87171"},
        {k:"calmar", l:t('mr_calmar'), v:m.calmar, c:parseFloat(m.calmar)>1?"#4ade80":"#fb923c"},
        {k:"omega",  l:t('mr_omega'),  v:m.omega,  c:parseFloat(m.omega)>1?"#4ade80":parseFloat(m.omega)>0?"#fb923c":"#f87171"},
      ]},
      { title:t('ms_bench')(benchmarkLabel), rows:[
        {k:"beta",l:t('mr_beta'),v:m.beta,c:parseFloat(m.beta)>1?"#fb923c":"#38bdf8"},
        {k:"corr",l:t('mr_corr'),v:m.correlation,c:T.t2},
      ]},
    ];
    return <div>{sections.map(sec=>(
      <div key={sec.title} className="metric-section">
        <div className="metric-group-title">{sec.title}</div>
        {sec.rows.map(r=><MetricRow key={r.k} label={r.l} val={r.v} color={r.c} info={mi(r.k)} T={T}/>)}
      </div>
    ))}</div>;
  };

  const ConfigPanel = ()=>{
    const totalW = assets.reduce((a,b)=>a+(parseFloat(b.weight)||0),0);
    const weightOk = Math.abs(totalW-100)<0.05;

    function applyRiskParity(){
      if(assets.length<2){ notify(t('notif_need2'),"error"); return; }
      const d=PERIOD_DAYS["3M"];
      const vols=assets.map(({ticker})=>{
        const pr=getPrices(ticker,d);
        const dr=pr.slice(1).map((p,i)=>(p-pr[i])/pr[i]);
        const mean=dr.reduce((a,b)=>a+b,0)/dr.length;
        return Math.sqrt(dr.reduce((a,b)=>a+(b-mean)**2,0)/dr.length*252)||0.01;
      });
      const invVols=vols.map(v=>1/v); const sumInv=invVols.reduce((a,b)=>a+b,0);
      const raw=invVols.map(v=>v/sumInv*100);
      const rounded=raw.map((w,i)=>i<raw.length-1?parseFloat(w.toFixed(1)):0);
      rounded[rounded.length-1]=parseFloat((100-rounded.slice(0,-1).reduce((a,b)=>a+b,0)).toFixed(1));
      setAssets(prev=>prev.map((a,i)=>({...a,weight:rounded[i]})));
      notify(t('notif_rp'));
    }

    function applyMaxSharpe(){
      if(assets.length<2){ notify(t('notif_need2'),"error"); return; }
      const d=PERIOD_DAYS["1A"]; const n=assets.length;
      const allDr=assets.map(({ticker})=>{ const pr=getPrices(ticker,d); return pr.slice(1).map((p,i)=>(p-pr[i])/pr[i]); });
      const means=allDr.map(dr=>dr.reduce((a,b)=>a+b,0)/dr.length);
      const cov=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>allDr[i].reduce((a,r,k)=>a+(r-means[i])*(allDr[j][k]-means[j]),0)/d));
      const rf=0.02/252;
      let w=Array(n).fill(1/n);
      for(let iter=0;iter<500;iter++){
        const pRet=w.reduce((a,wi,i)=>a+wi*means[i],0);
        let pVar=0; for(let i=0;i<n;i++) for(let j=0;j<n;j++) pVar+=w[i]*w[j]*cov[i][j];
        const pVol=Math.sqrt(pVar)||1e-8;
        const grad=means.map((mu,i)=>{ let dc=0; for(let j=0;j<n;j++) dc+=w[j]*cov[i][j]; return((mu-rf)*pVol-(pRet-rf)*dc/pVol)/pVar; });
        w=w.map((wi,i)=>Math.max(0.01,wi+0.01*grad[i]));
        const s=w.reduce((a,b)=>a+b,0); w=w.map(wi=>wi/s);
      }
      const rounded=w.map((wi,i)=>i<n-1?parseFloat((wi*100).toFixed(1)):0);
      rounded[n-1]=parseFloat((100-rounded.slice(0,-1).reduce((a,b)=>a+b,0)).toFixed(1));
      setAssets(prev=>prev.map((a,i)=>({...a,weight:rounded[i]})));
      notify(t('notif_ms'));
    }

    return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* Editing indicator */}
      {editingPortfolioId&&(()=>{
        const ep=savedPortfolios.find(p=>p.id===editingPortfolioId);
        return <div style={{fontSize:9,color:"#fb923c",background:"#fb923c12",border:"1px solid #fb923c30",borderRadius:6,padding:"5px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{t('edit_ind')(ep?.name||"Portfolio")}</span>
          <button onClick={()=>{setEditingPortfolioId(null);setSaveName("");}} style={{background:"none",border:"none",color:"#fb923c",cursor:"pointer",fontSize:10}}>{t('edit_cancel')}</button>
        </div>;
      })()}

      {mode==="backtest"&&<div>
        <SL T={T}>{t('cfg_start_date')}</SL>
        <LocaleDateInput value={btStartDate} max={new Date().toISOString().split('T')[0]}
          onChange={e=>setBtStartDate(e.target.value)} T={T} darkMode={darkMode} lang={lang} />
      </div>}

      <div>
        <SL T={T}>{t('cfg_mode')}</SL>
        <div style={{display:"flex",gap:5}}>
          {[{id:"backtest",icon:"◀",lk:"mode_backtest"},{id:"monte_carlo",icon:"⟁",lk:"mode_mc"}].map(m=>(
            <button key={m.id} className={`mode-btn ${mode===m.id?"active":""}`}
              onClick={()=>{ setMode(m.id); if(isMobile) setPanelOpen(false); }}>
              <div style={{fontSize:13}}>{m.icon}</div><div>{t(m.lk)}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SL T={T}>{t('cfg_invest')}</SL>
        <input type="number" min="0" step="500" value={invest} onChange={e=>setInvest(parseFloat(e.target.value)||0)}
          style={{width:"100%",background:T.bg,border:`1px solid ${T.b2}`,color:T.t1,borderRadius:6,padding:"7px 11px",fontFamily:"'Space Mono'",fontSize:12,outline:"none"}} />
      </div>

      <div>
        <div style={{display:"flex",gap:5,marginBottom:8}}>
          {[{id:"sector",lk:"cfg_by_sector"},{id:"theme",lk:"cfg_by_theme"}].map(m=>(
            <button key={m.id} onClick={()=>{setPickerMode(m.id);setActiveSector("all");setActiveTheme(null);}}
              style={{flex:1,padding:"5px 8px",border:`1px solid ${pickerMode===m.id?"#4ade80":T.b2}`,borderRadius:6,background:pickerMode===m.id?"#4ade8012":"transparent",color:pickerMode===m.id?"#4ade80":T.t4,cursor:"pointer",fontFamily:"'Space Mono'",fontSize:9,transition:"all .12s"}}>
              {t(m.lk)}
            </button>
          ))}
        </div>
        {pickerMode==="sector"&&<>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
            {SECTORS.map(s=>(
              <button key={s.id} onClick={()=>setActiveSector(s.id)}
                style={{flexShrink:0,padding:"4px 9px",border:`1px solid ${activeSector===s.id?"#4ade80":T.b2}`,borderRadius:20,background:activeSector===s.id?"#4ade8012":"transparent",color:activeSector===s.id?"#4ade80":T.t4,cursor:"pointer",fontFamily:"'Space Mono'",fontSize:9,transition:"all .12s",whiteSpace:"nowrap"}}>
                {s.icon} {L.sectors?.[s.id]||s.label}
              </button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,maxHeight:200,overflowY:"auto",paddingRight:2}}>
            {PRESETS.filter(p=>activeSector==="all"||p.sector===activeSector).map(p=>{
              const used=!!assets.find(a=>a.ticker===p.ticker); const tc=TYPE_COLOR[p.type]||"#888";
              const capStr=p.cap>=1000?`${(p.cap/1000).toFixed(1)}T$`:`${p.cap}B$`;
              return(
                <button key={p.ticker}
                  onClick={()=>{ used ? removeAsset(p.ticker) : addAsset(p.ticker); }}
                  onMouseEnter={e=>{ if(used){e.currentTarget.style.borderColor="#f87171";e.currentTarget.style.background="#f8717112";e.currentTarget.querySelector(".added-lbl").textContent="× retirer";}}}
                  onMouseLeave={e=>{ if(used){e.currentTarget.style.borderColor="#4ade8055";e.currentTarget.style.background="#4ade8012";e.currentTarget.querySelector(".added-lbl").textContent="✓ "+t('cfg_added').replace("✓ ","");}}}
                  style={{display:"flex",flexDirection:"column",alignItems:"flex-start",padding:"7px 9px",border:`1px solid ${used?"#4ade8055":tc+"33"}`,borderRadius:7,background:used?"#4ade8012":tc+"08",cursor:"pointer",transition:"border-color .12s, background .12s",opacity:1,textAlign:"left"}}>
                  <div style={{display:"flex",justifyContent:"space-between",width:"100%",marginBottom:2}}>
                    <span style={{fontFamily:"'Space Mono'",fontSize:10,fontWeight:700,color:used?"#4ade80":T.t1}}>{p.ticker}</span>
                    <span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:tc+"22",color:tc,fontWeight:700,textTransform:"uppercase"}}>{p.type}</span>
                  </div>
                  <span style={{fontSize:9,color:T.t4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{p.name}</span>
                  <span style={{fontSize:8,color:T.b3,marginTop:2}}>{capStr}</span>
                  {used&&<span className="added-lbl" style={{fontSize:8,color:"#4ade8088",marginTop:1}}>{t('cfg_added')}</span>}
                </button>
              );
            })}
          </div>
        </>}
        {pickerMode==="theme"&&<>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
            {THEMES.map(th=>(
              <button key={th.id} onClick={()=>setActiveTheme(activeTheme===th.id?null:th.id)}
                style={{padding:"4px 9px",border:`1px solid ${activeTheme===th.id?th.color:th.color+"44"}`,borderRadius:20,background:activeTheme===th.id?th.color+"18":"transparent",color:activeTheme===th.id?th.color:th.color+"99",cursor:"pointer",fontFamily:"'Space Mono'",fontSize:9,transition:"all .12s",whiteSpace:"nowrap"}}>
                {th.icon} {L.themes?.[th.id]||th.label}
              </button>
            ))}
          </div>
          {activeTheme&&(()=>{
            const theme=THEMES.find(th=>th.id===activeTheme);
            const themed=PRESETS.filter(p=>p.themes?.includes(activeTheme));
            const thLabel=L.themes?.[activeTheme]||theme?.label||"";
            return(<div>
              <div style={{fontSize:9,color:theme.color,background:theme.color+"10",padding:"5px 9px",borderRadius:6,marginBottom:7,lineHeight:1.5}}>
                {theme.icon} <strong>{thLabel}</strong> — {themed.length}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,maxHeight:180,overflowY:"auto"}}>
                {themed.map(p=>{
                  const used=!!assets.find(a=>a.ticker===p.ticker); const tc=TYPE_COLOR[p.type]||"#888";
                  const capStr=p.cap>=1000?`${(p.cap/1000).toFixed(1)}T$`:`${p.cap}B$`;
                  return(
                    <button key={p.ticker}
                      onClick={()=>{ used ? removeAsset(p.ticker) : addAsset(p.ticker); }}
                      onMouseEnter={e=>{ if(used){e.currentTarget.style.borderColor="#f87171";e.currentTarget.style.background="#f8717112";e.currentTarget.querySelector(".added-lbl").textContent="× retirer";}}}
                      onMouseLeave={e=>{ if(used){e.currentTarget.style.borderColor="#4ade8055";e.currentTarget.style.background="#4ade8012";e.currentTarget.querySelector(".added-lbl").textContent="✓ "+t('cfg_added').replace("✓ ","");}}}
                      style={{display:"flex",flexDirection:"column",alignItems:"flex-start",padding:"7px 9px",border:`1px solid ${used?"#4ade8055":tc+"33"}`,borderRadius:7,background:used?"#4ade8012":tc+"08",cursor:"pointer",transition:"border-color .12s, background .12s",opacity:1,textAlign:"left"}}>
                      <div style={{display:"flex",justifyContent:"space-between",width:"100%",marginBottom:2}}>
                        <span style={{fontFamily:"'Space Mono'",fontSize:10,fontWeight:700,color:used?"#4ade80":T.t1}}>{p.ticker}</span>
                        <span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:tc+"22",color:tc,fontWeight:700,textTransform:"uppercase"}}>{p.type}</span>
                      </div>
                      <span style={{fontSize:9,color:T.t4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{p.name}</span>
                      <span style={{fontSize:8,color:T.b3,marginTop:2}}>{capStr}</span>
                      {used&&<span className="added-lbl" style={{fontSize:8,color:"#4ade8088",marginTop:1}}>{t('cfg_added')}</span>}
                    </button>
                  );
                })}
              </div>
            </div>);
          })()}
          {!activeTheme&&<div style={{height:60,display:"flex",alignItems:"center",justifyContent:"center",color:T.b3,fontSize:10}}>{t('cfg_theme_hint')}</div>}
        </>}
      </div>

      {(()=>{
        const suggestions = custom.length>0
          ? PRESETS.filter(p=>p.ticker.startsWith(custom)||p.ticker.includes(custom)||p.name.toUpperCase().includes(custom)).slice(0,8)
          : [];
        const doAdd = (ticker)=>{ addAsset(ticker); setCustom(""); setSuggestionIdx(-1); setCustomFocused(false); };
        return (
        <div style={{display:"flex",gap:6}}>
          <div style={{flex:1,position:"relative"}}>
            <input value={custom}
              onChange={e=>{ setCustom(e.target.value.toUpperCase()); setSuggestionIdx(-1); }}
              onFocus={()=>setCustomFocused(true)}
              onBlur={()=>setTimeout(()=>setCustomFocused(false),150)}
              onKeyDown={e=>{
                if(e.key==="ArrowDown"){ e.preventDefault(); setSuggestionIdx(i=>Math.min(i+1,suggestions.length-1)); }
                else if(e.key==="ArrowUp"){ e.preventDefault(); setSuggestionIdx(i=>Math.max(i-1,-1)); }
                else if(e.key==="Escape"){ setCustom(""); setSuggestionIdx(-1); }
                else if(e.key==="Enter"){ if(suggestionIdx>=0&&suggestions[suggestionIdx]) doAdd(suggestions[suggestionIdx].ticker); else doAdd(custom); }
              }}
              placeholder={t('cfg_ticker_ph')}
              style={{width:"100%",background:T.bg,border:`1px solid ${customFocused&&suggestions.length?"#4ade80":T.b2}`,color:T.t1,borderRadius:customFocused&&suggestions.length?"6px 6px 0 0":6,padding:"7px 10px",fontFamily:"'Space Mono'",fontSize:11,outline:"none",transition:"border-color .12s"}}
            />
            {customFocused&&suggestions.length>0&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:T.bg2,border:`1px solid #4ade80`,borderTop:"none",borderRadius:"0 0 6px 6px",zIndex:60,overflow:"hidden",boxShadow:`0 8px 24px ${darkMode?"#0009":"#0002"}`}}>
                {suggestions.map((p,i)=>{
                  const tc=TYPE_COLOR[p.type]||"#888"; const used=!!assets.find(a=>a.ticker===p.ticker);
                  return(
                    <div key={p.ticker} onMouseDown={()=>{ if(!used) doAdd(p.ticker); }}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",cursor:used?"default":"pointer",background:i===suggestionIdx?T.b2:"transparent",borderBottom:i<suggestions.length-1?`1px solid ${T.b1}`:"none",transition:"background .08s"}}>
                      <span style={{fontFamily:"'Space Mono'",fontSize:11,fontWeight:700,color:used?T.t5:T.t1,minWidth:58,flexShrink:0}}>{p.ticker}</span>
                      <span style={{fontSize:9,color:T.t4,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                      <span style={{fontSize:7,padding:"2px 5px",borderRadius:3,background:tc+"22",color:tc,fontWeight:700,textTransform:"uppercase",flexShrink:0}}>{p.type}</span>
                      {used&&<span style={{fontSize:8,color:"#4ade8077",flexShrink:0}}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button onMouseDown={()=>doAdd(custom)} style={{background:T.b2,border:"none",color:"#4ade80",borderRadius:6,padding:"0 12px",cursor:"pointer",fontSize:17,flexShrink:0}}>+</button>
        </div>
        );
      })()}

      {assets.length>0&&<div>
        <SL mb={6} T={T}>{t('cfg_composition')}</SL>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4,marginBottom:9}}>
          {[
            {lk:"opt_equal", icon:"÷", dk:"opt_equal_d", action:()=>setAssets(prev=>reequalize(prev))},
            {lk:"opt_rp",    icon:"⚖", dk:"opt_rp_d",    action:applyRiskParity},
            {lk:"opt_ms",    icon:"◎", dk:"opt_ms_d",    action:applyMaxSharpe},
          ].map(({lk,icon,dk,action})=>{
            const isAct=selectedOptim===lk;
            return(
            <button key={lk} onClick={()=>{setSelectedOptim(lk);action();}}
              style={{padding:"7px 4px",border:`1px solid ${isAct?"#4ade80":T.b2}`,borderRadius:7,background:isAct?"#4ade8012":"transparent",color:isAct?"#4ade80":T.t4,cursor:"pointer",fontFamily:"'Space Mono'",fontSize:9,textAlign:"center",lineHeight:1.5,transition:"all .12s",boxShadow:isAct?"0 0 0 1px #4ade8033":undefined}}
              onMouseEnter={e=>{if(!isAct){e.currentTarget.style.borderColor="#4ade80";e.currentTarget.style.color="#4ade80";}}}
              onMouseLeave={e=>{if(!isAct){e.currentTarget.style.borderColor=T.b2;e.currentTarget.style.color=T.t4;}}}>
              <div style={{fontSize:14,marginBottom:1}}>{icon}</div>
              <div style={{fontWeight:700,fontSize:9}}>{t(lk)}</div>
              <div style={{fontSize:7,color:isAct?"#4ade8088":T.t5,marginTop:1}}>{t(dk)}</div>
            </button>
            );
          })}
        </div>
        {assets.map(({ticker,weight})=>{
          const meta=ASSET_PARAMS[ticker]; const type=meta?.type||"action";
          const tc=TYPE_COLOR[type]||"#4ade80";
          return(
            <div key={ticker} className="arow">
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:11,color:T.t1}}>{ticker}</div>
                <div style={{fontSize:9,color:T.t5}}>{meta?.name||"—"}</div>
              </div>
              <span className="tag" style={{background:tc+"18",color:tc}}>{type}</span>
              <input type="number" min="0" max="100" step="0.1" className="w-in"
                value={weight} onChange={e=>setWeight(ticker,e.target.value)} />
              <span style={{color:T.t3,fontSize:11}}>%</span>
              <button onClick={()=>removeAsset(ticker)} style={{background:"none",border:"none",color:T.b2,cursor:"pointer",fontSize:15}} className="del-btn">×</button>
            </div>
          );
        })}
        <div style={{display:"flex",justifyContent:"flex-end",gap:6,alignItems:"center",marginTop:4}}>
          <span style={{fontSize:9,color:T.t4}}>{t('cfg_total')}</span>
          <span style={{fontFamily:"'Space Mono'",fontWeight:700,color:weightOk?"#4ade80":"#f87171",fontSize:13}}>{totalW.toFixed(1)}%</span>
          {!weightOk&&<span style={{fontSize:9,color:"#f87171"}}>≠ 100</span>}
        </div>
      </div>}

      {isMobile&&<div style={{display:"flex",gap:8}}>
        <button className="run" style={{flex:1}} onClick={()=>setPanelOpen(false)} disabled={!weightOk||!assets.length}>
          {mode==="backtest"?t('btn_run_bt'):t('btn_run_mc')}
        </button>
        <button className="save-btn" disabled={!weightOk||!assets.length} onClick={()=>{
          const auto=`Portfolio #${savedPortfolios.length+1} · ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}`;
          setSaveName(editingPortfolioId?saveName:auto); setSaveModalOpen(true);
        }}>💾</button>
      </div>}
      {!weightOk&&assets.length>0&&<div style={{fontSize:9,color:"#f87171",textAlign:"center"}}>{t('cfg_weight_err')}</div>}
    </div>
  );};

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.t1,fontFamily:"'Space Mono','Courier New',monospace"}}>
      <style>{css}</style>

      {/* NOTIFICATION */}
      {notification&&<div className="notif" style={{background:notification.type==="error"?"#f8717122":"#4ade8022",border:`1px solid ${notification.type==="error"?"#f87171":"#4ade80"}`,color:notification.type==="error"?"#f87171":"#4ade80"}}>{notification.msg}</div>}

      {/* TUTORIAL MODAL */}
      {tutorialOpen&&<TutorialModal lang={lang} setLang={setLang} T={T} onClose={()=>setTutorialOpen(false)}/>}

      {/* SAVE MODAL */}
      {saveModalOpen&&<div className="modal-bg" onClick={()=>setSaveModalOpen(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div style={{fontFamily:"'Unbounded'",fontSize:14,fontWeight:700,marginBottom:16,color:T.t1}}>{t('save_title')}</div>
          <SL T={T}>{t('save_name_lbl')}</SL>
          <input value={saveName} onChange={e=>setSaveName(e.target.value)}
            style={{width:"100%",background:T.bg,border:`1px solid ${T.b2}`,color:T.t1,borderRadius:6,padding:"8px 12px",fontFamily:"'Space Mono'",fontSize:12,outline:"none",marginBottom:12}}
            placeholder={t('save_name_ph')} />
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setSaveModalOpen(false)} style={{flex:1,padding:"10px",border:`1px solid ${T.b2}`,background:"transparent",color:T.t3,borderRadius:6,cursor:"pointer",fontFamily:"'Space Mono'",fontSize:11}}>{t('save_cancel')}</button>
            <button onClick={savePortfolio} className="run" style={{flex:2,padding:"10px"}}>{editingPortfolioId?t('save_update'):t('save_confirm')}</button>
          </div>
        </div>
      </div>}

      {/* MOBILE DRAWER */}
      {isMobile&&panelOpen&&<>
        <div className="drawer-overlay" onClick={()=>setPanelOpen(false)} />
        <div className="drawer">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:11,fontWeight:700,color:T.t1}}>{t('drawer_title')}</span>
            <button onClick={()=>setPanelOpen(false)} style={{background:"none",border:"none",color:T.t4,cursor:"pointer",fontSize:20}}>×</button>
          </div>
          {ConfigPanel()}
        </div>
      </>}

      {/* HEADER */}
      <div style={{borderBottom:`1px solid ${T.b1}`,padding:isMobile?"10px 12px":"14px 24px",display:"flex",alignItems:"center",gap:isMobile?5:12}}>
        <span style={{fontFamily:"'Unbounded'",fontSize:isMobile?15:20,fontWeight:900,letterSpacing:-0.5,color:T.t1,flexShrink:0}}>INDEX LAB</span>
        {!isMobile&&<span style={{marginLeft:"auto",fontSize:9,color:priceData?"#4ade80":T.b3}}>
          {priceData ? t('data_real')(priceData.updated, Object.keys(priceData.raw||{}).length) : t('data_sim')}
        </span>}
        <div style={{display:"flex",gap:3,marginLeft:isMobile?"auto":0,flexShrink:0}}>
          {[{code:"en",flag:"🇬🇧"},{code:"es",flag:"🇪🇸"},{code:"fr",flag:"🇫🇷"}].map(({code,flag})=>(
            <button key={code} onClick={()=>setLang(code)} style={{background:lang===code?T.b2:"transparent",border:`1px solid ${lang===code?T.b3:T.b1}`,borderRadius:5,padding:"2px 5px",cursor:"pointer",fontSize:isXS?12:14,color:T.t1,opacity:lang===code?1:0.45,lineHeight:1}}>{flag}</button>
          ))}
        </div>
        <button
          onClick={()=>setDarkMode(d=>!d)}
          style={{background:"transparent",border:`1px solid ${T.b2}`,color:T.t3,borderRadius:6,padding:isMobile?"5px 7px":"4px 10px",cursor:"pointer",fontFamily:"'Space Mono'",fontSize:isMobile?13:10,transition:"all .12s",whiteSpace:"nowrap",flexShrink:0}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#4ade80";e.currentTarget.style.color="#4ade80";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b2;e.currentTarget.style.color=T.t3;}}
        >{isMobile?(darkMode?"☀":"◑"):(darkMode?t('light_mode'):t('dark_mode'))}</button>
        {!isXS&&<button
          onClick={()=>setTutorialOpen(true)}
          title="Tutorial"
          style={{background:"transparent",border:`1px solid ${T.b2}`,color:T.t4,borderRadius:"50%",width:28,height:28,cursor:"pointer",fontFamily:"serif",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .12s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="#4ade80";e.currentTarget.style.color="#4ade80";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b2;e.currentTarget.style.color=T.t4;}}>?</button>}
        {isMobile&&<button onClick={()=>setPanelOpen(true)} style={{background:T.b2,border:"none",color:"#4ade80",borderRadius:6,padding:"5px 8px",cursor:"pointer",fontFamily:"'Space Mono'",fontSize:isXS?9:10,flexShrink:0}}>⚙</button>}
      </div>

      {/* TABS */}
      <div style={{borderBottom:`1px solid ${T.b1}`,padding:isMobile?"0 10px":"0 24px",display:"flex",gap:0}}>
        {TABS.map(tb=><button key={tb.id} className={`tab-btn ${tab===tb.id?"active":""}`} onClick={()=>setTab(tb.id)}>{tb.id==="builder"?t('tab_builder'):tb.id==="compare"?t('tab_compare'):t('tab_track')}</button>)}
        {savedPortfolios.length>0&&<span style={{marginLeft:"auto",alignSelf:"center",fontSize:9,color:"#4ade80",fontFamily:"'Space Mono'"}}>{t('saved_count')(savedPortfolios.length)}</span>}
      </div>

      <div style={{display:"flex",maxWidth:1200,margin:"0 auto",padding:isMobile?"0 12px":"0 20px"}}>

        {/* LEFT PANEL (desktop only) */}
        {!isMobile&&tab==="builder"&&(
          <div style={{width:260,flexShrink:0,paddingTop:16,paddingRight:14,borderRight:`1px solid ${T.b1}`}}>
            {ConfigPanel()}
          </div>
        )}

        {/* MAIN CONTENT */}
        <div style={{flex:1,paddingTop:16,minWidth:0,paddingLeft:isMobile?0:16}}>

          {/* ═══════════════ BUILDER TAB ═══════════════ */}
          {tab==="builder"&&<>

            {/* ── INLINE PERIOD / HORIZON SELECTOR ── */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
              <span style={{fontSize:9,color:T.t4,letterSpacing:2,textTransform:"uppercase",whiteSpace:"nowrap"}}>
                {mode==="backtest"?t('period_lbl'):t('horizon_lbl')}
              </span>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {mode==="backtest"
                  ?Object.keys(PERIOD_DAYS).map(p=>(
                      <button key={p} className={`pill ${period===p?"active":""}`} onClick={()=>setPeriod(p)}>{p}</button>
                    ))
                  :["6M","1A","3A","5A"].map(h=>(
                      <button key={h} className={`pill ${horizon===h?"active":""}`} onClick={()=>setHorizon(h)}>{h}</button>
                    ))
                }
              </div>
              {!isMobile&&(
                <button className="save-btn" style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,padding:"5px 14px"}}
                  disabled={!weightOk||!assets.length}
                  onClick={()=>{
                    const auto=`Portfolio #${savedPortfolios.length+1} · ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})}`;
                    setSaveName(editingPortfolioId?saveName:auto); setSaveModalOpen(true);
                  }}>
                  <span>💾</span>
                  <span style={{fontSize:10}}>{editingPortfolioId?t('save_update').replace(" ✓",""):t('save_confirm').replace(" ✓","")}</span>
                </button>
              )}
            </div>

            {/* ── BENCHMARK SELECTOR ── */}
            {mode==="backtest"&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
              <span style={{fontSize:9,color:T.t4,letterSpacing:2,textTransform:"uppercase",whiteSpace:"nowrap"}}>Benchmark :</span>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {BENCHMARKS.map(b=>(
                  <button key={b.ticker} className={`pill ${benchmark===b.ticker?"active":""}`} onClick={()=>setBenchmark(b.ticker)}>{b.label}</button>
                ))}
              </div>
            </div>}

            {/* BACKTEST */}
            {mode==="backtest"&&(!chartData.length?<Empty T={T} label={t('empty_launch')}/>:<>
              {/* KPIs top row */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:8,marginBottom:14}}>
                {[
                  {l:t('kpi_perf'),v:`${parseFloat(metrics?.totalReturn||0)>=0?"+":""}${metrics?.totalReturn||"—"}%`,c:parseFloat(metrics?.totalReturn||0)>=0?"#4ade80":"#f87171",s:invest>0?`→ ${(invest*(1+parseFloat(metrics?.totalReturn||0)/100)).toFixed(0)} €`:period},
                  {l:t('kpi_sharpe'),v:metrics?.sharpe||"—",c:parseFloat(metrics?.sharpe||0)>1?"#4ade80":parseFloat(metrics?.sharpe||0)>0?"#fb923c":"#f87171",s:t('kpi_sharpe_sub')},
                  {l:t('kpi_maxdd'),v:`${metrics?.maxDD||"—"}%`,c:"#f87171",s:t('kpi_maxdd_sub')},
                  {l:t('kpi_alpha'),v:`${parseFloat(metrics?.alpha||0)>=0?"+":""}${metrics?.alpha||"—"}%`,c:parseFloat(metrics?.alpha||0)>=0?"#4ade80":"#f87171",s:t('kpi_alpha_sub')(benchmarkLabel)},
                ].map(({l,v,c,s})=>(
                  <div key={l} className="card">
                    <div style={{fontSize:8,color:T.t4,letterSpacing:2,textTransform:"uppercase",marginBottom:3}}>{l}</div>
                    <div style={{fontFamily:"'Unbounded'",fontSize:isMobile?17:20,color:c,fontWeight:700}}>{v}</div>
                    <div style={{fontSize:8,color:T.t5,marginTop:2}}>{s}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="card" style={{marginBottom:12}}>
                <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>{t('ch_perf_vs_sp')(benchmarkLabel)}</div>
                <ResponsiveContainer width="100%" height={CH}>
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isPos?"#4ade80":"#f87171"} stopOpacity={0.15}/>
                        <stop offset="100%" stopColor={isPos?"#4ade80":"#f87171"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48} tickFormatter={d=>d&&d.length>=10?`${d.slice(8)} ${moisArr[parseInt(d.slice(5,7))-1]}`:d}/>
                    <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?"+":""}${v.toFixed(0)}%`} width={42}/>
                    <Tooltip content={<ChartTooltip invest={invest} T={T} mois={moisArr}/>}/>
                    <ReferenceLine y={0} stroke={T.b2} strokeDasharray="4 3"/>
                    <Line type="monotone" dataKey="bench" stroke={T.b2} strokeWidth={1.5} dot={false} name={benchmarkLabel} strokeDasharray="4 2"/>
                    <Line type="monotone" dataKey="value" stroke={isPos?"#4ade80":"#f87171"} strokeWidth={2.5} dot={false} name={t('my_index')} activeDot={{r:4}}/>
                  </LineChart>
                </ResponsiveContainer>
                <div style={{display:"flex",gap:14,marginTop:8}}>
                  {[{c:isPos?"#4ade80":"#f87171",l:t('my_index')},{c:T.b2,l:benchmarkLabel,dash:true}].map(({c,l,dash})=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:16,height:2,background:c,borderRadius:1,borderTop:dash?"1px dashed":"none"}}/>
                      <span style={{fontSize:9,color:T.t4}}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attribution panel */}
              <div className="card" style={{marginBottom:12}}>
                <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:14}}>{t('ch_attribution')}</div>

                <div style={{marginBottom:18}}>
                  <div style={{fontSize:9,color:T.t2,marginBottom:10}}>{t('ch_contrib_rend')}</div>
                  {[...assetPerfs].sort((a,b)=>b.contribution-a.contribution).map(({ticker,weight,perf,contribution})=>{
                    const meta=ASSET_PARAMS[ticker]; const type=meta?.type||"action";
                    const tc=TYPE_COLOR[type]; const isPos=contribution>=0;
                    const totalContrib = assetPerfs.reduce((a,b)=>a+Math.abs(b.contribution),0)||1;
                    const barW = Math.abs(contribution)/totalContrib*100;
                    const role = contribution === Math.max(...assetPerfs.map(a=>a.contribution)) ? t('role_engine') :
                                 contribution === Math.min(...assetPerfs.map(a=>a.contribution)) ? t('role_drag') : null;
                    return(
                      <div key={ticker} style={{marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:4}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            <span style={{fontFamily:"'Space Mono'",fontSize:11,fontWeight:700,color:T.t1}}>{ticker}</span>
                            <span className="tag" style={{background:tc+"18",color:tc}}>{type}</span>
                            {!isMobile&&<span style={{fontSize:9,color:T.t5}}>{weight}% du portefeuille</span>}
                            {role&&<span style={{fontSize:9,color:isPos?"#4ade80":"#f87171",background:isPos?"#4ade8010":"#f8717110",padding:"1px 6px",borderRadius:3}}>{role}</span>}
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            {!isMobile&&<span style={{fontSize:9,color:T.t4}}>{parseFloat(perf)>=0?"+":""}{perf}% {t('attr_alone')}</span>}
                            <span style={{fontFamily:"'Space Mono'",fontSize:12,fontWeight:700,color:isPos?"#4ade80":"#f87171",minWidth:55,textAlign:"right"}}>
                              {contribution>=0?"+":""}{contribution.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                        <div style={{height:6,background:T.b1,borderRadius:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${barW}%`,background:isPos?`linear-gradient(90deg,${tc}88,${tc})`:"linear-gradient(90deg,#f8717188,#f87171)",borderRadius:4,transition:"width .4s ease"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{borderTop:`1px solid ${T.b1}`,paddingTop:14}}>
                  <div style={{fontSize:9,color:T.t2,marginBottom:10}}>{t('ch_contrib_risk')}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                    {riskContribs?.map(({ticker,riskContrib})=>{
                      const perf = assetPerfs.find(a=>a.ticker===ticker);
                      const meta=ASSET_PARAMS[ticker]; const type=meta?.type||"action"; const tc=TYPE_COLOR[type];
                      const nominalWeight = parseFloat(perf?.weight||0);
                      const diff = riskContrib - nominalWeight;
                      return(
                        <div key={ticker} style={{flex:"1 1 120px",background:T.b1,borderRadius:8,padding:"9px 11px",border:`1px solid ${Math.abs(diff)>10?"#f8717133":T.b1}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{fontSize:11,fontWeight:700,fontFamily:"'Space Mono'",color:T.t1}}>{ticker}</span>
                            <span className="tag" style={{background:tc+"18",color:tc}}>{type}</span>
                          </div>
                          <div style={{marginBottom:5}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:T.t4,marginBottom:2}}>
                              <span>Poids</span><span>{nominalWeight}%</span>
                            </div>
                            <div style={{height:4,background:T.bg2,borderRadius:2,overflow:"hidden",marginBottom:4}}>
                              <div style={{height:"100%",width:`${nominalWeight}%`,background:"#38bdf8",borderRadius:2}}/>
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:T.t4,marginBottom:2}}>
                              <span>Risque</span><span style={{color:Math.abs(diff)>10?"#f87171":T.t2}}>{riskContrib.toFixed(1)}%</span>
                            </div>
                            <div style={{height:4,background:T.bg2,borderRadius:2,overflow:"hidden"}}>
                              <div style={{height:"100%",width:`${Math.min(riskContrib,100)}%`,background:riskContrib>nominalWeight?"#f87171":"#4ade80",borderRadius:2}}/>
                            </div>
                          </div>
                          {Math.abs(diff)>10&&(
                            <div style={{fontSize:8,color:diff>0?"#f87171":"#4ade80",marginTop:3,lineHeight:1.4}}>
                              {diff>0?t('rc_excess')(diff.toFixed(0)):t('rc_under')(Math.abs(diff).toFixed(0))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{fontSize:8,color:T.b3,lineHeight:1.6}}>{t('attr_rc_legend')}</div>
                </div>
              </div>

              {/* Metrics + asset mini-cards */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
                <div className="card">
                  <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>{t('ch_metrics')}</div>
                  <MetricsPanel m={metrics}/>
                </div>
                <div>
                  <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:8}}>{t('ch_assets_ind')}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:6}}>
                    {assetPerfs.map(({ticker,weight,perf,contribution})=>{
                      const meta=ASSET_PARAMS[ticker]; const type=meta?.type||"action"; const p=parseFloat(perf);
                      const rc = riskContribs?.find(r=>r.ticker===ticker)?.riskContrib??0;
                      const isMoteur = contribution===Math.max(...assetPerfs.map(a=>a.contribution));
                      const isFrein  = contribution===Math.min(...assetPerfs.map(a=>a.contribution));
                      return <div key={ticker} className="card" style={{padding:"9px 11px",border:`1px solid ${isMoteur?"#4ade8033":isFrein?"#f8717133":T.b1}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:10,fontWeight:700,color:T.t1}}>{ticker}</span>
                          <span className="tag" style={{background:TYPE_COLOR[type]+"18",color:TYPE_COLOR[type]}}>{type}</span>
                        </div>
                        <div style={{fontFamily:"'Unbounded'",fontSize:16,color:p>=0?"#4ade80":"#f87171",fontWeight:700}}>{p>=0?"+":""}{perf}%</div>
                        <div style={{fontSize:8,color:T.t4,marginTop:2}}>{t('asset_poids')} {weight}%</div>
                        <div style={{fontSize:8,color:contribution>=0?"#4ade8099":"#f8717199",marginTop:1}}>
                          {t('asset_contrib')} {contribution>=0?"+":""}{contribution.toFixed(2)}%
                        </div>
                        <div style={{fontSize:8,color:"#fb923c99",marginTop:1}}>{t('asset_risque')} {rc.toFixed(1)}%</div>
                        {invest>0&&<div style={{fontSize:8,color:T.t5,marginTop:1}}>→ {(invest*(parseFloat(weight)||0)/100*(1+p/100)).toFixed(0)} €</div>}
                        {isMoteur&&<div style={{fontSize:8,color:"#4ade80",marginTop:3}}>{t('role_engine')}</div>}
                        {isFrein&&<div style={{fontSize:8,color:"#f87171",marginTop:3}}>{t('role_drag')}</div>}
                      </div>;
                    })}
                  </div>
                </div>
              </div>
            </>)}

            {/* MONTE CARLO */}
            {mode==="monte_carlo"&&(!mcData.length?<Empty T={T} label={t('empty_launch')}/>:<>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(3,1fr)",gap:8,marginBottom:14}}>
                {[
                  {l:t('mc_opt'),v:lastMC?.p90,c:"#4ade80"},
                  {l:t('mc_med'),v:lastMC?.median,c:"#22d3ee"},
                  {l:t('mc_pess'),v:lastMC?.p10,c:"#f87171"},
                ].map(({l,v,c})=>(
                  <div key={l} className="card">
                    <div style={{fontSize:8,color:T.t4,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{l}</div>
                    <div style={{fontFamily:"'Unbounded'",fontSize:isMobile?16:19,color:c,fontWeight:700}}>
                      {v!=null?`${v>=0?"+":""}${v.toFixed(1)}%`:"—"}
                    </div>
                    {invest>0&&v!=null&&<div style={{fontSize:9,color:T.t4,marginTop:2}}>→ {(invest*(1+v/100)).toFixed(0)} €</div>}
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>{t('ch_mc')(horizon)}</div>
                <ResponsiveContainer width="100%" height={CH}>
                  <ComposedChart data={mcData}>
                    <defs><linearGradient id="mcg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity={0.1}/>
                      <stop offset="100%" stopColor="#4ade80" stopOpacity={0.01}/>
                    </linearGradient></defs>
                    <XAxis dataKey="date" tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48}/>
                    <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?"+":""}${v.toFixed(0)}%`} width={44}/>
                    <Tooltip content={<ChartTooltip invest={invest} T={T}/>}/>
                    <ReferenceLine y={0} stroke={T.b2} strokeDasharray="4 3"/>
                    <Area type="monotone" dataKey="p90" stroke="none" fill="url(#mcg)" fillOpacity={1}/>
                    <Area type="monotone" dataKey="p10" stroke="none" fill={T.bg2} fillOpacity={1}/>
                    <Line type="monotone" dataKey="p90" stroke="#4ade8044" strokeWidth={1} dot={false} strokeDasharray="3 3" name={t('mc_opt')}/>
                    <Line type="monotone" dataKey="p10" stroke="#f8717144" strokeWidth={1} dot={false} strokeDasharray="3 3" name={t('mc_pess')}/>
                    <Line type="monotone" dataKey="median" stroke="#4ade80" strokeWidth={2.5} dot={false} activeDot={{r:4}} name={t('mc_med')}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>)}

            {isMobile&&<div style={{height:80}}/>}
          </>}

          {/* ═══════════════ COMPARE TAB ═══════════════ */}
          {tab==="compare"&&<>
            {savedPortfolios.length===0?(
              <div style={{height:300,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,color:T.b2}}>
                <div style={{fontSize:40}}>◫</div>
                <div style={{fontSize:10,letterSpacing:2,color:T.t2}}>{t('cmp_none')}</div>
                <div style={{fontSize:9,color:T.t6,marginTop:4}}>{t('cmp_none_sub')}</div>
              </div>
            ):<>
              {/* Portfolio selector */}
              <div className="card" style={{marginBottom:14}}>
                <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>{t('cmp_saved')}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {savedPortfolios.map(p=>(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:7,border:`1px solid ${selectedCompare.includes(p.id)?"#4ade80":T.b1}`,background:selectedCompare.includes(p.id)?"#4ade8014":"transparent",cursor:"pointer",transition:"all .12s"}}
                      onMouseEnter={e=>{if(!selectedCompare.includes(p.id)){e.currentTarget.style.borderColor="#4ade8055";e.currentTarget.style.background="#4ade8008";}}}
                      onMouseLeave={e=>{if(!selectedCompare.includes(p.id)){e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.background="transparent";}}}
                      onClick={()=>toggleCompare(p.id)}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:selectedCompare.includes(p.id)?"#4ade80":T.t1}}>{p.name}</div>
                        <div style={{fontSize:9,color:T.t4}}>{p.assets.map(a=>`${a.ticker} ${a.weight}%`).join(" · ")}</div>
                      </div>
                      {!isMobile&&<div style={{fontSize:8,color:T.t6,whiteSpace:"nowrap"}}>{new Date(p.savedAt).toLocaleDateString("fr-FR")}</div>}
                      <button onClick={e=>{e.stopPropagation();loadPortfolio(p);}} style={{background:"none",border:`1px solid ${T.b3}`,color:T.t3,cursor:"pointer",fontSize:10,padding:"2px 7px",borderRadius:4,fontFamily:"'Space Mono'",whiteSpace:"nowrap",transition:"all .12s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="#fb923c";e.currentTarget.style.color="#fb923c";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b3;e.currentTarget.style.color=T.t3;}}>✎</button>
                      <button className="del-btn" onClick={e=>{e.stopPropagation();deletePortfolio(p.id);}}>×</button>
                    </div>
                  ))}
                </div>
                {savedPortfolios.length>0&&<div style={{fontSize:9,color:T.t4,marginTop:8}}>{t('cmp_hint')(selectedCompare.length)}</div>}
              </div>

              {/* Period selector for compare */}
              <div style={{marginBottom:8}}>
                <SL T={T}>{t('cmp_period')}</SL>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {Object.keys(PERIOD_DAYS).map(p=><button key={p} className={`pill ${period===p?"active":""}`} onClick={()=>setPeriod(p)}>{p}</button>)}
                </div>
              </div>

              {/* Benchmark selector for compare */}
              <div style={{marginBottom:14}}>
                <SL T={T}>Benchmark</SL>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {BENCHMARKS.map(b=>(
                    <button key={b.ticker} className={`pill ${benchmark===b.ticker?"active":""}`} onClick={()=>setBenchmark(b.ticker)}>{b.label}</button>
                  ))}
                </div>
              </div>

              {selectedCompare.length>=1&&compareData.chart.length>0&&<>
                {/* Superposed chart */}
                <div className="card" style={{marginBottom:12}}>
                  <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>{t('cmp_chart')}</div>
                  <ResponsiveContainer width="100%" height={CH+20}>
                    <LineChart data={compareData.chart}>
                      <XAxis dataKey="date" tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48} tickFormatter={d=>d&&d.length>=10?`${d.slice(8)} ${moisArr[parseInt(d.slice(5,7))-1]}`:d}/>
                      <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?"+":""}${v.toFixed(0)}%`} width={44}/>
                      <Tooltip content={<ChartTooltip invest={invest} T={T} mois={moisArr}/>}/>
                      <ReferenceLine y={0} stroke={T.b2} strokeDasharray="4 3"/>
                      <Line type="monotone" dataKey="bench" stroke={T.b2} strokeWidth={1.5} dot={false} name={benchmarkLabel} strokeDasharray="4 2"/>
                      {compareData.names?.map(({id,name,color})=>(
                        <Line key={id} type="monotone" dataKey={id} stroke={color} strokeWidth={2} dot={false} name={name} activeDot={{r:3}}/>
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:16,height:1,background:T.b2,borderTop:`1px dashed ${T.b2}`}}/>
                      <span style={{fontSize:9,color:T.t4}}>{benchmarkLabel}</span>
                    </div>
                    {compareData.names?.map(({id,name,color})=>(
                      <div key={id} style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:16,height:2,background:color,borderRadius:1}}/>
                        <span style={{fontSize:9,color:T.t2}}>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics comparison table */}
                <div className="card">
                  <div style={{fontSize:8,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:12}}>{t('cmp_table')}</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Space Mono'",fontSize:10}}>
                      <thead>
                        <tr style={{borderBottom:`1px solid ${T.b2}`}}>
                          <td style={{padding:"6px 8px",color:T.t4,fontSize:8,textTransform:"uppercase",letterSpacing:1}}>{t('cmp_table_hdr')}</td>
                          <td style={{padding:"6px 8px",color:T.t2,fontSize:9,textAlign:"right"}}>{benchmarkLabel}</td>
                          {compareData.metricsTable?.map(p=>(
                            <td key={p.id} style={{padding:"6px 8px",color:p.color,fontSize:9,textAlign:"right",whiteSpace:"nowrap"}}>
                              {p.name.length>12?p.name.slice(0,12)+"…":p.name}
                            </td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(()=>{const perDay=lang==="fr"?"%/j":"%/d"; return [
                          {k:"totalReturn",l:t('ct_perf'),fmt:v=>`${parseFloat(v)>=0?"+":""}${v}%`,best:"max",ik:"perf"},
                          {k:"annReturn",l:t('ct_ann'),fmt:v=>`${parseFloat(v)>=0?"+":""}${v}%`,best:"max",ik:"ann"},
                          {k:"sharpe",l:t('ct_sharpe'),fmt:v=>v,best:"max",ik:"sharpe"},
                          {k:"sortino",l:t('ct_sortino'),fmt:v=>v,best:"max",ik:"sortino"},
                          {k:"calmar",l:t('ct_calmar'),fmt:v=>v,best:"max",ik:"calmar"},
                          {k:"omega", l:t('ct_omega'), fmt:v=>v,best:"max",ik:"omega"},
                          {k:"maxDD",l:t('ct_maxdd'),fmt:v=>`${v}%`,best:"min",ik:"maxdd"},
                          {k:"annVol",l:t('ct_vol'),fmt:v=>`${v}%`,best:"min",ik:"vol"},
                          {k:"var95",l:t('ct_var'),fmt:v=>`${v}${perDay}`,best:"min",ik:"var95"},
                          {k:"alpha",l:t('ct_alpha'),fmt:v=>`${parseFloat(v)>=0?"+":""}${v}%`,best:"max",ik:"alpha"},
                          {k:"beta",l:t('ct_beta'),fmt:v=>v,best:null,ik:"beta"},
                          {k:"winRate",l:t('ct_win'),fmt:v=>`${v}%`,best:"max",ik:"win"},
                        ];})().map(({k,l,fmt,best,ik})=>{
                          const portfolioVals = compareData.metricsTable?.map(p=>parseFloat(p.m[k]));
                          const benchVal = compareData.benchMetrics ? parseFloat(compareData.benchMetrics[k]) : null;
                          const allVals = benchVal!=null ? [benchVal, ...portfolioVals] : portfolioVals;
                          const bestVal = best==="max"?Math.max(...allVals):best==="min"?Math.min(...allVals):null;
                          const benchIsBest = bestVal!==null && benchVal===bestVal;
                          return <tr key={k} style={{borderBottom:`1px solid ${T.b1_20}`}}>
                            <td style={{padding:"5px 8px",color:T.t3,fontSize:9}}>
                              <TableMetricLabel label={l} info={mi(ik)} T={T}/>
                            </td>
                            <td style={{padding:"5px 8px",textAlign:"right",fontSize:9,color:benchIsBest?"#94a3b8":T.t5,fontWeight:benchIsBest?700:400,background:benchIsBest?"#94a3b808":"transparent"}}>
                              {benchVal!=null ? fmt(compareData.benchMetrics[k]) : "—"}
                            </td>
                            {compareData.metricsTable?.map((p)=>{
                              const v=parseFloat(p.m[k]);
                              const isBest = bestVal!==null&&v===bestVal&&!benchIsBest;
                              let color;
                              if(isBest) color=p.color;
                              else if(best==="max") color=v>=0?"#4ade80":"#f87171";
                              else if(best==="min") color=T.t3;
                              else color=T.t2;
                              return <td key={p.id} style={{padding:"5px 8px",color,textAlign:"right",fontWeight:isBest?700:400,background:isBest?p.color+"22":"transparent"}}>
                                {fmt(p.m[k])}
                              </td>;
                            })}
                          </tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{fontSize:8,color:T.t6,marginTop:10}}>{t('cmp_table_foot')}</div>
                </div>
              </>}
            </>}
            {isMobile&&<div style={{height:40}}/>}
          </>}

          {/* ═══════════════ TRACKING TAB ═══════════════ */}
          {tab==="track"&&<>
            {savedPortfolios.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:32,marginBottom:12}}>📂</div>
                <div style={{fontSize:12,color:T.t2,fontWeight:700,marginBottom:6}}>{t('trk_no_ports')}</div>
                <div style={{fontSize:10,color:T.t4}}>{t('trk_no_ports_sub')}</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {/* Horizon selector */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:9,color:T.t4,letterSpacing:2,textTransform:"uppercase"}}>{t('trk_proj_lbl')}</span>
                  <div style={{display:"flex",gap:4}}>
                    {[{k:"y1",l:t('trk_proj_1y')},{k:"y3",l:t('trk_proj_3y')},{k:"y5",l:t('trk_proj_5y')}].map(({k,l})=>(
                      <button key={k} onClick={()=>setProjHorizon(k)}
                        style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${projHorizon===k?"#4ade80":T.b2}`,background:projHorizon===k?"#4ade8022":"transparent",color:projHorizon===k?"#4ade80":T.t4,fontFamily:"'Space Mono'",fontSize:10,cursor:"pointer",transition:"all .12s"}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {trackingData.map(item=>{
                  const pv = item.projection?.[projHorizon];
                  return (
                  <div key={item.id} onClick={()=>setTrackModalId(item.id)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:9,border:`1px solid ${T.b1}`,background:T.bg2,cursor:"pointer",transition:"all .12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="#4ade8055";e.currentTarget.style.background=T.bg;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.background=T.bg2;}}>
                    <div style={{width:11,height:11,borderRadius:"50%",background:item.color,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                      <div style={{fontSize:9,color:T.t4,marginTop:1}}>
                        {t('trk_since')(item.startDate||new Date(item.savedAt||Date.now()).toISOString().split('T')[0])}
                        {item.trackDays!=null?` · ${t('trk_days')(item.trackDays)}`:""}
                      </div>
                      <div style={{fontSize:9,color:T.t5,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.assets?.map(a=>`${a.ticker} ${a.weight}%`).join(' · ')}</div>
                    </div>
                    {/* Right side: actual perf + projection */}
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                      {!item.error?(
                        <span style={{fontSize:11,fontWeight:700,color:item.actualFinal>=0?"#4ade80":"#f87171",whiteSpace:"nowrap"}}>{item.actualFinal>=0?"+":""}{item.actualFinal.toFixed(2)}%</span>
                      ):(
                        <span style={{fontSize:9,color:item.error==='no_data'||item.error==='missing_assets'?"#fb923c":T.t4}}>
                          {item.error==='no_data'?"📡":item.error==='too_short'?"⏳":"⚠"}{" "}
                          {item.error==='too_short'?t('trk_too_short')(item.trackDays||0):"—"}
                        </span>
                      )}
                      {pv!=null&&(
                        <span style={{fontSize:9,color:pv>=0?"#4ade8099":"#f8717199",whiteSpace:"nowrap"}}>
                          ↗ {pv>=0?"+":""}{pv.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <span style={{fontSize:10,color:T.t4,flexShrink:0}}>›</span>
                    <button className="del-btn" onClick={e=>{e.stopPropagation();deletePortfolio(item.id);}} style={{fontSize:16,flexShrink:0}}>×</button>
                  </div>
                  );
                })}
              </div>
            )}
            {isMobile&&<div style={{height:40}}/>}
          </>}

          {/* ═══════════════ TRACKING DETAIL MODAL ═══════════════ */}
          {trackModalId&&(()=>{
            const item = trackingData.find(d=>d.id===trackModalId);
            if(!item) return null;
            const hDays={y1:252,y3:756,y5:1260}[projHorizon];
            return (
              <div onClick={()=>setTrackModalId(null)} style={{position:"fixed",inset:0,background:"#000c",zIndex:60,display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",padding:isMobile?0:16}}>
                <div onClick={e=>e.stopPropagation()} style={{
                  background:T.bg2,border:`1px solid ${T.b2}`,
                  borderRadius:isMobile?"14px 14px 0 0":14,
                  width:"100%",maxWidth:isMobile?"100%":700,
                  maxHeight:isMobile?"92dvh":"90vh",overflowY:"auto",
                  padding:0,boxShadow:"0 24px 60px #0008",animation:"fadeIn .18s ease",
                }}>

                  {isMobile&&<div style={{display:"flex",justifyContent:"center",padding:"10px 0 2px"}}><div style={{width:36,height:4,borderRadius:2,background:T.b3}}/></div>}
                  {/* ── Header strip ── */}
                  <div style={{
                    padding:isMobile?"14px 16px 12px":"20px 24px 16px",borderRadius:"14px 14px 0 0",
                    background:`linear-gradient(120deg,${item.color}18 0%,transparent 55%)`,
                    borderBottom:`1px solid ${T.b1}`,position:"relative",overflow:"hidden",
                  }}>
                    <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:item.color,borderRadius:"14px 0 0 14px"}}/>
                    <div style={{display:"flex",alignItems:"flex-start",gap:14,paddingLeft:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:"'Unbounded'",fontSize:16,fontWeight:700,color:T.t1,lineHeight:1.2,marginBottom:8}}>{item.name}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                          {item.error==='no_data'&&<span style={{fontSize:8,padding:"2px 9px",borderRadius:20,background:"#fb923c18",border:"1px solid #fb923c44",color:"#fb923c",letterSpacing:1,textTransform:"uppercase"}}>📡 offline</span>}
                          {item.error==='too_short'&&<span style={{fontSize:8,padding:"2px 9px",borderRadius:20,background:T.bg,border:`1px solid ${T.b2}`,color:T.t4,letterSpacing:1,textTransform:"uppercase"}}>⏳ {t('trk_too_short')(item.trackDays||0)}</span>}
                          {item.error==='missing_assets'&&<span style={{fontSize:8,padding:"2px 9px",borderRadius:20,background:"#fb923c18",border:"1px solid #fb923c44",color:"#fb923c",letterSpacing:1,textTransform:"uppercase"}}>⚠ données partielles</span>}
                          {!item.error&&<span style={{fontSize:8,padding:"2px 9px",borderRadius:20,background:"#4ade8015",border:"1px solid #4ade8045",color:"#4ade80",letterSpacing:1,textTransform:"uppercase"}}>● live</span>}
                          <span style={{fontSize:9,color:T.t4}}>
                            {t('trk_since')(item.startDate||new Date(item.savedAt||Date.now()).toISOString().split('T')[0])}
                            {item.trackDays>0?` · ${t('trk_days')(item.trackDays)}`:""}
                          </span>
                        </div>
                      </div>
                      <button onClick={()=>setTrackModalId(null)}
                        style={{background:"none",border:"none",color:T.t4,fontSize:18,cursor:"pointer",lineHeight:1,padding:"2px 6px",flexShrink:0,transition:"color .12s"}}
                        onMouseEnter={e=>e.currentTarget.style.color="#f87171"}
                        onMouseLeave={e=>e.currentTarget.style.color=T.t4}>×</button>
                    </div>
                  </div>

                  {/* ── Content ── */}
                  <div style={{padding:isMobile?"14px 16px":"20px 24px"}}>

                    {/* Composition */}
                    <div style={{marginBottom:18}}>
                      <div style={{fontSize:7,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:7}}>Composition</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                        {item.assets?.map(a=>{
                          let ret=null;
                          if(priceData?.raw?.[a.ticker]&&item.startDate){
                            const bd=priceData.bdays;
                            const arr=priceData.raw[a.ticker];
                            const si=bd.findIndex(d=>d>=item.startDate);
                            if(si>=0&&si<arr.length&&arr[si]&&arr[arr.length-1]){
                              ret=(arr[arr.length-1]/arr[si]-1)*100;
                            }
                          }
                          return (
                          <div key={a.ticker} style={{background:T.bg,border:`1px solid ${T.b1}`,borderRadius:6,padding:"5px 10px",fontSize:9,fontFamily:"'Space Mono'",display:"flex",gap:7,alignItems:"center",transition:"border-color .12s"}}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=T.b2}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=T.b1}>
                            <span style={{color:T.t1,fontWeight:700}}>{a.ticker}</span>
                            <span style={{color:T.t5,borderRight:`1px solid ${T.b1}`,paddingRight:7}}>{a.weight}%</span>
                            {ret!=null
                              ?<span style={{color:ret>=0?"#4ade80":"#f87171",fontSize:8}}>{ret>=0?"↑":"↓"}{ret>=0?"+":""}{ret.toFixed(1)}%</span>
                              :<span style={{color:T.t4,fontSize:8}}>—</span>
                            }
                          </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* KPIs */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
                      {[
                        {l:t('trk_actual'), v:item.error?null:item.actualFinal, c:!item.error?(item.actualFinal>=0?"#4ade80":"#f87171"):T.t5, bc:!item.error?(item.actualFinal>=0?"#4ade8035":"#f8717135"):T.b1},
                        {l:t('trk_mc'),     v:item.error?null:item.mcFinal,     c:!item.error?"#fb923c":T.t5,                                  bc:!item.error?"#fb923c35":T.b1},
                        {l:t('trk_delta'),  v:item.error?null:(item.actualFinal-item.mcFinal), c:!item.error?((item.actualFinal-item.mcFinal)>=0?"#4ade80":"#f87171"):T.t5, bc:!item.error?((item.actualFinal-item.mcFinal)>=0?"#4ade8035":"#f8717135"):T.b1},
                      ].map(({l,v,c,bc})=>(
                        <div key={l} style={{background:T.bg,border:`1px solid ${bc}`,borderRadius:9,padding:"13px 14px"}}>
                          <div style={{fontSize:7,color:T.t5,letterSpacing:2,textTransform:"uppercase",marginBottom:7}}>{l}</div>
                          <div style={{fontFamily:"'Unbounded'",fontSize:isMobile?17:22,color:c,fontWeight:700,lineHeight:1}}>
                            {v==null?"—":`${v>=0?"+":""}${v.toFixed(2)}%`}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Chart */}
                    <div style={{marginBottom:20}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        {/* Legend */}
                        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                          {!item.error&&(()=>{const ac=item.actualFinal>=0?"#4ade80":"#f87171";return(<>
                            <span style={{fontSize:8,color:T.t4,display:"flex",alignItems:"center",gap:5}}>
                              <span style={{display:"inline-block",width:14,height:2,background:ac,borderRadius:1}}/>
                              {t('trk_actual')}
                            </span>
                            <span style={{fontSize:8,color:T.t4,display:"flex",alignItems:"center",gap:5}}>
                              <span style={{display:"inline-block",width:14,height:0,borderTop:"2px dashed #fb923c"}}/>
                              {t('trk_mc')}
                            </span>
                          </>);})()}
                          <span style={{fontSize:8,color:T.t4,display:"flex",alignItems:"center",gap:5}}>
                            <span style={{display:"inline-block",width:14,height:0,borderTop:"2px dashed #22d3ee"}}/>
                            {t('trk_proj_lbl')}
                          </span>
                        </div>
                        {/* Horizon pills */}
                        <div style={{display:"flex",gap:4}}>
                          {[{k:"y1",l:t('trk_proj_1y')},{k:"y3",l:t('trk_proj_3y')},{k:"y5",l:t('trk_proj_5y')}].map(({k,l})=>(
                            <button key={k} onClick={()=>setProjHorizon(k)} className={`pill${projHorizon===k?" active":""}`}
                              style={{fontSize:9,padding:"3px 10px"}}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {item.error==='no_data'?(
                        <div style={{height:140,background:T.bg,borderRadius:9,border:`1px dashed ${T.b2}`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
                          <div style={{fontSize:28,opacity:0.18}}>📡</div>
                          <div style={{fontSize:9,color:T.t4,textAlign:"center",maxWidth:240}}>{t('trk_no_data')}</div>
                        </div>
                      ):(()=>{
                        const actualColor=(!item.error&&item.actualFinal>=0)?"#4ade80":"#f87171";
                        let combined;
                        if(item.error){
                          combined=(item.projChartData||[]).filter(pt=>pt.d<=hDays);
                        } else {
                          const ji=item.chartData.length-1;
                          combined=[
                            ...item.chartData.map((pt,i)=>i===ji?{...pt,proj:item.actualFinal}:pt),
                            ...(item.projChartData||[]).filter(pt=>pt.d>0&&pt.d<=hDays),
                          ];
                        }
                        const fmtLabel=d=>d&&d.length>=10?`${d.slice(8)}/${d.slice(5,7)}/${d.slice(0,4)}`:d||'';
                        return (
                          <ResponsiveContainer width="100%" height={200}>
                            <ComposedChart data={combined} margin={{top:4,right:8,left:0,bottom:0}}>
                              <defs>
                                <linearGradient id={`trkMG_${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={actualColor} stopOpacity={0.2}/>
                                  <stop offset="100%" stopColor={actualColor} stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id={`projMG_${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.15}/>
                                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={48} tickFormatter={d=>d&&d.length>=10?d.slice(5).replace('-','/'):d}/>
                              <YAxis tick={{fill:T.t4,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v>0?"+":""}${v.toFixed(0)}%`} width={44}/>
                              <Tooltip contentStyle={{background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:7,fontSize:10,fontFamily:"'Space Mono'",boxShadow:"0 8px 24px #0006"}}
                                labelFormatter={fmtLabel}
                                formatter={(v,name)=>[`${v>=0?"+":""}${v.toFixed(2)}%`,name==="actual"?t('trk_actual'):name==="mc"?t('trk_mc'):t('trk_proj_lbl')]}/>
                              <ReferenceLine y={0} stroke={T.b2} strokeDasharray="2 2"/>
                              {!item.error&&<Area type="monotone" dataKey="actual" stroke={actualColor} strokeWidth={2} fill={`url(#trkMG_${item.id})`} dot={false} isAnimationActive={false}/>}
                              {!item.error&&<Line type="monotone" dataKey="mc" stroke="#fb923c" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false}/>}
                              <Area type="monotone" dataKey="proj" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 3" fill={`url(#projMG_${item.id})`} dot={false} isAnimationActive={false} connectNulls={false}/>
                            </ComposedChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>

                    {/* Metrics table — only when real data */}
                    {!item.error&&<>
                      <div style={{fontSize:7,color:T.t4,letterSpacing:3,textTransform:"uppercase",marginBottom:10}}>{t('trk_metrics_title')}</div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,fontFamily:"'Space Mono'"}}>
                        <thead>
                          <tr>{["",t('trk_actual'),t('trk_mc'),t('trk_delta')].map((h,i)=>(
                            <th key={i} style={{padding:"6px 8px",color:T.t5,fontWeight:400,textAlign:i===0?"left":"right",fontSize:8,borderBottom:`1px solid ${T.b1}`,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {[
                            {l:t('trk_ann'),   ka:"annReturn",inv:false},
                            {l:t('trk_sharpe'),ka:"sharpe",   inv:false},
                            {l:t('trk_vol'),   ka:"annVol",   inv:true},
                            {l:t('trk_maxdd'), ka:"maxDD",    inv:true},
                          ].map(({l,ka,inv},ri)=>{
                            const va=parseFloat(item.actualM[ka]);
                            const vm=parseFloat(item.mcM[ka]);
                            const d=parseFloat((va-vm).toFixed(2));
                            const better=inv?d<0:d>0;
                            const fmt=v=>ka==="annReturn"||ka==="annVol"||ka==="maxDD"?`${v>=0&&ka!=="maxDD"?"+":""}${v.toFixed(2)}%`:v.toFixed(3);
                            return (
                              <tr key={l} style={{borderBottom:`1px solid ${T.b1}`,background:ri%2===0?T.bg:"transparent",transition:"background .1s",cursor:"default"}}
                                onMouseEnter={e=>e.currentTarget.style.background=T.bg2}
                                onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?T.bg:"transparent"}>
                                <td style={{padding:"8px 8px",color:T.t4,fontSize:9}}>{l}</td>
                                <td style={{padding:"8px 8px",color:item.color,fontWeight:700,textAlign:"right"}}>{fmt(va)}</td>
                                <td style={{padding:"8px 8px",color:"#fb923c",textAlign:"right"}}>{fmt(vm)}</td>
                                <td style={{padding:"8px 8px",color:better?"#4ade80":"#f87171",fontWeight:700,textAlign:"right"}}>{d>=0?"+":""}{ka==="annReturn"||ka==="annVol"||ka==="maxDD"?`${d.toFixed(2)}%`:d.toFixed(3)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>}

                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
