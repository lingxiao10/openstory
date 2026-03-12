import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AuthContext } from '../store/authStore';
import { queryWork } from '../api/queryWork';

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
      if (data.length === 0) setErr('未找到用户');
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
        alert('请输入非负整数，或留空表示使用系统默认值');
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

  return (
    <Layout>
      <h2 style={{ color: '#e2e8f0', marginBottom: 8 }}>⚙ 管理后台</h2>

      {sysConfig && (
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#94a3b8', border: '1px solid #334155' }}>
          每日生成限额功能：
          <span style={{ color: sysConfig.daily_gen_limit_enabled ? '#22c55e' : '#ef4444', fontWeight: 700, marginLeft: 6 }}>
            {sysConfig.daily_gen_limit_enabled ? '已开启' : '已关闭'}
          </span>
          {sysConfig.daily_gen_limit_enabled && (
            <span style={{ marginLeft: 12 }}>系统默认每日上限：<b style={{ color: '#e2e8f0' }}>{sysConfig.daily_gen_limit}</b> 次</span>
          )}
          <span style={{ marginLeft: 12, color: '#64748b' }}>（修改需在 secret_json.json 中配置 daily_gen_limit_enabled / daily_gen_limit）</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="输入用户 ID、用户名或邮箱"
          style={inputStyle}
        />
        <button onClick={search} disabled={loading} style={btnStyle}>
          {loading ? '搜索中...' : '搜索'}
        </button>
      </div>

      {err && <p style={{ color: '#ef4444', fontSize: 13 }}>{err}</p>}

      {results.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#64748b', borderBottom: '1px solid #334155' }}>
                {['用户名', '邮箱', '语言', 'ID', '今日已生成', '有效上限', '自定义上限', '操作'].map(h => (
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
                          placeholder={`默认${sysConfig?.daily_gen_limit ?? 10}`}
                          style={{ ...inputStyle, width: 80, padding: '4px 8px', fontSize: 12 }}
                        />
                        <button onClick={() => saveQuota(row.id)} disabled={saving} style={{ ...btnStyle, padding: '4px 10px', fontSize: 12 }}>
                          {saving ? '...' : '保存'}
                        </button>
                        <button onClick={() => setEditingId(null)} style={{ ...btnStyle, padding: '4px 10px', fontSize: 12, background: '#475569' }}>
                          取消
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: row.daily_quota == null ? '#475569' : '#a5b4fc' }}>
                        {row.daily_quota == null ? '（默认）' : row.daily_quota}
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    {editingId !== row.id && (
                      <button onClick={() => startEdit(row)} style={{ ...btnStyle, padding: '4px 12px', fontSize: 12 }}>
                        设置额度
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
