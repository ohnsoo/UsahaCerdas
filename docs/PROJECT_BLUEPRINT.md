# Project Blueprint — UsahaCerdas v0.1

## 1. Identitas

- **Nama:** UsahaCerdas
- **Judul:** Pengembangan Aplikasi Web Manajemen dan Analisis Keuangan UMKM Berbasis Dashboard Interaktif
- **Target MVP:** Pemilik UMKM dari berbagai jenis usaha; satu akun memiliki satu usaha (skemanya membuka kemungkinan multi-usaha kelak).
- **Status:** Fondasi kode awal untuk pengembangan dan validasi, bukan sistem akuntansi resmi.

## 2. Problem statement

Bagaimana membantu pelaku UMKM melakukan pencatatan transaksi yang terstruktur, memantau arus kas dan surplus operasional, serta memahami perkembangan usaha melalui informasi yang mudah dibaca?

Akar masalah *hipotesis* yang perlu divalidasi melalui wawancara: pencatatan tidak konsisten, dana usaha/pribadi tercampur, biaya tidak dikelompokkan, laporan manual, dan minimnya insight.

## 3. Tujuan dan dampak yang diharapkan

1. Memperbaiki keteraturan pencatatan keuangan.
2. Memisahkan transaksi operasional, modal, prive, dan transfer.
3. Memberikan dashboard dan laporan berbasis kas.
4. Mendukung keputusan yang lebih berbasis data.

**Dampak tidak otomatis terjadi**: evaluasi dengan skenario task, akurasi kalkulasi, SUS, dan validasi bersama UMKM.

## 4. Batas MVP

**Termasuk:** registrasi/login, profil usaha, akun kas, kategori, CRUD transaksi, filter transaksi, dashboard keuangan, laporan kas sederhana, autentikasi dan isolasi data.

**Belum termasuk:** HPP & stok, akuntansi akrual, utang/piutang, pajak, integrasi bank, export PDF/XLSX, pegawai, AI, notifikasi, multi-business dalam UI.

## 5. Aktor

- **Guest:** landing, registrasi, login.
- **Owner:** akses data usahanya, transaksi, akun, kategori, dashboard dan laporan.

## 6. Kebutuhan fungsional

| ID | Kebutuhan | Implementasi awal |
|---|---|---|
| FR01 | Registrasi/login/logout | Ada |
| FR02 | Profil usaha | Ada |
| FR03 | Pengelolaan akun kas | Daftar + tambah |
| FR04 | Pengelolaan kategori | Daftar + tambah + hapus |
| FR05 | CRUD transaksi | Ada |
| FR06 | Validasi nominal dan jenis | Ada |
| FR07 | Dashboard ringkasan & grafik | Ada |
| FR08 | Laporan periode kas | Ada |
| FR09 | Filter kategori/periode | Ada |
| FR10 | Isolasi data pemilik | Ada di endpoint utama; perlu uji integrasi |

## 7. Kebutuhan nonfungsional

Keamanan akses, validasi server, harga/uang decimal, responsif, kode modular, dokumentasi perubahan, integritas relasi, target respons dashboard <3 detik pada dataset uji (belum diukur).

## 8. Arsitektur

- Presentation: React + TypeScript + Vite + Tailwind CSS v4
- Application: Node.js + Express + TypeScript + Zod
- Data: PostgreSQL + Prisma
- Auth: JWT di cookie HttpOnly dengan SameSite Strict; CORS origin spesifik (tetap audit keamanan sebelum produksi)

## 9. Pengujian yang direncanakan

- Kesalahan validasi nominal, kategori tidak cocok, transaksi beda usaha.
- Hasil saldo dan surplus: kas masuk, kas keluar, modal, prive, transfer, saldo awal.
- Edit/hapus transaksi dan audit log.
- UI mobile/desktop, login/logout, perilaku tanpa sesi.
- Integrasi database nyata dan backup/restore.

## 10. Definition of Done MVP

Semua fitur wajib berjalan pada PostgreSQL; isolasi tenant diuji; perhitungan divalidasi terhadap contoh manual; UI responsif; web dapat dideploy dengan HTTPS; dokumentasi change log lengkap.

## 11. Tahapan

1. Validasi masalah & requirement
2. Use case, activity, ERD, UI prototype
3. Backend/API
4. Frontend
5. Integrasi, pengujian keamanan & keuangan
6. Deployment setelah persetujuan
