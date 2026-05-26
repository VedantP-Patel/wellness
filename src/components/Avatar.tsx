// src/components/Avatar.tsx
interface AvatarProps {
  gender?: string | null;
  size?: number;
}

export default function Avatar({ gender, size = 40 }: AvatarProps) {
  // Determine colors and icon based on gender
  let bgColor = "bg-gray-100";
  let icon = (
    <svg viewBox="0 0 24 24" className="fill-gray-400" width={size * 0.6} height={size * 0.6}>
      <circle cx="12" cy="8" r="4" />
      <path d="M12 14c-4 0-6 2-6 4h12c0-2-2-4-6-4z" />
    </svg>
  );

  if (gender === "male") {
    bgColor = "bg-blue-100";
    icon = (
      <svg viewBox="0 0 24 24" className="fill-blue-600" width={size * 0.6} height={size * 0.6}>
        <path d="M12 2L15 8h-6l3-6zm-4 10h8v2H8v-2zm0 4h8v2H8v-2z" />
      </svg>
    );
  } else if (gender === "female") {
    bgColor = "bg-pink-100";
    icon = (
      <svg viewBox="0 0 24 24" className="fill-pink-600" width={size * 0.6} height={size * 0.6}>
        <circle cx="12" cy="8" r="4" />
        <path d="M12 14c-3 0-5 1-5 3v1h10v-1c0-2-2-3-5-3z" />
        <circle cx="10" cy="6" r="1.5" fill="#f9a8d4" />
        <circle cx="14" cy="6" r="1.5" fill="#f9a8d4" />
      </svg>
    );
  } else if (gender === "non-binary" || gender === "prefer_not_to_say") {
    bgColor = "bg-teal-100";
    icon = (
      <svg viewBox="0 0 24 24" className="fill-teal-600" width={size * 0.6} height={size * 0.6}>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full ${bgColor}`}
      style={{ width: size, height: size }}
    >
      {icon}
    </div>
  );
}