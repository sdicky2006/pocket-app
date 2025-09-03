"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Hydration-safe: determine theme on client after mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem("pocket-app:theme");
      let next: "light" | "dark" = "light";
      if (saved === "light" || saved === "dark") next = saved;
      else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) next = "dark";
      setTheme(next);
      document.documentElement.setAttribute("data-bs-theme", next);
      window.localStorage.setItem("pocket-app:theme", next);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      document.documentElement.setAttribute("data-bs-theme", theme);
      window.localStorage.setItem("pocket-app:theme", theme);
    } catch {}
  }, [theme, mounted]);

  const label = mounted ? (theme === "dark" ? "Light Mode" : "Dark Mode") : "Theme";

  return (
    <button
      type="button"
      className="btn btn-outline-secondary btn-sm"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <span suppressHydrationWarning>{label}</span>
    </button>
  );
}


