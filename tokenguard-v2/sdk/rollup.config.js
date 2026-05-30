// rollup.config.js
import { defineConfig } from 'rollup';
import terser from '@rollup/plugin-terser';

const input = 'src/index.js';
const banner = `/*!
 * TokenGuard SDK v2.0.0
 * Runtime Protection for Frontend Applications
 * https://tokenguard.io
 */`;

export default defineConfig([
  // ESM — for bundlers (webpack, vite, esbuild)
  {
    input,
    output: {
      file: 'dist/tokenguard.esm.js',
      format: 'esm',
      banner,
      sourcemap: true,
    },
  },
  // CJS — for Node/CommonJS environments
  {
    input,
    output: {
      file: 'dist/tokenguard.cjs.js',
      format: 'cjs',
      exports: 'default',
      banner,
      sourcemap: true,
    },
  },
  // UMD minified — for CDN / script tags
  {
    input,
    output: {
      file: 'dist/tokenguard.umd.js',
      format: 'umd',
      name: 'TokenGuard',
      exports: 'default',
      banner,
      sourcemap: false,
    },
    plugins: [terser({ format: { comments: /^!/ } })],
  },
]);
