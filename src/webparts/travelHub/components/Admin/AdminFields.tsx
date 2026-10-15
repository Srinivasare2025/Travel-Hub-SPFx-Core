import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { ImageWithFallback } from '../../../../common/components';
import { BRAND_COLORS, resolveColor } from '../../../../common/utils/color';
import { parseImageHints, withImageHints, ImageFit } from '../../../../common/utils/imageHints';
import { sanitizeHtml } from '../../../../common/utils/sanitizeHtml';
import type { IAdminField } from './adminSchema';
import type { FormValue } from './adminValues';
import styles from './Admin.module.scss';

export interface IFieldProps {
  field: IAdminField;
  value: FormValue;
  onChange: (value: FormValue) => void;
  error?: string;
  /** Uploads a picture and returns its link (AdminService.uploadImage). */
  uploadImage: (file: File) => Promise<string>;
  /** Existing page slugs for the page picker. */
  pageSlugs: { slug: string; title: string }[];
  inputId: string;
}

const COMMON_ICONS = [
  'Airplane', 'Hotel', 'Car', 'Suitcase', 'Money', 'ReceiptCheck', 'Calendar', 'Clock', 'Mail', 'Phone', 'Chat', 'Headset',
  'People', 'Group', 'Contact', 'Home', 'MapPin', 'POI', 'Globe', 'Info', 'Warning', 'CheckMark', 'Shield', 'Lightbulb',
  'Page', 'Library', 'Document', 'DocumentApproval', 'System', 'CellPhone', 'Coffee', 'EatDrink', 'Breakfast', 'Cake', 'Health',
  'Diamond', 'Ribbon', 'Starburst', 'Camera', 'Video', 'Leaf', 'Flower', 'Robot', 'Search', 'Settings', 'Ticket', 'GiftCard',
  'Package', 'Sync', 'Cancel', 'Add', 'Like', 'Send', 'Database', 'LightningBolt', 'Ringer', 'CityNext', 'BullseyeTarget'
];

const FOCUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Centre (default)' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top left', label: 'Top left' },
  { value: 'top right', label: 'Top right' },
  { value: 'bottom left', label: 'Bottom left' },
  { value: 'bottom right', label: 'Bottom right' }
];

/* --------------------------------------------------------------------------
   Rich text editor
   -------------------------------------------------------------------------- */

const RichTextEditor: React.FC<IFieldProps> = ({ value, onChange, uploadImage, inputId }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const savedRange = React.useRef<Range | undefined>(undefined);
  const [showHtml, setShowHtml] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const html = typeof value === 'string' ? value : '';

  // Set the content once (and when switching back from HTML view) - never on
  // every keystroke, which would move the caret.
  React.useEffect(() => {
    if (!showHtml && ref.current !== null && ref.current.innerHTML !== html) {
      ref.current.innerHTML = sanitizeHtml(html);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only on mount / mode switch
  }, [showHtml]);

  const emit = (): void => {
    if (ref.current !== null) {
      onChange(ref.current.innerHTML);
    }
  };

  const saveSelection = (): void => {
    const sel = window.getSelection();
    if (sel !== null && sel.rangeCount > 0 && ref.current !== null && ref.current.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0);
    }
  };

  const restoreSelection = (): void => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current !== undefined && sel !== null) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (command: string, arg?: string): void => {
    restoreSelection();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertLink = (): void => {
    saveSelection();
    const url = window.prompt('Link address (https://…):', 'https://');
    if (url === null || !/^(https?:\/\/|mailto:|\/)/i.test(url.trim())) {
      return;
    }
    exec('createLink', url.trim());
  };

  const insertImageUrl = (url: string): void => {
    const alt = window.prompt('Describe the picture (for screen readers):', '') ?? '';
    const safeAlt = alt.replace(/["<>]/g, '');
    exec('insertHTML', `<figure><img src="${encodeURI(decodeURI(url))}" alt="${safeAlt}" />${safeAlt.length > 0 ? `<figcaption>${safeAlt}</figcaption>` : ''}</figure><p></p>`);
  };

  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file === undefined) {
      return;
    }
    setBusy(true);
    try {
      insertImageUrl(await uploadImage(file));
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>): void => {
    const pasted = e.clipboardData.getData('text/html');
    if (pasted.length > 0) {
      e.preventDefault();
      document.execCommand('insertHTML', false, sanitizeHtml(pasted));
      emit();
    }
  };

  const tool = (icon: string, label: string, action: () => void): React.ReactElement => (
    <button
      type="button"
      className={styles.rteTool}
      title={label}
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the text selection
        saveSelection();
      }}
      onClick={action}
    >
      <Icon iconName={icon} aria-hidden="true" />
    </button>
  );

  return (
    <div className={styles.rte}>
      <div className={styles.rteToolbar} role="toolbar" aria-label="Formatting">
        {tool('Bold', 'Bold', () => exec('bold'))}
        {tool('Italic', 'Italic', () => exec('italic'))}
        {tool('Underline', 'Underline', () => exec('underline'))}
        <span className={styles.rteSep} />
        <button type="button" className={styles.rteToolText} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('formatBlock', 'H2')}>
          Heading
        </button>
        <button type="button" className={styles.rteToolText} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('formatBlock', 'H3')}>
          Sub-heading
        </button>
        <button type="button" className={styles.rteToolText} onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => exec('formatBlock', 'P')}>
          Normal
        </button>
        <span className={styles.rteSep} />
        {tool('BulletedList', 'Bulleted list', () => exec('insertUnorderedList'))}
        {tool('NumberedList', 'Numbered list', () => exec('insertOrderedList'))}
        {tool('RightDoubleQuote', 'Quote', () => exec('formatBlock', 'BLOCKQUOTE'))}
        {tool('AlignCenter', 'Centre', () => exec('justifyCenter'))}
        {tool('AlignLeft', 'Left', () => exec('justifyLeft'))}
        <span className={styles.rteSep} />
        {tool('Link', 'Insert link', insertLink)}
        {tool('Photo2Add', 'Upload a picture here', () => {
          saveSelection();
          fileRef.current?.click();
        })}
        {tool('PictureFill', 'Insert a picture from a link', () => {
          saveSelection();
          const url = window.prompt('Picture link (https://…):', 'https://');
          if (url !== null && /^(https?:\/\/|\/)/i.test(url.trim())) {
            insertImageUrl(url.trim());
          }
        })}
        <span className={styles.rteSep} />
        {tool('ClearFormatting', 'Clear formatting', () => exec('removeFormat'))}
        {tool('Undo', 'Undo', () => exec('undo'))}
        {tool('Redo', 'Redo', () => exec('redo'))}
        <button type="button" className={`${styles.rteToolText} ${styles.rteHtmlToggle}`} onClick={() => setShowHtml((v) => !v)}>
          {showHtml ? 'Back to editor' : 'HTML'}
        </button>
        {busy && <span className={styles.rteBusy}>Uploading…</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
            onImageFile(e).catch(() => undefined);
          }} />
      {showHtml ? (
        <textarea id={inputId} className={`${styles.input} ${styles.rteSource}`} value={html} onChange={(e) => onChange(e.target.value)} rows={14} spellCheck={false} />
      ) : (
        <div
          id={inputId}
          ref={ref}
          className={styles.rteArea}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          onBlur={() => {
            saveSelection();
            emit();
          }}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onPaste={onPaste}
        />
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------
   Picture (link + upload + focus)
   -------------------------------------------------------------------------- */

const ImageField: React.FC<IFieldProps> = ({ value, onChange, uploadImage, inputId }) => {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | undefined>(undefined);
  const url = typeof value === 'string' ? value : '';
  const hints = parseImageHints(url.length > 0 ? url : undefined);
  const bare = hints?.src ?? '';
  const focus = hints?.position ?? '';
  const fit: ImageFit | undefined = hints?.fit;

  const set = (nextBare: string, nextFocus: string, nextFit: ImageFit | undefined): void =>
    onChange(nextBare.trim().length === 0 ? '' : withImageHints(nextBare.trim(), nextFocus.replace('center ', '') || undefined, nextFit));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file === undefined) {
      return;
    }
    setBusy(true);
    setUploadError(undefined);
    try {
      set(await uploadImage(file), focus, fit);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Focus values come back as CSS ("center top"); the picker uses the short form.
  const focusShort = focus.replace(/^center (top|bottom)$/, '$1');

  return (
    <div className={styles.imageField}>
      <div className={styles.imagePreview}>
        <ImageWithFallback src={url.length > 0 ? url : undefined} alt="" aspectRatio="16 / 9" fallbackIcon="Photo2" />
      </div>
      <div className={styles.imageControls}>
        <div className={styles.inlineRow}>
          <input
            id={inputId}
            className={styles.input}
            type="url"
            value={bare}
            placeholder="https://…/Travel Hub Images/picture.jpg"
            onChange={(e) => set(e.target.value, focusShort, fit)}
          />
          <button type="button" className={styles.secondaryButton} onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon iconName="Upload" aria-hidden="true" /> {busy ? 'Uploading…' : 'Upload'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => {
            onFile(e).catch(() => undefined);
          }} />
        </div>
        {uploadError !== undefined && <p className={styles.fieldError}>{uploadError}</p>}
        <div className={styles.inlineRow}>
          <label className={styles.inlineLabel}>
            Focus
            <select className={styles.select} value={focusShort} onChange={(e) => set(bare, e.target.value, fit)} disabled={bare.length === 0}>
              {FOCUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={fit === 'contain'} onChange={(e) => set(bare, focusShort, e.target.checked ? 'contain' : undefined)} disabled={bare.length === 0} />
            Show whole image (logos, posters)
          </label>
        </div>
      </div>
    </div>
  );
};

/* --------------------------------------------------------------------------
   Small pickers
   -------------------------------------------------------------------------- */

const IconField: React.FC<IFieldProps> = ({ value, onChange, inputId }) => {
  const v = typeof value === 'string' ? value : '';
  return (
    <div className={styles.inlineRow}>
      <span className={styles.iconPreview} aria-hidden="true">
        {v.trim().length > 0 ? <Icon iconName={v.trim()} /> : <Icon iconName="Emoji2" style={{ opacity: 0.3 }} />}
      </span>
      <input id={inputId} className={styles.input} value={v} list={`${inputId}-icons`} placeholder="e.g. Airplane" onChange={(e) => onChange(e.target.value)} />
      <datalist id={`${inputId}-icons`}>
        {COMMON_ICONS.map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
    </div>
  );
};

const ColorField: React.FC<IFieldProps> = ({ value, onChange, inputId }) => {
  const v = typeof value === 'string' ? value : '';
  const resolved = resolveColor(v);
  return (
    <div>
      <div className={styles.inlineRow}>
        <span className={styles.swatchPreview} style={{ background: resolved?.value ?? 'transparent' }} aria-hidden="true" />
        <input id={inputId} className={styles.input} value={v} placeholder="Brand colour name or #hex" onChange={(e) => onChange(e.target.value)} />
      </div>
      <div className={styles.swatches}>
        {BRAND_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`${styles.swatch} ${v.toLowerCase() === c.name.toLowerCase() ? styles.swatchActive : ''}`}
            style={{ background: c.hex }}
            title={c.name}
            aria-label={c.name}
            onClick={() => onChange(c.name)}
          />
        ))}
      </div>
    </div>
  );
};

const SlugField: React.FC<IFieldProps> = ({ value, onChange, pageSlugs, inputId }) => {
  const v = typeof value === 'string' ? value : '';
  const match = pageSlugs.find((p) => p.slug === v.trim().toLowerCase());
  return (
    <div>
      <input id={inputId} className={styles.input} value={v} list={`${inputId}-pages`} placeholder="Start typing a page name…" onChange={(e) => onChange(e.target.value)} />
      <datalist id={`${inputId}-pages`}>
        {pageSlugs.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.title}
          </option>
        ))}
      </datalist>
      {v.trim().length > 0 && !v.trim().startsWith('#') && (
        <p className={match !== undefined ? styles.fieldOk : styles.fieldWarn}>
          {match !== undefined ? `Opens "${match.title}"` : 'No page with this address yet - check the spelling.'}
        </p>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------
   The control for one field
   -------------------------------------------------------------------------- */

export const AdminFieldControl: React.FC<IFieldProps> = (props) => {
  const { field, value, onChange, inputId } = props;
  const text = typeof value === 'string' ? value : '';
  switch (field.kind) {
    case 'bool':
      return (
        <label className={styles.toggle}>
          <input id={inputId} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span className={styles.toggleTrack} aria-hidden="true" />
          <span>{value === true ? 'Yes' : 'No'}</span>
        </label>
      );
    case 'note':
      return <textarea id={inputId} className={styles.input} value={text} rows={3} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case 'lines': {
      const count = text.split('\n').filter((l) => l.trim().length > 0).length;
      return (
        <div>
          <textarea
            id={inputId}
            className={`${styles.input} ${styles.mono}`}
            value={text}
            rows={Math.min(14, Math.max(4, text.split('\n').length + 1))}
            placeholder={field.placeholder ?? 'One item per line'}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className={styles.lineCount}>{count === 1 ? '1 line' : `${String(count)} lines`}</span>
        </div>
      );
    }
    case 'rich':
      return <RichTextEditor {...props} />;
    case 'number':
      return (
        <input
          id={inputId}
          className={`${styles.input} ${styles.narrow}`}
          type="number"
          inputMode="numeric"
          value={text}
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return <input id={inputId} className={`${styles.input} ${styles.narrow}`} type="date" value={text} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <input id={inputId} className={`${styles.input} ${styles.narrow}`} type="datetime-local" value={text} onChange={(e) => onChange(e.target.value)} />;
    case 'choice':
      return (
        <select id={inputId} className={styles.select} value={text} onChange={(e) => onChange(e.target.value)}>
          {field.required !== true && <option value="">(none)</option>}
          {(field.choices ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          {text.length > 0 && (field.choices ?? []).indexOf(text) < 0 && <option value={text}>{text}</option>}
        </select>
      );
    case 'choiceFillIn':
      return (
        <>
          <input id={inputId} className={styles.input} value={text} list={`${inputId}-choices`} onChange={(e) => onChange(e.target.value)} />
          <datalist id={`${inputId}-choices`}>
            {(field.choices ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </>
      );
    case 'url':
      return (
        <div className={styles.inlineRow}>
          <input id={inputId} className={styles.input} type="url" value={text} placeholder={field.placeholder ?? 'https://…'} onChange={(e) => onChange(e.target.value)} />
          {/^https?:\/\//i.test(text.trim()) && (
            <a className={styles.secondaryButton} href={text.trim()} target="_blank" rel="noopener noreferrer">
              <Icon iconName="OpenInNewWindow" aria-hidden="true" /> Test
            </a>
          )}
        </div>
      );
    case 'image':
      return <ImageField {...props} />;
    case 'icon':
      return <IconField {...props} />;
    case 'color':
      return <ColorField {...props} />;
    case 'slug':
      return <SlugField {...props} />;
    default:
      return <input id={inputId} className={styles.input} value={text} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
};
