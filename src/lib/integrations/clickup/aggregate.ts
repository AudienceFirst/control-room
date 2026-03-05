import type { ClickUpConfig } from "@prisma/client";
import type { TaskSummary, TaskItem, StatusCount } from "@/types/snapshot";
import {
  getClientFolderContents,
  getIncompleteTasks,
  getRecentlyCompletedTasks,
} from "./client";

function safeDueDate(due: number | string | null | undefined): { iso: string | null; isOverdue: boolean } {
  if (due == null) return { iso: null, isOverdue: false };
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return { iso: null, isOverdue: false };
  try {
    return {
      iso: d.toISOString(),
      isOverdue: d < new Date(),
    };
  } catch {
    return { iso: null, isOverdue: false };
  }
}

function mapTask(t: { id: string; name?: string; title?: string; status?: { status: string }; due_date?: number; assignees?: { username: string }[] }, listName: string): TaskItem {
  const { iso: dueDate, isOverdue } = safeDueDate(t.due_date);
  return {
    id: t.id,
    name: (t.name ?? t.title ?? "Unnamed").trim(),
    status: t.status?.status ?? "Unknown",
    dueDate,
    isOverdue,
    assignees: t.assignees?.map((a: { username: string }) => a.username) ?? [],
    listName,
  };
}

function groupByStatus(tasks: unknown[]): StatusCount[] {
  const counts: Record<string, { count: number; color: string }> = {};
  for (const task of tasks as { status?: { status?: string; color?: string } }[]) {
    const status = task.status?.status ?? "Unknown";
    const color = task.status?.color ?? "#999";
    if (!counts[status]) counts[status] = { count: 0, color };
    counts[status].count++;
  }
  return Object.entries(counts)
    .map(([status, { count, color }]) => ({ status, count, color }))
    .sort((a, b) => b.count - a.count);
}

export async function buildTaskSummary(config: ClickUpConfig): Promise<TaskSummary> {
  const showCompletedDays = config.showCompletedDays ?? 7;

  // Fetch all lists in the client folder (operational + overview)
  const { allLists } =
    await getClientFolderContents(config.clientFolderId);

  const lists = (allLists ?? []) as { id: string; name: string }[];
  if (lists.length === 0) {
    return {
      incompleteCount: 0,
      overdueCount: 0,
      recentlyCompletedCount: 0,
      estimatesByStatus: [],
      projectsByStatus: [],
      topIncompleteTasks: [],
      recentlyCompletedTasks: [],
    };
  }

  // Exclude overview lists (names starting with *) — only count/show operational lists
  const isOverviewList = (name: string) => name.trimStart().startsWith("*");
  const operationalLists = lists.filter((l) => !isOverviewList(l.name));

  // Fetch incomplete and recently completed tasks from operational lists only
  const listPromises = operationalLists.flatMap((list) => [
    getIncompleteTasks(list.id).catch(() => [] as unknown[]),
    getRecentlyCompletedTasks(list.id, showCompletedDays).catch(() => [] as unknown[]),
  ]);

  const results = await Promise.all(listPromises);
  const rawIncompleteByList: unknown[][] = [];
  const recentByList: unknown[][] = [];
  for (let i = 0; i < results.length; i += 2) {
    rawIncompleteByList.push((results[i] ?? []) as unknown[]);
    recentByList.push((results[i + 1] ?? []) as unknown[]);
  }

  const allIncomplete: TaskItem[] = operationalLists.flatMap((list, idx) =>
    (rawIncompleteByList[idx] ?? []).map((t: unknown) =>
      mapTask(t as Parameters<typeof mapTask>[0], list.name)
    )
  );
  const overdue = allIncomplete.filter((t) => t.isOverdue);
  const notOverdue = allIncomplete.filter((t) => !t.isOverdue);
  // All incomplete tasks: overdue first, then rest (no limit)
  const topIncomplete: TaskItem[] = [...overdue, ...notOverdue];

  // Overview lists (*) excluded — no estimates/projects counts in main display
  const estimatesRaw: unknown[] = [];
  const projectsRaw: unknown[] = [];

  const recentlyCompletedCount = recentByList.reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  const recentlyCompletedTasks: TaskItem[] = operationalLists.flatMap((list, idx) =>
    (recentByList[idx] ?? []).map((t: unknown) =>
      mapTask(t as Parameters<typeof mapTask>[0], list.name)
    )
  );

  return {
    incompleteCount: allIncomplete.length,
    overdueCount: overdue.length,
    recentlyCompletedCount,
    estimatesByStatus: groupByStatus(estimatesRaw),
    projectsByStatus: groupByStatus(projectsRaw),
    topIncompleteTasks: topIncomplete,
    recentlyCompletedTasks,
  };
}
