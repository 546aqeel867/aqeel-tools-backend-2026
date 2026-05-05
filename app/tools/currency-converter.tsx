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

const CURRENCIES = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸", rate: 1 },
  { code: "EUR", name: "Euro", flag: "🇪🇺", rate: 0.92 },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", rate: 0.79 },
  { code: "SAR", name: "Saudi Riyal", flag: "🇸🇦", rate: 3.75 },
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪", rate: 3.67 },
  { code: "PKR", name: "Pakistani Rupee", flag: "🇵🇰", rate: 278.5 },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳", rate: 83.1 },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", rate: 7.24 },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", rate: 149.5 },
  { code: "KRW", name: "South Korean Won", flag: "🇰🇷", rate: 1320 },
  { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", rate: 32.1 },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", rate: 1.36 },
  { code: "AUD", name: "Australian Dollar", flag: "🇦🇺", rate: 1.53 },
  { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", rate: 0.88 },
  { code: "EGP", name: "Egyptian Pound", flag: "🇪🇬", rate: 30.9 },
];

export default function CurrencyConverter() {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("1");
  const [fromCurr, setFromCurr] = useState("USD");
  const [toCurr, setToCurr] = useState("SAR");
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const from = CURRENCIES.find(c => c.code === fromCurr)!;
  const to = CURRENCIES.find(c => c.code === toCurr)!;
  const numAmount = parseFloat(amount) || 0;
  const usdVal = numAmount / from.rate;
  const converted = usdVal * to.rate;

  const swap = () => {
    Haptics.selectionAsync();
    setFromCurr(toCurr);
    setToCurr(fromCurr);
  };

  const CurrPicker = ({ visible, selected, onSelect, onClose }: {
    visible: boolean; selected: string; onSelect: (c: string) => void; onClose: () => void;
  }) => {
    if (!visible) return null;
    return (
      <View style={styles.overlay}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Currency</Text>
            <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={Colors.text} /></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
            {CURRENCIES.map(c => (
              <Pressable
                key={c.code}
                onPress={() => { onSelect(c.code); onClose(); Haptics.selectionAsync(); }}
                style={[styles.currItem, selected === c.code && styles.currItemActive]}
              >
                <Text style={styles.currFlag}>{c.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.currCode, selected === c.code && { color: Colors.primary }]}>{c.code}</Text>
                  <Text style={styles.currName}>{c.name}</Text>
                </View>
                {selected === c.code && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ToolHeader title="Currency Converter" subtitle="Real-time rate estimates" accentColor="#059669" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.heroCard}>
          <MaterialCommunityIcons name="currency-usd" size={32} color="#059669" />
          <Text style={styles.heroTitle}>15 Major Currencies</Text>
          <Text style={styles.heroSub}>Rates updated periodically. For live rates, check your bank.</Text>
        </View>

        <View style={styles.converterCard}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currSymbol}>{from.flag}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="1"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.codeTag}>{fromCurr}</Text>
          </View>

          <View style={styles.langRow}>
            <Pressable onPress={() => { setShowFrom(true); setShowTo(false); }} style={styles.langBtn}>
              <Text style={styles.currFlag}>{from.flag}</Text>
              <Text style={styles.langBtnText}>{from.code} — {from.name}</Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <Pressable onPress={swap} style={styles.swapRow}>
            <View style={styles.swapLine} />
            <View style={styles.swapCircle}>
              <Ionicons name="swap-vertical" size={18} color={Colors.primary} />
            </View>
            <View style={styles.swapLine} />
          </Pressable>

          <View style={styles.langRow}>
            <Pressable onPress={() => { setShowTo(true); setShowFrom(false); }} style={styles.langBtn}>
              <Text style={styles.currFlag}>{to.flag}</Text>
              <Text style={styles.langBtnText}>{to.code} — {to.name}</Text>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>{numAmount} {fromCurr} =</Text>
            <Text style={styles.resultValue}>{converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</Text>
            <Text style={styles.resultCurr}>{toCurr}</Text>
          </View>

          <Text style={styles.rateNote}>
            1 {fromCurr} = {(to.rate / from.rate).toFixed(4)} {toCurr}
          </Text>
        </View>

        <View style={styles.allRatesCard}>
          <Text style={styles.allRatesTitle}>All Rates (1 {fromCurr})</Text>
          {CURRENCIES.filter(c => c.code !== fromCurr).map(c => (
            <Pressable
              key={c.code}
              onPress={() => { Haptics.selectionAsync(); setToCurr(c.code); }}
              style={[styles.rateRow, toCurr === c.code && styles.rateRowActive]}
            >
              <Text style={styles.rateFlag}>{c.flag}</Text>
              <Text style={styles.rateCode}>{c.code}</Text>
              <Text style={styles.rateName}>{c.name}</Text>
              <Text style={[styles.rateValue, toCurr === c.code && { color: Colors.primary }]}>
                {((c.rate / from.rate) * numAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <CurrPicker visible={showFrom} selected={fromCurr} onSelect={setFromCurr} onClose={() => setShowFrom(false)} />
      <CurrPicker visible={showTo} selected={toCurr} onSelect={setToCurr} onClose={() => setShowTo(false)} />
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
  heroCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  heroTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  heroSub: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, textAlign: "center" },
  converterCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  label: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.separator,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  currSymbol: { fontSize: 22 },
  amountInput: {
    flex: 1,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 22,
    color: Colors.text,
  },
  codeTag: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  langRow: {},
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.separator,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  currFlag: { fontSize: 22 },
  langBtnText: { fontFamily: "Poppins_500Medium", fontSize: 13, color: Colors.text, flex: 1 },
  swapRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  swapLine: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
  swapCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  resultBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resultLabel: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary },
  resultValue: { fontFamily: "Poppins_700Bold", fontSize: 36, color: Colors.primary, letterSpacing: -1 },
  resultCurr: { fontFamily: "Poppins_500Medium", fontSize: 16, color: Colors.primary },
  rateNote: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "center" },
  allRatesCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 0,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  allRatesTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  rateRowActive: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 8 },
  rateFlag: { fontSize: 18 },
  rateCode: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text, width: 40 },
  rateName: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary, flex: 1 },
  rateValue: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    padding: 24,
  },
  pickerCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxHeight: 440,
  },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  pickerTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.text },
  currItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  currItemActive: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 8 },
  currCode: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.text },
  currName: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary },
});
