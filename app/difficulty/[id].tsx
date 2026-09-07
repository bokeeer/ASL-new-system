import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Image, ActivityIndicator, Animated, Platform } from "react-native";
import * as Haptics from 'expo-haptics';
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../context/config";
import { getCachedTopicLessons, getCachedStudentProgress } from "../../context/OfflineCache";

interface Slide {
  slide_index: number;
  description_text: string;
  image_url?: string;
}

interface DBLesson {
  id: number;
  topic_id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  slides: Slide[];
  quiz_id?: number;
}

const THEME_COLORS: Record<string, { primary: string; light: string; border: string }> = {
  'story-grammar': { primary: '#7C3AED', light: '#EDE9FE', border: '#DDD6FE' },
  'mathematics': { primary: '#2563EB', light: '#DBEAFE', border: '#BFDBFE' },
  'technology-and-livelihood-education': { primary: '#D97706', light: '#FEF3C7', border: '#FDE68A' },
  'araling-panlipunan': { primary: '#059669', light: '#D1FAE5', border: '#A7F3D0' },
};

const getStoryGrammarBadge = (index: number) => {
  switch (index) {
    case 0:
      return {
        label: "Character & Setting",
        icon: "person-outline" as const,
        color: "#7C3AED",
        bgColor: "#EDE9FE",
      };
    case 1:
      return {
        label: "Problem & Challenge",
        icon: "alert-circle-outline" as const,
        color: "#D97706",
        bgColor: "#FEF3C7",
      };
    case 2:
      return {
        label: "Action & Rules",
        icon: "build-outline" as const,
        color: "#2563EB",
        bgColor: "#DBEAFE",
      };
    default:
      return {
        label: "Resolution & Outcome",
        icon: "checkmark-circle-outline" as const,
        color: "#059669",
        bgColor: "#D1FAE5",
      };
  }
};

export default function DifficultyScreen() {
  const { id: lessonGroupId, subjectId, topicId, deafEnglish: deafEngParam } = useLocalSearchParams();
  const theme = THEME_COLORS[topicId as string] || THEME_COLORS[subjectId as string] || THEME_COLORS['story-grammar'];
  const { user } = useAuth();
  const userId = user?.id || 1;

  const [isDeafEnglish, setIsDeafEnglish] = useState<boolean>(deafEngParam === 'true');
  const [lessonsMap, setLessonsMap] = useState<Record<string, DBLesson>>({});
  const [groupTitle, setGroupTitle] = useState('');
  const [progress, setProgress] = useState<{
    easy_passed: boolean;
    medium_passed: boolean;
    hard_passed: boolean;
    easy_best_score: number;
    medium_best_score: number;
    hard_best_score: number;
  }>({
    easy_passed: false,
    medium_passed: false,
    hard_passed: false,
    easy_best_score: 0,
    medium_best_score: 0,
    hard_best_score: 0,
  });
  const [loading, setLoading] = useState(true);

  // Interactive slide modal state
  const [activeLesson, setActiveLesson] = useState<DBLesson | null>(null);
  const [activeDescIndex, setActiveDescIndex] = useState<number>(0);

  // ASL translation state for slide reader
  const [aslDrawerVisible, setAslDrawerVisible] = useState(false);
  const [aslResult, setAslResult] = useState('');
  const [aslLoading, setAslLoading] = useState(false);

  const handleAslTranslate = async () => {
    const currentSlide = activeLesson?.slides[activeDescIndex];
    const textToTranslate = currentSlide?.description_text || '';
    if (!textToTranslate) return;
    setAslLoading(true);
    setAslResult('');
    try {
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, direction: 'en_to_asl' }),
      });
      const data = await res.json();
      setAslResult(data.result?.trim() || `[ASL plain version]: "${textToTranslate}"`);
    } catch {
      setAslResult('Could not connect to translation server.');
    } finally {
      setAslLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Fetch lesson group content
      const res = await fetch(`${API_URL}/lessons/${topicId}`);
      if (res.ok) {
        const groups = await res.json();
        const foundGroup = groups.find((g: any) => g.id === Number(lessonGroupId));
        if (foundGroup) {
          setGroupTitle(foundGroup.title);
          const map: Record<string, DBLesson> = {};
          (foundGroup.lessons || []).forEach((l: DBLesson) => {
            map[l.difficulty] = l;
          });
          setLessonsMap(map);
        }
      }

      // 2. Fetch student progress
      const progRes = await fetch(`${API_URL}/student/${userId}/profile/${topicId}`);
      if (progRes.ok) {
        const progData = await progRes.json();
        if (progData.lesson_progress) {
          const found = progData.lesson_progress.find((p: any) => p.lesson_group_id === Number(lessonGroupId));
          if (found) {
            setProgress(found);
          }
        }
      }
    } catch (err) {
      console.log("Error fetching difficulty data, falling back to cache (offline):", err);
      try {
        const cachedGroups = await getCachedTopicLessons(topicId as string);
        if (cachedGroups) {
          const foundGroup = cachedGroups.find((g: any) => g.id === Number(lessonGroupId));
          if (foundGroup) {
            setGroupTitle(foundGroup.title);
            const map: Record<string, DBLesson> = {};
            (foundGroup.lessons || []).forEach((l: DBLesson) => {
              map[l.difficulty] = l;
            });
            setLessonsMap(map);
          }
        }
        const cachedProg = await getCachedStudentProgress(userId, topicId as string);
        if (cachedProg) {
          const progList = Array.isArray(cachedProg) ? cachedProg : Object.values(cachedProg);
          const found = progList.find((p: any) => p.lesson_group_id === Number(lessonGroupId));
          if (found) {
            setProgress(found);
          }
        }
      } catch (cacheErr) {
        console.log("Error reading difficulty cache:", cacheErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lessonGroupId && topicId) {
      fetchData();
    }
  }, [lessonGroupId, topicId, userId]);

  // Slide animation values for smooth horizontal transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;

  const handleOpenDifficulty = (diff: 'easy' | 'medium' | 'hard') => {
    const lesson = lessonsMap[diff];
    if (!lesson) return;
    setActiveLesson(lesson);
    setActiveDescIndex(0);
    slideAnim.setValue(0);
    slideOpacity.setValue(1);
  };

  const handleNextSlide = () => {
    if (!activeLesson || activeDescIndex >= activeLesson.slides.length - 1) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -35, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideOpacity, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setActiveDescIndex(prev => prev + 1);
      slideAnim.setValue(35);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideOpacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    });
  };

  const handlePrevSlide = () => {
    if (!activeLesson || activeDescIndex <= 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}

    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 35, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideOpacity, { toValue: 0, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setActiveDescIndex(prev => prev - 1);
      slideAnim.setValue(-35);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(slideOpacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    });
  };

  const currentSlide = activeLesson?.slides?.[activeDescIndex];
  const slideText = currentSlide
    ? isDeafEnglish
      ? currentSlide.description_text.toUpperCase()
      : currentSlide.description_text
    : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading difficulty levels...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isUnlocked = (diff: 'easy' | 'medium' | 'hard') => {
    if (diff === 'easy') return true;
    if (diff === 'medium') return progress.easy_passed;
    if (diff === 'hard') return progress.medium_passed;
    return false;
  };

  const getBestScore = (diff: 'easy' | 'medium' | 'hard') => {
    if (diff === 'easy') return progress.easy_best_score;
    if (diff === 'medium') return progress.medium_best_score;
    if (diff === 'hard') return progress.hard_best_score;
    return 0;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.light }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{groupTitle || "Select Difficulty"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subHeader}>Choose your difficulty level for this lesson:</Text>

        {(['easy', 'medium', 'hard'] as const).map(diff => {
          const unlocked = isUnlocked(diff);
          const lessonExists = !!lessonsMap[diff];
          const best = getBestScore(diff);
          const isPassed = diff === 'easy' ? progress.easy_passed : diff === 'medium' ? progress.medium_passed : progress.hard_passed;

          return (
            <TouchableOpacity
              key={diff}
              style={[
                styles.diffCard,
                (styles as any)[`diffCard_${diff}`],
                !unlocked && styles.diffCardLocked,
                !lessonExists && styles.diffCardMissing,
              ]}
              disabled={!unlocked || !lessonExists}
              onPress={() => handleOpenDifficulty(diff)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBox}>
                  <Ionicons
                    name={!unlocked ? "lock-closed" : diff === 'easy' ? "star-outline" : diff === 'medium' ? "flame-outline" : "trophy-outline"}
                    size={28}
                    color={!unlocked ? "#9CA3AF" : diff === 'easy' ? "#10B981" : diff === 'medium' ? "#F59E0B" : "#EF4444"}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.cardTitle}>
                      {diff === 'easy' ? 'Easy Tier' : diff === 'medium' ? 'Medium Tier' : 'Hard Tier'}
                    </Text>
                    {diff === 'easy' && !progress.easy_passed && (
                      <View style={styles.recommendedBadge}>
                        <Ionicons name="star" size={11} color="#854D0E" />
                        <Text style={styles.recommendedBadgeText}>Recommended</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardSub}>
                    {!lessonExists
                      ? "Not available yet (Admin hasn't created slides)"
                      : !unlocked
                      ? diff === 'medium'
                        ? "Score 70%+ on Easy to unlock"
                        : "Score 70%+ on Medium to unlock"
                      : isPassed
                      ? `Passed • Best Score: ${best}%`
                      : "Tap to read slides and start quiz"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Slide Modal */}
      {activeLesson && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={!!activeLesson}
          onRequestClose={() => setActiveLesson(null)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.header}>
              <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.light }]} onPress={() => setActiveLesson(null)}>
                <Ionicons name="close" size={24} color={theme.primary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {groupTitle} ({activeLesson.difficulty.toUpperCase()})
              </Text>
            </View>

            <View style={styles.readerContent}>
              {/* Progress Dots */}
              <View style={styles.dotsRow}>
                {activeLesson.slides.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.progressDot, i === activeDescIndex ? [styles.progressDotActive, { backgroundColor: theme.primary }] : null]}
                  />
                ))}
              </View>

              {/* Slide Card */}
              <Animated.View style={[styles.flipCard, { transform: [{ translateX: slideAnim }], opacity: slideOpacity }]}>
                {/* Story Grammar Indicator Chip */}
                {(() => {
                  const badge = getStoryGrammarBadge(activeDescIndex);
                  return (
                    <View style={[styles.narrativeBadge, { backgroundColor: badge.bgColor }]}>
                      <Ionicons name={badge.icon} size={14} color={badge.color} />
                      <Text style={[styles.narrativeBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  );
                })()}

                <ScrollView contentContainerStyle={styles.cardScrollView} showsVerticalScrollIndicator={false}>
                  {currentSlide?.image_url ? (
                    <View style={styles.imageWrapper}>
                      <Image source={{ uri: currentSlide.image_url }} style={styles.slideImage} resizeMode="contain" />
                    </View>
                  ) : (
                    <Ionicons name="sparkles-outline" size={32} color={theme.primary} style={styles.cardDecorationIcon} />
                  )}
                  <Text style={styles.cardText}>{slideText}</Text>
                </ScrollView>
                <Text style={styles.cardCounter}>
                  {activeDescIndex + 1} of {activeLesson.slides.length}
                </Text>
              </Animated.View>

              {/* Nav Footer */}
              <View style={styles.actionsFooter}>
                <TouchableOpacity
                  style={[styles.navBtn, { backgroundColor: theme.light }, activeDescIndex === 0 && styles.navBtnDisabled]}
                  disabled={activeDescIndex === 0}
                  onPress={handlePrevSlide}
                >
                  <Ionicons name="arrow-back" size={20} color={activeDescIndex === 0 ? "#9CA3AF" : theme.primary} />
                  <Text style={[styles.navBtnText, { color: theme.primary }, activeDescIndex === 0 && styles.navBtnTextDisabled]}>Previous</Text>
                </TouchableOpacity>

                {activeDescIndex < activeLesson.slides.length - 1 ? (
                  <TouchableOpacity
                    style={[styles.navBtn, { backgroundColor: theme.light }]}
                    onPress={handleNextSlide}
                  >
                    <Text style={[styles.navBtnText, { color: theme.primary }]}>Next</Text>
                    <Ionicons name="arrow-forward" size={20} color={theme.primary} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.quizStartBtn}
                    onPress={() => {
                      const qId = activeLesson.quiz_id;
                      setActiveLesson(null);
                      router.push(`/quiz/${topicId}?subjectId=${subjectId}&deafEnglish=${isDeafEnglish}&lessonId=${activeLesson.id}&quizId=${qId || ''}&difficulty=${activeLesson.difficulty}` as any);
                    }}
                  >
                    <Ionicons name="pencil" size={18} color="white" style={{ marginRight: 6 }} />
                    <Text style={styles.quizStartBtnText}>Start {activeLesson.difficulty.toUpperCase()} Quiz</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Floating ASL Helper Button for Slide */}
            <TouchableOpacity
              style={styles.aslFloatBtn}
              onPress={() => { setAslDrawerVisible(true); setAslResult(''); }}
            >
              <Ionicons name="hand-left-outline" size={22} color="white" />
              <Text style={styles.aslFloatBtnText}>ASL Helper</Text>
            </TouchableOpacity>

            {/* ASL / Deaf English Slide Helper Drawer Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={aslDrawerVisible}
              onRequestClose={() => setAslDrawerVisible(false)}
            >
              <View style={styles.aslDrawerOverlay}>
                <View style={styles.aslDrawerContent}>
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={styles.aslDrawerTitle}>ASL / Deaf English Translator</Text>
                    <TouchableOpacity onPress={() => setAslDrawerVisible(false)}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {/* Original slide text */}
                  <View style={styles.aslOriginalBox}>
                    <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>SLIDE TEXT</Text>
                    <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 20 }}>
                      {slideText || 'No slide text.'}
                    </Text>
                  </View>

                  {/* Loading indicator */}
                  {aslLoading && (
                    <ActivityIndicator color="#7C3AED" style={{ marginVertical: 16 }} />
                  )}

                  {/* Translation result */}
                  {!!aslResult && !aslLoading && (
                    <View style={styles.aslResultBox}>
                      <Text style={styles.aslResultLabel}>ASL / DEAF ENGLISH</Text>
                      <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 20 }}>{aslResult}</Text>
                    </View>
                  )}

                  {/* Translate button */}
                  <TouchableOpacity
                    onPress={handleAslTranslate}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: '#7C3AED', borderRadius: 10, marginTop: 14,
                      paddingVertical: 12, paddingHorizontal: 20, gap: 8,
                    }}
                  >
                    <Ionicons name="language-outline" size={20} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Translate Slide</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20, backgroundColor: '#F8F9FA' },
  backButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  deafButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#0284C7' },
  deafButtonActive: { backgroundColor: '#0284C7' },
  deafButtonText: { fontSize: 14, fontWeight: '600', color: '#0284C7' },
  deafButtonTextActive: { color: 'white' },
  scrollContent: { padding: 20 },
  subHeader: { fontSize: 15, color: '#4B5563', marginBottom: 20 },
  diffCard: { backgroundColor: 'white', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 2, borderColor: '#E5E7EB' },
  diffCard_easy: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  diffCard_medium: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  diffCard_hard: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  diffCardLocked: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.6 },
  diffCardMissing: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB', opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  recommendedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF08A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  recommendedBadgeText: { fontSize: 11, color: '#854D0E', fontWeight: 'bold' },
  narrativeBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginBottom: 12 },
  narrativeBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  modalContainer: { flex: 1, backgroundColor: "#F8F9FA" },
  readerContent: { flex: 1, padding: 24, justifyContent: 'space-between', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' },
  progressDotActive: { backgroundColor: '#0284C7', width: 18 },
  flipCard: { flex: 1, width: '100%', backgroundColor: 'white', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 24, justifyContent: 'space-between' },
  imageWrapper: { width: '100%', height: 220, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  slideImage: { width: '100%', height: '100%', borderRadius: 16 },
  cardDecorationIcon: { alignSelf: 'center', marginBottom: 16, opacity: 0.8 },
  cardScrollView: { flexGrow: 1, justifyContent: 'center' },
  cardText: { fontSize: 18, color: '#374151', textAlign: 'center', lineHeight: 28, fontWeight: '500' },
  cardCounter: { textAlign: 'center', fontSize: 13, color: '#9CA3AF', marginTop: 16, fontWeight: '600' },
  actionsFooter: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  navBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#E0F2FE', gap: 6 },
  navBtnDisabled: { backgroundColor: '#F3F4F6' },
  navBtnText: { fontSize: 16, fontWeight: '600', color: '#0284C7' },
  navBtnTextDisabled: { color: '#9CA3AF' },
  quizStartBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  quizStartBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  aslFloatBtn: {
    position: 'absolute', bottom: 85, right: 20,
    backgroundColor: '#7C3AED', borderRadius: 24,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    elevation: 6, shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 8,
  },
  aslFloatBtnText: { color: 'white', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  aslDrawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  aslDrawerContent: {
    backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '75%',
  },
  aslDrawerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  aslOriginalBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginTop: 10, marginBottom: 8 },
  aslResultBox: { backgroundColor: '#EDE9FE', borderRadius: 10, padding: 12, marginTop: 8 },
  aslResultLabel: { fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 4 },
});
