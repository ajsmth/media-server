import { cn } from "@/lib/utils";

type ProgressProps = {
  className?: string;
  value: number;
};

export function Progress({ className, value }: ProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-secondary/90",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-amber-400 transition-[width] duration-300"
        style={{ width: `${Math.max(clampedValue, 4)}%` }}
      />
    </div>
  );
}
