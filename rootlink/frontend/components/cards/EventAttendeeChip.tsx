"use client";

export function EventAttendeeChip({ attendee }: { attendee: any }) {
  return (
    <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-full text-sm text-stone-600 dark:text-stone-300" data-rl-component="EventAttendeeChip">
      <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-medium">
        {attendee.name?.[0]?.toUpperCase() || "?"}
      </div>
      {attendee.name}
    </div>
  );
}
