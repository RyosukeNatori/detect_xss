import fs from 'fs';
// import path from 'path';
import engine from 'php-parser';

const parser = new engine({
  // some options :
  parser: {
    extractDoc: true,
    php7: true,
  },
  ast: {
    withPositions: true,
  },
});

const phpFile = fs.readFileSync('../index.php');

const parsedCode = parser.parseCode(phpFile);

const parsedEval = parser.parseEval('echo "Hello World";');

const parsedToken = parser.tokenGetAll(phpFile);

const setParent = (node) => {
  const shouldSetParents = ['body', 'left', 'right', 'what', 'offset', 'test'];

  const shouldSetParentsFor = ['expressions', 'children', 'variables'];

  const keys = Object.keys(node);

  keys
    .filter((key) => shouldSetParentsFor.includes(key))
    .forEach((key) => {
      node[key].forEach((child) => {
        child.parent = node;
        setParent(child);
      });
    });

  keys
    .filter((key) => shouldSetParents.includes(key))
    .forEach((key) => {
      node[key].parent = node;
      setParent(node[key]);
    });
};
setParent(parsedCode);

console.log(parsedCode.children);
