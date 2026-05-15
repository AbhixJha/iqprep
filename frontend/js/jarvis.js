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
    return `Good ${time}${name ? ', ' + name : ''}! 👋 I'm iqAI, your AI interview coach. Ask me anything or tap the mic to speak!\n\nTip: Say "Interview me on Java" or "Evaluate my code" to start! 🎯`;
  },

  render() {
    const el = document.createElement('div');
    el.id = 'jarvis-root';
    el.innerHTML = `
      <button class="jarvis-btn" id="jarvis-btn" onclick="JARVIS.toggle()">
        <div class="jarvis-btn-inner">
          <i class="fa-solid fa-robot" id="jarvis-icon"></i>
          <div class="jarvis-pulse"></div>
        </div>
        <div class="jarvis-tooltip">Ask iqAI</div>
      </button>

      <div class="jarvis-panel" id="jarvis-panel">
        <div class="jarvis-header">
          <div class="jarvis-header-left">
            <div class="jarvis-avatar">
              <i class="fa-solid fa-robot"></i>
              <div class="jarvis-online"></div>
            </div>
            <div>
              <div class="jarvis-name" id="jarvis-name-display">iqAI</div>
              <div class="jarvis-status" id="jarvis-status">AI Interview Coach · Online</div>
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
          <button onclick="JARVIS.exitInterviewMode()" style="background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:.7rem;margin-left:auto">Exit ✕</button>
        </div>

        <div class="jarvis-messages" id="jarvis-messages"></div>

        <div class="jarvis-suggestions" id="jarvis-suggestions">
          <button class="jarvis-chip" onclick="JARVIS.quickSend('How do I answer tell me about yourself?')">Tell me about yourself</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Give me tips for technical interviews')">Technical tips</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Interview me on Java')">🎯 Java Interview</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Interview me on HR questions')">🤝 HR Interview</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Can you evaluate my code?')">💻 Evaluate Code</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('How to improve my interview score?')">Improve score</button>
          <button class="jarvis-chip" onclick="JARVIS.quickSend('Explain the STAR method')">STAR method</button>
        </div>

        <div class="jarvis-wave" id="jarvis-wave" style="display:none">
          <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
          <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <span class="wave-label">iqAI is speaking...</span>
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
    document.getElementById('jarvis-name-display').textContent = 'iqAI — Interviewer';
    document.getElementById('jarvis-mode-btn').style.color = 'var(--violet-bright)';
    toast('Interview Mode ON', `iqAI will now interview you on: ${topic}`, 'i', 3000);
  },

  exitInterviewMode() {
    this.mode = 'coach';
    this.interviewTopic = '';
    document.getElementById('jarvis-mode-banner').style.display = 'none';
    document.getElementById('jarvis-name-display').textContent = 'iqAI';
    document.getElementById('jarvis-mode-btn').style.color = '';
    this.addMessage('jarvis', "Interview mode ended. I'm back to coach mode! Ask me anything. 😊");
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
        <div class="jarvis-msg-av"><i class="fa-solid fa-robot"></i></div>
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
      <div class="jarvis-msg-av"><i class="fa-solid fa-robot"></i></div>
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
      this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'AI Interview Coach · Online';
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

      const res = await fetch('http://localhost:8080/api/jarvis/chat', {
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
      return "I'm having connectivity issues. Make sure backend is running! 🔧";
    }
  },

  toggleSpeech() {
    this.voiceEnabled = !this.voiceEnabled;
    const btn = document.getElementById('jarvis-speak-toggle');
    if (this.voiceEnabled) {
      btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      btn.style.color = '';
      toast('Voice ON', 'iqAI will speak responses', 's', 2000);
    } else {
      btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
      btn.style.color = 'var(--red)';
      this.stopSpeech();
      toast('Voice OFF', 'iqAI will only show text', 'w', 2000);
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
      document.getElementById('jarvis-status').textContent = '🔊 Speaking...';
    };
    utt.onend = () => {
      this.isSpeaking = false;
      const wave = document.getElementById('jarvis-wave');
      if (wave) wave.style.display = 'none';
      document.getElementById('jarvis-status').textContent =
        this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'AI Interview Coach · Online';
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
      this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'AI Interview Coach · Online';
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
          document.getElementById('jarvis-status').textContent = '🎤 Listening... speak now!';
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
      this.mode === 'interviewer' ? `Interview Mode: ${this.interviewTopic}` : 'AI Interview Coach · Online';
  },

  clearChat() {
    document.getElementById('jarvis-messages').innerHTML = '';
    document.getElementById('jarvis-suggestions').style.display = 'flex';
    this.history = [];
    this.mode = 'coach';
    this.interviewTopic = '';
    document.getElementById('jarvis-mode-banner').style.display = 'none';
    document.getElementById('jarvis-name-display').textContent = 'iqAI';
    this.stopSpeech();
    this.addMessage('jarvis', this.getGreeting());
  }
};

// ── STYLES ──
const jarvisStyles = document.createElement('style');
jarvisStyles.textContent = `
#jarvis-root{position:fixed;bottom:1.5rem;left:1.5rem;z-index:9998;font-family:'Satoshi',sans-serif}
.jarvis-btn{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#7c5cfc,#f472b6);border:none;cursor:pointer;position:relative;box-shadow:0 8px 32px rgba(124,92,252,.4);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.3s ease}
.jarvis-btn:hover{transform:scale(1.1);box-shadow:0 12px 40px rgba(124,92,252,.5)}
.jarvis-btn.active{transform:scale(0.95)}
.jarvis-btn-inner{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:white;font-size:1.3rem}
.jarvis-pulse{position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(124,92,252,.4);animation:jPulse 2s ease infinite}
@keyframes jPulse{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.15);opacity:0}}
.jarvis-tooltip{position:absolute;left:110%;top:50%;transform:translateY(-50%);background:rgba(10,11,20,.95);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:4px 10px;font-size:.72rem;font-weight:600;color:white;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.2s ease}
.jarvis-btn:hover .jarvis-tooltip{opacity:1}
.jarvis-panel{position:fixed;bottom:90px;left:1.5rem;width:380px;height:560px;background:#0d0e1a;border:1px solid rgba(124,92,252,.25);border-radius:20px;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04);transform:scale(0.9) translateY(20px);transform-origin:bottom left;opacity:0;pointer-events:none;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);overflow:hidden}
.jarvis-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all}
.jarvis-header{display:flex;align-items:center;justify-content:space-between;padding:.9rem 1rem;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(124,92,252,.06)}
.jarvis-header-left{display:flex;align-items:center;gap:.75rem}
.jarvis-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#7c5cfc,#f472b6);display:flex;align-items:center;justify-content:center;color:white;font-size:.9rem;position:relative}
.jarvis-online{position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#34d399;border:2px solid #0d0e1a}
.jarvis-name{font-size:.88rem;font-weight:800;color:white;letter-spacing:-.01em}
.jarvis-status{font-size:.65rem;color:rgba(255,255,255,.4);margin-top:1px;transition:all .3s}
.jarvis-header-right{display:flex;gap:.35rem}
.jarvis-hbtn{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.5);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.72rem;transition:all 0.2s ease}
.jarvis-hbtn:hover{background:rgba(255,255,255,.1);color:white}
.jarvis-mode-banner{display:flex;align-items:center;gap:.5rem;padding:.5rem .85rem;background:rgba(124,92,252,.15);border-bottom:1px solid rgba(124,92,252,.2);font-size:.72rem;color:var(--violet-bright);font-weight:600}
.jarvis-messages{flex:1;overflow-y:auto;padding:.85rem;display:flex;flex-direction:column;gap:.65rem;scroll-behavior:smooth}
.jarvis-messages::-webkit-scrollbar{width:3px}
.jarvis-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.jarvis-msg{display:flex;gap:.5rem;align-items:flex-end}
.jarvis-msg-jarvis{align-self:flex-start}
.jarvis-msg-user{flex-direction:row-reverse;align-self:flex-end}
.jarvis-msg-av{width:26px;height:26px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#7c5cfc,#f472b6);display:flex;align-items:center;justify-content:center;color:white;font-size:.6rem}
.jarvis-msg-bubble{max-width:270px;padding:.6rem .85rem;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);border-radius:16px 16px 16px 4px;font-size:.8rem;color:rgba(255,255,255,.9);line-height:1.65;animation:msgIn 0.3s ease}
.jarvis-msg-user-bubble{background:linear-gradient(135deg,rgba(124,92,252,.3),rgba(244,114,182,.2));border-color:rgba(124,92,252,.3);border-radius:16px 16px 4px 16px;color:white}
@keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.jarvis-typing-bubble{display:flex;gap:4px;align-items:center;padding:.7rem .85rem}
.jarvis-typing-bubble span{width:6px;height:6px;border-radius:50%;background:rgba(124,92,252,.7);animation:typingDot 1.2s ease infinite}
.jarvis-typing-bubble span:nth-child(2){animation-delay:.2s}
.jarvis-typing-bubble span:nth-child(3){animation-delay:.4s}
@keyframes typingDot{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-4px);opacity:1}}
.jarvis-wave{display:flex;align-items:center;gap:3px;padding:.5rem .85rem;background:rgba(124,92,252,.08);border-top:1px solid rgba(124,92,252,.15)}
.wave-bar{width:3px;border-radius:2px;background:linear-gradient(180deg,#7c5cfc,#f472b6);animation:waveBar 0.8s ease infinite}
.wave-bar:nth-child(1){height:8px;animation-delay:0s}
.wave-bar:nth-child(2){height:14px;animation-delay:.1s}
.wave-bar:nth-child(3){height:18px;animation-delay:.2s}
.wave-bar:nth-child(4){height:22px;animation-delay:.15s}
.wave-bar:nth-child(5){height:18px;animation-delay:.25s}
.wave-bar:nth-child(6){height:12px;animation-delay:.1s}
.wave-bar:nth-child(7){height:6px;animation-delay:.05s}
@keyframes waveBar{0%,100%{transform:scaleY(.5);opacity:.7}50%{transform:scaleY(1.2);opacity:1}}
.wave-label{font-size:.65rem;color:rgba(124,92,252,.8);margin-left:.35rem;flex:1}
.wave-stop{background:rgba(244,63,94,.15);border:1px solid rgba(244,63,94,.25);border-radius:6px;padding:2px 8px;font-size:.65rem;color:#f87171;cursor:pointer;white-space:nowrap;font-family:inherit}
.wave-stop:hover{background:rgba(244,63,94,.25)}
.jarvis-suggestions{display:flex;gap:.35rem;padding:.5rem .85rem;overflow-x:auto;flex-wrap:nowrap;border-top:1px solid rgba(255,255,255,.05)}
.jarvis-suggestions::-webkit-scrollbar{display:none}
.jarvis-chip{background:rgba(124,92,252,.12);border:1px solid rgba(124,92,252,.25);border-radius:20px;padding:4px 10px;font-size:.68rem;font-weight:600;color:rgba(157,127,255,.9);cursor:pointer;white-space:nowrap;transition:all 0.2s ease;font-family:inherit}
.jarvis-chip:hover{background:rgba(124,92,252,.25);color:white}
.jarvis-input-row{display:flex;align-items:center;gap:.5rem;padding:.75rem;border-top:1px solid rgba(255,255,255,.06)}
.jarvis-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 12px;font-size:.8rem;color:white;font-family:inherit;outline:none;transition:border-color 0.2s ease}
.jarvis-input:focus{border-color:rgba(124,92,252,.5)}
.jarvis-input::placeholder{color:rgba(255,255,255,.3)}
.jarvis-mic,.jarvis-send{width:36px;height:36px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.82rem;transition:all 0.2s ease;flex-shrink:0}
.jarvis-mic{background:rgba(255,255,255,.07);color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.1)}
.jarvis-mic:hover{background:rgba(255,255,255,.12);color:white}
.jarvis-mic.listening{background:rgba(244,63,94,.2);color:#f87171;border-color:rgba(244,63,94,.4);animation:micPulse 1s ease infinite}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(244,63,94,.4)}50%{box-shadow:0 0 0 8px rgba(244,63,94,0)}}
.jarvis-send{background:linear-gradient(135deg,#7c5cfc,#f472b6);color:white}
.jarvis-send:hover{transform:scale(1.08);box-shadow:0 4px 16px rgba(124,92,252,.4)}
@media(max-width:480px){.jarvis-panel{width:calc(100vw - 2rem);left:1rem}#jarvis-root{bottom:1rem;left:1rem}}
`;
document.head.appendChild(jarvisStyles);

document.addEventListener('DOMContentLoaded', () => JARVIS.init());
