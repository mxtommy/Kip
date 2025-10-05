"use strict";
const { apply, url, template, move, mergeWith, chain, noop } = require('@angular-devkit/schematics');
const { strings } = require('@angular-devkit/core');

const WIDGETS_DIR = 'src/app/widgets';
const WIDGET_SERVICE = 'src/app/core/services/widget.service.ts';

function createHost2Widget(options) {
  return (tree, ctx) => {
    const nameDashed = strings.dasherize(options.name);
    const selector = `widget-${nameDashed}`;
    const className = `Widget${strings.classify(options.name)}Component`;
    const widgetFolder = `${WIDGETS_DIR}/${selector}`;
    if (tree.exists(`${widgetFolder}/${selector}.component.ts`)) {
      throw new Error(`Widget already exists: ${selector}`);
    }
    const tplSource = apply(url('./files/widget'), [
      template({ ...strings, ...options, nameDashed, selector, className, pathKey: options.pathKey }),
      move(widgetFolder)
    ]);
    const specSource = options.addSpec ? apply(url('./files/spec'), [
      template({ ...strings, ...options, nameDashed, selector, className }), move(widgetFolder)
    ]) : null;
    const readmeSource = options.readme ? apply(url('./files/readme'), [
      template({ ...strings, ...options, nameDashed, selector, className }), move(widgetFolder)
    ]) : null;
    return chain([
      mergeWith(tplSource),
      specSource ? mergeWith(specSource) : noop(),
      readmeSource ? mergeWith(readmeSource) : noop(),
      stripTemplateSuffixRule(widgetFolder),
      options.updateWidgetService !== 'none' ? updateWidgetService(selector, className, options) : noop(),
      logSummary(selector, className, options)
    ])(tree, ctx);
  };
}

function logSummary(selector, className, opts) {
  return (_t, ctx) => {
    ctx.logger.info(`✔ Created ${selector} (${className})`);
    if (opts.updateWidgetService !== 'none') ctx.logger.info('✔ WidgetService updated');
    // Config UI generation removed
  };
}

function updateWidgetService(selector, className, opts) {
  return (tree, ctx) => {
    if (!tree.exists(WIDGET_SERVICE)) {
      ctx.logger.warn('WidgetService not found; skipping auto-registration');
      return tree;
    }
    const src = tree.read(WIDGET_SERVICE).toString('utf-8');
    let updated = src;
    const fileBase = selector.replace(/^widget-/, '');
    const importStatement = `import { ${className} } from '../../widgets/${selector}/${selector}.component';`;
    if (!updated.includes(importStatement)) {
      // Match the full leading import block (all consecutive import lines from top)
      const importBlockRegex = /^(?:import[^;]+;\s*)+/m;
      if (importBlockRegex.test(updated)) {
        // Normalize existing block (strip trailing blank lines), append new import, then ensure ONE empty line after block
        updated = updated.replace(importBlockRegex, (block) => {
          const normalized = block.replace(/\n*$/, '');
          return normalized + '\n' + importStatement + '\n\n';
        });
      } else {
        updated = importStatement + '\n\n' + updated;
      }
    }
    const mapPattern = /_componentTypeMap: Record<string, Type<any>> = {([\s\S]*?)};/m;
    updated = updated.replace(mapPattern, (m, inner) => {
      if (inner.includes(className + ':')) return m;
      // Ensure the current last non-empty mapping line ends with a comma
      const lines = inner.split(/\n/);
      // Remove any trailing empty lines before the closing brace
      while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
      // Determine if last meaningful line is a mapping (contains ':')
      for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        if (!trimmed.includes(':')) break; // nothing to comma-adjust
        if (!trimmed.endsWith(',')) lines[i] = lines[i] + ',';
        break;
      }
      // Insert new mapping as its own line (no trailing comma)
      lines.push(`    ${className}: ${className}`);
      // Ensure final newline before closing brace in outer replacement context
      return m.replace(inner, lines.join('\n') + '\n');
    });
    const defArrayPattern = /private readonly _widgetDefinition: readonly WidgetDescription\[] = \[(\s*[\s\S]*?)\n\s*\];/m;
    updated = updated.replace(defArrayPattern, (m, inner) => {
      if (inner.includes(`selector: '${selector}'`)) return m; // already present
      const defObjRaw = buildWidgetDefinitionObject(selector, className, opts).trim();
      // Determine base indentation from first object ("{\n" line)
      const indentMatch = inner.match(/^(\s*){/m);
      const baseIndent = indentMatch ? indentMatch[1] : '    ';
      // Normalize existing: unify objects and remove interior blank lines
      const objectRegex = /{[\s\S]*?},\n?/g;
      const objects = inner.match(objectRegex) || [];
      let defObj = defObjRaw.startsWith('{') ? defObjRaw : '{' + defObjRaw;
      // Normalize: strip leading/trailing blank lines and collapse internal blank lines
      defObj = defObj.replace(/\n{2,}/g, '\n');
      const linesDef = defObj.split(/\n/).map(l => l.trimEnd());
      // Expect opening '{' and closing '},'
      const openIdx = 0;
      const closeIdx = linesDef.length - 1;
      const firstLine = baseIndent + '{';
      const lastLine = baseIndent + linesDef[closeIdx].trim(); // '},'
      const middle = linesDef.slice(openIdx + 1, closeIdx).filter(l => l.trim().length > 0).map(l => baseIndent + '  ' + l.trim());
      defObj = [firstLine, ...middle, lastLine].join('\n');

      if (objects.length === 0) {
        return m.replace(inner, baseIndent + defObj + '\n');
      }

      // Build array of object metadata with category
      const metas = objects.map(o => ({ text: o, category: (o.match(/category: '([^']+)'/) || [])[1] }));
      // Find insertion index (after last of same category if any)
      let insertAfter = -1;
      for (let i = 0; i < metas.length; i++) {
        if (metas[i].category === opts.category) insertAfter = i;
      }
      const formattedNew = defObj + '\n';
      let rebuilt = '';
      metas.forEach((meta, idx) => {
        rebuilt += meta.text;
        if (!meta.text.endsWith('\n')) rebuilt += '\n';
        if (idx === insertAfter) rebuilt += formattedNew;
      });
      if (insertAfter === -1) rebuilt += formattedNew; // append at end
      // Retro-normalize: collapse multiple blank lines between objects to a single newline
      rebuilt = rebuilt.replace(/\n{2,}(\s*{)/g, '\n$1');
      // Remove any empty lines inside objects between property lines
      rebuilt = rebuilt.replace(/({\n)([ \t]*\n)+/g, '$1'); // after opening brace
      rebuilt = rebuilt.replace(/\n\s*\n(\s+\w+:)/g, '\n$1'); // between properties
      // Ensure closing brace lines are directly after last property (no extra blank line)
      rebuilt = rebuilt.replace(/,\n\n(\s*})/g, ',\n$1');
      // Remove blank line after closing brace/comma before next object
      rebuilt = rebuilt.replace(/},\n\n(\s*{)/g, '},\n$1');
      // Remove blank line before closing brace if any
      rebuilt = rebuilt.replace(/\n\n(\s*})/g, '\n$1');
      // Ensure each object starts with baseIndent (simple pass)
      rebuilt = rebuilt.replace(/^(\s*){(?=\n)/gm, baseIndent + '{');
      return m.replace(inner, rebuilt);
    });
    tree.overwrite(WIDGET_SERVICE, updated);
    return tree;
  };
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

function escapeSingle(str) { return str.replace(/'/g, `\\'`); }

exports.createHost2Widget = createHost2Widget;
function stripTemplateSuffixRule(widgetFolder) {
  return (tree) => {
    // Recursively visit widget folder and strip .template suffix
    const visit = (dirPath) => {
      const dir = tree.getDir(dirPath);
      // Process files
      dir.subfiles.forEach(fileName => {
        if (fileName.endsWith('.template')) {
          const fullPath = `${dirPath}/${fileName}`;
          const newPath = fullPath.replace(/\.template$/, '');
          const content = tree.read(fullPath);
          if (content) {
            if (!tree.exists(newPath)) tree.create(newPath, content);
            tree.delete(fullPath);
          }
        }
      });
      // Recurse into subdirectories
      dir.subdirs.forEach(sub => visit(`${dirPath}/${sub}`));
    };
    if (tree.getDir(widgetFolder)) {
      visit(widgetFolder);
    }
    return tree;
  };
}

