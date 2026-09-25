/* The card, held in the hand.

   A physically based render of the generated card: ID-1 corner radius, a
   coated-stock finish (clearcoat over a matte face), image-based lighting
   from a neutral room, ACES tone mapping and a soft contact shadow behind
   it. The card leans gently toward the pointer.

   The artwork itself stays the generator's SVG: it is rasterised to a
   texture on every change, so the 3D card and the exported PNG are always
   the same picture. If WebGL is unavailable the flat SVG stays, and
   `#flat` in the URL forces it (used by the layout checks). */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

(() => {
  'use strict';
  if (location.hash.includes('flat')) return;

  const stage = document.getElementById('card-stage');
  if (!stage || !window.InfoDayCard) return;

  const { W, H } = window.InfoDayCard.mm;      /* 90 x 54 */
  const R = 3.18, DEPTH = 0.76;                /* ID-1 corner, card stock */

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  /* VSM honours shadow.radius; PCFSoft silently ignores it */
  renderer.shadowMap.type = THREE.VSMShadowMap;
  /* Neutral keeps the brand colours honest; ACES washes saturated ink */
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  stage.classList.add('is-3d');
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 620 / 400, 10, 1200);
  camera.position.set(0, 0, 205);

  /* the room is the light: image-based, so the coat has something to mirror */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(70, 110, 160);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 22;
  key.shadow.blurSamples = 18;
  key.shadow.bias = -0.0002;
  const d = 90;
  key.shadow.camera.left = -d; key.shadow.camera.right = d;
  key.shadow.camera.top = d; key.shadow.camera.bottom = -d;
  key.shadow.camera.far = 500;
  scene.add(key);

  /* the card: rounded rectangle, thin extrusion, tiny bevel for the edge
     highlight. Drawn centred so it rotates about its middle. */
  const shape = new THREE.Shape();
  const w2 = W / 2, h2 = H / 2;
  shape.moveTo(-w2 + R, -h2);
  shape.lineTo(w2 - R, -h2);  shape.absarc(w2 - R, -h2 + R, R, -Math.PI / 2, 0);
  shape.lineTo(w2, h2 - R);   shape.absarc(w2 - R, h2 - R, R, 0, Math.PI / 2);
  shape.lineTo(-w2 + R, h2);  shape.absarc(-w2 + R, h2 - R, R, Math.PI / 2, Math.PI);
  shape.lineTo(-w2, -h2 + R); shape.absarc(-w2 + R, -h2 + R, R, Math.PI, Math.PI * 1.5);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH, curveSegments: 24,
    bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2,
  });
  geo.center();
  /* the caps' UVs come out in shape millimetres; remap them to 0..1 */
  {
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    const g0 = geo.groups.find(g => g.materialIndex === 0);
    const idx = geo.index;
    const seen = new Set();
    for (let i = g0.start; i < g0.start + g0.count; i++) {
      const v = idx ? idx.getX(i) : i;
      if (seen.has(v)) continue;
      seen.add(v);
      uv.setXY(v, (pos.getX(v) + w2) / W, (pos.getY(v) + h2) / H);
    }
    uv.needsUpdate = true;
  }

  const face = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.4,
    clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.45,
  });
  const edge = new THREE.MeshPhysicalMaterial({
    color: 0xF2F1EE, metalness: 0, roughness: 0.6, envMapIntensity: 0.4,
  });
  const card = new THREE.Mesh(geo, [face, edge]);
  card.castShadow = true;
  scene.add(card);

  /* soft contact shadow on an invisible wall behind the card */
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 400),
    new THREE.ShadowMaterial({ opacity: 0.22 }));
  wall.position.z = -16;
  wall.receiveShadow = true;
  scene.add(wall);

  /* ── the artwork as a texture, refreshed whenever the card changes ────── */
  const TEXW = 1800, TEXH = 1080;
  const cnv = document.createElement('canvas');
  cnv.width = TEXW; cnv.height = TEXH;
  const ctx = cnv.getContext('2d');
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  face.map = tex;

  const STILL = location.hash.includes('still');   /* render per event, for checks */
  let timer = null;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const svg = window.InfoDayCard.svg();
      if (!svg) return;
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = () => {
        ctx.clearRect(0, 0, TEXW, TEXH);
        ctx.drawImage(img, 0, 0, TEXW, TEXH);
        URL.revokeObjectURL(url);
        tex.needsUpdate = true;
        if (STILL) renderer.render(scene, camera);
      };
      img.src = url;
    }, 90);
  }
  document.addEventListener('if-cardchange', refresh);
  refresh();

  /* ── the lean: toward the pointer, and a slow breath when it leaves ───── */
  let tx = 0, ty = 0, hasPointer = false;
  /* the whole page steers the card; angles still measured from the stage */
  document.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    const nx = Math.max(-1.15, Math.min(1.15, ((e.clientX - r.left) / r.width) * 2 - 1));
    const ny = Math.max(-1.15, Math.min(1.15, ((e.clientY - r.top) / r.height) * 2 - 1));
    hasPointer = true;
    ty = nx * 0.16; tx = ny * 0.12;
  });
  document.documentElement.addEventListener('mouseleave', () => { hasPointer = false; });

  function size() {
    const w = stage.clientWidth || 620;
    const h = Math.round(w * 400 / 620);
    renderer.setSize(w, h, false);
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(stage);
  size();

  const clock = new THREE.Clock();
  (function frame() {
    if (!STILL) requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    if (!hasPointer) {
      ty = Math.sin(t * 0.5) * 0.05;
      tx = Math.cos(t * 0.4) * 0.035;
    }
    card.rotation.y += (ty - card.rotation.y) * 0.07;
    card.rotation.x += (tx - card.rotation.x) * 0.07;
    card.position.y = Math.sin(t * 0.8) * 0.6;
    renderer.render(scene, camera);
  })();
})();
