export type VideoSession = { url: string; token: string; expiresAt: number };
export type VideoCallProps = {
  session: VideoSession;
  onLeave: () => void;
  onError: () => void;
};
