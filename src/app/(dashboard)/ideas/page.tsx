import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { IdeaBoard } from "./IdeaBoard";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";

  const ideas = await prisma.idea.findMany({
    include: {
      author: { select: { id: true, name: true, image: true } },
      upvotes: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="px-4 py-6 sm:px-6 md:px-8 lg:px-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Ideeënbord</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Deel ideeën en stem op suggesties van collega's.
        </p>
      </div>
      <IdeaBoard ideas={ideas} currentUserId={currentUserId} />
    </div>
  );
}
