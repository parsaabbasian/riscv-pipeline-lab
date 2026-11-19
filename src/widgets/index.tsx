import type { WidgetKey } from '../content/modules';
import { AluCtrlSim, BranchCalc, ClockSim, Formats, GatesSim, ImmGenSim, InstrWalk, MuxSim, RegisterSim } from './basic';
import { ControlDashboard, CpuClick, CriticalPath, Progressive, SingleVsMulti } from './datapathWidgets';
import { BranchLab, Laundry, PerfCalc, PROGRAMS, SchedulingLab } from './pipeWidgets';
import PipelineRunner from './PipelineRunner';

export const WIDGETS: Record<WidgetKey, { title: string; render: () => JSX.Element }> = {
  instrWalk: { title: 'Instruction walkthrough', render: () => <InstrWalk /> },
  cpuClick: { title: 'Clickable CPU', render: () => <CpuClick /> },
  mux: { title: '2-to-1 MUX simulator', render: () => <MuxSim /> },
  gates: { title: 'Combinational elements', render: () => <GatesSim /> },
  register: { title: 'Register with write enable', render: () => <RegisterSim /> },
  clock: { title: 'Clocking & critical path', render: () => <><RegisterSim withClockOnly /><div className="h-4" /><ClockSim /></> },
  progressive: { title: 'Progressive datapath builder', render: () => <Progressive /> },
  immgen: { title: 'Imm Gen & effective address', render: () => <ImmGenSim /> },
  branchCalc: { title: 'Branch target calculator', render: () => <BranchCalc /> },
  control: { title: 'Control signal dashboard', render: () => <ControlDashboard /> },
  aluctrl: { title: 'ALU control decoder', render: () => <AluCtrlSim /> },
  criticalPath: { title: 'Critical path', render: () => <CriticalPath /> },
  singleVsMulti: { title: 'Single-cycle vs multicycle', render: () => <SingleVsMulti /> },
  laundry: { title: 'Laundry pipeline', render: () => <Laundry /> },
  pipeTiming: { title: 'Pipeline timing simulator', render: () => <PipelineRunner program={'ld x1, 0(x2)\nadd x3, x4, x5\nsub x6, x7, x8\nsd x9, 8(x2)\nor x10, x11, x12'} regs="x2=0, x4=1, x5=2" show={{ options: [] }} /> },
  perfCalc: { title: 'Performance calculator', render: () => <PerfCalc /> },
  formats: { title: 'Instruction format encoder', render: () => <Formats /> },
  structural: { title: 'Structural hazard', render: () => <PipelineRunner {...PROGRAMS.structural} opts={{ unifiedMemory: true }} show={{ options: ['unifiedMemory'] }} /> },
  hazard: { title: 'Data hazard & forwarding', render: () => <PipelineRunner {...PROGRAMS.forward} show={{ options: ['forwarding'] }} /> },
  loadUse: { title: 'Load-use hazard', render: () => <PipelineRunner {...PROGRAMS.loadUse} show={{ options: ['forwarding'] }} /> },
  scheduling: { title: 'Code scheduling 13 vs 11', render: () => <SchedulingLab /> },
  branchStall: { title: 'Branch in the pipeline', render: () => <PipelineRunner {...PROGRAMS.branch} show={{ options: ['branchPolicy', 'forwarding'] }} /> },
  branchLab: { title: 'Branch prediction lab', render: () => <BranchLab /> },
  pipeDatapath: { title: 'Pipelined datapath (ld/sd)', render: () => <PipelineRunner {...PROGRAMS.ldsd} show={{ datapath: true, options: ['forwarding'] }} /> },
  pipeRegs: { title: 'Pipeline registers', render: () => <PipelineRunner {...PROGRAMS.ldsd} show={{ datapath: true, options: [] , editor: false }} /> },
  wrongReg: { title: 'Wrong register number', render: () => <PipelineRunner {...PROGRAMS.wrong} opts={{ buggyWriteRegister: true }} show={{ datapath: true, options: ['buggyWriteRegister'] }} /> },
};
