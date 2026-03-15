import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AuthContext } from '../store/authStore';
import { queryWork } from '../api/queryWork';
import { useI18n } from '../i18n';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await queryWork<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      login(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('auth_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 420, margin: '60px auto' }}>
        <h2 style={{ color: '#e2e8f0', marginBottom: 32, textAlign: 'center', fontSize: 28, fontWeight: 800 }}>
          {t('auth_loginTitle')}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={{ background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>{error}</div>}
          <input
            type="email" placeholder={t('auth_email')} value={email} onChange={e => setEmail(e.target.value)}
            required style={inputStyle}
          />
          <input
            type="password" placeholder={t('auth_password')} value={password} onChange={e => setPassword(e.target.value)}
            required style={inputStyle}
          />
          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? t('common_loading') : t('auth_login')}
          </button>
        </form>
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 14 }}>
          {t('auth_noAccount')}{' '}
          <Link to="/register" style={{ color: '#6366f1' }}>{t('auth_registerLink')}</Link>
        </p>
      </div>
    </Layout>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 16px',
  color: '#e2e8f0', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box',
};

const submitBtnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '13px',
  fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4,
};
