import { detectXss } from './src/detectXss.js';

export const assertXSS = ({ filePath }) => {
  const result = detectXss(filePath).length > 0;
  return result;
};
