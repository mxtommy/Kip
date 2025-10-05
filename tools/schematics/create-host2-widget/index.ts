import {
  Rule, SchematicContext, Tree, apply, url, template, move, mergeWith, chain, noop
} from '@angular-devkit/schematics';
import { strings } from '@angular-devkit/core';

interface Options {
  name: string; title: string; description: string; category: string; icon: string;
  minWidth: number; minHeight: number; defaultWidth: number; defaultHeight: number;
  pathKey: string; pathDescription: string; pathType: string; pathDefault: string | null; convertUnitTo: string;
  sampleTime: number; pathRequired: boolean; isPathConfigurable: boolean; showPathSkUnitsFilter: boolean; pathSkUnitsFilter: string | null;
  enableTimeout: boolean; dataTimeout: number; ignoreZones: boolean; displayNameOpt: string; color: string;
  updateWidgetService: 'none' | 'append' | 'by-category'; addSpec: boolean; todoBlock: boolean; readme: boolean; interactive: boolean;
}

const WIDGETS_DIR = 'src/app/widgets';
const WIDGET_SERVICE = 'src/app/core/services/widget.service.ts';

export function createHost2Widget(options: Options): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    const nameDashed = strings.dasherize(options.name);
    const selector = `widget-${nameDashed}`;
    const className = `Widget${strings.classify(options.name)}Component`;
    const configClassName = `Widget${strings.classify(options.name)}ConfigComponent`; // retained for placeholder interpolation if templates expect it
    const widgetFolder = `${WIDGETS_DIR}/${selector}`;
    if (tree.exists(`${widgetFolder}/${selector}.component.ts`)) {
      throw new Error(`Widget already exists: ${selector}`);
    }

    const tplSource = apply(url('./files/widget'), [
      template({
        ...strings,
        ...options,
        nameDashed,
        selector,
        className,
        pathKey: options.pathKey,
        configClassName
      }),
      move(widgetFolder)
    ]);

    const specSource = options.addSpec ? apply(url('./files/spec'), [
      template({ ...strings, ...options, nameDashed, selector, className }),
      move(widgetFolder)
    ]) : null;

    const readmeSource = options.readme ? apply(url('./files/readme'), [
      template({ ...strings, ...options, nameDashed, selector, className }),
      move(widgetFolder)
    ]) : null;

    return chain([
      mergeWith(tplSource),
      specSource ? mergeWith(specSource) : noop(),
      readmeSource ? mergeWith(readmeSource) : noop(),
      options.updateWidgetService !== 'none' ? updateWidgetService(selector, className, options) : noop(),
      logSummary(selector, className, options)
    ])(tree, ctx);
  };
}

function logSummary(selector: string, className: string, opts: Options): Rule {
  return (_t, ctx) => {
    ctx.logger.info(`✔ Created ${selector} (${className})`);
    if (opts.updateWidgetService !== 'none') ctx.logger.info('✔ WidgetService updated');
  };
}

function updateWidgetService(selector: string, className: string, opts: Options): Rule {
  return (tree: Tree, ctx: SchematicContext) => {
    if (!tree.exists(WIDGET_SERVICE)) {
      ctx.logger.warn('WidgetService not found; skipping auto-registration');
      return tree;
    }
    const src = tree.read(WIDGET_SERVICE)!.toString('utf-8');
    // SourceFile and printer not required for current string-based transforms

    // Insert import
    const importStatement = `import { ${className} } from '../../widgets/${selector}/${selector}.component';`;
    let updated = src.includes(importStatement) ? src : importStatement + '\n' + src;

    // Update _componentTypeMap
    const mapPattern = /_componentTypeMap: Record<string, Type<any>> = {([\s\S]*?)};/m;
    updated = updated.replace(mapPattern, (m, inner) => {
      if (inner.includes(className + ':')) return m; // already present
      const insertion = `    ${className}: ${className},\n`;
      return m.replace(inner, inner + insertion);
    });

    // Insert widget definition object into _widgetDefinition array respecting category ordering if by-category
    const defArrayPattern = /private readonly _widgetDefinition: readonly WidgetDescription\[] = \[(\s*[\s\S]*?)\n\s*\];/m;
    updated = updated.replace(defArrayPattern, (m, inner) => {
      if (inner.includes(`selector: '${selector}'`)) return m; // already there
      const defObj = buildWidgetDefinitionObject(selector, className, opts);
      if (opts.updateWidgetService === 'append') {
        return m.replace(inner, inner + defObj + '\n');
      }
      // by-category: find last occurrence of category
      const catRegex = new RegExp(`category: '${opts.category}'[\u0000-\uFFFF]*?selector: '([A-Za-z0-9-]+)'`, 'g');
      let lastIndex = -1; let match: RegExpExecArray | null;
      while ((match = catRegex.exec(inner)) !== null) {
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex === -1) {
        // category not found (unlikely) -> append
        return m.replace(inner, inner + defObj + '\n');
      }
      // splice defObj after lastIndex
      return m.replace(inner, inner.slice(0, lastIndex) + '\n    ' + defObj.trim() + inner.slice(lastIndex));
    });

    tree.overwrite(WIDGET_SERVICE, updated);
    return tree;
  };
}

function buildWidgetDefinitionObject(selector: string, className: string, opts: Options): string {
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

function escapeSingle(str: string): string { return str.replace(/'/g, `\\'`); }
