import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface SegmentOption {
  value: string;
  label: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  theme?: "light" | "dark";
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onChange,
  size = "md",
  fullWidth,
  theme,
  className,
  ...aria
}: SegmentedControlProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const track = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const el = refs.current[current];
    if (el) setRect({ x: el.offsetLeft, w: el.offsetWidth });
  }, [current]);

  useLayoutEffect(measure, [measure, options.length]);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 30);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && track.current) ro.observe(track.current);
    Object.values(refs.current).forEach((n) => n && ro?.observe(n));
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
    };
  }, [measure]);

  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  const onKey = (e: KeyboardEvent) => {
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.value === current);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % enabled.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = enabled.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const next = enabled[n];
    select(next.value);
    refs.current[next.value]?.focus();
  };

  return (
    <div className={`fd-seg${className ? "" + className : ""}`} data-size={size} data-full={fullWidth || undefined} data-ready={ready || undefined} data-fd-theme={theme}>
      <style>{css}</style>
      <div ref={track} className="fd-seg-track" role="radiogroup" onKeyDown={onKey} {...aria}>
        {rect && <span className="fd-seg-thumb" aria-hidden="true" style={{ transform: `translateX(${rect.x}px)`, width: rect.w }} />}
        {options.map((o) => {
          const on = o.value === current;
          return (
            <button
              key={o.value}
              ref={(n) => {
                refs.current[o.value] = n;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              disabled={o.disabled}
              className="fd-seg-opt"
              onClick={() => select(o.value)}
            >
              {o.icon && <span className="fd-seg-ic">{o.icon}</span>}
              <span className="fd-seg-label">{o.label}</span>
              {o.badge && <span className="fd-seg-badge">{o.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const css = `
:where(.fd-seg,.fd-seg *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-seg,.fd-seg *)::before,:where(.fd-seg,.fd-seg *)::after{box-sizing:border-box}
:where(.fd-seg svg){display:block;flex-shrink:0}
:where(.fd-seg button){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0}
.fd-seg{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --g-track:rgba(11,11,15,.06);--g-thumb:#fff;--g-fg:#0B0B0F;--g-mut:#6B6B76;--g-ring:rgba(0,122,255,.7);--g-badge-bg:rgba(0,122,255,.12);--g-badge-fg:#0058C7;
  --g-thumb-sh:0 0 0 .5px rgba(11,11,15,.06),0 1px 2px rgba(11,11,15,.12),0 3px 8px -2px rgba(11,11,15,.12);
  display:inline-flex;vertical-align:middle;max-width:100%;
  font:500 14px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--g-fg);
}
[data-fd-theme="dark"] .fd-seg,.fd-seg[data-fd-theme="dark"]{--g-track:rgba(255,255,255,.07);--g-thumb:#34343D;--g-fg:#F5F5F7;--g-mut:#9A9AA6;--g-ring:rgba(10,132,255,.85);--g-badge-bg:rgba(48,209,88,.18);--g-badge-fg:#5BE382;
  --g-thumb-sh:0 1px 0 rgba(255,255,255,.08) inset,0 0 0 .5px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.4)}
.fd-seg[data-full]{display:flex;width:100%}
.fd-seg[data-size="sm"]{--g-h:28px;--g-px:12px;--g-fs:13px}
.fd-seg[data-size="md"]{--g-h:36px;--g-px:16px;--g-fs:14px}
.fd-seg[data-size="lg"]{--g-h:44px;--g-px:22px;--g-fs:15px}
.fd-seg-track{position:relative;display:inline-flex;align-items:stretch;padding:3px;border-radius:9999px;background:var(--g-track);max-width:100%;overflow-x:auto;scrollbar-width:none}
.fd-seg-track::-webkit-scrollbar{display:none}
.fd-seg[data-full] .fd-seg-track{display:flex;width:100%}
.fd-seg[data-full] .fd-seg-opt{flex:1}
.fd-seg-thumb{position:absolute;z-index:0;left:0;top:3px;bottom:3px;border-radius:9999px;background:var(--g-thumb);box-shadow:var(--g-thumb-sh);pointer-events:none;will-change:transform,width}
.fd-seg[data-ready] .fd-seg-thumb{transition:transform var(--fd-dur-3) var(--fd-spring),width var(--fd-dur-3) var(--fd-spring)}
.fd-seg-opt{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:calc(var(--g-h) - 6px);padding:0 var(--g-px);border-radius:9999px;
  appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;background:transparent;white-space:nowrap;
  color:var(--g-mut);font-family:inherit;font-size:var(--g-fs);font-weight:500;line-height:1;letter-spacing:inherit;
  transform:scale(1);transition:color var(--fd-dur-2) var(--fd-ease-out),transform var(--fd-dur-3) var(--fd-spring)}
.fd-seg-opt[aria-checked="true"]{color:var(--g-fg)}
@media (hover:hover){.fd-seg-opt[aria-checked="false"]:hover:not(:disabled){color:var(--g-fg)}}
.fd-seg-opt:active{transform:scale(.96);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-seg-opt:focus-visible{outline:2px solid var(--g-ring);outline-offset:1px}
.fd-seg-opt:disabled{opacity:.4;cursor:not-allowed}
.fd-seg-ic{display:grid;place-items:center;width:16px;height:16px}.fd-seg-ic svg{width:100%;height:100%}
.fd-seg-label{display:block}
.fd-seg-badge{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:9999px;background:var(--g-badge-bg);color:var(--g-badge-fg);font-size:11px;font-weight:600;letter-spacing:0}
@media (prefers-reduced-motion:reduce){.fd-seg[data-ready] .fd-seg-thumb{transition:transform 1ms linear,width 1ms linear}.fd-seg-opt,.fd-seg-opt:active{transition:none;transform:none}}
@media (prefers-contrast:more){.fd-seg-track{box-shadow:0 0 0 1px currentColor}.fd-seg-thumb{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

export function Demo() {
  const [billing, setBilling] = useState("yearly");
  return (
    <div className="fd-segd">
      <style>{demoCss}</style>
      <SegmentedControl
        aria-label="Billing period"
        size="lg"
        value={billing}
        onChange={setBilling}
        options={[
          { value: "monthly", label: "Monthly" },
          { value: "yearly", label: "Yearly", badge: "-20%" },
        ]}
      />
    </div>
  );
}

const demoCss = `
.fd-segd,.fd-segd *,.fd-segd *::before,.fd-segd *::after{box-sizing:border-box}
.fd-segd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;overflow:hidden;background:#f4f4f4;color:#1d1d1f;font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:normal;-webkit-font-smoothing:antialiased}
`;
