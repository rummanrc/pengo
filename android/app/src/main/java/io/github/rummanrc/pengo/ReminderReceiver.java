package io.github.rummanrc.pengo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!StudyReminders.ACTION.equals(intent.getAction())) return;
        StudyReminders.createChannel(context);
        StudyReminders.deliver(context, System.currentTimeMillis(), false);
        StudyReminders.schedule(context);
    }
}
