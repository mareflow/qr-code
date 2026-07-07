// js/os.js
import { supabase } from './config.js'

let globalOrders = [];
let globalWorkshopsMap = {};
let globalMainWorkshop = null;
let globalIsPublicView = false;
let globalActiveFilter = null;
let globalRole = 'public'; // 'public', 'client', 'workshop'
let currentFilters = {
    compartimento: '',
    workshopName: '',
    date: ''
};

const btnLogoutOs = document.getElementById('btn-logout-os');
const loading = document.getElementById('loading');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const osSection = document.getElementById('os-section');

function showError(message) {
    loading.classList.add('hidden');
    osSection.classList.add('hidden');
    errorMessage.textContent = message;
    errorSection.classList.remove('hidden');
}

function normalizePlate(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function formatDate(value) {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function onlyNumbers(value) {
    return String(value || '').replace(/\D/g, '');
}

function getContrastColor(hexColor) {
    if (!hexColor) return '#1f2937';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#1f2937' : '#ffffff';
}

function getSecondaryContrastColor(hexColor) {
    if (!hexColor) return '#4b5563';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#4b5563' : '#d1d5db';
}

function applyFilters() {
    let filtered = globalOrders;

    if (currentFilters.compartimento) {
        filtered = filtered.filter(o => o.compartimentos && o.compartimentos.toLowerCase().includes(currentFilters.compartimento.toLowerCase()));
    }

    if (currentFilters.workshopName) {
        filtered = filtered.filter(o => {
            const ws = globalWorkshopsMap[o.workshop_id];
            return ws && ws.name && ws.name.toLowerCase().includes(currentFilters.workshopName.toLowerCase());
        });
    }

    if (currentFilters.date) {
        filtered = filtered.filter(o => o.os_date && o.os_date.split('T')[0] === currentFilters.date);
    }

    if (globalActiveFilter) {
        filtered = filtered.filter(o => o.workshop_id === globalActiveFilter);
    }

    renderHistory(filtered, globalMainWorkshop, globalWorkshopsMap, globalIsPublicView);
}

function setupFilters() {
    const inputComp = document.getElementById('filter-compartimento');
    const inputWork = document.getElementById('filter-workshop');
    const inputDate = document.getElementById('filter-date');

    const listComp = document.getElementById('lista-compartimentos');
    const listWork = document.getElementById('lista-oficinas');

    if (!inputComp) return; // Se a UI ainda não existir (segurança)

    // Reset datalists
    if (listComp) listComp.innerHTML = '';
    if (listWork) listWork.innerHTML = '';

    if (globalRole === 'client') {
        const wsContainer = document.getElementById('filter-workshop-container');
        if (wsContainer) wsContainer.classList.remove('hidden');
    }

    // Compartimentos (Todos)
    const comps = new Set();
    globalOrders.forEach(o => {
        if (o.compartimentos) {
            o.compartimentos.split(',').forEach(c => comps.add(c.trim()));
        }
    });
    const sortedComps = Array.from(comps).sort();
    sortedComps.forEach(c => {
        if (c && listComp) listComp.insertAdjacentHTML('beforeend', `<option value="${c}">`);
    });

    // Oficinas (Cliente)
    if (globalRole === 'client' && listWork) {
        const workshops = new Set();
        globalOrders.forEach(o => {
            const ws = globalWorkshopsMap[o.workshop_id];
            if (ws && ws.name) {
                workshops.add(ws.name);
            }
        });
        const sortedWorkshops = Array.from(workshops).sort();
        sortedWorkshops.forEach(name => {
            listWork.insertAdjacentHTML('beforeend', `<option value="${name}">`);
        });
    }

    const onFilterChange = () => {
        currentFilters.compartimento = inputComp.value;
        currentFilters.workshopName = inputWork ? inputWork.value : '';
        currentFilters.date = inputDate ? inputDate.value : '';
        applyFilters();
    };

    if (inputComp) inputComp.addEventListener('input', onFilterChange);
    if (inputWork) inputWork.addEventListener('input', onFilterChange);
    if (inputDate) inputDate.addEventListener('change', onFilterChange);
}

function renderHistory(orders, mainWorkshop, workshopsMap, isPublicView, currentVehicleMileage = null) {
    const latestOrder = orders[0];

    const buttonColor = mainWorkshop?.button_color || '#2563EB';
    const bgColor = '#F3F4F6';

    document.body.style.backgroundColor = bgColor;

    document.getElementById('os-date').textContent = formatDate(latestOrder.os_date);
    
    const displayMileage = currentVehicleMileage || latestOrder.mileage;
    document.getElementById('mileage').textContent = (displayMileage ? displayMileage + ' km' : '-');

    if (isPublicView) {
        document.getElementById('customer-name').textContent = '*****';
        const elPhone = document.getElementById('customer-phone');
        if (elPhone) elPhone.textContent = '*****';
        const shareBox = document.getElementById('public-share-box');
        if (shareBox) shareBox.classList.add('hidden');
        const contactBox = document.getElementById('contact-box');
        if (contactBox) contactBox.classList.add('hidden');
    } else {
        document.getElementById('customer-name').textContent = latestOrder.customer_name || '-';
        const elPhone = document.getElementById('customer-phone');
        if (elPhone) {
            elPhone.textContent = latestOrder.client_phone ? latestOrder.client_phone : '-';
        }
    }

    // Ativar edição de quilometragem apenas para o proprietário (client)
    if (globalRole === 'client') {
        const btnEditMileage = document.getElementById('btn-edit-mileage');
        if (btnEditMileage) {
            btnEditMileage.classList.remove('hidden');
            if (!btnEditMileage.dataset.bound) {
                btnEditMileage.dataset.bound = 'true';

                const displayContainer = document.getElementById('mileage-display-container');
                const editContainer = document.getElementById('mileage-edit-container');
                const inputMileage = document.getElementById('input-edit-mileage');
                const btnSaveMileage = document.getElementById('btn-save-mileage');
                const btnCancelMileage = document.getElementById('btn-cancel-mileage');
                const mileageText = document.getElementById('mileage');

                btnEditMileage.addEventListener('click', () => {
                    displayContainer.classList.add('hidden');
                    btnEditMileage.classList.add('hidden');
                    editContainer.classList.remove('hidden');
                    inputMileage.value = mileageText.textContent.replace(/\D/g, '');
                    inputMileage.focus();
                });

                btnCancelMileage.addEventListener('click', () => {
                    displayContainer.classList.remove('hidden');
                    btnEditMileage.classList.remove('hidden');
                    editContainer.classList.add('hidden');
                });

                btnSaveMileage.addEventListener('click', async () => {
                    const newKm = inputMileage.value.trim();
                    if (!newKm) return;

                    const currentKm = parseInt(mileageText.textContent.replace(/\D/g, '')) || 0;
                    if (parseInt(newKm) < currentKm) {
                        alert('A nova quilometragem não pode ser menor que a atual (' + currentKm + ' km).');
                        return;
                    }

                    const originalIcon = btnSaveMileage.innerHTML;
                    btnSaveMileage.innerHTML = '...';

                    const pKey = latestOrder.plate_key || normalizePlate(latestOrder.plate);

                    try {
                        const { error: rpcError } = await supabase.rpc('update_vehicle_mileage', { p_plate_key: pKey, p_mileage: String(newKm) });
                        
                        if (rpcError) {
                            alert('Não foi possível salvar o KM. Erro: ' + rpcError.message);
                            throw new Error('Falha no RPC: ' + rpcError.message);
                        }
                        
                        mileageText.textContent = newKm + ' km';
                    } catch(err) {
                        console.error('Erro ao salvar KM:', err);
                    }

                    displayContainer.classList.remove('hidden');
                    btnEditMileage.classList.remove('hidden');
                    editContainer.classList.add('hidden');
                    btnSaveMileage.innerHTML = originalIcon;
                });
            }
        }
    }

    document.getElementById('plate').textContent = latestOrder.plate || '-';

    const elBrand = document.getElementById('car-brand');
    if (elBrand) elBrand.textContent = latestOrder.brand || '-';

    const elModel = document.getElementById('car-model');
    if (elModel) elModel.textContent = latestOrder.vehicle || '-';

    const elEngine = document.getElementById('car-engine');
    if (elEngine) elEngine.textContent = latestOrder.engine || '-';

    if (latestOrder.os_date && !isPublicView) {
        const lastVisitDate = new Date(latestOrder.os_date);
        const currentDate = new Date();
        const diffTime = Math.abs(currentDate - lastVisitDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = diffDays / 30;

        if (diffMonths > 6) {
            const alertContainer = document.getElementById('maintenance-alert-container');
            if (alertContainer) {
                alertContainer.innerHTML = `
                    <div class="animate-pulse bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded mb-4" role="alert">
                        <p class="font-bold">Hora de uma revisão!</p>
                        <p class="text-sm">Já faz mais de 6 meses desde sua última visita. Venha fazer uma manutenção preventiva sem custo, pois cliente Maré Flow tem seu carro bem cuidado!</p>
                    </div>
                `;
            }
        }
    }

    document.getElementById('history-list').innerHTML = orders.map((order, index) => {
        const osWorkshop = workshopsMap[order.workshop_id] || { name: 'Oficina Parceira', logo_url: '' };

        const themeColor = osWorkshop.theme_color || '#3B82F6';
        const bgColor = osWorkshop.bg_color || '#0f172a';
        const buttonColor = osWorkshop.button_color || themeColor;

        const textColor = getContrastColor(bgColor);
        const textSecondaryColor = getSecondaryContrastColor(bgColor);

        const wsLogoHtml = osWorkshop.logo_url
            ? `<img src="${osWorkshop.logo_url}" class="w-11 h-11 object-contain rounded-lg bg-white p-1 shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-white/20">`
            : `<div class="w-11 h-11 border border-white/20 rounded-lg flex items-center justify-center text-lg font-bold text-white shadow-sm" style="background-color: rgba(255,255,255,0.2);">OF</div>`;

        let contactIcons = '';
        if (!isPublicView) {
            if (osWorkshop.whatsapp) {
                const whatsappNumber = onlyNumbers(osWorkshop.whatsapp);
                contactIcons += `<a href="https://wa.me/55${whatsappNumber}" target="_blank" class="text-white p-2 rounded-lg transition-all flex items-center justify-center border shadow-sm hover:brightness-110" style="background-color: #25D366; border-color: transparent;" title="Falar no WhatsApp"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.89-4.443 9.89-9.89 0-5.446-4.44-9.888-9.888-9.888-5.45 0-9.893 4.444-9.893 9.89 0 2.118.6 3.717 1.595 5.394l-1.05 3.834 3.954-1.032zm6.815-11.393c-1.397-1.397-3.664-1.397-5.061 0-1.397 1.397-1.397 3.664 0 5.061 1.397 1.397 3.664 1.397 5.061 0 1.397-1.397 1.397-3.664 0-5.061zm-1.414 3.647c-.617.617-1.616.617-2.233 0-.617-.617-.617-1.616 0-2.233.617-.617 1.616-.617 2.233 0 .617.617.617 1.616 0 2.233z"/></svg></a>`;
            }
            if (osWorkshop.instagram) {
                const instUser = osWorkshop.instagram.replace('@', '').trim();
                contactIcons += `<a href="https://www.instagram.com/${instUser}/" target="_blank" class="text-white p-2 rounded-lg transition-all flex items-center justify-center border shadow-sm hover:brightness-110" style="background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); border-color: transparent;" title="Ver Instagram"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg></a>`;
            }
            if (osWorkshop.google_review_url) {
                contactIcons += `<a href="${osWorkshop.google_review_url}" target="_blank" class="p-2 rounded-lg transition-all flex items-center justify-center border shadow-sm hover:brightness-95" style="background-color: #ffffff; border-color: transparent;" title="Avaliar no Google"><svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg></a>`;
            }
        }

        if (order.status === 'pendente') {
            return `
                <article class="rounded-xl overflow-hidden transition-all hover:shadow-[0_4px_40px_rgba(0,0,0,0.2)]" style="background-color: ${bgColor}; border: 1px solid #111827; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div class="p-3 sm:p-4 flex items-center justify-between gap-3" style="background: linear-gradient(135deg, ${themeColor}, ${themeColor}cc); color: #ffffff; border-bottom: 1px solid #111827;">
                        <div class="flex items-center gap-3">
                            ${wsLogoHtml}
                            <div data-filter-workshop="${order.workshop_id}" class="cursor-pointer" title="Filtrar por esta oficina">
                                <h3 class="text-base sm:text-lg font-extrabold tracking-tight leading-tight drop-shadow-sm text-white">${osWorkshop.name}</h3>
                                <p class="text-[10px] sm:text-xs font-bold tracking-wide text-white opacity-90 drop-shadow-sm">Em Manutenção</p>
                            </div>
                        </div>
                        ${contactIcons ? `<div class="flex items-center gap-2">${contactIcons}</div>` : ''}
                    </div>
                    <div class="p-4 transition-colors">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="bg-yellow-500/20 text-yellow-500 text-[10px] font-extrabold px-2 py-1 rounded-md border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]">Veículo na Oficina</span>
                            <strong class="text-xs" style="color: ${textColor}">${formatDate(order.os_date)}</strong>
                        </div>
                        <p class="text-xs font-medium p-3 rounded-lg border transition-colors" style="background-color: ${textColor}0A; border-color: ${textColor}1A; color: ${textSecondaryColor};">O veículo encontra-se atualmente em manutenção. O histórico detalhado estará disponível assim que concluído.</p>
                    </div>
                </article>
            `;
        }

        const pdfButton = (order.pdf_url)
            ? `<a href="${order.pdf_url}" target="_blank" class="inline-flex items-center gap-1.5 hover:brightness-110 text-xs font-bold py-2 px-3 rounded-lg transition-all border shadow-sm" style="color: ${buttonColor}; border-color: ${buttonColor}50; background-color: ${buttonColor}15;">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                PDF
               </a>`
            : '';

        let photosHtml = '';
        let photosButtonHtml = '';

        if (order.photos && order.photos.length > 0) {
            const galleryId = `gallery-${order.id || index}`;
            photosButtonHtml = `<button type="button" onclick="document.getElementById('${galleryId}').classList.toggle('hidden')" class="inline-flex items-center gap-1.5 text-xs font-bold py-2 px-3 rounded-lg border transition-all hover:brightness-95 shadow-sm" style="color: ${textColor}; border-color: ${textColor}20; background-color: ${textColor}0A;">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Fotos
            </button>`;

            const images = order.photos.map(url => `<a href="${url}" target="_blank" class="block hover:opacity-90 transition-opacity"><img src="${url}" class="w-24 h-24 object-cover rounded-xl border shadow-sm" style="border-color: ${textColor}20;"></a>`).join('');
            photosHtml = `
                <div id="${galleryId}" class="hidden mt-5 pt-5 border-t" style="border-color: ${textColor}1A;">
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-3" style="color: ${textSecondaryColor};">Fotos do Serviço</p>
                    <div class="flex flex-wrap gap-3">
                        ${images}
                    </div>
                </div>
            `;
        }

        return `
            <article class="rounded-xl overflow-hidden transition-all hover:shadow-[0_4px_40px_rgba(0,0,0,0.2)]" style="background-color: ${bgColor}; border: 1px solid #111827; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <div class="p-3 sm:p-4 flex items-center justify-between gap-3" style="background: linear-gradient(135deg, ${themeColor}, ${themeColor}cc); color: #ffffff; border-bottom: 1px solid #111827;">
                    <div class="flex items-center gap-3">
                        ${wsLogoHtml}
                        <div data-filter-workshop="${order.workshop_id}" class="cursor-pointer" title="Filtrar por esta oficina">
                            <h3 class="text-base sm:text-lg font-extrabold tracking-tight leading-tight drop-shadow-sm text-white">${osWorkshop.name}</h3>
                            <p class="text-[10px] sm:text-xs opacity-90 font-bold tracking-wide text-white drop-shadow-sm">Serviço Concluído</p>
                        </div>
                    </div>
                    ${contactIcons ? `<div class="flex items-center gap-2">${contactIcons}</div>` : ''}
                </div>
                
                <div class="p-4 transition-colors">
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                        <div class="p-2 rounded-lg border" style="background-color: ${textColor}0A; border-color: ${textColor}1A;">
                            <p class="text-[9px] uppercase font-bold tracking-wider mb-0.5" style="color: ${textSecondaryColor};">Data</p>
                            <p class="font-bold text-sm" style="color: ${textColor};">${formatDate(order.os_date)}</p>
                        </div>
                        <div class="p-2 rounded-lg border" style="background-color: ${textColor}0A; border-color: ${textColor}1A;">
                            <p class="text-[9px] uppercase font-bold tracking-wider mb-0.5" style="color: ${textSecondaryColor};">Km</p>
                            <p class="font-bold text-sm" style="color: ${textColor};">${order.mileage || '-'}</p>
                        </div>
                        ${!isPublicView ? `
                        <div class="p-2 rounded-lg border col-span-2 sm:col-span-1" style="background-color: ${textColor}0A; border-color: ${textColor}1A;">
                            <p class="text-[9px] uppercase font-bold tracking-wider mb-0.5" style="color: ${textSecondaryColor};">Valor Total</p>
                            <p class="font-bold text-base leading-none text-emerald-500 drop-shadow-sm">${formatMoney(order.total_value)}</p>
                        </div>
                        ` : ''}
                    </div>

                    ${order.lembrete_oficina ? `
                    <div class="mb-5 border-l-4 p-4 rounded-r-xl shadow-sm" style="background-color: ${themeColor}15; border-color: ${themeColor};">
                        <div class="flex items-start gap-3">
                            <svg class="w-6 h-6 flex-shrink-0 mt-0.5" style="color: ${themeColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                            <div>
                                <h4 class="text-sm font-bold mb-1" style="color: ${textColor};">Lembrete da Oficina</h4>
                                <p class="text-sm font-medium" style="color: ${textSecondaryColor};">${order.lembrete_oficina}</p>
                            </div>
                        </div>
                    </div>
                    ${(() => {
                    // Marca como visto se o dono estiver acessando (não-público) e ainda não foi visto
                    if (!isPublicView && !order.lembrete_visto) {
                        supabase.from('service_orders')
                            .update({ lembrete_visto: true })
                            .eq('id', order.id)
                            .then(() => { order.lembrete_visto = true; })
                            .catch(err => console.error('Erro ao marcar lembrete como visto:', err));
                    }
                    return '';
                })()}
                    ` : ''}

                    ${order.compartimentos ? `
                    <div class="mb-4">
                        <p class="text-[9px] uppercase font-bold tracking-wider mb-1.5" style="color: ${textSecondaryColor};">Categorias / Compartimentos</p>
                        <div class="flex flex-wrap gap-1.5">
                            ${order.compartimentos.split(',').map(tag => `<span class="text-[10px] px-2 py-0.5 rounded-md font-semibold border shadow-sm" style="color: ${themeColor}; border-color: ${themeColor}40; background-color: ${themeColor}15;">${tag.trim()}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div>
                        <p class="text-[9px] uppercase font-bold tracking-wider mb-1.5" style="color: ${textSecondaryColor};">Serviços Executados</p>
                        <p class="whitespace-pre-line p-3 rounded-lg border text-xs font-medium transition-colors" style="background-color: ${textColor}0A; border-color: ${textColor}1A; color: ${textColor};">${order.services_done || '-'}</p>
                    </div>

                    ${(pdfButton || photosButtonHtml) ? `
                    <div class="mt-4 flex gap-2 flex-wrap">
                        ${pdfButton}
                        ${photosButtonHtml}
                    </div>
                    ${pdfButton ? `<p class="text-[10px] text-amber-600 mt-1.5 font-semibold leading-tight drop-shadow-sm">* O arquivo PDF serve apenas como Ordem de Serviço, e não tem validade como Nota Fiscal.</p>` : ''}
                    ` : ''}

                    ${photosHtml}
                </div>
            </article>
        `;
    }).join('');

    loading.classList.add('hidden');
    osSection.classList.remove('hidden');
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function setupLoginUI(plateKey) {
    const loginForm = document.getElementById('client-login-form');
    const loginMessage = document.getElementById('login-message');
    const emailInput = document.getElementById('client-email-input');

    if (!loginForm || loginForm.dataset.bound === 'true') return;
    loginForm.dataset.bound = 'true';

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = normalizeEmail(emailInput.value);
        const btn = document.getElementById('btn-client-login');
        btn.textContent = 'Verificando...';
        btn.disabled = true;
        loginMessage.classList.add('hidden');

        const { data: isValid, error: verifyError } = await supabase.rpc('verify_vehicle_email', {
            p_plate_key: plateKey,
            p_email: email
        });

        if (verifyError || !isValid) {
            btn.textContent = 'Receber Link de Acesso';
            btn.disabled = false;
            loginMessage.textContent = 'Este e-mail não está cadastrado como proprietário deste veículo. Use o e-mail informado na oficina.';
            loginMessage.className = 'mt-6 text-center text-sm font-medium p-4 rounded-xl border border-red-200 bg-red-50 text-red-600';
            loginMessage.classList.remove('hidden');
            return;
        }

        btn.textContent = 'Enviando...';

        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.href
            }
        });

        btn.textContent = 'Receber Link de Acesso';
        btn.disabled = false;

        loginMessage.classList.remove('hidden');
        if (error) {
            loginMessage.textContent = 'Erro ao enviar o link: ' + error.message;
            loginMessage.className = 'mt-6 text-center text-sm font-medium p-4 rounded-xl border border-red-200 bg-red-50 text-red-600';
        } else {
            loginMessage.textContent = 'Link enviado! Verifique sua caixa de entrada e clique no link para acessar.';
            loginMessage.className = 'mt-6 text-center text-sm font-medium p-4 rounded-xl border border-green-200 bg-green-50 text-green-600';
            emailInput.value = '';
        }
    });
}

function setupPublicShare(plateKey) {
    const btnShare = document.getElementById('btn-share-public');
    if (!btnShare) return;

    btnShare.addEventListener('click', async () => {
        if (!globalOrders || globalOrders.length === 0) {
            alert('Nenhum histórico encontrado para gerar link.');
            return;
        }

        const textSpan = document.getElementById('text-share-public');
        const originalText = textSpan.textContent;
        textSpan.textContent = 'Gerando link...';
        btnShare.disabled = true;

        try {
            const { data, error } = await supabase.rpc('generate_public_share_token', {
                p_plate_key: plateKey
            });

            if (error || !data) {
                console.error('Erro ao gerar link público:', error);
                alert('Erro ao gerar o link público.');
                textSpan.textContent = originalText;
                btnShare.disabled = false;
                return;
            }

            const token = data;
            const url = new URL(window.location.href);
            url.searchParams.set('public_token', token);
            url.searchParams.delete('id');
            url.searchParams.set('placa', plateKey);

            const finalUrl = url.toString();

            // Copia em 3 camadas (browsers bloqueiam clipboard apos async)
            let copiou = false;

            // Camada 1: Clipboard API moderna
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(finalUrl);
                    copiou = true;
                }
            } catch (_) { /* tenta fallback */ }

            // Camada 2: execCommand legacy
            if (!copiou) {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = finalUrl;
                    ta.setAttribute('readonly', '');
                    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus(); ta.select();
                    copiou = document.execCommand('copy');
                    document.body.removeChild(ta);
                } catch (_) { /* tenta camada 3 */ }
            }

            // Camada 3: campo visivel para copiar manualmente
            if (!copiou) {
                const helpText = document.getElementById('public-link-help');
                if (helpText) {
                    helpText.innerHTML = '<p style="font-size:11px;font-weight:700;margin-bottom:4px;">Copie o link abaixo:</p><input type="text" readonly value="' + finalUrl + '" onclick="this.select()" style="width:100%;font-size:11px;padding:6px 8px;border:1px solid rgba(0,0,0,.2);border-radius:6px;cursor:text;"/>';
                    helpText.classList.remove('hidden');
                }
                textSpan.textContent = 'Toque no link abaixo para copiar';
                btnShare.disabled = false;
                return;
            }

            textSpan.textContent = 'Link Copiado! ✓';
            btnShare.classList.remove('bg-gray-900', 'hover:bg-black');
            btnShare.classList.add('bg-green-600', 'hover:bg-green-700');

            const helpText = document.getElementById('public-link-help');
            if (helpText) helpText.classList.remove('hidden');

            setTimeout(() => {
                textSpan.textContent = originalText;
                btnShare.disabled = false;
                btnShare.classList.add('bg-gray-900', 'hover:bg-black');
                btnShare.classList.remove('bg-green-600', 'hover:bg-green-700');
            }, 4000);

        } catch (err) {
            console.error(err);
            textSpan.textContent = 'Erro ao gerar link. Tente novamente.';
            btnShare.disabled = false;
            setTimeout(() => { textSpan.textContent = originalText; }, 3000);
        }
    });
}

async function loadOrder() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const workshopId = params.get('oficina');
    let plateKey = normalizePlate(params.get('placa'));
    const publicToken = params.get('public_token');

    let isPublicView = !!publicToken;
    let userEmail = null;
    let userId = null;
    let userVehicles = [];

    if (!isPublicView) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
            if (!id && !plateKey) {
                window.location.href = 'login-cliente.html';
                return;
            }
            window.location.href = `login-cliente.html?placa=${plateKey || ''}`;
            return;
        }
        userEmail = normalizeEmail(session.user.email);
        userId = session.user.id;

        if (btnLogoutOs) {
            btnLogoutOs.classList.remove('hidden');
        }

        const isClient = session.user.user_metadata && session.user.user_metadata.role === 'cliente';
        const btnBackPartner = document.getElementById('btn-back-partner');
        if (btnBackPartner && !isClient) {
            btnBackPartner.classList.remove('hidden');
        }

        const { data: vehicles } = await supabase
            .from('vehicles')
            .select('*')
            .eq('client_email', userEmail);

        if (vehicles && vehicles.length > 0) {
            userVehicles = vehicles;
            if (!plateKey && !id) {
                plateKey = vehicles[0].plate_key;

                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('placa', plateKey);
                window.history.replaceState({}, '', newUrl);
            }
        }
    }

    if (!id && !plateKey) {
        showError('Nenhum veículo encontrado para este e-mail nas oficinas parceiras.');
        return;
    }

    let finalWorkshopId = workshopId;
    let finalPlateKey = plateKey;

    if (id) {
        const { data: order, error } = await supabase
            .from('service_orders')
            .select('workshop_id, plate_key, plate')
            .eq('id', id)
            .maybeSingle();

        if (error || !order) {
            showError('Nao foi possivel carregar essa ordem de servico.');
            return;
        }

        finalWorkshopId = order.workshop_id;
        finalPlateKey = order.plate_key || normalizePlate(order.plate);
    }

    if (!finalPlateKey) {
        showError('Identificação da placa não encontrada.');
        return;
    }

    // Busca consolidada (Ecossistema)
    let orders = [];

    // Busca consolidada (Ecossistema)
    if (isPublicView) {
        globalRole = 'public';
        // Usa a função segura no banco para não conflitar com RLS
        const { data: publicOrders, error: publicError } = await supabase.rpc('get_public_history', {
            p_plate_key: finalPlateKey,
            p_os_id: publicToken
        });

        if (publicError || !publicOrders || publicOrders.length === 0) {
            console.error("RPC Error:", publicError);
            showError(`Link inválido. Erro interno: ${publicError ? publicError.message : 'Nenhum dado'}`);
            return;
        }
        orders = publicOrders;
    } else {
        const { data: normalOrders, error: ordersError } = await supabase
            .from('service_orders')
            .select('*')
            .eq('plate_key', finalPlateKey)
            .order('os_date', { ascending: false });

        if (ordersError || !normalOrders || normalOrders.length === 0) {
            showError('Nenhum histórico encontrado para este veículo.');
            return;
        }
        orders = normalOrders;

        // Validação de Acesso
        const { data: isValidEmail, error: verifyError } = await supabase.rpc('verify_vehicle_email', {
            p_plate_key: finalPlateKey,
            p_email: userEmail
        });

        if (verifyError) {
            console.error('Erro ao validar e-mail:', verifyError);
            showError('Não foi possível validar o acesso. Tente novamente.');
            return;
        }

        if (isValidEmail) {
            globalRole = 'client';
            // Cliente proprietário: vê histórico completo do veículo
        } else {
            const isWorkshopOwner = orders.some(o => o.workshop_id === userId);

            if (isWorkshopOwner) {
                globalRole = 'workshop';
                orders = orders.filter(o => o.workshop_id === userId);
                const shareBox = document.getElementById('public-share-box');
                if (shareBox) shareBox.classList.add('hidden');
            } else {
                showError('Acesso negado: use o e-mail cadastrado como proprietário deste veículo na oficina.');
                return;
            }
        }
    }

    // Busca informações de TODAS as oficinas envolvidas
    const workshopIds = [...new Set(orders.map(o => o.workshop_id))];
    const { data: workshopsData } = await supabase
        .from('workshops')
        .select('id, name, logo_url, whatsapp, instagram, google_review_url, theme_color, button_color, bg_color')
        .in('id', workshopIds);

    const workshopsMap = {};
    if (workshopsData) {
        workshopsData.forEach(w => workshopsMap[w.id] = w);
    }

    // A oficina principal (para tema) é a do link original, ou a da OS mais recente
    const mainWorkshop = workshopsMap[finalWorkshopId] || workshopsMap[orders[0].workshop_id];

    setupPublicShare(finalPlateKey);

    globalOrders = orders;
    globalMainWorkshop = mainWorkshop;
    globalWorkshopsMap = workshopsMap;
    globalIsPublicView = isPublicView;

    if (userVehicles.length > 1) {
        const selectorContainer = document.getElementById('vehicle-selector-container');
        const selector = document.getElementById('vehicle-selector');

        if (selectorContainer && selector) {
            selector.innerHTML = userVehicles.map(v =>
                `<option value="${v.plate_key}" ${v.plate_key === finalPlateKey ? 'selected' : ''}>
                    ${v.brand} ${v.vehicle} - ${v.plate}
                </option>`
            ).join('');

            selector.addEventListener('change', (e) => {
                window.location.href = `os.html?placa=${e.target.value}`;
            });

            selectorContainer.classList.remove('hidden');
        }
    }


    if (!isPublicView) {
        setupPushNotifications();
    }

    // Busca a quilometragem atual do veículo para o painel superior
    let currentVehicleMileage = null;
    try {
        const { data: vDataList, error: vErr } = await supabase
            .from('vehicles')
            .select('mileage')
            .eq('plate_key', finalPlateKey)
            .limit(1);

        if (vErr) {
            console.warn('Erro ao buscar KM do veiculo:', vErr);
        }

        if (vDataList && vDataList.length > 0 && vDataList[0].mileage) {
            currentVehicleMileage = vDataList[0].mileage;
        }
    } catch (e) {
        console.warn('Excecao ao buscar KM do veiculo:', e);
    }

    setupFilters();
    renderNotifications(orders, currentVehicleMileage);
    renderHistory(orders, mainWorkshop, workshopsMap, isPublicView, currentVehicleMileage);
}

// Notification Bell Logic
function renderNotifications(orders, currentVehicleMileage) {
    const wrapper = document.getElementById('notifications-wrapper');
    const btn = document.getElementById('btn-notifications');
    const dropdown = document.getElementById('notifications-dropdown');
    const badge = document.getElementById('notif-badge');
    const countDisplay = document.getElementById('notif-count');
    const list = document.getElementById('notifications-list');

    if (!wrapper || !btn || !dropdown) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currKm = parseInt(String(currentVehicleMileage || '0').replace(/\D/g, '')) || 0;

    const dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');

    // Filtra lembretes do cliente ou ambos que já venceram (Data <= Hoje OU KM Agendado <= KM Atual)
    const notifications = orders.filter(o => {
        if (dismissed.includes(String(o.id))) return false;

        const isClient = o.lembrete_tipo === 'cliente' || o.lembrete_tipo === 'ambos';
        if (!isClient) return false;

        let triggered = false;
        if (o.lembrete_data) {
            const lDate = new Date(o.lembrete_data + 'T12:00:00');
            lDate.setHours(0,0,0,0);
            if (today >= lDate) triggered = true;
        }
        
        if (o.lembrete_km) {
            if (currKm >= o.lembrete_km) triggered = true;
        }

        return triggered;
    });

    // Sempre garante que o botão do sininho apareça
    wrapper.classList.remove('hidden');

    if (notifications.length === 0) {
        badge.classList.add('hidden');
        countDisplay.textContent = '0';
        list.innerHTML = `<div class="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma notificação no momento.</div>`;
    } else {
        badge.classList.remove('hidden');
        countDisplay.textContent = notifications.length;

        list.innerHTML = notifications.map(n => {
            let dateKmDisplay = '';
            if (n.lembrete_data) {
                const dateObj = new Date(n.lembrete_data + 'T12:00:00');
                dateKmDisplay += dateObj.toLocaleDateString('pt-BR');
            }
            if (n.lembrete_km) {
                if (dateKmDisplay) dateKmDisplay += ' ou ';
                dateKmDisplay += n.lembrete_km + ' KM';
            }
            if (!dateKmDisplay) dateKmDisplay = 'Aviso';

            const workshopName = globalWorkshopsMap[n.workshop_id]?.name || 'Sua Oficina';
            let whatsappNum = '';
            if (globalWorkshopsMap[n.workshop_id] && globalWorkshopsMap[n.workshop_id].whatsapp) {
                whatsappNum = String(globalWorkshopsMap[n.workshop_id].whatsapp).replace(/\D/g, '');
            }
            
            const wpMsg = encodeURIComponent(`Olá! Estou vendo o histórico do meu veículo e vi um aviso sobre: ${n.lembrete_titulo || 'Manutenção'}`);

            return `
                <div class="notif-item p-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors last:border-0 rounded-lg">
                    <div class="flex justify-between items-start mb-1">
                        <p class="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">${dateKmDisplay}</p>
                        <span class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-semibold">${workshopName}</span>
                    </div>
                    <p class="text-sm font-bold text-slate-800 dark:text-white mb-1">${n.lembrete_titulo || 'Aviso de Manutenção'}</p>
                    ${n.lembrete_observacoes ? `<p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">${n.lembrete_observacoes}</p>` : ''}
                    <div class="flex gap-2 mt-3">
                        ${whatsappNum ? `<a href="https://wa.me/55${whatsappNum}?text=${wpMsg}" target="_blank" class="flex-1 text-center bg-green-500 hover:bg-green-600 text-white text-[11px] font-bold py-2 px-2 rounded-lg transition-colors shadow-sm">Entrar em Contato</a>` : ''}
                        <button type="button" data-dismiss-notif="${n.id}" class="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-bold py-2 px-2 rounded-lg transition-colors shadow-sm">Descartar</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Event listener para os botões de descartar
        list.onclick = (e) => {
            const btnDismiss = e.target.closest('[data-dismiss-notif]');
            if (btnDismiss) {
                const notifId = btnDismiss.dataset.dismissNotif;
                let dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');
                if (!dismissed.includes(String(notifId))) {
                    dismissed.push(String(notifId));
                    localStorage.setItem('dismissed_notifs', JSON.stringify(dismissed));
                }
                
                const notifElement = btnDismiss.closest('.notif-item');
                if (notifElement) notifElement.remove();
                
                const currentCount = parseInt(countDisplay.textContent) - 1;
                countDisplay.textContent = currentCount >= 0 ? currentCount : 0;
                
                if (currentCount <= 0) {
                    list.innerHTML = `<div class="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma notificação no momento.</div>`;
                    badge.classList.add('hidden');
                }
            }
        };
    }

    // Toggle Dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        badge.classList.add('hidden'); // Oculta bolinha ao abrir
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// Push Notification Logic
async function setupPushNotifications() {
    const btnEnablePush = document.getElementById('btn-enable-push');
    const pushContainer = document.getElementById('push-permission-container');

    if (!btnEnablePush || !pushContainer) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return;
    const clientEmail = session.user.email;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
            pushContainer.classList.add('hidden');
            return;
        }

        pushContainer.classList.remove('hidden');

        btnEnablePush.addEventListener('click', async () => {
            btnEnablePush.textContent = 'Ativando...';
            btnEnablePush.disabled = true;
            try {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') throw new Error('Permissão negada');

                // VAPID Public Key Oficial
                const publicVapidKey = 'BDv-6NDexj29668yAsr_-4mUx_5DKEe38LddlpGZ2JzJzBz5wb13BoqWpRUrg12uMKl2ZlWDw5cwQVwUMFyQgxs';
                const applicationServerKey = urlBase64ToUint8Array(publicVapidKey);

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });

                const { error } = await supabase
                    .from('push_subscriptions')
                    .insert({
                        client_email: clientEmail,
                        subscription: subscription
                    });
                if (error) throw error;

                btnEnablePush.textContent = 'Ativado! ✓';
                btnEnablePush.classList.replace('bg-purple-600', 'bg-green-600');
                setTimeout(() => pushContainer.classList.add('hidden'), 2000);
            } catch (err) {
                console.error('Erro no Push:', err);
                btnEnablePush.textContent = 'Erro ao Ativar';
                btnEnablePush.disabled = false;
                alert('Não foi possível ativar as notificações. Você pode ter bloqueado isso no navegador.');
            }
        });
    } catch (err) {
        console.error('Push error:', err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

loadOrder();

document.getElementById('history-list').addEventListener('click', (e) => {
    const wsHeader = e.target.closest('[data-filter-workshop]');
    if (wsHeader) {
        const wsId = wsHeader.dataset.filterWorkshop;
        if (globalActiveFilter === wsId) {
            globalActiveFilter = null; // Remove o filtro se clicar de novo
        } else {
            globalActiveFilter = wsId; // Aplica o filtro
        }

        const filtered = globalActiveFilter
            ? globalOrders.filter(o => o.workshop_id === globalActiveFilter)
            : globalOrders;

        renderHistory(filtered, globalMainWorkshop, globalWorkshopsMap, globalIsPublicView);
    }
});

if (btnLogoutOs) {
    btnLogoutOs.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login-cliente.html';
    });
}
