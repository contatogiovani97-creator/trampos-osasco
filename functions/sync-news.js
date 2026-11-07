const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');
const { parseGoogleNewsRss } = require('./news-feed');

async function syncOsascoNews() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment secret');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON', { cause: error });
  }
  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing required service-account fields');
  }

  const app = getApps()[0] ?? initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  const database = getFirestore(app);
  const feedUrl = 'https://news.google.com/rss/search?q=Osasco&hl=pt-BR&gl=BR&ceid=BR:pt-419';
  const response = await fetch(feedUrl, {
    headers: { 'User-Agent': 'TramposOsasco/1.0 (news feed)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Google Notícias RSS returned HTTP ${response.status}`);
  }

  const articles = parseGoogleNewsRss(await response.text()).slice(0, 30);
  if (articles.length === 0) {
    throw new Error('Google Notícias RSS returned no valid Osasco articles');
  }

  const newsCollection = database.collection('osascoPosts');
  const existingSnapshot = await newsCollection.where('provider', '==', 'google-news').get();
  const existingIds = new Set(existingSnapshot.docs.map((document) => document.id));
  const activeIds = new Set();
  const writes = [];

  for (const article of articles) {
    const id = `google-news-${createHash('sha256').update(article.sourceUrl).digest('hex').slice(0, 32)}`;
    activeIds.add(id);
    const post = {
      type: 'news',
      title: article.title,
      summary: article.summary,
      sourceName: article.sourceName,
      sourceUrl: article.sourceUrl,
      startsAt: null,
      venue: '',
      neighborhood: '',
      homeTeam: '',
      awayTeam: '',
      publishedAt: article.publishedAt ?? new Date(),
      provider: 'google-news',
      status: 'published',
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!existingIds.has(id)) {
      post.createdAt = FieldValue.serverTimestamp();
    }
    writes.push({ reference: newsCollection.doc(id), data: post });
  }

  for (const document of existingSnapshot.docs) {
    if (!activeIds.has(document.id)) {
      writes.push({
        reference: document.ref,
        data: { status: 'archived', updatedAt: FieldValue.serverTimestamp() },
      });
    }
  }

  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = database.batch();
    for (const write of writes.slice(offset, offset + 400)) {
      batch.set(write.reference, write.data, { merge: true });
    }
    await batch.commit();
  }

  console.log(`Synced ${articles.length} Osasco news articles to ${serviceAccount.project_id}.`);
}

syncOsascoNews().catch((error) => {
  console.error('Failed to sync Osasco news:', error);
  process.exitCode = 1;
});
