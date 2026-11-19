import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Cpu, Layers, AlertTriangle, Gauge, ListChecks, BookOpen, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { ALL_TOPICS, MODULES, type Topic } from '../content/modules';
import { QUESTIONS } from '../content/quiz';
import { GLOSSARY } from '../content/glossary';
import { coverage } from '../content/coverage';
import { WIDGETS } from '../widgets';
import { useApp } from '../store';
import { Callout, Card, SlideRef, STAGE_COLOR } from '../components/ui';
import { ControlDashboard, CpuClick, CriticalPath, Progressive, SingleVsMulti } from '../widgets/datapathWidgets';
import { InstrWalk } from '../widgets/basic';
import PipelineRunner from '../widgets/PipelineRunner';
import { PerfCalc, PROGRAMS, SchedulingLab, Laundry, BranchLab } from '../widgets/pipeWidgets';
import { Segmented } from '../components/ui';
import QuestionCard from '../components/QuestionCard';

function PageHead({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      {kicker && <div className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">{kicker}</div>}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
      {children && <div className="text-muted mt-2 max-w-3xl leading-relaxed">{children}</div>}
    </div>
  );
}

function useMastery() {
  const quiz = useApp((s) => s.quiz);
  return useMemo(() => MODULES.map((m) => {
    const qs = QUESTIONS.filter((q) => q.module === m.id);
    const tried = qs.filter((q) => quiz[q.id]);
    const right = tried.filter((q) => quiz[q.id].correct).length;
    return { m, total: qs.length, tried: tried.length, right, pct: qs.length ? Math.round((right / qs.length) * 100) : 0 };
  }), [quiz]);
}

export function HomePage() {
  const { completed, lastLesson } = useApp();
  const mastery = useMastery();
  const done = ALL_TOPICS.filter((t) => completed[t.id]).length;
  const resume = ALL_TOPICS.find((t) => t.id === lastLesson) ?? ALL_TOPICS.find((t) => !completed[t.id]) ?? ALL_TOPICS[0];
  const tools = [
    { to: '/explorer', icon: Cpu, t: 'Datapath Explorer', d: 'Single-cycle datapath with live control signals and values.' },
    { to: '/pipeline', icon: Layers, t: 'Pipeline Simulator', d: 'Write a program, step cycle-by-cycle, inspect pipeline registers.' },
    { to: '/hazards', icon: AlertTriangle, t: 'Hazard Lab', d: 'Forwarding, load-use stalls, structural hazards and scheduling.' },
    { to: '/performance', icon: Gauge, t: 'Performance', d: 'Critical path, single vs multicycle vs pipeline, speedup math.' },
    { to: '/practice', icon: ListChecks, t: 'Practice', d: `${QUESTIONS.length} questions + unlimited generated problems.` },
  ];
  return (
    <div className="space-y-8">
      <div className="card p-6 sm:p-8 relative overflow-hidden">
        <div className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">Lecture 8 · Computer Organization and Design RISC-V</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">From one instruction to a five-stage pipeline.</h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">Ten modules covering slides 1–61: logic and clocking, the single-cycle datapath and its control, multicycle design, pipelining, hazards, branch prediction and the pipelined datapath. Every simulator computes real state — nothing is pre-recorded.</p>
        <div className="flex flex-wrap gap-2 mt-5">
          <Link to={`/lesson/${resume.module.id}#${resume.id}`} className="btn btn-primary">{done ? 'Continue' : 'Start'}: {resume.title}<ArrowRight className="w-4 h-4" /></Link>
          <Link to="/pipeline" className="btn">Open the pipeline simulator</Link>
        </div>
        <div className="mt-6 flex gap-1" aria-hidden>{['IF', 'ID', 'EX', 'MEM', 'WB'].map((s, i) => <div key={s} className={`${STAGE_COLOR[s]} h-1.5 rounded-full`} style={{ flex: 1, opacity: 0.4 + i * 0.15 }} />)}</div>
      </div>
      {done === 0 && <StartHere />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {tools.map((t) => (
          <Link key={t.to} to={t.to} className="card p-4 hover:border-accent/50 transition-colors group">
            <t.icon className="w-5 h-5 text-accent mb-2" /><div className="font-semibold text-sm group-hover:text-accent">{t.t}</div><div className="text-xs text-muted mt-1 leading-relaxed">{t.d}</div>
          </Link>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Card title="Modules" icon={<BookOpen className="w-4 h-4" />}>
          <div className="grid sm:grid-cols-2 gap-2">
            {MODULES.map((m) => {
              const d = m.topics.filter((t) => completed[t.id]).length;
              return (
                <Link key={m.id} to={`/lesson/${m.id}`} className="flex gap-3 p-3 rounded-lg hover:bg-raised">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${d === m.topics.length ? 'bg-ok/15 text-ok' : 'bg-accent/10 text-accent'}`}>{m.n}</span>
                  <div className="min-w-0"><div className="font-medium text-sm">{m.title}</div><div className="text-xs text-muted">Slides {m.slides} · {d}/{m.topics.length} topics</div></div>
                </Link>
              );
            })}
          </div>
        </Card>
        <Card title="Topic mastery (quiz accuracy)">
          <div className="space-y-2">
            {mastery.map(({ m, pct, tried, total }) => (
              <div key={m.id}>
                <div className="flex justify-between text-xs"><span>M{m.n} {m.title}</span><span className="text-muted">{tried}/{total}</span></div>
                <div className="h-1.5 bg-raised rounded-full overflow-hidden mt-1"><div className={`h-full ${pct >= 80 ? 'bg-ok' : pct >= 50 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${pct}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const STORY = [
  { t: 'A CPU follows instructions', d: 'Each instruction is a tiny command like “add two numbers”. Modules 1–2.' },
  { t: 'It is built from simple parts', d: 'Wires, switches (MUXes), adders and memory cells. Module 3.' },
  { t: 'We connect the parts into a CPU', d: 'First a simple one that does one instruction per clock tick. Modules 4–6.' },
  { t: 'Then we make it faster', d: 'Like a factory assembly line: start the next instruction before the last one finishes. Module 7.' },
  { t: 'And fix the problems that causes', d: 'Sometimes an instruction must wait (“hazards”). Modules 8–10.' },
];

function StartHere() {
  const setMode = useApp((s) => s.setMode);
  const mode = useApp((s) => s.mode);
  return (
    <Card title="New here? Start with this">
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="text-sm font-semibold mb-2">The whole lecture in five sentences</div>
          <ol className="space-y-2">
            {STORY.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <div className="text-sm"><span className="font-medium">{s.t}.</span> <span className="text-muted">{s.d}</span></div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="text-sm font-semibold mb-2">How to use this app</div>
          <ul className="space-y-2 text-sm text-muted list-disc pl-5">
            <li>Go through the modules <b className="text-ink">in order</b> — each one only uses words explained before.</li>
            <li>Every topic is a short list of steps. Read the plain-English part first; the technical part is optional at first.</li>
            <li>Diagrams are <b className="text-ink">interactive</b>: change the numbers and watch what happens. You can’t break anything.</li>
            <li>Answer the question at the end of each topic — a correct answer marks it complete.</li>
            <li>Unknown word? Check the <Link to="/glossary" className="text-accent">Glossary</Link>.</li>
          </ul>
          {mode !== 'beginner' && <button className="btn mt-3" onClick={() => setMode('beginner')}>Switch to Beginner mode (explains everything)</button>}
        </div>
      </div>
    </Card>
  );
}

export function Curriculum() {
  const completed = useApp((s) => s.completed);
  return (
    <div>
      <PageHead kicker="Course" title="Curriculum">Ten modules mapped to the 61 slides of Lecture 8. Topics marked <span className="chip bg-raised">background</span> are supporting material not taught directly on the slides.</PageHead>
      <div className="space-y-3">
        {MODULES.map((m) => (
          <Card key={m.id} title={<Link to={`/lesson/${m.id}`} className="hover:text-accent">Module {m.n} · {m.title}</Link>} actions={<SlideRef s={m.slides} />}>
            <p className="text-sm text-muted mb-3">{m.blurb}</p>
            <div className="grid md:grid-cols-2 gap-1">
              {m.topics.map((t) => (
                <Link key={t.id} to={`/lesson/${m.id}#${t.id}`} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-raised">
                  {completed[t.id] ? <CheckCircle2 className="w-4 h-4 text-ok shrink-0" /> : <Circle className="w-4 h-4 text-muted shrink-0" />}
                  <span className="flex-1">{t.title}</span>
                  {t.background && <span className="chip bg-raised text-muted">background</span>}
                  <span className="text-xs text-muted font-mono">{t.slides}</span>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-raised text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 text-muted">{n}</div>
      <div className="flex-1 min-w-0"><div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">{title}</div><div className="prose-lite">{children}</div></div>
    </div>
  );
}

function TopicCheck({ t }: { t: Topic }) {
  const q = QUESTIONS.find((x) => x.id === `chk-${t.id}`)!;
  const toggle = useApp((s) => s.toggleComplete);
  return <QuestionCard q={q} onAnswered={(ok) => { if (ok) toggle(t.id, true); }} />;
}

function oneLiner(s: string) {
  const i = s.indexOf('. ');
  return i > 0 ? s.slice(0, i + 1) : s;
}

function TopicView({ t }: { t: Topic }) {
  const { mode, completed, toggleComplete, setLastLesson } = useApp();
  const [showViz, setShowViz] = useState(mode !== 'exam');
  const [showTech, setShowTech] = useState(false);
  useEffect(() => setShowViz(mode !== 'exam'), [mode]);
  const W = t.widget ? WIDGETS[t.widget] : null;
  const beginner = mode === 'beginner', exam = mode === 'exam';
  let k = 0;
  return (
    <section id={t.id} className="card scroll-mt-4" onPointerDown={() => setLastLesson(t.id)} onFocus={() => setLastLesson(t.id)}>
      <header className="px-5 py-4 border-b border-line flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold flex-1 min-w-[200px]">{t.title}</h2>
        {t.background && <span className="chip bg-raised text-muted" title="Supporting background, not directly taught on the slides">background</span>}
        <SlideRef s={t.slides} />
        <button className={`btn !text-xs ${completed[t.id] ? '!text-ok !border-ok/40' : ''}`} onClick={() => toggleComplete(t.id)}>
          {completed[t.id] ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}{completed[t.id] ? 'Completed' : 'Mark complete'}
        </button>
      </header>
      <div className="p-5 space-y-5">
        {!exam && <div className="rounded-lg bg-accent/5 border border-accent/30 px-4 py-3 text-[15px]"><span className="text-xs font-semibold uppercase tracking-wide text-accent mr-2">In one sentence</span>{oneLiner(t.simple)}</div>}
        {!exam && <Step n={++k} title="Why does this exist?"><p>{t.why}</p></Step>}
        {beginner && <Step n={++k} title="Real-world analogy"><p>{t.analogy}</p></Step>}
        {!exam && <Step n={++k} title="In simple English"><p>{t.simple}</p></Step>}
        <Step n={++k} title={exam ? 'Technical summary' : 'The technical picture'}>
          {beginner && !showTech ? (
            <button className="btn !text-xs" onClick={() => setShowTech(true)}><Eye className="w-3.5 h-3.5" />Show the technical version (optional on first read)</button>
          ) : <p>{t.technical}</p>}
          {t.terms && !exam && (
            <dl className="mt-3 grid sm:grid-cols-2 gap-2">
              {t.terms.map(([a, b]) => <div key={a} className="rounded-lg bg-raised p-2 text-sm"><dt className="font-semibold">{a}</dt><dd className="text-muted">{b}</dd></div>)}
            </dl>
          )}
        </Step>
        {W && (
          <Step n={++k} title={`Visualise, animate & manipulate — ${W.title}`}>
            {showViz ? <div className="not-prose">{W.render()}</div> : <button className="btn" onClick={() => setShowViz(true)}><Eye className="w-4 h-4" />Show interactive diagram</button>}
          </Step>
        )}
        {!exam && <Step n={++k} title="Worked example with real numbers"><p>{t.example}</p></Step>}
        <Step n={++k} title="RISC-V connection"><pre className="font-mono text-xs bg-raised rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{t.riscv}</pre></Step>
        <Step n={++k} title="Check your understanding"><TopicCheck t={t} /></Step>
        <Step n={++k} title="Exam points">
          <ul className="list-disc pl-5 space-y-1 text-[15px]">{t.exam.map((e) => <li key={e}>{e}</li>)}</ul>
        </Step>
        <Callout kind="warn" title="Common mistakes"><ul className="list-disc pl-4 space-y-0.5">{t.mistakes.map((m) => <li key={m}>{m}</li>)}</ul></Callout>
      </div>
    </section>
  );
}

export function LessonPage() {
  const { id } = useParams();
  const mode = useApp((s) => s.mode);
  const completed = useApp((s) => s.completed);
  const idx = MODULES.findIndex((m) => m.id === id);
  if (idx < 0) return <NotFound />;
  const m = MODULES[idx];
  const prev = MODULES[idx - 1], next = MODULES[idx + 1];
  const glossary = GLOSSARY.filter((g) => g.module === m.id);
  return (
    <div className="grid xl:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-5 min-w-0">
        <PageHead kicker={`Module ${m.n} · Slides ${m.slides}`} title={m.title}>{m.blurb}</PageHead>
        {mode === 'beginner' && <Callout kind="tip" title="Beginner mode">Every term is introduced before use, analogies are shown, and interactive diagrams are open. Switch to Exam mode in the top bar for a condensed review.</Callout>}
        {mode === 'exam' && <Callout kind="info" title="Exam mode">Only technical summaries, formulas, RISC-V examples, checks and exam points are shown. Diagrams are collapsed — expand them when needed.</Callout>}
        {m.topics.map((t) => <TopicView key={t.id} t={t} />)}
        <div className="flex justify-between gap-2">
          {prev ? <Link className="btn" to={`/lesson/${prev.id}`}><ChevronLeft className="w-4 h-4" />M{prev.n} {prev.title}</Link> : <span />}
          {next ? <Link className="btn btn-primary" to={`/lesson/${next.id}`}>M{next.n} {next.title}<ChevronRight className="w-4 h-4" /></Link> : <Link className="btn btn-primary" to="/exam">Final assessment<ChevronRight className="w-4 h-4" /></Link>}
        </div>
      </div>
      <aside className="hidden xl:block">
        <div className="sticky top-0 space-y-3">
          <Card title="In this module">
            <ul className="space-y-1 text-sm">{m.topics.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' }); }} className="flex items-center gap-2 hover:text-accent">
                {completed[t.id] ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <Circle className="w-3.5 h-3.5 text-muted" />}{t.title}</a></li>
            ))}</ul>
          </Card>
          {glossary.length > 0 && (
            <Card title="Key terms">
              <dl className="space-y-2 text-xs">{glossary.map((g) => <div key={g.term}><dt className="font-semibold">{g.term}</dt><dd className="text-muted">{g.def}</dd></div>)}</dl>
            </Card>
          )}
          <Link to={`/practice?m=${m.id}`} className="btn w-full justify-center">Practice this module</Link>
        </div>
      </aside>
    </div>
  );
}

export function ExplorerPage() {
  const [tab, setTab] = useState<'click' | 'build' | 'control' | 'walk'>('control');
  return (
    <div className="space-y-4">
      <PageHead kicker="Lab" title="CPU Datapath Explorer">The single-cycle RISC-V datapath from slides 19–31. Choose an instruction to see the active path, the values on each wire, and every control signal with the reason for its value. Click components to inspect them.</PageHead>
      <Segmented label="Explorer view" value={tab} onChange={setTab} options={[{ value: 'control', label: 'Control dashboard' }, { value: 'click', label: 'Component inspector' }, { value: 'build', label: 'Build it step by step' }, { value: 'walk', label: 'Instruction walkthrough' }]} />
      <div className="card p-4">{tab === 'control' ? <ControlDashboard /> : tab === 'click' ? <CpuClick /> : tab === 'build' ? <Progressive /> : <InstrWalk />}</div>
    </div>
  );
}

const PRESETS: Record<string, { label: string; p: { program: string; regs?: string; mem?: string } }> = {
  ldsd: { label: 'Load/store sequence (slides 56–60)', p: PROGRAMS.ldsd },
  mix: { label: 'Dependencies on x2 (forwarding)', p: PROGRAMS.hazardMix },
  sched: { label: 'Slide 48 original (13 cycles)', p: PROGRAMS.original },
  branch: { label: 'Taken branch', p: PROGRAMS.branch },
  loop: { label: 'Loop with backward branch', p: PROGRAMS.loop },
};

export function PipelinePage() {
  const [preset, setPreset] = useState('ldsd');
  const beginner = useApp((s) => s.mode) === 'beginner';
  return (
    <div className="space-y-4">
      {beginner && <div className="mb-4"><Callout kind="tip" title="Tip">New to pipelines? Read Module 7 first. Then press <b>Next</b> here a few times and follow the plain-English panel. Advanced switches appear in Standard mode.</Callout></div>}
      <PageHead kicker="Flagship" title="Pipeline Simulator">A cycle-accurate model of the five-stage RISC-V pipeline: pipeline registers, hazard detection, forwarding unit, load-use stalls, branch resolution in ID with stall or predict-not-taken. Every value shown is computed from the program and initial state; Prev/Next replays deterministic snapshots.</PageHead>
      <div className="flex flex-wrap gap-1">{Object.entries(PRESETS).map(([k, v]) => <button key={k} className={`btn !text-xs ${preset === k ? 'btn-primary' : ''}`} onClick={() => setPreset(k)}>{v.label}</button>)}</div>
      <div className="card p-4"><PipelineRunner key={preset} persist {...PRESETS[preset].p} show={{ options: beginner ? ['forwarding', 'branchPolicy'] : ['forwarding', 'branchPolicy', 'unifiedMemory', 'buggyWriteRegister'] }} /></div>
    </div>
  );
}

export function HazardPage() {
  const [tab, setTab] = useState('data');
  const tabs: Record<string, { label: string; el: ReactNode; note: string }> = {
    data: { label: 'Data hazards & forwarding', el: <PipelineRunner key="d" {...PROGRAMS.hazardMix} show={{ options: ['forwarding'] }} />, note: 'Five instructions all depending on x2 (from sub). Turn forwarding off to see the stalls the hazard unit inserts; turn it on to see the EX/MEM and MEM/WB forwarding paths listed per cycle.' },
    load: { label: 'Load-use', el: <PipelineRunner key="l" {...PROGRAMS.loadUse} show={{ options: ['forwarding'] }} />, note: 'Even with forwarding, the loaded value is ready only after MEM: one bubble is unavoidable (slide 47).' },
    sched: { label: 'Code scheduling', el: <SchedulingLab />, note: 'Slide 48: a = b + e; c = b + f. Reordering the third load removes both load-use stalls: 13 → 11 cycles.' },
    struct: { label: 'Structural hazard', el: <PipelineRunner key="s" {...PROGRAMS.structural} opts={{ unifiedMemory: true }} show={{ options: ['unifiedMemory'] }} />, note: 'With a single memory, IF cannot fetch while ld is in MEM (slide 44). Toggle off to model separate instruction/data memories.' },
    branch: { label: 'Control hazards', el: <><PipelineRunner key="b" {...PROGRAMS.branch} show={{ options: ['branchPolicy', 'forwarding'] }} /><div className="h-6" /><BranchLab /></>, note: 'Branches resolve in ID. Compare stall-on-branch with predict-not-taken, then explore static and dynamic predictors.' },
  };
  return (
    <div className="space-y-4">
      <PageHead kicker="Lab" title="Hazard Laboratory">See exactly which instructions depend on which, where forwarding applies, when stalls are unavoidable, how bubbles move through the pipeline, and how scheduling helps.</PageHead>
      <Segmented label="Hazard type" value={tab} onChange={setTab} options={Object.entries(tabs).map(([k, v]) => ({ value: k, label: v.label }))} />
      <Callout kind="info">{tabs[tab].note}</Callout>
      <div className="card p-4">{tabs[tab].el}</div>
    </div>
  );
}

export function PerfPage() {
  return (
    <div className="space-y-4">
      <PageHead kicker="Lab" title="Performance Calculator">Critical path, single-cycle vs multicycle, the laundry analogy and pipelined speedup — with the lecture’s numbers (100 ps register read/write, 200 ps for other stages) as defaults.</PageHead>
      <Card title="Pipeline speedup (slides 39–41)"><PerfCalc /></Card>
      <Card title="Single-cycle critical path (slide 32)"><CriticalPath /></Card>
      <Card title="Single-cycle vs multicycle (slides 33–36)"><SingleVsMulti /></Card>
      <Card title="Laundry analogy (slide 37)"><Laundry /></Card>
    </div>
  );
}

export function GlossaryPage() {
  const [q, setQ] = useState('');
  const list = GLOSSARY.filter((g) => (g.term + g.def).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.term.localeCompare(b.term));
  return (
    <div>
      <PageHead kicker="Reference" title="Glossary">{GLOSSARY.length} terms with slide references.</PageHead>
      <input className="input !font-sans !max-w-md mb-4" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search glossary" />
      <div className="grid md:grid-cols-2 gap-2">
        {list.map((g) => {
          const m = MODULES.find((x) => x.id === g.module)!;
          return (
            <div key={g.term} className="card p-3">
              <div className="flex justify-between gap-2"><div className="font-semibold">{g.term}</div><SlideRef s={g.slides} /></div>
              <p className="text-sm text-muted mt-1 leading-relaxed">{g.def}</p>
              <Link to={`/lesson/${m.id}`} className="text-xs text-accent mt-1 inline-block">Module {m.n} →</Link>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-muted text-sm">No terms match.</div>}
      </div>
    </div>
  );
}

export function CoveragePage() {
  const rows = coverage();
  const completed = useApp((s) => s.completed);
  const covered = rows.filter((r) => r.status === 'covered').length;
  return (
    <div>
      <PageHead kicker="Validation" title="Slide Coverage Matrix">{covered}/61 slides are mapped to at least one lesson topic.</PageHead>
      <div className="mb-4"><Callout kind="warn" title="Source note">The lecture PDF was not available when this app was built. Slide-to-topic mapping follows the slide ranges in the course brief (modules 1–10) and the standard Patterson &amp; Hennessy RISC-V Chapter 4 deck. Check individual slide titles and examples against your PDF.</Callout></div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted text-left border-b border-line"><tr>{['Slide', 'Module', 'Lesson topic(s)', 'Interactive visualisation', 'Practice', 'Status'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slide} className="border-b border-line/60 align-top">
                <td className="px-3 py-2 font-mono">{r.slide}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{r.moduleTitle}</td>
                <td className="px-3 py-2">{r.topics.map((t) => <Link key={t.id} to={`/lesson/${r.module}#${t.id}`} className="block text-accent hover:underline">{t.title}</Link>)}</td>
                <td className="px-3 py-2 text-xs">{r.widgets.join(', ') || '—'}</td>
                <td className="px-3 py-2 text-xs">{r.questions} question{r.questions === 1 ? '' : 's'}</td>
                <td className="px-3 py-2 text-xs">{r.status === 'covered' ? <span className="text-ok">✓ covered{r.topics.every((t) => completed[t.id]) ? ' · studied' : ''}</span> : <span className="text-bad">missing</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NotFound() {
  return <div className="text-center py-20"><h1 className="text-2xl font-bold">Page not found</h1><Link to="/" className="btn btn-primary mt-4">Back to dashboard</Link></div>;
}
