# Skenario Pengujian — Belum dieksekusi pada database nyata

Checklist berikut adalah rencana pengujian, **bukan** hasil PASS.

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| T01 | Register dengan usaha baru | User, usaha, Kas Utama, kategori default tercipta |
| T02 | Register email duplikat | HTTP 409 |
| T03 | Login password salah | HTTP 401 |
| T04 | Akses laporan tanpa login | HTTP 401 |
| T05 | Owner A mencoba mengubah transaksi Owner B | HTTP 404, data B tidak berubah |
| T06 | Nominal kosong, 0, negatif, format salah | HTTP 400 |
| T07 | Kategori pengeluaran dipakai untuk pemasukan | HTTP 400 |
| T08 | Rekening milik usaha lain | HTTP 400 |
| T09 | Transfer ke rekening sendiri | HTTP 400 |
| T10 | Penghapusan kategori yang dipakai transaksi | HTTP 409 |
| T11 | Saldo awal 1 juta, income 500 ribu, expense 200 ribu | Saldo 1,3 juta, surplus 300 ribu |
| T12 | Dari T11: tambah modal 1 juta dan prive 100 ribu | Saldo 2,2 juta; surplus tetap 300 ribu |
| T13 | Transfer 300 ribu antara dua rekening kas | Saldo per akun berubah; total kas & surplus tetap |
| T14 | Edit atau hapus transaksi | Dashboard dan laporan dihitung ulang, audit log dibuat |
| T15 | Filter tanggal dan kategori | Hasil hanya dari rentang/jenis yang sesuai |
| T16 | Refresh halaman saat login | Sesi tersimpan selama token masih valid |
| T17 | Logout, kembali ke dashboard | Dialihkan ke halaman login |
| T18 | Layar desktop dan mobile | Sidebar dan form tetap dapat dipakai |

## Data contoh manual (T11–T13)

- Kas Utama saldo awal: Rp1.000.000
- Pemasukan operasional: Rp500.000
- Pengeluaran operasional: Rp200.000
- Modal: Rp1.000.000
- Prive: Rp100.000
- Akun tambahan: saldo awal Rp0
- Transfer Kas Utama → akun tambahan: Rp300.000
- Saldo Kas Utama: Rp1.900.000, akun kedua: Rp300.000, total Rp2.200.000
- Surplus operasional: Rp300.000

## Langkah testing yang disarankan

1. Jalankan database, migrasi, backend, frontend.
2. Jalankan `npm test` untuk skenario API otomatis (T01 sampai T17 dan aturan rekening), lalu cek alur UI di browser.
3. Simpan bukti dan status hasil pada dokumen pengujian yang dibuat dari tabel ini.
4. Jika melakukan perubahan kode ketika memperbaiki bug, tambahkan entri di `docs/CHANGELOG.md`.
