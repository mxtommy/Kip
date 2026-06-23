/**
 * Small helpers for reading static literals out of KIP source with the
 * TypeScript Compiler API.
 *
 * KIP already depends on `typescript`, so the generator uses the compiler API
 * directly (no extra dependency). We only ever parse syntactically and read
 * literal values — Angular components are never executed.
 */
import * as fs from 'node:fs';
import * as ts from 'typescript';

/** Parses a source file syntactically (no type-checking, no program). */
export function parseSourceFile(filePath: string): ts.SourceFile {
  const content = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, /* setParentNodes */ true);
}

/**
 * Converts a literal expression node to a plain JS value.
 *
 * Supports strings, numbers (incl. unary minus), booleans, null, arrays and
 * object literals. Anything else (an identifier, function call, spread, computed
 * value, ...) throws — the generator fails loudly rather than emitting a wrong
 * default.
 */
export function literalToValue(node: ts.Expression): unknown {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);

  switch (node.kind) {
    case ts.SyntaxKind.TrueKeyword:
      return true;
    case ts.SyntaxKind.FalseKeyword:
      return false;
    case ts.SyntaxKind.NullKeyword:
      return null;
  }

  if (ts.isParenthesizedExpression(node)) {
    return literalToValue(node.expression);
  }

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = literalToValue(node.operand);
    if (typeof inner === 'number') return -inner;
    throw unsupported(node);
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => literalToValue(element));
  }

  if (ts.isObjectLiteralExpression(node)) {
    const obj: Record<string, unknown> = {};
    for (const member of node.properties) {
      if (!ts.isPropertyAssignment(member)) throw unsupported(member);
      obj[propertyName(member.name)] = literalToValue(member.initializer);
    }
    return obj;
  }

  throw unsupported(node);
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`Unsupported property name kind: ${ts.SyntaxKind[name.kind]}`);
}

function unsupported(node: ts.Node): Error {
  return new Error(
    `Unsupported (non-literal) syntax: ${ts.SyntaxKind[node.kind]}. ` +
      `The MCP schema generator only reads static literals.`,
  );
}

/**
 * Finds the first property/variable named `propName` whose initializer is an
 * array literal, anywhere in the source file. Throws if not found.
 */
export function findArrayLiteral(sourceFile: ts.SourceFile, propName: string): ts.ArrayLiteralExpression {
  let found: ts.ArrayLiteralExpression | undefined;

  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      (ts.isPropertyDeclaration(node) ||
        ts.isPropertyAssignment(node) ||
        ts.isVariableDeclaration(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === propName &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (!found) {
    throw new Error(`Could not find an array initializer named "${propName}" in ${sourceFile.fileName}`);
  }
  return found;
}
