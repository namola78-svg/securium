import type { MobileNavIcon } from "@/lib/ui-nav";

export function NavigationIcon({ name }: { name: MobileNavIcon }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    focusable: false,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  switch (name) {
    case "book-open":
      return <svg {...common}><path d="M3.5 5.5A2.5 2.5 0 0 1 6 3h5.5v16H6a2.5 2.5 0 0 0-2.5 2.5z" /><path d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-6.5v16H18a2.5 2.5 0 0 1 2.5 2.5z" /><path d="M3.5 21.5h17" /></svg>;
    case "file-question":
      return <svg {...common}><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M9.5 11a2.25 2.25 0 1 1 3.77 1.65c-.77.69-1.27 1.03-1.27 2.1" /><path d="M12 17.75h.01" /></svg>;
    case "briefcase":
      return <svg {...common}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18M10 12v2h4v-2" /></svg>;
    case "graduation-cap":
      return <svg {...common}><path d="m3 9 9-4 9 4-9 4z" /><path d="M7 11.1V15c2.7 2 7.3 2 10 0v-3.9M21 9v6" /><path d="M19.5 18.5c.7-1.1 1-2.3 1-3.5" /></svg>;
    case "home":
    default:
      return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5M9.5 21v-6h5v6" /></svg>;
  }
}
