(function () {
  'use strict';
  if (window.__CIET_NO_CONTEXT_MENU__) return;
  window.__CIET_NO_CONTEXT_MENU__ = true;

  document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    alert('Sorry ! Right Click No Access.');
  }, true);
})();
