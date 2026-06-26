import type { ConversationTurn } from '../../../core/types.js';

interface RankedRoutingCandidate {
  agentId: string;
  score: number;
  matchedTaskTags?: string[];
  missingTaskTags?: string[];
  extraAgentTags?: string[];
}

interface RoutingDiagnosticsPayload {
  requestedTags?: string[];
  rankedCandidates?: RankedRoutingCandidate[];
}

interface RoutingDiagnosticsViewProps {
  title?: string;
  turns: ConversationTurn[];
}

function parseRoutingDiagnostics(turn: ConversationTurn): RoutingDiagnosticsPayload | null {
  if (turn.metadata?.phase !== 'dispatch-routing') {
    return null;
  }

  try {
    const parsed = JSON.parse(turn.content) as RoutingDiagnosticsPayload;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function RoutingDiagnosticsView({
  title = 'Routing Diagnostics',
  turns,
}: RoutingDiagnosticsViewProps) {
  const diagnostics = turns
    .map((turn) => ({
      turn,
      payload: parseRoutingDiagnostics(turn),
    }))
    .filter((entry): entry is { turn: ConversationTurn; payload: RoutingDiagnosticsPayload } => entry.payload !== null);

  if (diagnostics.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-secondary">
          {title}
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          Ranked agent candidates and tag-coverage breakdown captured during dispatch.
        </p>
      </div>

      <div className="space-y-3">
        {diagnostics.map(({ turn, payload }, index) => (
          <div
            key={`${turn.timestamp}-${index}`}
            className="rounded-cyber border border-accent-primary/15 bg-panel/60 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-primary">
                  requested tags
                </span>
                {(payload.requestedTags ?? []).length === 0 ? (
                  <span className="text-xs text-text-secondary">none</span>
                ) : (
                  payload.requestedTags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-text-primary"
                    >
                      {tag}
                    </span>
                  ))
                )}
              </div>
              <span className="text-xs text-text-secondary">
                {new Date(turn.timestamp).toLocaleString()}
              </span>
            </div>

            {(payload.rankedCandidates ?? []).length === 0 ? (
              <div className="mt-3 rounded-cyber border border-accent-warning/20 bg-accent-warning/5 px-3 py-2 text-sm text-text-secondary">
                No ranked candidates were eligible for this routing attempt.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {payload.rankedCandidates?.map((candidate) => (
                  <div
                    key={candidate.agentId}
                    className="rounded-cyber border border-accent-primary/10 bg-bg-secondary/20 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold text-text-primary">{candidate.agentId}</div>
                      <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-2 py-0.5 text-[10px] text-accent-secondary">
                        score {candidate.score}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="rounded-full border border-accent-success/20 bg-accent-success/10 px-2 py-0.5 text-accent-success">
                        matched {(candidate.matchedTaskTags ?? []).length}
                      </span>
                      <span className="rounded-full border border-accent-warning/20 bg-accent-warning/10 px-2 py-0.5 text-accent-warning">
                        missing {(candidate.missingTaskTags ?? []).length}
                      </span>
                      <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-text-primary">
                        extra {(candidate.extraAgentTags ?? []).length}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Matched</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(candidate.matchedTaskTags ?? []).length === 0 ? (
                            <span className="text-xs text-text-secondary">none</span>
                          ) : (
                            candidate.matchedTaskTags?.map((tag) => (
                              <span key={tag} className="rounded-full border border-accent-success/20 bg-accent-success/10 px-2 py-0.5 text-[10px] text-accent-success">
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Missing</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(candidate.missingTaskTags ?? []).length === 0 ? (
                            <span className="text-xs text-text-secondary">none</span>
                          ) : (
                            candidate.missingTaskTags?.map((tag) => (
                              <span key={tag} className="rounded-full border border-accent-warning/20 bg-accent-warning/10 px-2 py-0.5 text-[10px] text-accent-warning">
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Extra</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(candidate.extraAgentTags ?? []).length === 0 ? (
                            <span className="text-xs text-text-secondary">none</span>
                          ) : (
                            candidate.extraAgentTags?.map((tag) => (
                              <span key={tag} className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5 text-[10px] text-text-primary">
                                {tag}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
