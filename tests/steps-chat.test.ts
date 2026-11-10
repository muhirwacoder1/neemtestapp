import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StepTracker,
  dayKey,
  readStepLog,
  type StepSensor,
  type StepSnapshot,
} from "../src/steps/tracker";
import {
  appNeedsSignIn,
  aiViewState,
  authReturnPath,
  pageActions,
} from "../src/chat/session";
function harness(
  platform: StepSensor["platform"] = "android",
  initial: string | null = null,
) {
  let value = initial,
    permission = { granted: true, canAskAgain: true },
    systemCount = 1000;
  const snapshots: StepSnapshot[] = [],
    listeners: ((steps: number) => void)[] = [],
    removed: number[] = [];
  const storage = {
    getItem: vi.fn(async () => value),
    setItem: vi.fn(async (_key: string, next: string) => {
      value = next;
    }),
  };
  const sensor: StepSensor = {
    platform,
    requiresBuild: false,
    available: vi.fn(async () => true),
    permission: vi.fn(async (request) => {
      if (request) permission = { granted: true, canAskAgain: true };
      return permission;
    }),
    today: vi.fn(async () => systemCount),
    watch: vi.fn((callback) => {
      listeners.push(callback);
      return {
        remove: () => {
          removed.push(listeners.length);
        },
      };
    }),
  };
  const tracker = new StepTracker({
    key: "account-1/profile-1",
    sensor,
    storage,
    emit: (s) => snapshots.push(s),
  });
  return {
    tracker,
    sensor,
    storage,
    emit: (count: number) => listeners.at(-1)?.(count),
    snapshots,
    removed,
    get snapshot() {
      return snapshots.at(-1)!;
    },
    get value() {
      return value;
    },
    setPermission: (granted: boolean, canAskAgain = true) => {
      permission = { granted, canAskAgain };
    },
    setSystemCount: (count: number) => {
      systemCount = count;
    },
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 6, 12, 0));
});
afterEach(() => {
  vi.useRealTimers();
});
describe("phone steps", () => {
  it("asks for motion access only after the user enables counting", async () => {
    const h = harness();
    h.setPermission(false);
    await h.tracker.initialize(true);
    expect(h.snapshot.status).toBe("idle");
    expect(h.sensor.permission).toHaveBeenCalledWith(false);
    expect(h.sensor.watch).not.toHaveBeenCalled();
    await h.tracker.enable();
    expect(h.sensor.permission).toHaveBeenCalledWith(true);
    h.emit(4);
    expect(h.snapshot.day?.count).toBe(4);
    await h.tracker.dispose();
  });
  it("reports denied or absent sensors without inventing a measured zero", async () => {
    const h = harness();
    h.setPermission(false, false);
    await h.tracker.initialize(true);
    expect(h.snapshot.status).toBe("denied");
    expect(h.snapshot.day).toBeNull();
    const absent = harness();
    vi.mocked(absent.sensor.available).mockResolvedValue(false);
    await absent.tracker.initialize(true);
    expect(absent.snapshot.status).toBe("unavailable");
    expect(absent.snapshot.day).toBeNull();
    await h.tracker.dispose();
    await absent.tracker.dispose();
  });
  it("accumulates foreground deltas once and resumes across sessions without double counting", async () => {
    const h = harness();
    await h.tracker.initialize(true);
    [3, 7, 7, 4, 6].forEach(h.emit);
    expect(h.snapshot.day?.count).toBe(9);
    expect(h.storage.setItem).not.toHaveBeenCalled();
    await h.tracker.setActive(false);
    h.emit(100);
    expect(h.snapshot.day?.count).toBe(9);
    expect(h.removed).toHaveLength(1);
    await h.tracker.setActive(true);
    h.emit(2);
    h.tracker.setGoal(5000);
    await h.tracker.flush();
    expect(h.snapshot.day?.count).toBe(11);
    const persisted = h.value;
    await h.tracker.dispose();
    const resumed = harness("android", persisted);
    await resumed.tracker.initialize(true);
    resumed.emit(2);
    expect(resumed.snapshot.day?.count).toBe(13);
    expect(resumed.snapshot.goal).toBe(5000);
    expect(resumed.snapshot.day?.source).toBe("android");
    await resumed.tracker.dispose();
  });
  it("starts a separate local-calendar day at midnight and preserves yesterday", async () => {
    vi.setSystemTime(new Date(2026, 10, 6, 23, 59));
    const h = harness();
    await h.tracker.initialize(true);
    h.tracker.setGoal(3000);
    h.emit(10);
    vi.setSystemTime(new Date(2026, 10, 7, 0, 1));
    await h.tracker.tick();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    h.emit(3);
    expect(h.snapshot.day?.date).toBe(dayKey(new Date()));
    expect(h.snapshot.day?.count).toBe(3);
    await h.tracker.flush();
    expect(readStepLog(h.value).days.map((d) => d.count)).toEqual([10, 3]);
    expect(h.snapshot.goal).toBe(3000);
    await h.tracker.dispose();
  });
  it("uses authoritative iOS day totals instead of adding overlapping live counts", async () => {
    const h = harness("ios");
    await h.tracker.initialize(true);
    expect(h.snapshot.day?.count).toBe(1000);
    h.setSystemCount(1007);
    h.emit(7);
    h.emit(9);
    await vi.advanceTimersByTimeAsync(3100);
    expect(h.snapshot.day?.count).toBe(1007);
    expect(h.snapshot.day?.source).toBe("ios");
    expect(h.sensor.today).toHaveBeenCalledTimes(2);
    await h.tracker.dispose();
  });
  it("does not query motion in a browser or Android Expo Go", async () => {
    const web = harness("web");
    await web.tracker.initialize(true);
    expect(web.snapshot.status).toBe("web");
    expect(web.snapshot.day).toBeNull();
    expect(web.sensor.permission).not.toHaveBeenCalled();
    const go = harness();
    go.sensor.requiresBuild = true;
    await go.tracker.initialize(true);
    expect(go.snapshot.status).toBe("development-build");
    expect(go.snapshot.day).toBeNull();
    expect(go.sensor.watch).not.toHaveBeenCalled();
    await web.tracker.dispose();
    await go.tracker.dispose();
  });
  it("does not overwrite saved steps when an old account unmounts during storage loading", async () => {
    let finish!: (raw: string | null) => void;
    const getItem = vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            finish = resolve;
          }),
      ),
      setItem = vi.fn(async () => {});
    const sensor = harness().sensor;
    const tracker = new StepTracker({
      key: "old-account",
      sensor,
      storage: { getItem, setItem },
      emit: () => {},
    });
    const loading = tracker.initialize(true);
    await tracker.dispose();
    finish(JSON.stringify({ version: 1, goal: 8000, days: [] }));
    await loading;
    expect(setItem).not.toHaveBeenCalled();
    expect(sensor.watch).not.toHaveBeenCalled();
  });
  it("ignores invalid sensor totals and keeps a recoverable storage error visible", async () => {
    const h = harness();
    await h.tracker.initialize(true);
    h.emit(5);
    h.emit(-1);
    h.emit(Number.NaN);
    h.emit(1.5);
    expect(h.snapshot.day?.count).toBe(5);
    h.storage.setItem.mockRejectedValueOnce(new Error("disk"));
    await h.tracker.flush();
    expect(h.snapshot.storageError).toBe(true);
    await h.tracker.flush();
    expect(h.snapshot.storageError).toBe(false);
    await h.tracker.dispose();
  });
});
describe("one Neem session for AI", () => {
  it("requires one app-entry sign-in and keeps all app screens open to the existing session", () => {
    for (const path of ["/", "/ai", "/account", "/admin", "/billing"]) {
      expect(appNeedsSignIn({ loaded: true, signedIn: false }, path)).toBe(
        true,
      );
      expect(appNeedsSignIn({ loaded: true, signedIn: true }, path)).toBe(
        false,
      );
      expect(appNeedsSignIn({ loaded: false, signedIn: false }, path)).toBe(
        false,
      );
    }
    for (const path of ["/welcome", "/sign-in", "/sign-up", "/auth-callback"])
      expect(appNeedsSignIn({ loaded: true, signedIn: false }, path)).toBe(
        false,
      );
  });

  it("never sends an already signed-in person to a second sign-in during token or profile loading", () => {
    expect(
      aiViewState(
        { signedIn: true, loaded: false, authenticated: false },
        { busy: true, profileId: "visitor" },
      ),
    ).toBe("connecting");
    expect(
      aiViewState(
        { signedIn: true, loaded: true, authenticated: true },
        { busy: false, profileId: "profile1" },
      ),
    ).toBe("ready");
    expect(
      aiViewState(
        { signedIn: true, loaded: true, authenticated: false },
        { busy: false, profileId: "profile1" },
      ),
    ).toBe("connecting");
  });
  it("waits for account restoration and only prompts actual visitors", () => {
    expect(
      aiViewState(
        { signedIn: false, loaded: false, authenticated: false },
        { busy: false, profileId: "visitor" },
      ),
    ).toBe("checking");
    expect(
      aiViewState(
        { signedIn: false, loaded: true, authenticated: false },
        { busy: false, profileId: "visitor" },
      ),
    ).toBe("visitor");
  });
  it("returns AI visitors to chat after signing in without accepting external redirects", () => {
    expect(authReturnPath("/ai")).toBe("/ai");
    for (const path of [
      "https://other.example",
      "//evil.example",
      "/admin",
      undefined,
      ["/ai"],
    ])
      expect(authReturnPath(path)).toBe("/");
  });
  it("keeps approved AI navigation actions and rejects untrusted tool destinations", () => {
    expect(
      pageActions([
        {
          type: "tool-open_page",
          state: "output-available",
          output: { page: "Appointments" },
        },
        {
          type: "tool-open_page",
          state: "output-available",
          output: { page: "https://other.example" },
        },
        {
          type: "tool-open_page",
          state: "input-available",
          output: { page: "Home" },
        },
      ]),
    ).toEqual(["Appointments"]);
  });
});
