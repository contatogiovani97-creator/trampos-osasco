import { Component, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/lazy';
import { MARKETPLACE_CATEGORIES, OSASCO_NEIGHBORHOODS } from '../core/data/marketplace.data';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  readonly backend = inject(MarketplaceBackendService);
  private readonly alertController = inject(AlertController);
  readonly categories = MARKETPLACE_CATEGORIES;
  readonly neighborhoods = OSASCO_NEIGHBORHOODS.filter((item) => item !== 'Todas as regiões');
  readonly opportunitySelectPopoverOptions = {
    side: 'bottom' as const,
    alignment: 'center' as const,
    size: 'cover' as const,
    cssClass: 'account-select-popover',
  };
  title = '';
  description = '';
  categorySlug = '';
  professionName = '';
  neighborhood = '';
  saving = false;

  get categoryName(): string {
    return this.professionName.trim()
      || this.categories.find((category) => category.slug === this.categorySlug)?.name
      || '';
  }

  async publishOpportunity(): Promise<void> {
    this.saving = true;
    let publicationFailed = false;
    let publicationError = '';
    try {
      await this.backend.publishOpportunity({
        title: this.title.trim(),
        description: this.description.trim(),
        categorySlug: this.categorySlug,
        categoryName: this.categoryName,
        neighborhood: this.neighborhood,
      });
      this.title = '';
      this.description = '';
      this.categorySlug = '';
      this.professionName = '';
      this.neighborhood = '';
    } catch (error) {
      publicationFailed = true;
      publicationError = this.backend.toUserMessage(error);
    } finally {
      this.saving = false;
    }
    if (publicationFailed) {
      await this.presentFeedback('Não foi possível publicar', publicationError);
      return;
    }
    await this.presentFeedback('Publicação concluída', 'Oportunidade publicada no mural da região.');
  }

  private async presentFeedback(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
