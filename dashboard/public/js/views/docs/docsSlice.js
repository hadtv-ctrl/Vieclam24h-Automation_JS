/**
 * dashboard/public/js/views/docs/docsSlice.js
 * Documentation & Guides Feature Slice (Phase 4.8). Budget <= 150 lines.
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';

export class DocsSlice {
  constructor() {
    this.activeDoc = 'README.md';
    this._disposers = [];
    this._mounted = false;
  }

  async mount() {
    this._mounted = true;
    this._bindDomEvents();
    await this.loadDoc(this.activeDoc);
  }

  unmount() {
    this._mounted = false;
    this._disposers.forEach((d) => { try { d(); } catch (_) {} });
    this._disposers = [];
  }

  _bindDomEvents() {
    const root = document.getElementById('docs-view');
    if (!root) return;
    root.querySelectorAll('.doc-nav-item').forEach((item) => {
      const h = () => {
        const docName = item.dataset.doc;
        if (docName) this.loadDoc(docName);
      };
      item.addEventListener('click', h);
      this._disposers.push(() => item.removeEventListener('click', h));
    });
  }

  async loadDoc(docName) {
    this.activeDoc = docName;
    try {
      const res = await apiClient.get(`/api/code?path=${encodeURIComponent(docName)}`);
      stateStore.setState({ docs: { active: docName } }, 'docsSlice.load');
      this.renderDocContent(res?.content || 'Chưa có nội dung tài liệu.');
    } catch (_) {
      this.renderDocContent('# Hướng Dẫn Sử Dụng\nNội dung đang được cập nhật.');
    }
  }

  renderDocContent(content) {
    const el = document.getElementById('docs-markdown-content');
    if (el) el.textContent = content;
  }
}

export const docsSlice = new DocsSlice();
