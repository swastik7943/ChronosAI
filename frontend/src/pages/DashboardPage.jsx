import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, Clock, Users, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#6d28d9', '#7c3aed'];
const CHART_THEME = { bg: 'rgba(99,102,241,0.1)', stroke: '#6366f1', fill: '#6366f1' };

export default function DashboardPage({ token }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await axios.get(`${API_URL}/api/meetings/all`);
        setMeetings(res.data || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    fetch();
  }, [token]);

  const scheduled = meetings.filter(m => m.status === 'scheduled');

  // Meetings per week (last 8 weeks)
  const weeklyData = (() => {
    const weeks = {};
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0];
      const label = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      weeks[key] = { week: label, count: 0 };
    }
    scheduled.forEach(m => {
      const mDate = new Date(m.date + 'T00:00:00');
      const weekStart = new Date(mDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (weeks[key]) weeks[key].count++;
    });
    return Object.values(weeks);
  })();

  // Busiest days of the week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const busiestDays = (() => {
    const counts = Array(7).fill(0);
    scheduled.forEach(m => {
      const d = new Date(m.date + 'T00:00:00').getDay();
      counts[d]++;
    });
    return dayNames.map((name, i) => ({ day: name.slice(0, 3), meetings: counts[i] }));
  })();

  // Average duration
  const avgDuration = scheduled.length > 0 ? Math.round(scheduled.reduce((a, m) => a + (m.duration || 0), 0) / scheduled.length) : 0;

  // Top participants
  const participantCounts = {};
  scheduled.forEach(m => {
    (m.participants || []).forEach(p => {
      const name = p.includes('@') ? p.split('@')[0] : p;
      participantCounts[name] = (participantCounts[name] || 0) + 1;
    });
  });
  const topParticipants = Object.entries(participantCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, meetings: count }));

  // Duration distribution
  const durationDist = (() => {
    const buckets = { '15 min': 0, '30 min': 0, '45 min': 0, '1 hr': 0, '1.5+ hr': 0 };
    scheduled.forEach(m => {
      const d = m.duration || 30;
      if (d <= 15) buckets['15 min']++;
      else if (d <= 30) buckets['30 min']++;
      else if (d <= 45) buckets['45 min']++;
      else if (d <= 60) buckets['1 hr']++;
      else buckets['1.5+ hr']++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  })();

  // Stat cards
  const totalMeetings = scheduled.length;
  const today = new Date().toISOString().split('T')[0];
  const todayCount = scheduled.filter(m => m.date === today).length;
  const totalParticipants = new Set(scheduled.flatMap(m => m.participants || [])).size;

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px', fontSize: '12px', color: '#e5e7eb' },
    cursor: { fill: 'rgba(99,102,241,0.08)' }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Insights from your scheduling data</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Meetings', value: totalMeetings, icon: Calendar, color: 'indigo' },
          { label: 'Today', value: todayCount, icon: TrendingUp, color: 'emerald' },
          { label: 'Avg Duration', value: `${avgDuration}m`, icon: Clock, color: 'amber' },
          { label: 'Participants', value: totalParticipants, icon: Users, color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400 uppercase">{stat.label}</span>
              <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Meetings per week */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">Meetings Per Week</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fillOpacity={1} fill="url(#colorMeetings)" strokeWidth={2} name="Meetings" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Busiest days */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">Busiest Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={busiestDays}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="meetings" fill="#6366f1" radius={[6, 6, 0, 0]} name="Meetings">
                {busiestDays.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Duration distribution */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">Duration Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={durationDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {durationDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top participants */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">Top Participants</h3>
          {topParticipants.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">No participant data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topParticipants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={70} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="meetings" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="Meetings">
                  {topParticipants.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
