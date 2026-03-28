## Contributing Widgets

KIP widgets are community-powered. If you need a widget that does not exist yet, you can request one from the community or build and contribute it.

## For End Users

- Check [Dashboards and Layout](#/help/dashboards.md) to confirm the current widget catalog.
- Ask in the community first before building from scratch; someone may already have a branch or reusable approach.
- Use [The Embed Page Viewer](#/help/embedwidget.md) when your requirement is best served by an external web dashboard.

## For Developers

Widget creation follows a schematic-first workflow for Host2 widgets.

1. Scaffold with `npm run generate:widget`.
2. Follow schematic flags and examples in `docs/widget-schematic.md`.
3. Apply Host2 implementation patterns and stream wiring guardrails.
4. Add domain assertions to the generated spec before submitting a PR.

Developer references:
- `docs/widget-schematic.md`
- `.github/instructions/project.instructions.md`
- `.agents/skills/kip-widget-creation/SKILL.md`
- `.agents/skills/kip-host2-widget/SKILL.md`

## Contribution Flow

1. Create a feature branch.
2. Generate and implement the widget.
3. Generate and implement the widget test when necessary.
4. Add an svg icon
5. Update README.md and KIP documentation with your plugin information.
6. Validate with lint/tests (ng lint/ng test).
7. Submit a pull request with screenshots and a short behavior summary.

## Notes

- Keep new widget behavior deterministic and path-safe.
- Prefer theme roles and shared formatting helpers.
- Keep docs concise and link to canonical references rather than duplicating option tables.
