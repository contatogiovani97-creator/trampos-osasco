import { Injectable, signal } from '@angular/core';
import { User as FirebaseUser, browserLocalPersistence, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { environment } from '../../../environments/environment';
import {
  ConversationMessage,
  ConversationUnreadState,
  WorkApplication,
  WorkConversation,
  WorkOpportunity,
  UserProfile,
} from '../models/marketplace-account.models';
import { OsascoPost, OsascoPostType } from '../models/osasco-community.models';

const firebaseConfigured = Object.values(environment.firebase)
  .every((value) => value.length > 0 && !value.includes('PREENCHER_'));

@Injectable({ providedIn: 'root' })
export class MarketplaceBackendService {
  readonly currentUser = signal<FirebaseUser | null>(null);
  readonly profile = signal<UserProfile | null>(null);
  readonly profileError = signal('');
  readonly authReady = signal(!firebaseConfigured);
  readonly profileLoading = signal(false);
  readonly isConfigured = firebaseConfigured;

  private readonly auth: Auth | null;
  private readonly database: Firestore | null;
  private profileLoadTask: { uid: string; promise: Promise<void> } | null = null;

  constructor() {
    if (!firebaseConfigured) {
      this.auth = null;
      this.database = null;
      return;
    }

    const app = initializeApp(environment.firebase);
    this.auth = getAuth(app);
    this.database = getFirestore(app);
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser.set(user);
      this.profile.set(null);
      this.profileError.set('');
      this.authReady.set(true);
      if (user) {
        this.profileLoading.set(true);
        void this.loadCurrentProfile(user.uid);
      } else {
        this.profileLoading.set(false);
      }
    });
  }

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    categorySlug: string;
    categoryName: string;
    neighborhood: string;
    bio: string;
  }): Promise<void> {
    const auth = this.requireAuth();
    const database = this.requireDatabase();
    await setPersistence(auth, browserLocalPersistence);
    const credential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
    await updateProfile(credential.user, { displayName: input.displayName.trim() });
    const profile: UserProfile = {
      id: credential.user.uid,
      displayName: input.displayName.trim(),
      categorySlug: input.categorySlug,
      categoryName: input.categoryName,
      neighborhood: input.neighborhood,
      bio: input.bio.trim(),
      photoURL: '',
    };
    await setDoc(doc(database, 'profiles', credential.user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    this.currentUser.set(credential.user);
    this.profile.set(profile);
  }

  async signIn(email: string, password: string): Promise<void> {
    const auth = this.requireAuth();
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    this.currentUser.set(credential.user);
    if (this.profile()?.id !== credential.user.uid) {
      this.profileLoading.set(true);
      await this.loadCurrentProfile(credential.user.uid);
    }
  }

  async loadInitialSiteData(): Promise<void> {
    await Promise.all([
      this.getProfiles(),
      this.getOpportunities(),
      this.getPublishedOsascoPosts('news'),
      this.getPublishedOsascoPosts('event'),
      this.getPublishedOsascoPosts('football'),
    ]);
  }

  async signOut(): Promise<void> {
    await signOut(this.requireAuth());
  }

  async reloadProfile(): Promise<void> {
    const uid = this.currentUser()?.uid;
    if (!uid) {
      return;
    }
    this.profileLoading.set(true);
    this.profileError.set('');
    await this.loadCurrentProfile(uid);
  }

  async updateProfile(input: Omit<UserProfile, 'id' | 'createdAt'>): Promise<void> {
    const user = this.requireUser();
    const database = this.requireDatabase();
    const profileRef = doc(database, 'profiles', user.uid);
    const existing = await getDoc(profileRef);
    const profile: UserProfile = {
      ...input,
      id: user.uid,
      photoURL: input.photoURL ?? this.profile()?.photoURL ?? '',
      createdAt: existing.exists() ? existing.data()['createdAt'] : undefined,
    };
    const profileData = {
      id: user.uid,
      displayName: input.displayName,
      categorySlug: input.categorySlug,
      categoryName: input.categoryName,
      neighborhood: input.neighborhood,
      bio: input.bio,
      photoURL: profile.photoURL,
    };
    if (existing.exists()) {
      await setDoc(profileRef, { ...profileData, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      await setDoc(profileRef, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    this.profile.set(profile);
  }

  async uploadProfilePhoto(file: File): Promise<void> {
    const user = this.requireUser();
    if (!file.type.startsWith('image/')) {
      throw new Error('Escolha um arquivo de imagem.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('A foto deve ter no máximo 5 MB.');
    }

    const photoURL = await this.compressProfilePhoto(file);
    await setDoc(doc(this.requireDatabase(), 'profiles', user.uid), {
      photoURL,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const currentProfile = this.profile();
    if (currentProfile?.id === user.uid) {
      this.profile.set({ ...currentProfile, photoURL });
    }
  }

  async getProfile(id: string): Promise<UserProfile | null> {
    const snapshot = await getDoc(doc(this.requireDatabase(), 'profiles', id));
    return snapshot.exists() ? snapshot.data() as UserProfile : null;
  }

  async getProfiles(): Promise<UserProfile[]> {
    const snapshot = await getDocs(collection(this.requireDatabase(), 'profiles'));
    return snapshot.docs.map((item) => item.data() as UserProfile);
  }

  subscribeToProfiles(
    onProfiles: (profiles: UserProfile[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      collection(this.requireDatabase(), 'profiles'),
      (snapshot) => onProfiles(snapshot.docs.map((item) => item.data() as UserProfile)),
      onError,
    );
  }

  async getOpportunities(): Promise<WorkOpportunity[]> {
    const opportunities = query(
      collection(this.requireDatabase(), 'opportunities'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(opportunities);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WorkOpportunity);
  }

  subscribeToOpenOpportunities(
    onOpportunities: (opportunities: WorkOpportunity[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    const opportunities = query(
      collection(this.requireDatabase(), 'opportunities'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(
      opportunities,
      (snapshot) => onOpportunities(snapshot.docs.map((item) =>
        ({ id: item.id, ...item.data() }) as WorkOpportunity,
      )),
      onError,
    );
  }

  async getPublishedOsascoPosts(type: OsascoPostType): Promise<OsascoPost[]> {
    const posts = query(
      collection(this.requireDatabase(), 'osascoPosts'),
      where('status', '==', 'published'),
      where('type', '==', type),
      orderBy('publishedAt', 'desc'),
    );
    const snapshot = await getDocs(posts);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as OsascoPost);
  }

  async getMyOpportunities(): Promise<WorkOpportunity[]> {
    const user = this.requireUser();
    const mine = query(
      collection(this.requireDatabase(), 'opportunities'),
      where('ownerId', '==', user.uid),
    );
    const snapshot = await getDocs(mine);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WorkOpportunity);
  }

  async removeOpportunity(opportunityId: string): Promise<void> {
    this.requireUser();
    await updateDoc(doc(this.requireDatabase(), 'opportunities', opportunityId), {
      status: 'removed',
    });
  }

  async updateOpportunity(
    opportunityId: string,
    input: Pick<WorkOpportunity, 'title' | 'description' | 'categorySlug' | 'categoryName' | 'neighborhood'>,
  ): Promise<void> {
    this.requireUser();
    await updateDoc(doc(this.requireDatabase(), 'opportunities', opportunityId), {
      title: input.title.trim(),
      description: input.description.trim(),
      categorySlug: input.categorySlug,
      categoryName: input.categoryName,
      neighborhood: input.neighborhood,
    });
  }

  async getApplications(opportunityId: string): Promise<WorkApplication[]> {
    const applications = query(
      collection(this.requireDatabase(), 'opportunities', opportunityId, 'applications'),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(applications);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as WorkApplication);
  }

  subscribeToConversations(
    onChange: (conversations: WorkConversation[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    const user = this.requireUser();
    const conversations = query(
      collection(this.requireDatabase(), 'conversations'),
      where('participantIds', 'array-contains', user.uid),
    );
    return onSnapshot(
      conversations,
      (snapshot) => onChange(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as WorkConversation)
          .sort((a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0)),
      ),
      onError,
    );
  }

  subscribeToConversationMessages(
    conversationId: string,
    onChange: (messages: ConversationMessage[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    const messages = query(
      collection(this.requireDatabase(), 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(
      messages,
      (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ConversationMessage)),
      onError,
    );
  }

  toUserMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = String(error.code);
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Este e-mail já tem uma conta. Tente entrar.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/operation-not-allowed': 'Habilite o acesso por e-mail e senha nas configurações de Authentication do Firebase.',
        'auth/user-disabled': 'Esta conta está desativada.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
        'auth/network-request-failed': 'Sem conexão com o Firebase. Verifique a internet e tente novamente.',
        'permission-denied': 'O Firebase recusou o acesso ao Firestore. No Firebase Console, abra Firestore Database → Regras, publique o conteúdo do arquivo firestore.rules e tente novamente. Sua conta de e-mail já foi criada; não crie outra.',
        'failed-precondition': 'O Firestore precisa de um índice. Confira firestore.indexes.json e publique os índices.',
        unavailable: 'O Firebase está temporariamente indisponível. Tente novamente.',
      };
      if (messages[code]) {
        return messages[code];
      }
    }
    return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.';
  }

  async publishOpportunity(input: Omit<WorkOpportunity, 'id' | 'ownerId' | 'ownerName' | 'createdAt'>): Promise<void> {
    const user = this.requireUser();
    const profile = this.profile();
    if (!profile) {
      throw new Error('Complete seu perfil antes de publicar uma oportunidade.');
    }
    await addDoc(collection(this.requireDatabase(), 'opportunities'), {
      ...input,
      ownerId: user.uid,
      ownerName: profile.displayName,
      status: 'open',
      createdAt: serverTimestamp(),
    });
  }

  async applyToOpportunity(opportunity: WorkOpportunity, message: string): Promise<string> {
    const user = this.requireUser();
    const profile = this.profile();
    if (opportunity.ownerId === user.uid) {
      throw new Error('Você não pode se candidatar à sua própria oportunidade.');
    }
    if (!profile) {
      throw new Error('Complete seu perfil antes de enviar uma candidatura.');
    }
    if (message.trim().length < 10 || message.trim().length > 1000) {
      throw new Error('A mensagem deve ter entre 10 e 1000 caracteres.');
    }
    const database = this.requireDatabase();
    const applicationRef = doc(database, 'opportunities', opportunity.id, 'applications', user.uid);
    if ((await getDoc(applicationRef)).exists()) {
      throw new Error('Você já se candidatou a esta oportunidade.');
    }
    const conversationId = this.getConversationId(opportunity.id, user.uid);
    const conversationRef = doc(database, 'conversations', conversationId);
    const userConversations = await getDocs(query(
      collection(database, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
    ));
    const existingConversation = userConversations.docs.find((item) => item.id === conversationId);
    const messageRef = doc(collection(database, 'conversations', conversationId, 'messages'));
    const batch = writeBatch(database);
    batch.set(applicationRef, {
      opportunityId: opportunity.id,
      applicantId: user.uid,
      applicantName: profile.displayName,
      message: message.trim(),
      createdAt: serverTimestamp(),
    });
    if (existingConversation) {
      batch.update(conversationRef, {
        lastMessage: message.trim(),
        lastMessageAt: serverTimestamp(),
      });
    } else {
      batch.set(conversationRef, {
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        ownerId: opportunity.ownerId,
        ownerName: opportunity.ownerName,
        applicantId: user.uid,
        applicantName: profile.displayName,
        participantIds: [opportunity.ownerId, user.uid],
        lastMessage: message.trim(),
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
    batch.set(messageRef, {
      senderId: user.uid,
      senderName: profile.displayName,
      text: message.trim(),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return conversationId;
  }

  async sendConversationMessage(conversationId: string, text: string): Promise<void> {
    const user = this.requireUser();
    const profile = this.profile();
    const normalizedText = text.trim();
    if (!profile) {
      throw new Error('Complete seu perfil antes de enviar mensagens.');
    }
    if (normalizedText.length < 1 || normalizedText.length > 1000) {
      throw new Error('A mensagem deve ter entre 1 e 1000 caracteres.');
    }

    const database = this.requireDatabase();
    const conversationRef = doc(database, 'conversations', conversationId);
    const messageRef = doc(collection(database, 'conversations', conversationId, 'messages'));
    const batch = writeBatch(database);
    batch.set(messageRef, {
      senderId: user.uid,
      senderName: profile.displayName,
      text: normalizedText,
      createdAt: serverTimestamp(),
    });
    batch.update(conversationRef, {
      lastMessage: normalizedText,
      lastMessageAt: serverTimestamp(),
    });
    await batch.commit();
  }

  subscribeToUnreadConversationStates(
    onChange: (states: ConversationUnreadState[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    const user = this.requireUser();
    return onSnapshot(
      collection(this.requireDatabase(), 'users', user.uid, 'conversationStates'),
      (snapshot) => onChange(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as ConversationUnreadState)
        .filter((state) => state.unreadCount > 0)),
      onError,
    );
  }

  subscribeToUnreadMessageCounts(
    onChange: (counts: ReadonlyMap<string, number>) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    const user = this.requireUser();
    const database = this.requireDatabase();
    const conversations = new Map<string, WorkConversation>();
    const states = new Map<string, ConversationUnreadState>();
    const counts = new Map<string, number>();
    const messageListeners = new Map<string, {
      lastReadAtMillis: number;
      unsubscribe: Unsubscribe;
    }>();

    const publishCounts = (): void => {
      onChange(new Map(counts));
    };

    const reconcileMessageListeners = (): void => {
      for (const [conversationId, listener] of messageListeners) {
        const lastReadAtMillis = states.get(conversationId)?.lastReadAt?.toMillis() ?? 0;
        if (!conversations.has(conversationId) || listener.lastReadAtMillis !== lastReadAtMillis) {
          listener.unsubscribe();
          messageListeners.delete(conversationId);
          counts.delete(conversationId);
        }
      }

      for (const conversationId of conversations.keys()) {
        const lastReadAt = states.get(conversationId)?.lastReadAt ?? null;
        const lastReadAtMillis = lastReadAt?.toMillis() ?? 0;
        if (messageListeners.has(conversationId)) {
          continue;
        }

        const messages = collection(database, 'conversations', conversationId, 'messages');
        const unreadMessages = lastReadAt
          ? query(messages, where('createdAt', '>', lastReadAt))
          : query(messages);
        const unsubscribe = onSnapshot(
          unreadMessages,
          (snapshot) => {
            const unreadCount = snapshot.docs
              .filter((message) => message.data()['senderId'] !== user.uid)
              .length;
            if (unreadCount > 0) {
              counts.set(conversationId, unreadCount);
            } else {
              counts.delete(conversationId);
            }
            publishCounts();
          },
          onError,
        );
        messageListeners.set(conversationId, { lastReadAtMillis, unsubscribe });
      }

      publishCounts();
    };

    const conversationsQuery = query(
      collection(database, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
    );
    const stopConversations = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        conversations.clear();
        for (const item of snapshot.docs) {
          conversations.set(item.id, { id: item.id, ...item.data() } as WorkConversation);
        }
        reconcileMessageListeners();
      },
      onError,
    );
    const stopStates = onSnapshot(
      collection(database, 'users', user.uid, 'conversationStates'),
      (snapshot) => {
        states.clear();
        for (const item of snapshot.docs) {
          states.set(item.id, { id: item.id, ...item.data() } as ConversationUnreadState);
        }
        reconcileMessageListeners();
      },
      onError,
    );

    return () => {
      stopConversations();
      stopStates();
      for (const listener of messageListeners.values()) {
        listener.unsubscribe();
      }
      messageListeners.clear();
    };
  }

  async markConversationAsRead(conversationId: string): Promise<void> {
    const user = this.requireUser();
    await setDoc(
      doc(this.requireDatabase(), 'users', user.uid, 'conversationStates', conversationId),
      { unreadCount: 0, lastReadAt: serverTimestamp() },
      { merge: true },
    );
  }

  async savePushToken(userId: string, token: string): Promise<void> {
    await setDoc(
      doc(this.requireDatabase(), 'users', userId, 'devices', encodeURIComponent(token)),
      { token, updatedAt: serverTimestamp() },
    );
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    await deleteDoc(doc(
      this.requireDatabase(),
      'users',
      userId,
      'devices',
      encodeURIComponent(token),
    ));
  }

  async ensureConversationForApplication(
    opportunity: WorkOpportunity,
    application: WorkApplication,
  ): Promise<string> {
    const user = this.requireUser();
    if (opportunity.ownerId !== user.uid) {
      throw new Error('Somente quem publicou a oportunidade pode iniciar esta conversa.');
    }

    const database = this.requireDatabase();
    const conversationId = this.getConversationId(opportunity.id, application.applicantId);
    const conversationRef = doc(database, 'conversations', conversationId);
    const opportunityRef = doc(database, 'opportunities', opportunity.id);
    const applicationRef = doc(database, 'opportunities', opportunity.id, 'applications', application.applicantId);
    const messageRef = doc(collection(database, 'conversations', conversationId, 'messages'));
    const ownerConversations = await getDocs(query(
      collection(database, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
    ));
    if (ownerConversations.docs.some((item) => item.id === conversationId)) {
      return conversationId;
    }

    await runTransaction(database, async (transaction) => {
      const [opportunitySnapshot, applicationSnapshot] = await Promise.all([
        transaction.get(opportunityRef),
        transaction.get(applicationRef),
      ]);
      if (!opportunitySnapshot.exists() || !applicationSnapshot.exists()) {
        throw new Error('A oportunidade ou candidatura não está mais disponível.');
      }

      const opportunityData = opportunitySnapshot.data();
      const applicationData = applicationSnapshot.data() as WorkApplication;
      if (opportunityData['ownerId'] !== user.uid || applicationData.applicantId !== application.applicantId) {
        throw new Error('Não foi possível validar esta candidatura.');
      }

      transaction.set(conversationRef, {
        opportunityId: opportunity.id,
        opportunityTitle: opportunityData['title'] as string,
        ownerId: user.uid,
        ownerName: opportunityData['ownerName'] as string,
        applicantId: applicationData.applicantId,
        applicantName: applicationData.applicantName,
        participantIds: [user.uid, applicationData.applicantId],
        lastMessage: applicationData.message,
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      transaction.set(messageRef, {
        senderId: applicationData.applicantId,
        senderName: applicationData.applicantName,
        text: applicationData.message,
        createdAt: applicationData.createdAt ?? serverTimestamp(),
      });
    });

    return conversationId;
  }

  getConversationId(opportunityId: string, applicantId: string): string {
    return `${opportunityId}_${applicantId}`;
  }

  private loadCurrentProfile(uid: string): Promise<void> {
    if (this.profileLoadTask?.uid === uid) {
      return this.profileLoadTask.promise;
    }

    const promise = this.fetchCurrentProfile(uid);
    this.profileLoadTask = { uid, promise };
    void promise.then(() => {
      if (this.profileLoadTask?.promise === promise) {
        this.profileLoadTask = null;
      }
    });
    return promise;
  }

  private async fetchCurrentProfile(uid: string): Promise<void> {
    try {
      const profile = await this.getProfile(uid);
      if (this.currentUser()?.uid !== uid) {
        return;
      }
      this.profile.set(profile ?? {
        id: uid,
        displayName: this.currentUser()?.displayName ?? '',
        categorySlug: '',
        categoryName: '',
        neighborhood: '',
        bio: '',
      });
    } catch (error) {
      this.profileError.set(this.toUserMessage(error));
    } finally {
      if (this.currentUser()?.uid === uid) {
        this.profileLoading.set(false);
      }
    }
  }

  private async compressProfilePhoto(file: File): Promise<string> {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Não foi possível abrir esta imagem. Escolha outra foto.'));
        image.src = objectUrl;
      });

      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) * 0.2;
      const outputSize = Math.min(512, sourceSize);
      const scale = outputSize / sourceSize;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceSize * scale));
      canvas.height = Math.max(1, Math.round(sourceSize * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Não foi possível preparar a foto neste dispositivo.');
      }
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const maxPhotoBytes = 400 * 1024;
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= maxPhotoBytes) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result);
              } else {
                reject(new Error('Não foi possível preparar a foto para salvar.'));
              }
            };
            reader.onerror = () => reject(new Error('Não foi possível ler a foto selecionada.'));
            reader.readAsDataURL(blob);
          });
        }
      }
      throw new Error('Não foi possível reduzir a foto o suficiente. Escolha uma imagem menor.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private requireAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase ainda não foi configurado. Preencha os dados em src/environments/environment.ts.');
    }
    return this.auth;
  }

  private requireDatabase(): Firestore {
    if (!this.database) {
      throw new Error('Firebase ainda não foi configurado. Preencha os dados em src/environments/environment.ts.');
    }
    return this.database;
  }

  private requireUser(): FirebaseUser {
    const user = this.currentUser();
    if (!user) {
      throw new Error('Entre na sua conta para continuar.');
    }
    return user;
  }

}
