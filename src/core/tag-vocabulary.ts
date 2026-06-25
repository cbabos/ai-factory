export interface DefaultCapabilityTagDefinition {
  id: string;
  label: string;
  description: string;
}

export const DEFAULT_CAPABILITY_TAGS: DefaultCapabilityTagDefinition[] = [
  { id: "search", label: "Search", description: "Finding information across the web, tools, or indexed data sources." },
  { id: "codebase", label: "Codebase", description: "Understanding existing project structure, code, and repository context." },
  { id: "read-only", label: "Read Only", description: "Inspection-only work that should avoid modifying files or state." },
  { id: "analysis", label: "Analysis", description: "Reasoning over requirements, systems, risks, or evidence." },
  { id: "reasoning", label: "Reasoning", description: "Multi-step logical inference, tradeoff evaluation, and diagnosis." },
  { id: "summarization", label: "Summarization", description: "Condensing large inputs into concise takeaways or executive summaries." },
  { id: "synthesis", label: "Synthesis", description: "Combining multiple inputs into a coherent unified output." },
  { id: "execution", label: "Execution", description: "Running concrete implementation steps, commands, or operational actions." },
  { id: "code-generation", label: "Code Generation", description: "Writing code, scripts, or configuration artifacts." },
  { id: "write", label: "Write", description: "Producing persisted output such as files, documents, or structured results." },
  { id: "file-io", label: "File I/O", description: "Reading from or writing to the filesystem as part of task execution." },
];

export function getDefaultCapabilityTagIds(): string[] {
  return DEFAULT_CAPABILITY_TAGS.map((tag) => tag.id);
}
