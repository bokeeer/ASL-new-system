import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { useSubjects } from "../../context/SubjectsContext";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../context/config";

interface LessonGroup {
  id: number;
  topic_id: str;
  title: string;
  order_index: number;
  lessons: any[];
}

interface LessonProgress {
  lesson_group_id: number;
  title: string;
  order_index: number;
  easy_passed: boolean;
  medium_passed: boolean;
  hard_passed: boolean;
  easy_best_score: number;
  medium_best_score: number;
  hard_best_score: number;
  attempts_count: number;
}

export default function TopicScreen() {
  const { id, subjectId } = useLocalSearchParams();
  const { subjects } = useSubjects();
  const { user } = useAuth();
  const userId = user?.id || 1;

  const subject = subjects[subjectId as string];
  let topic = null;

  if (subject) {
    for (const category of subject.categories) {
      const foundTopic = category.topics.find(t => t.id === id);
      if (foundTopic) {
        topic = foundTopic;
        break;
      }
    }
  }

  const [isDeafEnglish, setIsDeafEnglish] = useState<boolean>(false);
  const [lessonGroups, setLessonGroups] = useState<LessonGroup[]>([]);
  const [studentProgress, setStudentProgress] = useState<Record<number, LessonProgress>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch lesson groups for topic
      const groupRes = await fetch(`${API_URL}/lessons/${id}`);
      let groupsData: LessonGroup[] = [];
      if (groupRes.ok) {
        groupsData = await groupRes.json();
      }

      // 2. Fetch student progress for topic
      const progRes = await fetch(`${API_URL}/student/${userId}/profile/${id}`);
      let progMap: Record<number, LessonProgress> = {};
      if (progRes.ok) {
        const progData = await progRes.json();
        if (progData.lesson_progress) {
          progData.lesson_progress.forEach((p: LessonProgress) => {
            progMap[p.lesson_group_id] = p;
          });
        }
      }

      setLessonGroups(groupsData);
      setStudentProgress(progMap);
    } catch (err) {
      console.log("Error fetching topic data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, userId]);

  if (!topic) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text>Topic not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: '#0284C7' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading topic content...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Determine lock status for each lesson group
  const isLessonUnlocked = (index: number) => {
    if (index === 0) return true; // Lesson 1 is always open
    const prevGroup = lessonGroups[index - 1];
    if (!prevGroup) return false;
    const prevProg = studentProgress[prevGroup.id];
    return prevProg?.easy_passed || false;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0284C7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{topic.name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        {lessonGroups.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="book-outline" size={64} color="#9CA3AF" />
            <Text style={{ marginTop: 16, fontSize: 18, color: '#4B5563', textAlign: 'center' }}>
              No lessons have been published for this topic yet.
            </Text>
          </View>
        ) : (
          lessonGroups.map((group, index) => {
            const unlocked = isLessonUnlocked(index);
            const prog = studentProgress[group.id];
            const isCompleted = prog?.easy_passed;
            const isNextUp = unlocked && !isCompleted;

            return (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.questCard,
                  !unlocked && styles.questCardLocked,
                  isNextUp && styles.questCardActive,
                ]}
                disabled={!unlocked}
                onPress={() => {
                  router.push(`/difficulty/${group.id}?subjectId=${subjectId}&deafEnglish=${isDeafEnglish}&topicId=${id}` as any);
                }}
              >
                <View style={styles.questHeader}>
                  <View style={[
                    styles.questIconContainer,
                    unlocked ? { backgroundColor: "#E0F2FE" } : { backgroundColor: "#F3F4F6" }
                  ]}>
                    <Ionicons
                      name={!unlocked ? "lock-closed-outline" : isCompleted ? "checkmark-circle-outline" : "bulb-outline"}
                      size={28}
                      color={!unlocked ? "#9CA3AF" : isCompleted ? "#10B981" : "#0284C7"}
                    />
                  </View>

                  <View style={styles.questInfo}>
                    <Text style={[styles.questTitle, !unlocked && { color: "#9CA3AF" }]}>
                      {isDeafEnglish ? group.title.toUpperCase() : group.title}
                    </Text>
                    <Text style={styles.questSubtitle}>
                      {!unlocked
                        ? `🔒 Complete Lesson ${index} Easy quiz to unlock`
                        : isCompleted
                        ? `✅ Passed • Best Score: ${prog?.easy_best_score || 0}%`
                        : "⭐ Current Lesson — Tap to start"}
                    </Text>
                  </View>

                  <View style={[
                    styles.badge,
                    unlocked ? (isCompleted ? { backgroundColor: "#10B981" } : { backgroundColor: "#0284C7" }) : { backgroundColor: "#9CA3AF" }
                  ]}>
                    <Text style={styles.badgeText}>
                      {!unlocked ? "Locked" : isCompleted ? "Passed" : "Active"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, backgroundColor: '#F8F9FA' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  deafButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#0284C7' },
  deafButtonActive: { backgroundColor: '#0284C7' },
  deafButtonText: { fontSize: 14, fontWeight: '600', color: '#0284C7' },
  deafButtonTextActive: { color: 'white' },
  scrollViewContent: { padding: 20, paddingBottom: 40 },
  questCard: { backgroundColor: "white", borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#E0F2FE", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  questCardLocked: { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB", opacity: 0.75 },
  questCardActive: { borderColor: "#0284C7", borderWidth: 2 },
  questHeader: { flexDirection: "row", alignItems: "center" },
  questIconContainer: { width: 56, height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 16 },
  questInfo: { flex: 1, justifyContent: "center" },
  questTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginBottom: 4 },
  questSubtitle: { fontSize: 13, color: "#6B7280" },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: "white", fontSize: 12, fontWeight: "bold" },
});
