import React, { useEffect, useRef } from "react";
import type { VideoCallProps } from "./VideoCall.types";
export function VideoCall({ session, onLeave, onError }: VideoCallProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onLeave, onError });
  useEffect(() => {
    callbacks.current = { onLeave, onError };
  }, [onLeave, onError]);
  useEffect(() => {
    let disposed = false;
    let call: import("@daily-co/daily-js").DailyCall | undefined;
    void import("@daily-co/daily-js")
      .then(({ default: Daily }) => {
        if (disposed || !host.current) return;
        call = Daily.createFrame(host.current, {
          iframeStyle: { width: "100%", height: "100%", border: "0" },
          showLeaveButton: true,
        });
        call.on("left-meeting", () => {
          if (!disposed) callbacks.current.onLeave();
        });
        call.on("error", () => {
          if (!disposed) callbacks.current.onError();
        });
        return call.join({ url: session.url, token: session.token });
      })
      .catch(() => {
        if (!disposed) callbacks.current.onError();
      });
    return () => {
      disposed = true;
      void call?.destroy();
    };
  }, [session]);
  return (
    <div
      ref={host}
      style={{
        flex: 1,
        minHeight: 420,
        width: "100%",
        height: "100%",
        background: "#101211",
      }}
    />
  );
}
