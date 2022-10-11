import { TestBed } from '@angular/core/testing';

import { AuththeticationService } from './auththetication.service';

describe('AuththeticationService', () => {
  let service: AuththeticationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuththeticationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
