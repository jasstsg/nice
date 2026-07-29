import { useRef } from 'react';
import Field from './Field';
import { defaultValueForField } from '../fieldDefaults';
import type { FieldDef, ReferenceValue } from '../../types/domain';
import type { SchemaDeps } from '../hooks/useSchemaDeps';

export interface ArrayFieldProps {
  field: FieldDef;
  list: unknown[];
  onChange: (value: unknown[]) => void;
  deps: SchemaDeps;
}

// All mutators build a NEW array and hand it to onChange - never splice/swap
// in place - so state updates flow up through the parent form's lifted
// state as genuinely new references every time.
export default function ArrayField({ field, list, onChange, deps }: ArrayFieldProps) {
  const items = field.items as FieldDef;
  const isReference = items.type === 'reference';
  const options = isReference ? (items.schema && deps.options[items.schema]) || [] : [];
  const selectRef = useRef<HTMLSelectElement>(null);

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = list.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }
  function moveDown(idx: number) {
    if (idx === list.length - 1) return;
    const next = list.slice();
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    onChange(next);
  }
  function remove(idx: number) {
    onChange([...list.slice(0, idx), ...list.slice(idx + 1)]);
  }
  function updateAt(idx: number, v: unknown) {
    onChange(list.map((item, i) => (i === idx ? v : item)));
  }
  function addReference() {
    const id = selectRef.current?.value;
    if (!id) return;
    const alreadyAdded = list.some((v) => (v as ReferenceValue)?.$id === id);
    if (!alreadyAdded) onChange([...list, { $niceSchema: items.schema, $id: id } as ReferenceValue]);
  }

  return (
    <div className="array-box">
      <div>
        {list.map((itemValue, idx) => (
          <div className="array-row" key={idx}>
            {isReference ? (
              <span>{options.find((o) => o.id === (itemValue as ReferenceValue)?.$id)?.label ?? (itemValue as ReferenceValue)?.$id}</span>
            ) : (
              <Field
                field={{ ...items, name: field.name, label: `#${idx + 1}` }}
                value={itemValue}
                onChange={(v) => updateAt(idx, v)}
                deps={deps}
              />
            )}
            <button type="button" className="ghost" onClick={() => moveUp(idx)}>↑</button>
            <button type="button" className="ghost" onClick={() => moveDown(idx)}>↓</button>
            <button type="button" className="danger" onClick={() => remove(idx)}>Remove</button>
          </div>
        ))}
      </div>

      {isReference ? (
        <>
          <select ref={selectRef}>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <button type="button" onClick={addReference}>Add</button>
        </>
      ) : (
        <button type="button" onClick={() => onChange([...list, defaultValueForField(items)])}>+ Add</button>
      )}
    </div>
  );
}
