export type typeScope = {
  kind: string;
  parent: null | typeScope;
  childrenScopes: typeScope[];
  functions: typeFunctionScope[];
  variables: Map<string, any[]>;
  location: {
    startLine: string;
    endLine: string;
  };
  ast: any;
};

export type typeFunctionScope = {
  kind: 'function';
  name: string;
  childrenScopes: typeScope[];
  functions: typeFunctionScope[];
  variables: Map<string, any[]>;
  location: {
    startLine: string;
    endLine: string;
  };
  parent: null | typeScope;
  ast: any;
};
