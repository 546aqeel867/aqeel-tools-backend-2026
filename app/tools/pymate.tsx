import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, Alert, ActivityIndicator, Clipboard, KeyboardAvoidingView,
  Animated, Easing,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ToolHeader from "@/components/ToolHeader";
import { Colors } from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { useNitro } from "@/contexts/NitroContext";
import { getApiUrl } from "@/lib/query-client";
import { router } from "expo-router";

const ACCENT = "#10B981";
const ACCENT_LIGHT = "#ECFDF5";
const ACCENT_DARK = "#059669";
const PY_DARK = "#0D1117";
const PY_PURPLE = "#7C3AED";
const PY_BG = "#161B22";

interface Snippet {
  id: string; name: string; desc: string; code: string; category: string;
}

const SNIPPETS: Snippet[] = [
  { id: "hello", name: "Hello World", desc: "Your first Python program", category: "Basics",
    code: `# Hello World in Python\nprint("Hello, World!")\n\n# Variables\nname = "Aqeel"\nage = 20\nprint(f"My name is {name} and I am {age} years old.")` },
  { id: "list", name: "List Operations", desc: "Working with Python lists", category: "Basics",
    code: `# Python Lists\nfruits = ["apple", "banana", "orange"]\n\n# Add item\nfruits.append("mango")\n\n# Loop through list\nfor fruit in fruits:\n    print(f"I like {fruit}")\n\n# List comprehension\nupper_fruits = [f.upper() for f in fruits]\nprint(upper_fruits)` },
  { id: "dict", name: "Dictionaries", desc: "Key-value data storage", category: "Basics",
    code: `# Python Dictionary\nperson = {\n    "name": "Aqeel",\n    "age": 20,\n    "city": "Dubai"\n}\n\n# Access value\nprint(person["name"])\n\n# Add/update\nperson["job"] = "Developer"\n\n# Loop through dict\nfor key, value in person.items():\n    print(f"{key}: {value}")` },
  { id: "func", name: "Functions", desc: "Reusable code blocks", category: "Basics",
    code: `# Python Functions\ndef greet(name, greeting="Hello"):\n    return f"{greeting}, {name}!"\n\n# Call function\nprint(greet("Aqeel"))\nprint(greet("World", "Hi"))\n\n# Lambda function\nsquare = lambda x: x ** 2\nprint(square(5))  # Output: 25` },
  { id: "class", name: "Classes & OOP", desc: "Object-oriented programming", category: "OOP",
    code: `# Python Class\nclass Person:\n    def __init__(self, name, age):\n        self.name = name\n        self.age = age\n    \n    def greet(self):\n        return f"Hi, I'm {self.name}, {self.age} years old!"\n\n# Create object\naqeel = Person("Aqeel", 20)\nprint(aqeel.greet())` },
  { id: "file", name: "File Operations", desc: "Read and write files", category: "Files",
    code: `# File Operations in Python\n\n# Write to file\nwith open("data.txt", "w") as f:\n    f.write("Hello, File!\\n")\n\n# Read from file\nwith open("data.txt", "r") as f:\n    content = f.read()\n    print(content)` },
  { id: "exception", name: "Error Handling", desc: "Try/except patterns", category: "Advanced",
    code: `# Python Exception Handling\ntry:\n    number = int(input("Enter a number: "))\n    result = 10 / number\n    print(f"Result: {result}")\nexcept ValueError:\n    print("Please enter a valid number!")\nexcept ZeroDivisionError:\n    print("Cannot divide by zero!")\nfinally:\n    print("This always runs!")` },
  { id: "api", name: "API Requests", desc: "Fetch data from APIs", category: "Advanced",
    code: `# API Requests with Python\nimport requests\n\n# GET request\nresponse = requests.get("https://api.github.com/users/octocat")\n\nif response.status_code == 200:\n    data = response.json()\n    print(f"Name: {data['name']}")\n    print(f"Followers: {data['followers']}")\nelse:\n    print(f"Error: {response.status_code}")` },
  { id: "comprehension", name: "List Comprehensions", desc: "Pythonic data transformations", category: "Pythonic",
    code: `# Python List Comprehensions\nnumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\n\n# Even numbers\nevens = [n for n in numbers if n % 2 == 0]\nprint("Evens:", evens)\n\n# Squares\nsquares = [n**2 for n in numbers]\nprint("Squares:", squares)` },
  { id: "decorator", name: "Decorators", desc: "Advanced function patterns", category: "Advanced",
    code: `# Python Decorators\nimport time\n\ndef timer(func):\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        end = time.time()\n        print(f"{func.__name__} took {end-start:.4f}s")\n        return result\n    return wrapper\n\n@timer\ndef slow_function():\n    time.sleep(0.1)\n    return "done"\n\nresult = slow_function()` },
];

const CATEGORIES = ["All", "Basics", "OOP", "Files", "Advanced", "Pythonic"];
interface ChatMsg { role: "user" | "assistant"; content: string; }

// ── Animated message wrapper ────────────────────────────────────────────────
function AnimatedMsg({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── Bouncing typing dot ─────────────────────────────────────────────────────
function BouncingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: -6, duration: 320, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(200),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.dot, { transform: [{ translateY: anim }] }]} />;
}

// ── Animated Python logo ────────────────────────────────────────────────────
function PySnakeIcon() {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.08, tension: 120, friction: 6, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View style={[s.snakeWrap, { transform: [{ scale }] }]}>
      <Animated.View style={[s.snakeGlow, { opacity: glowOpacity }]} />
      <Text style={s.snakeEmoji}>🐍</Text>
    </Animated.View>
  );
}

export default function PymateScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { apiKeys, hasAiKey } = useApp();
  const { isNitro, activateDemo } = useNitro();

  const [activeTab, setActiveTab] = useState<"chat" | "snippets" | "reference">("chat");
  const [category, setCategory] = useState("All");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "🐍 Hey! I'm PyMate, your Python coding assistant.\n\nAsk me anything Python:\n• 'Explain list comprehensions'\n• 'Write a function to sort a dict'\n• 'Debug this code: [paste your code]'\n• 'What is a decorator?'\n\nOr pick a snippet from the Snippets tab!" }
  ]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const tabLineAnim = useRef(new Animated.Value(0)).current;

  const TAB_NAMES: ("chat" | "snippets" | "reference")[] = ["chat", "snippets", "reference"];
  const TAB_LABELS = ["AI Chat", "Snippets", "Reference"];
  const TAB_ICONS = ["chatbubble-ellipses", "code-slash", "book"] as const;

  const switchTab = (tab: "chat" | "snippets" | "reference") => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    const idx = TAB_NAMES.indexOf(tab);
    Animated.spring(tabLineAnim, { toValue: idx, tension: 220, friction: 14, useNativeDriver: true }).start();
  };

  const sendMessage = useCallback(async () => {
    if (!question.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg = question.trim();
    setQuestion("");
    const newMessages: ChatMsg[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    if (hasAiKey) {
      try {
        const systemPrompt = `You are PyMate, an expert Python coding assistant embedded in a mobile app. You help users learn Python, debug code, and write programs. Always format code in code blocks. Be concise but complete. Use emojis sparingly for friendliness. Always explain what the code does.`;
        const resp = await fetch(new URL("/api/ai/chat", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              ...newMessages.map((m) => ({ role: m.role, content: m.content })),
            ],
            apiKey: apiKeys.openrouterKey || apiKeys.huggingfaceKey,
            model: "meta-llama/llama-3.1-8b-instruct:free",
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.message) {
            setMessages((prev) => [...prev, { role: "assistant", content: json.message }]);
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            return;
          }
        }
      } catch {}
    }
    const offline = getOfflineAnswer(userMsg);
    setMessages((prev) => [...prev, { role: "assistant", content: offline }]);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [question, messages, hasAiKey, apiKeys]);

  const copyCode = async (text: string, id?: string) => {
    await Clipboard.setString(text);
    setCopied(id ?? "msg");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(null), 2000);
  };

  const loadSnippet = (snippet: Snippet) => {
    setQuestion(`Explain this Python code:\n\`\`\`python\n${snippet.code}\n\`\`\``);
    switchTab("chat");
  };

  const filtered = category === "All" ? SNIPPETS : SNIPPETS.filter((s) => s.category === category);

  // ── Nitro gate ─────────────────────────────────────────────────────────────
  if (!isNitro) {
    return (
      <View style={[s.container, { paddingTop: topPad }]}>
        <ToolHeader title="PyMate" subtitle="Python AI Assistant" accentColor={ACCENT} />
        <ScrollView contentContainerStyle={[s.gateScroll, { paddingBottom: bottomPad + 32 }]}>
          <View style={s.gateHero}>
            <View style={s.gateGlow} />
            <PySnakeIcon />
            <Text style={s.gateTitle}>PyMate Python AI</Text>
            <Text style={s.gateDesc}>
              Your intelligent Python coding companion. Learn, debug, and write Python with AI guidance.
            </Text>
            <View style={s.gateBadgeRow}>
              <View style={s.gateBadge}>
                <Ionicons name="lock-closed" size={12} color="#FF6B00" />
                <Text style={s.gateBadgeText}>NITRO BAT EXCLUSIVE</Text>
              </View>
            </View>
          </View>

          <View style={s.gateFeatureList}>
            {[
              { icon: "chatbubble-ellipses", label: "AI Python Q&A", desc: "Ask any Python question, get expert answers" },
              { icon: "code-slash", label: "10+ Code Snippets", desc: "Ready-to-use Python templates" },
              { icon: "book", label: "Quick Reference", desc: "Full syntax reference at your fingertips" },
              { icon: "bug", label: "Code Debugger", desc: "Paste code, get AI debug help" },
            ].map((f, i) => (
              <View key={i} style={s.gateFeatureRow}>
                <View style={s.gateFeatureIcon}>
                  <Ionicons name={f.icon as any} size={18} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.gateFeatureLabel}>{f.label}</Text>
                  <Text style={s.gateFeatureDesc}>{f.desc}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={18} color={ACCENT} />
              </View>
            ))}
          </View>

          <Pressable onPress={() => router.push("/(tabs)/nitro" as any)} style={({ pressed }) => [s.gateBtn, pressed && { opacity: 0.88 }]}>
            <Text style={{ fontSize: 18 }}>🦇</Text>
            <Text style={s.gateBtnText}>Unlock with Nitro Bat</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
          </Pressable>

          <Pressable onPress={async () => { await activateDemo(); }} style={s.gateFreeBtn}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FF6B00" />
            <Text style={s.gateFreeBtnText}>Start Free 7-Day Trial</Text>
          </Pressable>

          <Text style={s.gateFootnote}>No credit card required · Cancel anytime</Text>
        </ScrollView>
      </View>
    );
  }

  const tabWidth = 33.33;
  const tabLineX = tabLineAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ["0%", "33.33%", "66.66%"],
  });

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <ToolHeader
        title="PyMate"
        subtitle="Python AI assistant"
        accentColor={ACCENT}
        rightElement={
          <View style={s.nitroBadge}>
            <MaterialCommunityIcons name="crown" size={12} color="#F59E0B" />
            <Text style={s.nitroBadgeText}>NITRO</Text>
          </View>
        }
      />

      {/* ── Tab Bar ── */}
      <View style={s.tabRow}>
        {TAB_NAMES.map((tab, idx) => (
          <Pressable key={tab} onPress={() => switchTab(tab)} style={s.tab}>
            <View style={s.tabInner}>
              <Ionicons name={TAB_ICONS[idx] as any} size={14} color={activeTab === tab ? ACCENT : Colors.textMuted} />
              <Text style={[s.tabText, activeTab === tab && { color: ACCENT }]}>{TAB_LABELS[idx]}</Text>
            </View>
          </Pressable>
        ))}
        <View style={s.tabTrack}>
          <Animated.View style={[s.tabLine, { width: `${tabWidth}%` as any, left: tabLineX }]} />
        </View>
      </View>

      {/* ─── CHAT TAB ─── */}
      {activeTab === "chat" && (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.chatScroll}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg, i) => (
              <AnimatedMsg key={i} delay={0}>
                <View style={[s.bubble, msg.role === "user" ? s.userBubble : s.aiBubble]}>
                  {msg.role === "assistant" && (
                    <View style={s.aiAvatar}>
                      <Text style={{ fontSize: 13 }}>🐍</Text>
                    </View>
                  )}
                  <View style={[s.bubbleInner, msg.role === "user" && { alignItems: "flex-end" }]}>
                    <MessageContent content={msg.content} isUser={msg.role === "user"} onCopy={copyCode} copiedId={copied} />
                  </View>
                </View>
              </AnimatedMsg>
            ))}
            {loading && (
              <AnimatedMsg>
                <View style={[s.bubble, s.aiBubble]}>
                  <View style={s.aiAvatar}><Text style={{ fontSize: 13 }}>🐍</Text></View>
                  <View style={s.typingCard}>
                    <BouncingDot delay={0} />
                    <BouncingDot delay={120} />
                    <BouncingDot delay={240} />
                  </View>
                </View>
              </AnimatedMsg>
            )}
          </ScrollView>

          <View style={[s.inputArea, { paddingBottom: bottomPad + 10 }]}>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask a Python question or paste code…"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
                returnKeyType="send"
                onSubmitEditing={sendMessage}
              />
              <Pressable
                onPress={sendMessage}
                disabled={loading || !question.trim()}
                style={[s.sendBtn, (!question.trim() || loading) && { opacity: 0.45 }]}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={17} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ─── SNIPPETS TAB ─── */}
      {activeTab === "snippets" && (
        <ScrollView contentContainerStyle={[s.padScroll, { paddingBottom: bottomPad + 40 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
            {CATEGORIES.map((cat) => (
              <Pressable key={cat} onPress={() => { Haptics.selectionAsync(); setCategory(cat); }} style={[s.catChip, category === cat && s.catChipOn]}>
                <Text style={[s.catChipText, category === cat && { color: ACCENT }]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ gap: 14 }}>
            {filtered.map((snip) => (
              <View key={snip.id} style={s.snippetCard}>
                <View style={s.snippetHeader}>
                  <View style={s.snippetLeft}>
                    <Text style={s.snippetName}>{snip.name}</Text>
                    <Text style={s.snippetDesc}>{snip.desc}</Text>
                  </View>
                  <View style={[s.snippetCat, { backgroundColor: ACCENT + "18" }]}>
                    <Text style={[s.snippetCatText, { color: ACCENT }]}>{snip.category}</Text>
                  </View>
                </View>
                <View style={s.codeBlock}>
                  <View style={s.codeBlockHeader}>
                    <View style={s.codeDots}>
                      <View style={[s.codeDot, { backgroundColor: "#FF5F57" }]} />
                      <View style={[s.codeDot, { backgroundColor: "#FFBD2E" }]} />
                      <View style={[s.codeDot, { backgroundColor: "#28CA41" }]} />
                    </View>
                    <Text style={s.codeBlockLang}>Python</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={s.codeText}>{snip.code}</Text>
                  </ScrollView>
                </View>
                <View style={s.snippetActions}>
                  <Pressable onPress={() => copyCode(snip.code, snip.id)} style={s.snippetCopyBtn}>
                    <Ionicons name={copied === snip.id ? "checkmark" : "copy-outline"} size={14} color={ACCENT} />
                    <Text style={s.snippetCopyText}>{copied === snip.id ? "Copied!" : "Copy"}</Text>
                  </Pressable>
                  <Pressable onPress={() => loadSnippet(snip)} style={s.snippetAskBtn}>
                    <MaterialCommunityIcons name="robot-outline" size={14} color="#fff" />
                    <Text style={s.snippetAskText}>Explain with AI</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ─── REFERENCE TAB ─── */}
      {activeTab === "reference" && (
        <ScrollView contentContainerStyle={[s.padScroll, { paddingBottom: bottomPad + 40 }]}>
          <View style={{ gap: 14 }}>
            {REFERENCE.map((section) => (
              <View key={section.title} style={s.refSection}>
                <View style={s.refSectionHeader}>
                  <Text style={s.refSectionEmoji}>{section.emoji}</Text>
                  <Text style={s.refTitle}>{section.title}</Text>
                </View>
                {section.items.map((item, i) => (
                  <Pressable key={i} onPress={() => copyCode(item.code, section.title + i)} style={s.refRow}>
                    <Text style={s.refLabel}>{item.label}</Text>
                    <View style={s.refCode}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Text style={s.refCodeText}>{item.code}</Text>
                      </ScrollView>
                      <Ionicons name={copied === section.title + i ? "checkmark" : "copy-outline"} size={11} color="rgba(255,255,255,0.4)" />
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Message renderer ────────────────────────────────────────────────────────
function MessageContent({ content, isUser, onCopy, copiedId }: {
  content: string; isUser: boolean;
  onCopy: (c: string, id?: string) => void;
  copiedId: string | null;
}) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <View style={{ gap: 6, maxWidth: "100%" }}>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const code = part.replace(/```python\n?|```\n?|```/g, "").trim();
          const id = "inline" + i;
          return (
            <View key={i} style={s.inlineCode}>
              <View style={s.codeBlockHeader}>
                <View style={s.codeDots}>
                  <View style={[s.codeDot, { backgroundColor: "#FF5F57" }]} />
                  <View style={[s.codeDot, { backgroundColor: "#FFBD2E" }]} />
                  <View style={[s.codeDot, { backgroundColor: "#28CA41" }]} />
                </View>
                <Text style={s.codeBlockLang}>Python</Text>
                <Pressable onPress={() => onCopy(code, id)} style={s.inlineCopyBtn}>
                  <Ionicons name={copiedId === id ? "checkmark" : "copy-outline"} size={12} color="rgba(255,255,255,0.5)" />
                  <Text style={s.inlineCopyText}>{copiedId === id ? "Copied" : "Copy"}</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <Text style={s.inlineCodeText}>{code}</Text>
              </ScrollView>
            </View>
          );
        }
        if (!part.trim()) return null;
        return (
          <Text key={i} style={isUser ? s.userText : s.aiText}>{part.trim()}</Text>
        );
      })}
    </View>
  );
}

function getOfflineAnswer(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("list comprehension")) return "🐍 **List Comprehensions** are a concise way to create lists:\n\n```python\n# Traditional loop\nresult = []\nfor x in range(10):\n    result.append(x**2)\n\n# Comprehension - same result!\nresult = [x**2 for x in range(10)]\n\n# With condition\nevens = [x for x in range(20) if x % 2 == 0]\n```\n\nThey're faster and more Pythonic!";
  if (lower.includes("decorator")) return "🎀 **Decorators** wrap functions to add behavior:\n\n```python\ndef my_decorator(func):\n    def wrapper(*args, **kwargs):\n        print('Before function')\n        result = func(*args, **kwargs)\n        print('After function')\n        return result\n    return wrapper\n\n@my_decorator\ndef say_hello():\n    print('Hello!')\n\nsay_hello()\n```";
  if (lower.includes("class") || lower.includes("oop")) return "🏛️ **Python Classes**:\n\n```python\nclass Animal:\n    def __init__(self, name, sound):\n        self.name = name\n        self.sound = sound\n    \n    def speak(self):\n        return f'{self.name} says {self.sound}!'\n\ndog = Animal('Dog', 'Woof')\nprint(dog.speak())\n```";
  if (lower.includes("lambda")) return "⚡ **Lambda Functions**:\n\n```python\n# Regular function\ndef add(a, b):\n    return a + b\n\n# Lambda equivalent\nadd = lambda a, b: a + b\n\n# Sort by second element\npairs = [(1, 'b'), (2, 'a')]\npairs.sort(key=lambda x: x[1])\n```";
  if (lower.includes("dict") || lower.includes("dictionary")) return "📚 **Python Dictionaries**:\n\n```python\nperson = {'name': 'Aqeel', 'age': 20}\n\n# Safe access\nname = person.get('name', 'Unknown')\n\n# Loop\nfor key, value in person.items():\n    print(f'{key}: {value}')\n\n# Dict comprehension\nsquares = {x: x**2 for x in range(5)}\n```";
  if (lower.includes("error") || lower.includes("exception") || lower.includes("debug")) return "🐛 **Exception Handling**:\n\n```python\ntry:\n    result = int(input('Enter number: '))\n    print(10 / result)\nexcept ValueError:\n    print('Not a valid number!')\nexcept ZeroDivisionError:\n    print('Cannot divide by zero!')\nfinally:\n    print('Always runs!')\n```";
  return `🐍 Great question about Python!\n\nI'll help you with "${q.slice(0, 50)}..."\n\nConnect an AI key in Settings for detailed answers. Quick tip:\n\n\`\`\`python\n# Use help() to learn about any function\nhelp(print)\n\n# dir() shows available methods\nprint(dir([]))\n\`\`\`\n\nCheck the Snippets tab for ready-to-use examples!`;
}

const REFERENCE = [
  { title: "Data Types", emoji: "📦", items: [
    { label: "Integer", code: "x = 42" }, { label: "Float", code: "x = 3.14" },
    { label: "String", code: "s = 'hello'" }, { label: "Boolean", code: "b = True" },
    { label: "List", code: "lst = [1, 2, 3]" }, { label: "Tuple", code: "tup = (1, 2, 3)" },
    { label: "Dict", code: "d = {'key': 'val'}" }, { label: "Set", code: "s = {1, 2, 3}" },
  ]},
  { title: "Control Flow", emoji: "🔀", items: [
    { label: "if/elif/else", code: "if x > 0:\n    pass\nelif x < 0:\n    pass\nelse:\n    pass" },
    { label: "for loop", code: "for i in range(10):\n    print(i)" },
    { label: "while loop", code: "while condition:\n    do_something()" },
    { label: "break", code: "break  # exit loop" },
    { label: "continue", code: "continue  # skip iteration" },
  ]},
  { title: "String Methods", emoji: "📝", items: [
    { label: "Upper/Lower", code: "s.upper()  s.lower()" },
    { label: "Strip", code: "s.strip()  # remove whitespace" },
    { label: "Split", code: "s.split(',')  # split by comma" },
    { label: "Join", code: "', '.join(['a','b'])" },
    { label: "Replace", code: "s.replace('old', 'new')" },
    { label: "Format", code: "f'Hello {name}!'" },
  ]},
  { title: "List Methods", emoji: "📋", items: [
    { label: "Append", code: "lst.append(item)" },
    { label: "Extend", code: "lst.extend([1,2,3])" },
    { label: "Remove", code: "lst.remove(item)" },
    { label: "Pop", code: "lst.pop()  # last item" },
    { label: "Sort", code: "lst.sort()\nlst.sort(reverse=True)" },
    { label: "Length", code: "len(lst)" },
    { label: "Slice", code: "lst[1:4]  lst[::2]" },
  ]},
  { title: "Built-in Functions", emoji: "⚡", items: [
    { label: "Print", code: "print('hello', end='')" },
    { label: "Range", code: "range(start, stop, step)" },
    { label: "Enumerate", code: "for i, v in enumerate(lst):" },
    { label: "Zip", code: "for a, b in zip(lst1, lst2):" },
    { label: "Map", code: "list(map(func, lst))" },
    { label: "Filter", code: "list(filter(func, lst))" },
    { label: "Sorted", code: "sorted(lst, key=..., reverse=True)" },
  ]},
];

const MONO = Platform.OS === "ios" ? "Courier New" : "monospace";

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Gate screen
  gateScroll: { paddingHorizontal: 20, paddingTop: 16, gap: 16, alignItems: "stretch" },
  gateHero: { alignItems: "center", gap: 12, paddingVertical: 24, position: "relative" },
  gateGlow: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: ACCENT, opacity: 0.08, top: 0 },
  snakeWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: ACCENT + "40", position: "relative" },
  snakeGlow: { position: "absolute", inset: -8, borderRadius: 53, backgroundColor: ACCENT, opacity: 0.15 },
  snakeEmoji: { fontSize: 44 },
  gateTitle: { fontFamily: "Poppins_700Bold", fontSize: 24, color: Colors.text, letterSpacing: -0.3 },
  gateDesc: { fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  gateBadgeRow: { flexDirection: "row", gap: 8 },
  gateBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FFF3E8", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "#FF6B0040" },
  gateBadgeText: { fontFamily: "Poppins_700Bold", fontSize: 10, color: "#FF6B00", letterSpacing: 0.5 },
  gateFeatureList: { backgroundColor: Colors.white, borderRadius: 20, padding: 4, gap: 0, borderWidth: 1, borderColor: Colors.cardBorder },
  gateFeatureRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  gateFeatureIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: ACCENT_LIGHT, justifyContent: "center", alignItems: "center" },
  gateFeatureLabel: { fontFamily: "Poppins_600SemiBold", fontSize: 13, color: Colors.text },
  gateFeatureDesc: { fontFamily: "Poppins_400Regular", fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  gateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#FF6B00", borderRadius: 16, paddingVertical: 16, shadowColor: "#FF6B00", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  gateBtnText: { fontFamily: "Poppins_700Bold", fontSize: 15, color: "#fff" },
  gateFreeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: "#FF6B00", backgroundColor: "#FFF3E8" },
  gateFreeBtnText: { fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#FF6B00" },
  gateFootnote: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textMuted, textAlign: "center" },

  // Active screen
  nitroBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FFF8E7", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#F59E0B60" },
  nitroBadgeText: { fontFamily: "Poppins_700Bold", fontSize: 10, color: "#F59E0B" },

  tabRow: { flexDirection: "row", backgroundColor: Colors.white, borderBottomWidth: 0, position: "relative", marginHorizontal: 0 },
  tab: { flex: 1, paddingVertical: 13 },
  tabInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  tabText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary },
  tabTrack: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.cardBorder },
  tabLine: { position: "absolute", height: 2, backgroundColor: ACCENT, borderRadius: 2 },

  chatScroll: { padding: 16, gap: 14, paddingBottom: 20 },
  bubble: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  userBubble: { justifyContent: "flex-end" },
  aiBubble: { justifyContent: "flex-start" },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT + "18", justifyContent: "center", alignItems: "center", marginTop: 2, flexShrink: 0, borderWidth: 1, borderColor: ACCENT + "30" },
  bubbleInner: { flex: 1, gap: 5 },
  aiText: { fontFamily: "Poppins_400Regular", fontSize: 13.5, color: Colors.text, lineHeight: 22, backgroundColor: Colors.white, padding: 13, borderRadius: 18, borderTopLeftRadius: 5, borderWidth: 1, borderColor: Colors.cardBorder, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  userText: { fontFamily: "Poppins_400Regular", fontSize: 13.5, color: "#fff", lineHeight: 22, backgroundColor: ACCENT, padding: 13, borderRadius: 18, borderTopRightRadius: 5, shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },

  inlineCode: { backgroundColor: PY_BG, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  codeBlockHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: PY_DARK, gap: 8 },
  codeDots: { flexDirection: "row", gap: 5 },
  codeDot: { width: 10, height: 10, borderRadius: 5 },
  codeBlockLang: { flex: 1, fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5 },
  inlineCopyBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.07)" },
  inlineCopyText: { fontFamily: "Poppins_500Medium", fontSize: 10, color: "rgba(255,255,255,0.5)" },
  inlineCodeText: { fontFamily: MONO, fontSize: 12.5, color: "#A9DC76", lineHeight: 22, padding: 12, paddingTop: 8 },

  typingCard: { flexDirection: "row", gap: 6, backgroundColor: Colors.white, padding: 16, borderRadius: 18, borderTopLeftRadius: 5, alignItems: "center", borderWidth: 1, borderColor: Colors.cardBorder },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: ACCENT },

  inputArea: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingHorizontal: 14, paddingTop: 10 },
  inputWrap: { flexDirection: "row", alignItems: "flex-end", gap: 10, backgroundColor: Colors.background, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.cardBorder, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontFamily: "Poppins_400Regular", fontSize: 14, color: Colors.text, maxHeight: 100, paddingVertical: 4 },
  sendBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: ACCENT, justifyContent: "center", alignItems: "center", shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },

  padScroll: { padding: 16, gap: 0 },
  catRow: { gap: 8, marginBottom: 14, paddingVertical: 2 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.cardBorder },
  catChipOn: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  catChipText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: Colors.textSecondary },

  snippetCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: Colors.cardBorder, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 14 },
  snippetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  snippetLeft: { flex: 1, gap: 2 },
  snippetName: { fontFamily: "Poppins_700Bold", fontSize: 15, color: Colors.text },
  snippetDesc: { fontFamily: "Poppins_400Regular", fontSize: 12, color: Colors.textSecondary },
  snippetCat: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  snippetCatText: { fontFamily: "Poppins_700Bold", fontSize: 10 },
  codeBlock: { backgroundColor: PY_BG, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  codeText: { fontFamily: MONO, fontSize: 12, color: "#A9DC76", lineHeight: 20, padding: 14, paddingTop: 8 },
  snippetActions: { flexDirection: "row", gap: 10 },
  snippetCopyBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: ACCENT + "60", backgroundColor: ACCENT_LIGHT },
  snippetCopyText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: ACCENT },
  snippetAskBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: PY_PURPLE, shadowColor: PY_PURPLE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  snippetAskText: { fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#fff" },

  refSection: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  refSectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  refSectionEmoji: { fontSize: 18 },
  refTitle: { fontFamily: "Poppins_700Bold", fontSize: 14, color: Colors.text },
  refRow: { gap: 5 },
  refLabel: { fontFamily: "Poppins_500Medium", fontSize: 11, color: Colors.textMuted },
  refCode: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: PY_BG, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  refCodeText: { fontFamily: MONO, fontSize: 12, color: "#A9DC76", flex: 1 },
});
