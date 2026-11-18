# REST API v0.1 — Referensi Awal

Base URL development: `http://localhost:4000/api` melalui proxy Vite (`/api`). Semua endpoint selain health, registrasi, login, dan logout membutuhkan cookie sesi HttpOnly.

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/health` | Status proses API |
| POST | `/auth/register` | Buat akun + usaha + kas awal + kategori default |
| POST | `/auth/login` | Login email/password |
| POST | `/auth/logout` | Hapus cookie sesi |
| GET | `/auth/me` | Data pemilik dan usaha |
| GET | `/business` | Profil usaha |
| PATCH | `/business` | Perbarui `name`, `businessType` |
| GET | `/accounts` | Daftar rekening kas, termasuk `archivedAt` dan `hasTransactions` |
| POST | `/accounts` | Tambah `name`, `openingBalance` |
| PATCH | `/accounts/:id` | Ubah `name`, `openingBalance`, dan/atau `archived` (boolean). Lihat aturan di bawah |
| GET | `/categories` | Daftar kategori |
| POST | `/categories` | Tambah kategori `name` dan `type` |
| DELETE | `/categories/:id` | Hapus kategori yang belum dipakai |
| GET | `/transactions` | Filter `from`, `to`, `type`, `categoryId`, `search` (maks 500) |
| POST | `/transactions` | Buat transaksi |
| PUT | `/transactions/:id` | Ubah transaksi |
| DELETE | `/transactions/:id` | Hapus transaksi |
| GET | `/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` | Ringkasan periode dan saldo kas |
| GET | `/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | Ringkasan berbasis kas |

## Contoh POST transaksi

```json
{
  "type": "INCOME",
  "amount": "150000.00",
  "date": "2026-11-17",
  "note": "Penjualan harian",
  "accountId": "id-rekening-kas",
  "categoryId": "id-kategori-pendapatan"
}
```

`CAPITAL` dan `DRAW` memakai `accountId`, tanpa `categoryId`. `TRANSFER` memakai `fromAccountId` dan `toAccountId`, tanpa `accountId`/`categoryId`. Nominal selalu **string** desimal positif. `accountId` dan `categoryId` dapat diperoleh dari endpoint masing-masing. Jangan mengirim `businessId` secara manual: backend menentukan dari akun yang telah login.

## Format respons

Endpoint mengirim JSON. Kegagalan menggunakan status HTTP yang sesuai dan respons seperti:

```json
{ "error": "Kategori tidak cocok dengan jenis transaksi." }
```

Semua endpoint yang mengubah data perlu `Content-Type: application/json` (frontend helper melakukannya otomatis).

## Aturan PATCH rekening

- `openingBalance` hanya bisa diubah selama rekening belum dipakai transaksi apa pun (409 jika sudah). Mengirim nilai yang sama tidak dianggap perubahan.
- `archived: true` ditolak (409) bila saldo rekening sepanjang waktu belum nol, atau bila rekening itu satu-satunya yang masih aktif.
- Rekening arsip tidak bisa dipakai transaksi baru (400). Transaksi lama yang sudah memakai rekening itu tetap bisa diedit.
- Rekening arsip tetap dihitung di `/dashboard` dan `/reports`; `accountBalances[]` menyertakan `archived: boolean`.
- Setiap perubahan dicatat di audit log (`entityType: ACCOUNT`).
