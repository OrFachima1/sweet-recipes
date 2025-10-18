"use client";

interface WorkModeToggleProps {
  workMode: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function WorkModeToggle({ workMode, onChange }: WorkModeToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-xl shadow border cursor-pointer hover:bg-gray-50">
      <input
        type="checkbox"
        className="h-4 w-4 accent-pink-500"
        checked={workMode}
        onChange={onChange}
      />
      <span className="font-medium">מצב עבודה</span>
    </label>
  );
}