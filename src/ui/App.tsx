import { AgentsPage } from './pages/index.js';
import { ModelsPage } from './pages/index.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { ThemeProvider } from './theme/index.js';
import { useEffect, useState } from 'react';

const App = () => {
  const [page, setPage] = useState('agents');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '') || 'agents';
      setPage(hash as 'agents' | 'models' | 'tasks');
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
  }, []);

  const renderPage = () => {
    switch (page) {
      case 'agents':
        return <AgentsPage />;
      case 'models':
        return <ModelsPage />;
      case 'tasks':
        return <div>Tasks page coming soon</div>;
      default:
        return <AgentsPage />;
    }
  };

  return (
    <ThemeProvider defaultTheme="synthwave84">
      <MainLayout title="Factory">
        {renderPage()}
      </MainLayout>
    </ThemeProvider>
  );
};

export default App;
export { App };
