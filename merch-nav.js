/* Keep the native Merch dropdown easy to dismiss without interfering with links. */
(() => {
  const menus = Array.from(document.querySelectorAll('.nav-merch-menu'));
  if (!menus.length) return;
  document.addEventListener('pointerdown', event => {
    for (const menu of menus) {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    for (const menu of menus) {
      if (!menu.open) continue;
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
})();
