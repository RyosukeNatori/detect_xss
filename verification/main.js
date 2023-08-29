let scope;
const hoge = ({ ast, target }) => {
  const template = {
    kind: '',
    children: [],
    parent: null,
  };
  console.log('-------target-------');
  console.log(target);
  console.log('--------------');

  if (target === '') {
    scope = template;
    scope.kind = 'global';
    console.log('-------template-------');
    console.log(template);
    console.log('--------------');
    hoge({ ast: '', target: scope.children[0] });
  } else {
    console.log('-------template-------');
    console.log(template);
    console.log('--------------');
    console.log(target);
    target.push(template);
    console.log(scope);
  }
};
hoge({ ast: '', target: '' });
