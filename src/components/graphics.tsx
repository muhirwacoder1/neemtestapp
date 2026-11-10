import React, { useId } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { brandPaths } from "./brandPaths";
import { useTheme } from "./ui";
export function Brand({
  width = 104,
  white = false,
}: {
  width?: number;
  white?: boolean;
}) {
  const c = useTheme();
  return (
    <Svg
      width={width}
      height={width / 4.2657}
      viewBox="0 0 3788 888"
      accessibilityLabel="Neem"
    >
      <G fill={white ? "#FFFFFF" : c.navy} fillRule="evenodd">
        {brandPaths.map((p) => (
          <Path
            key={p.id}
            d={p.d}
            fill={p.id === "neem-leaf" ? "#42AD9B" : undefined}
          />
        ))}
      </G>
    </Svg>
  );
}
export function ProgressRing({
  progress,
  size = 130,
  color = "#87D6C2",
  children,
  track = "#FFFFFF20",
}: {
  progress: number;
  size?: number;
  color?: string;
  children?: React.ReactNode;
  track?: string;
}) {
  const stroke = size * 0.065,
    r = size / 2 - stroke,
    circumference = 2 * Math.PI * r;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * Math.max(0.001, Math.min(progress, 1))} ${circumference}`}
        />
      </Svg>
      {children}
    </View>
  );
}
export function InsoleProduct({ height = 170 }: { height?: number }) {
  const id = useId().replace(/:/g, "");
  const path =
    "M79 18 C113 10 137 41 133 76 C130 102 118 127 111 150 C103 180 113 204 103 235 C98 255 78 269 61 259 C42 248 46 219 49 197 C53 165 41 144 37 114 C31 81 39 29 79 18Z";
  return (
    <Svg
      height={height}
      width="100%"
      viewBox="0 0 360 290"
      accessibilityLabel="Illustration of two Neem smart insoles"
    >
      <Defs>
        <LinearGradient id={`${id}body`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#566A79" />
          <Stop offset=".3" stopColor="#283F51" />
          <Stop offset="1" stopColor="#112A3C" />
        </LinearGradient>
        <LinearGradient id={`${id}edge`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#92A7B5" />
          <Stop offset="1" stopColor="#345669" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="190" cy="270" rx="116" ry="12" fill="#183F6320" />
      {[0, 1].map((side) => (
        <G
          key={side}
          transform={
            side === 0
              ? "translate(26,-5) rotate(-19,85,140)"
              : "translate(316,11) scale(-1,1) rotate(-14,85,140)"
          }
        >
          <Path d={path} fill="#0B2032" transform="translate(2,6)" />
          <Path
            d={path}
            fill={`url(#${id}body)`}
            stroke={`url(#${id}edge)`}
            strokeWidth="1.5"
          />
          <Path
            d="M78 36 C102 29 122 52 117 80 C111 109 94 135 90 162 C86 186 98 219 84 242"
            fill="none"
            stroke="#5B8592"
            strokeWidth=".9"
            strokeDasharray="2 3"
          />
          <Path
            d="M65 80 L84 95 L73 135 L72 206"
            fill="none"
            stroke="#43B4AB70"
            strokeWidth="1.2"
          />
          {[
            [84, 58],
            [64, 92],
            [91, 105],
            [68, 163],
            [74, 222],
          ].map(([x, y], i) => (
            <G key={i}>
              <Circle
                cx={x}
                cy={y}
                r="8"
                fill="#43B4AB20"
                stroke="#74CCBA"
                strokeWidth=".7"
              />
              <Circle cx={x} cy={y} r="3" fill="#86DFC8" />
            </G>
          ))}
          <Path
            d="M55 135 C70 140 88 139 101 132"
            fill="none"
            stroke="#FFFFFF15"
          />
          <SvgText
            x="78"
            y="187"
            fill="#B7C7CC"
            fontSize="11"
            fontWeight="bold"
            textAnchor="middle"
            transform="rotate(-90,78,187)"
          >
            neem
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}
export { FootMaps } from "./PressureMap";
export { Sparkline, HealthChart } from "./MonoCharts";
