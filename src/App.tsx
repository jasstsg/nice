import { useState } from 'react';
import Sidebar from './components/Sidebar';
import ContentEditForm from './components/ContentEditForm';
import SchemaEditForm from './components/SchemaEditForm';
import SchemaPicker from './components/SchemaPicker';
import StatusToast, { type StatusMessage } from './components/StatusToast';
import type { ActiveTab } from './components/Tabs';

type MainView =
  | { type: 'placeholder' }
  | { type: 'content-picker' }
  | { type: 'content-edit'; schema: string; id: string | null }
  | { type: 'schema-edit'; path: string | null };

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('content');
  const [mainView, setMainView] = useState<MainView>({ type: 'placeholder' });
  const [treeVersion, setTreeVersion] = useState(0);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  function showStatus(message: string, isError = false) {
    setStatus({ message, isError, id: Date.now() });
  }

  return (
    <div className="app">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        treeVersion={treeVersion}
        onOpenContent={(schema, id) => setMainView({ type: 'content-edit', schema, id })}
        onNewContent={() => setMainView({ type: 'content-picker' })}
        onOpenSchema={(path) => setMainView({ type: 'schema-edit', path })}
        onNewSchema={() => setMainView({ type: 'schema-edit', path: null })}
        onStatus={showStatus}
      />
      <main className="main">
        <div className="panel">
          {mainView.type === 'placeholder' && (
            <p className="placeholder">Select an item in the sidebar to edit it.</p>
          )}

          {mainView.type === 'content-picker' && (
            <SchemaPicker
              onPick={(schema) => setMainView({ type: 'content-edit', schema, id: null })}
              onCancel={() => setMainView({ type: 'placeholder' })}
              onStatus={showStatus}
            />
          )}

          {mainView.type === 'content-edit' && (
            <ContentEditForm
              key={`${mainView.schema}:${mainView.id || 'new'}`}
              schemaName={mainView.schema}
              id={mainView.id}
              onSaved={(schema, id) => {
                setTreeVersion((v) => v + 1);
                setMainView({ type: 'content-edit', schema, id });
              }}
              onDeleted={() => {
                setTreeVersion((v) => v + 1);
                setMainView({ type: 'placeholder' });
              }}
              onClose={() => setMainView({ type: 'placeholder' })}
              onStatus={showStatus}
            />
          )}

          {mainView.type === 'schema-edit' && (
            <SchemaEditForm
              key={mainView.path || 'new'}
              path={mainView.path}
              onSaved={(path) => {
                setTreeVersion((v) => v + 1);
                setMainView({ type: 'schema-edit', path });
              }}
              onDeleted={() => {
                setTreeVersion((v) => v + 1);
                setMainView({ type: 'placeholder' });
              }}
              onClose={() => setMainView({ type: 'placeholder' })}
              onStatus={showStatus}
            />
          )}
        </div>
      </main>
      <StatusToast status={status} />
    </div>
  );
}
