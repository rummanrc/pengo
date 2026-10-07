package com.knowkanji.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Intent;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import java.time.ZonedDateTime;
import java.util.TimeZone;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class StudyRemindersTest {
    Application app;
    TimeZone previous;
    long now;
    @Before public void setup() {
        previous = TimeZone.getDefault(); TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
        app = RuntimeEnvironment.getApplication();
        StudyReminders.prefs(app).edit().clear().commit();
        Shadows.shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        StudyReminders.createChannel(app);
        now = ZonedDateTime.parse("2026-10-07T19:05:00+09:00[Asia/Tokyo]").toInstant().toEpochMilli();
    }
    @After public void cleanup() { TimeZone.setDefault(previous); }
    @Test public void defaultIsOffWithNoAlarm() {
        StudyReminders.schedule(app, now);
        assertFalse(StudyReminders.prefs(app).getBoolean("enabled", false));
        assertEquals(0, Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void scheduleIsOwnedByAndroidAndReplacesExistingAlarm() {
        StudyReminders.configure(app, true, "19:00");
        StudyReminders.schedule(app, now);
        StudyReminders.schedule(app, now);
        assertEquals(1, Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        assertEquals(ReminderTime.next("19:00",now,TimeZone.getDefault()),StudyReminders.prefs(app).getLong("nextAt",0));
    }
    @Test public void turnOffCancelsAlarmAndNotification() {
        StudyReminders.configure(app,true,"19:00");
        assertTrue(StudyReminders.deliver(app,now,false));
        StudyReminders.configure(app,false,"19:00");
        assertEquals(0,Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        assertNull(Shadows.shadowOf(app.getSystemService(NotificationManager.class)).getNotification(StudyReminders.NOTIFICATION_ID));
    }
    @Test public void deliveryPostsAnActionableNotificationOnlyOncePerDay() throws Exception {
        StudyReminders.configure(app,true,"19:00");
        assertTrue(StudyReminders.deliver(app,now,false));
        assertFalse(StudyReminders.deliver(app,now+60000,false));
        Notification notification=Shadows.shadowOf(app.getSystemService(NotificationManager.class)).getNotification(StudyReminders.NOTIFICATION_ID);
        assertEquals("A little Japanese with Pengo?",notification.extras.getString(Notification.EXTRA_TITLE));
        assertTrue(Shadows.shadowOf(notification.contentIntent).getSavedIntent().getBooleanExtra("pengo_reminder",false));
    }
    @Test public void completedGoalSuppressesNotification() {
        StudyReminders.configure(app,true,"19:00");StudyReminders.goalDate(app,"2026-10-07");
        assertFalse(StudyReminders.deliver(app,now,false));
        assertNull(Shadows.shadowOf(app.getSystemService(NotificationManager.class)).getNotification(StudyReminders.NOTIFICATION_ID));
    }
    @Test public void deniedPermissionSuppressesNotification() {
        StudyReminders.configure(app,true,"19:00");Shadows.shadowOf(app).denyPermissions(Manifest.permission.POST_NOTIFICATIONS);
        assertFalse(StudyReminders.deliver(app,now,false));
    }
    @Test public void disabledChannelSuppressesNotification() {
        StudyReminders.configure(app,true,"19:00");
        NotificationManager manager=app.getSystemService(NotificationManager.class);
        android.app.NotificationChannel channel=manager.getNotificationChannel(StudyReminders.CHANNEL);
        channel.setImportance(NotificationManager.IMPORTANCE_NONE);manager.createNotificationChannel(channel);
        assertFalse(StudyReminders.deliver(app,now,false));
    }
    @Test public void staleDeliveryDoesNotNagHoursLater() {
        StudyReminders.configure(app,true,"17:00");assertFalse(StudyReminders.deliver(app,now,false));
    }
    @Test public void testNotificationDoesNotConsumeDailyReminder() {
        StudyReminders.configure(app,true,"19:00");
        assertTrue(StudyReminders.deliver(app,now,true));assertTrue(StudyReminders.deliver(app,now,false));
    }
    @Test public void bootRestoresEnabledScheduleButNeverEnablesOptedOutUsers() {
        new ReminderRestoreReceiver().onReceive(app,new Intent(Intent.ACTION_BOOT_COMPLETED));
        assertEquals(0,Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        StudyReminders.configure(app,true,"19:00");StudyReminders.cancel(app);
        new ReminderRestoreReceiver().onReceive(app,new Intent(Intent.ACTION_BOOT_COMPLETED));
        assertEquals(1,Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void timezoneAndClockChangesRescheduleOneAlarm() {
        StudyReminders.configure(app,true,"19:00");
        for(String action:new String[]{Intent.ACTION_TIMEZONE_CHANGED,Intent.ACTION_TIME_CHANGED,Intent.ACTION_MY_PACKAGE_REPLACED})
            new ReminderRestoreReceiver().onReceive(app,new Intent(action));
        assertEquals(1,Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void reminderReceiverReschedulesWithoutWebView() {
        StudyReminders.configure(app,true,"19:00");StudyReminders.cancel(app);
        new ReminderReceiver().onReceive(app,new Intent(StudyReminders.ACTION));
        assertEquals(1,Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void unrelatedBroadcastDoesNotScheduleAnything() {
        new ReminderRestoreReceiver().onReceive(app,new Intent("unrelated"));
        new ReminderReceiver().onReceive(app,new Intent("unrelated"));
        assertEquals(0,Shadows.shadowOf(app.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
    }
    @Test public void invalidTimeRejected() {
        assertThrows(IllegalArgumentException.class,()->StudyReminders.configure(app,true,"25:99"));
        assertFalse(StudyReminders.prefs(app).getBoolean("enabled",false));
    }
    @Test public void settingsReflectOSPermissionAndSavedTime() throws Exception {
        StudyReminders.configure(app,true,"18:30");
        org.json.JSONObject settings=new org.json.JSONObject(StudyReminders.settings(app));
        assertTrue(settings.getBoolean("enabled"));assertEquals("18:30",settings.getString("time"));assertEquals("granted",settings.getString("permission"));
        Shadows.shadowOf(app).denyPermissions(Manifest.permission.POST_NOTIFICATIONS);
        assertEquals("denied",new org.json.JSONObject(StudyReminders.settings(app)).getString("permission"));
    }
}
