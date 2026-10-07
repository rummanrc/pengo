"use strict";
/* Reminders belong to this device, separately from transferable learning backups. */
var Reminders = {
  key: 'pengo:reminders:v1', timer: null, listening: false, delivering: false,
  normalize(value) {
    var v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return { enabled: v.enabled === true, time: /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.time || '') ? v.time : '19:00',
      lastDate: /^\d{4}-\d{2}-\d{2}$/.test(v.lastDate || '') ? v.lastDate : '' };
  },
  native() { return typeof window !== 'undefined' && window.KnowKanjiNative && typeof window.KnowKanjiNative.getReminderSettings === 'function' ? window.KnowKanjiNative : null; },
  read() {
    try {
      var bridge = this.native();
      return this.normalize(JSON.parse(bridge ? bridge.getReminderSettings() : localStorage.getItem(this.key) || '{}'));
    } catch (e) { return this.normalize(null); }
  },
  write(value) {
    try { localStorage.setItem(this.key, JSON.stringify(this.normalize(value))); return true; }
    catch (e) { return false; }
  },
  permission() {
    var bridge = this.native();
    if (bridge) { try { return JSON.parse(bridge.getReminderSettings()).permission || 'denied'; } catch (e) { return 'unsupported'; } }
    return typeof Notification !== 'undefined' && window.isSecureContext ? Notification.permission : 'unsupported';
  },
  dateKey(date) { return date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0'); },
  shouldDeliver(value, now, goalMet) {
    var r = this.normalize(value), date = this.dateKey(now), parts = r.time.split(':');
    var minutes = now.getHours()*60 + now.getMinutes() - (Number(parts[0])*60 + Number(parts[1]));
    return r.enabled && !goalMet && r.lastDate !== date && minutes >= 0 && minutes < 60;
  },
  async enable(time) {
    var r = this.normalize({enabled:true,time:time,lastDate:this.read().lastDate}), bridge = this.native();
    if (bridge) { bridge.setReminder(true, r.time); return {pending:true}; }
    if (this.permission() === 'unsupported') return {ok:false,message:'Browser alerts are unavailable here. Add a calendar reminder instead.'};
    var permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return {ok:false,message:'Notifications are blocked. You can allow them in your browser’s site settings, or use a calendar reminder.'};
    try { await this.registration(); } catch(e) { return {ok:false,message:'Browser notifications are unavailable here. Use a calendar reminder instead.'}; }
    if (!this.write(r)) return {ok:false,message:'This browser cannot save reminder settings. Use a calendar reminder instead.'};
    this.init();
    return {ok:true,message:'Browser reminder enabled while Pengo is open. It pauses after you meet your goal.'};
  },
  disable() {
    var bridge = this.native();
    if (bridge) bridge.setReminder(false,this.read().time);
    else this.write(Object.assign(this.read(),{enabled:false}));
  },
  resetDevice() {
    var bridge=this.native();
    if(bridge && typeof bridge.resetReminderSettings==='function')bridge.resetReminderSettings();
    else if(bridge)bridge.setReminder(false,'19:00');
    else try{localStorage.removeItem(this.key);}catch(e){}
  },
  syncGoal() {
    var bridge = this.native();
    if (bridge && typeof bridge.setReminderGoalDate === 'function' && typeof practiceStats === 'function') {
      var stats = practiceStats(); bridge.setReminderGoalDate(stats.goalMet ? Course.todayStr() : '');
    }
  },
  async registration() {
    if(!navigator.serviceWorker || !window.isSecureContext)throw new Error('unsupported');
    await navigator.serviceWorker.register('./reminder-worker.js');
    return navigator.serviceWorker.ready;
  },
  async notify(title,options) {
    var registration=await this.registration();
    await registration.showNotification(title,options);
  },
  async tick(now) {
    if (this.delivering || this.native() || this.permission() !== 'granted') return false;
    var r = this.read(), date = now || new Date();
    if (!this.shouldDeliver(r,date,practiceStats().goalMet)) return false;
    this.delivering=true;
    try {
      await this.notify('A little Japanese with Pengo?', {body:'Your study buddy is ready. Three questions are a lovely place to start.', icon:'assets/pengo-icon.png', tag:'pengo-daily'});
      r.lastDate = this.dateKey(date); this.write(r);
      return true;
    } catch (e) { return false; }
    finally { this.delivering=false; }
  },
  init() {
    this.syncGoal();
    if (this.native()) return;
    if (!this.listening) { this.listening = true; document.addEventListener('visibilitychange',()=>this.tick()); }
    if (!this.timer) this.timer = setInterval(()=>this.tick(),30000);
  },
  calendar(time, now) {
    var r = this.normalize({time:time}), date = new Date((now || new Date()).getTime()), parts = r.time.split(':');
    date.setHours(Number(parts[0]),Number(parts[1]),0,0);
    if (date <= (now || new Date())) date.setDate(date.getDate()+1);
    var pad = n=>String(n).padStart(2,'0');
    var stamp = date.getFullYear()+pad(date.getMonth()+1)+pad(date.getDate())+'T'+pad(date.getHours())+pad(date.getMinutes())+'00';
    var created = (now || new Date()).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pengo//Daily Practice//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
      'UID:pengo-daily-'+stamp+'@pengo.local','DTSTAMP:'+created,'DTSTART:'+stamp,'DURATION:PT5M','RRULE:FREQ=DAILY',
      'SUMMARY:A little Japanese with Pengo','DESCRIPTION:Open Pengo and practice three questions. A small step counts.',
      'BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Your study buddy is ready.','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
  },
  downloadCalendar(time) {
    var text = this.calendar(time), blob = new Blob([text],{type:'text/calendar;charset=utf-8'}), url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href=url; a.download='pengo-daily-reminder.ics'; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);
  }
};
function reminderSettingsHTML() {
  var r = Reminders.read(), native = !!Reminders.native(), permission = Reminders.permission();
  var status = r.enabled && permission === 'granted' ? 'Enabled · ' + r.time + (native ? ' · daily on this device' : ' · while Pengo is open') :
    r.enabled ? 'Saved, but notifications are blocked in system settings.' : 'Off · choose what fits your day';
  return '<section class="card reminder-settings" id="reminderSettings"><div class="practice-heading"><h2>Gentle reminders</h2><span class="reminder-status ' + (r.enabled && permission === 'granted' ? 'is-on' : '') + '">' +
    (r.enabled && permission === 'granted' ? 'ON' : 'OFF') + '</span></div><p>Make a little room for Japanese. One optional reminder a day, and no nudge after you reach your goal.</p>' +
    '<label for="reminderTime">Your preferred time</label><input type="time" id="reminderTime" value="' + r.time + '" required><p class="explain">' +
    (native ? 'Android can remind you even when Pengo is closed. Battery settings may delay the reminder. Times follow your device’s local clock.' :
      'Browser alerts work while Pengo is open, including in a background tab. For reminders after closing Pengo, add the calendar event and enable alerts in your calendar. Calendar reminders follow the calendar app’s settings and cannot check your Pengo goal.') +
    '</p><p id="reminderMessage" role="status" aria-live="polite">' + esc(status) + '</p><div class="practice-actions"><button class="btn primary" id="reminderEnable">' +
    (r.enabled ? 'Save reminder time' : 'Enable '+ (native ? 'daily reminder' : 'browser reminder')) + '</button><button class="btn soft" id="reminderDisable"' + (!r.enabled ? ' disabled' : '') + '>Turn off</button>' +
    (!native ? '<button class="btn soft" id="reminderCalendar">Add to calendar</button>' : '<button class="btn soft" id="reminderSystem">System settings</button>') +
    '<button class="btn soft" id="reminderTest"' + (permission !== 'granted' ? ' disabled' : '') + '>Send a test</button></div></section>';
}
function bindReminderSettings(view) {
  var panel = $('#reminderSettings',view); if(!panel)return;
  var message = $('#reminderMessage',panel), enable = $('#reminderEnable',panel), input = $('#reminderTime',panel);
  function update(text) {
    if(!document.contains(panel))return;
    message.textContent=text;
    $('#reminderDisable',panel).disabled=!Reminders.read().enabled;
    $('#reminderTest',panel).disabled=Reminders.permission()!=='granted';
    var indicator=$('.reminder-status',panel), active=Reminders.read().enabled && Reminders.permission()==='granted';
    indicator.textContent=active?'ON':'OFF';indicator.classList.toggle('is-on',active);
    enable.disabled=false;enable.textContent=Reminders.read().enabled?'Save reminder time':'Enable '+(Reminders.native()?'daily reminder':'browser reminder');
  }
  enable.addEventListener('click',async function(){
    if(!input.reportValidity())return;
    enable.disabled=true;
    try { var result=await Reminders.enable(input.value); if(!result.pending)update(result.message); }
    catch(e){update('Could not enable reminders. Check your notification settings and try again.');}
  });
  window.PengoReminderResult=function(ok,text){update(text);Reminders.syncGoal();};
  $('#reminderDisable',panel).addEventListener('click',()=>{Reminders.disable();update('Reminders are off. Your progress stays right here.');});
  var calendar=$('#reminderCalendar',panel);if(calendar)calendar.addEventListener('click',()=>{if(input.reportValidity()){Reminders.downloadCalendar(input.value);update('Calendar file downloaded. Import it into your calendar and choose your alert settings there.');}});
  var system=$('#reminderSystem',panel);if(system)system.addEventListener('click',()=>Reminders.native().openNotificationSettings());
  $('#reminderTest',panel).addEventListener('click',async function(){
    if(Reminders.native())Reminders.native().sendTestReminder();
    else try{await Reminders.notify('Hello from Pengo!',{body:'Your study buddy is ready whenever you are.',icon:'assets/pengo-icon.png',tag:'pengo-test'});update('Test sent. Check your device’s notifications.');}catch(e){update('Test could not be sent. Check your browser’s notification settings.');}
  });
}
if(typeof module!=='undefined' && module.exports)module.exports=Reminders;
