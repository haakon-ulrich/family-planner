import * as esbuild from 'esbuild';
import { cp, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../web/dist');

const aliasPlugin = {
  name: 'tsconfig-paths',
  setup(build) {
    const tryResolve = (base, rel) => {
      for (const ext of ['', '.ts', '/index.ts']) {
        const candidate = path.resolve(base, rel + ext);
        if (existsSync(candidate)) return candidate;
      }
      return null;
    };

    build.onResolve({ filter: /^@server\// }, (args) => {
      const resolved = tryResolve(
        path.resolve(__dirname, 'src'),
        args.path.slice('@server/'.length),
      );
      if (resolved) return { path: resolved };
    });

    build.onResolve({ filter: /^@shared\// }, (args) => {
      const resolved = tryResolve(
        path.resolve(__dirname, '../../packages/shared/src'),
        args.path.slice('@shared/'.length),
      );
      if (resolved) return { path: resolved };
    });
  },
};

await rm('dist', { recursive: true, force: true });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/index.js',
  packages: 'external',
  plugins: [aliasPlugin],
  sourcemap: true,
});

await cp('drizzle', 'dist/drizzle', { recursive: true });

if (existsSync(webDist)) {
  await cp(webDist, 'dist/public', { recursive: true });
} else {
  console.warn(
    'Warning: apps/web/dist not found — SPA not bundled. Run npm run build from the repo root.',
  );
}

console.log('Server bundle written to dist/');
