import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { encode, parse, signExtend, type Instr } from '../sim/isa';
import { aluControl, ALU_NAME } from '../sim/control';
import { initialState, stepSingle } from '../sim/singleCycle';
import Datapath, { PHASE_WIRES } from '../components/Datapath';
import { Segmented, Toggle, ZoomPan } from '../components/ui';

const PRESETS = ['add x5, x2, x3', 'sub x5, x2, x3', 'and x5, x2, x3', 'or x5, x2, x3', 'ld x5, 8(x2)', 'sd x3, 8(x2)', 'beq x2, x3, 16'];

const numIn = (v: number, set: (n: number) => void, label: string) => (
  <label key={label} className="flex items-center gap-1.5 text-xs font-mono">{label}
    <input type="number" className="input !w-24" value={v} onChange={(e) => set(Number.isFinite(+e.target.value) ? Math.trunc(+e.target.value) : 0)} aria-label={label} />
  </label>
);

/** Module 1: walk one instruction through the functional units with live values. */
export function InstrWalk() {
  const [text, setText] = useState(PRESETS[0]);
  const [x2, setX2] = useState(7);
  const [x3, setX3] = useState(5);
  const [m, setM] = useState(42);
  const [pc, setPc] = useState(100);
  const [phase, setPhase] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const parsed = useMemo(() => { try { return parse(text)[0] ?? null; } catch { return null; } }, [text]);
  const r = useMemo(() => {
    if (!parsed) return null;
    const s = initialState({ 2: x2, 3: x3 }, { [x2 + parsed.imm]: m });
    s.pc = pc;
    return stepSingle(s, parsed);
  }, [parsed, x2, x3, m, pc]);
  if (!r || !parsed) return <div className="text-bad text-sm">Invalid instruction</div>;
  const t = r.trace;
  const I = parsed.op;
  const phases = [
    { name: '1 · Fetch', text: `PC = ${t.pc} is sent to instruction memory, which returns “${parsed.text}”. An adder computes PC + 4 = ${t.pcPlus4}.` },
    { name: '2 · Read registers', text: `Register numbers rs1 = x${parsed.rs1}${['ld'].includes(I) ? '' : `, rs2 = x${parsed.rs2}`} go to the register file → Read data 1 = ${t.readData1}${I === 'ld' ? '' : `, Read data 2 = ${t.readData2}`}.` },
    { name: '3 · ALU', text: I === 'ld' || I === 'sd' ? `ALU computes the memory address: ${t.readData1} + ${t.imm} = ${t.aluResult}.` : I === 'beq' ? `ALU subtracts to compare: ${t.readData1} − ${t.readData2} = ${t.aluResult} → Zero = ${t.zero ? 1 : 0}.` : `ALU performs ${I}: ${t.readData1} ${I === 'add' ? '+' : I === 'sub' ? '−' : I === 'and' ? 'AND' : 'OR'} ${t.aluB} = ${t.aluResult}.` },
    { name: '4 · Data memory', text: I === 'ld' ? `Read Mem[${t.aluResult}] = ${t.memRead}.` : I === 'sd' ? `Write ${t.memWritten} into Mem[${t.aluResult}].` : 'Not used by this instruction (data memory idle).' },
    { name: '5 · Write back & next PC', text: `${t.writeReg !== null ? `x${t.writeReg} ← ${t.writeData}. ` : 'No register is written. '}Next PC = ${t.pcSrc ? `branch target ${t.branchTarget}` : `PC + 4 = ${t.pcPlus4}`}.` },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs">Instruction
          <select className="input !w-48 block mt-1" value={PRESETS.includes(text) ? text : ''} onChange={(e) => { setText(e.target.value); setPhase(0); }}>
            {PRESETS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        {numIn(pc, (n) => setPc(n - (n % 4)), 'PC')}{numIn(x2, setX2, 'x2')}{numIn(x3, setX3, 'x3')}
        {I === 'ld' && numIn(m, setM, `Mem[${x2 + parsed.imm}]`)}
      </div>
      <div className="flex flex-wrap gap-1">
        {phases.map((p, k) => (
          <button key={k} onClick={() => setPhase(k)} className={`btn !text-xs ${phase === k ? 'btn-primary' : ''}`}>{p.name}</button>
        ))}
        <button className="btn !text-xs" onClick={() => setPhase((phase + 1) % 5)} aria-label="Next phase"><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
      <div className="rounded-lg bg-accent/5 border border-accent/30 p-3 text-sm"><b>{phases[phase].name}:</b> {phases[phase].text}</div>
      <Toggle checked={showAll} onChange={setShowAll} label="Highlight the whole instruction (all phases)" />
      <Datapath op={I} trace={t} limit={showAll ? null : PHASE_WIRES[phase]} />
      <p className="text-xs text-muted">Highlighted wires are those used in the selected phase by this instruction; values come from the simulator (try changing x2/x3).</p>
    </div>
  );
}

/** 2-to-1 MUX simulator. */
export function MuxSim() {
  const [i0, setI0] = useState(104);
  const [i1, setI1] = useState(116);
  const [s, setS] = useState(0);
  const y = s ? i1 : i0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">{numIn(i0, setI0, 'I0')}{numIn(i1, setI1, 'I1')}
        <Segmented label="Select S" value={String(s)} onChange={(v) => setS(+v)} options={[{ value: '0', label: 'S = 0' }, { value: '1', label: 'S = 1' }]} />
      </div>
      <ZoomPan width={520} height={220} minH={180}>
        <path d="M 40 70 L 220 70" stroke={s === 0 ? 'rgb(var(--accent))' : 'rgb(var(--line))'} strokeWidth={s === 0 ? 3 : 1.5} className="wire" />
        <path d="M 40 150 L 220 150" stroke={s === 1 ? 'rgb(var(--accent))' : 'rgb(var(--line))'} strokeWidth={s === 1 ? 3 : 1.5} className="wire" />
        <text x={40} y={60} fontFamily="JetBrains Mono" fontSize={14} fill="rgb(var(--ink))">I0 = {i0}</text>
        <text x={40} y={140} fontFamily="JetBrains Mono" fontSize={14} fill="rgb(var(--ink))">I1 = {i1}</text>
        <path d="M 220 40 L 290 70 L 290 150 L 220 180 Z" fill="rgb(var(--accent) / 0.1)" stroke="rgb(var(--accent))" strokeWidth={2} />
        <text x={248} y={115} fontWeight={700} fill="rgb(var(--ink))">M</text>
        <text x={228} y={75} fontSize={11} fill="rgb(var(--muted))">0</text><text x={228} y={155} fontSize={11} fill="rgb(var(--muted))">1</text>
        <path d={`M ${s ? 222 : 222} ${s ? 150 : 70} L 288 110`} stroke="rgb(var(--teal))" strokeWidth={2} strokeDasharray="4 3" />
        <path d="M 255 210 L 255 165" stroke="rgb(var(--teal))" strokeWidth={2} />
        <text x={264} y={208} fontSize={13} fontFamily="JetBrains Mono" fill="rgb(var(--teal))">S = {s}</text>
        <path d="M 290 110 L 470 110" stroke="rgb(var(--ok))" strokeWidth={3} />
        <text x={330} y={100} fontFamily="JetBrains Mono" fontSize={15} fontWeight={700} fill="rgb(var(--ok))">Y = {y}</text>
      </ZoomPan>
      <p className="text-sm">Y = S ? I1 : I0 = <code className="k">{s} ? {i1} : {i0}</code> = <b>{y}</b>. If you simply joined the two wires, both sources would drive the same wire with different values, which is an electrical conflict. The MUX makes the choice explicit.</p>
    </div>
  );
}

/** Combinational elements: AND, adder, MUX, ALU (slide 8). */
export function GatesSim() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(0);
  const [A, setAA] = useState(12);
  const [B, setBB] = useState(10);
  const [f, setF] = useState('0010');
  const res = f === '0000' ? A & B : f === '0001' ? A | B : f === '0010' ? A + B : A - B;
  return (
    <div className="grid md:grid-cols-2 gap-3 text-sm">
      <div className="card p-3 space-y-2">
        <div className="font-semibold">1-bit AND gate</div>
        <div className="flex gap-3">
          <Toggle checked={!!a} onChange={(v) => setA(+v)} label={`A = ${a}`} />
          <Toggle checked={!!b} onChange={(v) => setB(+v)} label={`B = ${b}`} />
        </div>
        <div>Y = A · B = <b className={a & b ? 'text-ok' : ''}>{a & b}</b> &nbsp;<span className="text-muted">(high voltage only if both inputs high)</span></div>
        <div className="font-mono text-xs text-muted">Truth table: 00→0 · 01→0 · 10→0 · 11→1</div>
      </div>
      <div className="card p-3 space-y-2">
        <div className="font-semibold">ALU: Y = F(A, B)</div>
        <div className="flex flex-wrap gap-2">{numIn(A, setAA, 'A')}{numIn(B, setBB, 'B')}</div>
        <Segmented label="ALU function" value={f} onChange={setF} options={['0000', '0001', '0010', '0110'].map((v) => ({ value: v, label: `${v} ${ALU_NAME[v]}` }))} />
        <div className="font-mono">Y = {res} &nbsp; Zero = {res === 0 ? 1 : 0}</div>
        <div className="font-mono text-xs text-muted">A = {(A >>> 0).toString(2).slice(-8).padStart(8, '0')} · B = {(B >>> 0).toString(2).slice(-8).padStart(8, '0')} (low 8 bits)</div>
      </div>
    </div>
  );
}

/** Edge-triggered register with write enable + interactive clock waveform (slides 9–10). */
export function RegisterSim({ withClockOnly = false }: { withClockOnly?: boolean }) {
  const [d, setD] = useState(8);
  const [q, setQ] = useState(3);
  const [we, setWe] = useState(true);
  const [clk, setClk] = useState(0);
  const [hist, setHist] = useState<{ clk: number; d: number; q: number; we: boolean; edge?: boolean }[]>([{ clk: 0, d: 8, q: 3, we: true }]);
  const [msg, setMsg] = useState('Clock is LOW. Change D and notice that Q does not follow.');
  const push = (c: number, nd: number, nq: number, nwe: boolean, edge = false) => setHist((h) => {
    const last = h[h.length - 1];
    // typing in D (no clock activity) updates the current time step instead of adding new ones
    if (!edge && last && last.clk === c && !last.edge && h.length > 1 && last.we === nwe) return [...h.slice(0, -1), { ...last, d: nd }];
    return [...h.slice(-39), { clk: c, d: nd, q: nq, we: nwe, edge }];
  });
  const toggleClock = () => {
    const nc = clk ? 0 : 1;
    let nq = q;
    if (nc === 1) {
      if (we || withClockOnly) { nq = d; setMsg(`Rising edge with Write = 1 → Q captures D = ${d}.`); }
      else setMsg('Rising edge but Write = 0 → Q keeps its value.');
    } else setMsg('Falling edge: edge-triggered registers ignore it. Q unchanged.');
    setClk(nc); setQ(nq); push(nc, d, nq, we, nc === 1);
  };
  const N = 12, SW = 56, X0 = 60;
  const view = hist.slice(-N);
  const lvl = (vals: number[], yTop: number, color: string) => {
    let d = '';
    vals.forEach((v, i) => {
      const y = v ? yTop : yTop + 22;
      d += `${i === 0 ? 'M' : 'L'}${X0 + i * SW},${y} L${X0 + (i + 1) * SW},${y} `;
    });
    return <path d={d} fill="none" stroke={color} strokeWidth={2} />;
  };
  const bus = (vals: number[], yTop: number, color: string) => {
    const segs: { v: number; a: number; b: number }[] = [];
    vals.forEach((v, i) => { const l = segs[segs.length - 1]; if (l && l.v === v) l.b = i + 1; else segs.push({ v, a: i, b: i + 1 }); });
    return segs.map((g, k) => {
      const x0 = X0 + g.a * SW, x1 = X0 + g.b * SW, ym = yTop + 11, c = 5;
      return (
        <g key={k}>
          <path d={`M${x0},${ym} L${x0 + c},${yTop} L${x1 - c},${yTop} L${x1},${ym} L${x1 - c},${yTop + 22} L${x0 + c},${yTop + 22} Z`} fill={color.replace('))', ') / 0.12)')} stroke={color} strokeWidth={1.5} />
          <text x={(x0 + x1) / 2} y={ym + 4} textAnchor="middle" fontSize={11} fontFamily="JetBrains Mono" fill="rgb(var(--ink))">{g.v}</text>
        </g>
      );
    });
  };
  const rows: [string, number][] = withClockOnly ? [['Clk', 14], ['D', 58], ['Q', 102]] : [['Clk', 14], ['Write', 58], ['D', 102], ['Q', 146]];
  const yOf = (l: string) => rows.find((r) => r[0] === l)![1];
  const H = rows.length * 44 + 10;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        {numIn(d, (n) => { setD(n); push(clk, n, q, we); setMsg(clk ? 'Clock HIGH but no edge: Q does not change.' : 'Clock LOW: D changed, Q holds.'); }, 'D')}
        {!withClockOnly && <Toggle checked={we} onChange={(b) => { setWe(b); push(clk, d, q, b); }} label={`Write = ${we ? 1 : 0}`} />}
        <button className="btn btn-primary" onClick={toggleClock}>{clk ? 'Clock ↓ (falling edge)' : 'Clock ↑ (rising edge)'}</button>
        <button className="btn" onClick={() => { setHist([{ clk: 0, d, q, we }]); setClk(0); }}>Clear waveform</button>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
        <svg viewBox="0 0 180 130" className="w-40 shrink-0" role="img" aria-label={`Register: D = ${d}, Q = ${q}`}>
          <rect x={45} y={15} width={90} height={100} rx={8} fill="rgb(var(--surface))" stroke="rgb(var(--accent))" strokeWidth={2} />
          <text x={52} y={50} fontSize={13} fill="rgb(var(--ink))">D</text><text x={118} y={50} fontSize={13} fill="rgb(var(--ink))">Q</text>
          <path d="M45 85 L57 92 L45 99" fill="none" stroke="rgb(var(--teal))" strokeWidth={1.6} />
          <text x={60} y={96} fontSize={10} fill="rgb(var(--muted))">Clk</text>
          {!withClockOnly && <text x={70} y={30} fontSize={10} fill="rgb(var(--muted))">Write</text>}
          <path d="M5 45 L45 45" stroke="rgb(var(--accent))" strokeWidth={2} /><text x={4} y={38} fontSize={11} fontFamily="JetBrains Mono" fill="rgb(var(--ink))">{d}</text>
          <path d="M135 45 L175 45" stroke="rgb(var(--ok))" strokeWidth={2} /><text x={140} y={38} fontSize={12} fontWeight={700} fontFamily="JetBrains Mono" fill="rgb(var(--ok))">{q}</text>
          <path d="M5 92 L45 92" stroke="rgb(var(--teal))" strokeWidth={2} /><text x={4} y={110} fontSize={10} fill="rgb(var(--teal))">{clk ? 'HIGH' : 'LOW'}</text>
        </svg>
          <div className="flex-1 min-w-[200px] rounded-lg bg-accent/5 border border-accent/30 p-3 text-sm">{msg}</div>
        </div>
        <div className="space-y-2">
          <svg viewBox={`0 0 ${X0 + N * SW + 6} ${H}`} className="w-full bg-bg rounded-lg border border-line" role="img" aria-label="Timing waveform of Clk, Write, D and Q">
            {rows.map(([l, y]) => <text key={l} x={8} y={y + 15} fontSize={12} fontWeight={600} fill="rgb(var(--muted))">{l}</text>)}
            {view.map((h, i) => h.edge && <line key={'e' + i} x1={X0 + i * SW} x2={X0 + i * SW} y1={6} y2={H - 4} stroke="rgb(var(--warn))" strokeDasharray="3 3" />)}
            {lvl(view.map((h) => h.clk), yOf('Clk'), 'rgb(var(--teal))')}
            {!withClockOnly && lvl(view.map((h) => (h.we ? 1 : 0)), yOf('Write'), 'rgb(var(--accent))')}
            {bus(view.map((h) => h.d), yOf('D'), 'rgb(var(--accent))')}
            {bus(view.map((h) => h.q), yOf('Q'), 'rgb(var(--ok))')}
            {view.length < N && <text x={X0 + view.length * SW + 8} y={H / 2} fontSize={11} fill="rgb(var(--muted))">← new events appear here</text>}
          </svg>
          <p className="text-xs text-muted">Amber dashed lines mark rising edges, the only moments Q may change.</p>
        </div>
      </div>
    </div>
  );
}

/** Clocking methodology & critical path. */
export function ClockSim() {
  const [delays, setDelays] = useState([200, 100, 200, 200, 100]);
  const names = ['Instr mem', 'Reg read', 'ALU', 'Data mem', 'Reg write'];
  const total = delays.reduce((a, b) => a + b, 0);
  const [period, setPeriod] = useState(800);
  const ok = period >= total;
  return (
    <div className="space-y-3 text-sm">
      <p>A path from one state element through combinational logic to the next. Edit the delays and the clock period:</p>
      <div className="flex flex-wrap gap-2">{delays.map((d, i) => numIn(d, (n) => setDelays(delays.map((x, j) => (j === i ? Math.max(0, n) : x))), names[i] + ' ps'))}</div>
      <div className="flex items-center gap-3">{numIn(period, setPeriod, 'Clock period (ps)')}<span>= {(1e3 / Math.max(1, period)).toFixed(2)} GHz</span></div>
      <div className="relative h-16 rounded-lg bg-bg border border-line overflow-hidden">
        {delays.reduce<{ x: number; els: JSX.Element[] }>((acc, d, i) => {
          const w = (d / Math.max(total, period)) * 100;
          acc.els.push(<div key={i} className="absolute top-2 h-6 rounded text-[10px] text-white flex items-center justify-center bg-accent/80 border-r border-bg overflow-hidden" style={{ left: `${acc.x}%`, width: `${w}%` }}>{names[i]}</div>);
          acc.x += w; return acc;
        }, { x: 0, els: [] }).els}
        <div className="absolute top-9 h-5 border-r-2 border-dashed border-warn text-[10px] text-warn pr-1 text-right" style={{ left: 0, width: `${(period / Math.max(total, period)) * 100}%` }}>next rising edge at {period} ps</div>
      </div>
      <div className={ok ? 'text-ok' : 'text-bad'}>{ok ? `OK: the critical path (${total} ps) finishes before the next edge.` : `Timing violation: the critical path needs ${total} ps but the clock edge arrives at ${period} ps, so the register would capture a wrong (unfinished) value.`}</div>
    </div>
  );
}

/** Imm Gen and effective address. */
export function ImmGenSim() {
  const [imm, setImm] = useState(-8);
  const [base, setBase] = useState(64);
  const v = Math.max(-2048, Math.min(2047, imm));
  const bits12 = ((v & 0xfff) >>> 0).toString(2).padStart(12, '0');
  const ext = (signExtend(v & 0xfff, 12) < 0 ? '1'.repeat(52) : '0'.repeat(52)) + bits12;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3">{numIn(imm, setImm, 'offset (−2048…2047)')}{numIn(base, setBase, 'base register x1')}</div>
      <div className="font-mono text-xs break-all">
        <div>12-bit field: <span className="text-accent">{bits12}</span></div>
        <div className="mt-1">sign-extended: <span className="text-warn">{ext.slice(0, 52)}</span><span className="text-accent">{ext.slice(52)}</span></div>
        <div className="text-muted mt-1">The sign bit ({bits12[0]}) is copied into the 52 upper bits (slide 17: “sign-bit wire replicated”).</div>
      </div>
      <div className="rounded-lg bg-raised p-3 font-mono">ld x4, {v}(x1) → address = {base} + ({v}) = <b className="text-ok">{base + v}</b></div>
      {imm !== v && <div className="text-warn text-xs">Value clamped: a 12-bit signed field can only hold −2048…2047.</div>}
    </div>
  );
}

/** Branch target / PC + 4. */
export function BranchCalc() {
  const [pc, setPc] = useState(40);
  const [field, setField] = useState(6);
  const [a, setA] = useState(9);
  const [b, setB] = useState(9);
  const off = field * 2;
  const taken = a - b === 0;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3">{numIn(pc, (n) => setPc(n - (n % 4)), 'PC')}{numIn(field, setField, 'imm field')}{numIn(a, setA, 'x5')}{numIn(b, setB, 'x6')}</div>
      <ol className="space-y-1 font-mono text-xs">
        <li>1. ALU: x5 − x6 = {a} − {b} = {a - b} → Zero = <b>{taken ? 1 : 0}</b></li>
        <li>2. Shift left 1: {field} &lt;&lt; 1 = {off} bytes</li>
        <li>3. Branch adder: PC + {off} = {pc + off}</li>
        <li>4. PC + 4 adder: {pc + 4}</li>
        <li>5. PCSrc = Branch · Zero = 1 · {taken ? 1 : 0} = {taken ? 1 : 0} → <b className="text-ok">next PC = {taken ? pc + off : pc + 4}</b></li>
      </ol>
    </div>
  );
}

/** Instruction format explorer with real encodings. */
export function Formats() {
  const [t, setT] = useState('add x9, x6, x7');
  let ins: Instr | null = null;
  try { ins = parse(t)[0] ?? null; } catch { ins = null; }
  const fields = ins ? encode(ins) : [];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2 flex-wrap">
        <input className="input !w-56" value={t} onChange={(e) => setT(e.target.value)} aria-label="Instruction to encode" />
        {['add x9, x6, x7', 'sub x9, x6, x7', 'ld x10, 40(x1)', 'sd x10, 40(x2)', 'beq x1, x2, 16'].map((p) => <button key={p} className="btn !text-xs" onClick={() => setT(p)}>{p}</button>)}
      </div>
      {!ins ? <div className="text-bad text-xs">Cannot parse.</div> : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[560px]">
            {fields.map((f) => (
              <div key={f.name} className="border border-line first:rounded-l-lg last:rounded-r-lg text-center" style={{ flex: f.width }}>
                <div className="text-[10px] text-muted bg-raised py-0.5">{f.name}</div>
                <div className="font-mono text-xs py-1 tracking-wider">{f.bits}</div>
                <div className="text-[10px] text-teal pb-1">{f.meaning}</div>
              </div>
            ))}
          </div>
          <div className="font-mono text-xs mt-2 text-muted">hex: 0x{parseInt(fields.map((f) => f.bits).join(''), 2).toString(16).padStart(8, '0')} · bits 31 → 0</div>
        </div>
      )}
      <p className="text-xs text-muted">Notice rs1 and rs2 always occupy the same bit positions. That is what lets the register file be read during decode (slide 42).</p>
    </div>
  );
}

/** ALU control truth table explorer (slides 22–24). */
export function AluCtrlSim() {
  const [aluop, setAluop] = useState('10');
  const [f7, setF7] = useState('0000000');
  const [f3, setF3] = useState('000');
  const out = aluControl(aluop, f7, f3);
  const rows = [
    ['ld', '00', 'XXXXXXX', 'XXX', 'add', '0010'], ['sd', '00', 'XXXXXXX', 'XXX', 'add', '0010'], ['beq', '01', 'XXXXXXX', 'XXX', 'subtract', '0110'],
    ['R-type add', '10', '0000000', '000', 'add', '0010'], ['R-type sub', '10', '0100000', '000', 'subtract', '0110'],
    ['R-type and', '10', '0000000', '111', 'AND', '0000'], ['R-type or', '10', '0000000', '110', 'OR', '0001'],
  ];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3 items-center">
        <Segmented label="ALUOp" value={aluop} onChange={setAluop} options={[{ value: '00', label: 'ALUOp 00' }, { value: '01', label: '01' }, { value: '10', label: '10' }]} />
        <Segmented label="funct7" value={f7} onChange={setF7} options={[{ value: '0000000', label: 'f7 0000000' }, { value: '0100000', label: '0100000' }]} />
        <Segmented label="funct3" value={f3} onChange={setF3} options={[{ value: '000', label: 'f3 000' }, { value: '111', label: '111' }, { value: '110', label: '110' }]} />
      </div>
      <div className="font-mono">ALU control = <b className="text-teal">{out}</b> ({ALU_NAME[out] ?? 'undefined combination'}) {aluop !== '10' && <span className="text-muted text-xs">(funct fields ignored, don’t care)</span>}</div>
      <div className="overflow-x-auto">
        <table className="text-xs font-mono w-full">
          <thead className="text-muted"><tr>{['Instruction', 'ALUOp', 'funct7', 'funct3', 'operation', 'ALU control'].map((h) => <th key={h} className="text-left py-1 pr-3">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => {
            const hit = r[1] === aluop && (aluop !== '10' || (r[2] === f7 && r[3] === f3));
            return <tr key={r[0]} className={hit ? 'bg-teal/10 text-teal' : ''}>{r.map((c, i) => <td key={i} className="py-1 pr-3">{c}</td>)}</tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
