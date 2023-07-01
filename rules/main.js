import fs from 'fs';
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

const setParent = (ast) => {
  const shouldSetParents = [
    'body',
    'left',
    'right',
    'what',
    'offset',
    'test',
    'expression',
  ];

  const shouldSetParentsFor = ['expressions', 'children', 'variables'];

  const keys = Object.keys(ast);

  keys
    .filter((key) => shouldSetParentsFor.includes(key))
    .forEach((key) => {
      ast[key].forEach((child) => {
        child.parent = ast;
        setParent(child);
      });
    });

  keys
    .filter((key) => shouldSetParents.includes(key))
    .forEach((key) => {
      ast[key].parent = ast;
      setParent(ast[key]);
    });
};
setParent(parsedCode);

const buildScopeObject = (ast) => {
  const templateScope = {
    kind: '',
    parent: null,
    children: [],
    variables: new Map(),
    functions: [],
  };

  const scope = templateScope;
  scope.kind = 'global';

  for (const child of ast.children) {
    switch (child.kind) {
      case 'expressionstatement': {
        if (scope.variables.has(child.expression.left.name)) {
          scope.variables.get(child.expression.left.name).push({
            ast: child.expression.left,
            location: child.expression.left.loc,
          });
        } else {
          scope.variables.set(child.expression.left.name, [
            { ast: child.expression.left, location: child.expression.left.loc },
          ]);
        }
      }
    }
  }
  return scope;
};
const scope = buildScopeObject(parsedCode);
// console.log();
