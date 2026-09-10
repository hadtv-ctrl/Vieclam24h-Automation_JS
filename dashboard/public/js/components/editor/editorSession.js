/**
 * dashboard/public/js/components/editor/editorSession.js
 * Unified Editor Session managing in-memory buffer, dirty tracking, and keybindings.
 * Line budget: <= 180 lines.
 */

import { eventBus } from '../../core/eventBus.js';
import { stateStore } from '../../core/stateStore.js';

export class EditorSession {
  constructor() {
    this._activeFile = null;
    this._cleanContent = '';
    this._bufferContent = '';
    this._isDirty = false;
  }

  openFile(filePath, content = '') {
    this._activeFile = filePath;
    this._cleanContent = content;
    this._bufferContent = content;
    this._setDirty(false);
    stateStore.setState({
      editor: { activeFile: filePath, isDirty: false }
    }, 'editorSession.openFile');
  }

  updateBuffer(newContent) {
    this._bufferContent = newContent;
    const isNowDirty = this._bufferContent !== this._cleanContent;
    if (this._isDirty !== isNowDirty) {
      this._setDirty(isNowDirty);
    }
  }

  async save(saveFn) {
    if (!this._activeFile) throw new Error('No active file open in editor.');
    if (!this._isDirty) return { skipped: true };

    const contentToSave = this._bufferContent;
    if (typeof saveFn === 'function') {
      await saveFn(this._activeFile, contentToSave);
    }

    this._cleanContent = contentToSave;
    this._setDirty(false);
    return { success: true, file: this._activeFile };
  }

  discard() {
    this._bufferContent = this._cleanContent;
    this._setDirty(false);
    return this._cleanContent;
  }

  getBuffer() {
    return this._bufferContent;
  }

  isDirty() {
    return this._isDirty;
  }

  getActiveFile() {
    return this._activeFile;
  }

  _setDirty(dirty) {
    this._isDirty = dirty;
    stateStore.setState({
      editor: { activeFile: this._activeFile, isDirty: dirty }
    }, 'editorSession.setDirty');
    eventBus.emit('editor:dirty', { file: this._activeFile, isDirty: dirty });
  }

  bindKeybindings(textareaOrElement, onSave) {
    if (!textareaOrElement || typeof textareaOrElement.addEventListener !== 'function') return;

    textareaOrElement.addEventListener('keydown', (e) => {
      // 1. Ctrl+S or Cmd+S -> Trigger Save
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onSave === 'function') {
          onSave(this.getBuffer());
        }
        return;
      }

      // 2. Tab key -> Insert 2 spaces
      if (e.key === 'Tab' && textareaOrElement.tagName === 'TEXTAREA') {
        e.preventDefault();
        const start = textareaOrElement.selectionStart;
        const end = textareaOrElement.selectionEnd;
        const value = textareaOrElement.value;
        textareaOrElement.value = value.substring(0, start) + '  ' + value.substring(end);
        textareaOrElement.selectionStart = textareaOrElement.selectionEnd = start + 2;
        this.updateBuffer(textareaOrElement.value);
      }
    });

    textareaOrElement.addEventListener('input', () => {
      if (textareaOrElement.tagName === 'TEXTAREA') {
        this.updateBuffer(textareaOrElement.value);
      }
    });
  }
}

export const editorSession = new EditorSession();
