import { Component, effect, inject, signal } from '@angular/core';
import { AlertController } from '@ionic/angular/lazy';
import { Router } from '@angular/router';
import { MARKETPLACE_CATEGORIES, OSASCO_NEIGHBORHOODS } from '../core/data/marketplace.data';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { UserProfile, WorkApplication, WorkOpportunity } from '../core/models/marketplace-account.models';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  standalone: false,
})
export class AccountPage {
  readonly backend = inject(MarketplaceBackendService);
  private readonly alertController = inject(AlertController);
  private readonly router = inject(Router);
  readonly categories = MARKETPLACE_CATEGORIES;
  readonly neighborhoods = OSASCO_NEIGHBORHOODS.filter((item) => item !== 'Todas as regiões');
  readonly accountSelectPopoverOptions = {
    side: 'bottom' as const,
    alignment: 'center' as const,
    size: 'cover' as const,
    cssClass: 'account-select-popover',
  };
  mode: 'signin' | 'register' = 'signin';
  displayName = '';
  email = '';
  password = '';
  categorySlug = '';
  professionName = '';
  neighborhood = '';
  bio = '';
  saving = false;
  readonly loadingSite = signal(false);
  uploadingPhoto = false;
  readonly workLoading = signal(false);
  readonly removingOpportunityId = signal('');
  readonly editingOpportunityId = signal('');
  readonly savingOpportunityId = signal('');
  readonly myOpportunities = signal<WorkOpportunity[]>([]);
  readonly applicationsByOpportunity = signal<Record<string, WorkApplication[]>>({});
  opportunityTitle = '';
  opportunityDescription = '';
  opportunityCategorySlug = '';
  opportunityNeighborhood = '';

  constructor() {
    effect(() => {
      const profile = this.backend.profile();
      if (profile) {
        this.setProfileForm(profile);
        void this.loadMyWork();
      }
    });
  }

  ionViewWillEnter(): void {
    if (this.backend.profile()) {
      void this.loadMyWork();
    }
  }

  get categoryName(): string {
    return this.professionName.trim()
      || this.categories.find((category) => category.slug === this.categorySlug)?.name
      || '';
  }

  toggleMode(): void {
    this.mode = this.mode === 'signin' ? 'register' : 'signin';
  }

  async submit(): Promise<void> {
    this.saving = true;
    const signingIn = this.mode === 'signin';
    this.loadingSite.set(signingIn);
    let feedback: { header: 'Erro' | 'Sucesso'; message: string } | null = null;
    let accountCreated = false;
    let loginSucceeded = false;
    try {
      if (this.mode === 'register') {
        await this.backend.register({
          email: this.email,
          password: this.password,
          displayName: this.displayName,
          categorySlug: this.categorySlug,
          categoryName: this.categoryName,
          neighborhood: this.neighborhood,
          bio: this.bio,
        });
        accountCreated = true;
        feedback = {
          header: 'Sucesso',
          message: 'Conta criada. Seu perfil já está disponível para os moradores da região.',
        };
      } else {
        await this.backend.signIn(this.email, this.password);
        await this.backend.loadInitialSiteData();
        loginSucceeded = true;
      }
    } catch (error) {
      feedback = { header: 'Erro', message: this.backend.toUserMessage(error) };
    } finally {
      this.saving = false;
      this.loadingSite.set(false);
    }
    if (loginSucceeded) {
      await this.router.navigateByUrl('/tabs/tab1');
      return;
    }
    if (!feedback) {
      return;
    }
    await this.presentFeedback(feedback.header, feedback.message);
    if (accountCreated && feedback.header === 'Sucesso') {
      this.mode = 'signin';
      this.password = '';
      try {
        await this.backend.signOut();
      } catch (error) {
        await this.showError(this.backend.toUserMessage(error));
      }
    }
  }

  async saveProfile(): Promise<void> {
    this.saving = true;
    try {
      await this.backend.updateProfile({
        displayName: this.displayName.trim(),
        categorySlug: this.categorySlug,
        categoryName: this.categoryName,
        neighborhood: this.neighborhood,
        bio: this.bio.trim(),
      });
      await this.showSuccess('Perfil atualizado.');
    } catch (error) {
      await this.showError(this.backend.toUserMessage(error));
    } finally {
      this.saving = false;
    }
  }

  async onPhotoSelected(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.uploadingPhoto = true;
    try {
      await this.backend.uploadProfilePhoto(file);
      await this.showSuccess('Foto de perfil atualizada.');
    } catch (error) {
      await this.showError(this.backend.toUserMessage(error));
    } finally {
      this.uploadingPhoto = false;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.backend.signOut();
      this.clearForm();
    } catch (error) {
      await this.showError(this.backend.toUserMessage(error));
    }
  }

  async reloadProfile(): Promise<void> {
    try {
      await this.backend.reloadProfile();
    } catch (error) {
      await this.showError(this.backend.toUserMessage(error));
    }
  }

  async confirmRemoveOpportunity(opportunity: WorkOpportunity): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Remover anúncio?',
      message: 'Ele deixará de aparecer para novos profissionais, mas continuará no seu histórico e as conversas serão mantidas.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Remover anúncio',
          role: 'destructive',
          handler: () => {
            void this.removeOpportunity(opportunity);
          },
        },
      ],
    });
    await alert.present();
    await alert.onDidDismiss();
  }

  startEditingOpportunity(opportunity: WorkOpportunity): void {
    this.opportunityTitle = opportunity.title;
    this.opportunityDescription = opportunity.description;
    this.opportunityCategorySlug = opportunity.categorySlug;
    this.opportunityNeighborhood = opportunity.neighborhood;
    this.editingOpportunityId.set(opportunity.id);
  }

  cancelEditingOpportunity(): void {
    this.editingOpportunityId.set('');
    this.opportunityTitle = '';
    this.opportunityDescription = '';
    this.opportunityCategorySlug = '';
    this.opportunityNeighborhood = '';
  }

  async saveOpportunityEdits(opportunity: WorkOpportunity): Promise<void> {
    const category = this.categories.find((item) => item.slug === this.opportunityCategorySlug);
    if (!category) {
      await this.showError('Selecione uma categoria válida.');
      return;
    }

    this.savingOpportunityId.set(opportunity.id);
    try {
      const updates = {
        title: this.opportunityTitle.trim(),
        description: this.opportunityDescription.trim(),
        categorySlug: category.slug,
        categoryName: category.name,
        neighborhood: this.opportunityNeighborhood,
      };
      await this.backend.updateOpportunity(opportunity.id, updates);
      this.myOpportunities.update((opportunities) => opportunities.map((item) =>
        item.id === opportunity.id ? { ...item, ...updates } : item,
      ));
      this.cancelEditingOpportunity();
      await this.showSuccess('Anúncio atualizado.');
    } catch (error) {
      await this.showError(this.backend.toUserMessage(error));
    } finally {
      this.savingOpportunityId.set('');
    }
  }

  private async removeOpportunity(opportunity: WorkOpportunity): Promise<void> {
    this.removingOpportunityId.set(opportunity.id);
    try {
      await this.backend.removeOpportunity(opportunity.id);
      this.myOpportunities.update((opportunities) => opportunities.map((item) =>
        item.id === opportunity.id ? { ...item, status: 'removed' } : item,
      ));
      await this.showSuccess('Anúncio removido. Ele continua disponível no seu histórico.');
    } catch (error) {
      await this.showError(this.backend.toUserMessage(error));
    } finally {
      this.removingOpportunityId.set('');
    }
  }

  private async loadMyWork(): Promise<void> {
    if (this.workLoading()) {
      return;
    }
    this.workLoading.set(true);
    try {
      this.myOpportunities.set(await this.backend.getMyOpportunities());
      const entries = await Promise.all(this.myOpportunities().map(async (opportunity) => [
        opportunity.id,
        await this.loadOpportunityApplications(opportunity),
      ] as const));
      this.applicationsByOpportunity.set(Object.fromEntries(entries));
    } catch (error) {
      await this.showError(this.backend.toUserMessage(error));
    } finally {
      this.workLoading.set(false);
    }
  }

  private async loadOpportunityApplications(opportunity: WorkOpportunity): Promise<WorkApplication[]> {
    const applications = await this.backend.getApplications(opportunity.id);
    await Promise.all(applications.map((application) =>
      this.backend.ensureConversationForApplication(opportunity, application),
    ));
    return applications;
  }

  private async showError(message: string): Promise<void> {
    await this.presentFeedback('Erro', message);
  }

  private async showSuccess(message: string): Promise<void> {
    await this.presentFeedback('Sucesso', message);
  }

  private async presentFeedback(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
    await alert.onDidDismiss();
  }

  private setProfileForm(profile: UserProfile): void {
    this.displayName = profile.displayName;
    this.categorySlug = profile.categorySlug;
    this.professionName = profile.categoryName === this.categories.find((category) => category.slug === profile.categorySlug)?.name
      ? ''
      : profile.categoryName;
    this.neighborhood = profile.neighborhood;
    this.bio = profile.bio;
  }

  private clearForm(): void {
    this.displayName = '';
    this.email = '';
    this.password = '';
    this.categorySlug = '';
    this.professionName = '';
    this.neighborhood = '';
    this.bio = '';
    this.myOpportunities.set([]);
    this.applicationsByOpportunity.set({});
  }
}
