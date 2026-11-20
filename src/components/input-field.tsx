import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix" | "onChange" | "value" | "defaultValue">;

export interface InputFieldProps extends Base {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  helper?: ReactNode;
  error?: ReactNode;
  success?: boolean | string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  clearable?: boolean;
  multiline?: boolean;
  rows?: number;
  size?: "md" | "lg";
  theme?: "light" | "dark";
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  {
    label,
    value,
    defaultValue = "",
    onChange,
    type = "text",
    helper,
    error,
    success,
    prefix,
    suffix,
    maxLength,
    clearable,
    multiline,
    rows = 3,
    size = "md",
    theme,
    disabled,
    readOnly,
    placeholder,
    className,
    id,
    onFocus,
    onBlur,
    ...rest
  },
  fwd,
) {
  const uid = useId();
  const fid = id ?? `${uid}-f`;
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useImperativeHandle(fwd, () => el.current as HTMLInputElement);
  const [inner, setInner] = useState(defaultValue);
  const [focus, setFocus] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const val = value ?? inner;
  const isPw = type === "password";
  const floated = focus || val.length > 0 || !!prefix || autofilled || (!!placeholder && false);
  const state = error ? "error" : success ? "success" : "idle";

  // browsers fill autofill values without firing change on some engines
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (el.current && el.current.value && !val) setAutofilled(true);
    }, 150);
    return () => window.clearTimeout(t);
  }, [val]);

  const set = useCallback(
    (v: string) => {
      if (value === undefined) setInner(v);
      onChange?.(v);
    },
    [onChange, value],
  );

  const hid = `${fid}-help`;
  const eid = `${fid}-err`;
  const cid = `${fid}-cnt`;
  const describedBy = [error ? eid : helper ? hid : null, maxLength ? cid : null].filter(Boolean).join("") || undefined;
  const showClear = clearable && val.length > 0 && !disabled && !readOnly;
  const successMsg = typeof success === "string" ? success : null;

  const common = {
    id: fid,
    ref: el,
    value: val,
    disabled,
    readOnly,
    maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: "fd-in-control",
    placeholder: floated ? placeholder : undefined,
    onChange: (e: { target: { value: string } }) => {
      setAutofilled(false);
      set(e.target.value);
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocus(true);
      onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      setFocus(false);
      onBlur?.(e);
    },
  };

  return (
    <div className={`fd-in${className ? "" + className : ""}`} data-size={size} data-state={state} data-focus={focus || undefined} data-floated={floated || undefined} data-disabled={disabled || undefined} data-multiline={multiline || undefined} data-fd-theme={theme}>
      <style>{css}</style>
      <div className="fd-in-box">
        {prefix && <span className="fd-in-fix fd-in-pre">{prefix}</span>}
        <div className="fd-in-main">
          {multiline ? (
            <textarea {...(common as object)} rows={rows} {...(rest as object)} />
          ) : (
            <input {...common} type={isPw && reveal ? "text" : type} {...rest} />
          )}
          <label className="fd-in-label" htmlFor={fid}>{label}</label>
        </div>
        <span className="fd-in-end">
          {showClear && (
            <button type="button" className="fd-in-btn" aria-label={`Clear ${label}`} onClick={() => { set(""); el.current?.focus(); }}>
              <svg width="16" height="16" viewBox="0 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 20 0-20zm3.7 12.3a1 1-1.4 1.4L12 13.4l-2.3 2.3a1 1-1.4-1.4l2.3-2.3-2.3-2.3a1 1.4-1.4l2.3 2.3 2.3-2.3a1 1.4 1.4L13.4 12z" /></svg>
            </button>
          )}
          {isPw && (
            <button type="button" className="fd-in-btn" aria-label={reveal ? "Hide password" : "Show password"} aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>
              {reveal ? (
                <svg width="18" height="18" viewBox="0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 1 12 6c5 8.5 4 9.5 6a14 14 1-2.6 3.4M6.6 7.7A14 2.5 12c1 2 4.5 6 1.5 2.8-.4 4-.9M9.9 10a3 3 4.1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          )}
          {suffix && <span className="fd-in-fix fd-in-suf">{suffix}</span>}
          {state === "success" && (
            <span className="fd-in-state fd-in-ok" aria-hidden="true">
              <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
          )}
          {state === "error" && (
            <span className="fd-in-state fd-in-bad" aria-hidden="true">
              <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
            </span>
          )}
        </span>
      </div>

      <div className="fd-in-foot">
        <div className="fd-in-msgwrap" data-open={error || helper || successMsg ? "" : undefined}>
          <div className="fd-in-msgin">
            {error ? (
              <p id={eid} className="fd-in-msg fd-in-err" role="alert">{error}</p>
            ) : successMsg ? (
              <p className="fd-in-msg fd-in-okmsg">{successMsg}</p>
            ) : helper ? (
              <p id={hid} className="fd-in-msg">{helper}</p>
            ) : null}
          </div>
        </div>
        {maxLength !== undefined && (
          <span id={cid} className="fd-in-count" data-near={val.length >= maxLength * 0.9 || undefined} aria-live="off">
            {val.length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
});

const css = `
:where(.fd-in,.fd-in *){box-sizing:border-box;margin:0;padding:0;font:inherit;letter-spacing:inherit;color:inherit;text-decoration:none;list-style:none}
:where(.fd-in,.fd-in *)::before,:where(.fd-in,.fd-in *)::after{box-sizing:border-box}
:where(.fd-in svg){display:block;flex-shrink:0}
:where(.fd-in button,.fd-in input,.fd-in textarea){appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;outline:0}
.fd-in{
  --fd-ease-out:cubic-bezier(.22,1,.36,1);--fd-ease-in-out:cubic-bezier(.65,0,.35,1);--fd-spring:cubic-bezier(.34,1.56,.64,1);--fd-dur-1:120ms;--fd-dur-2:240ms;--fd-dur-3:420ms;
  --n-bg:#fff;--n-fg:#0B0B0F;--n-mut:#6B6B76;--n-line:rgba(11,11,15,.16);--n-line-h:rgba(11,11,15,.28);--n-accent:var(--fd-in-accent,#007AFF);--n-err:#D70015;--n-ok:#0F7D3F;--n-dis:#F1F1F4;
  --n-sh:0 1px 2px rgba(11,11,15,.04);
  display:block;width:100%;
  font:400 15px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif;letter-spacing:-.005em;color:var(--n-fg);
}
[data-fd-theme="dark"] .fd-in,.fd-in[data-fd-theme="dark"]{--n-bg:#16161B;--n-fg:#F5F5F7;--n-mut:#9A9AA6;--n-line:rgba(255,255,255,.14);--n-line-h:rgba(255,255,255,.26);--n-accent:var(--fd-in-accent,#0A84FF);--n-err:#FF6A60;--n-ok:#5BE382;--n-dis:#1B1B21;--n-sh:0 1px 0 rgba(255,255,255,.03) inset}
.fd-in[data-size="md"]{--n-h:52px}.fd-in[data-size="lg"]{--n-h:60px}
.fd-in-box{position:relative;display:flex;align-items:stretch;min-height:var(--n-h);border-radius:var(--fd-in-radius,14px);background:var(--n-bg);box-shadow:0 0 0 1px var(--n-line),var(--n-sh);
  transition:box-shadow var(--fd-dur-2) var(--fd-ease-out),background-color var(--fd-dur-2) var(--fd-ease-out)}
@media (hover:hover){.fd-in:not([data-disabled]):not([data-focus]):not([data-state="error"]):not([data-state="success"]) .fd-in-box:hover{box-shadow:0 0 0 1px var(--n-line-h),var(--n-sh)}}
.fd-in[data-focus] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-accent),0 0 0 5px color-mix(in srgb,var(--n-accent) 18%,transparent)}
.fd-in[data-state="error"] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-err)}
.fd-in[data-state="error"][data-focus] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-err),0 0 0 5px color-mix(in srgb,var(--n-err) 18%,transparent)}
.fd-in[data-state="success"] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-ok)}
.fd-in[data-state="success"][data-focus] .fd-in-box{box-shadow:0 0 0 1.5px var(--n-ok),0 0 0 5px color-mix(in srgb,var(--n-ok) 18%,transparent)}
.fd-in[data-disabled] .fd-in-box{background:var(--n-dis);box-shadow:0 0 0 1px var(--n-line);opacity:.65}
.fd-in-main{position:relative;flex:1;min-width:0;display:flex}
.fd-in-control{appearance:none;-webkit-appearance:none;border:0;outline:0;background:transparent;color:var(--n-fg);width:100%;min-width:0;height:auto;
  padding:calc(var(--n-h) * .42) 16px calc(var(--n-h) * .14);font-family:inherit;font-size:15px;line-height:1.3;font-weight:400;letter-spacing:inherit;caret-color:var(--n-accent);resize:none;
  text-overflow:ellipsis}
.fd-in[data-size="lg"] .fd-in-control{font-size:17px}
.fd-in[data-multiline] .fd-in-control{padding-top:26px;padding-bottom:12px;resize:vertical;min-height:calc(var(--n-h) * 1.5)}
.fd-in-control::placeholder{color:var(--n-mut);opacity:.75}
.fd-in-control:disabled{cursor:not-allowed}
.fd-in-control:-webkit-autofill{-webkit-text-fill-color:var(--n-fg);-webkit-box-shadow:0 0 0 100px var(--n-bg) inset;transition:background-color 9999s}
.fd-in-label{position:absolute;left:16px;top:calc(var(--n-h) / 2);max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;color:var(--n-mut);
  font-size:15px;line-height:1;transform:translateY(-50%);transform-origin:left top;
  transition:transform var(--fd-dur-2) var(--fd-ease-out),color var(--fd-dur-2) var(--fd-ease-out),top var(--fd-dur-2) var(--fd-ease-out)}
.fd-in[data-size="lg"] .fd-in-label{font-size:17px}
.fd-in[data-floated] .fd-in-label{top:calc(var(--n-h) * .3);transform:translateY(-50%) scale(.8)}
.fd-in[data-multiline]:not([data-floated]) .fd-in-label{top:calc(var(--n-h) / 2)}
.fd-in[data-focus] .fd-in-label{color:var(--n-accent)}
.fd-in[data-state="error"] .fd-in-label{color:var(--n-err)}
.fd-in[data-state="success"] .fd-in-label{color:var(--n-ok)}
.fd-in-fix{display:flex;align-items:center;color:var(--n-mut);font-size:15px;white-space:nowrap;user-select:none}
.fd-in-pre{padding:calc(var(--n-h) * .2) 0 0 16px}
.fd-in-pre+.fd-in-main .fd-in-control{padding-left:8px}.fd-in-pre+.fd-in-main .fd-in-label{left:8px}
.fd-in-end{display:flex;align-items:center;gap:2px;padding-right:12px}
.fd-in-suf{padding:calc(var(--n-h) * .2) 4px 0 4px}
.fd-in-btn{appearance:none;-webkit-appearance:none;border:0;outline:0;cursor:pointer;display:grid;place-items:center;width:32px;height:32px;border-radius:9999px;background:transparent;color:var(--n-mut);
  transform:scale(1);transition:transform var(--fd-dur-3) var(--fd-spring),background-color var(--fd-dur-1) var(--fd-ease-out),color var(--fd-dur-1) var(--fd-ease-out)}
@media (hover:hover){.fd-in-btn:hover{background:color-mix(in srgb,var(--n-fg) 7%,transparent);color:var(--n-fg)}}
.fd-in-btn:active{transform:scale(.92);transition:transform var(--fd-dur-1) var(--fd-ease-out)}
.fd-in-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--n-accent) 70%,transparent);outline-offset:1px}
.fd-in-state{display:grid;place-items:center;width:28px;height:28px;margin-left:2px;border-radius:9999px;animation:fd-in-pop var(--fd-dur-3) var(--fd-spring)}
.fd-in-ok{color:var(--n-ok)}.fd-in-bad{color:var(--n-err)}
.fd-in-ok path{stroke-dasharray:24;stroke-dashoffset:24;animation:fd-in-draw 380ms var(--fd-ease-out) 80ms forwards}
.fd-in-foot{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:0 4px}
.fd-in-msgwrap{display:grid;grid-template-rows:0fr;flex:1;transition:grid-template-rows var(--fd-dur-3) var(--fd-ease-out)}
.fd-in-msgwrap[data-open]{grid-template-rows:1fr}
.fd-in-msgin{overflow:hidden;min-height:0}
.fd-in-msg{padding-top:8px;font-size:13px;line-height:1.35;color:var(--n-mut)}
.fd-in-err{color:var(--n-err);animation:fd-in-slide var(--fd-dur-3) var(--fd-ease-out)}
.fd-in-okmsg{color:var(--n-ok)}
.fd-in-count{padding-top:8px;font-size:12px;line-height:1.35;color:var(--n-mut);font-variant-numeric:tabular-nums;transition:color var(--fd-dur-2) var(--fd-ease-out)}
.fd-in-count[data-near]{color:var(--n-err)}
@keyframes fd-in-pop{from{opacity:0;transform:scale(.4)}}
@keyframes fd-in-draw{to{stroke-dashoffset:0}}
@keyframes fd-in-slide{from{opacity:0;transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.fd-in-label,.fd-in-box,.fd-in-msgwrap{transition-duration:1ms}.fd-in-state,.fd-in-err{animation:none}.fd-in-ok path{animation:none;stroke-dashoffset:0}.fd-in-btn,.fd-in-btn:active{transform:none;transition:none}}
@media (prefers-contrast:more){.fd-in-box{box-shadow:0 0 0 1px currentColor}}
`;

/* ───────────────────────────── demo ───────────────────────────── */

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export function Demo() {
  const [name, setName] = useState("Amara Okonkwo");
  const [email, setEmail] = useState("amara.okonkwo@example.com");
  const [touched, setTouched] = useState(false);
  const [pw, setPw] = useState("");

  const err = touched && !emailOk(email) ? "Enter a full address, like amara@example.com" : undefined;

  return (
    <div className="fd-inputd">
      <style>{demoCss}</style>
      <form className="fd-inputd-card" onSubmit={(e) => e.preventDefault()} noValidate>
        <InputField label="Full name" value={name} onChange={setName} clearable autoComplete="name" />
        <InputField label="Email" type="email" value={email} onChange={setEmail} onBlur={() => setTouched(true)} error={err} success={!err && emailOk(email)} autoComplete="email" />
        <InputField label="Password" type="password" value={pw} onChange={setPw} autoComplete="new-password" helper="At least 10 characters." />
      </form>
    </div>
  );
}

const F = `ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Segoe UI",Roboto,sans-serif`;

const demoCss = `
.fd-inputd,.fd-inputd *,.fd-inputd *::before,.fd-inputd *::after{box-sizing:border-box}
.fd-inputd{display:flex;align-items:center;justify-content:center;min-height:100vh;width:100%;margin:0;padding:32px 20px;color:#1d1d1f;font:400 15px/1.4 ${F};letter-spacing:normal;background:#f1f1f2}
.fd-inputd-card{display:flex;flex-direction:column;gap:18px;width:100%;max-width:380px;margin:0;padding:28px;border-radius:24px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.03),0 18px 40px -22px rgba(0,0,0,.2)}
`;
