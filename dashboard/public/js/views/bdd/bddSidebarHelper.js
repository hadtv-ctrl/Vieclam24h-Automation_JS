/**
 * dashboard/public/js/views/bdd/bddSidebarHelper.js
 * Sidebar collapse/expand event bindings for BDD Studio. Budget <= 60 lines.
 */
export function bindBddSidebarEvents(root, disposers) {
  if (!root) return;
  const on = (sel, evt, fn) => {
    const el = root.querySelector(sel);
    if (!el) return;
    el.addEventListener(evt, fn);
    disposers.push(() => el.removeEventListener(evt, fn));
  };

  const toggle = (e) => {
    e.stopPropagation();
    if (typeof window.toggleSidebar === 'function') {
      window.toggleSidebar('bdd');
    } else {
      root.querySelector('.script-workspace-panel')?.classList.toggle('sidebar-collapsed');
    }
  };

  const setCollapsed = (e, val, lock = false) => {
    e.stopPropagation();
    if (typeof window.setSidebarCollapsed === 'function') {
      window.setSidebarCollapsed('bdd', val, lock);
    } else {
      root.querySelector('.script-workspace-panel')?.classList.toggle('sidebar-collapsed', val);
    }
  };

  on('#btn-collapse-script-sidebar', 'click', (e) => setCollapsed(e, true, true));
  on('#btn-toggle-script-sidebar-head', 'click', toggle);
  on('#btn-toggle-script-sidebar-head-edit', 'click', toggle);
  on('#btn-toggle-script-sidebar-head-create', 'click', toggle);
  on('#btn-expand-script-sidebar', 'click', (e) => setCollapsed(e, false));
  on('#script-sidebar-collapsed-strip', 'click', (e) => setCollapsed(e, false));
}
