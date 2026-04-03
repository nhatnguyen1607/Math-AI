import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentHeader from '../../components/student/StudentHeader';
import levelService from '../../services/student/levelService';

const formatDate = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey || monthKey === 'unknown') return 'Không rõ tháng';
  const [year, month] = monthKey.split('-');
  return `Tháng ${month}/${year}`;
};

const buildLinePoints = (rows, width, height, padding) => {
  if (!rows.length) return { points: '', circles: [] };

  const maxY = 8;
  const minY = 0;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const circles = rows.map((row, idx) => {
    const x = rows.length === 1 ? width / 2 : padding + (idx * innerWidth) / (rows.length - 1);
    const y = padding + ((maxY - Math.max(minY, Math.min(maxY, row.averageScore || 0))) / (maxY - minY)) * innerHeight;
    return {
      x,
      y,
      label: row.dateKey,
      value: row.averageScore
    };
  });

  return {
    points: circles.map((p) => `${p.x},${p.y}`).join(' '),
    circles
  };
};

const StudentLearningProfilePage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await levelService.getStudentProfileData(user.uid);
        setProfile(data);
      } catch (error) {
        console.error('Error loading student profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user?.uid]);

  const handleRecalculateLevel = async () => {
    if (!user?.uid || isRecalculating) return;

    try {
      setIsRecalculating(true);
      await levelService.recalculateLevelFromProgress(user.uid);
      // Reload profile data after recalculation
      const data = await levelService.getStudentProfileData(user.uid);
      setProfile(data);
    } catch (error) {
      console.error('Error recalculating level:', error);
    } finally {
      setIsRecalculating(false);
    }
  };

  const monthOptions = useMemo(() => {
    const set = new Set((profile?.dailyRows || []).map((item) => item.monthKey));
    return Array.from(set).filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [profile?.dailyRows]);

  useEffect(() => {
    if (!selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0]);
    }
  }, [monthOptions, selectedMonth]);

  const filteredDailyRows = useMemo(() => {
    return (profile?.dailyRows || []).filter((row) => row.monthKey === selectedMonth);
  }, [profile?.dailyRows, selectedMonth]);

  const filteredHistory = useMemo(() => {
    return (profile?.history || []).filter((row) => row.monthKey === selectedMonth);
  }, [profile?.history, selectedMonth]);

  const lineChart = useMemo(() => buildLinePoints(filteredDailyRows, 860, 300, 40), [filteredDailyRows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📚</div>
          <p className="text-2xl font-bold text-gray-700">Đang tải hồ sơ học tập...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />
        <div className="app-shell section-shell">
          <div className="text-center py-20">
            <p className="text-2xl font-bold text-gray-700">Không có dữ liệu hồ sơ học tập</p>
            <button
              onClick={() => navigate('/student')}
              className="mt-6 touch-btn rounded-2xl bg-blue-500 text-white px-6"
            >
              Quay lại trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <StudentHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="app-shell section-shell">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => navigate('/student')}
            className="touch-btn rounded-2xl bg-white px-5 text-sm font-bold text-gray-700 shadow"
          >
            ← Quay lại
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">Hồ sơ học tập</h1>
            <button
              onClick={handleRecalculateLevel}
              disabled={isRecalculating}
              className={`touch-btn rounded-2xl px-4 py-2 font-bold text-white transition ${
                isRecalculating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 active:scale-95'
              }`}
              title="Tính lại điểm năng lực"
            >
              {isRecalculating ? '⟳ Đang tính...' : '🔄 Tính lại'}
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-6 shadow-lg border-2 border-indigo-200">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-indigo-500 text-white flex items-center justify-center text-2xl font-bold">
              {profile.user.photoURL ? (
                <img src={profile.user.photoURL} alt="avatar" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span>{(profile.user.displayName || 'H').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{profile.user.displayName}</p>
              <p className="text-lg font-semibold text-indigo-700">
                {profile.user.levelIcon} {profile.user.level} - {profile.user.levelName}
              </p>
              <p className="text-sm text-gray-600">Tổng điểm năng lực: <span className="font-bold">{profile.user.levelScore}</span></p>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-3xl bg-white p-6 shadow-lg border-2 border-blue-200">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold text-blue-800">Biểu đồ tiến bộ theo ngày</h2>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border-2 border-blue-300 px-3 py-2 font-semibold"
            >
              {monthOptions.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthLabel(monthKey)}
                </option>
              ))}
            </select>
          </div>

          <p className="mb-4 text-sm text-gray-600">
            Trục dọc: mức điểm 0 - 8 (trung bình 3 hoạt động KĐ, LT, VD của ngày đó, làm tròn 1 chữ số thập phân)
          </p>

          {filteredDailyRows.length === 0 ? (
            <p className="text-gray-500">Chưa có dữ liệu trong tháng này.</p>
          ) : (
            <div className="overflow-x-auto">
              <svg viewBox="0 0 860 300" className="min-w-[860px] w-full h-[300px] rounded-xl bg-blue-50 border border-blue-200">
                {[0, 2, 4, 6, 8].map((y) => {
                  const yPos = 40 + ((8 - y) / 8) * 220;
                  return (
                    <g key={y}>
                      <line x1="40" y1={yPos} x2="820" y2={yPos} stroke="#c7d2fe" strokeDasharray="4 4" />
                      <text x="12" y={yPos + 5} fontSize="12" fill="#475569">{y}</text>
                    </g>
                  );
                })}

                <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={lineChart.points} />

                {lineChart.circles.map((point) => (
                  <g key={point.label}>
                    <circle cx={point.x} cy={point.y} r="5" fill="#1d4ed8" />
                    <text x={point.x - 14} y={point.y - 10} fontSize="11" fill="#1e3a8a">{point.value}</text>
                  </g>
                ))}

                {filteredDailyRows.map((row, idx) => {
                  const x = filteredDailyRows.length === 1 ? 430 : 40 + (idx * (820 - 40)) / (filteredDailyRows.length - 1);
                  return (
                    <text key={row.dateKey} x={x - 18} y="286" fontSize="11" fill="#475569">
                      {formatDate(row.date).slice(0, 5)}
                    </text>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg border-2 border-emerald-200">
          <h2 className="text-2xl font-bold text-emerald-800 mb-4">Lịch sử làm bài theo ngày</h2>

          {filteredHistory.length === 0 ? (
            <p className="text-gray-500">Chưa có lịch sử trong tháng này.</p>
          ) : (
            <div className="space-y-4">
              {filteredDailyRows
                .slice()
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .map((day) => (
                  <div key={day.dateKey} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold text-emerald-800">📅 {formatDate(day.date)}</p>
                      <p className="text-sm font-semibold text-emerald-700">Điểm TB 3 hoạt động: {day.averageScore}</p>
                    </div>
                    <div className="space-y-2">
                      {day.exams.map((item) => (
                        <button
                          key={`${item.examId}_${item.dateKey}`}
                          onClick={() => navigate(`/student/exam-result/id_exam/${item.examId}`)}
                          className="w-full text-left rounded-xl border border-emerald-300 bg-white px-3 py-2 hover:bg-emerald-100 transition"
                        >
                          <p className="font-semibold text-gray-800">{item.examName}</p>
                          <p className="text-xs text-gray-600">
                            Điểm cộng level: {item.levelContribution} | KĐ: {item.khoiDongScore} | LT(avg): {Math.round(item.luyenTapAverage * 10) / 10} | VD: {item.vanDungScore}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentLearningProfilePage;
