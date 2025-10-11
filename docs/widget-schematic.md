## Host2 Widget Schematic

Use the custom schematic to scaffold a new Host2 architecture widget.

### Command

```
npx schematics ./tools/schematics/collection.json:create-host2-widget \
  --name speed-over-ground \
  --title "Speed Over Ground" \
  --description "Displays SOG from navigation.speedOverGround" \
  --icon navigation-speed \
  --path-key numericPath \
  --path-description "Speed Over Ground" \
  --convert-unit-to knots \
  --sample-time 1000 \
  --register-widget Core
```

Only the required flags are `--name`, `--title`, `--description`, and `--icon` when running non-interactively. By default `--dry-run=false` is applied via the npm script.

### Prompting Behavior

The schematic now uses Angular schema `x-prompt` for both required and optional fields.

Modes:
1. Non-interactive (default when values supplied or CLI run without `--interactive`): Only missing required fields will prompt; others use defaults.
2. Interactive (`--interactive` or `--interactive=true`): Prompts sequentially for every field (required + optional) unless you provided it on the command line.

Flag naming: CLI flags must be kebab-case. Each dashed flag maps to camelCase schema properties (e.g. `--register-widget` → `registerWidget`, `--sample-time` → `sampleTime`). Using camelCase directly (e.g. `--registerWidget`) will fail with an "Unknown argument" error.

Examples:
```
# Minimal required (will prompt for any missing among required)
npm run generate:widget -- --name depth --title Depth --description "Shows depth" --icon depth-icon --register-widget Core

# Full guided session (asks optional too)
npm run generate:widget -- --interactive --name aws --title "Apparent Wind" --description "Displays apparent wind" --icon wind --register-widget Core

# Skip service registration
npm run generate:widget -- --name scratch --title Scratch --description "Sandbox" --icon placeholder --register-widget no
```

### Important Options (subset)

| Option | Default | Notes |
| ------ | ------- | ----- |
| name | (none) | Kebab-case base name without `widget-` prefix |
| title | (none) | Display name inserted into widget definition |
| description | (none) | One-line description for registry |
| icon | (none) | Icon key placeholder (replace later) |
| category | Core | One of Core, Gauge, Component, Racing |
| pathKey (flag: --path-key) | signalKPath | Internal key used for data stream observation |
| pathDescription (flag: --path-description) | My Path | Shown in config UIs (future) |
| pathType (flag: --path-type) | number | number|string|boolean|Date |
| convertUnitTo (flag: --convert-unit-to) | unitless | Target display unit (UnitsService) |
| sampleTime (flag: --sample-time) | 1000 | ms between sampled updates |
| registerWidget (flag: --register-widget) | (none) | Category (Core/Gauge/Component/Racing) or 'no' to skip service update |
| addSpec | true | Generates a basic host test wrapper spec |
| readme | true | Emits README.md with scaffold notes |
| interactive | false | Use `--interactive` to have the CLI ask for any values you did not supply |

### What Gets Generated

```
src/app/widgets/widget-<name>/<name>.component.ts
src/app/widgets/widget-<name>/<name>.component.html
src/app/widgets/widget-<name>/<name>.component.scss
src/app/widgets/widget-<name>/<name>.component.spec.ts (if --addSpec)
src/app/widgets/widget-<name>/README.md (if --readme)
```

If `registerWidget` is not set to `no`, the schematic also updates `WidgetService`:
1. Adds an import for the new component.
2. Adds the component class to `_componentTypeMap`.
3. Inserts a widget definition object into `_widgetDefinition` (automatically ordered within its category).

### After Generation Checklist

- Replace placeholder `icon` in the widget definition with a real SVG symbol id.
- Adjust `DEFAULT_CONFIG.paths` if you need multiple paths (add entries & observers in one `untracked` block).
- Implement formatting / unit display logic using existing helper services if needed.
- Flesh out the spec with domain assertions (current spec only verifies instantiation).

### Removing a Generated Widget

Manual cleanup steps:
1. Delete the folder `src/app/widgets/widget-<name>`.
2. Remove the import, map entry, and definition block for the widget from `WidgetService`.

### Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| Duplicate README like `README<name>.md` | Older schematic version left name in filename | Delete the redundant file & upgrade schematic (already fixed) |
| Widget already exists error | Folder collision | Choose a different `--name` or delete the existing widget |
| No WidgetService update | Service path changed | Adjust `WIDGET_SERVICE` constant in schematic factory |

### Development Notes

- Template sources end with `.template`; a post-processing rule strips the suffix for final emission.
- Config UI generation was intentionally removed; future re-introduction would require new templates.
