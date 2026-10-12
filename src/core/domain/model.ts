export type SourceKind = "book" | "notes" | "supplemental";
export interface Question {
  id: string;
  topic: string;
  section: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}
export interface Chapter {
  id: number;
  title: string;
  description: string;
  kind: SourceKind;
  source: string;
  questions: Question[];
}
export interface QuestionSet {
  format: 1;
  book: string;
  version: string;
  chapter: Chapter;
}
export interface Catalog {
  book: string;
  version: string;
  chapterVersions?: Record<string, string>;
  chapters: Chapter[];
}
export interface Attempt {
  id: string;
  date: string;
  book: string;
  version: string;
  chapter: Chapter;
  answers: number[];
  notes: string[];
}
export interface Draft {
  chapterId: number;
  version: string;
  answers: (number | null)[];
  notes: string[];
  index: number;
}
export interface StudyState {
  catalog: Catalog;
  attempts: Attempt[];
  draft: Draft | null;
}
export interface Grade {
  score: number;
  correct: number;
  total: number;
}
