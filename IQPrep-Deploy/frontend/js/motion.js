/* ==========================================================================
   IQPrep motion layer
   --------------------------------------------------------------------------
   One file, two modes (set with <body data-motion="full|lite">):
     full  - landing + auth pages. Lenis smooth scroll, GSAP ScrollTrigger:
             split-text reveals, pinned horizontal section, scroll-scrubbed
             words, velocity marquee, 3D tilt, magnetic buttons.
     lite  - app pages. No smooth scroll (it fights with chat panes, modals
             and the code editor). Only: cursor, page wipe, soft reveals.
   Everything is progressive: if GSAP is not loaded the page still works.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer:fine)').matches && window.innerWidth > 768;
  var body = document.body;
  var mode = body.getAttribute('data-motion') || 'lite';
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (mode === 'full' && !hasGSAP) mode = 'lite';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- shared: page wipe between pages ---------- */
  var wipe = document.createElement('div');
  wipe.className = 'pt';
  wipe.innerHTML = '<span>IQPrep</span>';
  body.appendChild(wipe);

  function animate(el, frames, opts) {
    if (el.animate) return el.animate(frames, opts);
    return { finished: Promise.resolve(), onfinish: null };
  }

  var cameViaWipe = false;
  try { cameViaWipe = sessionStorage.getItem('iq_pt') === '1'; sessionStorage.removeItem('iq_pt'); } catch (e) {}
  if (cameViaWipe && !reduce) {
    wipe.style.transform = 'translateY(0)';
    requestAnimationFrame(function () {
      var a = animate(wipe, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], { duration: 650, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards', delay: 80 });
      (a.finished || Promise.resolve()).then(function () { wipe.style.transform = 'translateY(100%)'; try { a.cancel(); } catch (e) {} });
    });
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-nowipe')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/.test(href)) return;
    var url; try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    if (reduce) return;
    e.preventDefault();
    try { sessionStorage.setItem('iq_pt', '1'); } catch (err) {}
    var an = animate(wipe, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 520, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
    var go = function () { location.href = url.href; };
    if (an.finished) an.finished.then(go); else go();
    setTimeout(go, 900); // safety
  });
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) { wipe.style.transform = 'translateY(100%)'; $$('.pt').forEach(function (p) { p.getAnimations && p.getAnimations().forEach(function (x) { x.cancel(); }); }); }
  });

  /* ---------- shared: cursor reticle ---------- */
  var dot = $('.cur'), ring = $('.cur-ring');
  if (dot && ring && fine) {
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; dot.style.left = mx + 'px'; dot.style.top = my + 'px'; }, { passive: true });
    (function loop() { rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16; ring.style.left = rx + 'px'; ring.style.top = ry + 'px'; requestAnimationFrame(loop); })();
    document.addEventListener('pointerover', function (e) {
      var hot = e.target.closest && e.target.closest('a,button,[data-tilt],[data-magnetic],.btn,.cat-c,.opt');
      ring.classList.toggle('big', !!hot);
    });
  } else {
    if (dot) dot.style.display = 'none';
    if (ring) ring.style.display = 'none';
  }

  /* ---------- shared: soft reveal for app pages (IntersectionObserver) ---------- */
  function softReveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var sel = '.card, .feat-card, .stat-c, .sess-i, .hi, .cat-c, .lb-row, .tab-c';
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    var i = 0;
    $$(sel).forEach(function (el) {
      // only things that are on screen layout right now and not already animated by the page
      if (!el.offsetParent || el.closest('.stag') || el.closest('[data-reveal]') || el.closest('.modal,.modal-ov')) return;
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.9) return; // already visible: leave alone
      el.classList.add('rv');
      el.style.transitionDelay = (i++ % 4) * 60 + 'ms';
      io.observe(el);
    });
  }

  if (mode !== 'full') { softReveal(); return; }

  /* ========================= FULL MODE ========================= */
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  var lenis = null;

  /* smooth scroll wired into ScrollTrigger */
  if (!reduce && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var t = $(id); if (!t) return;
        e.preventDefault(); lenis.scrollTo(t, { offset: -40, duration: 1.4 });
      });
    });
    $$('[data-top]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); lenis.scrollTo(0, { duration: 1.6 }); }); });
  }

  /* scroll progress bar */
  var bar = $('.scroll-bar');
  if (bar) gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });

  /* ---------- split text: keeps <em>, <br>, nested spans ---------- */
  function splitEl(el, mode) {
    var chars = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'split-w';
            if (mode === 'chars') {
              part.split('').forEach(function (ch) { var c = document.createElement('span'); c.className = 'split-c'; c.textContent = ch; w.appendChild(c); chars.push(c); });
            } else { var c2 = document.createElement('span'); c2.className = 'split-c'; c2.textContent = part; w.appendChild(c2); chars.push(c2); }
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    })(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    return chars;
  }

  var heroChars = [];
  $$('[data-split]').forEach(function (el) {
    var parts = splitEl(el, el.getAttribute('data-split'));
    var inHero = !!el.closest('.hero');
    gsap.set(parts, { yPercent: 118 });
    if (inHero) { heroChars = parts; return; }
    gsap.to(parts, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: el.getAttribute('data-split') === 'chars' ? 0.02 : 0.07, scrollTrigger: { trigger: el, start: 'top 85%' } });
  });

  /* generic reveals */
  var heroReveals = [];
  $$('[data-reveal]').forEach(function (el) {
    var kind = el.getAttribute('data-reveal');
    var from = kind === 'wipe' ? { clipPath: 'inset(0 0 100% 0)', y: 30 } : kind === 'fade' ? { opacity: 0, y: 24 } : { opacity: 0, y: 40 };
    var to = { clipPath: 'inset(0 0 0% 0)', opacity: 1, y: 0, duration: 1, ease: 'power3.out', clearProps: 'clipPath' };
    gsap.set(el, { visibility: 'visible' });
    gsap.set(el, from);
    if (el.closest('.hero')) { heroReveals.push({ el: el, to: to }); return; }
    to.scrollTrigger = { trigger: el, start: 'top 90%' };
    gsap.to(el, to);
  });

  /* parallax */
  $$('[data-speed]').forEach(function (el) {
    var s = parseFloat(el.getAttribute('data-speed')) || 0.2;
    gsap.to(el, { yPercent: s * 100, ease: 'none', scrollTrigger: { trigger: el.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- scroll-scrubbed words ---------- */
  var stmt = $('#stmt');
  if (stmt) {
    var wds = [];
    (function walk(node, acc) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var s = document.createElement('span'); s.className = 'wd' + (acc ? ' acc' : ''); s.textContent = p; frag.appendChild(s); wds.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n, acc || n.classList.contains('acc'));
      });
    })(stmt, false);
    ScrollTrigger.create({
      trigger: stmt, start: 'top 78%', end: 'bottom 55%', scrub: true,
      onUpdate: function (self) { var k = Math.round(self.progress * wds.length); wds.forEach(function (w, i) { w.classList.toggle('lit', i < k); }); }
    });
  }

  /* ---------- pinned horizontal rounds ---------- */
  var rtrack = $('#rd-track'), rsec = $('#rounds');
  if (rtrack && rsec) {
    var cards = $$('.rd', rtrack), cur = $('#rd-cur');
    var dist = function () { return Math.max(0, rtrack.scrollWidth - innerWidth + 0); };
    gsap.to(rtrack, {
      x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: {
        trigger: rsec, pin: true, scrub: 0.6, start: 'top top', end: function () { return '+=' + (dist() + innerHeight * 0.4); }, invalidateOnRefresh: true,
        onUpdate: function (self) {
          var i = Math.min(cards.length - 1, Math.floor(self.progress * cards.length * 0.999));
          if (cur) cur.textContent = '0' + (i + 1);
          cards.forEach(function (c, n) { var b = $('.rd-bar', c); if (b) b.style.width = (n < i ? 100 : n === i ? Math.round(((self.progress * cards.length) - i) * 100) : 0) + '%'; });
        }
      }
    });
  }

  /* ---------- marquee reacts to scroll velocity ---------- */
  var mq = $('#mq');
  if (mq) {
    var mtw = gsap.to(mq, { xPercent: -50, ease: 'none', duration: 32, repeat: -1 });
    ScrollTrigger.create({
      onUpdate: function (self) {
        var v = Math.min(Math.abs(self.getVelocity()) / 220, 9);
        gsap.to(mtw, { timeScale: (self.direction || 1) * (1 + v), duration: 0.25, overwrite: true, onComplete: function () { gsap.to(mtw, { timeScale: 1, duration: 1.2 }); } });
      }
    });
  }

  /* ---------- 3D scorecard driven by scroll ---------- */
  var card = $('#sc-card'), stage = $('#sc-stage');
  if (card && stage) {
    gsap.set(card, { transformPerspective: 1400 });
    gsap.fromTo(card, { rotateY: -32, rotateX: 16, y: 90, rotateZ: -3 }, { rotateY: 10, rotateX: 0, y: 0, rotateZ: 0, ease: 'none', scrollTrigger: { trigger: stage, start: 'top 90%', end: 'center 45%', scrub: 0.8 } });
    $$('.sc-row i', card).forEach(function (bar, n) {
      gsap.fromTo(bar, { '--p': 0 }, { '--p': 1, duration: 1.2, delay: n * 0.12, ease: 'power3.out', scrollTrigger: { trigger: stage, start: 'top 60%' } });
    });
  }

  /* ---------- giant CTA word slides sideways ---------- */
  var big = $('#cta-big');
  if (big) gsap.fromTo(big, { xPercent: 10 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: big, start: 'top bottom', end: 'bottom 30%', scrub: true } });

  /* ---------- colour bleed: the fill spreads from where the cursor enters/leaves ---------- */
  $$('.ft').forEach(function (el) {
    function at(e) { var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
    el.addEventListener('pointerenter', at); el.addEventListener('pointerleave', at);
  });

  /* ---------- 3D tilt on cards ---------- */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach(function (el) {
      gsap.set(el, { transformPerspective: 900 });
      var rx = gsap.quickTo(el, 'rotateX', { duration: 0.5, ease: 'power3' });
      var ry = gsap.quickTo(el, 'rotateY', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 9);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 9);
      });
      el.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });

    /* magnetic buttons */
    $$('[data-magnetic]').forEach(function (el) {
      var qx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      var qy = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.28);
        qy((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', function () { qx(0); qy(0); });
    });
  }

  /* ---------- intro: preloader then hero ---------- */
  var pre = $('#pre');
  function intro() {
    var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to(heroChars, { yPercent: 0, duration: 1.15, stagger: 0.028 }, 0)
      .fromTo('.l-nav', { yPercent: -100 }, { yPercent: 0, duration: 0.9 }, 0.2)
      .fromTo('.hero-tag', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.8 }, 0.3);
    heroReveals.forEach(function (r, i) { tl.to(r.el, r.to, 0.55 + i * 0.12); });
    tl.add(function () { body.classList.add('motion-ready'); ScrollTrigger.refresh(); }, 0);
  }
  var seen = false; try { seen = sessionStorage.getItem('iq_pre') === '1'; } catch (e) {}
  if (pre && !seen && !cameViaWipe && !reduce) {
    try { sessionStorage.setItem('iq_pre', '1'); } catch (e) {}
    if (lenis) lenis.stop();
    var n = $('#pre-n'), b = $('#pre-bar'), o = { v: 0 };
    gsap.to(o, { v: 100, duration: 1.3, ease: 'power2.inOut', onUpdate: function () { n.textContent = ('00' + Math.round(o.v)).slice(-3); b.style.transform = 'scaleX(' + o.v / 100 + ')'; },
      onComplete: function () {
        gsap.to(pre, { yPercent: -100, duration: 0.85, ease: 'power4.inOut', onComplete: function () { pre.remove(); if (lenis) lenis.start(); } });
        intro();
      } });
  } else { if (pre) pre.remove(); body.classList.add('motion-ready'); intro(); }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  window.IQMotion = { lenis: lenis };
})();
