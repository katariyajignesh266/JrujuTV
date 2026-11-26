'use client';

import { useState } from 'react';
import { Tv2 } from 'lucide-react';

export function ChannelArtwork({ src, className }: { src?: string; className: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <div className={className} aria-hidden="true">
      {src && src !== failedSrc ? (
        // YouTube supplies thumbnails from several image hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={64} height={64} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} />
      ) : <Tv2 size={26} strokeWidth={1.6} />}
    </div>
  );
}
