import { ReactNode } from 'react';
import { Button } from '../controls/Button.js';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, title = 'AI Factory' }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#00f3ff]">
      <header className="border-b border-[#00f3ff]/20 bg-[#0a0a12]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-accent-primary">AI</span> {title}
            </h1>
            <nav className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => window.location.hash = '/agents'}>
                Agents
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.location.hash = '/models'}>
                Models
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.location.hash = '/tasks'}>
                Tasks
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
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
