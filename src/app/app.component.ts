import { Component, effect, inject } from '@angular/core';
import { MessagingNotificationsService } from './core/services/messaging-notifications.service';
import { MarketplaceBackendService } from './core/services/marketplace-backend.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  private readonly backend = inject(MarketplaceBackendService);
  private readonly messagingNotifications = inject(MessagingNotificationsService);

  constructor() {
    effect(() => {
      this.messagingNotifications.setUser(this.backend.currentUser()?.uid ?? null);
    });
  }
}
