import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../store/authStore';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '../i18n';

export function Header() {
  const { isLoggedIn, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useI18n();

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
        <LanguageSwitcher />
        {isLoggedIn ? (
          <>
            <Link to="/my-stories" className="header-create" style={navLinkStyle}>{t('nav_create')}</Link>
            {user?.isAdmin && (
              <Link to="/admin" style={{ ...navLinkStyle, color: '#f59e0b', fontWeight: 700 }}>⚙ 后台</Link>
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
