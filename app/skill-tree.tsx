import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../context/config';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string; bar: string }> = {
  mastered:    { color: '#10B981', bg: '#DCFCE7', icon: '⭐', label: 'Mastered',     bar: '#10B981' },
  learning:    { color: '#F59E0B', bg: '#FEF3C7', icon: '📖', label: 'Learning',     bar: '#F59E0B' },
  struggling:  { color: '#EF4444', bg: '#FEE2E2', icon: '🔥', label: 'Needs Work',   bar: '#EF4444' },
  not_started: { color: '#9CA3AF', bg: '#F3F4F6', icon: '○',  label: 'Not Started',  bar: '#D1D5DB' },
};

interface KCMastery {
  kc_name: string;
  display_name: string;
  topic_id: string;
  p_mastery: number;
  p_mastery_pct: number;
  status: string;
  total_opportunities: number;
  correct_count: number;
  wrong_count: number;
}

interface MasteryData {
  user_id: number;
  kc_mastery: KCMastery[];
  total_kcs: number;
  mastered: number;
  learning: number;
  struggling: number;
  not_started: number;
}

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', overflow: 'hidden', marginTop: 6 }}>
      <Animated.View style={{ width, height: '100%', backgroundColor: color, borderRadius: 5 }} />
    </View>
  );
}

type FilterType = 'all' | 'mastered' | 'learning' | 'struggling' | 'not_started';

export default function SkillTreeScreen() {
  const { user } = useAuth() as any;
  const { topicId } = useLocalSearchParams<{ topicId?: string }>();
  const [data, setData] = useState<MasteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (user?.id) fetchMastery();
  }, [user?.id, topicId]);

  const fetchMastery = async () => {
    setLoading(true);
    try {
      const url = topicId
        ? `${API_URL}/student/${user.id}/kc-mastery?topic_id=${topicId}`
        : `${API_URL}/student/${user.id}/kc-mastery`;
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const filtered = (data?.kc_mastery ?? []).filter(k => filter === 'all' || k.status === filter);

  const overallPct = data && data.total_kcs > 0
    ? Math.round((data.kc_mastery.reduce((a, k) => a + k.p_mastery, 0) / data.total_kcs) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🧠 Skill Tree</Text>
          <Text style={styles.headerSub}>Your knowledge mastery map (AI-powered)</Text>
        </View>
        <TouchableOpacity onPress={fetchMastery} style={styles.refreshIconBtn}>
          <Ionicons name="refresh" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Loading your skills...</Text>
        </View>
      ) : !data || data.total_kcs === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 56 }}>🌱</Text>
          <Text style={styles.emptyTitle}>No skills tracked yet</Text>
          <Text style={styles.emptyBody}>
            Answer quiz questions that are tagged with Knowledge Components to start tracking your skill mastery here.
          </Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchMastery}>
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Summary Cards */}
          <View style={styles.summaryRow}>
            {[
              { label: 'Mastered',    count: data.mastered,    color: '#10B981', bg: '#DCFCE7', icon: '⭐' },
              { label: 'Learning',    count: data.learning,    color: '#F59E0B', bg: '#FEF3C7', icon: '📖' },
              { label: 'Struggling',  count: data.struggling,  color: '#EF4444', bg: '#FEE2E2', icon: '🔥' },
              { label: 'Not Started', count: data.not_started, color: '#9CA3AF', bg: '#F3F4F6', icon: '○' },
            ].map(s => (
              <View key={s.label} style={[styles.summaryCard, { backgroundColor: s.bg }]}>
                <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
                <Text style={styles.summaryLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Overall Progress */}
          <View style={styles.overallCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.overallTitle}>Overall Mastery</Text>
              <Text style={[styles.overallPct, { color: overallPct >= 70 ? '#10B981' : overallPct >= 40 ? '#F59E0B' : '#7C3AED' }]}>
                {overallPct}%
              </Text>
            </View>
            <View style={{ height: 14, borderRadius: 7, backgroundColor: '#EDE9FE', overflow: 'hidden' }}>
              <View style={{
                width: `${overallPct}%`, height: '100%',
                backgroundColor: '#7C3AED', borderRadius: 7,
              }} />
            </View>
            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
              {data.mastered}/{data.total_kcs} skills mastered · BKT-powered
            </Text>
          </View>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {([
              ['all',         `All (${data.total_kcs})`],
              ['mastered',    `⭐ Mastered (${data.mastered})`],
              ['learning',    `📖 Learning (${data.learning})`],
              ['struggling',  `🔥 Struggling (${data.struggling})`],
              ['not_started', `○ Not Started (${data.not_started})`],
            ] as [FilterType, string][]).map(([f, label]) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* KC Cards */}
          {filtered.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ color: '#9CA3AF' }}>No skills in this category.</Text>
            </View>
          ) : filtered.map(kc => {
            const cfg = STATUS_CONFIG[kc.status] ?? STATUS_CONFIG.not_started;
            return (
              <View key={kc.kc_name} style={[styles.kcCard, { borderLeftColor: cfg.color }]}>
                {/* KC Header */}
                <View style={styles.kcTop}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                      <Text style={styles.kcName}>{kc.display_name}</Text>
                    </View>
                    <Text style={styles.kcId}>{kc.kc_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Mastery bar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                  <Text style={styles.masteryLabel}>P(mastery) — BKT estimate</Text>
                  <Text style={[styles.masteryPct, { color: cfg.color }]}>{kc.p_mastery_pct}%</Text>
                </View>
                <AnimatedBar pct={kc.p_mastery_pct} color={cfg.bar} />

                {/* Stats row */}
                {kc.total_opportunities > 0 && (
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                      <Text style={styles.statText}>{kc.correct_count} correct</Text>
                    </View>
                    <View style={styles.stat}>
                      <Ionicons name="close-circle" size={13} color="#EF4444" />
                      <Text style={styles.statText}>{kc.wrong_count} wrong</Text>
                    </View>
                    <View style={styles.stat}>
                      <Ionicons name="layers-outline" size={13} color="#6B7280" />
                      <Text style={styles.statText}>{kc.total_opportunities} answers</Text>
                    </View>
                  </View>
                )}

                {/* Context hints */}
                {kc.status === 'struggling' && (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintText}>
                      💡 The AI will prioritise questions from this skill in your next quiz session.
                    </Text>
                  </View>
                )}
                {kc.status === 'learning' && kc.total_opportunities > 0 && (
                  <View style={[styles.hintBox, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.hintText, { color: '#92400E' }]}>
                      📈 You're making progress! Keep answering to build mastery.
                    </Text>
                  </View>
                )}
                {kc.status === 'mastered' && (
                  <View style={[styles.hintBox, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={[styles.hintText, { color: '#065F46' }]}>
                      🎉 Great work! You've mastered this skill.
                    </Text>
                  </View>
                )}
                {kc.status === 'not_started' && (
                  <Text style={styles.notStartedText}>
                    Answer quiz questions tagged with this skill to begin tracking.
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F3FF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 14,
    backgroundColor: '#F5F3FF',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center',
  },
  refreshIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#7C3AED', marginTop: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginTop: 16 },
  emptyBody: { color: '#6B7280', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center' },
  summaryCount: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  summaryLabel: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  overallCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#EDE9FE',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  overallTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  overallPct: { fontSize: 18, fontWeight: 'bold' },

  filterRow: { gap: 8, marginBottom: 16, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EDE9FE' },
  filterChipActive: { backgroundColor: '#7C3AED' },
  filterChipText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  filterChipTextActive: { color: 'white' },

  kcCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
    borderLeftWidth: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  kcTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  kcName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', flexShrink: 1 },
  kcId: { fontSize: 11, color: '#9CA3AF', marginTop: 2, marginLeft: 28 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  masteryLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  masteryPct: { fontSize: 13, fontWeight: 'bold' },

  statsRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#6B7280' },

  hintBox: { backgroundColor: '#FEE2E2', borderRadius: 8, padding: 10, marginTop: 10 },
  hintText: { fontSize: 12, color: '#991B1B', lineHeight: 16 },
  notStartedText: { fontSize: 12, color: '#9CA3AF', marginTop: 10 },

  refreshBtn: {
    marginTop: 24, backgroundColor: '#7C3AED',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  refreshBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});
