// RISC-V subset used in Lecture 8: add, sub, and, or, ld, sd, beq (plus lw/sw as 32-bit aliases for teaching).
export type Op = 'add' | 'sub' | 'and' | 'or' | 'ld' | 'sd' | 'beq' | 'nop';
export type Format = 'R' | 'I' | 'S' | 'SB';

export interface Instr {
  op: Op;
  rd: number;
  rs1: number;
  rs2: number;
  imm: number; // byte offset (for beq: byte displacement, already multiplied by 2 conceptually)
  text: string;
  line: number;
}

export const FORMAT: Record<Op, Format> = {
  add: 'R', sub: 'R', and: 'R', or: 'R', ld: 'I', sd: 'S', beq: 'SB', nop: 'I',
};

/** Which source registers an instruction actually reads (used by hazard detection). */
export function readsRegs(i: Instr): { rs1: boolean; rs2: boolean } {
  switch (i.op) {
    case 'add': case 'sub': case 'and': case 'or': case 'beq': case 'sd': return { rs1: true, rs2: true };
    case 'ld': return { rs1: true, rs2: false };
    default: return { rs1: false, rs2: false };
  }
}
export function writesReg(i: Instr): boolean {
  return ['add', 'sub', 'and', 'or', 'ld'].includes(i.op) && i.rd !== 0;
}

export class ParseError extends Error {
  constructor(public line: number, msg: string) { super(`Line ${line}: ${msg}`); }
}

function reg(tok: string, line: number): number {
  const t = tok.trim().toLowerCase();
  const m = /^x(\d{1,2})$/.exec(t);
  if (m && +m[1] < 32) return +m[1];
  if (t === 'zero') return 0;
  throw new ParseError(line, `"${tok}" is not a register (use x0–x31)`);
}
function num(tok: string, line: number): number {
  const t = tok.trim();
  const v = /^-?0x[0-9a-f]+$/i.test(t) ? parseInt(t, 16) : /^-?\d+$/.test(t) ? parseInt(t, 10) : NaN;
  if (Number.isNaN(v)) throw new ParseError(line, `"${tok}" is not a number`);
  return v;
}

/** Parse assembly text into instructions. Labels ("loop:") are supported for beq. */
export function parse(src: string): Instr[] {
  const raw = src.split(/\r?\n/);
  const labels: Record<string, number> = {};
  const lines: { text: string; line: number }[] = [];
  raw.forEach((l, idx) => {
    let s = l.replace(/(#|\/\/).*$/, '').trim();
    const lm = /^([A-Za-z_]\w*):\s*(.*)$/.exec(s);
    if (lm) { labels[lm[1]] = lines.length * 4; s = lm[2].trim(); }
    if (s) lines.push({ text: s, line: idx + 1 });
  });
  return lines.map(({ text, line }, k) => {
    const m = /^(\w+)\s*(.*)$/.exec(text);
    if (!m) throw new ParseError(line, 'cannot read instruction');
    let mn = m[1].toLowerCase();
    if (mn === 'lw') mn = 'ld';
    if (mn === 'sw') mn = 'sd';
    const args = m[2].split(',').map((a) => a.trim()).filter(Boolean);
    const base = { text, line, rd: 0, rs1: 0, rs2: 0, imm: 0 };
    const need = (n: number) => { if (args.length !== n) throw new ParseError(line, `${mn} expects ${n} operands`); };
    switch (mn) {
      case 'add': case 'sub': case 'and': case 'or':
        need(3);
        return { ...base, op: mn as Op, rd: reg(args[0], line), rs1: reg(args[1], line), rs2: reg(args[2], line) };
      case 'ld': case 'sd': {
        need(2);
        const mm = /^(-?(?:0x)?[0-9a-f]*)\s*\(\s*(\w+)\s*\)$/i.exec(args[1]);
        if (!mm) throw new ParseError(line, `${mn} uses offset(base), e.g. 40(x1)`);
        const imm = mm[1] === '' ? 0 : num(mm[1], line);
        if (imm < -2048 || imm > 2047) throw new ParseError(line, 'offset must fit in 12 signed bits (−2048…2047)');
        const r = reg(args[0], line), b = reg(mm[2], line);
        return mn === 'ld' ? { ...base, op: 'ld', rd: r, rs1: b, imm } : { ...base, op: 'sd', rs2: r, rs1: b, imm };
      }
      case 'beq': {
        need(3);
        const t = args[2];
        const imm = t in labels ? labels[t] - k * 4 : num(t, line);
        if (imm % 2 !== 0) throw new ParseError(line, 'branch offset must be even');
        return { ...base, op: 'beq', rs1: reg(args[0], line), rs2: reg(args[1], line), imm };
      }
      case 'nop':
        return { ...base, op: 'nop' };
      default:
        throw new ParseError(line, `unsupported instruction "${mn}" (supported: add, sub, and, or, ld, sd, beq, nop)`);
    }
  });
}

const bin = (v: number, w: number) => ((v >>> 0) & ((1 << w) - 1 >>> 0 || 0xffffffff)).toString(2).padStart(w, '0').slice(-w);

export interface Field { name: string; bits: string; width: number; meaning: string }

/** Real RISC-V machine encoding fields. */
export function encode(i: Instr): Field[] {
  const r = (n: number) => bin(n, 5);
  switch (i.op) {
    case 'add': case 'sub': case 'and': case 'or': {
      const f3 = { add: '000', sub: '000', and: '111', or: '110' }[i.op];
      const f7 = i.op === 'sub' ? '0100000' : '0000000';
      return [
        { name: 'funct7', bits: f7, width: 7, meaning: 'selects add vs sub' }, { name: 'rs2', bits: r(i.rs2), width: 5, meaning: `x${i.rs2}` },
        { name: 'rs1', bits: r(i.rs1), width: 5, meaning: `x${i.rs1}` }, { name: 'funct3', bits: f3, width: 3, meaning: 'operation' },
        { name: 'rd', bits: r(i.rd), width: 5, meaning: `x${i.rd}` }, { name: 'opcode', bits: '0110011', width: 7, meaning: 'R-type' },
      ];
    }
    case 'ld': case 'nop':
      return [
        { name: 'imm[11:0]', bits: bin(i.imm, 12), width: 12, meaning: `offset ${i.imm}` }, { name: 'rs1', bits: r(i.rs1), width: 5, meaning: `base x${i.rs1}` },
        { name: 'funct3', bits: i.op === 'nop' ? '000' : '011', width: 3, meaning: i.op === 'nop' ? 'addi' : 'doubleword' }, { name: 'rd', bits: r(i.rd), width: 5, meaning: `x${i.rd}` },
        { name: 'opcode', bits: i.op === 'nop' ? '0010011' : '0000011', width: 7, meaning: i.op === 'nop' ? 'addi x0,x0,0' : 'load' },
      ];
    case 'sd': {
      const b = bin(i.imm, 12);
      return [
        { name: 'imm[11:5]', bits: b.slice(0, 7), width: 7, meaning: 'offset upper' }, { name: 'rs2', bits: r(i.rs2), width: 5, meaning: `data x${i.rs2}` },
        { name: 'rs1', bits: r(i.rs1), width: 5, meaning: `base x${i.rs1}` }, { name: 'funct3', bits: '011', width: 3, meaning: 'doubleword' },
        { name: 'imm[4:0]', bits: b.slice(7), width: 5, meaning: 'offset lower' }, { name: 'opcode', bits: '0100011', width: 7, meaning: 'store' },
      ];
    }
    case 'beq': {
      const b = bin(i.imm >> 1, 12); // imm[12:1], bit 12 is b[0]
      return [
        { name: 'imm[12|10:5]', bits: b[0] + b.slice(2, 8), width: 7, meaning: 'offset' }, { name: 'rs2', bits: r(i.rs2), width: 5, meaning: `x${i.rs2}` },
        { name: 'rs1', bits: r(i.rs1), width: 5, meaning: `x${i.rs1}` }, { name: 'funct3', bits: '000', width: 3, meaning: 'beq' },
        { name: 'imm[4:1|11]', bits: b.slice(8) + b[1], width: 5, meaning: 'offset' }, { name: 'opcode', bits: '1100011', width: 7, meaning: 'branch' },
      ];
    }
  }
}

export const NOP: Instr = { op: 'nop', rd: 0, rs1: 0, rs2: 0, imm: 0, text: 'nop', line: 0 };

/** Sign-extend the low `bits` bits of v. */
export function signExtend(v: number, bits: number): number {
  const m = 1 << (bits - 1);
  const x = v & ((1 << bits) - 1);
  return (x ^ m) - m;
}

/** 64-bit-safe ALU ops on JS numbers via BigInt. */
export function alu(ctrl: string, a: number, b: number): number {
  const A = BigInt(a), B = BigInt(b);
  let r: bigint;
  switch (ctrl) {
    case '0000': r = A & B; break;
    case '0001': r = A | B; break;
    case '0010': r = A + B; break;
    case '0110': r = A - B; break;
    default: r = 0n;
  }
  return Number(BigInt.asIntN(64, r));
}
