import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, RotateCcw, Lightbulb, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export function Card({ title, icon, children, className = '', actions }: { title?: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
          <h3 className="font-semibold text-sm flex items-center gap-2">{icon}{title}</h3>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-raised p-0.5 flex-wrap">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${value === o.value ? 'bg-surface shadow-sm text-ink' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-accent' : 'bg-line'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      {label}
    </label>
  );
}

const CALLOUT = {
  tip: { icon: Lightbulb, cls: 'border-teal/40 bg-teal/5', ic: 'text-teal' },
  warn: { icon: AlertTriangle, cls: 'border-warn/40 bg-warn/5', ic: 'text-warn' },
  ok: { icon: CheckCircle2, cls: 'border-ok/40 bg-ok/5', ic: 'text-ok' },
  info: { icon: Info, cls: 'border-accent/40 bg-accent/5', ic: 'text-accent' },
};
export function Callout({ kind = 'info', title, children }: { kind?: keyof typeof CALLOUT; title?: string; children: ReactNode }) {
  const C = CALLOUT[kind];
  return (
    <div className={`border rounded-lg p-3 flex gap-3 ${C.cls}`}>
      <C.icon className={`w-4 h-4 mt-0.5 shrink-0 ${C.ic}`} aria-hidden />
      <div className="text-sm leading-relaxed">{title && <div className="font-semibold mb-0.5">{title}</div>}{children}</div>
    </div>
  );
}

export function SlideRef({ s }: { s: string }) {
  return <span className="chip bg-accent/10 text-accent font-mono" title="Lecture 8 slide reference">slide {s}</span>;
}

export const STAGE_COLOR: Record<string, string> = { IF: 'bg-sif', ID: 'bg-sid', EX: 'bg-sex', MEM: 'bg-smem', WB: 'bg-swb' };
export const STAGE_STROKE: Record<string, string> = { IF: 'rgb(var(--s-if))', ID: 'rgb(var(--s-id))', EX: 'rgb(var(--s-ex))', MEM: 'rgb(var(--s-mem))', WB: 'rgb(var(--s-wb))' };

/** Zoom/pan container for SVG diagrams: wheel zoom, drag pan, buttons, reset. */
export function ZoomPan({ width, height, children, className = '', minH = 260 }: { width: number; height: number; children: ReactNode; className?: string; minH?: number }) {
  const [vb, setVb] = useState({ x: 0, y: 0, w: width, h: height });
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const reset = () => setVb({ x: 0, y: 0, w: width, h: height });
  const zoom = (f: number, cx = 0.5, cy = 0.5) => setVb((v) => {
    const w = Math.min(width * 1.5, Math.max(width / 6, v.w * f)), h = (w / v.w) * v.h;
    return { x: v.x + (v.w - w) * cx, y: v.y + (v.h - h) * cy, w, h };
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) return; // don't hijack page scroll
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(e.deltaY > 0 ? 1.12 : 0.89, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={`relative rounded-lg border border-line bg-bg overflow-hidden ${className}`}>
      <svg ref={ref} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="w-full h-auto touch-none cursor-grab active:cursor-grabbing" style={{ minHeight: minH }}
        role="img"
        onPointerDown={(e) => { if ((e.target as Element).closest('[data-click]')) return; drag.current = { px: e.clientX, py: e.clientY, vx: vb.x, vy: vb.y }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (!drag.current || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          const k = vb.w / r.width;
          setVb((v) => ({ ...v, x: drag.current!.vx - (e.clientX - drag.current!.px) * k, y: drag.current!.vy - (e.clientY - drag.current!.py) * k }));
        }}
        onPointerUp={() => { drag.current = null; }}>
        {children}
      </svg>
      <div className="absolute right-2 top-2 flex gap-1">
        <button className="btn !px-1.5 !py-1" onClick={() => zoom(0.8)} aria-label="Zoom in"><Plus className="w-3.5 h-3.5" /></button>
        <button className="btn !px-1.5 !py-1" onClick={() => zoom(1.25)} aria-label="Zoom out"><Minus className="w-3.5 h-3.5" /></button>
        <button className="btn !px-1.5 !py-1" onClick={reset} aria-label="Reset view"><RotateCcw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="absolute left-2 bottom-1.5 text-[10px] text-muted pointer-events-none hidden sm:block">drag to pan · ctrl+scroll to zoom</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="font-mono text-[10px] border border-line rounded px-1 bg-raised">{children}</kbd>;
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'accent'; hint?: string }) {
  const t = tone ? { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', accent: 'text-accent' }[tone] : '';
  return (
    <div className="rounded-lg bg-raised px-3 py-2" title={hint}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-mono font-semibold text-lg ${t}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted leading-tight">{hint}</div>}
    </div>
  );
}
