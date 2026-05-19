"""
Fetch 5 years of daily closing prices from Yahoo Finance.
Outputs public/prices.json consumed by the React frontend.

Usage:
    pip install -r scripts/requirements.txt
    python scripts/fetch_prices.py
"""
import json
import math
import os
from datetime import date, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

START = (date.today() - timedelta(days=5 * 365 + 15)).strftime("%Y-%m-%d")
END = date.today().strftime("%Y-%m-%d")

TICKERS = [
    # ── US Tech (33)
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "ORCL", "CRM", "AMD", "INTC",
    "NFLX", "ADBE", "NOW", "SNOW", "PLTR", "UBER", "ABNB", "AVGO", "QCOM", "AMAT",
    "TXN", "TSM", "SPOT", "INTU", "NET", "ZS", "CSCO", "ACN", "IBM",
    "CRWD", "PANW", "FTNT", "RBLX",
    # ── US Finance (19)
    "JPM", "GS", "BRK-B", "V", "MA", "PYPL", "SQ", "COIN",
    "BAC", "WFC", "MS", "C", "AXP", "SCHW", "BLK", "SPGI", "ICE", "CME", "AFL",
    # ── US Santé (18)
    "JNJ", "PFE", "UNH", "LLY", "MRNA", "ISRG",
    "ABBV", "MRK", "AMGN", "BMY", "GILD", "MDT", "REGN", "VRTX", "CVS", "ELV", "SYK", "BSX",
    # ── US Énergie (10)
    "XOM", "CVX", "ENPH", "NEE", "CCJ",
    "SLB", "EOG", "MPC", "VLO", "HAL",
    # ── US Conso. discrétionnaire (13)
    "TSLA", "NKE", "MC.PA", "TTWO",
    "SBUX", "MCD", "DIS", "COST", "HD", "LOW", "TJX", "BKNG", "LULU", "F",
    # ── US Conso. défensive (4)
    "PG", "KO", "WMT", "MDLZ",
    # ── US Industrie (10)
    "BA", "CAT", "LMT", "LHX",
    "RTX", "GE", "HON", "DE", "UPS", "NOC",
    # ── US Immobilier REITs (5)
    "PLD", "AMT", "EQIX", "O", "PSA",
    # ── US Matériaux (7)
    "LIN", "NEM", "FCX", "APD", "ECL", "DOW", "NUE",
    # ── US Utilities (6)
    "DUK", "SO", "CEG", "XYL", "AWK", "AEP",
    # ── US Télécom (3)
    "VZ", "TMUS", "T",
    # ── Europe (14)
    "ASML", "SAP", "NVO", "AIR.PA", "TTE.PA", "RMS.PA", "AZN", "SHEL",
    "OR.PA", "BNP.PA", "SIE.DE", "VOW.DE", "INGA.AS", "NSRGY",
    # ── Asie (6)
    "TM", "SONY", "BABA", "SE", "BYDDY", "9984.T",
    # ── Crypto (14) – trades 7 days/week, ffill'd to business days
    "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "DOGE-USD",
    "ADA-USD", "AVAX-USD", "LINK-USD", "DOT-USD", "MATIC-USD", "UNI-USD", "FIL-USD", "ATOM-USD",
    # ── ETF (32)
    "SPY", "QQQ", "GLD", "ARKK", "XLF", "XLE", "ICLN", "VWO",
    "IWM", "EFA", "EEM", "TLT", "LQD", "HYG", "SOXX", "GDX",
    "SCHD", "JEPI", "IAU", "SLV", "MCHI", "EWJ", "EWZ", "QQQM",
    "XLK", "XLV", "XLRE", "XLP", "IVV", "VTI", "EWG", "IEMG",
    # ── Indices (5)
    "^GSPC", "^FCHI", "^GDAXI", "^N225", "^FTSE",
]


def main():
    print(f"Downloading {len(TICKERS)} tickers  {START} → {END} …")
    raw = yf.download(
        TICKERS,
        start=START,
        end=END,
        auto_adjust=True,
        progress=False,
        threads=True,
    )["Close"]

    # Ensure we have a DataFrame even if a single ticker was returned
    if isinstance(raw, pd.Series):
        raw = raw.to_frame(name=TICKERS[0])

    # Align to business-day calendar and fill weekend/holiday gaps
    bdays = pd.bdate_range(start=raw.index[0], end=raw.index[-1])
    raw = raw.reindex(bdays).ffill().bfill()

    out = {
        "updated": END,
        "bdays": [str(d.date()) for d in bdays],
        "raw": {},
    }

    skipped, ok = [], 0
    for ticker in TICKERS:
        col = ticker if ticker in raw.columns else None
        if col is None:
            skipped.append(ticker)
            continue
        series = raw[col].ffill().bfill()
        if series.isna().all():
            skipped.append(ticker)
            continue
        out["raw"][ticker] = [
            round(float(v), 4) if not math.isnan(v) else None
            for v in series.tolist()
        ]
        ok += 1

    if skipped:
        print(f"  Skipped ({len(skipped)}): {', '.join(skipped)}")

    out_path = "public/prices.json"
    os.makedirs("public", exist_ok=True)
    json_str = json.dumps(out, separators=(",", ":"))
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(json_str)

    size_kb = len(json_str.encode()) / 1024
    print(f"Done: {ok}/{len(TICKERS)} tickers · {len(out['bdays'])} trading days · {size_kb:.0f} KB")
    print(f"Saved → {out_path}")


if __name__ == "__main__":
    main()
