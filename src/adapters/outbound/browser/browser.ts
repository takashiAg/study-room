import type { Catalog, StudyState } from "../../../core/domain/model";
import type {
  DownloadPort,
  StudyRepository,
} from "../../../core/application/ports";
import {
  validateCatalog,
  validateStudyState,
} from "../../../core/domain/study";
import { seal, unseal } from "./crypto";
export class BrowserStudyRepository implements StudyRepository {
  private password: string | null = null;
  private storageKey = "study-room-v1";
  async unlock(password: string): Promise<StudyState> {
    const response = await fetch(`${import.meta.env.BASE_URL}vault.json`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error("初期データを読み込めません。接続を確認してください。");
    let catalog: Catalog;
    try {
      catalog = validateCatalog(await unseal(await response.json(), password));
    } catch {
      throw new Error("パスワードが違うか、初期データが破損しています。");
    }
    this.storageKey = `study-room-v1:${catalog.book}`;
    let state: StudyState;
    try {
      const stored = localStorage.getItem(this.storageKey);
      state = stored
        ? validateStudyState(await unseal(JSON.parse(stored), password))
        : { catalog, attempts: [], draft: null };
    } catch {
      throw new Error(
        "保存済みの履歴を開けません。以前のパスワードと保存データをご確認ください。履歴は上書きしていません。",
      );
    }
    if (state.catalog.book !== catalog.book)
      throw new Error("保存されたデータの書名が一致しません。");
    this.password = password;
    return state;
  }
  async save(state: StudyState) {
    if (!this.password) throw new Error("パスワードを入力してください。");
    const password = this.password,
      storageKey = this.storageKey;
    const envelope = await seal(state, password);
    if (this.password !== password || this.storageKey !== storageKey)
      throw new Error("学習室はロックされています。");
    try {
      localStorage.setItem(storageKey, JSON.stringify(envelope));
    } catch {
      throw new Error(
        "ブラウザに保存できません。空き容量や保存設定をご確認ください。",
      );
    }
  }
  lock() {
    this.password = null;
  }
}
export class BrowserDownload implements DownloadPort {
  save(filename: string, content: string, mime: string) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
