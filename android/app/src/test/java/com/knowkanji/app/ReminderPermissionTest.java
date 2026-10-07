package com.knowkanji.app;

import android.Manifest;
import android.app.AlarmManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Looper;
import android.webkit.WebView;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class ReminderPermissionTest {
    @Before public void setup() {
        StudyReminders.prefs(RuntimeEnvironment.getApplication()).edit().clear().commit();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(Manifest.permission.POST_NOTIFICATIONS);
    }
    @Test public void startupNeverRequestsNotificationPermission() {
        try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
            assertNull(Shadows.shadowOf(c.get()).getLastRequestedPermission());
            assertFalse(StudyReminders.prefs(c.get()).getBoolean("enabled",false));
        }
    }
    @Test public void explicitOptInRequestsPermissionAndDenialLeavesNoAlarm() {
        try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=c.get();activity.new NativeBridge().setReminder(true,"18:30");
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            org.robolectric.shadows.ShadowActivity.PermissionsRequest request=Shadows.shadowOf(activity).getLastRequestedPermission();
            assertNotNull(request);assertArrayEquals(new String[]{Manifest.permission.POST_NOTIFICATIONS},request.requestedPermissions);
            activity.onRequestPermissionsResult(request.requestCode,request.requestedPermissions,new int[]{PackageManager.PERMISSION_DENIED});
            assertFalse(StudyReminders.prefs(activity).getBoolean("enabled",false));
            assertEquals(0,Shadows.shadowOf(activity.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        }
    }
    @Test public void permissionGrantSchedulesChosenTime() {
        try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=c.get();activity.new NativeBridge().setReminder(true,"18:30");Shadows.shadowOf(Looper.getMainLooper()).idle();
            org.robolectric.shadows.ShadowActivity.PermissionsRequest request=Shadows.shadowOf(activity).getLastRequestedPermission();
            Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
            activity.onRequestPermissionsResult(request.requestCode,request.requestedPermissions,new int[]{PackageManager.PERMISSION_GRANTED});
            assertTrue(StudyReminders.prefs(activity).getBoolean("enabled",false));assertEquals("18:30",StudyReminders.prefs(activity).getString("time",""));
            assertEquals(1,Shadows.shadowOf(activity.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        }
    }
    @Test public void notificationTapOpensShortPracticeOnColdLaunch() {
        Intent open=new Intent(RuntimeEnvironment.getApplication(),MainActivity.class).putExtra("pengo_reminder",true);
        try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class,open).setup()) {
            WebView web=ReflectionHelpers.getField(c.get(),"web");
            assertEquals("file:///android_asset/www/index.html#/practice?start=1&size=3",Shadows.shadowOf(web).getLastLoadedUrl());
        }
    }
    @Test public void turningOffDuringPermissionPromptCannotScheduleAfterLateGrant() {
        try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=c.get();MainActivity.NativeBridge bridge=activity.new NativeBridge();
            bridge.setReminder(true,"18:30");Shadows.shadowOf(Looper.getMainLooper()).idle();
            org.robolectric.shadows.ShadowActivity.PermissionsRequest request=Shadows.shadowOf(activity).getLastRequestedPermission();
            bridge.setReminder(false,"18:30");Shadows.shadowOf(Looper.getMainLooper()).idle();
            Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
            activity.onRequestPermissionsResult(request.requestCode,request.requestedPermissions,new int[]{PackageManager.PERMISSION_GRANTED});
            assertFalse(StudyReminders.prefs(activity).getBoolean("enabled",false));
        }
    }
    @Test public void eraseResetsDeviceReminderPreferencesAndAlarm() {
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
        try(ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity=c.get();MainActivity.NativeBridge bridge=activity.new NativeBridge();
            bridge.setReminder(true,"18:30");Shadows.shadowOf(Looper.getMainLooper()).idle();
            StudyReminders.prefs(activity).edit().putString("lastDate","2026-10-07").putString("goalDate","2026-10-07").commit();
            bridge.resetReminderSettings();Shadows.shadowOf(Looper.getMainLooper()).idle();
            assertFalse(StudyReminders.prefs(activity).getBoolean("enabled",false));
            assertEquals("19:00",StudyReminders.prefs(activity).getString("time",""));
            assertFalse(StudyReminders.prefs(activity).contains("lastDate"));assertFalse(StudyReminders.prefs(activity).contains("goalDate"));
            assertEquals(0,Shadows.shadowOf(activity.getSystemService(AlarmManager.class)).getScheduledAlarms().size());
        }
    }

}
