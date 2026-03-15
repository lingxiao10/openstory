import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AuthContext } from '../store/authStore';
import { queryWork } from '../api/queryWork';
import { useI18n } from '../i18n';

interface UserRow {
  id: string;
  username: string;
  email: string;
  lang: string;
  created_at: string;
  daily_quota: number | null;
  quota_used_today: number;
  effective_limit: number;
}

export function Admin() {
  const { user, token, isLoggedIn } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [sysConfig, setSysConfig] = useState<{ daily_gen_limit_enabled: boolean; daily_gen_limit: number } | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user?.isAdmin) { navigate('/'); return; }
    queryWork<any>('/api/admin/config', { token })
      .then(setSysConfig)
      .catch(() => {});
  }, [isLoggedIn]);

  const search = async () => {
    if (!q.trim()) return;
    setErr(''); setLoading(true);
    try {
      const data = await queryWork<UserRow[]>(`/api/admin/users?q=${encodeURIComponent(q)}`, { token });
      setResults(data);
      if (data.length === 0) setErr(t('admin_notFound'));
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const startEdit = (row: UserRow) => {
    setEditingId(row.id);
    setEditVal(row.daily_quota == null ? '' : String(row.daily_quota));
  };

  const saveQuota = async (id: string) => {
    setSaving(true);
    try {
      const val = editVal.trim() === '' ? null : parseInt(editVal);
      if (val !== null && (isNaN(val) || val < 0)) {
        alert(t('admin_invalidQuota'));
        return;
      }
      await queryWork(`/api/admin/users/${id}/quota`, {
        method: 'PATCH', body: { daily_quota: val }, token,
      });
      setResults(prev => prev.map(r => r.id === id
        ? { ...r, daily_quota: val, effective_limit: val ?? (sysConfig?.daily_gen_limit ?? 10) }
        : r));
      setEditingId(null);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const cols = [
    t('admin_colUsername'), t('admin_colEmail'), t('admin_colLang'), t('admin_colId'),
    t('admin_colUsedToday'), t('admin_colEffLimit'), t('admin_colCustomLimit'), t('admin_colAction'),
  ];

  return (
    <Layout>
      <h2 style={{ color: '#e2e8f0', marginBottom: 8 }}>{t('admin_title')}</h2>

      {sysConfig && (
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#94a3b8', border: '1px solid #334155' }}>
          {t('admin_quotaLabel')}
          <span style={{ color: sysConfig.daily_gen_limit_enabled ? '#22c55e' : '#ef4444', fontWeight: 700, marginLeft: 6 }}>
            {sysConfig.daily_gen_limit_enabled ? t('admin_enabled') : t('admin_disabled')}
          </span>
          {sysConfig.daily_gen_limit_enabled && (
            <span style={{ marginLeft: 12 }}>
              {t('admin_sysLimit')}<b style={{ color: '#e2e8f0' }}>{sysConfig.daily_gen_limit}</b>{t('admin_sysLimitUnit')}
            </span>
          )}
          <span style={{ marginLeft: 12, color: '#64748b' }}>{t('admin_configNote')}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder={t('admin_searchPlaceholder')}
          style={inputStyle}
        />
        <button onClick={search} disabled={loading} style={btnStyle}>
          {loading ? t('admin_searching') : t('admin_search')}
        </button>
      </div>

      {err && <p style={{ color: '#ef4444', fontSize: 13 }}>{err}</p>}

      {results.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                {cols.map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={td}>{row.username}</td>
                  <td style={td}>{row.email}</td>
                  <td style={td}>{row.lang}</td>
                  <td style={{ ...td, color: '#475569', fontSize: 11 }}>{row.id}</td>
                  <td style={td}>
                    <span style={{ color: row.quota_used_today >= row.effective_limit ? '#ef4444' : '#22c55e', fontWeight: 700 }}>
                      {row.quota_used_today}
                    </span>
                    <span style={{ color: '#475569' }}> / {row.effective_limit}</span>
                  </td>
                  <td style={td}>{row.effective_limit}</td>
                  <td style={td}>
                    {editingId === row.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          value={editVal} onChange={e => setEditVal(e.target.value)}
                          placeholder={`${sysConfig?.daily_gen_limit ?? 10}`}
                          style={{ ...inputStyle, width: 80, padding: '4px 8px', fontSize: 12 }}
                        />
                        <button onClick={() => saveQuota(row.id)} disabled={saving} style={{ ...btnStyle, padding: '4px 10px', fontSize: 12 }}>
                          {saving ? '...' : t('admin_save')}
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ ...btnStyle, padding: '4px 10px', fontSize: 12, background: '#475569' }}>
                          {t('admin_cancel')}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: row.daily_quota == null ? '#475569' : '#a5b4fc' }}>
                        {row.daily_quota == null ? t('admin_defaultQuota') : row.daily_quota}
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    {editingId !== row.id && (
                      <button onClick={() => startEdit(row)} style={{ ...btnStyle, padding: '4px 12px', fontSize: 12 }}>
                        {t('admin_setQuota')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
  color: '#e2e8f0', padding: '8px 14px', fontSize: 14, outline: 'none', flex: 1,
};
const btnStyle: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const td: React.CSSProperties = { padding: '10px 12px', color: '#e2e8f0', verticalAlign: 'middle' };
