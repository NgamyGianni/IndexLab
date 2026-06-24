// ── three.js hero: a restrained 3D ribbon of the live portfolio path ───────────
// Lazy-loaded (keeps three out of the main chunk). Editorial: one accent hue,
// slow drift, lots of negative space. Falls back to an SVG sparkline when WebGL
// is unavailable, on mobile, or under prefers-reduced-motion.

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

// Build 3D points from a 1-D performance path, normalised to a tidy frame.
function pointsFromPath(path) {
  const n = path.length;
  const spanX = 3.4;
  let min = Infinity, max = -Infinity;
  for (const v of path) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * spanX - spanX / 2;
    const y = (((path[i] - min) / range) - 0.5) * 1.05;
    const z = Math.sin((i / n) * Math.PI * 2) * 0.12;     // gentle depth wave
    pts[i] = new THREE.Vector3(x, y, z);
  }
  return pts;
}

function buildTube(path, accent, dark) {
  const pts = pointsFromPath(path);
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  const geo = new THREE.TubeGeometry(curve, Math.min(420, path.length * 2), 0.024, 12, false);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accent),
    roughness: 0.32, metalness: 0.12,
    emissive: new THREE.Color(accent),
    emissiveIntensity: dark ? 0.22 : 0.04,
    transparent: true, opacity: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, end: pts[pts.length - 1] };
}

// Soft SVG sparkline — the graceful fallback.
function Sparkline({ path, accent, height }) {
  if (!path || path.length < 2) return null;
  const w = 1000, h = height;
  let min = Infinity, max = -Infinity;
  for (const v of path) { if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;
  const pad = 14;
  const pts = path.map((v, i) => {
    const x = (i / (path.length - 1)) * w;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none"
         style={{ display: "block", opacity: 0.9 }}>
      <defs>
        <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.14" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#heroFade)" />
      <path d={d} fill="none" stroke={accent} strokeWidth="2.5"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={accent} />
    </svg>
  );
}

export default function Hero3D({ path = [], accent = "#1f3aff", dark = false, height = 200, reduced = false, lite = false }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);   // { renderer, scene, camera, group, mesh, glow, raf }

  // ── Create scene once ──
  useEffect(() => {
    if (lite || reduced) return;
    const el = mountRef.current;
    if (!el || path.length < 2) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch { return; }   // no WebGL → effect bails, SVG fallback shows underneath

    const w = el.clientWidth || 800;
    const h = height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearAlpha(0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    camera.position.set(0, 0.18, 3.05);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, dark ? 0.5 : 0.85));
    const key = new THREE.DirectionalLight(0xffffff, dark ? 0.7 : 0.5);
    key.position.set(2, 3, 4);
    scene.add(key);

    const { mesh, end } = buildTube(path, accent, dark);
    group.add(mesh);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 20, 20),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(accent) })
    );
    glow.position.copy(end);
    group.add(glow);

    const st = { renderer, scene, camera, group, mesh, glow, raf: 0, t: 0 };
    stateRef.current = st;

    const clock = new THREE.Clock();
    const tick = () => {
      const dt = clock.getDelta();
      st.t += dt;
      group.rotation.y = Math.sin(st.t * 0.18) * 0.34;
      group.rotation.x = -0.07 + Math.sin(st.t * 0.13) * 0.045;
      const pulse = 1 + Math.sin(st.t * 2.2) * 0.18;
      glow.scale.setScalar(pulse);
      renderer.render(scene, camera);
      st.raf = requestAnimationFrame(tick);
    };
    // intro
    group.scale.set(1, 0.82, 1);
    mesh.material.opacity = 0;
    gsap.to(group.scale, { y: 1, duration: 1.1, ease: "power3.out" });
    gsap.to(mesh.material, { opacity: 1, duration: 1.0, ease: "power2.out" });
    tick();

    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth || w;
      camera.aspect = nw / h;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, h);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(st.raf);
      ro.disconnect();
      mesh.geometry.dispose();
      mesh.material.dispose();
      glow.geometry.dispose();
      glow.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, [lite, reduced, dark, height]);   // NOT path — geometry updates handled below

  // ── Morph geometry when the path changes (no scene teardown) ──
  useEffect(() => {
    const st = stateRef.current;
    if (!st || path.length < 2) return;
    const old = st.mesh;
    const { mesh, end } = buildTube(path, accent, dark);
    st.group.add(mesh);
    st.mesh = mesh;
    st.glow.position.copy(end);
    mesh.material.opacity = 0;
    gsap.to(mesh.material, { opacity: 1, duration: 0.6, ease: "power2.out" });
    gsap.to(old.material, {
      opacity: 0, duration: 0.5, ease: "power2.in",
      onComplete() {
        st.group.remove(old);
        old.geometry.dispose();
        old.material.dispose();
      },
    });
  }, [path, accent, dark]);

  if (lite || reduced) {
    return (
      <div ref={mountRef} style={{ width: "100%", height }}>
        <Sparkline path={path} accent={accent} height={height} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      {/* SVG sits underneath; if WebGL mounts a canvas on top it covers this */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        <Sparkline path={path} accent={accent} height={height} />
      </div>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
