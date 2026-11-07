import { Component, inject } from '@angular/core';
import { MessagingNotificationsService } from '../core/services/messaging-notifications.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  readonly messagingNotifications = inject(MessagingNotificationsService);

}
