GTR2026 UPGRADE

1. Copy Code.gs ke Apps Script.
2. Copy Index.html ke Apps Script.
3. Tampilkan appsscript.json dari Project Settings.
4. Isi CONFIG.SHEET_ID di Code.gs.
5. Jalankan setup() satu kali dan berikan izin.
6. Jalankan:
   setAdminPassword('PASSWORD_ADMIN_MINIMAL_8_KARAKTER')
7. Deploy > New deployment > Web app.
8. Execute as: Me / User deploying.
9. Who has access: Anyone.

PERUBAHAN:
- Tombol "Pilih 7K" dan "Pilih 18K" pada kartu informasi dihapus.
- Kartu 7K/18K menjadi informasi paket.
- Form tetap memiliki pilihan kategori.
- Untuk 7K: Jersey Race 7K tercatat otomatis.
- Untuk 18K: ada pilihan Jersey Race.
- Panel admin menampilkan paket 7K dan 18K.
- Login admin memakai adminLogin() di Apps Script, bukan password hard-code di HTML.
- Data peserta dan upload tidak lagi disimpan di localStorage.
- Google Sheet menjadi database utama.
