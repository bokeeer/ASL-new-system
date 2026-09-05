import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../context/config';

const { width } = Dimensions.get('window');

interface Flashcard {
  id: number;
  term: string;
  asl_gloss: string;
  definition: string;
  example: string;
  category: string;
  icon: string;
  color: string;
}

export default function FlashcardsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const initialTopic = (params.topicId as string) || 'story-grammar';

  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masteredIds, setMasteredIds] = useState<number[]>([]);

  const flipAnim = useRef(new Animated.Value(0)).current;

  const handleFlipCard = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {}

    if (isFlipped) {
      Animated.spring(flipAnim, {
        toValue: 0,
        friction: 8,
        tension: 10,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      setIsFlipped(false);
    } else {
      Animated.spring(flipAnim, {
        toValue: 180,
        friction: 8,
        tension: 10,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      setIsFlipped(true);
    }
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  const fetchCards = async (topicId: string) => {
    setLoading(true);
    setCurrentIndex(0);
    setIsFlipped(false);
    flipAnim.setValue(0);
    try {
      const res = await fetch(`${API_URL}/flashcards/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (err) {
      console.log('Error fetching flashcards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards(selectedTopic);
  }, [selectedTopic]);

  const currentCard = cards[currentIndex];
  const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      flipAnim.setValue(0);
      setIsFlipped(false);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      flipAnim.setValue(0);
      setIsFlipped(false);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleToggleMastered = (id: number) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {}
    if (masteredIds.includes(id)) {
      setMasteredIds(masteredIds.filter(i => i !== id));
    } else {
      setMasteredIds([...masteredIds, id]);
    }
    handleNext();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#7C3AED" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Visual Vocabulary Flashcards</Text>
          <Text style={styles.headerSub}>Tap card to flip between English & ASL Gloss</Text>
        </View>
      </View>

      {/* Topic Selector */}
      <View style={styles.topicBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicBarScroll}>
          {[
            { id: 'story-grammar', name: 'Story Grammar', icon: 'book-outline', color: '#7C3AED' },
            { id: 'mathematics', name: 'Mathematics', icon: 'shapes-outline', color: '#2563EB' },
            { id: 'technology-and-livelihood-education', name: 'TLE (ICT)', icon: 'videocam-outline', color: '#D97706' },
            { id: 'araling-panlipunan', name: 'Araling Panlipunan', icon: 'globe-outline', color: '#059669' },
          ].map((t) => {
            const isActive = selectedTopic === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.topicChip,
                  isActive && { backgroundColor: t.color, borderColor: t.color }
                ]}
                onPress={() => setSelectedTopic(t.id)}
              >
                <Ionicons
                  name={t.icon as any}
                  size={16}
                  color={isActive ? 'white' : t.color}
                />
                <Text style={[styles.topicChipText, isActive && styles.topicChipTextActive]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 60 }} />
        ) : !currentCard ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No flashcards available for this topic.</Text>
          </View>
        ) : (
          <View style={styles.cardArea}>
            {/* Card Counter & Tag */}
            <View style={styles.cardTopRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{currentCard.category}</Text>
              </View>
              <Text style={styles.cardCounterText}>
                {currentIndex + 1} of {cards.length}
              </Text>
            </View>

            {/* Interactive 3D Flip Card */}
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={handleFlipCard}
              style={styles.cardContainer}
            >
              {/* FRONT OF CARD */}
              <Animated.View
                style={[
                  styles.flashcard,
                  styles.flashcardFront,
                  {
                    transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
                    opacity: frontOpacity,
                  },
                ]}
              >
                <View style={styles.cardSideContainer}>
                  <View style={[styles.iconWrapper, { backgroundColor: `${currentCard.color}15` }]}>
                    <Ionicons name={currentCard.icon as any} size={48} color={currentCard.color} />
                  </View>
                  <Text style={styles.cardTerm}>{currentCard.term}</Text>
                  <Text style={styles.cardFrontHint}>Tap to reveal ASL Gloss & Definition</Text>
                  <View style={styles.flipPrompt}>
                    <Ionicons name="repeat-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.flipPromptText}>Tap to Flip</Text>
                  </View>
                </View>
              </Animated.View>

              {/* BACK OF CARD */}
              <Animated.View
                style={[
                  styles.flashcard,
                  styles.flashcardBack,
                  styles.cardBackAbsolute,
                  {
                    transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
                    opacity: backOpacity,
                  },
                ]}
              >
                <View style={styles.cardSideContainer}>
                  <View style={styles.aslBox}>
                    <Text style={styles.aslTag}>ASL GLOSS</Text>
                    <Text style={styles.aslText}>{currentCard.asl_gloss}</Text>
                  </View>

                  <View style={styles.defBox}>
                    <Text style={styles.defLabel}>Definition:</Text>
                    <Text style={styles.defText}>{currentCard.definition}</Text>
                  </View>

                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleLabel}>Example Sentence:</Text>
                    <Text style={styles.exampleText}>"{currentCard.example}"</Text>
                  </View>

                  <View style={[styles.flipPrompt, { marginTop: 12 }]}>
                    <Ionicons name="repeat-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.flipPromptText}>Tap to Flip Back</Text>
                  </View>
                </View>
              </Animated.View>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
                onPress={handlePrev}
                disabled={currentIndex === 0}
              >
                <Ionicons name="chevron-back" size={20} color={currentIndex === 0 ? '#9CA3AF' : '#1F2937'} />
                <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Prev</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.masteredBtn,
                  masteredIds.includes(currentCard.id) && styles.masteredBtnActive
                ]}
                onPress={() => handleToggleMastered(currentCard.id)}
              >
                <Ionicons
                  name={masteredIds.includes(currentCard.id) ? "checkmark-circle" : "checkmark-circle-outline"}
                  size={20}
                  color="white"
                />
                <Text style={styles.masteredBtnText}>
                  {masteredIds.includes(currentCard.id) ? "Mastered" : "Mark Mastered"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navBtn, currentIndex === cards.length - 1 && styles.navBtnDisabled]}
                onPress={handleNext}
                disabled={currentIndex === cards.length - 1}
              >
                <Text style={[styles.navBtnText, currentIndex === cards.length - 1 && styles.navBtnTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={20} color={currentIndex === cards.length - 1 ? '#9CA3AF' : '#1F2937'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  topicBarContainer: {
    marginBottom: 10,
  },
  topicBarScroll: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  topicChipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  topicChipTextActive: { color: 'white', fontWeight: 'bold' },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', width: '100%' },
  progressBarFill: { height: '100%', backgroundColor: '#7C3AED' },
  container: { padding: 20, alignItems: 'center' },
  emptyBox: { marginTop: 40 },
  emptyText: { color: '#6B7280', fontSize: 15 },
  cardArea: { width: '100%', maxWidth: 440, alignItems: 'center' },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#7C3AED' },
  cardCounterText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  cardContainer: {
    width: '100%',
    minHeight: 340,
    marginBottom: 24,
    position: 'relative',
  },
  flashcard: {
    width: '100%',
    minHeight: 340,
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardBackAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flashcardFront: { borderColor: '#EDE9FE' },
  flashcardBack: { borderColor: '#DDD6FE', backgroundColor: '#FAF5FF' },
  cardSideContainer: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTerm: { fontSize: 26, fontWeight: 'bold', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  cardFrontHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  flipPrompt: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flipPromptText: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  aslBox: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
  },
  aslTag: { fontSize: 11, fontWeight: 'bold', color: '#7C3AED', marginBottom: 4 },
  aslText: { fontSize: 17, fontWeight: 'bold', color: '#5B21B6', textAlign: 'center' },
  defBox: { width: '100%', marginBottom: 12 },
  defLabel: { fontSize: 12, fontWeight: 'bold', color: '#4B5563', marginBottom: 2 },
  defText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  exampleBox: { width: '100%', backgroundColor: 'white', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  exampleLabel: { fontSize: 12, fontWeight: 'bold', color: '#6B7280', marginBottom: 2 },
  exampleText: { fontSize: 14, color: '#1F2937', fontStyle: 'italic', lineHeight: 20 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  navBtnTextDisabled: { color: '#9CA3AF' },
  masteredBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
  },
  masteredBtnActive: { backgroundColor: '#10B981' },
  masteredBtnText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
});
