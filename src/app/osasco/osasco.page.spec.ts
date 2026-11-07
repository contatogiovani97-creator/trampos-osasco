import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Timestamp } from 'firebase/firestore';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { OsascoPost } from '../core/models/osasco-community.models';
import { OsascoPageModule } from './osasco.module';
import { OsascoPage } from './osasco.page';

describe('OsascoPage', () => {
  let component: OsascoPage;
  let fixture: ComponentFixture<OsascoPage>;
  let publishedPosts: OsascoPost[];

  beforeEach(async () => {
    publishedPosts = [{
      id: 'event-1',
      type: 'event',
      title: 'Feira comunitária',
      summary: 'Feira aberta para os moradores da região.',
      sourceName: '',
      sourceUrl: '',
      startsAt: Timestamp.fromDate(new Date('2027-01-01T10:00:00')),
      venue: 'Praça central',
      neighborhood: 'Centro',
      homeTeam: '',
      awayTeam: '',
      publishedAt: Timestamp.fromDate(new Date('2026-12-01T10:00:00')),
      createdAt: Timestamp.fromDate(new Date('2026-11-30T10:00:00')),
    }];

    await TestBed.configureTestingModule({
      imports: [OsascoPageModule, RouterModule.forRoot([])],
      providers: [{
        provide: MarketplaceBackendService,
        useValue: {
          isConfigured: true,
          currentUser: () => ({ uid: 'user-1' }),
          getPublishedOsascoPosts: async () => publishedPosts,
          toUserMessage: (error: unknown) => String(error),
        },
      }],
    }).compileComponents();

    fixture = TestBed.createComponent(OsascoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads published posts for the selected category', async () => {
    await component.loadPosts();
    fixture.detectChanges();

    expect(component.posts()).toEqual(publishedPosts);
    expect(fixture.nativeElement.textContent).toContain('Feira comunitária');
  });

  it('does not show user suggestion controls', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Sugerir');
    expect(fixture.nativeElement.textContent).not.toContain('Enviar sugestão');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows a centered page title without an Início back button', () => {
    const title = fixture.nativeElement.querySelector('ion-header ion-title') as HTMLElement | null;

    expect(title?.textContent?.trim()).toBe('Acontece em Osasco');
    expect(fixture.nativeElement.querySelector('ion-header ion-back-button')).toBeNull();
  });
});
