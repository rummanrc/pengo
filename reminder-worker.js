/* Notification delivery only. This worker does not cache or schedule content. */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = new URL('./index.html#/practice?start=1&size=3', self.registration.scope).href;
  event.waitUntil((async function () {
    var windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    var app = windows.find(function (client) { return client.url.startsWith(self.registration.scope); });
    if (app) { await app.navigate(target); return app.focus(); }
    return self.clients.openWindow(target);
  })());
});
