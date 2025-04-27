// Rely on global `L` from <script src="leaflet.js">
declare const L: any;

type Coords = [number, number];
interface ItineraryItem { date: string; start: string; end: string; hours: number; startCoords?: Coords; endCoords?: Coords; }
interface MealItem     { date: string; desc: string; }
interface PoiItem      { name: string; location: string; notes?: string; }
interface HotelItem    { checkin: string; checkout: string; name: string; address: string; phone?: string; price?: number; conf?: string; }

class RoadtripApp {
  private itinerary: ItineraryItem[] = [];
  private meals: MealItem[]         = [];
  private pois: PoiItem[]           = [];
  private hotels: HotelItem[]       = [];
  private history: string[]         = [];
  private map: any;
  private markers: any;
  private polyline: any;

  constructor() {
    this.loadState();
    this.initNav();
    this.initUndo();
    this.initItinerary();
    this.initMeals();
    this.initPoi();
    this.initHotels();
    this.initMap();
    this.renderAll();
  }

  private loadState() {
    this.itinerary = JSON.parse(localStorage.getItem('itinerary') || '[]');
    this.meals     = JSON.parse(localStorage.getItem('meals')     || '[]');
    this.pois      = JSON.parse(localStorage.getItem('pois')      || '[]');
    this.hotels    = JSON.parse(localStorage.getItem('hotels')    || '[]');
    this.history   = JSON.parse(localStorage.getItem('history')   || '[]');
  }

  private saveState() {
    localStorage.setItem('itinerary', JSON.stringify(this.itinerary));
    localStorage.setItem('meals',     JSON.stringify(this.meals));
    localStorage.setItem('pois',      JSON.stringify(this.pois));
    localStorage.setItem('hotels',    JSON.stringify(this.hotels));
    localStorage.setItem('history',   JSON.stringify(this.history));
  }

  private pushHistory() {
    const snap = JSON.stringify({itinerary:this.itinerary, meals:this.meals, pois:this.pois, hotels:this.hotels});
    this.history.push(snap);
    this.saveState();
    this.updateUndoButton();
  }

  private undo() {
    if (this.history.length < 2) return;
    this.history.pop();
    const prev = this.history.pop();
    if (!prev) return;
    const state = JSON.parse(prev);
    this.itinerary = state.itinerary;
    this.meals     = state.meals;
    this.pois      = state.pois;
    this.hotels    = state.hotels;
    this.saveState();
    this.renderAll();
  }

  private initUndo() {
    const btn = document.getElementById('undo-btn') as HTMLButtonElement;
    btn.addEventListener('click', () => this.undo());
    this.updateUndoButton();
  }

  private updateUndoButton() {
    (document.getElementById('undo-btn') as HTMLButtonElement).disabled = this.history.length < 2;
  }

  private initNav() {
    document.querySelectorAll('#nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const page = btn.getAttribute('data-page');
        document.querySelectorAll('section.page').forEach(sec => {
          sec.classList.toggle('active', sec.id === `page-${page}`);
        });
      });
    });
  }

  private async geocode(addr: string): Promise<Coords> {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`);
    const data = await res.json();
    return data.length ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : [0,0];
  }

  private initMap() {
    this.map = L.map('map').setView([39.5, -98.35], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(this.map);
    this.markers = L.layerGroup().addTo(this.map);
  }

  private initItinerary() {
    const form = document.getElementById('itinerary-form') as HTMLFormElement;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      this.pushHistory();
      const date = (document.getElementById('date') as HTMLInputElement).value;
      const start = (document.getElementById('start') as HTMLInputElement).value;
      const end = (document.getElementById('end') as HTMLInputElement).value;
      const hours = parseFloat((document.getElementById('hours') as HTMLInputElement).value);
      const [sc, ec] = await Promise.all([this.geocode(start), this.geocode(end)]);
      this.itinerary.push({ date, start, end, hours, startCoords: sc, endCoords: ec });
      form.reset();
      this.saveState();
      this.renderItinerary();
      this.updateTotals();
    });
  }

  private renderItinerary() {
    const ul = document.getElementById('itinerary-list')!; ul.innerHTML = '';
    this.markers.clearLayers();
    const coords: Coords[] = [];
    this.itinerary.forEach((item, i) => {
      const li = document.createElement('li');
      li.textContent = `${item.date}: ${item.start} → ${item.end} (${item.hours}h)`;
      const del = document.createElement('button'); del.textContent = 'Delete';
      del.addEventListener('click', () => { this.pushHistory(); this.itinerary.splice(i, 1); this.saveState(); this.renderItinerary(); this.updateTotals(); });
      li.appendChild(del);
      ul.appendChild(li);
      if (item.startCoords) { coords.push(item.startCoords); L.marker(item.startCoords).addTo(this.markers); }
      if (item.endCoords)   { coords.push(item.endCoords);   L.marker(item.endCoords).addTo(this.markers); }
    });
    if (this.polyline) this.map.removeLayer(this.polyline);
    if (coords.length) {
      this.polyline = L.polyline(coords).addTo(this.markers);
      this.map.fitBounds(L.latLngBounds(coords));
    }
  }

  private updateTotals() {
    const total = this.itinerary.reduce((sum, it) => sum + it.hours, 0);
    (document.getElementById('totals')!).textContent = `Total Hours: ${total.toFixed(1)}h`;
  }

  private initMeals() {
    const form = document.getElementById('meals-form') as HTMLFormElement;
    form.addEventListener('submit', e => {
      e.preventDefault();
      this.pushHistory();
      const date = (document.getElementById('meal-date') as HTMLInputElement).value;
      const desc = (document.getElementById('meal-desc') as HTMLInputElement).value;
      this.meals.push({ date, desc });
      form.reset();
      this.saveState();
      this.renderMeals();
    });
  }

  private renderMeals() {
    const ul = document.getElementById('meals-list')!; ul.innerHTML = '';
    this.meals.forEach((m, i) => {
      const li = document.createElement('li');
      li.textContent = `${m.date}: ${m.desc}`;
      const del = document.createElement('button'); del.textContent = 'Delete';
      del.addEventListener('click', () => { this.pushHistory(); this.meals.splice(i, 1); this.saveState(); this.renderMeals(); });
      li.appendChild(del); ul.appendChild(li);
    });
  }

  private initPoi() {
    const form = document.getElementById('poi-form') as HTMLFormElement;
    form.addEventListener('submit', e => {
      e.preventDefault();
      this.pushHistory();
      const name = (document.getElementById('poi-name') as HTMLInputElement).value;
      const location = (document.getElementById('poi-location') as HTMLInputElement).value;
      const notes = (document.getElementById('poi-notes') as HTMLInputElement).value;
      this.pois.push({ name, location, notes });
      form.reset();
      this.saveState();
      this.renderPoi();
    });
  }

  private renderPoi() {
    const ul = document.getElementById('poi-list')!; ul.innerHTML = '';
    this.pois.forEach((p, i) => {
      const li = document.createElement('li');
      li.textContent = `${p.name}: ${p.location} ${p.notes || ''}`;
      const del = document.createElement('button'); del.textContent = 'Delete';
      del.addEventListener('click', () => { this.pushHistory(); this.pois.splice(i, 1); this.saveState(); this.renderPoi(); });
      li.appendChild(del); ul.appendChild(li);
    });
  }

  private initHotels() {
    const form = document.getElementById('hotels-form') as HTMLFormElement;
    form.addEventListener('submit', e => {
      e.preventDefault();
      this.pushHistory();
      const checkin = (document.getElementById('hotel-checkin') as HTMLInputElement).value;
      const checkout = (document.getElementById('hotel-checkout') as HTMLInputElement).value;
      const name = (document.getElementById('hotel-name') as HTMLInputElement).value;
      const address = (document.getElementById('hotel-address') as HTMLInputElement).value;
      const phone = (document.getElementById('hotel-phone') as HTMLInputElement).value;
      const price = parseFloat((document.getElementById('hotel-price') as HTMLInputElement).value) || undefined;
      const conf = (document.getElementById('hotel-conf') as HTMLInputElement).value;
      this.hotels.push({ checkin, checkout, name, address, phone, price, conf });
      form.reset();
      this.saveState();
      this.renderHotels();
    });
  }

  private renderHotels() {
    const ul = document.getElementById('hotels-list')!; ul.innerHTML = '';
    this.hotels.forEach((h, i) => {
      const li = document.createElement('li');
      li.textContent = `${h.checkin} → ${h.checkout}: ${h.name}, ${h.address}, ${h.phone || ''}, $${h.price || ''}, Conf: ${h.conf || ''}`;
      const del = document.createElement('button'); del.textContent = 'Delete';
      del.addEventListener('click', () => { this.pushHistory(); this.hotels.splice(i, 1); this.saveState(); this.renderHotels(); });
      li.appendChild(del); ul.appendChild(li);
    });
  }

  private renderAll() {
    this.renderItinerary();
    this.renderMeals();
    this.renderPoi();
    this.renderHotels();
    this.updateTotals();
  }
}

window.addEventListener('DOMContentLoaded', () => new RoadtripApp());
