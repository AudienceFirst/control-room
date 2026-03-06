"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createIdea(content: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const trimmed = content.trim();
  if (!trimmed) return { success: false, error: "Inhoud mag niet leeg zijn" };
  if (trimmed.length > 500) return { success: false, error: "Maximaal 500 tekens" };

  try {
    await prisma.idea.create({
      data: { content: trimmed, authorId: session.user.id },
    });
    revalidatePath("/ideas");
    return { success: true };
  } catch (err) {
    console.error("[Ideas] createIdea failed:", err);
    return { success: false, error: "Idee kon niet worden opgeslagen" };
  }
}

export async function deleteIdea(ideaId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
    if (!idea) return { success: false, error: "Idee niet gevonden" };
    if (idea.authorId !== session.user.id) return { success: false, error: "Alleen de auteur kan dit verwijderen" };

    await prisma.idea.delete({ where: { id: ideaId } });
    revalidatePath("/ideas");
    return { success: true };
  } catch (err) {
    console.error("[Ideas] deleteIdea failed:", err);
    return { success: false, error: "Idee kon niet worden verwijderd" };
  }
}

export async function toggleUpvote(ideaId: string): Promise<{ success: boolean; voted?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const userId = session.user.id;

  try {
    const existing = await prisma.ideaUpvote.findUnique({
      where: { ideaId_userId: { ideaId, userId } },
    });

    if (existing) {
      await prisma.ideaUpvote.delete({ where: { ideaId_userId: { ideaId, userId } } });
      revalidatePath("/ideas");
      return { success: true, voted: false };
    } else {
      await prisma.ideaUpvote.create({ data: { ideaId, userId } });
      revalidatePath("/ideas");
      return { success: true, voted: true };
    }
  } catch (err) {
    console.error("[Ideas] toggleUpvote failed:", err);
    return { success: false, error: "Upvote kon niet worden verwerkt" };
  }
}
