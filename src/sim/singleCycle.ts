import { alu, type Instr } from './isa';
import { aluCtrlFor, controlFor, type Control } from './control';

export interface MachineState {
  pc: number;
  regs: number[]; // 32 registers; x0 is always 0
  mem: Record<number, number>; // doubleword-addressed data memory (byte address → 64-bit value)
}

export interface CycleTrace {
  pc: number;
  instr: Instr;
  ctrl: Control;
  aluCtrl: string;
  readData1: number;
  readData2: number;
  imm: number;
  aluB: number;
  aluResult: number;
  zero: boolean;
  memAddr: number | null;
  memRead: number | null;
  memWritten: number | null;
  writeData: number | null;
  writeReg: number | null;
  pcPlus4: number;
  branchTarget: number;
  pcSrc: 0 | 1;
  nextPc: number;
}

export function initialState(regs: Partial<Record<number, number>> = {}, mem: Record<number, number> = {}): MachineState {
  const r = new Array(32).fill(0);
  for (const [k, v] of Object.entries(regs)) if (+k !== 0) r[+k] = v as number;
  return { pc: 0, regs: r, mem: { ...mem } };
}

export function memLoad(mem: Record<number, number>, addr: number): number {
  return mem[addr] ?? 0;
}

/** Execute one instruction on the single-cycle datapath. Pure: returns new state + full trace. */
export function stepSingle(s: MachineState, instr: Instr): { state: MachineState; trace: CycleTrace } {
  const ctrl = controlFor(instr.op);
  const aluCtrl = aluCtrlFor(instr);
  const readData1 = s.regs[instr.rs1];
  const readData2 = s.regs[instr.rs2];
  const imm = instr.imm;
  const aluB = ctrl.ALUSrc === 1 ? imm : readData2;
  const aluResult = alu(aluCtrl, readData1, aluB);
  const zero = aluResult === 0;
  const regs = s.regs.slice();
  const mem = { ...s.mem };
  let memRead: number | null = null, memWritten: number | null = null, writeData: number | null = null, writeReg: number | null = null;
  const memAddr = ctrl.MemRead === 1 || ctrl.MemWrite === 1 ? aluResult : null;
  if (ctrl.MemRead === 1) memRead = memLoad(mem, aluResult);
  if (ctrl.MemWrite === 1) { mem[aluResult] = readData2; memWritten = readData2; }
  if (ctrl.RegWrite === 1) {
    writeData = ctrl.MemtoReg === 1 ? (memRead as number) : aluResult;
    writeReg = instr.rd;
    if (instr.rd !== 0) regs[instr.rd] = writeData;
  }
  const pcPlus4 = s.pc + 4;
  const branchTarget = s.pc + imm; // imm field << 1 == byte offset
  const pcSrc: 0 | 1 = ctrl.Branch === 1 && zero ? 1 : 0;
  const nextPc = pcSrc ? branchTarget : pcPlus4;
  return {
    state: { pc: nextPc, regs, mem },
    trace: { pc: s.pc, instr, ctrl, aluCtrl, readData1, readData2, imm, aluB, aluResult, zero, memAddr, memRead, memWritten, writeData, writeReg, pcPlus4, branchTarget, pcSrc, nextPc },
  };
}

/** Run a whole program single-cycle; returns trace list (bounded to avoid infinite loops). */
export function runSingle(prog: Instr[], init: MachineState, maxSteps = 200) {
  const traces: CycleTrace[] = [];
  const states: MachineState[] = [init];
  let s = init;
  while (s.pc / 4 < prog.length && s.pc >= 0 && traces.length < maxSteps) {
    const r = stepSingle(s, prog[s.pc / 4]);
    traces.push(r.trace);
    states.push(r.state);
    s = r.state;
  }
  return { traces, states };
}

/** Multicycle execution steps (slides 35–36): one shared memory, one ALU, intermediate registers. */
export interface MultiStep { name: string; rtl: string; units: string[] }
export function multicycleSteps(i: Instr): MultiStep[] {
  const fetch: MultiStep = { name: 'Fetch', rtl: 'IR ← Memory[PC]; PC ← PC + 4 (ALU)', units: ['PC', 'Memory', 'IR', 'ALU'] };
  const decode: MultiStep = { name: 'Decode / Reg read', rtl: 'A ← Reg[rs1]; B ← Reg[rs2]; ALUOut ← PC + imm<<1 (branch target, computed early)', units: ['IR', 'Registers', 'A', 'B', 'ALU', 'ALUOut'] };
  switch (i.op) {
    case 'add': case 'sub': case 'and': case 'or':
      return [fetch, decode,
        { name: 'Execute', rtl: `ALUOut ← A ${i.op} B`, units: ['A', 'B', 'ALU', 'ALUOut'] },
        { name: 'R-type completion', rtl: 'Reg[rd] ← ALUOut', units: ['ALUOut', 'Registers'] }];
    case 'ld':
      return [fetch, decode,
        { name: 'Address calc', rtl: 'ALUOut ← A + sign-ext(imm)', units: ['A', 'ImmGen', 'ALU', 'ALUOut'] },
        { name: 'Memory read', rtl: 'MDR ← Memory[ALUOut]', units: ['ALUOut', 'Memory', 'MDR'] },
        { name: 'Write back', rtl: 'Reg[rd] ← MDR', units: ['MDR', 'Registers'] }];
    case 'sd':
      return [fetch, decode,
        { name: 'Address calc', rtl: 'ALUOut ← A + sign-ext(imm)', units: ['A', 'ImmGen', 'ALU', 'ALUOut'] },
        { name: 'Memory write', rtl: 'Memory[ALUOut] ← B', units: ['ALUOut', 'B', 'Memory'] }];
    case 'beq':
      return [fetch, decode,
        { name: 'Branch completion', rtl: 'if (A − B == 0) PC ← ALUOut', units: ['A', 'B', 'ALU', 'PC'] }];
    default:
      return [fetch, decode];
  }
}
