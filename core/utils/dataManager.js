const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const BACKUP_DIR = path.join(ROOT_DIR, '.dashboard-backups', 'data');
const MAX_DATASET_BYTES = 1024 * 1024;
const MAX_CSV_ROWS = 10000;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Sinh gia tri ngau nhien cho cac placeholder dong
 */
function generateDynamicValue(placeholder) {
  const ts = Date.now();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  switch (placeholder) {
    case '{{random_phone}}':
    case 'random_phone':
      return `098${Math.floor(1000000 + Math.random() * 9000000)}`;
    case '{{random_email}}':
    case 'random_email':
      return `autotest_${ts.toString().slice(-6)}_${randomDigits}@example.com`;
    case '{{random_name}}':
    case 'random_name': {
      const names = ['Nguyen Van A', 'Tran Thi B', 'Le Hoang C', 'Pham Quoc D', 'Hoang Mai E'];
      return `${names[Math.floor(Math.random() * names.length)]} ${randomDigits}`;
    }
    case '{{timestamp}}':
    case 'timestamp':
      return `${ts}`;
    case '{{date}}':
    case 'date':
      return new Date().toISOString().split('T')[0];
    default:
      return placeholder;
  }
}

/**
 * Thay the toan bo cac placeholder {{...}} trong chuoi hoac object
 */
function resolveDynamicValues(data) {
  if (typeof data === 'string') {
    return data.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match) => generateDynamicValue(match));
  }
  if (Array.isArray(data)) {
    return data.map(resolveDynamicValues);
  }
  if (data && typeof data === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(data)) {
      resolved[k] = resolveDynamicValues(v);
    }
    return resolved;
  }
  return data;
}

/**
 * Liet ke tat ca dataset files trong data/
 */
function listDatasets() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const fullPath = path.join(DATA_DIR, entry.name);
      const stat = fs.statSync(fullPath);
      let content = null;
      let recordCount = 0;
      let isArray = false;
      try {
        content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (Array.isArray(content)) {
          recordCount = content.length;
          isArray = true;
        } else if (typeof content === 'object') {
          recordCount = Object.keys(content).length;
          isArray = false;
        }
      } catch (e) {
        // Ignored
      }
      return {
        fileName: entry.name,
        relativePath: `data/${entry.name}`,
        size: stat.size,
        modifiedAt: new Date(stat.mtimeMs).toISOString(),
        recordCount,
        isArray,
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

/**
 * Doc chi tiet mot dataset
 */
function readDataset(fileName) {
  const safeName = path.basename(fileName);
  const fullPath = path.join(DATA_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File ${safeName} khong ton tai trong thu muc data/`);
  }
  const raw = fs.readFileSync(fullPath, 'utf8');
  const data = JSON.parse(raw);
  return {
    fileName: safeName,
    relativePath: `data/${safeName}`,
    raw,
    data,
    isArray: Array.isArray(data),
  };
}

/**
 * Luu dataset vao file co backup an toan
 */
function saveDataset(fileName, dataOrRaw) {
  const safeName = normalizeDatasetName(fileName);
  const fullPath = path.join(DATA_DIR, safeName);
  ensureBackupDir();

  // Tao backup truoc khi ghi
  if (fs.existsSync(fullPath)) {
    const backupName = `${safeName}.${Date.now()}.bak`;
    fs.copyFileSync(fullPath, path.join(BACKUP_DIR, backupName));
  }

  let formatted = '';
  if (typeof dataOrRaw === 'string') {
    // Validate JSON truoc khi luu
    const parsed = JSON.parse(dataOrRaw);
    formatted = JSON.stringify(parsed, null, 2);
  } else {
    formatted = JSON.stringify(dataOrRaw, null, 2);
  }

  if (Buffer.byteLength(formatted, 'utf8') > MAX_DATASET_BYTES) {
    throw new Error('Tệp dữ liệu vượt quá giới hạn 1 MB.');
  }

  fs.writeFileSync(fullPath, formatted, 'utf8');
  return {
    success: true,
    fileName: safeName,
    relativePath: `data/${safeName}`,
  };
}

/**
 * Chuyen mang JSON sang chuoi CSV
 */
function jsonToCsv(jsonArray) {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) return '';
  const headers = Array.from(
    new Set(jsonArray.flatMap((item) => (typeof item === 'object' && item !== null ? Object.keys(item) : [])))
  );

  const rows = [headers.join(',')];
  for (const item of jsonArray) {
    const values = headers.map((header) => {
      let val = item && item[header] !== undefined ? item[header] : '';
      if (typeof val === 'object') val = JSON.stringify(val);
      const strVal = String(val).replace(/"/g, '""');
      return strVal.includes(',') || strVal.includes('\n') || strVal.includes('"') ? `"${strVal}"` : strVal;
    });
    rows.push(values.join(','));
  }
  return rows.join('\n');
}

/**
 * Chuyen chuoi CSV sang mang JSON
 */
function csvToJson(csvString) {
  if (!csvString || typeof csvString !== 'string') return [];
  if (Buffer.byteLength(csvString, 'utf8') > MAX_DATASET_BYTES) throw new Error('CSV vượt quá giới hạn 1 MB.');
  const records = parseCsvRecords(csvString);
  if (records.length < 2) return [];
  const headers = records[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error('CSV có tiêu đề cột rỗng.');
  const result = [];
  for (const values of records.slice(1)) {
    if (values.length !== headers.length) throw new Error('CSV có số cột không đồng nhất.');
    const row = {};
    headers.forEach((header, idx) => {
      const value = values[idx];
      if (value === 'true') row[header] = true;
      else if (value === 'false') row[header] = false;
      else if (value !== '' && !Number.isNaN(Number(value))) row[header] = Number(value);
      else row[header] = value;
    });
    result.push(row);
  }
  if (result.length > MAX_CSV_ROWS) throw new Error(`CSV vượt quá giới hạn ${MAX_CSV_ROWS} dòng.`);
  return result;
}

function parseCsvRecords(csvString) {
  const records = [];
  let record = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < csvString.length; index += 1) {
    const char = csvString[index];
    if (char === '"') {
      if (quoted && csvString[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { record.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csvString[index + 1] === '\n') index += 1;
      if (value || record.length) { record.push(value); records.push(record); }
      record = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV có chuỗi mở nhưng chưa đóng dấu ngoặc kép.');
  if (value || record.length) { record.push(value); records.push(record); }
  return records;
}


/**
 * Tao moi mot dataset voi template
 */
function normalizeDatasetName(fileName) {
  const requested = String(fileName || '');
  if (requested.includes('/') || requested.includes('\\')) {
    throw new Error('Tên file dữ liệu không hợp lệ.');
  }
  const safeName = path.basename(requested.endsWith('.json') ? requested : `${requested}.json`);
  if (!/^[a-zA-Z0-9._-]+\.json$/.test(safeName) || safeName === '.json') {
    throw new Error('Tên file dữ liệu không hợp lệ.');
  }
  return safeName;
}

function createDataset(fileName, templateType = 'array', content) {
  const safeName = normalizeDatasetName(fileName);
  const fullPath = path.join(DATA_DIR, safeName);
  if (fs.existsSync(fullPath)) {
    throw new Error(`File ${safeName} da ton tai trong thu muc data/`);
  }

  if (content !== undefined && content !== null) return saveDataset(safeName, content);
  let initialData = [];
  if (templateType === 'users') {
    initialData = [
      {
        fullName: "{{random_name}}",
        phone: "{{random_phone}}",
        email: "{{random_email}}",
        password: "Test@1234",
        otp: "1111"
      }
    ];
  } else if (templateType === 'object') {
    initialData = {
      title: "Bo du lieu mau",
      createdAt: "{{date}}",
      details: {
        description: "Mo ta chi tiet",
        enabled: true
      }
    };
  }

  return saveDataset(safeName, initialData);
}

/**
 * Xoa tep du lieu test khoi thu muc data/ co tao backup
 */
function deleteDataset(fileName) {
  const safeName = path.basename(String(fileName || '').trim());
  if (!safeName || !safeName.endsWith('.json')) {
    throw new Error('Chỉ được xóa file dữ liệu JSON (.json).');
  }
  const fullPath = path.join(DATA_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Tệp dữ liệu ${safeName} không tồn tại.`);
  }

  // Tao backup truoc khi xoa
  ensureBackupDir();
  const backupName = `${safeName}.${Date.now()}.deleted.bak`;
  fs.copyFileSync(fullPath, path.join(BACKUP_DIR, backupName));

  fs.unlinkSync(fullPath);
  return {
    success: true,
    fileName: safeName,
    message: `Đã xóa tệp dữ liệu ${safeName} thành công.`,
  };
}

module.exports = {
  listDatasets,
  readDataset,
  saveDataset,
  createDataset,
  deleteDataset,
  jsonToCsv,
  csvToJson,
  generateDynamicValue,
  resolveDynamicValues,
  normalizeDatasetName,
  MAX_DATASET_BYTES,
};
