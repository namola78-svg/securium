import type { MobileNavIcon } from "@/lib/ui-nav";

export function NavigationIcon({ name }: { name: MobileNavIcon }) {
  const common = { "aria-hidden": true, fill: "none", focusable: false, stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8, viewBox: "0 0 24 24" };
  switch (name) {
    case "book-open": return <svg {...common}><path d="M3.5 5.5A2.5 2.5 0 0 1 6 3h5.5v16H6a2.5 2.5 0 0 0-2.5 2.5z" /><path d="M20.5 5.5A2.5 2.5 0 0 0 18 3h-6.5v16H18a2.5 2.5 0 0 1 2.5 2.5z" /><path d="M3.5 21.5h17" /></svg>;
    case "file-question": return <svg {...common}><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M9.5 11a2.25 2.25 0 1 1 3.77 1.65c-.77.69-1.27 1.03-1.27 2.1" /><path d="M12 17.75h.01" /></svg>;
    case "clipboard-check": return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 13l2 2 4-5" /></svg>;
    case "graduation-cap": return <svg {...common}><path d="m3 9 9-4 9 4-9 4z" /><path d="M7 11.1V15c2.7 2 7.3 2 10 0v-3.9M21 9v6" /></svg>;
    case "rotate-ccw": return <svg {...common}><path d="M4 4v6h6" /><path d="M5.5 16A8 8 0 1 0 5 9.5L4 10" /></svg>;
    case "bookmark": return <svg {...common}><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" /></svg>;
    case "chart": return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case "user": return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
    case "sparkles": return <svg {...common}><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM18.5 14l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7zM5.5 13l.7 2.3 2.3.7-2.3.7L5.5 19l-.7-2.3-2.3-.7 2.3-.7z" /></svg>;
    case "settings": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1A7 7 0 0 0 15 6l-.3-2.5h-4L10.5 6A7 7 0 0 0 9 7L6.6 6 4.5 9.5l2 1.5a7 7 0 0 0 0 2l-2 1.5L6.6 18 9 17a7 7 0 0 0 1.5 1l.2 2.5h4L15 18a7 7 0 0 0 1.5-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" /></svg>;
    case "home": default: return <svg {...common}><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5M9.5 21v-6h5v6" /></svg>;
  }
}
