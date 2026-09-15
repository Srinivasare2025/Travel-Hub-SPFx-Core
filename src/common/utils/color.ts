/** Safe CSS colour for an inline `style` value: #rgb/#rrggbb or a `--full-*` design token name. */
// eslint-disable-next-line @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields.
export function safeColor(raw: string | null | undefined, fallback: string): string {
  const v = (raw ?? '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
    return v;
  }
  if (/^--full-[a-z-]+$/.test(v)) {
    return `var(${v})`;
  }
  return fallback;
}
