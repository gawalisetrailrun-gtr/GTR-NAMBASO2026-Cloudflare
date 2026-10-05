/*******************************************************
 * GTR2026 - GOOGLE APPS SCRIPT BACKEND
 * Database: Google Sheet
 * Upload  : Google Drive
 *
 * Setelah paste:
 * 1. Isi SHEET_ID
 * 2. Jalankan setup()
 * 3. Jalankan setAdminPassword('PasswordBaruMinimal8')
 * 4. Deploy sebagai Web App
 *******************************************************/

const CONFIG = {
  SHEET_ID: '1DDQn5Rt7nhiHrp5cy43CcfYLqjAYxpds7Ydb-aPz_Gs',
  PARTICIPANT_SHEET: 'PESERTA',
  SETTINGS_SHEET: 'PENGATURAN',
  UPLOAD_FOLDER: 'GTR2026_UPLOADS',
  SESSION_TTL_SECONDS: 21600,
  ID_PREFIX_7K: 'GNTR-7K-',
  ID_PREFIX_18K: 'GNTR-18K-'
};

const HEADERS = [
  'ID PESERTA','NAMA LENGKAP','NIK','WHATSAPP','JENIS KELAMIN',
  'NOMOR KONTAK EMERGENCY','NAMA KONTAK EMERGENCY','GOL. DARAH','NAMA KOMUNITAS',
  'ALAMAT','KATEGORI','SIZE JERSEY','JERSEY RACE',
  'SIZE WINDBREAKER','KTP FILE','BUKTI TRANSFER','STATUS','TANGGAL DAFTAR'
];

const DEFAULT_SETTINGS = {
  EVENT_NAME: 'GTR2026',
  EVENT_DATE: '',
  REGISTRATION_OPEN: 'YA',
  REGISTRATION_DEADLINE: '',
  EARLY_BIRD_ACTIVE: 'YES',
  PRICE_7K_EARLY: '250000',
  PRICE_7K_NORMAL: '300000',
  PRICE_18K_EARLY: '450000',
  PRICE_18K_NORMAL: '500000',
  BANK_NAME: '',
  BANK_ACCOUNT: '',
  BANK_OWNER: '',
  ADMIN_CONTACT: '',
  JERSEY_RACE_OPTIONS: 'Jersey Race|Tidak memilih Jersey Race'
};

/* ================= WEB APP ================= */

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'GTR-NAMBASO2026 Cloudflare API aktif'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ================= CLOUDFLARE API BRIDGE ================= */

const API_HANDLERS = {
  getSettings: getSettings,
  registerParticipant: registerParticipant,
  quickSearch: quickSearch,
  adminLogin: adminLogin,
  adminLogout: adminLogout,
  adminListParticipants: adminListParticipants,
  adminGetParticipant: adminGetParticipant,
  adminDeleteParticipant: adminDeleteParticipant,
  changeAdminPassword: changeAdminPassword,
  saveSettings: saveSettings,
  adminExportCSV: adminExportCSV
};

function doPost(e) {
  try {
    const body = JSON.parse(e?.postData?.contents || '{}');
    const action = String(body.action || '');
    const args = Array.isArray(body.args) ? body.args : [];

    const fn = API_HANDLERS[action];
    if (typeof fn !== 'function') {
      throw new Error('Aksi API tidak diizinkan atau tidak ditemukan.');
    }

    const result = fn.apply(null, args);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: err?.message || 'Terjadi kesalahan pada server.'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ================= SETUP ================= */

function setup() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const peserta = getOrCreateSheet_(ss, CONFIG.PARTICIPANT_SHEET);
  const pengaturan = getOrCreateSheet_(ss, CONFIG.SETTINGS_SHEET);

  ensureHeaders_(peserta);
  ensureSettings_(pengaturan);
  getOrCreateUploadFolder_();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD_HASH')) {
    props.setProperty('ADMIN_PASSWORD_HASH', hash_('admin123'));
  }

  return {
    success: true,
    message: 'Setup berhasil. Segera ganti password admin dengan setAdminPassword().'
  };
}

/* ================= ADMIN PASSWORD ================= */

function setAdminPassword(password) {
  if (!password || String(password).length < 8) {
    throw new Error('Password minimal 8 karakter.');
  }

  PropertiesService.getScriptProperties()
    .setProperty('ADMIN_PASSWORD_HASH', hash_(String(password)));

  return {
    success: true,
    message: 'Password admin berhasil diubah.'
  };
}

function adminLogin(password) {
  if (!password) {
    return {success:false, message:'Password wajib diisi.'};
  }

  const stored = PropertiesService.getScriptProperties()
    .getProperty('ADMIN_PASSWORD_HASH');

  if (!stored) {
    return {
      success:false,
      message:'Password belum dikonfigurasi. Jalankan setup().'
    };
  }

  if (hash_(String(password)) !== stored) {
    return {
      success:false,
      message:'Kata sandi admin salah.'
    };
  }

  const token = Utilities.getUuid();

  CacheService.getScriptCache().put(
    'GTR2026_ADMIN_' + token,
    'OK',
    CONFIG.SESSION_TTL_SECONDS
  );

  return {
    success:true,
    token:token,
    expiresIn:CONFIG.SESSION_TTL_SECONDS
  };
}


function changeAdminPassword(token, currentPassword, newPassword) {
  auth_(token);

  const current = String(currentPassword || '');
  const next = String(newPassword || '');

  if (current.length < 1) {
    throw new Error('Password lama wajib diisi.');
  }

  if (next.length < 8) {
    throw new Error('Password baru minimal 8 karakter.');
  }

  if (current === next) {
    throw new Error('Password baru harus berbeda dari password lama.');
  }

  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('ADMIN_PASSWORD_HASH');

  if (!stored) {
    throw new Error('Password admin belum dikonfigurasi.');
  }

  if (hash_(current) !== stored) {
    throw new Error('Password lama salah.');
  }

  props.setProperty('ADMIN_PASSWORD_HASH', hash_(next));

  return {
    success: true,
    message: 'Password admin berhasil diubah. Silakan gunakan password baru saat login berikutnya.'
  };
}

function adminLogout(token) {
  if (token) {
    CacheService.getScriptCache()
      .remove('GTR2026_ADMIN_' + token);
  }

  return {success:true};
}

function auth_(token) {
  if (!token) {
    throw new Error('Sesi admin tidak ditemukan.');
  }

  const cache = CacheService.getScriptCache();
  const key = 'GTR2026_ADMIN_' + token;

  if (cache.get(key) !== 'OK') {
    throw new Error('Sesi admin telah berakhir. Silakan login kembali.');
  }

  cache.put(
    key,
    'OK',
    CONFIG.SESSION_TTL_SECONDS
  );
}

/* ================= REGISTRASI ================= */

function registerParticipant(data) {
  if (!data) {
    throw new Error('Data pendaftaran tidak valid.');
  }

  const x = normalizeRegistration_(data);
  validateRegistration_(x);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sh = getOrCreateSheet_(ss, CONFIG.PARTICIPANT_SHEET);
    ensureHeaders_(sh);

    const settings = getSettings();

    const openValue =
      String(settings.REGISTRATION_OPEN || 'YA').toUpperCase();

    if (openValue !== 'YA' && openValue !== 'OPEN') {
      throw new Error('Pendaftaran sedang ditutup.');
    }

    if (settings.REGISTRATION_DEADLINE) {
      const deadline = new Date(settings.REGISTRATION_DEADLINE);
      if (!isNaN(deadline.getTime()) && new Date() > deadline) {
        throw new Error('Batas pendaftaran telah berakhir.');
      }
    }

    const duplicate = findDuplicate_(sh, x.nik, x.whatsapp);
    if (duplicate) {
      throw new Error(
        duplicate === 'NIK'
          ? 'NIK sudah terdaftar.'
          : 'Nomor WhatsApp sudah terdaftar.'
      );
    }

    const category = normalizeCategory_(x.kategori);

    const prefix =
      category === '18K'
        ? CONFIG.ID_PREFIX_18K
        : CONFIG.ID_PREFIX_7K;

    const id = nextId_(sh, prefix);
    const folder = getOrCreateUploadFolder_();

    const ktp = saveUpload_(
      x.uploadKtp,
      folder,
      id + '_KTP'
    );

    const transfer = saveUpload_(
      x.uploadTransfer,
      folder,
      id + '_TRANSFER'
    );

    const race =
      category === '18K'
        ? 'Jersey Race 18K'
        : 'Jersey Race 7K';

    sh.appendRow([
      id,
      x.namaLengkap,
      x.nik,
      x.whatsapp,
      x.jenisKelamin,
      x.nomorKontakEmergency,
      x.namaKontakEmergency,
      x.golDarah,
      x.namaKomunitas,
      x.alamat,
      category,
      x.sizeJersey,
      race,
      x.sizeWindbreaker,
      ktp.url,
      transfer.url,
      'TERDAFTAR',
      new Date()
    ]);

    return {
      success:true,
      participantId:id,
      nama:x.namaLengkap,
      kategori:category,
      jerseyRace:race,
      status:'TERDAFTAR'
    };

  } finally {
    lock.releaseLock();
  }
}

function normalizeRegistration_(d) {
  const category = normalizeCategory_(d.kategori);

  return {
    namaLengkap: clean_(d.namaLengkap || d.nama),
    nik: digits_(d.nik),
    whatsapp: phone_(d.whatsapp),
    jenisKelamin: clean_(d.jenisKelamin),
    nomorKontakEmergency: phone_(d.nomorKontakEmergency),
    namaKontakEmergency: clean_(d.namaKontakEmergency),
    golDarah: clean_(d.golDarah).toUpperCase(),
    namaKomunitas: clean_(d.namaKomunitas),
    alamat: clean_(d.alamat),
    kategori: category,
    sizeJersey: clean_(d.sizeJersey),
    jerseyRace:
      category === '18K'
        ? 'Jersey Race 18K'
        : 'Jersey Race 7K',
    sizeWindbreaker: clean_(d.sizeWindbreaker),
    uploadKtp: d.uploadKtp,
    uploadTransfer: d.uploadTransfer
  };
}

function validateRegistration_(x) {
  if (!x.namaLengkap) throw new Error('Nama lengkap wajib diisi.');
  if (x.nik.length < 8) throw new Error('NIK tidak valid.');
  if (x.whatsapp.length < 8) throw new Error('Nomor WhatsApp tidak valid.');
  if (!x.jenisKelamin) throw new Error('Jenis kelamin wajib dipilih.');
  if (x.nomorKontakEmergency.length < 8) throw new Error('Nomor kontak emergency tidak valid.');
  if (!x.namaKontakEmergency) throw new Error('Nama kontak emergency wajib diisi.');
  if (!['A','B','AB','O'].includes(x.golDarah)) throw new Error('Golongan darah wajib dipilih.');
  if (!x.alamat) throw new Error('Alamat wajib diisi.');
  if (!x.kategori) throw new Error('Kategori wajib dipilih.');

  if (x.kategori === '7K' && !x.sizeJersey) {
    throw new Error('Ukuran Jersey 7K wajib dipilih.');
  }

  if (x.kategori === '18K' && !x.sizeJersey) {
    throw new Error('Ukuran Jersey Race 18K wajib dipilih.');
  }

  if (x.kategori === '18K' && !x.sizeWindbreaker) {
    throw new Error('Ukuran Windbreaker 18K wajib dipilih.');
  }

  if (!x.uploadKtp) throw new Error('KTP wajib diunggah.');
  if (!x.uploadTransfer) throw new Error('Bukti transfer wajib diunggah.');
}

function normalizeCategory_(v) {
  const value = String(v || '').trim().toUpperCase();

  if (value.includes('18')) return '18K';
  if (value.includes('7')) return '7K';

  return value;
}

/* ================= SEARCH ================= */

function quickSearch(q) {
  q = String(q || '').trim();

  if (!q) {
    return {
      success:false,
      message:'Masukkan ID peserta, NIK, atau nomor WhatsApp.'
    };
  }

  const sh = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.PARTICIPANT_SHEET);

  if (!sh || sh.getLastRow() < 2) {
    return {
      success:false,
      message:'Data peserta belum tersedia.'
    };
  }

  const values = sh.getRange(1, 1, sh.getLastRow(), Math.min(sh.getLastColumn(), HEADERS.length)).getDisplayValues();
  const I = indexes_(values[0]);

  const qNIK = digits_(q);
  const qPhone = phone_(q);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    if (
      String(row[I.id]) === q ||
      digits_(row[I.nik]) === qNIK ||
      phone_(row[I.phone]) === qPhone
    ) {
      return {
        success:true,
        participant:publicParticipant_(row, I)
      };
    }
  }

  return {
    success:false,
    message:'Peserta tidak ditemukan.'
  };
}

/* ================= ADMIN LIST ================= */

function adminListParticipants(token, options) {
  auth_(token);

  options = options || {};

  const page = Math.max(1, Number(options.page || 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(options.pageSize || 25))
  );

  const search =
    String(options.search || '').trim().toLowerCase();

  const category =
    String(options.category || '').trim().toUpperCase();

  const status =
    String(options.status || '').trim().toUpperCase();

  const sh = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.PARTICIPANT_SHEET);

  if (!sh || sh.getLastRow() < 2) {
    return {
      success:true,
      data:[],
      total:0,
      page:page,
      pageSize:pageSize,
      totalPages:0
    };
  }

  const values = sh.getRange(1, 1, sh.getLastRow(), Math.min(sh.getLastColumn(), HEADERS.length)).getDisplayValues();
  const I = indexes_(values[0]);
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const r = values[i];

    const rowId = String(r[I.id] || '').toLowerCase();
    const rowName = String(r[I.name] || '').toLowerCase();
    const rowNik = String(r[I.nik] || '').toLowerCase();
    const rowPhone = phone_(r[I.phone]);

    const matchSearch =
      !search ||
      rowId.includes(search) ||
      rowName.includes(search) ||
      rowNik.includes(search) ||
      rowPhone.includes(phone_(search));

    const matchCategory =
      !category ||
      String(r[I.cat] || '').toUpperCase() === category;

    const matchStatus =
      !status ||
      String(r[I.status] || '').toUpperCase() === status;

    if (matchSearch && matchCategory && matchStatus) {
      rows.push({
        sheetRow:i + 1,
        participant:adminParticipant_(r, I)
      });
    }
  }

  const total = rows.length;
  const start = (page - 1) * pageSize;

  return {
    success:true,
    data:rows.slice(start, start + pageSize),
    total:total,
    page:page,
    pageSize:pageSize,
    totalPages:Math.ceil(total / pageSize)
  };
}

/* ================= ADMIN DETAIL ================= */

function adminGetParticipant(token, id) {
  auth_(token);

  const sh = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.PARTICIPANT_SHEET);

  if (!sh || sh.getLastRow() < 2) {
    throw new Error('Data peserta belum tersedia.');
  }

  const values = sh.getRange(1, 1, sh.getLastRow(), Math.min(sh.getLastColumn(), HEADERS.length)).getDisplayValues();
  const I = indexes_(values[0]);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][I.id]) === String(id)) {
      return {
        success:true,
        sheetRow:i + 1,
        participant:adminParticipant_(values[i], I),
        ktpPreview:fileToDataUrl_(values[i][I.ktp]),
        transferPreview:fileToDataUrl_(values[i][I.transfer])
      };
    }
  }

  throw new Error('Peserta tidak ditemukan.');
}

/* ================= ADMIN STATUS ================= */

function adminUpdateStatus(token, id, status) {
  auth_(token);
  return {success:false, message:'Fungsi verifikasi peserta sudah dinonaktifkan.'};
}

/* ================= ADMIN DELETE ================= */

function adminDeleteParticipant(token, id) {
  auth_(token);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sh = SpreadsheetApp.openById(CONFIG.SHEET_ID)
      .getSheetByName(CONFIG.PARTICIPANT_SHEET);

    const row = findRow_(sh, id);

    if (!row) throw new Error('Peserta tidak ditemukan.');

    sh.deleteRow(row);

    return {
      success:true,
      participantId:id
    };

  } finally {
    lock.releaseLock();
  }
}

/* ================= SETTINGS ================= */

function getSettings() {
  const result = Object.assign({}, DEFAULT_SETTINGS);

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);

  if (!sh || sh.getLastRow() < 2) {
    return result;
  }

  const rows = sh.getRange(
    2, 1, sh.getLastRow() - 1, 2
  ).getValues();

  rows.forEach(row => {
    const key = String(row[0] || '').trim();

    if (
      key &&
      Object.prototype.hasOwnProperty.call(
        DEFAULT_SETTINGS,
        key
      )
    ) {
      result[key] = String(row[1] ?? '');
    }
  });

  return result;
}

function saveSettings(token, settings) {
  auth_(token);

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = getOrCreateSheet_(
    ss,
    CONFIG.SETTINGS_SHEET
  );

  ensureSettings_(sh);

  const current = getSettings();

  const rows = Object.keys(DEFAULT_SETTINGS).map(key => [
    key,
    settings[key] !== undefined
      ? String(settings[key])
      : String(current[key] ?? DEFAULT_SETTINGS[key])
  ]);

  if (sh.getLastRow() > 1) {
    sh.getRange(
      2, 1, sh.getLastRow() - 1, 2
    ).clearContent();
  }

  sh.getRange(
    2, 1, rows.length, 2
  ).setValues(rows);

  return {
    success:true,
    settings:getSettings()
  };
}

/* ================= CSV ================= */

function adminExportCSV(token) {
  auth_(token);

  const sh = SpreadsheetApp.openById(CONFIG.SHEET_ID)
    .getSheetByName(CONFIG.PARTICIPANT_SHEET);

  if (!sh) throw new Error('Sheet PESERTA tidak ditemukan.');

  const csv = sh.getDataRange()
    .getDisplayValues()
    .map(row =>
      row.map(v =>
        '"' + String(v).replace(/"/g, '""') + '"'
      ).join(',')
    )
    .join('\r\n');

  return {
    success:true,
    filename:
      'GTR2026_PESERTA_' +
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone() || 'Asia/Makassar',
        'yyyyMMdd_HHmmss'
      ) +
      '.csv',
    csv:csv
  };
}

/* ================= SHEETS ================= */

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sh) {
  if (sh.getLastRow() === 0) {
    sh.getRange(
      1,1,1,HEADERS.length
    ).setValues([HEADERS]);
  } else {
    for (let i = 0; i < HEADERS.length; i++) {
      if (!sh.getRange(1, i + 1).getValue()) {
        sh.getRange(1, i + 1)
          .setValue(HEADERS[i]);
      }
    }
  }

  sh.getRange(
    1,1,1,HEADERS.length
  ).setFontWeight('bold');

  sh.setFrozenRows(1);
}

function ensureSettings_(sh) {
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,2)
      .setValues([['KEY','VALUE']]);

    const rows = Object.keys(DEFAULT_SETTINGS)
      .map(k => [k, DEFAULT_SETTINGS[k]]);

    sh.getRange(
      2,1,rows.length,2
    ).setValues(rows);

  } else if (
    String(sh.getRange(1,1).getValue()) !== 'KEY'
  ) {
    sh.getRange(1,1,1,2)
      .setValues([['KEY','VALUE']]);
  }

  sh.getRange(1,1,1,2)
    .setFontWeight('bold');

  sh.setFrozenRows(1);
}

/* ================= INDEX ================= */

function indexes_(headers) {
  const m = {};

  headers.forEach((v, i) => {
    switch (String(v || '').trim().toUpperCase()) {
      case 'ID PESERTA': m.id = i; break;
      case 'NAMA LENGKAP': m.name = i; break;
      case 'NIK': m.nik = i; break;
      case 'WHATSAPP': m.phone = i; break;
      case 'JENIS KELAMIN': m.gender = i; break;
      case 'NOMOR KONTAK EMERGENCY': m.emergencyPhone = i; break;
      case 'NAMA KONTAK EMERGENCY': m.emergencyName = i; break;
      case 'GOL. DARAH': m.bloodType = i; break;
      case 'NAMA KOMUNITAS': m.community = i; break;
      case 'ALAMAT': m.address = i; break;
      case 'KATEGORI': m.cat = i; break;
      case 'SIZE JERSEY': m.jersey = i; break;
      case 'JERSEY RACE': m.race = i; break;
      case 'SIZE WINDBREAKER': m.wind = i; break;
      case 'KTP FILE': m.ktp = i; break;
      case 'BUKTI TRANSFER': m.transfer = i; break;
      case 'STATUS': m.status = i; break;
      case 'TANGGAL DAFTAR': m.date = i; break;
    }
  });

  return m;
}

/* ================= DATA ================= */

function publicParticipant_(r, I) {
  return {
    id:r[I.id],
    nama:r[I.name],
    kategori:r[I.cat],
    jerseyRace:r[I.race],
    status:r[I.status],
    tanggal:formatDate_(r[I.date])
  };
}

function adminParticipant_(r, I) {
  return {
    id:r[I.id],
    nama:r[I.name],
    nik:r[I.nik],
    whatsapp:r[I.phone],
    jenisKelamin:r[I.gender],
    nomorKontakEmergency:r[I.emergencyPhone],
    namaKontakEmergency:r[I.emergencyName],
    golDarah:r[I.bloodType],
    namaKomunitas:r[I.community],
    alamat:r[I.address],
    kategori:r[I.cat],
    sizeJersey:r[I.jersey],
    jerseyRace:r[I.race],
    sizeWindbreaker:r[I.wind],
    ktp:r[I.ktp],
    transfer:r[I.transfer],
    status:r[I.status],
    tanggal:formatDate_(r[I.date])
  };
}

/* ================= DUPLICATE ================= */

function findDuplicate_(sh, nik, phone) {
  if (sh.getLastRow() < 2) return null;

  const values = sh.getRange(1, 1, sh.getLastRow(), Math.min(sh.getLastColumn(), HEADERS.length)).getDisplayValues();
  const I = indexes_(values[0]);

  for (let i = 1; i < values.length; i++) {
    if (digits_(values[i][I.nik]) === nik) {
      return 'NIK';
    }

    if (phone_(values[i][I.phone]) === phone) {
      return 'WHATSAPP';
    }
  }

  return null;
}

/* ================= ID ================= */

function nextId_(sh, prefix) {
  if (sh.getLastRow() < 2) {
    return prefix + '0001';
  }

  const ids = sh.getRange(
    2,1,sh.getLastRow() - 1,1
  ).getDisplayValues();

  let max = 0;

  ids.forEach(row => {
    const id = String(row[0] || '');

    if (id.startsWith(prefix)) {
      const n = parseInt(
        id.substring(prefix.length),
        10
      );

      if (!isNaN(n) && n > max) {
        max = n;
      }
    }
  });

  return prefix +
    String(max + 1).padStart(4, '0');
}

/* ================= UPLOAD ================= */

function saveUpload_(data, folder, prefix) {
  if (!data || !data.data) {
    throw new Error('File upload tidak valid.');
  }

  const base64 = String(data.data)
    .replace(/^data:.*?;base64,/, '');

  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    data.mimeType || 'image/jpeg',
    prefix + '_' +
      String(data.name || 'file.jpg')
        .replace(/[^\w.\-]+/g, '_')
  );

  const file = folder.createFile(blob);

  return {
    id:file.getId(),
    url:file.getUrl()
  };
}

function fileToDataUrl_(url) {
  try {
    const match =
      String(url || '').match(/[-\w]{25,}/);

    if (!match) return '';

    const blob =
      DriveApp.getFileById(match[0]).getBlob();

    return (
      'data:' +
      blob.getContentType() +
      ';base64,' +
      Utilities.base64Encode(
        blob.getBytes()
      )
    );

  } catch (e) {
    return '';
  }
}

/* ================= DRIVE ================= */

function getOrCreateUploadFolder_() {
  const folders =
    DriveApp.getFoldersByName(
      CONFIG.UPLOAD_FOLDER
    );

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(
    CONFIG.UPLOAD_FOLDER
  );
}

/* ================= ADMIN ROW ================= */

function findRow_(sh, id) {
  if (!sh || sh.getLastRow() < 2) {
    return null;
  }

  const values = sh.getRange(
    2,1,sh.getLastRow() - 1,1
  ).getDisplayValues();

  for (let i = 0; i < values.length; i++) {
    if (
      String(values[i][0]) === String(id)
    ) {
      return i + 2;
    }
  }

  return null;
}

/* ================= HELPERS ================= */

function hash_(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );

  return bytes.map(b => {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function digits_(v) {
  return String(v || '').replace(/\D/g, '');
}

function phone_(v) {
  let p = digits_(v);

  if (p.startsWith('62')) return p;

  if (p.startsWith('0')) {
    return '62' + p.substring(1);
  }

  return p;
}

function clean_(v) {
  return String(v || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDate_(v) {
  if (!v) return '';

  const d =
    v instanceof Date
      ? v
      : new Date(v);

  if (isNaN(d.getTime())) {
    return String(v);
  }

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone() || 'Asia/Makassar',
    'dd/MM/yyyy HH:mm'
  );
}
