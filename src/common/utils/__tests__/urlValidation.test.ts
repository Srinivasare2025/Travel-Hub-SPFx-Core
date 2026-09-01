/* eslint-disable no-script-url -- this suite deliberately tests that javascript: URLs are rejected. */
import { sanitizeUrl, isSafeUrl, toMailtoHref, toTelHref } from '../urlValidation';

describe('sanitizeUrl', () => {
  it('accepts https, http, mailto and tel', () => {
    expect(sanitizeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    expect(sanitizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(sanitizeUrl('tel:+123456')).toBe('tel:+123456');
  });

  it('accepts site-relative paths but not protocol-relative', () => {
    expect(sanitizeUrl('/sites/travel/page.aspx')).toBe('/sites/travel/page.aspx');
    expect(sanitizeUrl('//evil.example.com')).toBeUndefined();
  });

  it('rejects dangerous and unknown schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('  javascript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('JavaScript:alert(1)')).toBeUndefined();
    expect(sanitizeUrl('data:text/html,<script>')).toBeUndefined();
    expect(sanitizeUrl('vbscript:msgbox')).toBeUndefined();
    expect(sanitizeUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('treats null / undefined / empty as no URL', () => {
    expect(sanitizeUrl(null)).toBeUndefined();
    expect(sanitizeUrl(undefined)).toBeUndefined();
    expect(sanitizeUrl('   ')).toBeUndefined();
  });

  it('allows the inert "#" placeholder', () => {
    expect(sanitizeUrl('#')).toBe('#');
  });
});

describe('isSafeUrl', () => {
  it('is the boolean form of sanitizeUrl', () => {
    expect(isSafeUrl('https://x.com')).toBe(true);
    expect(isSafeUrl('javascript:x')).toBe(false);
  });
});

describe('toMailtoHref / toTelHref', () => {
  it('builds mailto only for a plausible address and strips CRLF', () => {
    expect(toMailtoHref('person@example.com')).toBe('mailto:person@example.com');
    expect(toMailtoHref('person@example.com\r\nBcc: x@y.com')).toBeUndefined();
    expect(toMailtoHref('not-an-email')).toBeUndefined();
  });

  it('builds tel only for phone-like input', () => {
    expect(toTelHref('+44 20 7946 0000')).toBe('tel:+442079460000');
    expect(toTelHref('ext 12')).toBeUndefined();
  });
});
