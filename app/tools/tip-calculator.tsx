import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, Animated,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";

const ACCENT = "#059669";
const ACCENT_LIGHT = "#ECFDF5";

const TIP_PRESETS = [10, 15, 18, 20, 25, 30];
const SPLIT_MAX = 10;

export default function TipCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [bill, setBill] = useState("");
  const [tip, setTip] = useState(15);
  const [split, setSplit] = useState(1);
  const [customTip, setCustomTip] = useState("");
  const [currency, setCurrency] = useState("$");

  const billNum = parseFloat(bill) || 0;
  const tipPct = customTip ? parseFloat(customTip) || 0 : tip;
  const tipAmt = billNum * (tipPct / 100);
  const total = billNum + tipAmt;
  const perPerson = split > 0 ? total / split : total;
  const tipPerPerson = split > 0 ? tipAmt / split : tipAmt;

  const CURRENCIES = ["$", "€", "£", "₹", "¥", "AED", "SAR", "PKR"];

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader title="Tip Calculator" subtitle="Split bills instantly" accentColor={ACCENT} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Bill Input */}
        <View style={s.card}>
          <Text style={s.label}>Bill Amount</Text>
          <View style={s.billRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 140 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {CURRENCIES.map((c) => (
                  <Pressable key={c} onPress={() => { Haptics.selectionAsync(); setCurrency(c); }} style={[s.currBtn, currency === c && s.currBtnOn]}>
                    <Text style={[s.currText, currency === c && s.currTextOn]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={s.billInputWrap}>
              <Text style={s.currSymbol}>{currency}</Text>
              <TextInput
                style={s.billInput}
                value={bill}
                onChangeText={setBill}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Tip Selector */}
        <View style={s.card}>
          <Text style={s.label}>Tip Percentage</Text>
          <View style={s.tipGrid}>
            {TIP_PRESETS.map((t) => (
              <Pressable
                key={t}
                onPress={() => { Haptics.selectionAsync(); setTip(t); setCustomTip(""); }}
                style={[s.tipBtn, tip === t && !customTip && s.tipBtnOn]}
              >
                <Text style={[s.tipBtnText, tip === t && !customTip && s.tipBtnTextOn]}>{t}%</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.customRow}>
            <Text style={s.customLabel}>Custom %</Text>
            <TextInput
              style={s.customInput}
              value={customTip}
              onChangeText={setCustomTip}
              placeholder="Enter %"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Split */}
        <View style={s.card}>
          <Text style={s.label}>Split Between</Text>
          <View style={s.splitRow}>
            <Pressable onPress={() => { if (split > 1) { Haptics.selectionAsync(); setSplit((p) => p - 1); } }} style={[s.splitBtn, split <= 1 && s.splitBtnDis]}>
              <Ionicons name="remove" size={22} color={split <= 1 ? Colors.textMuted : ACCENT} />
            </Pressable>
            <View style={s.splitCountBox}>
              <Text style={s.splitCount}>{split}</Text>
              <Text style={s.splitPerson}>{split === 1 ? "person" : "people"}</Text>
            </View>
            <Pressable onPress={() => { if (split < SPLIT_MAX) { Haptics.selectionAsync(); setSplit((p) => p + 1); } }} style={[s.splitBtn, split >= SPLIT_MAX && s.splitBtnDis]}>
              <Ionicons name="add" size={22} color={split >= SPLIT_MAX ? Colors.textMuted : ACCENT} />
            </Pressable>
          </View>
          <View style={s.splitAvatars}>
            {Array.from({ length: Math.min(split, 8) }).map((_, i) => (
              <View key={i} style={s.avatar}>
                <MaterialCommunityIcons name="account" size={16} color={ACCENT} />
              </View>
            ))}
            {split > 8 && <Text style={s.moreText}>+{split - 8}</Text>}
          </View>
        </View>

        {/* Results */}
        <View style={[s.card, s.resultCard]}>
          <Text style={s.resultTitle}>Summary</Text>
          <View style={s.resultRow}>
            <Text style={s.resultLabel}>Bill</Text>
            <Text style={s.resultValue}>{currency}{billNum.toFixed(2)}</Text>
          </View>
          <View style={s.resultRow}>
            <Text style={s.resultLabel}>Tip ({tipPct}%)</Text>
            <Text style={s.resultValue}>{currency}{tipAmt.toFixed(2)}</Text>
          </View>
          <View style={[s.resultRow, s.totalRow]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{currency}{total.toFixed(2)}</Text>
          </View>
        </View>

        {split > 1 && (
          <View style={[s.card, { backgroundColor: ACCENT }]}>
            <Text style={[s.resultTitle, { color: Colors.white }]}>Per Person ({split} people)</Text>
            <View style={s.resultRow}>
              <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>Each pays</Text>
              <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 28, color: Colors.white }}>{currency}{perPerson.toFixed(2)}</Text>
            </View>
            <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              Includes {currency}{tipPerPerson.toFixed(2)} tip each
            </Text>
          </View>
        )}

        {split === 1 && (
          <View style={[s.card, { backgroundColor: ACCENT, alignItems: "center" }]}>
            <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: "rgba(255,255,255,0.75)" }}>Total to Pay</Text>
            <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 40, color: Colors.white, marginTop: 4 }}>{currency}{total.toFixed(2)}</Text>
            <Text style={{ fontFamily: "Poppins_400Regular", fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              Including {currency}{tipAmt.toFixed(2)} tip
            </Text>
          </View>
        )}

        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setBill(""); setCustomTip(""); setTip(15); setSplit(1); }} style={s.resetBtn}>
          <Ionicons name="refresh-outline" size={16} color={Colors.textSecondary} />
          <Text style={s.resetText}>Reset</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: Colors.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.cardBorder, gap: 12 },
  label: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  billRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  currBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.separator },
  currBtnOn: { backgroundColor: ACCENT },
  currText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  currTextOn: { color: Colors.white },
  billInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: Colors.separator, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  currSymbol: { fontFamily: "Poppins_600SemiBold", fontSize: 18, color: ACCENT, marginRight: 4 },
  billInput: { flex: 1, fontFamily: "Poppins_700Bold", fontSize: 24, color: Colors.text, paddingVertical: 10 },
  tipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tipBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, backgroundColor: Colors.separator, borderWidth: 1.5, borderColor: Colors.cardBorder },
  tipBtnOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  tipBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  tipBtnTextOn: { color: ACCENT },
  customRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  customLabel: { fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.textSecondary },
  customInput: { flex: 1, backgroundColor: Colors.separator, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.cardBorder },
  splitRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  splitBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: ACCENT },
  splitBtnDis: { backgroundColor: Colors.separator, borderColor: Colors.cardBorder },
  splitCountBox: { alignItems: "center" },
  splitCount: { fontFamily: "Poppins_700Bold", fontSize: 36, color: Colors.text },
  splitPerson: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary },
  splitAvatars: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: ACCENT },
  moreText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: ACCENT, alignSelf: "center" },
  resultTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.text },
  resultCard: { gap: 10 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultLabel: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary },
  resultValue: { fontFamily: "Poppins_600SemiBold", fontSize: 15, color: Colors.text },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.separator, paddingTop: 10, marginTop: 4 },
  totalLabel: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.text },
  totalValue: { fontFamily: "Poppins_700Bold", fontSize: 22, color: ACCENT },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  resetText: { fontFamily: "Poppins_500Medium", fontSize: 14, color: Colors.textSecondary },
});
