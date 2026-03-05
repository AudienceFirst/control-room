const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN!;
const FETCH_TIMEOUT_MS = 8000;

async function clickupFetch(path: string) {
  if (!CLICKUP_TOKEN) {
    throw new Error("CLICKUP_API_TOKEN is not configured");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${CLICKUP_BASE}${path}`, {
      headers: { Authorization: CLICKUP_TOKEN },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ClickUp API error: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getClientFolderContents(clientFolderId: string) {
  // Try folder first (lists inside a folder), then space (folderless lists)
  let lists: { id: string; name: string }[] | undefined;
  try {
    const folderRes = await clickupFetch(`/folder/${clientFolderId}/list`);
    lists = folderRes?.lists;
  } catch {
    try {
      const spaceRes = await clickupFetch(`/space/${clientFolderId}/list`);
      lists = spaceRes?.lists;
    } catch {
      throw new Error(
        "Invalid folder/space ID — use a Folder ID or Space ID from ClickUp. Check the URL when viewing the client's folder or space."
      );
    }
  }
  const estimatesList = lists?.find((l: { name: string }) =>
    l.name.toLowerCase().includes("estimate")
  );
  const projectsList = lists?.find((l: { name: string }) =>
    l.name.toLowerCase().includes("project")
  );
  return { estimatesList, projectsList, allLists: lists ?? [] };
}

const TASKS_PAGE_SIZE = 100;

export async function getIncompleteTasks(listId: string) {
  const all: unknown[] = [];
  for (let page = 0; ; page++) {
    const { tasks } = await clickupFetch(
      `/list/${listId}/task?include_closed=false&archived=false&page=${page}`
    );
    const batch = tasks ?? [];
    all.push(...batch);
    if (batch.length < TASKS_PAGE_SIZE) break;
  }
  return all;
}

export async function getRecentlyCompletedTasks(
  listId: string,
  days: number = 7
) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const all: unknown[] = [];
  for (let page = 0; ; page++) {
    const { tasks } = await clickupFetch(
      `/list/${listId}/task?statuses[]=complete&date_updated_gt=${since}&archived=false&page=${page}`
    );
    const batch = tasks ?? [];
    all.push(...batch);
    if (batch.length < TASKS_PAGE_SIZE) break;
  }
  return all;
}

export async function getTaskCountsByStatus(listId: string) {
  const { tasks } = await clickupFetch(
    `/list/${listId}/task?include_closed=true&archived=false`
  );
  const counts: Record<string, { count: number; color: string }> = {};
  for (const task of tasks ?? []) {
    const status = task.status?.status ?? "Unknown";
    const color = task.status?.color ?? "#999";
    if (!counts[status]) counts[status] = { count: 0, color };
    counts[status].count++;
  }
  return Object.entries(counts).map(([status, { count, color }]) => ({
    status,
    count,
    color,
  }));
}
