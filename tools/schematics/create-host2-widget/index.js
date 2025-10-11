const { apply, url, template, move, mergeWith, chain, noop } = require('@angular-devkit/schematics');
const { strings } = require('@angular-devkit/core');
const { appendImport, updateComponentMap, insertDefinitionObject } = require('./utils/formatting');

const WIDGETS_DIR = 'src/app/widgets';
const WIDGET_SERVICE = 'src/app/core/services/widget.service.ts';

function createHost2Widget(options) {
  return (tree, ctx) => {
    const debug = !!options.debugLogging;
    if (debug) ctx.logger.info('[widget-schematic] Raw options input: ' + JSON.stringify(options));
    if (debug) ctx.logger.info('[widget-schematic] Using schema x-prompt only (no inquirer).');
    // Normalize registerWidget (case-insensitive). 'no' => skip service update.
    const rawReg = (options.registerWidget || '').trim();
    const lower = rawReg.toLowerCase();
    const skip = lower === 'no';
    const normalizedCategory = skip ? 'no' : capitalizeCategory(lower);
    if (debug) ctx.logger.info(`[widget-schematic] registerWidget raw='${rawReg}' lower='${lower}' => normalized='${normalizedCategory}' skip=${skip}`);

    const nameDashed = strings.dasherize(options.name);
    const selector = `widget-${nameDashed}`;
    const className = `Widget${strings.classify(options.name)}Component`;
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
        zonesSupport: !!options.zonesSupport,
        // Hidden defaults
        convertUnitTo: null,
        sampleTime: 1000,
        icon: 'placeholder-icon',
        description: 'TODO: Add description',
      }),
      move(widgetFolder)
    ]);
    const commonTemplateCtx = { ...strings, ...options, nameDashed, selector, className, zonesSupport: !!options.zonesSupport };
    const specSource = options.addSpec ? apply(url('./files/spec'), [
      template(commonTemplateCtx), move(widgetFolder)
    ]) : null;
    const readmeSource = options.readme ? apply(url('./files/readme'), [
      template({
        ...commonTemplateCtx,
        convertUnitTo: null,
        sampleTime: 1000,
        icon: 'placeholder-icon',
        description: 'TODO: Add description'
      }), move(widgetFolder)
    ]) : null;

    return chain([
      mergeWith(tplSource),
      specSource ? mergeWith(specSource) : noop(),
      readmeSource ? mergeWith(readmeSource) : noop(),
      stripTemplateSuffixRule(widgetFolder),
      !skip ? updateWidgetService(selector, className, { ...options, category: normalizedCategory, debugLogging: debug }) : noop(),
      logSummary(selector, className, normalizedCategory)
    ])(tree, ctx);
  };
}

function logSummary(selector, className, registerMode) {
  return (_t, ctx) => {
    ctx.logger.info(`✔ Created ${selector} (${className})`);
    if (registerMode !== 'no') ctx.logger.info('✔ WidgetService updated');
    else ctx.logger.info('ℹ Skipped WidgetService update (registerWidget=no)');
  };
}

function capitalizeCategory(lower) {
  switch (lower) {
    case 'core': return 'Core';
    case 'gauge': return 'Gauge';
    case 'component': return 'Component';
    case 'racing': return 'Racing';
    default: return lower; // includes 'no' or any unexpected value
  }
}

function updateWidgetService(selector, className, opts) {
  return (tree, ctx) => {
    if (!tree.exists(WIDGET_SERVICE)) {
      ctx.logger.warn('WidgetService not found; skipping auto-registration');
      return tree;
    }
    if (opts.debugLogging) ctx.logger.info('[widget-schematic] Updating WidgetService for ' + className);
    let updated = tree.read(WIDGET_SERVICE).toString('utf-8');
    const importStatement = `import { ${className} } from '../../widgets/${selector}/${selector}.component';`;
    updated = appendImport(updated, importStatement);
    if (opts.debugLogging) ctx.logger.info('[widget-schematic] After import insertion.');
    updated = updateComponentMap(updated, className);
    if (opts.debugLogging) ctx.logger.info('[widget-schematic] After component map update.');
    updated = insertDefinitionObject(updated, selector, className, {
      title: opts.title || opts.name || className,
      description: "TODO: Add description. Description is found in the item related to your widget as an item in array _widgetDefinition, found in file src/app/core/services/widget.service.ts. In this file you can also set the widget icon and other properties.",
      icon: 'placeholder-icon', // TODO: Replace with proper icon key when you add an icon. See file src/assets/svg/icons.svg
      category: opts.category || 'Core',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
    });
    if (opts.debugLogging) ctx.logger.info('[widget-schematic] After definition insertion.');
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

