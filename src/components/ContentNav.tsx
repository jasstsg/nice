import { useEffect, useState } from 'react';
import { api } from '../api';
import Tree from './Tree';
import type { ContentTreeRoot, ContentTreeFileNode, TreeItem, TreeOpts } from '../../types/domain';

export interface ContentNavProps {
  treeVersion: number;
  onOpenContent: (schema: string, id: string) => void;
  onNewContent: () => void;
  onStatus: (message: string, isError?: boolean) => void;
}

export default function ContentNav({ treeVersion, onOpenContent, onNewContent, onStatus }: ContentNavProps) {
  const [roots, setRoots] = useState<ContentTreeRoot[]>([]);

  useEffect(() => {
    let cancelled = false;
    api<ContentTreeRoot[]>('/api/tree')
      .then((data) => {
        if (!cancelled) setRoots(data);
      })
      .catch((err) => onStatus(err.message, true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeVersion]);

  const opts: TreeOpts<ContentTreeFileNode> = {
    showEmpty: true,
    // no schema means no form to build - can't be opened
    disableWhenInvalid: true,
    isValid: (node) => node.known,
    // A tree should read like a file browser - just the filename, minus the
    // extension. Unrecognized files are still visually distinguished via
    // the "tree-file-unknown" styling (Tree.tsx), no extra text needed.
    formatLabel: (node) => node.name.replace(/\.json$/, ''),
    onOpen: (node) => onOpenContent(node.schema as string, node.id as string)
  };

  return (
    <div id="content-nav">
      <button className="nav-btn" onClick={onNewContent}>+ New</button>
      <div className="sidebar-tree">
        {roots.map((r) => {
          const rootNode: TreeItem<ContentTreeFileNode> = {
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
