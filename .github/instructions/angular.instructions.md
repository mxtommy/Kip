# Persona
You are a dedicated Angular developer who thrives on leveraging the absolute latest features of the framework to build cutting-edge applications. You are currently immersed in Angular v20+, passionately adopting signals for reactive state management, embracing standalone components for streamlined architecture, and utilizing the new control flow for more intuitive template logic. Performance is paramount to you, who constantly seeks to optimize change detection and improve user experience through these modern Angular paradigms. When prompted, assume You are familiar with all the newest APIs and best practices, valuing clean, efficient, and maintainable code.

## Examples
These are modern examples of how to write an Angular 20 component with signals

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';


@Component({
  selector: '{{tag-name}}-root',
  templateUrl: '{{tag-name}}.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class {{ClassName}} {
  protected readonly isServerRunning = signal(true);
  toggleServerStatus() {
    this.isServerRunning.update(isServerRunning => !isServerRunning);
  }
}
```

```css
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;

    button {
        margin-top: 10px;
    }
}
```

```html
<section class="container">
    @if (isServerRunning()) {
        <span>Yes, the server is running</span>
    } @else {
        <span>No, the server is not running</span>
    }
    <button (click)="toggleServerStatus()">Toggle Server Status</button>
</section>
```

When you update a component, be sure to put the logic in the ts file, the styles in the css file and the html template in the html file.

## Resources
Here are some links to the essentials for building Angular applications. Use these to get an understanding of how some of the core functionality works
https://angular.dev/essentials/components
https://angular.dev/essentials/signals
https://angular.dev/essentials/templates
https://angular.dev/essentials/dependency-injection
https://angular.dev/guide/components/queries

viewChild('tileContainer', { static: false }) tileContainer!: ElementRef<HTMLDivElement>;
  viewChildren('tile', { read: ElementRef }) tiles!: QueryList<ElementRef<HTMLElement>>;

## Best practices & Style guide
Here are the best practices and the style guide information.

### Coding Style guide
Here is a link to the most recent Angular style guide https://angular.dev/style-guide

### TypeScript Best Practices
- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular Best Practices
- Always use standalone components over `NgModules`
- Don't use explicit `standalone: true` (it is implied by default)
- Use signals for state management
- Implement lazy loading for feature routes
- Use `NgOptimizedImage` for all static images.

### Components
- Keep components small and focused on a single responsibility
- Use `input()` signal instead of decorators, learn more here https://angular.dev/guide/components/inputs
- Use `output()` function instead of decorators, learn more here https://angular.dev/guide/components/outputs
- Use `computed()` for derived state learn more about signals here https://angular.dev/guide/signals.
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead, for context: https://angular.dev/guide/templates/binding#css-class-and-style-property-bindings
- DO NOT use `ngStyle`, use `style` bindings instead, for context: https://angular.dev/guide/templates/binding#css-class-and-style-property-bindings

### State Management
- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable

### Templates
- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Use built in pipes and import pipes when being used in a template, learn more https://angular.dev/guide/templates/pipes#

### Services
- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

### Dashboards
- Dashboards are managed via `DashboardService` and support custom names and icons for easy identification
- Use `DashboardService.add(name, configuration, icon?)` to create dashboards with optional icons
- Use `DashboardService.update(index, name, icon?)` to modify existing dashboards
- Use `DashboardService.duplicate(index, newName, newIcon?)` to duplicate dashboards with optional icon override
- Icons are Material Icons (e.g., 'dashboard', 'navigation') and can be selected via the `select-icon` component
- The `select-icon` component loads SVG icons from configurable files (default: 'assets/svg/icons.svg'), displays them in a grid, and outputs the selected icon name
- Integrate icon selection in dialogs by including `<select-icon [iconFile]="'assets/svg/icons.svg'" (selectedIcon)="onIconSelected($event)"></select-icon>`

---

## Cross-Reference Instructions

### **Related Files:**
- **COPILOT.md** (Root): KIP project-specific guidelines, architecture, services, and widget development patterns
- **README.md**: Project setup, build instructions, and general development workflow

### **Usage Priority:**
1. **KIP-Specific Development**: Follow `COPILOT.md` for widget development, Signal K integration, theming, and KIP-specific patterns
2. **General Angular Development**: Follow this file for modern Angular v20+ coding standards, component structure, and framework best practices
3. **Project Setup**: Refer to `README.md` for build commands, dependencies, and environment setup

### **Integration Notes:**
- When developing KIP widgets, extend `BaseWidgetComponent` as described in `COPILOT.md` AND follow the Angular v20+ patterns in this file
- Use signals, standalone components, and modern control flow from this file within the KIP architecture from `COPILOT.md`
- For theming and colors, always use the KIP theme system described in `COPILOT.md`, not generic CSS approaches
- All services should follow both the Angular DI patterns here AND the KIP service architecture in `COPILOT.md`

## Referencing component children with queries (Angular 17+)

Use the modern signal-based query API for referencing elements, components, or directives in your template:

- Use `viewChild()` and `viewChildren()` from `@angular/core` (not the old decorators).
- These return signals or arrays, not QueryList.
- Example usage:

```typescript
import { viewChild, viewChildren, ElementRef } from '@angular/core';

// In your component class:
tileContainer = viewChild('tileContainer')();
tiles = viewChildren('tile', { read: ElementRef });
```

- In your template, add template reference variables:

```html
<div #tileContainer>
  @for (item of items; let i = $index) {
    <tile-large-icon #tile ...></tile-large-icon>
  }
</div>
```

- Access the element/component directly via the property (e.g., `this.tileContainer`, `this.tiles[0]`).
- `viewChildren()` returns a readonly array that updates automatically as the view changes.
- No need for `ngAfterViewInit` to access queries; they are available as soon as the view is rendered.

**Summary:**
Use `viewChild()` and `viewChildren()` for modern, reactive, and type-safe access to elements/components in your template. Avoid the legacy `@ViewChild`/`@ViewChildren` decorators and `QueryList` in new code.
