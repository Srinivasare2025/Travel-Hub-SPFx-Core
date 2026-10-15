/* eslint-disable @rushstack/no-new-null -- SharePoint expects `null` to clear a field. */
import type { AdminRow } from '../../../../services/AdminService';
import type { IAdminField, IAdminList } from './adminSchema';

/** A form value: text/number inputs keep strings while typing; switches are booleans. */
export type FormValue = string | boolean;
export type FormValues = Record<string, FormValue>;

const URL_KINDS = new Set(['url', 'image']);

/** The `$select` for a list, limited to the fields the site actually has. */
export function selectFields(def: IAdminList, existing: Set<string>, extra: string[] = []): string[] {
  const names = ['Id', 'Title', ...def.fields.map((f) => f.name), ...extra];
  return names.filter((n, i) => names.indexOf(n) === i && (n === 'Id' || n.endsWith('IdId') || existing.has(n)));
}

/** Fields shown in the form: defined here AND provisioned on the site. */
export function visibleFields(def: IAdminList, existing: Set<string>): IAdminField[] {
  return def.fields.filter((f) => existing.has(f.name));
}

function pad(n: number): string {
  return n < 10 ? `0${String(n)}` : String(n);
}

/** Raw SharePoint value -> form value. */
export function toFormValue(field: IAdminField, raw: unknown): FormValue {
  if (field.kind === 'bool') {
    return raw === true;
  }
  if (raw === null || raw === undefined) {
    return '';
  }
  if (URL_KINDS.has(field.kind)) {
    return typeof raw === 'object' ? String((raw as { Url?: string }).Url ?? '') : String(raw);
  }
  if (field.kind === 'date' || field.kind === 'datetime') {
    const d = new Date(String(raw));
    if (isNaN(d.getTime())) {
      return '';
    }
    const date = `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return field.kind === 'date' ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return String(raw);
}

/** A new item's starting values. */
export function defaultFormValues(def: IAdminList, fields: IAdminField[]): FormValues {
  const values: FormValues = { Title: '' };
  fields.forEach((f) => {
    if (f.defaultValue !== undefined) {
      values[f.name] = typeof f.defaultValue === 'boolean' ? f.defaultValue : String(f.defaultValue);
    } else {
      values[f.name] = f.kind === 'bool' ? false : '';
    }
  });
  return values;
}

export function rowToFormValues(row: AdminRow, fields: IAdminField[]): FormValues {
  const values: FormValues = { Title: row.Title === null || row.Title === undefined ? '' : String(row.Title) };
  fields.forEach((f) => {
    values[f.name] = toFormValue(f, row[f.name]);
  });
  return values;
}

/** Form value -> the JSON SharePoint expects for that column type. */
export function toSpValue(field: IAdminField, value: FormValue | undefined): unknown {
  if (field.kind === 'bool') {
    return value === true;
  }
  const text = typeof value === 'string' ? value : '';
  const trimmed = text.trim();
  switch (field.kind) {
    case 'number':
      return trimmed.length === 0 ? null : Number(trimmed);
    case 'url':
    case 'image':
      return trimmed.length === 0 ? null : { Url: trimmed, Description: trimmed.slice(0, 255) };
    case 'date':
      // Noon UTC: the same calendar day in every site time zone.
      return trimmed.length === 0 ? null : `${trimmed}T12:00:00Z`;
    case 'datetime': {
      if (trimmed.length === 0) {
        return null;
      }
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    case 'choice':
    case 'choiceFillIn':
      return trimmed.length === 0 ? null : trimmed;
    case 'lines':
      // Normalise line endings and drop trailing blank lines.
      return text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    default:
      return text;
  }
}

export interface IValidationError {
  field: string;
  message: string;
}

const SAFE_URL_RE = /^(https?:\/\/|\/|mailto:|tel:)/i;

export function validate(def: IAdminList, fields: IAdminField[], values: FormValues): IValidationError[] {
  const errors: IValidationError[] = [];
  const title = String(values.Title ?? '').trim();
  if (def.titleRequired === true && title.length === 0) {
    errors.push({ field: 'Title', message: `${def.titleLabel} is required.` });
  }
  if (title.length > 255) {
    errors.push({ field: 'Title', message: 'Keep this under 255 characters.' });
  }
  fields.forEach((f) => {
    const v = values[f.name];
    const s = typeof v === 'string' ? v.trim() : '';
    if (f.required === true && f.kind !== 'bool' && s.length === 0) {
      errors.push({ field: f.name, message: `${f.label} is required.` });
      return;
    }
    if (s.length === 0) {
      return;
    }
    if (f.kind === 'number') {
      const n = Number(s);
      if (!isFinite(n)) {
        errors.push({ field: f.name, message: 'Enter a number (digits only).' });
      } else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
        errors.push({ field: f.name, message: `Enter a number from ${String(f.min ?? '')} to ${String(f.max ?? '')}.` });
      }
    }
    if ((f.kind === 'url' || f.kind === 'image') && !SAFE_URL_RE.test(s)) {
      errors.push({ field: f.name, message: 'Enter a full link starting with https:// (or a site link starting with /).' });
    }
    if ((f.kind === 'url' || f.kind === 'image') && s.length > 255) {
      errors.push({ field: f.name, message: 'SharePoint links can be at most 255 characters. Use a shorter link.' });
    }
    if (f.kind === 'text' && s.length > 255) {
      errors.push({ field: f.name, message: 'Keep this under 255 characters.' });
    }
    if (f.name === 'Slug' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) {
      errors.push({ field: f.name, message: 'Use lowercase letters, numbers and dashes only, e.g. sap-concur.' });
    }
    if (f.kind === 'color' && !/^#[0-9a-f]{3,8}$/i.test(s) && !/^[A-Za-z][A-Za-z ]+$/.test(s) && !/^--full-[\w-]+$/.test(s)) {
      errors.push({ field: f.name, message: 'Pick a brand colour or enter a hex code like #007481.' });
    }
  });
  return errors;
}

/** Display text for a table cell. */
export function cellText(field: IAdminField | undefined, raw: unknown): string {
  if (raw === null || raw === undefined) {
    return '';
  }
  if (field === undefined) {
    return String(raw);
  }
  if (field.kind === 'bool') {
    return raw === true ? 'Yes' : 'No';
  }
  if (URL_KINDS.has(field.kind)) {
    return toFormValue(field, raw) as string;
  }
  if (field.kind === 'date' || field.kind === 'datetime') {
    const d = new Date(String(raw));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const text = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}
