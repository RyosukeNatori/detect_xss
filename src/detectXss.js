import { buildScopeObject, getAst } from '../lib/main.js';
import child_process from 'child_process';

export const detectXss = (filePath) => {
  const results = [];
  try {
    const ast = getAst(filePath);

    const scope = buildScopeObject({ ast, target: '', parent: '' });

    let sink = { location: { startLine: 0, startColumn: 0 }, name: '' };
    let source = { location: { startLine: 0, startColumn: 0 }, name: '' };

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
      return minimumScope;
    };

    const checkSource = ({ ast, scope }) => {
      switch (ast.kind) {
        case 'assign': {
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
                  ast: findScope({ ast: ast.right.what, scope }).variables.get(
                    ast.right.what.name
                  )[0].values[ast.right.offset.value].parent,
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
                  };
                  source.name = 'exec';
                  report();
                }
              }
            }
          } else if (ast.right.kind === 'call') {
            if (ast.right.arguments.length > 0) {
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
          }
        }
      }
    };

    const judgeXss = ({ ast, scope, echoVariables }) => {
      echoVariables.forEach((echoVariable) => {
        let echo = echoVariable;
        while (echo.kind !== 'echo' && echo.kind !== 'call') {
          echo = echo.parent;
        }
        sink = {
          location: {
            startLine: echo.loc.start.line,
            startColumn: echo.loc.start.column,
          },
          name: echoVariable.name,
        };
        const minimumScope = findScope({ ast: echoVariable, scope });
        let nowScope = minimumScope;
        const sourceVariables = [];
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
            checkSource({
              ast: sourceVariable.ast.parent,
              scope: nowScope,
            });
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
    return results;
  }
};

detectXss(
  '/Users/ryosuke/project/php_and_html_parser/sample/CWE_79__exec__func_FILTER-CLEANING-email_filter__Unsafe_use_untrusted_data-attribute_Name.php'
);
