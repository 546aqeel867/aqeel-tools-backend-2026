import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, FlatList, Platform,
  KeyboardAvoidingView, ActivityIndicator, Alert, Modal, ScrollView, Animated, Easing,
} from "react-native";
import * as Speech from "expo-speech";
import * as Clipboard from "expo-clipboard";
import { useAudioPlayer } from "expo-audio";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { useApp, ChatMessage, ChatSession } from "@/contexts/AppContext";
import { aiChat, elevenLabsTtsBase64 } from "@/lib/ai";
import { ZenoLogo } from "@/components/ZenoLogo";
import { LinearGradient } from "expo-linear-gradient";

const PERSONAS = [
  {
    id: "helper",
    label: "Helper",
    icon: "sparkles-outline" as const,
    color: "#2563EB",
    system: `You are Zeno V2, a smart, friendly AI assistant built into Aqeel Tools Hub — a professional all-in-one mobile toolkit.\n\nGuidelines:\n- Keep responses clear, concise, and well-structured\n- Use bullet points and numbered lists when helpful\n- Be enthusiastic and supportive\n- For code: format in fenced code blocks\n- If unsure, say so honestly`,
    suggestions: [
      "What can Zeno help me with?",
      "Give me 5 morning routine tips",
      "Explain machine learning simply",
      "Write a short poem about the moon",
    ],
  },
  {
    id: "coder",
    label: "Coder",
    icon: "code-slash-outline" as const,
    color: "#0891B2",
    system: `You are Zeno V2 in Coder Mode — an expert software engineer who loves helping with code.\n\nGuidelines:\n- Always provide working, tested code examples\n- Explain what the code does step by step\n- Suggest best practices and optimizations\n- Support all major languages: JavaScript, Python, TypeScript, Swift, Kotlin, etc.\n- Format all code in fenced code blocks with language tags`,
    suggestions: [
      "Write a Python function to reverse a string",
      "Explain async/await in JavaScript",
      "Debug: why is my fetch returning undefined?",
      "Best practices for React Native performance",
    ],
  },
  {
    id: "writer",
    label: "Writer",
    icon: "pencil-outline" as const,
    color: "#EA580C",
    system: `You are Zeno V2 in Writer Mode — a creative writing expert who helps with all forms of writing.\n\nGuidelines:\n- Help with stories, essays, emails, scripts, poems, and more\n- Suggest vivid language and strong imagery\n- Improve clarity, flow, and tone\n- Ask clarifying questions about style and audience when needed\n- Be creative, expressive, and encouraging`,
    suggestions: [
      "Write an opening paragraph for a thriller",
      "Help me write a professional email",
      "Give me a metaphor for loneliness",
      "Rewrite this sentence more powerfully: I was sad",
    ],
  },
  {
    id: "gamer",
    label: "Gamer",
    icon: "game-controller-outline" as const,
    color: "#7C3AED",
    system: `You are Zeno V2 in Gamer Mode — a passionate gaming expert who knows everything about video games.\n\nGuidelines:\n- Help with game strategies, walkthroughs, and tips\n- Recommend games based on preferences\n- Discuss game lore, characters, and mechanics\n- Cover all platforms: PC, console, mobile, and retro\n- Be enthusiastic and use gaming terminology naturally`,
    suggestions: [
      "Best mobile games of 2025?",
      "Tips for improving at FPS games",
      "What should I play after finishing Zelda?",
      "Explain Minecraft redstone basics",
    ],
  },
];

const OFFLINE_FACTS = [
  "The first computer bug was an actual bug — a moth found in a Harvard computer in 1947.",
  "There are more possible chess games than atoms in the observable universe.",
  "The average person types at 40 words per minute. The fastest ever recorded was 216 WPM.",
  "The first website ever is still live: info.cern.ch — it went online in 1991.",
  "Python is named after Monty Python, not the snake. 🐍",
  "The most used password is still '123456'. Please use the Password Generator in Tools! 😅",
  "Instagram was sold to Facebook in 2012 for $1 billion — it was only 13 employees at the time.",
  "The first mobile phone call was made in 1973. It lasted 10 minutes.",
  "There are more than 700 programming languages in existence today.",
  "Approximately 90% of the world's data was created in the last two years.",
];

const OFFLINE_JOKES = [
  "Why do programmers prefer dark mode?\nBecause light attracts bugs! 🐛",
  "Why do Java developers wear glasses?\nBecause they can't C#! 👓",
  "A SQL query walks into a bar, walks up to two tables and asks… 'Can I join you?' 😄",
  "How many programmers does it take to change a light bulb?\nNone — that's a hardware problem! 💡",
  "Why did the developer go broke?\nBecause he used up all his cache! 💸",
  "I told my wife she should embrace her mistakes.\nShe gave me a hug. 🤗",
];

function getOfflineReply(msg: string, personaId: string): string {
  const lower = msg.toLowerCase();

  if (lower.match(/^(hi|hello|hey|sup|yo|howdy|hiya)\b/)) {
    return `Hey! 👋 I'm Zeno V2. I'm in offline mode right now.\n\nI can still chat, share facts & jokes while you're offline — or add an AI key in Settings for full AI power!\n\nWhat would you like to talk about?`;
  }

  if (lower.includes("joke") || lower.includes("funny") || lower.includes("laugh")) {
    return "😄 " + OFFLINE_JOKES[Math.floor(Math.random() * OFFLINE_JOKES.length)];
  }

  if (lower.includes("fact") || lower.includes("trivia") || lower.includes("did you know") || lower.includes("interesting")) {
    return "🧠 Here's a fun fact:\n\n" + OFFLINE_FACTS[Math.floor(Math.random() * OFFLINE_FACTS.length)];
  }

  if (lower.includes("time") || lower.includes("clock") || lower.includes("date")) {
    const now = new Date();
    return `🕐 Right now it's ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} on ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.\n\nCheck the World Clock tool for times in different cities around the world!`;
  }

  if (lower.includes("tip") || lower.includes("bill") || lower.includes("split") || lower.includes("restaurant")) {
    return "💰 Need to split a bill? Try the Tip Calculator tool — it handles tips, splits between friends, and multiple currencies. No internet needed!";
  }

  if (lower.includes("study") || lower.includes("learn") || lower.includes("memorize") || lower.includes("quiz")) {
    return "📚 Try the Flashcard tool for studying! Create decks, flip cards, and track what you know. Works completely offline — perfect for exam prep!";
  }

  if (personaId === "coder" || lower.includes("code") || lower.includes("function") || lower.includes("bug") || lower.includes("script") || lower.includes("program")) {
    return "💻 Coding question? In offline mode I can't run AI, but:\n\n• Use the **Code Snippets** tool to save and search your code\n• **AI Code Helper** tool has pre-built templates\n\nAdd an API key in Settings to get full coding assistance!";
  }

  if (personaId === "writer" || lower.includes("write") || lower.includes("story") || lower.includes("poem") || lower.includes("essay") || lower.includes("caption")) {
    return "✍️ Love the creative spirit! While offline I can't generate full stories, but here's a quick writing tip:\n\n*Show, don't tell* — instead of 'she was scared', write 'her hands trembled and her breath came in short gasps.'\n\nConnect me to AI for full creative writing assistance!";
  }

  if (personaId === "gamer" || lower.includes("game") || lower.includes("play") || lower.includes("level") || lower.includes("score")) {
    return "🎮 Game talk! Check out the **Game Bar** tab — 9 free offline games including Snake, Breakout, Wordle, 2048 and more. All work without internet!\n\nCome back with AI for strategy tips and game recommendations!";
  }

  if (lower.includes("weather")) {
    return "🌤️ I don't have real-time weather data, but I can tell you: check your phone's weather app for the most accurate forecast!\n\nOnce you're online and have an API key, I can help with weather-related trip planning!";
  }

  if (lower.includes("translate") || lower.includes("language") || lower.includes("say") || lower.includes("word in")) {
    return "🌍 The **Translator** tool in Tools tab supports 16 languages and works offline for basic translations! Try it out.\n\nFor more complex translations, connect me to AI!";
  }

  if (lower.includes("help") || lower.includes("what can") || lower.includes("feature")) {
    return "🤖 Here's what I can do offline:\n\n• Tell jokes & fun facts\n• Share the current time\n• Give tool recommendations\n• Answer basic questions\n\n**Full AI power** (need API key):\n• Write code, stories, emails\n• Translate anything\n• Answer any question\n• Plan trips & itineraries\n\nAdd your key in Settings → API Keys!";
  }

  if (lower.includes("thank")) {
    return "You're welcome! 😊 Anytime. I'm always here — even offline I do my best to help!";
  }

  const randomFact = Math.random() < 0.4;
  if (randomFact) {
    return `🤖 I'm in offline mode, but here's something interesting while you wait:\n\n${OFFLINE_FACTS[Math.floor(Math.random() * OFFLINE_FACTS.length)]}\n\nAdd an AI API key in Settings to unlock my full capabilities!`;
  }

  return `🤖 I'm Zeno V2 in offline mode.\n\nI can share jokes, facts, time info, and tool tips right now!\n\nFor full AI answers, please:\n• Check your internet connection\n• Add an API key in Settings → API Keys\n\nWhat would you like to know?`;
}

function TypingIndicator() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -7, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay(560),
        ]),
      );
    const a1 = bounce(d1, 0);
    const a2 = bounce(d2, 140);
    const a3 = bounce(d3, 280);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.typingRow}>
      <View style={styles.botAvatar}>
        <MaterialCommunityIcons name="robot-outline" size={16} color={Colors.primary} />
      </View>
      <View style={styles.typingBubble}>
        {[d1, d2, d3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
}

function MessageBubble({
  msg, onCopy, onSpeak, speakingId, copyingId,
}: {
  msg: ChatMessage;
  onCopy: (msg: ChatMessage) => void;
  onSpeak: (msg: ChatMessage) => void;
  speakingId: string | null;
  copyingId: string | null;
}) {
  const isUser = msg.role === "user";
  const isBot = msg.role === "assistant";
  const isSpeaking = speakingId === msg.id;
  const justCopied = copyingId === msg.id;
  const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
      {isBot && (
        <View style={styles.botAvatar}>
          <MaterialCommunityIcons name="robot-outline" size={16} color={Colors.primary} />
        </View>
      )}
      <View style={{ maxWidth: "82%", gap: 4 }}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Pressable
            onPress={() => onCopy(msg)}
            hitSlop={6}
            style={[styles.copyCorner, { backgroundColor: isUser ? "rgba(255,255,255,0.2)" : Colors.separator }]}
          >
            <Ionicons
              name={justCopied ? "checkmark" : "copy-outline"}
              size={12}
              color={isUser ? Colors.white : Colors.textSecondary}
            />
          </Pressable>
          <Text style={[styles.bubbleText, isUser && { color: Colors.white }]}>{msg.content}</Text>
          <Text style={[styles.bubbleTime, isUser && { color: "rgba(255,255,255,0.6)" }]}>{time}</Text>
        </View>
        {isBot && (
          <View style={styles.botActions}>
            <Pressable onPress={() => onCopy(msg)} hitSlop={8} style={styles.actionChip}>
              <Ionicons name={justCopied ? "checkmark" : "copy-outline"} size={12} color={Colors.primary} />
              <Text style={styles.actionChipText}>{justCopied ? "Copied" : "Copy"}</Text>
            </Pressable>
            <Pressable onPress={() => onSpeak(msg)} hitSlop={8} style={[styles.actionChip, isSpeaking && styles.actionChipActive]}>
              <Ionicons name={isSpeaking ? "stop-circle" : "volume-high-outline"} size={12} color={isSpeaking ? Colors.white : Colors.primary} />
              <Text style={[styles.actionChipText, isSpeaking && { color: Colors.white }]}>{isSpeaking ? "Stop" : "Listen"}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function SessionsModal({ visible, onClose, sessions, activeId, onNew, onSwitch, onDelete, onRename }: {
  visible: boolean; onClose: () => void; sessions: ChatSession[]; activeId: string;
  onNew: () => void; onSwitch: (id: string) => void; onDelete: (id: string) => void;
  onRename: (id: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sessionsOverlay} onPress={onClose}>
        <Pressable style={styles.sessionsDrawer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sessionsHeader}>
            <Text style={styles.sessionsTitle}>Chat History</Text>
            <Pressable onPress={onNew} style={styles.newChatBtn}>
              <Ionicons name="add" size={16} color={Colors.white} />
              <Text style={styles.newChatBtnText}>New Chat</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            {sessions.map((session) => (
              <Pressable
                key={session.id}
                onPress={() => { onSwitch(session.id); onClose(); }}
                style={[styles.sessionItem, session.id === activeId && styles.sessionItemActive]}
              >
                <View style={styles.sessionItemIcon}>
                  <Ionicons name="chatbubble-outline" size={16} color={session.id === activeId ? Colors.primary : Colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionItemName, session.id === activeId && { color: Colors.primary }]} numberOfLines={1}>
                    {session.name || "New Chat"}
                  </Text>
                  <Text style={styles.sessionItemMeta}>{session.messages.length} messages</Text>
                </View>
                <View style={styles.sessionItemActions}>
                  <Pressable onPress={() => onRename(session.id)} hitSlop={8} style={styles.sessionActionBtn}>
                    <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} />
                  </Pressable>
                  {sessions.length > 1 && (
                    <Pressable onPress={() => onDelete(session.id)} hitSlop={8} style={styles.sessionActionBtn}>
                      <Ionicons name="trash-outline" size={14} color={Colors.error} />
                    </Pressable>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.sessionsCloseBtn}>
            <Text style={styles.sessionsCloseBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function VoiceCallModal({
  visible, onClose, speaking, loading, lastResponse, onStop,
  voiceLang, onToggleLang, onSendInCall, hasVoiceKey,
}: {
  visible: boolean; onClose: () => void; speaking: boolean; loading: boolean;
  lastResponse: string; onStop: () => void;
  voiceLang: "en" | "hi"; onToggleLang: () => void;
  onSendInCall: (text?: string) => void; hasVoiceKey: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [callDuration, setCallDuration] = useState(0);
  const [callInput, setCallInput] = useState("");
  const [muted, setMuted] = useState(false);

  const ringsRef = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]);
  const rings = ringsRef.current;
  const waveRef = useRef(Array.from({ length: 9 }, () => new Animated.Value(0.2)));
  const waveBars = waveRef.current;

  useEffect(() => {
    if (!visible) { setCallDuration(0); return; }
    const id = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    const anims = rings.map((r, i) => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(r, { toValue: 1.6, duration: 2400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(r, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      setTimeout(() => anim.start(), i * 700);
      return anim;
    });
    return () => anims.forEach((a) => a.stop());
  }, []);

  useEffect(() => {
    if (!speaking) {
      waveBars.forEach((b) =>
        Animated.timing(b, { toValue: 0.15, duration: 350, useNativeDriver: true }).start(),
      );
      return;
    }
    const PEAKS = [0.9, 0.4, 1.0, 0.5, 0.75, 0.3, 0.85, 0.45, 0.65];
    const anims = waveBars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: PEAKS[i], duration: 180 + i * 35, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bar, { toValue: PEAKS[i] * 0.2, duration: 180 + i * 35, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [speaking]);

  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const statusText = loading
    ? (voiceLang === "hi" ? "सोच रहा हूँ…" : "Thinking…")
    : speaking
    ? (voiceLang === "hi" ? "बोल रहा हूँ…" : "Speaking…")
    : (voiceLang === "hi" ? "सुन रहा हूँ" : "Listening");

  const handleCallSend = () => {
    const t = callInput.trim();
    if (!t) return;
    setCallInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSendInCall(t);
  };

  const handleEndCall = () => {
    onStop();
    onClose();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleEndCall} statusBarTranslucent>
      <View style={[callS.container, { paddingTop: insets.top || 44, paddingBottom: insets.bottom || 20 }]}>

        {/* ── Header ── */}
        <View style={callS.header}>
          <Pressable onPress={onClose} style={callS.headerBtn} hitSlop={12}>
            <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <View style={callS.headerCenter}>
            <Text style={callS.headerTitle}>{voiceLang === "hi" ? "वॉयस कॉल" : "Voice Call"}</Text>
            <Text style={callS.headerTimer}>{fmtDuration(callDuration)}</Text>
          </View>
          <Pressable onPress={onToggleLang} style={callS.langBtn} hitSlop={8}>
            <Text style={callS.langBtnText}>{voiceLang === "hi" ? "EN" : "HI"}</Text>
          </Pressable>
        </View>

        {/* ── Avatar + rings ── */}
        <View style={callS.avatarArea}>
          {rings.map((r, i) => {
            const opacity = r.interpolate({ inputRange: [1, 1.6], outputRange: [0.22 - i * 0.06, 0] });
            return (
              <Animated.View
                key={i}
                style={[
                  callS.ring,
                  {
                    width: 140 + i * 74,
                    height: 140 + i * 74,
                    borderRadius: (140 + i * 74) / 2,
                    opacity,
                    transform: [{ scale: r }],
                  },
                ]}
              />
            );
          })}
          <LinearGradient
            colors={["#2563EB", "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={callS.avatar}
          >
            <MaterialCommunityIcons name="robot" size={62} color="#fff" />
          </LinearGradient>
          <Text style={callS.callerName}>Zeno AI</Text>
          <View style={callS.statusRow}>
            <View style={[callS.statusDot, {
              backgroundColor: loading ? "#F59E0B" : speaking ? "#60A5FA" : "#10B981",
            }]} />
            <Text style={callS.statusText}>{statusText}</Text>
          </View>
          <View style={callS.voiceBadge}>
            <Ionicons
              name={hasVoiceKey ? "musical-notes-outline" : "volume-high-outline"}
              size={11} color="rgba(255,255,255,0.6)"
            />
            <Text style={callS.voiceBadgeText}>
              {hasVoiceKey ? "ElevenLabs" : "Device TTS"} · {voiceLang === "hi" ? "हिंदी" : "English"}
            </Text>
          </View>
        </View>

        {/* ── Waveform ── */}
        <View style={callS.waveform}>
          {waveBars.map((bar, i) => (
            <Animated.View
              key={i}
              style={[
                callS.waveBar,
                {
                  transform: [{ scaleY: bar }],
                  backgroundColor: speaking
                    ? i % 2 === 0 ? "#3B82F6" : "#7C3AED"
                    : "rgba(255,255,255,0.18)",
                },
              ]}
            />
          ))}
        </View>

        {/* ── Transcript ── */}
        {lastResponse ? (
          <View style={callS.transcript}>
            <Text style={callS.transcriptLabel}>
              {voiceLang === "hi" ? "आखिरी जवाब" : "Last response"}
            </Text>
            <Text style={callS.transcriptText} numberOfLines={3}>{lastResponse}</Text>
          </View>
        ) : (
          <View style={callS.transcriptEmpty}>
            <Text style={callS.transcriptEmptyText}>
              {voiceLang === "hi"
                ? "नीचे टाइप करके Zeno से बात करें"
                : "Type below to start talking with Zeno"}
            </Text>
          </View>
        )}

        {/* ── Controls ── */}
        <View style={callS.controls}>
          <View style={callS.controlItem}>
            <Pressable
              onPress={() => { setMuted((m) => !m); Haptics.selectionAsync(); }}
              style={[callS.controlBtn, muted && callS.controlBtnDanger]}
            >
              <Ionicons name={muted ? "mic-off" : "mic-outline"} size={24} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Text style={callS.controlLabel}>
              {muted
                ? (voiceLang === "hi" ? "अनम्यूट" : "Unmute")
                : (voiceLang === "hi" ? "म्यूट" : "Mute")}
            </Text>
          </View>
          <View style={callS.controlItem}>
            <Pressable
              onPress={() => { if (speaking) onStop(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              style={[callS.controlBtn, speaking && callS.controlBtnBlue]}
            >
              <Ionicons
                name={speaking ? "stop-circle-outline" : "volume-high-outline"}
                size={24} color="rgba(255,255,255,0.9)"
              />
            </Pressable>
            <Text style={callS.controlLabel}>
              {speaking
                ? (voiceLang === "hi" ? "रोकें" : "Stop")
                : (voiceLang === "hi" ? "स्पीकर" : "Speaker")}
            </Text>
          </View>
          <View style={callS.controlItem}>
            <Pressable onPress={onToggleLang} style={[callS.controlBtn, callS.controlBtnPurple]}>
              <Text style={callS.langToggle}>{voiceLang === "hi" ? "EN" : "HI"}</Text>
            </Pressable>
            <Text style={callS.controlLabel}>{voiceLang === "hi" ? "English" : "हिंदी"}</Text>
          </View>
        </View>

        {/* ── Mini input ── */}
        <View style={callS.inputArea}>
          <TextInput
            style={callS.callInput}
            value={callInput}
            onChangeText={setCallInput}
            placeholder={voiceLang === "hi" ? "Zeno से पूछें…" : "Ask Zeno something…"}
            placeholderTextColor="rgba(255,255,255,0.3)"
            onSubmitEditing={handleCallSend}
            returnKeyType="send"
            multiline={false}
          />
          <Pressable
            onPress={handleCallSend}
            disabled={!callInput.trim() || loading}
            style={[callS.callSendBtn, { opacity: !callInput.trim() || loading ? 0.4 : 1 }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={17} color="#fff" />}
          </Pressable>
        </View>

        {/* ── End call ── */}
        <View style={callS.endArea}>
          <Pressable onPress={handleEndCall} style={callS.endBtn}>
            <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
          <Text style={callS.endLabel}>{voiceLang === "hi" ? "कॉल समाप्त करें" : "End Call"}</Text>
        </View>

      </View>
    </Modal>
  );
}

const callS = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07091A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.10)", justifyContent: "center", alignItems: "center" },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "rgba(255,255,255,0.85)" },
  headerTimer: { fontFamily: "Poppins_700Bold", fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 1 },
  langBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(124,58,237,0.35)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(124,58,237,0.6)" },
  langBtnText: { fontFamily: "Poppins_700Bold", fontSize: 14, color: "#fff" },
  avatarArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  ring: { position: "absolute", borderWidth: 1.5, borderColor: "#2563EB" },
  avatar: { width: 140, height: 140, borderRadius: 70, justifyContent: "center", alignItems: "center", shadowColor: "#2563EB", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 30, elevation: 20 },
  callerName: { fontFamily: "Poppins_700Bold", fontSize: 26, color: "#fff", marginTop: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 7 },
  statusDot: { width: 9, height: 9, borderRadius: 4.5 },
  statusText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: "rgba(255,255,255,0.65)" },
  voiceBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, paddingHorizontal: 13, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  voiceBadgeText: { fontFamily: "Poppins_500Medium", fontSize: 11, color: "rgba(255,255,255,0.55)" },
  waveform: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 56, paddingHorizontal: 40 },
  waveBar: { width: 5, height: 42, borderRadius: 3 },
  transcript: { marginHorizontal: 18, marginBottom: 6, padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  transcriptLabel: { fontFamily: "Poppins_500Medium", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 },
  transcriptText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 20 },
  transcriptEmpty: { marginHorizontal: 18, marginBottom: 6, alignItems: "center" },
  transcriptEmptyText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center" },
  controls: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", paddingHorizontal: 30, paddingVertical: 14 },
  controlItem: { alignItems: "center", gap: 8 },
  controlBtn: { width: 62, height: 62, borderRadius: 31, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  controlBtnDanger: { backgroundColor: "rgba(239,68,68,0.3)", borderColor: "#EF4444" },
  controlBtnBlue: { backgroundColor: "rgba(59,130,246,0.35)", borderColor: "#3B82F6" },
  controlBtnPurple: { backgroundColor: "rgba(124,58,237,0.35)", borderColor: "#7C3AED" },
  controlLabel: { fontFamily: "Poppins_400Regular", fontSize: 10, color: "rgba(255,255,255,0.45)", textAlign: "center", maxWidth: 72 },
  langToggle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: "#fff" },
  inputArea: { flexDirection: "row", marginHorizontal: 16, marginBottom: 10, gap: 10, alignItems: "center" },
  callInput: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: "#fff", backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  callSendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" },
  endArea: { alignItems: "center", gap: 8, paddingBottom: 10 },
  endBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center", shadowColor: "#DC2626", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 14, elevation: 10 },
  endLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: "rgba(255,255,255,0.45)" },
});

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const {
    chatHistory, addChatMessage, clearChatHistory,
    chatSessions, activeChatSessionId, createNewChatSession, switchChatSession, deleteChatSession, renameChatSession,
    apiKeys, hasAiKey, hasVoiceKey,
  } = useApp();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en" | "hi">("en");
  const [voiceText, setVoiceText] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState("helper");
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const flatListRef = useRef<FlatList>(null);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const persona = PERSONAS.find((p) => p.id === personaId) || PERSONAS[0];
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
  const allMessages = [...chatHistory].reverse();

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("playbackStatusUpdate", (status: any) => {
      if (status?.didJustFinish) setSpeakingId(null);
    });
    return () => { sub?.remove?.(); };
  }, [player]);

  const stopAllVoice = useCallback(() => {
    Speech.stop();
    try { player?.pause(); } catch {}
    setSpeakingId(null);
  }, [player]);

  const speakWithEleven = useCallback(async (msg: ChatMessage) => {
    try {
      stopAllVoice();
      setSpeakingId(msg.id);
      setVoiceText(msg.content);
      const base64 = await elevenLabsTtsBase64(apiKeys.elevenlabsKey, msg.content, apiKeys.elevenlabsVoiceId);
      const dataUri = `data:audio/mpeg;base64,${base64}`;
      setAudioUri(dataUri);
      setTimeout(() => { try { player?.play?.(); } catch {} }, 100);
    } catch (e: any) {
      setSpeakingId(null);
      Alert.alert("Voice unavailable", e?.message || "Could not play voice.");
    }
  }, [apiKeys.elevenlabsKey, apiKeys.elevenlabsVoiceId, player, stopAllVoice]);

  const speakWithDevice = useCallback((msg: ChatMessage) => {
    stopAllVoice();
    setSpeakingId(msg.id);
    setVoiceText(msg.content);
    Speech.speak(msg.content, {
      language: voiceLang === "hi" ? "hi-IN" : "en-US", rate: 0.95, pitch: 1.0,
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, [stopAllVoice]);

  const handleSpeak = useCallback(async (msg: ChatMessage) => {
    if (speakingId === msg.id) { stopAllVoice(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") {
      Alert.alert("Voice on mobile only", "Voice playback works in Expo Go on iOS / Android.");
      return;
    }
    if (hasVoiceKey) await speakWithEleven(msg);
    else speakWithDevice(msg);
  }, [speakingId, hasVoiceKey, stopAllVoice, speakWithEleven, speakWithDevice]);

  const handleCopy = useCallback(async (msg: ChatMessage) => {
    await Clipboard.setStringAsync(msg.content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopyingId(msg.id);
    setTimeout(() => setCopyingId(null), 1400);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (!hasAiKey) {
      Alert.alert(
        "API key required",
        "Please add your AI API key in Settings to use Zeno.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => router.push("/tools/settings" as any) },
        ],
      );
      return;
    }

    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addChatMessage("user", msg);
    setLoading(true);

    try {
      const history = chatHistory.slice(-20);
      const messages = [
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: msg },
      ];
      const reply = await aiChat(apiKeys, messages, persona.system);
      const finalReply = reply || "Sorry, I couldn't generate a response. Please try again.";
      addChatMessage("assistant", finalReply);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if ((autoSpeak || showCall) && Platform.OS !== "web") {
        const fakeMsg: ChatMessage = { id: "auto-" + Date.now(), role: "assistant", content: finalReply, timestamp: Date.now() };
        if (hasVoiceKey) speakWithEleven(fakeMsg);
        else speakWithDevice(fakeMsg);
      }
    } catch (e: any) {
      const isNetworkError = e?.message?.toLowerCase().includes("network") || e?.message?.toLowerCase().includes("fetch") || e?.message?.toLowerCase().includes("failed");
      const fallback = isNetworkError ? getOfflineReply(msg, personaId) : (e?.message || "Something went wrong. Please try again.");
      addChatMessage("assistant", fallback);
    } finally {
      setLoading(false);
    }
  }, [input, loading, hasAiKey, addChatMessage, chatHistory, apiKeys, persona, personaId, autoSpeak, hasVoiceKey, speakWithEleven, speakWithDevice]);

  const handleClear = () => {
    if (chatHistory.length === 0) return;
    Alert.alert("Clear this chat?", "This will erase all messages in this session.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => { clearChatHistory(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  const handleDeleteSession = (id: string) => {
    Alert.alert("Delete chat?", "This conversation will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deleteChatSession(id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
    ]);
  };

  const handleRenameSession = (id: string) => {
    Alert.prompt?.(
      "Rename chat", "Give this conversation a new name.",
      [{ text: "Cancel", style: "cancel" }, { text: "Save", onPress: (val?: string) => val && renameChatSession(id, val.trim()) }],
      "plain-text",
      chatSessions.find((s) => s.id === id)?.name || "",
    );
  };

  const toggleAutoSpeak = () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync();
    setAutoSpeak((v) => { if (v) stopAllVoice(); return !v; });
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => setShowSessions(true)} style={styles.sessionToggleBtn} hitSlop={8}>
            <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
          </Pressable>
          <ZenoLogo size={36} animate />
          <View>
            <Text style={styles.headerTitle}>Zeno V2</Text>
            <Text style={[styles.headerStatus, { color: persona.color }]} numberOfLines={1}>
              {loading ? "Thinking…" : (activeSession?.name || "New Chat")}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {Platform.OS !== "web" && (
            <Pressable onPress={() => setShowCall(true)} hitSlop={8} style={[styles.headerIconBtn, styles.headerCallBtn]}>
              <Ionicons name="call" size={16} color={Colors.white} />
            </Pressable>
          )}
          {Platform.OS !== "web" && (
            <Pressable onPress={toggleAutoSpeak} hitSlop={8} style={[styles.headerIconBtn, autoSpeak && styles.headerIconBtnActive]}>
              <Ionicons name={autoSpeak ? "volume-high" : "volume-medium-outline"} size={18} color={autoSpeak ? Colors.white : Colors.textSecondary} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/tools/settings" as any)} hitSlop={8} style={styles.headerIconBtn}>
            <Ionicons name="key-outline" size={18} color={hasAiKey ? Colors.success : Colors.warning} />
          </Pressable>
          <Pressable onPress={handleClear} hitSlop={10} style={styles.headerIconBtn}>
            <Ionicons name="trash-outline" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.personaBar}
        contentContainerStyle={styles.personaBarContent}
      >
        {PERSONAS.map((p) => {
          const active = p.id === personaId;
          return (
            <Pressable
              key={p.id}
              onPress={() => { setPersonaId(p.id); Haptics.selectionAsync(); }}
              style={[styles.personaChip, active && { backgroundColor: p.color, borderColor: p.color }]}
            >
              <Ionicons name={p.icon} size={13} color={active ? "#fff" : Colors.textSecondary} />
              <Text style={[styles.personaLabel, active && { color: "#fff" }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!hasAiKey && (
        <Pressable onPress={() => router.push("/tools/settings" as any)} style={styles.banner}>
          <Ionicons name="key" size={16} color={Colors.warning} />
          <Text style={styles.bannerText}>Add your AI API key in Settings to start chatting with Zeno.</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.warning} />
        </Pressable>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={[styles.msgList, { paddingBottom: 16 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListFooterComponent={
            allMessages.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyAvatar, { backgroundColor: persona.color + "22" }]}>
                  <ZenoLogo size={72} animate showLabel={false} />
                </View>
                <Text style={styles.emptyTitle}>Zeno V2</Text>
                <Text style={styles.emptyText}>
                  {persona.id === "helper" ? "Your smart AI assistant — ask me anything!" :
                    persona.id === "coder" ? "Expert coding help — paste code, ask questions!" :
                    persona.id === "writer" ? "Creative writing expert — let's craft something amazing!" :
                    "Your gaming companion — tips, strategies, recommendations!"}
                </Text>
                {Platform.OS !== "web" && hasVoiceKey && (
                  <View style={styles.voiceNote}>
                    <Ionicons name="volume-high-outline" size={14} color={persona.color} />
                    <Text style={[styles.voiceNoteText, { color: persona.color }]}>ElevenLabs voice ready — tap Listen on any reply</Text>
                  </View>
                )}
                <View style={styles.suggestGrid}>
                  {persona.suggestions.map((s) => (
                    <Pressable key={s} onPress={() => sendMessage(s)} style={[styles.suggestChip, { borderColor: persona.color }]}>
                      <Text style={[styles.suggestText, { color: persona.color }]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <MessageBubble msg={item} onCopy={handleCopy} onSpeak={handleSpeak} speakingId={speakingId} copyingId={copyingId} />
          )}
        />

        {loading && <TypingIndicator />}

        <View style={[styles.inputBar, { paddingBottom: bottomPad + 8 }]}>
          <Pressable onPress={() => { createNewChatSession(); Haptics.selectionAsync(); }} hitSlop={8} style={styles.newChatIconBtn}>
            <Ionicons name="add-circle-outline" size={24} color={persona.color} />
          </Pressable>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={hasAiKey ? `Ask Zeno (${persona.label} mode)…` : "Add your API key in Settings"}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
            returnKeyType="send"
            editable={!loading && hasAiKey}
          />
          <Pressable
            onPress={() => sendMessage()}
            disabled={loading || !input.trim() || !hasAiKey}
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: persona.color, opacity: loading || !input.trim() || !hasAiKey ? 0.4 : pressed ? 0.85 : 1 },
            ]}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Ionicons name="send" size={18} color={Colors.white} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SessionsModal
        visible={showSessions} onClose={() => setShowSessions(false)}
        sessions={chatSessions} activeId={activeChatSessionId}
        onNew={() => { createNewChatSession(); setShowSessions(false); Haptics.selectionAsync(); }}
        onSwitch={switchChatSession}
        onDelete={handleDeleteSession}
        onRename={handleRenameSession}
      />

      <VoiceCallModal
        visible={showCall}
        onClose={() => setShowCall(false)}
        speaking={!!speakingId}
        loading={loading}
        lastResponse={voiceText}
        onStop={stopAllVoice}
        voiceLang={voiceLang}
        onToggleLang={() => { setVoiceLang((l) => l === "en" ? "hi" : "en"); Haptics.selectionAsync(); }}
        onSendInCall={sendMessage}
        hasVoiceKey={hasVoiceKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.white, paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  sessionToggleBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center" },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.text },
  headerStatus: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.success, marginTop: 1, maxWidth: 140 },
  headerActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  headerIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.separator, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  headerIconBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  headerCallBtn: { backgroundColor: Colors.success, borderColor: Colors.success },
  personaBar: { maxHeight: 44, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  personaBarContent: { paddingHorizontal: 12, gap: 8, alignItems: "center", paddingVertical: 6 },
  personaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.white,
  },
  personaLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.textSecondary },
  banner: { flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.warningLight, borderBottomWidth: 1, borderBottomColor: Colors.warning + "44" },
  bannerText: { flex: 1, fontFamily: "Poppins_500Medium", fontSize: 12, color: Colors.text },
  msgList: { paddingHorizontal: 16, paddingTop: 16, gap: 12, flexGrow: 1 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  msgRowUser: { flexDirection: "row-reverse" },
  botAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  bubble: { borderRadius: 18, padding: 12, paddingHorizontal: 16, paddingTop: 22, gap: 4 },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: Colors.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.cardBorder },
  bubbleText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, lineHeight: 22 },
  bubbleTime: { fontFamily: "Poppins_400Regular", fontSize: 10, color: Colors.textMuted, alignSelf: "flex-end", marginTop: 2 },
  copyCorner: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  botActions: { flexDirection: "row", gap: 6 },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  actionChipActive: { backgroundColor: Colors.primary },
  actionChipText: { fontFamily: "Poppins_500Medium", fontSize: 10, color: Colors.primary },
  emptyState: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 12 },
  emptyAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.primaryLight, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: "Poppins_700Bold", fontSize: 22, color: Colors.text },
  emptyText: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22, maxWidth: 260 },
  voiceNote: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.primary },
  voiceNoteText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.primary },
  suggestGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 },
  suggestChip: { backgroundColor: Colors.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.primary },
  suggestText: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.primary },
  typingRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.white, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  inputBar: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 8, gap: 8, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  newChatIconBtn: { paddingBottom: 10 },
  textInput: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 15, color: Colors.text, backgroundColor: Colors.separator, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 110, borderWidth: 1, borderColor: Colors.cardBorder },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  sessionsOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sessionsDrawer: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
  sessionsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sessionsTitle: { fontFamily: "Poppins_700Bold", fontSize: 18, color: Colors.text },
  newChatBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  newChatBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.white },
  sessionItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: Colors.separator },
  sessionItemActive: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  sessionItemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.white, justifyContent: "center", alignItems: "center" },
  sessionItemName: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  sessionItemMeta: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  sessionItemActions: { flexDirection: "row", gap: 6 },
  sessionActionBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.white, justifyContent: "center", alignItems: "center" },
  sessionsCloseBtn: { backgroundColor: Colors.separator, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  sessionsCloseBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: Colors.textSecondary },
  callModal: { flex: 1, backgroundColor: "#0F172A" },
  callTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: Platform.OS === "ios" ? 60 : 36 },
  callCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
  callTitle: { fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.white },
  callBody: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  callPulse: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(37,99,235,0.25)" },
  callAvatar: { width: 130, height: 130, borderRadius: 65, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
  callName: { fontFamily: "Poppins_700Bold", fontSize: 22, color: Colors.white, marginTop: 14 },
  callStatus: { fontFamily: "Poppins_400Regular", fontSize: 13, color: "rgba(255,255,255,0.65)", textAlign: "center", maxWidth: 280 },
  callTranscript: { marginTop: 24, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", maxWidth: 320 },
  callTranscriptLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.6 },
  callTranscriptText: { fontFamily: "Poppins_400Regular", fontSize: 13, color: Colors.white, marginTop: 6, lineHeight: 20 },
  callFooter: { alignItems: "center", paddingBottom: Platform.OS === "ios" ? 50 : 30, gap: 6 },
  callStopBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#DC2626", justifyContent: "center", alignItems: "center" },
  callFooterHint: { fontFamily: "Poppins_400Regular", fontSize: 11, color: "rgba(255,255,255,0.5)" },
});
