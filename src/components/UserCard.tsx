import Image from "next/image";

type UserCardProps = {
  title: string;
  badgeLabel: string;
  total: number | null;
  isLoading?: boolean;
  variant?: "purple" | "yellow";
};

const variantClassMap: Record<Required<UserCardProps>["variant"], string> = {
  purple: "bg-lamaPurple text-white",
  yellow: "bg-lamaYellow text-gray-900",
};

const valueClassMap: Record<Required<UserCardProps>["variant"], string> = {
  purple: "text-white",
  yellow: "text-gray-900",
};

const subtitleClassMap: Record<Required<UserCardProps>["variant"], string> = {
  purple: "text-white/80",
  yellow: "text-gray-700",
};

const UserCard = ({
  title,
  badgeLabel,
  total,
  isLoading = false,
  variant = "purple",
}: UserCardProps) => {
  const displayValue =
    total != null && Number.isFinite(total)
      ? total.toLocaleString()
      : isLoading
      ? "..."
      : "--";

  return (
    <div className={`flex-1 min-w-[140px] rounded-2xl p-4 ${variantClassMap[variant]}`}>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-700">
          {badgeLabel}
        </span>
        <Image src="/more.png" alt="" width={20} height={20} />
      </div>
      <h1 className={`my-4 text-2xl font-semibold ${valueClassMap[variant]}`}>{displayValue}</h1>
      <h2 className={`text-sm font-medium capitalize ${subtitleClassMap[variant]}`}>{title}</h2>
    </div>
  );
};

export default UserCard;
