import FieldTypeEditor from './FieldTypeEditor';
import type { FieldDef } from '../../types/domain';

export interface SchemaFieldRowProps {
  field: FieldDef;
  onChange: (field: FieldDef) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  schemaNames: string[];
}

// One top-level entry in a schema's `fields` array: name/label (shown once,
// here) wrapping a FieldTypeEditor (which handles the type dropdown and
// everything that type needs, recursively for `array`).
export default function SchemaFieldRow({ field, onChange, onRemove, onMoveUp, onMoveDown, schemaNames }: SchemaFieldRowProps) {
  return (
    <div className="array-box">
      <div className="field">
        <label>Field name</label>
        <input type="text" value={field.name} onChange={(e) => onChange({ ...field, name: e.target.value })} />
      </div>

      <div className="field">
        <label>Display label (optional)</label>
        <input type="text" value={field.label || ''} onChange={(e) => onChange({ ...field, label: e.target.value })} />
      </div>

      <FieldTypeEditor field={field} onChange={onChange} schemaNames={schemaNames} />

      <button type="button" className="ghost" onClick={onMoveUp}>↑</button>
      <button type="button" className="ghost" onClick={onMoveDown}>↓</button>
      <button type="button" className="danger" onClick={onRemove}>Remove field</button>
    </div>
  );
}
