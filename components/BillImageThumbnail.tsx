"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Images, X } from "lucide-react";

type BillImageThumbnailProps = {
  value: unknown;
};

export function BillImageThumbnail({ value }: BillImageThumbnailProps) {
  const rawValue = formatValue(value).trim();
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const imageUrls = splitImageValues(rawValue).map(imagePreviewUrl).filter(Boolean);
  const firstImageUrl = imageUrls[0] || "";
  const currentImageUrl = imageUrls[currentIndex] || firstImageUrl;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft") setCurrentIndex(index => previousIndex(index, imageUrls.length));
      if (event.key === "ArrowRight") setCurrentIndex(index => nextIndex(index, imageUrls.length));
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [imageUrls.length, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!rawValue) return null;

  if (!imageUrls.length) {
    return <span className="bill-image-path" title={rawValue}>{rawValue}</span>;
  }

  return (
    <>
      <button
        type="button"
        className="bill-thumb-link"
        title="ดูรูปถ่ายบิล"
        onClick={() => {
          setCurrentIndex(0);
          setOpen(true);
        }}
      >
        {imageUrls.length > 1 ? (
          <>
            <Images size={15} aria-hidden="true" />
            <span>{imageUrls.length} รูป</span>
          </>
        ) : (
          <img src={firstImageUrl} alt="รูปถ่ายบิล" loading="lazy" />
        )}
      </button>
      {open ? (
        <div className="image-preview-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="image-preview-dialog" role="dialog" aria-modal="true" aria-label="รูปถ่ายบิล" onClick={event => event.stopPropagation()}>
            <header className="image-preview-header">
              <strong>รูปถ่ายบิล {imageUrls.length > 1 ? `(${imageUrls.length})` : ""}</strong>
              <div className="image-preview-actions">
                <a className="image-preview-open" href={currentImageUrl} target="_blank" rel="noreferrer" aria-label="เปิดรูปในแท็บใหม่">
                  <ExternalLink size={18} />
                </a>
                <button className="image-preview-close" type="button" aria-label="ปิดรูป" onClick={() => setOpen(false)}>
                  <X size={20} />
                </button>
              </div>
            </header>
            <div className="image-preview-body">
              <div className="image-preview-slider">
                {imageUrls.length > 1 ? (
                  <button type="button" className="image-preview-nav image-preview-prev" aria-label="รูปก่อนหน้า" onClick={() => setCurrentIndex(index => previousIndex(index, imageUrls.length))}>
                    <ChevronLeft size={26} />
                  </button>
                ) : null}
                <figure>
                  <img src={currentImageUrl} alt={`รูปถ่ายบิล ${currentIndex + 1}`} />
                </figure>
                {imageUrls.length > 1 ? (
                  <button type="button" className="image-preview-nav image-preview-next" aria-label="รูปถัดไป" onClick={() => setCurrentIndex(index => nextIndex(index, imageUrls.length))}>
                    <ChevronRight size={26} />
                  </button>
                ) : null}
              </div>
              {imageUrls.length > 1 ? (
                <div className="image-preview-counter">
                  <span>{currentIndex + 1} / {imageUrls.length}</span>
                  <a href={currentImageUrl} target="_blank" rel="noreferrer">เปิดรูป</a>
                </div>
              ) : null}
              {imageUrls.length > 1 ? (
                <div className="image-preview-dots" aria-label="เลือกรูป">
                  {imageUrls.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      className={index === currentIndex ? "is-active" : ""}
                      aria-label={`รูปที่ ${index + 1}`}
                      onClick={() => setCurrentIndex(index)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value);
}

function splitImageValues(value: string) {
  return value
    .split(/[\n,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function previousIndex(index: number, total: number) {
  if (total <= 1) return 0;
  return index <= 0 ? total - 1 : index - 1;
}

function nextIndex(index: number, total: number) {
  if (total <= 1) return 0;
  return index >= total - 1 ? 0 : index + 1;
}

function imagePreviewUrl(value: string) {
  if (/^\/api\/drive-image\/[A-Za-z0-9_-]+/.test(value)) return value;
  const driveFileId = driveFileIdFromUrl(value);
  if (driveFileId) return `/api/drive-image/${encodeURIComponent(driveFileId)}`;
  if (/^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value)) return value;
  return "";
}

function driveFileIdFromUrl(value: string) {
  const proxyPathMatch = value.match(/\/api\/drive-image\/([^/?#]+)/i);
  if (proxyPathMatch?.[1]) return proxyPathMatch[1];
  const filePathMatch = value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (filePathMatch?.[1]) return filePathMatch[1];
  const queryMatch = value.match(/[?&]id=([^&#]+)/i);
  if (queryMatch?.[1] && value.includes("drive.google.com")) return queryMatch[1];
  return "";
}
