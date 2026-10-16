package io.github.rummanrc.pengo;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Opt-in offline reminders. The OS owns delivery, even after the WebView closes. */
final class StudyReminders {
    static final String PREFS = "pengo_reminders";
    static final String CHANNEL = "pengo_daily_practice";
    static final int ALARM_ID = 5201, NOTIFICATION_ID = 5202, TEST_ID = 5203;
    static final String ACTION = "io.github.rummanrc.pengo.DAILY_REMINDER";

    static SharedPreferences prefs(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Daily practice", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("A gentle daily invitation to practice Japanese with Pengo.");
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    static boolean allowed(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }
    static String today(long now) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now)); }
    static PendingIntent alarmIntent(Context context) {
        Intent intent = new Intent(context, ReminderReceiver.class).setAction(ACTION);
        return PendingIntent.getBroadcast(context, ALARM_ID, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void configure(Context context, boolean enabled, String time) {
        if (!ReminderTime.valid(time)) throw new IllegalArgumentException("Invalid reminder time");
        prefs(context).edit().putBoolean("enabled", enabled).putString("time", time).apply();
        if (enabled) schedule(context); else cancel(context);
    }
    static void schedule(Context context) { schedule(context, System.currentTimeMillis()); }
    static void schedule(Context context, long now) {
        if (!prefs(context).getBoolean("enabled", false)) { cancel(context); return; }
        long at = ReminderTime.next(prefs(context).getString("time", "19:00"), now, TimeZone.getDefault());
        context.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarmIntent(context));
        prefs(context).edit().putLong("nextAt", at).apply();
    }
    static void cancel(Context context) {
        context.getSystemService(AlarmManager.class).cancel(alarmIntent(context));
        context.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
        prefs(context).edit().remove("nextAt").apply();
    }
    static boolean deliver(Context context, long now, boolean test) {
        if (!allowed(context)) return false;
        SharedPreferences p = prefs(context);
        String date = today(now);
        if (!test) {
            if (!p.getBoolean("enabled", false) || date.equals(p.getString("goalDate", "")) || date.equals(p.getString("lastDate", ""))) return false;
            // Avoid a stale alarm delivered hours late or after a timezone/time change.
            String[] parts = p.getString("time", "19:00").split(":");
            java.util.Calendar clock = java.util.Calendar.getInstance(); clock.setTimeInMillis(now);
            int late = clock.get(java.util.Calendar.HOUR_OF_DAY) * 60 + clock.get(java.util.Calendar.MINUTE)
                    - Integer.parseInt(parts[0]) * 60 - Integer.parseInt(parts[1]);
            if (late < 0 || late >= 60) return false;
        }
        Intent open = new Intent(context, MainActivity.class).putExtra("pengo_reminder", true)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, test ? TEST_ID : NOTIFICATION_ID, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
        builder.setSmallIcon(R.drawable.ic_notification).setContentTitle(test ? "Hello from Pengo!" : "A little Japanese with Pengo?")
                .setContentText("Your study buddy is ready. Three questions are a lovely place to start.")
                .setAutoCancel(true).setContentIntent(tap).setCategory(Notification.CATEGORY_REMINDER)
                .setOnlyAlertOnce(true);
        context.getSystemService(NotificationManager.class).notify(test ? TEST_ID : NOTIFICATION_ID, builder.build());
        if (!test) p.edit().putString("lastDate", date).apply();
        return true;
    }
    static void goalDate(Context context, String date) {
        prefs(context).edit().putString("goalDate", date != null && date.matches("\\d{4}-\\d{2}-\\d{2}") ? date : "").apply();
        if (today(System.currentTimeMillis()).equals(date)) context.getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);
    }
    static String settings(Context context) {
        try {
            SharedPreferences p = prefs(context);
            return new JSONObject().put("enabled", p.getBoolean("enabled", false)).put("time", p.getString("time", "19:00"))
                    .put("permission", allowed(context) ? "granted" : "denied").put("nextAt", p.getLong("nextAt", 0)).toString();
        } catch (Exception e) { return "{}"; }
    }
    private StudyReminders() {}
}
