import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';

const LEVEL_CONFIG = [
  { level: 'Lv1', icon: '🌱', name: 'Mầm non toán học', min: 0, max: 30 },
  { level: 'Lv2', icon: '🌿', name: 'Nhà khám phá', min: 31, max: 100 },
  { level: 'Lv3', icon: '🌳', name: 'Nhà tư duy logic', min: 101, max: 200 },
  { level: 'Lv4', icon: '⚔️', name: 'Chiến binh toán học', min: 201, max: 300 },
  { level: 'Lv5', icon: '👑', name: 'Bậc thầy giải toán', min: 301, max: Number.POSITIVE_INFINITY }
];

const normalizeNumber = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getLevelByScore = (score) => {
  const safeScore = Math.max(0, normalizeNumber(score));
  const config = LEVEL_CONFIG.find((item) => safeScore >= item.min && safeScore <= item.max) || LEVEL_CONFIG[0];
  return {
    ...config,
    levelScore: Math.round(safeScore * 10) / 10
  };
};

const extractKhoiDongScore = (progress) => {
  const competency = progress?.parts?.khoiDong?.competencyEvaluation;
  if (!competency) return 0;

  const byTotal = normalizeNumber(competency.totalCompetencyScore || competency.tongDiem);
  if (byTotal > 0) return byTotal;

  return (
    normalizeNumber(competency.TC1?.score || competency.TC1?.diem) +
    normalizeNumber(competency.TC2?.score || competency.TC2?.diem) +
    normalizeNumber(competency.TC3?.score || competency.TC3?.diem) +
    normalizeNumber(competency.TC4?.score || competency.TC4?.diem)
  );
};

const extractLuyenTapBaiScore = (bai) => {
  const evaluation = bai?.evaluation || {};
  const byTong = normalizeNumber(evaluation.tongDiem || evaluation.totalCompetencyScore);
  if (byTong > 0) return byTong;

  const tc = evaluation.diemTC || {};
  return (
    normalizeNumber(tc.tc1) +
    normalizeNumber(tc.tc2) +
    normalizeNumber(tc.tc3) +
    normalizeNumber(tc.tc4)
  );
};

const extractVanDungScore = (progress) => {
  const evaluation = progress?.parts?.vanDung?.evaluation || {};
  const byTong = normalizeNumber(evaluation.tongDiem || evaluation.totalCompetencyScore);
  if (byTong > 0) return byTong;

  return (
    normalizeNumber(evaluation.TC1?.diem || evaluation.TC1?.score) +
    normalizeNumber(evaluation.TC2?.diem || evaluation.TC2?.score) +
    normalizeNumber(evaluation.TC3?.diem || evaluation.TC3?.score) +
    normalizeNumber(evaluation.TC4?.diem || evaluation.TC4?.score)
  );
};

const calculateExamContribution = (progress) => {
  const khoiDongScore = extractKhoiDongScore(progress);
  const luyenTapBai1 = extractLuyenTapBaiScore(progress?.parts?.luyenTap?.bai1);
  const luyenTapBai2 = extractLuyenTapBaiScore(progress?.parts?.luyenTap?.bai2);
  const vanDungScore = extractVanDungScore(progress);

  const luyenTapAverage = (luyenTapBai1 + luyenTapBai2) / 2;
  const totalContribution = khoiDongScore + luyenTapAverage + vanDungScore;

  return {
    khoiDongScore,
    luyenTapBai1,
    luyenTapBai2,
    luyenTapAverage,
    vanDungScore,
    totalContribution: Math.round(totalContribution * 10) / 10
  };
};

class LevelService {
  getLevelInfoByScore(score) {
    return getLevelByScore(score);
  }

  async getUserLevel(userId) {
    if (!userId) return null;
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return null;

    const data = userSnap.data();
    const levelInfo = getLevelByScore(data.levelScore || 0);
    return {
      level: data.level || levelInfo.level,
      levelScore: normalizeNumber(data.levelScore),
      levelName: levelInfo.name,
      levelIcon: levelInfo.icon
    };
  }

  async addLevelScoreForCompletedExam(userId, examId) {
    if (!userId || !examId) {
      throw new Error('Missing userId or examId when adding level score');
    }

    const progressId = `${userId}_${examId}`;
    const progressRef = doc(db, 'student_exam_progress', progressId);
    const progressSnap = await getDoc(progressRef);

    if (!progressSnap.exists()) {
      return null;
    }

    const progress = progressSnap.data();
    const isDone = progress?.status === 'all_done' || progress?.parts?.vanDung?.status === 'completed';
    if (!isDone) {
      return null;
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return null;
    }

    const userData = userSnap.data();
    const processedExamIds = userData.levelProcessedExamIds || [];

    if (processedExamIds.includes(examId)) {
      const existingLevel = getLevelByScore(userData.levelScore || 0);
      return {
        userId,
        examId,
        ...existingLevel,
        addedScore: 0,
        reason: 'already_processed'
      };
    }

    const contribution = calculateExamContribution(progress);
    const nextScore = normalizeNumber(userData.levelScore) + contribution.totalContribution;
    const levelInfo = getLevelByScore(nextScore);

    await updateDoc(userRef, {
      level: levelInfo.level,
      levelScore: levelInfo.levelScore,
      levelProcessedExamIds: [...processedExamIds, examId],
      levelUpdatedAt: serverTimestamp(),
      updatedAt: new Date()
    });

    return {
      userId,
      examId,
      ...levelInfo,
      addedScore: contribution.totalContribution,
      contribution
    };
  }

  async recalculateLevelFromProgress(userId) {
    if (!userId) {
      throw new Error('Missing userId for level recalculation');
    }

    const q = query(collection(db, 'student_exam_progress'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    let totalScore = 0;
    const processedExamIds = [];

    snapshot.docs.forEach((item) => {
      const data = item.data();
      const isDone = data?.status === 'all_done' || data?.parts?.vanDung?.status === 'completed';
      if (!isDone || !data.examId) return;

      const contribution = calculateExamContribution(data);
      totalScore += contribution.totalContribution;
      processedExamIds.push(data.examId);
    });

    totalScore = Math.round(totalScore * 10) / 10;
    const levelInfo = getLevelByScore(totalScore);

    await updateDoc(doc(db, 'users', userId), {
      level: levelInfo.level,
      levelScore: levelInfo.levelScore,
      levelProcessedExamIds: processedExamIds,
      levelUpdatedAt: serverTimestamp(),
      updatedAt: new Date()
    });

    return {
      userId,
      ...levelInfo,
      processedExamIds
    };
  }

  async getClassLeaderboard(classId) {
    if (!classId) return [];

    const classRef = doc(db, 'classes', classId);
    const classSnap = await getDoc(classRef);
    if (!classSnap.exists()) return [];

    const classData = classSnap.data();
    const studentIds = classData.students || [];

    const students = await Promise.all(
      studentIds.map(async (studentId) => {
        const userSnap = await getDoc(doc(db, 'users', studentId));
        if (!userSnap.exists()) return null;

        const userData = userSnap.data();
        const levelInfo = getLevelByScore(userData.levelScore || 0);

        return {
          id: studentId,
          displayName: userData.displayName || userData.name || 'Học sinh',
          photoURL: userData.photoURL || '',
          level: userData.level || levelInfo.level,
          levelScore: normalizeNumber(userData.levelScore),
          levelName: levelInfo.name,
          levelIcon: levelInfo.icon
        };
      })
    );

    return students
      .filter(Boolean)
      .sort((a, b) => {
        if (b.levelScore !== a.levelScore) return b.levelScore - a.levelScore;
        return a.displayName.localeCompare(b.displayName);
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  async getStudentProfileData(userId) {
    if (!userId) return null;

    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return null;

    const userData = userSnap.data();
    const levelInfo = getLevelByScore(userData.levelScore || 0);

    const q = query(collection(db, 'student_exam_progress'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const historyRaw = await Promise.all(
      snapshot.docs.map(async (item) => {
        const data = item.data();
        const isDone = data?.status === 'all_done' || data?.parts?.vanDung?.status === 'completed';
        if (!isDone || !data.examId) return null;

        const examSnap = await getDoc(doc(db, 'exams', data.examId));
        const examName = examSnap.exists() ? (examSnap.data().title || examSnap.data().name || data.examId) : data.examId;

        const contribution = calculateExamContribution(data);
        const completedAt = toDate(data?.parts?.vanDung?.completedAt || data?.lastUpdatedAt || data?.createdAt);

        return {
          examId: data.examId,
          examName,
          completedAt,
          dateKey: completedAt ? completedAt.toISOString().slice(0, 10) : 'unknown',
          monthKey: completedAt ? `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}` : 'unknown',
          khoiDongScore: contribution.khoiDongScore,
          luyenTapAverage: contribution.luyenTapAverage,
          vanDungScore: contribution.vanDungScore,
          levelContribution: contribution.totalContribution,
          dailyAverage3Parts: Math.round(((contribution.khoiDongScore + contribution.luyenTapAverage + contribution.vanDungScore) / 3) * 10) / 10
        };
      })
    );

    const history = historyRaw
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.completedAt ? a.completedAt.getTime() : 0;
        const bTime = b.completedAt ? b.completedAt.getTime() : 0;
        return bTime - aTime;
      });

    const dailyMap = {};
    history.forEach((item) => {
      if (!item.completedAt) return;
      if (!dailyMap[item.dateKey]) {
        dailyMap[item.dateKey] = {
          date: item.completedAt,
          dateKey: item.dateKey,
          monthKey: item.monthKey,
          exams: [],
          sumAverage: 0,
          count: 0
        };
      }

      dailyMap[item.dateKey].exams.push(item);
      dailyMap[item.dateKey].sumAverage += item.dailyAverage3Parts;
      dailyMap[item.dateKey].count += 1;
    });

    const dailyRows = Object.values(dailyMap)
      .map((row) => ({
        ...row,
        averageScore: Math.round((row.sumAverage / Math.max(row.count, 1)) * 10) / 10
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      user: {
        id: userId,
        displayName: userData.displayName || userData.name || 'Học sinh',
        photoURL: userData.photoURL || '',
        level: userData.level || levelInfo.level,
        levelScore: normalizeNumber(userData.levelScore),
        levelName: levelInfo.name,
        levelIcon: levelInfo.icon
      },
      history,
      dailyRows
    };
  }
}

const levelService = new LevelService();
export default levelService;
export { LEVEL_CONFIG };
