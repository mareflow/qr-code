import { supabase } from './config.js';

let map;
let markers = [];

async function initMap() {
    // Inicializa o mapa focado no Brasil
    map = L.map('map', {
        zoomControl: false 
    }).setView([-14.235, -51.925], 4);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Adiciona o layer do OpenStreetMap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    await loadWorkshops();
    
    // Esconde o loading
    setTimeout(() => {
        const loader = document.getElementById('loading');
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }, 500);
}

async function loadWorkshops() {
    try {
        const { data, error } = await supabase
            .from('workshops')
            .select('id, name, address, lat, lng, logo_url, whatsapp, instagram')
            .not('lat', 'is', null)
            .not('lng', 'is', null);

        if (error) throw error;

        if (data && data.length > 0) {
            const bounds = [];

            data.forEach(workshop => {
                if (workshop.lat && workshop.lng) {
                    bounds.push([workshop.lat, workshop.lng]);
                    createMarker(workshop);
                }
            });

            // Ajusta o zoom para mostrar todas as oficinas (se houver alguma)
            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
            }
        }
    } catch (err) {
        console.error('Erro ao buscar oficinas:', err);
    }
}

function createMarker(workshop) {
    const lat = workshop.lat;
    const lng = workshop.lng;
    
    const logoSrc = workshop.logo_url || 'assets/logo.png';

    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div class="marker-pin">
                <img src="${logoSrc}" class="marker-logo" onerror="this.src='assets/logo.png'">
            </div>
        `,
        iconSize: [44, 52],
        iconAnchor: [22, 52],
        popupAnchor: [0, -52]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    // Conteúdo do Popup
    const nome = workshop.name || 'Oficina Parceira';
    
    let endereco = workshop.address || '';
    try {
        const addrObj = JSON.parse(endereco);
        endereco = `${addrObj.rua}, ${addrObj.numero} - ${addrObj.bairro}, ${addrObj.cidade} - ${addrObj.uf}`;
    } catch (e) {
        // Se der erro no parse, significa que era o texto livre antigo, deixa como estava
    }
    
    let contatosHtml = '';
    if (workshop.whatsapp) {
        const waMsg = encodeURIComponent('Olá, estava no portal de parceiros do QRCode Maré Flow e gostaria de mais informações');
        contatosHtml += `<a href="https://wa.me/${workshop.whatsapp.replace(/\D/g, '')}?text=${waMsg}" target="_blank" class="text-green-600 font-bold hover:underline flex items-center gap-1 text-xs"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.125-.339-.153-.993-.368-1.895-1.18-.804-.725-1.345-1.62-1.503-1.893-.159-.272-.017-.42.119-.556.126-.126.275-.321.413-.482.138-.161.183-.275.275-.458.092-.183.046-.344-.023-.482-.069-.138-.69-1.666-.945-2.28-.247-.594-.503-.513-.69-.523-.173-.008-.372-.01-.571-.01-.199 0-.521.074-.793.366-.272.292-1.041 1.016-1.041 2.476 0 1.46 1.066 2.871 1.214 3.07.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> WhatsApp</a>`;
    }
    if (workshop.instagram) {
        contatosHtml += `<a href="https://instagram.com/${workshop.instagram.replace('@', '')}" target="_blank" class="text-pink-600 font-bold hover:underline flex items-center gap-1 text-xs"><svg class="w-3 h-3" fill="currentColor" viewBox="0 2 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> Instagram</a>`;
    }

    const popupHtml = `
        <div class="bg-blue-900 h-12 flex items-center justify-center p-2 relative">
            <h3 class="text-white font-bold text-sm truncate w-full text-center px-4" title="${nome}">${nome}</h3>
        </div>
        <div class="p-4 bg-white">
            <p class="text-xs text-gray-600 mb-3 leading-relaxed">${endereco}</p>
            <div class="flex gap-3 justify-center border-t border-gray-100 pt-3">
                ${contatosHtml}
            </div>
        </div>
    `;

    marker.bindPopup(popupHtml);
    markers.push(marker);

    marker.on('mouseover', function (e) {
        this.openPopup();
    });
}

document.addEventListener('DOMContentLoaded', initMap);
