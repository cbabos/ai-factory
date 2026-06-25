interface ImportMetaEnvLike {
  VITE_API_URL?: string;
}

/**
 * API configuration for UI
 * Uses environment variable or default to localhost:3001
 */

export const API_BASE_URL =
  ((import.meta as ImportMeta & { env?: ImportMetaEnvLike }).env?.VITE_API_URL) ??
  'http://localhost:3001';

export const API_ENDPOINTS = {
  agents: `${API_BASE_URL}/api/agents`,
  models: `${API_BASE_URL}/api/models`,
  tasks: `${API_BASE_URL}/api/tasks`,
  workflows: `${API_BASE_URL}/api/workflows`,
  workflowRuns: `${API_BASE_URL}/api/workflow-runs`,
  humanTasks: `${API_BASE_URL}/api/human-tasks`,
  settings: `${API_BASE_URL}/api/settings`,
  settingsTheme: `${API_BASE_URL}/api/settings/theme`,
} as const;

export default {
  API_BASE_URL,
  API_ENDPOINTS,
};
