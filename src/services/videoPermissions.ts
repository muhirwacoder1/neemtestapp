import { PermissionsAndroid, Platform } from "react-native";
export async function requestVideoPermissions() {
  if (Platform.OS !== "android") return;
  const permissions = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  if (permissions.some((p) => result[p] !== PermissionsAndroid.RESULTS.GRANTED))
    throw new Error(
      "Allow camera and microphone access in your phone settings to join a video consultation.",
    );
}
