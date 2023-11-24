// import { detectXss } from './src/detectXss.js';
const detectXssModule = await import('./src/detectXss.js');
console.log(detectXssModule);
export const assertXSS = ({ filePath }) => {
  const result = detectXssModule.detectXss(filePath).length > 0;
  return result;
};
