import { useEffect, useState } from "react";
import { Image } from "react-native";

export interface RemoteImageInfo {
  width: number | null;
  height: number | null;
  bytes: number | null;
}

const EMPTY: RemoteImageInfo = { width: null, height: null, bytes: null };

/**
 * Bytes the browser pulled over the wire for `src`, when it will say. A server
 * that does not send `Timing-Allow-Origin` reports zero, and so does a platform
 * with no resource timing; both read as unknown rather than as an empty file.
 */
function transferredBytes(src: string): number | null {
  if (typeof performance === "undefined" || typeof performance.getEntriesByName !== "function") {
    return null;
  }
  const entries = performance.getEntriesByName(src) as PerformanceResourceTiming[];
  const size = entries[entries.length - 1]?.encodedBodySize;
  return typeof size === "number" && size > 0 ? size : null;
}

/**
 * The pixel size, and the weight when it is known, of an image that loads from
 * a URL. A local file gets both from the daemon; a remote one has no daemon to
 * ask, so they are read once the image itself has loaded. Pass undefined until
 * the reader has agreed to the request.
 */
export function useRemoteImageInfo(src: string | undefined): RemoteImageInfo {
  const [info, setInfo] = useState<RemoteImageInfo>(EMPTY);

  useEffect(() => {
    if (!src) {
      setInfo(EMPTY);
      return;
    }
    let cancelled = false;
    Image.getSize(
      src,
      (width, height) => {
        if (!cancelled) setInfo({ width, height, bytes: transferredBytes(src) });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [src]);

  return info;
}
