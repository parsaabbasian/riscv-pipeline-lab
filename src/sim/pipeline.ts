import { alu, readsRegs, writesReg, type Instr } from './isa';
import { aluCtrlFor, controlFor, type Control } from './control';
import { memLoad, type MachineState } from './singleCycle';

export type BranchPolicy = 'stall' | 'predict-not-taken';
export interface PipeOptions {
  forwarding: boolean;
  branchPolicy: BranchPolicy;
  /** One shared memory for instructions and data → structural hazard (slide 44). */
  unifiedMemory: boolean;
  /** Bug from slide 61: WB uses the rd field of the instruction currently in ID instead of the one carried in MEM/WB. */
  buggyWriteRegister: boolean;
}
export const DEFAULT_OPTS: PipeOptions = { forwarding: true, branchPolicy: 'predict-not-taken', unifiedMemory: false, buggyWriteRegister: false };

export const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;
export type Stage = (typeof STAGES)[number];

/** A dynamic (in-flight) instruction instance. */
export interface Dyn { id: number; instr: Instr; pc: number }

export interface IFID { d: Dyn }
export interface IDEX { d: Dyn; ctrl: Control; aluCtrl: string; rd1: number; rd2: number; imm: number; rs1: number; rs2: number; rd: number }
export interface EXMEM { d: Dyn; ctrl: Control; aluResult: number; zero: boolean; storeData: number; rd: number }
export interface MEMWB { d: Dyn; ctrl: Control; aluResult: number; memData: number | null; rd: number }

export interface Forward { stage: 'EX' | 'ID'; operand: 'rs1' | 'rs2'; from: 'EX/MEM' | 'MEM/WB'; reg: number; value: number; to: number }
export interface PipeEvent { kind: 'stall' | 'forward' | 'flush' | 'branch' | 'structural' | 'write' | 'mem' | 'bug' | 'info'; text: string }

export interface PipeState {
  cycle: number; // number of clock cycles completed
  pc: number;
  regs: number[];
  mem: Record<number, number>;
  ifid: IFID | null;
  idex: IDEX | null;
  exmem: EXMEM | null;
  memwb: MEMWB | null;
  nextId: number;
  /** what occupied each stage during the cycle that just completed */
  occupancy: Record<Stage, Dyn | null>;
  /** stage label overrides for the cycle that just completed (e.g. bubble / stall) */
  marks: Partial<Record<Stage, 'stall' | 'bubble' | 'flush'>>;
  forwards: Forward[];
  events: PipeEvent[];
  done: boolean;
  committed: number;
  stalls: number;
  flushes: number;
  /** bubble flags for the latch feeding each stage */
  bub: { ID: boolean; EX: boolean; MEM: boolean; WB: boolean };
}

export function initPipe(base: MachineState): PipeState {
  return {
    cycle: 0, pc: base.pc, regs: base.regs.slice(), mem: { ...base.mem },
    ifid: null, idex: null, exmem: null, memwb: null, nextId: 0,
    occupancy: { IF: null, ID: null, EX: null, MEM: null, WB: null }, marks: {}, forwards: [], events: [],
    done: false, committed: 0, stalls: 0, flushes: 0, bub: { ID: false, EX: false, MEM: false, WB: false },
  };
}

const writes = (c: Control) => c.RegWrite === 1;

/** Advance the pipeline by exactly one clock cycle. Pure function. */
export function stepPipe(s: PipeState, prog: Instr[], o: PipeOptions): PipeState {
  if (s.done) return s;
  const regs = s.regs.slice();
  const mem = { ...s.mem };
  const events: PipeEvent[] = [];
  const forwards: Forward[] = [];
  const marks: PipeState['marks'] = {};
  let committed = s.committed, stalls = s.stalls, flushes = s.flushes;

  // ---------- WB (first half of cycle: register write) ----------
  if (s.memwb && writes(s.memwb.ctrl)) {
    const val = s.memwb.ctrl.MemtoReg === 1 ? (s.memwb.memData as number) : s.memwb.aluResult;
    let dest = s.memwb.rd;
    if (o.buggyWriteRegister && s.ifid) {
      const wrong = s.ifid.d.instr.rd;
      if (wrong !== dest) events.push({ kind: 'bug', text: `WRONG REGISTER: ${s.memwb.d.instr.text} should write x${dest}, but WB uses rd=x${wrong} from the instruction now in ID (${s.ifid.d.instr.text}).` });
      dest = wrong;
    }
    if (dest !== 0) regs[dest] = val;
    events.push({ kind: 'write', text: `WB: x${dest} ← ${val}` });
  }
  if (s.memwb) committed++;

  // ---------- MEM ----------
  let newMemwb: MEMWB | null = null;
  if (s.exmem) {
    const e = s.exmem;
    let memData: number | null = null;
    if (e.ctrl.MemRead === 1) { memData = memLoad(mem, e.aluResult); events.push({ kind: 'mem', text: `MEM: read Mem[${e.aluResult}] = ${memData}` }); }
    if (e.ctrl.MemWrite === 1) { mem[e.aluResult] = e.storeData; events.push({ kind: 'mem', text: `MEM: Mem[${e.aluResult}] ← ${e.storeData}` }); }
    newMemwb = { d: e.d, ctrl: e.ctrl, aluResult: e.aluResult, memData, rd: e.rd };
  }

  // ---------- EX (with forwarding unit) ----------
  let newExmem: EXMEM | null = null;
  if (s.idex) {
    const x = s.idex;
    const fwd = (r: number, regVal: number, operand: 'rs1' | 'rs2'): number => {
      if (!o.forwarding || r === 0) return regVal;
      if (s.exmem && writes(s.exmem.ctrl) && s.exmem.ctrl.MemRead !== 1 && s.exmem.rd === r) {
        forwards.push({ stage: 'EX', operand, from: 'EX/MEM', reg: r, value: s.exmem.aluResult, to: x.d.id });
        return s.exmem.aluResult;
      }
      if (s.memwb && writes(s.memwb.ctrl) && s.memwb.rd === r) {
        const v = s.memwb.ctrl.MemtoReg === 1 ? (s.memwb.memData as number) : s.memwb.aluResult;
        forwards.push({ stage: 'EX', operand, from: 'MEM/WB', reg: r, value: v, to: x.d.id });
        return v;
      }
      return regVal;
    };
    const rr = readsRegs(x.d.instr);
    const a = rr.rs1 ? fwd(x.rs1, x.rd1, 'rs1') : x.rd1;
    const b = rr.rs2 ? fwd(x.rs2, x.rd2, 'rs2') : x.rd2;
    const aluB = x.ctrl.ALUSrc === 1 ? x.imm : b;
    const res = alu(x.aluCtrl, a, aluB);
    newExmem = { d: x.d, ctrl: x.ctrl, aluResult: res, zero: res === 0, storeData: b, rd: x.rd };
  }

  // ---------- ID (hazard detection, register read, early branch resolution) ----------
  let newIdex: IDEX | null = null;
  let stallID = false;
  let redirect: number | null = null;
  let squashIF = false;
  if (s.ifid) {
    const d = s.ifid.d;
    const ins = d.instr;
    const rr = readsRegs(ins);
    const uses = (r: number) => r !== 0 && ((rr.rs1 && ins.rs1 === r) || (rr.rs2 && ins.rs2 === r));
    const exW = s.idex && writes(s.idex.ctrl) ? s.idex : null;
    const memW = s.exmem && writes(s.exmem.ctrl) ? s.exmem : null;
    let reason = '';
    if (ins.op === 'beq') {
      // branch compares in ID (slide 50): its operands must be ready now
      if (exW && uses(exW.rd)) reason = `beq needs x${exW.rd}, still being computed in EX by ${exW.d.instr.text}`;
      else if (memW && uses(memW.rd) && (memW.ctrl.MemRead === 1 || !o.forwarding)) reason = `beq needs x${memW.rd} from ${memW.d.instr.text} (in MEM)`;
    } else if (o.forwarding) {
      if (exW && exW.ctrl.MemRead === 1 && uses(exW.rd)) reason = `load-use hazard: ${ins.text} needs x${exW.rd} loaded by ${exW.d.instr.text}`;
    } else {
      if (exW && uses(exW.rd)) reason = `data hazard (no forwarding): ${ins.text} needs x${exW.rd} from ${exW.d.instr.text}`;
      else if (memW && uses(memW.rd)) reason = `data hazard (no forwarding): ${ins.text} needs x${memW.rd} from ${memW.d.instr.text}`;
    }
    if (reason) {
      stallID = true; stalls++;
      events.push({ kind: 'stall', text: `Stall: ${reason}. PC and IF/ID hold; a bubble (nop) is inserted into ID/EX.` });
    } else {
      // register read happens after WB write (write first half, read second half)
      const rd1 = regs[ins.rs1], rd2 = regs[ins.rs2];
      newIdex = { d, ctrl: controlFor(ins.op), aluCtrl: aluCtrlFor(ins), rd1, rd2, imm: ins.imm, rs1: ins.rs1, rs2: ins.rs2, rd: ins.rd };
      if (ins.op === 'beq') {
        const get = (r: number, operand: 'rs1' | 'rs2') => {
          if (o.forwarding && r !== 0 && memW && memW.rd === r) {
            forwards.push({ stage: 'ID', operand, from: 'EX/MEM', reg: r, value: memW.aluResult, to: d.id });
            return memW.aluResult;
          }
          return regs[r];
        };
        const taken = get(ins.rs1, 'rs1') === get(ins.rs2, 'rs2');
        const target = d.pc + ins.imm;
        events.push({ kind: 'branch', text: `beq resolved in ID: ${taken ? `TAKEN → PC = ${target}` : 'not taken'}` });
        if (o.branchPolicy === 'predict-not-taken') {
          if (taken) { redirect = target; squashIF = true; }
        } else {
          redirect = taken ? target : d.pc + 4;
          squashIF = true; // stall-on-branch: the slot after a branch is always lost
        }
      }
    }
  }

  // ---------- IF ----------
  let newIfid: IFID | null = s.ifid;
  let pc = s.pc;
  let nextId = s.nextId;
  let fetched: Dyn | null = null;
  const structural = o.unifiedMemory && s.exmem && (s.exmem.ctrl.MemRead === 1 || s.exmem.ctrl.MemWrite === 1);
  const inProgram = pc >= 0 && pc / 4 < prog.length;
  if (stallID) {
    // IF/ID and PC hold; if IF fetched, it is the same instruction again
    if (inProgram) fetched = { id: nextId, instr: prog[pc / 4], pc };
  } else if (structural && inProgram) {
    events.push({ kind: 'structural', text: `Structural hazard: ${s.exmem!.d.instr.text} uses the single memory in MEM, so IF cannot fetch this cycle.` });
    marks.IF = 'stall'; stalls++;
    newIfid = null;
    if (redirect !== null) pc = redirect;
  } else {
    if (inProgram) {
      fetched = { id: nextId++, instr: prog[pc / 4], pc };
      newIfid = { d: fetched };
      pc += 4;
    } else newIfid = null;
    if (squashIF) {
      if (fetched) {
        events.push({ kind: 'flush', text: `${o.branchPolicy === 'stall' ? 'Branch stall' : 'Misprediction'}: ${fetched.instr.text} (fetched at PC ${fetched.pc}) is flushed → bubble.` });
        marks.IF = 'flush'; flushes++;
      }
      newIfid = null;
    }
    if (redirect !== null) pc = redirect;
  }

  const occupancy: PipeState['occupancy'] = {
    IF: fetched,
    ID: s.ifid?.d ?? null, EX: s.idex?.d ?? null, MEM: s.exmem?.d ?? null, WB: s.memwb?.d ?? null,
  };
  if (stallID) marks.ID = 'stall';
  if (stallID && occupancy.IF) marks.IF = 'stall';
  if (s.bub.ID) marks.ID = marks.ID ?? 'flush';
  if (s.bub.EX) marks.EX = 'bubble';
  if (s.bub.MEM) marks.MEM = 'bubble';
  if (s.bub.WB) marks.WB = 'bubble';
  const bub = { ID: !stallID && squashIF && !!fetched, EX: stallID, MEM: s.bub.EX, WB: s.bub.MEM };

  const empty = !newIfid && !newIdex && !newExmem && !newMemwb;
  const done = empty && !(pc >= 0 && pc / 4 < prog.length);
  return {
    cycle: s.cycle + 1, pc, regs, mem,
    ifid: stallID ? s.ifid : newIfid, idex: newIdex, exmem: newExmem, memwb: newMemwb,
    nextId, occupancy, marks, forwards, events, done, committed, stalls, flushes, bub,
  };
}

export interface PipeRun { states: PipeState[]; cycles: number; committed: number }

export function runPipe(prog: Instr[], base: MachineState, o: PipeOptions, maxCycles = 300): PipeRun {
  const states = [initPipe(base)];
  let s = states[0];
  while (!s.done && s.cycle < maxCycles) { s = stepPipe(s, prog, o); states.push(s); }
  return { states, cycles: s.cycle, committed: s.committed };
}

/** Build a timing chart: row per dynamic instruction, column per cycle. */
export interface ChartRow { id: number; text: string; cells: Record<number, { stage: Stage; mark?: string }> }
export function timingChart(run: PipeRun): ChartRow[] {
  const rows = new Map<number, ChartRow>();
  run.states.slice(1).forEach((st) => {
    for (const stg of STAGES) {
      const d = st.occupancy[stg];
      if (!d) continue;
      const id = d.id;
      if (!rows.has(id)) rows.set(id, { id, text: d.instr.text, cells: {} });
      rows.get(id)!.cells[st.cycle] = { stage: stg, mark: st.marks[stg] === 'stall' ? 'stall' : stg === 'IF' && st.marks.IF === 'flush' ? 'flush' : undefined };
    }
  });
  return [...rows.values()].sort((a, b) => a.id - b.id);
}

export interface Dependency {
  consumer: number; consumerText: string; producer: number; producerText: string;
  reg: number; distance: number; stallCycles: number;
  resolution: string;
}

/** RAW dependencies between completed dynamic instructions, with how the pipeline resolved each. */
export function dependencies(run: PipeRun): Dependency[] {
  const done: Dyn[] = [];
  const seen = new Set<number>();
  run.states.forEach((st) => { const d = st.occupancy.WB; if (d && !seen.has(d.id) && !st.marks.WB) { seen.add(d.id); done.push(d); } });
  const out: Dependency[] = [];
  done.forEach((c, k) => {
    const rr = readsRegs(c.instr);
    const regsUsed = [rr.rs1 ? c.instr.rs1 : -1, rr.rs2 ? c.instr.rs2 : -1].filter((r, i, a) => r > 0 && a.indexOf(r) === i);
    for (const r of regsUsed) {
      for (let j = k - 1; j >= 0 && j >= k - 3; j--) {
        const p = done[j];
        if (!writesReg(p.instr) || p.instr.rd !== r) continue;
        const stalls = run.states.filter((st) => st.occupancy.ID?.id === c.id && st.marks.ID === 'stall').length;
        const fw = run.states.flatMap((st) => st.forwards).filter((f) => f.to === c.id && f.reg === r);
        let resolution: string;
        if (fw.length) resolution = `forwarded from ${fw[0].from} to ${fw[0].stage}`;
        else if (k - j === 3) resolution = 'register file (written in 1st half, read in 2nd half of the cycle)';
        else resolution = 'read from register file after stalling';
        out.push({ consumer: c.id, consumerText: c.instr.text, producer: p.id, producerText: p.instr.text, reg: r, distance: k - j, stallCycles: stalls, resolution });
        break; // nearest producer only
      }
    }
  });
  return out;
}
