# UsahaCerdas ML

Eksperimen machine learning untuk UsahaCerdas: **kategorisasi transaksi otomatis** dan **prediksi arus kas 30 hari**. Kode di folder ini terpisah dari aplikasi web dan belum dipasang ke aplikasi.

## Setup

```bash
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt   # Windows
# source ml/.venv/bin/activate && pip install -r ml/requirements.txt   # macOS/Linux
```

Jalankan semua perintah dari root repo. `ml/.venv`, `ml/data`, dan `ml/models` diabaikan git karena bisa dibuat ulang.

## Alur

| Langkah | Perintah | Hasil |
|---|---|---|
| 1. Dataset sintetis | `python ml/src/generate_dataset.py` | `ml/data/transactions.csv` |
| 2. Kategorisasi | `python ml/src/train_categorizer.py` | `ml/reports/categorizer_metrics.json`, `categorizer_confusion.png`, `ml/models/categorizer.joblib` |
| 3. Prediksi arus kas | `python ml/src/forecast_baseline.py` | `ml/reports/forecast_metrics.json`, `forecast_example.png` |
| Semua + penjelasan | `ml/notebooks/01_baseline.ipynb` | Notebook dengan output tersimpan |

Semua langkah memakai seed 42 sehingga hasilnya bisa diulang.

## Dataset

Data sintetis 4 UMKM (warung kopi, laundry, toko kelontong, fashion online), 1 Mei 2025 sampai 31 Oktober 2026, sekitar 11.800 transaksi. Kolom: `business_id`, `business_type`, `date`, `type`, `category`, `true_category`, `amount`, `note`, `template_id`.

- Kategori mengikuti 6 kategori bawaan aplikasi: Penjualan, Pendapatan Lain, Bahan Baku, Operasional, Transportasi, Lain-lain.
- Keterangan dibuat dari 64 pola kalimat dengan variasi singkatan, salah ketik, dan kapitalisasi.
- 2% label sengaja salah di `category` (meniru salah input); evaluasi memakai `true_category`.
- Arus kas memuat tren naik, pola akhir pekan, efek tanggal gajian, sewa tiap tanggal 1, listrik/air awal bulan, dan gaji tiap tanggal 28.

**Keterbatasan:** data sintetis tidak menangkap seluruh variasi cara menulis pemilik usaha sungguhan. Hasil di bawah adalah baseline, bukan performa produksi.

## Hasil baseline

### Kategorisasi (TF-IDF kata + karakter, Logistic Regression)

Hiperparameter dipilih dengan `GroupKFold` per template **hanya di data latih**; data uji dipakai sekali.

| Skema uji | Dummy macro-F1 | Akurasi | Macro-F1 |
|---|---|---|---|
| Split acak (pola kalimat sudah dikenal) | 0,142 | 1,000 | 0,994 |
| Split per template (pola kalimat baru) | 0,148 | 0,932 | **0,513** |

Split per template adalah angka yang relevan. Penjualan (F1 1,00) dan Bahan Baku (0,80) baik; Operasional (0,66) dan Transportasi (0,62) sedang, dengan Transportasi sering tertebak Bahan Baku karena kalimat ongkir menyebut nama barang; Pendapatan Lain dan Lain-lain gagal (0,00) karena kalimatnya unik.

### Prediksi arus kas (rolling-origin, 6 titik, horizon 30 hari)

| Metode | MAE harian | Error total 30 hari | % dari rata-rata total 30 hari |
|---|---|---|---|
| naive_mean (rata-rata 28 hari) | Rp1.023.587 | Rp9.135.688 | 31% |
| seasonal_weekly (per hari dalam minggu) | Rp1.138.629 | Rp9.149.203 | 31% |
| **gbm_calendar** (HistGradientBoosting + fitur kalender) | **Rp968.699** | **Rp5.885.371** | **20%** |

## Langkah berikutnya

1. Menambah keragaman kalimat dan memakai data asli aplikasi bila sudah cukup.
2. Mencoba sentence embedding / IndoBERT untuk kategori dengan kalimat unik.
3. Integrasi ke aplikasi: saran kategori saat input transaksi dan peringatan kas menipis di dashboard.
