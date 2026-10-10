/* eslint-disable no-script-url -- this suite deliberately tests that javascript: URLs are rejected. */
import { parseMediaItems, guessMediaKind } from '../mediaItems';

describe('parseMediaItems', () => {
  it('reads label | url lines and guesses the kind from the extension', () => {
    expect(
      parseMediaItems(['Riyadh | https://x.sharepoint.com/docs/Riyadh.pdf', 'Poster|/sites/th/Images/poster.PNG?web=1'])
    ).toEqual([
      { label: 'Riyadh', url: 'https://x.sharepoint.com/docs/Riyadh.pdf', kind: 'document' },
      { label: 'Poster', url: '/sites/th/Images/poster.PNG?web=1', kind: 'image' }
    ]);
  });

  it('accepts a bare URL and an explicit kind', () => {
    expect(parseMediaItems(['https://picsum.photos/seed/a/800/500'])).toEqual([
      { label: '', url: 'https://picsum.photos/seed/a/800/500', kind: 'document' }
    ]);
    expect(parseMediaItems(['Setup 1 | https://picsum.photos/seed/a/800/500 | image'])[0].kind).toBe('image');
    expect(parseMediaItems(['Guide | https://x.com/view.aspx?id=1 | PDF'])[0].kind).toBe('document');
  });

  it('drops unsafe, empty and non-file URLs', () => {
    expect(parseMediaItems(['Bad | javascript:alert(1)', 'Empty |', 'Hash | #', 'Mail | mailto:a@b.com'])).toEqual([]);
  });
});

describe('guessMediaKind', () => {
  it('treats image extensions as images and everything else as documents', () => {
    expect(guessMediaKind('https://a/b.jpeg#x')).toBe('image');
    expect(guessMediaKind('https://a/b.webp')).toBe('image');
    expect(guessMediaKind('https://a/b.pdf')).toBe('document');
    expect(guessMediaKind('https://a/_layouts/15/embed.aspx?UniqueId=1')).toBe('document');
  });
});
