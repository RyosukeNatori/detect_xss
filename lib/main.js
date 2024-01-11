// eslint-disable-next-line no-undef
const fs = require('fs');
// eslint-disable-next-line no-undef
const engine = require('php-parser');

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
    'alternate',
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
      if (ast[key] === null) return;
      ast[key].parent = ast;
      setParent(ast[key]);
    });
};

const getAst = (phpfilePath) => {
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
const buildScopeObject = ({ ast, target, parent }) => {
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
    class: { dictionary: {} },
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
                if (
                  child.expression.right.kind === 'call' &&
                  child.expression.right.what.kind === 'propertylookup'
                ) {
                  const className =
                    scope.class.dictionary[
                      child.expression.right?.what.what.name
                    ];
                  if (scope.class[className]) {
                    scope.class[className].callStack.push(
                      child.expression.right.what
                    );
                  }
                }
                if (child.expression.left.kind === 'variable') {
                  if (child.expression.right.kind === 'new') {
                    if (scope.class[child.expression.right.what.name]) {
                      const tmpClass =
                        scope.class[child.expression.right.what.name];
                      tmpClass.call = child.expression.left;
                      tmpClass.callStack = [child.expression.right];
                      scope.class.dictionary[child.expression.left.name] =
                        child.expression.right.what.name;
                    }
                  }
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
                } else if (child.expression.what.kind === 'propertylookup') {
                  const className =
                    scope.class.dictionary[child.expression.what.what.name];
                  if (scope.class[className]) {
                    scope.class[className].callStack.push(
                      child.expression.what
                    );
                  }
                }
              }
            }
            break;
          }
          case 'if': {
            buildScopeObject({
              ast: child,
              target: scope,
              parent: null,
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
          case 'class': {
            scope.class[child.name.name] = child;
            break;
          }
          case 'for': {
            buildScopeObject({
              ast: child,
              target: scope,
              parent: null,
            });
            break;
          }
        }
      }
      break;
    }
    case 'for': {
      if (ast.body.kind === 'block') {
        for (const child of ast.body.children) {
          switch (child.kind) {
            case 'expressionstatement': {
              switch (child.expression.kind) {
                case 'assign': {
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
              }
              break;
            }
            case 'if': {
              buildScopeObject({
                ast: child,
                target,
                parent,
              });
              break;
            }
            case 'function': {
              buildScopeObject({
                ast: child,
                target: target.functions,
                parent: target,
              });
              break;
            }
            case 'for': {
              buildScopeObject({
                ast: child,
                target,
                parent,
              });
              break;
            }
          }
        }
      } else {
        switch (ast.body.expression.kind) {
          case 'assign': {
            if (scope.variables.has(ast.body.expression.left.name)) {
              scope.variables.get(ast.body.expression.left.name).push({
                ast: ast.body.expression.left,
                location: ast.body.expression.left.loc,
              });
            } else {
              scope.variables.set(ast.body.expression.left.name, [
                {
                  ast: ast.body.expression.left,
                  location: ast.body.expression.left.loc,
                },
              ]);
            }
            break;
          }
        }
      }
      break;
    }
    case 'if': {
      let astLeft = ast.test;
      while (astLeft.kind === 'bin') {
        astLeft = astLeft.left;
      }
      if (astLeft.kind === 'assign') {
        if (scope.variables.has(astLeft.left.name)) {
          scope.variables.get(astLeft.left.name).push({
            ast: astLeft.left,
            location: astLeft.left.loc,
          });
        } else {
          scope.variables.set(astLeft.left.name, [
            {
              ast: astLeft.left,
              location: astLeft.left.loc,
            },
          ]);
        }
      }
      if (ast.body.kind === 'block') {
        for (const child of ast.body.children) {
          switch (child.kind) {
            case 'expressionstatement': {
              switch (child.expression.kind) {
                case 'assign': {
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
              }
              break;
            }
            case 'if': {
              buildScopeObject({
                ast: child,
                target: scope,
                parent,
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
      } else {
        switch (ast.body.expression.kind) {
          case 'assign': {
            if (scope.variables.has(ast.body.expression.left.name)) {
              scope.variables.get(ast.body.expression.left.name).push({
                ast: ast.body.expression.left,
                location: ast.body.expression.left.loc,
              });
            } else {
              scope.variables.set(ast.body.expression.left.name, [
                {
                  ast: ast.body.expression.left,
                  location: ast.body.expression.left.loc,
                },
              ]);
            }
            break;
          }
        }
      }
      if (ast.alternate) {
        buildScopeObject({
          ast: ast.alternate,
          target,
          parent,
        });
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

// eslint-disable-next-line no-undef
module.exports = {
  getAst,
  buildScopeObject,
};

// const hoge = buildScopeObject({ ast: getAst(), target: '', parent: '' });
