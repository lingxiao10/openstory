import { useContext } from 'react';
import { LangContext } from '../store/langStore';

export function LanguageSwitcher() {
  const { lang, setLang } = useContext(LangContext);

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button
        onClick={() => setLang('zh')}
        style={{
          padding: '4px 10px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: lang === 'zh' ? '#6366f1' : 'transparent',
          color: lang === 'zh' ? '#fff' : '#94a3b8',
          fontWeight: lang === 'zh' ? 700 : 400,
          fontSize: 13,
          transition: 'all 0.2s',
        }}
      >
        中文
      </button>
      <button
        onClick={() => setLang('en')}
        style={{
          padding: '4px 10px',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: lang === 'en' ? '#6366f1' : 'transparent',
          color: lang === 'en' ? '#fff' : '#94a3b8',
          fontWeight: lang === 'en' ? 700 : 400,
          fontSize: 13,
          transition: 'all 0.2s',
        }}
      >
        EN
      </button>
    </div>
  );
}
