import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useSubjects } from "../../context/SubjectsContext";
import { API_URL } from "../../context/config";

export default function HomeScreen() {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const displayName = user?.name ?? "Student";
  const userId = user?.id || 1;

  const [totalStars, setTotalStars] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [topicProgress, setTopicProgress] = useState<{ [topicId: string]: { stars: number; progress: number } }>({});

  const fetchHomeSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/student/${userId}/home-summary`);
      if (res.ok) {
        const data = await res.json();
        setTotalStars(data.total_stars ?? 0);
        setStreak(data.current_streak ?? 0);
        if (data.topics) {
          const map: { [topicId: string]: { stars: number; progress: number } } = {};
          data.topics.forEach((t: any) => {
            map[t.topic_id] = { stars: t.stars_earned || 0, progress: t.progress_pct || 0 };
          });
          setTopicProgress(map);
        }
      }
    } catch (err) {
      console.log("Error fetching home summary:", err);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchHomeSummary();
    }, [fetchHomeSummary])
  );

  // Load English subjects category and topics dynamically
  const englishSubject = subjects['english'];
  const categoryName = englishSubject?.categories[0]?.name ?? "English Lessons";
  const topics = englishSubject?.categories[0]?.topics ?? [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi, {displayName}!</Text>
            <Text style={styles.subGreeting}>Keep learning and earning stars</Text>
          </View>
        </View>

        {/* Twin Stats Cards Row */}
        <View style={styles.statsRow}>
          {/* Total Stars Card -> Badges Gallery */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: "#FF8A65" }]}
            activeOpacity={0.8}
            onPress={() => router.push("/badges" as any)}
          >
            <View style={styles.statCardHeader}>
              <Text style={styles.starsTitle}>Total Stars</Text>
              <Ionicons name="star" size={20} color="white" />
            </View>
            <Text style={styles.starsCount}>{totalStars}</Text>
            <View style={styles.cardFooterHint}>
              <Text style={styles.cardFooterText}>View Badges</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.8)" />
            </View>
          </TouchableOpacity>

          {/* Streak Card -> Leaderboard */}
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.8}
            onPress={() => router.push("/leaderboard" as any)}
          >
            <View style={styles.statCardHeader}>
              <Text style={styles.statTitle}>Streak</Text>
              <Ionicons name="flame-outline" size={20} color="#EA580C" />
            </View>
            <Text style={[styles.starsCount, { color: '#EA580C' }]}>{streak} <Text style={styles.daysText}>days</Text></Text>
            <View style={styles.cardFooterHint}>
              <Text style={[styles.cardFooterText, { color: '#EA580C' }]}>Leaderboard</Text>
              <Ionicons name="chevron-forward" size={14} color="#EA580C" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Subjects Section */}
        <Text style={styles.sectionTitle}>{categoryName}</Text>

        {/* Dynamic Topic List */}
        {topics.map((topic) => {
          const liveStats = topicProgress[topic.id] || { stars: topic.starsEarned || 0, progress: topic.progress || 0 };
          const progressVal = Math.min(Math.max(liveStats.progress, 0), 100);

          return (
            <TouchableOpacity 
              key={topic.id} 
              style={styles.subjectCard} 
              onPress={() => router.push(`/topic/${topic.id}?subjectId=english` as any)}
            >
              <View style={styles.subjectHeader}>
                <View style={[styles.subjectIconContainer, { backgroundColor: topic.bgColor || '#E0F2FE' }]}>
                  <Ionicons name={(topic.icon || 'book-outline') as any} size={28} color={topic.iconColor || '#0284C7'} />
                </View>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{topic.name}</Text>
                  <View style={styles.subjectStars}>
                    <Ionicons name="star" size={14} color="#FF8A65" />
                    <Text style={styles.subjectStarsText}> {liveStats.stars} stars</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressText}>Progress</Text>
                  <Text style={styles.progressPercent}>{progressVal}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${progressVal}%`, backgroundColor: topic.iconColor || '#0284C7' }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  container: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: "#6B7280",
  },
  starsTitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    fontWeight: "500",
  },
  starsCount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 8,
  },
  statCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    justifyContent: "space-between",
  },
  statCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  daysText: {
    fontSize: 14,
    fontWeight: "normal",
  },
  cardFooterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 2,
  },
  cardFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 16,
  },
  subjectCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  subjectHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  subjectIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  subjectStars: {
    flexDirection: "row",
    alignItems: "center",
  },
  subjectStarsText: {
    fontSize: 12,
    color: "#FF8A65",
    fontWeight: "500",
  },
  progressContainer: {
    marginTop: 4,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
  },
  progressPercent: {
    fontSize: 12,
    color: "#12B3C9",
    fontWeight: "600",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: "#12B3C9",
    borderRadius: 4,
  },
});
