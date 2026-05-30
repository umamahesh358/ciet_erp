const root = document.documentElement;
const themeToggle = document.querySelector('[data-theme-toggle]');
const mobileToggle = document.querySelector('[data-mobile-toggle]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
const menuClose = document.querySelector('[data-menu-close]');
const counterNodes = document.querySelectorAll('[data-counter]');
const carousel = document.querySelector('[data-carousel]');

const storedTheme = localStorage.getItem('theme');
if (storedTheme === 'dark') {
  root.classList.add('dark');
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    root.classList.toggle('dark');
    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
  });
}

// Full screen menu overlay logic
if (mobileToggle && mobileMenu) {
  mobileToggle.addEventListener('click', () => {
    mobileMenu.classList.remove('hidden');
    // small delay to allow display block to process before opacity transition
    setTimeout(() => {
      mobileMenu.classList.remove('opacity-0');
      mobileMenu.classList.add('opacity-100');
    }, 10);
    document.body.style.overflow = 'hidden';
  });
}

if (menuClose && mobileMenu) {
  menuClose.addEventListener('click', () => {
    mobileMenu.classList.remove('opacity-100');
    mobileMenu.classList.add('opacity-0');
    // wait for transition to finish
    setTimeout(() => {
      mobileMenu.classList.add('hidden');
      document.body.style.overflow = '';
    }, 300);
  });
}

const revealTargets = document.querySelectorAll('.section-reveal');
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((node) => observer.observe(node));

const runCounter = (node) => {
  const target = Number(node.dataset.counter);
  if (!Number.isFinite(target)) return;
  let current = 0;
  const increment = Math.max(1, Math.floor(target / 60));
  const tick = () => {
    current = Math.min(target, current + increment);
    node.textContent = current.toLocaleString() + "+";
    if (current < target) {
      requestAnimationFrame(tick);
    }
  };
  tick();
};

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        runCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.6 }
);

counterNodes.forEach((node) => counterObserver.observe(node));

if (carousel) {
  const prev = document.querySelector('[data-carousel-prev]');
  const next = document.querySelector('[data-carousel-next]');
  const scrollByCard = () => carousel.clientWidth * 0.8;

  if (prev) {
    prev.addEventListener('click', () => {
      carousel.scrollBy({ left: -scrollByCard(), behavior: 'smooth' });
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      carousel.scrollBy({ left: scrollByCard(), behavior: 'smooth' });
    });
  }

  setInterval(() => {
    carousel.scrollBy({ left: scrollByCard(), behavior: 'smooth' });
  }, 8000);
}
