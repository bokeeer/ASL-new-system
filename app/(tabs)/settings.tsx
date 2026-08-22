import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, Platform, Modal, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { API_URL } from "../../context/config";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const userId = user?.id || 1;

  // Profile Edit Modal State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Change Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Help Modal State
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) {
      showAlert("Error", "Please enter a valid display name.");
      return;
    }
    setUpdatingProfile(true);
    try {
      const res = await fetch(`${API_URL}/student/${userId}/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed.");
      showAlert("Success", "Your profile name has been updated!");
      setProfileModalVisible(false);
    } catch (err: any) {
      showAlert("Error", err.message || "Could not update profile.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showAlert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Error", "New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      showAlert("Error", "New password must be at least 4 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/student/${userId}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Password change failed.");
      showAlert("Success", "Your password has been changed successfully!");
      setPasswordModalVisible(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      showAlert("Error", err.message || "Could not change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm("Are you sure you want to log out of your account?");
      if (confirmLogout) {
        logout().then(() => {
          router.replace("/");
        });
      }
    } else {
      Alert.alert(
        "Confirm Logout",
        "Are you sure you want to log out of your account?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Log Out", 
            style: "destructive", 
            onPress: async () => {
              await logout();
              router.replace("/");
            } 
          }
        ]
      );
    }
  };

  type SettingItemProps = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    color: string;
    isLast?: boolean;
    onPress?: () => void;
  };

  const SettingItem = ({ icon, title, color, isLast = false, onPress = () => {} }: SettingItemProps) => (
    <TouchableOpacity style={[styles.settingItem, !isLast && styles.settingItemBorder]} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: '#F3F4F6' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.settingTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#0284C7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Account Section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="person-outline"
            title="Profile Information"
            color="#0284C7"
            onPress={() => {
              setNewName(user?.name || "");
              setProfileModalVisible(true);
            }}
          />
          <SettingItem
            icon="lock-closed-outline"
            title="Change Password"
            color="#0284C7"
            isLast
            onPress={() => setPasswordModalVisible(true)}
          />
        </View>

        {/* Gamification & Progress */}
        <Text style={styles.sectionTitle}>Achievements & Competition</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="trophy-outline"
            title="Achievement Badges"
            color="#7C3AED"
            onPress={() => router.push('/badges')}
          />
          <SettingItem
            icon="flame-outline"
            title="Class Leaderboard"
            color="#EA580C"
            isLast
            onPress={() => router.push('/leaderboard')}
          />
        </View>

        {/* Reports Section */}
        <Text style={styles.sectionTitle}>Reports</Text>
        <View style={styles.sectionCard}>
          <SettingItem icon="document-text-outline" title="Generate Report" color="#0284C7" onPress={() => router.push('/report')} />
          <SettingItem icon="documents-outline" title="View Past Reports" color="#0284C7" isLast onPress={() => router.push('/past-reports')} />
        </View>

        {/* Preferences Section */}
        <Text style={styles.sectionTitle}>Preferences & Help</Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon="help-circle-outline"
            title="Help & Deaf Accessibility Info"
            color="#0284C7"
            isLast
            onPress={() => setHelpModalVisible(true)}
          />
        </View>

        {/* Account Actions Section */}
        <Text style={styles.sectionTitle}>Account Actions</Text>
        <View style={[styles.sectionCard, styles.logoutCard]}>
          <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
            <View style={[styles.iconContainer, { backgroundColor: '#FFF5F5' }]}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.settingTitle, { color: '#EF4444' }]}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Version Info */}
        <Text style={styles.versionText}>Sign Language Learning App v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={profileModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Information</Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Username (Account ID)</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>@{user?.username || 'student'}</Text>
            </View>

            <Text style={[styles.modalLabel, { marginTop: 14 }]}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Your full name"
            />

            <TouchableOpacity
              style={[styles.modalActionBtn, updatingProfile && { opacity: 0.6 }]}
              onPress={handleUpdateProfile}
              disabled={updatingProfile}
            >
              {updatingProfile ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.modalActionBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Current Password</Text>
            <TextInput
              style={styles.modalInput}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Enter current password"
              secureTextEntry
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password (min 4 chars)"
              secureTextEntry
            />

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.modalActionBtn, changingPassword && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.modalActionBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help & Support FAQ Modal */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deaf Accessibility & FAQ</Text>
              <TouchableOpacity onPress={() => setHelpModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.faqCard}>
                <Text style={styles.faqQ}>What is the In-Lesson ASL Helper?</Text>
                <Text style={styles.faqA}>
                  Tap the floating purple ASL icon during any lesson slide or quiz to get an instant ASL Gloss translation powered by the neural mBART-50 model.
                </Text>
              </View>

              <View style={styles.faqCard}>
                <Text style={styles.faqQ}>How do Hints work in Quizzes?</Text>
                <Text style={styles.faqA}>
                  Using a Hint costs 5 Stars and gives you a visual clue while eliminating one incorrect distractor option to reduce cognitive load.
                </Text>
              </View>

              <View style={styles.faqCard}>
                <Text style={styles.faqQ}>How do I maintain my Learning Streak?</Text>
                <Text style={styles.faqA}>
                  Complete at least one lesson quiz or daily quiz slot every day. If your streak breaks, you can use 30 Stars on the Daily Quiz screen to repair it!
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  settingTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  logoutCard: {
    borderColor: "#FFE4E6",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  readOnlyInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readOnlyText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalActionBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  modalActionBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  faqCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  faqQ: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
    marginBottom: 6,
  },
  faqA: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
  },
});
