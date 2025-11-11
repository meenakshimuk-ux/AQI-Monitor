// Config
const CITIES = [
  "Delhi","Mumbai","Kolkata","Chennai","Bengaluru",
  "Hyderabad","Pune","Ahmedabad","Jaipur","Lucknow"
];
const YEARS = Array.from({length: 20}, (_, i) => 2005 + i);

// AQI calculators (PM2.5)
function computeAQI_US_PM25(c) {
  const bp = [
    {Cl: 0.0, Ch: 12.0, Il: 0, Ih: 50},
    {Cl: 12.1, Ch: 35.4, Il: 51, Ih: 100},
    {Cl: 35.5, Ch: 55.4, Il: 101, Ih: 150},
    {Cl: 55.5, Ch: 150.4, Il: 151, Ih: 200},
    {Cl: 150.5, Ch: 250.4, Il: 201, Ih: 300},
    {Cl: 250.5, Ch: 350.4, Il: 301, Ih: 400},
    {Cl: 350.5, Ch: 500.4, Il: 401, Ih: 500}
  ];
  const b = bp.find(b => c >= b.Cl && c <= b.Ch) || bp[bp.length-1];
  return Math.round(((b.Ih - b.Il) / (b.Ch - b.Cl)) * (c - b.Cl) + b.Il);
}

function computeAQI_INDIA_PM25(c) {
  // CPCB National AQI for PM2.5 categories (24-hr):
  // 0-30: Good(0-50), 31-60: Satisfactory(51-100), 61-90: Moderate(101-200),
  // 91-120: Poor(201-300), 121-250: Very Poor(301-400), 251-350+: Severe(401-500)
  const bp = [
    {Cl: 0, Ch: 30, Il: 0, Ih: 50},
    {Cl: 31, Ch: 60, Il: 51, Ih: 100},
    {Cl: 61, Ch: 90, Il: 101, Ih: 200},
    {Cl: 91, Ch: 120, Il: 201, Ih: 300},
    {Cl: 121, Ch: 250, Il: 301, Ih: 400},
    {Cl: 251, Ch: 350, Il: 401, Ih: 500},
  ];
  const b = bp.find(b => c >= b.Cl && c <= b.Ch) || bp[bp.length-1];
  const capped = Math.min(Math.max(c, b.Cl), b.Ch);
  return Math.round(((b.Ih - b.Il) / (b.Ch - b.Cl)) * (capped - b.Cl) + b.Il);
}

function computeAQI(c, standard) {
  return standard === 'us' ? computeAQI_US_PM25(c) : computeAQI_INDIA_PM25(c);
}

// Data store
let DATA = [];

async function loadData() {
  try {
    const res = await fetch('./data/aqi.json');
    if (!res.ok) throw new Error('no aqi.json');
    DATA = await res.json();
  } catch (e) {
    const res = await fetch('./data/sample.json');
    DATA = await res.json();
  }
}

function getAQIByYear(year, cities, standard) {
  // Expect records: {city, year, pm25}
  const rows = DATA.filter(d => d.year === year && cities.includes(d.city));
  return rows.map(r => ({ city: r.city, aqi: computeAQI(r.pm25, standard), pm25: r.pm25 }));
}

function getTrajectories(cities, standard) {
  return cities.map(city => {
    const series = YEARS.map(y => {
      const r = DATA.find(d => d.city === city && d.year === y);
      return r ? computeAQI(r.pm25, standard) : null;
    });
    return { city, series };
  });
}

function initControls() {
  const yearSel = document.getElementById('yearSelect');
  YEARS.forEach(y => {
    const o = document.createElement('option');
    o.value = y; o.textContent = y; yearSel.appendChild(o);
  });
  yearSel.value = YEARS[YEARS.length-1];

  const citySel = document.getElementById('citySelect');
  CITIES.forEach(c => {
    const o = document.createElement('option');
    o.value = o.textContent = c; citySel.appendChild(o);
  });
  // default select all
  for (let i=0;i<citySel.options.length;i++) { citySel.options[i].selected = true; }
}

function getSelectedCities() {
  const citySel = document.getElementById('citySelect');
  return Array.from(citySel.selectedOptions).map(o => o.value);
}

function getSelectedYears() {
  const sel = document.getElementById('yearsSelect');
  return Array.from(sel?.selectedOptions || []).map(o => parseInt(o.value, 10));
}

function renderYearly() {
  const year = parseInt(document.getElementById('yearSelect').value, 10);
  const standard = document.getElementById('standardSelect').value;
  const cities = getSelectedCities();
  const rows = getAQIByYear(year, cities, standard).sort((a,b)=>a.city.localeCompare(b.city));

  const trace = {
    x: rows.map(r=>r.city),
    y: rows.map(r=>r.aqi),
    text: rows.map(r=>`PM2.5: ${r.pm25}`),
    type: 'bar',
    marker: {color: '#0ea5e9'}
  };

  const layout = {
    yaxis: {title: 'AQI', rangemode: 'tozero'},
    margin: {t: 10, r: 10, b: 60, l: 50}
  };

  document.getElementById('chartTitle').textContent = `Yearly Snapshot • ${year} • ${standard==='us'?'US EPA':'India National'} AQI (PM2.5)`;
  Plotly.react('plot', [trace], layout, {responsive: true, displayModeBar: true});
}

function renderTrajectory() {
  const standard = document.getElementById('standardSelect').value;
  const cities = getSelectedCities();
  const series = getTrajectories(cities, standard);

  const traces = series.map(s => ({
    x: YEARS,
    y: s.series,
    mode: 'lines+markers',
    name: s.city
  }));

  const layout = {
    xaxis: {title: 'Year', dtick: 1},
    yaxis: {title: 'AQI'},
    margin: {t: 10, r: 10, b: 50, l: 50}
  };

  document.getElementById('chartTitle').textContent = `20-Year Trajectory • ${standard==='us'?'US EPA':'India National'} AQI (PM2.5)`;
  Plotly.react('plot', traces, layout, {responsive: true, displayModeBar: true});
}

function renderCompareYears() {
  const standard = document.getElementById('standardSelect').value;
  const city = document.getElementById('citySingleSelect').value;
  const years = getSelectedYears().length ? getSelectedYears() : [YEARS[YEARS.length-1]];
  const rows = years.map(y => {
    const r = DATA.find(d => d.city === city && d.year === y);
    return { year: y, aqi: r ? computeAQI(r.pm25, standard) : null, pm25: r?.pm25 ?? null };
  }).sort((a,b)=>a.year-b.year);

  const trace = {
    x: rows.map(r=>r.year),
    y: rows.map(r=>r.aqi),
    text: rows.map(r=> r.pm25==null ? 'No data' : `PM2.5: ${r.pm25}`),
    type: 'bar',
    marker: {color: '#22c55e'},
    name: city
  };

  const layout = {
    xaxis: {title: 'Year', dtick: 1},
    yaxis: {title: 'AQI', rangemode: 'tozero'},
    margin: {t: 10, r: 10, b: 60, l: 50}
  };

  document.getElementById('chartTitle').textContent = `Compare Years • ${city} • ${standard==='us'?'US EPA':'India National'} AQI (PM2.5)`;
  Plotly.react('plot', [trace], layout, {responsive: true, displayModeBar: true});
}

function render() {
  const view = document.getElementById('viewSelect').value;
  if (view === 'yearly') renderYearly();
  else if (view === 'trajectory') renderTrajectory();
  else renderCompareYears();
}

function updateControlVisibility() {
  const view = document.getElementById('viewSelect').value;
  const yearCtrl = document.getElementById('yearControl');
  const citiesCtrl = document.getElementById('citiesControl');
  const compareCtrl = document.getElementById('compareYearsControl');

  if (view === 'yearly') {
    yearCtrl.classList.remove('hidden');
    citiesCtrl.classList.remove('hidden');
    compareCtrl.classList.add('hidden');
  } else if (view === 'trajectory') {
    yearCtrl.classList.add('hidden');
    citiesCtrl.classList.remove('hidden');
    compareCtrl.classList.add('hidden');
  } else {
    yearCtrl.classList.add('hidden');
    citiesCtrl.classList.add('hidden');
    compareCtrl.classList.remove('hidden');
  }
}

function bindEvents() {
  ['yearSelect','citySelect','standardSelect','viewSelect','citySingleSelect','yearsSelect'].forEach(id => {
    document.getElementById(id).addEventListener('change', render);
  });
  document.getElementById('viewSelect').addEventListener('change', updateControlVisibility);
  document.getElementById('exportBtn').addEventListener('click', async () => {
    Plotly.downloadImage('plot', {format: 'png', filename: 'aqi-chart'});
  });
}

(async function init() {
  await loadData();
  initControls();
  const citySingle = document.getElementById('citySingleSelect');
  CITIES.forEach(c => { const o = document.createElement('option'); o.value = o.textContent = c; citySingle.appendChild(o); });
  citySingle.value = 'Delhi';
  const yearsSel = document.getElementById('yearsSelect');
  YEARS.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearsSel.appendChild(o); });
  for (let i=yearsSel.options.length-1, cnt=0; i>=0 && cnt<5; i--, cnt++) { yearsSel.options[i].selected = true; }
  bindEvents();
  updateControlVisibility();
  render();
})();
