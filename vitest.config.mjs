/// <reference types="vitest" />

import { defineConfig } from 'vitest/dist/config';

export default defineConfig({
  test: {
    threads: true,
    testTimeout: 200,
  },
  // ...
});
