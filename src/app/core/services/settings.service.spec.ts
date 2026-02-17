import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SettingsService]
    });
  });

  it('should be created', () => {
    const service = TestBed.inject(SettingsService);
    expect(service).toBeTruthy();
  });
});
