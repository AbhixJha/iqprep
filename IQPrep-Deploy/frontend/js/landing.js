/* Landing interactions. The 3D scene lives in arena.js; this file only does
   smooth scroll, reveals, the rail line, magnetic buttons and the cursor. */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(pointer:fine)').matches && innerWidth > 768;
  var lenis = null;
  if (!reduce && window.Lenis) {
    try {
      lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var el = document.querySelector(a.getAttribute('href')); if (!el) return;
          e.preventDefault(); lenis.scrollTo(el, { offset: 0, duration: 1.6 });
        });
      });
    } catch (e) { lenis = null; }
  }
  // reveals
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.2 });
  document.querySelectorAll('.rv,[data-lines],.meter').forEach(function (el) { io.observe(el); });
  setTimeout(function () { document.querySelectorAll('[data-lines],.rv').forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); }); }, 150);

  // progress bar + rail
  var bar = document.querySelector('.scroll-bar'), rail = document.querySelector('.rail');
  function prog() {
    var p = Math.min(1, Math.max(0, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (rail) rail.style.setProperty('--rp', p.toFixed(4));
  }
  addEventListener('scroll', prog, { passive: true }); prog();

  // magnetic buttons
  if (fine && !reduce) document.querySelectorAll('[data-magnetic]').forEach(function (b) {
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.25) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.35) + 'px)';
    });
    b.addEventListener('pointerleave', function () { b.style.transform = ''; });
  });

  // cursor reticle
  var c = document.querySelector('.cur'), ring = document.querySelector('.cur-ring');
  if (fine && c && ring) {
    var x = 0, y = 0, rx = 0, ry = 0;
    addEventListener('pointermove', function (e) { x = e.clientX; y = e.clientY; c.style.left = x + 'px'; c.style.top = y + 'px'; }, { passive: true });
    (function loop() { rx += (x - rx) * 0.18; ry += (y - ry) * 0.18; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(loop); })();
    document.querySelectorAll('a,button').forEach(function (el) {
      el.addEventListener('pointerenter', function () { ring.classList.add('big'); });
      el.addEventListener('pointerleave', function () { ring.classList.remove('big'); });
    });
  }
  var top = document.querySelector('[data-top]');
  if (top) top.addEventListener('click', function (e) { e.preventDefault(); lenis ? lenis.scrollTo(0) : scrollTo({ top: 0 }); });
})();
