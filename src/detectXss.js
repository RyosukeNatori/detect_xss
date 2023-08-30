import { buildScopeObject, getAst } from '../lib/main.js';

const ast = getAst('/home/ryosuke/project/php_and_html_parser/sample/easy.php');
// console.log(ast);
const scope = buildScopeObject({ ast, target: '', parent: '' });

let sink = { location: { startLine: 0, startColumn: 0 }, name: '' };
let source = { location: { startLine: 0, startColumn: 0 }, name: '' };

const report = () => {
  console.log('source:', source.name, source.location);
  console.log('sink:', sink.name, sink.location);
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
          console.log('No source variable');
          return;
        }
      } else if (ast.right.kind === 'offsetlookup') {
        if (
          ast.right.what.kind === 'variable' &&
          ast.right.what.name === '_GET'
        ) {
          source.location = {
            startLine: ast.right.loc.start.line,
            startColumn: ast.right.loc.start.column,
          };
          source.name = ast.right.what.name;
          report();
          return;
        }
      }
    }
  }
};

const judgeXss = ({ ast, scope, echoVariables }) => {
  echoVariables.forEach((echoVariable) => {
    let echo = echoVariable;
    while (echo.kind !== 'echo') {
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
        checkSource({ ast: sourceVariable.ast.parent, scope: nowScope });
      });
    } else {
      console.log('No source variable');
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
    console.log('No echo variable');
  }
};

const findEcho = ({ ast, scope }) => {
  const echos = [];
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
        }
      }
    } else if (ast.body) {
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
  };
  depthFirstSearch({ ast });
  if (echos.length > 0) {
    findEchoVariable({ ast, echos, scope });
  } else {
    console.log('No echo');
  }
};

findEcho({ ast, scope });
