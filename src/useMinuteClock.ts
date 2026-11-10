import { useEffect, useState } from "react";
// Coarse timestamps keep time-based Convex subscriptions shared and current.
export function useMinuteClock() {
  const [now, setNow] = useState(
    () => Math.floor(Date.now() / 60_000) * 60_000,
  );
  useEffect(() => {
    const timer = setInterval(
      () => setNow(Math.floor(Date.now() / 60_000) * 60_000),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return now;
}
