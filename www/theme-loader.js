/* ═══════════════════════════════════════════════════════════════════
   theme-loader.js — StudyApp Theme Switcher
   ─────────────────────────────────────────────────────────────────
   Architecture:
     theme.css            →  always loaded (layout, structure, tokens)
     theme-{name}.css     →  palette override injected after theme.css
                             contains: colours + fonts (both in one file)

   Available themes:
     'royal'    Egyptian gold / parchment / navy   (default)
     'obsidian' Volcanic dark / amber / teal
     'ivory'    Warm light / terracotta / sage

   Usage:
     ThemeLoader.set('obsidian')   — switch + persist
     ThemeLoader.get()             — current theme name
     ThemeLoader.apply('ivory')    — switch without persisting

   Dashboard swatches:
     <button class="theme-swatch" data-theme="royal"    onclick="ThemeLoader.set(this.dataset.theme)">Royal</button>
     <button class="theme-swatch" data-theme="obsidian" onclick="ThemeLoader.set(this.dataset.theme)">Obsidian</button>
     <button class="theme-swatch" data-theme="ivory"    onclick="ThemeLoader.set(this.dataset.theme)">Ivory</button>

   The loader runs immediately (before DOMContentLoaded) to avoid
   a flash of unstyled / wrong-theme content.
   ═══════════════════════════════════════════════════════════════ */

const ThemeLoader = (function () {

  /* ── Config ── */
  const STORAGE_KEY = 'studyapp_theme';
  const DEFAULT     = 'royal';
  const THEMES      = ['royal', 'obsidian', 'ivory'];

  /* ── Link element id injected into <head> ── */
  const LINK_ID = 'theme-palette-link';

  /* ── Inject or swap the palette <link> tag ── */
  function _injectLink(href) {
    let link = document.getElementById(LINK_ID);
    if (!link) {
      link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.id   = LINK_ID;
      /* Insert immediately after theme.css so cascade order is correct */
      const base = document.querySelector('link[href="theme.css"]');
      if (base) base.after(link);
      else document.head.appendChild(link);
    }
    if (link.href !== new URL(href, location.href).href) {
      link.href = href;
    }
    return link;
  }

  /* ── Apply theme by name ── */
  function apply(name) {
    if (!THEMES.includes(name)) name = DEFAULT;

    /* Always inject the palette file — royal also has one so
       the font imports are always loaded from a single source */
    _injectLink(`theme-${name}.css`);

    /* data-theme on <html> for any CSS you want scoped later */
    document.documentElement.setAttribute('data-theme', name);

    /* Sync swatch buttons if the panel is already in the DOM */
    _syncSwatches(name);
  }

  /* ── Mark the active swatch; safe to call before panel exists ── */
  function _syncSwatches(name) {
    document.querySelectorAll('.theme-swatch').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === name);
    });
  }

  /* ── Public: switch + persist ── */
  function set(name) {
    if (!THEMES.includes(name)) name = DEFAULT;
    localStorage.setItem(STORAGE_KEY, name);
    apply(name);
  }

  /* ── Public: read current theme ── */
  function get() {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT;
  }

  /* ── Re-sync swatches once DOM is ready (panel may load late) ── */
  document.addEventListener('DOMContentLoaded', function () {
    _syncSwatches(get());

    /* Wire up any swatch buttons that used data-theme + no onclick */
    document.querySelectorAll('.theme-swatch[data-theme]').forEach(btn => {
      if (!btn.dataset.loaderBound) {
        btn.addEventListener('click', () => set(btn.dataset.theme));
        btn.dataset.loaderBound = '1';
      }
    });
  });

  /* ── Auto-apply immediately on script parse ── */
  apply(get());

  return { set, get, apply };

})();
