(function () {
  'use strict';

  function revealOnScroll() {
    document.querySelectorAll('.ciet-theme-reveal').forEach(function (item) {
      item.classList.add('is-visible');
      item.style.transitionDelay = '0ms';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealOnScroll);
  } else {
    revealOnScroll();
  }
})();
