import { notFound } from "next/navigation";
import { getBoardFull, getCurrentProfile } from "@/lib/data";
import BoardWorkspace from "@/components/board/BoardWorkspace";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const [{ board, groups, items, profiles }, currentProfile] = await Promise.all([
    getBoardFull(boardId),
    getCurrentProfile(),
  ]);

  if (!board) notFound();

  return (
    <BoardWorkspace
      board={board}
      workspaceName={(board as unknown as { workspaces?: { name: string } }).workspaces?.name}
      initialGroups={groups}
      initialItems={items}
      profiles={profiles}
      currentUserId={currentProfile?.id ?? null}
    />
  );
}
