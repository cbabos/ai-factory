export interface ConversationTurn {
  role: 'system' | 'user' | 'model' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface TaskDetails {
  id: string;
  taskId: string;
  conversation: ConversationTurn[];
}

export default TaskDetails;
