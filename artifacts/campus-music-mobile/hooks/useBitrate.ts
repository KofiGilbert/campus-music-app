import { useNetInfo } from "@react-native-community/netinfo";

export type Quality = "auto" | "96" | "160" | "320";
export type Bitrate = "96" | "160" | "320";

/**
 * Resolves the audio bitrate to request. When quality is "auto", picks by
 * connection: WiFi/Ethernet -> 320, 2G/3G -> 96, otherwise (4G/5G/unknown) -> 160.
 * A non-auto quality is used verbatim (manual override).
 */
export function useBitrate(quality: Quality = "auto"): Bitrate {
  const net = useNetInfo();
  if (quality !== "auto") return quality;
  if (net.type === "wifi" || net.type === "ethernet") return "320";
  if (net.type === "cellular") {
    const gen = net.details?.cellularGeneration;
    if (gen === "2g" || gen === "3g") return "96";
  }
  return "160";
}
