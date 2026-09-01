import { FileText, ImageIcon } from "lucide-react";
import { parseLampiran } from "@/lib/lampiran";

/**
 * Render lampiran sebagai link ke route proxy ber-auth (bukan URL Drive
 * langsung — file tidak publik, lihat lib/drive.ts). Hanya berguna saat
 * admin sedang login karena route itu cookie-gated sama seperti /report.
 */
export function AttachmentList({ raw }: { raw: string }) {
  const items = parseLampiran(raw);
  if (items.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Lampiran
      </dt>
      <dd className="mt-1 flex flex-wrap gap-2">
        {items.map((item) => {
          const isImage = /\.(jpe?g|png|webp)$/i.test(item.name);
          const Icon = isImage ? ImageIcon : FileText;
          return (
            <a
              key={item.fileId}
              href={`/api/report/attachment/${item.fileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="max-w-[16ch] truncate">{item.name}</span>
            </a>
          );
        })}
      </dd>
    </div>
  );
}
