/**
 * Thu vien 6 nhom payload kiem thu bien (Edge Payloads).
 */

const PAYLOAD_CATEGORIES = ['xss', 'sqli', 'unicode', 'whitespace', 'length', 'csv-formula'];

const STATIC_PAYLOADS = [
  // XSS
  { id: 'xss-01', category: 'xss', value: '<script>alert(1)</script>', description: 'The script thuan' },
  { id: 'xss-02', category: 'xss', value: '<img src=x onerror=alert(1)>', description: 'The img kem onerror handler' },
  { id: 'xss-03', category: 'xss', value: '"><svg onload=alert(1)>', description: 'Dong thuoc tinh va chen the svg onload' },
  { id: 'xss-04', category: 'xss', value: 'javascript:alert(1)', description: 'URI scheme javascript' },

  // SQLi
  { id: 'sqli-01', category: 'sqli', value: "' OR '1'='1", description: 'Menh de luon dung voi dau nhay don' },
  { id: 'sqli-02', category: 'sqli', value: "'; DROP TABLE users;--", description: 'Lenh thuc thi tiep theo (stacked query)' },
  { id: 'sqli-03', category: 'sqli', value: '" OR ""="', description: 'Menh de luon dung voi dau nhay kep' },
  { id: 'sqli-04', category: 'sqli', value: "1' AND SLEEP(5)--", description: 'Time-based blind SQL injection' },

  // Unicode
  { id: 'unicode-01', category: 'unicode', value: 'Nguyễn'.normalize('NFC'), description: 'Chuoi tieng Viet NFC' },
  { id: 'unicode-02', category: 'unicode', value: 'Nguyễn'.normalize('NFD'), description: 'Chuoi tieng Viet NFD (decomposed)' },
  { id: 'unicode-03', category: 'unicode', value: '\u200B', description: 'Zero-width space (U+200B)' },
  { id: 'unicode-04', category: 'unicode', value: '\u200D', description: 'Zero-width joiner (U+200D)' },
  { id: 'unicode-05', category: 'unicode', value: '\u00A0', description: 'Non-breaking space NBSP (U+00A0)' },
  { id: 'unicode-06', category: 'unicode', value: '\u202E', description: 'Right-to-left override RTL (U+202E)' },
  { id: 'unicode-07', category: 'unicode', value: '👨‍👩‍👧‍👦', description: 'Surrogate pair emoji to hop' },

  // Whitespace
  { id: 'whitespace-01', category: 'whitespace', value: '   test   ', description: 'Khoang trang dau va cuoi chuoi' },
  { id: 'whitespace-02', category: 'whitespace', value: '     ', description: 'Chuoi chi chua khoang trang' },
  { id: 'whitespace-03', category: 'whitespace', value: '\t\n\r', description: 'Ky tu dieu khien tab va xuong dong' },
  { id: 'whitespace-04', category: 'whitespace', value: '\u3000', description: 'Khoang trang toan kho Ideographic Space (U+3000)' },

  // CSV Formula
  { id: 'csv-01', category: 'csv-formula', value: '=1+1', description: 'Cong thuc dau bang' },
  { id: 'csv-02', category: 'csv-formula', value: '+1+1', description: 'Cong thuc dau cong' },
  { id: 'csv-03', category: 'csv-formula', value: '-1+1', description: 'Cong thuc dau tru' },
  { id: 'csv-04', category: 'csv-formula', value: '@SUM(1,1)', description: 'Cong thuc ky tu @' },
  { id: 'csv-05', category: 'csv-formula', value: '=HYPERLINK("http://example.com")', description: 'Lenh mo lien ket ngoai' }
];

function listPayloads(category) {
  if (category && category !== 'all' && !PAYLOAD_CATEGORIES.includes(category)) {
    const err = new Error(`Nhom payload khong hop le: ${category}`);
    err.field = 'category';
    throw err;
  }

  const lengthPayloads = [
    { id: 'length-255', category: 'length', value: 'A'.repeat(255), description: 'Chuoi do dai dung 255 ky tu' },
    { id: 'length-256', category: 'length', value: 'A'.repeat(256), description: 'Chuoi do dai vuot nguong 256 ky tu' },
    { id: 'length-1024', category: 'length', value: 'A'.repeat(1024), description: 'Chuoi do dai 1024 ky tu' }
  ];

  const all = [...STATIC_PAYLOADS, ...lengthPayloads];
  if (!category || category === 'all') {
    return all;
  }
  return all.filter((p) => p.category === category);
}

module.exports = {
  PAYLOAD_CATEGORIES,
  listPayloads
};
