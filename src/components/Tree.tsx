import type { TreeItem, TreeOpts } from '../../types/domain';

interface TreeProps<TFile> {
  node: TreeItem<TFile>;
  expanded: boolean;
  opts: TreeOpts<TFile>;
}

// Generic recursive dir/file tree, shared by the content tree and the
// schema tree - they only differ in what counts as "openable" and how a
// file's label reads, which `opts` supplies.
export default function Tree<TFile extends { type: 'file'; name: string; path: string }>({
  node,
  expanded,
  opts
}: TreeProps<TFile>) {
  if (node.type === 'dir') {
    const children = node.children;
    return (
      <details open={expanded}>
        <summary>{node.name}</summary>
        <div className="tree-children">
          {children.map((child) => (
            <Tree key={child.path} node={child} expanded={false} opts={opts} />
          ))}
          {opts.showEmpty && children.length === 0 && <div className="tree-empty">(empty)</div>}
        </div>
      </details>
    );
  }

  const valid = opts.isValid(node);
  const clickable = valid || !opts.disableWhenInvalid;

  return (
    <div className="tree-file">
      <a
        href="#"
        className={valid ? undefined : 'tree-file-unknown'}
        onClick={(e) => {
          e.preventDefault();
          if (clickable) opts.onOpen(node);
        }}
      >
        {opts.formatLabel(node)}
      </a>
    </div>
  );
}
