import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { Timestamp } from 'firebase/firestore';

import { UserProfile, WorkOpportunity } from '../core/models/marketplace-account.models';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { Tab1PageModule } from './tab1.module';
import { Tab1Page } from './tab1.page';

describe('Tab1Page', () => {
  let component: Tab1Page;
  let fixture: ComponentFixture<Tab1Page>;
  let publishProfiles: ((profiles: UserProfile[]) => void) | null;
  let publishOpportunities: ((opportunities: WorkOpportunity[]) => void) | null;

  beforeEach(async () => {
    publishProfiles = null;
    publishOpportunities = null;
    await TestBed.configureTestingModule({
      imports: [Tab1PageModule, RouterModule.forRoot([])],
      providers: [{
        provide: MarketplaceBackendService,
        useValue: {
          isConfigured: true,
          currentUser: () => null,
          profile: () => null,
          subscribeToProfiles: (onProfiles: (profiles: UserProfile[]) => void) => {
            publishProfiles = onProfiles;
            return () => undefined;
          },
          subscribeToOpenOpportunities: (onOpportunities: (opportunities: WorkOpportunity[]) => void) => {
            publishOpportunities = onOpportunities;
            return () => undefined;
          },
          toUserMessage: (error: unknown) => String(error),
        },
      }],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab1Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the Osasco logo from the standard app assets directory', () => {
    const image = fixture.nativeElement.querySelector('.city-logo img') as HTMLImageElement | null;

    expect(image?.getAttribute('src')).toBe('assets/logo-osasco.png');
  });

  it('shows the project name in the home header without an Início title', () => {
    const title = fixture.nativeElement.querySelector('.brand-name') as HTMLHeadingElement | null;

    expect(title?.tagName).toBe('H1');
    expect(title?.textContent?.trim()).toBe('Trampos Osasco');
    expect(fixture.nativeElement.querySelector('.home-hero')?.textContent).not.toContain('INÍCIO');
  });

  it('crops professional photos consistently inside their avatars', () => {
    component.professionals.set(Array.from({ length: 5 }, (_, index) => ({
      id: `professional-${index + 1}`,
      displayName: `Profissional ${index + 1}`,
      categorySlug: 'beleza',
      categoryName: 'Manicure',
      neighborhood: 'Centro',
      bio: '',
      photoURL: 'https://example.com/profile.jpg',
    })));
    fixture.detectChanges();

    const images = Array.from(fixture.nativeElement.querySelectorAll('.avatar img')) as HTMLImageElement[];
    expect(images).toHaveLength(3);
    expect(images.every((image) => getComputedStyle(image).objectFit === 'cover')).toBe(true);
  });

  it('shows the publication date and time for opportunities', () => {
    component.opportunities.set([{
      id: 'opportunity-1',
      title: 'Pintar apartamento',
      description: 'Pintura de paredes e teto.',
      categorySlug: 'reformas',
      categoryName: 'Reformas e construção',
      neighborhood: 'Centro',
      ownerId: 'owner-1',
      ownerName: 'Giovani',
      createdAt: Timestamp.fromDate(new Date(2026, 10, 4, 15, 32)),
    } satisfies WorkOpportunity]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Anunciado em 04/11/2026 às 15:32');
  });

  it('updates professionals and publications when Firestore changes', async () => {
    component.ionViewWillEnter();
    publishProfiles?.([{
      id: 'new-profile',
      displayName: 'Carla',
      categorySlug: 'beleza',
      categoryName: 'Manicure',
      neighborhood: 'Centro',
      bio: '',
    }]);
    publishOpportunities?.([{
      id: 'new-opportunity',
      title: 'Pintar apartamento',
      description: 'Pintura de paredes e teto.',
      categorySlug: 'reformas',
      categoryName: 'Reformas e construção',
      neighborhood: 'Centro',
      ownerId: 'owner-1',
      ownerName: 'Giovani',
      createdAt: Timestamp.fromDate(new Date(2026, 10, 4, 15, 32)),
    }]);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Carla');
    expect(fixture.nativeElement.textContent).toContain('Pintar apartamento');
  });

  it('does not show empty states before the initial Firestore snapshots arrive', async () => {
    component.ionViewWillEnter();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Carregando oportunidades...');
    expect(fixture.nativeElement.textContent).toContain('Carregando profissionais...');
    expect(fixture.nativeElement.textContent).not.toContain('Ainda não há perfis cadastrados');

    publishProfiles?.([]);
    publishOpportunities?.([]);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Ainda não há perfis cadastrados');
    expect(fixture.nativeElement.textContent).toContain('Ainda não há oportunidades publicadas');
  });
});
