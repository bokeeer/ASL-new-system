import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSubjects } from "../context/SubjectsContext";
import * as ImagePicker from "expo-image-picker";
import { API_URL } from "../context/config";

interface MatchingPairForm {
  left: string;
  right: string;
}

interface QuestionForm {
  question_text: string;
  question_type: string;
  image_url: string;
  knowledge_component: string;
  options: string[];
  correct_option_index: number;
  matching_pairs: MatchingPairForm[];
}

export default function AdminScreen() {
  const { subjects } = useSubjects();
  const [activeTab, setActiveTab] = useState<'lessons' | 'quizzes' | 'kcs' | 'analytics'>('lessons');

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`${API_URL}/admin/analytics/overview`);
      if (res.ok) {
        setAnalyticsData(await res.json());
      }
    } catch (err) {
      console.log('Error fetching analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab]);

  const englishSubject = subjects['english'];
  const category = englishSubject?.categories[0];
  const topics = category ? category.topics : [];

  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id || '');
  const selectedTopic = topics.find(t => t.id === selectedTopicId);

  // Lesson groups state from DB
  const [lessonGroups, setLessonGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Lesson Form fields
  const [lessonGroupName, setLessonGroupName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [descriptions, setDescriptions] = useState<{ description_text: string; image_url: string }[]>([
    { description_text: '', image_url: '' }
  ]);
  const [submittingLesson, setSubmittingLesson] = useState(false);

  // Quiz Form fields
  const [quizTitle, setQuizTitle] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedQuizDifficulty, setSelectedQuizDifficulty] = useState<string>('easy');
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { question_text: '', question_type: 'descriptive', image_url: '', knowledge_component: '', options: ['', '', '', ''], correct_option_index: 0, matching_pairs: [{ left: '', right: '' }] }
  ]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Phase 2 KC state
  const [kcList, setKcList] = useState<any[]>([]);
  const [kcName, setKcName] = useState('');
  const [kcDisplayName, setKcDisplayName] = useState('');
  const [kcPrior, setKcPrior] = useState('0.10');
  const [kcLearns, setKcLearns] = useState('0.20');
  const [kcGuesses, setKcGuesses] = useState('0.25');
  const [kcSlips, setKcSlips] = useState('0.10');
  const [submittingKC, setSubmittingKC] = useState(false);
  const [fittingModel, setFittingModel] = useState(false);

  // Phase 6 Quiz Editing state
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
  const [editingQuizQuestions, setEditingQuizQuestions] = useState<any[]>([]);
  const [loadingEditingQuiz, setLoadingEditingQuiz] = useState(false);
  const [savingEditingQuiz, setSavingEditingQuiz] = useState(false);

  // Edit Existing Lesson Slides state
  const [editingLesson, setEditingLesson] = useState<{ id: number; title: string; difficulty: string; groupTitle: string } | null>(null);
  const [editingSlides, setEditingSlides] = useState<{ description_text: string; image_url: string }[]>([]);
  const [loadingEditingSlides, setLoadingEditingSlides] = useState(false);
  const [savingEditingSlides, setSavingEditingSlides] = useState(false);

  const openEditSlides = async (lesson: any, groupTitle: string) => {
    setEditingLesson({ id: lesson.id, title: lesson.title, difficulty: lesson.difficulty, groupTitle });
    setLoadingEditingSlides(true);
    try {
      const res = await fetch(`${API_URL}/admin/lesson/${lesson.id}/slides`);
      if (res.ok) {
        const data = await res.json();
        setEditingSlides(data.map((s: any) => ({
          description_text: s.description_text || '',
          image_url: s.image_url || ''
        })));
      } else {
        setEditingSlides([{ description_text: '', image_url: '' }]);
      }
    } catch {
      setEditingSlides([{ description_text: '', image_url: '' }]);
    } finally {
      setLoadingEditingSlides(false);
    }
  };

  const handleEditSlideTextChange = (text: string, index: number) => {
    const updated = [...editingSlides];
    updated[index].description_text = text;
    setEditingSlides(updated);
  };

  const pickEditSlideImage = async (index: number) => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      showAlert("Permission Required", "Camera roll permission is needed to select an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadEditSlideImage(result.assets[0].uri, index);
    }
  };

  const uploadEditSlideImage = async (uri: string, index: number) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, filename);
      } else {
        formData.append('file', { uri, name: filename, type } as any);
      }

      const res = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const updated = [...editingSlides];
      updated[index].image_url = data.url;
      setEditingSlides(updated);
    } catch (err: any) {
      showAlert("Upload Error", err.message || "Could not upload image.");
    }
  };

  const handleRemoveEditSlideImage = (index: number) => {
    const updated = [...editingSlides];
    updated[index].image_url = '';
    setEditingSlides(updated);
  };

  const handleAddEditSlide = () => {
    setEditingSlides([...editingSlides, { description_text: '', image_url: '' }]);
  };

  const handleRemoveEditSlide = (index: number) => {
    if (editingSlides.length <= 1) {
      showAlert("Warning", "A lesson must have at least one slide.");
      return;
    }
    setEditingSlides(editingSlides.filter((_, i) => i !== index));
  };

  const handleSaveEditedSlides = async () => {
    if (!editingLesson) return;
    const validSlides = editingSlides.filter(s => s.description_text.trim() !== '');
    if (validSlides.length === 0) {
      showAlert("Error", "Please provide text for at least one slide.");
      return;
    }
    setSavingEditingSlides(true);
    try {
      const res = await fetch(`${API_URL}/admin/lesson/${editingLesson.id}/slides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: validSlides }),
      });
      if (!res.ok) throw new Error("Failed to update slides.");
      showAlert("Success", `Slides for "${editingLesson.title}" updated successfully!`);
      setEditingLesson(null);
      fetchLessonGroups(selectedTopicId);
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to update slides.");
    } finally {
      setSavingEditingSlides(false);
    }
  };

  const fetchQuizzes = async (topicId: string) => {
    setLoadingQuizzes(true);
    try {
      const res = await fetch(`${API_URL}/topic/${topicId}?user_id=1`);
      if (res.ok) {
        const data = await res.json();
        const quizzes: any[] = [];
        (data.lesson_groups || []).forEach((g: any) => {
          (g.lessons || []).forEach((l: any) => {
            if (l.quiz_id) {
              quizzes.push({
                id: l.quiz_id,
                title: `${g.title} (${l.difficulty.toUpperCase()})`,
                difficulty: l.difficulty,
                groupTitle: g.title,
                questionCount: l.quiz_question_count || 0,
              });
            }
          });
        });
        setExistingQuizzes(quizzes);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingQuizzes(false);
    }
  };

  useEffect(() => {
    if (selectedTopicId) {
      fetchQuizzes(selectedTopicId);
    }
  }, [selectedTopicId, activeTab]);

  const openEditQuiz = async (quiz: any) => {
    setEditingQuiz(quiz);
    setLoadingEditingQuiz(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/${quiz.id}/questions`);
      if (res.ok) {
        const data = await res.json();
        setEditingQuizQuestions(data.map((q: any) => ({
          id: q.id,
          question_text: q.question_text || '',
          question_type: q.question_type || 'descriptive',
          image_url: q.image_url || '',
          knowledge_component: q.knowledge_component || '',
          options: q.options && q.options.length > 0 ? q.options : ['', '', '', ''],
          correct_option_index: q.correct_option_index || 0,
          hint: q.hint || '',
          matching_pairs: q.matching_pairs || [{ left: '', right: '' }]
        })));
      } else {
        setEditingQuizQuestions([]);
      }
    } catch {
      setEditingQuizQuestions([]);
    } finally {
      setLoadingEditingQuiz(false);
    }
  };

  const handleEditQuizQuestionText = (text: string, index: number) => {
    const updated = [...editingQuizQuestions];
    updated[index].question_text = text;
    setEditingQuizQuestions(updated);
  };

  const handleEditQuizHint = (text: string, index: number) => {
    const updated = [...editingQuizQuestions];
    updated[index].hint = text;
    setEditingQuizQuestions(updated);
  };

  const handleEditQuizOption = (text: string, qIdx: number, oIdx: number) => {
    const updated = [...editingQuizQuestions];
    updated[qIdx].options[oIdx] = text;
    setEditingQuizQuestions(updated);
  };

  const handleSetCorrectOption = (qIdx: number, oIdx: number) => {
    const updated = [...editingQuizQuestions];
    updated[qIdx].correct_option_index = oIdx;
    setEditingQuizQuestions(updated);
  };

  const pickQuizQuestionImage = async (index: number) => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      showAlert("Permission Required", "Camera roll permission is needed to select an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadQuizQuestionImage(result.assets[0].uri, index);
    }
  };

  const uploadQuizQuestionImage = async (uri: string, index: number) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, filename);
      } else {
        formData.append('file', { uri, name: filename, type } as any);
      }

      const res = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const updated = [...editingQuizQuestions];
      updated[index].image_url = data.url;
      setEditingQuizQuestions(updated);
    } catch (err: any) {
      showAlert("Upload Error", err.message || "Could not upload image.");
    }
  };

  const handleRemoveQuizQuestionImage = (index: number) => {
    const updated = [...editingQuizQuestions];
    updated[index].image_url = '';
    setEditingQuizQuestions(updated);
  };

  const handleAddQuizQuestion = () => {
    setEditingQuizQuestions([
      ...editingQuizQuestions,
      {
        question_text: '',
        question_type: 'descriptive',
        image_url: '',
        knowledge_component: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        hint: '',
        matching_pairs: [{ left: '', right: '' }]
      }
    ]);
  };

  const handleRemoveQuizQuestion = (index: number) => {
    if (editingQuizQuestions.length <= 1) {
      showAlert("Warning", "A quiz must have at least one question.");
      return;
    }
    setEditingQuizQuestions(editingQuizQuestions.filter((_, i) => i !== index));
  };

  const handleSaveQuizQuestions = async () => {
    if (!editingQuiz) return;
    const valid = editingQuizQuestions.filter(q => q.question_text.trim() !== '');
    if (valid.length === 0) {
      showAlert("Error", "Please provide at least one valid question with text.");
      return;
    }
    setSavingEditingQuiz(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/${editingQuiz.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: valid }),
      });
      if (!res.ok) throw new Error("Failed to update quiz questions.");
      showAlert("Success", `Quiz "${editingQuiz.title}" updated successfully!`);
      setEditingQuiz(null);
      fetchQuizzes(selectedTopicId);
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to update questions.");
    } finally {
      setSavingEditingQuiz(false);
    }
  };

  const handleFitBkt = async () => {
    setFittingModel(true);
    try {
      const res = await fetch(`${API_URL}/admin/fit-bkt-model?topic_id=${selectedTopicId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Fitting failed');
      showAlert('pyBKT Refitting Complete!', data.message);
      fetchKCs(selectedTopicId);
    } catch (err: any) {
      showAlert('pyBKT Error', err.message);
    } finally {
      setFittingModel(false);
    }
  };


  const fetchKCs = async (topicId: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/kcs/${topicId}`);
      if (res.ok) setKcList(await res.json());
    } catch { /* silent */ }
  };

  const handleSubmitKC = async () => {
    if (!kcName.trim() || !kcDisplayName.trim()) {
      showAlert('Error', 'KC name and display name are required.');
      return;
    }
    setSubmittingKC(true);
    try {
      const res = await fetch(`${API_URL}/admin/kc/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopicId,
          name: kcName.trim(),
          display_name: kcDisplayName.trim(),
          prior: parseFloat(kcPrior) || 0.10,
          learns: parseFloat(kcLearns) || 0.20,
          guesses: parseFloat(kcGuesses) || 0.25,
          slips: parseFloat(kcSlips) || 0.10,
        }),
      });
      if (!res.ok) throw new Error('Failed to save KC');
      showAlert('Success', `KC "${kcDisplayName}" saved!`);
      setKcName(''); setKcDisplayName('');
      fetchKCs(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmittingKC(false); }
  };

  const handleDeleteKC = async (name: string) => {
    const ok = Platform.OS === 'web' ? window.confirm(`Delete KC "${name}"?`) : true;
    if (!ok) return;
    try {
      await fetch(`${API_URL}/admin/kc/${name}`, { method: 'DELETE' });
      fetchKCs(selectedTopicId);
    } catch { showAlert('Error', 'Could not delete KC.'); }
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const fetchLessonGroups = async (topicId: string) => {
    setLoadingGroups(true);
    try {
      const res = await fetch(`${API_URL}/admin/lesson-groups/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        setLessonGroups(data);
      }
    } catch (err) {
      console.log('Error fetching lesson groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    if (selectedTopicId) {
      fetchLessonGroups(selectedTopicId);
      fetchKCs(selectedTopicId);
    }
  }, [selectedTopicId]);

  // Handle slide description change
  const handleDescriptionChange = (text: string, index: number) => {
    const updated = [...descriptions];
    updated[index].description_text = text;
    setDescriptions(updated);
  };

  // Pick slide image
  const pickSlideImage = async (index: number) => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      showAlert("Permission Required", "Camera roll permission is needed to select an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadSlideImage(result.assets[0].uri, index);
    }
  };

  const uploadSlideImage = async (uri: string, index: number) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'upload.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, filename);
      } else {
        formData.append('file', { uri, name: filename, type } as any);
      }

      const res = await fetch(`${API_URL}/admin/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const updated = [...descriptions];
      updated[index].image_url = data.url;
      setDescriptions(updated);
    } catch (err: any) {
      showAlert("Upload Error", err.message || "Could not upload image.");
    }
  };

  const handleAddDescription = () => {
    setDescriptions([...descriptions, { description_text: '', image_url: '' }]);
  };

  const handleRemoveDescription = (index: number) => {
    if (descriptions.length <= 1) {
      showAlert("Warning", "A lesson must have at least one slide.");
      return;
    }
    setDescriptions(descriptions.filter((_, i) => i !== index));
  };

  // Submit Lesson
  const handleSubmitLesson = async () => {
    if (!lessonGroupName.trim()) {
      showAlert("Error", "Please enter a Lesson Group title.");
      return;
    }
    const validSlides = descriptions.filter(d => d.description_text.trim() !== '');
    if (validSlides.length === 0) {
      showAlert("Error", "Please add text for at least one slide.");
      return;
    }

    setSubmittingLesson(true);
    try {
      // 1. Check if group exists or create it
      let groupId: number | null = null;
      const existingGroup = lessonGroups.find(
        g => g.title.toLowerCase().trim() === lessonGroupName.toLowerCase().trim()
      );

      if (existingGroup) {
        groupId = existingGroup.id;
      } else {
        const groupRes = await fetch(`${API_URL}/admin/lesson-group/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_id: selectedTopicId,
            title: lessonGroupName.trim(),
            order_index: lessonGroups.length,
          }),
        });
        if (!groupRes.ok) throw new Error("Failed to create lesson group");
        const groupData = await groupRes.json();
        groupId = groupData.lesson_group.id;
      }

      // 2. Create the lesson with difficulty
      const res = await fetch(`${API_URL}/admin/lesson/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopicId,
          title: `${lessonGroupName.trim()} (${difficulty.toUpperCase()})`,
          difficulty,
          lesson_group_id: groupId,
          slides: validSlides,
        }),
      });

      if (res.status === 409) {
        showAlert("Duplicate Error", `A ${difficulty.toUpperCase()} lesson already exists for "${lessonGroupName}". Pick a different difficulty.`);
        return;
      }

      if (!res.ok) throw new Error("Failed to save lesson");

      showAlert("Success", `${difficulty.toUpperCase()} lesson saved successfully under "${lessonGroupName}"!`);
      setLessonGroupName('');
      setDescriptions([{ description_text: '', image_url: '' }]);
      fetchLessonGroups(selectedTopicId);
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to submit lesson.");
    } finally {
      setSubmittingLesson(false);
    }
  };

  const handleDeleteGroup = async (groupId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Delete "${title}" and all its difficulty lessons?`)
      : true;

    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/lesson-group/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert("Deleted", `Lesson group "${title}" was deleted.`);
        fetchLessonGroups(selectedTopicId);
      }
    } catch (err) {
      showAlert("Error", "Could not delete lesson group.");
    }
  };

  // Flatten all available lessons across groups for quiz selection
  const allLessonsList = lessonGroups.flatMap(g =>
    (g.lessons || []).map((l: any) => ({
      id: l.id,
      title: `${g.title} — ${l.difficulty.toUpperCase()}`,
      difficulty: l.difficulty,
    }))
  );

  // Auto-fill quiz difficulty when selected lesson changes
  const handleSelectQuizLesson = (lessonId: number) => {
    setSelectedLessonId(lessonId);
    const found = allLessonsList.find(l => l.id === lessonId);
    if (found) {
      setSelectedQuizDifficulty(found.difficulty);
    }
  };

  // Submit Quiz
  const handleSubmitQuiz = async () => {
    if (!quizTitle.trim()) {
      showAlert("Error", "Please enter a Quiz Title.");
      return;
    }
    if (!selectedLessonId) {
      showAlert("Error", "Please select a Lesson for this quiz.");
      return;
    }

    setSubmittingQuiz(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quizTitle.trim(),
          topic_id: selectedTopicId,
          lesson_id: selectedLessonId,
          difficulty: selectedQuizDifficulty,
          questions,
        }),
      });

      if (!res.ok) throw new Error("Failed to create quiz.");

      showAlert("Success", "Quiz created successfully!");
      setQuizTitle('');
      setQuestions([{ question_text: '', question_type: 'descriptive', image_url: '', options: ['', '', '', ''], correct_option_index: 0, matching_pairs: [{ left: '', right: '' }] }]);
      fetchLessonGroups(selectedTopicId);
    } catch (err: any) {
      showAlert("Error", err.message || "Could not create quiz.");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0284C7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Content Manager</Text>
        </View>

        {/* Topic Selector Bar */}
        <View style={styles.topicBar}>
          <Text style={styles.topicBarLabel}>Select Topic:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {topics.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.topicChip, selectedTopicId === t.id && styles.topicChipActive]}
                onPress={() => setSelectedTopicId(t.id)}
              >
                <Text style={[styles.topicChipText, selectedTopicId === t.id && styles.topicChipTextActive]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tab Buttons */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'lessons' && styles.tabButtonActive]}
            onPress={() => setActiveTab('lessons')}
          >
            <Ionicons name="book-outline" size={16} color={activeTab === 'lessons' ? '#0284C7' : '#6B7280'} />
            <Text style={[styles.tabButtonText, activeTab === 'lessons' && styles.tabButtonTextActive]}>
              Lessons
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'quizzes' && styles.tabButtonActive]}
            onPress={() => setActiveTab('quizzes')}
          >
            <Ionicons name="help-circle-outline" size={16} color={activeTab === 'quizzes' ? '#0284C7' : '#6B7280'} />
            <Text style={[styles.tabButtonText, activeTab === 'quizzes' && styles.tabButtonTextActive]}>
              Quizzes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'kcs' && styles.tabButtonActive]}
            onPress={() => setActiveTab('kcs')}
          >
            <Ionicons name="brain-outline" size={16} color={activeTab === 'kcs' ? '#9333EA' : '#6B7280'} />
            <Text style={[styles.tabButtonText, activeTab === 'kcs' && styles.tabButtonTextActive]}>
              Skills (ITS)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
            onPress={() => setActiveTab('analytics')}
          >
            <Ionicons name="bar-chart-outline" size={16} color={activeTab === 'analytics' ? '#0D9488' : '#6B7280'} />
            <Text style={[styles.tabButtonText, activeTab === 'analytics' && styles.tabButtonTextActive]}>
              Analytics
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* LESSONS TAB */}
          {activeTab === 'lessons' && (
            <View>
              {/* Add Lesson Form */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create Lesson Content</Text>

                {/* Lesson Group Title */}
                <Text style={styles.label}>Lesson Group Title (e.g., "Introduction to Letters")</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter lesson group name..."
                  value={lessonGroupName}
                  onChangeText={setLessonGroupName}
                />

                {/* Difficulty Selector */}
                <Text style={styles.label}>Difficulty Level for this Version:</Text>
                <View style={styles.difficultyRow}>
                  {(['easy', 'medium', 'hard'] as const).map(diff => (
                    <TouchableOpacity
                      key={diff}
                      style={[
                        styles.diffChip,
                        difficulty === diff && styles[`diffChip_${diff}` as keyof typeof styles]
                      ]}
                      onPress={() => setDifficulty(diff)}
                    >
                      <Text style={[
                        styles.diffChipText,
                        difficulty === diff && styles.diffChipTextActive
                      ]}>
                        {diff === 'easy' ? 'Easy' : diff === 'medium' ? 'Medium' : 'Hard'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Slides Section */}
                <Text style={[styles.label, { marginTop: 16 }]}>Lesson Slides ({difficulty.toUpperCase()} content):</Text>
                {descriptions.map((desc, idx) => (
                  <View key={idx} style={styles.slideCard}>
                    <View style={styles.slideHeader}>
                      <Text style={styles.slideNumber}>Slide {idx + 1}</Text>
                      {descriptions.length > 1 && (
                        <TouchableOpacity onPress={() => handleRemoveDescription(idx)}>
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TextInput
                      style={[styles.input, { height: 70 }]}
                      placeholder={`Enter slide text for slide ${idx + 1}...`}
                      value={desc.description_text}
                      onChangeText={(txt) => handleDescriptionChange(txt, idx)}
                      multiline
                    />

                    {/* Image Preview / Button */}
                    {desc.image_url ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: desc.image_url }} style={styles.slideImagePreview} resizeMode="contain" />
                        <TouchableOpacity
                          style={styles.changeImgBtn}
                          onPress={() => pickSlideImage(idx)}
                        >
                          <Text style={styles.changeImgBtnText}>Change Image</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => pickSlideImage(idx)}
                      >
                        <Ionicons name="image-outline" size={20} color="#0284C7" />
                        <Text style={styles.uploadBtnText}>Add Image to Slide (Optional)</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity style={styles.addSlideBtn} onPress={handleAddDescription}>
                  <Ionicons name="add-circle-outline" size={20} color="#0284C7" />
                  <Text style={styles.addSlideBtnText}>Add Another Slide</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, submittingLesson && styles.submitBtnDisabled]}
                  onPress={handleSubmitLesson}
                  disabled={submittingLesson}
                >
                  {submittingLesson ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitBtnText}>Save {difficulty.toUpperCase()} Lesson</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Lesson Groups List */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Existing Lessons ({selectedTopic?.name})</Text>
                {loadingGroups ? (
                  <ActivityIndicator size="small" color="#0284C7" style={{ marginVertical: 20 }} />
                ) : lessonGroups.length === 0 ? (
                  <Text style={styles.emptyText}>No lesson groups created yet for this topic.</Text>
                ) : (
                  lessonGroups.map(group => (
                    <View key={group.id} style={styles.groupCard}>
                      <View style={styles.groupHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.groupTitle}>{group.title}</Text>
                          <Text style={styles.groupSub}>Order #{group.order_index + 1}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteGroup(group.id, group.title)}>
                          <Ionicons name="trash-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      {/* Difficulty Tiers */}
                      <View style={styles.tierContainer}>
                        {(['easy', 'medium', 'hard'] as const).map(diff => {
                          const found = (group.lessons || []).find((l: any) => l.difficulty === diff);
                          const isWarn = found && found.quiz_question_count < 10;
                          return (
                            <View key={diff} style={styles.tierRow}>
                              <Text style={styles.tierName}>
                                {diff === 'easy' ? 'Easy' : diff === 'medium' ? 'Medium' : 'Hard'}
                              </Text>

                              {found ? (
                                <View style={styles.tierInfo}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.tierText}>
                                      {found.slide_count} slides • Quiz: {found.quiz_question_count} Qs
                                    </Text>
                                    {isWarn && (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                        <Ionicons name="alert-circle-outline" size={12} color="#B45309" />
                                        <Text style={styles.warnBadge}>&lt;10 Qs</Text>
                                      </View>
                                    )}
                                  </View>
                                  <TouchableOpacity
                                    style={styles.editTierBtn}
                                    onPress={() => openEditSlides(found, group.title)}
                                  >
                                    <Ionicons name="create-outline" size={14} color="#0284C7" />
                                    <Text style={styles.editTierBtnText}>Edit Slides & Images</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.addTierBtn}
                                  onPress={() => {
                                    setLessonGroupName(group.title);
                                    setDifficulty(diff);
                                  }}
                                >
                                  <Text style={styles.addTierBtnText}>+ Add {diff}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* QUIZZES TAB */}
          {activeTab === 'quizzes' && (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create Quiz</Text>

                <Text style={styles.label}>Quiz Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Easy Letters Quiz"
                  value={quizTitle}
                  onChangeText={setQuizTitle}
                />

                <Text style={styles.label}>Select Lesson Version:</Text>
                {allLessonsList.length === 0 ? (
                  <Text style={{ color: '#EF4444', marginBottom: 12 }}>
                    No lessons found. Please create a lesson first.
                  </Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                    {allLessonsList.map(l => (
                      <TouchableOpacity
                        key={l.id}
                        style={[styles.topicChip, selectedLessonId === l.id && styles.topicChipActive]}
                        onPress={() => handleSelectQuizLesson(l.id)}
                      >
                        <Text style={[styles.topicChipText, selectedLessonId === l.id && styles.topicChipTextActive]}>
                          {l.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.label}>Quiz Difficulty (Inherited):</Text>
                <View style={[styles.diffChip, styles[`diffChip_${selectedQuizDifficulty}` as keyof typeof styles], { alignSelf: 'flex-start', marginBottom: 16 }]}>
                  <Text style={styles.diffChipTextActive}>
                    {selectedQuizDifficulty.toUpperCase()}
                  </Text>
                </View>

                {/* Question List */}
                <Text style={styles.label}>Questions (Pool of up to 40 questions):</Text>
                {questions.map((q, idx) => (
                  <View key={idx} style={styles.slideCard}>
                    <Text style={styles.slideNumber}>Question #{idx + 1}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Question prompt text..."
                      value={q.question_text}
                      onChangeText={(txt) => {
                        const updated = [...questions];
                        updated[idx].question_text = txt;
                        setQuestions(updated);
                      }}
                    />

                    {/* KC Dropdown */}
                    <Text style={[styles.label, { color: '#7C3AED' }]}>🧠 Knowledge Component (ITS):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={[styles.topicChip, q.knowledge_component === '' && styles.topicChipActive]}
                        onPress={() => { const u = [...questions]; u[idx].knowledge_component = ''; setQuestions(u); }}
                      >
                        <Text style={[styles.topicChipText, q.knowledge_component === '' && styles.topicChipTextActive]}>None</Text>
                      </TouchableOpacity>
                      {kcList.map(kc => (
                        <TouchableOpacity
                          key={kc.name}
                          style={[styles.topicChip, q.knowledge_component === kc.name && { backgroundColor: '#7C3AED' }]}
                          onPress={() => { const u = [...questions]; u[idx].knowledge_component = kc.name; setQuestions(u); }}
                        >
                          <Text style={[styles.topicChipText, q.knowledge_component === kc.name && { color: 'white', fontWeight: 'bold' }]}>{kc.display_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {kcList.length === 0 && (
                      <Text style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 8 }}>No KCs yet — create them in the Skills (ITS) tab first</Text>
                    )}
                    {q.options.map((opt, oIdx) => (
                      <View key={oIdx} style={styles.optionRow}>
                        <TouchableOpacity
                          style={[styles.radio, q.correct_option_index === oIdx && styles.radioActive]}
                          onPress={() => {
                            const updated = [...questions];
                            updated[idx].correct_option_index = oIdx;
                            setQuestions(updated);
                          }}
                        >
                          {q.correct_option_index === oIdx && <View style={styles.radioInner} />}
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          value={opt}
                          onChangeText={(txt) => {
                            const updated = [...questions];
                            updated[idx].options[oIdx] = txt;
                            setQuestions(updated);
                          }}
                        />
                      </View>
                    ))}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addSlideBtn}
                  onPress={() => setQuestions([...questions, { question_text: '', question_type: 'descriptive', image_url: '', knowledge_component: '', options: ['', '', '', ''], correct_option_index: 0, matching_pairs: [{ left: '', right: '' }] }])}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#0284C7" />
                  <Text style={styles.addSlideBtnText}>Add Question to Pool ({questions.length} questions)</Text>
                </TouchableOpacity>

                {questions.length < 10 && (
                  <Text style={{ color: '#F59E0B', fontSize: 13, marginBottom: 12 }}>
                    ⚠️ Note: Adding at least 10 questions enables full randomization for students.
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, submittingQuiz && styles.submitBtnDisabled]}
                  onPress={handleSubmitQuiz}
                  disabled={submittingQuiz}
                >
                  {submittingQuiz ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Save Quiz</Text>}
                </TouchableOpacity>
              </View>

              {/* Existing Quizzes for Selected Topic */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Existing Quizzes ({selectedTopic?.name})</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                  View and edit questions, options, hints, and illustrations for each lesson quiz.
                </Text>

                {loadingQuizzes ? (
                  <ActivityIndicator color="#0284C7" style={{ marginVertical: 20 }} />
                ) : existingQuizzes.length === 0 ? (
                  <Text style={styles.emptyText}>No quizzes created yet for this topic.</Text>
                ) : (
                  existingQuizzes.map((quiz) => (
                    <View key={quiz.id} style={styles.groupCard}>
                      <View style={styles.groupHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.groupTitle}>{quiz.title}</Text>
                          <Text style={styles.groupSub}>
                            {quiz.questionCount} questions in pool • Difficulty: {quiz.difficulty.toUpperCase()}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.editTierBtn}
                          onPress={() => openEditQuiz(quiz)}
                        >
                          <Ionicons name="create-outline" size={14} color="#0284C7" />
                          <Text style={styles.editTierBtnText}>Edit Questions & Images</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* KC / SKILLS TAB — Phase 2 ITS */}
          {activeTab === 'kcs' && (
            <View>
              <View style={styles.card}>
                <Text style={[styles.cardTitle, { color: '#7C3AED' }]}>🧠 Create Knowledge Component</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                  KCs define the specific skill a question tests. BKT tracks each student's mastery per KC automatically.
                </Text>

                <Text style={styles.label}>KC ID (no spaces)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. identify_vowels"
                  value={kcName}
                  onChangeText={setKcName}
                  autoCapitalize="none"
                />

                <Text style={styles.label}>KC Display Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Identify Vowels"
                  value={kcDisplayName}
                  onChangeText={setKcDisplayName}
                />

                <Text style={[styles.label, { marginTop: 4 }]}>BKT Parameters</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Prior P(L₀)', val: kcPrior, set: setKcPrior },
                    { label: 'Learn P(T)', val: kcLearns, set: setKcLearns },
                    { label: 'Guess P(G)', val: kcGuesses, set: setKcGuesses },
                    { label: 'Slip P(S)', val: kcSlips, set: setKcSlips },
                  ].map(p => (
                    <View key={p.label} style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{p.label}</Text>
                      <TextInput style={[styles.input, { marginBottom: 0, paddingHorizontal: 8 }]} value={p.val} onChangeText={p.set} keyboardType="decimal-pad" />
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: '#7C3AED' }, submittingKC && styles.submitBtnDisabled]}
                  onPress={handleSubmitKC}
                  disabled={submittingKC}
                >
                  {submittingKC ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Save Knowledge Component</Text>}
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={[styles.cardTitle, { color: '#7C3AED' }]}>Registered KCs ({kcList.length})</Text>
                {kcList.length === 0 ? (
                  <Text style={{ color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 }}>No KCs yet. Create one above.</Text>
                ) : (
                  kcList.map(kc => (
                    <View key={kc.name} style={[styles.slideCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold', color: '#1F2937' }}>{kc.display_name}</Text>
                        <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{kc.name}</Text>
                        <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                          Prior: {kc.prior} | Learn: {kc.learns} | Guess: {kc.guesses} | Slip: {kc.slips}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteKC(kc.name)} style={{ padding: 8 }}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              {/* pyBKT Model Refitting Card (Phase 2c) */}
              <View style={[styles.card, { borderColor: '#DDD6FE', backgroundColor: '#FAF5FF' }]}>
                <Text style={[styles.cardTitle, { color: '#6D28D9' }]}>⚡ Refit BKT Model (pyBKT)</Text>
                <Text style={{ fontSize: 13, color: '#4C1D95', marginBottom: 14, lineHeight: 18 }}>
                  Runs pyBKT's Expectation-Maximization (EM) algorithm on collected student answer data to automatically recalculate and calibrate prior, learn, guess, and slip parameters.
                </Text>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: '#6D28D9' }, fittingModel && styles.submitBtnDisabled]}
                  onPress={handleFitBkt}
                  disabled={fittingModel}
                >
                  {fittingModel ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitBtnText}>⚡ Recalibrate Parameters with pyBKT</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <View>
              {loadingAnalytics ? (
                <ActivityIndicator size="large" color="#0D9488" style={{ marginVertical: 40 }} />
              ) : !analyticsData ? (
                <Text style={styles.emptyText}>No analytics data available yet.</Text>
              ) : (
                <>
                  {/* KPI Row */}
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCard}>
                      <Ionicons name="people-outline" size={22} color="#0284C7" />
                      <Text style={styles.kpiVal}>{analyticsData.total_students || 0}</Text>
                      <Text style={styles.kpiLabel}>Students</Text>
                    </View>
                    <View style={styles.kpiCard}>
                      <Ionicons name="create-outline" size={22} color="#7C3AED" />
                      <Text style={styles.kpiVal}>{analyticsData.total_attempts || 0}</Text>
                      <Text style={styles.kpiLabel}>Quiz Attempts</Text>
                    </View>
                    <View style={styles.kpiCard}>
                      <Ionicons name="stats-chart-outline" size={22} color="#10B981" />
                      <Text style={styles.kpiVal}>{analyticsData.class_avg_accuracy || 0}%</Text>
                      <Text style={styles.kpiLabel}>Class Accuracy</Text>
                    </View>
                  </View>

                  {/* Topic Performance Breakdown */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Topic Performance</Text>
                    <View style={{ gap: 10 }}>
                      {[
                        { id: 'story-grammar', name: 'Story Grammar', icon: 'book-outline', color: '#7C3AED' },
                        { id: 'mathematics', name: 'Mathematics', icon: 'shapes-outline', color: '#2563EB' },
                        { id: 'technology-and-livelihood-education', name: 'TLE (ICT)', icon: 'videocam-outline', color: '#D97706' },
                        { id: 'araling-panlipunan', name: 'Araling Panlipunan', icon: 'globe-outline', color: '#059669' },
                      ].map((top) => (
                        <View key={top.id} style={styles.topicPerfCard}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name={top.icon as any} size={20} color={top.color} />
                            <Text style={styles.topicPerfTitle}>{top.name}</Text>
                          </View>
                          <Text style={styles.topicPerfStats}>
                            {analyticsData.topic_stats?.[top.id]?.attempts || 0} attempts •{' '}
                            <Text style={{ fontWeight: 'bold', color: top.color }}>
                              {analyticsData.topic_stats?.[top.id]?.avg_accuracy || 0}% avg
                            </Text>
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Weakest Knowledge Components */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Skills Requiring Attention</Text>
                    <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
                      Knowledge Components with lowest class mastery based on student BKT tracing.
                    </Text>

                    {(analyticsData.weak_kcs || []).map((kc: any) => (
                      <View key={kc.name} style={styles.weakKcRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.weakKcName}>{kc.display_name || kc.name}</Text>
                          <Text style={styles.weakKcSub}>Topic: {kc.topic_id} • {kc.student_count} students</Text>
                        </View>
                        <View style={{ width: 100, alignItems: 'flex-end' }}>
                          <Text style={styles.weakKcPct}>{kc.avg_mastery_pct}%</Text>
                          <View style={styles.kcBarBg}>
                            <View style={[styles.kcBarFill, { width: `${kc.avg_mastery_pct}%` }]} />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Student Performance Roster */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Student Performance Roster</Text>
                    {(analyticsData.student_roster || []).map((student: any, idx: number) => (
                      <View key={student.user_id} style={styles.rosterRow}>
                        <View style={styles.rosterRank}>
                          <Text style={styles.rosterRankText}>#{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rosterName}>{student.name}</Text>
                          <Text style={styles.rosterUser}>@{student.username} • {student.attempts_count} quizzes</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <Text style={styles.rosterStars}>⭐ {student.total_stars}</Text>
                          <Text style={styles.rosterAcc}>{student.avg_accuracy}% acc</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Edit Slides Modal */}
      {editingLesson && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={!!editingLesson}
          onRequestClose={() => setEditingLesson(null)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => setEditingLesson(null)}>
                <Ionicons name="close" size={24} color="#0284C7" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>Edit Slides & Images</Text>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {editingLesson.groupTitle} • {editingLesson.difficulty.toUpperCase()}
                </Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              {loadingEditingSlides ? (
                <ActivityIndicator size="large" color="#0284C7" style={{ marginTop: 40 }} />
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Slide Content & Visuals</Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                    Edit the text and upload/change illustrations for each slide of this lesson.
                  </Text>

                  {editingSlides.map((slide, idx) => (
                    <View key={idx} style={styles.slideCard}>
                      <View style={styles.slideHeader}>
                        <Text style={styles.slideNumber}>Slide {idx + 1}</Text>
                        {editingSlides.length > 1 && (
                          <TouchableOpacity onPress={() => handleRemoveEditSlide(idx)}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      <TextInput
                        style={[styles.input, { height: 75 }]}
                        placeholder={`Slide ${idx + 1} description text...`}
                        value={slide.description_text}
                        onChangeText={(txt) => handleEditSlideTextChange(txt, idx)}
                        multiline
                      />

                      {/* Image Preview / Upload */}
                      {slide.image_url ? (
                        <View style={styles.imagePreviewContainer}>
                          <Image source={{ uri: slide.image_url }} style={styles.slideImagePreview} resizeMode="contain" />
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                              style={styles.changeImgBtn}
                              onPress={() => pickEditSlideImage(idx)}
                            >
                              <Text style={styles.changeImgBtnText}>Change Image</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.changeImgBtn, { backgroundColor: '#FEE2E2' }]}
                              onPress={() => handleRemoveEditSlideImage(idx)}
                            >
                              <Text style={[styles.changeImgBtnText, { color: '#EF4444' }]}>Remove Image</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.uploadBtn}
                          onPress={() => pickEditSlideImage(idx)}
                        >
                          <Ionicons name="image-outline" size={20} color="#0284C7" />
                          <Text style={styles.uploadBtnText}>+ Add / Upload Image for Slide {idx + 1}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  <TouchableOpacity style={styles.addSlideBtn} onPress={handleAddEditSlide}>
                    <Ionicons name="add-circle-outline" size={20} color="#0284C7" />
                    <Text style={styles.addSlideBtnText}>Add Another Slide</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, savingEditingSlides && styles.submitBtnDisabled]}
                    onPress={handleSaveEditedSlides}
                    disabled={savingEditingSlides}
                  >
                    {savingEditingSlides ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.submitBtnText}>Save Slides & Images</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {/* Edit Quiz Questions Modal */}
      {editingQuiz && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={!!editingQuiz}
          onRequestClose={() => setEditingQuiz(null)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => setEditingQuiz(null)}>
                <Ionicons name="close" size={24} color="#0284C7" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>Edit Questions & Images</Text>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                  {editingQuiz.title} • {editingQuiz.difficulty.toUpperCase()}
                </Text>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              {loadingEditingQuiz ? (
                <ActivityIndicator size="large" color="#0284C7" style={{ marginTop: 40 }} />
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Quiz Questions Pool</Text>
                  <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                    Edit question prompts, correct answers, hints, and question illustrations.
                  </Text>

                  {editingQuizQuestions.map((q, idx) => (
                    <View key={idx} style={styles.slideCard}>
                      <View style={styles.slideHeader}>
                        <Text style={styles.slideNumber}>Question #{idx + 1}</Text>
                        <TouchableOpacity onPress={() => handleRemoveQuizQuestion(idx)}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.label}>Question Prompt:</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Question prompt text..."
                        value={q.question_text}
                        onChangeText={(txt) => handleEditQuizQuestionText(txt, idx)}
                      />

                      {/* Question Image */}
                      <Text style={styles.label}>Question Illustration / Visual (Optional):</Text>
                      {q.image_url ? (
                        <View style={styles.imagePreviewContainer}>
                          <Image
                            source={{ uri: q.image_url.startsWith('http') ? q.image_url : `${API_URL}${q.image_url}` }}
                            style={styles.slideImagePreview}
                            resizeMode="cover"
                          />
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                              style={styles.changeImgBtn}
                              onPress={() => pickQuizQuestionImage(idx)}
                            >
                              <Text style={styles.changeImgBtnText}>Change Image</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.changeImgBtn, { backgroundColor: '#FEE2E2' }]}
                              onPress={() => handleRemoveQuizQuestionImage(idx)}
                            >
                              <Text style={[styles.changeImgBtnText, { color: '#EF4444' }]}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.uploadBtn}
                          onPress={() => pickQuizQuestionImage(idx)}
                        >
                          <Ionicons name="image-outline" size={20} color="#0284C7" />
                          <Text style={styles.uploadBtnText}>Upload / Choose Image</Text>
                        </TouchableOpacity>
                      )}

                      {/* Hint */}
                      <Text style={[styles.label, { marginTop: 10 }]}>Hint (Optional):</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Hint text for 5-star student unlock..."
                        value={q.hint}
                        onChangeText={(txt) => handleEditQuizHint(txt, idx)}
                      />

                      {/* Options & Radio */}
                      <Text style={styles.label}>Answer Options (Select correct answer):</Text>
                      {q.options.map((opt: string, oIdx: number) => (
                        <View key={oIdx} style={styles.optionRow}>
                          <TouchableOpacity
                            style={[styles.radio, q.correct_option_index === oIdx && styles.radioActive]}
                            onPress={() => handleSetCorrectOption(idx, oIdx)}
                          >
                            {q.correct_option_index === oIdx && <View style={styles.radioInner} />}
                          </TouchableOpacity>
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                            value={opt}
                            onChangeText={(txt) => handleEditQuizOption(txt, idx, oIdx)}
                          />
                        </View>
                      ))}
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.addSlideBtn}
                    onPress={handleAddQuizQuestion}
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#0284C7" />
                    <Text style={styles.addSlideBtnText}>Add Another Question</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, savingEditingQuiz && styles.submitBtnDisabled]}
                    onPress={handleSaveQuizQuestions}
                    disabled={savingEditingQuiz}
                  >
                    {savingEditingQuiz ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.submitBtnText}>Save Questions & Images</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 16, backgroundColor: '#F8F9FA' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  topicBar: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  topicBarLabel: { fontSize: 14, fontWeight: '600', color: '#4B5563', marginRight: 10 },
  topicChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E5E7EB' },
  topicChipActive: { backgroundColor: '#0284C7' },
  topicChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  topicChipTextActive: { color: 'white', fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4 },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  tabButtonActive: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  tabButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabButtonTextActive: { color: '#0284C7' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1F2937', marginBottom: 14 },
  difficultyRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  diffChip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', backgroundColor: '#F3F4F6' },
  diffChip_easy: { backgroundColor: '#DCFCE7', borderColor: '#10B981' },
  diffChip_medium: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  diffChip_hard: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  diffChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  diffChipTextActive: { fontWeight: 'bold', color: '#111827' },
  slideCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  slideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  slideNumber: { fontSize: 13, fontWeight: 'bold', color: '#0284C7' },
  imagePreviewContainer: { marginTop: 8, alignItems: 'center' },
  slideImagePreview: { width: '100%', height: 140, borderRadius: 8, marginBottom: 6 },
  changeImgBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#E0F2FE', borderRadius: 6 },
  changeImgBtnText: { fontSize: 12, color: '#0284C7', fontWeight: '600' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginTop: 4 },
  uploadBtnText: { fontSize: 13, color: '#0284C7', fontWeight: '500' },
  addSlideBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#0284C7', borderStyle: 'dashed', marginBottom: 16 },
  addSlideBtnText: { color: '#0284C7', fontWeight: 'bold', fontSize: 14 },
  submitBtn: { backgroundColor: '#0284C7', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  emptyText: { color: '#6B7280', textAlign: 'center', marginVertical: 20 },
  groupCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  groupTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  groupSub: { fontSize: 12, color: '#6B7280' },
  tierContainer: { gap: 8 },
  tierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  tierName: { fontSize: 13, fontWeight: '600', width: 90 },
  tierInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierText: { fontSize: 12, color: '#4B5563' },
  warnBadge: { fontSize: 11, color: '#D97706', fontWeight: 'bold' },
  addTierBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#E0F2FE', borderRadius: 6 },
  addTierBtnText: { fontSize: 12, color: '#0284C7', fontWeight: 'bold' },
  editTierBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#E0F2FE', borderRadius: 6 },
  editTierBtnText: { fontSize: 12, color: '#0284C7', fontWeight: '600' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: '#10B981' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981' },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  kpiVal: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginTop: 4 },
  kpiLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  topicPerfCard: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topicPerfTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  topicPerfStats: { fontSize: 13, color: '#4B5563' },
  weakKcRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  weakKcName: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  weakKcSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  weakKcPct: { fontSize: 12, fontWeight: 'bold', color: '#0D9488', marginBottom: 3 },
  kcBarBg: { width: 100, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 },
  kcBarFill: { height: '100%', backgroundColor: '#0D9488', borderRadius: 3 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rosterRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0F2FE', justifyContent: 'center', alignItems: 'center' },
  rosterRankText: { fontSize: 12, fontWeight: 'bold', color: '#0284C7' },
  rosterName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  rosterUser: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  rosterStars: { fontSize: 13, fontWeight: 'bold', color: '#1F2937' },
  rosterAcc: { fontSize: 11, color: '#10B981', fontWeight: '600' },
});
