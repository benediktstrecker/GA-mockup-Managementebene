const screenNames = {
  overview: 'Systemübersicht',
  rooms: 'Raumübersicht',
  heating: 'Heizung',
  ventilation: 'Lüftung'
};

const pageParams = new URLSearchParams(window.location.search);
document.body.classList.toggle('panel-mode', pageParams.get('panel') === '1');
document.body.classList.toggle('embedded-mode', pageParams.get('embed') === '1');

const stateConfig = {
  COMFORT: { label: 'Komfortniveau', target: 20 },
  PRECOMFORT: { label: 'Bereitschaftsniveau', target: 18 },
  ECONOMY: { label: 'Absenkniveau', target: 15 },
  PROTECTION: { label: 'Gebäudeschutzniveau', target: 10 }
};

const automationContext = { buildingClosed: false, frostProtectionRequest: false };
const weatherWeek = [
  { min: 2, max: 8, condition: 'Bewölkt', icon: 'cloud' },
  { min: 1, max: 7, condition: 'Heiter', icon: 'sun' },
  { min: 3, max: 9, condition: 'Wolkig', icon: 'cloud' },
  { min: -1, max: 6, condition: 'Bedeckt', icon: 'cloud' },
  { min: -2, max: 5, condition: 'Unbewölkt', icon: 'sun' },
  { min: 0, max: 6, condition: 'Wolkig', icon: 'cloud' },
  { min: 2, max: 8, condition: 'Bewölkt', icon: 'cloud' }
];

const bookingTemplates = [
  [[8, 9.5], [10, 11.5], [13, 15]],
  [[7, 8.5], [11, 13], [15, 17.5]],
  [[9, 12], [14, 16]],
  [[8, 10], [12, 14.5], [16, 18]],
  [[9.5, 11], [12.5, 14]]
];

const floorData = {
  eg: [
    { id: 'S113', name: 'WC', anchor: [260, 205], card: [88, 170], area: .45, offset: -.25, type: 'service' },
    { id: 'S111', name: 'Flur', anchor: [340, 205], card: [145, 52], area: .55, offset: -.45, type: 'common' },
    { id: 'S110', name: 'Pantryküche', anchor: [430, 205], card: [315, 52], area: .55, offset: .15, type: 'service' },
    { id: 'S106', name: 'Beratung 2', anchor: [530, 205], card: [475, 52], area: .8, offset: -.05, type: 'consult', index: 1 },
    { id: 'S107', name: 'Beratung 3', anchor: [630, 205], card: [635, 52], area: .8, offset: .05, type: 'consult', index: 2 },
    { id: 'S108', name: 'Beratung 4', anchor: [730, 205], card: [795, 52], area: .8, offset: -.15, type: 'consult', index: 3 },
    { id: 'S109', name: 'Beratung 5', anchor: [840, 220], card: [1030, 120], area: 1.0, offset: 0, type: 'consult', index: 4 },
    { id: 'S112', name: 'Technik', anchor: [300, 315], card: [88, 300], area: .65, offset: -.35, type: 'service' },
    { id: 'S101', name: 'Foyer', anchor: [300, 455], card: [88, 500], area: 1.15, offset: -.3, type: 'common' },
    { id: 'S102', name: 'Kundenhalle', anchor: [455, 470], card: [390, 625], area: 1.8, offset: 0, type: 'common' },
    { id: 'S104', name: 'Beratung 1', anchor: [570, 495], card: [555, 630], area: .85, offset: .1, type: 'consult', index: 0 },
    { id: 'S103', name: 'Treppenhaus', anchor: [730, 500], card: [730, 625], area: .7, offset: -.55, type: 'common' },
    { id: 'S105', name: 'Leiterzimmer', anchor: [840, 455], card: [1030, 500], area: .9, offset: .2, type: 'office' }
  ],
  og: [
    { id: 'S204', name: 'WC', anchor: [360, 330], card: [155, 255], area: .45, offset: -.25, type: 'service' },
    { id: 'S205', name: 'Pausenraum', anchor: [305, 440], card: [95, 520], area: 1.0, offset: .05, type: 'break' },
    { id: 'S202', name: 'Büro', anchor: [550, 420], card: [545, 625], area: 1.65, offset: .15, type: 'office' },
    { id: 'S201', name: 'Treppenhaus', anchor: [750, 460], card: [900, 625], area: .75, offset: -.5, type: 'common' }
  ]
};

const allRooms = Object.values(floorData).flat();
const nonBookableRoomIds = new Set(['S101', 'S102', 'S103', 'S110', 'S111', 'S112', 'S113', 'S201', 'S204']);
const noPresenceRoomIds = new Set(['S110', 'S111', 'S113', 'S204']);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatDecimal = (value) => value.toFixed(1).replace('.', ',');

function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

function getOperatingState(date) {
  if (automationContext.buildingClosed || automationContext.frostProtectionRequest) return 'PROTECTION';
  const day = mondayIndex(date);
  const hour = date.getHours() + date.getMinutes() / 60;
  if (day >= 5) return 'ECONOMY';
  if (hour >= 9 && hour < 16) return 'COMFORT';
  if ((hour >= 6 && hour < 9) || (hour >= 16 && hour < 19)) return 'PRECOMFORT';
  return 'ECONOMY';
}

function outsideTemperature(date) {
  const profile = weatherWeek[mondayIndex(date)];
  const hour = date.getHours() + date.getMinutes() / 60;
  const daylight = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
  return profile.min + (profile.max - profile.min) * Math.max(0, daylight);
}

function weatherConditionAt(date) {
  const profile = weatherWeek[mondayIndex(date)];
  const hour = date.getHours();
  return profile.icon === 'sun' && (hour >= 20 || hour < 7) ? 'Unbewölkt' : profile.condition;
}

function slotsForRoom(room, date) {
  const day = mondayIndex(date);
  if (day >= 5) return [];
  if (room.id === 'S107') return bookingTemplates[day];
  if (room.type === 'consult') {
    const shift = ((room.index ?? 0) % 3 - 1) * .5;
    return bookingTemplates[day].map(([start, end]) => [clamp(start + shift, 7, 17), clamp(end + shift, 8, 18.5)]);
  }
  if (room.type === 'office') return [[8, 17]];
  if (room.type === 'break') return [[10, 10.5], [12, 13.5], [15, 15.5]];
  return [];
}

function isInSlot(slots, hour) {
  return slots.some(([start, end]) => hour >= start && hour < end);
}

function roomAt(room, date, outside, stateName) {
  const state = stateConfig[stateName];
  const day = mondayIndex(date);
  const hour = date.getHours() + date.getMinutes() / 60;
  const bookable = !nonBookableRoomIds.has(room.id);
  const presenceTracked = !noPresenceRoomIds.has(room.id);
  const slots = bookable ? slotsForRoom(room, date) : [];
  const booked = isInSlot(slots, hour);
  const openUse = day < 5 && hour >= 9 && hour < 16 && (room.type === 'common' || room.type === 'service');
  const occupied = presenceTracked && (booked || openUse);
  const target = state.target;
  const lag = stateName === 'COMFORT' ? .28 : stateName === 'PRECOMFORT' ? .45 : .38;
  const coldPenalty = Math.max(0, 4 - outside) * .025;
  const internalGain = occupied ? .12 : 0;
  const actual = target - lag - coldPenalty + room.offset + internalGain;
  const bookingStart = slots.find(([start, end]) => hour >= start && hour < end)?.[0] ?? hour;
  const co2 = Math.round(clamp(545 + (occupied ? 210 + room.area * 85 + Math.max(0, hour - bookingStart) * 58 : 0), 520, 1480));
  const lightsOn = occupied && (hour < 10 || hour > 15 || weatherWeek[day].icon === 'cloud');
  const lightLevel = lightsOn ? Math.round(clamp(58 + room.area * 8, 55, 82)) : 0;
  const airflow = occupied ? Math.round(clamp((38 + (co2 - 650) * .13) * (.72 + room.area * .22), 34, 185)) : 0;
  const heatKw = Math.max(.05, (target - actual) * room.area * 1.45 + Math.max(0, 12 - outside) * room.area * .045);
  const heatPercent = Math.round(clamp(heatKw / (room.area * 1.25) * 100, 4, 100));
  return {
    ...room,
    target,
    actual,
    bookable,
    presenceTracked,
    booked,
    occupied,
    booking: bookable ? (booked ? 'Gebucht' : 'Frei') : '',
    co2,
    lightsOn,
    lightLevel,
    airflow,
    heatKw,
    heatPercent
  };
}

function systemAt(date) {
  const stateName = getOperatingState(date);
  const outside = outsideTemperature(date);
  const rooms = allRooms.map((room) => roomAt(room, date, outside, stateName));
  const heatingDemand = rooms.reduce((sum, room) => sum + room.heatKw, 0);
  const wpOutput = Math.min(14.5, heatingDemand);
  const gasOutput = Math.max(0, heatingDemand - wpOutput);
  const totalAirflow = rooms.reduce((sum, room) => sum + room.airflow, 0);
  const avgCo2 = Math.round(rooms.reduce((sum, room) => sum + room.co2, 0) / rooms.length);
  const occupied = rooms.filter((room) => room.occupied).length;
  const bufferTop = clamp(40 + wpOutput * .52 + gasOutput * .25, 39, 51);
  const bufferMiddle = bufferTop - 5.2;
  const bufferBottom = bufferTop - 10.3;
  const flow = clamp(28 + heatingDemand * .72, 28, 48);
  const wrg = totalAirflow > 0 ? Math.round(clamp(76 + (8 - outside) * .75, 74, 88)) : 0;
  return {
    date,
    stateName,
    state: stateConfig[stateName],
    outside,
    rooms,
    heatingDemand,
    wpOutput,
    gasOutput,
    totalAirflow,
    avgCo2,
    occupied,
    bufferTop,
    bufferMiddle,
    bufferBottom,
    flow,
    returnTemp: flow - clamp(5.5 + heatingDemand * .05, 5.5, 7.5),
    wrg,
    supplyTemp: totalAirflow > 0 ? clamp(18.2 + (8 - outside) * .13, 18.2, 20.4) : 0,
    ductPressure: totalAirflow > 0 ? Math.round(72 + totalAirflow * .12) : 0
  };
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

let activeScreen = 'overview';
let selectedRoom = null;
function activateScreen(name) {
  if (!screenNames[name]) return;
  activeScreen = name;
  document.querySelectorAll('[data-screen]').forEach((button) => button.classList.toggle('is-active', button.dataset.screen === name));
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('is-active', screen.id === `screen-${name}`));
  setText('#screenTitle', screenNames[name]);
  if (name !== 'rooms') closeRoomDetail();
  document.querySelector('#sidebar').classList.remove('is-open');
  document.querySelector('#navToggle').setAttribute('aria-expanded', 'false');
}

document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => activateScreen(button.dataset.screen)));
window.addEventListener('message', (event) => {
  const sameOrigin = window.location.origin === 'null' || event.origin === window.location.origin;
  if (event.source !== window.parent || !sameOrigin || event.data?.type !== 'management-screen') return;
  const screen = event.data.screen;
  if (!screenNames[screen]) return;
  activateScreen(screen);
  const url = new URL(window.location.href);
  url.searchParams.set('screen', screen);
  window.history.replaceState(null, '', url);
});
document.querySelector('#navToggle').addEventListener('click', () => {
  const open = document.querySelector('#sidebar').classList.toggle('is-open');
  document.querySelector('#navToggle').setAttribute('aria-expanded', String(open));
});

let manualTheme = null;
function applyTheme(date) {
  const automaticDark = date.getHours() >= 20 || date.getHours() < 7;
  const dark = manualTheme === null ? automaticDark : manualTheme;
  document.body.classList.toggle('night-mode', dark);
  const toggle = document.querySelector('#themeToggle');
  toggle.setAttribute('aria-pressed', String(dark));
  toggle.title = `${dark ? 'Dunkelmodus' : 'Hellmodus'} · manuell umschalten`;
}

document.querySelector('#themeToggle').addEventListener('click', () => {
  manualTheme = !document.body.classList.contains('night-mode');
  applyTheme(new Date());
});

function edgePoint(anchor, card, width = 132, height = 86) {
  const dx = anchor[0] - card[0];
  const dy = anchor[1] - card[1];
  const scale = 1 / Math.max(Math.abs(dx) / (width / 2), Math.abs(dy) / (height / 2));
  return [card[0] + dx * scale, card[1] + dy * scale];
}

const useOffsetConnectorStarts = true; // false restores the original label-centered starts.

function connectorStart(room) {
  if (!useOffsetConnectorStarts) return room.anchor;

  const dx = room.card[0] - room.anchor[0];
  const dy = room.card[1] - room.anchor[1];
  if (Math.abs(dx) >= Math.abs(dy)) {
    return [room.anchor[0] + Math.sign(dx) * 34, room.anchor[1]];
  }
  return [room.anchor[0], room.anchor[1] + Math.sign(dy) * 26];
}

function co2Class(value) {
  if (value <= 1000) return 'good';
  if (value <= 2000) return 'medium';
  return 'bad';
}

function statusRow(icon, label, value) {
  return `<div><svg><use href="#${icon}"/></svg><span>${label}</span><strong>${value}</strong></div>`;
}

function renderFloorPlans(model) {
  Object.entries(floorData).forEach(([floor, roomDefs]) => {
    const roomLayer = document.querySelector(`#rooms-${floor}`);
    const lineLayer = document.querySelector(`#lines-${floor}`);
    roomLayer.replaceChildren();
    lineLayer.replaceChildren();
    roomDefs.forEach((definition) => {
      const room = model.rooms.find((entry) => entry.id === definition.id);
      const card = document.createElement('button');
      const bookingState = room.bookable
        ? `<span class="booking-state ${room.booked ? 'booked' : 'free'}">${room.booking}</span>`
        : '';
      card.type = 'button';
      card.className = `room-callout${room.booked ? ' booked' : ''}${room.bookable ? '' : ' no-booking'}`;
      card.style.left = `${room.card[0] / 11.2}%`;
      card.style.top = `${room.card[1] / 6.8}%`;
      card.setAttribute('aria-label', `${room.name}, Raum ${room.id}, Details öffnen`);
      card.innerHTML = `<h3>${room.name} · ${room.id}</h3><div class="room-values"><span>Temperatur</span><strong>${formatDecimal(room.actual)} °C</strong><span>Licht</span><strong class="light-state"><svg><use href="#i-light"/></svg>${room.lightsOn ? 'An' : 'Aus'}</strong><span>CO₂</span><strong class="co2-badge ${co2Class(room.co2)}">${room.co2} ppm</strong>${bookingState}</div>`;
      card.addEventListener('click', () => openRoomDetail(room.id));
      roomLayer.appendChild(card);

      const start = connectorStart(room);
      const [edgeX, edgeY] = edgePoint(start, room.card);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', start[0]);
      line.setAttribute('y1', start[1]);
      line.setAttribute('x2', edgeX.toFixed(1));
      line.setAttribute('y2', edgeY.toFixed(1));
      line.setAttribute('data-room-id', room.id);
      lineLayer.appendChild(line);
    });
  });
}

function openRoomDetail(roomId) {
  const model = systemAt(new Date());
  const room = model.rooms.find((entry) => entry.id === roomId);
  if (!room) return;
  selectedRoom = roomId;
  document.querySelector('#planShell').hidden = true;
  document.querySelector('#floorSwitch').hidden = true;
  document.querySelector('#roomDetail').classList.add('is-active');
  document.querySelector('#roomBack').classList.add('is-visible');
  setText('#rooms-title', `${room.name} · ${room.id}`);
  setText('#screenTitle', `${room.name} · ${room.id}`);
  const blindValue = 0;
  const airQuality = room.co2 <= 800 ? 'Sehr gut' : room.co2 <= 1000 ? 'Gut' : 'Erhöht';
  const statusItems = [
    room.presenceTracked ? statusRow('i-user', 'Präsenz', room.occupied ? 'Erkannt' : 'Keine') : '',
    statusRow('i-window', 'Fenster', 'Geschlossen'),
    room.bookable ? statusRow('i-calendar', 'Buchung', room.booking) : '',
    statusRow('i-thermo', 'Betriebsniveau', model.stateName)
  ].join('');
  document.querySelector('#roomDetailGrid').innerHTML = `
    <article class="tile temperature-tile">
      <div class="tile-head"><span><svg><use href="#i-thermo"/></svg> Raumtemperatur</span><span class="state-label">Heizen aktiv</span></div>
      <div class="temperature-body"><div class="actual-temp"><strong>${formatDecimal(room.actual)}</strong><span>°C</span><small>Istwert</small></div><div class="setpoint-control"><span>Sollwert</span><div class="stepper"><button type="button" data-detail-temp-step="-0.5" aria-label="Temperatur senken">−</button><strong><span id="detailSetpoint">${formatDecimal(room.target)}</span><span>°C</span></strong><button type="button" data-detail-temp-step="0.5" aria-label="Temperatur erhöhen">+</button></div></div></div>
      <div class="temperature-context"><span>Außentemperatur</span><strong>${formatDecimal(model.outside)} °C</strong><span id="detailStateSetpoint">${model.stateName} · ${formatDecimal(room.target)} °C</span></div>
      <div class="demand-row"><span>Heizventil</span><div class="meter"><i style="width:${room.heatPercent}%"></i></div><strong>${room.heatPercent} %</strong></div>
    </article>
    <article class="tile air-tile">
      <div class="tile-head"><span><svg><use href="#i-wind"/></svg> Raumluft</span><span class="quality ${co2Class(room.co2)}">${airQuality}</span></div>
      <div class="air-value"><strong>${room.co2}</strong><span>ppm CO₂</span></div>
      <div class="mini-stats"><div><span>Feuchte</span><strong>43 %</strong></div><div><span>Zuluft</span><strong>${room.airflow} m³/h</strong></div></div>
      <div class="segmented"><button type="button">Leise</button><button type="button" class="is-selected">Auto</button><button type="button">Intensiv</button></div>
    </article>
    <article class="tile control-tile">
      <div class="tile-head"><span><svg><use href="#i-light"/></svg> Beleuchtung</span><label class="switch"><input id="detailLightToggle" type="checkbox" ${room.lightsOn ? 'checked' : ''}><span></span></label></div>
      <div class="control-value"><strong id="detailLightValue">${room.lightsOn ? `${room.lightLevel} %` : 'Aus'}</strong><span>Arbeitslicht</span></div>
      <input id="detailLightSlider" class="range" type="range" min="0" max="100" value="${room.lightLevel}" aria-label="Helligkeit">
      <div class="control-footer"><span>Automatik</span><strong>${room.presenceTracked ? 'Präsenz + 500 lx' : 'Zeitprogramm + 500 lx'}</strong></div>
    </article>
    <article class="tile control-tile">
      <div class="tile-head"><span><svg><use href="#i-blinds"/></svg> Verschattung</span><span class="state-label neutral">Automatik</span></div>
      <div class="control-value"><strong id="detailBlindValue">${blindValue} %</strong><span>Behang geschlossen</span></div>
      <input id="detailBlindSlider" class="range" type="range" min="0" max="100" value="${blindValue}" aria-label="Jalousiestellung">
      <div class="segmented compact"><button type="button">Auf</button><button type="button" class="is-selected">Auto</button><button type="button">Ab</button></div>
    </article>
    <article class="tile status-tile">
      <div class="tile-head"><span>Raumstatus</span><span class="status-dot"></span></div>
      <div class="status-list">${statusItems}</div>
    </article>`;

  let detailSetpoint = room.target;
  document.querySelectorAll('[data-detail-temp-step]').forEach((button) => button.addEventListener('click', () => {
    detailSetpoint += Number(button.dataset.detailTempStep);
    setText('#detailSetpoint', formatDecimal(detailSetpoint));
    setText('#detailStateSetpoint', `${model.stateName} · ${formatDecimal(detailSetpoint)} °C`);
  }));
  const lightToggle = document.querySelector('#detailLightToggle');
  const lightSlider = document.querySelector('#detailLightSlider');
  const updateLight = () => setText('#detailLightValue', lightToggle.checked ? `${lightSlider.value} %` : 'Aus');
  lightToggle.addEventListener('change', updateLight);
  lightSlider.addEventListener('input', () => { lightToggle.checked = Number(lightSlider.value) > 0; updateLight(); });
  document.querySelector('#detailBlindSlider').addEventListener('input', (event) => setText('#detailBlindValue', `${event.target.value} %`));
}

function closeRoomDetail() {
  selectedRoom = null;
  const plan = document.querySelector('#planShell');
  const floorSwitch = document.querySelector('#floorSwitch');
  if (plan) plan.hidden = false;
  if (floorSwitch) floorSwitch.hidden = false;
  document.querySelector('#roomDetail')?.classList.remove('is-active');
  document.querySelector('#roomBack')?.classList.remove('is-visible');
  setText('#rooms-title', 'Raumübersicht');
  if (activeScreen === 'rooms') setText('#screenTitle', 'Raumübersicht');
}

function roomsByNumber(rooms) {
  return [...rooms].sort((left, right) => left.id.localeCompare(right.id, 'de-DE', { numeric: true }));
}

document.querySelector('#roomBack').addEventListener('click', closeRoomDetail);
document.querySelectorAll('[data-floor]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-floor]').forEach((item) => item.classList.toggle('is-selected', item === button));
  document.querySelectorAll('.floor-view').forEach((view) => view.classList.toggle('is-active', view.id === `floor-${button.dataset.floor}`));
}));

function renderHeatingZones(model) {
  const target = document.querySelector('#heatingZones');
  target.replaceChildren();
  roomsByNumber(model.rooms).forEach((room) => {
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `<div><strong>${room.id} · ${room.name}</strong><span>Ist / Soll</span></div><strong>${formatDecimal(room.actual)} °C</strong><span>${formatDecimal(room.target)} °C</span><strong>${formatDecimal(room.heatKw)} kW</strong><div class="need-bar"><i style="width:${room.heatPercent}%"></i></div>`;
    target.appendChild(row);
  });
  setText('#heatingZoneSummary', `${formatDecimal(model.heatingDemand)} kW`);
}

function renderAirZones(model) {
  const target = document.querySelector('#airZones');
  target.replaceChildren();
  roomsByNumber(model.rooms).forEach((room) => {
    const share = model.totalAirflow ? Math.round(room.airflow / model.totalAirflow * 100) : 0;
    const roomState = [
      room.bookable ? room.booking : '',
      room.presenceTracked ? (room.occupied ? 'Präsenz' : 'keine Präsenz') : ''
    ].filter(Boolean).join(' · ');
    const row = document.createElement('div');
    row.className = 'zone-row air-row';
    row.innerHTML = `<div><strong>${room.id} · ${room.name}</strong>${roomState ? `<span>${roomState}</span>` : ''}</div><strong>${room.co2} ppm</strong><span>${room.airflow} m³/h</span><strong>${share} %</strong><div class="need-bar"><i style="width:${share}%"></i></div>`;
    target.appendChild(row);
  });
  setText('#averageCo2', `Ø ${model.avgCo2} ppm`);
}

function chartPath(values, x, y) {
  return values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
}

function renderHeatingChart(now) {
  const points = Array.from({ length: 289 }, (_, index) => {
    const date = new Date(now.getTime() - (288 - index) * 5 * 60000);
    const model = systemAt(date);
    const ripple = Math.sin(index * .72) * .12;
    return { demand: Math.max(0, model.heatingDemand + ripple), wp: Math.max(0, model.wpOutput + ripple), gas: model.gasOutput };
  });
  const maxValue = Math.max(18, Math.ceil(Math.max(...points.map((point) => point.demand)) / 5) * 5);
  const left = 48, right = 880, top = 20, bottom = 255;
  const x = (index) => left + index / (points.length - 1) * (right - left);
  const y = (value) => bottom - value / maxValue * (bottom - top);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = maxValue - index * maxValue / 4;
    const yPos = top + index * (bottom - top) / 4;
    return `<line class="chart-grid" x1="${left}" y1="${yPos}" x2="${right}" y2="${yPos}"/><text class="chart-axis" x="4" y="${yPos + 4}">${formatDecimal(value)} kW</text>`;
  }).join('');
  const times = [24, 18, 12, 6, 0].map((hoursAgo, index) => `<text class="chart-axis" x="${left + index * (right - left) / 4}" y="279" text-anchor="middle">${new Date(now.getTime() - hoursAgo * 3600000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</text>`).join('');
  document.querySelector('#heatingChart').innerHTML = `${grid}${times}<path class="chart-path demand" d="${chartPath(points.map((p) => p.demand), x, y)}"/><path class="chart-path wp" d="${chartPath(points.map((p) => p.wp), x, y)}"/><path class="chart-path gas" d="${chartPath(points.map((p) => p.gas), x, y)}"/><line class="chart-now" x1="${right}" y1="${top}" x2="${right}" y2="${bottom}"/>`;
}

function renderVentilationChart(now) {
  const points = Array.from({ length: 289 }, (_, index) => {
    const date = new Date(now.getTime() - (288 - index) * 5 * 60000);
    const model = systemAt(date);
    return { airflow: model.totalAirflow, outside: model.outside };
  });
  const maxAir = Math.max(1200, Math.ceil(Math.max(...points.map((point) => point.airflow)) / 200) * 200);
  const minTemp = -5, maxTemp = 15;
  const left = 55, right = 865, top = 20, bottom = 255;
  const x = (index) => left + index / (points.length - 1) * (right - left);
  const airY = (value) => bottom - value / maxAir * (bottom - top);
  const tempY = (value) => bottom - (value - minTemp) / (maxTemp - minTemp) * (bottom - top);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const yPos = top + index * (bottom - top) / 4;
    const airValue = maxAir - index * maxAir / 4;
    const tempValue = maxTemp - index * (maxTemp - minTemp) / 4;
    return `<line class="chart-grid" x1="${left}" y1="${yPos}" x2="${right}" y2="${yPos}"/><text class="chart-axis" x="2" y="${yPos + 4}">${Math.round(airValue)} m³/h</text><text class="chart-axis" x="895" y="${yPos + 4}" text-anchor="end">${formatDecimal(tempValue)} °C</text>`;
  }).join('');
  const times = [24, 18, 12, 6, 0].map((hoursAgo, index) => `<text class="chart-axis" x="${left + index * (right - left) / 4}" y="279" text-anchor="middle">${new Date(now.getTime() - hoursAgo * 3600000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</text>`).join('');
  document.querySelector('#ventilationChart').innerHTML = `${grid}${times}<path class="chart-path airflow" d="${chartPath(points.map((p) => p.airflow), x, airY)}"/><path class="chart-path outside" d="${chartPath(points.map((p) => p.outside), x, tempY)}"/><line class="chart-now" x1="${right}" y1="${top}" x2="${right}" y2="${bottom}"/>`;
}

function renderForecast(now, model) {
  setText('#weatherCurrent', `${formatDecimal(model.outside)} °C`);
  setText('#weatherCondition', weatherConditionAt(now));
  const forecast = document.querySelector('#forecast');
  forecast.replaceChildren();
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const profile = weatherWeek[mondayIndex(date)];
    const item = document.createElement('div');
    item.innerHTML = `<span>${offset === 0 ? 'Heute' : date.toLocaleDateString('de-DE', { weekday: 'short' })}</span><svg><use href="#i-${profile.icon}"/></svg><strong>${profile.max}° / ${profile.min}°</strong><small>${profile.condition.toLowerCase()}</small>`;
    forecast.appendChild(item);
  }
}

function renderModel(now) {
  const model = systemAt(now);
  const avgTemperature = model.rooms.reduce((sum, room) => sum + room.actual, 0) / model.rooms.length;
  const airflowSet = Math.round(model.totalAirflow * 1.04);
  setText('#overviewRoomTemp', `Ø ${formatDecimal(avgTemperature)} °C`);
  setText('#overviewOccupancy', `${model.occupied} belegt`);
  setText('#overviewRoomMode', model.stateName);
  setText('#overviewDemand', `${formatDecimal(model.heatingDemand)} kW`);
  setText('#overviewWpPower', `WP ${Math.round(model.wpOutput / 16 * 100)} %`);
  setText('#overviewBuffer', `${formatDecimal(model.bufferTop)} °C`);
  setText('#overviewAirflow', `${model.totalAirflow} m³/h`);
  setText('#overviewCo2', `Ø ${model.avgCo2} ppm`);
  setText('#overviewWrg', `WRG ${model.wrg} %`);

  setText('#heatDemand', `${formatDecimal(model.heatingDemand)} kW`);
  setText('#bufferTopKpi', `${formatDecimal(model.bufferTop)} °C`);
  setText('#heatingMode', model.stateName);
  setText('#heatOutside', `${formatDecimal(model.outside)} °C`);
  setText('#wpOutput', `${formatDecimal(model.wpOutput)} kW`);
  setText('#wpPower', `${Math.round(model.wpOutput / 16 * 100)} %`);
  setText('#wpRequest', `${formatDecimal(4.2 + model.wpOutput / 16 * 2.8)} V`);
  setText('#flowReturn', `${formatDecimal(model.flow)} / ${formatDecimal(model.returnTemp)} °C`);
  setText('#wpStatus', `Grundlast · ${model.wpOutput > .2 ? 'aktiv' : 'bereit'}`);
  setText('#gasOutput', `${formatDecimal(model.gasOutput)} kW`);
  setText('#gasPower', `${Math.round(model.gasOutput / 40 * 100)} %`);
  setText('#gasStatus', model.gasOutput > .2 ? 'Spitzenlast · aktiv' : 'Spitzenlast · bereit');
  setText('#boilerSetpoint', `${formatDecimal(model.gasOutput > .2 ? 52 : 48)} °C`);
  setText('#boilerTemp', `${formatDecimal(model.gasOutput > .2 ? 49.4 : 45.2)} °C`);
  setText('#dhwTemp', `${formatDecimal(53.8 + Math.sin(now.getHours() / 24 * Math.PI * 2) * .5)} °C`);
  setText('#burnerStarts', String(model.gasOutput > .2 ? 4 : 3));
  setText('#bufferTop', `${formatDecimal(model.bufferTop)} °C`);
  setText('#bufferMiddle', `${formatDecimal(model.bufferMiddle)} °C`);
  setText('#bufferBottom', `${formatDecimal(model.bufferBottom)} °C`);

  setText('#airflowKpi', `${model.totalAirflow} m³/h`);
  setText('#wrgKpi', `${model.wrg} %`);
  setText('#ventilationMode', model.stateName);
  setText('#airflowValues', `${airflowSet} / ${model.totalAirflow} m³/h`);
  setText('#ductPressure', `${model.ductPressure} Pa`);
  setText('#supplyTemp', model.totalAirflow ? `${formatDecimal(model.supplyTemp)} °C` : 'Nicht aktiv');
  setText('#co2Lead', `${Math.max(...model.rooms.map((room) => room.co2)).toLocaleString('de-DE')} ppm`);
  setText('#wrgValue', `${model.wrg} %`);
  setText('#heatingCoil', `${model.totalAirflow ? Math.round(clamp((18 - model.outside) * 2.2, 0, 38)) : 0} %`);
  setText('#airUnitStatus', model.totalAirflow ? `${model.stateName} · Betrieb` : `${model.stateName} · Aus`);
  setText('#airOutside', `${formatDecimal(model.outside)} °C`);
  setText('#fanPower', `${model.totalAirflow ? Math.round(clamp(model.totalAirflow / 1500 * 100, 20, 100)) : 0} %`);
  setText('#extractTemp', `${formatDecimal(model.rooms.reduce((sum, room) => sum + room.actual, 0) / model.rooms.length + .6)} °C`);

  renderForecast(now, model);
  renderFloorPlans(model);
  renderHeatingZones(model);
  renderAirZones(model);
  renderHeatingChart(now);
  renderVentilationChart(now);
  if (selectedRoom) openRoomDetail(selectedRoom);
}

let lastModelKey = '';
function updateClock() {
  const now = new Date();
  setText('#clockTime', now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
  setText('#clockDate', now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  applyTheme(now);
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  if (key !== lastModelKey) {
    lastModelKey = key;
    renderModel(now);
  }
}

const requestedScreen = pageParams.get('screen');
if (screenNames[requestedScreen]) activateScreen(requestedScreen);
updateClock();
setInterval(updateClock, 1000);
