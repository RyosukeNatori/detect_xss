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

const setParent = (ast) => {
  const shouldSetParents = [
    'body',
    'left',
    'right',
    'what',
    'offsetlookup',
    'test',
    'expression',
    'variable',
  ];
  // console.log();
  // console.log(ast.kind);

  const shouldSetParentsFor = [
    'expressions',
    'children',
    'variables',
    'arguments',
  ];

  const keys = Object.keys(ast);
  // if (keys.includes('parent')) return;
  // if (ast.kind === 'variable') {
  //   console.log();
  //   console.log(keys);
  // }

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

export const getAst = (phpfilePath) => {
  let parsedCode = null;
  try {
    const phpFile = fs.readFileSync(phpfilePath);
    parsedCode = parser.parseCode(phpFile);
    setParent(parsedCode);
  } catch (e) {
    console.debug(e);
  }
  return parsedCode;
};

let scope;
export const buildScopeObject = ({ ast, target, parent }) => {
  const templateScope = {
    kind: '',
    parent: null,
    childrenScopes: [],
    variables: new Map(),
    functions: [],
    location: {
      startLine: '',
      endLine: '',
    },
    exec: null,
    ast: null,
  };
  const templateFunction = {
    kind: 'function',
    name: '',
    childrenScopes: [],
    variables: new Map(),
    functions: [],
    location: {
      startLine: '',
      endLine: '',
    },
    parent: null,
    ast: null,
  };
  if (!ast) return;

  switch (ast.kind) {
    case 'program': {
      // console.log(ast.children[2]);
      scope = templateScope;
      scope.location.startLine = ast.loc.start.line;
      scope.location.endLine = ast.loc.end.line;
      scope.ast = ast;

      scope.kind = 'global';
      for (const child of ast.children) {
        switch (child.kind) {
          case 'expressionstatement': {
            switch (child.expression.kind) {
              case 'assign': {
                if (child.expression.left.kind === 'variable') {
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
                } else if (child.expression.left.kind === 'offsetlookup') {
                  //ここみたいな配列を作るやつを他のやつにも作る
                  if (
                    scope.variables.has(child.expression.left.what.name) &&
                    scope.variables.get(child.expression.left.what.name)[0]
                      .values
                  ) {
                    scope.variables
                      .get(child.expression.left.what.name)[0]
                      .values.push(child.expression.right);
                  } else if (
                    scope.variables.has(child.expression.left.what.name)
                  ) {
                    scope.variables.get(
                      child.expression.left.what.name
                    )[0].values = [child.expression.right];
                  }
                }
                break;
              }
              case 'call': {
                if (child.expression.what.name === 'exec') {
                  if (scope.exec !== null) {
                    scope.exec.push(child.expression.arguments[1]);
                  } else {
                    scope.exec = [child.expression.arguments[1]];
                  }
                }
              }
            }
            break;
          }
          case 'if': {
            buildScopeObject({
              ast: child,
              target: scope.childrenScopes,
              parent: scope,
            });
            break;
          }
          case 'function': {
            buildScopeObject({
              ast: child,
              target: scope.functions,
              parent: scope,
            });
            break;
          }
        }
      }
      break;
    }
    case 'if': {
      const ifScope = templateScope;
      ifScope.kind = 'if';
      ifScope.parent = parent;
      ifScope.location.startLine = ast.loc.start.line;
      ifScope.location.endLine = ast.loc.end.line;
      ifScope.ast = ast;
      if (ast.body.kind === 'block') {
        for (const child of ast.body.children) {
          switch (child.kind) {
            case 'expressionstatement': {
              switch (child.expression.kind) {
                case 'assign': {
                  if (ifScope.variables.has(child.expression.left.name)) {
                    ifScope.variables.get(child.expression.left.name).push({
                      ast: child.expression.left,
                      location: child.expression.left.loc,
                    });
                  } else {
                    ifScope.variables.set(child.expression.left.name, [
                      {
                        ast: child.expression.left,
                        location: child.expression.left.loc,
                      },
                    ]);
                  }
                  break;
                }
              }
              break;
            }
            case 'if': {
              buildScopeObject({
                ast: child,
                target: ifScope.childrenScopes,
                parent: ifScope,
              });
              break;
            }
            case 'function': {
              buildScopeObject({
                ast: child,
                target: scope.functions,
                parent: scope,
              });
              break;
            }
          }
        }
        target.push(ifScope);
      } else {
        switch (ast.body.expression.kind) {
          case 'assign': {
            if (ifScope.variables.has(ast.body.expression.left.name)) {
              ifScope.variables.get(ast.body.expression.left.name).push({
                ast: ast.body.expression.left,
                location: ast.body.expression.left.loc,
              });
            } else {
              ifScope.variables.set(ast.body.expression.left.name, [
                {
                  ast: ast.body.expression.left,
                  location: ast.body.expression.left.loc,
                },
              ]);
            }
            break;
          }
        }
        if (ast.alternate || ast.alternate.kind === 'if') {
          buildScopeObject({
            ast: ast.alternate,
            target: target,
            parent: parent,
          });
        }

        target.push(ifScope);
      }
      break;
    }
    case 'function': {
      const functionScope = templateFunction;
      functionScope.name = ast.name.name;
      functionScope.parent = parent;
      functionScope.location.startLine = ast.loc.start.line;
      functionScope.location.endLine = ast.loc.end.line;
      functionScope.ast = ast;
      for (const child of ast.body.children) {
        switch (child.kind) {
          case 'expressionstatement': {
            switch (child.expression.kind) {
              case 'assign': {
                if (functionScope.variables.has(child.expression.left.name)) {
                  functionScope.variables.get(child.expression.left.name).push({
                    ast: child.expression.left,
                    location: child.expression.left.loc,
                  });
                } else {
                  functionScope.variables.set(child.expression.left.name, [
                    {
                      ast: child.expression.left,
                      location: child.expression.left.loc,
                    },
                  ]);
                }
                break;
              }
            }
            break;
          }
          case 'if': {
            buildScopeObject({
              ast: child,
              target: functionScope.childrenScopes,
              parent: functionScope,
            });
            break;
          }
          case 'function': {
            buildScopeObject({
              ast: child,
              target: scope.functions,
              parent: scope,
            });
            break;
          }
        }
      }
      target.push(functionScope);
      break;
    }
  }
  return scope;
};

// const hoge = buildScopeObject({ ast: getAst(), target: '', parent: '' });
