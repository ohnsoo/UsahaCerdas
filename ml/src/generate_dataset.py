"""Generator dataset transaksi UMKM sintetis untuk UsahaCerdas.

Satu dataset dipakai untuk dua tugas:
  1. Kategorisasi: kolom `note` (keterangan bebas) -> `category` (6 kategori bawaan aplikasi).
  2. Prediksi arus kas: agregasi harian `amount` per `business_id`.

Setiap baris menyimpan `template_id` (pola kalimat asal). Evaluasi kategorisasi memisahkan
data uji berdasarkan template agar model diuji pada pola kalimat yang belum pernah dilihat.

Pemakaian:
    python ml/src/generate_dataset.py --out ml/data/transactions.csv --seed 42
"""
from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

START = date(2025, 5, 1)
END = date(2026, 10, 31)

# ---------------------------------------------------------------------------
# Kosakata per jenis usaha
# ---------------------------------------------------------------------------
BUSINESSES = {
    "kuliner": {
        "name": "Warung Kopi",
        "products": ["kopi susu", "es kopi gula aren", "teh tarik", "roti bakar", "mie goreng", "nasi goreng", "pisang goreng", "indomie telur"],
        "materials": ["biji kopi", "susu uht", "gula aren", "gula pasir", "roti tawar", "telur", "mie instan", "minyak goreng", "beras", "es batu", "cup plastik", "sedotan"],
        "suppliers": ["Toko Sinar Jaya", "pasar induk", "agen susu Pak Darto", "roastery Kopi Nusantara", "Indogrosir", "toko plastik Maju"],
        "tools": ["mesin espresso", "grinder", "kompor", "kulkas", "blender"],
        "base_sales": 1_400_000, "weekend": 1.35, "rent": 2_500_000, "staff": 2, "salary": 1_800_000,
    },
    "laundry": {
        "name": "Laundry Kiloan",
        "products": ["cuci kering setrika", "laundry kiloan", "cuci bed cover", "cuci sepatu", "setrika saja", "cuci karpet", "laundry express"],
        "materials": ["deterjen", "pewangi", "plastik laundry", "pelembut pakaian", "hanger", "label nota", "pemutih", "gas elpiji"],
        "suppliers": ["agen sabun Bu Rina", "toko kimia Sentosa", "grosir plastik Abadi", "Indogrosir"],
        "tools": ["mesin cuci", "pengering", "setrika uap", "pompa air"],
        "base_sales": 950_000, "weekend": 0.9, "rent": 1_800_000, "staff": 2, "salary": 1_600_000,
    },
    "kelontong": {
        "name": "Toko Kelontong",
        "products": ["sembako", "rokok", "minyak goreng", "beras 5kg", "gas elpiji", "air galon", "pulsa", "snack anak", "sabun mandi"],
        "materials": ["beras", "minyak goreng", "gula pasir", "telur", "rokok", "air mineral", "mie instan", "kopi sachet", "sabun cuci", "gas elpiji 3kg"],
        "suppliers": ["sales Unilever", "agen sembako Haji Rahmat", "grosir Alfa", "distributor rokok", "pasar induk"],
        "tools": ["freezer", "etalase", "timbangan", "rak besi"],
        "base_sales": 2_200_000, "weekend": 1.15, "rent": 1_500_000, "staff": 1, "salary": 1_700_000,
    },
    "fashion": {
        "name": "Fashion Online",
        "products": ["kaos oversize", "kemeja flanel", "hijab voal", "celana kulot", "tunik", "jaket hoodie", "gamis"],
        "materials": ["kain katun", "kain rayon", "benang jahit", "kancing", "label merek", "polymailer", "hangtag", "kain flanel"],
        "suppliers": ["Pasar Tanah Abang", "konveksi Bu Sri", "toko kain Cigondewah", "supplier polymailer"],
        "tools": ["mesin jahit", "mesin obras", "printer label", "ring light"],
        "base_sales": 1_800_000, "weekend": 1.25, "rent": 1_200_000, "staff": 2, "salary": 1_900_000,
    },
}

NAMES = ["Bu Ani", "Pak Budi", "Mbak Sinta", "Mas Dedi", "Bu Tini", "Pak Joko", "Dina", "Rizky", "Ayu", "Fajar", "Bu Lastri", "Pak Agus"]
PLATFORMS = ["shopee", "tokopedia", "gofood", "grabfood", "tiktok shop", "shopeefood", "whatsapp"]
COURIERS = ["jne", "j&t", "sicepat", "anteraja", "pos", "gosend", "grab express"]
MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"]
TIMES = ["pagi", "siang", "sore", "malam", "hari ini", "kemarin", "shift pagi", "shift malam"]


def qty(rng: random.Random) -> str:
    n = rng.choice([1, 2, 3, 5, 10, 12, 20, 25, 50])
    unit = rng.choice(["kg", "pcs", "pak", "dus", "liter", "bal", "lusin", "sak", "rim", "karung"])
    sep = rng.choice(["", " "])
    return f"{n}{sep}{unit}"


def nominal(rng: random.Random) -> str:
    v = rng.choice([25, 50, 75, 100, 150, 200, 250, 300, 500])
    return rng.choice([f"{v}rb", f"{v}k", f"{v}.000", f"rp{v}rb"])


# ---------------------------------------------------------------------------
# Template per kategori. Setiap template adalah fungsi (rng, biz) -> str.
# Kategori mengikuti kategori bawaan aplikasi (backend/src/app.ts, register).
# ---------------------------------------------------------------------------
T = dict[str, list]

TEMPLATES: T = {
    "Penjualan": [
        lambda r, b: f"penjualan {r.choice(b['products'])} {r.choice(TIMES)}",
        lambda r, b: f"jual {r.randint(2, 40)} {r.choice(b['products'])}",
        lambda r, b: "omzet " + r.choice(TIMES),
        lambda r, b: f"pesanan {r.choice(PLATFORMS)} {r.choice(b['products'])}",
        lambda r, b: f"transfer dari pelanggan {r.choice(NAMES)} untuk {r.choice(b['products'])}",
        lambda r, b: f"bayar qris {r.choice(b['products'])}",
        lambda r, b: f"cod {r.choice(b['products'])} a.n. {r.choice(NAMES)}",
        lambda r, b: f"dp pesanan {r.choice(b['products'])} {r.choice(NAMES)}",
        lambda r, b: f"pelunasan order {r.choice(b['products'])}",
        lambda r, b: f"pencairan saldo {r.choice(PLATFORMS)}",
        lambda r, b: f"setoran kasir {r.choice(TIMES)}",
        lambda r, b: f"pembeli borong {r.choice(b['products'])}",
    ],
    "Pendapatan Lain": [
        lambda r, b: f"cashback {r.choice(PLATFORMS)}",
        lambda r, b: "bunga tabungan bank",
        lambda r, b: "jual kardus bekas ke pengepul",
        lambda r, b: f"komisi titip jual {r.choice(NAMES)}",
        lambda r, b: f"refund ongkir {r.choice(COURIERS)}",
        lambda r, b: "hadiah lomba umkm kecamatan",
        lambda r, b: f"sewa tempat parkir ke {r.choice(NAMES)}",
        lambda r, b: f"bonus program mitra {r.choice(PLATFORMS)}",
        lambda r, b: f"jual {r.choice(b['tools'])} bekas",
        lambda r, b: "kembalian lebih bayar dari supplier",
    ],
    "Bahan Baku": [
        lambda r, b: f"beli {r.choice(b['materials'])} {qty(r)}",
        lambda r, b: f"belanja {r.choice(b['materials'])} dan {r.choice(b['materials'])} di {r.choice(b['suppliers'])}",
        lambda r, b: f"restock {r.choice(b['materials'])}",
        lambda r, b: f"kulakan dari {r.choice(b['suppliers'])}",
        lambda r, b: f"{r.choice(b['materials'])} {qty(r)} {r.choice(b['suppliers'])}",
        lambda r, b: f"stok {r.choice(b['materials'])} habis, beli lagi",
        lambda r, b: f"bayar nota {r.choice(b['suppliers'])}",
        lambda r, b: f"tambah persediaan {r.choice(b['materials'])}",
        lambda r, b: f"order bahan {r.choice(b['materials'])} ke {r.choice(b['suppliers'])}",
        lambda r, b: f"pelunasan bon {r.choice(b['suppliers'])}",
    ],
    "Operasional": [
        lambda r, b: f"bayar listrik bulan {r.choice(MONTHS)}",
        lambda r, b: f"token listrik {nominal(r)}",
        lambda r, b: f"sewa tempat bulan {r.choice(MONTHS)}",
        lambda r, b: f"gaji karyawan {r.choice(NAMES)}",
        lambda r, b: f"kuota internet {nominal(r)}",
        lambda r, b: "tagihan air pdam",
        lambda r, b: f"servis {r.choice(b['tools'])}",
        lambda r, b: "iuran kebersihan dan keamanan",
        lambda r, b: "biaya admin bank",
        lambda r, b: "langganan wifi indihome",
        lambda r, b: f"uang makan karyawan {r.choice(TIMES)}",
        lambda r, b: f"ganti sparepart {r.choice(b['tools'])}",
    ],
    "Transportasi": [
        lambda r, b: f"bensin motor {nominal(r)}",
        lambda r, b: f"ongkir {r.choice(COURIERS)} kirim {r.choice(b['products'])}",
        lambda r, b: "parkir pasar",
        lambda r, b: f"gojek antar pesanan ke {r.choice(NAMES)}",
        lambda r, b: f"grab ke {r.choice(b['suppliers'])}",
        lambda r, b: f"isi pertalite {r.randint(2, 10)} liter",
        lambda r, b: "bayar tol",
        lambda r, b: f"sewa pickup angkut {r.choice(b['materials'])}",
        lambda r, b: f"ojek ke {r.choice(b['suppliers'])}",
        lambda r, b: f"pengiriman paket via {r.choice(COURIERS)}",
    ],
    "Lain-lain": [
        lambda r, b: "sumbangan masjid",
        lambda r, b: "fotokopi dan materai",
        lambda r, b: f"kado untuk pelanggan {r.choice(NAMES)}",
        lambda r, b: "perbaikan atap bocor",
        lambda r, b: "biaya izin usaha nib",
        lambda r, b: "sumbangan 17an rt",
        lambda r, b: "beli obat p3k",
        lambda r, b: "denda telat bayar",
        lambda r, b: "cetak spanduk promo",
        lambda r, b: f"selamatan {r.choice(['buka cabang', 'ulang tahun toko', 'syukuran'])}",
    ],
}
CATEGORY_TYPE = {"Penjualan": "INCOME", "Pendapatan Lain": "INCOME", "Bahan Baku": "EXPENSE",
                 "Operasional": "EXPENSE", "Transportasi": "EXPENSE", "Lain-lain": "EXPENSE"}

ABBREV = {"untuk": "utk", "dengan": "dgn", "bulan": "bln", "yang": "yg", "pelanggan": "plgn", "karyawan": "kary",
          "pembayaran": "pmbyrn", "transfer": "tf", "bayar": "byr", "dari": "dr", "belanja": "blnj"}


def add_noise(text: str, rng: random.Random) -> str:
    """Variasi gaya menulis pemilik usaha: singkatan, salah ketik, kapitalisasi."""
    words = text.split()
    if rng.random() < 0.35:
        words = [ABBREV.get(w, w) if rng.random() < 0.6 else w for w in words]
    if rng.random() < 0.12 and words:  # salah ketik: tukar dua huruf
        i = rng.randrange(len(words))
        w = words[i]
        if len(w) > 3:
            j = rng.randrange(len(w) - 1)
            words[i] = w[:j] + w[j + 1] + w[j] + w[j + 2:]
    text = " ".join(words)
    r = rng.random()
    if r < 0.15:
        text = text.upper()
    elif r < 0.45:
        text = text.capitalize()
    if rng.random() < 0.1:
        text += rng.choice([" lunas", " (cash)", " tf bca", " via qris", " ok", "!!"])
    return text


@dataclass
class Row:
    business_id: str
    business_type: str
    date: date
    type: str
    category: str
    amount: int
    note: str
    template_id: str


def round_rp(x: float, step: int = 500) -> int:
    return max(step, int(round(x / step)) * step)


def generate(seed: int = 42) -> pd.DataFrame:
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)
    rows: list[Row] = []
    days = (END - START).days + 1

    def emit(bid, btype, d, cat, amount, biz, templates=None):
        k = rng.choice(templates) if templates else rng.randrange(len(TEMPLATES[cat]))
        note = add_noise(TEMPLATES[cat][k](rng, biz), rng)
        rows.append(Row(bid, btype, d, CATEGORY_TYPE[cat], cat, round_rp(amount), note, f"{cat}#{k}"))

    for btype, biz in BUSINESSES.items():
        bid = f"biz-{btype}"
        utility_day = {}  # tanggal bayar listrik/air per bulan, tetap dalam satu bulan
        for i in range(days):
            d = START + timedelta(days=i)
            trend = 1 + 0.25 * i / days                                  # tumbuh ~25% selama periode
            week = biz["weekend"] if d.weekday() >= 5 else 1.0
            payday = 1.15 if d.day >= 25 or d.day <= 3 else 1.0           # efek gajian
            closed = btype == "laundry" and d.weekday() == 6 and rng.random() < 0.7
            if closed:
                continue
            daily_sales = biz["base_sales"] * trend * week * payday * np_rng.lognormal(0, 0.25)

            # Penjualan dipecah 2-6 catatan per hari
            parts = np_rng.dirichlet(np.full(rng.randint(2, 6), 3.0)) * daily_sales
            for p in parts:
                emit(bid, btype, d, "Penjualan", p, biz)
            if rng.random() < 0.04:
                emit(bid, btype, d, "Pendapatan Lain", np_rng.lognormal(np.log(80_000), 0.6), biz)

            # Bahan baku ~ 45% omzet, dibeli tiap 1-3 hari
            if rng.random() < 0.55:
                emit(bid, btype, d, "Bahan Baku", daily_sales * rng.uniform(0.55, 1.1), biz)
            # Transportasi kecil dan sering
            if rng.random() < 0.6:
                emit(bid, btype, d, "Transportasi", np_rng.lognormal(np.log(30_000), 0.5), biz)
            # Operasional tetap bulanan
            # Indeks template Operasional: 0 listrik, 1 token, 2 sewa, 3 gaji, 5 pdam; sisanya biaya kecil.
            if d.day == 1:
                emit(bid, btype, d, "Operasional", biz["rent"], biz, [2])
            ym = (d.year, d.month)
            utility_day.setdefault(ym, rng.choice([5, 6, 7, 8, 9]))
            if d.day == utility_day[ym]:
                emit(bid, btype, d, "Operasional", np_rng.normal(450_000, 60_000), biz, [0, 1, 5])
            if d.day == 28:
                for _ in range(biz["staff"]):
                    emit(bid, btype, d, "Operasional", biz["salary"] * trend, biz, [3])
            if rng.random() < 0.08:
                emit(bid, btype, d, "Operasional", np_rng.lognormal(np.log(60_000), 0.5), biz, [4, 6, 7, 8, 9, 10, 11])
            if rng.random() < 0.03:
                emit(bid, btype, d, "Lain-lain", np_rng.lognormal(np.log(100_000), 0.7), biz)

    df = pd.DataFrame([r.__dict__ for r in rows])
    df["date"] = pd.to_datetime(df["date"])

    # 2% label noise: pemilik usaha kadang salah pilih kategori (realistis untuk data input manual).
    # `true_category` menyimpan label sebenarnya untuk evaluasi; `category` adalah label yang "dicatat".
    df["true_category"] = df["category"]
    noise_idx = df.sample(frac=0.02, random_state=seed).index
    for idx in noise_idx:
        same_type = [c for c, t in CATEGORY_TYPE.items() if t == df.at[idx, "type"] and c != df.at[idx, "category"]]
        df.at[idx, "category"] = rng.choice(same_type)
    return df.sort_values(["business_id", "date"]).reset_index(drop=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="ml/data/transactions.csv")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    df = generate(args.seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    print(f"{len(df):,} transaksi, {df.business_id.nunique()} usaha, {df.date.min().date()} s.d. {df.date.max().date()} -> {out}")
    print(df.category.value_counts().to_string())


if __name__ == "__main__":
    main()
