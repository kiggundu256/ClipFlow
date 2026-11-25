"use client";

import { useRef } from "react";
import { CalendarClock } from "lucide-react";
import { scheduleDraft } from "@/app/actions/content";

export function SchedulePostForm({ postId }: { postId: string }) {
  const localDateRef = useRef<HTMLInputElement>(null);
  const isoDateRef = useRef<HTMLInputElement>(null);

  return <form className="schedule-inline-form" action={scheduleDraft} onSubmit={() => {
    const value = localDateRef.current?.value;
    if (isoDateRef.current && value) {
      const parsed = new Date(value);
      isoDateRef.current.value = Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
    }
  }}>
    <input type="hidden" name="postId" value={postId}/>
    <input type="hidden" name="scheduledAt" ref={isoDateRef}/>
    <label className="sr-only" htmlFor={`schedule-${postId}`}>Choose date and time in your local timezone</label>
    <input id={`schedule-${postId}`} ref={localDateRef} type="datetime-local" required/>
    <button className="secondary-button" type="submit"><CalendarClock size={14}/> Schedule</button>
  </form>;
}
