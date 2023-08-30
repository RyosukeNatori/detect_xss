import { glob } from 'glob';
import { detectXss } from '/home/ryosuke/project/php_and_html_parser/src/detectXss.js';

const fileNames = glob.sync(
  '/home/ryosuke/project/reflected-samples/XSS/CWE_79/unsafe/*'
);
fileNames.forEach((fileName) => {
  detectXss(fileName);
  console.log(fileName);
});
