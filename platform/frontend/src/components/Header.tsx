import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../store/authStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../i18n';
import { useAudio } from './AudioManager';

export function Header() {
  const { isLoggedIn, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toggleBgm, bgmEnabled } = useAudio();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="site-header" style={{
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      padding: '0 24px',
      height: 60,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <span className="header-logo" style={{ color: '#6366f1', fontWeight: 800, fontSize: 20, letterSpacing: 1 }}>
          Open<span style={{ color: '#e2e8f0' }}>Story</span>
        </span>
      </Link>

      <nav className="header-nav" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <a
          href="https://github.com/lingxiao10/openstory"
          target="_blank"
          rel="noopener noreferrer"
          className="header-github"
          style={{ color: '#64748b', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          title="GitHub"
        >
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style={{ display: 'block' }}>
            <path d="M10.303 16.652c-2.837-.344-4.835-2.385-4.835-5.028 0-1.074.387-2.235 1.031-3.008-.279-.709-.236-2.214.086-2.837.86-.107 2.02.344 2.708.967.816-.258 1.676-.386 2.728-.386 1.053 0 1.913.128 2.686.365.666-.602 1.848-1.053 2.708-.946.3.581.344 2.085.064 2.815.688.817 1.053 1.913 1.053 3.03 0 2.643-1.998 4.641-4.877 5.006.73.473 1.224 1.504 1.224 2.686v2.235c0 .644.537 1.01 1.182.752 3.889-1.483 6.94-5.372 6.94-10.185 0-6.081-4.942-11.044-11.022-11.044-6.081 0-10.98 4.963-10.98 11.044a10.84 10.84 0 0 0 7.112 10.206c.58.215 1.139-.172 1.139-.752v-1.719a2.768 2.768 0 0 1-1.032.215c-1.418 0-2.256-.773-2.857-2.213-.237-.58-.495-.924-.989-.988-.258-.022-.344-.129-.344-.258 0-.258.43-.451.86-.451.623 0 1.16.386 1.719 1.181.43.623.881.903 1.418.903.537 0 .881-.194 1.375-.688.365-.365.645-.687.903-.902Z" />
          </svg>
        </a>
        <button
          onClick={toggleBgm}
          style={{
            background: 'transparent',
            border: 'none',
            color: bgmEnabled ? '#64748b' : '#475569',
            cursor: 'pointer',
            fontSize: 13,
            padding: '4px 8px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
          onMouseLeave={e => (e.currentTarget.style.color = bgmEnabled ? '#64748b' : '#475569')}
        >
          {t(bgmEnabled ? 'game_bgmOn' : 'game_bgmOff')}
        </button>
        <LanguageSwitcher />
        {isLoggedIn ? (
          <>
            <Link to="/my-stories" className="header-create" style={navLinkStyle}>{t('nav_create')}</Link>
            {user?.isAdmin && (
              <>
                <Link to="/admin" style={{ ...navLinkStyle, color: '#f59e0b', fontWeight: 700 }}>{t('nav_admin')}</Link>
                <Link to="/stats" style={{ ...navLinkStyle, color: '#22c55e', fontWeight: 700 }}>{t('nav_stats')}</Link>
              </>
            )}
            <span className="header-username" style={{ color: '#64748b', fontSize: 13 }}>{user?.username}</span>
            <button onClick={handleLogout} style={btnStyle}>{t('nav_logout')}</button>
          </>
        ) : (
          <Link to="/login" style={{ ...btnStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{t('nav_login')}</Link>
        )}
      </nav>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  color: '#94a3b8',
  textDecoration: 'none',
  fontSize: 14,
  transition: 'color 0.2s',
};

const btnStyle: React.CSSProperties = {
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '6px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
