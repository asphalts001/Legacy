/* ═══════════════════════════════════════════════════════════════
   theme-loader.js — StudyApp theme switcher
   Loads theme-royal.css / theme-obsidian.css / theme-ivory.css
   depending on saved preference. theme.css has no :root block.
   ═══════════════════════════════════════════════════════════════ */

const ThemeLoader = (function () {
  const STORAGE_KEY = 'studyapp_theme';
  const THEMES = ['royal', 'obsidian', 'ivory'];
  const DEFAULT = 'royal';

  function apply(name) {
    if (!THEMES.includes(name)) name = DEFAULT;

    let link = document.getElementById('theme-override-link');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = 'theme-override-link';
      const base = document.querySelector('link[href="theme.css"]');
      if (base) base.after(link);
      else document.head.appendChild(link);
    }

    link.href = `theme-${name}.css`;

    document.documentElement.setAttribute('data-theme', name);

    document.querySelectorAll('.theme-swatch').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === name);
    });
  }

  function get() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT;
  }

  function set(name) {
    localStorage.setItem(STORAGE_KEY, name);
    apply(name);
  }

  // Auto-apply saved theme immediately on load
  apply(get());

  return { set, get, apply };
})();
