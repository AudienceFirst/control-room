"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/slug";

export async function createClient(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string || generateSlug(name);
  const logoUrl = (formData.get("logoUrl") as string) || null;
  const clientLead = (formData.get("clientLead") as string) || null;

  if (!name?.trim()) {
    throw new Error("Client name is required");
  }

  const finalSlug = slug?.trim() || generateSlug(name);

  const existing = await prisma.client.findUnique({
    where: { slug: finalSlug },
  });

  if (existing) {
    throw new Error(`Client with slug "${finalSlug}" already exists`);
  }

  await prisma.client.create({
    data: {
      name: name.trim(),
      slug: finalSlug,
      logoUrl,
      clientLead: clientLead || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/settings/clients");
  revalidatePath("/");
}

export async function updateClient(clientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string | null;
  const slug = formData.get("slug") as string | null;
  const logoUrl = formData.get("logoUrl") as string | null;
  const clientLead = formData.get("clientLead") as string | null;
  const isActive = formData.get("isActive") === "true"; // unchecked = not in formData

  const data: Record<string, unknown> = { isActive };
  if (name != null) data.name = name.trim();
  if (slug != null) data.slug = slug.trim();
  if (logoUrl != null) data.logoUrl = logoUrl || null;
  if (clientLead != null) data.clientLead = clientLead || null;

  await prisma.client.update({
    where: { id: clientId },
    data,
  });

  revalidatePath("/settings/clients");
  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/");
}

export async function deleteClient(clientId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await prisma.client.delete({
    where: { id: clientId },
  });

  revalidatePath("/settings/clients");
  revalidatePath("/control-room");
  revalidatePath("/");
}
