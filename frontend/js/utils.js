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
  if (s >= 9) return '#34d399';
  if (s >= 7) return '#60a5fa';
  if (s >= 5) return '#fbbf24';
  if (s >= 3) return '#f97316';
  return '#f87171';
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
  if (s >= 9) return '🏆';
  if (s >= 7) return '⭐';
  if (s >= 5) return '📈';
  if (s >= 3) return '💪';
  return '📚';
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
            <div class="ivc-opt-ic">⌨️</div>
            <div class="ivc-opt-name">Text Interview</div>
            <div class="ivc-opt-desc">Type or speak your answers · 5–50 questions · Real AI evaluation</div>
            <div class="ivc-opt-tags">
              <span>⚡ Fast</span>
              <span>🎤 Voice input</span>
              <span>📊 Analytics</span>
            </div>
          </a>
          <a href="video-interview.html${category ? '?cat=' + category : ''}" class="ivc-opt ivc-video">
            <div class="ivc-opt-ic">🎥</div>
            <div class="ivc-opt-name">Video Interview</div>
            <div class="ivc-opt-desc">Camera on · AI speaks questions · Answer by voice · Filler detection</div>
            <div class="ivc-opt-tags">
              <span>📹 Camera</span>
              <span>🔊 AI Voice</span>
              <span>🆕 New</span>
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
    .ivc-bg{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(12px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .2s ease}
    .ivc-card{background:#0d0e1a;border:1px solid rgba(124,92,252,.3);border-radius:22px;padding:2rem;max-width:540px;width:100%;animation:scIn .35s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 30px 80px rgba(0,0,0,.6)}
    .ivc-title{font-family:'Cabinet Grotesk',sans-serif;font-size:1.5rem;font-weight:900;text-align:center;margin-bottom:.3rem;color:white;letter-spacing:-.025em}
    .ivc-sub{text-align:center;color:rgba(255,255,255,.4);font-size:.8rem;margin-bottom:1.5rem}
    .ivc-opts{display:grid;grid-template-columns:1fr 1fr;gap:.85rem;margin-bottom:1rem}
    .ivc-opt{background:rgba(255,255,255,.04);border:2px solid rgba(255,255,255,.08);border-radius:16px;padding:1.4rem 1.1rem;text-align:center;text-decoration:none;color:white;transition:all .25s cubic-bezier(0.34,1.56,0.64,1);display:flex;flex-direction:column;align-items:center;gap:.45rem}
    .ivc-text:hover{border-color:rgba(124,92,252,.6);background:rgba(124,92,252,.1);transform:translateY(-4px);box-shadow:0 12px 32px rgba(124,92,252,.15)}
    .ivc-video:hover{border-color:rgba(244,114,182,.6);background:rgba(244,114,182,.1);transform:translateY(-4px);box-shadow:0 12px 32px rgba(244,114,182,.15)}
    .ivc-opt-ic{font-size:2.5rem;margin-bottom:.2rem}
    .ivc-opt-name{font-family:'Cabinet Grotesk',sans-serif;font-size:1rem;font-weight:800;letter-spacing:-.015em}
    .ivc-opt-desc{font-size:.71rem;color:rgba(255,255,255,.4);line-height:1.6}
    .ivc-opt-tags{display:flex;gap:.3rem;justify-content:center;flex-wrap:wrap;margin-top:.3rem}
    .ivc-opt-tags span{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:2px 8px;font-size:.62rem;color:rgba(255,255,255,.55)}
    .ivc-cancel{width:100%;background:none;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:9px;color:rgba(255,255,255,.3);font-size:.78rem;cursor:pointer;transition:.2s;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px}
    .ivc-cancel:hover{border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.6)}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes scIn{from{opacity:0;transform:scale(.85) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @media(max-width:480px){.ivc-opts{grid-template-columns:1fr}}
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
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.3s ease';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
    });
  });
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