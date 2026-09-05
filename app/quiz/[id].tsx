import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Image, Dimensions, Modal, Alert, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from "expo-router";
import { useSubjects } from "../../context/SubjectsContext";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../context/config";
import Confetti from "../../components/Confetti";

const { width } = Dimensions.get('window');

interface MatchPair {
  left: string;
  right: string;
}

interface QuestionAnswerRecord {
  question_id: number;
  is_correct: bool;
  time_spent_seconds: number;
}

export default function QuizScreen() {
  const { id, subjectId, deafEnglish, lessonId, quizId: paramQuizId, difficulty: paramDiff } = useLocalSearchParams();
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

  const [isDeafEnglish, setIsDeafEnglish] = useState<boolean>(deafEnglish === 'true');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Milestone 7 Session State
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [difficulty, setDifficulty] = useState<string>( (paramDiff as string) || "easy");
  const [loading, setLoading] = useState(true);
  const [lockedError, setLockedError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(1);

  // Answer tracking for backend submission
  const [answersRecord, setAnswersRecord] = useState<QuestionAnswerRecord[]>([]);
  const [submittingResults, setSubmittingResults] = useState(false);

  // Result state from completion response
  const [completionResult, setCompletionResult] = useState<{
    accuracy_pct: number;
    passed: boolean;
    stars_earned: number;
    unlocked_medium: boolean;
    unlocked_hard: boolean;
    unlocked_next_lesson: boolean;
  } | null>(null);

  // Timers for tracking time spent per question
  const questionStartTimeRef = useRef<number>(Date.now());
  const totalQuizStartTimeRef = useRef<number>(Date.now());

  // Matching mode interactive states
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [currentMatchedPairs, setCurrentMatchedPairs] = useState<MatchPair[]>([]);
  const [shuffledLeftItems, setShuffledLeftItems] = useState<string[]>([]);
  const [shuffledRightItems, setShuffledRightItems] = useState<string[]>([]);
  const [matchingFeedback, setMatchingFeedback] = useState<'correct' | 'wrong' | null>(null);

  // ASL / Deaf English Helper state
  const [aslDrawerVisible, setAslDrawerVisible] = useState(false);
  const [aslResult, setAslResult] = useState('');
  const [aslLoading, setAslLoading] = useState(false);

  // Hint state
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [eliminatedOptionIdx, setEliminatedOptionIdx] = useState<number | null>(null);

  // Visual Feedback Animations (Auditory-Free)
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const starPopAnim = useRef(new Animated.Value(0)).current;
  const hintElimAnim = useRef(new Animated.Value(0)).current;
  const [showStarPop, setShowStarPop] = useState(false);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  const triggerStarPop = () => {
    setShowStarPop(true);
    starPopAnim.setValue(0);
    Animated.timing(starPopAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: Platform.OS !== 'web',
    }).start(() => {
      setShowStarPop(false);
    });
  };

  const handleUseHint = async () => {
    if (!attemptId) {
      Alert.alert('Not available', 'Quiz session is not started yet.');
      return;
    }
    if (hintUsed) return;
    setHintLoading(true);
    try {
      const res = await fetch(`${API_URL}/quiz/session/use-hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id: attemptId, user_id: userId }),
      });
      if (res.status === 400) {
        const data = await res.json();
        Alert.alert('Not enough stars', data.detail || 'You need at least 5 stars to use a hint.');
        return;
      }
      const data = await res.json();
      const currentQ = quizQuestions[currentQuestionIndex];
      const hint = currentQ?.hint || 'Think carefully about the question context.';
      setHintText(hint);
      setHintUsed(true);

      // Visual elimination of 1 wrong choice for multiple choice
      if (currentQ && currentQ.question_type !== 'matching' && currentQ.options && currentQ.options.length > 2) {
        const wrongIndices = currentQ.options
          .map((_, i) => i)
          .filter(i => i !== currentQ.correctOptionIndex);
        if (wrongIndices.length > 0) {
          const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
          setEliminatedOptionIdx(randomWrong);
          hintElimAnim.setValue(0);
          Animated.timing(hintElimAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: false,
          }).start();
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          } catch {}
        }
      }
    } catch {
      Alert.alert('Error', 'Could not fetch hint. Check your connection.');
    } finally {
      setHintLoading(false);
    }
  };

  const handleAslTranslate = async () => {
    const currentQ = quizQuestions[currentQuestionIndex];
    if (!currentQ) return;
    setAslLoading(true);
    setAslResult('');

    // Build the text to translate:
    // For matching questions, the question_text is just "Match the pairs below:" which
    // gives the model no content. Instead, send the actual item pairs as a sentence.
    let textToTranslate = currentQ.question || currentQ.question_text || '';
    if (!textToTranslate) {
      setAslResult('No question text available to translate.');
      setAslLoading(false);
      return;
    }
    if (currentQ.question_type === 'matching' && currentQ.matching_pairs?.length > 0) {
      const pairs = currentQ.matching_pairs
        .map((p: any) => `${p.left || p.left_item} matches ${p.right || p.right_item}`)
        .join('. ');
      textToTranslate = `Match the following pairs: ${pairs}`;
    }

    try {
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, direction: 'en_to_asl' }),
      });
      const data = await res.json();
      const result = data.result?.trim();
      if (result) {
        setAslResult(result);
      } else {
        // Model returned empty — give a plain English simplified version as fallback
        setAslResult(`[ASL model could not process this text. Plain version]: "${textToTranslate}"`);
      }
    } catch {
      setAslResult('Could not connect to the translation server. Make sure the server is running.');
    } finally {
      setAslLoading(false);
    }
  };


  const startQuizSession = async () => {
    setLoading(true);
    setLockedError(null);
    setIsFinished(false);
    setScore(0);
    setCurrentQuestionIndex(0);
    setAnswersRecord([]);
    setCompletionResult(null);
    totalQuizStartTimeRef.current = Date.now();

    try {
      // 1. Get quiz ID if not passed directly
      let targetQuizId = paramQuizId;

      if (!targetQuizId) {
        let res;
        if (lessonId) {
          res = await fetch(`${API_URL}/quizzes/lesson/${lessonId}`);
        } else {
          res = await fetch(`${API_URL}/quizzes/${id}`);
        }
        if (res.ok) {
          const data = await res.json();
          const quizObj = Array.isArray(data) ? data[data.length - 1] : data;
          if (quizObj) targetQuizId = quizObj.id;
        }
      }

      if (!targetQuizId) {
        throw new Error("No quiz found for this lesson.");
      }

      // 2. Call AI Session endpoint (randomized 10 questions + lock check)
      const sessionRes = await fetch(`${API_URL}/quiz/session/${targetQuizId}?user_id=${userId}`);

      if (sessionRes.status === 403) {
        const errorData = await sessionRes.json();
        setLockedError(errorData.detail || "This quiz is locked.");
        return;
      }

      if (!sessionRes.ok) throw new Error("Failed to start quiz session.");

      const sessionData = await sessionRes.json();
      setAttemptId(sessionData.attempt_id);
      setDifficulty(sessionData.difficulty || "easy");

      const mapped = sessionData.questions.map((q: any) => ({
        id: q.id,
        question: q.question_text,
        deafQuestion: q.question_text.toUpperCase(),
        question_type: q.question_type || 'descriptive',
        image_url: q.image_url,
        options: (q.options || []).map((opt: string, idx: number) => ({
          id: String.fromCharCode(65 + idx),
          text: opt,
          deafText: opt.toUpperCase()
        })),
        correctOptionId: String.fromCharCode(65 + q.correct_option_index),
        matching_pairs: (q.matching_pairs || []).map((p: any) => ({
          left: p.left || p.left_item || '',
          right: p.right || p.right_item || ''
        })),
        hint: "Look closely at the choice text.",
        deafHint: "LOOK CLOSELY AT THE CHOICE TEXT."
      }));

      setQuizQuestions(mapped);
      setQuizTitle(`${difficulty.toUpperCase()} Quiz`);
      questionStartTimeRef.current = Date.now();
    } catch (err: any) {
      console.log('Error starting quiz session:', err);
      setLockedError(err.message || "Failed to load quiz.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startQuizSession();
  }, [id, lessonId, paramQuizId, userId]);

  // Set up matching items when current question changes
  useEffect(() => {
    if (quizQuestions.length > 0 && currentQuestionIndex < quizQuestions.length) {
      const q = quizQuestions[currentQuestionIndex];
      if (q.question_type === 'matching' && q.matching_pairs) {
        const lefts = q.matching_pairs.map((p: MatchPair) => p.left);
        const rights = q.matching_pairs.map((p: MatchPair) => p.right);
        setShuffledLeftItems([...lefts].sort(() => 0.5 - Math.random()));
        setShuffledRightItems([...rights].sort(() => 0.5 - Math.random()));
        setCurrentMatchedPairs([]);
        setSelectedLeft(null);
        setSelectedRight(null);
        setMatchingFeedback(null);
      }
      questionStartTimeRef.current = Date.now();
      // Reset hint per question
      setHintText(null);
      setHintUsed(false);
      setEliminatedOptionIdx(null);
      hintElimAnim.setValue(0);
    }
  }, [currentQuestionIndex, quizQuestions]);

  const currentQuestion = quizQuestions[currentQuestionIndex];

  // Submit quiz results to backend when finished
  const submitQuizResults = async (finalScore: number, finalAnswers: QuestionAnswerRecord[]) => {
    if (!attemptId) return;
    setSubmittingResults(true);
    const totalTimeSec = Math.round((Date.now() - totalQuizStartTimeRef.current) / 1000);

    try {
      const res = await fetch(`${API_URL}/quiz/session/${attemptId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: finalScore,
          total_questions: quizQuestions.length,
          time_spent_seconds: totalTimeSec,
          answers: finalAnswers,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setCompletionResult(result);
      }
    } catch (err) {
      console.log('Error submitting quiz results:', err);
    } finally {
      setSubmittingResults(false);
    }
  };

  // Multiple Choice option handler
  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOptionIndex(index);
    setIsAnswered(true);

    const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
    const selectedOpt = currentQuestion.options[index];
    const isCorrect = selectedOpt.id === currentQuestion.correctOptionId;

    let newScore = score;
    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
      triggerStarPop();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {}
    } else {
      triggerShake();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } catch {}
    }

    const newAnswer: QuestionAnswerRecord = {
      question_id: currentQuestion.id,
      is_correct: isCorrect,
      time_spent_seconds: timeSpent,
    };
    const updatedAnswers = [...answersRecord, newAnswer];
    setAnswersRecord(updatedAnswers);

    // Auto-advance after 1.2 seconds
    setTimeout(() => {
      setShowStarPop(false);
      shakeAnim.setValue(0);
      starPopAnim.setValue(0);
      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedOptionIndex(null);
        setIsAnswered(false);
        setShowHint(false);
      } else {
        setIsFinished(true);
        submitQuizResults(newScore, updatedAnswers);
      }
    }, 1200);
  };

  // Matching pair handler
  const handlePairMatch = (left: string, right: string) => {
    const pairFound = currentQuestion.matching_pairs.find(
      (p: MatchPair) => p.left === left && p.right === right
    );

    if (pairFound) {
      setMatchingFeedback('correct');
      triggerStarPop();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {}
      const updatedPairs = [...currentMatchedPairs, { left, right }];
      setCurrentMatchedPairs(updatedPairs);
      setSelectedLeft(null);
      setSelectedRight(null);

      setTimeout(() => {
        setMatchingFeedback(null);
        setShowStarPop(false);
      }, 800);

      // Check if all pairs are matched
      if (updatedPairs.length === currentQuestion.matching_pairs.length) {
        setIsAnswered(true);
        const newScore = score + 1;
        setScore(newScore);

        const timeSpent = Math.round((Date.now() - questionStartTimeRef.current) / 1000);
        const newAnswer: QuestionAnswerRecord = {
          question_id: currentQuestion.id,
          is_correct: true,
          time_spent_seconds: timeSpent,
        };
        const updatedAnswers = [...answersRecord, newAnswer];
        setAnswersRecord(updatedAnswers);

        setTimeout(() => {
          if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setIsAnswered(false);
            setShowHint(false);
          } else {
            setIsFinished(true);
            submitQuizResults(newScore, updatedAnswers);
          }
        }, 1200);
      }
    } else {
      setMatchingFeedback('wrong');
      triggerShake();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } catch {}
      setTimeout(() => {
        setMatchingFeedback(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 800);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0284C7" />
          <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading quiz questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 🔒 Locked Quiz Screen
  if (lockedError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0284C7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quiz Locked</Text>
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="lock-closed" size={64} color="#F59E0B" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginTop: 16 }}>
            {difficulty.toUpperCase()} Quiz Locked
          </Text>
          <Text style={{ marginTop: 8, fontSize: 15, color: '#6B7280', textAlign: 'center', paddingHorizontal: 30 }}>
            {lockedError}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 24, backgroundColor: '#0284C7', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 🎉 Finished Screen (Pass / Fail)
  if (isFinished) {
    const accuracy = completionResult ? completionResult.accuracy_pct : Math.round((score / quizQuestions.length) * 100);
    const passed = completionResult ? completionResult.passed : accuracy >= 70;

    return (
      <SafeAreaView style={styles.safeArea}>
        {passed && <Confetti count={65} />}
        <View style={styles.finishedContainer}>
          <Ionicons
            name={passed ? "trophy" : "refresh-circle"}
            size={80}
            color={passed ? "#F59E0B" : "#0284C7"}
          />

          <Text style={styles.finishedTitle}>
            {passed ? "Quiz Passed!" : "Keep Trying!"}
          </Text>

          <Text style={styles.finishedScore}>
            {score} / {quizQuestions.length} ({accuracy}%)
          </Text>

          <Text style={styles.difficultyBadge}>
            Difficulty: {difficulty.toUpperCase()}
          </Text>

          {/* Celebration Unlocks */}
          {completionResult?.unlocked_medium && (
            <View style={styles.unlockCelebrationBox}>
              <Ionicons name="sparkles" size={16} color="#854D0E" style={{ marginRight: 6 }} />
              <Text style={styles.unlockCelebrationText}>Medium Tier Unlocked!</Text>
            </View>
          )}
          {completionResult?.unlocked_hard && (
            <View style={styles.unlockCelebrationBox}>
              <Ionicons name="trophy" size={16} color="#854D0E" style={{ marginRight: 6 }} />
              <Text style={styles.unlockCelebrationText}>Hard Tier Unlocked!</Text>
            </View>
          )}
          {completionResult?.unlocked_next_lesson && (
            <View style={styles.unlockCelebrationBox}>
              <Ionicons name="checkmark-done" size={16} color="#854D0E" style={{ marginRight: 6 }} />
              <Text style={styles.unlockCelebrationText}>Next Lesson Unlocked!</Text>
            </View>
          )}

          {submittingResults && (
            <ActivityIndicator color="#0284C7" style={{ marginVertical: 10 }} />
          )}

          {/* Action Buttons */}
          <View style={styles.finishedActions}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setAttemptCount(prev => prev + 1);
                startQuizSession();
              }}
            >
              <Ionicons name="refresh" size={20} color="#0284C7" />
              <Text style={styles.retryBtnText}>Try Again (Fresh Questions)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.doneBtnText}>Back to Lessons</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={{ color: "#EF4444", fontSize: 16 }}>No questions available for this quiz.</Text>
          <TouchableOpacity style={[styles.doneButton, { marginTop: 16 }]} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentDiff = ((paramDiff as string) || difficulty || 'easy').toUpperCase();
  const currentQuestionNumber = currentQuestionIndex + 1;
  const totalQuestions = quizQuestions.length;
  const progressPercent = totalQuestions > 0 ? (currentQuestionNumber / totalQuestions) * 100 : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#7C3AED" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{quizTitle || `${currentDiff} Quiz`}</Text>
          <Text style={styles.headerSub}>Difficulty: {currentDiff} • Q{currentQuestionNumber} of {totalQuestions}</Text>
        </View>

        {/* Hint Button */}
        <TouchableOpacity
          style={[styles.hintHeaderBtn, hintUsed && styles.hintHeaderBtnUsed]}
          onPress={handleUseHint}
          disabled={hintUsed || hintLoading}
        >
          {hintLoading ? (
            <ActivityIndicator size="small" color="#7C3AED" />
          ) : (
            <>
              <Ionicons name="bulb-outline" size={16} color={hintUsed ? "#9CA3AF" : "#7C3AED"} />
              <Text style={[styles.hintHeaderBtnText, hintUsed && styles.hintHeaderBtnTextUsed]}>
                {hintUsed ? "Hint Used" : "Hint (-5 Stars)"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Question Card */}
        <View style={styles.questionCard}>
          {currentQuestion.image_url ? (
            <View style={styles.questionImageWrapper}>
              <Image source={{ uri: currentQuestion.image_url }} style={styles.questionImage} resizeMode="contain" />
            </View>
          ) : null}

          {/* Inline Hint Banner */}
          {!!hintText && (
            <View style={styles.hintBanner}>
              <Ionicons name="bulb" size={18} color="#D97706" />
              <Text style={styles.hintBannerText}>{hintText}</Text>
            </View>
          )}

          <Text style={styles.questionText}>
            {isDeafEnglish ? currentQuestion.deafQuestion : currentQuestion.question}
          </Text>

          {/* Multiple Choice Options */}
          {currentQuestion.question_type !== 'matching' && (
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option: any, idx: number) => {
                const isSelected = selectedOptionIndex === idx;
                const isCorrect = option.id === currentQuestion.correctOptionId;
                const isEliminated = idx === eliminatedOptionIdx;
                let optionStyle: any = styles.optionCard;

                if (isEliminated) {
                  optionStyle = [styles.optionCard, styles.optionEliminated];
                } else if (isAnswered) {
                  if (isCorrect) optionStyle = styles.optionCorrect;
                  else if (isSelected) optionStyle = styles.optionWrong;
                }

                return (
                  <Animated.View
                    key={idx}
                    style={[
                      { width: '100%', position: 'relative' },
                      isSelected && !isCorrect ? { transform: [{ translateX: shakeAnim }] } : null,
                      isEliminated
                        ? {
                            opacity: hintElimAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 0.45],
                            }),
                          }
                        : null,
                    ]}
                  >
                    <TouchableOpacity
                      style={optionStyle}
                      disabled={isAnswered || isEliminated}
                      onPress={() => handleSelectOption(idx)}
                    >
                      <View style={styles.optionLetterBox}>
                        <Text style={[styles.optionLetter, isEliminated && { color: '#9CA3AF' }]}>
                          {isEliminated ? '✕' : option.id}
                        </Text>
                      </View>
                      <Text style={[styles.optionText, isEliminated && styles.optionTextEliminated]}>
                        {isDeafEnglish ? option.deafText : option.text}
                      </Text>

                      {/* Animated Distractor Strikethrough Line */}
                      {isEliminated && (
                        <Animated.View
                          style={[
                            styles.strikethroughLine,
                            {
                              width: hintElimAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '78%'],
                              }),
                            },
                          ]}
                        />
                      )}

                      {/* Floating +10 Stars Pop Animation */}
                      {isAnswered && isCorrect && showStarPop && (
                        <Animated.View
                          style={[
                            styles.starPopBadge,
                            {
                              opacity: starPopAnim.interpolate({
                                inputRange: [0, 0.7, 1],
                                outputRange: [1, 1, 0],
                              }),
                              transform: [
                                {
                                  translateY: starPopAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -38],
                                  }),
                                },
                                {
                                  scale: starPopAnim.interpolate({
                                    inputRange: [0, 0.25, 1],
                                    outputRange: [0.5, 1.15, 0.95],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          <Ionicons name="star" size={15} color="#F59E0B" />
                          <Text style={styles.starPopText}>+10 Stars</Text>
                        </Animated.View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Matching Pairs UI */}
          {currentQuestion.question_type === 'matching' && (
            <View>
              {/* Matching Feedback Star Pop */}
              {matchingFeedback === 'correct' && showStarPop && (
                <Animated.View
                  style={[
                    styles.matchingStarPopBadge,
                    {
                      opacity: starPopAnim.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [1, 1, 0],
                      }),
                      transform: [
                        {
                          translateY: starPopAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -25],
                          }),
                        },
                        {
                          scale: starPopAnim.interpolate({
                            inputRange: [0, 0.25, 1],
                            outputRange: [0.6, 1.2, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <Text style={styles.starPopText}>+10 Stars Matched!</Text>
                </Animated.View>
              )}

              <Animated.View
                style={[
                  styles.matchingContainer,
                  matchingFeedback === 'wrong' ? { transform: [{ translateX: shakeAnim }] } : null,
                ]}
              >
                <View style={styles.matchingColumn}>
                  <Text style={styles.matchingColHeader}>Items</Text>
                  {shuffledLeftItems.map((item, idx) => {
                    const isMatched = currentMatchedPairs.some(p => p.left === item);
                    const isSelected = selectedLeft === item;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.matchingChip,
                          isSelected && styles.matchingChipSelected,
                          isMatched && styles.matchingChipMatched,
                        ]}
                        disabled={isMatched}
                        onPress={() => {
                          setSelectedLeft(item);
                          if (selectedRight) handlePairMatch(item, selectedRight);
                        }}
                      >
                        <Text style={[styles.matchingChipText, isMatched && styles.matchingChipTextMatched]}>
                          {isDeafEnglish ? item.toUpperCase() : item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.matchingColumn}>
                  <Text style={styles.matchingColHeader}>Matches</Text>
                  {shuffledRightItems.map((item, idx) => {
                    const isMatched = currentMatchedPairs.some(p => p.right === item);
                    const isSelected = selectedRight === item;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.matchingChip,
                          isSelected && styles.matchingChipSelected,
                          isMatched && styles.matchingChipMatched,
                        ]}
                        disabled={isMatched}
                        onPress={() => {
                          setSelectedRight(item);
                          if (selectedLeft) handlePairMatch(selectedLeft, item);
                        }}
                      >
                        <Text style={[styles.matchingChipText, isMatched && styles.matchingChipTextMatched]}>
                          {isDeafEnglish ? item.toUpperCase() : item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating ASL Helper Button */}
      {!isFinished && (
        <TouchableOpacity
          style={styles.aslFloatBtn}
          onPress={() => { setAslDrawerVisible(true); setAslResult(''); }}
        >
          <Ionicons name="hand-left-outline" size={22} color="white" />
          <Text style={styles.aslFloatBtnText}>ASL Helper</Text>
        </TouchableOpacity>
      )}

      {/* ASL / Deaf English Helper Drawer Modal */}
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

            {/* Original question text */}
            <View style={styles.aslOriginalBox}>
              <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 }}>ORIGINAL QUESTION</Text>
              <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 20 }}>
                {quizQuestions[currentQuestionIndex]?.question || quizQuestions[currentQuestionIndex]?.question_text || ''}
              </Text>
            </View>

            {/* Loading indicator */}
            {aslLoading && (
              <ActivityIndicator color="#7C3AED" style={{ marginVertical: 16 }} />
            )}

            {/* Translation result — shown above the button */}
            {!!aslResult && !aslLoading && (
              <View style={styles.aslResultBox}>
                <Text style={styles.aslResultLabel}>ASL / DEAF ENGLISH</Text>
                <Text style={{ fontSize: 14, color: '#1F2937', lineHeight: 20 }}>{aslResult}</Text>
              </View>
            )}

            {/* Translate button — always at the bottom */}
            <TouchableOpacity
              onPress={handleAslTranslate}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#7C3AED', borderRadius: 10, marginTop: 14,
                paddingVertical: 12, paddingHorizontal: 20, gap: 8,
              }}
            >
              <Ionicons name="language-outline" size={20} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Translate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 16, backgroundColor: '#F8F9FA' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  hintHeaderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#7C3AED',
  },
  hintHeaderBtnUsed: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  hintHeaderBtnText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  hintHeaderBtnTextUsed: { color: '#9CA3AF' },
  hintBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FEF3C7', borderRadius: 10,
    padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A',
  },
  hintBannerText: { fontSize: 14, color: '#92400E', flex: 1, lineHeight: 20 },
  scrollContent: { padding: 20 },
  questionCard: { backgroundColor: 'white', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  questionText: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 16, lineHeight: 26 },
  questionImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 16 },
  optionsContainer: { gap: 12 },
  optionCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  optionCorrect: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionWrong: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  optionLetterBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionLetter: { fontSize: 14, fontWeight: 'bold', color: '#0284C7' },
  optionText: { fontSize: 16, color: '#374151', flex: 1 },
  matchingContainer: { flexDirection: 'row', gap: 16 },
  matchingColumn: { flex: 1, gap: 10 },
  matchingColHeader: { fontSize: 14, fontWeight: 'bold', color: '#4B5563', marginBottom: 4 },
  matchingChip: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F3F4F6', alignItems: 'center' },
  matchingChipSelected: { borderColor: '#0284C7', backgroundColor: '#E0F2FE', borderWidth: 2 },
  matchingChipMatched: { borderColor: '#10B981', backgroundColor: '#D1FAE5', opacity: 0.6 },
  matchingChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  matchingChipTextMatched: { color: '#065F46' },
  finishedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  finishedTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginTop: 16 },
  finishedScore: { fontSize: 20, color: '#0284C7', fontWeight: 'bold', marginTop: 8 },
  difficultyBadge: { fontSize: 14, color: '#6B7280', marginTop: 4, textTransform: 'uppercase', fontWeight: '600' },
  unlockCelebrationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF08A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
  unlockCelebrationText: { color: '#854D0E', fontWeight: 'bold', fontSize: 15 },
  finishedActions: { width: '100%', gap: 12, marginTop: 30 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: '#0284C7', backgroundColor: 'white' },
  retryBtnText: { color: '#0284C7', fontWeight: 'bold', fontSize: 16 },
  doneBtn: { backgroundColor: '#0284C7', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  doneBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  aslFloatBtn: {
    position: 'absolute', bottom: 100, right: 16,
    backgroundColor: '#7C3AED', borderRadius: 24,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    elevation: 6, shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 8,
  },
  aslFloatBtnText: { color: 'white', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  aslDrawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  aslDrawerContent: {
    backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  aslDrawerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  aslOriginalBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 14 },
  aslResultBox: { backgroundColor: '#EDE9FE', borderRadius: 10, padding: 12, marginTop: 14 },
  aslResultLabel: { fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 4 },
  optionEliminated: { opacity: 0.45, backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  optionTextEliminated: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  strikethroughLine: {
    position: 'absolute',
    left: 56,
    height: 3,
    backgroundColor: '#EF4444',
    borderRadius: 2,
    top: '50%',
    zIndex: 10,
  },
  progressBarBg: { height: 6, backgroundColor: '#E5E7EB', width: '100%' },
  progressBarFill: { height: '100%', backgroundColor: '#7C3AED' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  doneButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7C3AED', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 20 },
  doneButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  starPopBadge: {
    position: 'absolute',
    right: 12,
    top: -10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 20,
  },
  starPopText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
  },
  matchingStarPopBadge: {
    alignSelf: 'center',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
});
