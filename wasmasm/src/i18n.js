import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import hi from './locales/hi.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ar from './locales/ar.json'
import bn from './locales/bn.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import ur from './locales/ur.json'

/**
 * Each entry is { code, nativeName } where nativeName is how the language
 * names itself (used in the selector so users can always read their own option).
 * Add new locales here and drop the matching JSON file in src/locales/.
 */
export const SUPPORTED_LOCALES = [
  { code: 'en', nativeName: 'English' },
  { code: 'zh-CN', nativeName: '简体中文' },
  { code: 'hi', nativeName: 'हिन्दी' },
  { code: 'es', nativeName: 'Español' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'ar', nativeName: 'العربية' },
  { code: 'bn', nativeName: 'বাংলা' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'ur', nativeName: 'اردو' },
]

const messages = {
  en,
  'zh-CN': zhCN,
  hi,
  es,
  fr,
  ar,
  bn,
  pt,
  ru,
  ur,
}

function savedLocale() {
  try { return localStorage.getItem('wasmasm_locale') } catch { return null }
}

const locale = (() => {
  const stored = savedLocale()
  return stored && messages[stored] ? stored : 'en'
})()

const i18n = createI18n({
  legacy: true,          // Options-API components use this.$t()
  locale,
  fallbackLocale: 'en',
  messages,
})

export default i18n
