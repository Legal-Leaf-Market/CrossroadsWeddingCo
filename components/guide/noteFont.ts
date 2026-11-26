import localFont from "next/font/local";

// The helper note's handwriting. Purely presentational.
export const noteFont = localFont({
  src: "./fonts/caveat.woff2",
  weight: "600 700",
  display: "swap",
});
