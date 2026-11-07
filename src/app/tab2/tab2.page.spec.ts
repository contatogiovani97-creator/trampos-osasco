import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, RouterModule } from '@angular/router';
import { of } from 'rxjs';

import { MARKETPLACE_CATEGORIES } from '../core/data/marketplace.data';
import { UserProfile } from '../core/models/marketplace-account.models';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { Tab2PageModule } from './tab2.module';
import { Tab2Page } from './tab2.page';

describe('Tab2Page', () => {
  let component: Tab2Page;
  let fixture: ComponentFixture<Tab2Page>;
  let profilesToLoad: UserProfile[];
  let publishProfiles: ((profiles: UserProfile[]) => void) | null;

  beforeEach(async () => {
    profilesToLoad = [];
    publishProfiles = null;
    await TestBed.configureTestingModule({
      imports: [Tab2PageModule, RouterModule.forRoot([])],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ slug: 'beleza' })) },
        },
        {
          provide: MarketplaceBackendService,
          useValue: {
            isConfigured: true,
            getProfiles: async () => profilesToLoad,
            subscribeToProfiles: (onProfiles: (profiles: UserProfile[]) => void) => {
              publishProfiles = onProfiles;
              return () => undefined;
            },
            toUserMessage: (error: unknown) => String(error),
          },
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Tab2Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows professionals matching the selected category slug or category name', () => {
    component.selectedCategory = MARKETPLACE_CATEGORIES.find((category) => category.slug === 'beleza');
    component.professionals.set([
      {
        id: 'slug-match',
        displayName: 'Ana',
        categorySlug: 'beleza',
        categoryName: 'Manicure',
        neighborhood: 'Centro',
        bio: '',
      },
      {
        id: 'name-match',
        displayName: 'Bia',
        categorySlug: '',
        categoryName: 'Beleza e bem-estar',
        neighborhood: 'Vila Yara',
        bio: '',
      },
      {
        id: 'other-category',
        displayName: 'Caio',
        categorySlug: 'tecnologia',
        categoryName: 'Engenheiro de Software',
        neighborhood: 'Centro',
        bio: '',
      },
    ] satisfies UserProfile[]);

    expect(component.filteredProfessionals.map((professional) => professional.id))
      .toEqual(['slug-match', 'name-match']);
  });

  it('renders professionals as soon as the profile load completes', async () => {
    profilesToLoad = [{
      id: 'ana',
      displayName: 'Ana',
      categorySlug: 'beleza',
      categoryName: 'Manicure',
      neighborhood: 'Centro',
      bio: '',
    }];
    fixture.detectChanges();

    await component.loadProfessionals();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Ana');
  });

  it('updates the professional list when Firestore publishes a profile change', () => {
    component.ionViewWillEnter();
    publishProfiles?.([{
      id: 'new-profile',
      displayName: 'Carla',
      categorySlug: 'beleza',
      categoryName: 'Manicure',
      neighborhood: 'Centro',
      bio: '',
    }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Carla');
  });
});
