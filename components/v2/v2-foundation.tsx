import type { HTMLAttributes, ReactNode } from "react";
import styles from "./v2-foundation.module.css";

type V2FoundationProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/**
 * Explicit boundary for future V2 presentation work.
 *
 * Phase 1 intentionally has no production consumer. Rendering this boundary is
 * the only supported way to activate the V2 custom properties.
 */
export function V2Foundation({
  children,
  className = "",
  ...props
}: V2FoundationProps) {
  return (
    <div
      className={[styles.root, "securium-v2", className].filter(Boolean).join(" ")}
      data-v2-foundation=""
      {...props}
    >
      {children}
    </div>
  );
}
