import { useState } from 'react';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { checkAnswer, type Question } from '../content/quiz';
import { useApp } from '../store';
import { SlideRef } from './ui';

export default function QuestionCard({ q, index, onAnswered, record = true }: { q: Question; index?: number; onAnswered?: (ok: boolean) => void; record?: boolean }) {
  const recordQuiz = useApp((s) => s.recordQuiz);
  const [given, setGiven] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hint, setHint] = useState(false);
  const ok = submitted && checkAnswer(q, given);
  const submit = () => {
    if (given === '' || submitted) return;
    setSubmitted(true);
    const c = checkAnswer(q, given);
    if (record) recordQuiz(q.id, c, given);
    onAnswered?.(c);
  };
  const diff = ['', 'Easy', 'Medium', 'Hard'][q.difficulty];
  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {index !== undefined && <span className="font-mono text-muted">Q{index + 1}</span>}
        <span className="chip bg-raised text-muted">{q.category}</span>
        <span className={`chip ${q.difficulty === 3 ? 'bg-bad/10 text-bad' : q.difficulty === 2 ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok'}`}>{diff}</span>
        <SlideRef s={q.slides} />
      </div>
      <div className="font-medium leading-relaxed">{q.q}</div>
      {q.code && <pre className="font-mono text-xs bg-raised rounded-lg p-3 overflow-x-auto">{q.code}</pre>}
      {q.type === 'num' ? (
        <div className="flex gap-2">
          <input className="input !w-40" inputMode="decimal" value={given} disabled={submitted} onChange={(e) => setGiven(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} aria-label="Your answer" placeholder="Your answer" />
        </div>
      ) : (
        <div className="grid gap-1.5" role="radiogroup">
          {q.options!.map((o, i) => {
            const chosen = given === String(i);
            const state = submitted ? (i === q.answer ? 'border-ok bg-ok/10' : chosen ? 'border-bad bg-bad/10' : 'border-line opacity-70') : chosen ? 'border-accent bg-accent/10' : 'border-line hover:bg-raised';
            return (
              <button key={i} role="radio" aria-checked={chosen} disabled={submitted} onClick={() => setGiven(String(i))} className={`text-left text-sm border rounded-lg px-3 py-2 transition-colors ${state}`}>
                <span className="font-mono text-muted mr-2">{String.fromCharCode(65 + i)}</span>{o}
                {submitted && q.wrong?.[i] && i !== q.answer && (chosen || q.type === 'mcq') && <div className="text-xs text-muted mt-1">✗ {q.wrong[i]}</div>}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn btn-primary" onClick={submit} disabled={given === '' || submitted}>Check answer</button>
        {!submitted && <button className="btn" onClick={() => setHint(!hint)}><Lightbulb className="w-4 h-4" />Hint</button>}
        {submitted && <button className="btn" onClick={() => { setSubmitted(false); setGiven(''); setHint(false); }}>Try again</button>}
      </div>
      {hint && !submitted && <div className="text-sm text-teal">Hint: {q.hint}</div>}
      {submitted && (
        <div className={`rounded-lg border p-3 text-sm ${ok ? 'border-ok/40 bg-ok/5' : 'border-bad/40 bg-bad/5'}`}>
          <div className="flex items-center gap-1.5 font-semibold mb-1">{ok ? <CheckCircle2 className="w-4 h-4 text-ok" /> : <XCircle className="w-4 h-4 text-bad" />}{ok ? 'Correct' : `Not quite. Correct answer: ${q.type === 'num' ? q.answer : String.fromCharCode(65 + q.answer) + '. ' + q.options![q.answer]}`}</div>
          <div className="leading-relaxed">{q.solution}</div>
        </div>
      )}
    </div>
  );
}
