import type { Instr, Op } from './isa';

/** Main control signals exactly as in the lecture's control table (slides 25–31). 'X' = don't care. */
export type Bit = 0 | 1 | 'X';
export interface Control {
  ALUSrc: Bit; MemtoReg: Bit; RegWrite: Bit; MemRead: Bit; MemWrite: Bit; Branch: Bit;
  ALUOp1: Bit; ALUOp0: Bit;
}

export const CONTROL_TABLE: Record<'R' | 'ld' | 'sd' | 'beq', Control> = {
  R: { ALUSrc: 0, MemtoReg: 0, RegWrite: 1, MemRead: 0, MemWrite: 0, Branch: 0, ALUOp1: 1, ALUOp0: 0 },
  ld: { ALUSrc: 1, MemtoReg: 1, RegWrite: 1, MemRead: 1, MemWrite: 0, Branch: 0, ALUOp1: 0, ALUOp0: 0 },
  sd: { ALUSrc: 1, MemtoReg: 'X', RegWrite: 0, MemRead: 0, MemWrite: 1, Branch: 0, ALUOp1: 0, ALUOp0: 0 },
  beq: { ALUSrc: 0, MemtoReg: 'X', RegWrite: 0, MemRead: 0, MemWrite: 0, Branch: 1, ALUOp1: 0, ALUOp0: 1 },
};
const NOP_CTRL: Control = { ALUSrc: 0, MemtoReg: 0, RegWrite: 0, MemRead: 0, MemWrite: 0, Branch: 0, ALUOp1: 0, ALUOp0: 0 };

export function controlFor(op: Op): Control {
  if (op === 'add' || op === 'sub' || op === 'and' || op === 'or') return CONTROL_TABLE.R;
  if (op === 'ld' || op === 'sd' || op === 'beq') return CONTROL_TABLE[op];
  return NOP_CTRL;
}

export const ALU_CODES = { AND: '0000', OR: '0001', ADD: '0010', SUB: '0110' } as const;
export const ALU_NAME: Record<string, string> = { '0000': 'AND', '0001': 'OR', '0010': 'add', '0110': 'subtract' };

/** ALU control unit: ALUOp (2 bits) + funct7/funct3 → 4-bit ALU control input (slide 23). */
export function aluControl(aluOp: string, funct7: string, funct3: string): string {
  if (aluOp === '00') return ALU_CODES.ADD;
  if (aluOp === '01') return ALU_CODES.SUB;
  if (funct7 === '0000000' && funct3 === '000') return ALU_CODES.ADD;
  if (funct7 === '0100000' && funct3 === '000') return ALU_CODES.SUB;
  if (funct7 === '0000000' && funct3 === '111') return ALU_CODES.AND;
  if (funct7 === '0000000' && funct3 === '110') return ALU_CODES.OR;
  return 'XXXX';
}

export function aluCtrlFor(i: Instr): string {
  const c = controlFor(i.op);
  const f7 = i.op === 'sub' ? '0100000' : '0000000';
  const f3 = { add: '000', sub: '000', and: '111', or: '110' }[i.op as 'add'] ?? '000';
  return aluControl(`${c.ALUOp1 === 1 ? 1 : 0}${c.ALUOp0 === 1 ? 1 : 0}`, f7, f3);
}

export const SIGNAL_INFO: Record<string, { controls: string; when0: string; when1: string }> = {
  RegWrite: { controls: 'Register file write port', when0: 'Nothing is written to the register file.', when1: 'The register named by rd is written with the Write data input on the clock edge.' },
  ALUSrc: { controls: 'MUX in front of the ALU’s 2nd input', when0: 'ALU 2nd operand = Read data 2 (register rs2).', when1: 'ALU 2nd operand = sign-extended immediate from Imm Gen.' },
  PCSrc: { controls: 'MUX that picks the next PC', when0: 'Next PC = PC + 4.', when1: 'Next PC = branch target (PC + imm<<1). PCSrc = Branch AND Zero.' },
  MemRead: { controls: 'Data memory read enable', when0: 'Data memory is not read.', when1: 'Data memory contents at Address are put on Read data.' },
  MemWrite: { controls: 'Data memory write enable', when0: 'Data memory is not written.', when1: 'Write data is stored into memory at Address.' },
  MemtoReg: { controls: 'MUX choosing register Write data', when0: 'Write data = ALU result.', when1: 'Write data = data read from memory.' },
  Branch: { controls: 'AND gate feeding PCSrc', when0: 'Not a branch: PCSrc forced to 0.', when1: 'Instruction is a branch: PCSrc follows the ALU Zero output.' },
  ALUOp: { controls: 'ALU control unit', when0: '00 → add (ld/sd address), 01 → subtract (beq compare)', when1: '10 → look at funct7/funct3 (R-type)' },
};
