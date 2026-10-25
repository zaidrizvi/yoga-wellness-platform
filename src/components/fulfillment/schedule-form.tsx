"use client";
import { useState } from "react";
import { ActionForm } from "@/components/auth/action-form";
import { saveSchedule } from "@/app/professional/actions";

export function ScheduleForm({ windows }: { windows: { id: string; iso_weekday: number; start_time: string; end_time: string }[] }) {
  const [rows, setRows] = useState(windows);
  return <ActionForm action={saveSchedule} submit="Save weekly schedule">
    <p>India time (Asia/Kolkata). Add multiple windows for breaks. An empty schedule means no working hours.</p>
    {!rows.length && <p className="booking-help" role="status">No working windows added. Add your actual hours below, or confirm an empty schedule to clear your availability.</p>}
    {rows.map((row, index) => <fieldset className="schedule-window" key={row.id}>
      <legend>Working window {index + 1}</legend>
      <label>Day<select name="weekday" defaultValue={row.iso_weekday}>{["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((d,i) => <option key={d} value={i+1}>{d}</option>)}</select></label>
      <div className="form-row"><label>From<input type="time" name="start" required defaultValue={row.start_time.slice(0,5)} /></label><label>Until<input type="time" name="end" required defaultValue={row.end_time.slice(0,5)} /></label></div>
      <button type="button" className="text-link" onClick={() => setRows(rows.filter(r => r.id !== row.id))}>Remove window</button>
    </fieldset>)}
    {rows.length < 28 && <button type="button" className="text-link" onClick={() => setRows([...rows,{ id: crypto.randomUUID(), iso_weekday: 1, start_time: "", end_time: "" }])}>Add working window</button>}
    <label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />Replace my saved weekly schedule with these windows.</label>
  </ActionForm>;
}
