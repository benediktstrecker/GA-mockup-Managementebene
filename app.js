const screenNames = {
  overview: 'Systemübersicht',
  rooms: 'Raumübersicht',
  heating: 'Heizung',
  ventilation: 'Lüftung'
};

document.querySelectorAll('[data-screen]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-screen]').forEach((item) => item.classList.remove('is-active'));
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('is-active'));
    button.classList.add('is-active');
    document.querySelector(`#screen-${button.dataset.screen}`).classList.add('is-active');
    document.querySelector('#screenTitle').textContent = screenNames[button.dataset.screen];
  });
});

const operatingStates = {
  COMFORT: { label: 'Komfortniveau', heat: 20, roomBase: 19.6, demand: 12.8, wp: 63, buffer: 68, flow: '41,6 / 34,1 °C', request: '5,9 V', pumps: '52 / 38 %', airflow: 742, airflowSet: 760, fan: 68, wrg: 78, supply: '19,2 °C', pressure: 186, extract: '19,8 °C', co2Lead: 1180, avgCo2: 811, coil: 18, occupied: 3 },
  PRECOMFORT: { label: 'Bereitschaftsniveau', heat: 18, roomBase: 17.6, demand: 9.4, wp: 46, buffer: 64, flow: '37,2 / 31,4 °C', request: '5,3 V', pumps: '44 / 32 %', airflow: 360, airflowSet: 380, fan: 42, wrg: 82, supply: '17,4 °C', pressure: 128, extract: '18,2 °C', co2Lead: 1050, avgCo2: 850, coil: 26, occupied: 0 },
  ECONOMY: { label: 'Absenkniveau', heat: 15, roomBase: 14.8, demand: 4.2, wp: 28, buffer: 58, flow: '31,8 / 27,1 °C', request: '4,7 V', pumps: '26 / 20 %', airflow: 0, airflowSet: 0, fan: 0, wrg: 0, supply: 'Nicht aktiv', pressure: 0, extract: '15,1 °C', co2Lead: 590, avgCo2: 575, coil: 0, occupied: 0 },
  PROTECTION: { label: 'Gebäudeschutzniveau', heat: 10, roomBase: 9.7, demand: 2.1, wp: 18, buffer: 45, flow: '25,0 / 22,0 °C', request: '4,4 V', pumps: '18 / 14 %', airflow: 0, airflowSet: 0, fan: 0, wrg: 0, supply: 'Nicht aktiv', pressure: 0, extract: '10,2 °C', co2Lead: 560, avgCo2: 550, coil: 0, occupied: 0 }
};

const automationContext = {
  buildingClosed: false,
  frostProtectionRequest: false
};

function getOperatingState(date) {
  const day = date.getDay();
  const hour = date.getHours() + date.getMinutes() / 60;
  if (automationContext.buildingClosed || automationContext.frostProtectionRequest) return 'PROTECTION';
  if (day === 0 || day === 6) return 'ECONOMY';
  if (hour >= 9 && hour < 16) return 'COMFORT';
  if ((hour >= 6 && hour < 9) || (hour >= 16 && hour < 19)) return 'PRECOMFORT';
  return 'ECONOMY';
}

const floorData = {
  eg: [
    { room: 'S110', name: 'Pantryküche', offset: 0.2, light: true, co2: 620, booking: 'Frei', anchor: [278, 205], card: [88, 72] },
    { room: 'S106', name: 'Beratung 2', offset: -0.1, light: true, co2: 812, booking: 'Gebucht', anchor: [360, 205], card: [255, 72] },
    { room: 'S107', name: 'Beratung 3', offset: 0.1, light: true, co2: 742, booking: 'Gebucht', anchor: [460, 205], card: [420, 72] },
    { room: 'S108', name: 'Beratung 4', offset: -0.2, light: true, co2: 1040, booking: 'Gebucht', anchor: [560, 205], card: [585, 72] },
    { room: 'S109', name: 'Beratung 5', offset: 0, light: false, co2: 890, booking: 'Frei', anchor: [660, 205], card: [752, 72] },
    { room: 'S101', name: 'SB-Foyer', offset: -0.4, light: true, co2: 680, booking: 'Frei', anchor: [278, 375], card: [95, 315] },
    { room: 'S102', name: 'Kundenhalle', offset: 0, light: true, co2: 960, booking: 'Frei', anchor: [470, 310], card: [895, 220] },
    { room: 'S104', name: 'Beratung 1', offset: 0.1, light: true, co2: 1180, booking: 'Gebucht', anchor: [415, 410], card: [300, 530] },
    { room: 'S105', name: 'Leiterzimmer', offset: 0.3, light: true, co2: 720, booking: 'Frei', anchor: [550, 410], card: [700, 530] }
  ],
  og: [
    { room: 'S205', name: 'Pausenraum', offset: 0, light: true, co2: 860, booking: 'Frei', anchor: [265, 405], card: [110, 485] },
    { room: 'S202', name: 'Büro', offset: 0.2, light: true, co2: 930, booking: 'Gebucht', anchor: [470, 405], card: [470, 520] },
    { room: 'S201', name: 'Flur / Treppe', offset: -0.5, light: true, co2: 610, booking: 'Frei', anchor: [660, 405], card: [720, 520] },
    { room: 'S204', name: 'WC', offset: -0.2, light: false, co2: 570, booking: 'Frei', anchor: [750, 405], card: [890, 350] }
  ]
};

const heatingZones = [
  ['Beratung / Büros', 0.1, 42],
  ['Beratung 5 / Pause', 0, 28],
  ['Foyer / Kundenhalle', -0.3, 58],
  ['Flure / Treppe', -0.6, 36],
  ['WC-Bereiche', -0.2, 24],
  ['Pantryküche', 0.2, 12],
  ['Wohnungen', 0, 34]
];

const airZones = [
  ['Beratung 1', 820, 72, 44],
  ['Beratung 2', 812, 68, 39],
  ['Beratung 3', 742, 68, 35],
  ['Beratung 4', 1040, 92, 64],
  ['Beratung 5', 890, 76, 48],
  ['Kundenhalle', 960, 188, 59],
  ['Leiterzimmer', 720, 54, 29]
];

function co2Class(value) {
  if (value <= 1000) return 'good';
  if (value <= 2000) return 'medium';
  return 'bad';
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderFloorPlans(stateName, config) {
  Object.entries(floorData).forEach(([floor, rooms]) => {
    const layer = document.querySelector(`#rooms-${floor}`);
    const lines = document.querySelector(`#lines-${floor}`);
    layer.replaceChildren();
    lines.replaceChildren();
    rooms.forEach((room, index) => {
      const activeUse = stateName === 'COMFORT';
      const booking = activeUse ? room.booking : 'Frei';
      const light = activeUse ? room.light : false;
      const co2 = activeUse ? room.co2 : Math.round(config.avgCo2 + ((index % 4) - 1.5) * 18);
      const temperature = config.roomBase + room.offset;
      const callout = document.createElement('article');
      callout.className = `room-callout ${booking === 'Gebucht' ? 'booked' : ''}`;
      callout.style.left = `${room.card[0] / 10}%`;
      callout.style.top = `${room.card[1] / 6}%`;
      const bookingClass = booking === 'Gebucht' ? 'booked' : 'free';
      callout.innerHTML = `<h3>${room.name} · ${room.room}</h3><div class="room-values"><span>Temperatur</span><strong>${temperature.toFixed(1).replace('.', ',')} °C</strong><span>Licht</span><strong class="light-state ${light ? 'on' : ''}"><svg><use href="#i-light"/></svg>${light ? 'An' : 'Aus'}</strong><span>CO₂</span><strong class="co2-badge ${co2Class(co2)}">${co2} ppm</strong><span class="booking-state ${bookingClass}">${booking}</span></div>`;
      layer.appendChild(callout);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', room.card[0]);
      line.setAttribute('y1', room.card[1]);
      line.setAttribute('x2', room.anchor[0]);
      line.setAttribute('y2', room.anchor[1]);
      lines.appendChild(line);
    });
  });
}

function renderHeatingZones(config) {
  const target = document.querySelector('#heatingZones');
  target.replaceChildren();
  const scale = config.wp / operatingStates.COMFORT.wp;
  let activeCount = 0;
  heatingZones.forEach(([name, offset, comfortNeed]) => {
    const need = Math.max(8, Math.round(comfortNeed * scale));
    if (need >= 20) activeCount += 1;
    const actual = config.roomBase + offset;
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `<div><strong>${name}</strong><span>Ist / Soll</span></div><strong>${actual.toFixed(1).replace('.', ',')} °C</strong><span>${config.heat.toFixed(1).replace('.', ',')} °C</span><strong>${need} %</strong><div class="need-bar"><i style="width:${need}%"></i></div>`;
    target.appendChild(row);
  });
  setText('#heatingZoneSummary', `${activeCount} von 7 aktiv`);
}

function renderAirZones(stateName, config) {
  const target = document.querySelector('#airZones');
  target.replaceChildren();
  const scale = config.airflow / operatingStates.COMFORT.airflow;
  airZones.forEach(([name, comfortCo2, comfortFlow, comfortNeed], index) => {
    const active = config.airflow > 0;
    const co2 = active ? Math.round(config.avgCo2 + (comfortCo2 - operatingStates.COMFORT.avgCo2) * 0.55) : Math.round(config.avgCo2 + (index - 3) * 7);
    const flow = active ? Math.round(comfortFlow * scale) : 0;
    const need = active ? Math.round(comfortNeed * Math.max(scale, 0.45)) : 0;
    const row = document.createElement('div');
    row.className = 'zone-row';
    row.innerHTML = `<div><strong>${name}</strong><span>${stateName} · Luftqualität</span></div><strong>${co2.toLocaleString('de-DE')} ppm</strong><span>${flow} m³/h</span><strong>${need} %</strong><div class="need-bar"><i style="width:${need}%"></i></div>`;
    target.appendChild(row);
  });
}

function applyOperatingState(now) {
  const stateName = getOperatingState(now);
  const config = operatingStates[stateName];
  const nightMode = now.getHours() >= 20 || now.getHours() < 7;
  document.body.classList.toggle('night-mode', nightMode);

  setText('#overviewRoomTemp', `Ø ${config.roomBase.toFixed(1).replace('.', ',')} °C`);
  setText('#overviewOccupancy', `${config.occupied} belegt`);
  setText('#overviewRoomMode', stateName);
  setText('#overviewDemand', `${config.demand.toFixed(1).replace('.', ',')} kW Bedarf`);
  setText('#overviewWpPower', `WP ${config.wp} %`);
  setText('#overviewBuffer', `Puffer ${config.buffer} %`);
  setText('#overviewAirflow', `${config.airflow} m³/h`);
  setText('#overviewCo2', `Ø ${config.avgCo2} ppm`);
  setText('#overviewWrg', `WRG ${config.wrg} %`);

  setText('#heatDemand', `${config.demand.toFixed(1).replace('.', ',')} kW`);
  setText('#bufferLoad', `${config.buffer} %`);
  setText('#heatingMode', stateName);
  setText('#wpPower', `${config.wp} %`);
  setText('#flowReturn', config.flow);
  setText('#wpRequest', config.request);
  setText('#schemeWpOutput', `${config.demand.toFixed(1).replace('.', ',')} kW`);
  setText('#schemeHeatDemand', `${config.demand.toFixed(1).replace('.', ',')} kW`);
  setText('#pumpOutput', config.pumps);
  setText('#wpStatus', `Grundlast · ${config.wp > 0 ? 'aktiv' : 'bereit'}`);

  setText('#airflowKpi', `${config.airflow} m³/h`);
  setText('#wrgKpi', `${config.wrg} %`);
  setText('#ventilationMode', stateName);
  setText('#airUnitStatus', config.airflow > 0 ? `Betrieb · ${stateName}` : `${stateName} · Aus`);
  setText('#fanPower', `${config.fan} %`);
  setText('#wrgValue', `${config.wrg} %`);
  setText('#supplyTemp', config.supply);
  setText('#airflowValues', `${config.airflowSet} / ${config.airflow} m³/h`);
  setText('#ductPressure', `${config.pressure} Pa`);
  setText('#extractTemp', config.extract);
  setText('#co2Lead', `${config.co2Lead.toLocaleString('de-DE')} ppm`);
  setText('#heatingCoil', `${config.coil} %`);
  setText('#averageCo2', `Ø ${config.avgCo2} ppm`);
  setText('#kwlStatus', config.airflow > 0 ? 'Bedarfsbetrieb' : 'ECONOMY · Aus');
  setText('#kwlFlow', config.airflow > 0 ? `${Math.round(214 * (config.airflow / 742))} m³/h` : '0 m³/h');
  setText('#kwlAirQuality', `${Math.max(550, config.avgCo2 - 20)} ppm / 48 %`);

  renderFloorPlans(stateName, config);
  renderHeatingZones(config);
  renderAirZones(stateName, config);
}

document.querySelectorAll('[data-floor]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-floor]').forEach((item) => item.classList.remove('is-selected'));
    document.querySelectorAll('.floor-view').forEach((view) => view.classList.remove('is-active'));
    button.classList.add('is-selected');
    document.querySelector(`#floor-${button.dataset.floor}`).classList.add('is-active');
  });
});

let lastStateKey = '';
function updateClock() {
  const now = new Date();
  document.querySelector('#clockTime').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  document.querySelector('#clockDate').textContent = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const stateKey = `${getOperatingState(now)}-${now.getHours() >= 20 || now.getHours() < 7}`;
  if (stateKey !== lastStateKey) {
    lastStateKey = stateKey;
    applyOperatingState(now);
  }
}

updateClock();
setInterval(updateClock, 1000);
