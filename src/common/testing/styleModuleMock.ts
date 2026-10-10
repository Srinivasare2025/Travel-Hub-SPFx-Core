/**
 * Jest stand-in for `*.module.scss` imports (wired via `moduleNameMapper` in
 * `config/jest.config.json`): every class name maps to itself, so component
 * render tests can run and assert on `styles.<name>` classes.
 */
const styles: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_target, key) => (key === '__esModule' ? false : String(key))
});

export default styles;
module.exports = styles;
