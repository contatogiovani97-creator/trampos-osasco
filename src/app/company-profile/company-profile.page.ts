import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular/lazy';
import { FEATURED_COMPANIES } from '../core/data/marketplace.data';
import { FeaturedCompany } from '../core/models/marketplace.models';

@Component({
  selector: 'app-company-profile',
  templateUrl: './company-profile.page.html',
  styleUrls: ['./company-profile.page.scss'],
  standalone: false,
})
export class CompanyProfilePage {
  private readonly route = inject(ActivatedRoute);
  private readonly alertController = inject(AlertController);

  readonly company?: FeaturedCompany = FEATURED_COMPANIES.find(
    (item) => item.id === this.route.snapshot.paramMap.get('id'),
  );

  async showDemoContactNotice(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Empresa demonstrativa',
      message: 'As informações de contato serão exibidas quando as empresas reais forem cadastradas.',
      buttons: ['Entendi'],
    });
    await alert.present();
  }
}
