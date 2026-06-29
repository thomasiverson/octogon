// esbuild bundler for the Octogon extension host.
// Bundles src/extension.ts -> dist/extension.js for the Node-based extension host.
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  // The 'vscode' module is provided by the extension host at runtime.
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info'
};

async function main() {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('[esbuild] watching for changes…');
  } else {
    await esbuild.build(options);
    console.log('[esbuild] build complete');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
