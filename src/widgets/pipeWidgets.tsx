import { useMemo, useState } from 'react';
import { Segmented, Stat, Toggle } from '../components/ui';
import PipelineRunner from './PipelineRunner';

/** Laundry analogy (slide 37). */
export function Laundry() {
  const [n, setN] = useState(4);
  const [piped, setPiped] = useState(true);
  const st = ['Wash', 'Dry', 'Fold', 'Store'];
  const col = ['bg-sif', 'bg-sex', 'bg-smem', 'bg-swb'];
  const slots = piped ? n + 3 : n * 4;
  const seqH = n * 2, pipH = (n + 3) * 0.5;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-xs">Loads: <input type="range" min={1} max={10} value={n} onChange={(e) => setN(+e.target.value)} aria-label="Number of loads" /> <b>{n}</b></label>
        <Toggle checked={piped} onChange={setPiped} label="Pipelined" />
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px] space-y-1">
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-14 text-xs font-mono">Load {String.fromCharCode(65 + i)}</div>
              <div className="flex-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${slots}, 1fr)` }}>
                {Array.from({ length: slots }, (_, s) => {
                  const k = piped ? s - i : s - i * 4;
                  return <div key={s} className={`h-6 rounded-sm text-[9px] text-white flex items-center justify-center ${k >= 0 && k < 4 ? col[k] : 'bg-raised'}`}>{k >= 0 && k < 4 ? st[k] : ''}</div>;
                })}
              </div>
            </div>
          ))}
          <div className="flex text-[10px] text-muted pl-14">each slot = 30 min</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Sequential" value={`${seqH} h`} />
        <Stat label="Pipelined" value={`${pipH} h`} tone="ok" />
        <Stat label="Speedup" value={(seqH / pipH).toFixed(2)} tone="accent" />
      </div>
      <p className="text-xs text-muted">Speedup = 2n / (0.5n + 1.5). n = 4 → 8 / 3.5 = 2.3. As n grows, speedup → 4 = number of stages. Each load still takes 2 h (latency unchanged).</p>
    </div>
  );
}

/** Performance calculator (slides 39–41). */
export function PerfCalc() {
  const [t, setT] = useState([200, 100, 200, 200, 100]);
  const [n, setN] = useState(3);
  const [stalls, setStalls] = useState(0);
  const names = ['IF', 'ID', 'EX', 'MEM', 'WB'];
  const single = t.reduce((a, b) => a + b, 0); // ld uses every stage
  const clk = Math.max(...t);
  const sc = n * single;
  const pp = (n + 4 + stalls) * clk;
  const curve = [1, 2, 3, 5, 10, 20, 50, 100, 1000].map((k) => ({ k, s: (k * single) / ((k + 4) * clk) }));
  const maxS = single / clk;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {t.map((v, i) => (
          <label key={i} className="text-xs font-mono">{names[i]} ps <input type="number" className="input !w-20" value={v} onChange={(e) => setT(t.map((x, j) => (j === i ? Math.max(1, +e.target.value | 0) : x)))} /></label>
        ))}
        <label className="text-xs font-mono">instructions <input type="number" className="input !w-24" value={n} onChange={(e) => setN(Math.max(1, +e.target.value | 0))} /></label>
        <label className="text-xs font-mono">stall cycles <input type="number" className="input !w-20" value={stalls} onChange={(e) => setStalls(Math.max(0, +e.target.value | 0))} /></label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Single-cycle clock" value={`${single} ps`} />
        <Stat label="Pipelined clock" value={`${clk} ps`} />
        <Stat label="Single-cycle time" value={`${sc} ps`} />
        <Stat label="Pipelined time" value={`${pp} ps`} tone="ok" />
      </div>
      <div className="rounded-lg bg-raised p-3 font-mono text-xs space-y-1">
        <div>single-cycle = n × T<sub>sc</sub> = {n} × {single} = {sc} ps</div>
        <div>pipelined = (n + k − 1 + stalls) × T<sub>stage</sub> = ({n} + 4 + {stalls}) × {clk} = {pp} ps</div>
        <div>speedup = {sc} / {pp} = <b className="text-accent">{(sc / pp).toFixed(2)}</b> (limit as n → ∞: {single}/{clk} = {maxS.toFixed(2)}; balanced stages would give 5)</div>
        <div>latency of one instruction: single-cycle {single} ps vs pipelined {5 * clk} ps</div>
      </div>
      <svg viewBox="0 0 520 170" className="w-full max-w-xl" role="img" aria-label="Speedup versus number of instructions">
        <line x1={40} y1={140} x2={510} y2={140} stroke="rgb(var(--line))" /><line x1={40} y1={10} x2={40} y2={140} stroke="rgb(var(--line))" />
        <line x1={40} x2={510} y1={140 - (maxS / Math.max(5, maxS)) * 125} y2={140 - (maxS / Math.max(5, maxS)) * 125} stroke="rgb(var(--warn))" strokeDasharray="4 3" />
        <text x={44} y={136 - (maxS / Math.max(5, maxS)) * 125} fontSize={9} fill="rgb(var(--warn))">limit {maxS.toFixed(2)}×</text>
        <polyline fill="none" stroke="rgb(var(--accent))" strokeWidth={2} points={curve.map((c, i) => `${40 + i * 58},${140 - (c.s / Math.max(5, maxS)) * 125}`).join(' ')} />
        {curve.map((c, i) => (
          <g key={c.k}>
            <circle cx={40 + i * 58} cy={140 - (c.s / Math.max(5, maxS)) * 125} r={3} fill="rgb(var(--accent))"><title>n = {c.k}: {c.s.toFixed(2)}×</title></circle>
            <text x={40 + i * 58} y={155} fontSize={9} textAnchor="middle" fill="rgb(var(--muted))">{c.k}</text>
          </g>
        ))}
        <text x={270} y={168} fontSize={9} textAnchor="middle" fill="rgb(var(--muted))">number of instructions (no stalls)</text>
        <text x={4} y={14} fontSize={9} fill="rgb(var(--muted))">speedup</text>
      </svg>
    </div>
  );
}

type Strat = 'not-taken' | 'taken' | 'btfn' | '1bit' | '2bit';
function lcg(seed: number) { let s = seed; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); }

/** Branch prediction laboratory (slides 51–53). */
export function BranchLab() {
  const [scenario, setScenario] = useState<'loop' | 'if' | 'custom'>('loop');
  const [iters, setIters] = useState(5);
  const [reps, setReps] = useState(3);
  const [prob, setProb] = useState(30);
  const [custom, setCustom] = useState('TTNTTNTTN');
  const [dir, setDir] = useState<'back' | 'fwd'>('back');
  const [strat, setStrat] = useState<Strat>('2bit');
  const [penalty, setPenalty] = useState(1);
  const outcomes = useMemo(() => {
    if (scenario === 'loop') return { d: 'back' as const, seq: Array.from({ length: reps }, () => [...Array(iters - 1).fill(true), false]).flat() as boolean[] };
    if (scenario === 'if') { const r = lcg(7); return { d: 'fwd' as const, seq: Array.from({ length: 20 }, () => r() * 100 < prob) }; }
    return { d: dir, seq: custom.toUpperCase().split('').filter((c) => c === 'T' || c === 'N').map((c) => c === 'T') };
  }, [scenario, iters, reps, prob, custom, dir]);
  const sim = useMemo(() => {
    let one = false; let two = 1; // 2-bit: 0,1 = predict NT; 2,3 = predict T (start weakly NT)
    return outcomes.seq.map((act) => {
      let pred: boolean;
      const state = strat === '1bit' ? (one ? 'T' : 'N') : strat === '2bit' ? ['strong N', 'weak N', 'weak T', 'strong T'][two] : '';
      switch (strat) {
        case 'not-taken': pred = false; break;
        case 'taken': pred = true; break;
        case 'btfn': pred = outcomes.d === 'back'; break;
        case '1bit': pred = one; one = act; break;
        case '2bit': pred = two >= 2; two = act ? Math.min(3, two + 1) : Math.max(0, two - 1); break;
      }
      return { act, pred, ok: pred === act, state };
    });
  }, [outcomes, strat]);
  const correct = sim.filter((s) => s.ok).length;
  const wasted = (sim.length - correct) * penalty;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3 items-center">
        <Segmented label="Scenario" value={scenario} onChange={setScenario} options={[{ value: 'loop', label: 'Loop (backward)' }, { value: 'if', label: 'If (forward)' }, { value: 'custom', label: 'Custom' }]} />
        <Segmented label="Strategy" value={strat} onChange={setStrat} options={[{ value: 'not-taken', label: 'Predict not taken' }, { value: 'taken', label: 'Always taken' }, { value: 'btfn', label: 'Static BTFN' }, { value: '1bit', label: 'Dynamic 1-bit' }, { value: '2bit', label: 'Dynamic 2-bit' }]} />
      </div>
      <div className="flex flex-wrap gap-3 items-center text-xs font-mono">
        {scenario === 'loop' && <><label>iterations <input type="number" className="input !w-16 inline" value={iters} min={2} onChange={(e) => setIters(Math.max(2, Math.min(30, +e.target.value | 0)))} /></label><label>times loop runs <input type="number" className="input !w-16 inline" value={reps} onChange={(e) => setReps(Math.max(1, Math.min(10, +e.target.value | 0)))} /></label></>}
        {scenario === 'if' && <label>% taken <input type="range" min={0} max={100} value={prob} onChange={(e) => setProb(+e.target.value)} /> {prob}%</label>}
        {scenario === 'custom' && <><label>outcomes (T/N) <input className="input !w-48 inline" value={custom} onChange={(e) => setCustom(e.target.value)} /></label><Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'back', label: 'backward' }, { value: 'fwd', label: 'forward' }]} /></>}
        <label>misprediction penalty (cycles) <input type="number" className="input !w-16 inline" value={penalty} onChange={(e) => setPenalty(Math.max(0, +e.target.value | 0))} /></label>
      </div>
      <div className="flex flex-wrap gap-1">
        {sim.map((s, i) => (
          <div key={i} className={`w-12 rounded border text-center text-[10px] font-mono py-1 ${s.ok ? 'border-ok/50 bg-ok/10' : 'border-bad/60 bg-bad/15'}`} title={s.state ? `predictor state before: ${s.state}` : ''}>
            <div className="text-muted">#{i + 1}</div><div>P:{s.pred ? 'T' : 'N'}</div><div className="font-bold">A:{s.act ? 'T' : 'N'}</div>
            {s.state && <div className="text-[8px] text-muted truncate">{s.state}</div>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Branches" value={sim.length} />
        <Stat label="Correct" value={correct} tone="ok" />
        <Stat label="Accuracy" value={sim.length ? `${((correct / sim.length) * 100).toFixed(0)}%` : '-'} tone="accent" />
        <Stat label="Wasted cycles" value={wasted} tone={wasted ? 'bad' : 'ok'} />
      </div>
      <p className="text-xs text-muted">P = prediction, A = actual. Each misprediction flushes the wrongly fetched instruction(s), costing {penalty} cycle(s) in the lecture’s pipeline with the branch resolved in ID. 1-bit and 2-bit counters are standard implementations of “record recent history” (background beyond the slide).</p>
    </div>
  );
}

export const PROGRAMS = {
  forward: { program: 'add x19, x0, x1\nsub x2, x19, x3', regs: 'x1=10, x3=4' },
  hazardMix: { program: 'sub x2, x1, x3\nand x12, x2, x5\nor x13, x6, x2\nadd x14, x2, x2\nsd x15, 100(x2)', regs: 'x1=10, x3=3, x5=6, x6=1, x15=99' },
  loadUse: { program: 'ld x1, 0(x2)\nsub x4, x1, x5', regs: 'x2=16, x5=3', mem: '16=50' },
  original: { program: 'ld x1, 0(x31)\nld x2, 8(x31)\nadd x3, x1, x2\nsd x3, 24(x31)\nld x4, 16(x31)\nadd x5, x1, x4\nsd x5, 32(x31)', regs: 'x31=0', mem: '0=10, 8=20, 16=30' },
  scheduled: { program: 'ld x1, 0(x31)\nld x2, 8(x31)\nld x4, 16(x31)\nadd x3, x1, x2\nsd x3, 24(x31)\nadd x5, x1, x4\nsd x5, 32(x31)', regs: 'x31=0', mem: '0=10, 8=20, 16=30' },
  structural: { program: 'ld x1, 0(x0)\nadd x2, x3, x4\nadd x5, x6, x7\nadd x8, x9, x10\nsub x11, x12, x13', regs: 'x3=1, x4=2', mem: '0=5' },
  branch: { program: 'add x5, x0, x0\nbeq x1, x2, skip\nadd x5, x5, x7\nadd x6, x6, x7\nskip: or x8, x7, x7', regs: 'x1=3, x2=3, x7=1' },
  loop: { program: '# x1 counts up to x2\nloop: add x1, x1, x3\nbeq x1, x2, done\nbeq x0, x0, loop\ndone: sd x1, 0(x0)', regs: 'x2=3, x3=1' },
  ldsd: { program: 'ld x10, 40(x1)\nsub x11, x2, x3\nadd x12, x3, x4\nld x13, 48(x1)\nadd x14, x5, x6\nsd x10, 0(x1)', regs: 'x1=0, x2=9, x3=4, x4=1, x5=2, x6=3', mem: '40=111, 48=222' },
  wrong: { program: 'ld x10, 40(x1)\nadd x11, x2, x3\nadd x12, x3, x4\nadd x13, x5, x6\nadd x14, x7, x8', regs: 'x1=0, x2=1, x3=2, x4=3, x5=4, x6=5, x7=6, x8=7', mem: '40=999' },
};

export function SchedulingLab() {
  return (
    <div className="grid 2xl:grid-cols-2 gap-6">
      <PipelineRunner title="Original order (slide 48), expect 13 cycles" {...PROGRAMS.original} show={{ options: ['forwarding'] }} />
      <PipelineRunner title="Scheduled order, expect 11 cycles" {...PROGRAMS.scheduled} show={{ options: ['forwarding'] }} />
    </div>
  );
}
