import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../context/config";

interface TopicBreakdown {
  topic_id: string;
  knowledge_level: string;
  avg_accuracy: number;
  quizzes_done: number;
  total_stars: number;
}

interface WeakTopic {
  topic_id: string;
  accuracy: number;
  level: string;
}

interface RecentAttempt {
  quiz_title: string;
  score: number;
  total: number;
  difficulty: string;
  accuracy: number;
  time_spent_seconds: number;
  completed_at: string;
}

interface ReportData {
  user_id: number;
  total_stars: number;
  overall_accuracy: number;
  total_time_spent_seconds: number;
  quizzes_completed: number;
  topic_breakdown: TopicBreakdown[];
  weak_topics: WeakTopic[];
  recent_attempts: RecentAttempt[];
}

export default function ReportScreen() {
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<any>(null);

  const fetchReport = async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/report`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.log("Error fetching report:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreak = async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/streak`);
      if (res.ok) setStreak(await res.json());
    } catch { /* silent */ }
  };

  const handleRepairStreak = async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/repair-streak`, { method: 'POST' });
      if (res.ok) fetchStreak();
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchReport();
    fetchStreak();
  }, [userId]);

  const StatCard = ({ icon, value, label, bgColor, iconColor }: { icon: any, value: string, label: string, bgColor: string, iconColor: string }) => (
    <View style={[styles.statCard, { backgroundColor: bgColor }]}>
      <View style={[styles.statIconContainer, { backgroundColor: iconColor + '33' }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#12B3C9" />
          <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading your learning report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#12B3C9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Learning Report ({user?.name || "Student"})</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="star"
            value={report?.total_stars.toString() || "0"}
            label="Total Stars"
            bgColor="#E0F2FE"
            iconColor="#0284C7"
          />
          <StatCard
            icon="scan-circle-outline"
            value={`${report?.overall_accuracy || 0}%`}
            label="Accuracy"
            bgColor="#FFEDD5"
            iconColor="#EA580C"
          />
          <StatCard
            icon="time-outline"
            value={formatTime(report?.total_time_spent_seconds || 0)}
            label="Time Spent"
            bgColor="#D1FAE5"
            iconColor="#059669"
          />
          <StatCard
            icon="ribbon-outline"
            value={report?.quizzes_completed.toString() || "0"}
            label="Quizzes Done"
            bgColor="#F3E8FF"
            iconColor="#9333EA"
          />
        </View>

        {/* Phase 3: Streak Widget */}
        <View style={styles.streakCard}>
          <View style={styles.streakLeft}>
            <Ionicons name="flame" size={32} color={streak?.active_today ? '#F97316' : '#D1D5DB'} />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.streakCount}>{streak?.current_streak ?? 0} Day Streak</Text>
              <Text style={styles.streakSub}>Longest: {streak?.longest_streak ?? 0} days</Text>
            </View>
          </View>
          {streak?.can_repair && (
            <TouchableOpacity style={styles.repairBtn} onPress={handleRepairStreak}>
              <Ionicons name="build-outline" size={14} color="white" />
              <Text style={styles.repairBtnText}>Repair (30 Stars)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Phase 3: Daily Quiz entry point */}
        <TouchableOpacity
          style={styles.dailyQuizBanner}
          onPress={() => router.push('/quest' as any)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="calendar-outline" size={22} color="#7C3AED" style={{ marginRight: 10 }} />
            <View>
              <Text style={styles.dailyQuizTitle}>Daily Quizzes</Text>
              <Text style={styles.dailyQuizSub}>Complete 3 daily challenges for bonus stars</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#7C3AED" />
        </TouchableOpacity>

        {/* ── Phase 2: Skill Tree Banner ── */}
        <TouchableOpacity
          style={styles.skillTreeBanner}
          onPress={() => router.push('/skill-tree' as any)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.skillTreeTitle}>View Skill Tree</Text>
            <Text style={styles.skillTreeSub}>See your BKT mastery per knowledge component</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#7C3AED" />
        </TouchableOpacity>

        {/* Topic Breakdown */}
        <Text style={styles.sectionTitle}>Topic Performance</Text>
        <View style={styles.sectionCard}>
          {(!report?.topic_breakdown || report.topic_breakdown.length === 0) ? (
            <Text style={styles.emptyText}>No quizzes completed yet. Start learning to see performance!</Text>
          ) : (
            report.topic_breakdown.map((t, idx) => (
              <View key={idx} style={styles.subjectRow}>
                <View style={styles.subjectHeader}>
                  <View style={styles.subjectInfoLeft}>
                    <View style={[styles.subjectIconBg, { backgroundColor: '#0284C722' }]}>
                      <Ionicons name="book-outline" size={20} color="#0284C7" />
                    </View>
                    <View>
                      <Text style={styles.subjectName}>{t.topic_id.toUpperCase()}</Text>
                      <Text style={styles.subjectStats}>
                        {t.quizzes_done} quizzes • Level: {t.knowledge_level.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.subjectPercentage, { color: '#0284C7' }]}>{t.avg_accuracy}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(100, t.avg_accuracy)}%`, backgroundColor: '#0284C7' }]} />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Areas to Improve */}
        <Text style={styles.sectionTitle}>Areas to Improve</Text>
        <View style={styles.improvementCard}>
          {(!report?.weak_topics || report.weak_topics.length === 0) ? (
            <View style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
              <Text style={{ color: '#10B981', fontWeight: 'bold', marginTop: 6 }}>Great job! No weak topics detected.</Text>
            </View>
          ) : (
            <>
              <View style={styles.warningHeader}>
                <Ionicons name="warning-outline" size={20} color="#EF4444" style={styles.warningIcon} />
                <Text style={styles.warningText}>Topics with accuracy below 70%</Text>
              </View>

              {report.weak_topics.map((wt, idx) => (
                <View key={idx} style={styles.topicRow}>
                  <View>
                    <Text style={styles.topicName}>{wt.topic_id.toUpperCase()}</Text>
                    <Text style={styles.topicSubject}>Current Level: {wt.level.toUpperCase()}</Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>{wt.accuracy}%</Text>
                  </View>
                </View>
              ))}

              <View style={styles.tipBox}>
                <Ionicons name="bulb" size={18} color="#FACC15" style={styles.tipIcon} />
                <Text style={styles.tipText}>Practice these topics more to unlock higher difficulty levels!</Text>
              </View>
            </>
          )}
        </View>

        {/* Recent Attempts */}
        {report?.recent_attempts && report.recent_attempts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Quiz Attempts</Text>
            <View style={styles.sectionCard}>
              {report.recent_attempts.map((ra, idx) => (
                <View key={idx} style={styles.recentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentTitle}>{ra.quiz_title}</Text>
                    <Text style={styles.recentSub}>
                      {ra.difficulty.toUpperCase()} • {formatTime(ra.time_spent_seconds)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.recentScore, ra.accuracy >= 70 ? { color: '#10B981' } : { color: '#EF4444' }]}>
                      {ra.score}/{ra.total} ({ra.accuracy}%)
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Action Button */}
        <TouchableOpacity style={styles.continueButton} onPress={() => router.back()}>
          <Text style={styles.continueButtonText}>Continue Learning</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, backgroundColor: '#F8F9FA' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  container: { padding: 20, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: '48%', borderRadius: 16, padding: 16, alignItems: 'center' },
  statIconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  statLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  sectionCard: { backgroundColor: 'white', borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyText: { color: '#6B7280', textAlign: 'center', paddingVertical: 10 },
  subjectRow: { marginBottom: 16 },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subjectInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subjectIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  subjectName: { fontSize: 15, fontWeight: 'bold', color: '#1F2937' },
  subjectStats: { fontSize: 12, color: '#6B7280' },
  subjectPercentage: { fontSize: 16, fontWeight: 'bold' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  improvementCard: { backgroundColor: 'white', borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB' },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  warningIcon: { marginRight: 2 },
  warningText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  topicRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  topicName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  topicSubject: { fontSize: 12, color: '#6B7280' },
  scoreBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  scoreText: { color: '#EF4444', fontWeight: 'bold', fontSize: 13 },
  tipBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF9C3', padding: 12, borderRadius: 10, marginTop: 14 },
  tipIcon: { marginRight: 2 },
  tipText: { fontSize: 12, color: '#854D0E', flex: 1, fontWeight: '500' },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recentTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  recentSub: { fontSize: 12, color: '#6B7280' },
  recentScore: { fontSize: 14, fontWeight: 'bold' },
  continueButton: { backgroundColor: '#0284C7', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  continueButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  skillTreeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE',
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  skillTreeTitle: { fontSize: 16, fontWeight: 'bold', color: '#5B21B6' },
  skillTreeSub: { fontSize: 12, color: '#7C3AED', marginTop: 2 },
  // Phase 3 styles
  streakCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center' },
  streakCount: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  streakSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  repairBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#7C3AED', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  repairBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
  dailyQuizBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  dailyQuizTitle: { fontSize: 16, fontWeight: 'bold', color: '#5B21B6' },
  dailyQuizSub: { fontSize: 12, color: '#7C3AED', marginTop: 2 },
});
