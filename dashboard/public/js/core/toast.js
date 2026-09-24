/**
 * dashboard/public/js/core/toast.js
 * Toast notification utility wrapping EventBus ui:notify.
 * Line budget: <= 50 lines.
 */
import { eventBus } from './eventBus.js';

export const toast = {
  info(message) {
    eventBus.emit('ui:notify', { message, level: 'info' });
  },
  success(message) {
    eventBus.emit('ui:notify', { message, level: 'success' });
  },
  warn(message) {
    eventBus.emit('ui:notify', { message, level: 'warning' });
  },
  error(message) {
    eventBus.emit('ui:notify', { message, level: 'error' });
  },
};
