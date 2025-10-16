import { TestBed } from '@angular/core/testing';
import { AppSettingsService } from './app-settings.service';

describe('AppSettingsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppSettingsService]
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(AppSettingsService);
    expect(service).toBeTruthy();
  });
});
