import ArrayField from './ArrayField';
import type { FieldDef, ReferenceValue } from '../../types/domain';
import type { SchemaDeps } from '../hooks/useSchemaDeps';

export interface FieldProps {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  deps: SchemaDeps;
}

// Recursive field renderer, one component covering every field type rather
// than one component per type - matches the schema's own shape (a flat
// `type` switch) and avoids fragmenting ~5 cases across ~5 files.
export default function Field({ field, value, onChange, deps }: FieldProps) {
  const label = field.label || field.name;

  switch (field.type) {
    case 'string':
      return (
        <div className="field">
          <label>{label}</label>
          <input type="text" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case 'number':
      return (
        <div className="field">
          <label>{label}</label>
          <input type="number" value={(value as number) ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
        </div>
      );

    case 'boolean':
      return (
        <div className="field">
          <label>{label}</label>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        </div>
      );

    case 'enum':
      return (
        <div className="field">
          <label>{label}</label>
          <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case 'reference': {
      const options = (field.schema && deps.options[field.schema]) || [];
      const currentId = (value as ReferenceValue | null)?.$id ?? '';
      return (
        <div className="field">
          <label>{label}</label>
          <select
            value={currentId}
            onChange={(e) => {
              const id = e.target.value;
              onChange(id ? ({ $niceSchema: field.schema, $id: id } as ReferenceValue) : null);
            }}
          >
            <option value="">-- none --</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    case 'object': {
      const targetSchema = field.schema ? deps.schemas[field.schema] : undefined;
      const objValue = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
      return (
        <div className="field">
          <label>{label}</label>
          <div className="nested">
            {!targetSchema ? (
              `Unknown schema "${field.schema}"`
            ) : (
              targetSchema.fields.map((subField) => (
                <Field
                  key={subField.name}
                  field={subField}
                  value={objValue[subField.name]}
                  // New object each time, never mutate objValue in place -
                  // React's re-render model assumes state updates produce
                  // new references.
                  onChange={(v) => onChange({ ...objValue, [subField.name]: v })}
                  deps={deps}
                />
              ))
            )}
          </div>
        </div>
      );
    }

    case 'array':
      return (
        <div className="field">
          <label>{label}</label>
          <ArrayField field={field} list={Array.isArray(value) ? value : []} onChange={onChange} deps={deps} />
        </div>
      );

    default:
      return (
        <div className="field">
          <label>{label}</label>
          <span>Unsupported field type: {field.type}</span>
        </div>
      );
  }
}
