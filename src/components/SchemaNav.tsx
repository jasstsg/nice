import { useEffect, useState } from 'react';
import { api } from '../api';
import Tree from './Tree';
import type { SchemaTreeRoot, SchemaTreeFileNode, TreeItem, TreeOpts } from '../../types/domain';

export interface SchemaNavProps {
  treeVersion: number;
  onOpenSchema: (path: string) => void;
  onNewSchema: () => void;
  onStatus: (message: string, isError?: boolean) => void;
}

export default function SchemaNav({ treeVersion, onOpenSchema, onNewSchema, onStatus }: SchemaNavProps) {
  const [roots, setRoots] = useState<SchemaTreeRoot[]>([]);

  useEffect(() => {
    let cancelled = false;
    api<SchemaTreeRoot[]>('/api/schema-files')
      .then((data) => {
        if (!cancelled) setRoots(data);
      })
      .catch((err) => onStatus(err.message, true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeVersion]);

  const opts: TreeOpts<SchemaTreeFileNode> = {
    showEmpty: false,
    // stays clickable so a broken schema file can be opened and fixed
    disableWhenInvalid: false,
    isValid: (node) => node.valid,
    // Same as the content tree - just the filename, minus extension. Invalid
    // files are still visually distinguished via "tree-file-unknown" styling.
    formatLabel: (node) => node.name.replace(/\.nice-schema\.json$/, ''),
    onOpen: (node) => onOpenSchema(node.path)
  };

  const isEmpty = roots.every((r) => r.children.length === 0);

  return (
    <div id="schema-nav">
      <button className="nav-btn" onClick={onNewSchema}>＋ New schema</button>
      <div className="sidebar-tree">
        {isEmpty && <div className="tree-empty">(no schema files found)</div>}
        {roots.map((r) => {
          const rootNode: TreeItem<SchemaTreeFileNode> = {
            type: 'dir',
            name: r.name || r.root,
            path: r.root,
            children: r.children
          };
          return <Tree key={r.root} node={rootNode} expanded opts={opts} />;
        })}
      </div>
    </div>
  );
}
