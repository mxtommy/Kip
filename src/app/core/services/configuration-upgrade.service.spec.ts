import { TestBed } from '@angular/core/testing';

import { ConfigurationUpgradeService } from './configuration-upgrade.service';

describe('ConfigurationUpgradeService', () => {
  let service: ConfigurationUpgradeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfigurationUpgradeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
