import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { MessagesPageModule } from './messages.module';
import { MessagesPage } from './messages.page';
import { MarketplaceBackendService } from '../core/services/marketplace-backend.service';
import { WorkConversation } from '../core/models/marketplace-account.models';
import { MessagingNotificationsService } from '../core/services/messaging-notifications.service';

describe('MessagesPage', () => {
  let component: MessagesPage;
  let fixture: ComponentFixture<MessagesPage>;
  let sentMessage: { conversationId: string; text: string } | null;
  let readConversationIds: string[];

  beforeEach(async () => {
    sentMessage = null;
    readConversationIds = [];
    await TestBed.configureTestingModule({
      imports: [MessagesPageModule, RouterModule.forRoot([])],
      providers: [
        {
          provide: MarketplaceBackendService,
          useValue: {
            isConfigured: true,
            authReady: () => true,
            currentUser: () => ({ uid: 'owner-1' }),
            profileLoading: () => false,
            profile: () => ({ id: 'owner-1', displayName: 'Contratante' }),
            toUserMessage: (error: unknown) => String(error),
            subscribeToConversations: () => () => undefined,
            subscribeToConversationMessages: () => () => undefined,
            markConversationAsRead: async (conversationId: string) => {
              readConversationIds.push(conversationId);
            },
            sendConversationMessage: async (conversationId: string, text: string) => {
              sentMessage = { conversationId, text };
            },
          },
        },
        {
          provide: MessagingNotificationsService,
          useValue: {
            unreadCount: () => 0,
            notificationStatus: () => '',
            isConversationUnread: () => false,
            unreadMessageCount: () => 0,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessagesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sends a trimmed reply in the selected opportunity conversation', async () => {
    const conversation: WorkConversation = {
      id: 'opportunity_applicant',
      opportunityId: 'opportunity',
      opportunityTitle: 'Pintar apartamento',
      ownerId: 'owner-1',
      ownerName: 'Contratante',
      applicantId: 'applicant-1',
      applicantName: 'Profissional',
      participantIds: ['owner-1', 'applicant-1'],
      lastMessage: 'Primeira mensagem',
      lastMessageAt: null,
      createdAt: null,
    };
    component.selectedConversation.set(conversation);
    component.messageDraft.set('  Podemos conversar sobre o serviço?  ');

    await component.sendMessage();

    expect(sentMessage).toEqual({
      conversationId: conversation.id,
      text: 'Podemos conversar sobre o serviço?',
    });
    expect(component.messageDraft()).toBe('');
  });

  it('marks a conversation as read when it is opened', () => {
    const conversation: WorkConversation = {
      id: 'opportunity_applicant',
      opportunityId: 'opportunity',
      opportunityTitle: 'Pintar apartamento',
      ownerId: 'owner-1',
      ownerName: 'Contratante',
      applicantId: 'applicant-1',
      applicantName: 'Profissional',
      participantIds: ['owner-1', 'applicant-1'],
      lastMessage: 'Primeira mensagem',
      lastMessageAt: null,
      createdAt: null,
    };

    component.openConversation(conversation);

    expect(readConversationIds).toEqual([conversation.id]);
  });

  it('shows the other participant profile photo in the conversation heading', () => {
    const conversation: WorkConversation = {
      id: 'opportunity_applicant',
      opportunityId: 'opportunity',
      opportunityTitle: 'Pintar apartamento',
      ownerId: 'owner-1',
      ownerName: 'Contratante',
      applicantId: 'applicant-1',
      applicantName: 'Profissional',
      participantIds: ['owner-1', 'applicant-1'],
      lastMessage: 'Primeira mensagem',
      lastMessageAt: null,
      createdAt: null,
    };
    const photoURL = 'data:image/jpeg;base64,photo';

    component.participantProfiles.set(new Map([[
      'applicant-1',
      {
        id: 'applicant-1',
        displayName: 'Profissional',
        categorySlug: 'reformas',
        categoryName: 'Reformas',
        neighborhood: 'Centro',
        bio: '',
        photoURL,
      },
    ]]));
    component.selectedConversation.set(conversation);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.conversation-heading img') as HTMLImageElement | null;
    expect(image?.getAttribute('src')).toBe(photoURL);
  });
});
