import React, { useId } from "react";
import Svg, { ClipPath, Defs, G, Image, Path, Text } from "react-native-svg";
import { fonts, useTheme } from "./ui";
export function ProfileAvatar({
  name,
  imageUrl,
  size = 205,
}: {
  name: string;
  imageUrl?: string;
  size?: number;
}) {
  const c = useTheme(),
    id = `avatar${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const path =
    Array.from({ length: 241 }, (_, i) => {
      const angle = (i / 240) * Math.PI * 2,
        radius = 104 + 5 * Math.cos(12 * angle);
      return `${i ? "L" : "M"}${120 + radius * Math.cos(angle)},${120 + radius * Math.sin(angle)}`;
    }).join(" ") + " Z";
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      accessibilityLabel={
        imageUrl ? "Your profile photo" : "Your profile initials"
      }
    >
      <Defs>
        <ClipPath id={id}>
          <Path d={path} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Path d={path} fill={c.bluePale} />
        {imageUrl ? (
          <Image
            href={{ uri: imageUrl }}
            x={10}
            y={10}
            width={220}
            height={220}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <Text
            x={120}
            y={143}
            fontFamily={fonts.medium}
            fontSize={65}
            textAnchor="middle"
            fill={c.text}
          >
            {name.trim()
              ? name
                  .trim()
                  .split(/\s+/)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
              : "N"}
          </Text>
        )}
      </G>
      <Path d={path} fill="none" stroke={c.blue} strokeWidth={1.8} />
    </Svg>
  );
}
