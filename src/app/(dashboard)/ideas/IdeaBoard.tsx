"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createIdea, deleteIdea, toggleUpvote } from "@/app/actions/ideas";

type Upvoter = { id: string; name: string | null; image: string | null };

type IdeaWithUpvotes = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null };
  upvotes: { userId: string; user: Upvoter }[];
};

interface IdeaBoardProps {
  ideas: IdeaWithUpvotes[];
  currentUserId: string;
}

const STICKY_COLORS = [
  "bg-yellow-200 border-yellow-300",
  "bg-sky-200 border-sky-300",
  "bg-green-200 border-green-300",
  "bg-pink-200 border-pink-300",
  "bg-purple-200 border-purple-300",
  "bg-orange-200 border-orange-300",
];

function colorForIdea(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return STICKY_COLORS[Math.abs(hash) % STICKY_COLORS.length];
}

function Avatar({ user }: { user: { name: string | null; image: string | null } }) {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt={user.name ?? ""}
        className="h-5 w-5 rounded-full ring-1 ring-white/60 object-cover"
      />
    );
  }
  const initials = (user.name ?? "?").charAt(0).toUpperCase();
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-semibold text-white ring-1 ring-white/60">
      {initials}
    </span>
  );
}

function UpvoterTooltip({ upvoters }: { upvoters: Upvoter[] }) {
  if (upvoters.length === 0) return null;
  return (
    <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 z-20 pointer-events-none">
      <div className="rounded-lg bg-zinc-900 px-3 py-2 shadow-xl ring-1 ring-white/10 text-xs text-white whitespace-nowrap">
        <div className="font-semibold mb-1.5 text-zinc-300">Upvotes</div>
        <div className="flex flex-col gap-1">
          {upvoters.map((u) => (
            <div key={u.id} className="flex items-center gap-2">
              <Avatar user={u} />
              <span>{u.name ?? "Onbekend"}</span>
            </div>
          ))}
        </div>
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  currentUserId,
}: {
  idea: IdeaWithUpvotes;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showVoters, setShowVoters] = useState(false);
  const [optimisticVoted, setOptimisticVoted] = useState(
    idea.upvotes.some((u) => u.userId === currentUserId)
  );
  const [optimisticCount, setOptimisticCount] = useState(idea.upvotes.length);

  const isOwn = idea.author.id === currentUserId;
  const color = colorForIdea(idea.id);
  const upvoters = idea.upvotes.map((u) => u.user);

  function handleUpvote() {
    if (isPending) return;
    const willVote = !optimisticVoted;
    setOptimisticVoted(willVote);
    setOptimisticCount((c) => (willVote ? c + 1 : c - 1));
    startTransition(async () => {
      const res = await toggleUpvote(idea.id);
      if (!res.success) {
        setOptimisticVoted(!willVote);
        setOptimisticCount((c) => (willVote ? c - 1 : c + 1));
      }
    });
  }

  function handleDelete() {
    if (isPending) return;
    startTransition(async () => { await deleteIdea(idea.id); });
  }

  const dateStr = new Date(idea.createdAt).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-sm border p-4 shadow-md transition-shadow hover:shadow-lg ${color}`}
      style={{ minHeight: 160 }}
    >
      {/* Delete button (own ideas only) */}
      {isOwn && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="absolute right-2 top-2 rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-800 group-hover:opacity-100 disabled:opacity-30"
          aria-label="Verwijder idee"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Content */}
      <p className="flex-1 text-sm leading-relaxed text-zinc-800 break-words pr-4">{idea.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {/* Author + date */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar user={idea.author} />
          <span className="truncate text-xs text-zinc-600">{idea.author.name ?? "Onbekend"}</span>
          <span className="text-xs text-zinc-400">· {dateStr}</span>
        </div>

        {/* Upvote button */}
        <div className="relative flex items-center gap-1 shrink-0">
          {optimisticCount > 0 && (
            <button
              type="button"
              onMouseEnter={() => setShowVoters(true)}
              onMouseLeave={() => setShowVoters(false)}
              onClick={() => setShowVoters((v) => !v)}
              className="flex -space-x-1.5 focus:outline-none"
              aria-label="Wie heeft geupvote"
            >
              {upvoters.slice(0, 4).map((u) => (
                <Avatar key={u.id} user={u} />
              ))}
              {upvoters.length > 4 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-600 px-1 text-[10px] font-semibold text-white ring-1 ring-white/60">
                  +{upvoters.length - 4}
                </span>
              )}
            </button>
          )}
          {showVoters && <UpvoterTooltip upvoters={upvoters} />}
          <button
            type="button"
            onClick={handleUpvote}
            disabled={isPending}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
              optimisticVoted
                ? "bg-zinc-800 text-white"
                : "bg-white/60 text-zinc-700 hover:bg-white"
            }`}
            aria-label={optimisticVoted ? "Upvote intrekken" : "Upvote"}
          >
            <svg className="h-3 w-3" fill={optimisticVoted ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {optimisticCount > 0 && <span>{optimisticCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewIdeaCard({ onSubmit }: { onSubmit: (content: string) => void }) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createIdea(text);
      if (res.success) {
        setText("");
        onSubmit(text);
      } else {
        setError(res.error ?? "Er ging iets mis");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-dashed border-zinc-600 bg-zinc-800/40 p-4 shadow-inner" style={{ minHeight: 160 }}>
      <form onSubmit={handleSubmit} className="flex flex-col h-full gap-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder="Schrijf een idee..."
          rows={4}
          disabled={isPending}
          className="flex-1 resize-none rounded bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${text.length > 450 ? "text-amber-400" : "text-zinc-500"}`}>
            {text.length}/500
          </span>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              type="submit"
              disabled={isPending || !text.trim()}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40"
            >
              {isPending ? "Opslaan…" : "Toevoegen"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function IdeaBoard({ ideas: initialIdeas, currentUserId }: IdeaBoardProps) {
  const [ideas] = useState(initialIdeas);

  const sorted = [...ideas].sort((a, b) => b.upvotes.length - a.upvotes.length || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* New idea card always first */}
      <NewIdeaCard onSubmit={() => {}} />
      {sorted.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} currentUserId={currentUserId} />
      ))}
    </div>
  );
}
