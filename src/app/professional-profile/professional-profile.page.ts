import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UserProfile } from '../core/models/marketplace-account.models';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';

@Component({
  selector: 'app-professional-profile',
  templateUrl: './professional-profile.page.html',
  styleUrls: ['./professional-profile.page.scss'],
  standalone: false,
})
export class ProfessionalProfilePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly backend = inject(MarketplaceBackendService);
  readonly profile = signal<UserProfile | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.profile.set(null);

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set('Perfil não encontrado.');
      return;
    }
    if (!this.backend.isConfigured) {
      this.loading.set(false);
      this.error.set('Configure o Firebase para acessar os perfis públicos.');
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('A consulta ao Firebase demorou demais. Verifique a conexão e se o Firestore foi criado no projeto.')),
          15000,
        );
      });
      this.profile.set(await Promise.race([this.backend.getProfile(id), timeout]));
    } catch (error: unknown) {
      this.error.set(this.backend.toUserMessage(error));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.loading.set(false);
    }
  }
}
