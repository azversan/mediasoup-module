import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: false,
  minify: true,
  treeshake: true,
  clean: true,
  target: 'es2020',
  outDir: 'dist',
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata', 'rxjs', 'mediasoup'],
  esbuildOptions(options) {
    options.legalComments = 'none';
  },
});
