import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";

function getBMICategory(bmi: number): { label: string; color: string; emoji: string; tip: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "#0891B2", emoji: "🔵", tip: "Consider increasing your caloric intake with nutritious foods." };
  if (bmi < 25) return { label: "Normal Weight", color: "#059669", emoji: "🟢", tip: "Great job! Maintain your current healthy lifestyle." };
  if (bmi < 30) return { label: "Overweight", color: "#D97706", emoji: "🟡", tip: "Regular exercise and a balanced diet can help." };
  return { label: "Obese", color: "#DC2626", emoji: "🔴", tip: "Please consult a healthcare professional for guidance." };
}

export default function BMICalculator() {
  const insets = useSafeAreaInsets();
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState<"metric" | "imperial">("metric");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const w = parseFloat(weight) || 0;
  const h = parseFloat(height) || 0;

  let bmi = 0;
  if (w > 0 && h > 0) {
    if (unit === "metric") {
      const hM = h / 100;
      bmi = w / (hM * hM);
    } else {
      bmi = (703 * w) / (h * h);
    }
  }

  const bmiCategory = bmi > 0 ? getBMICategory(bmi) : null;

  const idealWeightMin = unit === "metric"
    ? (18.5 * Math.pow(h / 100, 2)).toFixed(1)
    : (18.5 * h * h / 703).toFixed(1);
  const idealWeightMax = unit === "metric"
    ? (24.9 * Math.pow(h / 100, 2)).toFixed(1)
    : (24.9 * h * h / 703).toFixed(1);

  const clear = () => {
    Haptics.selectionAsync();
    setWeight(""); setHeight(""); setAge("");
  };

  const barWidth = bmi > 0 ? Math.min(Math.max(((bmi - 10) / 30) * 100, 0), 100) : 0;

  return (
    <View style={styles.container}>
      <ToolHeader title="BMI Calculator" subtitle="Body Mass Index & health insights" accentColor="#DB2777" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.unitRow}>
          {(["metric", "imperial"] as const).map(u => (
            <Pressable
              key={u}
              onPress={() => { Haptics.selectionAsync(); setUnit(u); setWeight(""); setHeight(""); }}
              style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
            >
              <Text style={[styles.unitBtnText, unit === u && { color: Colors.white }]}>
                {u === "metric" ? "Metric (kg/cm)" : "Imperial (lb/in)"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.genderRow}>
          {(["male", "female"] as const).map(g => (
            <Pressable
              key={g}
              onPress={() => { Haptics.selectionAsync(); setGender(g); }}
              style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
            >
              <Ionicons
                name={g === "male" ? "male" : "female"}
                size={20}
                color={gender === g ? Colors.white : Colors.textSecondary}
              />
              <Text style={[styles.genderBtnText, gender === g && { color: Colors.white }]}>
                {g === "male" ? "Male" : "Female"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputsCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Weight ({unit === "metric" ? "kg" : "lbs"})
            </Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="weight-kilogram" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder={unit === "metric" ? "e.g. 70" : "e.g. 154"}
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.unitTag}>{unit === "metric" ? "kg" : "lb"}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Height ({unit === "metric" ? "cm" : "inches"})
            </Text>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="human-male-height" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
                placeholder={unit === "metric" ? "e.g. 175" : "e.g. 69"}
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.unitTag}>{unit === "metric" ? "cm" : "in"}</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age (optional)</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="e.g. 25"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.unitTag}>yrs</Text>
            </View>
          </View>

          <Pressable onPress={clear} style={styles.clearBtn}>
            <Ionicons name="refresh" size={14} color={Colors.textSecondary} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        </View>

        {bmi > 0 && bmiCategory ? (
          <>
            <View style={[styles.resultCard, { borderColor: bmiCategory.color }]}>
              <Text style={styles.bmiEmoji}>{bmiCategory.emoji}</Text>
              <Text style={[styles.bmiValue, { color: bmiCategory.color }]}>{bmi.toFixed(1)}</Text>
              <Text style={styles.bmiLabel}>BMI</Text>
              <Text style={[styles.bmiCategory, { color: bmiCategory.color }]}>{bmiCategory.label}</Text>
            </View>

            <View style={styles.barCard}>
              <Text style={styles.barTitle}>BMI Scale</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barSegment, { backgroundColor: "#0891B2", flex: 1 }]} />
                <View style={[styles.barSegment, { backgroundColor: "#059669", flex: 1.3 }]} />
                <View style={[styles.barSegment, { backgroundColor: "#D97706", flex: 1 }]} />
                <View style={[styles.barSegment, { backgroundColor: "#DC2626", flex: 1.7 }]} />
              </View>
              <View style={styles.barLabels}>
                <Text style={styles.barLabel}>Under{"\n"}18.5</Text>
                <Text style={styles.barLabel}>Normal{"\n"}18.5-25</Text>
                <Text style={styles.barLabel}>Over{"\n"}25-30</Text>
                <Text style={styles.barLabel}>Obese{"\n"}30+</Text>
              </View>
              <View style={[styles.barIndicator, { left: `${barWidth}%` as any }]}>
                <View style={[styles.barDot, { backgroundColor: bmiCategory.color }]} />
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="body-outline" size={22} color="#DB2777" />
                <Text style={styles.statValue}>{idealWeightMin}-{idealWeightMax}</Text>
                <Text style={styles.statLabel}>Ideal Weight ({unit === "metric" ? "kg" : "lb"})</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="fitness-outline" size={22} color="#7C3AED" />
                <Text style={styles.statValue}>{bmi.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Your BMI</Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <Ionicons name="information-circle-outline" size={18} color="#DB2777" />
              <Text style={styles.tipText}>{bmiCategory.tip}</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="human" size={48} color={Colors.cardBorder} />
            <Text style={styles.emptyText}>Enter your weight and height to calculate BMI</Text>
          </View>
        )}

        <View style={styles.scaleCard}>
          <Text style={styles.scaleTitle}>BMI Categories</Text>
          {[
            { range: "Below 18.5", cat: "Underweight", color: "#0891B2" },
            { range: "18.5 – 24.9", cat: "Normal weight", color: "#059669" },
            { range: "25.0 – 29.9", cat: "Overweight", color: "#D97706" },
            { range: "30.0 and above", cat: "Obese", color: "#DC2626" },
          ].map(item => (
            <View key={item.cat} style={styles.scaleRow}>
              <View style={[styles.scaleDot, { backgroundColor: item.color }]} />
              <Text style={styles.scaleRange}>{item.range}</Text>
              <Text style={[styles.scaleCat, { color: item.color }]}>{item.cat}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: Colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14 },
  unitRow: { flexDirection: "row", gap: 8 },
  unitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: "center",
  },
  unitBtnActive: { backgroundColor: "#DB2777", borderColor: "#DB2777" },
  unitBtnText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  genderRow: { flexDirection: "row", gap: 8 },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  genderBtnActive: { backgroundColor: "#DB2777", borderColor: "#DB2777" },
  genderBtnText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.textSecondary },
  inputsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  inputGroup: { gap: 6 },
  inputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.separator,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 18,
    color: Colors.text,
  },
  unitTag: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    ...CARD_SHADOW,
  },
  bmiEmoji: { fontSize: 40 },
  bmiValue: { fontFamily: "Poppins_700Bold", fontSize: 56, letterSpacing: -2 },
  bmiLabel: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary },
  bmiCategory: { fontFamily: "Poppins_700Bold", fontSize: 20 },
  barCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  barTitle: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary, textTransform: "uppercase" },
  barTrack: { flexDirection: "row", height: 10, borderRadius: 10, overflow: "hidden", gap: 2 },
  barSegment: { borderRadius: 10 },
  barLabels: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontFamily: "Poppins_400Regular", fontSize: 9, color: Colors.textMuted, textAlign: "center", flex: 1 },
  barIndicator: { position: "absolute", bottom: 28, transform: [{ translateX: -6 }] },
  barDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.white },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  statValue: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  statLabel: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textSecondary, textAlign: "center" },
  tipCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "#FDF2F8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FBCFE8",
    alignItems: "flex-start",
  },
  tipText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "#9D174D", flex: 1, lineHeight: 20 },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textMuted, textAlign: "center" },
  scaleCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  scaleTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text, marginBottom: 4 },
  scaleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scaleDot: { width: 10, height: 10, borderRadius: 5 },
  scaleRange: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary, width: 110 },
  scaleCat: { fontFamily: "Poppins_600SemiBold", fontSize: 12 },
});
