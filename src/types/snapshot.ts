export interface TaskSummary {
  incompleteCount: number;
  overdueCount: number;
  recentlyCompletedCount: number;
  estimatesByStatus: StatusCount[];
  projectsByStatus: StatusCount[];
  topIncompleteTasks: TaskItem[];
  recentlyCompletedTasks: TaskItem[];
}

export interface StatusCount {
  status: string;
  count: number;
  color?: string;
}

export interface TaskItem {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  isOverdue: boolean;
  assignees: string[];
  listName: string;
}
