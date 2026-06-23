import { Navigate, Route, Routes } from 'react-router-dom';
import { AgentsPage, ModelsPage, TaskDetailsPage, TasksPage } from './pages/index.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { ThemeProvider } from './theme/index.js';
import { Panel } from './components/layout/Panel.js';

const App = () => {
  return (
    <ThemeProvider defaultTheme="synthwave84">
      <MainLayout title="Factory">
        <Routes>
          <Route path="/" element={<Navigate to="/agents" replace />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailsPage />} />
          <Route
            path="*"
            element={
              <Panel title="Route Not Found" border="default">
                The requested page does not exist.
              </Panel>
            }
          />
        </Routes>
      </MainLayout>
    </ThemeProvider>
  );
};

export default App;
export { App };
