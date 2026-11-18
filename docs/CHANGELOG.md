# CHANGELOG — Riwayat Perubahan UsahaCerdas

Pembaruan wajib setiap perubahan kode; ikuti `AGENTS.md`.

## 2026-11-17

### Fondasi project full-stack (v0.1.0)
- **Tipe:** Initial setup.
- **Alasan:** Menyediakan fondasi implementasi setelah penyusunan blueprint.
- **File:** `frontend/`, `backend/`, `docs/`, `scripts/`, konfigurasi root, `AGENTS.md`.
- **Isi:** React/Express/PostgreSQL/Prisma, autentikasi, transaksi, dashboard, laporan, kerangka konseptual, instruksi asisten dan CLI change log.
- **Pengujian:** Pemeriksaan sintaks TypeScript menggunakan TypeScript compiler API, parsing JSON, pengecekan sintaks JavaScript Node, dan uji CLI pencatatan pada direktori sementara — **PASS**. `npm install`, full typecheck/build dengan dependensi, koneksi database, dan uji end-to-end **belum dijalankan** karena akses registry paket tidak tersedia.
- **Catatan:** Jalankan setup database/migrasi dan validasi manual sebelum menggunakan data nyata.

## 2026-11-18

### Instalasi dependensi dan typecheck pertama
- **Tipe:** Setup / verifikasi.
- **Alasan:** Entri 2026-11-17 mencatat `npm install` dan typecheck penuh belum pernah dijalankan.
- **File:** `package-lock.json` (baru, dihasilkan `npm install`), `frontend/tsconfig.tsbuildinfo` (baru, artefak `tsc -b`). Tidak ada kode sumber yang diubah.
- **Pengujian:** Node v24.14.1, npm 11.12.1. `npm install` berhasil (300 paket). `npm run db:generate` berhasil (Prisma Client 6.19.3). `npm run typecheck` (backend + frontend) **PASS**, exit code 0, tanpa error.
- **Belum dijalankan:** `db:up`, `db:migrate`, dan uji end-to-end T01–T18, karena Docker tidak terpasang di mesin ini dan belum ada PostgreSQL. `backend/.env` belum dibuat.
- **Catatan/risiko:** `npm audit` melaporkan 8 kerentanan high, termasuk `zod <4.6.6` dan `deepmerge-ts <8.0.0` (dependensi Prisma); perbaikannya memerlukan upgrade major (`--force`), belum dilakukan. `recharts@2.x` sudah deprecated (disarankan v3). `frontend/tsconfig.tsbuildinfo` sebaiknya dimasukkan ke `.gitignore`.

### Konfigurasi server MCP Supabase untuk asisten coding
- **Tipe:** Tooling / konfigurasi.
- **Alasan:** Memakai Supabase (PostgreSQL hosted) sebagai database development karena Docker tidak tersedia; MCP memungkinkan asisten coding membaca dokumentasi dan skema Supabase.
- **File:** `.mcp.json` (baru; server `supabase`, transport HTTP, `project_ref=tqelodxptbhrboracbqv`). Tidak berisi token atau password; autentikasi lewat OAuth.
- **Pengujian:** Validasi JSON `.mcp.json` — **PASS**. Koneksi dan autentikasi MCP **belum diuji** (perlu login OAuth oleh pengguna).
- **Catatan/risiko:** Fitur `database`, `development`, `functions`, `branching` memberi akses tulis ke project Supabase. Skema tetap dikelola lewat `prisma migrate`, jangan lewat `apply_migration` MCP agar riwayat migrasi tidak bercabang. Pertimbangkan `read_only=true` pada URL. Langkah `npx skills add supabase/agent-skills` (opsional) belum dijalankan. `schema.prisma` belum disesuaikan (`directUrl`).

### Database Supabase, migrasi init, dan perbaikan dua bug API
- **Tipe:** Setup + Fix.
- **Alasan:** Docker tidak tersedia, jadi development memakai PostgreSQL Supabase (region ap-southeast-1). Uji API pertama menemukan dua bug.
- **File:**
  - `backend/prisma/schema.prisma`: tambah `directUrl = env("DIRECT_URL")` untuk `prisma migrate`.
  - `backend/prisma/migrations/20261118072540_init/migration.sql`, `backend/prisma/migrations/migration_lock.toml` (baru).
  - `backend/src/server.ts`: (1) middleware tidak lagi menolak `DELETE` tanpa body dengan 415; (2) validasi nominal tidak lagi crash (500) untuk input kosong/non-angka.
  - `.env.example`, `README.md`: panduan Supabase (`DATABASE_URL` + `DIRECT_URL`) dan opsi Docker/PostgreSQL lokal.
  - `backend/.env` (lokal, di-`.gitignore`, tidak di-commit).
- **Detail bug:**
  - Semua `DELETE` (hapus transaksi/kategori) ditolak 415 karena middleware mewajibkan `Content-Type: application/json`, padahal frontend mengirim DELETE tanpa body. Fitur hapus di UI sebelumnya tidak berfungsi.
  - Zod v3 tetap menjalankan `.refine` setelah regex gagal, sehingga `new Prisma.Decimal("abc")` melempar error dan API membalas 500, bukan 400.
- **Catatan setup:** Host direct `db.<ref>.supabase.co` hanya IPv6 dan jaringan development tidak mendukung IPv6, jadi koneksi memakai Supavisor pooler (`aws-1-ap-southeast-1`; port 6543 untuk aplikasi, 5432 untuk migrasi) dengan `connect_timeout=30`. `prisma migrate dev` gagal (P1001) karena pooler tidak bisa membuka shadow database; migrasi init dibuat dengan `prisma migrate diff --from-empty` lalu diterapkan dengan `prisma migrate deploy`. Untuk perubahan schema berikutnya gunakan alur yang sama atau set `shadowDatabaseUrl`.
- **Pengujian:**
  - Schema `public` dicek kosong sebelum migrasi; `prisma migrate deploy` — **PASS** (6 tabel, 2 enum).
  - Skrip uji API (Node fetch ke backend lokal + Supabase) mencakup T01–T17 kecuali T18: sebelum perbaikan 21/26 PASS (gagal: T06 input kosong/"abc", T10, T05 hapus, T14 hapus); sesudah perbaikan **26/26 PASS**. T11–T13 sesuai perhitungan manual (saldo 2,2 jt, surplus 300 rb, transfer tidak mengubah total).
  - `npm run typecheck` — **PASS**.
  - Belum diuji: UI di browser (T18 desktop/mobile), isi audit log T14, alur frontend end-to-end.
- **Catatan/risiko:**
  - Koneksi ke pooler dari jaringan development sering putus sementara (P1001 acak); `connect_timeout=30` mengurangi tetapi belum menghilangkan.
  - Database development sekarang berisi akun uji `uji-a-*@usahacerdas.test` / `uji-b-*@usahacerdas.test` dari tiga kali uji (boleh dihapus).
  - Password database dan secret key Supabase sempat dibagikan lewat chat; disarankan rotasi `SUPABASE_SECRET_KEY` dan password database lalu perbarui `backend/.env`.

### Uji di browser: perbaikan lanjutan DELETE via proxy Vite dan pool koneksi Supabase
- **Tipe:** Fix + konfigurasi.
- **Alasan:** Uji UI di browser menemukan dua masalah yang tidak muncul saat uji API langsung ke port 4000.
- **File:**
  - `backend/src/server.ts`: `DELETE` tidak lagi wajib `Content-Type: application/json`. Perbaikan sebelumnya (hanya meloloskan DELETE tanpa body) tidak cukup, karena proxy Vite meneruskan DELETE dengan `Transfer-Encoding: chunked` sehingga Express menganggapnya ber-body dan tetap membalas 415. Cek Origin tetap berlaku.
  - `backend/.env` (lokal), `.env.example`, `README.md`: `DATABASE_URL` pindah dari transaction pooler (6543, `connection_limit=1`) ke session pooler (5432, `connection_limit=5&pool_timeout=20&connect_timeout=30`). Dengan satu koneksi, register gagal 500 ("Timed out fetching a new connection from the connection pool"); backend Express berjalan terus sehingga session pooler lebih sesuai.
  - `.claude/launch.json` (baru): konfigurasi `backend` (port 4000) dan `frontend` (port 5173) terpisah untuk preview di Claude desktop. Satu konfigurasi `npm run dev` gagal karena tool preview mengisi `PORT=5173`, sehingga backend merebut port Vite.
- **Pengujian (browser, panel Claude desktop):**
  - Landing page, register akun uji via UI, redirect ke dashboard — **PASS**.
  - Tambah transaksi pemasukan Rp150.000 via form — **PASS**.
  - Hapus transaksi via tombol Hapus: sebelum perbaikan 415, sesudah perbaikan 204 dan daftar kosong setelah reload — **PASS**.
  - curl lewat proxy: DELETE Origin sendiri → 401 (lolos ke auth), Origin asing → 403, POST form-urlencoded → 415 — **PASS**.
  - Tampilan mobile 375px tanpa scroll horizontal, menu hamburger terbuka — **PASS** (T18 sebagian). Halaman Laporan tampil benar.
  - `npm run typecheck` — **PASS**. Log error backend bersih.
- **Catatan/risiko:**
  - `/auth/me` pertama butuh ~5 detik (pembukaan koneksi baru ke Supabase dari jaringan yang tidak stabil); request berikutnya 300–500 ms. Setelah hapus, reload data sempat tertahan oleh satu request lambat sehingga daftar baru diperbarui setelah halaman dimuat ulang.
  - Belum diuji di UI: edit transaksi, kategori, pengaturan rekening, transfer, logout via UI.
  - Akun uji UI `uji-ui-20261118@usahacerdas.test` (usaha "Warung Uji UI") ada di database development.

### Redesign seluruh frontend dengan shadcn/ui + Tailwind
- **Tipe:** Feature (UI) + refactor.
- **Alasan:** Desain lama dinilai terlalu generik ("terasa AI"). Pengguna memilih gaya shadcn/ui untuk semua halaman.
- **File:**
  - Baru: `frontend/components.json`, `frontend/src/lib/{auth.tsx,utils.ts}`, `frontend/src/components/{app-shell,confirm-dialog,date-range,empty-state,logo,page-header,tx-form-sheet,tx-table,tx-type-badge}.tsx`, `frontend/src/components/ui/*` (button, card, input, label, select, table, badge, alert-dialog, sheet, dropdown-menu, separator, sonner, alert, avatar, skeleton), `frontend/src/pages/{landing,auth,dashboard,transactions,categories,reports,settings}.tsx`.
  - Dipindah: `frontend/src/api.ts` → `frontend/src/lib/api.ts` (tambah `compactMoney`, `isOutflow`).
  - Ditulis ulang: `frontend/src/App.tsx` (hanya routing), `frontend/src/main.tsx` (Toaster), `frontend/src/styles.css` (token tema saja; 145 baris CSS custom dihapus).
  - Konfigurasi: `frontend/tsconfig.json`, `frontend/vite.config.ts` (alias `@/`), `frontend/package.json` (dependensi shadcn: radix-ui, cn, class-variance-authority, sonner, next-themes, tw-animate-css, @fontsource-variable/geist).
  - Dokumen: `docs/DECISIONS.md` (ADR-004).
- **Perubahan perilaku UI (logika data dan aturan keuangan tidak berubah):**
  - Form transaksi pindah ke panel samping (Sheet) dengan penjelasan tiap jenis transaksi.
  - `window.confirm` diganti dialog konfirmasi; pesan sukses/gagal hapus memakai toast.
  - Aksi edit/hapus di tabel lewat menu `⋯`; di mobile kolom tanggal/jenis disembunyikan dan dipindah ke bawah keterangan supaya nominal tetap terlihat.
  - Logout lewat menu pengguna di bawah sidebar; navigasi mobile memakai Sheet.
- **Pengujian:**
  - `npm run typecheck` — **PASS**. `vite build` — **PASS** (peringatan ukuran chunk 937 kB).
  - Browser (panel Claude desktop, 1280×800 dan 375×812) — **PASS**: landing, login, dashboard (saldo Rp2.305.000 dan surplus Rp455.000 sesuai data uji), tambah transaksi via Sheet, tabel transaksi, laporan, kategori, dialog hapus kategori terpakai → toast 409, navigasi Sheet mobile, logout → halaman login. Tidak ada scroll horizontal di mobile.
  - Ditemukan dan diperbaiki saat uji: tabel transaksi di mobile mendorong kolom nominal keluar layar.
  - Belum diuji di browser: edit transaksi via Sheet, transfer, halaman Pengaturan (tambah rekening, ubah profil), hapus transaksi via dialog.
- **Catatan/risiko:**
  - Klik pertama setelah menutup dropdown Select di dalam Sheet bisa "termakan" (perilaku Radix); tombol tetap berfungsi pada klik berikutnya.
  - Latensi Supabase masih sesekali 5–15 detik per request (masalah jaringan, bukan UI); skeleton loading kini muncul selama menunggu.
  - Transaksi uji di akun `uji-ui-20261118@usahacerdas.test`: 1 pemasukan, 2 pengeluaran, 1 modal, 1 prive.

### Uji browser lanjutan UI shadcn: pengaturan, transfer, edit, hapus transaksi
- **Tipe:** Test + fix kecil.
- **Alasan:** Menuntaskan bagian UI yang belum diuji setelah redesign.
- **File:** `frontend/src/components/tx-table.tsx`: transaksi tanpa keterangan dan tanpa kategori (mis. transfer) kini menampilkan nama jenisnya ("Transfer Kas"), bukan "—".
- **Pengujian (browser, 1280×800, akun uji UI) — semua PASS:**
  - Pengaturan: ubah bidang usaha → `Kuliner` tersimpan (dicek via `GET /api/business`); tambah rekening "Bank Uji" saldo awal Rp500.000 → tampil di daftar + toast.
  - Transfer Rp300.000 Kas Utama → Bank Uji via Sheet: Kas Utama 2.005.000, Bank Uji 800.000, total kas naik hanya sebesar saldo awal rekening baru, surplus tetap 455.000.
  - Edit transaksi via menu `⋯` → Sheet terisi data lama; nominal ongkir 75.000 → 95.000 tersimpan.
  - Hapus transaksi prive Rp150.000 via dialog konfirmasi → hilang dari tabel.
  - Angka akhir cocok dengan hitungan manual: Kas Utama 2.135.000, Bank Uji 800.000, total 2.935.000, pengeluaran 415.000, surplus 435.000.
  - Log backend tanpa error; console browser hanya berisi 409/401 yang memang diharapkan.
  - `npm run typecheck` — PASS.
- **Catatan:** Audit log edit/hapus belum diverifikasi isinya (tidak ada endpoint/UI untuk membacanya). Data uji tambahan (rekening Bank Uji, transfer) ada di akun `uji-ui-20261118@usahacerdas.test`.

### Inisialisasi repository git dan commit pertama
- **Tipe:** Setup.
- **Alasan:** Folder project belum punya riwayat versi, sehingga perubahan (termasuk redesign) tidak bisa ditelusuri atau dikembalikan.
- **File:** `docs/CHANGELOG.md`, `.git/hooks/pre-commit` (lokal, tidak ikut repo; dipasang lewat `npm run hooks:install`). Seluruh file project masuk commit pertama di branch `main`.
- **Pengujian:** Pemindaian file yang di-stage untuk kredensial (URL database berpassword, kunci Supabase, JWT) — **PASS**, tidak ada; `git check-ignore` memastikan `backend/.env` dan `*.tsbuildinfo` diabaikan — **PASS**. Hook changelog dijalankan saat commit.
- **Catatan:** Belum ada remote; repo baru tersedia lokal. `.mcp.json` ikut ter-commit dan berisi project ref Supabase (bukan rahasia, tapi mengungkap ID project bila repo dibuat publik).

### Tes API otomatis (`npm test`) dan fitur kelola rekening
- **Tipe:** Fitur + test + refactor kecil.
- **Alasan:** (1) Skrip uji API hanya ada di folder sementara dan bisa hilang; perubahan berikutnya butuh tes yang bisa diulang. (2) Rekening hanya bisa ditambah; salah nama atau rekening yang tak dipakai lagi tidak bisa ditangani.
- **Isi:**
  - `backend/src/server.ts` dipecah: `app.ts` membangun app Express dan mengekspor `app` + `prisma`, `server.ts` hanya `listen`. Perilaku runtime tidak berubah.
  - Tes integrasi `backend/test/api.test.ts` (node:test + tsx, tanpa dependensi baru): 38 kasus, mencakup T01 sampai T17, Origin 403, Content-Type 415, dan aturan rekening. Server dinyalakan di port acak; akun uji yang dibuat dihapus di akhir.
  - Skema: kolom `Account.archivedAt` (nullable) lewat migrasi `20261118120000_account_archive` (hanya `ADD COLUMN`, tidak destruktif), sudah diterapkan ke Supabase dengan `prisma migrate deploy`.
  - API: `PATCH /api/accounts/:id` (ubah nama, saldo awal, arsip/aktifkan), `GET /accounts` menambah `archivedAt` dan `hasTransactions`, transaksi baru menolak rekening arsip, ringkasan menambah `archived` di `accountBalances`, audit log untuk perubahan rekening. Aturan di ADR-005.
  - UI Pengaturan: menu per rekening (Ubah, Arsipkan), dialog ubah (saldo awal terkunci beserta penjelasannya bila sudah ada transaksi), konfirmasi arsip, bagian "Diarsipkan" dengan tombol Aktifkan. Form transaksi menyembunyikan rekening arsip (kecuali saat mengedit transaksi yang memakainya). Dashboard menyembunyikan rekening arsip bersaldo nol. Komponen shadcn `dialog` ditambahkan; `ConfirmDialog` mendapat opsi `destructive` dan `busyLabel`.
- **File:** `backend/src/app.ts` (baru, dari `server.ts`), `backend/src/server.ts`, `backend/test/api.test.ts` (baru), `backend/tsconfig.test.json` (baru), `backend/package.json`, `package.json`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261118120000_account_archive/migration.sql` (baru), `frontend/src/lib/api.ts`, `frontend/src/pages/settings.tsx`, `frontend/src/pages/dashboard.tsx`, `frontend/src/pages/transactions.tsx`, `frontend/src/components/tx-form-sheet.tsx`, `frontend/src/components/confirm-dialog.tsx`, `frontend/src/components/ui/dialog.tsx` (baru), `docs/API.md`, `docs/DECISIONS.md`, `docs/TEST_SCENARIOS.md`, `README.md`.
- **Pengujian:**
  - `npm test` dijalankan dua kali terhadap Supabase: **38/38 PASS** kedua kalinya; pengecekan langsung ke database memastikan akun uji dari run ini sudah terhapus.
  - `npm run typecheck` (backend termasuk folder test, dan frontend): **PASS**. `npm run build -w frontend`: **PASS** (peringatan ukuran bundle ±944 kB, belum ditangani).
  - Browser (akun uji UI): arsip Bank Uji bersaldo Rp800.000 ditolak dengan toast yang menjelaskan; ubah nama Bank Uji ke "Bank BCA" berhasil dan terlihat di riwayat transfer; saldo awal terkunci untuk rekening bertransaksi dan bisa diedit untuk rekening kosong; tambah, arsip, dan aktifkan lagi "Dompet Coba" berhasil; form transaksi hanya menampilkan rekening aktif; dashboard tetap Rp2.935.000 / surplus Rp435.000; tampilan mobile 375 px tanpa scroll horizontal; tidak ada error server. Hasil: **PASS**.
  - Ditemukan dan diperbaiki saat uji: nama rekening hilang dari dialog arsip selama animasi menutup (status buka dipisah dari target).
- **Catatan:**
  - `npm test` menulis ke database yang dikonfigurasi; jangan dijalankan terhadap produksi.
  - Akun uji lama dari sesi sebelumnya (`uji-a-*`, `uji-b-*` bertimestamp 1794986*, dan `uji-ui-20261118@usahacerdas.test`) masih ada di Supabase; belum dihapus karena perlu persetujuan.
  - Dashboard memakai `Number(balance) !== 0` hanya untuk menentukan tampil/tidak, bukan untuk perhitungan.

### Pembersihan akun uji di database Supabase
- **Tipe:** Data (tanpa perubahan kode).
- **Alasan:** Tujuh akun uji dari sesi pengujian sebelumnya (`uji-a-*`, `uji-b-*` bertimestamp 1794986*, dan `uji-ui-20261118@usahacerdas.test`) masih tersimpan. Dihapus atas persetujuan eksplisit pemilik project.
- **File:** `docs/CHANGELOG.md`. Skrip sekali pakai dijalankan lalu dihapus, tidak masuk repo.
- **Isi:** Daftar akun diperiksa dulu (semua berdomain `@usahacerdas.test`; tidak ada akun lain di database). Dalam satu transaksi database: 7 business dihapus (cascade ke rekening, kategori, transaksi, audit log), lalu 7 user.
- **Pengujian:** Hitung ulang setelah penghapusan: akun uji 0, total user 0. **PASS**.
- **Catatan:** Database kini kosong. Akun untuk uji UI perlu didaftarkan ulang lewat halaman register; sesi browser lama untuk `uji-ui` sudah tidak valid.

## 2026-11-19

### Pemeriksaan `npm audit` (16 temuan) dan aturan batas array zod
- **Tipe:** Keamanan (analisis) + dokumentasi.
- **Alasan:** `npm ci` melaporkan 16 kerentanan (2 moderate, 14 high) yang belum pernah diperiksa.
- **Hasil analisis:**
  - `picomatch` (ReDoS, GHSA-fc5q-39xc-vjpf) serta turunannya `fdir`, `tinyglobby`, `micromatch`, `fast-glob`, `vite`, `@dotenvx/dotenvx`, `@shadcn/registry`, `shadcn`: semua versi terdampak, termasuk 4.0.7 terbaru, jadi belum ada versi tambalan. Hanya dipakai alat build/CLI dengan pola glob dari developer; tidak masuk bundle browser maupun runtime backend.
  - `minimatch`, `ts-morph`, `@ts-morph/common`: dependensi CLI `shadcn` saja (dev).
  - `prisma`, `@prisma/config`, `deepmerge-ts` (GHSA-ggr8-5vv4-36mx): hanya CLI Prisma saat membaca konfigurasi; `@prisma/client` runtime tidak terdampak. Tambalan butuh Prisma 7 (versi mayor, migrasi besar).
  - `zod` (GHSA-mrhx-c7xc-m3w5): satu-satunya yang berjalan di runtime backend. Celahnya hanya pada skema array tanpa batas panjang; backend tidak memakai `z.array`/`z.set`/`z.record` sama sekali dan body JSON dibatasi 100 kB, jadi tidak bisa dieksploitasi saat ini. Tambalan butuh zod 4 (versi mayor).
  - Saran `npm audit fix --force` (mis. `shadcn@2.10.0`) justru menurunkan versi mayor dan tidak dipakai.
- **Perubahan:** `npm audit fix` (tanpa `--force`) dijalankan dan tidak mengubah `package-lock.json`. Aturan baru di `AGENTS.md`: setiap skema koleksi zod untuk input request wajib memakai `.max(n)`.
- **File:** `AGENTS.md`, `docs/CHANGELOG.md`.
- **Pengujian:** `npm audit` sebelum/sesudah (tetap 16 temuan, sesuai analisis); grep `backend/src` untuk skema koleksi zod (tidak ada). Setelah `npm ci`: `npm run typecheck` **PASS**, `npm test` **38/38 PASS**.
- **Catatan:** Tindak lanjut opsional: migrasi ke zod 4 dan Prisma 7 sebagai pekerjaan terpisah; pantau rilis tambalan `picomatch`.
