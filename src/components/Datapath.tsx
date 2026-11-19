import type { Op } from '../sim/isa';
import type { CycleTrace } from '../sim/singleCycle';
import { ZoomPan } from './ui';

/** Single-cycle RISC-V datapath with control (slides 4–6, 19–20, 27–31). */
export type CompId = 'PC' | 'IM' | 'ADD4' | 'RF' | 'IMM' | 'MUXALU' | 'ALU' | 'SHL' | 'BADD' | 'DM' | 'MUXWB' | 'MUXPC' | 'AND' | 'CTRL' | 'ALUCTRL';

export interface CompInfo { id: CompId; name: string; stage: number; role: string; inputs: string; outputs: string; slides: string }
export const COMPONENTS: CompInfo[] = [
  { id: 'PC', name: 'Program Counter (PC)', stage: 1, role: 'A 64-bit register holding the address of the current instruction. It is written on every rising clock edge.', inputs: 'Next PC from the PC MUX', outputs: 'Address to instruction memory and both adders', slides: '3, 13' },
  { id: 'IM', name: 'Instruction memory', stage: 1, role: 'Read-only (for the datapath) memory holding the program. Given an address, it outputs the 32-bit instruction stored there.', inputs: 'Read address (PC)', outputs: '32-bit instruction bits [31:0]', slides: '13, 20' },
  { id: 'ADD4', name: 'Adder (PC + 4)', stage: 1, role: 'Dedicated adder computing the address of the next sequential instruction. Instructions are 4 bytes, so +4.', inputs: 'PC, constant 4', outputs: 'PC + 4', slides: '13' },
  { id: 'RF', name: 'Register file', stage: 2, role: '32 general-purpose 64-bit registers (x0 is hard-wired to 0). Two read ports, one write port. Writes happen on the clock edge when RegWrite = 1.', inputs: 'Read reg 1 (rs1), Read reg 2 (rs2), Write reg (rd), Write data, RegWrite', outputs: 'Read data 1, Read data 2', slides: '14' },
  { id: 'ALU', name: 'ALU', stage: 3, role: 'Arithmetic Logic Unit. Performs AND, OR, add or subtract selected by the 4-bit ALU control input. Its Zero output is 1 when the result is 0 (used by beq).', inputs: 'Two 64-bit operands, 4-bit ALU control', outputs: 'ALU result, Zero', slides: '14, 16, 23' },
  { id: 'IMM', name: 'Immediate generator (Imm Gen)', stage: 4, role: 'Extracts the 12-bit immediate field from the instruction (its position depends on the format) and sign-extends it to 64 bits.', inputs: 'Instruction bits', outputs: '64-bit sign-extended immediate', slides: '15, 16' },
  { id: 'MUXALU', name: 'ALUSrc multiplexer', stage: 4, role: 'Chooses the ALU’s second operand: a register (R-type, beq) or the immediate (ld, sd).', inputs: 'Read data 2, immediate, select ALUSrc', outputs: 'ALU operand B', slides: '5, 18' },
  { id: 'DM', name: 'Data memory', stage: 5, role: 'Holds program data. Reads when MemRead = 1, writes on the clock edge when MemWrite = 1. Separate from instruction memory in the single-cycle design.', inputs: 'Address (ALU result), Write data (Read data 2), MemRead, MemWrite', outputs: 'Read data', slides: '15, 18, 20' },
  { id: 'MUXWB', name: 'MemtoReg multiplexer', stage: 5, role: 'Chooses what is written back to the register file: ALU result (R-type) or memory data (ld).', inputs: 'ALU result, memory read data, select MemtoReg', outputs: 'Register Write data', slides: '18' },
  { id: 'SHL', name: 'Shift left 1', stage: 6, role: 'Branch offsets are in units of 2 bytes, so the immediate is shifted left by 1 (multiplied by 2) to give a byte offset.', inputs: 'Sign-extended immediate', outputs: 'imm × 2', slides: '16' },
  { id: 'BADD', name: 'Branch target adder', stage: 6, role: 'Computes the PC-relative branch target address = PC + (imm << 1).', inputs: 'PC, shifted immediate', outputs: 'Branch target', slides: '16' },
  { id: 'AND', name: 'AND gate (Branch · Zero)', stage: 6, role: 'Takes the branch only if the instruction is a branch AND the ALU says the operands are equal. Output is PCSrc.', inputs: 'Branch, Zero', outputs: 'PCSrc', slides: '27, 31' },
  { id: 'MUXPC', name: 'PCSrc multiplexer', stage: 6, role: 'Chooses the next PC: PC + 4 (PCSrc = 0) or the branch target (PCSrc = 1).', inputs: 'PC + 4, branch target, select PCSrc', outputs: 'Next PC', slides: '6, 20' },
  { id: 'CTRL', name: 'Main Control Unit', stage: 7, role: 'Decodes the 7-bit opcode and produces the control signals RegWrite, ALUSrc, MemRead, MemWrite, MemtoReg, Branch and ALUOp.', inputs: 'opcode = instruction[6:0]', outputs: 'All control signals', slides: '6, 25–27' },
  { id: 'ALUCTRL', name: 'ALU control', stage: 7, role: 'Second-level decoding: combines the 2-bit ALUOp from main control with funct7/funct3 to produce the 4-bit ALU control input.', inputs: 'ALUOp, funct7 bit 30, funct3', outputs: '4-bit ALU control', slides: '22–24' },
];

type W = { id: string; pts: number[][]; stage: number; label?: [number, number]; ctl?: boolean };
const WIRES: W[] = [
  { id: 'pc_im', pts: [[80, 285], [110, 285]], stage: 1 },
  { id: 'pc_add4', pts: [[90, 285], [90, 80], [150, 80]], stage: 1 },
  { id: 'four', pts: [[128, 108], [150, 108]], stage: 1 },
  { id: 'add4_mux', pts: [[200, 92], [860, 92], [860, 75], [880, 75]], stage: 1, label: [230, 86] },
  { id: 'mux_pc', pts: [[902, 92], [965, 92], [965, 18], [22, 18], [22, 285], [40, 285]], stage: 1, label: [500, 13] },
  { id: 'inst', pts: [[220, 285], [252, 285]], stage: 2 },
  { id: 'rs1', pts: [[252, 238], [330, 238]], stage: 2, label: [266, 232] },
  { id: 'rs2', pts: [[252, 266], [330, 266]], stage: 2, label: [266, 260] },
  { id: 'rd', pts: [[252, 296], [330, 296]], stage: 2, label: [266, 291] },
  { id: 'rd1', pts: [[460, 250], [560, 250]], stage: 3, label: [470, 244] },
  { id: 'rd2_mux', pts: [[460, 318], [492, 318], [510, 318]], stage: 3, label: [466, 312] },
  { id: 'wb', pts: [[882, 312], [945, 312], [945, 530], [300, 530], [300, 326], [330, 326]], stage: 3, label: [600, 524] },
  { id: 'alu_wbmux', pts: [[630, 290], [660, 290], [660, 400], [846, 400], [846, 298], [860, 298]], stage: 3 },
  { id: 'inst_imm', pts: [[252, 425], [350, 425]], stage: 4 },
  { id: 'imm_mux', pts: [[430, 425], [495, 425], [495, 345], [510, 345]], stage: 4, label: [436, 419] },
  { id: 'mux_alu', pts: [[532, 330], [560, 320]], stage: 3 },
  { id: 'alu_dm', pts: [[630, 290], [700, 290]], stage: 5, label: [636, 284] },
  { id: 'rd2_dm', pts: [[492, 318], [492, 470], [680, 470], [680, 345], [700, 345]], stage: 5, label: [600, 464] },
  { id: 'dm_mux', pts: [[820, 300], [836, 300], [836, 328], [860, 328]], stage: 5, label: [822, 294] },
  { id: 'imm_shl', pts: [[495, 345], [495, 128], [520, 128]], stage: 6 },
  { id: 'shl_badd', pts: [[570, 128], [610, 115]], stage: 6 },
  { id: 'pc_badd', pts: [[90, 80], [90, 34], [590, 34], [590, 85], [610, 85]], stage: 6 },
  { id: 'badd_mux', pts: [[660, 100], [870, 100], [870, 105], [880, 105]], stage: 6, label: [680, 112] },
  { id: 'zero_and', pts: [[630, 250], [800, 250], [800, 128], [830, 128]], stage: 6, label: [640, 244] },
  { id: 'and_mux', pts: [[860, 120], [891, 120]], stage: 6 },
  { id: 'inst_ctrl', pts: [[252, 160], [272, 160]], stage: 7 },
  { id: 'inst_aluctrl', pts: [[252, 425], [252, 495], [595, 495], [595, 445]], stage: 7 },
  { id: 'aluctrl_alu', pts: [[595, 405], [595, 335]], stage: 7, ctl: true },
  { id: 'c_branch', pts: [[372, 150], [815, 150], [815, 116], [830, 116]], stage: 7, ctl: true },
  { id: 'bus', pts: [[252, 160], [252, 425]], stage: 2 },
];

const ACTIVE: Record<Op, string[]> = {
  add: ['rs1', 'rs2', 'rd', 'rd1', 'rd2_mux', 'mux_alu', 'alu_wbmux', 'wb', 'inst_aluctrl', 'aluctrl_alu'],
  sub: [], and: [], or: [],
  ld: ['rs1', 'rd', 'rd1', 'inst_imm', 'imm_mux', 'mux_alu', 'alu_dm', 'dm_mux', 'wb', 'aluctrl_alu'],
  sd: ['rs1', 'rs2', 'rd1', 'rd2_dm', 'inst_imm', 'imm_mux', 'mux_alu', 'alu_dm', 'aluctrl_alu'],
  beq: ['rs1', 'rs2', 'rd1', 'rd2_mux', 'mux_alu', 'zero_and', 'and_mux', 'inst_imm', 'imm_shl', 'shl_badd', 'pc_badd', 'badd_mux', 'c_branch', 'aluctrl_alu'],
  nop: [],
};
ACTIVE.sub = ACTIVE.and = ACTIVE.or = ACTIVE.add;
const COMMON = ['pc_im', 'pc_add4', 'four', 'add4_mux', 'mux_pc', 'inst', 'bus', 'inst_ctrl'];

export function activeWires(op: Op | null): Set<string> {
  if (!op) return new Set();
  return new Set([...COMMON, ...ACTIVE[op]]);
}
export const ACTIVE_COMPS: Record<Op, CompId[]> = {
  add: ['PC', 'IM', 'ADD4', 'RF', 'MUXALU', 'ALU', 'MUXWB', 'MUXPC', 'CTRL', 'ALUCTRL'],
  sub: [], and: [], or: [],
  ld: ['PC', 'IM', 'ADD4', 'RF', 'IMM', 'MUXALU', 'ALU', 'DM', 'MUXWB', 'MUXPC', 'CTRL', 'ALUCTRL'],
  sd: ['PC', 'IM', 'ADD4', 'RF', 'IMM', 'MUXALU', 'ALU', 'DM', 'MUXPC', 'CTRL', 'ALUCTRL'],
  beq: ['PC', 'IM', 'ADD4', 'RF', 'IMM', 'MUXALU', 'ALU', 'SHL', 'BADD', 'AND', 'MUXPC', 'CTRL', 'ALUCTRL'],
  nop: [],
};
ACTIVE_COMPS.sub = ACTIVE_COMPS.and = ACTIVE_COMPS.or = ACTIVE_COMPS.add;

function wireValues(t: CycleTrace): Record<string, string> {
  const v: Record<string, string> = {
    add4_mux: `${t.pcPlus4}`, mux_pc: `next PC = ${t.nextPc}`, rs1: `x${t.instr.rs1}`, rs2: `x${t.instr.rs2}`, rd: `x${t.instr.rd}`,
    rd1: `${t.readData1}`, rd2_mux: `${t.readData2}`, imm_mux: `${t.imm}`, alu_dm: `${t.aluResult}`, badd_mux: `${t.branchTarget}`, zero_and: `Zero=${t.zero ? 1 : 0}`,
  };
  if (t.writeData !== null) v.wb = `x${t.writeReg} ← ${t.writeData}`;
  if (t.memRead !== null) v.dm_mux = `${t.memRead}`;
  if (t.memWritten !== null) v.rd2_dm = `store ${t.memWritten}`;
  return v;
}

interface Props {
  op?: Op | null;
  trace?: CycleTrace | null;
  maxStage?: number;
  selected?: CompId | null;
  onSelect?: (c: CompId) => void;
  showControl?: boolean;
  animate?: boolean;
  signals?: Record<string, string>;
  focusSignal?: string | null;
  /** restrict highlighting to these wire ids (e.g. one execution phase) */
  limit?: string[] | null;
}

export const PHASE_WIRES: string[][] = [
  ['pc_im', 'pc_add4', 'four', 'inst', 'bus'],
  ['inst', 'bus', 'rs1', 'rs2', 'rd', 'inst_ctrl', 'inst_imm', 'inst_aluctrl'],
  ['rd1', 'rd2_mux', 'imm_mux', 'mux_alu', 'aluctrl_alu', 'zero_and', 'imm_shl', 'shl_badd', 'pc_badd'],
  ['alu_dm', 'rd2_dm', 'dm_mux'],
  ['alu_wbmux', 'wb', 'dm_mux', 'add4_mux', 'badd_mux', 'and_mux', 'mux_pc', 'c_branch'],
];

const BOX: Record<CompId, { x: number; y: number; w: number; h: number; shape?: 'mux' | 'alu' | 'ellipse' | 'and' | 'adder'; label: string[] }> = {
  PC: { x: 40, y: 250, w: 40, h: 70, label: ['PC'] },
  IM: { x: 110, y: 230, w: 110, h: 110, label: ['Instruction', 'memory'] },
  ADD4: { x: 150, y: 62, w: 50, h: 60, shape: 'adder', label: ['Add'] },
  RF: { x: 330, y: 210, w: 130, h: 150, label: ['Registers'] },
  IMM: { x: 350, y: 402, w: 80, h: 46, shape: 'ellipse', label: ['Imm', 'Gen'] },
  MUXALU: { x: 510, y: 300, w: 22, h: 60, shape: 'mux', label: ['M'] },
  ALU: { x: 560, y: 225, w: 70, h: 115, shape: 'alu', label: ['ALU'] },
  SHL: { x: 520, y: 110, w: 50, h: 36, shape: 'ellipse', label: ['Shift', 'left 1'] },
  BADD: { x: 610, y: 70, w: 50, h: 60, shape: 'adder', label: ['Add'] },
  DM: { x: 700, y: 240, w: 120, h: 130, label: ['Data', 'memory'] },
  MUXWB: { x: 860, y: 282, w: 22, h: 60, shape: 'mux', label: ['M'] },
  MUXPC: { x: 880, y: 60, w: 22, h: 60, shape: 'mux', label: ['M'] },
  AND: { x: 830, y: 106, w: 30, h: 28, shape: 'and', label: [''] },
  CTRL: { x: 272, y: 128, w: 100, h: 46, shape: 'ellipse', label: ['Control'] },
  ALUCTRL: { x: 560, y: 405, w: 70, h: 40, shape: 'ellipse', label: ['ALU', 'control'] },
};

const SIGNAL_POS: Record<string, [number, number, CompId]> = {
  ALUSrc: [494, 378, 'MUXALU'], MemtoReg: [850, 360, 'MUXWB'], PCSrc: [905, 135, 'MUXPC'], RegWrite: [365, 205, 'RF'],
  MemRead: [735, 388, 'DM'], MemWrite: [735, 235, 'DM'], Branch: [700, 145, 'AND'], ALUOp: [520, 458, 'ALUCTRL'],
};

export default function Datapath({ op = null, trace = null, maxStage = 7, selected = null, onSelect, showControl = true, animate = true, signals, focusSignal, limit = null }: Props) {
  const all = activeWires(op);
  const act = limit ? new Set([...all].filter((w) => limit.includes(w))) : all;
  const actC = new Set(op ? ACTIVE_COMPS[op] : []);
  const vals = trace ? wireValues(trace) : {};
  const vis = (s: number) => s <= maxStage;
  return (
    <div className="space-y-2">
    <ZoomPan width={990} height={550}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--muted))" /></marker>
        <marker id="arrA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--accent))" /></marker>
      </defs>
      {WIRES.filter((w) => vis(w.stage) && (showControl || !w.ctl)).map((w) => {
        const on = act.has(w.id);
        const d = 'M' + w.pts.map((p) => p.join(',')).join(' L');
        const color = w.ctl ? 'rgb(var(--teal))' : on ? 'rgb(var(--accent))' : 'rgb(var(--muted))';
        return (
          <g key={w.id}>
            <path d={d} fill="none" className="wire" stroke={color} strokeWidth={on ? 2.6 : 1.3} opacity={op && !on ? 0.35 : 1} strokeDasharray={w.ctl ? '4 3' : undefined} markerEnd={w.id === 'bus' ? undefined : on ? 'url(#arrA)' : 'url(#arr)'} />
            {on && animate && !w.ctl && <path d={d} fill="none" stroke="rgb(var(--teal))" strokeWidth={2.6} className="flow" opacity={0.9} />}
            {on && w.label && vals[w.id] && (
              <text x={w.label[0]} y={w.label[1]} fontSize="11" fontFamily="JetBrains Mono" fill="rgb(var(--ink))" className="pointer-events-none">
                <tspan style={{ paintOrder: 'stroke' }} stroke="rgb(var(--bg))" strokeWidth={3}>{vals[w.id]}</tspan>
              </text>
            )}
          </g>
        );
      })}
      {vis(1) && <text x={112} y={112} fontSize="12" fill="rgb(var(--muted))" fontFamily="JetBrains Mono">4</text>}
      {COMPONENTS.filter((c) => vis(c.stage) && (showControl || (c.id !== 'CTRL' && c.id !== 'ALUCTRL'))).map((c) => {
        const b = BOX[c.id];
        const on = actC.has(c.id);
        const sel = selected === c.id;
        const fill = c.id === 'CTRL' || c.id === 'ALUCTRL' ? 'rgb(var(--teal) / 0.12)' : on ? 'rgb(var(--accent) / 0.12)' : 'rgb(var(--surface))';
        const stroke = sel ? 'rgb(var(--warn))' : c.id === 'CTRL' || c.id === 'ALUCTRL' ? 'rgb(var(--teal))' : on ? 'rgb(var(--accent))' : 'rgb(var(--line))';
        const sw = sel ? 3 : 1.6;
        let shape;
        if (b.shape === 'ellipse') shape = <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
        else if (b.shape === 'mux') shape = <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={11} fill={fill} stroke={stroke} strokeWidth={sw} />;
        else if (b.shape === 'alu' || b.shape === 'adder') {
          const { x, y, w, h } = b;
          shape = <path d={`M${x},${y} L${x + w},${y + h * 0.3} L${x + w},${y + h * 0.7} L${x},${y + h} L${x},${y + h * 0.62} L${x + w * 0.25},${y + h / 2} L${x},${y + h * 0.38} Z`} fill={fill} stroke={stroke} strokeWidth={sw} />;
        } else if (b.shape === 'and') {
          const { x, y, w, h } = b;
          shape = <path d={`M${x},${y} L${x + w / 2},${y} A${w / 2},${h / 2} 0 0 1 ${x + w / 2},${y + h} L${x},${y + h} Z`} fill={fill} stroke={stroke} strokeWidth={sw} />;
        } else shape = <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />;
        const ty = b.y + b.h / 2 - (b.label.length - 1) * 7 + 4;
        return (
          <g key={c.id} data-click tabIndex={onSelect ? 0 : -1} role={onSelect ? 'button' : undefined} aria-label={c.name}
            onClick={() => onSelect?.(c.id)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onSelect) { e.preventDefault(); onSelect(c.id); } }}
            className={onSelect ? 'cursor-pointer outline-none' : ''}>
            <title>{c.name}: {c.role}</title>
            {shape}
            {b.label.map((l, k) => (
              <text key={k} x={b.x + (b.shape === 'alu' || b.shape === 'adder' ? b.w * 0.6 : b.w / 2)} y={ty + k * 14} textAnchor="middle" fontSize={b.shape === 'mux' ? 10 : 12} fontWeight={600} fill="rgb(var(--ink))" className="pointer-events-none">{l}</text>
            ))}
          </g>
        );
      })}
      {vis(2) && (
        <g fontSize="9" fill="rgb(var(--muted))" fontFamily="JetBrains Mono" className="pointer-events-none">
          <text x={334} y={242}>Read reg 1</text><text x={334} y={270}>Read reg 2</text><text x={334} y={300}>Write reg</text><text x={334} y={330}>Write data</text>
          <text x={402} y={254}>Read data 1</text><text x={402} y={322}>Read data 2</text>
          {vis(5) && <><text x={704} y={294}>Address</text><text x={704} y={349}>Write data</text><text x={768} y={304}>Read data</text></>}
          <text x={222} y={274}>[31:0]</text>
          {vis(3) && <text x={600} y={246}>Zero</text>}
          {vis(4) && <><text x={515} y={313}>0</text><text x={515} y={350}>1</text></>}
          {vis(5) && <><text x={864} y={300}>0</text><text x={864} y={332}>1</text></>}
          {vis(6) && <><text x={884} y={78}>0</text><text x={884} y={108}>1</text></>}
        </g>
      )}
      {showControl && signals && vis(7) && Object.entries(SIGNAL_POS).map(([k, [x, y, comp]]) => vis(COMPONENTS.find((c) => c.id === comp)!.stage) && signals[k] !== undefined && (
        <g key={k} className="pointer-events-none">
          <rect x={x - 4} y={y - 11} width={k.length * 6.4 + 34} height={15} rx={4} fill={focusSignal === k ? 'rgb(var(--warn) / 0.25)' : 'rgb(var(--teal) / 0.14)'} stroke={focusSignal === k ? 'rgb(var(--warn))' : 'none'} />
          <text x={x} y={y} fontSize="10" fontFamily="JetBrains Mono" fill="rgb(var(--teal))" fontWeight={600}>{k}={signals[k]}</text>
        </g>
      ))}
    </ZoomPan>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted" aria-label="Diagram legend">
        <span className="flex items-center gap-1.5"><span className="w-6 h-[3px] rounded bg-accent" />wire used by this instruction</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-px bg-muted opacity-60" />wire not used</span>
        <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-teal" />control signal</span>
        <span className="flex items-center gap-1.5"><span className="font-mono text-ink">x5 · 12</span>value on that wire right now</span>
        {onSelect && <span>Tip: click any box to learn what it does.</span>}
      </div>
    </div>
  );
}
