import { getClientFolderContents } from "./client";

export async function discoverClientFolderStructure(clientFolderId: string) {
  const { allLists, estimatesList, projectsList } =
    await getClientFolderContents(clientFolderId);

  const find = (keyword: string) =>
    allLists?.find((l: { name: string }) =>
      l.name.toLowerCase().includes(keyword)
    );

  return {
    estimatesList: find("estimate"),
    projectsList: find("project"),
    contactsList: find("client"),
    allLists: allLists ?? [],
    resolvedAt: new Date().toISOString(),
  };
}
