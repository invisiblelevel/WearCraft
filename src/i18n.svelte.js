// Локализация с реактивным t()
// Словари хранятся в $state, t() читает из реактивного поля

const LOCALES = ['ru', 'en', 'zh'];
const FALLBACK = 'en';

// Реактивное хранилище
export const i18n = $state({
  locale: FALLBACK,
  ready: false,
  dict: {},       // текущий словарь
  fallback: {},   // английский (страховка)
});

async function loadJSON(code) {
  const res = await fetch(`./locales/${code}.json`);
  if (!res.ok) throw new Error(`Locale ${code} not found: ${res.status}`);
  return await res.json();
}

export async function initI18n() {
  // 1. Сохранённый выбор
  let code = localStorage.getItem('wearcraft.locale');
  // 2. Системный
  if (!code) {
    const sys = (navigator.language || 'en').slice(0, 2).toLowerCase();
    code = LOCALES.includes(sys) ? sys : FALLBACK;
  }
  await setLocale(code);
  i18n.ready = true;
}

export async function setLocale(code) {
  if (!LOCALES.includes(code)) code = FALLBACK;

  // Загружаем оба словаря (текущий + фоллбек), чтобы t() работал всегда
  if (!i18n.fallback || Object.keys(i18n.fallback).length === 0) {
    i18n.fallback = await loadJSON(FALLBACK);
  }
  if (code === FALLBACK) {
    i18n.dict = i18n.fallback;
  } else {
    i18n.dict = await loadJSON(code);
  }
  i18n.locale = code;
  localStorage.setItem('wearcraft.locale', code);
  document.documentElement.lang = code;
}

export function getLocale() {
  return i18n.locale;
}

// Реактивный t() — читает i18n.dict, поэтому Svelte видит изменения
export function t(key) {
  const dict = i18n.dict || {};
  const fb = i18n.fallback || {};
  return dict[key] ?? fb[key] ?? key;
}