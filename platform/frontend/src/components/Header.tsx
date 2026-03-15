import { useContext, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../store/authStore';
import { LangContext } from '../store/langStore';
import { useI18n } from '../i18n';

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/* ── 语言选择面板（未登录时独立使用） ──────────────────────────── */
function LangDropdown() {
  const { lang, setLang } = useContext(LangContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8',
          display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: 8,
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>
      {open && (
        <div style={dropdownStyle}>
          {(['zh', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false); }}
              style={{
                ...menuItemStyle,
                background: lang === l ? '#312e81' : 'transparent',
                color: lang === l ? '#a5b4fc' : '#cbd5e1',
                fontWeight: lang === l ? 700 : 400,
              }}
            >
              {l === 'zh' ? '中文' : 'English'}
              {lang === l && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 用户下拉菜单（登录后） ────────────────────────────────── */
function UserMenu({ username, onLogout }: { username: string; onLogout: () => void }) {
  const { t } = useI18n();
  const { lang, setLang } = useContext(LangContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: open ? '#312e81' : '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 10,
          padding: '7px 14px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#312e81'; e.currentTarget.style.borderColor = '#4338ca'; }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#334155'; } }}
      >
        {/* 简单头像圆圈 */}
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: '#6366f1', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {username.charAt(0).toUpperCase()}
        </span>
        {truncate(username, 8)}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={dropdownStyle}>
          {/* 我的故事 */}
          <Link
            to="/my-stories"
            onClick={() => setOpen(false)}
            style={{ ...menuItemStyle, textDecoration: 'none', color: '#cbd5e1' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>📖</span>
            {t('nav_create')}
          </Link>

          <div style={dividerStyle} />

          {/* 语言选择 */}
          <div style={{ padding: '6px 12px', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
            {t('nav_language')}
          </div>
          {(['zh', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); }}
              style={{
                ...menuItemStyle,
                background: lang === l ? '#312e81' : 'transparent',
                color: lang === l ? '#a5b4fc' : '#cbd5e1',
                fontWeight: lang === l ? 700 : 400,
                paddingLeft: 16,
              }}
              onMouseEnter={e => { if (lang !== l) e.currentTarget.style.background = '#1e293b'; }}
              onMouseLeave={e => { if (lang !== l) e.currentTarget.style.background = 'transparent'; }}
            >
              {l === 'zh' ? '中文' : 'English'}
              {lang === l && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
            </button>
          ))}

          <div style={dividerStyle} />

          {/* 退出 */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            style={{ ...menuItemStyle, color: '#f87171' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>🚪</span>
            {t('nav_logout')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Header ────────────────────────────────────────────────── */

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

      <nav className="header-nav" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

        {isLoggedIn ? (
          <UserMenu username={user?.username || ''} onLogout={handleLogout} />
        ) : (
          <>
            <LangDropdown />
            <Link to="/login" style={{
              background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
            }}>
              {t('nav_login')}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

/* ── 共享样式 ─────────────────────────────────────────────── */

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  padding: '6px 0',
  minWidth: 180,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  zIndex: 200,
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '9px 14px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  textAlign: 'left',
  transition: 'background 0.15s',
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: '#1e293b',
  margin: '4px 0',
};
