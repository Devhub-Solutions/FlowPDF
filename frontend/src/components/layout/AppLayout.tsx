import { Link, Outlet, useLocation } from 'react-router-dom';
import { Ico } from '../icons/Ico';

export function AppLayout() {
  const location = useLocation();

  const tabs = [
    { to: '/render',   label: 'Render',           icon: <Ico.zap /> },
    { to: '/merge',    label: 'Merge PDF',         icon: <Ico.merge /> },
    { to: '/builder',  label: 'Template Builder',  icon: <Ico.cursor /> },
    { to: '/lookup',   label: 'Vehicle Lookup',    icon: <Ico.search /> },
    { to: '/guide',    label: 'Hướng dẫn',         icon: <Ico.book /> },
    { to: '/api-docs', label: 'API Docs',           icon: <Ico.code /> },
  ];

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 backdrop-blur-xl bg-zinc-950/80 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-2 md:py-0 min-h-14 flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-6">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-lime-400 flex items-center justify-center shadow-[0_0_12px_rgba(163,230,53,0.4)]">
              <span className="text-zinc-950 font-bold text-xs font-mono">F</span>
            </div>
            <span className="font-bold text-white text-base tracking-tight">FlowPDF</span>
          </Link>

          <nav className="flex items-center gap-1 ml-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {tabs.map((t) => {
              const active = location.pathname === t.to;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-all font-medium whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400/60 focus-visible:outline-offset-2 ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
                >
                  {t.icon} {t.label}
                </Link>
              );
            })}
          </nav>
          <span className="md:hidden text-[10px] text-zinc-600 font-mono whitespace-nowrap">scroll →</span>

          <div className="ml-auto flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
              <span className="text-xs text-zinc-500 font-mono">v1.0.0</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
