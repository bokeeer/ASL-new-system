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
  quiz_id?: number | null;
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

  const [activeTab, setActiveTab] = useState<'lessons' | 'quizzes' | 'analytics'>('lessons');
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
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [selectedTopicId, activeTab, fetchLessonGroups, fetchQuizzes, fetchAnalytics]);

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

  // Delete Lesson Group
  const handleDeleteGroup = async (groupId: number, title: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Delete "${title}" and all its difficulty tiers?`)
      : true;
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/lesson-group/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Deleted', `Lesson group "${title}" was deleted.`);
        fetchLessonGroups(selectedTopicId);
      }
    } catch {
      showAlert('Error', 'Could not delete lesson group.');
    }
  };

  // Submit Quiz (Automatic KC linking)
  const handleSubmitQuiz = async () => {
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

  // Active selected lesson group for quiz creation
  const activeGroup = (selectedLessonGroupId !== null
    ? lessonGroups.find((g) => g.id === selectedLessonGroupId)
    : lessonGroups[0]) || null;

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

            {/* Sidebar Bottom: Log Out */}
            {!sidebarCollapsed ? (
              <View style={styles.sidebarFooter}>
                <TouchableOpacity style={styles.sidebarLogoutBtn} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={18} color="#DC2626" />
                  <Text style={styles.sidebarLogoutBtnText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.sidebarFooterCollapsed}>
                <TouchableOpacity style={styles.sidebarLogoutBtnCollapsed} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Main Workspace Body */}
          <View style={styles.mainArea}>
            {/* Subject Context Header & Navigation Tabs */}
            <View style={styles.mainHeaderStrip}>
              <View style={styles.mainSubjectHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={topics.find((t) => t.id === selectedTopicId)?.icon || 'book-outline'}
                    size={20}
                    color="#2563EB"
                  />
                  <Text style={styles.mainSubjectTitle}>
                    {topics.find((t) => t.id === selectedTopicId)?.name || 'Subject'}
                  </Text>
                </View>
                <View style={styles.subjectBadge}>
                  <Text style={styles.subjectBadgeText}>ACTIVE SUBJECT</Text>
                </View>
              </View>

              {/* Navigation Tabs */}
              <View style={styles.tabBar}>
                {[
                  { id: 'lessons' as const, label: 'Lessons & Slides', icon: 'book-outline' as const },
                  { id: 'quizzes' as const, label: 'Quizzes & Questions', icon: 'help-circle-outline' as const },
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
          {/* TAB 1: LESSONS & SLIDES */}
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

              {/* Existing Lessons Roster */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Current Lessons in Topic</Text>
                {loadingGroups ? (
                  <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
                ) : lessonGroups.length === 0 ? (
                  <Text style={styles.emptyText}>No lessons created yet in this topic.</Text>
                ) : (
                  lessonGroups.map((g) => (
                    <View key={g.id} style={styles.groupCard}>
                      <View style={styles.groupHeader}>
                        <Text style={styles.groupTitle}>{g.title}</Text>
                        <TouchableOpacity onPress={() => handleDeleteGroup(g.id, g.title)}>
                          <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.tierChipsRow}>
                        {['easy', 'medium', 'hard'].map((t) => {
                          const tierLesson = (g.lessons || []).find((l) => l.difficulty === t);
                          return (
                            <View
                              key={t}
                              style={[styles.tierStatusChip, tierLesson ? styles.tierStatusActive : styles.tierStatusMissing]}
                            >
                              <Ionicons
                                name={tierLesson ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={tierLesson ? '#059669' : '#94A3B8'}
                              />
                              <Text
                                style={[
                                  styles.tierStatusText,
                                  tierLesson ? styles.tierStatusTextActive : styles.tierStatusTextMissing,
                                ]}
                              >
                                {t.toUpperCase()}: {tierLesson ? `${tierLesson.slides?.length || 0} slides` : 'Not created'}
                              </Text>
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

                            return (
                              <TouchableOpacity
                                key={tier}
                                style={[
                                  styles.quizTierBtn,
                                  isSelected && styles.quizTierBtnActive,
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
                                    name={isSelected ? 'checkmark-circle' : isAvailable ? 'radio-button-off' : 'close-circle-outline'}
                                    size={15}
                                    color={isSelected ? '#FFFFFF' : isAvailable ? '#475569' : '#94A3B8'}
                                  />
                                  <Text
                                    style={[
                                      styles.quizTierBtnText,
                                      isSelected && styles.quizTierBtnTextActive,
                                      !isAvailable && styles.quizTierBtnTextDisabled,
                                    ]}
                                  >
                                    {tier.toUpperCase()}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.quizTierSubtext,
                                    isSelected && styles.quizTierSubtextActive,
                                    !isAvailable && styles.quizTierSubtextDisabled,
                                  ]}
                                >
                                  {isAvailable ? `${tierLesson?.slides?.length || 0} slides created` : 'Not created yet'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
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
                  style={styles.addSlideBtn}
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
                  <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                  <Text style={styles.addSlideBtnText}>Add Question to Pool</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, submittingQuiz && styles.primaryBtnDisabled]}
                  onPress={handleSubmitQuiz}
                  disabled={submittingQuiz}
                >
                  {submittingQuiz ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Create Quiz</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Existing Quizzes Roster */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Existing Quizzes in Topic</Text>
                {loadingQuizzes ? (
                  <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
                ) : existingQuizzes.length === 0 ? (
                  <Text style={styles.emptyText}>No quizzes created yet in this topic.</Text>
                ) : (
                  existingQuizzes.map((quiz) => (
                    <View key={quiz.id} style={styles.quizCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.quizTitle}>{quiz.title}</Text>
                        <Text style={styles.quizSub}>
                          Difficulty: {(quiz.difficulty || 'easy').toUpperCase()} • {quiz.questions?.length || 0} questions
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
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
});
