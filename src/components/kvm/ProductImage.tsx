import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/** A product photo, or a neutral placeholder when none was added. */
export function ProductImage({
  src,
  alt,
  size = "md",
  className,
}: {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-20 w-20" : "h-11 w-11";
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(dims, "shrink-0 rounded-md border border-border object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        dims,
        "flex shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-secondary text-muted-foreground",
        className,
      )}
    >
      <Package className={size === "lg" ? "h-8 w-8" : "h-4 w-4"} />
    </div>
  );
}
