export interface MarketplaceCategory {
  slug: string;
  name: string;
  icon: string;
  image?: string;
  description: string;
}

export interface Professional {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  neighborhood: string;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  startingPrice: number;
  summary: string;
  initials: string;
  verified: boolean;
  portfolio: string[];
}

export interface FeaturedCompany {
  id: string;
  name: string;
  categoryName: string;
  neighborhood: string;
  rating: number;
  reviewCount: number;
  summary: string;
  initials: string;
  offerings: string[];
}

export interface LocalNews {
  title: string;
  category: string;
  publishedAt: string;
  sponsored: boolean;
}
