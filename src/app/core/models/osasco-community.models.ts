import { Timestamp } from 'firebase/firestore';

export type OsascoPostType = 'news' | 'event' | 'football';

export interface OsascoPost {
  id: string;
  type: OsascoPostType;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  startsAt: Timestamp | null;
  venue: string;
  neighborhood: string;
  homeTeam: string;
  awayTeam: string;
  publishedAt: Timestamp | null;
  createdAt: Timestamp | null;
}
