import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: 12,
        background: "#087f70",
        color: "white",
        fontSize: 30,
        fontWeight: 700,
      }}
    >
      PS
    </div>,
    size,
  );
}
