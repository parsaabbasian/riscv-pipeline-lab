import { describe, expect, it } from 'vitest';
import { encode, parse, signExtend } from './isa';
import { aluControl, CONTROL_TABLE } from './control';
import { initialState, runSingle, stepSingle } from './singleCycle';
import { DEFAULT_OPTS, dependencies, runPipe, timingChart } from './pipeline';

describe('parser & encoding', () => {
  it('parses all lecture instructions', () => {
    const p = parse('add x5, x2, x3\nsub x1,x2,x3\nand x1,x2,x3\nor x1,x2,x3\nld x1, 40(x2)\nsd x3, -8(x4)\nbeq x1, x2, 16');
    expect(p.map((i) => i.op)).toEqual(['add', 'sub', 'and', 'or', 'ld', 'sd', 'beq']);
    expect(p[4]).toMatchObject({ rd: 1, rs1: 2, imm: 40 });
    expect(p[5]).toMatchObject({ rs2: 3, rs1: 4, imm: -8 });
  });
  it('resolves labels to PC-relative offsets', () => {
    const p = parse('loop: add x1,x1,x2\nbeq x0, x0, loop');
    expect(p[1].imm).toBe(-4);
  });
  it('rejects bad input', () => {
    expect(() => parse('mul x1,x2,x3')).toThrow();
    expect(() => parse('ld x1, 5000(x2)')).toThrow();
  });
  it('encodes add x5,x2,x3 correctly', () => {
    const bits = encode(parse('add x5, x2, x3')[0]).map((f) => f.bits).join('');
    expect(bits).toBe('00000000001100010000001010110011');
  });
  it('sign-extends 12-bit immediates', () => {
    expect(signExtend(0xfff, 12)).toBe(-1);
    expect(signExtend(0x7ff, 12)).toBe(2047);
  });
});

describe('control', () => {
  it('ALU control encodings match the lecture', () => {
    expect(aluControl('00', 'x', 'x')).toBe('0010');
    expect(aluControl('01', 'x', 'x')).toBe('0110');
    expect(aluControl('10', '0000000', '000')).toBe('0010');
    expect(aluControl('10', '0100000', '000')).toBe('0110');
    expect(aluControl('10', '0000000', '111')).toBe('0000');
    expect(aluControl('10', '0000000', '110')).toBe('0001');
  });
  it('control table', () => {
    expect(CONTROL_TABLE.ld).toMatchObject({ ALUSrc: 1, MemtoReg: 1, RegWrite: 1, MemRead: 1 });
    expect(CONTROL_TABLE.sd.MemtoReg).toBe('X');
    expect(CONTROL_TABLE.beq).toMatchObject({ Branch: 1, ALUOp0: 1 });
  });
});

describe('single-cycle', () => {
  it('executes R-type, load, store, beq', () => {
    const s0 = initialState({ 2: 7, 3: 5 }, { 48: 99 });
    const add = stepSingle(s0, parse('add x5, x2, x3')[0]);
    expect(add.state.regs[5]).toBe(12);
    expect(add.state.pc).toBe(4);
    const s1 = initialState({ 1: 8 }, { 48: 99 });
    expect(stepSingle(s1, parse('ld x4, 40(x1)')[0]).state.regs[4]).toBe(99);
    expect(stepSingle(s1, parse('sd x1, 0(x1)')[0]).state.mem[8]).toBe(8);
    const b = stepSingle(initialState({ 1: 3, 2: 3 }), parse('beq x1, x2, 16')[0]);
    expect(b.trace.zero).toBe(true);
    expect(b.state.pc).toBe(16);
  });
  it('x0 stays zero', () => {
    expect(stepSingle(initialState({ 2: 1 }), parse('add x0, x2, x2')[0]).state.regs[0]).toBe(0);
  });
  it('and/or', () => {
    const s = initialState({ 1: 0b1100, 2: 0b1010 });
    expect(stepSingle(s, parse('and x3,x1,x2')[0]).state.regs[3]).toBe(0b1000);
    expect(stepSingle(s, parse('or x3,x1,x2')[0]).state.regs[3]).toBe(0b1110);
  });
});

const lectureCode = `ld x1, 0(x31)
ld x2, 8(x31)
add x3, x1, x2
sd x3, 24(x31)
ld x4, 16(x31)
add x5, x1, x4
sd x5, 32(x31)`;
const scheduled = `ld x1, 0(x31)
ld x2, 8(x31)
ld x4, 16(x31)
add x3, x1, x2
sd x3, 24(x31)
add x5, x1, x4
sd x5, 32(x31)`;
const mem = { 0: 1, 8: 2, 16: 4 };

describe('pipeline', () => {
  it('ideal pipeline: n + 4 cycles', () => {
    const r = runPipe(parse('add x1,x2,x3\nadd x4,x5,x6\nadd x7,x8,x9'), initialState(), DEFAULT_OPTS);
    expect(r.cycles).toBe(7);
  });
  it('lecture code scheduling example: 13 vs 11 cycles', () => {
    const a = runPipe(parse(lectureCode), initialState({}, mem), DEFAULT_OPTS);
    const b = runPipe(parse(scheduled), initialState({}, mem), DEFAULT_OPTS);
    expect(a.cycles).toBe(13);
    expect(b.cycles).toBe(11);
    const last = a.states[a.states.length - 1];
    expect(last.mem[24]).toBe(3);
    expect(last.mem[32]).toBe(5);
    expect(b.states[b.states.length - 1].mem[32]).toBe(5);
  });
  it('forwarding avoids stall for add→sub (slide 46)', () => {
    const p = parse('add x1, x2, x3\nsub x4, x1, x5');
    const fw = runPipe(p, initialState({ 2: 10, 3: 5, 5: 1 }), DEFAULT_OPTS);
    expect(fw.cycles).toBe(6);
    expect(fw.states.at(-1)!.regs[4]).toBe(14);
    expect(fw.states.some((s) => s.forwards.some((f) => f.from === 'EX/MEM'))).toBe(true);
    const nf = runPipe(p, initialState({ 2: 10, 3: 5, 5: 1 }), { ...DEFAULT_OPTS, forwarding: false });
    expect(nf.cycles).toBe(8); // two stalls
    expect(nf.states.at(-1)!.regs[4]).toBe(14);
  });
  it('load-use needs exactly one stall with forwarding', () => {
    const r = runPipe(parse('ld x1, 0(x2)\nsub x4, x1, x5'), initialState({}, { 0: 9 }), DEFAULT_OPTS);
    expect(r.cycles).toBe(7);
    expect(r.states.at(-1)!.regs[4]).toBe(9);
  });
  it('taken branch with predict-not-taken flushes one instruction', () => {
    const p = parse('beq x1, x2, 8\nadd x3, x3, x4\nadd x5, x5, x4');
    const r = runPipe(p, initialState({ 4: 1 }), DEFAULT_OPTS);
    const last = r.states.at(-1)!;
    expect(last.regs[3]).toBe(0); // flushed
    expect(last.regs[5]).toBe(1);
    expect(last.flushes).toBe(1);
    const nt = runPipe(p, initialState({ 1: 1, 4: 1 }), DEFAULT_OPTS);
    expect(nt.states.at(-1)!.flushes).toBe(0);
    expect(nt.cycles).toBe(7);
  });
  it('stall-on-branch always loses a cycle', () => {
    const p = parse('beq x1, x2, 8\nadd x3, x3, x4\nadd x5, x5, x4');
    const r = runPipe(p, initialState({ 1: 1, 4: 1 }), { ...DEFAULT_OPTS, branchPolicy: 'stall' });
    expect(r.cycles).toBe(8);
    expect(r.states.at(-1)!.regs[3]).toBe(1);
  });
  it('unified memory causes structural stalls', () => {
    const p = parse('ld x1,0(x0)\nadd x2,x3,x3\nadd x4,x3,x3\nadd x5,x3,x3');
    const r = runPipe(p, initialState(), { ...DEFAULT_OPTS, unifiedMemory: true });
    expect(r.cycles).toBe(9);
  });
  it('wrong-register bug (slide 61) corrupts the wrong register', () => {
    const p = parse('ld x10, 0(x1)\nadd x11,x2,x3\nadd x12,x2,x3\nadd x13,x2,x3\nadd x14,x2,x3');
    const ok = runPipe(p, initialState({}, { 0: 77 }), DEFAULT_OPTS).states.at(-1)!;
    expect(ok.regs[10]).toBe(77);
    const run = runPipe(p, initialState({}, { 0: 77 }), { ...DEFAULT_OPTS, buggyWriteRegister: true });
    expect(run.states.at(-1)!.regs[10]).not.toBe(77);
    expect(run.states[5].regs[13]).toBe(77); // ld's WB (cycle 5) wrote the rd of the instruction then in ID
    expect(run.states[5].events.some((e) => e.kind === 'bug')).toBe(true);
  });
  it('pipeline and single-cycle agree on architectural state', () => {
    const p = parse(lectureCode);
    const sc = runSingle(p, initialState({}, mem)).states.at(-1)!;
    const pp = runPipe(p, initialState({}, mem), { ...DEFAULT_OPTS, forwarding: false }).states.at(-1)!;
    expect(pp.regs).toEqual(sc.regs);
    expect(pp.mem).toEqual(sc.mem);
  });
  it('timing chart has a row per dynamic instruction', () => {
    const r = runPipe(parse('add x1,x2,x3\nadd x4,x1,x1'), initialState(), DEFAULT_OPTS);
    const c = timingChart(r);
    expect(c.length).toBe(2);
    expect(c[1].cells[2].stage).toBe('IF');
    expect(c[1].cells[6].stage).toBe('WB');
  });
  it('dependency analysis reports forwarding and load-use stalls', () => {
    const fw = dependencies(runPipe(parse('add x1,x2,x3; sub x4,x1,x5'.replace('; ', String.fromCharCode(10))), initialState(), DEFAULT_OPTS));
    expect(fw).toHaveLength(1);
    expect(fw[0]).toMatchObject({ reg: 1, distance: 1, stallCycles: 0 });
    expect(fw[0].resolution).toContain('EX/MEM');
    const lu = dependencies(runPipe(parse('ld x1,0(x2); sub x4,x1,x5'.replace('; ', String.fromCharCode(10))), initialState(), DEFAULT_OPTS));
    expect(lu[0].stallCycles).toBe(1);
    expect(lu[0].resolution).toContain('MEM/WB');
  });
});
