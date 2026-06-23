import { describe, expect, it } from 'vitest';
import { appRouteMessages, appRoutes } from '../app-routes.js';

describe('app route contract', () => {
  it('keeps the expected top-level route paths', () => {
    expect(appRoutes).toEqual({
      homeRedirect: '/agents',
      agents: '/agents',
      models: '/models',
      tasks: '/tasks',
      taskDetails: '/tasks/:taskId',
    });
  });

  it('keeps the not-found copy stable', () => {
    expect(appRouteMessages.notFoundTitle).toBe('Route Not Found');
    expect(appRouteMessages.notFoundDescription).toBe('The requested page does not exist.');
  });
});
