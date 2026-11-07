import { Component, inject, signal } from '@angular/core';
import { OsascoPost, OsascoPostType } from '../core/models/osasco-community.models';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';

@Component({
  selector: 'app-osasco',
  templateUrl: './osasco.page.html',
  styleUrls: ['./osasco.page.scss'],
  standalone: false,
})
export class OsascoPage {
  readonly backend = inject(MarketplaceBackendService);
  readonly posts = signal<OsascoPost[]>([]);
  readonly selectedType = signal<OsascoPostType>('event');
  readonly loading = signal(false);
  readonly error = signal('');

  ionViewWillEnter(): void {
    void this.loadPosts();
  }

  async selectType(type: OsascoPostType): Promise<void> {
    this.selectedType.set(type);
    this.error.set('');
    await this.loadPosts();
  }

  async loadPosts(): Promise<void> {
    if (!this.backend.isConfigured) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      this.posts.set(await this.backend.getPublishedOsascoPosts(this.selectedType()));
    } catch (error) {
      this.error.set(this.backend.toUserMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
