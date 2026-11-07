const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

initializeApp();

const database = getFirestore();

exports.notifyOnConversationMessage = onDocumentCreated(
  'conversations/{conversationId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    if (!message || typeof message.senderId !== 'string') {
      return;
    }

    const { conversationId, messageId } = event.params;
    const conversationRef = database.doc(`conversations/${conversationId}`);
    const conversationSnapshot = await conversationRef.get();
    if (!conversationSnapshot.exists) {
      return;
    }

    const conversation = conversationSnapshot.data();
    const participantIds = conversation.participantIds;
    if (!Array.isArray(participantIds) || typeof message.text !== 'string') {
      return;
    }

    const recipientId = participantIds.find((participantId) => participantId !== message.senderId);
    if (!recipientId) {
      return;
    }

    const opportunityTitle = conversation.opportunityTitle ?? 'Oportunidade';
    const opportunityId = conversation.opportunityId ?? '';
    const stateRef = database.doc(`users/${recipientId}/conversationStates/${conversationId}`);
    const receiptRef = database.doc(`users/${recipientId}/processedMessages/${conversationId}_${messageId}`);
    const shouldNotify = await database.runTransaction(async (transaction) => {
      const [stateSnapshot, receiptSnapshot] = await Promise.all([
        transaction.get(stateRef),
        transaction.get(receiptRef),
      ]);
      if (receiptSnapshot.exists) {
        return false;
      }

      const state = stateSnapshot.data() ?? {};
      const messageMillis = message.createdAt?.toMillis?.() ?? 0;
      const lastReadMillis = state.lastReadAt?.toMillis?.() ?? 0;
      transaction.create(receiptRef, { processedAt: FieldValue.serverTimestamp() });

      if (lastReadMillis >= messageMillis && messageMillis > 0) {
        return false;
      }

      transaction.set(stateRef, {
        unreadCount: (state.unreadCount ?? 0) + 1,
        lastReadAt: state.lastReadAt ?? null,
        lastMessage: message.text,
        lastMessageAt: message.createdAt ?? FieldValue.serverTimestamp(),
        conversationId,
        opportunityTitle,
        otherUserName: message.senderName ?? 'Nova mensagem',
      }, { merge: true });
      return true;
    });

    if (!shouldNotify) {
      return;
    }

    const devicesSnapshot = await database.collection(`users/${recipientId}/devices`).get();
    const deviceDocs = devicesSnapshot.docs.filter((device) => typeof device.data().token === 'string');
    const tokens = deviceDocs.map((device) => device.data().token);
    if (tokens.length === 0) {
      return;
    }

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: `${message.senderName ?? 'Nova mensagem'} · ${opportunityTitle}`,
        body: message.text.slice(0, 180),
      },
      data: {
        conversationId,
        opportunityId,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'messages',
          sound: 'default',
        },
      },
    });

    const invalidTokenCodes = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
    ]);
    await Promise.all(response.responses.map(async (result, index) => {
      if (!result.success && result.error && invalidTokenCodes.has(result.error.code)) {
        await deviceDocs[index].ref.delete();
      }
    }));
  },
);
