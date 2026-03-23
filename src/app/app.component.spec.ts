import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { AppComponent } from './app.component';
import { AppNetworkInitService } from './core/services/app-initNetwork.service';

describe('AppComponent', () => {
  const appNetworkInitServiceStub = {
    bootstrapStatus$: new BehaviorSubject<'starting' | 'ready' | 'degraded'>('ready'),
    bootstrapIssue$: new BehaviorSubject({ reason: 'none' }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: AppNetworkInitService, useValue: appNetworkInitServiceStub },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
