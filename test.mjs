import { detectXss } from './src/detectXss.js';

export const assertXSS = async ({ filePath }) => {
  const result = (await detectXss(filePath).length) > 0;
  return result;
};
