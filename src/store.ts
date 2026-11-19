import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Mode = 'beginner' | 'standard' | 'exam';
export interface QuizRecord { correct: boolean; answer: string; at: number; attempts: number }

interface AppState {
  theme: 'dark' | 'light';
  mode: Mode;
  completed: Record<string, boolean>; // topic ids
  quiz: Record<string, QuizRecord>;
  lastLesson: string | null;
  simSpeed: number; // ms per step
  forwarding: boolean;
  setTheme: (t: 'dark' | 'light') => void;
  setMode: (m: Mode) => void;
  toggleComplete: (id: string, v?: boolean) => void;
  recordQuiz: (id: string, correct: boolean, answer: string) => void;
  setLastLesson: (id: string) => void;
  setSimSpeed: (n: number) => void;
  setForwarding: (b: boolean) => void;
  resetProgress: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark', mode: 'standard', completed: {}, quiz: {}, lastLesson: null, simSpeed: 700, forwarding: true,
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        try { localStorage.setItem('rv-theme', theme); } catch { /* ignore */ }
        set({ theme });
      },
      setMode: (mode) => set({ mode }),
      toggleComplete: (id, v) => set((s) => ({ completed: { ...s.completed, [id]: v ?? !s.completed[id] } })),
      recordQuiz: (id, correct, answer) => set((s) => ({
        quiz: { ...s.quiz, [id]: { correct, answer, at: Date.now(), attempts: (s.quiz[id]?.attempts ?? 0) + 1 } },
      })),
      setLastLesson: (id) => set({ lastLesson: id }),
      setSimSpeed: (simSpeed) => set({ simSpeed }),
      setForwarding: (forwarding) => set({ forwarding }),
      resetProgress: () => set({ completed: {}, quiz: {}, lastLesson: null }),
    }),
    { name: 'rv-lab-v1' },
  ),
);
