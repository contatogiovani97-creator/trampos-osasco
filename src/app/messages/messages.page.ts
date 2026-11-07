import { Component, DestroyRef, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonContent } from '@ionic/angular';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Unsubscribe } from 'firebase/firestore';
import { ConversationMessage, UserProfile, WorkConversation } from '../core/models/marketplace-account.models';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { MessagingNotificationsService } from '../core/services/messaging-notifications.service';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: false,
})
export class MessagesPage implements OnInit {
  @ViewChild('messageContent') private messageContent?: IonContent;
  @ViewChild('messageList') private messageList?: ElementRef<HTMLElement>;

  readonly backend = inject(MarketplaceBackendService);
  readonly messagingNotifications = inject(MessagingNotificationsService);
  readonly conversations = signal<WorkConversation[]>([]);
  readonly messages = signal<ConversationMessage[]>([]);
  readonly participantProfiles = signal<ReadonlyMap<string, UserProfile>>(new Map());
  readonly selectedConversation = signal<WorkConversation | null>(null);
  readonly messageDraft = signal('');
  readonly loadingConversations = signal(false);
  readonly loadingMessages = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly profileError = signal('');

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private conversationsUnsubscribe: Unsubscribe | null = null;
  private messagesUnsubscribe: Unsubscribe | null = null;
  private pendingConversationId = signal('');
  private activeUserId = '';
  private lastObservedIncomingMessageId = '';
  private pageActive = false;
  private keyboardListener: PluginListenerHandle | null = null;
  private readonly profileRequests = new Map<string, Promise<void>>();

  ngOnInit(): void {
    if (Capacitor.isNativePlatform()) {
      void this.registerKeyboardListener();
      this.destroyRef.onDestroy(() => {
        void this.keyboardListener?.remove();
      });
    }

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const conversationId = params.get('conversation') ?? '';
        this.pendingConversationId.set(conversationId);
        const conversation = this.conversations().find((item) => item.id === conversationId);
        if (conversation) {
          this.openConversation(conversation, true);
        }
      });
  }

  ionViewWillEnter(): void {
    this.pageActive = true;
    const user = this.backend.currentUser();
    if (!this.backend.isConfigured || !user) {
      return;
    }
    if (this.activeUserId !== user.uid) {
      this.activeUserId = user.uid;
      this.conversations.set([]);
      this.messages.set([]);
      this.selectedConversation.set(null);
      this.participantProfiles.set(new Map());
      this.profileRequests.clear();
    }

    this.loadingConversations.set(true);
    this.error.set('');
    this.conversationsUnsubscribe = this.backend.subscribeToConversations(
      (conversations) => {
        this.conversations.set(conversations);
        void this.loadParticipantProfiles(conversations);
        this.loadingConversations.set(false);
        const targetId = this.pendingConversationId() || this.selectedConversation()?.id;
        const targetConversation = conversations.find((conversation) => conversation.id === targetId);
        if (targetConversation && targetConversation.id !== this.selectedConversation()?.id) {
          this.openConversation(targetConversation, true);
        } else if (targetConversation && !this.messagesUnsubscribe) {
          this.subscribeToMessages(targetConversation);
        }
      },
      (error) => {
        this.loadingConversations.set(false);
        this.error.set(this.backend.toUserMessage(error));
      },
    );
  }

  ionViewWillLeave(): void {
    this.pageActive = false;
    this.stopListeners();
  }

  onComposerFocus(): void {
    this.scrollConversationToLatest();
  }

  preserveComposerFocus(event: PointerEvent): void {
    event.preventDefault();
  }

  openConversation(conversation: WorkConversation, fromRoute = false): void {
    this.selectedConversation.set(conversation);
    this.messages.set([]);
    this.lastObservedIncomingMessageId = '';
    this.messageDraft.set('');
    this.error.set('');
    if (!fromRoute) {
      this.pendingConversationId.set('');
    }
    void this.backend.markConversationAsRead(conversation.id).catch((error: unknown) => {
      this.error.set(this.backend.toUserMessage(error));
    });
    this.subscribeToMessages(conversation);
  }

  closeConversation(): void {
    this.selectedConversation.set(null);
    this.messages.set([]);
    this.messageDraft.set('');
    this.messagesUnsubscribe?.();
    this.messagesUnsubscribe = null;
    if (this.pendingConversationId()) {
      this.pendingConversationId.set('');
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { conversation: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  otherParticipantName(conversation: WorkConversation): string {
    return conversation.ownerId === this.backend.currentUser()?.uid
      ? conversation.applicantName
      : conversation.ownerName;
  }

  profileFor(userId: string): UserProfile | undefined {
    if (userId === this.backend.currentUser()?.uid) {
      return this.backend.profile() ?? undefined;
    }
    return this.participantProfiles().get(userId);
  }

  avatarInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase();
  }

  async sendMessage(): Promise<void> {
    const conversation = this.selectedConversation();
    const text = this.messageDraft().trim();
    if (!conversation || !text || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.error.set('');
    try {
      await this.backend.sendConversationMessage(conversation.id, text);
      this.messageDraft.set('');
    } catch (error) {
      this.error.set(this.backend.toUserMessage(error));
    } finally {
      this.sending.set(false);
    }
  }

  private subscribeToMessages(conversation: WorkConversation): void {
    this.messagesUnsubscribe?.();
    this.loadingMessages.set(true);
    this.messagesUnsubscribe = this.backend.subscribeToConversationMessages(
      conversation.id,
      (messages) => {
        this.messages.set(messages);
        this.loadingMessages.set(false);
        this.scrollConversationToLatest();
        const currentUserId = this.backend.currentUser()?.uid;
        const latestIncomingMessage = [...messages]
          .reverse()
          .find((message) => message.senderId !== currentUserId);
        if (latestIncomingMessage && latestIncomingMessage.id !== this.lastObservedIncomingMessageId) {
          this.lastObservedIncomingMessageId = latestIncomingMessage.id;
          void this.backend.markConversationAsRead(conversation.id).catch((error: unknown) => {
            this.error.set(this.backend.toUserMessage(error));
          });
        }
      },
      (error) => {
        this.loadingMessages.set(false);
        this.error.set(this.backend.toUserMessage(error));
      },
    );
  }

  private async loadParticipantProfiles(conversations: WorkConversation[]): Promise<void> {
    const userIds = new Set(conversations.flatMap((conversation) => [
      conversation.ownerId,
      conversation.applicantId,
    ]));
    const requests = Array.from(userIds)
      .filter((userId) => userId && userId !== this.backend.currentUser()?.uid)
      .map((userId) => this.loadParticipantProfile(userId));
    await Promise.all(requests);
  }

  private loadParticipantProfile(userId: string): Promise<void> {
    if (this.participantProfiles().has(userId)) {
      return Promise.resolve();
    }

    const existingRequest = this.profileRequests.get(userId);
    if (existingRequest) {
      return existingRequest;
    }

    const request = this.backend.getProfile(userId)
      .then((profile) => {
        if (profile) {
          this.participantProfiles.update((profiles) => {
            const updatedProfiles = new Map(profiles);
            updatedProfiles.set(userId, profile);
            return updatedProfiles;
          });
        }
      })
      .catch((error: unknown) => {
        this.profileError.set(this.backend.toUserMessage(error));
      })
      .finally(() => {
        this.profileRequests.delete(userId);
      });

    this.profileRequests.set(userId, request);
    return request;
  }

  private stopListeners(): void {
    this.conversationsUnsubscribe?.();
    this.messagesUnsubscribe?.();
    this.conversationsUnsubscribe = null;
    this.messagesUnsubscribe = null;
  }

  private async registerKeyboardListener(): Promise<void> {
    const listener = await Keyboard.addListener('keyboardDidShow', () => {
      if (this.pageActive && this.selectedConversation()) {
        this.scrollConversationToLatest();
      }
    });

    if (this.destroyRef.destroyed) {
      await listener.remove();
      return;
    }
    this.keyboardListener = listener;
  }

  private scrollConversationToLatest(): void {
    requestAnimationFrame(() => {
      const messageList = this.messageList?.nativeElement;
      if (messageList) {
        messageList.scrollTop = messageList.scrollHeight;
      }
      if (this.pageActive) {
        void this.messageContent?.scrollToBottom(200);
      }
    });
  }
}
