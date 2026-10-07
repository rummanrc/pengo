package com.knowkanji.app;

import org.junit.Test;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.util.TimeZone;
import static org.junit.Assert.*;

public class ReminderTimeTest {
    long ms(String s) { return ZonedDateTime.parse(s).toInstant().toEpochMilli(); }
    @Test public void validatesHoursAndMinutes() {
        assertTrue(ReminderTime.valid("00:00"));assertTrue(ReminderTime.valid("23:59"));
        assertFalse(ReminderTime.valid("24:00"));assertFalse(ReminderTime.valid("19:60"));assertFalse(ReminderTime.valid(null));
    }
    @Test public void choosesLaterTodayOrTomorrowAtEquality() {
        TimeZone zone=TimeZone.getTimeZone("Asia/Tokyo");
        assertEquals(ms("2026-10-07T19:00:00+09:00[Asia/Tokyo]"),ReminderTime.next("19:00",ms("2026-10-07T18:00:00+09:00[Asia/Tokyo]"),zone));
        assertEquals(ms("2026-10-08T19:00:00+09:00[Asia/Tokyo]"),ReminderTime.next("19:00",ms("2026-10-07T19:00:00+09:00[Asia/Tokyo]"),zone));
    }
    @Test public void preservesWallClockAcrossDaylightSavingChange() {
        TimeZone zone=TimeZone.getTimeZone("America/New_York");
        assertEquals(ms("2026-03-08T19:00:00-04:00[America/New_York]"),ReminderTime.next("19:00",ms("2026-03-07T20:00:00-05:00[America/New_York]"),zone));
    }
    @Test public void nonexistentHourDoesNotShiftTheFollowingDay() {
        TimeZone zone=TimeZone.getTimeZone("America/New_York");
        assertEquals(ms("2026-03-09T02:30:00-04:00[America/New_York]"),ReminderTime.next("02:30",ms("2026-03-08T04:00:00-04:00[America/New_York]"),zone));
    }
    @Test public void yearRollover() {
        TimeZone zone=TimeZone.getTimeZone("Asia/Tokyo");
        assertEquals(ms("2027-01-01T00:01:00+09:00[Asia/Tokyo]"),ReminderTime.next("00:01",ms("2026-12-31T23:59:00+09:00[Asia/Tokyo]"),zone));
    }
}
