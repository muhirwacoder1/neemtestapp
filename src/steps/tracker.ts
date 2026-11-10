export type StepStatus =
  | "loading"
  | "idle"
  | "ready"
  | "denied"
  | "unavailable"
  | "web"
  | "development-build"
  | "shared-profile"
  | "error";
export type StepDay = {
  date: string;
  count: number;
  source: "ios" | "android";
  updatedAt: number;
  hours: number[];
};
export type StepLog = { version: 1; goal: number | null; days: StepDay[] };
export type StepSnapshot = {
  status: StepStatus;
  day: StepDay | null;
  goal: number | null;
  canAskAgain: boolean;
  storageError: boolean;
};
export type MotionPermission = { granted: boolean; canAskAgain: boolean };
export interface StepSensor {
  platform: "ios" | "android" | "web";
  requiresBuild: boolean;
  available(): Promise<boolean>;
  permission(request: boolean): Promise<MotionPermission>;
  today(start: Date, end: Date): Promise<number>;
  watch(callback: (steps: number) => void): { remove(): void };
}
export interface StepStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validCount(count: number) {
  return Number.isSafeInteger(count) && count >= 0 && count <= 2_000_000;
}
export function readStepLog(raw: string | null): StepLog {
  const empty: StepLog = { version: 1, goal: null, days: [] };
  try {
    if (!raw) return empty;
    const value = JSON.parse(raw) as StepLog;
    if (value.version !== 1 || !Array.isArray(value.days)) return empty;
    return {
      version: 1,
      goal:
        Number.isSafeInteger(value.goal) &&
        value.goal! >= 100 &&
        value.goal! <= 100_000
          ? value.goal
          : null,
      days: value.days
        .filter(
          (d) =>
            /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
            validCount(d.count) &&
            ["ios", "android"].includes(d.source) &&
            Number.isFinite(d.updatedAt) &&
            Array.isArray(d.hours) &&
            d.hours.length === 24 &&
            d.hours.every(validCount),
        )
        .slice(-7),
    };
  } catch {
    return empty;
  }
}
// Owns one device/account session. iOS totals are authoritative system queries;
// Android totals are only observed foreground deltas, never a fabricated daily total.
export class StepTracker {
  private log: StepLog = { version: 1, goal: null, days: [] };
  private status: StepStatus = "loading";
  private canAskAgain = true;
  private storageError = false;
  private subscription?: { remove(): void };
  private generation = 0;
  private active = false;
  private loaded = false;
  private disposed = false;
  private lastWatchCount = 0;
  private iosLoading = false;
  private iosDirty = false;
  private lastIOSQuery = 0;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private writeQueue: Promise<void> = Promise.resolve();
  constructor(
    private options: {
      key: string;
      sensor: StepSensor;
      storage: StepStorage;
      emit: (snapshot: StepSnapshot) => void;
      now?: () => Date;
    },
  ) {}
  private now() {
    return this.options.now?.() ?? new Date();
  }
  private currentDay() {
    return this.log.days.find((d) => d.date === dayKey(this.now())) ?? null;
  }
  private emit() {
    if (!this.disposed)
      this.options.emit({
        status: this.status,
        day: this.currentDay(),
        goal: this.log.goal,
        canAskAgain: this.canAskAgain,
        storageError: this.storageError,
      });
  }
  async initialize(active: boolean) {
    this.active = active;
    try {
      this.log = readStepLog(
        await this.options.storage.getItem(this.options.key),
      );
      this.loaded = true;
    } catch {
      this.storageError = true;
      this.status = "error";
      this.emit();
      return;
    }
    if (this.disposed) return;
    if (this.options.sensor.platform === "web") {
      this.status = "web";
      this.emit();
      return;
    }
    if (this.options.sensor.requiresBuild) {
      this.status = "development-build";
      this.emit();
      return;
    }
    await this.setActive(this.active);
  }
  async enable() {
    if (this.disposed) return;
    if (!this.loaded) await this.initialize(this.active);
    if (this.loaded) await this.start(true);
  }
  async setActive(active: boolean) {
    this.active = active;
    this.stop();
    if (!this.loaded) return;
    if (!active) {
      await this.flush();
      return;
    }
    await this.start(false);
  }
  private stop() {
    this.generation++;
    this.subscription?.remove();
    this.subscription = undefined;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    this.iosLoading = false;
    this.iosDirty = false;
    this.lastWatchCount = 0;
  }
  private async start(request: boolean) {
    if (
      this.disposed ||
      this.options.sensor.platform === "web" ||
      this.options.sensor.requiresBuild
    )
      return;
    this.stop();
    const generation = this.generation;
    this.status = "loading";
    this.emit();
    try {
      const permission = await this.options.sensor.permission(request);
      if (this.disposed || generation !== this.generation) return;
      this.canAskAgain = permission.canAskAgain;
      if (!permission.granted) {
        this.status = permission.canAskAgain ? "idle" : "denied";
        this.emit();
        return;
      }
      if (!(await this.options.sensor.available())) {
        if (generation === this.generation) {
          this.status = "unavailable";
          this.emit();
        }
        return;
      }
      if (this.disposed || generation !== this.generation) return;
      this.active = true;
      this.status = "ready";
      this.ensureDay();
      if (this.options.sensor.platform === "ios")
        await this.refreshIOS(generation);
      if (this.disposed || generation !== this.generation) return;
      this.subscription = this.options.sensor.watch((count) => {
        if (
          this.disposed ||
          generation !== this.generation ||
          !validCount(count)
        )
          return;
        if (!this.ensureCurrentDay()) return;
        if (this.options.sensor.platform === "ios") {
          this.queueIOS(generation);
          return;
        }
        const delta =
          count >= this.lastWatchCount ? count - this.lastWatchCount : 0;
        // A provider counter reset starts a new baseline, rather than subtracting steps.
        this.lastWatchCount = count;
        if (delta > 0) {
          const day = this.ensureDay();
          if (!validCount(day.count + delta)) return;
          day.count += delta;
          day.hours[this.now().getHours()] += delta;
          day.updatedAt = this.now().getTime();
          this.scheduleFlush();
          this.emit();
        }
      });
      this.emit();
    } catch {
      if (!this.disposed && generation === this.generation) {
        this.status = "error";
        this.emit();
      }
    }
  }
  private ensureDay() {
    const date = dayKey(this.now());
    let day = this.log.days.find((d) => d.date === date);
    if (!day) {
      day = {
        date,
        count: 0,
        source: this.options.sensor.platform === "ios" ? "ios" : "android",
        updatedAt: 0,
        hours: Array(24).fill(0),
      };
      this.log.days.push(day);
      this.log.days = this.log.days.slice(-7);
    }
    return day;
  }
  private ensureCurrentDay() {
    if (this.currentDay()) return true;
    void this.setActive(true);
    return false;
  }
  async tick() {
    if (this.disposed || !this.active || this.status !== "ready") return;
    if (!this.ensureCurrentDay()) return;
    if (this.options.sensor.platform === "ios") this.queueIOS(this.generation);
  }
  private queueIOS(generation: number) {
    this.iosDirty = true;
    if (this.iosLoading || this.refreshTimer) return;
    const delay = Math.max(
      0,
      3000 - (this.now().getTime() - this.lastIOSQuery),
    );
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refreshIOS(generation);
    }, delay);
  }
  private async refreshIOS(generation: number) {
    if (this.iosLoading) return;
    this.iosLoading = true;
    this.iosDirty = false;
    const end = this.now(),
      start = new Date(end);
    start.setHours(0, 0, 0, 0);
    this.lastIOSQuery = end.getTime();
    try {
      const count = await this.options.sensor.today(start, end);
      if (
        this.disposed ||
        generation !== this.generation ||
        dayKey(end) !== dayKey(this.now())
      )
        return;
      if (!validCount(count)) throw new Error("Invalid motion data");
      const day = this.ensureDay();
      day.count = count;
      day.updatedAt = end.getTime();
      this.status = "ready";
      this.scheduleFlush();
      this.emit();
    } catch {
      if (!this.disposed && generation === this.generation) {
        this.status = "error";
        this.emit();
      }
    } finally {
      if (generation === this.generation) {
        this.iosLoading = false;
        if (this.iosDirty && this.active) this.queueIOS(generation);
      }
    }
  }
  setGoal(goal: number | null) {
    if (
      goal !== null &&
      (!Number.isSafeInteger(goal) || goal < 100 || goal > 100_000)
    )
      throw new Error("Choose a goal between 100 and 100,000 steps.");
    this.log.goal = goal;
    this.emit();
    void this.flush();
  }
  private scheduleFlush() {
    if (!this.flushTimer)
      this.flushTimer = setTimeout(() => {
        this.flushTimer = undefined;
        void this.flush();
      }, 5000);
  }
  async flush() {
    if (!this.loaded) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    const value = JSON.stringify(this.log);
    this.writeQueue = this.writeQueue
      .then(() => this.options.storage.setItem(this.options.key, value))
      .then(
        () => {
          const recovered = this.storageError;
          this.storageError = false;
          if (recovered) this.emit();
        },
        () => {
          this.storageError = true;
          this.emit();
        },
      );
    await this.writeQueue;
  }
  async dispose() {
    this.disposed = true;
    this.stop();
    await this.flush();
  }
}
