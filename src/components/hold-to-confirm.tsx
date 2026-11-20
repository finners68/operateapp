import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface HoldToConfirmProps {
  onConfirm?: () => void;
  onCancel?: () => void;
  onProgress?: (p: number) => void;
  duration?: number;
  tone?: "danger" | "neutral" | "accent";
  size?: "md" | "lg";
  label?: ReactNode;
  holdingLabel?: ReactNode;
  doneLabel?: ReactNode;
  resetAfter?: number;
  disabled?: boolean;
  theme?: "light" | "dark";
  icon?: ReactNode;
  className?: string;
}

type Phase = "idle" | "holding" | "done";

export function HoldToConfirm({
  onConfirm,
  onCancel,
  onProgress,
  duration = 1500,
  tone = "danger",
  size = "lg",
  label = "Hold to confirm",
  holdingLabel = "Keep holding…",
  doneLabel = "Confirmed",
  resetAfter = 2200,
  disabled,
  theme,
  icon,
  className,
}: HoldToConfirmProps) {
  const hintId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const st = useRef({ p: 0, dir: 0, raf: 0, t0: 0, from: 0, phase: "idle" as Phase, key: false });
  const cb = useRef({ onConfirm, onCancel, onProgress, duration, resetAfter });
  cb.current = { onConfirm, onCancel, onProgress, duration, resetAfter };
  const timer = useRef(0);

  const paint = (p: number) => {
    st.current.p = p;
    btn.current?.style.setProperty("--h-p", p.toFixed(4));
    cb.current.onProgress?.(p);
  };
  const setP = (ph: Phase) => {
    st.current.phase = ph;
    setPhase(ph);
  };

  const loop = useCallback((t: number) => {
    const s = st.current;
    if (s.dir === 1) {
      const p = Math.min(1, s.from + (t - s.t0) / cb.current.duration);
      paint(p);
      if (p >= 1) {
        s.dir = 0;
        s.raf = 0;
        setP("done");
        setMsg("Confirmed");
        cb.current.onConfirm?.();
        if (cb.current.resetAfter > 0)
          timer.current = window.setTimeout(() => {
            paint(0);
            setP("idle");
            setMsg("");
          }, cb.current.resetAfter);
        return;
      }
    } else if (s.dir === -1) {
      const k = Math.min(1, (t - s.t0) / (260 + 240 * s.from));
      const p = s.from * (1 - (1 - Math.pow(1 - k, 3)));
      paint(k >= 1 ? 0 : p);
      if (k >= 1) {
        s.dir = 0;
        s.raf = 0;
        return;
      }
    }
    s.raf = requestAnimationFrame(loop);
  }, []);

  const start = () => {
    const s = st.current;
    if (disabled || s.phase === "done") return;
    cancelAnimationFrame(s.raf);
    s.dir = 1;
    s.from = s.p;
    s.t0 = performance.now();
    setP("holding");
    setMsg("Hold to confirm");
    s.raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    const s = st.current;
    if (s.phase !== "holding") return;
    cancelAnimationFrame(s.raf);
    s.dir = -1;
    s.from = s.p;
    s.t0 = performance.now();
    setP("idle");
    setMsg("Cancelled");
    cb.current.onCancel?.();
    s.raf = requestAnimationFrame(loop);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(st.current.raf);
      window.clearTimeout(timer.current);
    },
    [],
  );

  const shown = phase === "done" ? doneLabel : phase === "holding" ? holdingLabel : label;

  return (
    <span className={`fd-hold${className ? "" + className : ""}`} data-fd-theme={theme} data-tone={tone} data-size={size} data-phase={phase}>
      <style>{css}</style>
      <button
        ref={btn}
        type="button"
        className="fd-hold-btn"
        disabled={disabled}
        aria-describedby={hintId}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={(e) => {
          if ((e.key === "" || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            st.current.key = true;
            start();
          }
        }}
        onKeyUp={(e) => {
          if ((e.key === "" || e.key === "Enter") && st.current.key) {
            st.current.key = false;
            stop();
          }
        }}
        onBlur={() => {
          st.current.key = false;
          stop();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="fd-hold-face" data-layer="base">
          {icon && <span className="fd-hold-icon">{icon}</span>}
          <span className="fd-hold-text">{shown}</span>
        </span>
        <span className="fd-hold-fill" aria-hidden="true">
          <span className="fd-hold-face" data-layer="on">
            {phase === "done" ? (
              <svg aria-hidden="true" focusable="false" className="fd-hold-check" width="18" height="18" viewBox="0 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            ) : (
              icon && <span className="fd-hold-icon">{icon}</span>
            )}
            <span className="fd-hold-text">{shown}</span>
          </span>
        </span>
      </button>
      <span id={hintId} className="fd-hold-sr">
        Press and hold for {(duration / 1000).toFixed(1)} seconds, or hold the Space key.
      </span>
      <span className="fd-hold-sr" role="status" aria-live="polite">{msg}</span>
    </span>
  );
}

const css = `
:where(.fd-hold,.fd-hold *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-hold,.fd-hold *)::before,:where(.fd-hold,.fd-hold *)::after{box-sizing:border-box}
:where(.fd-hold svg){display:block;flex-shrink:0}
:where(.fd-hold button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-hold{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --h-c:#E5334B;--h-soft:rgba(229,51,75,.1);--h-fg:#B3162E;--h-on:#fff;--h-line:rgba(229,51,75,.28);
  display:inline-flex;vertical-align:middle;position:relative;
  font:500 15px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;
}
.fd-hold[data-tone="neutral"]{--h-c:#0B0B0F;--h-soft:rgba(11,11,15,.06);--h-fg:#0B0B0F;--h-on:#fff;--h-line:rgba(11,11,15,.14)}
.fd-hold[data-tone="accent"]{--h-c:#007AFF;--h-soft:rgba(0,122,255,.1);--h-fg:#0058C7;--h-on:#fff;--h-line:rgba(0,122,255,.28)}
[data-fd-theme="dark"] .fd-hold,.fd-hold[data-fd-theme="dark"]{--h-c:#FF453A;--h-soft:rgba(255,69,58,.14);--h-fg:#FF8F87;--h-on:#1A0504;--h-line:rgba(255,69,58,.32)}
[data-fd-theme="dark"] .fd-hold[data-tone="neutral"],.fd-hold[data-tone="neutral"][data-fd-theme="dark"]{--h-c:#F5F5F7;--h-soft:rgba(255,255,255,.07);--h-fg:#F5F5F7;--h-on:#0B0B0F;--h-line:rgba(255,255,255,.14)}
[data-fd-theme="dark"] .fd-hold[data-tone="accent"],.fd-hold[data-tone="accent"][data-fd-theme="dark"]{--h-c:#0A84FF;--h-soft:rgba(10,132,255,.16);--h-fg:#66B2FF;--h-on:#fff;--h-line:rgba(10,132,255,.36)}
.fd-hold[data-phase="done"]{--h-c:#1FA45B;--h-soft:rgba(31,164,91,.12);--h-fg:#0F7A41;--h-on:#fff;--h-line:rgba(31,164,91,.3)}
[data-fd-theme="dark"] .fd-hold[data-phase="done"],.fd-hold[data-fd-theme="dark"][data-phase="done"]{--h-c:#30D158;--h-soft:rgba(48,209,88,.14);--h-fg:#7BE69B;--h-on:#04210E;--h-line:rgba(48,209,88,.32)}
.fd-hold[data-size="md"]{--h-h:40px;--h-px:18px;--h-fs:15px}
.fd-hold[data-size="lg"]{--h-h:52px;--h-px:26px;--h-fs:15px}
.fd-hold-btn{--h-p:0;position:relative;display:block;overflow:hidden;height:var(--h-h);min-width:176px;padding:0 var(--h-px);border-radius:var(--fd-hold-radius,9999px);
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;
  background:var(--h-soft);color:var(--h-fg);font-weight:500;font-size:var(--h-fs);line-height:1;font-family:inherit;letter-spacing:-.005em;
  box-shadow:0 0 0 1px var(--h-line),0 1px 2px rgba(11,11,15,.06);
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),box-shadow var(--fd-dur-2) var(--fd-ease-out)}
.fd-hold[data-phase="holding"] .fd-hold-btn{transform:scale(.97);transition:transform var(--fd-dur-1) var(--fd-ease-out);box-shadow:0 0 0 1px var(--h-c),0 6px 20px -8px var(--h-c)}
.fd-hold-btn:focus-visible{outline:2px solid rgba(10,132,255,.8);outline-offset:2px}
.fd-hold-btn:disabled{opacity:.4;cursor:not-allowed}
.fd-hold-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 var(--h-px);white-space:nowrap}
.fd-hold-fill{position:absolute;inset:0;background:var(--h-c);color:var(--h-on);
  clip-path:inset(0 calc((1 - var(--h-p)) * 100% + 0px) 0 0);will-change:clip-path}
.fd-hold[data-phase="done"] .fd-hold-fill{clip-path:inset(0)}
.fd-hold-icon{display:grid;place-items:center;width:18px;height:18px}
.fd-hold-icon svg{width:100%;height:100%}
.fd-hold-text{display:block}
.fd-hold-check path{stroke-dasharray:24;stroke-dashoffset:24;animation:fd-hold-draw 380ms var(--fd-ease-out) 80ms forwards}
.fd-hold-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes fd-hold-draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.fd-hold-btn,.fd-hold[data-phase="holding"] .fd-hold-btn{transform:none;transition:none}.fd-hold-check path{animation:none;stroke-dashoffset:0}}
@media (prefers-contrast:more){.fd-hold-btn{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const trash = (
  <svg aria-hidden="true" focusable="false" viewBox="0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 2h6a2 2-2l1-12M9 7V4h6v3" /></svg>
);

export function Demo() {
  return (
    <div className="fd-holdd" data-fd-theme="light">
      <style>{demoCss}</style>
      <HoldToConfirm tone="danger" size="lg" icon={trash} duration={1500} label="Hold to delete" holdingLabel="Deleting" doneLabel="Deleted" theme="light" />
    </div>
  );
}

const demoCss = `
.fd-holdd,.fd-holdd *,.fd-holdd *::before,.fd-holdd *::after{box-sizing:border-box}
.fd-holdd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f4f4f4;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
`;
