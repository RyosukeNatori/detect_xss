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

const phpFile = fs.readFileSync(
  '/home/ryosuke/project/php_and_html_parser/index.php'
);

const parsedCode = parser.parseCode(phpFile);

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

let scope;
const buildScopeObject = ({ ast, target, parent }) => {
  const templateScope = {
    kind: '',
    parent: null,
    childrenScopes: [],
    variables: new Map(),
    functions: [],
  };
  const templateFunction = {
    kind: 'function',
  };
  console.log(ast);

  switch (ast.kind) {
    case 'program': {
      scope = templateScope;

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
                {
                  ast: child.expression.left,
                  location: child.expression.left.loc,
                },
              ]);
            }
            break;
          }
          case 'if': {
            console.log(child);
            buildScopeObject({ ast: child, target: scope.childrenScopes });
            break;
          }
        }
      }
      break;
    }
    case 'if': {
      const ifScope = templateScope;
    }
  }
  return scope;
};

const hoge = buildScopeObject({ ast: parsedCode, target: '' });

console.log(hoge);
