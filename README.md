# UsahaCerdas — Full-Stack UMKM Financial Management

Starter project **v0.1.0** untuk aplikasi web pencatatan keuangan UMKM. Dibangun dengan **React + TypeScript + Vite + Tailwind CSS**, **Express + Prisma**, dan **PostgreSQL**.

> **Status:** fondasi MVP, **bukan aplikasi akuntansi produksi**. Sudah disiapkan autentikasi, profil usaha, akun kas, kategori, CRUD transaksi, dashboard, dan laporan kas sederhana. Belum ada integrasi bank, stok/HPP, pajak, utang-piutang, maupun laporan laba-rugi akrual penuh. Periksa dan uji sebelum memakai data keuangan sungguhan.

## Prasyarat

- Node.js 20+ dan npm
- VS Code
- Docker Desktop (untuk PostgreSQL), atau PostgreSQL lokal yang sudah berjalan
- Git (opsional, disarankan)

## Memulai di VS Code

1. Ekstrak ZIP, lalu buka folder **UsahaCerdas** menggunakan **File > Open Folder** pada VS Code.
2. Buka terminal VS Code (**Terminal > New Terminal**).
3. Jalankan `npm install` dari folder utama.
4. Siapkan database PostgreSQL. Pilih salah satu:
   - **Supabase (setup saat ini):** ambil connection string **session pooler** (port 5432) untuk `DATABASE_URL` dan `DIRECT_URL` (lihat `.env.example`) dari dashboard Supabase > **Connect** > **ORMs** > **Prisma**. Host direct `db.<ref>.supabase.co` hanya IPv6, jadi gunakan host pooler bila jaringan tidak mendukung IPv6.
   - **Docker Desktop:** jalankan `npm run db:up` dan tunggu database siap (`docker compose ps`).
   - **PostgreSQL lokal:** siapkan sendiri dan sesuaikan URL.
   Untuk Docker/PostgreSQL lokal, isi `DIRECT_URL` sama dengan `DATABASE_URL`.
5. Salin `.env.example` ke `backend/.env`. Di PowerShell: `Copy-Item .env.example backend/.env`.
6. Edit `JWT_SECRET` dalam `backend/.env` menjadi nilai acak panjang (minimal 32 karakter) **sebelum** menjalankan backend.
7. Jalankan `npm run db:generate` lalu `npm run db:migrate`. Saat Prisma meminta nama migrasi, gunakan `init`.
8. Jalankan `npm run dev`.
9. Buka **http://localhost:5173**. Registrasi akan membuat akun pemilik, usaha awal, akun kas, dan kategori bawaan.

Backend: **http://localhost:4000/api/health**. Prisma Studio: `npm run db:studio`.

Jika port 5432 sudah dipakai PostgreSQL lain, ubah port host pada `docker-compose.yml` dan sesuaikan `.env`.

### Di Windows tanpa Docker

Install PostgreSQL, buat database `usahacerdas`, lalu atur koneksi di `backend/.env`. Perintah lainnya sama.

## Machine learning

Eksperimen ML (kategorisasi transaksi otomatis dan prediksi arus kas) ada di folder `ml/`, terpisah dari aplikasi web. Panduan, dataset, dan hasil baseline: [`ml/README.md`](ml/README.md); notebook: `ml/notebooks/01_baseline.ipynb`.

## Realtime antar perangkat

Perubahan transaksi, rekening, kategori, dan profil usaha langsung tampil di tab atau perangkat lain yang login ke usaha yang sama, tanpa refresh. Mekanismenya Server-Sent Events dari backend (`/api/events`); indikator "Tersinkron" ada di kanan atas. Detail di ADR-006 dan `docs/API.md`.

## Pengujian otomatis

`npm test` menjalankan tes integrasi API (`backend/test/api.test.ts`, memakai `node:test`) terhadap database di `backend/.env`. Tes menyalakan server sendiri di port acak, membuat dua akun uji `uji-*@usahacerdas.test`, lalu menghapusnya lagi setelah selesai. Tes mencakup T01 sampai T17 di `docs/TEST_SCENARIOS.md` ditambah aturan kelola rekening. Jangan arahkan ke database produksi.

## Catatan perubahan dan asisten coding

- **`AGENTS.md`** adalah instruksi proyek untuk AI coding assistant seperti Codex: baca konteks, batasi perubahan, uji, dan **catat setiap revisi ke `docs/CHANGELOG.md`**.
- **`.github/copilot-instructions.md`** menyediakan arahan singkat untuk GitHub Copilot.
- `npm run assistant`: asisten CLI interaktif untuk merekam permintaan perubahan dan implementasi.
- `npm run change:request -- "Tambahkan filter transaksi"`: mencatat permintaan baru.
- `npm run change:log -- "Memperbaiki validasi nominal"`: mencatat perubahan selesai.
- `npm run hooks:install`: opsional, setelah `git init`; memasang **pre-commit hook** yang menolak commit kode tanpa pembaruan `docs/CHANGELOG.md`.
- `docs/CHANGE_REQUESTS.md`: daftar permintaan revisi; `docs/CHANGELOG.md`: riwayat implementasi; `docs/DECISIONS.md`: keputusan teknis.

**Penting:** AI assistant aktif hanya ketika kamu membuka proyek dengan tool yang membaca `AGENTS.md` dan memberinya tugas. Ia **bukan agent background** yang otomatis memantau file. CLI mencatat perubahan saat kamu menjalankannya. Hook Git opsional memaksa log sebelum commit.

## Struktur

```text
UsahaCerdas/
├── frontend/             # UI React
├── backend/              # REST API, Prisma schema
├── docs/                 # Blueprint, framework, revisi, keputusan
├── scripts/              # Asisten log dan pre-commit hook
├── .github/              # Instruksi Copilot
├── .vscode/              # Pengaturan editor
├── AGENTS.md             # Instruksi asisten coding
├── docker-compose.yml    # PostgreSQL development
└── package.json          # Workspace & scripts
```

## Aturan domain penting

- `INCOME` dan `EXPENSE` adalah transaksi **operasional** yang dihitung dalam surplus operasional berbasis kas.
- `CAPITAL` (setoran modal) dan `DRAW` (prive) memengaruhi kas, **bukan** surplus operasional.
- `TRANSFER` memindahkan kas antar-akun, **bukan** pendapatan atau biaya usaha.
- `openingBalance` adalah saldo awal kas; **bukan** pendapatan.
- Perhitungan disimpan menggunakan `Decimal(18,2)` di database. Antarmuka dan laporan memakai Rupiah.
- Jumlah dan saldo kas dapat negatif (indikasi data atau kondisi yang perlu diperiksa), jangan diam-diam dikoreksi.
- Query harus selalu dibatasi `businessId` dari identitas pengguna, **bukan** percaya pada ID yang dikirim klien.

## Checklist produksi (belum otomatis terpenuhi)

Security audit, CSRF review untuk domain deployment, rate limiting/anti-brute-force, backup database, monitoring, migrasi terkontrol, uji beban, kebijakan retensi data, konfirmasi alur akuntansi dengan praktisi, dan pengujian menyeluruh. **Jangan gunakan password development di produksi.**

## Dokumen

Baca `docs/PROJECT_BLUEPRINT.md`, `docs/CONCEPTUAL_FRAMEWORK.md`, `docs/API.md`, `docs/TEST_SCENARIOS.md`, dan `docs/CHANGELOG.md` sebelum menambah fitur.
