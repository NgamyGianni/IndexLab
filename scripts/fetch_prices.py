"""
Incremental price downloader with SQLite cache.

Outputs:
  public/prices.json        — historical prices (consumed by React frontend)
  public/asset_params.json  — ticker metadata + real annualised mu/sigma

First run: downloads 5 years of history (~few minutes).
Subsequent runs: only fetches missing business days (seconds).

Usage:
  pip install -r scripts/requirements.txt
  python scripts/fetch_prices.py
"""
import json, math, os, sqlite3, time
from datetime import date, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

# ── Paths & constants ──────────────────────────────────────────────────────────
DB_PATH  = "scripts/prices.db"
OUT_PX   = "public/prices.json"
OUT_META = "public/asset_params.json"
LOOKBACK = 5 * 365 + 15          # ~5 years of history
MIN_ROWS = 60                     # minimum trading days to compute stats
CHUNK    = 150                    # tickers per yfinance batch

# ── Curated ticker list ────────────────────────────────────────────────────────
CURATED = [
    # US Tech
    "AAPL","MSFT","NVDA","GOOGL","META","AMZN","ORCL","CRM","AMD","INTC",
    "NFLX","ADBE","NOW","SNOW","PLTR","UBER","ABNB","AVGO","QCOM","AMAT",
    "TXN","TSM","SPOT","INTU","NET","ZS","CSCO","ACN","IBM",
    "CRWD","PANW","FTNT","RBLX",
    # US Finance
    "JPM","GS","BRK-B","V","MA","PYPL","SQ","COIN",
    "BAC","WFC","MS","C","AXP","SCHW","BLK","SPGI","ICE","CME","AFL",
    # US Santé
    "JNJ","PFE","UNH","LLY","MRNA","ISRG",
    "ABBV","MRK","AMGN","BMY","GILD","MDT","REGN","VRTX","CVS","ELV","SYK","BSX",
    # US Énergie
    "XOM","CVX","ENPH","NEE","CCJ",
    "SLB","EOG","MPC","VLO","HAL",
    # US Conso.
    "TSLA","NKE","MC.PA","TTWO",
    "SBUX","MCD","DIS","COST","HD","LOW","TJX","BKNG","LULU","F",
    # US Conso. déf.
    "PG","KO","WMT","MDLZ",
    # US Industrie
    "BA","CAT","LMT","LHX",
    "RTX","GE","HON","DE","UPS","NOC",
    # US Immobilier
    "PLD","AMT","EQIX","O","PSA",
    # US Matériaux
    "LIN","NEM","FCX","APD","ECL","DOW","NUE",
    # US Utilities
    "DUK","SO","CEG","XYL","AWK","AEP",
    # US Télécom
    "VZ","TMUS","T",
    # Europe
    "ASML","SAP","NVO","AIR.PA","TTE.PA","RMS.PA","AZN","SHEL",
    "OR.PA","BNP.PA","SIE.DE","VOW.DE","INGA.AS","NSRGY",
    # Asie
    "TM","SONY","BABA","SE","BYDDY","9984.T",
    # Crypto
    "BTC-USD","ETH-USD","SOL-USD","BNB-USD","XRP-USD","DOGE-USD",
    "ADA-USD","AVAX-USD","LINK-USD","DOT-USD","MATIC-USD","UNI-USD","FIL-USD","ATOM-USD",
    # ETF
    "SPY","QQQ","GLD","ARKK","XLF","XLE","ICLN","VWO",
    "IWM","EFA","EEM","TLT","LQD","HYG","SOXX","GDX",
    "SCHD","JEPI","IAU","SLV","MCHI","EWJ","EWZ","QQQM",
    "XLK","XLV","XLRE","XLP","IVV","VTI","EWG","IEMG",
    # Indices
    "^GSPC","^FCHI","^GDAXI","^N225","^FTSE",
]

_ETF_SET = {
    "SPY","QQQ","GLD","ARKK","XLF","XLE","ICLN","VWO","IWM","EFA","EEM",
    "TLT","LQD","HYG","SOXX","GDX","SCHD","JEPI","IAU","SLV","MCHI","EWJ",
    "EWZ","QQQM","XLK","XLV","XLRE","XLP","IVV","VTI","EWG","IEMG",
}

# ── GICS sector → app sector/themes ───────────────────────────────────────────
_GICS_SECTOR = {
    "Information Technology": "Tech",
    "Financials":             "Finance",
    "Health Care":            "Santé",
    "Consumer Discretionary": "Conso.",
    "Consumer Staples":       "Conso. déf.",
    "Energy":                 "Énergie",
    "Utilities":              "Utilities",
    "Industrials":            "Industrie",
    "Materials":              "Matériaux",
    "Real Estate":            "Immobilier",
    "Communication Services": "Télécom",
}
_GICS_THEMES = {
    "Information Technology": ["tech"],
    "Financials":             ["finance"],
    "Health Care":            ["sante"],
    "Consumer Discretionary": ["conso"],
    "Consumer Staples":       ["conso", "refuge"],
    "Energy":                 ["energie"],
    "Utilities":              ["energie"],
    "Industrials":            ["industrie"],
    "Materials":              ["materiaux"],
    "Real Estate":            ["immo"],
    "Communication Services": ["media"],
}

# ── Hand-crafted metadata — mu/sigma will be overridden by real computed values ─
KNOWN_META = {
    "AAPL":    {"name":"Apple",              "type":"action","sector":"Tech",         "themes":["tech","ia"],                  "cap":3200},
    "MSFT":    {"name":"Microsoft",           "type":"action","sector":"Tech",         "themes":["tech","ia","cloud"],          "cap":3100},
    "NVDA":    {"name":"Nvidia",              "type":"action","sector":"Tech",         "themes":["tech","ia","semi"],           "cap":2200},
    "GOOGL":   {"name":"Alphabet",            "type":"action","sector":"Tech",         "themes":["tech","ia","cloud"],          "cap":2100},
    "META":    {"name":"Meta",                "type":"action","sector":"Tech",         "themes":["tech","ia","media"],          "cap":1400},
    "AMZN":    {"name":"Amazon",              "type":"action","sector":"Tech",         "themes":["tech","cloud","conso"],       "cap":2000},
    "ORCL":    {"name":"Oracle",              "type":"action","sector":"Tech",         "themes":["tech","cloud"],               "cap":420 },
    "CRM":     {"name":"Salesforce",          "type":"action","sector":"Tech",         "themes":["tech","cloud"],               "cap":290 },
    "AMD":     {"name":"AMD",                 "type":"action","sector":"Tech",         "themes":["tech","ia","semi"],           "cap":240 },
    "INTC":    {"name":"Intel",               "type":"action","sector":"Tech",         "themes":["tech","semi"],                "cap":95  },
    "NFLX":    {"name":"Netflix",             "type":"action","sector":"Tech",         "themes":["tech","media"],               "cap":350 },
    "ADBE":    {"name":"Adobe",               "type":"action","sector":"Tech",         "themes":["tech","cloud","ia"],          "cap":230 },
    "NOW":     {"name":"ServiceNow",          "type":"action","sector":"Tech",         "themes":["tech","cloud"],               "cap":200 },
    "SNOW":    {"name":"Snowflake",           "type":"action","sector":"Tech",         "themes":["tech","cloud","ia"],          "cap":55  },
    "PLTR":    {"name":"Palantir",            "type":"action","sector":"Tech",         "themes":["tech","ia"],                  "cap":80  },
    "UBER":    {"name":"Uber",                "type":"action","sector":"Tech",         "themes":["tech","auto"],                "cap":170 },
    "ABNB":    {"name":"Airbnb",              "type":"action","sector":"Tech",         "themes":["tech"],                       "cap":80  },
    "AVGO":    {"name":"Broadcom",            "type":"action","sector":"Tech",         "themes":["tech","semi","ia"],           "cap":800 },
    "QCOM":    {"name":"Qualcomm",            "type":"action","sector":"Tech",         "themes":["tech","semi"],                "cap":170 },
    "AMAT":    {"name":"Applied Materials",   "type":"action","sector":"Tech",         "themes":["tech","semi"],                "cap":190 },
    "TXN":     {"name":"Texas Instruments",  "type":"action","sector":"Tech",         "themes":["tech","semi"],                "cap":160 },
    "TSM":     {"name":"Taiwan Semi.",        "type":"action","sector":"Tech",         "themes":["tech","semi","asie"],         "cap":720 },
    "SPOT":    {"name":"Spotify",             "type":"action","sector":"Tech",         "themes":["tech","media"],               "cap":100 },
    "INTU":    {"name":"Intuit",              "type":"action","sector":"Tech",         "themes":["tech","cloud","fintech"],     "cap":180 },
    "NET":     {"name":"Cloudflare",          "type":"action","sector":"Tech",         "themes":["tech","cloud","cyber"],       "cap":65  },
    "ZS":      {"name":"Zscaler",             "type":"action","sector":"Tech",         "themes":["tech","cyber","cloud"],       "cap":25  },
    "CSCO":    {"name":"Cisco",               "type":"action","sector":"Tech",         "themes":["tech","telecom"],             "cap":230 },
    "ACN":     {"name":"Accenture",           "type":"action","sector":"Tech",         "themes":["tech","cloud"],               "cap":210 },
    "IBM":     {"name":"IBM",                 "type":"action","sector":"Tech",         "themes":["tech","cloud","ia"],          "cap":160 },
    "CRWD":    {"name":"CrowdStrike",         "type":"action","sector":"Tech",         "themes":["tech","cyber","ia"],          "cap":85  },
    "PANW":    {"name":"Palo Alto Netw.",     "type":"action","sector":"Tech",         "themes":["tech","cyber"],               "cap":120 },
    "FTNT":    {"name":"Fortinet",            "type":"action","sector":"Tech",         "themes":["tech","cyber"],               "cap":55  },
    "RBLX":    {"name":"Roblox",              "type":"action","sector":"Tech",         "themes":["gaming","tech","ia"],         "cap":22  },
    "JPM":     {"name":"JPMorgan",            "type":"action","sector":"Finance",      "themes":["finance","banque"],           "cap":680 },
    "GS":      {"name":"Goldman Sachs",       "type":"action","sector":"Finance",      "themes":["finance","banque"],           "cap":180 },
    "BRK-B":   {"name":"Berkshire B",         "type":"action","sector":"Finance",      "themes":["finance","value"],            "cap":1000},
    "V":       {"name":"Visa",                "type":"action","sector":"Finance",      "themes":["finance","paiement"],         "cap":580 },
    "MA":      {"name":"Mastercard",          "type":"action","sector":"Finance",      "themes":["finance","paiement"],         "cap":490 },
    "PYPL":    {"name":"PayPal",              "type":"action","sector":"Finance",      "themes":["finance","paiement"],         "cap":65  },
    "SQ":      {"name":"Block (Square)",      "type":"action","sector":"Finance",      "themes":["finance","fintech","paiement"],"cap":40 },
    "COIN":    {"name":"Coinbase",            "type":"action","sector":"Finance",      "themes":["finance","fintech","crypto"], "cap":55  },
    "BAC":     {"name":"Bank of America",     "type":"action","sector":"Finance",      "themes":["finance","banque"],           "cap":340 },
    "WFC":     {"name":"Wells Fargo",         "type":"action","sector":"Finance",      "themes":["finance","banque"],           "cap":225 },
    "MS":      {"name":"Morgan Stanley",      "type":"action","sector":"Finance",      "themes":["finance","banque"],           "cap":195 },
    "C":       {"name":"Citigroup",           "type":"action","sector":"Finance",      "themes":["finance","banque"],           "cap":145 },
    "AXP":     {"name":"American Express",    "type":"action","sector":"Finance",      "themes":["finance","paiement"],         "cap":175 },
    "SCHW":    {"name":"Charles Schwab",      "type":"action","sector":"Finance",      "themes":["finance"],                    "cap":135 },
    "BLK":     {"name":"BlackRock",           "type":"action","sector":"Finance",      "themes":["finance"],                    "cap":135 },
    "SPGI":    {"name":"S&P Global",          "type":"action","sector":"Finance",      "themes":["finance"],                    "cap":155 },
    "ICE":     {"name":"Intercontinental",    "type":"action","sector":"Finance",      "themes":["finance"],                    "cap":100 },
    "CME":     {"name":"CME Group",           "type":"action","sector":"Finance",      "themes":["finance"],                    "cap":80  },
    "AFL":     {"name":"Aflac",               "type":"action","sector":"Finance",      "themes":["finance","assurance"],        "cap":60  },
    "JNJ":     {"name":"Johnson & J.",        "type":"action","sector":"Santé",        "themes":["sante","pharma"],             "cap":380 },
    "PFE":     {"name":"Pfizer",              "type":"action","sector":"Santé",        "themes":["sante","pharma"],             "cap":140 },
    "UNH":     {"name":"UnitedHealth",        "type":"action","sector":"Santé",        "themes":["sante","assurance"],          "cap":450 },
    "LLY":     {"name":"Eli Lilly",           "type":"action","sector":"Santé",        "themes":["sante","pharma","biotech"],   "cap":750 },
    "MRNA":    {"name":"Moderna",             "type":"action","sector":"Santé",        "themes":["sante","biotech"],            "cap":45  },
    "ISRG":    {"name":"Intuitive Surg.",     "type":"action","sector":"Santé",        "themes":["sante","medtech"],            "cap":190 },
    "ABBV":    {"name":"AbbVie",              "type":"action","sector":"Santé",        "themes":["sante","pharma","biotech"],   "cap":275 },
    "MRK":     {"name":"Merck",               "type":"action","sector":"Santé",        "themes":["sante","pharma"],             "cap":240 },
    "AMGN":    {"name":"Amgen",               "type":"action","sector":"Santé",        "themes":["sante","biotech"],            "cap":150 },
    "BMY":     {"name":"Bristol-Myers",       "type":"action","sector":"Santé",        "themes":["sante","pharma","biotech"],   "cap":130 },
    "GILD":    {"name":"Gilead Sciences",     "type":"action","sector":"Santé",        "themes":["sante","biotech"],            "cap":115 },
    "MDT":     {"name":"Medtronic",           "type":"action","sector":"Santé",        "themes":["sante","medtech"],            "cap":100 },
    "REGN":    {"name":"Regeneron",           "type":"action","sector":"Santé",        "themes":["sante","biotech"],            "cap":90  },
    "VRTX":    {"name":"Vertex Pharma.",      "type":"action","sector":"Santé",        "themes":["sante","biotech","pharma"],   "cap":115 },
    "CVS":     {"name":"CVS Health",          "type":"action","sector":"Santé",        "themes":["sante"],                      "cap":85  },
    "ELV":     {"name":"Elevance Health",     "type":"action","sector":"Santé",        "themes":["sante","assurance"],          "cap":95  },
    "SYK":     {"name":"Stryker",             "type":"action","sector":"Santé",        "themes":["sante","medtech"],            "cap":145 },
    "BSX":     {"name":"Boston Scientific",   "type":"action","sector":"Santé",        "themes":["sante","medtech"],            "cap":125 },
    "XOM":     {"name":"ExxonMobil",          "type":"action","sector":"Énergie",      "themes":["energie","petrole"],          "cap":490 },
    "CVX":     {"name":"Chevron",             "type":"action","sector":"Énergie",      "themes":["energie","petrole"],          "cap":270 },
    "ENPH":    {"name":"Enphase Energy",      "type":"action","sector":"Énergie",      "themes":["energie","solaire"],          "cap":15  },
    "NEE":     {"name":"NextEra Energy",      "type":"action","sector":"Énergie",      "themes":["energie","solaire"],          "cap":130 },
    "CCJ":     {"name":"Cameco",              "type":"action","sector":"Énergie",      "themes":["energie","nucleaire"],        "cap":22  },
    "SLB":     {"name":"SLB",                 "type":"action","sector":"Énergie",      "themes":["energie","petrole"],          "cap":65  },
    "EOG":     {"name":"EOG Resources",       "type":"action","sector":"Énergie",      "themes":["energie","petrole"],          "cap":75  },
    "MPC":     {"name":"Marathon Petro.",     "type":"action","sector":"Énergie",      "themes":["energie","petrole"],          "cap":65  },
    "VLO":     {"name":"Valero Energy",       "type":"action","sector":"Énergie",      "themes":["energie","petrole"],          "cap":55  },
    "HAL":     {"name":"Halliburton",         "type":"action","sector":"Énergie",      "themes":["energie","petrole"],          "cap":30  },
    "TSLA":    {"name":"Tesla",               "type":"action","sector":"Conso.",       "themes":["conso","ve","ia"],            "cap":800 },
    "NKE":     {"name":"Nike",                "type":"action","sector":"Conso.",       "themes":["conso","luxe"],               "cap":90  },
    "MC.PA":   {"name":"LVMH",               "type":"action","sector":"Conso.",       "themes":["conso","luxe","europe"],      "cap":320 },
    "TTWO":    {"name":"Take-Two Interac.",   "type":"action","sector":"Conso.",       "themes":["gaming","conso","media"],     "cap":25  },
    "SBUX":    {"name":"Starbucks",           "type":"action","sector":"Conso.",       "themes":["conso"],                      "cap":100 },
    "MCD":     {"name":"McDonald's",          "type":"action","sector":"Conso.",       "themes":["conso"],                      "cap":220 },
    "DIS":     {"name":"Disney",              "type":"action","sector":"Conso.",       "themes":["conso","media","gaming"],     "cap":200 },
    "COST":    {"name":"Costco",              "type":"action","sector":"Conso.",       "themes":["conso"],                      "cap":390 },
    "HD":      {"name":"Home Depot",          "type":"action","sector":"Conso.",       "themes":["conso"],                      "cap":380 },
    "LOW":     {"name":"Lowe's",              "type":"action","sector":"Conso.",       "themes":["conso"],                      "cap":150 },
    "TJX":     {"name":"TJX Companies",      "type":"action","sector":"Conso.",       "themes":["conso"],                      "cap":140 },
    "BKNG":    {"name":"Booking Holdings",   "type":"action","sector":"Conso.",       "themes":["conso"],                      "cap":175 },
    "LULU":    {"name":"Lululemon",           "type":"action","sector":"Conso.",       "themes":["conso","luxe"],               "cap":45  },
    "F":       {"name":"Ford Motor",          "type":"action","sector":"Conso.",       "themes":["conso","auto","ve"],          "cap":50  },
    "PG":      {"name":"Procter & Gamble",    "type":"action","sector":"Conso. déf.", "themes":["conso","refuge","value"],     "cap":350 },
    "KO":      {"name":"Coca-Cola",           "type":"action","sector":"Conso. déf.", "themes":["conso","refuge","value"],     "cap":270 },
    "WMT":     {"name":"Walmart",             "type":"action","sector":"Conso. déf.", "themes":["conso","refuge","value"],     "cap":720 },
    "MDLZ":    {"name":"Mondelez",            "type":"action","sector":"Conso. déf.", "themes":["conso","refuge"],             "cap":80  },
    "BA":      {"name":"Boeing",              "type":"action","sector":"Industrie",    "themes":["industrie","defense"],        "cap":110 },
    "CAT":     {"name":"Caterpillar",         "type":"action","sector":"Industrie",    "themes":["industrie"],                  "cap":190 },
    "LMT":     {"name":"Lockheed Martin",     "type":"action","sector":"Industrie",    "themes":["industrie","defense"],        "cap":120 },
    "LHX":     {"name":"L3Harris Techn.",     "type":"action","sector":"Industrie",    "themes":["industrie","defense","space"],"cap":40  },
    "RTX":     {"name":"RTX Corp.",           "type":"action","sector":"Industrie",    "themes":["industrie","defense"],        "cap":165 },
    "GE":      {"name":"GE Aerospace",        "type":"action","sector":"Industrie",    "themes":["industrie"],                  "cap":190 },
    "HON":     {"name":"Honeywell",           "type":"action","sector":"Industrie",    "themes":["industrie"],                  "cap":145 },
    "DE":      {"name":"John Deere",          "type":"action","sector":"Industrie",    "themes":["industrie"],                  "cap":120 },
    "UPS":     {"name":"UPS",                 "type":"action","sector":"Industrie",    "themes":["industrie","logistique"],     "cap":130 },
    "NOC":     {"name":"Northrop Grumman",    "type":"action","sector":"Industrie",    "themes":["industrie","defense","space"],"cap":75  },
    "PLD":     {"name":"Prologis",            "type":"action","sector":"Immobilier",   "themes":["immo","logistique"],          "cap":95  },
    "AMT":     {"name":"American Tower",      "type":"action","sector":"Immobilier",   "themes":["immo","telecom"],             "cap":85  },
    "EQIX":    {"name":"Equinix",             "type":"action","sector":"Immobilier",   "themes":["immo","cloud"],               "cap":75  },
    "O":       {"name":"Realty Income",       "type":"action","sector":"Immobilier",   "themes":["immo","refuge"],              "cap":55  },
    "PSA":     {"name":"Public Storage",      "type":"action","sector":"Immobilier",   "themes":["immo"],                       "cap":55  },
    "LIN":     {"name":"Linde",               "type":"action","sector":"Matériaux",    "themes":["materiaux","industrie"],      "cap":200 },
    "NEM":     {"name":"Newmont",             "type":"action","sector":"Matériaux",    "themes":["materiaux","or","refuge"],    "cap":50  },
    "FCX":     {"name":"Freeport-McMoRan",    "type":"action","sector":"Matériaux",    "themes":["materiaux"],                  "cap":60  },
    "APD":     {"name":"Air Products",        "type":"action","sector":"Matériaux",    "themes":["materiaux","industrie"],      "cap":55  },
    "ECL":     {"name":"Ecolab",              "type":"action","sector":"Matériaux",    "themes":["materiaux","eau"],            "cap":55  },
    "DOW":     {"name":"Dow Inc.",            "type":"action","sector":"Matériaux",    "themes":["materiaux"],                  "cap":40  },
    "NUE":     {"name":"Nucor",               "type":"action","sector":"Matériaux",    "themes":["materiaux"],                  "cap":40  },
    "DUK":     {"name":"Duke Energy",         "type":"action","sector":"Utilities",    "themes":["energie","nucleaire"],        "cap":80  },
    "SO":      {"name":"Southern Company",    "type":"action","sector":"Utilities",    "themes":["energie","nucleaire"],        "cap":75  },
    "CEG":     {"name":"Constellation E.",    "type":"action","sector":"Utilities",    "themes":["energie","nucleaire"],        "cap":65  },
    "XYL":     {"name":"Xylem",               "type":"action","sector":"Utilities",    "themes":["eau","industrie"],            "cap":20  },
    "AWK":     {"name":"American Water",      "type":"action","sector":"Utilities",    "themes":["eau","refuge"],               "cap":25  },
    "AEP":     {"name":"American El. Pow.",   "type":"action","sector":"Utilities",    "themes":["energie","nucleaire"],        "cap":55  },
    "VZ":      {"name":"Verizon",             "type":"action","sector":"Télécom",      "themes":["telecom"],                    "cap":160 },
    "TMUS":    {"name":"T-Mobile US",         "type":"action","sector":"Télécom",      "themes":["telecom"],                    "cap":250 },
    "T":       {"name":"AT&T",                "type":"action","sector":"Télécom",      "themes":["telecom"],                    "cap":175 },
    "ASML":    {"name":"ASML Holding",        "type":"action","sector":"Tech",         "themes":["tech","semi","europe"],       "cap":350 },
    "SAP":     {"name":"SAP",                 "type":"action","sector":"Tech",         "themes":["tech","cloud","europe"],      "cap":250 },
    "NVO":     {"name":"Novo Nordisk",        "type":"action","sector":"Santé",        "themes":["sante","pharma","europe"],    "cap":370 },
    "AIR.PA":  {"name":"Airbus",              "type":"action","sector":"Industrie",    "themes":["industrie","defense","europe"],"cap":145},
    "TTE.PA":  {"name":"TotalEnergies",       "type":"action","sector":"Énergie",      "themes":["energie","petrole","europe"], "cap":155},
    "RMS.PA":  {"name":"Hermès",              "type":"action","sector":"Conso.",       "themes":["conso","luxe","europe"],      "cap":210 },
    "AZN":     {"name":"AstraZeneca",         "type":"action","sector":"Santé",        "themes":["sante","pharma","europe"],    "cap":240 },
    "SHEL":    {"name":"Shell",               "type":"action","sector":"Énergie",      "themes":["energie","petrole","europe"], "cap":220},
    "OR.PA":   {"name":"L'Oréal",             "type":"action","sector":"Conso.",       "themes":["conso","luxe","europe"],      "cap":200 },
    "BNP.PA":  {"name":"BNP Paribas",         "type":"action","sector":"Finance",      "themes":["finance","banque","europe"],  "cap":90  },
    "SIE.DE":  {"name":"Siemens",             "type":"action","sector":"Industrie",    "themes":["industrie","europe"],         "cap":130 },
    "VOW.DE":  {"name":"Volkswagen",          "type":"action","sector":"Conso.",       "themes":["conso","auto","ve","europe"], "cap":60  },
    "INGA.AS": {"name":"ING Group",           "type":"action","sector":"Finance",      "themes":["finance","banque","europe"],  "cap":70  },
    "NSRGY":   {"name":"Nestlé",              "type":"action","sector":"Conso. déf.", "themes":["conso","refuge","europe"],    "cap":250 },
    "TM":      {"name":"Toyota",              "type":"action","sector":"Conso.",       "themes":["conso","auto","ve","asie"],   "cap":250 },
    "SONY":    {"name":"Sony",                "type":"action","sector":"Tech",         "themes":["tech","gaming","media","asie"],"cap":120},
    "BABA":    {"name":"Alibaba",             "type":"action","sector":"Tech",         "themes":["tech","cloud","asie","emergent"],"cap":210},
    "SE":      {"name":"Sea Limited",         "type":"action","sector":"Tech",         "themes":["tech","gaming","asie","emergent"],"cap":45},
    "BYDDY":   {"name":"BYD",                 "type":"action","sector":"Conso.",       "themes":["conso","auto","ve","asie"],   "cap":100 },
    "9984.T":  {"name":"SoftBank",            "type":"action","sector":"Finance",      "themes":["finance","tech","asie"],      "cap":75  },
    "BTC-USD": {"name":"Bitcoin",             "type":"crypto","sector":"Crypto",       "themes":["crypto","store"],             "cap":1900},
    "ETH-USD": {"name":"Ethereum",            "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":390 },
    "SOL-USD": {"name":"Solana",              "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":85  },
    "BNB-USD": {"name":"BNB",                 "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":90  },
    "XRP-USD": {"name":"XRP",                 "type":"crypto","sector":"Crypto",       "themes":["crypto","paiement"],          "cap":130 },
    "DOGE-USD":{"name":"Dogecoin",            "type":"crypto","sector":"Crypto",       "themes":["crypto"],                     "cap":25  },
    "ADA-USD": {"name":"Cardano",             "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":18  },
    "AVAX-USD":{"name":"Avalanche",           "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":15  },
    "LINK-USD":{"name":"Chainlink",           "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":10  },
    "DOT-USD": {"name":"Polkadot",            "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":12  },
    "MATIC-USD":{"name":"Polygon",            "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":10  },
    "UNI-USD": {"name":"Uniswap",             "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":8   },
    "FIL-USD": {"name":"Filecoin",            "type":"crypto","sector":"Crypto",       "themes":["crypto"],                     "cap":5   },
    "ATOM-USD":{"name":"Cosmos",              "type":"crypto","sector":"Crypto",       "themes":["crypto","defi"],              "cap":5   },
    "SPY":     {"name":"S&P 500 ETF",         "type":"etf",   "sector":"ETF",          "themes":["etf","marche"],               "cap":550 },
    "QQQ":     {"name":"Nasdaq 100 ETF",      "type":"etf",   "sector":"ETF",          "themes":["etf","tech"],                 "cap":260 },
    "GLD":     {"name":"Gold ETF",            "type":"etf",   "sector":"ETF",          "themes":["etf","or","refuge"],          "cap":75  },
    "ARKK":    {"name":"ARK Innovation",      "type":"etf",   "sector":"ETF",          "themes":["etf","ia","tech"],            "cap":8   },
    "XLF":     {"name":"Finance ETF",         "type":"etf",   "sector":"ETF",          "themes":["etf","finance"],              "cap":45  },
    "XLE":     {"name":"Énergie ETF",         "type":"etf",   "sector":"ETF",          "themes":["etf","energie"],              "cap":30  },
    "ICLN":    {"name":"Clean Energy ETF",    "type":"etf",   "sector":"ETF",          "themes":["etf","energie","solaire"],    "cap":2   },
    "VWO":     {"name":"Marchés émergents",   "type":"etf",   "sector":"ETF",          "themes":["etf","marche"],               "cap":80  },
    "IWM":     {"name":"Russell 2000 ETF",    "type":"etf",   "sector":"ETF",          "themes":["etf","marche"],               "cap":45  },
    "EFA":     {"name":"MSCI EAFE ETF",       "type":"etf",   "sector":"ETF",          "themes":["etf","europe","asie"],        "cap":100 },
    "EEM":     {"name":"Émergents ETF",       "type":"etf",   "sector":"ETF",          "themes":["etf","emergent"],             "cap":45  },
    "TLT":     {"name":"Treasury 20+ ETF",    "type":"etf",   "sector":"ETF",          "themes":["etf","obligations","refuge"], "cap":30  },
    "LQD":     {"name":"Corp Bond ETF",       "type":"etf",   "sector":"ETF",          "themes":["etf","obligations"],          "cap":30  },
    "HYG":     {"name":"High Yield ETF",      "type":"etf",   "sector":"ETF",          "themes":["etf","obligations"],          "cap":15  },
    "SOXX":    {"name":"Semiconducteurs ETF", "type":"etf",   "sector":"ETF",          "themes":["etf","semi","tech"],          "cap":25  },
    "GDX":     {"name":"Gold Miners ETF",     "type":"etf",   "sector":"ETF",          "themes":["etf","or","refuge"],          "cap":15  },
    "SCHD":    {"name":"Schwab Dividend",      "type":"etf",   "sector":"ETF",          "themes":["etf","marche","refuge"],      "cap":60  },
    "JEPI":    {"name":"JPM Equity Prem.",    "type":"etf",   "sector":"ETF",          "themes":["etf","marche"],               "cap":35  },
    "IAU":     {"name":"Gold Trust ETF",      "type":"etf",   "sector":"ETF",          "themes":["etf","or","refuge"],          "cap":30  },
    "SLV":     {"name":"Silver ETF",          "type":"etf",   "sector":"ETF",          "themes":["etf","materiaux","refuge"],   "cap":12  },
    "MCHI":    {"name":"MSCI China ETF",      "type":"etf",   "sector":"ETF",          "themes":["etf","asie","emergent"],      "cap":5   },
    "EWJ":     {"name":"MSCI Japan ETF",      "type":"etf",   "sector":"ETF",          "themes":["etf","asie"],                 "cap":15  },
    "EWZ":     {"name":"MSCI Brazil ETF",     "type":"etf",   "sector":"ETF",          "themes":["etf","emergent"],             "cap":5   },
    "QQQM":    {"name":"Nasdaq 100 Mini",     "type":"etf",   "sector":"ETF",          "themes":["etf","tech"],                 "cap":30  },
    "XLK":     {"name":"Tech Sector ETF",     "type":"etf",   "sector":"ETF",          "themes":["etf","tech"],                 "cap":70  },
    "XLV":     {"name":"Health Care ETF",     "type":"etf",   "sector":"ETF",          "themes":["etf","sante"],                "cap":40  },
    "XLRE":    {"name":"Real Estate ETF",     "type":"etf",   "sector":"ETF",          "themes":["etf","immo"],                 "cap":10  },
    "XLP":     {"name":"Cons. Staples ETF",   "type":"etf",   "sector":"ETF",          "themes":["etf","conso","refuge"],       "cap":15  },
    "IVV":     {"name":"S&P 500 iShares",     "type":"etf",   "sector":"ETF",          "themes":["etf","marche"],               "cap":550 },
    "VTI":     {"name":"Vanguard Total Mkt",  "type":"etf",   "sector":"ETF",          "themes":["etf","marche"],               "cap":450 },
    "EWG":     {"name":"MSCI Germany ETF",    "type":"etf",   "sector":"ETF",          "themes":["etf","europe"],               "cap":7   },
    "IEMG":    {"name":"Core Émergents ETF",  "type":"etf",   "sector":"ETF",          "themes":["etf","emergent"],             "cap":80  },
    "^GSPC":   {"name":"S&P 500",             "type":"indice","sector":"Indices",       "themes":["indice","marche"],            "cap":99000},
    "^FCHI":   {"name":"CAC 40",              "type":"indice","sector":"Indices",       "themes":["indice","europe"],            "cap":3000 },
    "^GDAXI":  {"name":"DAX",                 "type":"indice","sector":"Indices",       "themes":["indice","europe"],            "cap":2500 },
    "^N225":   {"name":"Nikkei 225",          "type":"indice","sector":"Indices",       "themes":["indice","asie"],              "cap":6000 },
    "^FTSE":   {"name":"FTSE 100",            "type":"indice","sector":"Indices",       "themes":["indice","europe"],            "cap":2800 },
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def infer_type(ticker: str) -> str:
    if ticker.endswith("-USD"):
        return "crypto"
    if ticker.startswith("^"):
        return "indice"
    if ticker in _ETF_SET:
        return "etf"
    return "action"


def fetch_sp500():
    """Scrape S&P 500 list from Wikipedia -> [(ticker, name, gics_sector)]."""
    try:
        import urllib.request
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8")
        df = pd.read_html(html)[0]
        result = []
        for _, row in df.iterrows():
            t = str(row["Symbol"]).replace(".", "-").strip()
            n = str(row["Security"]).strip()
            s = str(row["GICS Sector"]).strip()
            result.append((t, n, s))
        print(f"  S&P 500: {len(result)} companies fetched from Wikipedia")
        return result
    except Exception as e:
        print(f"  Warning: S&P 500 scrape failed ({e}) - using curated list only")
        return []


def init_db(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS prices (
            ticker TEXT NOT NULL,
            date   TEXT NOT NULL,
            close  REAL,
            PRIMARY KEY (ticker, date)
        );
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
    """)
    conn.commit()


def last_dates(conn: sqlite3.Connection, tickers: list) -> dict:
    """Returns {ticker: 'YYYY-MM-DD'} for tickers that have stored rows."""
    if not tickers:
        return {}
    placeholders = ",".join("?" * len(tickers))
    rows = conn.execute(
        f"SELECT ticker, MAX(date) FROM prices WHERE ticker IN ({placeholders}) GROUP BY ticker",
        tickers,
    ).fetchall()
    return {r[0]: r[1] for r in rows}


def upsert(conn: sqlite3.Connection, ticker: str, series: pd.Series):
    """Bulk-insert a price series (index=Timestamp, values=float)."""
    rows = []
    for dt, v in series.items():
        try:
            fv = float(v)
        except (TypeError, ValueError):
            fv = None
        val = round(fv, 4) if fv is not None and not math.isnan(fv) else None
        rows.append((ticker, str(dt.date()), val))
    if rows:
        conn.executemany("INSERT OR REPLACE INTO prices VALUES (?,?,?)", rows)


def download(tickers: list, start: str, end: str) -> pd.DataFrame:
    """Batch-download closing prices via yfinance."""
    if not tickers:
        return pd.DataFrame()
    raw = yf.download(
        tickers,
        start=start,
        end=end,
        auto_adjust=True,
        progress=False,
        threads=True,
    )
    # yfinance returns multi-level columns when multiple tickers
    if hasattr(raw.columns, "levels"):
        raw = raw["Close"] if "Close" in raw.columns.get_level_values(0) else pd.DataFrame()
    elif isinstance(raw, pd.DataFrame) and "Close" in raw.columns:
        raw = raw["Close"]
    # Single-ticker case returns Series
    if isinstance(raw, pd.Series):
        raw = raw.to_frame(name=tickers[0])
    return raw


def compute_stats(conn: sqlite3.Connection, ticker: str):
    """Annualised mean return (mu) and volatility (sigma) from all stored prices."""
    rows = conn.execute(
        "SELECT close FROM prices WHERE ticker=? AND close IS NOT NULL ORDER BY date",
        (ticker,),
    ).fetchall()
    if len(rows) < MIN_ROWS:
        return None, None
    prices = np.array([r[0] for r in rows], dtype=float)
    rets = np.diff(prices) / prices[:-1]
    if len(rets) < MIN_ROWS - 1 or rets.std() == 0:
        return None, None
    mu    = round(float(rets.mean() * 252), 4)
    sigma = round(float(rets.std() * math.sqrt(252)), 4)
    return mu, sigma


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    END    = date.today().strftime("%Y-%m-%d")
    START  = (date.today() - timedelta(days=LOOKBACK)).strftime("%Y-%m-%d")
    CUTOFF = (date.today() - timedelta(days=3)).strftime("%Y-%m-%d")

    # ── 1. Build ticker universe ───────────────────────────────────────────────
    print("Building ticker universe...")
    sp500 = fetch_sp500()
    sp500_meta = {t: (n, s) for t, n, s in sp500}

    # Curated tickers first (preserves display order), then S&P 500 additions
    all_tickers = list(dict.fromkeys(CURATED + [t for t, _, _ in sp500]))
    print(f"Universe: {len(all_tickers)} tickers "
          f"({len(CURATED)} curated + {len(all_tickers) - len(CURATED)} from S&P 500)")

    # ── 2. Init SQLite ─────────────────────────────────────────────────────────
    os.makedirs("scripts", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    # ── 3. Classify tickers by download need ──────────────────────────────────
    ld = last_dates(conn, all_tickers)
    needs_full  = [t for t in all_tickers if t not in ld or ld[t] < START]
    needs_delta = [t for t in all_tickers if t not in needs_full and ld[t] < CUTOFF]
    up_to_date  = [t for t in all_tickers if t not in needs_full and t not in needs_delta]
    print(f"Full: {len(needs_full)} | Delta: {len(needs_delta)} | Up to date: {len(up_to_date)}")

    # ── 4. Full downloads ──────────────────────────────────────────────────────
    if needs_full:
        n_batches = math.ceil(len(needs_full) / CHUNK)
        print(f"\nFull download: {len(needs_full)} tickers in {n_batches} batch(es)...")
        for i in range(0, len(needs_full), CHUNK):
            chunk = needs_full[i:i + CHUNK]
            batch_n = i // CHUNK + 1
            print(f"  Batch {batch_n}/{n_batches}: {len(chunk)} tickers", end="", flush=True)
            try:
                raw = download(chunk, START, END)
                stored = 0
                for t in chunk:
                    if t in raw.columns:
                        s = raw[t].dropna()
                        if not s.empty:
                            upsert(conn, t, s)
                            stored += 1
                conn.commit()
                print(f" -> {stored} stored")
            except Exception as e:
                print(f" -> Error: {e}")
            if i + CHUNK < len(needs_full):
                time.sleep(1)

    # ── 5. Delta downloads ─────────────────────────────────────────────────────
    if needs_delta:
        # Group by last date to minimise batch count
        by_start: dict = {}
        ld2 = last_dates(conn, needs_delta)
        for t in needs_delta:
            s = ld2.get(t, START)
            by_start.setdefault(s, []).append(t)

        print(f"\nDelta download: {len(needs_delta)} tickers in {len(by_start)} date group(s)...")
        for group_start, group_tickers in sorted(by_start.items()):
            delta_start = (
                pd.Timestamp(group_start) + pd.Timedelta(days=1)
            ).strftime("%Y-%m-%d")
            for i in range(0, len(group_tickers), CHUNK):
                chunk = group_tickers[i:i + CHUNK]
                try:
                    raw = download(chunk, delta_start, END)
                    stored = 0
                    for t in chunk:
                        if t in raw.columns:
                            s = raw[t].dropna()
                            if not s.empty:
                                upsert(conn, t, s)
                                stored += 1
                    conn.commit()
                    if stored:
                        print(f"  {delta_start} -> {END}: {stored}/{len(chunk)} updated")
                except Exception as e:
                    print(f"  Error (delta {delta_start}): {e}")
                if i + CHUNK < len(group_tickers):
                    time.sleep(0.5)

    # ── 6. Compute mu/sigma + build metadata ───────────────────────────────────
    print("\nComputing asset parameters...")
    assets: dict = {}

    for ticker in all_tickers:
        mu, sigma = compute_stats(conn, ticker)
        if mu is None:
            continue

        if ticker in KNOWN_META:
            meta = dict(KNOWN_META[ticker])
        elif ticker in sp500_meta:
            name, gics = sp500_meta[ticker]
            meta = {
                "name":   name,
                "type":   infer_type(ticker),
                "sector": _GICS_SECTOR.get(gics, gics),
                "themes": _GICS_THEMES.get(gics, []),
                "cap":    0,
            }
        else:
            meta = {
                "name":   ticker,
                "type":   infer_type(ticker),
                "sector": "",
                "themes": [],
                "cap":    0,
            }

        assets[ticker] = {**meta, "mu": mu, "sigma": sigma}

    print(f"  {len(assets)} tickers with sufficient history (>={MIN_ROWS} days)")

    # ── 7. Build global business-day calendar ──────────────────────────────────
    all_bdays = [
        r[0]
        for r in conn.execute(
            "SELECT DISTINCT date FROM prices ORDER BY date"
        ).fetchall()
    ]

    # ── 8. Export prices.json ──────────────────────────────────────────────────
    print("\nExporting prices.json...")
    out_raw: dict = {}

    for ticker in all_tickers:
        if ticker not in assets:
            continue
        rows = conn.execute(
            "SELECT date, close FROM prices WHERE ticker=? ORDER BY date",
            (ticker,),
        ).fetchall()
        if len(rows) < MIN_ROWS:
            continue

        price_map = {r[0]: r[1] for r in rows}
        series = [price_map.get(d) for d in all_bdays]

        # Forward fill
        last_val = None
        filled = []
        for v in series:
            if v is not None:
                last_val = v
            filled.append(last_val)

        # Skip if no data at all
        if last_val is None:
            continue

        out_raw[ticker] = filled

    out_prices = {"updated": END, "bdays": all_bdays, "raw": out_raw}
    os.makedirs("public", exist_ok=True)
    px_str = json.dumps(out_prices, separators=(",", ":"))
    with open(OUT_PX, "w", encoding="utf-8") as f:
        f.write(px_str)
    print(f"  {len(out_raw)} tickers · {len(all_bdays)} trading days · {len(px_str) // 1024} KB")

    # ── 9. Export asset_params.json ────────────────────────────────────────────
    meta_out = {t: assets[t] for t in out_raw if t in assets}
    meta_str = json.dumps(meta_out, indent=2, ensure_ascii=False)
    with open(OUT_META, "w", encoding="utf-8") as f:
        f.write(meta_str)
    print(f"  asset_params.json: {len(meta_out)} tickers · {len(meta_str) // 1024} KB")

    conn.close()
    print(f"\nDone — {OUT_PX} and {OUT_META} updated.")


if __name__ == "__main__":
    main()
