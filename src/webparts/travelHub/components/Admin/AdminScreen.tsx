import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import type { AdminRow } from '../../../../services/AdminService';
import { ADMIN_GROUPS, ADMIN_LISTS, IAdminChild, IAdminField, IAdminList, findAdminList, lookupIdField } from './adminSchema';
import { FormValues, cellText, defaultFormValues, rowToFormValues, selectFields, toSpValue, validate, visibleFields, IValidationError } from './adminValues';
import { AdminFieldControl } from './AdminFields';
import styles from './Admin.module.scss';

/** One level of the drill-down: a list, optionally filtered to a parent item. */
interface ILevel {
  listKey: string;
  parent?: {
    child: IAdminChild;
    id: number;
    title: string;
    /** The page (TH_PolicyPages Id) this level belongs to, for nested sections. */
    pageId?: number;
  };
}

/** Plain-language message for a failed SharePoint call. */
function friendlyError(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  if (/403|access denied|unauthori[sz]ed/i.test(text)) {
    return 'You do not have permission to change this list. Ask the site owner to give your admin group "Edit" (or "Contribute") permission on it.';
  }
  if (/does not exist|404/i.test(text)) {
    return 'This list or column was not found on the site. Run provisioning/travelhub-provision.js once, then try again.';
  }
  if (/429|throttl/i.test(text)) {
    return 'SharePoint is busy right now. Please wait a moment and try again.';
  }
  return `Something went wrong: ${text.slice(0, 300)}`;
}

/** Link to view this item on the site (opens a new tab), when it has a page of its own. */
function viewLink(def: IAdminList, row: AdminRow): string | undefined {
  const base = `${window.location.pathname}?thView=`;
  switch (def.key) {
    case 'pages':
      return typeof row.Slug === 'string' && row.Slug.length > 0 ? `${base}${encodeURIComponent(`policy/${row.Slug}`)}` : undefined;
    case 'news':
      return `${base}${encodeURIComponent(`news/${String(row.Id)}`)}`;
    case 'events':
      return `${base}${encodeURIComponent(`event/${String(row.Id)}`)}`;
    default:
      return undefined;
  }
}

/* ===========================================================================
   Editor drawer
   =========================================================================== */

interface IEditorProps {
  def: IAdminList;
  fields: IAdminField[];
  row: AdminRow | undefined;
  level: ILevel;
  pageSlugs: { slug: string; title: string }[];
  onClose: (saved: boolean) => void;
}

const ItemEditor: React.FC<IEditorProps> = ({ def, fields, row, level, pageSlugs, onClose }) => {
  const { admin } = useServices();
  const isNew = row === undefined;
  const initial = React.useMemo<FormValues>(() => {
    if (row !== undefined) {
      return rowToFormValues(row, fields);
    }
    const values = defaultFormValues(def, fields);
    const defaults = level.parent?.child.defaults ?? {};
    Object.keys(defaults).forEach((k) => {
      const v = defaults[k];
      values[k] = typeof v === 'boolean' ? v : String(v);
    });
    return values;
  }, [row, fields, def, level]);
  const [values, setValues] = React.useState<FormValues>(initial);
  const [errors, setErrors] = React.useState<IValidationError[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | undefined>(undefined);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const close = (saved: boolean): void => {
    if (!saved && dirty && !window.confirm('Discard your unsaved changes?')) {
      return;
    }
    onClose(saved);
  };

  const set = (name: string, v: string | boolean): void => {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => prev.filter((e) => e.field !== name));
  };

  const save = async (): Promise<void> => {
    const found = validate(def, fields, values);
    setErrors(found);
    if (found.length > 0) {
      return;
    }
    const payload: Record<string, unknown> = { Title: String(values.Title ?? '').trim() };
    fields.forEach((f) => {
      payload[f.name] = toSpValue(f, values[f.name]);
    });
    if (isNew && level.parent !== undefined) {
      payload[lookupIdField(level.parent.child.parentField)] = level.parent.id;
      if (level.parent.child.inheritPageId === true && level.parent.pageId !== undefined) {
        payload.PageIdId = level.parent.pageId;
      }
    }
    setSaving(true);
    setSaveError(undefined);
    try {
      if (isNew) {
        await admin.addItem(def.list, payload);
      } else {
        await admin.updateItem(def.list, row.Id, payload);
      }
      onClose(true);
    } catch (err) {
      setSaveError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // Group the fields under their headings, keeping the schema order.
  const groups: { name: string; fields: IAdminField[] }[] = [];
  fields.forEach((f) => {
    const name = f.group ?? 'Details';
    const g = groups.find((x) => x.name === name);
    if (g === undefined) {
      groups.push({ name, fields: [f] });
    } else {
      g.fields.push(f);
    }
  });
  const errorFor = (name: string): string | undefined => errors.find((e) => e.field === name)?.message;

  return (
    <div className={styles.drawerBackdrop} onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div
        ref={panelRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="th-admin-editor-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            close(false);
          }
        }}
      >
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerEyebrow}>{def.label}</p>
            <h2 id="th-admin-editor-title" className={styles.drawerTitle}>
              {isNew ? 'Add new' : `Edit: ${String(row.Title ?? '') || `item ${String(row.Id)}`}`}
            </h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={() => close(false)} aria-label="Close">
            <Icon iconName="Cancel" aria-hidden="true" />
          </button>
        </header>

        <div className={styles.drawerBody}>
          {errors.length > 0 && (
            <div className={styles.errorSummary} role="alert">
              <Icon iconName="Warning" aria-hidden="true" /> Please fix {errors.length === 1 ? 'the highlighted field' : `the ${String(errors.length)} highlighted fields`} below.
            </div>
          )}

          <fieldset className={styles.formGroup}>
            <legend className={styles.formGroupTitle}>Main</legend>
            <div className={`${styles.field} ${errorFor('Title') !== undefined ? styles.fieldInvalid : ''}`}>
              <label className={styles.label} htmlFor="th-admin-Title">
                {def.titleLabel}
                {def.titleRequired === true && <span className={styles.required}> *</span>}
              </label>
              <input id="th-admin-Title" className={styles.input} value={String(values.Title ?? '')} onChange={(e) => set('Title', e.target.value)} />
              {def.titleHint !== undefined && <p className={styles.hint}>{def.titleHint}</p>}
              {errorFor('Title') !== undefined && <p className={styles.fieldError}>{errorFor('Title')}</p>}
            </div>
          </fieldset>

          {groups.map((group) => (
            <fieldset key={group.name} className={styles.formGroup}>
              <legend className={styles.formGroupTitle}>{group.name}</legend>
              {group.fields.map((f) => {
                const err = errorFor(f.name);
                const inputId = `th-admin-${f.name}`;
                return (
                  <div key={f.name} className={`${styles.field} ${err !== undefined ? styles.fieldInvalid : ''}`}>
                    <label className={styles.label} htmlFor={inputId}>
                      {f.label}
                      {f.required === true && <span className={styles.required}> *</span>}
                    </label>
                    <AdminFieldControl
                      field={f}
                      value={values[f.name] ?? ''}
                      onChange={(v) => set(f.name, v)}
                      error={err}
                      uploadImage={(file) => admin.uploadImage(file)}
                      pageSlugs={pageSlugs}
                      inputId={inputId}
                    />
                    {f.hint !== undefined && <p className={styles.hint}>{f.hint}</p>}
                    {f.example !== undefined && (
                      <details className={styles.example}>
                        <summary>Show example</summary>
                        <pre>{f.example}</pre>
                      </details>
                    )}
                    {err !== undefined && <p className={styles.fieldError}>{err}</p>}
                  </div>
                );
              })}
            </fieldset>
          ))}
        </div>

        <footer className={styles.drawerFooter}>
          {saveError !== undefined && (
            <p className={styles.saveError} role="alert">
              {saveError}
            </p>
          )}
          <div className={styles.drawerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => close(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => {
                save().catch(() => undefined);
              }} disabled={saving}>
              <Icon iconName="Save" aria-hidden="true" /> {saving ? 'Saving…' : isNew ? 'Add' : 'Save changes'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

/* ===========================================================================
   Item list (one drill level)
   =========================================================================== */

const ItemList: React.FC<{
  level: ILevel;
  pageSlugs: { slug: string; title: string }[];
  onDrill: (level: ILevel) => void;
  onToast: (text: string) => void;
}> = ({ level, pageSlugs, onDrill, onToast }) => {
  const { admin } = useServices();
  const def = findAdminList(level.listKey) as IAdminList;
  const [rows, setRows] = React.useState<AdminRow[] | undefined>(undefined);
  const [fields, setFields] = React.useState<IAdminField[]>([]);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [query, setQuery] = React.useState('');
  const [editing, setEditing] = React.useState<{ row: AdminRow | undefined } | undefined>(undefined);
  const [busyId, setBusyId] = React.useState<number | undefined>(undefined);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setRows(undefined);
    setError(undefined);
    (async () => {
      const existing = await admin.getFieldNames(def.list);
      const visible = visibleFields(def, existing);
      const filters: string[] = [];
      if (level.parent !== undefined) {
        filters.push(`${lookupIdField(level.parent.child.parentField)} eq ${String(level.parent.id)}`);
        if (level.parent.child.extraFilter !== undefined) {
          filters.push(level.parent.child.extraFilter);
        }
      }
      const orderField = def.orderField !== undefined && (existing.has(def.orderField) || def.orderField === 'Title') ? def.orderField : 'Id';
      const extra = def.key === 'pages' ? [] : existing.has('PageId') ? ['PageIdId'] : [];
      const items = await admin.getItems({
        list: def.list,
        select: selectFields(def, existing, extra),
        filter: filters.length > 0 ? filters.join(' and ') : undefined,
        orderBy: { field: orderField, ascending: def.orderDescending !== true }
      });
      if (!cancelled) {
        setFields(visible);
        setRows(items);
      }
    })().catch((err) => {
      if (!cancelled) {
        setError(friendlyError(err));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [def, level, nonce, admin]);

  const reload = (): void => setNonce((n) => n + 1);
  const fieldByName = (name: string): IAdminField | undefined => fields.find((f) => f.name === name);
  const columns = def.columns.filter((c) => fieldByName(c) !== undefined);
  const canReorder = def.orderField === 'DisplayOrder' && fieldByName('DisplayOrder') !== undefined;
  const hasActive = fieldByName('IsActive') !== undefined;

  const filtered = (rows ?? []).filter((r) => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return true;
    }
    return [r.Title, ...columns.map((c) => cellText(fieldByName(c), r[c]))].some((v) => String(v ?? '').toLowerCase().indexOf(q) >= 0);
  });

  const move = async (index: number, delta: number): Promise<void> => {
    if (rows === undefined) {
      return;
    }
    const target = index + delta;
    if (target < 0 || target >= rows.length) {
      return;
    }
    const next = rows.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setRows(next);
    setBusyId(item.Id);
    try {
      // Renumber 10, 20, 30... so items can later be slotted in between.
      for (let i = 0; i < next.length; i++) {
        const order = (i + 1) * 10;
        if (Number(next[i].DisplayOrder) !== order) {
          await admin.updateItem(def.list, next[i].Id, { DisplayOrder: order });
          next[i] = { ...next[i], DisplayOrder: order };
        }
      }
      onToast('Order saved.');
    } catch (err) {
      setError(friendlyError(err));
      reload();
    } finally {
      setBusyId(undefined);
    }
  };

  const toggleActive = async (row: AdminRow): Promise<void> => {
    setBusyId(row.Id);
    try {
      await admin.updateItem(def.list, row.Id, { IsActive: row.IsActive !== true });
      onToast(row.IsActive === true ? 'Hidden from the site.' : 'Now shown on the site.');
      reload();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(undefined);
    }
  };

  const remove = async (row: AdminRow): Promise<void> => {
    const name = String(row.Title ?? '') || `item ${String(row.Id)}`;
    const childNote = (def.children ?? []).length > 0 ? ' Its sub-items (sections, cards, rows...) are NOT deleted with it - delete or move them first.' : '';
    if (!window.confirm(`Delete "${name}"?\n\nIt goes to the site Recycle Bin and can be restored from there for 93 days.${childNote}`)) {
      return;
    }
    setBusyId(row.Id);
    try {
      await admin.recycleItem(def.list, row.Id);
      onToast(`"${name}" moved to the Recycle Bin.`);
      reload();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusyId(undefined);
    }
  };

  const pageIdFor = (row: AdminRow): number | undefined => {
    if (def.key === 'pages') {
      return row.Id;
    }
    if (typeof row.PageIdId === 'number') {
      return row.PageIdId;
    }
    return level.parent?.pageId;
  };

  return (
    <section className={styles.listPanel} aria-label={def.label}>
      <div className={styles.listHeader}>
        <div>
          <h2 className={styles.listTitle}>{level.parent !== undefined ? `${level.parent.child.label} of "${level.parent.title}"` : def.label}</h2>
          <p className={styles.listDescription}>{level.parent?.child.hint ?? def.description}</p>
        </div>
        <div className={styles.listActions}>
          <label className={styles.searchBox}>
            <Icon iconName="Search" aria-hidden="true" />
            <input type="search" value={query} placeholder="Search" aria-label={`Search ${def.label}`} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className={styles.primaryButton} onClick={() => setEditing({ row: undefined })} disabled={rows === undefined}>
            <Icon iconName="Add" aria-hidden="true" /> Add new
          </button>
        </div>
      </div>

      {error !== undefined && (
        <div className={styles.errorSummary} role="alert">
          <Icon iconName="Warning" aria-hidden="true" /> {error}{' '}
          <button type="button" className={styles.linkButton} onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {rows === undefined && error === undefined && <div className={styles.loading}>Loading…</div>}

      {rows !== undefined && filtered.length === 0 && (
        <div className={styles.emptyList}>
          <Icon iconName="AddTo" aria-hidden="true" />
          <p>{query.length > 0 ? 'Nothing matches your search.' : 'Nothing here yet. Use "Add new" to create the first item.'}</p>
        </div>
      )}

      {rows !== undefined && filtered.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {canReorder && query.length === 0 && <th className={styles.colOrder}>Order</th>}
                <th>{def.titleLabel}</th>
                {columns.map((c) => (
                  <th key={c} className={styles.colHideMobile}>
                    {fieldByName(c)?.label ?? c}
                  </th>
                ))}
                {hasActive && <th>Status</th>}
                <th className={styles.colActions}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => {
                const link = viewLink(def, row);
                const sub = def.subtitleField !== undefined ? cellText(fieldByName(def.subtitleField), row[def.subtitleField]) : '';
                return (
                  <tr key={row.Id} className={busyId === row.Id ? styles.rowBusy : undefined}>
                    {canReorder && query.length === 0 && (
                      <td className={styles.colOrder}>
                        <div className={styles.orderButtons}>
                          <button type="button" className={styles.iconButton} onClick={() => {
                move(index, -1).catch(() => undefined);
              }} disabled={index === 0 || busyId !== undefined} aria-label="Move up">
                            <Icon iconName="ChevronUp" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => {
                move(index, 1).catch(() => undefined);
              }}
                            disabled={index === filtered.length - 1 || busyId !== undefined}
                            aria-label="Move down"
                          >
                            <Icon iconName="ChevronDown" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    )}
                    <td>
                      <button type="button" className={styles.titleButton} onClick={() => setEditing({ row })}>
                        {String(row.Title ?? '').trim() || <em className={styles.untitled}>(no title)</em>}
                      </button>
                      {sub.length > 0 && sub !== String(row.Title ?? '') && <div className={styles.rowSub}>{sub}</div>}
                    </td>
                    {columns.map((c) => (
                      <td key={c} className={styles.colHideMobile}>
                        {cellText(fieldByName(c), row[c])}
                      </td>
                    ))}
                    {hasActive && (
                      <td>
                        <button
                          type="button"
                          className={`${styles.statusPill} ${row.IsActive === true ? styles.statusOn : styles.statusOff}`}
                          onClick={() => {
                toggleActive(row).catch(() => undefined);
              }}
                          disabled={busyId !== undefined}
                          title="Click to switch"
                        >
                          {row.IsActive === true ? 'Shown' : 'Hidden'}
                        </button>
                      </td>
                    )}
                    <td className={styles.colActions}>
                      <div className={styles.rowActions}>
                        {(def.children ?? []).map((child) => (
                          <button
                            key={child.label}
                            type="button"
                            className={styles.chipButton}
                            onClick={() =>
                              onDrill({
                                listKey: child.listKey,
                                parent: { child, id: row.Id, title: String(row.Title ?? '') || `item ${String(row.Id)}`, pageId: pageIdFor(row) }
                              })
                            }
                          >
                            {child.label} <Icon iconName="ChevronRight" aria-hidden="true" />
                          </button>
                        ))}
                        <button type="button" className={styles.iconButton} onClick={() => setEditing({ row })} aria-label={`Edit ${String(row.Title ?? '')}`} title="Edit">
                          <Icon iconName="Edit" aria-hidden="true" />
                        </button>
                        {link !== undefined && (
                          <a className={styles.iconButton} href={link} target="_blank" rel="noopener noreferrer" aria-label="View on the site" title="View on the site">
                            <Icon iconName="View" aria-hidden="true" />
                          </a>
                        )}
                        <button type="button" className={`${styles.iconButton} ${styles.dangerIcon}`} onClick={() => {
                remove(row).catch(() => undefined);
              }} aria-label={`Delete ${String(row.Title ?? '')}`} title="Delete">
                          <Icon iconName="Delete" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing !== undefined && (
        <ItemEditor
          def={def}
          fields={fields}
          row={editing.row}
          level={level}
          pageSlugs={pageSlugs}
          onClose={(saved) => {
            setEditing(undefined);
            if (saved) {
              onToast('Saved. Visitors see the change when they next open or refresh the page.');
              reload();
            }
          }}
        />
      )}
    </section>
  );
};

/* ===========================================================================
   Screen
   =========================================================================== */

/**
 * Content Admin: every Travel Hub list in one friendly screen. The side menu
 * groups the content by where it appears (Home page / Pages / Site); a list
 * with sub-content (a page's sections, a section's cards...) drills down with
 * a breadcrumb. Each field shows a hint with the exact format to use.
 */
export const AdminScreen: React.FC = () => {
  const { admin } = useServices();
  const [path, setPath] = React.useState<ILevel[]>([{ listKey: 'hero' }]);
  const [pageSlugs, setPageSlugs] = React.useState<{ slug: string; title: string }[]>([]);
  const [toast, setToast] = React.useState<string | undefined>(undefined);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const current = path[path.length - 1];

  React.useEffect(() => {
    admin
      .getItems({ list: 'TH_PolicyPages', select: ['Id', 'Title', 'Slug'], orderBy: { field: 'Title', ascending: true } })
      .then((rows) =>
        setPageSlugs(
          rows
            .filter((r) => typeof r.Slug === 'string' && r.Slug.length > 0)
            .map((r) => ({ slug: String(r.Slug).toLowerCase(), title: String(r.Title ?? r.Slug) }))
        )
      )
      .catch(() => undefined);
  }, [admin, path]);

  React.useEffect(() => {
    if (toast === undefined) {
      return undefined;
    }
    const t = window.setTimeout(() => setToast(undefined), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const rootKey = path[0].listKey;

  return (
    <div className={styles.admin}>
      <header className={styles.adminHeader}>
        <div className={styles.adminHeaderText}>
          <span className={styles.adminHeaderIcon} aria-hidden="true">
            <Icon iconName="EditCreate" />
          </span>
          <div>
            <h1 className={styles.adminTitle}>Content Admin</h1>
            <p className={styles.adminSubtitle}>Add and update everything shown on Travel Hub. Each field explains what to enter.</p>
          </div>
        </div>
        <button type="button" className={`${styles.secondaryButton} ${styles.menuToggle}`} onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
          <Icon iconName="GlobalNavButton" aria-hidden="true" /> Content menu
        </button>
      </header>

      <div className={styles.adminBody}>
        <nav className={`${styles.sideNav} ${menuOpen ? styles.sideNavOpen : ''}`} aria-label="Content">
          {ADMIN_GROUPS.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <p className={styles.navGroupTitle}>
                <Icon iconName={group.icon} aria-hidden="true" /> {group.label}
              </p>
              <ul>
                {group.keys.map((key) => {
                  const def = ADMIN_LISTS.find((l) => l.key === key);
                  if (def === undefined) {
                    return null;
                  }
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={`${styles.navItem} ${rootKey === key ? styles.navItemActive : ''}`}
                        aria-current={rootKey === key ? 'page' : undefined}
                        onClick={() => {
                          setPath([{ listKey: key }]);
                          setMenuOpen(false);
                        }}
                      >
                        {def.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className={styles.navNote}>
            <Icon iconName="Info" aria-hidden="true" /> Deleted items go to the site Recycle Bin. Attachments (offer files) are added in the SharePoint list form.
          </p>
        </nav>

        <main className={styles.mainPanel}>
          {path.length > 1 && (
            <nav className={styles.drillCrumbs} aria-label="Where you are">
              {path.map((lvl, i) => {
                const def = findAdminList(lvl.listKey);
                const label = lvl.parent !== undefined ? `${lvl.parent.title} › ${lvl.parent.child.label}` : (def?.label ?? lvl.listKey);
                return (
                  <React.Fragment key={`${lvl.listKey}-${String(lvl.parent?.id ?? 0)}`}>
                    {i > 0 && <Icon iconName="ChevronRight" aria-hidden="true" />}
                    {i < path.length - 1 ? (
                      <button type="button" onClick={() => setPath(path.slice(0, i + 1))}>
                        {label}
                      </button>
                    ) : (
                      <span aria-current="location">{label}</span>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          )}
          <ItemList key={`${current.listKey}-${String(current.parent?.id ?? 0)}-${current.parent?.child.label ?? ''}`} level={current} pageSlugs={pageSlugs} onDrill={(lvl) => setPath([...path, lvl])} onToast={setToast} />
        </main>
      </div>

      {toast !== undefined && (
        <div className={styles.toast} role="status">
          <Icon iconName="CheckMark" aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  );
};
