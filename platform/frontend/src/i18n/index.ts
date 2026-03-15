import { useContext } from 'react';
import { LangContext } from '../store/langStore';
import { translations, TranslationKey, Lang, BilingualText } from './translations';

export function useI18n() {
  const { lang } = useContext(LangContext);

  /** 获取 app 字符串 */
  function t(key: TranslationKey): string {
    return translations[key][lang as Lang] ?? translations[key].zh;
  }

  /** 获取故事数据中的双语字段 */
  function tf(obj: BilingualText | string | undefined): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang as Lang] ?? obj.zh;
  }

  return { t, tf, lang };
}
