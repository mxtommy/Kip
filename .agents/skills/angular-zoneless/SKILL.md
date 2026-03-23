---
name: angular-zoneless
description: Migrate Angular applications from zone.js to zoneless change detection. Use for removing zone dependencies, enabling provideZonelessChangeDetection(), updating component patterns, removing NgZone APIs, handling SSR with PendingTasks, and testing zoneless applications. Triggers on enabling zoneless mode, refactoring zone-dependent code, migrating from ZoneJS-based patterns, or implementing SSR in zoneless apps.
---

# Angular Zoneless Change Detection

Migrate applications from zone.js to zoneless change detection for better performance, smaller bundles, and improved debugging.

## Why Use Zoneless?

- **Improved performance**: ZoneJS triggers change detection unnecessarily; zoneless only runs when state actually changes
- **Better Core Web Vitals**: Removes payload size and startup time overhead
- **Improved debugging**: Stack traces are cleaner; easier to understand when and why code breaks
- **Better ecosystem compatibility**: Eliminates API patching issues and incompatibilities with modern async patterns

## Enabling Zoneless

### Angular v21+

Zoneless is the **default** in v21+. Verify that `provideZoneChangeDetection()` is NOT used anywhere.

### Angular v20

Enable zoneless by adding `provideZonelessChangeDetection()` at bootstrap:

#### Standalone Bootstrap

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    // ... other providers
  ]
});
```

#### NgModule Bootstrap

```typescript
import { platformBrowser } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppModule } from './app/app.module';

@NgModule({
  providers: [provideZonelessChangeDetection()],
})
export class AppModule {}

platformBrowser().bootstrapModule(AppModule);
```

## Removing ZoneJS

### Remove from angular.json

In `angular.json`, remove `zone.js` and `zone.js/testing` from polyfills:

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "options": {
            "polyfills": [
              // Remove "zone.js" from here
            ]
          }
        },
        "test": {
          "options": {
            "polyfills": [
              // Remove "zone.js/testing" from here
            ]
          }
        }
      }
    }
  }
}
```

### Remove from polyfills.ts

If using an explicit `polyfills.ts` file, remove:

```typescript
// DELETE THESE LINES:
// import 'zone.js';
// import 'zone.js/testing';
```

### Uninstall zone.js

```bash
npm uninstall zone.js
```

## Zoneless Compatibility Requirements

### Use OnPush Change Detection

Recommend `ChangeDetectionStrategy.OnPush` for all components:

```typescript
import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';

@Component({
  selector: 'app-user',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ name() }}</h1>
    <p>{{ description }}</p>
    <button (click)="updateName()">Update</button>
  `,
})
export class UserComponent {
  name = input.required<string>();
  description = signal('');

  updateName() {
    this.description.set('Updated!');
  }
}
```

### Update Triggers: Change Detection Notifications

Zoneless runs change detection when Angular receives notifications:

```typescript
// ✅ SIGNALS (automatic notification)
myState = signal('value');
updateState() {
  myState.set('new value'); // Triggers CD automatically
}

// ✅ markForCheck() with Default strategy
constructor(private cdr: ChangeDetectorRef) {}
updateManually() {
  this.someValue = 'changed';
  this.cdr.markForCheck(); // Notify Angular
}

// ✅ AsyncPipe (automatic notification)
myObservable$ = of('data');
// Template: {{ myObservable$ | async }}

// ✅ Bound host/template listeners
@HostListener('click')
handleClick() {
  // Automatic CD when listener fires
}
```

### Remove NgZone Stability APIs

Remove these NgZone APIs—they don't work zoneless:

```typescript
// ❌ DO NOT USE THESE:
ngZone.onMicrotaskEmpty.subscribe(...)  // Never emits
ngZone.onUnstable.subscribe(...)        // Never emits
ngZone.onStable.subscribe(...)          // Never emits
const isStable = ngZone.isStable;       // Always true

// ✅ USE THESE INSTEAD:

// For single render notification:
import { afterNextRender } from '@angular/core';
afterNextRender(() => {
  // Code runs after next render
});

// For repeated render notifications:
import { afterEveryRender } from '@angular/core';
afterEveryRender(() => {
  // Code runs after every render
});

// For DOM state changes:
const observer = new MutationObserver(() => {
  // Handle DOM changes directly
});
observer.observe(element, { attributes: true, childList: true });
```

### Keep NgZone.run and NgZone.runOutsideAngular

These APIs **do NOT need to be removed** and removing them can cause performance regressions:

```typescript
// ✅ STILL COMPATIBLE AND USEFUL:
ngZone.run(() => {
  // Code inside Angular
  this.state.set('value');
});

ngZone.runOutsideAngular(() => {
  // Code outside Angular (e.g., heavy computations)
  setInterval(() => fasterCalculation(), 100);
});
```

## Reactive Forms in Zoneless

Form model updates (`setValue`, `patchValue`, `FormArray.push`) don't automatically trigger change detection. Update your template or use signals:

```typescript
import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form',
  template: `
    <form [formGroup]="form">
      <input formControlName="name" />
      <p>Name: {{ displayName() }}</p>
    </form>
  `,
  imports: [ReactiveFormsModule],
})
export class FormComponent {
  form = new FormGroup({
    name: new FormControl(''),
  });

  displayName = signal('');

  constructor() {
    // Connect form to signal
    this.form.get('name')?.valueChanges.subscribe((value) => {
      this.displayName.set(value);
    });
  }
}
```

## Server-Side Rendering (SSR) with Zoneless

Use `PendingTasks` to track asynchronous work that must complete before serialization:

### Simple Case: Using run()

```typescript
import { inject } from '@angular/core';
import { PendingTasks } from '@angular/core';

export class DataService {
  private pendingTasks = inject(PendingTasks);

  loadData() {
    this.pendingTasks.run(async () => {
      const data = await fetch('/api/data').then(r => r.json());
      this.state.set(data);
    });
  }
}
```

### Manual Task Management

```typescript
const taskCleanup = this.pendingTasks.add();
try {
  await doSomeWorkThatNeedsToBeRendered();
} catch {
  // Handle error
} finally {
  taskCleanup(); // Mark task complete
}
```

### With RxJS Observables

```typescript
import { pendingUntilEvent } from '@angular/core/rxjs-interop';

readonly myObservableState = someObservable.pipe(
  pendingUntilEvent() // Keeps app unstable until observable completes
);
```

## Testing Zoneless Applications

### Configure TestBed for Zoneless

When `zone.js` is still in polyfills but you want to test zoneless:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MyComponent } from './my.component';

describe('MyComponent (Zoneless)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should update signal and render', async () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.componentInstance.mySignal.set('new value');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('new value');
  });
});
```

### Best Practices

- **Avoid `fixture.detectChanges()`**: Let Angular handle change detection
- **Use `fixture.whenStable()`**: Wait for Angular to stabilize after state changes
- **Signals in tests**: Rely on signal updates to trigger change detection
- **OnPush enforcement**: Tests throw `ExpressionChangedAfterItHasBeenCheckedError` if you bypass change detection

### Debug Mode: Exhaustive Change Detection Checks

Enable debug checks during development to catch missed notifications:

```typescript
import { provideCheckNoChangesConfig } from '@angular/core';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideCheckNoChangesConfig({ exhaustive: true, interval: 100 }), // Every 100ms
  ]
});
```

This periodically checks all bindings and throws `ExpressionChangedAfterItHasBeenCheckedError` if values changed without a notification.

## Migration Checklist

- [ ] Verify Angular version (v20+ supports zoneless)
- [ ] Add `provideZonelessChangeDetection()` at bootstrap (v20 only; default in v21+)
- [ ] Audit components and add `ChangeDetectionStrategy.OnPush`
- [ ] Refactor state to use signals or call `markForCheck()`
- [ ] Remove `NgZone.onMicrotaskEmpty`, `onUnstable`, `onStable`, `isStable` usages
- [ ] Replace with `afterNextRender()`, `afterEveryRender()`, or direct DOM APIs
- [ ] Update reactive forms to connect to signals if needed
- [ ] Add `PendingTasks` handling for SSR/async work
- [ ] Test with debug checks enabled: `provideCheckNoChangesConfig({ exhaustive: true })`
- [ ] Remove `zone.js` from `angular.json` polyfills
- [ ] Remove `import 'zone.js'` from `polyfills.ts` (if exists)
- [ ] Uninstall `zone.js` package
- [ ] Run full test suite
- [ ] Verify performance improvements with production build
