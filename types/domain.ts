// Pure type declarations shared by the tsc-compiled backend (lib/, bin/)
// and the Vite/esbuild-compiled frontend (src/) via `import type`, which is
// always fully erased at compile time - so this file has no bearing on
// either side's module/output settings and never needs to be "the same
// build" as either.

export type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'object' | 'array' | 'reference';

export interface FieldDef {
  name: string;
  type: FieldType;
  label?: string;
  options?: string[]; // enum
  schema?: string; // object | reference
  items?: FieldDef; // array - name/label here are overridden by the parent array field when rendering
}

export interface SchemaDef {
  name: string;
  label?: string;
  fields: FieldDef[];
}

export interface SchemaListItem {
  name: string;
  label: string;
}

export interface NiceConfig {
  cwd: string;
  port: number;
  schemaRoots: string[];
  contentRoots: string[];
  defaultContentRoot: string;
  // One or more folders scanned recursively for *.css files, concatenated
  // (sorted by path) and loaded after the built-in stylesheet so they win
  // the cascade - lets a project re-theme the UI (see the CSS variables at
  // the top of src/styles.css) across as many files as it wants, without
  // forking the built-in one.
  styleRoots: string[];
}

export interface ContentListItem {
  id: string;
  label: string;
}

// A `reference` field's stored value: self-describing so it can be
// resolved back into the full object later without needing to consult the
// schema that produced it - just walk the JSON looking for this shape.
export interface ReferenceValue {
  $niceSchema: string;
  $id: string;
}

export interface ContentRecord {
  id: string;
  path: string;
  data: Record<string, unknown>;
}

export interface SaveResult {
  id: string;
  path: string;
}

export interface TreeDirNode<TFile> {
  type: 'dir';
  name: string;
  path: string;
  children: TreeItem<TFile>[];
}

export type TreeItem<TFile> = TreeDirNode<TFile> | TFile;

export interface ContentTreeFileNode {
  type: 'file';
  name: string;
  path: string;
  known: boolean;
  schema: string | null;
  id: string | null;
  label: string;
}

export interface ContentTreeRoot {
  root: string;
  name: string;
  children: TreeItem<ContentTreeFileNode>[];
}

export interface SchemaTreeFileNode {
  type: 'file';
  name: string;
  path: string; // relative to cwd (not to any specific schemaRoot), so it stays unambiguous across multiple configured schemaRoots
  schemaName: string | null;
  label: string;
  valid: boolean;
}

export interface SchemaTreeRoot {
  root: string;
  name: string;
  children: TreeItem<SchemaTreeFileNode>[];
}

// Generic tree-rendering contract shared by the content tree and the
// schema tree - they only differ in what counts as "openable" and how a
// file's label reads.
export interface TreeOpts<TFile> {
  showEmpty: boolean;
  disableWhenInvalid: boolean;
  isValid: (node: TFile) => boolean;
  formatLabel: (node: TFile) => string;
  onOpen: (node: TFile) => void;
}
