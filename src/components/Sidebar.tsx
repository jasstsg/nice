import Tabs, { type ActiveTab } from './Tabs';
import ContentNav from './ContentNav';
import SchemaNav from './SchemaNav';

export interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  treeVersion: number;
  onOpenContent: (schema: string, id: string) => void;
  onNewContent: () => void;
  onOpenSchema: (path: string) => void;
  onNewSchema: () => void;
  onStatus: (message: string, isError?: boolean) => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  treeVersion,
  onOpenContent,
  onNewContent,
  onOpenSchema,
  onNewSchema,
  onStatus
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <h1>nice</h1>
      <p className="hint">Node Integrated Content Editor.</p>

      <Tabs activeTab={activeTab} onChange={onTabChange} />
      <div className="sidebar-divider" />

      {activeTab === 'content' ? (
        <ContentNav
          treeVersion={treeVersion}
          onOpenContent={onOpenContent}
          onNewContent={onNewContent}
          onStatus={onStatus}
        />
      ) : (
        <SchemaNav
          treeVersion={treeVersion}
          onOpenSchema={onOpenSchema}
          onNewSchema={onNewSchema}
          onStatus={onStatus}
        />
      )}
    </aside>
  );
}
