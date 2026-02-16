import { TestBed } from '@angular/core/testing';
import { AppHelpComponent } from './app-help.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApplicationRef, Component } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { BehaviorSubject } from 'rxjs';

type NavArgs = [unknown]; // minimal tuple placeholder for single-arg navigate signature used
class MockRouter { navigateCalls: NavArgs[] = []; navigate(commands: unknown[]): void { this.navigateCalls.push([commands]); } }
class MockActivatedRoute {
  private readonly _paramMap = new BehaviorSubject(convertToParamMap({}));
  readonly paramMap = this._paramMap.asObservable();

  setPage(page: string | null): void {
    this._paramMap.next(page ? convertToParamMap({ page }) : convertToParamMap({}));
  }
}

// Minimal stub replacing <markdown [src]="..."> usage so we avoid real MarkdownService dependency
@Component({
  selector: 'markdown',
  standalone: true,
  template: '<ng-content></ng-content>'
})
class MarkdownStubComponent {}

describe('AppHelpComponent', () => {
  let component: AppHelpComponent;
  let fixture: import('@angular/core/testing').ComponentFixture<AppHelpComponent>;
  let router: MockRouter;
  let activatedRoute: MockActivatedRoute;
  let httpMock: HttpTestingController;
  let appRef: ApplicationRef;

  const mockMenu = [
    {
      title: 'Group A',
      items: [
        { title: 'Intro', file: 'intro.md' },
        { title: 'Ignored', file: 'image.png' } // non-md filtered out
      ]
    },
    { title: 'Usage', file: 'usage.md' }
  ];

  beforeEach(async () => {
    router = new MockRouter();
    activatedRoute = new MockActivatedRoute();
    await TestBed.configureTestingModule({
      imports: [AppHelpComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRoute },
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    })
      .overrideComponent(AppHelpComponent, {
        set: {
          // Re-declare only needed imports without real MarkdownComponent
          imports: [MatButtonModule, MatMenuModule, MatDividerModule, MatIconModule, MarkdownStubComponent],
          // Simplified template (no <markdown> usage) to focus on logic
          template: `
          <div class="fullpage-header">
            <h6 class="fullpage-header-title">{{ pageTitle }}</h6>
            <button mat-flat-button [matMenuTriggerFor]="helpMenu" [disabled]="isLoading() || hasError() || helpFiles().length === 0">
              @if (isLoading()) { Loading... } @else { Table of Content }
            </button>
            <mat-menu #helpMenu="matMenu">
              <ng-template matMenuContent>
                @if (hasError()) {
                  <button mat-menu-item disabled>Error loading menu</button>
                } @else if (!isLoading() && helpFiles().length === 0) {
                  <button mat-menu-item disabled>No help entries</button>
                } @else {
                  @for (file of helpFiles(); track file.file) {
                    <button mat-menu-item (click)="selectFile(file.file)" [disabled]="selectedFile() === file.file">
                      {{ file.title }}
                    </button>
                  }
                }
              </ng-template>
            </mat-menu>
            <button mat-icon-button class="dialog-close-icon" (click)="closePage()" aria-label="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <mat-divider></mat-divider>
          @if (hasError()) {
            <div class="markdown-content">Unable to load help content.</div>
          } @else if (isLoading() && helpFiles().length === 0) {
            <div class="markdown-content">Loading help...</div>
          } @else if (selectedFile()) {
            <div class="markdown-content">Selected: {{ selectedFile() }}</div>
          }`
        }
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture = TestBed.createComponent(AppHelpComponent); // httpResource constructed eagerly
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  function expectFiles(expected: string[]) {
    const files = component['helpFiles']();
    expect(files.map(f => f.file)).toEqual(expected);
  }

  async function flushMenu(res: unknown = mockMenu) {
    const req = httpMock.expectOne('assets/help-docs/menu.json');
    expect(req.request.method).toBe('GET');
    req.flush(res);
    await appRef.whenStable(); // propagate to resource signals
    fixture.detectChanges();
  }

  it('should create', async () => {
    fixture.detectChanges();
    await flushMenu();
    expect(component).toBeTruthy();
  });

  it('should fetch and filter .md help files', async () => {
    fixture.detectChanges();
    await flushMenu();
    expectFiles(['intro.md', 'usage.md']);
  });

  it('should auto-select first file after load', async () => {
    fixture.detectChanges();
    await flushMenu();
    expect(component['selectedFile']()).toBe('intro.md');
  });

  it('should allow selecting another file', async () => {
    fixture.detectChanges();
    await flushMenu();
    component['selectFile']('usage.md');
    expect(component['selectedFile']()).toBe('usage.md');
    expect(router.navigateCalls[0][0]).toEqual(['/help', 'usage']);
  });

  it('should use route page parameter to select help file', async () => {
    activatedRoute.setPage('usage');
    fixture.detectChanges();
    await flushMenu();
    expect(component['selectedFile']()).toBe('usage.md');
  });

  it('should expose error state on failure', async () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('assets/help-docs/menu.json');
    req.flush('fail', { status: 500, statusText: 'Server Error' });
    await appRef.whenStable();
    fixture.detectChanges();
    expect(component['hasError']()).toBeTrue();
    expect(component['helpFiles']().length).toBe(0);
  });

  it('should navigate to dashboard on closePage', async () => {
    fixture.detectChanges();
    await flushMenu();
    component['closePage']();
    expect(router.navigateCalls.length).toBe(1);
    expect(router.navigateCalls[0][0]).toEqual(['/dashboard']);
  });
});
