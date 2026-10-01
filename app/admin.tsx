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
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { API_URL } from '../context/config';
import { useAuth } from '../context/AuthContext';

interface KnowledgeComponent {
  id?: number;
  topic_id: string;
  name: string;
  display_name: string;
  prior: number;
  learns: number;
  guesses: number;
  slips: number;
}

interface UserRecord {
  id: number;
  name: string;
  username: string;
  role: 'admin' | 'teacher' | 'student';
  password?: string;
  created_at?: string;
}

export default function AdminScreen() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'kcs' | 'pybkt' | 'users' | 'diagnostics'>('kcs');
  const [selectedTopicId, setSelectedTopicId] = useState('story-grammar');

  // KC State
  const [kcList, setKcList] = useState<KnowledgeComponent[]>([]);
  const [loadingKcs, setLoadingKcs] = useState(false);
  const [kcName, setKcName] = useState('');
  const [kcDisplayName, setKcDisplayName] = useState('');
  const [kcPrior, setKcPrior] = useState('0.10');
  const [kcLearns, setKcLearns] = useState('0.20');
  const [kcGuesses, setKcGuesses] = useState('0.25');
  const [kcSlips, setKcSlips] = useState('0.10');
  const [submittingKC, setSubmittingKC] = useState(false);

  // pyBKT Calibration State
  const [fittingModel, setFittingModel] = useState(false);
  const [fitResult, setFitResult] = useState<any>(null);

  // User Management State
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  // User Details & Password Modal State
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Delete User Modal State (Requires Admin Password)
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  // Diagnostics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

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

  // Fetch KCs for topic
  const fetchKcs = useCallback(async (topicId: string) => {
    setLoadingKcs(true);
    try {
      const res = await fetch(`${API_URL}/admin/kcs/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        setKcList(Array.isArray(data) ? data : []);
      }
    } catch {
      setKcList([]);
    } finally {
      setLoadingKcs(false);
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch Diagnostics
  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiagnostics(true);
    try {
      const res = await fetch(`${API_URL}/admin/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch {
      setAnalyticsData(null);
    } finally {
      setLoadingDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'kcs') {
      fetchKcs(selectedTopicId);
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'diagnostics') {
      fetchDiagnostics();
    }
  }, [activeTab, selectedTopicId, fetchKcs, fetchUsers, fetchDiagnostics]);

  // Submit Knowledge Component
  const handleSubmitKC = async () => {
    if (!kcName.trim() || !kcDisplayName.trim()) {
      showAlert('Required Fields', 'Please enter both KC ID and Display Name.');
      return;
    }

    setSubmittingKC(true);
    try {
      const res = await fetch(`${API_URL}/admin/kc/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopicId,
          name: kcName.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: kcDisplayName.trim(),
          prior: parseFloat(kcPrior) || 0.1,
          learns: parseFloat(kcLearns) || 0.2,
          guesses: parseFloat(kcGuesses) || 0.25,
          slips: parseFloat(kcSlips) || 0.1,
        }),
      });

      if (!res.ok) throw new Error('Failed to create Knowledge Component');

      showAlert('Success', `Knowledge Component "${kcDisplayName}" registered successfully.`);
      setKcName('');
      setKcDisplayName('');
      setKcPrior('0.10');
      setKcLearns('0.20');
      setKcGuesses('0.25');
      setKcSlips('0.10');
      fetchKcs(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not register Knowledge Component.');
    } finally {
      setSubmittingKC(false);
    }
  };

  // Delete Knowledge Component
  const handleDeleteKC = async (name: string) => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Delete Knowledge Component "${name}"?`)
      : true;
    if (!confirm) return;

    try {
      const res = await fetch(`${API_URL}/admin/kc/${name}`, { method: 'DELETE' });
      if (res.ok) {
        showAlert('Deleted', `Knowledge Component "${name}" was removed.`);
        fetchKcs(selectedTopicId);
      }
    } catch {
      showAlert('Error', 'Could not delete Knowledge Component.');
    }
  };

  // Run pyBKT Model Calibration
  const handleFitBkt = async () => {
    setFittingModel(true);
    setFitResult(null);
    try {
      const res = await fetch(`${API_URL}/admin/bkt/fit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'pyBKT refitting failed.');
      setFitResult(data);
      showAlert('Recalibration Complete', `pyBKT successfully calibrated parameters for ${data.updated_kcs?.length || 0} skills.`);
      fetchKcs(selectedTopicId);
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not complete pyBKT recalibration.');
    } finally {
      setFittingModel(false);
    }
  };

  // Create Teacher Account
  const handleCreateTeacher = async () => {
    if (!teacherName.trim() || !teacherUsername.trim() || !teacherPassword.trim()) {
      showAlert('Required Fields', 'Please enter Name, Username, and Password for the teacher.');
      return;
    }

    setCreatingTeacher(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/create-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacherName.trim(),
          username: teacherUsername.trim(),
          password: teacherPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create teacher account.');

      showAlert('Success', `Teacher account "@${teacherUsername}" created successfully.`);
      setTeacherName('');
      setTeacherUsername('');
      setTeacherPassword('');
      fetchUsers();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not create teacher account.');
    } finally {
      setCreatingTeacher(false);
    }
  };

  // Change User Role
  const handleChangeRole = async (userId: number, newRole: 'admin' | 'teacher' | 'student') => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        showAlert('Role Updated', `User role changed to ${newRole}.`);
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, role: newRole });
        }
        fetchUsers();
      }
    } catch {
      showAlert('Error', 'Could not update user role.');
    }
  };

  // Reset User Password (Admin action)
  const handleResetPassword = async () => {
    if (!selectedUser || !newResetPassword.trim()) {
      showAlert('Required', 'Please enter a new password.');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newResetPassword.trim() }),
      });
      if (!res.ok) throw new Error('Failed to update password');
      showAlert('Success', `Password for @${selectedUser.username} updated.`);
      setSelectedUser({ ...selectedUser, password: newResetPassword.trim() });
      setNewResetPassword('');
      fetchUsers();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete User Account (Requires Admin Password Authorization)
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (!adminPasswordInput.trim()) {
      showAlert('Required', 'Please enter your administrator password to authorize deletion.');
      return;
    }

    setDeletingUser(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${userToDelete.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_password: adminPasswordInput.trim(),
          admin_id: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to delete user.');
      }

      showAlert('Account Deleted', data.message || `User @${userToDelete.username} deleted.`);
      setDeleteModalVisible(false);
      setUserToDelete(null);
      setAdminPasswordInput('');
      if (selectedUser?.id === userToDelete.id) {
        setUserModalVisible(false);
        setSelectedUser(null);
      }
      fetchUsers();
    } catch (err: any) {
      showAlert('Deletion Error', err.message || 'Could not delete user account.');
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>System Administration & ITS Portal</Text>
            <Text style={styles.headerSubtitle}>
              Logged in as Administrator ({user?.username || 'admin'})
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Tabs */}
        <View style={styles.tabBar}>
          {[
            { id: 'kcs' as const, label: 'Skills & KCs (ITS)', icon: 'bulb-outline' as const },
            { id: 'pybkt' as const, label: 'pyBKT Calibration', icon: 'hardware-chip-outline' as const },
            { id: 'users' as const, label: 'User Management', icon: 'people-outline' as const },
            { id: 'diagnostics' as const, label: 'System Diagnostics', icon: 'stats-chart-outline' as const },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.id ? '#7C3AED' : '#64748B'}
                style={{ marginBottom: 4 }}
              />
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Content */}
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* TAB 1: KNOWLEDGE COMPONENTS (ITS) */}
          {activeTab === 'kcs' && (
            <View>
              {/* Topic Selector */}
              <View style={styles.topicBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {topics.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.topicChip, selectedTopicId === t.id && styles.topicChipActive]}
                      onPress={() => setSelectedTopicId(t.id)}
                    >
                      <Ionicons
                        name={t.icon}
                        size={16}
                        color={selectedTopicId === t.id ? '#FFFFFF' : '#475569'}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.topicChipText, selectedTopicId === t.id && styles.topicChipTextActive]}>
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Create KC Form */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Register Knowledge Component (ITS)</Text>
                <Text style={styles.cardHelp}>
                  Knowledge Components define atomic cognitive skills tracked by Bayesian Knowledge Tracing (BKT).
                </Text>

                <Text style={styles.fieldLabel}>KC Identifier (lowercase, no spaces)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. character_traits"
                  value={kcName}
                  onChangeText={setKcName}
                  autoCapitalize="none"
                />

                <Text style={styles.fieldLabel}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Character Traits & Feelings"
                  value={kcDisplayName}
                  onChangeText={setKcDisplayName}
                />

                <Text style={[styles.fieldLabel, { marginTop: 4 }]}>BKT Probabilistic Parameters</Text>
                <View style={styles.paramGrid}>
                  {[
                    { label: 'Prior P(L0)', val: kcPrior, set: setKcPrior, help: 'Initial mastery' },
                    { label: 'Learn P(T)', val: kcLearns, set: setKcLearns, help: 'Learning rate' },
                    { label: 'Guess P(G)', val: kcGuesses, set: setKcGuesses, help: 'Lucky guess' },
                    { label: 'Slip P(S)', val: kcSlips, set: setKcSlips, help: 'Careless error' },
                  ].map((p) => (
                    <View key={p.label} style={styles.paramBox}>
                      <Text style={styles.paramLabel}>{p.label}</Text>
                      <TextInput
                        style={styles.paramInput}
                        value={p.val}
                        onChangeText={p.set}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.paramHelp}>{p.help}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, submittingKC && styles.primaryBtnDisabled]}
                  onPress={handleSubmitKC}
                  disabled={submittingKC}
                >
                  {submittingKC ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save Knowledge Component</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Registered KCs List */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Registered KCs in Topic ({kcList.length})</Text>
                {loadingKcs ? (
                  <ActivityIndicator color="#7C3AED" style={{ marginVertical: 20 }} />
                ) : kcList.length === 0 ? (
                  <Text style={styles.emptyText}>No Knowledge Components registered for this topic yet.</Text>
                ) : (
                  kcList.map((kc) => (
                    <View key={kc.name} style={styles.kcItemCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.kcItemTitle}>{kc.display_name}</Text>
                        <Text style={styles.kcItemSlug}>ID: {kc.name}</Text>
                        <Text style={styles.kcItemParams}>
                          Prior: {kc.prior} • Learn: {kc.learns} • Guess: {kc.guesses} • Slip: {kc.slips}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteKC(kc.name)} style={{ padding: 6 }}>
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* TAB 2: pyBKT CALIBRATION */}
          {activeTab === 'pybkt' && (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>pyBKT Expectation-Maximization Calibration</Text>
                <Text style={styles.cardHelp}>
                  Executes the pyBKT library's Expectation-Maximization (EM) algorithm across collected student responses to recalculate empirical Prior, Learn, Guess, and Slip parameters.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#6D28D9' }, fittingModel && styles.primaryBtnDisabled]}
                  onPress={handleFitBkt}
                  disabled={fittingModel}
                >
                  {fittingModel ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Recalibrate Parameters with pyBKT</Text>
                  )}
                </TouchableOpacity>

                {fitResult && (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultTitle}>Calibration Output</Text>
                    <Text style={styles.resultText}>Status: {fitResult.status}</Text>
                    <Text style={styles.resultText}>Updated Skills: {(fitResult.updated_kcs || []).join(', ') || 'None'}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* TAB 3: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <View>
              {/* Create Teacher Account Form */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Create Teacher Account</Text>
                <Text style={styles.cardHelp}>
                  Authorized teachers can create curriculum lessons, author quizzes, and track classroom performance.
                </Text>

                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Maria Santos"
                  value={teacherName}
                  onChangeText={setTeacherName}
                />

                <Text style={styles.fieldLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. msantos"
                  value={teacherUsername}
                  onChangeText={setTeacherUsername}
                  autoCapitalize="none"
                />

                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter initial password"
                  value={teacherPassword}
                  onChangeText={setTeacherPassword}
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, creatingTeacher && styles.primaryBtnDisabled]}
                  onPress={handleCreateTeacher}
                  disabled={creatingTeacher}
                >
                  {creatingTeacher ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Create Teacher Account</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Users Directory */}
              <View style={styles.card}>
                <View style={styles.userDirHeader}>
                  <Text style={styles.cardTitle}>User Directory ({users.length})</Text>
                  <Text style={styles.userDirSub}>Tap any user or Info to view password & details</Text>
                </View>
                {loadingUsers ? (
                  <ActivityIndicator color="#7C3AED" style={{ marginVertical: 20 }} />
                ) : users.length === 0 ? (
                  <Text style={styles.emptyText}>No users registered.</Text>
                ) : (
                  users.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.userItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedUser(u);
                        setShowPassword(false);
                        setNewResetPassword('');
                        setUserModalVisible(true);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{u.name || 'User'}</Text>
                        <Text style={styles.userUsername}>@{u.username}</Text>
                      </View>
                      <View style={[styles.roleBadge, (styles as any)[`role_${u.role}`]]}>
                        <Text style={[styles.roleBadgeText, (styles as any)[`roleText_${u.role}`]]}>
                          {u.role.toUpperCase()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.userInfoBtn}
                        onPress={() => {
                          setSelectedUser(u);
                          setShowPassword(false);
                          setNewResetPassword('');
                          setUserModalVisible(true);
                        }}
                      >
                        <Ionicons name="information-circle-outline" size={15} color="#4338CA" />
                        <Text style={styles.userInfoBtnText}>Info</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.userDeleteBtn,
                          (u.username === 'admin' || u.id === user?.id) && styles.userDeleteBtnDisabled,
                        ]}
                        onPress={() => {
                          if (u.username === 'admin') {
                            showAlert('Protected', 'The root administrator account cannot be deleted.');
                            return;
                          }
                          if (u.id === user?.id) {
                            showAlert('Protected', 'You cannot delete your own active administrator account.');
                            return;
                          }
                          setUserToDelete(u);
                          setAdminPasswordInput('');
                          setShowAdminPassword(false);
                          setDeleteModalVisible(true);
                        }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={u.username === 'admin' || u.id === user?.id ? '#94A3B8' : '#DC2626'}
                        />
                        <Text
                          style={[
                            styles.userDeleteBtnText,
                            (u.username === 'admin' || u.id === user?.id) && styles.userDeleteBtnTextDisabled,
                          ]}
                        >
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {/* TAB 4: SYSTEM DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <View>
              {loadingDiagnostics ? (
                <ActivityIndicator color="#7C3AED" size="large" style={{ marginVertical: 30 }} />
              ) : !analyticsData ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No diagnostics data available.</Text>
                </View>
              ) : (
                <View>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiVal}>{analyticsData.total_students || 0}</Text>
                      <Text style={styles.kpiLabel}>Total Students</Text>
                    </View>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiVal}>{analyticsData.total_attempts || 0}</Text>
                      <Text style={styles.kpiLabel}>Quiz Attempts</Text>
                    </View>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiVal}>
                        {analyticsData.avg_score !== undefined ? `${Math.round(analyticsData.avg_score)}%` : '0%'}
                      </Text>
                      <Text style={styles.kpiLabel}>Overall Accuracy</Text>
                    </View>
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>System Health & Performance</Text>
                    <Text style={styles.cardHelp}>
                      All core ITS components, BKT student models, and adaptive assessment engines are operational.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* User Details & Password Modal */}
      <Modal
        visible={userModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-circle-outline" size={24} color="#7C3AED" />
                <Text style={styles.modalTitle}>User Account Details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setUserModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Basic Details */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Full Name</Text>
                  <Text style={styles.detailValue}>{selectedUser.name || 'Not provided'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Username</Text>
                  <Text style={styles.detailValue}>@{selectedUser.username}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>User ID</Text>
                  <Text style={styles.detailValue}>#{selectedUser.id}</Text>
                </View>

                {/* Role Switcher */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Account Role</Text>
                  <View style={styles.rolePickerRow}>
                    {(['student', 'teacher', 'admin'] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.rolePickerBtn,
                          selectedUser.role === r && styles.rolePickerBtnActive,
                        ]}
                        onPress={() => handleChangeRole(selectedUser.id, r)}
                      >
                        <Text
                          style={[
                            styles.rolePickerBtnText,
                            selectedUser.role === r && styles.rolePickerBtnTextActive,
                          ]}
                        >
                          {r.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Password Section */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Account Password</Text>
                  <View style={styles.passwordDisplayBox}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="key-outline" size={18} color="#7C3AED" />
                      <Text
                        style={[
                          styles.passwordDisplayText,
                          !showPassword && styles.passwordDisplayTextMasked,
                        ]}
                        selectable={true}
                      >
                        {showPassword
                          ? (selectedUser.password || 'No plain password recorded')
                          : '••••••••••••'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.passwordHint}>
                    {showPassword
                      ? 'Password is visible to Administrator. You can copy or inspect it.'
                      : 'Tap the eye icon to reveal the plain password.'}
                  </Text>
                </View>

                {/* Reset Password */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Reset Password</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password for this user"
                    value={newResetPassword}
                    onChangeText={setNewResetPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, resettingPassword && styles.primaryBtnDisabled]}
                    onPress={handleResetPassword}
                    disabled={resettingPassword}
                  >
                    {resettingPassword ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Save New Password</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                {selectedUser.username !== 'admin' && selectedUser.id !== user?.id && (
                  <View style={styles.modalSection}>
                    <Text style={[styles.modalSectionTitle, { color: '#DC2626' }]}>Danger Zone</Text>
                    <TouchableOpacity
                      style={styles.deleteUserInModalBtn}
                      onPress={() => {
                        const target = selectedUser;
                        setUserModalVisible(false);
                        setUserToDelete(target);
                        setAdminPasswordInput('');
                        setShowAdminPassword(false);
                        setDeleteModalVisible(true);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={styles.deleteUserInModalText}>Delete This User Account</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete User Confirmation Modal (Requires Admin Password) */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="warning-outline" size={24} color="#DC2626" />
                <Text style={[styles.modalTitle, { color: '#DC2626' }]}>Confirm Account Deletion</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setDeleteModalVisible(false);
                  setUserToDelete(null);
                  setAdminPasswordInput('');
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {userToDelete && (
              <View>
                <View style={styles.deleteWarningBox}>
                  <Text style={styles.deleteWarningTitle}>Permanent Action</Text>
                  <Text style={styles.deleteWarningText}>
                    You are about to permanently delete{' '}
                    <Text style={{ fontWeight: 'bold', color: '#991B1B' }}>
                      {userToDelete.name || userToDelete.username} (@{userToDelete.username})
                    </Text>
                    . This will delete all associated student progress, quiz attempts, streaks, and account records.
                  </Text>
                </View>

                <View style={{ marginVertical: 14 }}>
                  <Text style={styles.adminAuthLabel}>
                    Enter your Administrator Password to authorize:
                  </Text>
                  <View style={styles.passwordDisplayBox}>
                    <TextInput
                      style={{ flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 4 }}
                      placeholder="Administrator password"
                      value={adminPasswordInput}
                      onChangeText={setAdminPasswordInput}
                      secureTextEntry={!showAdminPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowAdminPassword(!showAdminPassword)}
                    >
                      <Ionicons
                        name={showAdminPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.deleteModalActions}>
                  <TouchableOpacity
                    style={styles.cancelModalBtn}
                    onPress={() => {
                      setDeleteModalVisible(false);
                      setUserToDelete(null);
                      setAdminPasswordInput('');
                    }}
                    disabled={deletingUser}
                  >
                    <Text style={styles.cancelModalBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.confirmDeleteBtn, deletingUser && styles.primaryBtnDisabled]}
                    onPress={handleDeleteUser}
                    disabled={deletingUser}
                  >
                    {deletingUser ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.confirmDeleteBtnText}>Delete Account</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  topHeader: {
    backgroundColor: '#1E1B4B',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#C7D2FE',
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  logoutBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
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
    borderBottomColor: '#7C3AED',
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#7C3AED',
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  topicBar: {
    marginBottom: 14,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topicChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#6D28D9',
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
  paramGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  paramBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8,
  },
  paramLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  paramInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0F172A',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  paramHelp: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
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
  kcItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 8,
  },
  kcItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  kcItemSlug: {
    fontSize: 11,
    color: '#7C3AED',
    marginTop: 2,
  },
  kcItemParams: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  resultBox: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#6D28D9',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 12,
    color: '#4C1D95',
    lineHeight: 18,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  userUsername: {
    fontSize: 12,
    color: '#64748B',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  role_admin: {
    backgroundColor: '#EDE9FE',
  },
  role_teacher: {
    backgroundColor: '#DBEAFE',
  },
  role_student: {
    backgroundColor: '#F1F5F9',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  roleText_admin: {
    color: '#6D28D9',
  },
  roleText_teacher: {
    color: '#1D4ED8',
  },
  roleText_student: {
    color: '#475569',
  },
  roleToggleBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleToggleText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginTop: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  userDirHeader: {
    marginBottom: 12,
  },
  userDirSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  userInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  userInfoBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338CA',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
  modalCloseBtn: {
    padding: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rolePickerBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  rolePickerBtnActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  rolePickerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  rolePickerBtnTextActive: {
    color: '#7C3AED',
  },
  passwordDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordDisplayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  passwordDisplayTextMasked: {
    letterSpacing: 3,
    fontSize: 16,
    color: '#64748B',
  },
  eyeBtn: {
    padding: 4,
  },
  passwordHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  userDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  userDeleteBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  userDeleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  userDeleteBtnTextDisabled: {
    color: '#94A3B8',
  },
  deleteUserInModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  deleteUserInModalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  deleteWarningBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  deleteWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  deleteWarningText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  adminAuthLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  deleteModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  confirmDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
