"use client";

interface ColorDotProps {
  color: string;
  color2?: string | null;
  size?: "sm" | "md" | "lg";
  shape?: "circle" | "square";
  className?: string;
}

const sizes = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3.5 h-3.5",
};

export default function ColorDot({ color, color2, size = "sm", shape = "square", className = "" }: ColorDotProps) {
  const sizeClass = sizes[size];
  const borderRadius = shape === "circle" ? "rounded-full" : "rounded-sm";

  const bg = color2
    ? `linear-gradient(90deg, ${color} 50%, ${color2} 50%)`
    : color;

  return (
    <span
      className={`${sizeClass} ${borderRadius} shrink-0 ${className}`}
      style={{ background: bg }}
    />
  );
}
