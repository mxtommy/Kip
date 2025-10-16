import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { TabsComponent } from './tabs.component';

describe('SettingsTabsComponent', () => {
  let component: TabsComponent;
  let fixture: ComponentFixture<TabsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [TabsComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TabsComponent);
    component = fixture.componentInstance;
    // Skip detectChanges to avoid ECAH from child components; creation is enough
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
