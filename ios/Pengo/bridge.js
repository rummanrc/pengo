/* Injected at document start in the trusted main frame only. WebKit messages
   are asynchronous; synchronous reminder reads use a native-refreshed cache. */
(function () {
  'use strict';
  let settings = { enabled: false, time: '19:00', lastDate: '', permission: 'default' };
  function send(method, args) {
    window.webkit.messageHandlers.pengo.postMessage({ method, args: args || [] });
  }
  window.PengoIOSUpdateReminders = function (value) { settings = value; };
  window.PengoNative = {
    getPlatform: () => 'ios',
    getVersion: () => '1.0.0',
    exportJson: (name, text) => send('exportJson', [name, text]),
    importJson: () => send('importJson'),
    showMessage: text => send('showMessage', [text]),
    setDarkTheme: dark => send('setDarkTheme', [!!dark]),
    getReminderSettings: () => JSON.stringify(settings),
    setReminder: (enabled, time) => send('setReminder', [!!enabled, time]),
    resetReminderSettings: () => send('resetReminderSettings'),
    setReminderGoalDate: date => send('setReminderGoalDate', [date]),
    openNotificationSettings: () => send('openNotificationSettings'),
    sendTestReminder: () => send('sendTestReminder')
  };
}());
