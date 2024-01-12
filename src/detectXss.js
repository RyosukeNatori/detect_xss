// eslint-disable-next-line no-undef
const { buildScopeObject } = require('../lib/main.js');
// eslint-disable-next-line no-undef
const { getAst } = require('../lib/main.js');

const detectXss = (filePath) => {
  const results = [];
  const stack = [];
  try {
    const ast = getAst(filePath);
    const scope = buildScopeObject({ ast, target: '', parent: '' });

    let sink = {
      location: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
      name: '',
    };
    let source = {
      location: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
      name: '',
    };

    const report = () => {
      const result = {
        source: source.name,
        sourceLocation: source.location,
        sink: sink.name,
        sinkLocation: sink.location,
      };
      console.log(result.source);
      console.log(result.sourceLocation);
      console.log(result.sink);
      console.log(result.sinkLocation);
      results.push(result);
      return;
    };

    const findScope = ({ ast, scope }) => {
      const targetStartLocation = ast.loc.start.line;
      const targetEndLocation = ast.loc.end.line;
      let minimumScope = scope;
      const findMinimumScope = ({ scope }) => {
        if (
          scope.location.startLine <= targetStartLocation &&
          scope.location.endLine >= targetEndLocation
        ) {
          if (
            minimumScope.location.startLine <= scope.location.startLine &&
            minimumScope.location.endLine >= scope.location.endLine
          ) {
            minimumScope = scope;
          }
          if (scope.functions.length > 0) {
            for (let childScope of scope.functions) {
              findMinimumScope({ scope: childScope });
            }
          }
          if (scope.childrenScopes.length > 0) {
            for (let childScope of scope.childrenScopes) {
              findMinimumScope({ scope: childScope });
            }
          }
        }
      };
      findMinimumScope({ scope });
      // console.log(minimumScope);
      return minimumScope;
    };

    const checkSource = ({ ast, scope }) => {
      switch (ast.kind) {
        case 'assign': {
          if (stack.includes(ast.right)) {
            return;
          } else {
            stack.push(ast.right);
          }
          if (ast.right.kind === 'variable') {
            if (scope.variables.get(ast.right.name)) {
              //いずれここは上のスコープまで見れるようにする
              scope.variables.get(ast.right.name).forEach((variable) => {
                checkSource({ ast: variable.ast.parent, scope });
              });
            } else {
              console.debug('No source variable');
              return;
            }
          } else if (
            ast.right.kind === 'encapsed' &&
            ast.right.type === 'shell'
          ) {
            // console.log(ast.right.value[0]);
            // let execResult;
            // if (ast.right.value.length > 0) {
            //   ast.right.value.forEach((value) => {
            //     try {
            //       execResult = child_process
            //         .execSync(value.expression.value)
            //         .toString();
            //     } catch (e) {
            //       execResult = e.output[2].toString();
            //     }
            //   });
            // } else {
            //   execResult = '';
            // }

            // if (execResult === '' || execResult.includes('command not found')) {
            //   return;
            // } else {
            source.location = {
              startLine: ast.right.loc.start.line,
              startColumn: ast.right.loc.start.column,
              endLine: ast.right.loc.end.line,
              endColumn: ast.right.loc.end.column,
            };
            source.name = ast.right.type;
            report();
            // }
          } else if (ast.right.kind === 'offsetlookup') {
            if (
              (ast.right.what.kind === 'variable' &&
                ast.right.what.name === '_GET') ||
              ast.right.what.name === '_POST' ||
              ast.right.what.name === '_SESSION'
            ) {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = ast.right.what.name;
              report();
            } else if (ast.right.offset.kind === 'number') {
              if (
                findScope({ ast: ast.right.what, scope }).variables.get(
                  ast.right.what.name
                )?.[0].values
              ) {
                checkSource({
                  ast: findScope({
                    ast: ast.right.what,
                    scope,
                  }).variables.get(ast.right.what.name)[0].values[
                    ast.right.offset.value
                  ].parent,
                  scope,
                });
              } else if (
                findScope({ ast: ast.right.what, scope }).variables.get(
                  ast.right?.what?.offset?.name
                )?.value
              ) {
                ast.right = findScope({
                  ast: ast.right.what,
                  scope,
                }).variables.get(ast.right.what.offset.name).value[
                  ast.right.offset.value
                ];
                checkSource({
                  ast: ast,
                  scope,
                });
              } else {
                if (
                  scope.exec.length > 0 &&
                  scope.exec.some((v) => {
                    return v.name === ast.right.what.name;
                  })
                ) {
                  source.location = {
                    startLine: ast.right.loc.start.line,
                    startColumn: ast.right.loc.start.column,
                    endLine: ast.right.loc.end.line,
                    endColumn: ast.right.loc.end.column,
                  };
                  source.name = 'exec';
                  report();
                }
              }
            } else if (ast.right.offset.kind === 'string') {
              if (
                findScope({ ast: ast.right.what, scope }).variables.get(
                  ast.right?.what?.offset?.name
                )?.value
              ) {
                const values = findScope({
                  ast: ast.right.what,
                  scope,
                })
                  .variables.get(ast.right?.what?.offset?.name)
                  ?.value.filter((elm) => {
                    return elm.key === ast.right.offset.value;
                  });

                if (values.length > 0) {
                  ast.right = values.at(-1).ast;
                  checkSource({
                    ast: ast,
                    scope,
                  });
                }
              }
            }
          } else if (ast.right.kind === 'call') {
            if (ast.right.what.name === 'shell_exec') {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = 'shell_exec';
              report();
            } else if (ast.right.what.name === 'system') {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = 'system';
              report();
            } else if (ast.right.what.name === 'fgets') {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = 'fgets';
              report();
            } else if (ast.right.what.name === 'fread') {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = 'fread';
              report();
            } else if (ast.right.what.name === 'file_get_contents') {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = 'file_get_contents';
              report();
            } else if (ast.right.what.name === 'file') {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = 'file';
              report();
            } else if (ast.right.what.name === 'stream_get_contents') {
              source.location = {
                startLine: ast.right.loc.start.line,
                startColumn: ast.right.loc.start.column,
                endLine: ast.right.loc.end.line,
                endColumn: ast.right.loc.end.column,
              };
              source.name = 'stream_get_contents';
              report();
            }
            if (ast.right.arguments.length > 0) {
              //   return;
              // }
              ast.right.arguments.forEach((argument) => {
                const variableScope = findScope({ ast: argument, scope });
                if (variableScope.variables.get(argument.name)) {
                  variableScope.variables
                    .get(argument.name)
                    .filter((variable) => {
                      return (
                        argument !== variable.ast && ast.left !== variable.ast
                      );
                    })
                    .forEach((variable) => {
                      checkSource({ ast: variable.ast.parent, scope });
                    });
                }
              });
            }
            if (ast.right.what.kind === 'propertylookup') {
              const className =
                scope.class.dictionary[ast.right.what.what.name];

              if (scope.class[className]?.callStack) {
                const index = scope.class[className].callStack.findIndex(
                  (element) => {
                    return element === ast.right.what;
                  }
                );
                const classScope = {
                  kind: 'class',
                  parent: scope,
                  variables: new Map(),
                  method: new Map(),
                  location: {
                    startLine: scope.class[className].loc.start.line,
                    endLine: scope.class[className].loc.end.line,
                  },
                  childrenScopes: [],
                  functions: [],
                };
                scope.class[className].body.forEach((element) => {
                  switch (element.kind) {
                    case 'propertystatement': {
                      element.properties.forEach((property) => {
                        classScope.variables.set(property.name.name, {
                          ast: property.name,
                          value: null,
                        });
                      });
                      break;
                    }
                    case 'method': {
                      classScope.method.set(element.name.name, {
                        ast: element.body,
                      });
                      if (element.body?.kind === 'block') {
                        element.body.children.forEach((child) => {
                          if (child.expression?.kind === 'assign') {
                            switch (child.expression.left.kind) {
                              case 'propertylookup': {
                                break;
                              }
                              case 'offsetlookup': {
                                if (
                                  child.expression.left.what.kind ===
                                    'propertylookup' &&
                                  child.expression.left.offset.kind === 'number'
                                ) {
                                  if (child.expression.left.what.offset.name) {
                                    if (
                                      classScope.variables.get(
                                        child.expression.left.what.offset.name
                                      ).value?.[0]
                                    ) {
                                      classScope.variables
                                        .get(
                                          child.expression.left.what.offset.name
                                        )
                                        .value.push(child.expression.right);
                                    } else {
                                      classScope.variables.get(
                                        child.expression.left.what.offset.name
                                      ).value = [child.expression.right];
                                    }
                                  }
                                } else if (
                                  child.expression.left.what.kind ===
                                    'propertylookup' &&
                                  child.expression.left.offset.kind === 'string'
                                ) {
                                  if (child.expression.left.what.offset.name) {
                                    if (
                                      classScope.variables.get(
                                        child.expression.left.what.offset.name
                                      ).value?.[0]
                                    ) {
                                      classScope.variables
                                        .get(
                                          child.expression.left.what.offset.name
                                        )
                                        .value.push({
                                          key: child.expression.left.offset
                                            .value,
                                          ast: child.expression.right,
                                        });
                                    } else {
                                      classScope.variables.get(
                                        child.expression.left.what.offset.name
                                      ).value = [
                                        {
                                          key: child.expression.left.offset
                                            .value,
                                          ast: child.expression.right,
                                        },
                                      ];
                                    }
                                  }
                                }
                                break;
                              }
                            }
                          }
                        });
                      }
                      break;
                    }
                  }
                });
                scope.childrenScopes.push(classScope);
                let resultValue;
                for (let i = 0; i <= index; i++) {
                  const callExpresson = scope.class[className].callStack[i];
                  switch (callExpresson.kind) {
                    case 'propertylookup': {
                      if (classScope.method.get(callExpresson.offset.name)) {
                        classScope.method
                          .get(callExpresson.offset.name)
                          .ast.children.forEach((element) => {
                            switch (element.kind) {
                              case 'expressionstatement': {
                                switch (element.expression.kind) {
                                  case 'assign': {
                                    switch (element.expression.left.kind) {
                                      case 'variable': {
                                        break;
                                      }
                                      case 'propertylookup': {
                                        if (
                                          classScope.variables.get(
                                            element.expression.left.offset.name
                                          )
                                        ) {
                                          if (
                                            element.expression.right.kind ===
                                            'variable'
                                          ) {
                                            classScope.variables.get(
                                              element.expression.left.offset
                                                .name
                                            ).value = element.expression.right;
                                          } else if (
                                            element.expression.right.kind ===
                                            'propertylookup'
                                          ) {
                                            classScope.variables.get(
                                              element.expression.left.offset
                                                .name
                                            ).value = classScope.variables.get(
                                              element.expression.right.offset
                                                .name
                                            ).value;
                                          }
                                        }
                                        break;
                                      }
                                    }
                                    break;
                                  }
                                }
                                break;
                              }
                              case 'return': {
                                switch (element.expr.kind) {
                                  case 'propertylookup': {
                                    if (
                                      classScope.variables.get(
                                        element.expr.offset.name
                                      )
                                    ) {
                                      resultValue = classScope.variables.get(
                                        element.expr.offset.name
                                      ).value;
                                    }
                                    break;
                                  }
                                  default: {
                                    resultValue = element.expr;
                                    break;
                                  }
                                }
                                break;
                              }
                            }
                          });
                      }
                      break;
                    }
                    case 'new': {
                      if (classScope.method.get('__construct')) {
                        classScope.method
                          .get('__construct')
                          .ast.children.forEach((element) => {
                            switch (element.kind) {
                              case 'expressionstatement': {
                                switch (element.expression.kind) {
                                  case 'assign': {
                                    switch (element.expression.left.kind) {
                                      case 'variable': {
                                        break;
                                      }
                                      case 'propertylookup': {
                                        if (
                                          classScope.variables.get(
                                            element.expression.left.offset.name
                                          ) &&
                                          element.expression.right.kind !==
                                            'array'
                                        ) {
                                          classScope.variables.get(
                                            element.expression.left.offset.name
                                          ).value = element.expression.right;
                                        }
                                        break;
                                      }
                                    }
                                    // if(classScope.variables.get())
                                    break;
                                  }
                                }
                                break;
                              }
                            }
                          });
                      }
                      break;
                    }
                  }
                }
                if (resultValue) {
                  ast.right = resultValue;
                  checkSource({ ast, scope });
                } else {
                  console.debug('No source variable');
                  return;
                }
              }
            }
          }
        }
      }
    };

    const judgeXss = ({ scope, echoVariables }) => {
      echoVariables.forEach((echoVariable) => {
        let echo = echoVariable;
        while (echo.kind !== 'echo' && echo.kind !== 'call') {
          echo = echo.parent;
        }
        sink = {
          location: {
            startLine: echo.loc.start.line,
            startColumn: echo.loc.start.column,
            endLine: echo.loc.end.line,
            endColumn: echo.loc.end.column,
          },
          name: echoVariable.name,
        };
        const minimumScope = findScope({ ast: echoVariable, scope });
        let nowScope = minimumScope;
        const sourceVariables = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (nowScope.variables.get(echoVariable.name)) {
            nowScope.variables.get(echoVariable.name).forEach((variable) => {
              sourceVariables.push(variable);
            });
            break;
          }
          nowScope = nowScope.parent;
          if (!nowScope) {
            break;
          }
        }

        if (sourceVariables.length > 0) {
          sourceVariables.forEach((sourceVariable) => {
            // if (!stack.includes(sourceVariable.ast.parent)) {
            checkSource({
              ast: sourceVariable.ast.parent,
              scope: nowScope,
            });
            // }
          });
        } else {
          console.debug('No source variable');
          return;
        }
      });
    };

    const findEchoVariable = ({ ast, echos, scope }) => {
      const echoVariables = [];

      const leftAndRightSearch = ({ ast }) => {
        Object.keys(ast).forEach((key) => {
          if (ast[key].kind === 'variable') {
            echoVariables.push(ast[key]);
          } else if (key === 'left' || key === 'right') {
            leftAndRightSearch({ ast: ast[key] });
          }
        });
      };

      for (let echo of echos) {
        for (let expression of echo.expressions) {
          if (expression.kind === 'variable') {
            echoVariables.push(expression);
          } else {
            leftAndRightSearch({ ast: expression });
          }
        }
      }
      if (echoVariables.length > 0) {
        judgeXss({ ast, scope, echoVariables });
      } else {
        console.debug('No echo variable');
      }
    };

    const findPrintVariable = ({ ast, prints, scope }) => {
      const printVariables = [];

      for (let print of prints) {
        for (let argument of print.arguments) {
          if (argument.kind === 'variable') {
            printVariables.push(argument);
          }
        }
      }
      if (printVariables.length > 0) {
        judgeXss({ ast, scope, echoVariables: printVariables });
      } else {
        console.debug('No print variable');
      }
    };

    const findEcho = ({ ast, scope }) => {
      const echos = [];
      const prints = [];
      const depthFirstSearch = ({ ast }) => {
        if (ast.children) {
          for (let child of ast.children) {
            if (child.kind === 'echo') {
              echos.push(child);
            } else if (
              child.kind === 'if' ||
              child.kind === 'while' ||
              child.kind === 'for' ||
              child.kind === 'function'
            ) {
              depthFirstSearch({ ast: child });
            } else if (child.kind === 'expressionstatement') {
              if (
                child.expression.kind === 'call' &&
                (child.expression.what.name === 'print' ||
                  child.expression.what?.name === 'print_r')
              ) {
                prints.push(child.expression);
              }
            }
          }
        } else if (ast.body) {
          if (ast.body.kind === 'block') {
            for (let child of ast.body.children) {
              if (child.kind === 'echo') {
                echos.push(child);
              } else if (
                child.kind === 'if' ||
                child.kind === 'while' ||
                child.kind === 'for' ||
                child.kind === 'function'
              ) {
                depthFirstSearch({ ast: child });
              }
            }
          }
        }
      };
      depthFirstSearch({ ast });
      if (echos.length > 0) {
        findEchoVariable({ ast, echos, scope });
      } else {
        console.debug('No echo');
      }
      if (prints.length > 0) {
        findPrintVariable({ ast, prints, scope });
      } else {
        console.debug('No print');
      }
    };

    findEcho({ ast, scope });
  } catch (e) {
    console.debug(e);
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    return results;
  }
};

// eslint-disable-next-line no-undef
exports.detectXss = detectXss;
// module.exports = detectXss;

detectXss(
  '/Users/ryosuke/project/php_and_html_parser/sample/CWE_79__proc_open__func_addslashes__Unsafe_use_untrusted_data-attribute_Name.php'
);
