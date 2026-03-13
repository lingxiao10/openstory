import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AuthContext } from '../store/authStore';
import { queryWork } from '../api/queryWork';
import { useI18n } from '../i18n';

export function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needCheckEmail, setNeedCheckEmail] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    queryWork<{ need_check_email: boolean }>('/api/auth/config')
      .then(d => setNeedCheckEmail(d.need_check_email))
      .catch(() => {});
  }, []);

  const handleSendCode = async () => {
    setError('');
    setSendingCode(true);
    try {
      await queryWork('/api/auth/send-code', { method: 'POST', body: { email } });
      setCodeSent(true);
    } catch (err: any) {
      setError(err.message || t('auth_error'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await queryWork<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: { username, email, password, ...(needCheckEmail ? { code } : {}) },
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
          {t('auth_registerTitle')}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div style={{ background: '#7f1d1d22', border: '1px solid #ef4444', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13 }}>{error}</div>}
          <input
            type="text" placeholder={t('auth_username')} value={username} onChange={e => setUsername(e.target.value)}
            required style={inputStyle}
          />
          <input
            type="email" placeholder={t('auth_email')} value={email} onChange={e => setEmail(e.target.value)}
            required style={inputStyle}
          />
          {needCheckEmail && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" placeholder={t('auth_verifyCode')} value={code} onChange={e => setCode(e.target.value)}
                required style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" onClick={handleSendCode} disabled={sendingCode || !email} style={sendCodeBtnStyle}>
                {sendingCode ? '...' : codeSent ? t('auth_resend') : t('auth_sendCode')}
              </button>
            </div>
          )}
          {codeSent && <div style={{ color: '#4ade80', fontSize: 13 }}>{t('auth_codeSent')}</div>}
          <input
            type="password" placeholder={t('auth_password')} value={password} onChange={e => setPassword(e.target.value)}
            required style={inputStyle}
          />
          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? t('common_loading') : t('auth_register')}
          </button>
        </form>
        <p style={{ textAlign: 'center', color: '#64748b', marginTop: 24, fontSize: 14 }}>
          {t('auth_hasAccount')}{' '}
          <Link to="/login" style={{ color: '#6366f1' }}>{t('auth_loginLink')}</Link>
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

const sendCodeBtnStyle: React.CSSProperties = {
  background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 10, padding: '0 14px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
