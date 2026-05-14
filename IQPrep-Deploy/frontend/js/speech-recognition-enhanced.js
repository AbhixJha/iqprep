/**
 * Web Speech API wrapper: multi-alternative scoring, soft-speech friendly restarts,
 * hesitation gap callbacks, optional mic RMS meter, and optional processed mic stream.
 */
(function (global) {
  'use strict';

  function pickBestAlternative(result) {
    let bestText = '';
    let bestConf = -1;
    for (let j = 0; j < result.length; j++) {
      const alt = result[j];
      const c = typeof alt.confidence === 'number' && !Number.isNaN(alt.confidence) ? alt.confidence : 0.45;
      const t = (alt.transcript || '').trim();
      if (!t) continue;
      if (c > bestConf || (c === bestConf && t.length > bestText.length)) {
        bestConf = c;
        bestText = alt.transcript || '';
      }
    }
    if (bestText) return bestText;
    const first = result[0];
    return first && first.transcript ? first.transcript : '';
  }

  function mergeFinals(prev, chunk) {
    const a = (prev || '').trimEnd();
    const b = (chunk || '').trim();
    if (!b) return a;
    if (!a) return b;
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    if (bl.startsWith(al)) return b;
    if (al.endsWith(bl.slice(0, Math.min(bl.length, 18)))) return a + b.slice(Math.min(bl.length, 18));
    return a + ' ' + b;
  }

  /**
   * @param {object} opts
   * @param {string} [opts.lang]
   * @param {(final: string, interim: string) => void} opts.onTranscript
   * @param {(gapMs: number) => void} [opts.onLongPause]
   * @param {(wpm: number) => void} [opts.onWpm]
   * @param {() => void} [opts.onStart]
   * @param {(err: string) => void} [opts.onError]
   * @param {() => void} [opts.onEnd]
   * @param {MediaStream} [opts.primeAudioStream] — stream with echoCancellation / AGC; keeps engine warm (tracks not consumed by STT but improves OS DSP path on some setups)
   */
  global.createEnhancedRecognition = function createEnhancedRecognition(opts) {
    const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!SR) return null;

    let rec = null;
    let active = false;
    let restartTimer = null;
    let lastFinalAt = 0;
    let lastChunkWordCount = 0;
    let noSpeechStreak = 0;
    let chunkStartMs = 0;

    const lang =
      opts.lang ||
      (navigator.language && navigator.language.startsWith('en') ? navigator.language : 'en-US');

    function clearRestart() {
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
    }

    function scheduleRestart(delayMs) {
      clearRestart();
      if (!active) return;
      restartTimer = setTimeout(() => {
        if (!active || !rec) return;
        try {
          rec.start();
        } catch (e) {
          restartTimer = setTimeout(() => {
            if (active && rec) {
              try {
                rec.start();
              } catch (e2) {
                /* already started */
              }
            }
          }, 450);
        }
      }, delayMs);
    }

    function resumeAudioIfNeeded() {
      try {
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return;
        const probe = new Ctx();
        if (probe.state === 'suspended') probe.resume().catch(() => {});
        probe.close().catch(() => {});
      } catch (e) {
        /* */
      }
    }

    let noSpeechRestarts = 0;
    const MAX_NO_SPEECH_RESTARTS = 120;

    function build() {
      const r = new SR();
      r.continuous = true;
      r.interimResults = true;
      r.lang = lang;
      r.maxAlternatives = 5;

      r.onstart = function () {
        resumeAudioIfNeeded();
        if (opts.onStart) opts.onStart();
      };

      r.onresult = function (e) {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = pickBestAlternative(res);
          if (res.isFinal) {
            const now = Date.now();
            if (lastFinalAt && opts.onLongPause) {
              const gap = now - lastFinalAt;
              if (gap > 1500) opts.onLongPause(gap);
            }
            lastFinalAt = now;
            noSpeechRestarts = 0;
            const piece = (text || '').trim();
            if (piece) {
              r._accumulated = mergeFinals((r._accumulated || '').trim(), piece) + ' ';
            }
            const words = piece.split(/\s+/).filter(Boolean);
            lastChunkWordCount += words.length;
            const elapsedSec = (now - chunkStartMs) / 1000;
            if (opts.onWpm && elapsedSec > 0.45 && lastChunkWordCount > 0) {
              const wpm = Math.round((lastChunkWordCount / elapsedSec) * 60);
              opts.onWpm(wpm);
            }
          } else {
            interim += text;
          }
        }
        if (opts.onTranscript) opts.onTranscript((r._accumulated || '').trimEnd(), interim);
      };

      r.onerror = function (e) {
        if (e.error === 'no-speech') {
          noSpeechStreak++;
          if (noSpeechRestarts >= MAX_NO_SPEECH_RESTARTS) {
            active = false;
            if (opts.onError) opts.onError('no-speech');
            return;
          }
          noSpeechRestarts++;
          if (active) scheduleRestart(200 + Math.min(noSpeechStreak * 35, 900));
          return;
        }
        noSpeechStreak = 0;
        if (e.error === 'aborted' || e.error === 'not-allowed') {
          active = false;
          if (opts.onError) opts.onError(e.error);
          return;
        }
        if (opts.onError && e.error !== 'no-speech') opts.onError(e.error);
        if (active && e.error !== 'not-allowed') scheduleRestart(e.error === 'network' ? 1100 : 280);
      };

      r.onend = function () {
        if (active) {
          scheduleRestart(90);
        } else if (opts.onEnd) {
          opts.onEnd();
        }
      };

      return r;
    }

    return {
      start(answerStartedAt) {
        active = true;
        noSpeechStreak = 0;
        noSpeechRestarts = 0;
        lastFinalAt = 0;
        lastChunkWordCount = 0;
        chunkStartMs = answerStartedAt || Date.now();
        clearRestart();
        rec = build();
        rec._accumulated = '';
        rec._answerStart = answerStartedAt || Date.now();
        if (opts.primeAudioStream && opts.primeAudioStream.getAudioTracks().length) {
          try {
            opts.primeAudioStream.getAudioTracks()[0].enabled = true;
          } catch (e) {
            /* */
          }
        }
        try {
          rec.start();
        } catch (e) {
          scheduleRestart(220);
        }
      },
      stop() {
        active = false;
        clearRestart();
        if (rec) {
          rec.onend = null;
          try {
            rec.stop();
          } catch (e) {
            /* */
          }
          rec = null;
        }
      },
      isActive() {
        return active;
      },
    };
  };

  global.createMicLevelMeter = function createMicLevelMeter(mediaStream) {
    let ctx = null;
    let analyser = null;
    let src = null;
    let raf = null;
    let level = 0;

    function loop() {
      if (!analyser) return;
      const data = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const boosted = Math.min(1, rms * 6.2);
      level = level * 0.82 + boosted * 0.18;
      raf = requestAnimationFrame(loop);
    }

    return {
      start() {
        if (!mediaStream) return;
        const tracks = mediaStream.getAudioTracks();
        if (!tracks.length) return;
        try {
          ctx = new (global.AudioContext || global.webkitAudioContext)();
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          src = ctx.createMediaStreamSource(new MediaStream([tracks[0]]));
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.55;
          src.connect(analyser);
          loop();
        } catch (e) {
          console.warn('Mic meter:', e);
        }
      },
      stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        try {
          if (src) src.disconnect();
        } catch (e) {
          /* */
        }
        try {
          if (ctx && ctx.state !== 'closed') ctx.close();
        } catch (e) {
          /* */
        }
        src = null;
        analyser = null;
        ctx = null;
        level = 0;
      },
      getLevel() {
        return level;
      },
    };
  };
})(typeof window !== 'undefined' ? window : this);
