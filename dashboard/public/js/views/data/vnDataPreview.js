/**
 * vnDataPreview.js - Render tuy chon form, bang xem truoc du lieu va payload.
 * Tran so dong <= 150, INV-5: 100% dung textContent chong XSS.
 */

export function renderOptions(container, type) {
  if (!container) return;
  container.innerHTML = '';

  const addGroup = (label, element) => {
    const grp = document.createElement('div');
    grp.className = 'data-vn-field-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    grp.append(lbl, element);
    container.appendChild(grp);
  };

  const addSelect = (label, id, options) => {
    const sel = document.createElement('select');
    sel.id = id;
    sel.className = 'form-input';
    options.forEach(([v, t]) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = t;
      sel.appendChild(opt);
    });
    addGroup(label, sel);
  };

  if (['persona', 'cccd', 'name'].includes(type)) {
    addSelect('Giới tính', 'data-vn-gender', [['any', 'Ngẫu nhiên'], ['male', 'Nam'], ['female', 'Nữ']]);
  }
  if (['persona', 'phone'].includes(type)) {
    addSelect('Nhà mạng', 'data-vn-carrier', [['any', 'Tất cả'], ['viettel', 'Viettel'], ['vinaphone', 'VinaPhone'], ['mobifone', 'MobiFone']]);
  }
  if (type === 'mst') {
    addSelect('Loại MST', 'data-vn-mst-kind', [['10', '10 số (Doanh nghiệp)'], ['13', '13 số (Đơn vị phụ thuộc)']]);
  }
  if (['persona', 'name'].includes(type)) {
    addSelect('Dấu tiếng Việt', 'data-vn-diacritics', [['true', 'Có dấu (NFC)'], ['false', 'Không dấu (ASCII)']]);
  }
  if (['persona', 'cccd'].includes(type)) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.id = 'data-vn-birthyear'; inp.className = 'form-input';
    inp.placeholder = '18–60 tuổi'; inp.min = '1900'; inp.max = String(new Date().getFullYear());
    addGroup('Năm sinh', inp);
  }
}

export function renderPreviewTable(container, type, records) {
  if (!container) return;
  container.innerHTML = '';
  if (!records?.length) {
    container.innerHTML = '<p class="data-vn-empty-hint">Không có bản ghi nào.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-vn-table';
  const thead = document.createElement('thead');
  const cols = type === 'persona'
    ? ['#', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Số CCCD', 'Số điện thoại', 'Email']
    : ['#', type === 'cccd' ? 'Số CCCD' : type === 'mst' ? 'Mã số thuế' : type === 'phone' ? 'Số điện thoại' : 'Họ và tên'];

  const htr = document.createElement('tr');
  cols.forEach((c) => { const th = document.createElement('th'); th.textContent = c; htr.appendChild(th); });
  thead.appendChild(htr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  records.forEach((rec, idx) => {
    const tr = document.createElement('tr');
    const tdIdx = document.createElement('td'); tdIdx.textContent = String(idx + 1);
    tr.appendChild(tdIdx);

    const vals = type === 'persona'
      ? [rec.fullName, rec.gender === 'male' ? 'Nam' : 'Nữ', rec.birthDate, rec.cccd, rec.phone, rec.email]
      : [String(rec ?? '')];

    vals.forEach((v) => {
      const td = document.createElement('td'); td.textContent = String(v ?? ''); tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

export function renderPayloadTable(container, payloads, onCopy) {
  if (!container) return;
  container.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'data-vn-table';
  table.innerHTML = '<thead><tr><th>ID</th><th>Nhóm</th><th>Giá trị</th><th>Mô tả</th><th>Thao tác</th></tr></thead>';

  const tbody = document.createElement('tbody');
  payloads.forEach((item) => {
    const tr = document.createElement('tr');
    const [tdId, tdCat, tdVal, tdDesc, tdAct] = [0, 1, 2, 3, 4].map(() => document.createElement('td'));
    tdId.textContent = item.id; tdCat.textContent = item.category; tdDesc.textContent = item.description || '';

    const code = document.createElement('span');
    code.className = 'data-vn-code'; code.textContent = item.value;
    tdVal.appendChild(code);

    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-secondary-sm'; btn.textContent = 'Sao chép';
    btn.onclick = () => onCopy(item.value, btn);
    tdAct.appendChild(btn);

    tr.append(tdId, tdCat, tdVal, tdDesc, tdAct);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}
