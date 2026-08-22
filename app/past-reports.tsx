import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import { ActivityIndicator, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../context/config";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AttemptRecord {
  id: number;
  quiz_id: number;
  quiz_title: string;
  topic_id: string;
  difficulty: string;
  score: number;
  total_questions: number;
  accuracy: number;
  time_spent_seconds: number;
  completed_at: string;
}

export default function PastReportsScreen() {
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttempts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/past-attempts`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.attempts || []);
        setAttempts(list);
      }
    } catch (err) {
      console.log("Error fetching past attempts:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchAttempts();
    }, [fetchAttempts])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0284C7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Past Reports</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#0284C7" style={{ marginTop: 40 }} />
        ) : attempts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Quiz Reports Yet</Text>
            <Text style={styles.emptySub}>
              Complete quizzes from Story Grammar or English Literacy to track your progress and performance here!
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/(tabs)/home" as any)}>
              <Text style={styles.emptyBtnText}>Start a Lesson</Text>
            </TouchableOpacity>
          </View>
        ) : (
          attempts.map((att) => {
            const diffColor = att.difficulty === 'hard' ? '#EF4444' : att.difficulty === 'medium' ? '#F59E0B' : '#10B981';
            const diffBg = att.difficulty === 'hard' ? '#FEE2E2' : att.difficulty === 'medium' ? '#FEF3C7' : '#DCFCE7';
            const accuracyVal = typeof att.accuracy === 'number' ? att.accuracy : 0;
            const isPassed = accuracyVal >= 70;
            const starsEarned = isPassed ? (att.difficulty === 'hard' ? 30 : att.difficulty === 'medium' ? 20 : 10) : 0;

            return (
              <View key={att.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.dateRow}>
                    <View style={styles.calendarIconBg}>
                      <Ionicons name={isPassed ? "checkmark-circle" : "close-circle"} size={22} color={isPassed ? "#10B981" : "#EF4444"} />
                    </View>
                    <View style={styles.dateInfo}>
                      <Text style={styles.dateText}>{att.quiz_title}</Text>
                      <Text style={styles.quizCountText}>{att.completed_at || 'Completed'}</Text>
                    </View>
                    <View style={[styles.diffBadge, { backgroundColor: diffBg }]}>
                      <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                        {att.difficulty.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryStatsRow}>
                    <View style={[styles.summaryStat, { backgroundColor: '#FFF5F5' }]}>
                      <Ionicons name="star" size={16} color="#FF8A65" />
                      <Text style={styles.summaryStatValue}>+{starsEarned}</Text>
                      <Text style={styles.summaryStatLabel}>Stars</Text>
                    </View>

                    <View style={[styles.summaryStat, { backgroundColor: '#F0F9FF' }]}>
                      <Ionicons name="scan-circle-outline" size={16} color="#0284C7" />
                      <Text style={styles.summaryStatValue}>{accuracyVal}%</Text>
                      <Text style={styles.summaryStatLabel}>Accuracy</Text>
                    </View>

                    <View style={[styles.summaryStat, { backgroundColor: '#F0FDF4' }]}>
                      <Ionicons name="time-outline" size={16} color="#0D9488" />
                      <Text style={styles.summaryStatValue}>{att.time_spent_seconds || 0}s</Text>
                      <Text style={styles.summaryStatLabel}>Time</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 10,
    backgroundColor: "#F8F9FA",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
  },
  container: {
    padding: 20,
  },
  reportCard: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden", // Important for smooth animation
  },
  reportHeader: {
    padding: 16,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  quizCountText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  summaryStatsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  summaryStat: {
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    minWidth: 70,
    marginRight: 12,
  },
  summaryStatValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 4,
  },
  summaryStatLabel: {
    fontSize: 10,
    color: "#6B7280",
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: "#FAF9F6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  subjectRow: {
    marginBottom: 16,
  },
  subjectRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subjectName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  subjectStats: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  percentageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentageText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  topicRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topicSubject: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
