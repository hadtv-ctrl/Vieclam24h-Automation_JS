/**
 * dashboard/public/js/views/qa/batch/selectionModel.js
 * Tập finding đang được chọn để sửa hàng loạt (PLAN-18). Giữ ngoài DOM nên sống qua mỗi lượt
 * vẽ lại và qua bộ lọc. Không phụ thuộc DOM hay API — kiểm được bằng import trực tiếp.
 */

export class SelectionModel {
  constructor() {
    this._keys = new Set();
  }

  get size() {
    return this._keys.size;
  }

  has(key) {
    return this._keys.has(key);
  }

  keys() {
    return [...this._keys];
  }

  toggle(key, on = !this._keys.has(key)) {
    if (on) this._keys.add(key);
    else this._keys.delete(key);
    return on;
  }

  addKeys(keys) {
    keys.forEach((key) => this._keys.add(key));
  }

  removeKeys(keys) {
    keys.forEach((key) => this._keys.delete(key));
  }

  clear() {
    this._keys.clear();
  }

  /** Bỏ các key không còn trong lần quét mới (key chứa số dòng nên đổi khi file đổi). Trả số key bị bỏ. */
  prune(currentKeys) {
    const alive = new Set(currentKeys);
    let removed = 0;
    for (const key of [...this._keys]) {
      if (!alive.has(key)) {
        this._keys.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  /** Trạng thái checkbox tổng theo các dòng ĐANG HIỂN THỊ và chọn được: 'none' | 'some' | 'all'. */
  visibleState(visibleKeys) {
    if (!visibleKeys.length) return 'none';
    const picked = visibleKeys.filter((key) => this._keys.has(key)).length;
    if (picked === 0) return 'none';
    return picked === visibleKeys.length ? 'all' : 'some';
  }

  /** Click checkbox tổng: đang 'all' thì bỏ chọn các dòng hiển thị, còn lại thì chọn hết. Không đụng mục bị ẩn. */
  toggleVisible(visibleKeys) {
    if (this.visibleState(visibleKeys) === 'all') this.removeKeys(visibleKeys);
    else this.addKeys(visibleKeys);
  }

  /** Số mục đã chọn nhưng đang bị bộ lọc ẩn. */
  hiddenCount(visibleKeys) {
    const visible = new Set(visibleKeys);
    return this.keys().filter((key) => !visible.has(key)).length;
  }
}
