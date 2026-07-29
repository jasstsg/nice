export type ActiveTab = 'content' | 'schema';

export interface TabsProps {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}

export default function Tabs({ activeTab, onChange }: TabsProps) {
  return (
    <div className="tabs">
      <button className={`tab-btn${activeTab === 'content' ? ' active' : ''}`} onClick={() => onChange('content')}>
        Content editor
      </button>
      <button className={`tab-btn${activeTab === 'schema' ? ' active' : ''}`} onClick={() => onChange('schema')}>
        Schema editor
      </button>
    </div>
  );
}
