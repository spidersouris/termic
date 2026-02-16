(() => {
  "use strict";

  const THEME_KEY = "theme";
  const DARK_QUERY = "(prefers-color-scheme: dark)";

  const $ = (sel, root = document) => root.querySelector(sel);

  const getStoredTheme = () => localStorage.getItem(THEME_KEY);

  const getOSTheme = () =>
    window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";

  const getPreferredTheme = () => getStoredTheme() ?? getOSTheme();

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    updateToggleButton(theme);
  };

  const setTheme = (theme) => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  };

  const toggleTheme = () => {
    const current = document.documentElement.dataset.theme || "light";
    setTheme(current === "light" ? "dark" : "light");
  };

  const updateToggleButton = (theme) => {
    const btn = $("#theme-toggle");
    if (!btn) return;

    const icon = btn.querySelector("i");
    if (!icon) return;

    const isDark = theme === "dark";
    icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  };

  const setupDOM = () => {
    const btn = $("#theme-toggle");
    if (!btn) return;

    updateToggleButton(document.documentElement.dataset.theme);
    btn.addEventListener("click", toggleTheme);
  };

  const setupOSListener = () => {
    const mql = window.matchMedia?.(DARK_QUERY);
    if (!mql) return;

    const onChange = (e) => {
      if (getStoredTheme()) return; // user explicitly chose; don't override
      applyTheme(e.matches ? "dark" : "light");
    };

    mql.addEventListener("change", onChange);
  };

  const init = () => {
    applyTheme(getPreferredTheme());

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupDOM, { once: true });
    } else {
      setupDOM();
    }

    setupOSListener();
  };

  init();
})();
