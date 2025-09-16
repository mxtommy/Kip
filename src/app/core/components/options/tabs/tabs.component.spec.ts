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
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
