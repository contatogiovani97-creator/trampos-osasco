import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { TabsPageModule } from './tabs.module';
import { TabsPage } from './tabs.page';

describe('TabsPage', () => {
  let component: TabsPage;
  let fixture: ComponentFixture<TabsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabsPageModule, RouterModule.forRoot([])],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('places the publish button in the center of the bottom navigation', () => {
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('ion-tab-bar ion-tab-button'),
      (button: Element) => button.getAttribute('tab'),
    );

    expect(tabs).toEqual(['tab1', 'tab2', 'tab3', 'messages', 'account']);
  });
});
