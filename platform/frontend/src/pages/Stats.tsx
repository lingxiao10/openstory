import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

interface DayStat {
  date: string;
  newUsers: number;
  reads: number;
}

export function Stats() {
  const [stats, setStats] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/stats/last7days', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Stats error:', res.status, errData);
        throw new Error(errData.error || 'Failed to load stats');
      }
      const data = await res.json();
      setStats(data.stats);
    } catch (err: any) {
      console.error('Load stats error:', err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={S.container}>{t('common_loading')}</div>;

  return (
    <div style={S.container}>
      <h1 style={S.title}>{t('stats_title')}</h1>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>{t('stats_date')}</th>
            <th style={S.th}>{t('stats_newUsers')}</th>
            <th style={S.th}>{t('stats_reads')}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(stat => (
            <tr key={stat.date}>
              <td style={S.td}>{stat.date}</td>
              <td style={S.td}>{stat.newUsers}</td>
              <td style={S.td}>{stat.reads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: { padding: 40, maxWidth: 800, margin: '0 auto' },
  title: { marginBottom: 30, fontSize: 24 },
  table: { width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' },
  th: { padding: 12, background: '#f5f5f5', border: '1px solid #ddd', textAlign: 'left' },
  td: { padding: 12, border: '1px solid #ddd' },
};
