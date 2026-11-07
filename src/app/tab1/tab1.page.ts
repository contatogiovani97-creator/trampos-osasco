import { Component, inject, OnDestroy, signal } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { MARKETPLACE_CATEGORIES } from '../core/data/marketplace.data';
import { MarketplaceCategory } from '../core/models/marketplace.models';
import { UserProfile, WorkOpportunity } from '../core/models/marketplace-account.models';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnDestroy {
  readonly backend = inject(MarketplaceBackendService);
  readonly categories: MarketplaceCategory[] = MARKETPLACE_CATEGORIES;
  readonly opportunities = signal<WorkOpportunity[]>([]);
  readonly professionals = signal<UserProfile[]>([]);
  searchTerm = '';
  readonly loading = signal(false);
  readonly loadError = signal('');
  selectedOpportunityId = '';
  applicationMessage = '';
  applicationSentId = '';
  applicationConversationId = '';
  actionError = '';
  applying = false;
  private profilesUnsubscribe: Unsubscribe | null = null;
  private opportunitiesUnsubscribe: Unsubscribe | null = null;

  ionViewWillEnter(): void {
    this.watchMarketplace();
  }

  ngOnDestroy(): void {
    this.profilesUnsubscribe?.();
    this.opportunitiesUnsubscribe?.();
  }

  async loadMarketplace(): Promise<void> {
    if (!this.backend.isConfigured) {
      return;
    }
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [opportunities, professionals] = await Promise.all([
        this.backend.getOpportunities(),
        this.backend.getProfiles(),
      ]);
      this.opportunities.set(opportunities);
      this.professionals.set(professionals);
    } catch (error) {
      this.loadError.set(this.backend.toUserMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private watchMarketplace(): void {
    if (!this.backend.isConfigured) {
      return;
    }

    this.profilesUnsubscribe?.();
    this.opportunitiesUnsubscribe?.();
    this.loading.set(true);
    this.loadError.set('');
    let receivedProfiles = false;
    let receivedOpportunities = false;
    const finishInitialLoad = (): void => {
      if (receivedProfiles && receivedOpportunities) {
        this.loading.set(false);
      }
    };

    this.profilesUnsubscribe = this.backend.subscribeToProfiles(
      (profiles) => {
        this.professionals.set(profiles);
        receivedProfiles = true;
        finishInitialLoad();
      },
      (error) => {
        this.loadError.set(this.backend.toUserMessage(error));
        receivedProfiles = true;
        finishInitialLoad();
      },
    );
    this.opportunitiesUnsubscribe = this.backend.subscribeToOpenOpportunities(
      (opportunities) => {
        this.opportunities.set(opportunities);
        receivedOpportunities = true;
        finishInitialLoad();
      },
      (error) => {
        this.loadError.set(this.backend.toUserMessage(error));
        receivedOpportunities = true;
        finishInitialLoad();
      },
    );
  }

  startApplication(opportunity: WorkOpportunity): void {
    this.selectedOpportunityId = opportunity.id;
    this.applicationMessage = '';
    this.applicationConversationId = '';
    this.actionError = '';
  }

  async submitApplication(opportunity: WorkOpportunity): Promise<void> {
    this.actionError = '';
    if (this.applicationMessage.trim().length < 10) {
      this.actionError = 'Escreva uma mensagem com pelo menos 10 caracteres.';
      return;
    }
    this.applying = true;
    try {
      this.applicationConversationId = await this.backend.applyToOpportunity(opportunity, this.applicationMessage);
      this.applicationSentId = opportunity.id;
      this.selectedOpportunityId = '';
      this.applicationMessage = '';
    } catch (error) {
      this.actionError = this.backend.toUserMessage(error);
    } finally {
      this.applying = false;
    }
  }

  get filteredOpportunities(): WorkOpportunity[] {
    const term = this.searchTerm.trim().toLocaleLowerCase('pt-BR');
    return this.opportunities().filter((opportunity) =>
      `${opportunity.title} ${opportunity.description} ${opportunity.categoryName} ${opportunity.neighborhood} ${opportunity.ownerName}`
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    );
  }

  get filteredProfessionals(): UserProfile[] {
    const term = this.searchTerm.trim().toLocaleLowerCase('pt-BR');
    return this.professionals().filter((professional) =>
      professional.categorySlug.length > 0
      && `${professional.displayName} ${professional.categoryName} ${professional.neighborhood} ${professional.bio}`
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    );
  }

  get featuredProfessionals(): UserProfile[] {
    return this.filteredProfessionals.slice(0, 3);
  }
}
