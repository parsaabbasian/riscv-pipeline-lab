import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Repeat, AlertTriangle, ArrowRightLeft, GitBranch, Database, PenLine } from 'lucide-react';
import { parse, ParseError, type Instr } from '../sim/isa';
import { initialState } from '../sim/singleCycle';
import { DEFAULT_OPTS, dependencies, runPipe, STAGES, timingChart, type PipeOptions, type PipeState } from '../sim/pipeline';
import { STAGE_COLOR, Segmented, Stat, Toggle, ZoomPan, STAGE_STROKE } from '../components/ui';
import { useApp } from '../store';

export function parseKV(s: string): Record<number, number> {
  const out: Record<number, number> = {};
  s.split(/[,\n]/).forEach((p) => {
    const m = /^\s*x?(-?\d+)\s*[=:]\s*(-?\d+)\s*$/.exec(p);
    if (m) out[+m[1]] = +m[2];
  });
  return out;
}

export interface RunnerProps {
  program: string;
  regs?: string;
  mem?: string;
  opts?: Partial<PipeOptions>;
  show?: { options?: (keyof PipeOptions)[]; datapath?: boolean; editor?: boolean; state?: boolean };
  title?: string;
  /** remember the forwarding toggle as a simulator preference */
  persist?: boolean;
}

export function usePipeRun(src: string, regsS: string, memS: string, opts: PipeOptions) {
  return useMemo(() => {
    try {
      const prog = parse(src);
      const base = initialState(parseKV(regsS), parseKV(memS));
      const run = runPipe(prog, base, opts);
      return { prog, run, chart: timingChart(run), error: null as string | null };
    } catch (e) {
      return { prog: [] as Instr[], run: null, chart: [], error: e instanceof ParseError || e instanceof Error ? e.message : String(e) };
    }
  }, [src, regsS, memS, opts]);
}

export function usePlayer(len: number) {
  const speed = useApp((s) => s.simSpeed);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setIdx(0); setPlaying(false); }, [len]);
  useEffect(() => {
    if (!playing) return;
    if (idx >= len - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx((i) => Math.min(i + 1, len - 1)), speed);
    return () => clearTimeout(t);
  }, [playing, idx, len, speed]);
  return { idx, setIdx, playing, setPlaying };
}

export function PlayerControls({ p, len }: { p: ReturnType<typeof usePlayer>; len: number }) {
  const speed = useApp((s) => s.simSpeed);
  const setSpeed = useApp((s) => s.setSimSpeed);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn btn-primary" onClick={() => p.setPlaying(!p.playing)} disabled={p.idx >= len - 1 && !p.playing} aria-label={p.playing ? 'Pause' : 'Play'}>
        {p.playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{p.playing ? 'Pause' : 'Play'}
      </button>
      <button className="btn" onClick={() => { p.setPlaying(false); p.setIdx(Math.max(0, p.idx - 1)); }} disabled={p.idx === 0} aria-label="Previous step"><SkipBack className="w-4 h-4" />Prev</button>
      <button className="btn" onClick={() => { p.setPlaying(false); p.setIdx(Math.min(len - 1, p.idx + 1)); }} disabled={p.idx >= len - 1} aria-label="Next step"><SkipForward className="w-4 h-4" />Next</button>
      <button className="btn" onClick={() => { p.setPlaying(false); p.setIdx(0); }} aria-label="Reset"><RotateCcw className="w-4 h-4" />Reset</button>
      <button className="btn" onClick={() => { p.setIdx(0); p.setPlaying(true); }} aria-label="Replay"><Repeat className="w-4 h-4" />Replay</button>
      <label className="flex items-center gap-2 text-xs text-muted ml-1">Speed
        <input type="range" min={150} max={1500} step={50} value={1650 - speed} onChange={(e) => setSpeed(1650 - +e.target.value)} aria-label="Animation speed" />
      </label>
    </div>
  );
}

export function TimingChart({ chart, upTo, total }: { chart: ReturnType<typeof timingChart>; upTo: number; total: number }) {
  const cols = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className="text-xs font-mono border-separate border-spacing-0.5 w-max">
        <thead>
          <tr><th className="text-left text-muted font-medium pr-3 sticky left-0 bg-surface">Instruction \ cycle</th>{cols.map((c) => <th key={c} className={`min-w-[2.5rem] text-center font-medium ${c === upTo ? 'text-accent' : 'text-muted'}`}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {chart.map((r) => (
            <tr key={r.id}>
              <td className="pr-3 whitespace-nowrap sticky left-0 bg-surface">{r.text}</td>
              {cols.map((c) => {
                const cell = r.cells[c];
                if (!cell || c > upTo) return <td key={c} className="min-w-[2.5rem] h-7 rounded bg-raised/40" />;
                const cls = cell.mark === 'stall' ? 'bg-warn/25 text-warn border border-warn/50 border-dashed' : cell.mark === 'flush' ? 'bg-bad/20 text-bad line-through' : `${STAGE_COLOR[cell.stage]} text-white`;
                return <td key={c} className={`min-w-[2.5rem] h-7 text-center rounded font-semibold ${cls}`} title={cell.mark ?? cell.stage}>{cell.stage}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-muted">
        {STAGES.map((s) => <span key={s} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${STAGE_COLOR[s]}`} />{s}</span>)}
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warn/25 border border-warn border-dashed" />waiting (stall)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-bad/20" />thrown away (flushed)</span>
      </div>
    </div>
  );
}

export function StageStrip({ st }: { st: PipeState }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {STAGES.map((s) => {
        const d = st.occupancy[s];
        const m = st.marks[s];
        return (
          <div key={s} className="rounded-lg border border-line overflow-hidden">
            <div className={`${STAGE_COLOR[s]} text-white text-[11px] font-bold px-2 py-0.5`}>{s}</div>
            <div className="px-2 py-1.5 text-[11px] font-mono min-h-[38px] leading-tight">
              {m === 'bubble' ? <span className="text-warn">bubble (nop)</span> : m === 'flush' && !d ? <span className="text-bad">flushed slot</span> : d ? <>{d.instr.text}{m === 'stall' && <div className="text-warn">stalled</div>}{m === 'flush' && <div className="text-bad">flushed</div>}</> : <span className="text-muted">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Pipelined datapath with pipeline-register contents (slides 54–61). */
export function PipeDatapathView({ st, buggy }: { st: PipeState; buggy?: boolean }) {
  const X = [20, 205, 390, 575, 760];
  const latch = [
    { name: 'IF/ID', x: 178, rows: st.ifid ? [`inst: ${st.ifid.d.instr.text}`, `PC: ${st.ifid.d.pc}`] : [st.bub.ID ? 'bubble' : 'empty'] },
    { name: 'ID/EX', x: 363, rows: st.idex ? [`${st.idex.d.instr.text}`, `RD1: ${st.idex.rd1}`, `RD2: ${st.idex.rd2}`, `imm: ${st.idex.imm}`, `rd: x${st.idex.rd}`, `ALUSrc=${st.idex.ctrl.ALUSrc} RW=${st.idex.ctrl.RegWrite}`] : [st.bub.EX ? 'bubble (ctrl = 0)' : 'empty'] },
    { name: 'EX/MEM', x: 548, rows: st.exmem ? [`${st.exmem.d.instr.text}`, `ALU: ${st.exmem.aluResult}`, `Zero: ${st.exmem.zero ? 1 : 0}`, `store: ${st.exmem.storeData}`, `rd: x${st.exmem.rd}`, `MR=${st.exmem.ctrl.MemRead} MW=${st.exmem.ctrl.MemWrite}`] : [st.bub.MEM ? 'bubble' : 'empty'] },
    { name: 'MEM/WB', x: 733, rows: st.memwb ? [`${st.memwb.d.instr.text}`, `mem: ${st.memwb.memData ?? '—'}`, `ALU: ${st.memwb.aluResult}`, `rd: x${st.memwb.rd}`, `RW=${st.memwb.ctrl.RegWrite} M2R=${st.memwb.ctrl.MemtoReg}`] : [st.bub.WB ? 'bubble' : 'empty'] },
  ];
  const names = ['Instruction fetch', 'Decode / reg read', 'Execute / address', 'Memory access', 'Write back'];
  const nextWb = st.memwb && st.memwb.ctrl.RegWrite === 1;
  return (
    <ZoomPan width={940} height={330} minH={220}>
      <text x={20} y={318} fontSize={10} fill="rgb(var(--muted))">Contents latched at the END of cycle {st.cycle} (what each stage will use in cycle {st.cycle + 1})</text>
      {STAGES.map((s, k) => (
        <g key={s}>
          <rect x={X[k]} y={20} width={150} height={270} rx={10} fill={STAGE_STROKE[s].replace('))', ') / 0.08)')} stroke={STAGE_STROKE[s]} strokeWidth={1.2} />
          <text x={X[k] + 10} y={40} fontWeight={700} fontSize={14} fill={STAGE_STROKE[s]}>{s}</text>
          <text x={X[k] + 10} y={56} fontSize={10} fill="rgb(var(--muted))">{names[k]}</text>
          <text x={X[k] + 10} y={84} fontSize={11} fontFamily="JetBrains Mono" fill="rgb(var(--ink))">{st.occupancy[s]?.instr.text ?? (st.marks[s] === 'bubble' ? 'bubble' : '—')}</text>
        </g>
      ))}
      {latch.map((l) => (
        <g key={l.name}>
          <rect x={l.x} y={100} width={50} height={190} rx={4} fill="rgb(var(--raised))" stroke="rgb(var(--muted))" />
          <text x={l.x + 25} y={95} textAnchor="middle" fontSize={10} fontWeight={700} fill="rgb(var(--ink))">{l.name}</text>
        </g>
      ))}
      {latch.map((l) => (
        <g key={l.name + 't'}>
          {l.rows.map((r, i) => (
            <text key={i} x={l.x - 18} y={118 + i * 15} fontSize={9.5} fontFamily="JetBrains Mono" fill={i === 0 ? 'rgb(var(--accent))' : 'rgb(var(--ink))'}>
              <tspan style={{ paintOrder: 'stroke' }} stroke="rgb(var(--bg))" strokeWidth={3}>{r}</tspan>
            </text>
          ))}
        </g>
      ))}
      {/* write-back path to register file in ID */}
      <path d="M 910 280 L 930 280 L 930 305 L 280 305 L 280 290" fill="none" stroke={nextWb ? 'rgb(var(--s-wb))' : 'rgb(var(--line))'} strokeWidth={nextWb ? 2.4 : 1.2} markerEnd="url(#arrW)" />
      <defs><marker id="arrW" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--s-wb))" /></marker></defs>
      {nextWb && (
        <text x={560} y={300} fontSize={10} fontFamily="JetBrains Mono" fill={buggy ? 'rgb(var(--bad))' : 'rgb(var(--s-wb))'}>
          next WB: Write register = {buggy ? `IF/ID.rd = x${st.ifid?.d.instr.rd ?? st.memwb!.rd} ✗` : `MEM/WB.rd = x${st.memwb!.rd} ✓`}
        </text>
      )}
    </ZoomPan>
  );
}

const OPT_LABEL: Record<keyof PipeOptions, string> = { forwarding: 'Forwarding', branchPolicy: 'Branch policy', unifiedMemory: 'Single shared memory', buggyWriteRegister: 'Wrong-register bug' };

export default function PipelineRunner({ program, regs = '', mem = '', opts: o0, show = {}, title, persist = false }: RunnerProps) {
  const fwPref = useApp((s) => s.forwarding);
  const setFwPref = useApp((s) => s.setForwarding);
  const [src, setSrc] = useState(program);
  const [regsS, setRegs] = useState(regs);
  const [memS, setMem] = useState(mem);
  const [opts, setOpts] = useState<PipeOptions>({ ...DEFAULT_OPTS, forwarding: o0?.forwarding ?? (persist ? fwPref : true), ...o0 });
  const { run, chart, error } = usePipeRun(src, regsS, memS, opts);
  const beginner = useApp((s) => s.mode) === 'beginner';
  const deps = useMemo(() => (run ? dependencies(run) : []), [run]);
  const len = run?.states.length ?? 1;
  const p = usePlayer(len);
  const [tab, setTab] = useState<'chart' | 'datapath'>(show.datapath ? 'datapath' : 'chart');
  const st = run?.states[Math.min(p.idx, len - 1)];
  const editor = show.editor ?? true;
  const options = show.options ?? ['forwarding', 'branchPolicy'];
  const prevSt = run && p.idx > 0 ? run.states[p.idx - 1] : null;

  return (
    <div className="space-y-3">
      {title && <h4 className="font-semibold">{title}</h4>}
      <div className={`grid gap-3 ${editor ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
        {editor && (
          <div className="space-y-2">
            <label className="text-xs text-muted flex items-center gap-1"><PenLine className="w-3 h-3" />Program (add, sub, and, or, ld, sd, beq, nop; labels ok)</label>
            <textarea className="input h-40 resize-y" spellCheck={false} value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Assembly program" />
            <label className="text-xs text-muted">Initial registers (e.g. x2=10, x3=5)</label>
            <input className="input" value={regsS} onChange={(e) => setRegs(e.target.value)} aria-label="Initial registers" />
            <label className="text-xs text-muted">Initial memory (byte address=value)</label>
            <input className="input" value={memS} onChange={(e) => setMem(e.target.value)} aria-label="Initial memory" />
            {error && <div className="text-xs text-bad flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}</div>}
          </div>
        )}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-3 items-center">
            {options.includes('forwarding') && <Toggle checked={opts.forwarding} onChange={(b) => { setOpts({ ...opts, forwarding: b }); if (persist) setFwPref(b); }} label={OPT_LABEL.forwarding} />}
            {options.includes('unifiedMemory') && <Toggle checked={opts.unifiedMemory} onChange={(b) => setOpts({ ...opts, unifiedMemory: b })} label={OPT_LABEL.unifiedMemory} />}
            {options.includes('buggyWriteRegister') && <Toggle checked={!opts.buggyWriteRegister} onChange={(b) => setOpts({ ...opts, buggyWriteRegister: !b })} label="Carry rd through pipeline (fix)" />}
            {options.includes('branchPolicy') && <Segmented label="Branch policy" value={opts.branchPolicy} onChange={(v) => setOpts({ ...opts, branchPolicy: v })} options={[{ value: 'predict-not-taken', label: 'Predict not taken' }, { value: 'stall', label: 'Stall on branch' }]} />}
          </div>
          {run && st && (
            <>
              <PlayerControls p={p} len={len} />
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <Stat label="Cycle" value={`${st.cycle}/${run.cycles}`} tone="accent" hint={beginner ? 'clock ticks so far' : undefined} />
                <Stat label="PC" value={st.pc} hint={beginner ? 'address fetched next' : undefined} />
                <Stat label="Completed" value={st.committed} tone="ok" hint={beginner ? 'instructions finished' : undefined} />
                <Stat label="Stalls" value={st.stalls} tone={st.stalls ? 'warn' : undefined} hint={beginner ? 'cycles spent waiting' : undefined} />
                <Stat label="Flushes" value={st.flushes} tone={st.flushes ? 'bad' : undefined} hint={beginner ? 'wrong guesses thrown away' : undefined} />
                <Stat label="CPI" value={st.committed ? (st.cycle / st.committed).toFixed(2) : '—'} hint={beginner ? 'cycles per finished instr.' : undefined} />
              </div>
              {st.cycle > 0 ? <StageStrip st={st} /> : <div className="text-sm text-muted">Cycle 0 — the pipeline is empty. Press <b>Next</b> to advance one clock tick, or <b>Play</b> to run.</div>}
              {st.cycle > 0 && <Narration st={st} />}
              {beginner && <HowToRead />}
              <div className="flex gap-2">
                <Segmented label="View" value={tab} onChange={setTab} options={[{ value: 'chart', label: 'Timing diagram' }, { value: 'datapath', label: 'Pipeline registers' }]} />
              </div>
              <div className="card p-3">
                {tab === 'chart' ? <TimingChart chart={chart} upTo={st.cycle} total={run.cycles} /> : <PipeDatapathView st={st} buggy={opts.buggyWriteRegister} />}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="card p-3">
                  <div className="text-xs font-semibold mb-2 text-muted">Events in cycle {st.cycle}</div>
                  <ul className="space-y-1 text-xs">
                    {st.events.length === 0 && <li className="text-muted">No events.</li>}
                    {st.events.map((e, i) => {
                      const I = e.kind === 'stall' || e.kind === 'structural' || e.kind === 'bug' ? AlertTriangle : e.kind === 'branch' || e.kind === 'flush' ? GitBranch : e.kind === 'mem' ? Database : ArrowRightLeft;
                      const c = { stall: 'text-warn', structural: 'text-warn', bug: 'text-bad', flush: 'text-bad', branch: 'text-teal', mem: 'text-smem', write: 'text-ok', forward: 'text-accent', info: '' }[e.kind];
                      return <li key={i} className={`flex gap-1.5 ${c}`}><I className="w-3.5 h-3.5 shrink-0 mt-px" /><span>{e.text}</span></li>;
                    })}
                    {st.forwards.map((f, i) => (
                      <li key={'f' + i} className="flex gap-1.5 text-accent"><ArrowRightLeft className="w-3.5 h-3.5 shrink-0 mt-px" />Forward {f.from}.rd = x{f.reg} (value {f.value}) → {f.stage} {f.operand}</li>
                    ))}
                  </ul>
                </div>
                {(show.state ?? true) && (
                  <div className="card p-3">
                    <div className="text-xs font-semibold mb-2 text-muted">Registers & memory after cycle {st.cycle}</div>
                    <div className="grid grid-cols-4 gap-1 text-[11px] font-mono">
                      {st.regs.map((v, r) => ({ v, r })).filter(({ v, r }) => v !== 0 || r === 0 || prevSt?.regs[r] !== v).slice(0, 24).map(({ v, r }) => (
                        <div key={r} className={`rounded px-1.5 py-0.5 ${prevSt && prevSt.regs[r] !== v ? 'bg-ok/20 text-ok' : 'bg-raised'}`}>x{r}={v}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[11px] font-mono mt-2">
                      {Object.entries(st.mem).sort((a, b) => +a[0] - +b[0]).map(([a, v]) => (
                        <div key={a} className={`rounded px-1.5 py-0.5 ${prevSt && prevSt.mem[+a] !== v ? 'bg-smem/20 text-smem' : 'bg-raised'}`}>M[{a}]={v}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DepTable deps={deps} upTo={st.cycle} run={run} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const DOING: Record<string, (t: string, ins: Instr) => string> = {
  IF: (t) => `${t} is being fetched from instruction memory`,
  ID: (t, i) => `${t} is being decoded and its registers are read${i.op === 'beq' ? ' (the branch decision is made here)' : ''}`,
  EX: (t, i) => i.op === 'ld' || i.op === 'sd' ? `${t} is computing its memory address in the ALU` : i.op === 'beq' ? `${t} passes through EX (nothing left to do)` : `${t} is calculating its result in the ALU`,
  MEM: (t, i) => i.op === 'ld' ? `${t} is reading data memory` : i.op === 'sd' ? `${t} is writing data memory` : `${t} passes through MEM (no memory needed)`,
  WB: (t, i) => i.op === 'sd' || i.op === 'beq' ? `${t} finishes (nothing to write back)` : `${t} writes its result into x${i.rd}`,
};

/** Plain-English description of what every stage is doing this cycle. */
function Narration({ st }: { st: PipeState }) {
  return (
    <div className="rounded-lg border border-line p-3 text-sm space-y-1">
      <div className="text-xs font-semibold text-muted mb-1">In plain English — cycle {st.cycle}</div>
      {STAGES.map((s) => {
        const d = st.occupancy[s], m = st.marks[s];
        let text: string;
        if (m === 'bubble') text = 'empty slot (a “bubble”) — nothing useful happens here this cycle';
        else if (!d) text = m === 'flush' ? 'empty — a wrongly fetched instruction was thrown away' : 'empty';
        else if (m === 'stall') text = `${d.instr.text} is waiting (stalled) for a value it needs`;
        else if (m === 'flush') text = `${d.instr.text} was fetched by mistake and is being thrown away`;
        else text = DOING[s](d.instr.text, d.instr);
        return (
          <div key={s} className="flex gap-2 items-baseline">
            <span className={`${STAGE_COLOR[s]} text-white text-[10px] font-bold rounded px-1.5 w-10 text-center shrink-0`}>{s}</span>
            <span className={m === 'stall' || m === 'bubble' ? 'text-warn' : m === 'flush' ? 'text-bad' : !d ? 'text-muted' : ''}>{text}</span>
          </div>
        );
      })}
    </div>
  );
}

function HowToRead() {
  return (
    <details className="rounded-lg border border-line p-3 text-sm">
      <summary className="cursor-pointer font-medium">How do I read this simulator?</summary>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-muted">
        <li>A program runs like an <b className="text-ink">assembly line</b> with 5 stations: IF (fetch), ID (decode), EX (calculate), MEM (memory), WB (write result).</li>
        <li>Every press of <b className="text-ink">Next</b> is one clock tick: every instruction moves one station to the right.</li>
        <li>In the <b className="text-ink">timing diagram</b>, each row is one instruction and each column is one clock tick. A diagonal staircase means everything is flowing.</li>
        <li><span className="text-warn">Amber dashed</span> cells mean an instruction had to <b className="text-ink">wait</b>, because it needs a result that isn’t ready yet.</li>
        <li><span className="text-bad">Red</span> cells mean an instruction was fetched by mistake (after a branch) and thrown away.</li>
        <li>Change the program on the left, or flip <b className="text-ink">Forwarding</b>, and see how the number of cycles changes.</li>
      </ul>
    </details>
  );
}

function DepTable({ deps, upTo, run }: { deps: ReturnType<typeof dependencies>; upTo: number; run: NonNullable<ReturnType<typeof usePipeRun>['run']> }) {
  if (!deps.length) return <div className="text-xs text-muted">No data dependencies between nearby instructions in this program.</div>;
  // a dependency becomes "visible" once its consumer has been decoded
  const decodedAt = (id: number) => run.states.findIndex((s) => s.occupancy.ID?.id === id);
  return (
    <div className="card p-3">
      <div className="text-xs font-semibold mb-2 text-muted">Data dependencies (read-after-write) and how the pipeline handled them</div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead className="text-muted text-left"><tr><th className="py-1 pr-3 font-medium">Producer</th><th className="pr-3 font-medium">Consumer</th><th className="pr-3 font-medium">Reg</th><th className="pr-3 font-medium">Distance</th><th className="pr-3 font-medium">Stalls</th><th className="font-medium">Resolution</th></tr></thead>
          <tbody>
            {deps.map((d, i) => {
              const vis = decodedAt(d.consumer) !== -1 && decodedAt(d.consumer) <= upTo;
              return (
                <tr key={i} className={`border-t border-line/60 ${vis ? '' : 'opacity-40'}`}>
                  <td className="py-1 pr-3 font-mono whitespace-nowrap">{d.producerText}</td>
                  <td className="pr-3 font-mono whitespace-nowrap">{d.consumerText}</td>
                  <td className="pr-3 font-mono">x{d.reg}</td>
                  <td className="pr-3">{d.distance}</td>
                  <td className={`pr-3 ${d.stallCycles ? 'text-warn font-semibold' : ''}`}>{d.stallCycles}</td>
                  <td className={d.resolution.startsWith('forward') ? 'text-accent' : d.stallCycles ? 'text-warn' : 'text-ok'}>{d.resolution}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-muted mt-1">Distance = how many instructions later the consumer comes. Rows fade in once the consumer reaches ID.</div>
    </div>
  );
}
