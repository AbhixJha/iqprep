// ═══════════════════════════════════════
// MOBILE-NAV.JS — Responsive Hamburger Menu
// ═══════════════════════════════════════

(function() {
  'use strict';
  
  function initMobileNav() {
    const nav = document.querySelector('.nav');
    if (!nav || nav.dataset.mobileInit) return;
    nav.dataset.mobileInit = 'true';

    // Don't add mobile nav to pages that have custom navs (video-interview inline nav)
    const navLinks = nav.querySelector('.nav-links');
    
    // Create hamburger button
    const hamburger = document.createElement('button');
    hamburger.className = 'nav-hamburger';
    hamburger.setAttribute('aria-label', 'Toggle menu');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'nav-mobile-overlay';

    // Create mobile menu
    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'nav-mobile-menu';

    // Build menu links from existing nav
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    const links = [
      { href: 'dashboard.html', icon: 'fa-solid fa-house', label: 'Dashboard' },
      { href: 'interview.html', icon: 'fa-solid fa-keyboard', label: 'Practice' },
      { href: 'video-interview.html', icon: 'fa-solid fa-video', label: 'Video Interview' },
      { href: 'resume.html', icon: 'fa-solid fa-file-lines', label: 'Resume' },
      { href: 'daily-challenge.html', icon: 'fa-solid fa-bolt', label: 'Daily Challenge' },
      { divider: true },
      { href: 'replay.html', icon: 'fa-solid fa-film', label: 'Replay' },
      { href: 'history.html', icon: 'fa-solid fa-clock-rotate-left', label: 'History' },
      { href: 'analytics.html', icon: 'fa-solid fa-chart-line', label: 'Analytics' },
      { href: 'leaderboard.html', icon: 'fa-solid fa-trophy', label: 'Leaderboard' },
      { divider: true },
      { href: 'profile.html', icon: 'fa-solid fa-user', label: 'Profile' },
    ];

    let menuHtml = '';
    links.forEach(link => {
      if (link.divider) {
        menuHtml += '<div class="nav-mobile-divider"></div>';
        return;
      }
      // Check if current nav has this link
      const isActive = currentPage === link.href;
      menuHtml += `<a href="${link.href}" class="${isActive ? 'on' : ''}">
        <i class="${link.icon}"></i> ${link.label}
      </a>`;
    });

    mobileMenu.innerHTML = menuHtml;

    // Insert hamburger into nav-right or after nav-logo
    const navRight = nav.querySelector('.nav-right');
    if (navRight) {
      navRight.appendChild(hamburger);
    } else {
      nav.appendChild(hamburger);
    }

    document.body.appendChild(overlay);
    document.body.appendChild(mobileMenu);

    // Toggle handlers
    function openMenu() {
      overlay.style.display = 'block';
      requestAnimationFrame(() => {
        overlay.classList.add('open');
        mobileMenu.classList.add('open');
      });
      hamburger.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      overlay.classList.remove('open');
      mobileMenu.classList.remove('open');
      hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }

    hamburger.addEventListener('click', function(e) {
      e.stopPropagation();
      if (mobileMenu.classList.contains('open')) closeMenu();
      else openMenu();
    });

    overlay.addEventListener('click', closeMenu);

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
    });

    // Close menu on resize to desktop
    window.addEventListener('resize', function() {
      if (window.innerWidth > 768 && mobileMenu.classList.contains('open')) closeMenu();
    });
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
