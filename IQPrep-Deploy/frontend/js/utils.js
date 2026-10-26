// ═══════════════════════════════════════
// UTILS.JS — IQPrep Shared Utilities
// ═══════════════════════════════════════

// ── STORAGE ──
const S = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: k => localStorage.removeItem(k),
  push: (k, v) => { const a = S.get(k) || []; a.unshift(v); S.set(k, a) }
};

// ── NAME HELPERS ──
function capitalizeName(name) {
  if (!name) return '';
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
function getFirstName() {
  const user = S.get('iq3_user');
  return capitalizeName(user?.firstName) || 'User';
}
function getFullName() {
  const user = S.get('iq3_user');
  return (capitalizeName(user?.firstName || '') + ' ' + capitalizeName(user?.lastName || '')).trim() || 'User';
}
function getInitial() {
  const user = S.get('iq3_user');
  return (user?.firstName || 'U')[0].toUpperCase();
}

// ── SCORE HELPERS ──
function scoreColor(s) {
  s = parseFloat(s);
  if (s >= 9) return '#10B981';
  if (s >= 7) return '#38BDF8';
  if (s >= 5) return '#FBBF24';
  if (s >= 3) return '#ff8a1a';
  return '#F43F5E';
}
function scoreLabel(s) {
  s = parseFloat(s);
  if (s >= 9) return 'Exceptional';
  if (s >= 7) return 'Good';
  if (s >= 5) return 'Average';
  if (s >= 3) return 'Needs Work';
  return 'Poor';
}
function scoreEmoji(s) {
  s = parseFloat(s);
  if (s >= 9) return 'A+';
  if (s >= 7) return 'A';
  if (s >= 5) return 'B';
  if (s >= 3) return 'C';
  return 'D';
}

// ── STREAK ──
function updateStreak() {
  const today = new Date().toDateString();
  const last = localStorage.getItem('iq3_last_day');
  let streak = parseInt(localStorage.getItem('iq3_streak') || '0');
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (last === today) return streak;
  if (last === yesterday) streak++;
  else streak = 1;
  localStorage.setItem('iq3_streak', streak);
  localStorage.setItem('iq3_last_day', today);
  return streak;
}
function getStreak() {
  return parseInt(localStorage.getItem('iq3_streak') || '0');
}

// ── TIMER ──
class ITimer {
  constructor(el, secs, onEnd) {
    this.el = el; this.total = secs; this.left = secs;
    this.onEnd = onEnd; this.iv = null;
  }
  start() {
    this.render();
    this.iv = setInterval(() => {
      this.left--;
      this.render();
      if (this.left <= 0) { this.stop(); this.onEnd && this.onEnd(); }
    }, 1000);
  }
  stop() { clearInterval(this.iv); this.iv = null; }
  render() {
    const m = String(Math.floor(this.left / 60)).padStart(2, '0');
    const s = String(this.left % 60).padStart(2, '0');
    this.el.textContent = `${m}:${s}`;
    this.el.style.color = this.left <= 10 ? 'var(--red)' : this.left <= 30 ? 'var(--amber)' : '';
  }
}

// ── TOAST ──
function toast(title, msg, type = 'i', duration = 3500) {
  const tc = document.querySelector('.tc');
  if (!tc) return;
  const icons = { s: 'fa-circle-check', e: 'fa-circle-xmark', w: 'fa-triangle-exclamation', i: 'fa-circle-info' };
  const colors = { s: 'var(--green)', e: 'var(--red)', w: 'var(--amber)', i: 'var(--violet-bright)' };
  const t = document.createElement('div');
  t.className = 'toast toast-in';
  t.innerHTML = `
    <div class="toast-ic" style="color:${colors[type]}"><i class="fa-solid ${icons[type]}"></i></div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button class="toast-x" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.replace('toast-in', 'toast-out'); setTimeout(() => t.remove(), 400); }, duration);
}

// ── TYPING ANIMATION ──
function typeText(el, text, speed = 15) {
  el.textContent = '';
  let i = 0;
  const iv = setInterval(() => {
    if (i < text.length) { el.textContent += text[i++]; }
    else clearInterval(iv);
  }, speed);
}

// ── EVAL ANSWER FALLBACK ──
async function evalAnswer(question, answer, cfg) {
  await new Promise(r => setTimeout(r, 800));
  const score = Math.floor(Math.random() * 4) + 5;
  return {
    score, feedback: 'Answer submitted. Backend evaluates with Groq AI.',
    strengths: ['Answer submitted'], improvements: ['Backend AI evaluation active'],
    betterAnswer: '', skills: { accuracy: score, clarity: score, completeness: score }
  };
}

// ── INTERVIEW MODE CHOOSER ──
function showInterviewChoice(category = null) {
  const existing = document.getElementById('iv-choice-modal');
  if (existing) existing.remove();
  document.getElementById('ivc-styles')?.remove();

  const modal = document.createElement('div');
  modal.id = 'iv-choice-modal';
  modal.innerHTML = `
    <div class="ivc-bg" onclick="closeInterviewChoice()">
      <div class="ivc-card" onclick="event.stopPropagation()">
        <div class="ivc-title">Choose Interview Mode</div>
        <div class="ivc-sub">How do you want to practice today?</div>
        <div class="ivc-opts">
          <a href="interview.html${category ? '?cat=' + category : ''}" class="ivc-opt ivc-text">
            <div class="ivc-opt-ic"><svg class="ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="1"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9.5 14h5"/></svg></div>
            <div class="ivc-opt-name">Text Interview</div>
            <div class="ivc-opt-desc">Type or speak your answers · 5–50 questions · Every answer scored</div>
            <div class="ivc-opt-tags">
              <span>Fast</span>
              <span>Voice input</span>
              <span>Analytics</span>
            </div>
          </a>
          <a href="video-interview.html${category ? '?cat=' + category : ''}" class="ivc-opt ivc-video">
            <div class="ivc-opt-ic"><svg class="ico" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="1"/><path d="M15.5 10.5 21.5 7v10l-6-3.5z"/><circle cx="9" cy="12" r="2.2"/></svg></div>
            <div class="ivc-opt-name">Video Interview</div>
            <div class="ivc-opt-desc">Camera on · Questions read aloud · Answer by voice · Filler detection</div>
            <div class="ivc-opt-tags">
              <span>Camera</span>
              <span>Voice</span>
              <span>New</span>
            </div>
          </a>
        </div>
        <button class="ivc-cancel" onclick="closeInterviewChoice()">
          <i class="fa-solid fa-xmark"></i> Cancel
        </button>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.id = 'ivc-styles';
  style.textContent = `
    .ivc-bg{position:fixed;inset:0;background:rgba(8,9,13,.88);z-index:99990;display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .2s ease}
    .ivc-card{background:#111;border:1px solid rgba(233,236,244,.16);border-top:3px solid #F59E0B;padding:2rem;max-width:600px;width:100%;animation:scIn .35s cubic-bezier(.16,1,.3,1)}
    .ivc-title{font-family:'Space Grotesk',sans-serif;font-size:2.4rem;font-weight:400;text-transform:uppercase;margin-bottom:.3rem;color:#E9ECF4;line-height:1}
    .ivc-sub{color:rgba(233,236,244,.58);font-size:.9rem;margin-bottom:1.6rem}
    .ivc-opts{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(233,236,244,.16);border:1px solid rgba(233,236,244,.16);margin-bottom:1rem}
    .ivc-opt{background:#0B0C11;padding:1.5rem 1.2rem;text-align:left;text-decoration:none;color:#E9ECF4;transition:background .25s;display:flex;flex-direction:column;align-items:flex-start;gap:.5rem;position:relative}
    .ivc-opt::after{content:'';position:absolute;left:0;bottom:0;height:3px;width:100%;background:#F59E0B;transform:scaleX(0);transform-origin:left;transition:transform .45s cubic-bezier(.16,1,.3,1)}
    .ivc-opt:hover{background:#151822}
    .ivc-opt:hover::after{transform:scaleX(1)}
    .ivc-opt-ic{font-family:'JetBrains Mono',monospace;font-size:.72rem;font-weight:700;letter-spacing:.16em;color:#F59E0B;margin-bottom:1.2rem}
    .ivc-opt-name{font-family:'Inter',sans-serif;text-transform:uppercase;font-size:1.35rem;font-weight:800;line-height:1}
    .ivc-opt-desc{font-size:.8rem;color:rgba(233,236,244,.58);line-height:1.6}
    .ivc-opt-tags{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem}
    .ivc-opt-tags span{border:1px solid rgba(233,236,244,.2);padding:2px 7px;font-family:'JetBrains Mono',monospace;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(233,236,244,.6)}
    .ivc-cancel{width:100%;background:none;border:1px solid rgba(233,236,244,.16);padding:11px;color:rgba(233,236,244,.58);font-family:'JetBrains Mono',monospace;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:border-color .2s,color .2s;display:flex;align-items:center;justify-content:center;gap:6px}
    .ivc-cancel:hover{border-color:#F59E0B;color:#F59E0B}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes scIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:520px){.ivc-opts{grid-template-columns:1fr}}

  `;
  document.head.appendChild(style);
  document.body.appendChild(modal);

  // Close on Escape
  const escHandler = (e) => { if (e.key === 'Escape') { closeInterviewChoice(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

function closeInterviewChoice() {
  document.getElementById('iv-choice-modal')?.remove();
  document.getElementById('ivc-styles')?.remove();
}

// ── SMOOTH PAGE LOAD ──
document.addEventListener('DOMContentLoaded', () => {
  
  // Stagger animations
  document.querySelectorAll('.stag > *').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = `opacity 0.4s ease ${i * 0.07}s, transform 0.4s ease ${i * 0.07}s`;
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 50 + i * 70);
  });
});

/* Profile photo: kept in this browser only (localStorage), resized to 256px. */
window.IQAvatar = (function () {
  function key() { try { var u = JSON.parse(localStorage.getItem('iq3_user') || '{}'); return 'iq3_avatar_' + (u.email || u.id || 'me'); } catch (e) { return 'iq3_avatar_me'; } }
  function get() { try { return localStorage.getItem(key()) || ''; } catch (e) { return ''; } }
  function apply() {
    var url = get();
    document.querySelectorAll('.nav-av,.av').forEach(function (el) {
      if (url) {
        el.style.setProperty('background-image', 'url("' + url + '")', 'important');
        el.style.setProperty('background-size', 'cover', 'important');
        el.style.setProperty('background-position', 'center', 'important');
      } else {
        el.style.removeProperty('background-image'); el.style.removeProperty('background-size'); el.style.removeProperty('background-position');
      }
    });
  }
  function set(file) {
    return new Promise(function (res, rej) {
      if (!file || !/^image\//.test(file.type)) return rej(new Error('Please choose an image file.'));
      var img = new Image(), r = new FileReader();
      r.onerror = function () { rej(new Error('Could not read that file.')); };
      r.onload = function () {
        img.onerror = function () { rej(new Error('Could not open that image.')); };
        img.onload = function () {
          var n = 256, c = document.createElement('canvas'); c.width = c.height = n;
          var m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
          c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, n, n);
          try { localStorage.setItem(key(), c.toDataURL('image/jpeg', 0.86)); } catch (e) { return rej(new Error('Not enough browser storage for the photo.')); }
          apply(); res();
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }
  function clear() { try { localStorage.removeItem(key()); } catch (e) {} apply(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
  return { apply: apply, set: set, clear: clear, has: function () { return !!get(); } };
})();
