import Sidebar from "@/components/sidebar/Sidebar";
import { SidebarStateProvider } from "@/components/sidebar/SidebarStateContext";
import TopBar from "@/components/topbar/TopBar";
import { getWorkspacesWithBoards } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const workspaces = await getWorkspacesWithBoards();

  return (
    <SidebarStateProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-night-900">
        <Sidebar workspaces={workspaces} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarStateProvider>
  );
}
