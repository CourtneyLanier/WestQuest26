import * as L from 'leaflet';

interface ItineraryItem {
  date: string;
  start: string;
  end: string;
  hours: number;
  startCoords?: [number, number];
  endCoords?: [number, number];
}

class ItineraryApp {
  private form: HTMLFormElement;
  private listEl: HTMLUListElement;
  private totalsEl: HTMLDivElement;
  private cancelBtn: HTMLButtonElement;
  private submitBtn: HTMLButtonElement;
  private items: ItineraryItem[];
  private editIndex: number | null = null;
  private map: L.Map;
  private markers: L.LayerGroup;

  constructor() {
    this.form = document.getElementById('itinerary-form') as HTMLFormElement;
    this.listEl = document.getElementById('itinerary-list') as HTMLUListElement;
    this.totalsEl = document.getElementById('totals') as HTMLDivElement;
    this.cancelBtn = document.getElementById('cancel-edit') as HTMLButtonElement;
    this.submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;

    this.items = JSON.parse(localStorage.getItem('itinerary') || '[]');

    this.form.addEventListener('submit', this.onSubmit.bind(this));
    this.cancelBtn.addEventListener('click', this.onCancel.bind(this));

    // Initialize map
    this.map = L.map('map').setView([39.5, -98.35], 4); // center on US
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
    this.markers = L.layerGroup().addTo(this.map);

    this.render();
  }

  async onSubmit(e: Event) {
    e.preventDefault();
    const date = (document.getElementById('date') as HTMLInputElement).value;
    const start = (document.getElementById('start') as HTMLInputElement).value.trim();
    const end = (document.getElementById('end') as HTMLInputElement).value.trim();
    const hours = parseFloat((document.getElementById('hours') as HTMLInputElement).value);

    // Geocode addresses
    const [startCoords, endCoords] = await Promise.all([
      this.geocode(start),
      this.geocode(end)
    ]);

    const item: ItineraryItem = { date, start, end, hours, startCoords, endCoords };

    if (this.editIndex !== null) {
      this.items[this.editIndex] = item;
      this.editIndex = null;
      this.submitBtn.textContent = 'Add';
      this.cancelBtn.classList.add('hidden');
    } else {
      this.items.push(item);
    }

    this.save();
    this.render();
    this.form.reset();
  }

  onCancel() {
    this.editIndex = null;
    this.submitBtn.textContent = 'Add';
    this.cancelBtn.classList.add('hidden');
    this.form.reset();
  }

  async geocode(address: string): Promise<[number, number] | undefined> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const results = await res.json();
      if (results && results.length) {
        return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
      }
    } catch {
      console.warn('Geocode failed for', address);
    }
  }

  editItem(index: number) {
    const item = this.items[index];
    (document.getElementById('date') as HTMLInputElement).value = item.date;
    (document.getElementById('start') as HTMLInputElement).value = item.start;
    (document.getElementById('end') as HTMLInputElement).value = item.end;
    (document.getElementById('hours') as HTMLInputElement).value = item.hours.toString();
    this.editIndex = index;
    this.submitBtn.textContent = 'Update';
    this.cancelBtn.classList.remove('hidden');
  }

  deleteItem(index: number) {
    this.items.splice(index, 1);
    this.save();
    this.render();
  }

  save() {
    localStorage.setItem('itinerary', JSON.stringify(this.items));
  }

  render() {
    this.listEl.innerHTML = '';
    this.markers.clearLayers();

    this.items.forEach((item, i) => {
      // List entry
      const li = document.createElement('li');
      const info = document.createElement('div');
      info.className = 'info';
      info.textContent = `${item.date}: ${item.start} → ${item.end} (${item.hours}h)`;

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.editItem(i));

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => this.deleteItem(i));

      li.append(info, editBtn, delBtn);
      this.listEl.appendChild(li);

      // Map markers
      if (item.startCoords) {
        L.marker(item.startCoords).bindPopup(`Start: ${item.start}`).addTo(this.markers);
      }
      if (item.endCoords) {
        L.marker(item.endCoords).bindPopup(`End: ${item.end}`).addTo(this.markers);
      }
    });

    // Update totals
    const total = this.items.reduce((sum, it) => sum + it.hours, 0);
    this.totalsEl.textContent = `Total Hours: ${total.toFixed(1)}h`;
  }
}

window.addEventListener('DOMContentLoaded', () => new ItineraryApp());

// Build steps:
// 1. `npm install leaflet @types/leaflet`
// 2. `tsc app.ts --outFile app.js`
// 3. Serve via local server (e.g. `npx serve`) or open in browser.
