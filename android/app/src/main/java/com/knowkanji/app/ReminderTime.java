package com.knowkanji.app;

import java.util.Calendar;
import java.util.TimeZone;

/** Local-wall-clock recurrence, recalculated each day rather than adding 24 hours. */
final class ReminderTime {
    static boolean valid(String time) {
        return time != null && time.matches("(?:[01]\\d|2[0-3]):[0-5]\\d");
    }
    static long next(String time, long now, TimeZone zone) {
        if (!valid(time)) time = "19:00";
        String[] parts = time.split(":");
        Calendar next = Calendar.getInstance(zone);
        next.setTimeInMillis(now);
        next.set(Calendar.HOUR_OF_DAY, Integer.parseInt(parts[0]));
        next.set(Calendar.MINUTE, Integer.parseInt(parts[1]));
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= now) {
            next.setTimeInMillis(now);
            next.add(Calendar.DATE, 1);
            next.set(Calendar.HOUR_OF_DAY, Integer.parseInt(parts[0]));
            next.set(Calendar.MINUTE, Integer.parseInt(parts[1]));
            next.set(Calendar.SECOND, 0);
            next.set(Calendar.MILLISECOND, 0);
        }
        return next.getTimeInMillis();
    }
    private ReminderTime() {}
}
