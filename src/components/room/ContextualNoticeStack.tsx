import { useCallback, useEffect, useRef } from "react";
import type { NoticeDuration } from "../../presentation/presentationPreferences";

export type ContextualNoticeTone = "info" | "success" | "warning" | "error";

export interface ContextualNotice {
  readonly id: number;
  readonly message: string;
  readonly tone: ContextualNoticeTone;
}

export function inferContextualNoticeTone(message: string): ContextualNoticeTone {
  const text = message.toLowerCase();
  if (/could not|not allowed|failed|unavailable|stage full|error/.test(text)) return "error";
  if (/updated|moved|revoked|created|saved|changed|returned/.test(text)) return "success";
  if (/not connected|blocked|warning/.test(text)) return "warning";
  return "info";
}

function NoticeItem({ notice, duration, onDismiss }: { readonly notice: ContextualNotice; readonly duration: NoticeDuration; readonly onDismiss: (id: number) => void }) {
  const timer = useRef(0);
  const remaining = useRef(0);
  const startedAt = useRef(0);
  const timeout = duration === "manual" ? null : Math.max(duration, notice.tone === "error" ? 12000 : notice.tone === "warning" ? 8000 : 0);

  const pause = useCallback(() => {
    if (!timer.current) return;
    window.clearTimeout(timer.current);
    timer.current = 0;
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);
  const resume = useCallback(() => {
    if (timeout === null || timer.current || remaining.current <= 0) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => onDismiss(notice.id), remaining.current);
  }, [notice.id, onDismiss, timeout]);

  useEffect(() => {
    if (timeout === null) return;
    remaining.current = timeout;
    resume();
    return () => window.clearTimeout(timer.current);
  }, [resume, timeout]);

  return <article className={`contextual-notice contextual-notice--${notice.tone}`} onPointerEnter={pause} onPointerLeave={resume} onFocusCapture={pause} onBlurCapture={resume}>
    <span>{notice.message}</span>
    <button type="button" aria-label="Dismiss notice" onClick={() => onDismiss(notice.id)}>×</button>
  </article>;
}

export function ContextualNoticeStack({ notices, duration, onDismiss }: { readonly notices: readonly ContextualNotice[]; readonly duration: NoticeDuration; readonly onDismiss: (id: number) => void }) {
  if (!notices.length) return null;
  return <section className="contextual-notice-stack" aria-label="Room notices" role="status" aria-live="polite" aria-atomic="false">
    {notices.map((notice) => <NoticeItem key={notice.id} notice={notice} duration={duration} onDismiss={onDismiss} />)}
  </section>;
}
