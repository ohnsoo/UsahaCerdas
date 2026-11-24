# Architectural & Business Decisions

## ADR-001 — Full-stack monorepo (2026-11-17)
- **Status:** Accepted for MVP.
- **Keputusan:** React/Vite/TS, Express/TS, Prisma/PostgreSQL, npm workspaces.
- **Alasan:** Pemisahan frontend, backend, data dengan teknologi populer untuk portfolio.

## ADR-002 — Keuangan berbasis kas (2026-11-17)
- **Status:** Accepted for MVP.
- **Keputusan:** INCOME/EXPENSE untuk operasional, CAPITAL/DRAW untuk pemilik, TRANSFER antar akun, openingBalance terpisah; dashboard melaporkan surplus operasional berbasis kas, tidak mengklaim laba akrual.
- **Konsekuensi:** Modul persediaan dan HPP harus ditambahkan jika ingin menghitung laba dagang lebih lengkap.

## ADR-003 — Pelacakan revisi (2026-11-17)
- **Status:** Accepted.
- **Keputusan:** AGENTS.md wajibkan changelog setiap edit, CLI untuk mencatat permintaan/revisi, hook Git opsional memverifikasi changelog saat commit.
- **Batasan:** Bukan pemantauan background otomatis.

## ADR-004 — UI memakai shadcn/ui di atas Tailwind CSS v4 (2026-11-18)
- **Status:** Accepted.
- **Keputusan:** Seluruh tampilan frontend memakai komponen shadcn/ui (preset `radix-nova`, base color neutral, ikon Lucide, font Geist) dengan utility class Tailwind. CSS custom lama di `styles.css` dihapus; `styles.css` hanya berisi token tema dan token warna domain (`--income`, `--expense`, `--capital`, `--draw`).
- **Alasan:** Tampilan lama terasa generik. shadcn/ui memberi gaya dashboard SaaS yang konsisten dan aksesibel (Radix), dan komponennya disalin ke `frontend/src/components/ui` sehingga bebas diubah tanpa terkunci ke library.
- **Struktur:** `src/lib` (API, auth), `src/components` (shell, tabel, dialog), `src/components/ui` (komponen shadcn hasil generator), `src/pages` (satu file per halaman). Alias import `@/` → `src/`.
- **Konsekuensi:** Komponen di `components/ui` sebaiknya diubah lewat `npx shadcn@latest add <komponen> --overwrite` atau diedit dengan sadar. Ukuran bundle naik (±937 kB, gzip ±277 kB); pertimbangkan code-splitting per halaman.

## ADR-005: Rekening diarsipkan, bukan dihapus (2026-11-18)
- **Status:** Accepted.
- **Keputusan:** Rekening tidak bisa dihapus permanen. Pemilik bisa mengubah nama, dan mengarsipkan rekening (`Account.archivedAt`). Rekening arsip disembunyikan dari form transaksi baru, tetapi riwayat dan saldonya tetap masuk laporan.
- **Aturan:** (1) saldo awal terkunci setelah rekening punya transaksi; koreksi dicatat sebagai setoran modal/prive agar laporan periode lalu tidak bergeser diam-diam; (2) arsip hanya bila saldo sepanjang waktu nol, sehingga total kas tidak "hilang" dari tampilan; (3) minimal satu rekening aktif.
- **Konsekuensi:** Mengedit transaksi lama pada rekening arsip masih diizinkan dan bisa membuat saldonya tidak nol; dashboard tetap menampilkan rekening arsip yang bersaldo agar total kas bisa ditelusuri.

## ADR-006: Realtime tampilan memakai Server-Sent Events dari backend (2026-11-19)
- **Status:** Accepted.
- **Keputusan:** Sinkronisasi antar perangkat/tab memakai SSE di Express (`GET /api/events`, `backend/src/live.ts`). Backend hanya mengirim topik yang berubah; frontend (`frontend/src/lib/live.tsx`) memuat ulang data lewat API biasa.
- **Alasan:** Supabase Realtime tidak dipakai karena autentikasi memakai JWT sendiri, bukan Supabase Auth, sehingga RLS tidak bisa membatasi data per pemilik; membuka tabel lewat anon key berisiko membocorkan data usaha lain. SSE cukup untuk arah server ke klien, tanpa dependensi baru, dan lewat cookie sesi yang sama.
- **Batasan:** Daftar koneksi disimpan di memori proses, jadi hanya berlaku untuk satu instance backend. Bila backend di-scale ke beberapa instance, perlu pub/sub bersama (mis. Postgres LISTEN/NOTIFY atau Redis). Reverse proxy di production harus tidak mem-buffer respons `text/event-stream`.
- **Bukan:** Integrasi bank/QRIS otomatis. Transaksi tetap dicatat manual; yang realtime hanya tampilannya.

## ADR-007: Eksperimen ML di folder `ml/` dengan Python, data sintetis, dan evaluasi per template (2026-11-24)
- **Status:** Dibatalkan (2026-11-24). Tugas kelas hanya meminta penjelasan bagaimana AI menyelesaikan masalah, bukan model di dalam project, sehingga folder `ml/` dihapus dan tidak ada model AI di aplikasi. Isi di bawah disimpan sebagai riwayat; kodenya ada di commit `bee86c5`.
- **Keputusan:** Kode ML ditulis dengan Python (pandas, scikit-learn) di `ml/`, terpisah dari aplikasi Node. Dataset awal sintetis karena data asli aplikasi belum cukup. Kategori mengikuti 6 kategori bawaan aplikasi agar model bisa dipasang ke aplikasi.
- **Evaluasi:** Kategorisasi dinilai dengan split per template (pola kalimat yang tidak ada di data latih) dan label sebenarnya (`true_category`), sedangkan hiperparameter dipilih dengan GroupKFold di data latih. Split acak tetap dilaporkan sebagai pembanding, tetapi dianggap terlalu optimistis. Prediksi arus kas memakai rolling-origin tanpa kebocoran waktu.
- **Konsekuensi:** Angka baseline sengaja konservatif. Model belum dipakai di aplikasi; integrasi (saran kategori, peringatan kas menipis) adalah langkah terpisah. `ml/.venv`, `ml/data`, `ml/models` tidak masuk git dan dibuat ulang dari skrip.
