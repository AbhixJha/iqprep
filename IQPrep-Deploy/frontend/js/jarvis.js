// ═══════════════════════════════════════
// JARVIS.JS — AI Voice Interview Coach
// ═══════════════════════════════════════

const JARVIS = {
  isOpen: false,
  isSpeaking: false,
  isListening: false,
  recognition: null,
  synth: window.speechSynthesis,
  voices: [],
  history: [],
  voiceEnabled: true,
  mode: 'coach', // 'coach' or 'interviewer'
  interviewTopic: '',
  waitTime: 2000, // ms to wait before responding

  init() {
    this.render();
    this.loadVoices();
    setTimeout(() => {
      this.addMessage('jarvis', this.getGreeting());
    }, 600);
  },

  loadVoices() {
    const load = () => { this.voices = this.synth.getVoices(); };
    load();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = load;
    }
  },

  getGreeting() {
    const user = S.get('iq3_user');
    const name = user?.firstName
      ? user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1)
      : '';
    const h = new Date().getHours();
    const time = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    return `Good ${time}${name ? ', ' + name : ''}. I'm your interview coach. Ask a question or tap the mic to talk.\n\nTry: "Interview me on Java" or "Evaluate my code".`;
  },

  render() {
    const el = document.createElement('div');
    el.id = 'jarvis-root';
    el.innerHTML = `
      <button class="jarvis-btn" id="jarvis-btn" onclick="JARVIS.toggle()">
        <div class="jarvis-btn-inner">
          <span class="jv-lbl" id="jarvis-icon"><svg class="ico" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M4 5h16v11H11l-5 4v-4H4z"/><path d="M8 10.5v1M12 8.5v5M16 10.5v1"/></svg></span>
          <div class="jarvis-pulse"></div>
        </div>
        <div class="jarvis-tooltip">Ask the coach</div>
      </button>

      <div class="jarvis-panel" id="jarvis-panel">
        <div class="jarvis-header">
          <div class="jarvis-header-left">
            <div class="jarvis-avatar">
              <svg class="ico" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V4.5M12 4.5h.01M9 13h.01M15 13h.01M9.5 16h5M2.5 13v2M21.5 13v2"/></svg>
              <div class="jarvis-online"></div>
            </div>
            <div>
              <div class="jarvis-name" id="jarvis-name-display">Coach</div>
              <div class="jarvis-status" id="jarvis-status">Interview coach</div>
            </div>
          </div>
          <div class="jarvis-header-right">
            <button class="jarvis-hbtn" id="jarvis-speak-toggle" onclick="JARVIS.toggleSpeech()" title="Toggle voice">
              <i class="fa-solid fa-volume-high"></i>
            </button>
            <button class="jarvis-hbtn" id="jarvis-mode-btn" onclick="JARVIS.toggleMode()" title="Switch mode">
              <i class="fa-solid fa-user-tie"></i>
            </button>
            <button class="jarvis-hbtn" onclick="JARVIS.clearChat()" title="Clear chat">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
            <button class="jarvis-hbtn" onclick="JARVIS.toggle()" title="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <!-- Mode Banner -->
        <div class="jarvis-mode-banner" id="jarvis-mode-banner" style="display:none">
          <i class="fa-solid fa-user-tie"></i>
          <span id="jarvis-mode-text">Interview Mode: Java</span>
          <button onclick="JARVIS.exitInterviewMode()" style="background:none;border:none;color:rgba(233,236,244,.6);cursor:pointer;font-size:.7rem;margin-left:auto">Exit</button>
        </div>

        <div class="jarvis-messages" id="jarvis-messages"></div>

        <div class="jarvis-suggestions" id="jarvis-suggestions">
          <button class="jarvis-chip" onclick="JARVIS.quickSend('How do I answer tell me about yourself?')">Tell me about yourself</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Give me tips for technical interviews')">Technical tips</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Interview me on Java')">Java Interview</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Interview me on HR questions')">HR Interview</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Can you evaluate my code?')">Evaluate Code</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('How to improve my interview score?')">Improve score</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Explain the STAR method')">STAR method</button>
        </div>

        <div class="jarvis-wave" id="jarvis-wave" style="display:none">
          <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
          <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <span class="wave-label">Coach is speaking...</span>
          <button class="wave-stop" onclick="JARVIS.stopSpeech()"><i class="fa-solid fa-stop"></i> Stop</button>
        </div>

        <div class="jarvis-input-row">
          <button class="jarvis-mic" id="jarvis-mic" onclick="JARVIS.toggleVoice()" title="Tap to speak">
            <i class="fa-solid fa-microphone" id="jarvis-mic-icon"></i>
          </button>
          <input
            type="text"
            id="jarvis-input"
            class="jarvis-input"
            placeholder="Ask me anything..."
            onkeydown="if(event.key==='Enter') JARVIS.send()"
            maxlength="500"
          />
          <button class="jarvis-send" onclick="JARVIS.send()">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('jarvis-panel');
      const btn = document.getElementById('jarvis-btn');
      if (this.isOpen && panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
        this.close();
      }
    });
  },

  toggle() { this.isOpen ? this.close() : this.open(); },

  open() {
    this.isOpen = true;
    document.getElementById('jarvis-panel').classList.add('open');
    document.getElementById('jarvis-btn').classList.add('active');
    setTimeout(() => document.getElementById('jarvis-input').focus(), 300);
    this.scrollToBottom();
  },

  close() {
    this.isOpen = false;
    document.getElementById('jarvis-panel').classList.remove('open');
    document.getElementById('jarvis-btn').classList.remove('active');
  },

  async send() {
    const input = document.getElementById('jarvis-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    document.getElementById('jarvis-suggestions').style.display = 'none';
    this.addMessage('user', msg);

    // Detect interview mode request
    const interviewMatch = msg.toLowerCase().match(/interview me (?:on|about)?\s*(.+)/);
    if (interviewMatch && this.mode !== 'interviewer') {
      this.interviewTopic = interviewMatch[1].trim();
      this.enterInterviewMode(this.interviewTopic);
    }

    // Add thinking delay before showing response
    await new Promise(r => setTimeout(r, this.waitTime));
    this.showTyping();

    const reply = await this.callJarvis(msg);
    this.hideTyping();
    this.addMessage('jarvis', reply);
    this.speak(reply);
  },

  quickSend(msg) {
    document.getElementById('jarvis-input').value = msg;
    this.send();
  },

  enterInterviewMode(topic) {
    this.mode = 'interviewer';
    this.interviewTopic = topic;
    document.getElementById('jarvis-mode-banner').style.display = 'flex';
    document.getElementById('jarvis-mode-text').textContent = `Interview Mode: ${topic}`;
    document.getElementById('jarvis-name-display').textContent = 'Coach — Interviewer';
    document.getElementById('jarvis-mode-btn').style.color = 'var(--violet-bright)';
    toast('Interview Mode ON', `Coach will now interview you on: ${topic}`, 'i', 3000);
  },

  exitInterviewMode() {
    this.mode = 'coach';
    this.interviewTopic = '';
    document.getElementById('jarvis-mode-banner').style.display = 'none';
    document.getElementById('jarvis-name-display').textContent = 'Coach';
    document.getElementById('jarvis-mode-btn').style.color = '';
    this.addMessage('jarvis', "Interview mode ended. Back to coaching. Ask me anything.");
    toast('Back to Coach Mode', 'Interview session ended', 'i', 2000);
  },

  toggleMode() {
    if (this.mode === 'interviewer') {
      this.exitInterviewMode();
    } else {
      this.addMessage('jarvis', "What topic should I interview you on? For example: Java, DSA, HR, System Design, Python, etc.");
    }
  },

  addMessage(role, text) {
    const container = document.getElementById('jarvis-messages');
    const div = document.createElement('div');
    div.className = `jarvis-msg jarvis-msg-${role}`;
    if (role === 'jarvis') {
      div.innerHTML = `
        <div class="jarvis-msg-av">IQ</div>
        <div class="jarvis-msg-bubble">${this.formatText(text)}</div>`;
    } else {
      div.innerHTML = `<div class="jarvis-msg-bubble jarvis-msg-user-bubble">${text}</div>`;
    }
    container.appendChild(div);
    this.scrollToBottom();
  },

  formatText(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/\n/g, '<br>');
    return text;
  },

  showTyping() {
    const container = document.getElementById('jarvis-messages');
    const div = document.createElement('div');
    div.className = 'jarvis-msg jarvis-msg-jarvis';
    div.id = 'jarvis-typing';
    div.innerHTML = `
      <div class="jarvis-msg-av">IQ</div>
      <div class="jarvis-msg-bubble jarvis-typing-bubble">
        <span></span><span></span><span></span>
      </div>`;
    container.appendChild(div);
    this.scrollToBottom();
    document.getElementById('jarvis-status').textContent = 'Thinking...';
  },

  hideTyping() {
    const t = document.getElementById('jarvis-typing');
    if (t) t.remove();
    document.getElementById('jarvis-status').textContent =
      this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'Interview coach';
  },

  scrollToBottom() {
    const c = document.getElementById('jarvis-messages');
    if (c) setTimeout(() => c.scrollTop = c.scrollHeight, 50);
  },

  async callJarvis(message) {
    try {
      const token = localStorage.getItem('iq3_token');
      const user = S.get('iq3_user');
      const context = user
        ? `Sessions: ${user.totalSessions || 0}, Avg Score: ${user.averageScore || 0}/10, Target Role: ${user.targetRole || 'Developer'}`
        : '';

      const base = (typeof window !== 'undefined' && window.IQPREP_API_BASE) || 'https://iqprep-backend.onrender.com/api';
      const res = await fetch(`${base}/jarvis/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          message,
          context,
          mode: this.mode,
          interviewTopic: this.interviewTopic
        })
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      return data.reply || 'Sorry, I could not respond. Try again!';
    } catch (err) {
      console.error('JARVIS error:', err);
      return "I can't reach the server right now. Try again in a moment.";
    }
  },

  toggleSpeech() {
    this.voiceEnabled = !this.voiceEnabled;
    const btn = document.getElementById('jarvis-speak-toggle');
    if (this.voiceEnabled) {
      btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      btn.style.color = '';
      toast('Voice ON', 'Coach will speak responses', 's', 2000);
    } else {
      btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
      btn.style.color = 'var(--red)';
      this.stopSpeech();
      toast('Voice OFF', 'Coach will only show text', 'w', 2000);
    }
  },

  speak(text) {
    if (!this.voiceEnabled || !this.synth) return;
    this.stopSpeech();
    const clean = text
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .trim();
    if (!clean) return;

    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 0.92;
    utt.pitch = 1.05;
    utt.volume = 1.0;
    utt.lang = 'en-US';

    const preferred =
      this.voices.find(v => v.name === 'Google US English') ||
      this.voices.find(v => v.name.includes('Google') && v.lang === 'en-US') ||
      this.voices.find(v => v.name.includes('Microsoft') && v.lang.startsWith('en')) ||
      this.voices.find(v => v.lang === 'en-US') ||
      this.voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;

    utt.onstart = () => {
      this.isSpeaking = true;
      const wave = document.getElementById('jarvis-wave');
      if (wave) wave.style.display = 'flex';
      document.getElementById('jarvis-status').textContent = 'Speaking...';
    };
    utt.onend = () => {
      this.isSpeaking = false;
      const wave = document.getElementById('jarvis-wave');
      if (wave) wave.style.display = 'none';
      document.getElementById('jarvis-status').textContent =
        this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'Interview coach';
    };
    utt.onerror = () => {
      this.isSpeaking = false;
      const wave = document.getElementById('jarvis-wave');
      if (wave) wave.style.display = 'none';
    };
    this.synth.speak(utt);
  },

  stopSpeech() {
    if (this.synth) this.synth.cancel();
    this.isSpeaking = false;
    const wave = document.getElementById('jarvis-wave');
    if (wave) wave.style.display = 'none';
    const status = document.getElementById('jarvis-status');
    if (status) status.textContent =
      this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'Interview coach';
  },

  toggleVoice() {
    if (this.isListening) {
      this.stopListening();
      return;
    }
    this.startListening();
  },

  startListening() {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          toast('Not Supported', 'Voice input needs Chrome browser!', 'e');
          return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          this.isListening = true;
          const mic = document.getElementById('jarvis-mic');
          const icon = document.getElementById('jarvis-mic-icon');
          if (mic) mic.classList.add('listening');
          if (icon) icon.className = 'fa-solid fa-stop';
          document.getElementById('jarvis-status').textContent = 'Listening... speak now!';
          document.getElementById('jarvis-input').placeholder = 'Listening...';
          this.stopSpeech(); // Stop speaking when listening
        };

        this.recognition.onresult = (e) => {
          const transcript = Array.from(e.results)
            .map(r => r[0].transcript)
            .join('');
          document.getElementById('jarvis-input').value = transcript;
          if (e.results[e.results.length - 1].isFinal) {
            this.stopListening();
            // Wait a bit before sending to avoid cutting off
            setTimeout(() => this.send(), 800);
          }
        };

        this.recognition.onerror = (e) => {
          console.error('Speech error:', e.error);
          this.stopListening();
          if (e.error === 'not-allowed') {
            toast('Mic Blocked!', 'Click lock icon → Allow Microphone → Refresh', 'e', 6000);
          } else if (e.error === 'no-speech') {
            toast('No speech', 'I did not hear anything. Try again!', 'w');
          } else if (e.error === 'network') {
            toast('Network Error', 'Open via Live Server: http://127.0.0.1:5500', 'e', 6000);
          } else {
            toast('Voice Error', e.error + ' — Try again!', 'e');
          }
        };

        this.recognition.onend = () => {
          this.stopListening();
        };

        this.stopSpeech();
        this.recognition.start();
      })
      .catch(() => {
        toast('Mic Blocked!', 'Allow microphone in browser settings then refresh!', 'e', 6000);
      });
  },

  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
      this.recognition = null;
    }
    const mic = document.getElementById('jarvis-mic');
    const icon = document.getElementById('jarvis-mic-icon');
    if (mic) mic.classList.remove('listening');
    if (icon) icon.className = 'fa-solid fa-microphone';
    const input = document.getElementById('jarvis-input');
    if (input) input.placeholder = 'Ask me anything...';
    const status = document.getElementById('jarvis-status');
    if (status) status.textContent =
      this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'Interview coach';
  },

  clearChat() {
    document.getElementById('jarvis-messages').innerHTML = '';
    document.getElementById('jarvis-suggestions').style.display = 'flex';
    this.history = [];
    this.mode = 'coach';
    this.interviewTopic = '';
    document.getElementById('jarvis-mode-banner').style.display = 'none';
    document.getElementById('jarvis-name-display').textContent = 'Coach';
    this.stopSpeech();
    this.addMessage('jarvis', this.getGreeting());
  }
};

// ── STYLES ──
const jarvisStyles = document.createElement('style');
jarvisStyles.textContent = `
#jarvis-root{position:fixed;bottom:1.5rem;left:1.5rem;z-index:9998;font-family:'Inter',sans-serif}
.jarvis-btn{width:64px;height:64px;background:#F59E0B;border:none;cursor:pointer;position:relative;clip-path:polygon(0 0,100% 0,100% 72%,72% 100%,0 100%);transition:background .25s,transform .35s cubic-bezier(.16,1,.3,1)}
.jarvis-btn:hover{background:#E9ECF4;transform:translateY(-3px)}
.jarvis-btn.active{background:#E9ECF4}
.jarvis-btn-inner{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#08090D}
.jv-lbl{font-family:'Space Grotesk',sans-serif;font-size:1.25rem;letter-spacing:.06em}
.jarvis-pulse{display:none}
.jarvis-tooltip{position:absolute;left:115%;top:50%;transform:translateY(-50%);background:#111;border:1px solid rgba(233,236,244,.16);padding:5px 10px;font-family:'JetBrains Mono',monospace;font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:#E9ECF4;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s}
.jarvis-btn:hover .jarvis-tooltip{opacity:1}
.jarvis-panel{position:fixed;bottom:100px;left:1.5rem;width:390px;height:570px;background:#0B0C11;border:1px solid rgba(233,236,244,.16);border-top:3px solid #F59E0B;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(0,0,0,.8);transform:translateY(24px);opacity:0;pointer-events:none;transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .3s;overflow:hidden}
.jarvis-panel.open{transform:translateY(0);opacity:1;pointer-events:all}
.jarvis-header{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;border-bottom:1px solid rgba(233,236,244,.12);background:#111}
.jarvis-header-left{display:flex;align-items:center;gap:.75rem}
.jarvis-avatar{width:34px;height:34px;background:#F59E0B;display:flex;align-items:center;justify-content:center;color:#08090D;font-family:'Space Grotesk',sans-serif;font-size:.95rem;position:relative}
.jarvis-online{position:absolute;bottom:-3px;right:-3px;width:9px;height:9px;background:#10B981;border:2px solid #111}
.jarvis-name{font-family:'Inter',sans-serif;text-transform:uppercase;font-size:1rem;font-weight:800;color:#E9ECF4}
.jarvis-status{font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(233,236,244,.5);margin-top:2px}
.jarvis-header-right{display:flex;gap:.3rem}
.jarvis-hbtn{width:28px;height:28px;background:none;border:1px solid rgba(233,236,244,.14);color:rgba(233,236,244,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.72rem;transition:border-color .2s,color .2s}
.jarvis-hbtn:hover{border-color:#F59E0B;color:#F59E0B}
.jarvis-mode-banner{display:flex;align-items:center;gap:.5rem;padding:.5rem .9rem;background:rgba(245,158,11,.12);border-bottom:1px solid rgba(245,158,11,.3);font-family:'JetBrains Mono',monospace;font-size:.66rem;letter-spacing:.08em;text-transform:uppercase;color:#FBBF24}
.jarvis-messages{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.7rem;scroll-behavior:smooth}
.jarvis-messages::-webkit-scrollbar{width:4px}
.jarvis-messages::-webkit-scrollbar-thumb{background:#262626}
.jarvis-msg{display:flex;gap:.5rem;align-items:flex-end}
.jarvis-msg-jarvis{align-self:flex-start}
.jarvis-msg-user{flex-direction:row-reverse;align-self:flex-end}
.jarvis-msg-av{width:24px;height:24px;flex-shrink:0;background:#E9ECF4;display:flex;align-items:center;justify-content:center;color:#08090D;font-family:'Space Grotesk',sans-serif;font-size:.62rem}
.jarvis-msg-bubble{max-width:275px;padding:.65rem .85rem;background:#151822;border:1px solid rgba(233,236,244,.1);font-size:.84rem;color:rgba(233,236,244,.92);line-height:1.6;animation:msgIn .3s ease}
.jarvis-msg-user-bubble{background:#F59E0B;border-color:#F59E0B;color:#08090D;font-weight:500}
@keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.jarvis-typing-bubble{display:flex;gap:4px;align-items:center;padding:.75rem .9rem}
.jarvis-typing-bubble span{width:6px;height:6px;background:#F59E0B;animation:typingDot 1.1s ease infinite}
.jarvis-typing-bubble span:nth-child(2){animation-delay:.18s}
.jarvis-typing-bubble span:nth-child(3){animation-delay:.36s}
@keyframes typingDot{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-4px);opacity:1}}
.jarvis-wave{display:flex;align-items:center;gap:3px;padding:.55rem .9rem;background:#111;border-top:1px solid rgba(233,236,244,.12)}
.wave-bar{width:3px;background:#F59E0B;animation:waveBar .8s ease infinite}
.wave-bar:nth-child(1){height:8px;animation-delay:0s}
.wave-bar:nth-child(2){height:14px;animation-delay:.1s}
.wave-bar:nth-child(3){height:18px;animation-delay:.2s}
.wave-bar:nth-child(4){height:22px;animation-delay:.15s}
.wave-bar:nth-child(5){height:18px;animation-delay:.25s}
.wave-bar:nth-child(6){height:12px;animation-delay:.1s}
.wave-bar:nth-child(7){height:6px;animation-delay:.05s}
@keyframes waveBar{0%,100%{transform:scaleY(.5);opacity:.7}50%{transform:scaleY(1.2);opacity:1}}
.wave-label{font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(233,236,244,.7);margin-left:.5rem;flex:1}
.wave-stop{background:none;border:1px solid #F43F5E;padding:2px 8px;font-family:'JetBrains Mono',monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:#F43F5E;cursor:pointer;white-space:nowrap}
.wave-stop:hover{background:rgba(244,63,94,.15)}
.jarvis-suggestions{display:flex;gap:.4rem;padding:.55rem .9rem;overflow-x:auto;flex-wrap:nowrap;border-top:1px solid rgba(233,236,244,.1)}
.jarvis-suggestions::-webkit-scrollbar{display:none}
.jarvis-chip{background:none;border:1px solid rgba(233,236,244,.2);padding:5px 10px;font-family:'JetBrains Mono',monospace;font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:rgba(233,236,244,.75);cursor:pointer;white-space:nowrap;transition:border-color .2s,color .2s,background .2s}
.jarvis-chip:hover{border-color:#F59E0B;color:#F59E0B;background:rgba(245,158,11,.08)}
.jarvis-input-row{display:flex;align-items:center;gap:.5rem;padding:.75rem;border-top:1px solid rgba(233,236,244,.12);background:#111}
.jarvis-input{flex:1;background:#0B0C11;border:1px solid rgba(233,236,244,.16);padding:10px 12px;font-size:.86rem;color:#E9ECF4;font-family:inherit;outline:none;transition:border-color .2s}
.jarvis-input:focus{border-color:#F59E0B}
.jarvis-input::placeholder{color:rgba(233,236,244,.35)}
.jarvis-mic,.jarvis-send{width:38px;height:38px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.82rem;transition:background .2s,color .2s;flex-shrink:0}
.jarvis-mic{background:none;color:rgba(233,236,244,.6);border:1px solid rgba(233,236,244,.16)}
.jarvis-mic:hover{border-color:#F59E0B;color:#F59E0B}
.jarvis-mic.listening{background:rgba(244,63,94,.18);color:#F43F5E;border-color:#F43F5E;animation:micPulse 1s steps(2) infinite}
@keyframes micPulse{50%{background:rgba(244,63,94,.05)}}
.jarvis-send{background:#F59E0B;color:#08090D}
.jarvis-send:hover{background:#E9ECF4}
@media(max-width:480px){.jarvis-panel{width:calc(100vw - 2rem);left:1rem}#jarvis-root{bottom:1rem;left:1rem}}

`;
document.head.appendChild(jarvisStyles);

document.addEventListener('DOMContentLoaded', () => JARVIS.init());
