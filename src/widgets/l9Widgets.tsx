import { useMemo, useState } from 'react';
import { CONTROL_TABLE } from '../sim/control';
import {
  branchStalls, DUAL_LOOP, DUAL_UNROLLED, exceptionTimeline, forwardingUnit, ipc, loadUseHazard, nestedLoopOutcomes, OOO_EXAMPLE, peak, runPredictor, schedule, type PredKind,
} from '../sim/lect9';
import { Segmented, Stat, Toggle } from '../components/ui';

const sbg = (s: string, a = 0.25) => ({ background: `rgb(var(--s-${s.toLowerCase()}) / ${a})` });

const regIn = (v: number, set: (n: number) => void, label: string) => (
  <label className="flex items-center gap-1.5 text-xs font-mono">{label}
    <span className="text-muted">x</span><input type="number" min={0} max={31} className="input !w-16" value={v} aria-label={label}
      onChange={(e) => set(Math.max(0, Math.min(31, Math.trunc(+e.target.value) || 0)))} />
  </label>
);
const SRC = { '00': 'ID/EX (register file)', '10': 'EX/MEM (prior ALU result)', '01': 'MEM/WB (memory or older ALU result)' } as const;

/** Slides 21–26: forwarding unit with live ForwardA / ForwardB. */
export function ForwardUnit() {
  const [exW, setExW] = useState(true), [exRd, setExRd] = useState(2);
  const [mwW, setMwW] = useState(true), [mwRd, setMwRd] = useState(2);
  const [rs1, setRs1] = useState(2), [rs2, setRs2] = useState(5);
  const [revised, setRevised] = useState(true);
  const r = forwardingUnit({ exmemRegWrite: exW, exmemRd: exRd, memwbRegWrite: mwW, memwbRd: mwRd, rs1, rs2 }, revised);
  const presets: [string, () => void][] = [
    ['sub → and (EX hazard)', () => { setExW(true); setExRd(2); setMwW(false); setMwRd(0); setRs1(2); setRs2(5); }],
    ['sub → or (MEM hazard)', () => { setExW(true); setExRd(12); setMwW(true); setMwRd(2); setRs1(6); setRs2(2); }],
    ['Double hazard (slide 25)', () => { setExW(true); setExRd(1); setMwW(true); setMwRd(1); setRs1(1); setRs2(4); }],
    ['Writes x0', () => { setExW(true); setExRd(0); setMwW(false); setMwRd(0); setRs1(0); setRs2(3); }],
    ['sd ahead (RegWrite 0)', () => { setExW(false); setExRd(2); setMwW(false); setMwRd(0); setRs1(2); setRs2(3); }],
  ];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">{presets.map(([l, f]) => <button key={l} className="btn !text-xs" onClick={f}>{l}</button>)}</div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-lg bg-raised p-3 space-y-2"><div className="text-xs font-semibold text-sid">ID/EX (instruction in EX)</div>{regIn(rs1, setRs1, 'RegisterRs1')}{regIn(rs2, setRs2, 'RegisterRs2')}</div>
        <div className="rounded-lg bg-raised p-3 space-y-2"><div className="text-xs font-semibold text-smem">EX/MEM (1 instruction ahead)</div><Toggle checked={exW} onChange={setExW} label="RegWrite" />{regIn(exRd, setExRd, 'RegisterRd')}</div>
        <div className="rounded-lg bg-raised p-3 space-y-2"><div className="text-xs font-semibold text-swb">MEM/WB (2 instructions ahead)</div><Toggle checked={mwW} onChange={setMwW} label="RegWrite" />{regIn(mwRd, setMwRd, 'RegisterRd')}</div>
      </div>
      <Toggle checked={revised} onChange={setRevised} label="Use the revised MEM-hazard condition (slide 26)" />
      <div className="grid md:grid-cols-2 gap-3">
        {(['A', 'B'] as const).map((k) => (
          <div key={k} className={`rounded-lg border p-3 ${r[k] === '00' ? 'border-line' : 'border-accent/60 bg-accent/5'}`}>
            <div className="font-mono font-semibold">Forward{k} = {r[k]}</div>
            <div className="text-xs text-muted">ALU operand {k === 'A' ? '1 (rs1)' : '2 (rs2)'} ← {SRC[r[k]]}</div>
            <p className="text-xs mt-2">{r.why[k]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Slides 28–31: load-use hazard detection unit. */
export function HazardUnit() {
  const [memRead, setMemRead] = useState(true), [rd, setRd] = useState(2);
  const [rs1, setRs1] = useState(2), [rs2, setRs2] = useState(5);
  const stall = loadUseHazard(memRead, rd, rs1, rs2);
  return (
    <div className="space-y-3 text-sm">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg bg-raised p-3 space-y-2"><div className="text-xs font-semibold text-sex">ID/EX (instruction in EX, e.g. ld)</div><Toggle checked={memRead} onChange={setMemRead} label="MemRead (is it a load?)" />{regIn(rd, setRd, 'RegisterRd')}</div>
        <div className="rounded-lg bg-raised p-3 space-y-2"><div className="text-xs font-semibold text-sid">IF/ID (instruction being decoded)</div>{regIn(rs1, setRs1, 'RegisterRs1')}{regIn(rs2, setRs2, 'RegisterRs2')}</div>
      </div>
      <div className={`rounded-lg border p-3 ${stall ? 'border-bad/60 bg-bad/10' : 'border-ok/50 bg-ok/10'}`}>
        <div className="font-semibold">{stall ? 'Hazard: stall one cycle' : 'No load-use hazard: keep going'}</div>
        <div className="font-mono text-xs mt-1">ID/EX.MemRead = {memRead ? 1 : 0} and (x{rd} = x{rs1} or x{rd} = x{rs2}) → {stall ? 'true' : 'false'}</div>
        {stall && <ul className="list-disc pl-5 text-xs mt-2 space-y-0.5"><li>Force control values in ID/EX to 0 (a bubble: EX, MEM and WB do nothing).</li><li>PCWrite = 0 and IF/IDWrite = 0: the using instruction is decoded again and the following one fetched again.</li><li>Next cycle the loaded value is in MEM/WB and is forwarded to EX.</li></ul>}
      </div>
      <p className="text-xs text-muted">Note: slide 28 prints “IF/ID.RegisterRs1” twice. The second comparison should be IF/ID.RegisterRs2, which is what this unit checks.</p>
    </div>
  );
}

/** Slides 16–18: control signals grouped by the stage that uses them. */
export function PipeControl() {
  const [op, setOp] = useState<keyof typeof CONTROL_TABLE>('ld');
  const c = CONTROL_TABLE[op];
  const groups = [
    { stage: 'EX', sigs: [['ALUSrc', c.ALUSrc], ['ALUOp', `${c.ALUOp1}${c.ALUOp0}`]] },
    { stage: 'MEM', sigs: [['Branch', c.Branch], ['MemRead', c.MemRead], ['MemWrite', c.MemWrite]] },
    { stage: 'WB', sigs: [['RegWrite', c.RegWrite], ['MemtoReg', c.MemtoReg]] },
  ];
  return (
    <div className="space-y-3 text-sm">
      <Segmented label="Instruction" value={op} onChange={setOp} options={[{ value: 'R', label: 'R-type' }, { value: 'ld', label: 'ld' }, { value: 'sd', label: 'sd' }, { value: 'beq', label: 'beq' }]} />
      <p className="text-xs text-muted">Control decodes the opcode once, in ID. The signals are put into ID/EX and travel along. Each pipeline register drops the group that its stage has already used.</p>
      <div className="grid grid-cols-4 gap-2 text-xs">
        {['ID/EX', 'EX/MEM', 'MEM/WB'].map((reg, ri) => (
          <div key={reg} className="contents">
            {ri === 0 && <div className="col-span-4 grid grid-cols-4 gap-2 font-semibold text-muted"><div>Pipeline reg</div><div>EX group</div><div>M group</div><div>WB group</div></div>}
            <div className="font-mono self-center">{reg}</div>
            {groups.map((g, gi) => (
              <div key={g.stage} className={`rounded p-2 font-mono ${gi >= ri ? '' : 'bg-raised text-muted line-through opacity-50'}`} style={gi >= ri ? sbg(g.stage) : undefined}>
                {g.sigs.map(([n, v]) => <div key={n as string}>{n} = {String(v)}</div>)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Slides 37–39: data hazards for a beq that is resolved in ID. */
export function BranchHazard() {
  const [kind, setKind] = useState<'alu' | 'load'>('load');
  const [dist, setDist] = useState(1);
  const n = branchStalls(kind, dist);
  const prod = kind === 'alu' ? 'add x1, x2, x3' : 'ld x1, 0(x2)';
  const filler = ['add x4, x5, x6', 'add x7, x8, x9'];
  const lines = [prod, ...filler.slice(0, dist - 1), 'beq x1, x4, target'];
  const beqRow = lines.length - 1;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3">
        <Segmented label="Producer" value={kind} onChange={setKind} options={[{ value: 'alu', label: 'ALU instruction' }, { value: 'load', label: 'Load' }]} />
        <Segmented label="Distance" value={String(dist) as '1'} onChange={(v) => setDist(+v)} options={[{ value: '1', label: 'Right before beq' }, { value: '2', label: '2nd before' }, { value: '3', label: '3rd before' }]} />
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs font-mono border-separate border-spacing-0.5">
          <thead><tr><th />{Array.from({ length: 9 }, (_, i) => <th key={i} className="w-12 text-muted font-normal">{i + 1}</th>)}</tr></thead>
          <tbody>
            {lines.map((l, r) => {
              const cells: string[] = Array(9).fill('');
              const st = ['IF', 'ID', 'EX', 'MEM', 'WB'];
              if (r < beqRow) st.forEach((s, k) => { cells[r + k] = s; });
              else { cells[r] = 'IF'; for (let k = 0; k <= n; k++) cells[r + 1 + k] = k < n ? 'ID*' : 'ID'; ['EX', 'MEM', 'WB'].forEach((s, k) => { cells[r + 2 + n + k] = s; }); }
              return <tr key={r}><td className="pr-2 whitespace-nowrap">{l}</td>{cells.map((c, k) => <td key={k} className={`text-center rounded ${c === 'ID*' ? 'bg-bad/30' : ''}`} style={c && c !== 'ID*' ? sbg(c, 0.3) : undefined}>{c === 'ID*' ? 'stall' : c}</td>)}</tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className={`rounded-lg border p-3 ${n ? 'border-bad/60 bg-bad/10' : 'border-ok/50 bg-ok/10'}`}>
        <b>{n} stall cycle{n === 1 ? '' : 's'}.</b>{' '}
        {n === 0 ? 'The value is ready in time and is forwarded to the comparator in ID.' : kind === 'alu' ? 'The ALU result appears at the end of EX, but beq needs it at the start of its ID. Wait one cycle, then forward.' : dist === 1 ? 'The loaded value only exists at the end of MEM. beq must sit in ID for two extra cycles.' : 'The load is one stage further ahead, so one stall is enough.'}
      </div>
    </div>
  );
}

/** Slides 41–42: 1-bit vs 2-bit predictor on the nested loop. */
export function PredictorLab() {
  const [kind, setKind] = useState<PredKind>('2bit');
  const [inner, setInner] = useState(4), [outer, setOuter] = useState(3);
  const seq = useMemo(() => nestedLoopOutcomes(inner, outer), [inner, outer]);
  const steps = runPredictor(kind, seq);
  const miss = steps.filter((s) => !s.ok).length;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3 items-center">
        <Segmented label="Predictor" value={kind} onChange={setKind} options={[{ value: '1bit', label: '1-bit' }, { value: '2bit', label: '2-bit' }]} />
        <label className="text-xs font-mono">inner iterations <input type="number" className="input !w-16 inline" value={inner} onChange={(e) => setInner(Math.max(2, Math.min(12, +e.target.value | 0)))} /></label>
        <label className="text-xs font-mono">outer runs <input type="number" className="input !w-16 inline" value={outer} onChange={(e) => setOuter(Math.max(1, Math.min(6, +e.target.value | 0)))} /></label>
      </div>
      {kind === '2bit' && (
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          {['Strong not taken', 'Weak not taken', 'Weak taken', 'Strong taken'].map((n, i) => <span key={n} className={`chip ${i >= 2 ? 'bg-ok/15 text-ok' : 'bg-bad/15 text-bad'}`}>{n}</span>)}
          <span className="text-muted">Taken moves right, not taken moves left. Only two misses in a row flip the guess.</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {steps.map((s, i) => (
          <div key={i} className={`w-[86px] rounded border text-[10px] p-1 text-center ${s.ok ? 'border-ok/50 bg-ok/10' : 'border-bad/60 bg-bad/15'}`} title={`state before: ${s.stateBefore}, after: ${s.stateAfter}`}>
            <div className="text-muted">run {Math.floor(i / inner) + 1}, iter {(i % inner) + 1}</div>
            <div>guess {s.predicted ? 'T' : 'N'} · real {s.actual ? 'T' : 'N'} {s.ok ? '✓' : '✗'}</div>
            <div className="text-[9px] text-muted truncate">{s.stateBefore}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2"><Stat label="Branches" value={steps.length} /><Stat label="Mispredictions" value={miss} tone={miss ? 'bad' : 'ok'} /><Stat label="Per outer run (steady)" value={kind === '1bit' ? 2 : 1} tone="accent" hint="after the first run" /></div>
    </div>
  );
}

/** Slides 48–53: exception in the pipeline. */
export function ExceptionLab() {
  const rows = exceptionTimeline();
  const [c, setC] = useState(5);
  const row = rows[c];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <button className="btn" disabled={c === 0} onClick={() => setC(c - 1)}>◀ Prev</button>
        <span className="font-mono text-xs">cycle {row.cycle}</span>
        <button className="btn" disabled={c === rows.length - 1} onClick={() => setC(c + 1)}>Next ▶</button>
      </div>
      <div className="grid grid-cols-5 gap-1 text-[11px] font-mono">
        {(['IF', 'ID', 'EX', 'MEM', 'WB'] as const).map((s) => (
          <div key={s} className={`rounded p-2 ${row[s].startsWith('bubble') ? 'bg-bad/15 text-bad' : row[s].startsWith('1C') ? 'bg-accent/15' : ''}`} style={row[s].startsWith('bubble') || row[s].startsWith('1C') ? undefined : sbg(s, 0.2)}>
            <div className="font-semibold">{s}</div><div className="break-words">{row[s]}</div>
          </div>
        ))}
      </div>
      {row.note && <div className="rounded-lg border border-warn/50 bg-warn/10 p-3 text-xs">{row.note}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Stat label="SEPC" value={row.cycle >= 7 ? '0x4c' : '-'} tone={row.cycle >= 7 ? 'accent' : undefined} />
        <Stat label="SCAUSE" value={row.cycle >= 7 ? '12 (hw malfunction)' : '-'} />
        <Stat label="PC source" value={row.cycle >= 7 ? 'handler 0x1C090000' : 'PC + 4'} />
        <Stat label="x1 written?" value="no" tone="ok" hint="the faulting add never reaches WB" />
      </div>
    </div>
  );
}

/** Slides 63–68: static dual issue, original vs unrolled. */
export function DualIssueLab() {
  const [which, setWhich] = useState<'loop' | 'unrolled'>('loop');
  const sch = which === 'loop' ? DUAL_LOOP : DUAL_UNROLLED;
  const s = ipc(sch);
  const [ghz, setGhz] = useState(4), [w, setW] = useState(4);
  const p = peak(ghz, w);
  return (
    <div className="space-y-4 text-sm">
      <Segmented label="Schedule" value={which} onChange={setWhich} options={[{ value: 'loop', label: 'Original loop (slide 66)' }, { value: 'unrolled', label: 'Unrolled ×4 (slide 68)' }]} />
      <table className="text-xs font-mono w-full max-w-xl">
        <thead className="text-muted"><tr><th className="text-left">cycle</th><th className="text-left">ALU / branch slot</th><th className="text-left">Load / store slot</th></tr></thead>
        <tbody>{sch.map((r, i) => <tr key={i} className="border-t border-line/60"><td>{i + 1}</td>{r.map((x, k) => <td key={k} className={`py-1 ${x === 'nop' ? 'text-muted' : ''}`}>{x}</td>)}</tr>)}</tbody>
      </table>
      <div className="grid grid-cols-3 gap-2 max-w-xl"><Stat label="Useful instructions" value={s.instrs} /><Stat label="Cycles" value={s.cycles} /><Stat label="IPC" value={s.ipc} tone="accent" hint="peak = 2" /></div>
      <div className="rounded-lg bg-raised p-3 space-y-2">
        <div className="text-xs font-semibold">Peak throughput (slide 56)</div>
        <div className="flex flex-wrap gap-3 text-xs font-mono">
          <label>clock GHz <input type="number" className="input !w-16 inline" value={ghz} onChange={(e) => setGhz(Math.max(0.1, +e.target.value || 1))} /></label>
          <label>issue width <input type="number" className="input !w-16 inline" value={w} onChange={(e) => setW(Math.max(1, Math.min(8, +e.target.value | 0)))} /></label>
        </div>
        <div className="text-xs">Peak = {ghz} × {w} = <b>{p.bips} BIPS</b>, peak IPC = {p.ipc}, peak CPI = {p.cpi}. Dependencies lower this in practice.</div>
      </div>
    </div>
  );
}

/** Slide 70: in-order vs out-of-order issue with in-order commit. */
export function OoOLab() {
  const [ooo, setOoo] = useState(true);
  const r = schedule(OOO_EXAMPLE, ooo);
  const last = Math.max(...r.commit);
  return (
    <div className="space-y-3 text-sm">
      <Toggle checked={ooo} onChange={setOoo} label="Out-of-order issue (dynamic scheduling)" />
      <table className="text-xs font-mono">
        <thead className="text-muted"><tr><th className="text-left pr-3">instruction</th>{Array.from({ length: last }, (_, i) => <th key={i} className="w-8 font-normal">{i + 1}</th>)}</tr></thead>
        <tbody>{OOO_EXAMPLE.map((ins, k) => (
          <tr key={k}><td className="pr-3">{ins.text}</td>{Array.from({ length: last }, (_, i) => {
            const c = i + 1;
            const lab = c === r.issue[k] ? 'I' : c > r.issue[k] && c <= r.done[k] ? 'E' : c === r.commit[k] ? 'C' : '';
            return <td key={i} className={`text-center rounded ${lab === 'C' ? 'bg-ok/30' : ''}`} style={lab === 'I' ? sbg('ID', 0.3) : lab === 'E' ? sbg('EX', 0.3) : undefined}>{lab}</td>;
          })}</tr>
        ))}</tbody>
      </table>
      <p className="text-xs text-muted">I = issue, E = still executing (ld takes 3 cycles here), C = commit. One instruction issues per cycle. {ooo ? 'sub and andi do not depend on ld, so they issue while add waits. Results still commit in program order.' : 'In order: add waits for ld, and sub and andi wait behind add.'} Last commit: cycle {last}.</p>
    </div>
  );
}
