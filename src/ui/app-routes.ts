export const appRoutes = {
  homeRedirect: '/agents',
  agents: '/agents',
  models: '/models',
  tasks: '/tasks',
  taskDetails: '/tasks/:taskId',
} as const;

export const appRouteMessages = {
  notFoundTitle: 'Route Not Found',
  notFoundDescription: 'The requested page does not exist.',
} as const;
