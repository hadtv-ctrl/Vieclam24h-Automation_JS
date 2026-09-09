const {
  listDatasets,
  readDataset,
  saveDataset,
  createDataset,
  deleteDataset,
  jsonToCsv,
  csvToJson,
  generateDynamicValue,
} = require('../../core/utils/dataManager');
const { sendJson, parseBody } = require('./routeUtils');

/**
 * Handles all /api/data/* endpoints for Test Data Studio.
 * Returns true if the request was handled, false otherwise.
 */
async function handleDataRoutes(request, response, url) {
  if (!url.pathname.startsWith('/api/data/')) return false;

  // 1. GET /api/data/datasets
  if (request.method === 'GET' && url.pathname === '/api/data/datasets') {
    try {
      sendJson(response, 200, { datasets: listDatasets() });
      return true;
    } catch (error) {
      sendJson(response, 500, { error: error.message });
      return true;
    }
  }

  // 2. GET /api/data/dataset?file=...
  if (request.method === 'GET' && url.pathname === '/api/data/dataset') {
    const fileName = url.searchParams.get('file');
    if (!fileName) {
      sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
      return true;
    }
    try {
      const result = readDataset(fileName);
      sendJson(response, 200, result);
      return true;
    } catch (error) {
      sendJson(response, 404, { error: error.message });
      return true;
    }
  }

  // 3. POST /api/data/dataset
  if (request.method === 'POST' && url.pathname === '/api/data/dataset') {
    try {
      const body = await parseBody(request);
      const fileName = body.fileName;
      if (!fileName) {
        sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
        return true;
      }
      const result = saveDataset(fileName, body.data);
      sendJson(response, 200, result);
      return true;
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }
  }

  // 4. DELETE /api/data/dataset or POST /api/data/delete-dataset
  if ((request.method === 'DELETE' && url.pathname === '/api/data/dataset') || (request.method === 'POST' && url.pathname === '/api/data/delete-dataset')) {
    try {
      const body = request.method === 'POST' ? await parseBody(request) : {};
      const fileName = body.fileName || body.file || body.name || url.searchParams.get('fileName') || url.searchParams.get('file') || url.searchParams.get('name');
      if (!fileName) {
        sendJson(response, 400, { error: 'Thiếu tên file dữ liệu cần xóa.' });
        return true;
      }
      const result = deleteDataset(fileName);
      sendJson(response, 200, result);
      return true;
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }
  }

  // 5. POST /api/data/create-dataset
  if (request.method === 'POST' && url.pathname === '/api/data/create-dataset') {
    try {
      const body = await parseBody(request);
      const fileName = body.fileName;
      const templateType = body.templateType || 'array';
      if (!fileName) {
        sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
        return true;
      }
      const result = createDataset(fileName, templateType, body.content);
      sendJson(response, 200, {
        success: true,
        message: `Đã tạo tệp dữ liệu ${result.fileName}`,
        ...result,
      });
      return true;
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }
  }

  // 6. GET /api/data/export-csv
  if (request.method === 'GET' && url.pathname === '/api/data/export-csv') {
    const fileName = url.searchParams.get('file');
    if (!fileName) {
      sendJson(response, 400, { error: 'Thiếu tên file dữ liệu.' });
      return true;
    }
    try {
      const dataset = readDataset(fileName);
      if (!Array.isArray(dataset.data)) throw new Error('Chỉ có thể xuất CSV từ dataset dạng mảng.');
      const csv = jsonToCsv(dataset.data);
      response.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${dataset.fileName.replace(/"/g, '')}"`,
      });
      response.end(`\uFEFF${csv}`);
      return true;
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }
  }

  // 7. POST /api/data/import-csv
  if (request.method === 'POST' && url.pathname === '/api/data/import-csv') {
    try {
      const body = await parseBody(request, 1024 * 1024 + 4096);
      const fileName = body.fileName;
      const csv = typeof body.csv === 'string' ? body.csv.replace(/^\uFEFF/, '') : '';
      if (!fileName || !csv) {
        sendJson(response, 400, { error: 'Thiếu tên file hoặc nội dung CSV.' });
        return true;
      }
      const rows = csvToJson(csv);
      if (rows.length === 0) throw new Error('CSV phải có tiêu đề và ít nhất một dòng dữ liệu.');
      const result = saveDataset(fileName, rows);
      sendJson(response, 200, { ...result, importedRows: rows.length });
      return true;
    } catch (error) {
      sendJson(response, 400, { error: error.message });
      return true;
    }
  }

  // 8. GET /api/data/dynamic-preview
  if (request.method === 'GET' && url.pathname === '/api/data/dynamic-preview') {
    try {
      sendJson(response, 200, {
        random_phone: generateDynamicValue('{{random_phone}}'),
        random_email: generateDynamicValue('{{random_email}}'),
        random_name: generateDynamicValue('{{random_name}}'),
        timestamp: generateDynamicValue('{{timestamp}}'),
        date: generateDynamicValue('{{date}}'),
      });
      return true;
    } catch (error) {
      sendJson(response, 500, { error: error.message });
      return true;
    }
  }

  return false;
}

module.exports = {
  handleDataRoutes,
};
