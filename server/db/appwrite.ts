import { Client, Databases, ID, Query, Models } from "node-appwrite";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "aqeel_tools_db";

export const COLLECTIONS = {
  PROFILES: "profiles",
  NOTES: "notes",
  CHAT_SESSIONS: "chat_sessions",
  API_KEYS: "api_keys",
};

export function isConfigured(): boolean {
  return !!(PROJECT_ID && API_KEY);
}

function getDb(): Databases | null {
  if (!isConfigured()) return null;
  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);
  return new Databases(client);
}

function safeDocId(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9._-]/g, "_").slice(0, 36);
}

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  avatarEmoji: string;
  avatarColor: string;
  toolsUsedCount: number;
  settings: string;
}

export interface NoteDoc {
  userId: string;
  noteId: string;
  title: string;
  content: string;
  tag: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionDoc {
  userId: string;
  sessionId: string;
  name: string;
  messages: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApiKeysDoc {
  userId: string;
  aiProvider: string;
  openrouterKey: string;
  huggingfaceKey: string;
  elevenlabsKey: string;
  elevenlabsVoiceId: string;
}

async function upsertDoc(
  db: Databases,
  collectionId: string,
  documentId: string,
  data: Record<string, unknown>,
): Promise<Models.Document> {
  try {
    return await db.updateDocument(DATABASE_ID, collectionId, documentId, data);
  } catch {
    return await db.createDocument(DATABASE_ID, collectionId, documentId, data);
  }
}

export async function saveProfile(profile: UserProfile): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const docId = safeDocId(profile.email);
    await upsertDoc(db, COLLECTIONS.PROFILES, docId, profile as unknown as Record<string, unknown>);
    return true;
  } catch (e: any) {
    console.error("[appwrite] saveProfile:", e.message);
    return false;
  }
}

export async function getProfile(email: string): Promise<UserProfile | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const docId = safeDocId(email);
    const doc = await db.getDocument(DATABASE_ID, COLLECTIONS.PROFILES, docId);
    return doc as unknown as UserProfile;
  } catch {
    return null;
  }
}

export async function syncNotes(userId: string, notes: NoteDoc[]): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const existing = await db.listDocuments(DATABASE_ID, COLLECTIONS.NOTES, [
      Query.equal("userId", userId),
      Query.limit(500),
    ]);
    const existingIds = new Set(existing.documents.map((d) => d.$id));
    const noteIds = new Set(notes.map((n) => `${safeDocId(userId)}_${n.noteId}`));

    for (const docId of existingIds) {
      if (!noteIds.has(docId)) {
        await db.deleteDocument(DATABASE_ID, COLLECTIONS.NOTES, docId).catch(() => {});
      }
    }

    for (const note of notes) {
      const docId = `${safeDocId(userId)}_${note.noteId}`.slice(0, 36);
      await upsertDoc(db, COLLECTIONS.NOTES, docId, { ...note, userId });
    }
    return true;
  } catch (e: any) {
    console.error("[appwrite] syncNotes:", e.message);
    return false;
  }
}

export async function getNotes(userId: string): Promise<NoteDoc[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const docs = await db.listDocuments(DATABASE_ID, COLLECTIONS.NOTES, [
      Query.equal("userId", userId),
      Query.limit(500),
      Query.orderDesc("updatedAt"),
    ]);
    return docs.documents as unknown as NoteDoc[];
  } catch {
    return [];
  }
}

export async function syncChatSessions(userId: string, sessions: ChatSessionDoc[]): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const existing = await db.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_SESSIONS, [
      Query.equal("userId", userId),
      Query.limit(100),
    ]);
    const existingIds = new Set(existing.documents.map((d) => d.$id));
    const sessionIds = new Set(sessions.map((s) => `${safeDocId(userId)}_${s.sessionId}`.slice(0, 36)));

    for (const docId of existingIds) {
      if (!sessionIds.has(docId)) {
        await db.deleteDocument(DATABASE_ID, COLLECTIONS.CHAT_SESSIONS, docId).catch(() => {});
      }
    }

    for (const session of sessions) {
      const docId = `${safeDocId(userId)}_${session.sessionId}`.slice(0, 36);
      await upsertDoc(db, COLLECTIONS.CHAT_SESSIONS, docId, { ...session, userId });
    }
    return true;
  } catch (e: any) {
    console.error("[appwrite] syncChatSessions:", e.message);
    return false;
  }
}

export async function getChatSessions(userId: string): Promise<ChatSessionDoc[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const docs = await db.listDocuments(DATABASE_ID, COLLECTIONS.CHAT_SESSIONS, [
      Query.equal("userId", userId),
      Query.limit(100),
      Query.orderDesc("updatedAt"),
    ]);
    return docs.documents as unknown as ChatSessionDoc[];
  } catch {
    return [];
  }
}

export async function saveApiKeys(userId: string, keys: ApiKeysDoc): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const docId = `keys_${safeDocId(userId)}`.slice(0, 36);
    await upsertDoc(db, COLLECTIONS.API_KEYS, docId, { ...keys, userId });
    return true;
  } catch (e: any) {
    console.error("[appwrite] saveApiKeys:", e.message);
    return false;
  }
}

export async function getApiKeys(userId: string): Promise<ApiKeysDoc | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const docId = `keys_${safeDocId(userId)}`.slice(0, 36);
    const doc = await db.getDocument(DATABASE_ID, COLLECTIONS.API_KEYS, docId);
    return doc as unknown as ApiKeysDoc;
  } catch {
    return null;
  }
}

export async function setupCollections(): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  if (!db) return { ok: false, message: "Appwrite not configured" };
  try {
    const collections = [
      {
        id: COLLECTIONS.PROFILES, name: "User Profiles",
        attrs: [
          { key: "userId", type: "string", size: 200, required: true },
          { key: "username", type: "string", size: 100, required: false },
          { key: "email", type: "string", size: 200, required: true },
          { key: "avatarEmoji", type: "string", size: 10, required: false },
          { key: "avatarColor", type: "string", size: 20, required: false },
          { key: "toolsUsedCount", type: "integer", required: false },
          { key: "settings", type: "string", size: 5000, required: false },
        ],
      },
      {
        id: COLLECTIONS.NOTES, name: "Notes",
        attrs: [
          { key: "userId", type: "string", size: 200, required: true },
          { key: "noteId", type: "string", size: 100, required: true },
          { key: "title", type: "string", size: 500, required: false },
          { key: "content", type: "string", size: 100000, required: false },
          { key: "tag", type: "string", size: 100, required: false },
          { key: "pinned", type: "boolean", required: false },
          { key: "createdAt", type: "integer", required: false },
          { key: "updatedAt", type: "integer", required: false },
        ],
      },
      {
        id: COLLECTIONS.CHAT_SESSIONS, name: "Chat Sessions",
        attrs: [
          { key: "userId", type: "string", size: 200, required: true },
          { key: "sessionId", type: "string", size: 100, required: true },
          { key: "name", type: "string", size: 200, required: false },
          { key: "messages", type: "string", size: 500000, required: false },
          { key: "createdAt", type: "integer", required: false },
          { key: "updatedAt", type: "integer", required: false },
        ],
      },
      {
        id: COLLECTIONS.API_KEYS, name: "API Keys",
        attrs: [
          { key: "userId", type: "string", size: 200, required: true },
          { key: "aiProvider", type: "string", size: 50, required: false },
          { key: "openrouterKey", type: "string", size: 500, required: false },
          { key: "huggingfaceKey", type: "string", size: 500, required: false },
          { key: "elevenlabsKey", type: "string", size: 500, required: false },
          { key: "elevenlabsVoiceId", type: "string", size: 100, required: false },
        ],
      },
    ];

    const { Client: AClient, Databases: ADatabases } = await import("node-appwrite");
    const adminClient = new AClient().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
    const adminDb = new ADatabases(adminClient);

    let dbExists = false;
    try {
      await adminDb.get(DATABASE_ID);
      dbExists = true;
    } catch {}

    if (!dbExists) {
      await adminDb.create(DATABASE_ID, "Aqeel Tools DB");
    }

    const messages: string[] = [];
    for (const col of collections) {
      let colExists = false;
      try {
        await adminDb.getCollection(DATABASE_ID, col.id);
        colExists = true;
      } catch {}

      if (!colExists) {
        await adminDb.createCollection(DATABASE_ID, col.id, col.name, [
          `read("any")`,
          `create("users")`,
          `update("users")`,
          `delete("users")`,
        ]);
        for (const attr of col.attrs) {
          try {
            if (attr.type === "string") {
              await adminDb.createStringAttribute(DATABASE_ID, col.id, attr.key, attr.size!, attr.required ?? false);
            } else if (attr.type === "integer") {
              await adminDb.createIntegerAttribute(DATABASE_ID, col.id, attr.key, attr.required ?? false);
            } else if (attr.type === "boolean") {
              await adminDb.createBooleanAttribute(DATABASE_ID, col.id, attr.key, attr.required ?? false);
            }
          } catch {}
        }
        messages.push(`Created collection: ${col.id}`);
      } else {
        messages.push(`Collection exists: ${col.id}`);
      }
    }

    return { ok: true, message: messages.join(", ") };
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
}
