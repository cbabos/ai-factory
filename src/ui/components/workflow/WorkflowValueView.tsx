import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type WorkflowValue =
  | string
  | number
  | boolean
  | null
  | WorkflowValue[]
  | { [key: string]: WorkflowValue };

interface WorkflowValueViewProps {
  value: unknown;
  label?: string;
  depth?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asWorkflowValue(value: unknown): WorkflowValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => asWorkflowValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, asWorkflowValue(item)]),
    );
  }

  return String(value);
}

function formatLabel(label: string): string {
  return label
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderMarkdown(value: string) {
  return (
    <div className="prose prose-invert max-w-none text-sm text-text-primary prose-pre:bg-panel/70 prose-pre:border prose-pre:border-accent-primary/20 prose-code:text-accent-secondary prose-headings:text-accent-primary prose-strong:text-text-primary prose-a:text-accent-secondary">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {value}
      </ReactMarkdown>
    </div>
  );
}

export function WorkflowValueView({ value, label, depth = 0 }: WorkflowValueViewProps) {
  const normalized = asWorkflowValue(value);

  if (depth > 5) {
    return (
      <pre className="overflow-auto rounded-cyber border border-accent-primary/15 bg-bg-secondary/40 p-3 text-xs text-text-secondary">
        {JSON.stringify(normalized, null, 2)}
      </pre>
    );
  }

  if (typeof normalized === 'string') {
    return (
      <div className="space-y-2">
        {label ? (
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
            {formatLabel(label)}
          </div>
        ) : null}
        {renderMarkdown(normalized)}
      </div>
    );
  }

  if (
    normalized === null
    || typeof normalized === 'number'
    || typeof normalized === 'boolean'
  ) {
    return (
      <div className="space-y-2">
        {label ? (
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
            {formatLabel(label)}
          </div>
        ) : null}
        <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-3 py-2 text-sm text-text-primary">
          {String(normalized)}
        </div>
      </div>
    );
  }

  if (Array.isArray(normalized)) {
    return (
      <div className="space-y-2">
        {label ? (
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
            {formatLabel(label)}
          </div>
        ) : null}
        {normalized.length === 0 ? (
          <div className="rounded-cyber border border-dashed border-accent-primary/20 bg-bg-secondary/20 px-3 py-2 text-sm text-text-secondary">
            Empty list
          </div>
        ) : (
          <div className="space-y-3">
            {normalized.map((item, index) => (
              <div key={`${label ?? 'item'}-${index}`} className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/20 p-3">
                <WorkflowValueView value={item} label={`Item ${index + 1}`} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const entries = Object.entries(normalized);

  return (
    <div className="space-y-3">
      {label ? (
        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
          {formatLabel(label)}
        </div>
      ) : null}
      {entries.length === 0 ? (
        <div className="rounded-cyber border border-dashed border-accent-primary/20 bg-bg-secondary/20 px-3 py-2 text-sm text-text-secondary">
          Empty object
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, item]) => (
            <div key={key} className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/20 p-3">
              <WorkflowValueView value={item} label={key} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkflowValueView;
