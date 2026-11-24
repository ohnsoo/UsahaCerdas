"""Baseline prediksi arus kas harian 30 hari ke depan per usaha.

Target: arus kas bersih harian = pemasukan (INCOME) - pengeluaran (EXPENSE).
Evaluasi rolling-origin: 6 titik awal (origin) setiap 30 hari di 180 hari terakhir, horizon 30 hari.
Model hanya memakai data sebelum origin (tidak ada kebocoran waktu).

Metode:
  - naive_mean      : rata-rata 28 hari terakhir untuk semua hari ke depan.
  - seasonal_weekly : rata-rata hari yang sama (Senin, Selasa, ...) dalam 4 minggu terakhir.
  - gbm_calendar    : HistGradientBoosting dengan fitur kalender (hari, tanggal, gajian) dan
                      statistik historis per usaha (rata-rata 28 hari, per hari-minggu, per tanggal).

Metrik: MAE harian dan MAE total 30 hari (selisih perubahan saldo kas di akhir horizon).

Pemakaian:
    python ml/src/forecast_baseline.py --data ml/data/transactions.csv
Hasil: ml/reports/forecast_metrics.json, ml/reports/forecast_example.png
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

HORIZON = 30
N_ORIGINS = 6
STEP = 30


def daily_net(df: pd.DataFrame) -> pd.DataFrame:
    df = df.assign(signed=np.where(df["type"] == "INCOME", df["amount"], -df["amount"]))
    out = []
    for bid, g in df.groupby("business_id"):
        s = g.groupby("date")["signed"].sum()
        s = s.reindex(pd.date_range(df["date"].min(), df["date"].max(), freq="D"), fill_value=0)
        out.append(pd.DataFrame({"business_id": bid, "date": s.index, "net": s.values}))
    return pd.concat(out, ignore_index=True)


def history_stats(hist: pd.Series) -> dict:
    """Statistik dari riwayat (indeks tanggal) sampai sebelum origin."""
    last28 = hist.iloc[-28:]
    last4w = hist.iloc[-28:]
    dow = last4w.groupby(last4w.index.dayofweek).mean()
    last180 = hist.iloc[-180:]
    dom = last180.groupby(last180.index.day).mean()
    return {"level28": last28.mean(), "dow": dow, "dom": dom}


def features(dates: pd.DatetimeIndex, origin: pd.Timestamp, st: dict, biz_code: int) -> pd.DataFrame:
    return pd.DataFrame({
        "biz": biz_code,
        "dow": dates.dayofweek,
        "dom": dates.day,
        "payday": ((dates.day >= 25) | (dates.day <= 3)).astype(int),
        "ahead": (dates - origin).days,
        "level28": st["level28"],
        "dow_mean": [st["dow"].get(d, st["level28"]) for d in dates.dayofweek],
        "dom_mean": [st["dom"].get(d, st["level28"]) for d in dates.day],
    })


def forecast_all(series: dict[str, pd.Series], origin: pd.Timestamp, biz_codes: dict[str, int]) -> dict[str, dict[str, np.ndarray]]:
    horizon_dates = pd.date_range(origin, periods=HORIZON, freq="D")
    preds: dict[str, dict[str, np.ndarray]] = {}

    # Data latih GBM: origin mingguan di masa lalu, target harus sebelum origin evaluasi.
    X_parts, y_parts = [], []
    for bid, s in series.items():
        first = s.index[0] + pd.Timedelta(days=180)
        for o in pd.date_range(first, origin - pd.Timedelta(days=HORIZON), freq="7D"):
            hist = s[s.index < o]
            tgt_dates = pd.date_range(o, periods=HORIZON, freq="D")
            X_parts.append(features(tgt_dates, o, history_stats(hist), biz_codes[bid]))
            y_parts.append(s.reindex(tgt_dates).values)
    gbm = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, categorical_features=[0], random_state=42)
    gbm.fit(pd.concat(X_parts, ignore_index=True), np.concatenate(y_parts))

    for bid, s in series.items():
        hist = s[s.index < origin]
        st = history_stats(hist)
        preds[bid] = {
            "naive_mean": np.full(HORIZON, st["level28"]),
            "seasonal_weekly": np.array([st["dow"].get(d, st["level28"]) for d in horizon_dates.dayofweek]),
            "gbm_calendar": gbm.predict(features(horizon_dates, origin, st, biz_codes[bid])),
            "actual": s.reindex(horizon_dates).values,
        }
    return preds


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/data/transactions.csv")
    ap.add_argument("--reports", default="ml/reports")
    args = ap.parse_args()
    reports = Path(args.reports)
    reports.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(args.data, parse_dates=["date"])
    daily = daily_net(df)
    series = {bid: g.set_index("date")["net"] for bid, g in daily.groupby("business_id")}
    biz_codes = {bid: i for i, bid in enumerate(sorted(series))}
    last = daily["date"].max()
    origins = [last - pd.Timedelta(days=STEP * k + HORIZON - 1) for k in range(N_ORIGINS - 1, -1, -1)]

    methods = ["naive_mean", "seasonal_weekly", "gbm_calendar"]
    rows = []
    example = None
    for origin in origins:
        preds = forecast_all(series, origin, biz_codes)
        for bid, p in preds.items():
            for m in methods:
                rows.append({"origin": origin.date().isoformat(), "business_id": bid, "method": m,
                             "mae_daily": float(np.mean(np.abs(p[m] - p["actual"]))),
                             "abs_err_30d_total": float(abs(p[m].sum() - p["actual"].sum())),
                             "actual_30d_total": float(p["actual"].sum())})
        example = (origin, preds)

    res = pd.DataFrame(rows)
    summary = res.groupby("method")[["mae_daily", "abs_err_30d_total"]].mean().round(0)
    per_biz = res.groupby(["business_id", "method"])["mae_daily"].mean().unstack().round(0)
    mean_abs_daily = float(daily["net"].abs().mean())
    print(f"Rata-rata |arus kas bersih harian|: Rp{mean_abs_daily:,.0f}")
    print(summary.to_string())
    print(per_biz.to_string())

    metrics = {
        "origins": [o.date().isoformat() for o in origins], "horizon_days": HORIZON,
        "mean_abs_daily_net": mean_abs_daily,
        "summary": summary.reset_index().to_dict("records"),
        "per_business_mae_daily": per_biz.reset_index().to_dict("records"),
        "folds": rows,
    }
    (reports / "forecast_metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf8")

    origin, preds = example
    bid = "biz-kuliner"
    dates = pd.date_range(origin, periods=HORIZON, freq="D")
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(dates, np.cumsum(preds[bid]["actual"]), label="Aktual", color="black", linewidth=2)
    for m, c in zip(methods, ["#999999", "#4C78A8", "#E45756"]):
        ax.plot(dates, np.cumsum(preds[bid][m]), label=m, color=c, linestyle="--")
    ax.set_title(f"Perubahan saldo kas kumulatif 30 hari, {bid}, origin {origin.date()}")
    ax.set_ylabel("Rupiah")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(reports / "forecast_example.png", dpi=120)
    plt.close(fig)


if __name__ == "__main__":
    main()
