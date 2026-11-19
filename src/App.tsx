import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, Link } from 'react-router-dom';
import { BookOpen, Cpu, GitBranch, Home, Layers, Menu, Moon, Sun, X, Gauge, ListChecks, GraduationCap, Search, Table2, AlertTriangle, Library } from 'lucide-react';
import { useApp, type Mode } from './store';
import { ALL_TOPICS, MODULES } from './content/modules';
import { Segmented } from './components/ui';
import { HomePage, Curriculum, LessonPage, ExplorerPage, PipelinePage, HazardPage, PerfPage, GlossaryPage, CoveragePage, NotFound } from './pages/pages';
import { PracticePage, ExamPage } from './pages/quizPages';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/curriculum', label: 'Curriculum', icon: BookOpen },
  { to: '/explorer', label: 'Datapath Explorer', icon: Cpu },
  { to: '/pipeline', label: 'Pipeline Simulator', icon: Layers },
  { to: '/hazards', label: 'Hazard Lab', icon: AlertTriangle },
  { to: '/performance', label: 'Performance', icon: Gauge },
  { to: '/practice', label: 'Practice & Quizzes', icon: ListChecks },
  { to: '/exam', label: 'Exam Prep', icon: GraduationCap },
  { to: '/glossary', label: 'Glossary', icon: Library },
  { to: '/coverage', label: 'Slide Coverage', icon: Table2 },
];

function Sidebar({ onNav }: { onNav?: () => void }) {
  const completed = useApp((s) => s.completed);
  return (
    <nav className="flex flex-col gap-0.5 p-3 text-sm" aria-label="Main">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={onNav}
          className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-ink hover:bg-raised'}`}>
          <n.icon className="w-4 h-4" />{n.label}
        </NavLink>
      ))}
      <div className="mt-4 mb-1 px-2.5 text-[11px] uppercase tracking-wider text-muted">Modules</div>
      {MODULES.map((m) => {
        const done = m.topics.filter((t) => completed[t.id]).length;
        return (
          <NavLink key={m.id} to={`/lesson/${m.id}`} onClick={onNav}
            className={({ isActive }) => `flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink hover:bg-raised'}`}>
            <span className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0 ${done === m.topics.length ? 'bg-ok/20 text-ok' : 'bg-raised'}`}>{m.n}</span>
            <span className="truncate">{m.title}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const hits = q.length < 2 ? [] : ALL_TOPICS.filter((t) => (t.title + ' ' + t.simple + ' ' + t.technical).toLowerCase().includes(q.toLowerCase())).slice(0, 7);
  return (
    <div className="relative hidden md:block">
      <Search className="w-4 h-4 absolute left-2.5 top-2 text-muted" />
      <input className="input !pl-8 !w-64 !font-sans" placeholder="Search lessons…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search lessons" />
      {hits.length > 0 && (
        <div className="absolute top-10 left-0 w-80 card shadow-xl z-50 p-1">
          {hits.map((h) => (
            <Link key={h.id} to={`/lesson/${h.module.id}#${h.id}`} onClick={() => setQ('')} className="block px-3 py-2 rounded-lg hover:bg-raised text-sm">
              <div className="font-medium">{h.title}</div><div className="text-xs text-muted">Module {h.module.n} · slides {h.slides}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { theme, setTheme, mode, setMode, completed } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  useEffect(() => {
    if (loc.hash) { const el = document.getElementById(loc.hash.slice(1)); if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; } }
    document.getElementById('main')?.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);
  const pct = Math.round((Object.values(completed).filter(Boolean).length / ALL_TOPICS.length) * 100);
  return (
    <div className="h-full flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-surface">Skip to content</a>
      <header className="h-14 shrink-0 border-b border-line bg-surface/80 backdrop-blur flex items-center gap-3 px-3 sm:px-4 z-30">
        <button className="btn !p-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="w-5 h-5" /></button>
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center"><GitBranch className="w-4 h-4" /></span>
          <span className="hidden sm:inline whitespace-nowrap">RISC-V Pipeline Lab</span>
        </Link>
        <span className="chip bg-raised text-muted hidden md:inline-flex whitespace-nowrap">Lecture 8</span>
        <div className="flex-1" />
        <GlobalSearch />
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted" title="Lessons completed">
          <div className="w-24 h-1.5 bg-raised rounded-full overflow-hidden"><div className="h-full bg-ok" style={{ width: `${pct}%` }} /></div>{pct}%
        </div>
        <div className="hidden sm:block"><Segmented label="Learning mode" value={mode} onChange={(v: Mode) => setMode(v)} options={[{ value: 'beginner', label: 'Beginner' }, { value: 'standard', label: 'Standard' }, { value: 'exam', label: 'Exam' }]} /></div>
        <select className="input !w-auto !font-sans sm:hidden" value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Learning mode">
          <option value="beginner">Beginner</option><option value="standard">Standard</option><option value="exam">Exam</option>
        </select>
        <button className="btn !p-1.5" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
      </header>
      <div className="flex-1 flex min-h-0">
        <aside className="w-64 shrink-0 border-r border-line bg-surface overflow-y-auto hidden lg:block"><Sidebar /></aside>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-surface border-r border-line overflow-y-auto">
              <div className="flex justify-end p-2"><button className="btn !p-1.5" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="w-4 h-4" /></button></div>
              <Sidebar onNav={() => setOpen(false)} />
            </aside>
          </div>
        )}
        <main id="main" className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/curriculum" element={<Curriculum />} />
              <Route path="/lesson/:id" element={<LessonPage />} />
              <Route path="/explorer" element={<ExplorerPage />} />
              <Route path="/pipeline" element={<PipelinePage />} />
              <Route path="/hazards" element={<HazardPage />} />
              <Route path="/performance" element={<PerfPage />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/exam" element={<ExamPage />} />
              <Route path="/glossary" element={<GlossaryPage />} />
              <Route path="/coverage" element={<CoveragePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
