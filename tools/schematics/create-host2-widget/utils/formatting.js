// JavaScript utility helpers for widget.service.ts mutation formatting & insertion logic
// Converted from TypeScript version.

function escapeSingle(str) {
  return str.replace(/'/g, "\\'");
}

function buildWidgetDefinitionObject(selector, className, opts) {
  return `{
    name: '${opts.title}',
    description: '${escapeSingle(opts.description)}',
    icon: '${opts.icon}', // TODO replace placeholder icon
    minWidth: ${opts.minWidth},
    minHeight: ${opts.minHeight},
    defaultWidth: ${opts.defaultWidth},
    defaultHeight: ${opts.defaultHeight},
    category: '${opts.category}',
    requiredPlugins: [],
    selector: '${selector}',
    componentClassName: '${className}'
  },`;
}

function appendImport(src, importStatement) {
  if (src.includes(importStatement)) return src;
  const importBlockRegex = /^(?:import[^;]+;\s*)+/m;
  if (importBlockRegex.test(src)) {
    return src.replace(importBlockRegex, (block) => {
      const normalized = block.replace(/\n*$/, '');
      return normalized + '\n' + importStatement + '\n\n';
    });
  }
  return importStatement + '\n\n' + src;
}

function updateComponentMap(src, className) {
  const mapPattern = /_componentTypeMap: Record<string, Type<any>> = {([\s\S]*?)};/m;
  return src.replace(mapPattern, (m, inner) => {
    if (inner.includes(className + ':')) return m;
    const lines = inner.split(/\n/);
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (!trimmed.includes(':')) break;
      if (!trimmed.endsWith(',')) lines[i] = lines[i] + ',';
      break;
    }
    lines.push(`    ${className}: ${className}`);
    // Replace inner content, then normalize closing brace indentation to two spaces
    let replaced = m.replace(inner, lines.join('\n') + '\n');
    replaced = replaced.replace(/\n *};/, '\n  };');
    return replaced;
  });
}

function normalizeDefinitionFormatting(content, baseIndent) {
  let rebuilt = content;
  // Remove any blank line(s) between objects: ensure pattern `},\n{` with exactly one newline
  rebuilt = rebuilt.replace(/},\n\n+(\s*{)/g, '},\n$1');
  // Remove blank line before closing array
  rebuilt = rebuilt.replace(/,\n\n(\s*])/g, ',\n$1');
  // Remove stray duplicate blank lines inside objects
  rebuilt = rebuilt.replace(/({\n)([ \t]*\n)+/g, '$1');
  rebuilt = rebuilt.replace(/\n\s*\n(\s+\w+:)/g, '\n$1');
  // Normalize opening brace indentation
  rebuilt = rebuilt.replace(/^(\s*){(?=\n)/gm, baseIndent + '{');
  // Collapse any 2+ blank lines to single newline
  rebuilt = rebuilt.replace(/\n{2,}/g, '\n');
  // Remove any trailing blank lines; do NOT force an extra newline because the array pattern supplies one before the closing ];
  return rebuilt.replace(/\n\s*$/,'');
}

function insertDefinitionObject(src, selector, className, opts) {
  const defArrayPattern = /private readonly _widgetDefinition: readonly WidgetDescription\[] = \[(\s*[\s\S]*?)\n\s*];/m;
  return src.replace(defArrayPattern, (m, inner) => {
    if (inner.includes(`selector: '${selector}'`)) return m;
    let defObj = buildWidgetDefinitionObject(selector, className, opts).trim();
    defObj = defObj.startsWith('{') ? defObj : '{' + defObj;
    defObj = defObj.replace(/\n{2,}/g, '\n');
    const linesDef = defObj.split(/\n/).map(l => l.trimEnd());
    const openIdx = 0; const closeIdx = linesDef.length - 1;
    const indentMatch = inner.match(/^(\s*){/m);
    const baseIndent = indentMatch ? indentMatch[1] : '    ';
    const firstLine = baseIndent + '{';
    const lastLine = baseIndent + linesDef[closeIdx].trim();
    const middle = linesDef.slice(openIdx + 1, closeIdx).filter(l => l.trim().length > 0).map(l => baseIndent + '  ' + l.trim());
    defObj = [firstLine, ...middle, lastLine].join('\n');
    const objectRegex = /{[\s\S]*?},\n?/g;
    const objects = inner.match(objectRegex) || [];
    if (objects.length === 0) {
      return m.replace(inner, defObj + '\n');
    }
    const metas = objects.map(o => ({ text: o, category: (o.match(/category: '([^']+)'/) || [])[1] }));
    let insertAfter = -1;
    for (let i = 0; i < metas.length; i++) {
      if (metas[i].category === opts.category) insertAfter = i;
    }
    const formattedNew = defObj + '\n';
    let rebuilt = '';
    metas.forEach((meta, idx) => {
      const normalized = meta.text.endsWith('\n') ? meta.text : meta.text + '\n';
      rebuilt += normalized;
      if (idx === insertAfter) rebuilt += formattedNew; // inserted immediately, no extra blank line expected
    });
    if (insertAfter === -1) rebuilt += formattedNew; // appended at end
    rebuilt = normalizeDefinitionFormatting(rebuilt, baseIndent);
    return m.replace(inner, rebuilt);
  });
}

module.exports = {
  escapeSingle,
  buildWidgetDefinitionObject,
  appendImport,
  updateComponentMap,
  insertDefinitionObject,
  normalizeDefinitionFormatting
};
