"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getBrowserClient } from "@/lib/supabase";

// ── Canvas crop helper ────────────────────────────────────────────────────────

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/jpeg", 0.92);
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  displayName: string | null;
  initialAvatarUrl: string | null;
  onUploadComplete: (url: string) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AvatarCropper({ displayName, initialAvatarUrl, onUploadComplete }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [rawSrc, setRawSrc] = useState<string | null>(null); // object URL of selected file
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setMsg({ text: "Only JPEG, PNG, WebP, or GIF images are allowed.", ok: false });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ text: "Image must be under 5 MB.", ok: false });
      return;
    }

    setMsg(null);
    // Revoke previous object URL to avoid memory leaks
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    setRawSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    // Reset the input so the same file can be re-selected after cancel
    e.target.value = "";
  }

  function handleCancel() {
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    setRawSrc(null);
  }

  async function handleConfirm() {
    if (!rawSrc || !croppedAreaPixels) return;
    setUploading(true);
    setMsg(null);

    try {
      const blob = await getCroppedBlob(rawSrc, croppedAreaPixels);

      const supabase = getBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const path = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

      if (uploadError) throw new Error(uploadError.message);

      // Bust the CDN cache by appending a timestamp query param
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;

      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: bustedUrl }),
      });

      if (!res.ok) throw new Error("Uploaded but failed to save URL.");

      URL.revokeObjectURL(rawSrc);
      setRawSrc(null);
      setAvatarUrl(bustedUrl);
      onUploadComplete(bustedUrl);
      setMsg({ text: "Profile picture updated.", ok: true });
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Upload failed.", ok: false });
    } finally {
      setUploading(false);
    }
  }

  const initial = (displayName ?? "?")[0].toUpperCase();

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Profile picture</h3>

      {/* Avatar preview + trigger */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile picture"
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-brand-600 font-bold text-xl">{initial}</span>
          )}
        </div>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            Upload photo
          </button>
          <p className="text-xs text-slate-400">JPEG, PNG, WebP or GIF · max 5 MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {msg && (
        <p className={`text-xs mt-2 ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
          {msg.text}
        </p>
      )}

      {/* Crop modal */}
      {rawSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-slate-800">Adjust your photo</h2>
              <p className="text-xs text-slate-400 mt-0.5">Drag to reposition · scroll to zoom</p>
            </div>

            {/* Cropper canvas */}
            <div className="relative w-full" style={{ height: 300 }}>
              <Cropper
                image={rawSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-5 py-4">
              <label className="text-xs text-slate-500 mb-1 block">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={handleCancel}
                disabled={uploading}
                className="flex-1 text-sm py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={uploading}
                className="flex-1 text-sm py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40"
              >
                {uploading ? "Uploading…" : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
