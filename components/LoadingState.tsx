type LoadingStateProps = {
  title?: string;
  message?: string;
  compact?: boolean;
};

export function LoadingState({
  title = "กำลังโหลดข้อมูล",
  message = "กำลังเตรียมข้อมูลจาก Google Sheet",
  compact = false
}: LoadingStateProps) {
  return (
    <div className={compact ? "loading-state loading-state-compact" : "loading-state"} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}
