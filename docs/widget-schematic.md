## Host2 Widget Schematic

Use the custom schematic to scaffold a new Host2 architecture widget.

### Command

```
npx schematics ./tools/schematics/collection.json:create-host2-widget \
  --name speed-over-ground \
  --title "Speed Over Ground" \
  --description "Displays SOG from navigation.speedOverGround" \
  --icon navigation-speed \
  --category Core \
  --pathKey numericPath \
  --pathDescription "Speed Over Ground" \
  --convertUnitTo knots \
  --sampleTime 1000
```

Only the required flags are `--name`, `--title`, `--description`, and `--icon`. Others fall back to defaults defined in `schema.json`.

### Important Options (subset)

| Option | Default | Notes |
| ------ | ------- | ----- |
| name | (none) | Kebab-case base name without `widget-` prefix |
| title | (none) | Display name inserted into widget definition |
| description | (none) | One-line description for registry |
| icon | (none) | Icon key placeholder (replace later) |
| category | Core | One of Core, Gauge, Component, Racing |
| pathKey | signalKPath | Internal key used for data stream observation |
| pathDescription | My Path | Shown in config UIs (future) |
| pathType | number | number|string|boolean|Date |
| convertUnitTo | unitless | Target display unit (UnitsService) |
| sampleTime | 1000 | ms between sampled updates |
| updateWidgetService | by-category | Append or insert by category ordering |
| addSpec | true | Generates a basic host test wrapper spec |
| readme | true | Emits README.md with scaffold notes |

### What Gets Generated

```
src/app/widgets/widget-<name>/<name>.component.ts
src/app/widgets/widget-<name>/<name>.component.html
src/app/widgets/widget-<name>/<name>.component.scss
src/app/widgets/widget-<name>/<name>.component.spec.ts (if --addSpec)
src/app/widgets/widget-<name>/README.md (if --readme)
```

The schematic also updates `WidgetService`:
1. Adds an import for the new component.
2. Adds the component class to `_componentTypeMap`.
3. Inserts a widget definition object into `_widgetDefinition` (in-category ordering when `by-category`).

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
