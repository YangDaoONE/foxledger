import { ImageResponse } from "next/og";

export function createPwaIcon(size: number) {
  const borderWidth = Math.max(10, Math.round(size * 0.055));
  const titleSize = Math.round(size * 0.3);
  const lineWidth = Math.round(size * 0.38);
  const smallLineWidth = Math.round(size * 0.28);

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#2f6f5e",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#f8f7f2",
            border: `${borderWidth}px solid #1f4d41`,
            borderRadius: Math.round(size * 0.18),
            color: "#1f4d41",
            display: "flex",
            flexDirection: "column",
            height: "78%",
            justifyContent: "center",
            width: "78%",
          }}
        >
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1,
            }}
          >
            FL
          </div>
          <div
            style={{
              background: "#df5c36",
              borderRadius: 999,
              height: Math.max(8, Math.round(size * 0.035)),
              marginTop: Math.round(size * 0.08),
              width: lineWidth,
            }}
          />
          <div
            style={{
              background: "#2f6da8",
              borderRadius: 999,
              height: Math.max(8, Math.round(size * 0.035)),
              marginTop: Math.round(size * 0.035),
              width: smallLineWidth,
            }}
          />
        </div>
      </div>
    ),
    {
      height: size,
      width: size,
    },
  );
}
