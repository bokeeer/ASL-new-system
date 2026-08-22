import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "../../context/config";

// ── Translate endpoint derived from centralized API config ───────────────────
const TRANSLATE_URL = `${API_URL}/translate`;
// ────────────────────────────────────────────────────────────────────────────

type Direction = "en_to_asl" | "asl_to_en";

export default function TranslateScreen() {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<Direction>("en_to_asl");

  const fromLabel = direction === "en_to_asl" ? "Basic English" : "ASL Gloss";
  const toLabel   = direction === "en_to_asl" ? "ASL Gloss"    : "Basic English";
  const placeholder =
    direction === "en_to_asl"
      ? "Type in Basic English…"
      : "Type in ASL Gloss (e.g. IX WANT BAKE CAKE)…";

  const handleSwap = () => {
    setDirection((d) => (d === "en_to_asl" ? "asl_to_en" : "en_to_asl"));
    // Optionally carry over the previous result as the new input
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText("");
    } else {
      setInputText("");
      setTranslatedText("");
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setTranslatedText("");
    try {
      const response = await fetch(TRANSLATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, direction }),
      });
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const data = await response.json();
      setTranslatedText(data.result ?? data.error ?? "No result returned.");
    } catch (error: any) {
      console.error("Translation error:", error);
      Alert.alert(
        "Connection Error",
        "Could not reach the translation server.\n\nMake sure the Python server is running:\n  uvicorn server:app --host 0.0.0.0 --port 8000",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setTranslatedText("");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Translation Tool</Text>
          <Text style={styles.subtitle}>Translate between Basic English and ASL Gloss</Text>
        </View>

        {/* Language Toggles — tap the swap button to switch direction */}
        <TouchableOpacity style={styles.languageToggleCard} onPress={handleSwap} activeOpacity={0.85}>
          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>FROM</Text>
            <Text style={styles.languageActive}>{fromLabel}</Text>
          </View>

          <View style={styles.swapIconContainer}>
            <Ionicons name="swap-horizontal" size={24} color="white" />
          </View>

          <View style={styles.languageSection}>
            <Text style={styles.languageLabel}>TO</Text>
            <Text style={styles.languageInactive}>{toLabel}</Text>
          </View>
        </TouchableOpacity>

        {/* Input Area */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Text style={styles.inputTitle}>Enter text to translate</Text>
            {inputText.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <Ionicons name="close-circle-outline" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={inputText}
              onChangeText={setInputText}
            />
          </View>

          <Text style={styles.characterCount}>{inputText.length} characters</Text>
        </View>

        {/* Translate Button */}
        <TouchableOpacity
          style={[styles.translateButton, (loading || !inputText.trim()) && styles.translateButtonDisabled]}
          onPress={handleTranslate}
          disabled={loading || !inputText.trim()}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="white" />
              <Text style={[styles.translateButtonText, { marginLeft: 10 }]}>Translating…</Text>
            </View>
          ) : (
            <Text style={styles.translateButtonText}>Translate</Text>
          )}
        </TouchableOpacity>

        {/* Translation Result Card */}
        {translatedText !== "" && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleRow}>
                <Ionicons name="checkmark-circle" size={18} color="#12B3C9" />
                <Text style={styles.resultTitle}>{toLabel}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setInputText(translatedText);
                setDirection((d) => (d === "en_to_asl" ? "asl_to_en" : "en_to_asl"));
                setTranslatedText("");
              }}>
                <Ionicons name="swap-horizontal-outline" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text selectable style={styles.resultText}>{translatedText}</Text>
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Ionicons name="bulb" size={20} color="white" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>About ASL Gloss</Text>
            <Text style={styles.infoDescription}>
              ASL Gloss follows American Sign Language grammar. It uses concise
              vocabulary, removes articles, and emphasises visual clarity —
              e.g. "I want cake" → "IX WANT CAKE".
            </Text>
          </View>
        </View>

        {/* Server hint */}
        <View style={styles.hintCard}>
          <Ionicons name="server-outline" size={14} color="#9CA3AF" />
          <Text style={styles.hintText}>
            Make sure the Python server is running:{"\n"}
            <Text style={styles.hintCode}>uvicorn server:app --host 0.0.0.0 --port 8000</Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  container: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  // ── Language Toggle ──────────────────────────────────────────────────────
  languageToggleCard: {
    backgroundColor: "white",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  languageSection: {
    flex: 1,
    alignItems: "center",
  },
  languageLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "600",
  },
  languageActive: {
    fontSize: 15,
    color: "#12B3C9",
    fontWeight: "bold",
  },
  languageInactive: {
    fontSize: 15,
    color: "#FF8A65",
    fontWeight: "bold",
  },
  swapIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#12B3C9",
    justifyContent: "center",
    alignItems: "center",
  },
  // ── Input Card ───────────────────────────────────────────────────────────
  inputCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  inputTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  textInputContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    minHeight: 96,
  },
  characterCount: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
  },
  // ── Translate Button ─────────────────────────────────────────────────────
  translateButton: {
    backgroundColor: "#12B3C9",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#12B3C9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  translateButtonDisabled: {
    backgroundColor: "#93C5D4",
    shadowOpacity: 0,
    elevation: 0,
  },
  translateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  // ── Result Card ──────────────────────────────────────────────────────────
  resultCard: {
    backgroundColor: "#EFF9FB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#B2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#12B3C9",
    marginLeft: 6,
  },
  resultText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    lineHeight: 26,
  },
  // ── Info Card ────────────────────────────────────────────────────────────
  infoCard: {
    backgroundColor: "#FEFCE8",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#FEF08A",
    marginBottom: 12,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FACC15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    marginTop: 4,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  // ── Hint Card ────────────────────────────────────────────────────────────
  hintCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 18,
    marginLeft: 6,
  },
  hintCode: {
    fontFamily: "monospace",
    color: "#6B7280",
  },
});
