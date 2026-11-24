import { ALL_TOPICS } from './modules';
import { parse } from '../sim/isa';
import { initialState } from '../sim/singleCycle';
import { DEFAULT_OPTS, runPipe } from '../sim/pipeline';

export interface Question {
  id: string; module: string; type: 'mcq' | 'tf' | 'num';
  difficulty: 1 | 2 | 3; category: string;
  q: string; code?: string; options?: string[]; answer: number;
  hint: string; solution: string; wrong?: string[]; slides: string;
}

const fromTopics: Question[] = ALL_TOPICS.map((t) => ({
  id: `chk-${t.id}`, module: t.module.id, type: 'mcq', difficulty: 1, category: 'Concept check',
  q: t.check.q, options: t.check.options, answer: t.check.answer, hint: `Revisit “${t.title}”.`, solution: t.check.why, wrong: t.check.wrong, slides: t.slides,
}));

/** Pipeline cycle counts are computed by the real simulator, never hardcoded. */
function cycles(src: string, forwarding = true, extra: Partial<typeof DEFAULT_OPTS> = {}) {
  return runPipe(parse(src), initialState({ 1: 3, 2: 3 }), { ...DEFAULT_OPTS, forwarding, ...extra }).cycles;
}
const P1 = 'add x1, x2, x3\nsub x4, x1, x5\nand x6, x1, x7\nor x8, x4, x6';
const P2 = 'ld x1, 0(x2)\nadd x3, x1, x4\nsd x3, 8(x2)';
const P3 = 'ld x1, 0(x2)\nld x5, 8(x2)\nadd x3, x1, x5';

const bank: Question[] = [
  { id: 'q9-fwdsel', module: 'l9m3', type: 'mcq', difficulty: 2, category: 'Forwarding', q: 'sub x2,x1,x3 is followed by and x12,x2,x5. When and is in EX, what is ForwardA?', options: ['00', '10', '01', '11'], answer: 1, hint: 'sub is one stage ahead, in MEM.', solution: 'sub’s result is in EX/MEM → ForwardA = 10 (slide 24).', slides: '19–24' },
  { id: 'q9-x0', module: 'l9m3', type: 'tf', difficulty: 2, category: 'Forwarding', q: 'True or false: add x0,x1,x2 followed by sub x3,x0,x4 forwards the add result to sub.', options: ['True', 'False'], answer: 1, hint: 'Slide 22.', solution: 'False. Forwarding requires Rd ≠ 0; x0 always reads as 0.', slides: '22' },
  { id: 'q9-double', module: 'l9m3', type: 'num', difficulty: 3, category: 'Double hazard', q: 'x1=1, x2=10, x3=100, x4=1000. After add x1,x1,x2; add x1,x1,x3; add x1,x1,x4 (correct forwarding), what is x1?', answer: 1111, hint: 'Each add uses the newest x1.', solution: '1+10=11, 11+100=111, 111+1000=1111.', slides: '25–26' },
  { id: 'q9-lu', module: 'l9m4', type: 'num', difficulty: 2, category: 'Count stalls and cycles', code: 'ld x1, 0(x2)\nadd x3, x1, x4\nsub x5, x3, x6', q: 'With forwarding, how many stall cycles does this code have?', answer: 1, hint: 'Load followed immediately by use.', solution: 'One load-use stall; the add→sub dependency is forwarded.', slides: '28–30' },
  { id: 'q9-stall-pc', module: 'l9m4', type: 'mcq', difficulty: 1, category: 'Stalling', q: 'Which is NOT part of a load-use stall?', options: ['ID/EX control set to 0', 'PC not updated', 'IF/ID not updated', 'Flush EX/MEM'], answer: 3, hint: 'The load in front keeps going.', solution: 'The load must continue to MEM; only the front is frozen and a bubble inserted (slide 29).', slides: '29' },
  { id: 'q9-btarget', module: 'l9m5', type: 'num', difficulty: 1, category: 'Branch target', q: 'beq x1,x3,16 at address 40 (slide 34). Target address?', answer: 72, hint: 'PC + imm × 2.', solution: '40 + 16 × 2 = 72.', slides: '34' },
  { id: 'q9-bstall', module: 'l9m5', type: 'num', difficulty: 2, category: 'Count stalls and cycles', code: 'ld x1, 0(x2)\nbeq x1, x0, target', q: 'Branch resolved in ID, full forwarding. Stall cycles?', answer: 2, hint: 'Slide 39.', solution: 'Load immediately before a branch → 2 stalls.', slides: '39' },
  { id: 'q9-bstall2', module: 'l9m5', type: 'num', difficulty: 2, category: 'Count stalls and cycles', code: 'ld x1, 0(x2)\nadd x4, x5, x6\nbeq x1, x4, target', q: 'Branch in ID. Stall cycles?', answer: 1, hint: 'Both the load (2nd before) and the add (just before) need 1.', solution: 'Slide 38: 1 stall.', slides: '38' },
  { id: 'q9-1bit', module: 'l9m6', type: 'num', difficulty: 2, category: 'Branch prediction', q: 'An inner loop runs 10 iterations, and is entered 5 times. With a 1-bit predictor (initially taken), how many mispredictions in total?', answer: 9, hint: 'First run: only the exit. Later runs: entry + exit.', solution: 'Run 1: 1 miss; runs 2–5: 2 each → 1 + 8 = 9.', slides: '41' },
  { id: 'q9-2bit', module: 'l9m6', type: 'num', difficulty: 2, category: 'Branch prediction', q: 'Same loop (10 iterations × 5 runs) with a 2-bit predictor starting in strong taken. Mispredictions?', answer: 5, hint: 'One per run.', solution: 'Only the exit misses each run: 5.', slides: '42' },
  { id: 'q9-cause', module: 'l9m7', type: 'num', difficulty: 1, category: 'Exceptions', q: 'What SCAUSE exception code does the lecture give for an undefined opcode?', answer: 2, hint: 'Slide 45.', solution: '2 for undefined opcode, 12 for hardware malfunction.', slides: '45' },
  { id: 'q9-exc-int', module: 'l9m7', type: 'mcq', difficulty: 1, category: 'Exceptions', q: 'Which register holds the address of the instruction that caused the exception?', options: ['SCAUSE', 'SEPC', 'PC + 4', 'x1'], answer: 1, hint: 'Supervisor Exception Program Counter.', solution: 'SEPC (slide 45).', slides: '45, 50' },
  { id: 'q9-precise', module: 'l9m7', type: 'tf', difficulty: 2, category: 'Exceptions', q: 'True or false: imprecise exceptions simplify hardware but make the handler more complex.', options: ['True', 'False'], answer: 0, hint: 'Slide 55.', solution: 'True.', slides: '55' },
  { id: 'q9-ipc', module: 'l9m8', type: 'num', difficulty: 2, category: 'Multiple issue', q: 'Slide 66 schedule: 5 instructions in 4 cycles on dual issue. IPC? (two decimals)', answer: 1.25, hint: 'instructions / cycles', solution: '5 / 4 = 1.25.', slides: '66' },
  { id: 'q9-bips', module: 'l9m8', type: 'num', difficulty: 1, category: 'Multiple issue', q: 'Peak BIPS of a 4 GHz, 4-way multiple-issue processor?', answer: 16, hint: 'GHz × width.', solution: '4 × 4 = 16 BIPS.', slides: '56' },
  { id: 'q9-dual', module: 'l9m8', type: 'tf', difficulty: 2, category: 'Multiple issue', q: 'True or false: in static dual-issue RISC-V, add x10,x0,x1 and ld x2,0(x10) can be in the same packet.', options: ['True', 'False'], answer: 1, hint: 'Slide 65.', solution: 'False. The ld needs the add result; they must be split into two packets.', slides: '65' },
  { id: 'q9-ctrl', module: 'l9m2', type: 'mcq', difficulty: 1, category: 'Pipelined control', q: 'Which group of control signals is stored in MEM/WB?', options: ['EX', 'M', 'WB', 'All three'], answer: 2, hint: 'Only what is still needed.', solution: 'MEM/WB keeps only RegWrite and MemtoReg (slide 18).', slides: '18' },
  { id: 'q9-wrongreg', module: 'l9m1', type: 'mcq', difficulty: 2, category: 'Pipeline operation', q: 'Why is the register number wrong in slide 8?', options: ['The ALU is too slow', 'IF/ID holds a later instruction by the time ld reaches WB', 'Memory returned bad data', 'x0 was written'], answer: 1, hint: 'Who is in IF/ID during ld’s WB?', solution: 'rd must travel with ld to MEM/WB (slide 9).', slides: '8–9' },
  { id: 'q-mux-sel', module: 'm2', type: 'num', difficulty: 1, category: 'Predict circuit output', q: 'A 2-to-1 MUX has I0 = 12, I1 = 30. S = 0. What is Y?', answer: 12, hint: 'S = 0 picks I0.', solution: 'Y = S ? I1 : I0 = I0 = 12.', slides: '5, 8' },
  { id: 'q-reg-we', module: 'm3', type: 'tf', difficulty: 1, category: 'Predict circuit output', q: 'True or false: an edge-triggered register with Write = 1 changes Q whenever D changes while the clock is HIGH.', options: ['True', 'False'], answer: 1, hint: 'Edge-triggered.', solution: 'False. Q changes only at the rising edge (0 → 1). While HIGH, D changes are ignored.', slides: '9–10' },
  { id: 'q-clock', module: 'm3', type: 'num', difficulty: 2, category: 'Calculation', q: 'The critical path is 500 ps. What is the maximum clock frequency in GHz?', answer: 2, hint: 'f = 1 / T.', solution: '1 / 500 ps = 2 × 10⁹ Hz = 2 GHz.', slides: '11' },
  { id: 'q-ea1', module: 'm4', type: 'num', difficulty: 1, category: 'Calculate effective address', q: 'x6 = 2000. What address does ld x5, 64(x6) read?', answer: 2064, hint: 'base + offset', solution: '2000 + 64 = 2064.', slides: '15' },
  { id: 'q-ea2', module: 'm4', type: 'num', difficulty: 2, category: 'Calculate effective address', q: 'x9 = 512. The 12-bit immediate field of sd x1, imm(x9) is 0xFF0. What is the effective address?', answer: 496, hint: 'Sign-extend 0xFF0.', solution: '0xFF0 has the sign bit set → −16. 512 − 16 = 496.', slides: '15, 17' },
  { id: 'q-btarget', module: 'm4', type: 'num', difficulty: 2, category: 'Calculation', q: 'A beq at PC = 1000 has immediate field value 10 (in halfwords). What is the branch target?', answer: 1020, hint: 'Shift left 1, then add to PC.', solution: '10 << 1 = 20; 1000 + 20 = 1020.', slides: '16' },
  { id: 'q-dp-ident', module: 'm4', type: 'mcq', difficulty: 1, category: 'Identify datapath components', q: 'Which component produces the second ALU operand for ld?', options: ['Register file Read data 2', 'Imm Gen through the ALUSrc MUX', 'PC + 4 adder', 'Data memory'], answer: 1, hint: 'ld needs an offset.', solution: 'ALUSrc = 1 selects the sign-extended immediate from Imm Gen.', wrong: ['That is for R-type/beq.', '', 'Only feeds the PC MUX.', 'Memory is accessed after the ALU.'], slides: '15, 19' },
  { id: 'q-ctrl-r', module: 'm5', type: 'mcq', difficulty: 2, category: 'Determine control signals', q: 'For or x1, x2, x3, what are (ALUSrc, MemtoReg, RegWrite, ALUOp)?', options: ['(0, 0, 1, 10)', '(1, 1, 1, 00)', '(0, X, 0, 01)', '(1, X, 0, 00)'], answer: 0, hint: 'R-type.', solution: 'R-type row of the control table: ALUSrc 0, MemtoReg 0, RegWrite 1, ALUOp 10.', wrong: ['', 'That is ld.', 'That is beq.', 'That is sd.'], slides: '27–28' },
  { id: 'q-ctrl-alu', module: 'm5', type: 'mcq', difficulty: 2, category: 'Determine control signals', q: 'ALUOp = 10, funct7 = 0000000, funct3 = 110. ALU control = ?', options: ['0000', '0001', '0010', '0110'], answer: 1, hint: 'funct3 110 is or.', solution: 'or → 0001.', wrong: ['and uses 111 → 0000.', '', 'add.', 'sub.'], slides: '22–23' },
  { id: 'q-ctrl-dc', module: 'm5', type: 'tf', difficulty: 2, category: 'Determine control signals', q: 'True or false: MemWrite may be “don’t care” for beq because beq does not use memory.', options: ['True', 'False'], answer: 1, hint: 'What if it were 1?', solution: 'False. If MemWrite were 1, memory would be corrupted. Enable signals that change state must always be 0 when unused.', slides: '27' },
  { id: 'q-debug1', module: 'm5', type: 'mcq', difficulty: 3, category: 'Debug incorrect datapaths', q: 'A student’s CPU executes ld correctly, but every R-type instruction writes a garbage value from memory. Which signal is most likely wrong for R-type?', options: ['ALUSrc stuck at 0', 'MemtoReg stuck at 1', 'Branch stuck at 0', 'MemWrite stuck at 0'], answer: 1, hint: 'Which MUX picks what is written back?', solution: 'If MemtoReg = 1 for R-type, the register file receives data memory output instead of the ALU result.', wrong: ['ALUSrc = 0 is correct for R-type.', '', 'Branch = 0 is correct.', 'MemWrite = 0 is correct.'], slides: '18, 28' },
  { id: 'q-debug2', module: 'm5', type: 'mcq', difficulty: 3, category: 'Debug incorrect datapaths', q: 'beq is always taken, even when the registers differ. Likely bug?', options: ['PCSrc wired to Branch only (not Branch AND Zero)', 'ALUSrc = 0', 'ALUOp = 01', 'RegWrite = 0'], answer: 0, hint: 'What decides PCSrc?', solution: 'PCSrc must be Branch · Zero. Without the AND with Zero, every branch is taken.', wrong: ['', 'Correct for beq.', 'Correct for beq.', 'Correct for beq.'], slides: '27, 31' },
  { id: 'q-sc-period', module: 'm6', type: 'num', difficulty: 2, category: 'Calculation', q: 'Instruction memory 250 ps, register read 150, ALU 200, data memory 300, register write 100. Single-cycle clock period (ps)?', answer: 1000, hint: 'The load path uses all five.', solution: '250 + 150 + 200 + 300 + 100 = 1000 ps (critical path: load).', slides: '32, 39' },
  { id: 'q-multi-cpi', module: 'm6', type: 'num', difficulty: 2, category: 'Calculation', q: 'In the multicycle design, how many cycles does ld take?', answer: 5, hint: 'Fetch, decode, address, memory, write-back.', solution: '5 steps: IF, ID/reg read, address calc, memory read, write back.', slides: '35–36' },
  { id: 'q-speedup1', module: 'm7', type: 'num', difficulty: 2, category: 'Calculate pipeline speedup', q: 'Using 800 ps single-cycle and 200 ps pipelined clocks, how long (ps) do 3 loads take in the pipeline (no hazards)?', answer: 1400, hint: '(n + 4) × 200', solution: '(3 + 4) × 200 = 1400 ps (single-cycle: 2400 ps).', slides: '40' },
  { id: 'q-speedup2', module: 'm7', type: 'num', difficulty: 3, category: 'Calculate pipeline speedup', q: 'Stages: 150, 100, 200, 250, 100 ps. Ideal speedup for a very long program vs single-cycle (sum of stages)? (two decimals)', answer: 3.2, hint: 'sum / max', solution: 'Single-cycle = 800 ps; pipelined clock = 250 ps; 800/250 = 3.2.', slides: '41' },
  { id: 'q-latency', module: 'm7', type: 'tf', difficulty: 1, category: 'Concept', q: 'True or false: pipelining reduces the latency of each individual instruction.', options: ['True', 'False'], answer: 1, hint: 'Slide 41.', solution: 'False. Speedup is due to increased throughput; latency does not decrease (it can increase: 5 × 200 = 1000 ps > 800 ps).', slides: '41' },
  { id: 'q-stage-wb', module: 'm7', type: 'mcq', difficulty: 1, category: 'Trace instruction execution', q: 'In which cycle does the 3rd instruction of a hazard-free sequence reach WB?', options: ['5', '6', '7', '8'], answer: 2, hint: 'Instruction i starts IF in cycle i.', solution: 'Instruction 3 is in IF at cycle 3, WB at cycle 3 + 4 = 7.', wrong: ['That is instruction 1.', 'That is instruction 2.', '', 'Too late.'], slides: '38–40' },
  { id: 'q-hz-type', module: 'm8', type: 'mcq', difficulty: 1, category: 'Identify hazards', q: 'ld x1,0(x2) immediately followed by add x3,x1,x4 is a…', options: ['Structural hazard', 'Load-use data hazard', 'Control hazard', 'No hazard'], answer: 1, hint: 'add uses what ld loads.', solution: 'The loaded value is needed by the next instruction: load-use data hazard (1 stall with forwarding).', wrong: ['No resource conflict with separate memories.', '', 'No branch.', 'There is a dependency.'], slides: '47' },
  { id: 'q-fw-need', module: 'm8', type: 'mcq', difficulty: 2, category: 'Determine forwarding requirements', code: P1, q: 'For this code, which forwarding paths does `or x8, x4, x6` use?', options: ['x4 from MEM/WB, x6 from EX/MEM', 'x4 from EX/MEM, x6 from MEM/WB', 'Both from the register file', 'Both from EX/MEM'], answer: 0, hint: 'sub is 2 instructions before or; and is 1 before.', solution: 'and (writes x6) is directly before or → EX/MEM; sub (writes x4) is two before → MEM/WB.', wrong: ['', 'Reversed.', 'Values aren’t written yet.', 'Only one instruction is in EX/MEM.'], slides: '46' },
  { id: 'q-cyc1', module: 'm8', type: 'num', difficulty: 2, category: 'Count stalls and cycles', code: P1, q: 'With forwarding, how many cycles does this code take?', answer: cycles(P1), hint: 'All dependencies are ALU→ALU.', solution: `ALU results can always be forwarded: no stalls → 4 + 4 = ${cycles(P1)} cycles (computed by the simulator).`, slides: '46' },
  { id: 'q-cyc2', module: 'm8', type: 'num', difficulty: 3, category: 'Count stalls and cycles', code: P1, q: 'WITHOUT forwarding, how many cycles does this code take?', answer: cycles(P1, false), hint: 'Each adjacent RAW dependency costs 2 stalls; a distance-2 dependency costs 1.', solution: `sub needs x1 (2 stalls). and needs x1, but by then add has written it. or needs x6 from and (adjacent, 2 stalls). Stalls = ${cycles(P1, false) - 8}; total = 4 + 4 + ${cycles(P1, false) - 8} = ${cycles(P1, false)} cycles (simulator).`, slides: '45' },
  { id: 'q-cyc3', module: 'm8', type: 'num', difficulty: 2, category: 'Count stalls and cycles', code: P2, q: 'With forwarding, total cycles?', answer: cycles(P2), hint: 'One load-use.', solution: `3 instructions + 4 + 1 load-use stall = ${cycles(P2)} (sd gets x3 by forwarding).`, slides: '47' },
  { id: 'q-cyc4', module: 'm8', type: 'num', difficulty: 3, category: 'Count stalls and cycles', code: P3, q: 'With forwarding, total cycles?', answer: cycles(P3), hint: 'Which load is adjacent to add?', solution: `ld x5 is directly before add → 1 stall. 3 + 4 + 1 = ${cycles(P3)}.`, slides: '47–48' },
  { id: 'q-sched', module: 'm8', type: 'num', difficulty: 2, category: 'Count stalls and cycles', q: 'The slide 48 example: how many cycles after reordering?', answer: 11, hint: 'No stalls left.', solution: '7 + 4 = 11 (the original needed 13).', slides: '48' },
  { id: 'q-struct', module: 'm8', type: 'mcq', difficulty: 2, category: 'Identify hazards', q: 'With one shared memory, which pair of stages conflicts?', options: ['IF and MEM', 'ID and WB', 'EX and MEM', 'IF and ID'], answer: 0, hint: 'Who accesses memory?', solution: 'IF reads instructions and MEM reads/writes data: both need memory in the same cycle.', wrong: ['', 'Register file handles both with write-first/read-second.', 'EX uses the ALU.', 'Different resources.'], slides: '44' },
  { id: 'q-br-pen', module: 'm9', type: 'num', difficulty: 2, category: 'Count stalls and cycles', q: '20% of instructions are branches, branch penalty is 1 cycle with stall-on-branch, base CPI = 1. Effective CPI? (one decimal)', answer: 1.2, hint: 'CPI = 1 + fraction × penalty', solution: '1 + 0.2 × 1 = 1.2.', slides: '50' },
  { id: 'q-br-pnt', module: 'm9', type: 'num', difficulty: 3, category: 'Count stalls and cycles', q: 'Predict-not-taken, 20% branches, 60% of them taken, 1-cycle penalty. Effective CPI? (two decimals)', answer: 1.12, hint: 'Only taken branches cost.', solution: '1 + 0.2 × 0.6 × 1 = 1.12.', slides: '51–52' },
  { id: 'q-btfn', module: 'm9', type: 'mcq', difficulty: 2, category: 'Concept', q: 'Which is a static prediction rule from the lecture?', options: ['Predict backward branches taken, forward not taken', 'Record history of each branch', 'Use a 2-bit counter', 'Predict whatever happened last time'], answer: 0, hint: 'Static = based on typical behaviour.', solution: 'Slide 53: static prediction based on typical loop/if behaviour.', wrong: ['', 'Dynamic.', 'Dynamic implementation.', 'Dynamic (1-bit).'], slides: '53' },
  { id: 'q-loop-acc', module: 'm9', type: 'num', difficulty: 3, category: 'Calculation', q: 'A loop branch is taken 9 times then not taken once. Using predict-taken (BTFN for backward), how many mispredictions?', answer: 1, hint: 'Only the exit is wrong.', solution: 'Taken 9× (correct), not-taken 1× (wrong) → 1 misprediction, 90% accuracy.', slides: '53' },
  { id: 'q-pr-ifid', module: 'm10', type: 'mcq', difficulty: 1, category: 'Identify datapath components', q: 'What does the IF/ID register hold?', options: ['Instruction and PC', 'ALU result', 'Memory data', 'Control signals for WB only'], answer: 0, hint: 'Output of the fetch stage.', solution: 'IF/ID latches the fetched instruction and its PC (PC + 4).', wrong: ['', 'EX/MEM.', 'MEM/WB.', 'Control is generated in ID.'], slides: '55–56' },
  { id: 'q-wrongreg', module: 'm10', type: 'mcq', difficulty: 3, category: 'Debug incorrect datapaths', code: 'ld x10, 40(x1)\nadd x11, x2, x3\nadd x12, x3, x4\nadd x13, x5, x6\nadd x14, x7, x8', q: 'If WB uses IF/ID’s rd, which register receives the loaded value?', options: ['x10', 'x11', 'x13', 'x14'], answer: 2, hint: 'When ld is in WB (cycle 5), which instruction is in ID?', solution: 'Cycle 5: ld in WB, add x13 in ID (add x14 in IF). The write goes to x13. This is the slide 61 bug. Fix: use MEM/WB.rd.', wrong: ['Correct design only.', 'In MEM at that time.', '', 'In IF at that time.'], slides: '61' },
  { id: 'q-diagram', module: 'm10', type: 'mcq', difficulty: 2, category: 'Complete pipeline timing diagrams', q: 'In a hazard-free 5-stage pipeline, in cycle 4 instruction 2 is in which stage?', options: ['IF', 'ID', 'EX', 'MEM'], answer: 2, hint: 'Instruction 2 starts IF in cycle 2.', solution: 'Cycle 2 IF, 3 ID, 4 EX.', wrong: ['Cycle 2.', 'Cycle 3.', '', 'Cycle 5.'], slides: '57–60' },
];

export const QUESTIONS: Question[] = [...fromTopics, ...bank];

export function checkAnswer(q: Question, given: string): boolean {
  if (q.type === 'num') {
    const v = parseFloat(given);
    return Number.isFinite(v) && Math.abs(v - q.answer) < 1e-6 + Math.abs(q.answer) * 0.005;
  }
  return +given === q.answer;
}

/** Procedurally generated practice (answers computed by the simulator). */
export function generateQuestion(seed: number): Question {
  let s = seed || 1;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const kind = Math.floor(r() * 3);
  if (kind === 0) {
    const base = 8 * Math.floor(r() * 400), off = 8 * Math.floor(r() * 64 - 32);
    return { id: `gen-${seed}`, module: 'm4', type: 'num', difficulty: 2, category: 'Calculate effective address', q: `x7 = ${base}. What address does ld x3, ${off}(x7) access?`, answer: base + off, hint: 'rs1 + sign-extended offset', solution: `${base} + (${off}) = ${base + off}.`, slides: '15' };
  }
  if (kind === 1) {
    const n = 2 + Math.floor(r() * 4);
    const regs = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'];
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const op = pick(['add', 'sub', 'ld', 'and', 'or']);
      const rd = pick(regs), a = pick(regs), b = pick(regs);
      lines.push(op === 'ld' ? `ld ${rd}, 0(${a})` : `${op} ${rd}, ${a}, ${b}`);
    }
    const fw = r() > 0.4;
    const code = lines.join('\n');
    const c = cycles(code, fw);
    return { id: `gen-${seed}`, module: 'm8', type: 'num', difficulty: 3, category: 'Count stalls and cycles', code, q: `${fw ? 'With' : 'Without'} forwarding, how many clock cycles does this code take (until the last WB)?`, answer: c, hint: 'cycles = n + 4 + stalls', solution: `The simulator finds ${c - n - 4} stall cycle(s): ${n} + 4 + ${c - n - 4} = ${c}. Open the Hazard Lab with this code to see each stall.`, slides: '45–48' };
  }
  const t = [pick([150, 200, 250]), pick([100, 150]), pick([150, 200, 300]), pick([200, 250, 300]), pick([100, 150])];
  const sum = t.reduce((a, b) => a + b, 0), mx = Math.max(...t), n = pick([4, 5, 10]);
  const ans = Math.round(((n * sum) / ((n + 4) * mx)) * 100) / 100;
  return { id: `gen-${seed}`, module: 'm7', type: 'num', difficulty: 3, category: 'Calculate pipeline speedup', q: `Stage times IF ${t[0]}, ID ${t[1]}, EX ${t[2]}, MEM ${t[3]}, WB ${t[4]} ps. Speedup of the pipeline over single-cycle for ${n} instructions with no hazards? (two decimals)`, answer: ans, hint: 'single = n × sum; pipe = (n + 4) × max', solution: `single = ${n} × ${sum} = ${n * sum}; pipelined = ${n + 4} × ${mx} = ${(n + 4) * mx}; speedup = ${ans}.`, slides: '39–41' };
}
