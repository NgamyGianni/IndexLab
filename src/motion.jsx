// ── GSAP motion primitives ────────────────────────────────────────────────────
// Reusable, reduced-motion-aware building blocks. useLayoutEffect runs before
// paint, so fromTo's "from" state is applied with no FOUC.

import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const refreshScroll = () => ScrollTrigger.refresh();

// Respect the OS "reduce motion" setting, reactively.
export function useReducedMotion(){
  const [reduced, setReduced] = useState(
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
}

// Entrance reveal. `whenVisible` defers to a ScrollTrigger; otherwise animates on mount.
export function Reveal({
  children, y = 18, delay = 0, duration = 0.7, ease = "power3.out",
  whenVisible = false, as: Tag = "div", className = "", style, ...rest
}){
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;            // reduced-motion → leave fully visible
    const tween = gsap.fromTo(el,
      { opacity: 0, y },
      {
        opacity: 1, y: 0, duration, delay, ease,
        ...(whenVisible ? { scrollTrigger: { trigger: el, start: "top 86%", once: true } } : {}),
      });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [reduced]);
  return <Tag ref={ref} className={className} style={style} {...rest}>{children}</Tag>;
}

// Staggered entrance for a list of direct children (mount-only — won't re-fire on data change).
export function Stagger({
  children, y = 14, stagger = 0.06, delay = 0, duration = 0.6,
  selector = ":scope > *", as: Tag = "div", className = "", style, ...rest
}){
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = el.querySelectorAll(selector);
    if (!items.length || reduced) return;
    const tween = gsap.fromTo(items,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration, delay, stagger, ease: "power3.out" });
    return () => tween.kill();
  }, [reduced]);
  return <Tag ref={ref} className={className} style={style} {...rest}>{children}</Tag>;
}

// Tween a number. Returns a ref to attach to a text node. Animates from 0 on first
// mount, then from the previous value on change. `format` maps number → string.
export function useCountUp(value, format = (n) => n.toFixed(2), duration = 0.9){
  const ref = useRef(null);
  const prev = useRef(value);
  const mounted = useRef(false);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const to = Number(value);
    if (!Number.isFinite(to)) { el.textContent = String(value); return; }
    const from = mounted.current ? Number(prev.current) : 0;
    prev.current = to;
    mounted.current = true;
    if (reduced || from === to) { el.textContent = format(to); return; }
    const obj = { v: from };
    el.textContent = format(from);
    const tween = gsap.to(obj, {
      v: to, duration, ease: "power2.out",
      onUpdate() { el.textContent = format(obj.v); },
    });
    return () => tween.kill();
  }, [value, reduced]);
  return ref;
}

// Drop-in animated number. Wraps useCountUp so it can be used inside .map()/lists.
export function CountNum({ value, format = (n) => n.toFixed(2), duration = 0.9, className = "", style }){
  const ref = useCountUp(value, format, duration);
  return <span ref={ref} className={className} style={style} />;
}

// Cursor-follow magnetic hover (desktop pointer only). Use sparingly on key CTAs.
export function Magnetic({
  children, strength = 0.3, as: Tag = "div", className = "", style, ...rest
}){
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || window.matchMedia?.("(hover: none)").matches) return;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * strength, y: y * strength, duration: 0.4, ease: "power3.out" });
    };
    const reset = () => gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" });
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    return () => { el.removeEventListener("mousemove", move); el.removeEventListener("mouseleave", reset); };
  }, [reduced, strength]);
  return <Tag ref={ref} className={`magnetic ${className}`} style={style} {...rest}>{children}</Tag>;
}
