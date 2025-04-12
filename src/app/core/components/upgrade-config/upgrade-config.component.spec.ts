import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpgradeConfigComponent } from './upgrade-config.component';

describe('UpgradeConfigComponent', () => {
  let component: UpgradeConfigComponent;
  let fixture: ComponentFixture<UpgradeConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpgradeConfigComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpgradeConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
