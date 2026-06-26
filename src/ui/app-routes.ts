export const appRoutes = {
  homeRedirect: '/agents',
  agents: '/agents',
  models: '/models',
  settings: '/settings',
  tasks: '/tasks',
  createTask: '/tasks/new',
  taskDetails: '/tasks/:taskId',
  workflows: '/workflows',
  workflowRunDetails: '/workflow-runs/:runId',
  humanTasks: '/human-tasks',
} as const;

export const appRouteMessages = {
  notFoundTitle: 'Route Not Found',
  notFoundDescription: 'The requested page does not exist.',
} as const;
