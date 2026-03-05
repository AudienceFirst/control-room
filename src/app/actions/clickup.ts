"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { discoverClientFolderStructure } from "@/lib/integrations/clickup/discovery";

export async function saveClickUpConfig(
  clientId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const clientFolderId = (formData.get("clientFolderId") as string)?.trim();
  const showCompletedDays = parseInt(
    (formData.get("showCompletedDays") as string) || "7",
    10
  );

  if (!clientFolderId) throw new Error("Client folder ID is required");

  const discovery = await discoverClientFolderStructure(clientFolderId);

  await prisma.clickUpConfig.upsert({
    where: { clientId },
    update: {
      clientFolderId,
      estimatesFolderId: discovery.estimatesList?.id ?? null,
      projectsFolderId: discovery.projectsList?.id ?? null,
      contactsFolderId: discovery.contactsList?.id ?? null,
      showCompletedDays,
      updatedAt: new Date(),
    },
    create: {
      clientId,
      clientFolderId,
      estimatesFolderId: discovery.estimatesList?.id ?? null,
      projectsFolderId: discovery.projectsList?.id ?? null,
      contactsFolderId: discovery.contactsList?.id ?? null,
      showCompletedDays,
    },
  });

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
  return {
    success: true,
    discovery: {
      estimatesList: discovery.estimatesList
        ? { id: discovery.estimatesList.id, name: discovery.estimatesList.name }
        : null,
      projectsList: discovery.projectsList
        ? { id: discovery.projectsList.id, name: discovery.projectsList.name }
        : null,
    },
  };
}

export async function discoverClickUpFolder(clientFolderId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const discovery = await discoverClientFolderStructure(clientFolderId);
  return {
    estimatesList: discovery.estimatesList
      ? { id: discovery.estimatesList.id, name: discovery.estimatesList.name }
      : null,
    projectsList: discovery.projectsList
      ? { id: discovery.projectsList.id, name: discovery.projectsList.name }
      : null,
    allLists: (discovery.allLists ?? []).map((l: { id: string; name: string }) => ({
      id: l.id,
      name: l.name,
    })),
  };
}
