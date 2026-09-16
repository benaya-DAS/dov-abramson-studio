import { redirect } from "next/navigation";
import { getWorkspacesWithBoards } from "@/lib/data";

export default async function HomePage() {
  const workspaces = await getWorkspacesWithBoards();
  const firstBoard = workspaces.flatMap((w) => w.boards)[0];

  if (firstBoard) {
    redirect(`/board/${firstBoard.id}`);
  }

  redirect("/onboarding");
}
