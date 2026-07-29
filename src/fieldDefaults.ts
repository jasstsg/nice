import type { FieldDef } from '../types/domain';

export function defaultValueForField(field: FieldDef): unknown {
  switch (field.type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'enum': return (field.options || [])[0] || '';
    case 'reference': return '';
    case 'object': return {};
    case 'array': return [];
    default: return null;
  }
}
