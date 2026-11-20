"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { removeAvatar, uploadAvatar } from "@/app/actions";
import { Avatar } from "./avatar";
import { FormMessage } from "./ui";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "@/components/icon";

/** Recorta la foto a un cuadrado de 400 px y la comprime a JPEG antes de subirla (≈30–60 KB). */
async function squareJpeg(file: File, size = 400): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarUpload({ name, url }: { name: string; url: string | null }) {
  const { t } = useI18n();
  const [state, action] = useActionState(uploadAvatar, undefined);
  const [busy, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    try {
      const blob = await squareJpeg(f);
      setPreview(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.set("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      start(() => action(fd));
    } catch {
      setErr(t("No he podido leer esa foto. Prueba con otra."));
    }
  }

  const shown = preview ?? url;
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="relative" aria-label={t("Cambiar foto")}>
        <Avatar name={name} url={shown} size={84} className={busy ? "opacity-50" : ""} />
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-sm"><Icon name="camera" size={14} /></span>
      </button>
      <div className="space-y-1 text-sm">
        <button type="button" onClick={() => input.current?.click()} className="font-semibold text-accent">
          {busy ? t("Subiendo…") : shown ? t("Cambiar foto") : t("Subir foto")}
        </button>
        {shown && !busy && (
          <form action={removeAvatar} onSubmit={() => setPreview(null)}>
            <button className="text-xs text-muted underline">{t("Quitar foto")}</button>
          </form>
        )}
        <p className="text-xs text-muted">{t("Sale en pequeño en los leaderboards.")}</p>
        {err ? <p className="text-xs text-red-400">{err}</p> : <FormMessage state={state} />}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </div>
  );
}
