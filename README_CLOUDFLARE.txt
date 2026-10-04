GTR-NAMBASO2026 - CLOUDFLARE EDITION v1
========================================

Ini adalah salinan terpisah dari GTR-NAMBASO2026 v8.
Versi v8 Apps Script ASLI tidak diubah.

TARGET PUBLIC URL
-----------------
https://gtr-nambaso2026.pages.dev

STRUKTUR
--------
- Index.html                : website publik Cloudflare
- functions/api/[[path]].js : Pages Function / proxy ke Apps Script
- Code.gs                   : backend Apps Script dengan API doPost
- appsscript.json           : manifest Apps Script

BACKEND APPS SCRIPT
-------------------
https://script.google.com/macros/s/AKfycbyiGmvWr93c3zgz8MJNYC0nbbOXl7jMCa537fk0U6jGscQowP3G3KfdiwJclCpc1Dnc/exec

GOOGLE SHEET
------------
1DDQn5Rt7nhiHrp5cy43CcfYLqjAYxpds7Ydb-aPz_Gs

PENTING
-------
1. Jangan menghapus deployment Apps Script lama.
2. Code.gs di paket ini sudah memakai Sheet ID yang diberikan pengguna.
3. Sebelum Cloudflare dipakai sebagai alamat publik, Code.gs versi ini perlu ditempel/deploy sebagai Web App dan diuji.
4. API hanya membuka fungsi yang diperlukan website; setup() dan setAdminPassword() tidak diekspos melalui API.
5. Upload KTP dan bukti transfer dikirim sebagai data base64 dari browser ke Apps Script melalui proxy.
6. Versi v8 asli tetap menjadi cadangan.

CLOUDFLARE PAGES
----------------
Cloudflare Pages dapat men-deploy static HTML dan Pages Functions. Setelah deployment, proyek mendapat subdomain *.pages.dev.

Untuk tahap berikutnya, buat proyek Pages dengan nama:
gtr-nambaso2026

Build command: exit 0
Build output directory: .

Jangan deploy sebelum backend Apps Script versi Cloudflare ini selesai diuji.


BACKEND API (Apps Script Cloudflare v2):
https://script.google.com/macros/s/AKfycbxffen8X1J9Xq_fr7B-k6YFoWG3MLNQpZjt_VKcRye6u_AfR2CwjcRNGT41ErjbDQLrig/exec

CATATAN: v8 lama tidak diubah. Folder ini adalah salinan terpisah.
Cloudflare Pages Functions tidak didukung melalui Direct Upload dashboard; deploy dengan Git integration atau Wrangler.
