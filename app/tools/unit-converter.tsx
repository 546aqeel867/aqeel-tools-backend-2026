import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";

type Category = "weight" | "length" | "temperature";

const CATEGORIES: { key: Category; label: string; icon: string; color: string; bg: string }[] = [
  { key: "weight", label: "Weight", icon: "scale-balance", color: "#D97706", bg: "#FFFBEB" },
  { key: "length", label: "Length", icon: "ruler", color: "#2563EB", bg: "#EBF2FF" },
  { key: "temperature", label: "Temperature", icon: "thermometer", color: "#DB2777", bg: "#FDF2F8" },
];

const UNITS: Record<Category, { key: string; label: string; toBase: (v: number) => number; fromBase: (v: number) => number }[]> = {
  weight: [
    { key: "kg", label: "Kilogram (kg)", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { key: "g", label: "Gram (g)", toBase: (v) => v, fromBase: (v) => v },
    { key: "lb", label: "Pound (lb)", toBase: (v) => v * 453.592, fromBase: (v) => v / 453.592 },
    { key: "oz", label: "Ounce (oz)", toBase: (v) => v * 28.3495, fromBase: (v) => v / 28.3495 },
    { key: "t", label: "Tonne (t)", toBase: (v) => v * 1e6, fromBase: (v) => v / 1e6 },
  ],
  length: [
    { key: "km", label: "Kilometer (km)", toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
    { key: "m", label: "Meter (m)", toBase: (v) => v, fromBase: (v) => v },
    { key: "cm", label: "Centimeter (cm)", toBase: (v) => v / 100, fromBase: (v) => v * 100 },
    { key: "mm", label: "Millimeter (mm)", toBase: (v) => v / 1000, fromBase: (v) => v * 1000 },
    { key: "mi", label: "Mile (mi)", toBase: (v) => v * 1609.34, fromBase: (v) => v / 1609.34 },
    { key: "ft", label: "Foot (ft)", toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
    { key: "in", label: "Inch (in)", toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
  ],
  temperature: [
    { key: "C", label: "Celsius (°C)", toBase: (v) => v, fromBase: (v) => v },
    { key: "F", label: "Fahrenheit (°F)", toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
    { key: "K", label: "Kelvin (K)", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
  ],
};

function fmt(v: number): string {
  if (!isFinite(v)) return "—";
  if (Math.abs(v) > 1e10 || (Math.abs(v) < 1e-6 && v !== 0)) return v.toExponential(4);
  return parseFloat(v.toPrecision(8)).toString();
}

export default function UnitConverter() {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<Category>("weight");
  const [inputValue, setInputValue] = useState("1");
  const [fromUnit, setFromUnit] = useState("kg");

  const catMeta = CATEGORIES.find((c) => c.key === category)!;
  const units = UNITS[category];
  const numVal = parseFloat(inputValue) || 0;
  const fromDef = units.find((u) => u.key === fromUnit) ?? units[0];
  const baseVal = fromDef.toBase(numVal);

  const handleCategory = (cat: Category) => {
    Haptics.selectionAsync();
    setCategory(cat);
    setFromUnit(UNITS[cat][0].key);
    setInputValue("1");
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <View style={styles.container}>
      <ToolHeader title="Unit Converter" subtitle="Weight, Length & Temperature" accentColor="#D97706" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.catRow}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => handleCategory(cat.key)}
              style={[styles.catCard, category === cat.key && { borderColor: cat.color, backgroundColor: cat.bg }]}
            >
              <Ionicons name={cat.icon as any} size={20} color={category === cat.key ? cat.color : Colors.textSecondary} />
              <Text style={[styles.catLabel, category === cat.key && { color: cat.color }]}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Enter Value</Text>
          <TextInput
            style={[styles.bigInput, { borderBottomColor: catMeta.color }]}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            selectTextOnFocus
          />
          <Text style={styles.label}>Convert From</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {units.map((u) => (
                <Pressable
                  key={u.key}
                  onPress={() => { Haptics.selectionAsync(); setFromUnit(u.key); }}
                  style={[styles.chip, fromUnit === u.key && { backgroundColor: catMeta.color, borderColor: catMeta.color }]}
                >
                  <Text style={[styles.chipText, fromUnit === u.key && { color: Colors.white }]}>{u.key}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <Text style={styles.sectionTitle}>All Conversions</Text>
        <View style={styles.listCard}>
          {units.map((unit, i) => {
            const result = unit.fromBase(baseVal);
            const isActive = unit.key === fromUnit;
            return (
              <View key={unit.key} style={[styles.resultRow, i === units.length - 1 && { borderBottomWidth: 0 }, isActive && { backgroundColor: catMeta.bg }]}>
                <View>
                  <Text style={[styles.unitKey, isActive && { color: catMeta.color }]}>{unit.key}</Text>
                  <Text style={styles.unitLabel} numberOfLines={1}>{unit.label}</Text>
                </View>
                <Text style={[styles.resultVal, isActive && { color: catMeta.color }]} numberOfLines={1}>
                  {numVal === 0 ? "0" : fmt(result)}
                </Text>
              </View>
            );
          })}
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
  catRow: { flexDirection: "row", gap: 8 },
  catCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  catLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  bigInput: {
    fontFamily: "Poppins_700Bold",
    fontSize: 40,
    color: Colors.text,
    borderBottomWidth: 2,
    paddingVertical: 4,
  },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.separator,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.text,
    marginTop: 4,
  },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  unitKey: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
    color: Colors.text,
  },
  unitLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    maxWidth: 140,
  },
  resultVal: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 17,
    color: Colors.text,
    textAlign: "right",
  },
});
