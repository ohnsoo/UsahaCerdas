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
