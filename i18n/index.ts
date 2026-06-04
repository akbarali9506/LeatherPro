import { Language } from '../types';
import en from './en';
import uz from './uz';
import ru from './ru';

const translations = { en, uz, ru };

export type TranslationKey = keyof typeof en;

export function t(lang: Language, key: TranslationKey): string {
  return (translations[lang] as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
}

export default translations;
