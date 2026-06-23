import { Navigate, Route, Routes } from 'react-router-dom';
import { AgentsPage, ModelsPage, TaskDetailsPage, TasksPage } from './pages/index.js';
import { MainLayout } from './components/layout/MainLayout.js';
import { ThemeProvider } from './theme/index.js';
import { Panel } from './components/layout/Panel.js';
import { appRouteMessages, appRoutes } from './app-routes.js';

const App = () => {
  return (
    <ThemeProvider defaultTheme="synthwave84">
      <MainLayout title="Factory">
        <Routes>
          <Route path="/" element={<Navigate to={appRoutes.homeRedirect} replace />} />
          <Route path={appRoutes.agents} element={<AgentsPage />} />
          <Route path={appRoutes.models} element={<ModelsPage />} />
          <Route path={appRoutes.tasks} element={<TasksPage />} />
          <Route path={appRoutes.taskDetails} element={<TaskDetailsPage />} />
          <Route
            path="*"
            element={
              <Panel title={appRouteMessages.notFoundTitle} border="default">
                {appRouteMessages.notFoundDescription}
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
