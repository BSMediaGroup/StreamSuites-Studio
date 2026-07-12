import { useGlobalActivityContext } from "./globalActivityContext";

export function GlobalLoadingBar() {
  const { activeCount } = useGlobalActivityContext();
  const active = activeCount > 0;
  return (
    <div
      className={`global-loading-bar${active ? " global-loading-bar--active" : ""}`}
      aria-hidden="true"
      data-active-count={activeCount}
    >
      <span className="global-loading-bar__track" />
      <span className="global-loading-bar__gradient" />
    </div>
  );
}
