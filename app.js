import * as L from 'leaflet';
class ItineraryApp {
    constructor() {
        this.editIndex = null;
        this.form = document.getElementById('itinerary-form');
        this.listEl = document.getElementById('itinerary-list');
        this.totalsEl = document.getElementById('totals');
        this.cancelBtn = document.getElementById('cancel-edit');
        this.submitBtn = document.getElementById('submit-btn');
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
    async onSubmit(e) {
        e.preventDefault();
        const date = document.getElementById('date').value;
        const start = document.getElementById('start').value.trim();
        const end = document.getElementById('end').value.trim();
        const hours = parseFloat(document.getElementById('hours').value);
        // Geocode addresses
        const [startCoords, endCoords] = await Promise.all([
            this.geocode(start),
            this.geocode(end)
        ]);
        const item = { date, start, end, hours, startCoords, endCoords };
        if (this.editIndex !== null) {
            this.items[this.editIndex] = item;
            this.editIndex = null;
            this.submitBtn.textContent = 'Add';
            this.cancelBtn.classList.add('hidden');
        }
        else {
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
    async geocode(address) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
            const results = await res.json();
            if (results && results.length) {
                return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
            }
        }
        catch (_a) {
            console.warn('Geocode failed for', address);
        }
    }
    editItem(index) {
        const item = this.items[index];
        document.getElementById('date').value = item.date;
        document.getElementById('start').value = item.start;
        document.getElementById('end').value = item.end;
        document.getElementById('hours').value = item.hours.toString();
        this.editIndex = index;
        this.submitBtn.textContent = 'Update';
        this.cancelBtn.classList.remove('hidden');
    }
    deleteItem(index) {
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
