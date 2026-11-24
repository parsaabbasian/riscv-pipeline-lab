import { describe, expect, it } from 'vitest';
import { branchStalls, DUAL_LOOP, DUAL_UNROLLED, forwardingUnit, ipc, loadUseHazard, nestedLoopOutcomes, OOO_EXAMPLE, peak, runPredictor, schedule } from './lect9';
import { L9_MODULES } from '../content/modulesL9';
import { coverage } from '../content/coverage';

const base = { exmemRegWrite: false, exmemRd: 0, memwbRegWrite: false, memwbRd: 0, rs1: 0, rs2: 0 };
describe('Lecture 9 forwarding unit', () => {
  it('EX hazard → 10, MEM hazard → 01', () => {
    expect(forwardingUnit({ ...base, exmemRegWrite: true, exmemRd: 2, rs1: 2, rs2: 5 }).A).toBe('10');
    expect(forwardingUnit({ ...base, memwbRegWrite: true, memwbRd: 2, rs1: 6, rs2: 2 }).B).toBe('01');
  });
  it('ignores x0 and non-writing instructions', () => {
    expect(forwardingUnit({ ...base, exmemRegWrite: true, exmemRd: 0, rs1: 0 }).A).toBe('00');
    expect(forwardingUnit({ ...base, exmemRegWrite: false, exmemRd: 2, rs1: 2 }).A).toBe('00');
  });
  it('double hazard picks EX/MEM only with the revised condition', () => {
    const i = { ...base, exmemRegWrite: true, exmemRd: 1, memwbRegWrite: true, memwbRd: 1, rs1: 1 };
    expect(forwardingUnit(i, true).A).toBe('10');
    expect(forwardingUnit(i, false).A).toBe('01');
  });
});
describe('Lecture 9 hazards', () => {
  it('load-use detection', () => {
    expect(loadUseHazard(true, 2, 5, 2)).toBe(true);
    expect(loadUseHazard(false, 2, 2, 2)).toBe(false);
  });
  it('branch stalls match slides 37–39', () => {
    expect([branchStalls('alu', 1), branchStalls('alu', 2), branchStalls('load', 1), branchStalls('load', 2), branchStalls('load', 3)]).toEqual([1, 0, 2, 1, 0]);
  });
  it('1-bit misses twice per run, 2-bit once', () => {
    const seq = nestedLoopOutcomes(10, 5);
    expect(runPredictor('1bit', seq).filter((s) => !s.ok).length).toBe(9);
    expect(runPredictor('2bit', seq).filter((s) => !s.ok).length).toBe(5);
  });
  it('dual-issue IPC from slides 66 and 68', () => {
    expect(ipc(DUAL_LOOP).ipc).toBe(1.25);
    expect(ipc(DUAL_UNROLLED)).toMatchObject({ instrs: 14, cycles: 8, ipc: 1.75 });
    expect(peak(4, 4)).toEqual({ bips: 16, ipc: 4, cpi: 0.25 });
  });
  it('out-of-order finishes no later than in-order and lets sub go before add', () => {
    const io = schedule(OOO_EXAMPLE, false), oo = schedule(OOO_EXAMPLE, true);
    expect(oo.issue[2]).toBeLessThan(oo.issue[1]);
    expect(Math.max(...oo.commit)).toBeLessThanOrEqual(Math.max(...io.commit));
    oo.commit.forEach((c, k) => k && expect(c).toBeGreaterThan(oo.commit[k - 1]));
  });
  it('every Lecture 9 slide is covered', () => {
    expect(L9_MODULES.length).toBe(8);
    expect(coverage(9).filter((r) => r.status === 'missing').map((r) => r.slide)).toEqual([]);
    expect(coverage(8).length).toBe(61);
  });
});
