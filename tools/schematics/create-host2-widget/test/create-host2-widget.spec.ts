import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { Tree } from '@angular-devkit/schematics';
import * as path from 'path';

// Path to collection.json
const collectionPath = path.join(__dirname, '..', 'collection.json').replace(/test\/[.][.]/, '..');

describe('create-host2-widget schematic', () => {
  const runner = new SchematicTestRunner('kip-schematics', collectionPath);
  let appTree: UnitTestTree;

  beforeEach(() => {
    // Minimal host tree with widget.service.ts skeleton to exercise mutations
  appTree = new UnitTestTree(Tree.empty());
    appTree.create('src/app/core/services/widget.service.ts', `import { Type } from '@angular/core';\nexport interface WidgetDescription { selector: string; componentClassName: string; category: string; name: string; description: string; icon: string; minWidth: number; minHeight: number; defaultWidth: number; defaultHeight: number; requiredPlugins: string[]; }\nexport class WidgetService {\n  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n  private readonly _componentTypeMap: Record<string, Type<any>> = {\n  };\n  private readonly _widgetDefinition: readonly WidgetDescription[] = [\n  ];\n}`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function run(options: Record<string, any>) {
    return runner.runSchematic('create-host2-widget', {
      name: 'alpha', title: 'Alpha', registerWidget: 'Core',
      pathType: 'number', pathDefault: null, ignoreZones: false,
      addSpec: false, todoBlock: false, readme: false,
      ...options
    }, appTree);
  }

  it('generates widget files', async () => {
    const tree = await run({});
    expect(tree.exists('src/app/widgets/widget-alpha/widget-alpha.component.ts')).toBeTrue();
  });

  it('updates service: import, map, definition', async () => {
    const tree = await run({});
    const service = tree.read('src/app/core/services/widget.service.ts')!.toString('utf-8');
    expect(service).toContain("import { WidgetAlphaComponent } from '../../widgets/widget-alpha/widget-alpha.component'");
    expect(service).toMatch(/_componentTypeMap[\s\S]*WidgetAlphaComponent: WidgetAlphaComponent/);
    expect(service).toMatch(/selector: 'widget-alpha'/);
  });

  it('inserts second widget in same category after first', async () => {
    let tree = await run({});
    appTree = tree; // carry over
    tree = await run({ name: 'beta', title: 'Beta' });
    const service = tree.read('src/app/core/services/widget.service.ts')!.toString('utf-8');
    const alphaIdx = service.indexOf("selector: 'widget-alpha'");
    const betaIdx = service.indexOf("selector: 'widget-beta'");
    expect(alphaIdx).toBeGreaterThan(-1);
    expect(betaIdx).toBeGreaterThan(-1);
    expect(betaIdx).toBeGreaterThan(alphaIdx); // inserted after
  });

  it('is idempotent (running with same name does not duplicate)', async () => {
    let tree = await run({});
    appTree = tree;
    tree = await run({});
    const service = tree.read('src/app/core/services/widget.service.ts')!.toString('utf-8');
    const occurrences = (service.match(/selector: 'widget-alpha'/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('skips registration when registerWidget = no', async () => {
    const tree = await run({ name: 'gamma', title: 'Gamma', registerWidget: 'no' });
    const service = tree.read('src/app/core/services/widget.service.ts')!.toString('utf-8');
    expect(service).not.toContain('WidgetGammaComponent');
    expect(service).not.toContain("selector: 'widget-gamma'");
    // component file still generated
    expect(tree.exists('src/app/widgets/widget-gamma/widget-gamma.component.ts')).toBeTrue();
  });
});
