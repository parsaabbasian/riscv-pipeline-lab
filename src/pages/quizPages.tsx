import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shuffle, RotateCcw } from 'lucide-react';
import { MODULES } from '../content/modules';
import { checkAnswer, generateQuestion, QUESTIONS, type Question } from '../content/quiz';
import QuestionCard from '../components/QuestionCard';
import { Callout, Card, Segmented, Stat } from '../components/ui';
import { useApp } from '../store';

export function PracticePage() {
  const [sp] = useSearchParams();
  const [mod, setMod] = useState(sp.get('m') ?? 'all');
  const [diff, setDiff] = useState('all');
  const [view, setView] = useState<'all' | 'wrong'>('all');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6) + 1);
  const quiz = useApp((s) => s.quiz);
  const reset = useApp((s) => s.resetProgress);
  const list = QUESTIONS.filter((q) => (mod === 'all' || q.module === mod) && (diff === 'all' || String(q.difficulty) === diff) && (view === 'all' || (quiz[q.id] && !quiz[q.id].correct)));
  const gen = useMemo(() => generateQuestion(seed), [seed]);
  const tried = Object.keys(quiz).filter((k) => QUESTIONS.some((q) => q.id === k));
  const right = tried.filter((k) => quiz[k].correct).length;
  return (
    <div className="space-y-4">
      <div><div className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Practice</div><h1 className="text-2xl sm:text-3xl font-bold">Practice & Quizzes</h1></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Questions" value={QUESTIONS.length} /><Stat label="Attempted" value={tried.length} /><Stat label="Correct" value={right} tone="ok" />
        <Stat label="Accuracy" value={tried.length ? `${Math.round((right / tried.length) * 100)}%` : '—'} tone="accent" />
      </div>
      <Card title="Generated problem (answer computed by the simulator)" actions={<button className="btn !text-xs" onClick={() => setSeed(seed + 1)}><Shuffle className="w-3.5 h-3.5" />New problem</button>}>
        <QuestionCard key={gen.id} q={gen} record={false} />
      </Card>
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input !w-auto !font-sans" value={mod} onChange={(e) => setMod(e.target.value)} aria-label="Module filter">
          <option value="all">All modules</option>{MODULES.map((m) => <option key={m.id} value={m.id}>M{m.n} {m.title}</option>)}
        </select>
        <Segmented label="Difficulty" value={diff} onChange={setDiff} options={[{ value: 'all', label: 'All' }, { value: '1', label: 'Easy' }, { value: '2', label: 'Medium' }, { value: '3', label: 'Hard' }]} />
        <Segmented label="Show" value={view} onChange={setView} options={[{ value: 'all', label: 'All' }, { value: 'wrong', label: 'Review incorrect' }]} />
        <button className="btn !text-xs ml-auto" onClick={() => { if (confirm('Reset all progress and quiz results?')) reset(); }}><RotateCcw className="w-3.5 h-3.5" />Reset progress</button>
      </div>
      {list.length === 0 && <div className="text-muted text-sm">No questions match{view === 'wrong' ? ' — no incorrect answers to review.' : '.'}</div>}
      <div className="grid lg:grid-cols-2 gap-3">{list.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />)}</div>
    </div>
  );
}

const FORMULAS = [
  ['Clock period', 'T ≥ critical-path delay; f = 1/T'],
  ['Single-cycle period', 'T = IF + ID + EX + MEM + WB (load) = 800 ps'],
  ['Pipelined period', 'T = max(stage) = 200 ps'],
  ['Pipeline time', '(n + k − 1 + stalls) × T_stage'],
  ['Ideal speedup', '≈ k (balanced); here 800/200 = 4'],
  ['Effective address', 'rs1 + sign-ext(imm12)'],
  ['Branch target', 'PC + (sign-ext(imm) << 1)'],
  ['PCSrc', 'Branch · Zero'],
  ['Branch CPI', '1 + f_branch × f_mispredict × penalty'],
];
const CONTROL = [['R-type', '0', '0', '1', '0', '0', '0', '10'], ['ld', '1', '1', '1', '1', '0', '0', '00'], ['sd', '1', 'X', '0', '0', '1', '0', '00'], ['beq', '0', 'X', '0', '0', '0', '1', '01']];

export function ExamPage() {
  const [started, setStarted] = useState(false);
  const [seed, setSeed] = useState(1);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const exam: Question[] = useMemo(() => {
    let s = seed * 9301 + 49297;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const picked = MODULES.flatMap((m) => QUESTIONS.filter((q) => q.module === m.id).map((q) => ({ q, k: r() })).sort((a, b) => a.k - b.k).slice(0, 2).map((x) => x.q));
    return [...picked, generateQuestion(seed * 7 + 1), generateQuestion(seed * 7 + 2)];
  }, [seed]);
  const n = Object.keys(answers).length;
  const score = Object.values(answers).filter(Boolean).length;
  void checkAnswer;
  return (
    <div className="space-y-4">
      <div><div className="text-xs font-semibold uppercase tracking-wider text-accent mb-1">Exam prep</div><h1 className="text-2xl sm:text-3xl font-bold">Exam Preparation</h1></div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card title="Formula sheet">
          <table className="text-sm w-full"><tbody>{FORMULAS.map(([a, b]) => <tr key={a} className="border-b border-line/50"><td className="py-1.5 pr-3 font-medium">{a}</td><td className="font-mono text-xs">{b}</td></tr>)}</tbody></table>
        </Card>
        <Card title="Control table (slide 27)">
          <div className="overflow-x-auto"><table className="text-xs font-mono w-full">
            <thead className="text-muted"><tr>{['Instr', 'ALUSrc', 'MemtoReg', 'RegWrite', 'MemRead', 'MemWrite', 'Branch', 'ALUOp'].map((h) => <th key={h} className="text-left pr-2 py-1">{h}</th>)}</tr></thead>
            <tbody>{CONTROL.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`pr-2 py-1 ${c === '1' ? 'text-teal font-bold' : c === 'X' ? 'text-muted' : ''}`}>{c}</td>)}</tr>)}</tbody>
          </table></div>
          <div className="text-xs text-muted mt-2">ALU control: AND 0000 · OR 0001 · add 0010 · subtract 0110</div>
        </Card>
      </div>
      <Card title="Final comprehensive assessment" actions={started && <span className="text-sm font-mono">{score}/{n} correct · {n}/{exam.length} answered</span>}>
        {!started ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">{exam.length} questions: two from each module plus two generated multi-step problems. Results feed your mastery indicators.</p>
            <button className="btn btn-primary" onClick={() => setStarted(true)}>Start assessment</button>
          </div>
        ) : (
          <div className="space-y-3">
            {n === exam.length && <Callout kind={score / n >= 0.7 ? 'ok' : 'warn'} title={`Score: ${score}/${n} (${Math.round((score / n) * 100)}%)`}>Review incorrect answers in Practice → “Review incorrect”.</Callout>}
            {exam.map((q, i) => <QuestionCard key={`${seed}-${q.id}`} q={q} index={i} record={!q.id.startsWith('gen')} onAnswered={(ok) => setAnswers((a) => ({ ...a, [q.id]: ok }))} />)}
            <button className="btn" onClick={() => { setSeed(seed + 1); setAnswers({}); }}><Shuffle className="w-4 h-4" />New assessment</button>
          </div>
        )}
      </Card>
    </div>
  );
}
