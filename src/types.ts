export type Plan = "free" | "pro";

export interface Blog {
  id: string;
  name: string;
  url: string;
  posts: number;
  pages: number;
}

export interface DiagnosisSummary {
  seoScore: number;
  brokenLinks: number;
  seoIssues: number;
  pagesChecked: number;
  postsChecked: number;
  critical: string[];
  seo: string[];
  good: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt?: unknown;
  read?: boolean;
  url?: string;
}

export interface SEOSuggestion {
  id: string;
  topic: string;
  reason: string;
  keywords: string[];
  suggestedTime: string;
  competition: "low";
  createdAt?: unknown;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  pro?: boolean;
  installed?: boolean;
  snippet: string;
  instructions: string[];
  requirements?: string[];
  integrationTarget?: "article-start" | "article-end" | "theme" | "server" | "editor";
}