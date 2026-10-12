import type { StudyState } from "../domain/model";
export interface StudyRepository {
  unlock(password: string): Promise<StudyState>;
  save(state: StudyState): Promise<void>;
  lock(): void;
}
export interface DownloadPort {
  save(filename: string, content: string, mime: string): void;
}
export interface Clock {
  now(): string;
}
export interface IdGenerator {
  next(): string;
}
export interface StudyUseCases {
  unlock(password: string): Promise<StudyState>;
  snapshot(): StudyState;
  lock(): void;
  restoreBackup(json: string): Promise<StudyState>;
  importQuestions(json: string): Promise<StudyState>;
  start(chapterId: number): Promise<StudyState>;
  answer(index: number, answer: number, note: string): Promise<StudyState>;
  finish(): Promise<import("../domain/model").Attempt>;
  abandon(): Promise<StudyState>;
  downloadReport(attempt: import("../domain/model").Attempt): void;
  downloadScores(): void;
  downloadBackup(): void;
  downloadQuestions(chapterId: number): void;
}
