"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export default function SafeImage(props: ImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return <Image {...props} onError={() => setFailed(true)} />;
}
