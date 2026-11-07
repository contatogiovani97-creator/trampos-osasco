import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  id: string;
  displayName: string;
  categorySlug: string;
  categoryName: string;
  neighborhood: string;
  bio: string;
  photoURL?: string;
  createdAt?: Timestamp | null;
}

export interface WorkOpportunity {
  id: string;
  title: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  neighborhood: string;
  ownerId: string;
  ownerName: string;
  createdAt?: Timestamp | null;
  status?: 'open' | 'closed' | 'removed';
}

export interface WorkApplication {
  id: string;
  opportunityId: string;
  applicantId: string;
  applicantName: string;
  message: string;
  createdAt?: Timestamp | null;
}

export interface WorkConversation {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  ownerId: string;
  ownerName: string;
  applicantId: string;
  applicantName: string;
  participantIds: string[];
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface ConversationMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Timestamp | null;
}

export interface ConversationUnreadState {
  id: string;
  unreadCount: number;
  lastReadAt?: Timestamp | null;
}
