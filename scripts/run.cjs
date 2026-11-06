// Runs a TypeScript / TSX script with the app's own imports (`@/` paths, .tsx components), so a script can draw with the
// canvas's real components instead of a copy of them. Next's bundled SWC compiles; jiti loads.
//   node scripts/run.cjs scripts/<file>.tsx [args…]
const path = require('path');
const { transformSync } = require('next/dist/build/swc');

const root = path.join(__dirname, '..');
const jiti = require('jiti')(__filename, {
  alias: { '@': root },
  extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
  transform: ({ source, filename }) => {
    const ts = /\.tsx?$/.test(filename ?? ''), tsx = /\.tsx$/.test(filename ?? '');
    const { code } = transformSync(source, {
      filename, sourceMaps: false, swcrc: false,
      jsc: { parser: ts ? { syntax: 'typescript', tsx } : { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } }, target: 'es2020' },
      module: { type: 'commonjs' },
    });
    return { code };
  },
});

const script = path.resolve(process.argv[2]);
process.argv.splice(1, 1);   // the script sees itself as argv[1], as if run directly
jiti(script);
