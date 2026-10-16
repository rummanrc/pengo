package io.github.rummanrc.pengo;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Offline shell: serves the bundled web app from android_asset, no network. */
public class MainActivity extends Activity {
    private static final int REQUEST_EXPORT_BACKUP = 4101;
    private static final int REQUEST_IMPORT_BACKUP = 4102;
    private static final int REQUEST_NOTIFICATIONS = 4103;
    private String pendingReminderTime;
    private WebView web;
    private String pendingExportText;

    /** Minimal bridge so the web app can detect the native shell. */
    public class NativeBridge {
        @JavascriptInterface
        public String getVersion() {
            return BuildConfig.VERSION_NAME;
        }

        @JavascriptInterface
        public void exportJson(String filename, String text) {
            runOnUiThread(() -> {
                pendingExportText = text;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, filename);
                startActivityForResult(intent, REQUEST_EXPORT_BACKUP);
            });
        }

        @JavascriptInterface
        public void importJson() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain"});
                startActivityForResult(intent, REQUEST_IMPORT_BACKUP);
            });
        }

        @JavascriptInterface
        public void showMessage(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface public String getReminderSettings() { return StudyReminders.settings(MainActivity.this); }
        @JavascriptInterface public void setReminder(boolean enabled, String time) {
            runOnUiThread(() -> {
                if (!ReminderTime.valid(time)) { reminderResult(false, "Choose a valid reminder time."); return; }
                if (!enabled) { pendingReminderTime = null; StudyReminders.configure(MainActivity.this, false, time); reminderResult(true, "Reminders are off. Your progress stays right here."); return; }
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    boolean asked = StudyReminders.prefs(MainActivity.this).getBoolean("permissionAsked", false);
                    if (asked && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                        reminderResult(false, "Notifications are blocked. Allow them in System settings to enable reminders."); return;
                    }
                    pendingReminderTime = time;
                    StudyReminders.prefs(MainActivity.this).edit().putBoolean("permissionAsked", true).apply();
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
                    return;
                }
                enableReminder(time);
            });
        }
        @JavascriptInterface public void resetReminderSettings() {
            runOnUiThread(() -> {
                pendingReminderTime = null;
                StudyReminders.configure(MainActivity.this, false, "19:00");
                StudyReminders.prefs(MainActivity.this).edit().remove("lastDate").remove("goalDate").apply();
                reminderResult(true, "Reminder settings reset. Reminders are off.");
            });
        }
        @JavascriptInterface public void setReminderGoalDate(String date) { StudyReminders.goalDate(MainActivity.this, date); }
        @JavascriptInterface public void openNotificationSettings() {
            runOnUiThread(() -> {
                Intent settings = Build.VERSION.SDK_INT >= 26
                        ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                        : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
                startActivity(settings);
            });
        }
        @JavascriptInterface public void sendTestReminder() {
            runOnUiThread(() -> reminderResult(StudyReminders.deliver(MainActivity.this, System.currentTimeMillis(), true),
                    StudyReminders.allowed(MainActivity.this) ? "Test sent. Check your device’s notifications." : "Notifications are blocked in System settings."));
        }

        @JavascriptInterface
        public void setDarkTheme(boolean dark) {
            runOnUiThread(() -> updateSystemBars(dark));
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        updateSystemBars(false);
        StudyReminders.createChannel(this);
        StudyReminders.schedule(this);

        web = new WebView(this);
        web.setFitsSystemWindows(true);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.addJavascriptInterface(new NativeBridge(), "PengoNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl("file:///android_asset/www/index.html" + (getIntent().getBooleanExtra("pengo_reminder", false) ? "#/practice?start=1&size=3" : ""));
        }
    }

    private void enableReminder(String time) {
        if (!StudyReminders.allowed(this)) { reminderResult(false, "Notifications are blocked. Allow Daily practice in System settings."); return; }
        StudyReminders.configure(this, true, time);
        reminderResult(true, "Daily reminder enabled for " + time + ". It pauses after you meet your goal.");
    }
    private void reminderResult(boolean ok, String message) {
        if (web != null) web.evaluateJavascript("window.PengoReminderResult && window.PengoReminderResult(" + ok + "," + JSONObject.quote(message) + ");", null);
    }
    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQUEST_NOTIFICATIONS) {
            String time = pendingReminderTime; pendingReminderTime = null;
            if (time != null && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) enableReminder(time);
            else reminderResult(false, "Reminders stay off. You can allow notifications later in System settings.");
        }
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if (web != null && intent.getBooleanExtra("pengo_reminder", false))
            web.evaluateJavascript("typeof go === 'function' ? go('#/practice?start=1&size=3') : location.hash='#/practice?start=1&size=3';", null);
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) reminderResult(StudyReminders.allowed(this), StudyReminders.prefs(this).getBoolean("enabled", false) && StudyReminders.allowed(this)
                ? "Daily reminder is enabled on this device." : "Reminders are off or notifications are blocked in System settings.");
    }

    private void updateSystemBars(boolean dark) {
        getWindow().setStatusBarColor(Color.parseColor(dark ? "#102422" : "#faf9f5"));
        int flags = getWindow().getDecorView().getSystemUiVisibility();
        if (dark) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        else flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            getWindow().setNavigationBarColor(Color.parseColor(dark ? "#102422" : "#faf9f5"));
            if (dark) flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            else flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            pendingExportText = null;
            return;
        }
        Uri uri = data.getData();
        if (requestCode == REQUEST_EXPORT_BACKUP) {
            String content = pendingExportText;
            pendingExportText = null;
            if (content == null) return;
            try (OutputStream output = getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException("Could not open destination");
                output.write(content.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, "Backup exported.", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Could not save backup.", Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == REQUEST_IMPORT_BACKUP) {
            try (InputStream input = getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (input == null) throw new IllegalStateException("Could not open backup");
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                String content = output.toString(StandardCharsets.UTF_8.name());
                String quoted = JSONObject.quote(content);
                web.evaluateJavascript("window.Platform && window.Platform.receiveImport(" + quoted + ");", null);
            } catch (Exception e) {
                Toast.makeText(this, "Could not read backup.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) {
            web.saveState(outState);
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web != null) {
            web.evaluateJavascript(
                    "(function(){try{return window.KKBack?window.KKBack():false;}catch(e){return false;}})()",
                    value -> {
                        if (!"true".equals(value)) {
                            MainActivity.super.onBackPressed();
                        }
                    });
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
