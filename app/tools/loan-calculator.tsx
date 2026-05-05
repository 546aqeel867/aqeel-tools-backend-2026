import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";

const LOAN_TYPES = [
  { label: "Personal Loan", icon: "person-outline", color: "#7C3AED" },
  { label: "Home Loan", icon: "home-outline", color: "#059669" },
  { label: "Car Loan", icon: "car-outline", color: "#D97706" },
  { label: "Education Loan", icon: "school-outline", color: "#0891B2" },
];

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function LoanCalculator() {
  const insets = useSafeAreaInsets();
  const [loanType, setLoanType] = useState(LOAN_TYPES[0]);
  const [principal, setPrincipal] = useState("100000");
  const [rate, setRate] = useState("8.5");
  const [tenure, setTenure] = useState("12");
  const [tenureUnit, setTenureUnit] = useState<"months" | "years">("months");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const result = useMemo(() => {
    const p = parseFloat(principal.replace(/,/g, "")) || 0;
    const r = parseFloat(rate) || 0;
    const t = parseFloat(tenure) || 0;
    if (p <= 0 || r <= 0 || t <= 0) return null;

    const months = tenureUnit === "years" ? t * 12 : t;
    const monthlyRate = r / 12 / 100;
    const emi = p * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
    const totalPayment = emi * months;
    const totalInterest = totalPayment - p;

    const schedule: { month: number; emi: number; principal: number; interest: number; balance: number }[] = [];
    let balance = p;
    for (let m = 1; m <= Math.min(months, 360); m++) {
      const interestForMonth = balance * monthlyRate;
      const principalForMonth = emi - interestForMonth;
      balance -= principalForMonth;
      schedule.push({ month: m, emi, principal: principalForMonth, interest: interestForMonth, balance: Math.max(0, balance) });
    }

    return { emi, totalPayment, totalInterest, months, schedule, principalPercent: (p / totalPayment) * 100 };
  }, [principal, rate, tenure, tenureUnit]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <ToolHeader title="Loan Calculator" subtitle="EMI, interest & repayment schedule" accentColor="#059669" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.typeCard}>
          <Text style={styles.sectionTitle}>Loan Type</Text>
          <View style={styles.typeGrid}>
            {LOAN_TYPES.map((type) => (
              <Pressable
                key={type.label}
                onPress={() => { setLoanType(type); Haptics.selectionAsync(); }}
                style={[styles.typeBtn, loanType.label === type.label && { backgroundColor: type.color, borderColor: type.color }]}
              >
                <Ionicons name={type.icon as any} size={18} color={loanType.label === type.label ? Colors.white : type.color} />
                <Text style={[styles.typeBtnText, loanType.label === type.label && { color: Colors.white }]}>{type.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.sectionTitle}>Loan Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Loan Amount</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput style={styles.input} value={principal} onChangeText={setPrincipal} keyboardType="numeric" placeholder="100,000" placeholderTextColor={Colors.textMuted} />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Annual Interest Rate</Text>
            <View style={styles.inputRow}>
              <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="8.5" placeholderTextColor={Colors.textMuted} />
              <Text style={styles.inputSuffix}>% per year</Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Loan Tenure</Text>
            <View style={styles.tenureRow}>
              <TextInput style={[styles.input, { flex: 1 }]} value={tenure} onChangeText={setTenure} keyboardType="numeric" placeholder="12" placeholderTextColor={Colors.textMuted} />
              <Pressable onPress={() => { setTenureUnit("months"); Haptics.selectionAsync(); }} style={[styles.unitBtn, tenureUnit === "months" && styles.unitBtnActive]}>
                <Text style={[styles.unitBtnText, tenureUnit === "months" && { color: Colors.white }]}>Months</Text>
              </Pressable>
              <Pressable onPress={() => { setTenureUnit("years"); Haptics.selectionAsync(); }} style={[styles.unitBtn, tenureUnit === "years" && styles.unitBtnActive]}>
                <Text style={[styles.unitBtnText, tenureUnit === "years" && { color: Colors.white }]}>Years</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {result ? (
          <>
            <View style={[styles.emiCard, { borderColor: loanType.color }]}>
              <Ionicons name="calculator-outline" size={22} color={loanType.color} />
              <Text style={styles.emiLabel}>Monthly EMI</Text>
              <Text style={[styles.emiAmount, { color: loanType.color }]}>${formatCurrency(result.emi)}</Text>
              <Text style={styles.emiSub}>for {result.months} months</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Loan Summary</Text>
              {[
                { label: "Loan Amount (Principal)", value: `$${formatCurrency(parseFloat(principal.replace(/,/g, "")) || 0)}`, color: Colors.primary },
                { label: "Total Interest Payable", value: `$${formatCurrency(result.totalInterest)}`, color: "#DC2626" },
                { label: "Total Payment", value: `$${formatCurrency(result.totalPayment)}`, color: loanType.color },
              ].map((row) => (
                <View key={row.label} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{row.label}</Text>
                  <Text style={[styles.summaryValue, { color: row.color }]}>{row.value}</Text>
                </View>
              ))}
              <View style={styles.barContainer}>
                <View style={[styles.barFill, { width: `${result.principalPercent}%` as any, backgroundColor: Colors.primary }]} />
                <View style={[styles.barFill, { width: `${100 - result.principalPercent}%` as any, backgroundColor: "#DC2626" }]} />
              </View>
              <View style={styles.barLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.primary }]} /><Text style={styles.legendText}>Principal ({result.principalPercent.toFixed(0)}%)</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} /><Text style={styles.legendText}>Interest ({(100 - result.principalPercent).toFixed(0)}%)</Text></View>
              </View>
            </View>

            <View style={styles.scheduleCard}>
              <Text style={styles.sectionTitle}>Repayment Schedule (First 12 months)</Text>
              <View style={styles.scheduleHeader}>
                {["Month", "EMI", "Principal", "Interest", "Balance"].map((h) => (
                  <Text key={h} style={styles.scheduleHeaderText}>{h}</Text>
                ))}
              </View>
              {result.schedule.slice(0, 12).map((row) => (
                <View key={row.month} style={[styles.scheduleRow, row.month % 2 === 0 && { backgroundColor: Colors.separator }]}>
                  <Text style={styles.scheduleCell}>{row.month}</Text>
                  <Text style={styles.scheduleCell}>${formatCurrency(row.emi)}</Text>
                  <Text style={[styles.scheduleCell, { color: Colors.primary }]}>${formatCurrency(row.principal)}</Text>
                  <Text style={[styles.scheduleCell, { color: "#DC2626" }]}>${formatCurrency(row.interest)}</Text>
                  <Text style={styles.scheduleCell}>${formatCurrency(row.balance)}</Text>
                </View>
              ))}
              {result.months > 12 && (
                <Text style={styles.scheduleNote}>Showing first 12 of {result.months} months</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.noResultCard}>
            <Ionicons name="calculator-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.noResultText}>Enter loan details above to calculate EMI and repayment schedule</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 14 },
  sectionTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.text, marginBottom: 10 },
  typeCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  typeBtnText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  inputCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.separator, borderRadius: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  input: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 16, color: Colors.text, height: 48 },
  inputPrefix: { fontFamily: "Poppins_600SemiBold", fontSize: 16, color: Colors.textSecondary },
  inputSuffix: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted },
  tenureRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  unitBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.separator, borderWidth: 1, borderColor: Colors.cardBorder },
  unitBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  unitBtnText: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  emiCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 24, alignItems: "center", gap: 8, borderWidth: 2 },
  emiLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  emiAmount: { fontFamily: "Poppins_700Bold", fontSize: 36 },
  emiSub: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textMuted },
  summaryCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1 },
  summaryValue: { fontFamily: "Poppins_700Bold", fontSize: 14 },
  barContainer: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginTop: 8 },
  barFill: { height: "100%" },
  barLegend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textSecondary },
  scheduleCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.cardBorder, overflow: "hidden" },
  scheduleHeader: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  scheduleHeaderText: { flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 9, color: Colors.textMuted, textAlign: "center" },
  scheduleRow: { flexDirection: "row", paddingVertical: 7, borderRadius: 6 },
  scheduleCell: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 9, color: Colors.text, textAlign: "center" },
  scheduleNote: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, textAlign: "center", marginTop: 10 },
  noResultCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 32, alignItems: "center", gap: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  noResultText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
});
