const { apply, url, template, move, mergeWith, chain, noop } = require('@angular-devkit/schematics');
const { strings } = require('@angular-devkit/core');
const { appendImport, updateComponentMap, insertDefinitionObject } = require('./utils/formatting');

const WIDGETS_DIR = 'src/app/widgets';
const WIDGET_SERVICE = 'src/app/core/services/widget.service.ts';

function createHost2Widget(options) {
  return (tree, ctx) => {
    // Normalize final decision: registerWidget = 'no' skips service update
    const registerMode = options.registerWidget === undefined ? 'Core' : options.registerWidget; // default
    options.registerWidget = registerMode; // ensure downstream templates can access

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
      registerMode !== 'no' ? updateWidgetService(selector, className, { ...options, category: options.category || registerMode }) : noop(),
      logSummary(selector, className, registerMode)
    ])(tree, ctx);
  };
}

function logSummary(selector, className, registerMode) {
  return (_t, ctx) => {
    ctx.logger.info(`✔ Created ${selector} (${className})`);
    if (registerMode !== 'no') ctx.logger.info('✔ WidgetService updated');
  };
}

function updateWidgetService(selector, className, opts) {
  return (tree, ctx) => {
    if (!tree.exists(WIDGET_SERVICE)) {
      ctx.logger.warn('WidgetService not found; skipping auto-registration');
      return tree;
    }
    let updated = tree.read(WIDGET_SERVICE).toString('utf-8');
    const importStatement = `import { ${className} } from '../../widgets/${selector}/${selector}.component';`;
    updated = appendImport(updated, importStatement);
    updated = updateComponentMap(updated, className);
    updated = insertDefinitionObject(updated, selector, className, {
      title: opts.title,
      description: opts.description,
      icon: opts.icon,
      category: opts.category,
      minWidth: opts.minWidth,
      minHeight: opts.minHeight,
      defaultWidth: opts.defaultWidth,
      defaultHeight: opts.defaultHeight,
    });
    tree.overwrite(WIDGET_SERVICE, updated);
    return tree;
  };
}

function stripTemplateSuffixRule(widgetFolder) {
  return (tree) => {
    const visit = (dirPath) => {
      const dir = tree.getDir(dirPath);
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
      dir.subdirs.forEach(sub => visit(`${dirPath}/${sub}`));
    };
    if (tree.getDir(widgetFolder)) visit(widgetFolder);
    return tree;
  };
}

exports.createHost2Widget = createHost2Widget;

