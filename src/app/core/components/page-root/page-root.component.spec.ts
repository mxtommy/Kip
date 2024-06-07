import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PageRootComponent } from './page-root.component';

describe('PagesComponent', () => {
  let component: PageRootComponent;
  let fixture: ComponentFixture<PageRootComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
    imports: [PageRootComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PageRootComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
