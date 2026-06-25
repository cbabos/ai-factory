import { Button } from '../controls/Button.js';
import type { WorkflowArtifactRecord } from '../../services/types.js';

interface WorkflowArtifactListProps {
  artifacts: WorkflowArtifactRecord[];
  title?: string;
  emptyMessage?: string;
}

function formatArtifactKind(kind: WorkflowArtifactRecord['kind']): string {
  switch (kind) {
    case 'markdown':
      return 'Markdown';
    case 'json':
      return 'JSON';
    case 'text':
    default:
      return 'Text';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkflowArtifactList({
  artifacts,
  title = 'Artifacts',
  emptyMessage = 'No artifacts available yet.',
}: WorkflowArtifactListProps) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {title}
      </div>
      {artifacts.length === 0 ? (
        <div className="rounded-cyber border border-dashed border-accent-primary/20 bg-bg-secondary/20 px-3 py-4 text-sm text-text-secondary">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-cyber border border-accent-primary/15 bg-bg-secondary/25 px-4 py-3"
            >
              <div>
                <div className="font-medium text-text-primary">{artifact.title}</div>
                <div className="mt-1 text-xs text-text-secondary">
                  {formatArtifactKind(artifact.kind)} · {formatBytes(artifact.sizeBytes)} · {artifact.fileName}
                </div>
                <div className="mt-1 text-xs text-text-muted">
                  {artifact.storagePath}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(artifact.contentUrl, '_blank', 'noopener,noreferrer')}
                >
                  Open
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkflowArtifactList;
