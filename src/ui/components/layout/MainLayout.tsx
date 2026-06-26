import { ReactNode, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { apiClient } from '../../services/index.js';
import { ThemeSwitcher } from '../../theme/index.js';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
}

const navigationItems = [
  { to: '/tasks/new', label: 'New Task' },
  { to: '/agents', label: 'Agents' },
  { to: '/models', label: 'Models' },
  { to: '/settings', label: 'Settings' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/workflows', label: 'Workflows' },
  { to: '/human-tasks', label: 'Human Tasks' },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children, title = 'AI Factory' }) => {
  const [pendingHumanTaskCount, setPendingHumanTaskCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadPendingCount = async () => {
      try {
        const tasks = await apiClient.listHumanTasks();
        if (!cancelled) {
          setPendingHumanTaskCount(tasks.length);
        }
      } catch {
        if (!cancelled) {
          setPendingHumanTaskCount(0);
        }
      }
    };

    void loadPendingCount();
    const intervalId = window.setInterval(() => {
      void loadPendingCount();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-panel text-text-primary transition-colors">
      <header className="sticky top-0 z-40 border-b border-accent-primary/20 bg-panel/95 backdrop-blur-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-accent-primary">AI</span> {title}
            </h1>
            <nav className="flex gap-2">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 text-sm rounded-cyber border transition-all ${
                      isActive
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                        : 'border-transparent text-text-secondary hover:border-accent-primary/30 hover:text-accent-primary'
                    }`
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.to === '/human-tasks' && pendingHumanTaskCount > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_0_12px_rgba(255,49,49,0.45)]">
                        {pendingHumanTaskCount}
                      </span>
                    ) : null}
                  </span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher showLabel />
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10">
              <div className="w-2 h-2 rounded-full bg-accent-success animate-pulse" />
              <span className="text-xs font-medium text-accent-success">System Active</span>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
};

export default MainLayout;
