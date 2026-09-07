import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingQuizAnswer {
  question_id: number;
  is_correct: boolean;
  time_spent_seconds: number;
}

export interface PendingQuizAttempt {
  localId: string;
  userId: number;
  quizId: number;
  attemptId?: number | null;
  difficulty: string;
  score: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  answers: PendingQuizAnswer[];
  timestamp: number;
}

const KEYS = {
  LESSONS_PREFIX: '@brightpath_cache_lessons_',
  PROGRESS_PREFIX: '@brightpath_cache_progress_',
  HOME_PREFIX: '@brightpath_cache_home_',
  FLASHCARDS_PREFIX: '@brightpath_cache_flashcards_',
  QUIZ_SESSION_PREFIX: '@brightpath_cache_quiz_session_',
  PENDING_QUEUE: '@brightpath_pending_quiz_queue',
};

// Generic storage helpers
export const setCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.log('[OfflineCache] setCache error:', err);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.log('[OfflineCache] getCache error:', err);
    return null;
  }
};

// Specific content caching
export const cacheTopicLessons = async (topicId: string, data: any): Promise<void> => {
  await setCache(`${KEYS.LESSONS_PREFIX}${topicId}`, data);
};

export const getCachedTopicLessons = async (topicId: string): Promise<any | null> => {
  return await getCache(`${KEYS.LESSONS_PREFIX}${topicId}`);
};

export const cacheStudentProgress = async (userId: number, topicId: string, data: any): Promise<void> => {
  await setCache(`${KEYS.PROGRESS_PREFIX}${userId}_${topicId}`, data);
};

export const getCachedStudentProgress = async (userId: number, topicId: string): Promise<any | null> => {
  return await getCache(`${KEYS.PROGRESS_PREFIX}${userId}_${topicId}`);
};

export const cacheHomeSummary = async (userId: number, data: any): Promise<void> => {
  await setCache(`${KEYS.HOME_PREFIX}${userId}`, data);
};

export const getCachedHomeSummary = async (userId: number): Promise<any | null> => {
  return await getCache(`${KEYS.HOME_PREFIX}${userId}`);
};

export const cacheFlashcards = async (topicId: string, data: any): Promise<void> => {
  await setCache(`${KEYS.FLASHCARDS_PREFIX}${topicId}`, data);
};

export const getCachedFlashcards = async (topicId: string): Promise<any | null> => {
  return await getCache(`${KEYS.FLASHCARDS_PREFIX}${topicId}`);
};

export const cacheQuizSession = async (quizId: number | string, data: any): Promise<void> => {
  await setCache(`${KEYS.QUIZ_SESSION_PREFIX}${quizId}`, data);
};

export const getCachedQuizSession = async (quizId: number | string): Promise<any | null> => {
  return await getCache(`${KEYS.QUIZ_SESSION_PREFIX}${quizId}`);
};

// ── Pending Quiz Queue for Offline Submissions ──────────────────────────────

export const getPendingQuizzes = async (): Promise<PendingQuizAttempt[]> => {
  const queue = await getCache<PendingQuizAttempt[]>(KEYS.PENDING_QUEUE);
  return Array.isArray(queue) ? queue : [];
};

export const enqueuePendingQuiz = async (
  attempt: Omit<PendingQuizAttempt, 'localId' | 'timestamp'>
): Promise<PendingQuizAttempt> => {
  const currentQueue = await getPendingQuizzes();
  const localId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const record: PendingQuizAttempt = {
    ...attempt,
    localId,
    timestamp: Date.now(),
  };

  const updatedQueue = [...currentQueue, record];
  await setCache(KEYS.PENDING_QUEUE, updatedQueue);
  return record;
};

export const removePendingQuiz = async (localId: string): Promise<void> => {
  const currentQueue = await getPendingQuizzes();
  const updatedQueue = currentQueue.filter(item => item.localId !== localId);
  await setCache(KEYS.PENDING_QUEUE, updatedQueue);
};

// Background flush worker: sends all pending attempts to server
export const syncPendingQuizzes = async (
  apiBaseUrl: string
): Promise<{ synced: number; failed: number }> => {
  const queue = await getPendingQuizzes();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`${apiBaseUrl}/quiz/offline-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: item.userId,
          quiz_id: item.quizId,
          attempt_id: item.attemptId || null,
          difficulty: item.difficulty,
          score: item.score,
          total_questions: item.totalQuestions,
          time_spent_seconds: item.timeSpentSeconds,
          answers: item.answers,
        }),
      });

      if (res.ok) {
        await removePendingQuiz(item.localId);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      // Stop loop if network is still disconnected
      break;
    }
  }

  return { synced, failed };
};

// Check connectivity with a quick timeout
export const checkOnlineStatus = async (apiBaseUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${apiBaseUrl}/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
};
