/** Pure logic for the Lecture 9 widgets (forwarding unit, hazard detection, branch hazards, predictors, exceptions, multiple issue). */

export interface FwdInputs {
  exmemRegWrite: boolean; exmemRd: number;
  memwbRegWrite: boolean; memwbRd: number;
  rs1: number; rs2: number;
}
export type FwdSel = '00' | '10' | '01';
export interface FwdResult { A: FwdSel; B: FwdSel; why: { A: string; B: string } }

/** Forwarding unit with the revised MEM-hazard condition (slides 21–26). `revised=false` gives the naive version from slide 21–22. */
export function forwardingUnit(i: FwdInputs, revised = true): FwdResult {
  const one = (rs: number, name: 'Rs1' | 'Rs2'): [FwdSel, string] => {
    const exHaz = i.exmemRegWrite && i.exmemRd !== 0 && i.exmemRd === rs;
    const memBase = i.memwbRegWrite && i.memwbRd !== 0 && i.memwbRd === rs;
    if (exHaz) return ['10', `EX hazard: EX/MEM.RegWrite = 1, EX/MEM.RegisterRd = x${i.exmemRd} ≠ 0 and equals ID/EX.Register${name}. Forward the prior ALU result.`];
    if (memBase) {
      // naive version would also reach here only if not exHaz; difference matters when both match and revised=false picks MEM
      return ['01', `MEM hazard: MEM/WB.RegWrite = 1, MEM/WB.RegisterRd = x${i.memwbRd} ≠ 0, equals ID/EX.Register${name}, and no EX hazard on this operand. Forward from MEM/WB.`];
    }
    const reasons: string[] = [];
    if (i.exmemRd === rs && rs !== 0 && !i.exmemRegWrite) reasons.push('EX/MEM rd matches but RegWrite = 0');
    if (i.memwbRd === rs && rs !== 0 && !i.memwbRegWrite) reasons.push('MEM/WB rd matches but RegWrite = 0');
    if (rs === 0 && (i.exmemRd === 0 || i.memwbRd === 0)) reasons.push('register is x0, which is never forwarded');
    return ['00', `No hazard${reasons.length ? ` (${reasons.join('; ')})` : ''}. Operand comes from the register file.`];
  };
  const [A, wa] = one(i.rs1, 'Rs1');
  const [B, wb] = one(i.rs2, 'Rs2');
  if (!revised) {
    // Naive: MEM condition checked independently, and if both fire the (wrong) MEM value would win when hardware is written in that order.
    const naive = (rs: number, sel: FwdSel, w: string): [FwdSel, string] => {
      const both = sel === '10' && i.memwbRegWrite && i.memwbRd !== 0 && i.memwbRd === rs;
      return both ? ['01', 'Both EX and MEM conditions are true. Without the revised condition the MEM/WB (older) value is selected: WRONG, it is stale.'] : [sel, w];
    };
    const [nA, nwa] = naive(i.rs1, A, wa);
    const [nB, nwb] = naive(i.rs2, B, wb);
    return { A: nA, B: nB, why: { A: nwa, B: nwb } };
  }
  return { A, B, why: { A: wa, B: wb } };
}

/** Load-use hazard detection unit in ID (slide 28; second term corrected to Rs2). */
export function loadUseHazard(idexMemRead: boolean, idexRd: number, ifidRs1: number, ifidRs2: number): boolean {
  return idexMemRead && idexRd !== 0 && (idexRd === ifidRs1 || idexRd === ifidRs2);
}

/** Stalls for a beq resolved in ID (slides 37–39), given the producer's kind and how many instructions before the beq it is (1 = immediately preceding). */
export function branchStalls(kind: 'alu' | 'load', distance: number): number {
  if (kind === 'alu') return distance === 1 ? 1 : 0;
  if (distance === 1) return 2;
  if (distance === 2) return 1;
  return 0;
}

export type PredKind = '1bit' | '2bit';
export interface PredStep { actual: boolean; predicted: boolean; ok: boolean; stateBefore: string; stateAfter: string }
export const TWO_BIT_NAMES = ['Strong not taken', 'Weak not taken', 'Weak taken', 'Strong taken'];

/** Run a single-entry predictor over a sequence of outcomes. 2-bit starts in `start2` (default strong taken, as a loop branch would settle). */
export function runPredictor(kind: PredKind, seq: boolean[], start1 = true, start2 = 3): PredStep[] {
  let b = start1, s = start2;
  return seq.map((actual) => {
    if (kind === '1bit') {
      const before = b ? 'Taken' : 'Not taken';
      const predicted = b; b = actual;
      return { actual, predicted, ok: predicted === actual, stateBefore: before, stateAfter: b ? 'Taken' : 'Not taken' };
    }
    const before = TWO_BIT_NAMES[s];
    const predicted = s >= 2;
    s = actual ? Math.min(3, s + 1) : Math.max(0, s - 1);
    return { actual, predicted, ok: predicted === actual, stateBefore: before, stateAfter: TWO_BIT_NAMES[s] };
  });
}

/** Outcomes of the inner-loop branch of slide 41 over `outer` runs of an inner loop with `inner` iterations. */
export function nestedLoopOutcomes(inner: number, outer: number): boolean[] {
  return Array.from({ length: outer }, () => [...Array(inner - 1).fill(true), false]).flat();
}

/** Exception example (slides 51–53): add at 0x4c faults in EX. Returns the per-cycle stage contents. */
export interface ExcRow { cycle: number; IF: string; ID: string; EX: string; MEM: string; WB: string; note: string }
export function exceptionTimeline(): ExcRow[] {
  const prog = ['40 sub x11,x2,x4', '44 and x12,x2,x5', '48 orr x13,x2,x6', '4c add x1,x2,x1', '50 sub x15,x6,x7', '54 ld x16,100(x7)', '58 …'];
  const handler = ['1C090000 sd x26,1000(x10)', '1C090004 sd x27,1008(x10)', '1C090008 …', '1C09000C …'];
  const rows: ExcRow[] = [];
  const e = '—';
  // cycles 1..6 normal, exception detected when add is in EX (cycle 6)
  for (let c = 1; c <= 6; c++) {
    const at = (k: number) => (c - k >= 1 && c - k <= prog.length ? prog[c - k - 1] : e);
    rows.push({ cycle: c, IF: at(0), ID: at(1), EX: at(2), MEM: at(3), WB: at(4), note: c === 6 ? 'add x1,x2,x1 overflows / malfunctions in EX. Exception detected.' : '' });
  }
  rows.push({ cycle: 7, IF: handler[0], ID: 'bubble (flushed ld)', EX: 'bubble (flushed sub)', MEM: 'bubble (flushed add)', WB: prog[2], note: 'Flush add, sub, ld (control → 0). SEPC ← 0x4c, SCAUSE ← cause. PC ← 0x1C090000. Earlier orr completes.' });
  rows.push({ cycle: 8, IF: handler[1], ID: handler[0], EX: 'bubble', MEM: 'bubble', WB: 'bubble', note: 'Handler is running. x1 was never written, so it is not clobbered.' });
  return rows;
}

/** Dual-issue schedules from slides 66 and 68. */
export const DUAL_LOOP = [
  ['nop', 'ld x31,0(x20)'],
  ['addi x20,x20,-8', 'nop'],
  ['add x31,x31,x21', 'nop'],
  ['blt x22,x20,Loop', 'sd x31,8(x20)'],
];
export const DUAL_UNROLLED = [
  ['addi x20,x20,-32', 'ld x28,0(x20)'],
  ['nop', 'ld x29,24(x20)'],
  ['add x28,x28,x21', 'ld x30,16(x20)'],
  ['add x29,x29,x21', 'ld x31,8(x20)'],
  ['add x30,x30,x21', 'sd x28,32(x20)'],
  ['add x31,x31,x21', 'sd x29,24(x20)'],
  ['nop', 'sd x30,16(x20)'],
  ['blt x22,x20,Loop', 'sd x31,8(x20)'],
];
export function ipc(schedule: string[][]): { instrs: number; cycles: number; ipc: number } {
  const instrs = schedule.flat().filter((s) => s !== 'nop').length;
  return { instrs, cycles: schedule.length, ipc: Math.round((instrs / schedule.length) * 100) / 100 };
}

/** Peak throughput of a multiple-issue CPU (slide 56). */
export function peak(ghz: number, width: number) {
  return { bips: ghz * width, ipc: width, cpi: Math.round((1 / width) * 1000) / 1000 };
}

/**
 * Toy in-order vs out-of-order issue for slide 70. Each instr has deps on earlier indices and a latency.
 * One instruction issues per cycle. In-order: stall the head until operands ready. OoO: issue the oldest ready one.
 * Results still commit in program order.
 */
export interface OoOInstr { text: string; deps: number[]; lat: number }
export const OOO_EXAMPLE: OoOInstr[] = [
  { text: 'ld x31,20(x21)', deps: [], lat: 3 },
  { text: 'add x1,x31,x2', deps: [0], lat: 1 },
  { text: 'sub x23,x23,x3', deps: [], lat: 1 },
  { text: 'andi x5,x23,20', deps: [2], lat: 1 },
];
export function schedule(prog: OoOInstr[], ooo: boolean): { issue: number[]; done: number[]; commit: number[] } {
  const issue = Array(prog.length).fill(-1), done = Array(prog.length).fill(-1);
  let cycle = 1, issued = 0;
  while (issued < prog.length && cycle < 100) {
    const ready = (k: number) => issue[k] < 0 && prog[k].deps.every((d) => done[d] > 0 && done[d] < cycle);
    let pick = -1;
    if (ooo) { for (let k = 0; k < prog.length; k++) if (ready(k)) { pick = k; break; } }
    else { const head = issue.findIndex((x) => x < 0); if (ready(head)) pick = head; }
    if (pick >= 0) { issue[pick] = cycle; done[pick] = cycle + prog[pick].lat - 1; issued++; }
    cycle++;
  }
  const commit: number[] = [];
  let last = 0;
  for (let k = 0; k < prog.length; k++) { last = Math.max(last + 1, done[k] + 1); commit.push(last); }
  return { issue, done, commit };
}
