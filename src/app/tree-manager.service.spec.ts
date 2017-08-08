import { TestBed, inject } from '@angular/core/testing';

import { TreeManagerService } from './tree-manager.service';

describe('TreeManagerServiceService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TreeManagerService]
    });
  });

  it('should be created', inject([TreeManagerService], (service: TreeManagerService) => {
    expect(service).toBeTruthy();
  }));
});
