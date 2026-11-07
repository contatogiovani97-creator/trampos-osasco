import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  MARKETPLACE_CATEGORIES,
  OSASCO_NEIGHBORHOODS,
} from '../core/data/marketplace.data';
import { MarketplaceCategory } from '../core/models/marketplace.models';
import { UserProfile } from '../core/models/marketplace-account.models';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { Unsubscribe } from 'firebase/firestore';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly backend = inject(MarketplaceBackendService);

  readonly categories: MarketplaceCategory[] = MARKETPLACE_CATEGORIES;
  readonly neighborhoods = OSASCO_NEIGHBORHOODS;
  readonly regionFilterPopoverOptions = {
    side: 'bottom' as const,
    alignment: 'center' as const,
    size: 'cover' as const,
    cssClass: 'region-filter-popover',
  };
  readonly professionals = signal<UserProfile[]>([]);
  selectedCategory?: MarketplaceCategory;
  selectedNeighborhood = 'Todas as regiões';
  readonly loadError = signal('');
  private professionalsUnsubscribe: Unsubscribe | null = null;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const slug = params.get('slug');
        const category = this.categories.find((item) => item.slug === slug);
        if (category?.slug !== this.selectedCategory?.slug) {
          this.selectedNeighborhood = 'Todas as regiões';
        }
        this.selectedCategory = category;
      });
  }

  ionViewWillEnter(): void {
    this.watchProfessionals();
  }

  ngOnDestroy(): void {
    this.professionalsUnsubscribe?.();
  }

  async loadProfessionals(): Promise<void> {
    if (!this.backend.isConfigured) {
      return;
    }
    this.loadError.set('');
    try {
      this.professionals.set(await this.backend.getProfiles());
    } catch (error) {
      this.loadError.set(this.backend.toUserMessage(error));
    }
  }

  private watchProfessionals(): void {
    if (!this.backend.isConfigured) {
      return;
    }
    this.professionalsUnsubscribe?.();
    this.loadError.set('');
    this.professionalsUnsubscribe = this.backend.subscribeToProfiles(
      (profiles) => this.professionals.set(profiles),
      (error) => this.loadError.set(this.backend.toUserMessage(error)),
    );
  }

  get filteredProfessionals(): UserProfile[] {
    const categorySlug = this.selectedCategory?.slug;
    const professionals = this.professionals().filter((professional) => {
      const selectedCategory = this.selectedCategory;
      const matchesCategory = !selectedCategory
        || this.normalizeCategoryValue(professional.categorySlug) === this.normalizeCategoryValue(categorySlug ?? '')
        || this.normalizeCategoryValue(professional.categoryName) === this.normalizeCategoryValue(selectedCategory.name);
      const matchesNeighborhood = this.selectedNeighborhood === 'Todas as regiões'
        || professional.neighborhood === this.selectedNeighborhood;
      return matchesCategory && matchesNeighborhood;
    });

    return professionals.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  }

  private normalizeCategoryValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
