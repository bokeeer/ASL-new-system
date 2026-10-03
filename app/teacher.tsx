import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../context/config';
import { useAuth } from '../context/AuthContext';

interface Slide {
  description_text: string;
  image_url?: string;
}

interface MatchingPair {
  left: string;
  right: string;
}

interface Question {
  id?: number;
  question_text: string;
  question_type: string;
  image_url?: string;
  options: string[];
  correct_option_index: number;
  matching_pairs?: MatchingPair[];
  hint?: string;
}

interface Lesson {
  id: number;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lesson_group_id?: number;
  slides?: Slide[];
  slide_count?: number;
  quiz_id?: number | null;
  quiz_question_count?: number;
}

interface LessonGroup {
  id: number;
  topic_id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
}

export default function TeacherDashboardScreen() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'current' | 'lessons' | 'quizzes' | 'analytics'>('current');
  const [selectedTopicId, setSelectedTopicId] = useState('story-grammar');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Lessons State
  const [lessonGroups, setLessonGroups] = useState<LessonGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [lessonGroupName, setLessonGroupName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [descriptions, setDescriptions] = useState<Slide[]>([{ description_text: '', image_url: '' }]);
  const [submittingLesson, setSubmittingLesson] = useState(false);

  // Edit Lesson Slides Modal
  const [editingLesson, setEditingLesson] = useState<{ id: number; groupTitle: string; difficulty: string } | null>(null);
  const [editSlides, setEditSlides] = useState<Slide[]>([]);
  const [savingEditSlides, setSavingEditSlides] = useState(false);

  // Edit Quiz Modal
  const [editingQuiz, setEditingQuiz] = useState<{ id: number; title: string; difficulty: string } | null>(null);
  const [editQuizQuestions, setEditQuizQuestions] = useState<Question[]>([]);
  const [loadingQuizQuestions, setLoadingQuizQuestions] = useState(false);
  const [savingEditQuiz, setSavingEditQuiz] = useState(false);

  // Trash & History State
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [loadingTrash, setLoadingTrash] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quizzes State
  const [selectedLessonGroupId, setSelectedLessonGroupId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [selectedQuizDifficulty, setSelectedQuizDifficulty] = useState<string>('easy');
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: '',
      question_type: 'descriptive',
      image_url: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      matching_pairs: [{ left: '', right: '' }],
      hint: '',
    },
  ]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [existingQuizzes, setExistingQuizzes] = useState<any[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const topics = [
    { id: 'story-grammar', name: 'Story Grammar', icon: 'book-outline' as const },
    { id: 'mathematics', name: 'Mathematics', icon: 'calculator-outline' as const },
    { id: 'technology-and-livelihood-education', name: 'TLE (ICT)', icon: 'hardware-chip-outline' as const },
    { id: 'araling-panlipunan', name: 'Araling Panlipunan', icon: 'globe-outline' as const },
  ];

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  // Fetch Lesson Groups
  const fetchLessonGroups = useCallback(async (topicId: string) => {
    setLoadingGroups(true);
    try {
      const res = await fetch(`${API_URL}/admin/lesson-groups/${topicId}`);
      if (!res.ok) throw new Error('Failed to fetch lesson groups');
      const data = await res.json();
      setLessonGroups(data);
    } catch {
      // Offline fallback
      setLessonGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  // Fetch Existing Quizzes
  const fetchQuizzes = useCallback(async (topicId: string) => {
    setLoadingQuizzes(true);
    try {
      const res = await fetch(`${API_URL}/quizzes/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        setExistingQuizzes(Array.isArray(data) ? data : []);
      }
    } catch {
      setExistingQuizzes([]);
    } finally {
      setLoadingQuizzes(false);
    }
  }, []);

  // Fetch Trash
  const fetchTrash = useCallback(async () => {
    setLoadingTrash(true);
    try {
      const res = await fetch(`${API_URL}/admin/trash`);
      if (res.ok) {
        const data = await res.json();
        setTrashItems(data.trash || []);
        setTrashCount(data.total_count || 0);
      }
    } catch {
      setTrashItems([]);
      setTrashCount(0);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/admin/teacher-history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data.history || []);
      }
    } catch {
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`${API_URL}/admin/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch {
      setAnalyticsData(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    fetchLessonGroups(selectedTopicId);
    fetchQuizzes(selectedTopicId);
    fetchTrash();
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [selectedTopicId, activeTab, fetchLessonGroups, fetchQuizzes, fetchTrash, fetchAnalytics]);

  // Image Upload helper
  const pickAndUploadImage = async (onSuccess: (url: string) => void) => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      showAlert('Permission Required', 'Camera roll permission is needed to select an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const uri = result.assets[0].uri;
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

        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        onSuccess(data.url);
      } catch (err: any) {
        showAlert('Upload Error', err.message || 'Could not upload image.');
      }
    }
  };

  // Submit Lesson
  const handleSubmitLesson = async () => {
    if (!lessonGroupName.trim()) {
      showAlert('Required Field', 'Please enter a Lesson Group title.');
      return;
    }
    const validSlides = descriptions.filter((d) => d.description_text.trim() !== '');
    if (validSlides.length === 0) {
      showAlert('Required Field', 'Please add text for at least one slide.');
      return;
    }

    setSubmittingLesson(true);
    try {
      let groupId: number | null = null;
      const existingGroup = lessonGroups.find(
        (g) => g.title.toLowerCase().trim() === lessonGroupName.toLowerCase().trim()
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
        if (!groupRes.ok) throw new Error('Failed to create lesson group');
        const groupData = await groupRes.json();
        groupId = groupData.lesson_group.id;
      }

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
        showAlert('Duplicate Tier', `A ${difficulty.toUpperCase()} tier already exists for "${lessonGroupName}". Select a different tier.`);
        return;
      }

      if (!res.ok) throw new Error('Failed to save lesson');

      showAlert('Success', `${difficulty.toUpperCase()} lesson saved successfully.`);
      setLessonGroupName('');
      setDescriptions([{ description_text: '', image_url: '' }]);
      fetchLessonGroups(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to submit lesson.');
    } finally {
      setSubmittingLesson(false);
    }
  };

  // Delete Lesson Group (Move to Trash)
  const handleDeleteGroup = async (groupId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Move "${title}" and all its difficulty tiers to Trash?`)
      : true;
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/lesson-group/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Moved to Trash', `Lesson group "${title}" was moved to Trash.`);
        fetchLessonGroups(selectedTopicId);
        fetchTrash();
        fetchHistory();
      }
    } catch {
      showAlert('Error', 'Could not move lesson group to trash.');
    }
  };

  // Delete Individual Lesson Tier (Move to Trash)
  const handleDeleteLesson = async (lessonId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Move "${title}" to Trash?`)
      : true;
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/lesson/${lessonId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Moved to Trash', `Lesson "${title}" was moved to Trash.`);
        fetchLessonGroups(selectedTopicId);
        fetchTrash();
        fetchHistory();
      } else {
        showAlert('Error', 'Could not delete lesson.');
      }
    } catch {
      showAlert('Error', 'Could not delete lesson.');
    }
  };

  // Delete Quiz (Move to Trash)
  const handleDeleteQuiz = async (quizId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Move quiz "${title}" to Trash? This will allow you to create a new quiz for this lesson difficulty.`)
      : true;
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/quiz/${quizId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Moved to Trash', `Quiz "${title}" was moved to Trash.`);
        fetchLessonGroups(selectedTopicId);
        fetchQuizzes(selectedTopicId);
        fetchTrash();
        fetchHistory();
      } else {
        showAlert('Error', 'Could not delete quiz.');
      }
    } catch {
      showAlert('Error', 'Could not delete quiz.');
    }
  };

  // Slide Editor Handlers
  const handleOpenEditSlides = (lesson: Lesson, groupTitle: string) => {
    setEditingLesson({ id: lesson.id, groupTitle, difficulty: lesson.difficulty });
    setEditSlides((lesson.slides && lesson.slides.length > 0) ? JSON.parse(JSON.stringify(lesson.slides)) : [{ description_text: '', image_url: '' }]);
  };

  const handleSaveEditSlides = async () => {
    if (!editingLesson) return;
    const valid = editSlides.filter(s => s.description_text.trim() !== '');
    if (valid.length === 0) {
      showAlert('Required', 'At least one slide with text is required.');
      return;
    }
    setSavingEditSlides(true);
    try {
      const res = await fetch(`${API_URL}/admin/lesson/${editingLesson.id}/slides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: valid }),
      });
      if (!res.ok) throw new Error('Failed to update slides.');
      showAlert('Success', 'Lesson slides updated successfully.');
      setEditingLesson(null);
      fetchLessonGroups(selectedTopicId);
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not update slides.');
    } finally {
      setSavingEditSlides(false);
    }
  };

  // Quiz Editor Handlers
  const handleOpenEditQuiz = async (quizId: number, groupTitle: string, difficulty: string) => {
    setEditingQuiz({ id: quizId, title: `${groupTitle} Quiz (${difficulty.toUpperCase()})`, difficulty });
    setLoadingQuizQuestions(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/${quizId}/questions`);
      if (!res.ok) throw new Error('Failed to fetch questions.');
      const data = await res.json();
      setEditQuizQuestions(Array.isArray(data) ? data : []);
    } catch {
      showAlert('Error', 'Could not load quiz questions.');
      setEditingQuiz(null);
    } finally {
      setLoadingQuizQuestions(false);
    }
  };

  const handleSaveEditQuiz = async () => {
    if (!editingQuiz) return;
    const valid = editQuizQuestions.filter(q => q.question_text.trim() !== '');
    if (valid.length === 0) {
      showAlert('Required', 'At least one question is required.');
      return;
    }
    setSavingEditQuiz(true);
    try {
      const res = await fetch(`${API_URL}/admin/quiz/${editingQuiz.id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: valid }),
      });
      if (!res.ok) throw new Error('Failed to update quiz questions.');
      showAlert('Success', 'Quiz updated successfully.');
      setEditingQuiz(null);
      fetchLessonGroups(selectedTopicId);
      fetchQuizzes(selectedTopicId);
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not update quiz.');
    } finally {
      setSavingEditQuiz(false);
    }
  };

  // Trash Handlers
  const handleRestoreItem = async (itemType: string, itemId: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/trash/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          teacher_name: user?.name || user?.username || 'Teacher',
        }),
      });
      if (!res.ok) throw new Error('Failed to restore item.');
      showAlert('Restored', 'Item restored to active curriculum.');
      fetchTrash();
      fetchLessonGroups(selectedTopicId);
      fetchQuizzes(selectedTopicId);
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not restore item.');
    }
  };

  const handlePermanentDeleteItem = async (itemType: string, itemId: number, title: string) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Permanently delete "${title}"? This cannot be undone.`)
      : true;
    if (!confirm) return;

    try {
      const res = await fetch(`${API_URL}/admin/trash/permanent`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          teacher_name: user?.name || user?.username || 'Teacher',
        }),
      });
      if (!res.ok) throw new Error('Failed to permanently delete item.');
      showAlert('Deleted', 'Item permanently removed.');
      fetchTrash();
      fetchHistory();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not delete item permanently.');
    }
  };

  // Active selected lesson group for quiz creation
  const activeGroup = (selectedLessonGroupId !== null
    ? lessonGroups.find((g) => g.id === selectedLessonGroupId)
    : lessonGroups[0]) || null;

  // Selected lesson object and whether it already has a quiz
  const selectedLessonObj = (selectedLessonId
    ? activeGroup?.lessons?.find((l) => l.id === selectedLessonId)
    : activeGroup?.lessons?.find((l) => l.difficulty === selectedQuizDifficulty)) || null;
  const selectedLessonHasQuiz = Boolean(selectedLessonObj?.quiz_id);

  // Submit Quiz (Automatic KC linking)
  const handleSubmitQuiz = async () => {
    if (selectedLessonHasQuiz) {
      showAlert('Quiz Already Exists', `A quiz has already been created for the ${selectedQuizDifficulty.toUpperCase()} tier.`);
      return;
    }
    if (!quizTitle.trim()) {
      showAlert('Required Field', 'Please enter a Quiz Title.');
      return;
    }
    if (!selectedLessonId) {
      showAlert('Required Field', 'Please select a Lesson for this quiz.');
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

      if (!res.ok) throw new Error('Failed to create quiz.');

      showAlert('Success', 'Quiz created and linked successfully.');
      setQuizTitle('');
      setQuestions([
        {
          question_text: '',
          question_type: 'descriptive',
          image_url: '',
          options: ['', '', '', ''],
          correct_option_index: 0,
          matching_pairs: [{ left: '', right: '' }],
          hint: '',
        },
      ]);
      fetchLessonGroups(selectedTopicId);
      fetchQuizzes(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not create quiz.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // Auto-sync selected lesson when activeGroup changes
  useEffect(() => {
    if (activeGroup && activeGroup.lessons && activeGroup.lessons.length > 0) {
      const match = activeGroup.lessons.find((l) => l.difficulty === selectedQuizDifficulty) || activeGroup.lessons[0];
      setSelectedLessonId(match.id);
      setSelectedQuizDifficulty(match.difficulty);
    } else if (!activeGroup || !activeGroup.lessons || activeGroup.lessons.length === 0) {
      setSelectedLessonId(null);
    }
  }, [activeGroup?.id]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Workspace Body: Sidebar + Main Content */}
        <View style={styles.workspaceBody}>
          {/* Collapsible Subject Sidebar */}
          <View style={[styles.sidebar, sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded]}>
            {/* Sidebar Top: Teacher Workspace Branding & Minimize Arrow */}
            <View style={[styles.sidebarBrandHeader, sidebarCollapsed && styles.sidebarBrandHeaderCollapsed]}>
              {!sidebarCollapsed ? (
                <>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.sidebarBrandTitle}>Teacher Workspace</Text>
                    <Text style={styles.sidebarBrandSubtitle} numberOfLines={1}>
                      {user?.name || 'Educator'} ({user?.username})
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sidebarToggleBtn}
                    onPress={() => setSidebarCollapsed(true)}
                  >
                    <Ionicons name="chevron-back-outline" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.sidebarToggleBtnCollapsed}
                  onPress={() => setSidebarCollapsed(false)}
                >
                  <Ionicons name="chevron-forward-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Subject Navigations */}
            <ScrollView style={styles.sidebarNavList} showsVerticalScrollIndicator={false}>
              {topics.map((t) => {
                const isSelected = selectedTopicId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.sidebarItem,
                      sidebarCollapsed && styles.sidebarItemCollapsed,
                      isSelected && (sidebarCollapsed ? styles.sidebarItemCollapsedActive : styles.sidebarItemActive),
                    ]}
                    onPress={() => setSelectedTopicId(t.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sidebarItemIconBox, isSelected && styles.sidebarItemIconBoxActive]}>
                      <Ionicons
                        name={t.icon}
                        size={18}
                        color={isSelected ? '#FFFFFF' : '#64748B'}
                      />
                    </View>
                    {!sidebarCollapsed && (
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.sidebarItemText, isSelected && styles.sidebarItemTextActive]}
                          numberOfLines={1}
                        >
                          {t.name}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sidebar Bottom: History, Trash, Log Out */}
            {!sidebarCollapsed ? (
              <View style={styles.sidebarFooter}>
                <TouchableOpacity
                  style={styles.sidebarActionBtn}
                  onPress={() => {
                    fetchHistory();
                    setShowHistoryModal(true);
                  }}
                >
                  <Ionicons name="time-outline" size={16} color="#475569" />
                  <Text style={styles.sidebarActionBtnText}>Teacher History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarActionBtn}
                  onPress={() => {
                    fetchTrash();
                    setShowTrashModal(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                    <Ionicons name="trash-bin-outline" size={16} color="#475569" />
                    <Text style={styles.sidebarActionBtnText}>Trash Bin</Text>
                  </View>
                  {trashCount > 0 && (
                    <View style={styles.sidebarTrashBadge}>
                      <Text style={styles.sidebarTrashBadgeText}>{trashCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.sidebarFooterDivider} />

                <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={16} color="#DC2626" />
                  <Text style={styles.sidebarLogoutBtnText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.sidebarFooterCollapsed}>
                <TouchableOpacity
                  style={styles.sidebarActionBtnCollapsed}
                  onPress={() => {
                    fetchHistory();
                    setShowHistoryModal(true);
                  }}
                >
                  <Ionicons name="time-outline" size={18} color="#475569" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sidebarActionBtnCollapsed}
                  onPress={() => {
                    fetchTrash();
                    setShowTrashModal(true);
                  }}
                >
                  <Ionicons name="trash-bin-outline" size={18} color="#475569" />
                  {trashCount > 0 && <View style={styles.sidebarTrashBadgeDot} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.sidebarLogoutBtnCollapsed} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Main Workspace Body */}
          <View style={styles.mainArea}>
            {/* Navigation Tabs (Subject header removed for maximum workspace) */}
            <View style={styles.mainHeaderStrip}>
              <View style={styles.tabBar}>
                {[
                  { id: 'current' as const, label: 'Current Lessons', icon: 'layers-outline' as const },
                  { id: 'lessons' as const, label: 'Create Lesson', icon: 'add-circle-outline' as const },
                  { id: 'quizzes' as const, label: 'Create Quiz', icon: 'help-circle-outline' as const },
                  { id: 'analytics' as const, label: 'Class Analytics', icon: 'bar-chart-outline' as const },
                ].map((tab) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
                    onPress={() => setActiveTab(tab.id)}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={18}
                      color={activeTab === tab.id ? '#2563EB' : '#64748B'}
                      style={{ marginBottom: 4 }}
                    />
                    <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Content Area */}
            <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* TAB 1: CURRENT LESSONS & QUIZZES HUB */}
          {activeTab === 'current' && (
            <View>
              {/* Header Bar */}
              <View style={styles.curriculumTopCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.curriculumTopTitle}>
                    {topics.find((t) => t.id === selectedTopicId)?.name || 'Subject'} Curriculum
                  </Text>
                  <Text style={styles.curriculumTopSubtitle}>
                    Manage stories, difficulty tiers, slides, and attached quizzes in one place.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => {
                    fetchLessonGroups(selectedTopicId);
                    fetchQuizzes(selectedTopicId);
                  }}
                >
                  <Ionicons name="refresh-outline" size={16} color="#2563EB" />
                  <Text style={styles.refreshBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              {loadingGroups ? (
                <ActivityIndicator color="#2563EB" size="large" style={{ marginVertical: 30 }} />
              ) : lessonGroups.length === 0 ? (
                <View style={styles.card}>
                  <View style={styles.emptyStateContainer}>
                    <Ionicons name="book-outline" size={44} color="#94A3B8" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyStateTitle}>No Lessons Created Yet</Text>
                    <Text style={styles.emptyStateText}>
                      Get started by adding your first story and difficulty slides.
                    </Text>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { marginTop: 14, alignSelf: 'center', paddingHorizontal: 24 }]}
                      onPress={() => setActiveTab('lessons')}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryBtnText}>Create First Lesson</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                lessonGroups.map((group) => {
                  const tiers = ['easy', 'medium', 'hard'] as const;
                  const availableTiers = tiers.filter((t) => (group.lessons || []).some((l) => l.difficulty === t));

                  return (
                    <View key={group.id} style={styles.curriculumStoryCard}>
                      {/* Story Card Header */}
                      <View style={styles.storyCardHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="book" size={18} color="#2563EB" />
                            <Text style={styles.storyCardTitle}>{group.title}</Text>
                          </View>
                          <Text style={styles.storyCardSub}>
                            {availableTiers.length} of 3 tiers created ({availableTiers.map((t) => t.toUpperCase()).join(', ') || 'None'})
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.storyDeleteBtn}
                          onPress={() => handleDeleteGroup(group.id, group.title)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          <Text style={styles.storyDeleteBtnText}>Trash Story</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Tier Cards List */}
                      <View style={styles.storyTiersContainer}>
                        {tiers.map((tier) => {
                          const tierLesson = (group.lessons || []).find((l) => l.difficulty === tier);
                          const slideCount = tierLesson ? (tierLesson.slide_count ?? tierLesson.slides?.length ?? 0) : 0;
                          const hasQuiz = Boolean(tierLesson?.quiz_id);
                          const quizQuestionsCount = tierLesson?.quiz_question_count || 0;

                          if (tierLesson) {
                            return (
                              <View key={tier} style={styles.tierCardActive}>
                                <View style={styles.tierCardRow}>
                                  {/* Difficulty Badge */}
                                  <View
                                    style={[
                                      styles.tierBadge,
                                      tier === 'easy' && styles.tierBadgeEasy,
                                      tier === 'medium' && styles.tierBadgeMedium,
                                      tier === 'hard' && styles.tierBadgeHard,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.tierBadgeText,
                                        tier === 'easy' && styles.tierBadgeTextEasy,
                                        tier === 'medium' && styles.tierBadgeTextMedium,
                                        tier === 'hard' && styles.tierBadgeTextHard,
                                      ]}
                                    >
                                      {tier.toUpperCase()}
                                    </Text>
                                  </View>

                                  {/* Slide Info & Edit Slides Button */}
                                  <View style={styles.tierSection}>
                                    <View style={styles.tierInfoRow}>
                                      <Ionicons name="images-outline" size={15} color="#475569" />
                                      <Text style={styles.tierInfoText}>
                                        {slideCount} {slideCount === 1 ? 'Slide' : 'Slides'}
                                      </Text>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.actionBtnSecondary}
                                      onPress={() => handleOpenEditSlides(tierLesson, group.title)}
                                    >
                                      <Ionicons name="create-outline" size={14} color="#2563EB" />
                                      <Text style={styles.actionBtnSecondaryText}>Edit Slides</Text>
                                    </TouchableOpacity>
                                  </View>

                                  {/* Attached Quiz Info */}
                                  <View style={styles.tierSection}>
                                    <View style={styles.tierInfoRow}>
                                      <Ionicons
                                        name={hasQuiz ? 'help-circle' : 'alert-circle-outline'}
                                        size={15}
                                        color={hasQuiz ? '#059669' : '#D97706'}
                                      />
                                      <Text style={hasQuiz ? styles.tierInfoTextSuccess : styles.tierInfoTextWarning}>
                                        {hasQuiz ? `Quiz Attached (${quizQuestionsCount}Q)` : 'No quiz attached'}
                                      </Text>
                                    </View>
                                  </View>

                                  {/* Right side: Edit Quiz and Delete Quiz Actions (replaced gray trash) */}
                                  <View style={styles.tierActionsRight}>
                                    {hasQuiz ? (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <TouchableOpacity
                                          style={styles.actionBtnSuccess}
                                          onPress={() => handleOpenEditQuiz(tierLesson.quiz_id!, group.title, tier)}
                                        >
                                          <Ionicons name="pencil-outline" size={13} color="#059669" />
                                          <Text style={styles.actionBtnSuccessText}>Edit Quiz</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={styles.actionBtnDangerSmall}
                                          onPress={() => handleDeleteQuiz(tierLesson.quiz_id!, `${group.title} (${tier.toUpperCase()}) Quiz`)}
                                        >
                                          <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        </TouchableOpacity>
                                      </View>
                                    ) : (
                                      <TouchableOpacity
                                        style={styles.actionBtnAmber}
                                        onPress={() => {
                                          setSelectedLessonGroupId(group.id);
                                          setSelectedLessonId(tierLesson.id);
                                          setSelectedQuizDifficulty(tier);
                                          setQuizTitle(`${group.title} (${tier.toUpperCase()}) Quiz`);
                                          setActiveTab('quizzes');
                                        }}
                                      >
                                        <Ionicons name="add-outline" size={14} color="#B45309" />
                                        <Text style={styles.actionBtnAmberText}>+ Add Quiz</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </View>
                              </View>
                            );
                          }

                          {/* Missing Tier Row */}
                          return (
                            <View key={tier} style={styles.tierCardMissing}>
                              <View style={styles.tierBadgeMissing}>
                                <Text style={styles.tierBadgeTextMissing}>{tier.toUpperCase()}</Text>
                              </View>
                              <Text style={styles.tierMissingText}>Tier not created yet</Text>
                              <TouchableOpacity
                                style={styles.tierCreateBtn}
                                onPress={() => {
                                  setLessonGroupName(group.title);
                                  setDifficulty(tier);
                                  setActiveTab('lessons');
                                }}
                              >
                                <Ionicons name="add-circle-outline" size={14} color="#2563EB" />
                                <Text style={styles.tierCreateBtnText}>Create {tier.toUpperCase()}</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 2: CREATE LESSON & SLIDES */}
          {activeTab === 'lessons' && (
            <View>
              {/* Create Lesson Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Add Lesson or Difficulty Tier</Text>
                <Text style={styles.cardHelp}>
                  Create reading and visual slides for students. Knowledge components and mastery targets are generated automatically.
                </Text>

                <Text style={styles.fieldLabel}>Lesson Group Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. The Lost Puppy"
                  value={lessonGroupName}
                  onChangeText={setLessonGroupName}
                />

                <Text style={styles.fieldLabel}>Select Difficulty Tier</Text>
                <View style={styles.tierRow}>
                  {(['easy', 'medium', 'hard'] as const).map((tier) => (
                    <TouchableOpacity
                      key={tier}
                      style={[styles.tierBtn, difficulty === tier && styles.tierBtnActive]}
                      onPress={() => setDifficulty(tier)}
                    >
                      <Text style={[styles.tierBtnText, difficulty === tier && styles.tierBtnTextActive]}>
                        {tier.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Slides Section */}
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                  Lesson Slides ({descriptions.length})
                </Text>

                {descriptions.map((desc, idx) => (
                  <View key={idx} style={styles.slideBox}>
                    <View style={styles.slideHeader}>
                      <Text style={styles.slideNumber}>Slide {idx + 1}</Text>
                      {descriptions.length > 1 && (
                        <TouchableOpacity
                          onPress={() => setDescriptions(descriptions.filter((_, i) => i !== idx))}
                        >
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Enter slide reading or story text..."
                      value={desc.description_text}
                      onChangeText={(txt) => {
                        const updated = [...descriptions];
                        updated[idx].description_text = txt;
                        setDescriptions(updated);
                      }}
                      multiline
                    />

                    {desc.image_url ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: desc.image_url }} style={styles.slidePreviewImg} resizeMode="cover" />
                        <TouchableOpacity
                          style={styles.removeImgBtn}
                          onPress={() => {
                            const updated = [...descriptions];
                            updated[idx].image_url = '';
                            setDescriptions(updated);
                          }}
                        >
                          <Ionicons name="close-circle" size={20} color="#DC2626" />
                          <Text style={styles.removeImgText}>Remove Image</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() =>
                          pickAndUploadImage((url) => {
                            const updated = [...descriptions];
                            updated[idx].image_url = url;
                            setDescriptions(updated);
                          })
                        }
                      >
                        <Ionicons name="image-outline" size={18} color="#2563EB" />
                        <Text style={styles.uploadBtnText}>Upload Slide Image</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addSlideBtn}
                  onPress={() => setDescriptions([...descriptions, { description_text: '', image_url: '' }])}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                  <Text style={styles.addSlideBtnText}>Add Another Slide</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, submittingLesson && styles.primaryBtnDisabled]}
                  onPress={handleSubmitLesson}
                  disabled={submittingLesson}
                >
                  {submittingLesson ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save Lesson</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.viewCurriculumLinkBtn}
                onPress={() => setActiveTab('current')}
              >
                <Ionicons name="layers-outline" size={16} color="#2563EB" />
                <Text style={styles.viewCurriculumLinkText}>View All Current Lessons & Attached Quizzes</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 2: QUIZZES & QUESTIONS */}
          {activeTab === 'quizzes' && (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create Quiz for Lesson</Text>
                <Text style={styles.cardHelp}>
                  Build assessment questions. Questions are automatically linked to the lesson knowledge component.
                </Text>

                {/* 1. Target Lesson Story Selection */}
                <Text style={styles.fieldLabel}>Select Story / Lesson</Text>
                {lessonGroups.length === 0 ? (
                  <Text style={styles.emptyText}>Create a lesson first before creating a quiz.</Text>
                ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {lessonGroups.map((g) => {
                        const isGroupActive = activeGroup?.id === g.id;
                        const lessonCount = g.lessons?.length || 0;
                        return (
                          <TouchableOpacity
                            key={g.id}
                            style={[styles.lessonGroupChip, isGroupActive && styles.lessonGroupChipActive]}
                            onPress={() => {
                              setSelectedLessonGroupId(g.id);
                              const match = g.lessons?.find((l) => l.difficulty === selectedQuizDifficulty) || (g.lessons && g.lessons[0]);
                              if (match) {
                                setSelectedLessonId(match.id);
                                setSelectedQuizDifficulty(match.difficulty);
                              } else {
                                setSelectedLessonId(null);
                              }
                            }}
                          >
                            <Ionicons
                              name="book-outline"
                              size={15}
                              color={isGroupActive ? '#FFFFFF' : '#2563EB'}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.lessonGroupChipText, isGroupActive && styles.lessonGroupChipTextActive]}>
                              {g.title}
                            </Text>
                            <View style={[styles.tierCountBadge, isGroupActive && styles.tierCountBadgeActive]}>
                              <Text style={[styles.tierCountText, isGroupActive && styles.tierCountTextActive]}>
                                {lessonCount} {lessonCount === 1 ? 'tier' : 'tiers'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* 2. Difficulty Tier Selector for the chosen Story */}
                    {activeGroup && (
                      <View style={styles.tierSelectionContainer}>
                        <Text style={styles.subFieldLabel}>
                          Select Difficulty Tier for "{activeGroup.title}":
                        </Text>
                        <View style={styles.tierRow}>
                          {(['easy', 'medium', 'hard'] as const).map((tier) => {
                            const tierLesson = activeGroup.lessons?.find((l) => l.difficulty === tier);
                            const isAvailable = Boolean(tierLesson);
                            const isSelected = isAvailable && (selectedLessonId === tierLesson?.id || selectedQuizDifficulty === tier);
                            const hasQuiz = Boolean(tierLesson?.quiz_id);
                            const slideCount = tierLesson ? (tierLesson.slide_count ?? tierLesson.slides?.length ?? 0) : 0;

                            return (
                              <TouchableOpacity
                                key={tier}
                                style={[
                                  styles.quizTierBtn,
                                  hasQuiz && styles.quizTierBtnHasQuiz,
                                  isSelected && (hasQuiz ? styles.quizTierBtnHasQuizActive : styles.quizTierBtnActive),
                                  !isAvailable && styles.quizTierBtnDisabled,
                                ]}
                                disabled={!isAvailable}
                                onPress={() => {
                                  if (tierLesson) {
                                    setSelectedLessonId(tierLesson.id);
                                    setSelectedQuizDifficulty(tier);
                                  }
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Ionicons
                                    name={
                                      hasQuiz
                                        ? 'checkmark-circle'
                                        : isSelected
                                        ? 'checkmark-circle'
                                        : isAvailable
                                        ? 'radio-button-off'
                                        : 'close-circle-outline'
                                    }
                                    size={15}
                                    color={
                                      isSelected
                                        ? '#FFFFFF'
                                        : hasQuiz
                                        ? '#D97706'
                                        : isAvailable
                                        ? '#475569'
                                        : '#94A3B8'
                                    }
                                  />
                                  <Text
                                    style={[
                                      styles.quizTierBtnText,
                                      hasQuiz && styles.quizTierBtnTextHasQuiz,
                                      isSelected && (hasQuiz ? styles.quizTierBtnTextHasQuizActive : styles.quizTierBtnTextActive),
                                      !isAvailable && styles.quizTierBtnTextDisabled,
                                    ]}
                                  >
                                    {tier.toUpperCase()}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.quizTierSubtext,
                                    hasQuiz && styles.quizTierSubtextHasQuiz,
                                    isSelected && (hasQuiz ? styles.quizTierSubtextHasQuizActive : styles.quizTierSubtextActive),
                                    !isAvailable && styles.quizTierSubtextDisabled,
                                  ]}
                                >
                                  {isAvailable
                                    ? `${slideCount} slides${hasQuiz ? ` • Quiz exists (${tierLesson?.quiz_question_count || 0}Q)` : ' • No quiz yet'}`
                                    : 'Not created yet'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        {selectedLessonHasQuiz && (
                          <View style={styles.quizExistsAlert}>
                            <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.quizExistsAlertTitle}>
                                Quiz Already Exists for {selectedQuizDifficulty.toUpperCase()} Tier
                              </Text>
                              <Text style={styles.quizExistsAlertText}>
                                A quiz has already been created for this difficulty with {selectedLessonObj?.quiz_question_count || 0} questions. Creating duplicate quizzes for this tier is disabled.
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

                <Text style={styles.fieldLabel}>Quiz Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. The Lost Puppy Comprehension Check"
                  value={quizTitle}
                  onChangeText={setQuizTitle}
                />

                {/* Questions Section */}
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                  Questions Pool ({questions.length})
                </Text>

                {questions.map((q, qIdx) => (
                  <View key={qIdx} style={styles.questionBox}>
                    <View style={styles.questionBoxHeader}>
                      <Text style={styles.slideNumber}>Question {qIdx + 1}</Text>
                      {questions.length > 1 && (
                        <TouchableOpacity onPress={() => setQuestions(questions.filter((_, i) => i !== qIdx))}>
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Question Type Toggle */}
                    <View style={styles.typeToggleRow}>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type !== 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...questions];
                          updated[qIdx].question_type = 'descriptive';
                          setQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type !== 'matching' && styles.typeBtnTextActive]}>
                          Multiple Choice
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type === 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...questions];
                          updated[qIdx].question_type = 'matching';
                          if (!updated[qIdx].matching_pairs || updated[qIdx].matching_pairs!.length === 0) {
                            updated[qIdx].matching_pairs = [{ left: '', right: '' }];
                          }
                          setQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type === 'matching' && styles.typeBtnTextActive]}>
                          Matching Pairs
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Type the question statement here..."
                      value={q.question_text}
                      onChangeText={(txt) => {
                        const updated = [...questions];
                        updated[qIdx].question_text = txt;
                        setQuestions(updated);
                      }}
                      multiline
                    />

                    {/* Multiple Choice Options */}
                    {q.question_type !== 'matching' && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Choices (Select radio button for the correct answer):</Text>
                        {q.options.map((opt, optIdx) => (
                          <View key={optIdx} style={styles.optionRow}>
                            <TouchableOpacity
                              style={[styles.radio, q.correct_option_index === optIdx && styles.radioActive]}
                              onPress={() => {
                                const updated = [...questions];
                                updated[qIdx].correct_option_index = optIdx;
                                setQuestions(updated);
                              }}
                            >
                              {q.correct_option_index === optIdx && <View style={styles.radioInner} />}
                            </TouchableOpacity>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              value={opt}
                              onChangeText={(txt) => {
                                const updated = [...questions];
                                updated[qIdx].options[optIdx] = txt;
                                setQuestions(updated);
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Matching Pairs */}
                    {q.question_type === 'matching' && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Matching Pairs (Left Item matches Right Item):</Text>
                        {(q.matching_pairs || []).map((pair, pIdx) => (
                          <View key={pIdx} style={styles.matchingRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Left ${pIdx + 1}`}
                              value={pair.left}
                              onChangeText={(txt) => {
                                const updated = [...questions];
                                updated[qIdx].matching_pairs![pIdx].left = txt;
                                setQuestions(updated);
                              }}
                            />
                            <Ionicons name="arrow-forward" size={16} color="#64748B" style={{ marginHorizontal: 6 }} />
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Right ${pIdx + 1}`}
                              value={pair.right}
                              onChangeText={(txt) => {
                                const updated = [...questions];
                                updated[qIdx].matching_pairs![pIdx].right = txt;
                                setQuestions(updated);
                              }}
                            />
                            {(q.matching_pairs || []).length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  const updated = [...questions];
                                  updated[qIdx].matching_pairs = updated[qIdx].matching_pairs!.filter((_, i) => i !== pIdx);
                                  setQuestions(updated);
                                }}
                                style={{ marginLeft: 6 }}
                              >
                                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.addPairBtn}
                          onPress={() => {
                            const updated = [...questions];
                            updated[qIdx].matching_pairs = [...(updated[qIdx].matching_pairs || []), { left: '', right: '' }];
                            setQuestions(updated);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#2563EB" />
                          <Text style={styles.addPairBtnText}>Add Matching Pair</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Visual Hint / Explanation */}
                    <Text style={[styles.subFieldLabel, { marginTop: 10 }]}>Visual Hint / Scaffolding Note (Optional):</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Look at the dog's collar in slide 2"
                      value={q.hint || ''}
                      onChangeText={(txt) => {
                        const updated = [...questions];
                        updated[qIdx].hint = txt;
                        setQuestions(updated);
                      }}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.addSlideBtn, selectedLessonHasQuiz && { opacity: 0.4 }]}
                  disabled={selectedLessonHasQuiz}
                  onPress={() =>
                    setQuestions([
                      ...questions,
                      {
                        question_text: '',
                        question_type: 'descriptive',
                        image_url: '',
                        options: ['', '', '', ''],
                        correct_option_index: 0,
                        matching_pairs: [{ left: '', right: '' }],
                        hint: '',
                      },
                    ])
                  }
                >
                  <Ionicons name="add-circle-outline" size={18} color={selectedLessonHasQuiz ? '#94A3B8' : '#2563EB'} />
                  <Text style={[styles.addSlideBtnText, selectedLessonHasQuiz && { color: '#94A3B8' }]}>
                    Add Question to Pool
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (submittingQuiz || selectedLessonHasQuiz) && styles.primaryBtnDisabled,
                    selectedLessonHasQuiz && styles.primaryBtnQuizExists,
                  ]}
                  onPress={handleSubmitQuiz}
                  disabled={submittingQuiz || selectedLessonHasQuiz}
                >
                  {submittingQuiz ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : selectedLessonHasQuiz ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="lock-closed-outline" size={16} color="#64748B" />
                      <Text style={styles.primaryBtnQuizExistsText}>Quiz Already Created for this Tier</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryBtnText}>Create Quiz</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.viewCurriculumLinkBtn}
                onPress={() => setActiveTab('current')}
              >
                <Ionicons name="layers-outline" size={16} color="#2563EB" />
                <Text style={styles.viewCurriculumLinkText}>View All Current Lessons & Attached Quizzes</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 3: CLASS ANALYTICS */}
          {activeTab === 'analytics' && (
            <View>
              {loadingAnalytics ? (
                <ActivityIndicator color="#2563EB" size="large" style={{ marginVertical: 30 }} />
              ) : !analyticsData ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No analytics data available yet.</Text>
                </View>
              ) : (
                <>
                  {/* Summary Metrics */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricValue}>{analyticsData.total_students || 0}</Text>
                      <Text style={styles.metricLabel}>Total Students</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricValue}>{analyticsData.total_attempts || 0}</Text>
                      <Text style={styles.metricLabel}>Quizzes Completed</Text>
                    </View>
                    <View style={styles.metricCard}>
                      <Text style={styles.metricValue}>
                        {analyticsData.avg_score !== undefined ? `${Math.round(analyticsData.avg_score)}%` : '0%'}
                      </Text>
                      <Text style={styles.metricLabel}>Class Accuracy</Text>
                    </View>
                  </View>

                  {/* Student Performance Roster */}
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Student Performance Roster</Text>
                    {(analyticsData.student_roster || []).length === 0 ? (
                      <Text style={styles.emptyText}>No active students registered yet.</Text>
                    ) : (
                      (analyticsData.student_roster || []).map((student: any) => (
                        <View key={student.id} style={styles.studentCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.studentName}>{student.name || 'Student'}</Text>
                            <Text style={styles.studentSub}>
                              @{student.username} • {student.attempts_count || 0} quizzes done
                            </Text>
                          </View>
                          <View style={styles.starBadge}>
                            <Ionicons name="star" size={14} color="#D97706" />
                            <Text style={styles.starBadgeText}>{student.total_stars || 0}</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* 1. SLIDE EDITOR MODAL */}
      <Modal
        visible={editingLesson !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingLesson(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Lesson Slides</Text>
                <Text style={styles.modalSubtitle}>
                  {editingLesson?.groupTitle} ({editingLesson?.difficulty?.toUpperCase()})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditingLesson(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {editSlides.map((slide, sIdx) => (
                <View key={sIdx} style={styles.slideBox}>
                  <View style={styles.slideHeader}>
                    <Text style={styles.slideNumber}>Slide {sIdx + 1}</Text>
                    {editSlides.length > 1 && (
                      <TouchableOpacity
                        onPress={() => setEditSlides(editSlides.filter((_, i) => i !== sIdx))}
                      >
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Enter slide reading or story text..."
                    value={slide.description_text}
                    onChangeText={(txt) => {
                      const updated = [...editSlides];
                      updated[sIdx].description_text = txt;
                      setEditSlides(updated);
                    }}
                    multiline
                  />

                  {slide.image_url ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: slide.image_url }} style={styles.slidePreviewImg} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.removeImgBtn}
                        onPress={() => {
                          const updated = [...editSlides];
                          updated[sIdx].image_url = '';
                          setEditSlides(updated);
                        }}
                      >
                        <Ionicons name="close-circle" size={20} color="#DC2626" />
                        <Text style={styles.removeImgText}>Remove Image</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadBtn}
                      onPress={() =>
                        pickAndUploadImage((url) => {
                          const updated = [...editSlides];
                          updated[sIdx].image_url = url;
                          setEditSlides(updated);
                        })
                      }
                    >
                      <Ionicons name="image-outline" size={18} color="#2563EB" />
                      <Text style={styles.uploadBtnText}>Upload Slide Image</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSlideBtn}
                onPress={() => setEditSlides([...editSlides, { description_text: '', image_url: '' }])}
              >
                <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                <Text style={styles.addSlideBtnText}>Add Another Slide</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingLesson(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, savingEditSlides && styles.primaryBtnDisabled]}
                onPress={handleSaveEditSlides}
                disabled={savingEditSlides}
              >
                {savingEditSlides ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save Slide Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. QUIZ EDITOR MODAL */}
      <Modal
        visible={editingQuiz !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingQuiz(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Edit Quiz Questions</Text>
                <Text style={styles.modalSubtitle}>{editingQuiz?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingQuiz(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {loadingQuizQuestions ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13 }}>Loading questions...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {editQuizQuestions.map((q, qIdx) => (
                  <View key={qIdx} style={styles.questionBox}>
                    <View style={styles.questionBoxHeader}>
                      <Text style={styles.slideNumber}>Question {qIdx + 1}</Text>
                      {editQuizQuestions.length > 1 && (
                        <TouchableOpacity
                          onPress={() => setEditQuizQuestions(editQuizQuestions.filter((_, i) => i !== qIdx))}
                        >
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Question Type Toggle */}
                    <View style={styles.typeToggleRow}>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type !== 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...editQuizQuestions];
                          updated[qIdx].question_type = 'descriptive';
                          setEditQuizQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type !== 'matching' && styles.typeBtnTextActive]}>
                          Multiple Choice
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.typeBtn, q.question_type === 'matching' && styles.typeBtnActive]}
                        onPress={() => {
                          const updated = [...editQuizQuestions];
                          updated[qIdx].question_type = 'matching';
                          if (!updated[qIdx].matching_pairs || updated[qIdx].matching_pairs!.length === 0) {
                            updated[qIdx].matching_pairs = [{ left: '', right: '' }];
                          }
                          setEditQuizQuestions(updated);
                        }}
                      >
                        <Text style={[styles.typeBtnText, q.question_type === 'matching' && styles.typeBtnTextActive]}>
                          Matching Pairs
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Type question statement here..."
                      value={q.question_text}
                      onChangeText={(txt) => {
                        const updated = [...editQuizQuestions];
                        updated[qIdx].question_text = txt;
                        setEditQuizQuestions(updated);
                      }}
                      multiline
                    />

                    {/* Options or Matching */}
                    {q.question_type !== 'matching' ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Choices (Select radio button for the correct answer):</Text>
                        {(q.options || ['', '', '', '']).map((opt, optIdx) => (
                          <View key={optIdx} style={styles.optionRow}>
                            <TouchableOpacity
                              style={[styles.radio, q.correct_option_index === optIdx && styles.radioActive]}
                              onPress={() => {
                                const updated = [...editQuizQuestions];
                                updated[qIdx].correct_option_index = optIdx;
                                setEditQuizQuestions(updated);
                              }}
                            >
                              {q.correct_option_index === optIdx && <View style={styles.radioInner} />}
                            </TouchableOpacity>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              value={opt}
                              onChangeText={(txt) => {
                                const updated = [...editQuizQuestions];
                                if (!updated[qIdx].options) updated[qIdx].options = ['', '', '', ''];
                                updated[qIdx].options[optIdx] = txt;
                                setEditQuizQuestions(updated);
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.subFieldLabel}>Matching Pairs:</Text>
                        {(q.matching_pairs || []).map((pair, pIdx) => (
                          <View key={pIdx} style={styles.matchingRow}>
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Left ${pIdx + 1}`}
                              value={pair.left}
                              onChangeText={(txt) => {
                                const updated = [...editQuizQuestions];
                                updated[qIdx].matching_pairs![pIdx].left = txt;
                                setEditQuizQuestions(updated);
                              }}
                            />
                            <Ionicons name="arrow-forward" size={16} color="#64748B" style={{ marginHorizontal: 6 }} />
                            <TextInput
                              style={[styles.input, { flex: 1, marginBottom: 0 }]}
                              placeholder={`Right ${pIdx + 1}`}
                              value={pair.right}
                              onChangeText={(txt) => {
                                const updated = [...editQuizQuestions];
                                updated[qIdx].matching_pairs![pIdx].right = txt;
                                setEditQuizQuestions(updated);
                              }}
                            />
                            {(q.matching_pairs || []).length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  const updated = [...editQuizQuestions];
                                  updated[qIdx].matching_pairs = updated[qIdx].matching_pairs!.filter((_, i) => i !== pIdx);
                                  setEditQuizQuestions(updated);
                                }}
                                style={{ marginLeft: 6 }}
                              >
                                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                        <TouchableOpacity
                          style={styles.addPairBtn}
                          onPress={() => {
                            const updated = [...editQuizQuestions];
                            updated[qIdx].matching_pairs = [...(updated[qIdx].matching_pairs || []), { left: '', right: '' }];
                            setEditQuizQuestions(updated);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#2563EB" />
                          <Text style={styles.addPairBtnText}>Add Matching Pair</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <Text style={[styles.subFieldLabel, { marginTop: 10 }]}>Visual Hint / Explanation (Optional):</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Look at the dog's collar in slide 2"
                      value={q.hint || ''}
                      onChangeText={(txt) => {
                        const updated = [...editQuizQuestions];
                        updated[qIdx].hint = txt;
                        setEditQuizQuestions(updated);
                      }}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addSlideBtn}
                  onPress={() =>
                    setEditQuizQuestions([
                      ...editQuizQuestions,
                      {
                        question_text: '',
                        question_type: 'descriptive',
                        image_url: '',
                        options: ['', '', '', ''],
                        correct_option_index: 0,
                        matching_pairs: [{ left: '', right: '' }],
                        hint: '',
                      },
                    ])
                  }
                >
                  <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                  <Text style={styles.addSlideBtnText}>Add Question</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingQuiz(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, savingEditQuiz && styles.primaryBtnDisabled]}
                onPress={handleSaveEditQuiz}
                disabled={savingEditQuiz || loadingQuizQuestions}
              >
                {savingEditQuiz ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save Quiz Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. TRASH BIN MODAL */}
      <Modal
        visible={showTrashModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTrashModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="trash-bin" size={20} color="#DC2626" />
                  <Text style={styles.modalTitle}>Trash Bin ({trashCount})</Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  Restore accidentally deleted items or permanently remove them.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTrashModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {loadingTrash ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13 }}>Loading trash items...</Text>
              </View>
            ) : trashItems.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="trash-outline" size={44} color="#94A3B8" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyStateTitle}>Trash Bin is Empty</Text>
                <Text style={styles.emptyStateText}>No soft-deleted lessons or quizzes at this time.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {trashItems.map((item, idx) => {
                  const typeLabel =
                    item.item_type === 'lesson_group'
                      ? 'Story Group'
                      : item.item_type === 'lesson'
                      ? 'Lesson Tier'
                      : 'Quiz';
                  const dateStr = item.deleted_at
                    ? new Date(item.deleted_at).toLocaleString()
                    : 'Recently deleted';

                  return (
                    <View key={`${item.item_type}-${item.id}-${idx}`} style={styles.trashItemCard}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <View
                            style={[
                              styles.itemTypeBadge,
                              item.item_type === 'lesson_group' && styles.itemTypeBadgeGroup,
                              item.item_type === 'lesson' && styles.itemTypeBadgeLesson,
                              item.item_type === 'quiz' && styles.itemTypeBadgeQuiz,
                            ]}
                          >
                            <Text style={styles.itemTypeBadgeText}>{typeLabel}</Text>
                          </View>
                          {item.difficulty && (
                            <View style={styles.trashTierBadge}>
                              <Text style={styles.trashTierBadgeText}>{item.difficulty.toUpperCase()}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.trashItemTitle}>{item.title}</Text>
                        <Text style={styles.trashItemSub}>
                          Deleted: {dateStr} {item.deleted_by ? `by ${item.deleted_by}` : ''}
                        </Text>
                      </View>

                      {/* Restore & Permanent Delete Actions */}
                      <View style={styles.trashActionsRow}>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => handleRestoreItem(item.item_type, item.id)}
                        >
                          <Ionicons name="refresh-outline" size={14} color="#059669" />
                          <Text style={styles.restoreBtnText}>Restore</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.permanentDeleteBtn}
                          onPress={() => handlePermanentDeleteItem(item.item_type, item.id, item.title)}
                        >
                          <Ionicons name="trash" size={14} color="#DC2626" />
                          <Text style={styles.permanentDeleteBtnText}>Delete Forever</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { flex: 1 }]}
                onPress={() => setShowTrashModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. TEACHER HISTORY MODAL */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="time" size={20} color="#2563EB" />
                  <Text style={styles.modalTitle}>Teacher Activity History</Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  Audit log of content updates, deletions, and restorations.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {loadingHistory ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13 }}>Loading activity logs...</Text>
              </View>
            ) : historyItems.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Ionicons name="time-outline" size={44} color="#94A3B8" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyStateTitle}>No History Recorded</Text>
                <Text style={styles.emptyStateText}>Teacher actions will be recorded here automatically.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {historyItems.map((log) => {
                  const dateStr = log.created_at ? new Date(log.created_at).toLocaleString() : '';
                  const actionType = log.action_type || 'action';

                  return (
                    <View key={log.id} style={styles.historyCard}>
                      <View style={styles.historyHeaderRow}>
                        <View
                          style={[
                            styles.historyActionBadge,
                            actionType === 'create' && styles.historyBadgeCreate,
                            actionType === 'update' && styles.historyBadgeUpdate,
                            (actionType === 'soft_delete' || actionType === 'trash') && styles.historyBadgeDelete,
                            actionType === 'restore' && styles.historyBadgeRestore,
                            actionType === 'permanent_delete' && styles.historyBadgePermanent,
                          ]}
                        >
                          <Text
                            style={[
                              styles.historyActionBadgeText,
                              actionType === 'create' && styles.historyBadgeTextCreate,
                              actionType === 'update' && styles.historyBadgeTextUpdate,
                              (actionType === 'soft_delete' || actionType === 'trash') && styles.historyBadgeTextDelete,
                              actionType === 'restore' && styles.historyBadgeTextRestore,
                              actionType === 'permanent_delete' && styles.historyBadgeTextPermanent,
                            ]}
                          >
                            {actionType.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.historyTimestamp}>{dateStr}</Text>
                      </View>

                      <Text style={styles.historyDesc}>{log.description}</Text>

                      <View style={styles.historyMetaRow}>
                        <Text style={styles.historyMetaText}>
                          Teacher: <Text style={{ fontWeight: '600', color: '#334155' }}>{log.teacher_name}</Text>
                        </Text>
                        {log.target_type && (
                          <Text style={styles.historyMetaText}>
                            Target: <Text style={{ fontWeight: '600', color: '#334155' }}>{log.target_type}</Text>
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { flex: 1 }]}
                onPress={() => setShowHistoryModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  workspaceBody: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  sidebarExpanded: {
    width: 185,
  },
  sidebarCollapsed: {
    width: 54,
  },
  sidebarBrandHeader: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  sidebarBrandHeaderCollapsed: {
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  sidebarBrandTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  sidebarBrandSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  sidebarToggleBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarToggleBtnCollapsed: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarNavList: {
    flex: 1,
    paddingVertical: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 5,
    marginVertical: 3,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  sidebarItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  sidebarItemCollapsed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginHorizontal: 4,
    marginVertical: 3,
    borderRadius: 8,
  },
  sidebarItemCollapsedActive: {
    backgroundColor: '#EFF6FF',
  },
  sidebarItemIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarItemIconBoxActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sidebarItemText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 8,
  },
  sidebarItemTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  sidebarFooter: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  sidebarFooterCollapsed: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 7,
    borderRadius: 6,
    gap: 6,
  },
  sidebarLogoutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  sidebarLogoutBtnCollapsed: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainHeaderStrip: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mainSubjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  mainSubjectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  subjectBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  topicChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  topicChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  topicChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  lessonGroupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  lessonGroupChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  lessonGroupChipText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  lessonGroupChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  tierCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  tierCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tierCountText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  tierCountTextActive: {
    color: '#FFFFFF',
  },
  tierSelectionContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  quizTierBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizTierBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  quizTierBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  quizTierBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  quizTierBtnTextActive: {
    color: '#FFFFFF',
  },
  quizTierBtnTextDisabled: {
    color: '#94A3B8',
  },
  quizTierSubtext: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
  },
  quizTierSubtextActive: {
    color: '#BFDBFE',
  },
  quizTierSubtextDisabled: {
    color: '#94A3B8',
  },
  quizTierBtnHasQuiz: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  quizTierBtnHasQuizActive: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  quizTierBtnTextHasQuiz: {
    color: '#92400E',
  },
  quizTierBtnTextHasQuizActive: {
    color: '#FFFFFF',
  },
  quizTierSubtextHasQuiz: {
    color: '#B45309',
  },
  quizTierSubtextHasQuizActive: {
    color: '#FEF3C7',
  },
  quizExistsAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  quizExistsAlertTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 2,
  },
  quizExistsAlertText: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 15,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#2563EB',
  },
  tabLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardHelp: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  subFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tierBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tierBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  tierBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tierBtnTextActive: {
    color: '#FFFFFF',
  },
  slideBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  slideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slideNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginTop: 6,
  },
  slidePreviewImg: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  removeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  removeImgText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  addSlideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 14,
    gap: 6,
  },
  addSlideBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  primaryBtnQuizExists: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  primaryBtnQuizExistsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  groupCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  tierChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  tierStatusActive: {
    backgroundColor: '#ECFDF5',
  },
  tierStatusMissing: {
    backgroundColor: '#F1F5F9',
  },
  tierStatusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tierStatusTextActive: {
    color: '#059669',
  },
  tierStatusTextMissing: {
    color: '#94A3B8',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  questionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  questionBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
  },
  typeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  typeBtnTextActive: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: '#2563EB',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  matchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addPairBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  addPairBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  quizCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quizDeleteBtn: {
    padding: 6,
    marginLeft: 8,
  },
  quizTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  quizSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  studentSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  starBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
  },
  sidebarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginBottom: 6,
    gap: 6,
  },
  sidebarActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  sidebarActionBtnCollapsed: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  sidebarTrashBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTrashBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sidebarTrashBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DC2626',
  },
  sidebarFooterDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  curriculumTopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  curriculumTopTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  curriculumTopSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    gap: 4,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  curriculumStoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    overflow: 'hidden',
  },
  storyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  storyCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  storyCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  storyDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  storyDeleteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  storyTiersContainer: {
    padding: 12,
    gap: 10,
  },
  tierCardActive: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  tierCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  tierBadgeEasy: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tierBadgeMedium: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tierBadgeHard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  tierBadgeTextEasy: {
    color: '#059669',
  },
  tierBadgeTextMedium: {
    color: '#D97706',
  },
  tierBadgeTextHard: {
    color: '#DC2626',
  },
  tierSection: {
    flex: 1,
    minWidth: 140,
  },
  tierInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tierInfoText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  tierInfoTextSuccess: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  tierInfoTextWarning: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '500',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  actionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  tierActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionBtnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  actionBtnSuccessText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  actionBtnDangerSmall: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  actionBtnAmberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  tierCardMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
  },
  tierBadgeMissing: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    minWidth: 64,
    alignItems: 'center',
  },
  tierBadgeTextMissing: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tierMissingText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
    marginLeft: 10,
  },
  tierCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  tierCreateBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  viewCurriculumLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 12,
  },
  viewCurriculumLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 6,
  },
  modalBody: {
    padding: 16,
    maxHeight: 520,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalEmptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  itemTypeBadgeGroup: {
    backgroundColor: '#EFF6FF',
  },
  itemTypeBadgeLesson: {
    backgroundColor: '#F0FDF4',
  },
  itemTypeBadgeQuiz: {
    backgroundColor: '#FEF3C7',
  },
  itemTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  trashTierBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trashTierBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
  },
  trashItemTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  trashItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  trashActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  permanentDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  permanentDeleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyActionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyBadgeCreate: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  historyBadgeUpdate: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  historyBadgeDelete: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  historyBadgeRestore: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  historyBadgePermanent: {
    backgroundColor: '#450A0A',
  },
  historyActionBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  historyBadgeTextCreate: {
    color: '#059669',
  },
  historyBadgeTextUpdate: {
    color: '#2563EB',
  },
  historyBadgeTextDelete: {
    color: '#DC2626',
  },
  historyBadgeTextRestore: {
    color: '#7C3AED',
  },
  historyBadgeTextPermanent: {
    color: '#FEF2F2',
  },
  historyTimestamp: {
    fontSize: 11,
    color: '#94A3B8',
  },
  historyDesc: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    marginBottom: 4,
  },
  historyMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  historyMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 360,
  },
});
