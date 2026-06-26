import React, { useCallback, useEffect, useState } from 'react';
import { Panel } from '../components/layout/Panel.js';
import { Alert } from '../components/ui/Alert.js';
import { Input } from '../components/forms/Input.js';
import { Select } from '../components/forms/Select.js';
import { Button } from '../components/controls/Button.js';
import { apiClient, type AppSettings } from '../services/index.js';

const defaultSettings: AppSettings = {
  theme: 'synthwave84',
  uiLayout: 'dashboard',
  autoRefreshMs: 5000,
  maxTasksDisplay: 100,
  decompositionThreshold: 5,
  budgetDefaultCap: 10,
  budgetSoftCapRatio: 0.8,
  dispatchMaxConcurrency: 5,
  dispatchDefaultTimeoutMs: 120000,
};

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getSettings();
      setSettings({ ...defaultSettings, ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSuccess(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await apiClient.updateSettings(settings);
      setSettings({ ...defaultSettings, ...saved });
      setSuccess('Runtime settings updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await loadSettings();
    setSuccess(null);
  };

  return (
    <Panel
      title="Runtime Settings"
      subtitle="Manage live orchestration, budget, dispatch, and UI defaults"
      border="cyber"
      headerVariant="cyber"
      padding="md"
      cyber
    >
      <div className="space-y-6">
        {error ? (
          <Alert variant="error" title="Settings Error">
            {error}
          </Alert>
        ) : null}

        {success ? (
          <Alert variant="success" title="Settings Saved">
            {success}
          </Alert>
        ) : null}

        <Panel
          title="Interface"
          subtitle="Theme and dashboard defaults"
          border="default"
          headerVariant="minimal"
          padding="md"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Theme"
              value={settings.theme}
              disabled={loading || saving}
              options={[
                { value: 'synthwave84', label: 'Synthwave 84' },
                { value: 'tokyonight', label: 'Tokyo Night' },
                { value: 'zenburn', label: 'Zenburn' },
              ]}
              onChange={(event) => updateField('theme', event.target.value as AppSettings['theme'])}
            />
            <Input
              label="UI Layout"
              value={settings.uiLayout ?? 'dashboard'}
              disabled={loading || saving}
              onChange={(event) => updateField('uiLayout', event.target.value)}
              helpText="Stored for future layout modes. Current default is dashboard."
            />
            <Input
              label="Auto Refresh (ms)"
              type="number"
              min={1000}
              step={500}
              value={String(settings.autoRefreshMs ?? defaultSettings.autoRefreshMs)}
              disabled={loading || saving}
              onChange={(event) => updateField('autoRefreshMs', parseNumber(event.target.value, defaultSettings.autoRefreshMs!))}
            />
            <Input
              label="Max Tasks Display"
              type="number"
              min={10}
              step={10}
              value={String(settings.maxTasksDisplay ?? defaultSettings.maxTasksDisplay)}
              disabled={loading || saving}
              onChange={(event) => updateField('maxTasksDisplay', parseNumber(event.target.value, defaultSettings.maxTasksDisplay!))}
            />
          </div>
        </Panel>

        <Panel
          title="Orchestration"
          subtitle="Control when tasks are decomposed into sub-tasks"
          border="default"
          headerVariant="minimal"
          padding="md"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Decomposition Threshold"
              type="number"
              min={1}
              step={1}
              value={String(settings.decompositionThreshold ?? defaultSettings.decompositionThreshold)}
              disabled={loading || saving}
              onChange={(event) => updateField('decompositionThreshold', parseNumber(event.target.value, defaultSettings.decompositionThreshold!))}
              helpText="Tasks above this complexity score are decomposed."
            />
          </div>
        </Panel>

        <Panel
          title="Budget"
          subtitle="Set default provider budget caps used by the selector"
          border="default"
          headerVariant="minimal"
          padding="md"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Default Cap"
              type="number"
              min={0.01}
              step={0.01}
              value={String(settings.budgetDefaultCap ?? defaultSettings.budgetDefaultCap)}
              disabled={loading || saving}
              onChange={(event) => updateField('budgetDefaultCap', parseNumber(event.target.value, defaultSettings.budgetDefaultCap!))}
            />
            <Input
              label="Soft Cap Ratio"
              type="number"
              min={0.01}
              max={1}
              step={0.01}
              value={String(settings.budgetSoftCapRatio ?? defaultSettings.budgetSoftCapRatio)}
              disabled={loading || saving}
              onChange={(event) => updateField('budgetSoftCapRatio', parseNumber(event.target.value, defaultSettings.budgetSoftCapRatio!))}
              helpText="A value between 0 and 1."
            />
          </div>
        </Panel>

        <Panel
          title="Dispatch"
          subtitle="Tune concurrency and baseline execution timeout defaults"
          border="default"
          headerVariant="minimal"
          padding="md"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Max Concurrency"
              type="number"
              min={1}
              step={1}
              value={String(settings.dispatchMaxConcurrency ?? defaultSettings.dispatchMaxConcurrency)}
              disabled={loading || saving}
              onChange={(event) => updateField('dispatchMaxConcurrency', parseNumber(event.target.value, defaultSettings.dispatchMaxConcurrency!))}
            />
            <Input
              label="Default Timeout (ms)"
              type="number"
              min={1000}
              step={1000}
              value={String(settings.dispatchDefaultTimeoutMs ?? defaultSettings.dispatchDefaultTimeoutMs)}
              disabled={loading || saving}
              onChange={(event) => updateField('dispatchDefaultTimeoutMs', parseNumber(event.target.value, defaultSettings.dispatchDefaultTimeoutMs!))}
            />
          </div>
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              void handleReset();
            }}
            disabled={loading || saving}
          >
            Reload
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={loading}
            onClick={() => {
              void handleSave();
            }}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </Panel>
  );
};

export default SettingsPage;
