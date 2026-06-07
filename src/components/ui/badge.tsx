import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default:  "bg-slate-50 text-slate-700 ring-slate-200",
        blue:     "bg-blue-50 text-blue-700 ring-blue-200",
        green:    "bg-emerald-50 text-emerald-700 ring-emerald-200",
        amber:    "bg-amber-50 text-amber-700 ring-amber-200",
        red:      "bg-red-50 text-red-700 ring-red-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
