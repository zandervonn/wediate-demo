import { useId, type ReactNode } from "react";

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const id = useId();
  return (
    <span
      className="app-tooltip"
      data-side={side}
      data-align={align}
      aria-describedby={id}
    >
      <span className="app-tooltip-anchor">{children}</span>
      <span className="app-tooltip-card" id={id} role="tooltip">
        {content}
      </span>
    </span>
  );
}
