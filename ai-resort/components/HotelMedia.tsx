"use client";

import { useEffect, useRef, useState } from "react";

export default function HotelMedia({
  name,
  image,
  images = [],
  videoUrl,
  onClick,
  className = "",
}: {
  name: string;
  image?: string;
  images?: string[];
  videoUrl?: string;
  onClick?: () => void;
  className?: string;
}) {
  const [hover, setHover] = useState(false);
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pics = images.length ? images : image ? [image] : [];

  // Slideshow ảnh khi hover (giả lập video) — chỉ khi không có video thật
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (hover && !videoUrl && pics.length > 1) {
      timer.current = setInterval(() => setIdx((i) => (i + 1) % pics.length), 1100);
    } else if (!hover) {
      setIdx(0);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [hover, videoUrl, pics.length]);

  // Phát video thật khi hover (phải muted để trình duyệt cho autoplay)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hover) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hover]);

  return (
    <div
      className={`relative shrink-0 cursor-pointer overflow-hidden bg-teal/10 ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {videoUrl ? (
        <>
          {pics[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pics[0]}
              alt={name}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                hover ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            loop
            playsInline
            preload="none"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              hover ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      ) : pics.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pics[idx]} alt={name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal to-jade font-display text-lg text-mist/80">
          An Lành Bay
        </div>
      )}

      {/* Nhãn gợi ý hover */}
      {(videoUrl || pics.length > 1) && (
        <span className="absolute bottom-2 right-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {videoUrl ? "▶ video" : "▶ xem nhanh"}
        </span>
      )}
    </div>
  );
}
