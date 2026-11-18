# Instruksi wajib untuk AI Coding Assistant — UsahaCerdas

Berlaku untuk Codex / asisten coding lain yang membaca AGENTS.md. Bahasa komunikasi: Indonesia, ringkas dan jelas.

## Sebelum mengubah kode

1. Baca `README.md`, `docs/PROJECT_BLUEPRINT.md`, `docs/CONCEPTUAL_FRAMEWORK.md`, `docs/DECISIONS.md`.
2. Pahami permintaan dan identifikasi apakah itu **bug**, **fitur**, **refactor**, **keamanan**, atau **dokumentasi**.
3. Baca file terkait (jangan menebak perilaku sistem). Pertahankan fitur existing.
4. Untuk permintaan besar/ambigu, tuliskan batasan dan asumsi di laporan; jangan diam-diam menambah scope.

## Saat mengubah kode

- Gunakan arsitektur React/Express/Prisma yang ada. Jangan ganti stack tanpa persetujuan pengguna.
- Pastikan setiap operasi database memakai `businessId` yang diperoleh dari sesi, bukan input bebas.
- Jangan menganggap modal, prive, transfer, atau saldo awal sebagai pendapatan/biaya operasional.
- Jangan menyimpan password/token di log. Jangan menaruh rahasia pada frontend.
- Jangan menggunakan floating-point untuk menghitung uang di backend; gunakan Prisma.Decimal.
- Setiap `z.array()`/`z.set()`/`z.record()` untuk input request wajib diberi batas (`.max(n)`). Zod 3 rentan kehabisan memori pada array tanpa batas (GHSA-mrhx-c7xc-m3w5).
- Jangan menghapus data pengguna atau menjalankan migrasi destruktif tanpa persetujuan eksplisit.
- Jangan deploy, menggunakan layanan AI berbayar, atau memodifikasi produksi tanpa izin.

## WAJIB: catat SETIAP perubahan

Setiap tugas yang menyebabkan perubahan **harus** diperbarui pada `docs/CHANGELOG.md` pada tugas yang sama, tidak ditunda:

- Tanggal ISO dan ringkasan yang spesifik.
- Jenis perubahan; alasan dan masalah yang diselesaikan.
- Daftar file yang diubah.
- Pengujian yang dilakukan dan hasilnya, atau alasan tidak bisa diuji.
- Risiko/catatan lanjutan.
- Bila pekerjaan berasal dari `docs/CHANGE_REQUESTS.md`, tandai permintaan sebagai selesai atau berstatus terbuka dengan keterangan.
- Bila keputusan arsitektur/aturan keuangan berubah, perbarui `docs/DECISIONS.md` dan diagram/referensi terkait.

Contoh entri:

```md
### 2026-11-17 — Validasi nominal transaksi
- Tipe: Fix
- Alasan: Menolak nominal negatif pada input transaksi.
- File: `backend/src/routes/transactions.ts`
- Pengujian: Validasi manual nominal 0, -10, 1000 — PASS/FAIL yang benar.
- Catatan: Belum diuji dengan PostgreSQL produksi.
```

**Jangan pernah menulis bahwa pengujian PASS jika belum benar-benar dijalankan.**

## Setelah mengubah kode

1. Jalankan `npm run typecheck` dan tes yang relevan jika dependensi tersedia.
2. Jelaskan perubahan, file terdampak, serta hasil validasi.
3. Ingatkan jika langkah database/migrasi/manual diperlukan.
4. Pastikan `docs/CHANGELOG.md` sudah diperbarui sebelum pekerjaan dinyatakan selesai.
