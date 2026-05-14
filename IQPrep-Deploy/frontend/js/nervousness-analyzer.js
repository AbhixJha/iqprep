/**
 * Real-time interview nervousness from webcam (MediaPipe Face Landmarker)
 * plus speech hesitation / pacing from the host page and optional mic flutter.
 */
(function (global) {
  'use strict';

  const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  const MODEL_URL =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  /** ARKit-style names used by MediaPipe; some builds use slightly different strings. */
  const BLEND_ALIASES = {
    browInnerUp: ['browInnerUp', 'browInnerUp_L', 'BrowInnerUp'],
    mouthPress: ['mouthPress', 'mouthPressLeft', 'mouthPressRight', 'mouthPress_L', 'mouthPress_R'],
    eyeSquintL: ['eyeSquintLeft', 'eyeSquint_L'],
    eyeSquintR: ['eyeSquintRight', 'eyeSquint_R'],
    mouthFunnel: ['mouthFunnel', 'mouthFunnel_L', 'mouthFunnel_R'],
    jawOpen: ['jawOpen', 'JawOpen'],
  };

  let faceLandmarker = null;
  let videoEl = null;
  let rafId = null;
  let lastDetectMs = 0;
  let running = false;
  let sessionActive = false;

  const noseHistory = [];
  const yawHistory = [];
  const blinkSpikeHistory = [];
  const micRmsHistory = [];
  let lastBlinkOpen = 1;
  let blendStressEMA = 0;

  let speechHesitationScore = 0;
  let speechWpmVariancePenalty = 0;
  let micFlutterScore = 0;

  let smoothedNervous = 0;
  let smoothedConfidence = 100;
  let framesNoFace = 0;
  let lastWarn = '';

  const MAX_HIST = 45;
  const DETECT_INTERVAL_MS = 33;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function ema(prev, next, alpha) {
    return prev * (1 - alpha) + next * alpha;
  }

  function stdDev(arr) {
    if (arr.length < 3) return 0;
    const m = arr.reduce((s, v) => s + v, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
  }

  function blendMap(categories) {
    const m = Object.create(null);
    if (!categories) return m;
    for (let i = 0; i < categories.length; i++) {
      const c = categories[i];
      if (c && c.categoryName) m[c.categoryName] = c.score;
    }
    return m;
  }

  function pickBlend(map, keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (typeof map[k] === 'number') return map[k];
    }
    return 0;
  }

  function stressFromBlends(blendCategories) {
    const map = blendMap(blendCategories);
    const brow = pickBlend(map, BLEND_ALIASES.browInnerUp);
    const press = Math.max(
      pickBlend(map, BLEND_ALIASES.mouthPress),
      pickBlend(map, ['mouthStretchLeft', 'mouthStretchRight', 'mouthStretch_L', 'mouthStretch_R']) * 0.85
    );
    const squint =
      (pickBlend(map, BLEND_ALIASES.eyeSquintL) + pickBlend(map, BLEND_ALIASES.eyeSquintR)) / 2;
    const funnel = pickBlend(map, BLEND_ALIASES.mouthFunnel);
    const jaw = pickBlend(map, BLEND_ALIASES.jawOpen);
    const browDn = Math.max(
      pickBlend(map, ['browDownLeft', 'browDown_L']),
      pickBlend(map, ['browDownRight', 'browDown_R'])
    );
    return clamp(
      brow * 0.28 +
        press * 0.28 +
        squint * 0.18 +
        funnel * 0.22 +
        jaw * 0.12 +
        browDn * 0.14,
      0,
      1
    );
  }

  /** Approximate head yaw from nose vs eye midline (normalized coords, mirrored video ok). */
  function estimateYaw(lm) {
    const nose = lm[1];
    const le = lm[33];
    const re = lm[263];
    if (!nose || !le || !re) return 0;
    const midX = (le.x + re.x) / 2;
    return (nose.x - midX) * 4;
  }

  function eyeOpenness(lm) {
    const upperL = lm[159];
    const lowerL = lm[145];
    const outerL = lm[33];
    const innerL = lm[133];
    const upperR = lm[386];
    const lowerR = lm[374];
    const outerR = lm[263];
    const innerR = lm[362];
    if (!upperL || !lowerL || !outerL || !innerL) return 1;
    const verL = Math.hypot(upperL.x - lowerL.x, upperL.y - lowerL.y);
    const horL = Math.hypot(outerL.x - innerL.x, outerL.y - innerL.y) + 1e-6;
    const earL = verL / horL;
    let earR = earL;
    if (upperR && lowerR && outerR && innerR) {
      const verR = Math.hypot(upperR.x - lowerR.x, upperR.y - lowerR.y);
      const horR = Math.hypot(outerR.x - innerR.x, outerR.y - innerR.y) + 1e-6;
      earR = verR / horR;
    }
    return clamp((earL + earR) / 2, 0, 0.45) / 0.45;
  }

  /** Iris / gaze offset when iris landmarks exist (478-point model). */
  function gazeOffsetScore(lm) {
    const le = lm[33];
    const re = lm[263];
    const li = lm[468];
    const ri = lm[473];
    if (!le || !re) return 0;
    const midEyeY = (le.y + re.y) / 2;
    let off = 0;
    if (li && ri) {
      const ix = (li.x + ri.x) / 2;
      const iy = (li.y + ri.y) / 2;
      off = Math.hypot(ix - 0.5, iy - midEyeY) * 2.2;
    } else {
      const nose = lm[1];
      if (nose) off = Math.hypot(nose.x - 0.5, nose.y - 0.42) * 1.6;
    }
    return clamp((off - 0.06) / 0.22, 0, 1);
  }

  function pushHist(arr, v) {
    arr.push(v);
    if (arr.length > MAX_HIST) arr.shift();
  }

  function processLandmarks(lm, blendCategories) {
    const nose = lm[1];
    if (!nose) return 0;

    pushHist(noseHistory, { x: nose.x, y: nose.y });
    const nx = noseHistory.map((p) => p.x);
    const ny = noseHistory.map((p) => p.y);
    const fidget = clamp((stdDev(nx) + stdDev(ny)) * 320, 0, 1);

    let frameJitter = 0;
    if (noseHistory.length >= 2) {
      const last = noseHistory[noseHistory.length - 1];
      const prev = noseHistory[noseHistory.length - 2];
      frameJitter = Math.hypot(last.x - prev.x, last.y - prev.y) * 85;
    }

    const yaw = estimateYaw(lm);
    pushHist(yawHistory, yaw);
    const shake = clamp(stdDev(yawHistory) * 8.5, 0, 1);

    const centerOff = Math.hypot(nose.x - 0.5, nose.y - 0.42);
    const away = clamp((centerOff - 0.05) / 0.16, 0, 1);

    const gazeAway = gazeOffsetScore(lm);

    const openness = eyeOpenness(lm);
    let blinkSpike = 0;
    if (lastBlinkOpen - openness > 0.28) {
      blinkSpike = 1;
      pushHist(blinkSpikeHistory, 1);
    } else {
      pushHist(blinkSpikeHistory, 0);
    }
    lastBlinkOpen = openness;
    const blinkRate = clamp(blinkSpikeHistory.reduce((a, b) => a + b, 0) / 10, 0, 1);

    let blendStress = 0;
    if (blendCategories && blendCategories.length) {
      blendStress = stressFromBlends(blendCategories);
    }
    blendStressEMA = ema(blendStressEMA, blendStress, 0.14);

    const gazeUnstable = clamp(fidget * 0.65 + shake * 0.55 + gazeAway * 0.35, 0, 1);

    const micNerv =
      micRmsHistory.length >= 4 ? clamp(stdDev(micRmsHistory) * 14 + micFlutterScore * 0.35, 0, 1) : micFlutterScore * 0.4;

    const raw =
      away * 22 +
      fidget * 20 +
      shake * 16 +
      blinkRate * 14 +
      blendStressEMA * 18 +
      gazeUnstable * 14 +
      clamp(frameJitter, 0, 1) * 10 +
      clamp(speechHesitationScore, 0, 1) * 11 +
      clamp(speechWpmVariancePenalty, 0, 1) * 9 +
      micNerv * 8;

    return clamp(raw, 0, 100);
  }

  function tick() {
    if (!running) {
      rafId = null;
      return;
    }
    if (!videoEl) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();

    if (!faceLandmarker) {
      const speechMic =
        clamp(speechHesitationScore * 44 + speechWpmVariancePenalty * 34, 0, 78) +
        clamp(micFlutterScore * 22, 0, 18);
      const speechOnly = clamp(speechMic, 0, 85);
      smoothedNervous = ema(smoothedNervous, speechOnly, sessionActive ? 0.16 : 0.12);
      smoothedConfidence = ema(smoothedConfidence, 100 - smoothedNervous * 0.9, 0.15);
      if (sessionActive) {
        speechHesitationScore *= 0.995;
        speechWpmVariancePenalty *= 0.996;
      } else {
        speechHesitationScore *= 0.988;
        speechWpmVariancePenalty *= 0.992;
      }
      micFlutterScore *= 0.97;
      updateWarnings();
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (videoEl.readyState < 2) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    let frameScore = smoothedNervous;
    try {
      if (now - lastDetectMs >= DETECT_INTERVAL_MS) {
        lastDetectMs = now;
        const res = faceLandmarker.detectForVideo(videoEl, now);
        if (res.faceLandmarks && res.faceLandmarks.length) {
          framesNoFace = 0;
          const lm = res.faceLandmarks[0];
          const blends = res.faceBlendshapes && res.faceBlendshapes[0] ? res.faceBlendshapes[0].categories : null;
          frameScore = processLandmarks(lm, blends);
        } else {
          framesNoFace++;
          const lost = clamp(framesNoFace / 18, 0, 1);
          frameScore = ema(smoothedNervous, 48 + lost * 38, 0.38);
        }
      }
    } catch (e) {
      console.warn('FaceLandmarker tick:', e);
    }

    smoothedNervous = ema(smoothedNervous, frameScore, 0.2);
    smoothedConfidence = ema(smoothedConfidence, 100 - smoothedNervous * 0.92, 0.16);

    speechHesitationScore *= sessionActive ? 0.992 : 0.985;
    speechWpmVariancePenalty *= sessionActive ? 0.994 : 0.99;
    micFlutterScore *= 0.985;

    updateWarnings();
    rafId = requestAnimationFrame(tick);
  }

  function ensureTick() {
    if (!rafId && running) rafId = requestAnimationFrame(tick);
  }

  function updateWarnings() {
    let w = '';
    if (framesNoFace > 14) w = 'Face not visible — look toward the camera';
    else if (smoothedNervous > 72) w = 'High stress signals — slow down and breathe';
    else if (smoothedNervous > 55) w = 'Try steady eye contact and relax shoulders';
    else if (smoothedNervous > 40) w = 'Slight tension detected';
    lastWarn = w;
  }

  const sessionSamples = [];

  function recordSample() {
    sessionSamples.push({
      t: Date.now(),
      n: Math.round(smoothedNervous),
      c: Math.round(smoothedConfidence),
    });
  }

  let sampleIv = null;

  global.NervousnessAnalyzer = {
    isReady() {
      return !!faceLandmarker;
    },

    setSessionActive(on) {
      sessionActive = !!on;
    },

    /** Feed normalized mic level 0..1 from createMicLevelMeter while interviewing. */
    onMicLevel(level) {
      const v = clamp(typeof level === 'number' ? level : 0, 0, 1);
      pushHist(micRmsHistory, v);
      const flutter = clamp(stdDev(micRmsHistory) * 6.5, 0, 1);
      micFlutterScore = ema(micFlutterScore, flutter, 0.22);
    },

    async start(video, opts) {
      opts = opts || {};
      videoEl = video;
      running = true;
      sessionActive = true;
      framesNoFace = 0;
      lastDetectMs = 0;
      smoothedNervous = 4;
      smoothedConfidence = 94;
      noseHistory.length = 0;
      yawHistory.length = 0;
      blinkSpikeHistory.length = 0;
      micRmsHistory.length = 0;
      lastBlinkOpen = 1;
      blendStressEMA = 0;
      speechHesitationScore = 0;
      speechWpmVariancePenalty = 0;
      micFlutterScore = 0;
      sessionSamples.length = 0;

      if (sampleIv) clearInterval(sampleIv);
      sampleIv = setInterval(recordSample, 500);
      recordSample();

      ensureTick();

      if (faceLandmarker) {
        if (opts.onStatus) opts.onStatus('Face tracking ready');
        return true;
      }

      try {
        const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
        const { FaceLandmarker, FilesetResolver } = vision;
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

        const tryCreate = async (delegate) =>
          FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: delegate || 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFaceBlendshapes: true,
            minFaceDetectionConfidence: 0.38,
            minFacePresenceConfidence: 0.28,
            minTrackingConfidence: 0.42,
          });

        try {
          faceLandmarker = await tryCreate('GPU');
        } catch (e1) {
          console.warn('FaceLandmarker GPU failed, trying CPU', e1);
          faceLandmarker = await tryCreate('CPU');
        }

        if (opts.onStatus) opts.onStatus('Face tracking ready');
        ensureTick();
        return true;
      } catch (err) {
        console.error('NervousnessAnalyzer init failed', err);
        if (opts.onStatus) opts.onStatus('Face model unavailable — using speech + mic signals');
        faceLandmarker = null;
        ensureTick();
        return false;
      }
    },

    stop() {
      running = false;
      sessionActive = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (sampleIv) clearInterval(sampleIv);
      sampleIv = null;
      videoEl = null;
    },

    onSpeechGap(gapMs) {
      if (gapMs > 2200) speechHesitationScore = clamp(speechHesitationScore + 0.24, 0, 1);
      else if (gapMs > 1400) speechHesitationScore = clamp(speechHesitationScore + 0.13, 0, 1);
    },

    onSpeechWpm(wpm) {
      if (!wpm || wpm < 45) speechWpmVariancePenalty = clamp(speechWpmVariancePenalty + 0.08, 0, 1);
      else if (wpm > 195) speechWpmVariancePenalty = clamp(speechWpmVariancePenalty + 0.1, 0, 1);
      else speechWpmVariancePenalty *= 0.975;
    },

    getLivePercent() {
      return Math.round(smoothedNervous);
    },

    getConfidencePercent() {
      return Math.round(smoothedConfidence);
    },

    getWarning() {
      return lastWarn;
    },

    getDetail() {
      return {
        nervousness: Math.round(smoothedNervous),
        confidence: Math.round(smoothedConfidence),
        warning: lastWarn,
        faceTracked: framesNoFace < 12,
      };
    },

    getSessionAverage() {
      if (!sessionSamples.length) return Math.round(smoothedNervous);
      const sum = sessionSamples.reduce((a, s) => a + s.n, 0);
      return Math.round(sum / sessionSamples.length);
    },

    getSamples() {
      return sessionSamples.slice();
    },
  };
})(typeof window !== 'undefined' ? window : this);
