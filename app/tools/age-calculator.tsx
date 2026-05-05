import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import ToolHeader from "@/components/ToolHeader";

interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalMonths: number;
  totalWeeks: number;
  totalHours: number;
  nextBirthday: number;
  dayOfWeek: string;
  zodiacSign: string;
}

function calculateAge(dob: Date): AgeResult {
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  const totalDays = Math.floor((now.getTime() - dob.getTime()) / 86400000);
  const nextBday = (() => {
    let d = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
    if (d <= now) d = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
    return Math.ceil((d.getTime() - now.getTime()) / 86400000);
  })();
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const m = dob.getMonth() + 1, d = dob.getDate();
  let zodiac = "Pisces";
  if ((m===3&&d>=21)||(m===4&&d<=19)) zodiac="Aries";
  else if ((m===4&&d>=20)||(m===5&&d<=20)) zodiac="Taurus";
  else if ((m===5&&d>=21)||(m===6&&d<=20)) zodiac="Gemini";
  else if ((m===6&&d>=21)||(m===7&&d<=22)) zodiac="Cancer";
  else if ((m===7&&d>=23)||(m===8&&d<=22)) zodiac="Leo";
  else if ((m===8&&d>=23)||(m===9&&d<=22)) zodiac="Virgo";
  else if ((m===9&&d>=23)||(m===10&&d<=22)) zodiac="Libra";
  else if ((m===10&&d>=23)||(m===11&&d<=21)) zodiac="Scorpio";
  else if ((m===11&&d>=22)||(m===12&&d<=21)) zodiac="Sagittarius";
  else if ((m===12&&d>=22)||(m===1&&d<=19)) zodiac="Capricorn";
  else if ((m===1&&d>=20)||(m===2&&d<=18)) zodiac="Aquarius";
  return { years, months, days, totalDays, totalWeeks: Math.floor(totalDays/7), totalMonths: years*12+months, totalHours: totalDays*24, nextBirthday: nextBday, dayOfWeek: DAYS[dob.getDay()], zodiacSign: zodiac };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AgeCalculator() {
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [result, setResult] = useState<AgeResult | null>(null);
  const [error, setError] = useState("");
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const handleCalculate = () => {
    setError("");
    const d = parseInt(day,10), m = parseInt(month,10), y = parseInt(year,10);
    if (!d||!m||!y) { setError("Please fill in day, month, and year."); return; }
    if (m<1||m>12) { setError("Month must be between 1 and 12."); return; }
    if (d<1||d>31) { setError("Day must be between 1 and 31."); return; }
    if (y<1900||y>new Date().getFullYear()) { setError("Please enter a valid year."); return; }
    const dob = new Date(y,m-1,d);
    if (dob>new Date()) { setError("Date of birth cannot be in the future."); return; }
    if (dob.getMonth()!==m-1) { setError("Invalid date for the given month."); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResult(calculateAge(dob));
  };

  return (
    <View style={styles.container}>
      <ToolHeader title="Age Calculator" subtitle="Calculate your exact age from DOB" accentColor="#DB2777" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Date of Birth</Text>
          <View style={styles.dateRow}>
            {[
              { label: "Day", value: day, onChange: setDay, placeholder: "DD", max: 2 },
              { label: "Month", value: month, onChange: setMonth, placeholder: "MM", max: 2 },
              { label: "Year", value: year, onChange: setYear, placeholder: "YYYY", max: 4, flex: 1.5 },
            ].map((f) => (
              <View key={f.label} style={[styles.dateField, f.flex ? { flex: f.flex } : undefined]}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.dateInput}
                  value={f.value}
                  onChangeText={(v) => f.onChange(v.replace(/[^0-9]/g,"").slice(0,f.max))}
                  keyboardType="number-pad"
                  placeholder={f.placeholder}
                  placeholderTextColor={Colors.textMuted}
                  maxLength={f.max}
                  selectTextOnFocus
                />
              </View>
            ))}
          </View>

          <View style={styles.monthGrid}>
            {MONTHS.map((mo, i) => (
              <Pressable
                key={mo}
                onPress={() => { Haptics.selectionAsync(); setMonth(String(i+1)); }}
                style={[styles.monthBtn, parseInt(month,10)===i+1 && styles.monthBtnActive]}
              >
                <Text style={[styles.monthBtnText, parseInt(month,10)===i+1 && styles.monthBtnTextActive]}>{mo}</Text>
              </Pressable>
            ))}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleCalculate}
            style={({ pressed }) => [styles.calcBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Ionicons name="calculator-outline" size={20} color={Colors.white} />
            <Text style={styles.calcBtnText}>Calculate Age</Text>
          </Pressable>
        </View>

        {result && (
          <>
            <View style={styles.mainResult}>
              <Text style={styles.mainResultLabel}>Your exact age</Text>
              <View style={styles.ageBlocks}>
                {[
                  { num: result.years, unit: "Years" },
                  { num: result.months, unit: "Months" },
                  { num: result.days, unit: "Days" },
                ].map((b, i) => (
                  <React.Fragment key={b.unit}>
                    <View style={styles.ageBlock}>
                      <Text style={styles.ageNum}>{b.num}</Text>
                      <Text style={styles.ageUnit}>{b.unit}</Text>
                    </View>
                    {i < 2 && <Text style={styles.ageSep}>:</Text>}
                  </React.Fragment>
                ))}
              </View>
            </View>

            <View style={styles.statsGrid}>
              {[
                { label: "Total Days", value: result.totalDays.toLocaleString(), icon: "calendar-outline" as const },
                { label: "Total Weeks", value: result.totalWeeks.toLocaleString(), icon: "calendar" as const },
                { label: "Total Months", value: result.totalMonths.toLocaleString(), icon: "time-outline" as const },
                { label: "Total Hours", value: result.totalHours.toLocaleString(), icon: "hourglass-outline" as const },
              ].map((s) => (
                <View key={s.label} style={styles.statCard}>
                  <Ionicons name={s.icon} size={20} color="#DB2777" />
                  <Text style={styles.statVal}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.listCard}>
              {[
                ["Born on", result.dayOfWeek],
                ["Zodiac Sign", result.zodiacSign],
                ["Next Birthday", `In ${result.nextBirthday} days`],
              ].map(([l, v], i, arr) => (
                <View key={l} style={[styles.infoRow, i===arr.length-1 && {borderBottomWidth:0}]}>
                  <Text style={styles.infoLabel}>{l}</Text>
                  <Text style={styles.infoValue}>{v}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {!result && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={40} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyText}>Enter your date of birth above to calculate your exact age</Text>
          </View>
        )}
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
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1, gap: 6 },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  dateInput: {
    fontFamily: "Poppins_700Bold",
    fontSize: 26,
    color: Colors.text,
    backgroundColor: Colors.separator,
    borderRadius: 10,
    padding: 12,
    textAlign: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  monthBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.separator,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  monthBtnActive: { backgroundColor: "#DB2777", borderColor: "#DB2777" },
  monthBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  monthBtnTextActive: { color: Colors.white },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  calcBtn: {
    backgroundColor: "#DB2777",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#DB2777",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  calcBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  mainResult: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#DB2777",
    ...CARD_SHADOW,
  },
  mainResultLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  ageBlocks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ageBlock: { alignItems: "center", minWidth: 70 },
  ageNum: {
    fontFamily: "Poppins_700Bold",
    fontSize: 44,
    color: "#DB2777",
    lineHeight: 52,
  },
  ageUnit: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  ageSep: {
    fontFamily: "Poppins_700Bold",
    fontSize: 36,
    color: Colors.cardBorder,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47%",
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...CARD_SHADOW,
  },
  statVal: {
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: "hidden",
    ...CARD_SHADOW,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separator,
  },
  infoLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 14,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.separator,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 240,
  },
});
