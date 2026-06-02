import { defineConfig } from 'tsup';

// Each domain is its own entry so subpath imports stay independently
// tree-shakeable. Sources are the self-contained modules under the app's lib/*,
// re-exported from src/*.ts; esbuild inlines them into dist/ at build time.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    text: 'src/text.ts',
    math: 'src/math.ts',
    color: 'src/color.ts',
    data: 'src/data.ts',
    time: 'src/time.ts',
    web: 'src/web.ts',
    generators: 'src/generators.ts',
    crypto: 'src/crypto.ts',
    // per-tool deep subpaths (the target architecture)
    'image/index': 'src/image/index.ts',
    'image/convert': 'src/image/convert.ts',
    'image/probe': 'src/image/probe.ts',
    'time/add-business-days': 'src/time/add-business-days.ts',
  },
  format: ['esm'],
  target: 'es2022',
  dts: true,
  splitting: false,
  treeshake: true,
  clean: true,
  sourcemap: true,
});
