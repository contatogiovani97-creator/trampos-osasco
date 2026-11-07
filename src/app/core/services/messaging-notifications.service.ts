import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Unsubscribe } from 'firebase/firestore';
import { MarketplaceBackendService } from './marketplace-backend.service';

@Injectable({ providedIn: 'root' })
export class MessagingNotificationsService {
  readonly unreadCount = signal(0);
  readonly unreadConversationIds = signal<ReadonlySet<string>>(new Set());
  readonly unreadCountsByConversation = signal<ReadonlyMap<string, number>>(new Map());
  readonly notificationStatus = signal('');

  private readonly backend = inject(MarketplaceBackendService);
  private readonly router = inject(Router);
  private activeUserId = '';
  private savedToken = '';
  private listenersRegistered = false;
  private unreadUnsubscribe: Unsubscribe | null = null;
  private notificationId = 0;

  setUser(userId: string | null): void {
    if (this.activeUserId === userId) {
      return;
    }

    const previousUserId = this.activeUserId;
    const previousToken = this.savedToken;
    this.activeUserId = userId ?? '';
    this.savedToken = '';
    this.unreadUnsubscribe?.();
    this.unreadUnsubscribe = null;
    this.unreadCount.set(0);
    this.unreadConversationIds.set(new Set());
    this.unreadCountsByConversation.set(new Map());
    this.notificationStatus.set('');

    if (previousUserId && previousToken) {
      void this.backend.removePushToken(previousUserId, previousToken).catch((error: unknown) => {
        console.error('Could not remove the previous messaging device token.', error);
      });
    }
    if (!userId) {
      return;
    }

    this.unreadUnsubscribe = this.backend.subscribeToUnreadMessageCounts(
      (counts) => {
        this.unreadCountsByConversation.set(counts);
        this.unreadConversationIds.set(new Set(counts.keys()));
        this.unreadCount.set(Array.from(counts.values()).reduce((total, count) => total + count, 0));
      },
      (error) => {
        this.notificationStatus.set(this.backend.toUserMessage(error));
      },
    );

    if (Capacitor.getPlatform() === 'android') {
      void this.initializeAndroidPush(userId);
    }
  }

  isConversationUnread(conversationId: string): boolean {
    return this.unreadConversationIds().has(conversationId);
  }

  unreadMessageCount(conversationId: string): number {
    return this.unreadCountsByConversation().get(conversationId) ?? 0;
  }

  private async initializeAndroidPush(userId: string): Promise<void> {
    try {
      await this.registerPushListeners();
      await LocalNotifications.createChannel({
        id: 'messages',
        name: 'Mensagens',
        description: 'Novas mensagens sobre oportunidades',
        importance: 5,
        sound: 'default',
        vibration: true,
      });

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        this.notificationStatus.set('Permita notificações nas configurações do aparelho para receber avisos de mensagens.');
        return;
      }

      if (this.activeUserId !== userId) {
        return;
      }
      this.notificationStatus.set('');
      await PushNotifications.register();
    } catch (error) {
      this.notificationStatus.set(this.backend.toUserMessage(error));
    }
  }

  private async registerPushListeners(): Promise<void> {
    if (this.listenersRegistered) {
      return;
    }
    this.listenersRegistered = true;

    await PushNotifications.addListener('registration', (token: Token) => {
      const userId = this.activeUserId;
      if (!userId) {
        return;
      }
      this.savedToken = token.value;
      void this.backend.savePushToken(userId, token.value).catch((error: unknown) => {
        this.notificationStatus.set(this.backend.toUserMessage(error));
      });
    });

    await PushNotifications.addListener('registrationError', (error) => {
      this.notificationStatus.set(`Não foi possível registrar as notificações push: ${error.error}`);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const conversationId = notification.data?.['conversationId'];
      void LocalNotifications.schedule({
        notifications: [{
          id: ++this.notificationId,
          title: notification.title ?? 'Nova mensagem',
          body: notification.body ?? 'Você recebeu uma mensagem.',
          channelId: 'messages',
          extra: typeof conversationId === 'string' ? { conversationId } : undefined,
        }],
      }).catch((error: unknown) => {
        this.notificationStatus.set(this.backend.toUserMessage(error));
      });
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      this.openNotificationConversation(action.notification.data?.['conversationId']);
    });

    await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      this.openNotificationConversation(action.notification.extra?.['conversationId']);
    });
  }

  private openNotificationConversation(conversationId: unknown): void {
    if (typeof conversationId === 'string' && conversationId.length > 0) {
      void this.router.navigate(['/tabs/messages'], {
        queryParams: { conversation: conversationId },
      });
    }
  }
}
