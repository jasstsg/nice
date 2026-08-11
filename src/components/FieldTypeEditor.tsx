import type { FieldDef, FieldType } from '../../types/domain';

export interface FieldTypeEditorProps {
  field: FieldDef;
  onChange: (field: FieldDef) => void;
  schemaNames: string[];
}

const FIELD_TYPES: FieldType[] = ['string', 'number', 'boolean', 'enum', 'object', 'array', 'reference'];

// Renders the type dropdown plus whatever extra config that type needs
// (enum options, an object/reference's target schema, an array's item
// type) - deliberately not the field's name/label, so this same component
// can recurse into an array field's `items`, which never carries its own
// name/label (the parent array field's do double duty when rendering).
export default function FieldTypeEditor({ field, onChange, schemaNames }: FieldTypeEditorProps) {
  function setType(type: FieldType) {
    // Switching type invalidates whatever config the old type needed, so
    // start clean rather than dragging stale options/schema/items along.
    const next: FieldDef = { name: field.name, label: field.label, type };
    if (type === 'enum') next.options = [''];
    if (type === 'object' || type === 'reference') next.schema = schemaNames[0] || '';
    if (type === 'array') next.items = { name: field.name, type: 'string' };
    onChange(next);
  }

  return (
    <>
      <div className="field">
        <label>Type</label>
        <select value={field.type} onChange={(e) => setType(e.target.value as FieldType)}>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {field.type === 'enum' && (
        <div className="nested">
          <label>Options</label>
          <div className="array-box">
            {(field.options || []).map((opt, i) => (
              <div className="array-row" key={i}>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = (field.options || []).slice();
                    next[i] = e.target.value;
                    onChange({ ...field, options: next });
                  }}
                />
                <button
                  type="button"
                  className="danger"
                  onClick={() => onChange({ ...field, options: (field.options || []).filter((_, idx) => idx !== i) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ ...field, options: [...(field.options || []), ''] })}>
              + Add option
            </button>
          </div>
        </div>
      )}

      {(field.type === 'object' || field.type === 'reference') && (
        <div className="field">
          <label>{field.type === 'object' ? 'Embedded schema' : 'References schema'}</label>
          {schemaNames.length === 0 ? (
            <p className="placeholder">No other schemas exist yet - create one first.</p>
          ) : (
            <select value={field.schema || ''} onChange={(e) => onChange({ ...field, schema: e.target.value })}>
              <option value="">-- choose a schema --</option>
              {schemaNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {field.type === 'array' && (
        <div className="nested">
          <label>Item type</label>
          <FieldTypeEditor
            field={field.items || { name: field.name, type: 'string' }}
            onChange={(items) => onChange({ ...field, items })}
            schemaNames={schemaNames}
          />
        </div>
      )}
    </>
  );
}
