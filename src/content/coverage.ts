import { ALL_TOPICS, MODULES } from './modules';
import { QUESTIONS } from './quiz';
import { WIDGETS } from '../widgets';

export function expandSlides(s: string): number[] {
  const out: number[] = [];
  s.split(',').forEach((part) => {
    const m = part.trim().split(/[–-]/).map((x) => parseInt(x, 10));
    if (m.length === 2) for (let i = m[0]; i <= m[1]; i++) out.push(i);
    else if (!Number.isNaN(m[0])) out.push(m[0]);
  });
  return out;
}

export interface CoverageRow { slide: number; module: string; moduleTitle: string; topics: { id: string; title: string }[]; widgets: string[]; questions: number; status: 'covered' | 'missing' }

export function coverage(): CoverageRow[] {
  return Array.from({ length: 61 }, (_, k) => {
    const slide = k + 1;
    const mod = MODULES.find((m) => expandSlides(m.slides).includes(slide));
    const topics = ALL_TOPICS.filter((t) => expandSlides(t.slides).includes(slide));
    const widgets = [...new Set(topics.map((t) => t.widget).filter(Boolean).map((w) => WIDGETS[w!].title))];
    const questions = QUESTIONS.filter((q) => expandSlides(q.slides).includes(slide)).length;
    return { slide, module: mod?.id ?? '', moduleTitle: mod ? `M${mod.n} ${mod.title}` : '-', topics: topics.map((t) => ({ id: t.id, title: t.title })), widgets, questions, status: topics.length ? 'covered' : 'missing' };
  });
}
