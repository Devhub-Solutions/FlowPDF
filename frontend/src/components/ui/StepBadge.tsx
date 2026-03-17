import { Ico } from '../icons/Ico';

export function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0 transition-all
        ${done ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700'}`}
    >
      {done ? <Ico.check /> : n}
    </div>
  );
}
