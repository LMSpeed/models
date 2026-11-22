import ts from 'typescript';
export function inspectTestSource(
  source: string,
  file: string,
): Array<{ line: number; rule: string }> {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const bindings = new Map<string, string>();
  const namespaces = new Set<string>();
  const findings: Array<{ line: number; rule: string }> = [];
  for (const statement of ast.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !['vitest', '@playwright/test', 'node:test', 'jest', 'sinon'].includes(
        statement.moduleSpecifier.text,
      )
    )
      continue;
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named))
      for (const element of named.elements)
        bindings.set(
          element.name.text,
          element.propertyName?.text ?? element.name.text,
        );
    if (named && ts.isNamespaceImport(named)) namespaces.add(named.name.text);
  }
  const path = (node: ts.Expression): string[] =>
    ts.isIdentifier(node)
      ? [node.text]
      : ts.isPropertyAccessExpression(node)
        ? [...path(node.expression), node.name.text]
        : ts.isCallExpression(node)
          ? path(node.expression)
          : [];
  const record = (node: ts.Node, rule: string) => {
    findings.push({
      line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
      rule,
    });
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const chain = path(node.expression);
      const imported = bindings.get(chain[0]);
      const framework = Boolean(imported) || namespaces.has(chain[0]);
      const method = chain.at(-1);
      if (
        framework &&
        ['mock', 'doMock', 'fn', 'spyOn', 'stubGlobal', 'stub', 'spy'].includes(
          method ?? '',
        )
      )
        record(node, 'mock');
      if (['toBeDefined', 'toBeTruthy', 'toBeFalsy'].includes(method ?? ''))
        record(node, 'empty-assertion');
      if (
        method === 'waitForTimeout' ||
        ['setTimeout', 'sleep'].includes(chain[0])
      )
        record(node, 'fixed-wait');
      const kind = namespaces.has(chain[0]) ? chain[1] : imported;
      if (
        ['it', 'test', 'describe'].includes(kind ?? '') &&
        ![
          'step',
          'extend',
          'use',
          'beforeAll',
          'afterAll',
          'beforeEach',
          'afterEach',
          'configure',
        ].includes(method ?? '') &&
        !(
          ts.isPropertyAccessExpression(node.expression) &&
          ['each', 'skipIf', 'runIf'].includes(node.expression.name.text)
        )
      ) {
        if (chain.some((part) => ['only', 'skip', 'fixme'].includes(part)))
          record(node, 'focus-or-skip');
        const first = node.arguments[0];
        const title =
          first &&
          (ts.isStringLiteralLike(first)
            ? first.text
            : ts.isTemplateExpression(first)
              ? first.head.text
              : undefined);
        if (!title?.startsWith('user ')) record(node, 'user-title');
        const suite = kind === 'describe' || chain.includes('describe');
        if (!suite) {
          if (
            file.endsWith('.spec.ts') &&
            !/@[a-z][a-z0-9_-]+|\[[a-z][a-z0-9_-]+\]/i.test(
              first?.getText(ast) ?? '',
            )
          )
            record(node, 'surface-tag');
          const callback = node.arguments.find(
            (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg),
          );
          const markers = new Map<number, string>();
          const gather = (child: ts.Node) => {
            for (const range of [
              ...(ts.getLeadingCommentRanges(source, child.pos) ?? []),
              ...(ts.getTrailingCommentRanges(source, child.pos) ?? []),
              ...(ts.getTrailingCommentRanges(source, child.end) ?? []),
            ])
              markers.set(range.pos, source.slice(range.pos, range.end));
            if (
              ts.isCallExpression(child) &&
              ts.isPropertyAccessExpression(child.expression) &&
              child.expression.name.text === 'step'
            ) {
              const step = child.arguments[0];
              if (step && ts.isStringLiteralLike(step))
                markers.set(child.getStart(ast), step.text);
            }
            ts.forEachChild(child, gather);
          };
          if (callback) gather(callback);
          const comments = [...markers]
            .sort((a, b) => a[0] - b[0])
            .map(([, text]) => text)
            .join('\n');
          if (!/Given\s+\S[\s\S]*When\s+\S[\s\S]*Then\s+\S/.test(comments))
            record(node, 'given-when-then');
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}
