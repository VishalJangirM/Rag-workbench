/**
 * Authentication service.
 *
 * Currently backed by a local (browser) mock store so the UI is fully usable
 * without a backend. Every call is async and returns the same shapes the
 * FastAPI backend is expected to return, so this module is the only file that
 * needs to change when real auth endpoints exist.
 */

import type { UserProfile, UserStats } from "@/types";

const STORAGE_KEY = "ragbench.session";
const USERS_KEY = "ragbench.users";

interface StoredUser {
  password: string;
  profile: UserProfile;
  stats: UserStats;
}

const DEFAULT_STATS: UserStats = {
  evaluationsRun: 42,
  experiments: 12,
  documents: 128,
  queriesEvaluated: 3480,
};

const DEMO_USER: StoredUser = {
  password: "ragbench",
  profile: {
    id: "usr_demo",
    fullName: "Vishal Jangir",
    username: "vishaljangir",
    email: "vishal@acme.ai",
    role: "ML Engineer",
    avatarUrl: null,
    memberSince: "2025-03-14",
  },
  stats: DEFAULT_STATS,
};

const isBrowser = () => typeof window !== "undefined";

function readUsers(): Record<string, StoredUser> {
  if (!isBrowser()) return { [DEMO_USER.profile.email]: DEMO_USER };
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, StoredUser>) : {};
    if (!parsed[DEMO_USER.profile.email]) parsed[DEMO_USER.profile.email] = DEMO_USER;
    return parsed;
  } catch {
    return { [DEMO_USER.profile.email]: DEMO_USER };
  }
}

function writeUsers(users: Record<string, StoredUser>) {
  if (isBrowser()) window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function findUser(identifier: string): StoredUser | undefined {
  const users = readUsers();
  const key = identifier.trim().toLowerCase();
  return (
    users[key] ??
    Object.values(users).find((user) => user.profile.username.toLowerCase() === key)
  );
}

export interface Session {
  user: UserProfile;
  stats: UserStats;
}

const delay = (ms = 420) => new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
  getSession(): Session | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  },

  persist(session: Session | null, remember = true) {
    if (!isBrowser()) return;
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    if (!remember) window.sessionStorage.setItem("ragbench.session.ephemeral", "1");
  },

  async signIn(identifier: string, password: string): Promise<Session> {
    await delay();
    const user = findUser(identifier);
    if (!user || user.password !== password) {
      throw new Error("Incorrect email/username or password.");
    }
    return { user: user.profile, stats: user.stats };
  },

  async signUp(input: {
    fullName: string;
    username: string;
    email: string;
    password: string;
  }): Promise<Session> {
    await delay();
    const users = readUsers();
    const key = input.email.trim().toLowerCase();
    if (users[key]) throw new Error("An account with this email already exists.");
    if (Object.values(users).some((u) => u.profile.username.toLowerCase() === input.username.toLowerCase())) {
      throw new Error("That username is already taken.");
    }
    const stored: StoredUser = {
      password: input.password,
      profile: {
        id: `usr_${Math.random().toString(36).slice(2, 10)}`,
        fullName: input.fullName.trim(),
        username: input.username.trim().replace(/^@/, ""),
        email: key,
        role: "ML Engineer",
        avatarUrl: null,
        memberSince: new Date().toISOString().slice(0, 10),
      },
      stats: { evaluationsRun: 0, experiments: 0, documents: 0, queriesEvaluated: 0 },
    };
    users[key] = stored;
    writeUsers(users);
    return { user: stored.profile, stats: stored.stats };
  },

  async updateProfile(profile: UserProfile): Promise<UserProfile> {
    await delay(300);
    const users = readUsers();
    const existingKey = Object.keys(users).find((key) => users[key]?.profile.id === profile.id);
    if (existingKey && users[existingKey]) {
      const record = users[existingKey];
      record.profile = profile;
      if (existingKey !== profile.email.toLowerCase()) {
        delete users[existingKey];
        users[profile.email.toLowerCase()] = record;
      }
      writeUsers(users);
    }
    return profile;
  },

  async requestPasswordReset(email: string): Promise<void> {
    await delay(300);
    if (!email) throw new Error("Enter your email address first.");
  },

  async signOut(): Promise<void> {
    await delay(120);
  },
};

export const DEMO_CREDENTIALS = {
  email: DEMO_USER.profile.email,
  password: DEMO_USER.password,
};
