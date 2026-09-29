import { parseHighlightSubPoints, extractTag } from '../parseHighlightSubPoints';

describe('parseHighlightSubPoints', () => {
  it('returns nothing for no lines', () => {
    expect(parseHighlightSubPoints([])).toEqual([]);
  });

  it('keeps plain lines as bullets (unchanged behaviour)', () => {
    expect(parseHighlightSubPoints(['One', 'Two'])).toEqual([
      { kind: 'bullet', text: 'One' },
      { kind: 'bullet', text: 'Two' }
    ]);
  });

  it('renders an all-numbered card as one numbered list (unchanged behaviour)', () => {
    expect(parseHighlightSubPoints(['1. Inform your manager', '2) Contact the Travel Desk'])).toEqual([
      { kind: 'numbered', items: ['Inform your manager', 'Contact the Travel Desk'] }
    ]);
  });

  it('keeps a single numbered-looking line among bullets as a bullet', () => {
    expect(parseHighlightSubPoints(['Plain', '1. Numbered'])).toEqual([
      { kind: 'bullet', text: 'Plain' },
      { kind: 'bullet', text: '1. Numbered' }
    ]);
  });

  it('keeps authored order: table first, then bullets (Exceeding Accommodation Cap Limits)', () => {
    const blocks = parseHighlightSubPoints([
      '##Excess Over Cap|Required Approval',
      'Up to 25%|GCAO Approval',
      'Above 25%|GCEO Approval',
      'You may use your daily transportation allowance.',
      'Raise accommodation-cap exception requests through SAP Concur.'
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(['table', 'bullet', 'bullet']);
    expect(blocks[0]).toEqual({
      kind: 'table',
      headers: ['Excess Over Cap', 'Required Approval'],
      rows: [
        ['Up to 25%', 'GCAO Approval'],
        ['Above 25%', 'GCEO Approval']
      ]
    });
  });

  it('keeps authored order: bullets, callout, bullets', () => {
    expect(parseHighlightSubPoints(['A', '!!Note:|Careful', 'B']).map((b) => b.kind)).toEqual(['bullet', 'callout', 'bullet']);
  });

  it('parses callouts with and without a label (unchanged behaviour)', () => {
    expect(parseHighlightSubPoints(['!!Policy note:|Text here', '!!Plain note'])).toEqual([
      { kind: 'callout', label: 'Policy note:', text: 'Text here' },
      { kind: 'callout', label: undefined, text: 'Plain note' }
    ]);
  });

  it('parses icon blocks and icon bullets (unchanged behaviour)', () => {
    expect(parseHighlightSubPoints(['@Calendar|Less than 30 days|Business travel', '@CheckMark|Confirm the need'])).toEqual([
      { kind: 'iconBlock', icon: 'Calendar', heading: 'Less than 30 days', text: 'Business travel' },
      { kind: 'iconBullet', icon: 'CheckMark', text: 'Confirm the need' }
    ]);
  });

  it('supports ==sub-headings above bullets and numbered points', () => {
    expect(
      parseHighlightSubPoints(['==Seasonal periods include:', 'Summer months', 'New Year', '==How to cancel', '1. Inform your manager', '2. Contact the Travel Desk'])
    ).toEqual([
      { kind: 'heading', text: 'Seasonal periods include:' },
      { kind: 'bullet', text: 'Summer months' },
      { kind: 'bullet', text: 'New Year' },
      { kind: 'heading', text: 'How to cancel' },
      { kind: 'numbered', items: ['Inform your manager', 'Contact the Travel Desk'] }
    ]);
  });

  it('supports ~~plain paragraphs', () => {
    expect(parseHighlightSubPoints(['==Note', '~~Some explanatory text.'])).toEqual([
      { kind: 'heading', text: 'Note' },
      { kind: 'paragraph', text: 'Some explanatory text.' }
    ]);
  });

  it('ends a table at a sub-heading', () => {
    expect(parseHighlightSubPoints(['##A|B', '1|2', '==Next', 'Bullet']).map((b) => b.kind)).toEqual(['table', 'heading', 'bullet']);
  });
});

describe('parseHighlightSubPoints - plainAs paragraph (Feature body)', () => {
  it('renders plain lines as paragraphs and "- " / "• " lines as bullets', () => {
    expect(parseHighlightSubPoints(['Intro text.', '- First', '• Second', '!!Note:|Careful'], { plainAs: 'paragraph' })).toEqual([
      { kind: 'paragraph', text: 'Intro text.' },
      { kind: 'bullet', text: 'First' },
      { kind: 'bullet', text: 'Second' },
      { kind: 'callout', label: 'Note:', text: 'Careful' }
    ]);
  });

  it('still renders an all-numbered run as numbered points', () => {
    expect(parseHighlightSubPoints(['1. One', '2. Two'], { plainAs: 'paragraph' })).toEqual([{ kind: 'numbered', items: ['One', 'Two'] }]);
  });
});

describe('extractTag', () => {
  it('pulls out a %%Tag line (unchanged behaviour)', () => {
    expect(extractTag(['%%Traveler', 'One'])).toEqual({ tag: 'Traveler', rest: ['One'] });
    expect(extractTag(['One'])).toEqual({ tag: undefined, rest: ['One'] });
  });
});
