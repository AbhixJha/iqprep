/* ==========================================================================
   IQPrep "Kinetic Arena" - real-time WebGL scene (Three.js)
   --------------------------------------------------------------------------
   One persistent scene that the page scrolls THROUGH. Every landing section
   is a camera + scene state; scrolling blends between them.

   Objects
     lattice   8k GPU points (custom shader) - the training floor; ripples under the pointer
     tower     72 instanced bars - starts as a voice meter ring, then MORPHS:
               ring -> three score blocks -> speech waveform wall -> progress staircase
     rings     3 orbit rings with 120 tick marks + satellites = text / voice / video modes
     beam      vertical signal beam, floor markings, drifting particle field
   Modes
     landing   scroll-driven (reads [data-act] sections)
     auth/dash fixed state, pointer-reactive, lighter
   Everything is cleaned up by dispose(). Reduced motion renders one still frame.
   ========================================================================== */
import * as THREE from './vendor/three.module.min.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerpArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

/* ---- scene states: one per act ----------------------------------------
   cam/look/fov  camera
   pw            position weights  [ring, three blocks, waveform wall]
   hw            height weights    [wave, stairs, blocks, speech]
   amp           lattice amplitude   mix  0 amber .. 1 cyan
   ringOp        orbit ring opacity  beam beam scale                        */
const STATES = [
  { name: 'ENTER',   cam: [9, 5.4, 14],   look: [-3.6, 2.5, 0],  fov: 42, pw: [1, 0, 0], hw: [1, 0, 0, 0], amp: 0.55, mix: 0.22, ringOp: 0.65, beam: 1,   spin: 1 },
  { name: 'TRAIN',   cam: [0, 4.6, 12.5], look: [-3.4, 3.1, 0],  fov: 44, pw: [1, 0, 0], hw: [1, 0, 0, 0], amp: 0.4,  mix: 0.45, ringOp: 1,    beam: 0.7, spin: 1.5 },
  { name: 'MEASURE', cam: [0, 5.6, 17],   look: [4.4, 3.2, 0],   fov: 44, pw: [0, 1, 0], hw: [0, 0, 1, 0], amp: 0.3,  mix: 0.3,  ringOp: 0.12, beam: 0,   spin: 0.4 },
  { name: 'SIGNAL',  cam: [0, 2.3, 9.5],  look: [0, 2.7, -2],    fov: 56, pw: [0, 0, 1], hw: [0, 0, 0, 1], amp: 1.15, mix: 1,    ringOp: 0.08, beam: 0,   spin: 0.5 },
  { name: 'ADVANCE', cam: [11, 9.6, 13],  look: [-2.6, 3.2, 0],  fov: 42, pw: [1, 0, 0], hw: [0, 1, 0, 0], amp: 0.5,  mix: 0.12, ringOp: 0.9,  beam: 1.7, spin: 0.8 },
];
const AUTH_STATE = { cam: [8.5, 5, 13], look: [0, 2.6, 0], fov: 42, pw: [1, 0, 0], hw: [1, 0, 0, 0], amp: 0.5, mix: 0.3, ringOp: 0.8, beam: 1, spin: 1 };
const DASH_STATE = { cam: [7.5, 4.2, 12], look: [-2.2, 2.3, 0], fov: 40, pw: [1, 0, 0], hw: [1, 0, 0, 0], amp: 0.35, mix: 0.4, ringOp: 0.5, beam: 0.8, spin: 0.7 };

const N = 72;            // bars
const R = 3.2;           // tower radius
const AMBER = new THREE.Color('#F59E0B');
const CYAN = new THREE.Color('#00F0FF');
const ICE = new THREE.Color('#38BDF8');
const BONE = new THREE.Color('#E9ECF4');

export function createArena(canvas, opts = {}) {
  const mode = opts.mode || 'landing';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = innerWidth < 800 || matchMedia('(pointer:coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { document.documentElement.classList.add('no-gl'); return null; }
  renderer.setClearColor(0x08090d, 1);
  let dprCap = small ? 1.25 : 1.75;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x08090d, small ? 0.04 : 0.032);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  const world = new THREE.Group();
  scene.add(world);

  /* lights */
  scene.add(new THREE.AmbientLight(0xb4c4e4, 1.15));
  const key = new THREE.DirectionalLight(0xdfe8ff, 1.7); key.position.set(-6, 12, 8); scene.add(key);
  const core = new THREE.PointLight(0xf59e0b, 55, 26, 1.6); core.position.set(0, 2.2, 0); world.add(core);
  const rimC = new THREE.PointLight(0x00f0ff, 30, 30, 1.8); rimC.position.set(8, 3, -8); scene.add(rimC);

  /* ---- lattice floor ---- */
  const G = small ? 56 : 92, SP = small ? 0.72 : 0.44;
  const pos = new Float32Array(G * G * 3);
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = (i * G + j) * 3;
    pos[k] = (i - G / 2) * SP; pos[k + 1] = 0; pos[k + 2] = (j - G / 2) * SP;
  }
  const latGeo = new THREE.BufferGeometry();
  latGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const latMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAmp: { value: 0.5 }, uPtr: { value: new THREE.Vector2(99, 99) }, uPtrS: { value: 0 }, uMix: { value: 0.2 }, uSize: { value: small ? 2.4 : 2.2 }, uPx: { value: 1 } },
    vertexShader: `
      uniform float uTime,uAmp,uPtrS,uSize,uPx; uniform vec2 uPtr;
      varying float vH; varying float vA;
      void main(){
        vec3 p = position;
        float d = length(p.xz);
        float w = sin(p.x*.5+uTime*.9)*.5 + sin(p.z*.42-uTime*.7)*.5 + sin(d*.8-uTime*1.4)*.6;
        float lift = exp(-pow(d-${R.toFixed(1)},2.)*.12);
        vec2 q = p.xz-uPtr; float ptr = exp(-dot(q,q)*.22)*uPtrS;
        float h = (w*.32 + lift*.5 + ptr*1.7)*uAmp;
        p.y += h;
        vH = h;
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_Position = projectionMatrix*mv;
        gl_PointSize = uSize*uPx*(1.+ptr*1.6)*(16./max(1.,-mv.z));
        vA = (1.-smoothstep(10.,${(G * SP / 2).toFixed(1)},d)) * (.35+.65*smoothstep(-.4,1.,h+.4));
      }`,
    fragmentShader: `
      uniform float uMix; varying float vH; varying float vA;
      void main(){
        vec2 c = gl_PointCoord-.5; float r = length(c); if(r>.5) discard;
        float a = smoothstep(.5,.05,r);
        vec3 amber = vec3(.96,.62,.04), cyan = vec3(0.,.94,1.);
        vec3 col = mix(amber,cyan,clamp(uMix+vH*.25,0.,1.));
        gl_FragColor = vec4(col, a*vA);
      }`,
  });
  const lattice = new THREE.Points(latGeo, latMat);
  lattice.position.y = -0.02;
  scene.add(lattice);

  /* ---- floor markings ---- */
  const marks = new THREE.Group(); world.add(marks);
  const markMat = new THREE.MeshBasicMaterial({ color: BONE, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  [3.7, 4.6, 9.6].forEach((r, i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r, r + (i === 2 ? 0.03 : 0.022), 160), markMat);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.02; marks.add(m);
  });
  const rad = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r0 = i % 4 === 0 ? 3.7 : 4.6, r1 = 9.6; rad.push(Math.cos(a) * r0, 0.02, Math.sin(a) * r0, Math.cos(a) * r1, 0.02, Math.sin(a) * r1); }
  const radGeo = new THREE.BufferGeometry(); radGeo.setAttribute('position', new THREE.Float32BufferAttribute(rad, 3));
  const radLines = new THREE.LineSegments(radGeo, new THREE.LineBasicMaterial({ color: BONE, transparent: true, opacity: 0.09, depthWrite: false }));
  marks.add(radLines);

  /* ---- tower (instanced bars that morph between layouts) ---- */
  const barGeo = new THREE.BoxGeometry(1, 1, 1);
  const barMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, emissive: 0x2a1a00, emissiveIntensity: 1 });
  const bars = new THREE.InstancedMesh(barGeo, barMat, N);
  bars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  world.add(bars);
  const dummy = new THREE.Object3D();
  const tmpC = new THREE.Color();

  /* ---- orbit rings: text / voice / video ---- */
  const RING = [
    { r: 5.8, y: 2.3, tx: 0.0, tz: 0.0, sp: 0.22, col: AMBER },
    { r: 7.2, y: 3.5, tx: 0.2, tz: 0.12, sp: -0.17, col: CYAN },
    { r: 8.6, y: 4.7, tx: -0.17, tz: 0.2, sp: 0.12, col: ICE },
  ];
  const rings = RING.map((cfg, idx) => {
    const g = new THREE.Group();
    g.position.y = cfg.y; g.rotation.x = cfg.tx; g.rotation.z = cfg.tz;
    const mat = new THREE.MeshBasicMaterial({ color: cfg.col, transparent: true, opacity: 0.6, depthWrite: false });
    const tor = new THREE.Mesh(new THREE.TorusGeometry(cfg.r, 0.018, 6, 220), mat);
    tor.rotation.x = Math.PI / 2; g.add(tor);
    const T = small ? 60 : 120;
    const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 1), mat, T);
    const d = new THREE.Object3D();
    for (let i = 0; i < T; i++) {
      const a = (i / T) * Math.PI * 2, long = i % 5 === 0, len = long ? 0.5 : 0.22;
      d.position.set(Math.cos(a) * (cfg.r - len / 2 - 0.05), 0, Math.sin(a) * (cfg.r - len / 2 - 0.05));
      d.rotation.set(0, -a + Math.PI / 2, 0); d.scale.set(1, 1, len); d.updateMatrix(); ticks.setMatrixAt(i, d.matrix);
    }
    g.add(ticks);
    const sats = [];
    for (let s = 0; s < 3; s++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshBasicMaterial({ color: cfg.col, transparent: true, opacity: 1 }));
      m.userData.off = (s / 3) * Math.PI * 2; g.add(m); sats.push(m);
    }
    world.add(g);
    return { g, mat, sats, cfg, idx, tor, s: { op: 0.6 } };
  });

  /* ---- beam ---- */
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 16, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = 8; world.add(beam);

  /* ---- particles ---- */
  const PN = small ? 700 : 1800, pp = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) { const r = 6 + Math.random() * 34, a = Math.random() * Math.PI * 2; pp[i * 3] = Math.cos(a) * r; pp[i * 3 + 1] = Math.random() * 24 - 1; pp[i * 3 + 2] = Math.sin(a) * r; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x9fb4d8, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }));
  scene.add(dust);

  /* ---- state / scroll mapping ---- */
  let actEls = [], centers = [], act2 = null, act2Top = 0, act2H = 1;
  const cur = JSON.parse(JSON.stringify(mode === 'dash' ? DASH_STATE : AUTH_STATE));
  let actIndexF = 0, p2 = 0;
  function measure() {
    if (mode !== 'landing') return;
    actEls = Array.from(document.querySelectorAll('[data-act]'));
    const sy = scrollY;
    centers = actEls.map((e) => { const r = e.getBoundingClientRect(); return sy + r.top + r.height / 2; });
    act2 = document.getElementById('act2');
    if (act2) { const r = act2.getBoundingClientRect(); act2Top = sy + r.top; act2H = r.height; }
  }
  function stateAtScroll() {
    if (!centers.length) return STATES[0];
    const t = scrollY + innerHeight * 0.5;
    let i = 0; while (i < centers.length - 1 && t > centers[i + 1]) i++;
    const a = STATES[Math.min(i, STATES.length - 1)], b = STATES[Math.min(i + 1, STATES.length - 1)];
    const f = i >= centers.length - 1 ? 0 : sstep((t - centers[i]) / (centers[i + 1] - centers[i]));
    actIndexF = i + f;
    const o = {};
    ['cam', 'look', 'pw', 'hw'].forEach((k) => (o[k] = lerpArr(a[k], b[k], f)));
    ['fov', 'amp', 'mix', 'ringOp', 'beam', 'spin'].forEach((k) => (o[k] = lerp(a[k], b[k], f)));
    if (act2) p2 = clamp((scrollY - act2Top) / Math.max(1, act2H - innerHeight), 0, 1);
    return o;
  }

  /* ---- pointer ---- */
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, wx: 99, wz: 99, active: 0 };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    ptr.active = 1;
  };
  const onLeave = () => { ptr.active = 0; };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  /* ---- sizing ---- */
  let W = 0, H = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (w === W && Math.abs(h - H) < 120 && H) return; // ignore mobile url-bar jitter
    W = w; H = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    latMat.uniforms.uPx.value = renderer.getPixelRatio();
    measure();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  addEventListener('scroll', () => { if (reduce) draw(0.016); }, { passive: true });
  addEventListener('load', measure);
  setTimeout(measure, 600); setTimeout(measure, 2000);

  /* ---- HUD ---- */
  const hud = {
    scroll: document.getElementById('hud-scroll'), act: document.getElementById('hud-act'), cam: document.getElementById('hud-cam'),
    ptr: document.getElementById('hud-ptr'), fps: document.getElementById('hud-fps'),
  };
  let hudT = 0, fpsAcc = 0, fpsN = 0, fpsShown = 60, fpsChecked = false, tAll = 0;

  /* ---- per-frame ---- */
  const tmpV = new THREE.Vector3(), look = new THREE.Vector3();
  const sat = new THREE.Vector3();
  function heights(i, t, hw, pw, ptrAng, ptrBump) {
    const a = (i / N) * Math.PI * 2, u = i / (N - 1);
    const wave = 0.5 + Math.max(0, (Math.sin(a * 5 + t * 1.6) * 0.5 + Math.sin(a * 11 - t * 2.3) * 0.3 + Math.sin(a * 2 + t * 0.7) * 0.5 + 1.1) * 0.5) * 2.4;
    let d = Math.abs(Math.atan2(Math.sin(a - ptrAng), Math.cos(a - ptrAng)));
    const bump = Math.exp(-d * d * 2.6) * ptrBump * 1.6;
    const stairs = 0.35 + (Math.floor(i / 6) / 11) * 5.4 + Math.sin(t * 2 + i) * 0.05;
    const sec = Math.floor(i / 24), j = i % 24, val = [0.82, 0.64, 0.5][sec];
    const blocks = 0.9 + val * 5.2 + Math.sin(t * 1.5 + j * 0.7) * 0.12;
    const env = 0.35 + 0.65 * Math.max(0, Math.sin(u * 7.5 + t * 0.7)) ** 0.7;
    const speech = 0.22 + (Math.abs(Math.sin(u * 30 + t * 3.1)) * 0.6 + Math.abs(Math.sin(u * 13 - t * 2.1)) * 0.4) * env * 3.6;
    const w = hw[0] + hw[1] + hw[2] + hw[3] || 1;
    return ((wave + bump) * hw[0] + stairs * hw[1] + blocks * hw[2] + speech * hw[3]) / w;
  }

  function draw(dt) {
    tAll += dt; const t = tAll;
    const st = mode === 'landing' ? stateAtScroll() : cur;
    // pointer smoothing + world point
    const pa = ptr.active;
    ptr.sx += (ptr.x * pa - ptr.sx) * 0.06; ptr.sy += (ptr.y * pa - ptr.sy) * 0.06;
    ray.setFromCamera({ x: ptr.x, y: ptr.y }, camera);
    if (ray.ray.intersectPlane(plane, hit)) { ptr.wx += (hit.x - ptr.wx) * 0.18; ptr.wz += (hit.z - ptr.wz) * 0.18; }
    latMat.uniforms.uPtr.value.set(ptr.wx, ptr.wz);
    latMat.uniforms.uPtrS.value += ((pa ? 1 : 0) - latMat.uniforms.uPtrS.value) * 0.06;
    latMat.uniforms.uTime.value = t;
    latMat.uniforms.uAmp.value = st.amp; latMat.uniforms.uMix.value = st.mix;

    // camera: state + pointer parallax + act-2 orbit
    let cx = st.cam[0], cy = st.cam[1], cz = st.cam[2];
    if (mode === 'landing') {
      const f2 = 1 - Math.min(1, Math.abs(actIndexF - 1) * 1.4); // 1 only inside act 2
      const ang = (p2 - 0.5) * 1.1 * f2;
      const c = Math.cos(ang), s = Math.sin(ang);
      const nx = cx * c + cz * s, nz = -cx * s + cz * c; cx = nx; cz = nz;
    }
    const portrait = camera.aspect < 1, pk = portrait ? Math.min(1.7, 1 + (1 - camera.aspect) * 1.1) : 1;
    camera.position.set((cx + ptr.sx * 1.4) * pk, cy * (portrait ? 1.1 : 1) - ptr.sy * 0.7, cz * pk);
    look.set(portrait ? st.look[0] * 0.15 : st.look[0], st.look[1] + (portrait ? 2.4 : 0), st.look[2]);
    camera.lookAt(look);
    if (Math.abs(camera.fov - st.fov) > 0.01) { camera.fov = st.fov; camera.updateProjectionMatrix(); }
    world.rotation.y = mode === 'landing' ? 0 : t * 0.08 + ptr.sx * 0.25;

    // tower morph
    const pw = st.pw, hw = st.hw;
    const ptrAng = Math.atan2(ptr.wz, ptr.wx), inside = Math.exp(-Math.pow(Math.hypot(ptr.wx, ptr.wz) / 9, 2));
    const ptrBump = latMat.uniforms.uPtrS.value * inside;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, u = i / (N - 1);
      const sec = Math.floor(i / 24), j = i % 24;
      const cxp = Math.cos(a) * R, czp = Math.sin(a) * R;
      const bxp = (sec - 1) * 6.4 + ((j % 6) - 2.5) * 0.72, bzp = (Math.floor(j / 6) - 1.5) * 0.72;
      const lxp = (u - 0.5) * 21, lzp = -2;
      const x = cxp * pw[0] + bxp * pw[1] + lxp * pw[2];
      const z = czp * pw[0] + bzp * pw[1] + lzp * pw[2];
      const h = Math.max(0.05, heights(i, t, hw, pw, ptrAng, ptrBump));
      dummy.position.set(x, h / 2, z);
      dummy.rotation.set(0, -a * pw[0], 0);
      dummy.scale.set(0.3 * pw[0] + 0.5 * pw[1] + 0.2 * pw[2], h, 0.16 * pw[0] + 0.5 * pw[1] + 0.3 * pw[2]);
      dummy.updateMatrix(); bars.setMatrixAt(i, dummy.matrix);
      const cyanBar = (i % 6 === 0) || (pw[2] > 0.5 && i % 3 === 0) || (pw[1] > 0.5 && sec === 1) || (st.mix > 0.9 && i % 2 === 0);
      tmpC.copy(cyanBar ? CYAN : AMBER); if (!cyanBar && h < 1.2) tmpC.multiplyScalar(0.7);
      bars.setColorAt(i, tmpC);
    }
    bars.instanceMatrix.needsUpdate = true; bars.instanceColor.needsUpdate = true;
    const pc = pw[0];
    marks.children.forEach((m) => { if (m.material) m.material.opacity = 0.22 * Math.max(pc, 0.25); });
    radLines.material.opacity = 0.09 * pc;

    // rings
    const focus = mode === 'landing' ? clamp(Math.floor(p2 * 2.999), 0, 2) : -1;
    const inAct2 = mode === 'landing' ? clamp(1 - Math.abs(actIndexF - 1) * 1.6, 0, 1) : 0;
    rings.forEach((rg) => {
      const dim = focus < 0 ? 1 : lerp(1, rg.idx === focus ? 1.25 : 0.2, inAct2);
      const target = clamp(st.ringOp * dim, 0, 1) * (0.25 + 0.75 * pc);
      rg.s.op += (target - rg.s.op) * 0.12; rg.mat.opacity = rg.s.op;
      rg.g.rotation.y += dt * rg.cfg.sp * st.spin;
      const sc = 1 + (focus === rg.idx ? 0.035 * inAct2 : 0) + pw[1] * 0.4 + pw[2] * 1.2;
      rg.g.scale.setScalar(sc);
      rg.sats.forEach((s) => {
        const ang = t * (0.5 + rg.idx * 0.15) * Math.sign(rg.cfg.sp) + s.userData.off;
        s.position.set(Math.cos(ang) * rg.cfg.r, 0, Math.sin(ang) * rg.cfg.r); s.rotation.y = t * 2; s.rotation.x = t;
        s.material.opacity = rg.s.op;
      });
    });
    beam.scale.set(1, Math.max(0.001, st.beam), 1); beam.material.opacity = 0.14 + 0.3 * Math.min(1, st.beam) * pc; beam.position.y = 8 * st.beam;
    core.intensity = 55 * (0.25 + 0.75 * pc);
    dust.rotation.y = t * 0.012 + scrollY * 0.00012;
    dust.position.y = -scrollY * 0.0016;

    renderer.render(scene, camera);

    // HUD
    hudT += dt; fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
      if (!fpsChecked && tAll > 3) { fpsChecked = true; if (fpsShown < 28 && dprCap > 1) { dprCap = 1; W = 0; resize(); } } }
    if (hudT > 0.1) { hudT = 0;
      if (hud.scroll) hud.scroll.textContent = String(Math.round(clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 0, 1) * 100)).padStart(3, '0') + '%';
      if (hud.act) { const i = clamp(Math.round(actIndexF), 0, STATES.length - 1); hud.act.textContent = '0' + (i + 1) + ' ' + STATES[i].name; }
      if (hud.cam) hud.cam.textContent = (Math.atan2(camera.position.x, camera.position.z) * 57.2958).toFixed(1) + '° / ' + camera.position.y.toFixed(1);
      if (hud.ptr) hud.ptr.textContent = (ptr.x >= 0 ? '+' : '−') + Math.abs(ptr.x).toFixed(2) + ' ' + (ptr.y >= 0 ? '+' : '−') + Math.abs(ptr.y).toFixed(2);
      if (hud.fps) hud.fps.textContent = fpsShown + ' FPS';
    }
    // publish act-2 progress for the DOM (step text)
    if (mode === 'landing' && act2) { act2.style.setProperty('--p2', p2.toFixed(3)); act2.dataset.step = String(focus); }
  }

  /* ---- loop (paused offscreen / hidden) ---- */
  let raf = 0, last = performance.now(), visible = true;
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }); io.observe(canvas);
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    draw(dt);
  }
  resize(); measure();
  if (reduce) { draw(0.016); } else raf = requestAnimationFrame(loop);
  canvas.dataset.ready = '1';

  return {
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
      renderer.dispose();
    },
    measure,
  };
}

/* auto-start for pages that declare a canvas */
const el = document.getElementById('arena');
if (el) {
  const arena = createArena(el, { mode: el.dataset.mode || 'landing' });
  window.IQArena = arena;
  addEventListener('pagehide', () => arena && arena.dispose());
}
