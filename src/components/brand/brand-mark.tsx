// Placeholder brand mark for the generated favicon/app icons: "AS" in
// near-black on the brand green. Replace with the real logo once it exists
// (drop a PNG/SVG into app/ as icon.png / apple-icon.png and delete the
// generated icon routes). Satori: flexbox only; pass loadBrandFont()
// (src/lib/og-font.ts) in the ImageResponse fonts option.
export function BrandMark({
  size,
  rounded = true,
}: {
  size: number;
  rounded?: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#00ffa8",
        color: "#0a0a0a",
        borderRadius: rounded ? size * 0.22 : 0,
        fontFamily: "Plus Jakarta Sans",
        fontSize: size * 0.5,
        fontWeight: 800,
        letterSpacing: -size * 0.03,
      }}
    >
      AS
    </div>
  );
}
