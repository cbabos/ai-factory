import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ConversationTurn } from '../../../core/types.js';

interface JsonObject {
  [key: string]: JsonValue;
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

interface ConversationTurnViewProps {
  turn: ConversationTurn;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function parseJson(value: string): JsonValue | null {
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    return null;
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getObjectTitle(value: JsonObject): string | null {
  const name = typeof value.name === 'string' ? value.name : undefined;
  const toolName = typeof value.toolName === 'string' ? value.toolName : undefined;
  const success = typeof value.success === 'boolean' ? (value.success ? 'success' : 'failed') : undefined;
  const error = typeof value.error === 'string' ? 'error' : undefined;
  const title = name ?? toolName ?? error ?? success;
  return title ?? null;
}

function getPrimaryKeys(value: JsonObject): string[] {
  return ['output', 'content', 'result', 'message', 'error'].filter((key) => key in value);
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

function ContentBlock({
  value,
  label,
  depth = 0,
}: {
  value: JsonValue | string;
  label?: string;
  depth?: number;
}) {
  if (depth > 4) {
    return (
      <pre className="overflow-auto rounded-cyber border border-accent-primary/15 bg-bg-secondary/40 p-3 text-xs text-text-secondary">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (typeof value === 'string') {
    const parsed = parseJson(value);
    return (
      <div className="space-y-2">
        {label ? (
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
            {label}
          </div>
        ) : null}
        {parsed ? <ContentBlock value={parsed} depth={depth + 1} /> : renderMarkdown(value)}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {label ? (
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
            {label}
          </div>
        ) : null}
        <div className="space-y-2">
          {value.map((item, index) => (
            <div
              key={index}
              className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 p-3"
            >
              <ContentBlock value={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isJsonObject(value)) {
    const title = getObjectTitle(value);
    const primaryKeys = getPrimaryKeys(value);
    const secondaryEntries = Object.entries(value).filter(
      ([key]) => !primaryKeys.includes(key),
    );

    return (
      <div className="space-y-3">
        {label || title ? (
          <div className="flex flex-wrap items-center gap-2">
            {label ? (
              <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
                {label}
              </span>
            ) : null}
            {title ? (
              <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] text-accent-secondary">
                {title}
              </span>
            ) : null}
          </div>
        ) : null}

        {primaryKeys.map((key) => (
          <ContentBlock
            key={key}
            label={key}
            value={value[key] ?? null}
            depth={depth + 1}
          />
        ))}

        {secondaryEntries.length > 0 ? (
          <details className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30">
            <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-[0.14em] text-text-secondary">
              Fields
            </summary>
            <div className="space-y-3 border-t border-accent-primary/10 p-3">
              {secondaryEntries.map(([key, item]) => (
                <ContentBlock key={key} label={key} value={item} depth={depth + 1} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 px-3 py-2 text-sm text-text-primary">
      {String(value)}
    </div>
  );
}

export function ConversationTurnView({ turn }: ConversationTurnViewProps) {
  const parsed = parseJson(turn.content);

  return (
    <article className="rounded-cyber border border-accent-primary/15 bg-bg-secondary/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
            {turn.role}
          </span>
          {turn.metadata?.toolName ? (
            <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] text-accent-secondary">
              {String(turn.metadata.toolName)}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-text-secondary">
          {formatDate(turn.timestamp)}
        </span>
      </div>

      <ContentBlock value={parsed ?? turn.content} />

      <details className="mt-3 rounded-cyber border border-accent-primary/10 bg-panel/40">
        <summary className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-text-muted">
          Raw
        </summary>
        <pre className="max-h-80 overflow-auto border-t border-accent-primary/10 p-3 text-xs text-text-secondary">
          {turn.content}
        </pre>
      </details>
    </article>
  );
}
