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
    # Tech
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "ORCL", "CRM", "AMD", "INTC",
    # Finance
    "JPM", "GS", "BRK-B", "V", "MA", "PYPL",
    # Santé
    "JNJ", "PFE", "UNH", "LLY", "MRNA", "ISRG",
    # Énergie
    "XOM", "CVX", "ENPH", "NEE",
    # Consommation
    "TSLA", "NKE", "MC.PA",
    # Industrie
    "BA", "CAT", "LMT",
    # Immobilier (REITs)
    "PLD", "AMT", "EQIX",
    # Matériaux
    "LIN", "NEM", "FCX",
    # Utilities
    "DUK", "SO",
    # Télécom
    "VZ", "TMUS",
    # Conso. défensive
    "PG", "KO",
    # Cyber
    "CRWD", "PANW", "FTNT",
    # Nucléaire
    "CCJ", "CEG",
    # Space & Défense
    "LHX",
    # Eau
    "XYL", "AWK",
    # Gaming
    "TTWO", "RBLX",
    # Fintech
    "SQ", "COIN",
    # Crypto (trades 7 days/week – ffill'd to business days)
    "BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "DOGE-USD",
    # ETF
    "SPY", "QQQ", "GLD", "ARKK", "XLF", "XLE", "ICLN", "VWO",
    # Indices
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
