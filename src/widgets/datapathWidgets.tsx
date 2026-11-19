import { useMemo, useState } from 'react';
import { parse, type Op } from '../sim/isa';
import { controlFor, ALU_NAME, SIGNAL_INFO } from '../sim/control';
import { initialState, multicycleSteps, stepSingle } from '../sim/singleCycle';
import Datapath, { COMPONENTS, ACTIVE_COMPS, type CompId } from '../components/Datapath';
import { Segmented, Stat } from '../components/ui';

const SAMPLE: Record<string, string> = { add: 'add x5, x2, x3', sub: 'sub x5, x2, x3', and: 'and x5, x2, x3', or: 'or x5, x2, x3', ld: 'ld x5, 8(x2)', sd: 'sd x3, 8(x2)', beq: 'beq x2, x3, 16' };
const OPS = Object.keys(SAMPLE) as Op[];

function useTrace(op: Op, x2 = 40, x3 = 2) {
  return useMemo(() => {
    const ins = parse(SAMPLE[op])[0];
    const s = initialState({ 2: x2, 3: x3 }, { [x2 + 8]: 1234 });
    s.pc = 100;
    return stepSingle(s, ins).trace;
  }, [op, x2, x3]);
}

export function Inspector({ id }: { id: CompId | null }) {
  const c = COMPONENTS.find((k) => k.id === id);
  if (!c) return <div className="text-sm text-muted">Click (or Tab + Enter) any component in the diagram to inspect it.</div>;
  return (
    <div className="space-y-2 text-sm">
      <div className="font-semibold text-base">{c.name}</div>
      <p className="leading-relaxed">{c.role}</p>
      <div><span className="text-xs uppercase text-muted">Inputs</span><div>{c.inputs}</div></div>
      <div><span className="text-xs uppercase text-muted">Outputs</span><div>{c.outputs}</div></div>
      <div className="text-xs text-muted">Used by: {OPS.filter((o) => ACTIVE_COMPS[o].includes(c.id)).join(', ') || '-'} · Lecture slides {c.slides}</div>
    </div>
  );
}

/** Module 2: clickable CPU diagram with inspector. */
export function CpuClick() {
  const [sel, setSel] = useState<CompId | null>('RF');
  const [op, setOp] = useState<Op | 'none'>('none');
  const t = useTrace(op === 'none' ? 'add' : op);
  return (
    <div className="space-y-3">
      <Segmented label="Highlight path" value={op} onChange={setOp} options={[{ value: 'none', label: 'No highlight' }, ...['add', 'ld', 'sd', 'beq'].map((o) => ({ value: o as Op, label: o }))]} />
      <div className="grid lg:grid-cols-[1fr_280px] gap-3">
        <Datapath op={op === 'none' ? null : op} trace={op === 'none' ? null : t} selected={sel} onSelect={setSel} />
        <div className="card p-3"><Inspector id={sel} /></div>
      </div>
    </div>
  );
}

const STEPS = [
  { s: 1, t: 'Instruction fetch: PC, instruction memory and the +4 adder (slide 13).' },
  { s: 2, t: 'Add the register file: the instruction fields rs1, rs2, rd select registers (slide 14).' },
  { s: 3, t: 'Add the ALU and the write-back wire: enough for R-format instructions (slide 14).' },
  { s: 4, t: 'Add Imm Gen and the ALUSrc MUX so the ALU can add an offset (slide 15).' },
  { s: 5, t: 'Add data memory and the MemtoReg MUX: loads and stores now work (slides 15, 19).' },
  { s: 6, t: 'Add shift-left-1, branch adder, AND gate and the PC MUX for beq (slides 16, 20).' },
  { s: 7, t: 'Add the control unit and ALU control (slides 21–27).' },
];

/** Module 4: progressive datapath builder. */
export function Progressive() {
  const [stage, setStage] = useState(1);
  const [op, setOp] = useState<Op>('add');
  const t = useTrace(op);
  const supported: Record<Op, number> = { add: 3, sub: 3, and: 3, or: 3, ld: 5, sd: 5, beq: 6, nop: 1 };
  const can = stage >= supported[op];
  const [sel, setSel] = useState<CompId | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn" disabled={stage === 1} onClick={() => setStage(stage - 1)}>← Remove</button>
        <button className="btn btn-primary" disabled={stage === 7} onClick={() => setStage(stage + 1)}>Add next component →</button>
        <span className="text-xs text-muted">Step {stage}/7</span>
        <Segmented label="Instruction" value={op} onChange={setOp} options={['add', 'ld', 'sd', 'beq'].map((o) => ({ value: o as Op, label: o }))} />
      </div>
      <div className="rounded-lg bg-accent/5 border border-accent/30 p-3 text-sm">{STEPS[stage - 1].t}</div>
      <div className="grid lg:grid-cols-[1fr_260px] gap-3">
        <Datapath op={can ? op : null} trace={can ? t : null} maxStage={stage} showControl={stage >= 7} selected={sel} onSelect={setSel} />
        <div className="card p-3 space-y-3">
          <div className={`text-sm ${can ? 'text-ok' : 'text-warn'}`}>{can ? `✓ This datapath can execute ${op}.` : `✗ ${op} cannot execute yet. It needs step ${supported[op]}.`}</div>
          <Inspector id={sel} />
        </div>
      </div>
    </div>
  );
}

/** Module 5: control signal dashboard. */
export function ControlDashboard() {
  const [op, setOp] = useState<Op>('ld');
  const [x2, setX2] = useState(40);
  const [x3, setX3] = useState(40);
  const t = useTrace(op, x2, x3);
  const c = controlFor(op);
  const [focus, setFocus] = useState<string | null>(null);
  const sig: Record<string, string> = {
    RegWrite: String(c.RegWrite), ALUSrc: String(c.ALUSrc), MemRead: String(c.MemRead), MemWrite: String(c.MemWrite),
    MemtoReg: String(c.MemtoReg), Branch: String(c.Branch), ALUOp: `${c.ALUOp1}${c.ALUOp0}`, PCSrc: String(t.pcSrc),
  };
  const why: Record<string, Record<string, string>> = {
    RegWrite: { R: 'R-type produces a result for rd.', ld: 'ld writes the loaded value into rd.', sd: 'A store must not change any register.', beq: 'A branch produces no register result.' },
    ALUSrc: { R: 'Second operand is register rs2.', ld: 'Address needs the immediate offset.', sd: 'Address needs the immediate offset.', beq: 'Compare two registers: needs rs2.' },
    MemRead: { R: 'No memory access.', ld: 'Load reads data memory.', sd: 'Store writes, not reads.', beq: 'No memory access.' },
    MemWrite: { R: 'Must not modify memory.', ld: 'Must not modify memory.', sd: 'Store writes rs2 into memory.', beq: 'Must not modify memory.' },
    MemtoReg: { R: 'Write back the ALU result.', ld: 'Write back the memory data.', sd: 'Don’t care (X): RegWrite = 0, so nothing is written anyway.', beq: 'Don’t care (X): RegWrite = 0.' },
    Branch: { R: 'Not a branch.', ld: 'Not a branch.', sd: 'Not a branch.', beq: 'Branch: PCSrc follows the Zero output.' },
    ALUOp: { R: '10: let funct7/funct3 decide.', ld: '00: ALU adds (address).', sd: '00: ALU adds (address).', beq: '01: ALU subtracts (compare).' },
    PCSrc: { R: 'Branch = 0 → PC + 4.', ld: 'Branch = 0 → PC + 4.', sd: 'Branch = 0 → PC + 4.', beq: `Branch · Zero = 1 · ${t.zero ? 1 : 0}: ${t.zero ? 'take branch' : 'fall through'}.` },
  };
  const cls = ['add', 'sub', 'and', 'or'].includes(op) ? 'R' : op;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <Segmented label="Instruction" value={op} onChange={setOp} options={OPS.map((o) => ({ value: o, label: SAMPLE[o] }))} />
      </div>
      <div className="flex flex-wrap gap-3 items-center text-xs font-mono">
        <label>x2 <input type="number" className="input !w-20 inline" value={x2} onChange={(e) => setX2(+e.target.value | 0)} /></label>
        <label>x3 <input type="number" className="input !w-20 inline" value={x3} onChange={(e) => setX3(+e.target.value | 0)} /></label>
        <span className="text-muted">ALU control = {t.aluCtrl} ({ALU_NAME[t.aluCtrl]}) · ALU result = {t.aluResult} · next PC = {t.nextPc}</span>
      </div>
      <div className="grid xl:grid-cols-[1fr_360px] gap-3">
        <Datapath op={op} trace={t} signals={sig} focusSignal={focus} />
        <div className="card divide-y divide-line">
          {Object.entries(sig).map(([k, v]) => (
            <button key={k} onMouseEnter={() => setFocus(k)} onFocus={() => setFocus(k)} onMouseLeave={() => setFocus(null)} className="w-full text-left px-3 py-2 hover:bg-raised">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-sm">{k}</span>
                <span className={`chip font-mono ${v === 'X' ? 'bg-raised text-muted' : v.includes('1') ? 'bg-teal/15 text-teal' : 'bg-raised text-ink'}`}>{v === 'X' ? 'X (don’t care)' : v}{k !== 'ALUOp' && v !== 'X' ? (v === '1' ? ' asserted' : ' deasserted') : ''}</span>
              </div>
              <div className="text-[11px] text-muted">{SIGNAL_INFO[k].controls}</div>
              <div className="text-xs mt-0.5">{why[k][cls]}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Module 6: critical path. */
export function CriticalPath() {
  const [d, setD] = useState({ im: 200, rr: 100, alu: 200, dm: 200, rw: 100 });
  const rows: [string, (keyof typeof d)[]][] = [['ld', ['im', 'rr', 'alu', 'dm', 'rw']], ['sd', ['im', 'rr', 'alu', 'dm']], ['R-format', ['im', 'rr', 'alu', 'rw']], ['beq', ['im', 'rr', 'alu']]];
  const tot = rows.map(([, k]) => k.reduce((a, x) => a + d[x], 0));
  const max = Math.max(...tot);
  const col: Record<string, string> = { im: 'bg-sif', rr: 'bg-sid', alu: 'bg-sex', dm: 'bg-smem', rw: 'bg-swb' };
  const lbl: Record<string, string> = { im: 'Instr fetch', rr: 'Reg read', alu: 'ALU op', dm: 'Memory access', rw: 'Reg write' };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(d) as (keyof typeof d)[]).map((k) => (
          <label key={k} className="text-xs font-mono flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${col[k]}`} />{lbl[k]}
            <input type="number" className="input !w-20" value={d[k]} onChange={(e) => setD({ ...d, [k]: Math.max(0, +e.target.value | 0) })} /></label>
        ))}
      </div>
      {rows.map(([n, ks], i) => (
        <div key={n} className="flex items-center gap-2">
          <div className="w-20 font-mono text-xs">{n}</div>
          <div className="flex-1 relative h-6 bg-raised rounded">
            <div className="absolute inset-y-0 left-0 flex">{ks.map((k) => <div key={k} className={`${col[k]} h-6 border-r border-bg`} style={{ width: `${(d[k] / max) * 100}%`, minWidth: 0 }} title={`${lbl[k]} ${d[k]} ps`} />)}</div>
            <div className="absolute inset-y-0 left-0 border-r-2 border-dashed border-warn" style={{ width: '100%' }} />
          </div>
          <div className={`w-28 font-mono text-xs ${tot[i] === max ? 'text-warn font-bold' : ''}`}>{tot[i]} ps{tot[i] === max ? ' ← critical' : ` (idle ${max - tot[i]})`}</div>
        </div>
      ))}
      <p>Single-cycle clock period = <b>{max} ps</b>. Every instruction pays it, even when it finishes earlier, so the idle time is wasted.</p>
    </div>
  );
}

/** Module 6: single-cycle vs multicycle side by side. */
export function SingleVsMulti() {
  const [op, setOp] = useState<Op>('ld');
  const [step, setStep] = useState(0);
  const [stepPs, setStepPs] = useState(200);
  const ms = multicycleSteps(parse(SAMPLE[op])[0]);
  const t = useTrace(op);
  const cur = ms[Math.min(step, ms.length - 1)];
  const mix = { ld: 0.25, sd: 0.1, R: 0.45, beq: 0.2 };
  const avgCpi = mix.ld * 5 + mix.sd * 4 + mix.R * 4 + mix.beq * 3;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3 items-center">
        <Segmented label="Instruction" value={op} onChange={(v) => { setOp(v); setStep(0); }} options={['add', 'ld', 'sd', 'beq'].map((o) => ({ value: o as Op, label: SAMPLE[o] }))} />
        <label className="text-xs font-mono">multicycle step (ps) <input type="number" className="input !w-20 inline" value={stepPs} onChange={(e) => setStepPs(Math.max(1, +e.target.value | 0))} /></label>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card p-3 space-y-2">
          <div className="font-semibold">Single-cycle</div>
          <div className="text-xs text-muted">One long 800 ps clock. Separate instruction/data memories, ALU + 2 adders. Every unit used at most once.</div>
          <div className="h-8 rounded bg-accent/80 text-white text-xs flex items-center px-2">1 cycle · 800 ps · all of: fetch → regs → ALU → memory → write</div>
          <div className="font-mono text-xs">Result: {t.writeReg !== null ? `x${t.writeReg} = ${t.writeData}` : t.memWritten !== null ? `M[${t.memAddr}] = ${t.memWritten}` : `next PC = ${t.nextPc}`}</div>
          <div className="grid grid-cols-2 gap-2"><Stat label="CPI" value="1" /><Stat label="Time" value="800 ps" /></div>
        </div>
        <div className="card p-3 space-y-2">
          <div className="font-semibold">Multicycle</div>
          <div className="text-xs text-muted">Short clock; one shared memory and one ALU reused in different cycles; IR, MDR, A, B, ALUOut hold values between steps.</div>
          <div className="flex gap-1">{ms.map((m, i) => (
            <button key={i} onClick={() => setStep(i)} className={`flex-1 h-8 rounded text-[10px] font-semibold ${i === step ? 'bg-teal text-white' : i < step ? 'bg-teal/30' : 'bg-raised'}`}>{i + 1}. {m.name}</button>
          ))}</div>
          <div className="rounded bg-raised p-2 font-mono text-xs">{cur.rtl}</div>
          <div className="flex flex-wrap gap-1">{['PC', 'Memory', 'IR', 'MDR', 'Registers', 'A', 'B', 'ImmGen', 'ALU', 'ALUOut'].map((u) => <span key={u} className={`chip ${cur.units.includes(u) ? 'bg-teal/20 text-teal' : 'bg-raised text-muted'}`}>{u}</span>)}</div>
          <div className="flex gap-2"><button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Prev</button><button className="btn btn-primary" disabled={step >= ms.length - 1} onClick={() => setStep(step + 1)}>Next step</button></div>
          <div className="grid grid-cols-2 gap-2"><Stat label="CPI" value={ms.length} /><Stat label="Time" value={`${ms.length * stepPs} ps`} tone={ms.length * stepPs > 800 ? 'bad' : 'ok'} /></div>
        </div>
      </div>
      <p className="text-xs text-muted">Example mix 25% ld, 10% sd, 45% R, 20% beq → average multicycle CPI = {avgCpi.toFixed(2)} → {(avgCpi * stepPs).toFixed(0)} ps/instruction vs 800 ps single-cycle (CPI values are the classic multicycle counts; the mix is illustrative).</p>
    </div>
  );
}
