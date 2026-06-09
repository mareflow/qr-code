// js/os.js
import { supabase } from './config.js'

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

function renderHistory(orders, workshop) {
    const latestOrder = orders[0];

    document.getElementById('workshop-name').textContent = workshop?.name || 'MareFlow';
    document.getElementById('customer-name').textContent = latestOrder.customer_name || '-';
    document.getElementById('plate').textContent = latestOrder.plate || '-';
    document.getElementById('os-date').textContent = formatDate(latestOrder.os_date);
    document.getElementById('mileage').textContent = latestOrder.mileage || '-';

    document.getElementById('history-list').innerHTML = orders.map((order) => {
        const pdfButton = order.pdf_url
            ? `<a href="${order.pdf_url}" target="_blank" class="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-3 rounded">Abrir PDF</a>`
            : '';

        return `
            <article class="bg-gray-50 rounded p-4">
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                        <p class="font-bold text-gray-900">${formatDate(order.os_date)} - ${formatMoney(order.total_value)}</p>
                        <p class="text-sm text-gray-500">Km: ${order.mileage || '-'}</p>
                    </div>
                    ${pdfButton}
                </div>
                <p class="text-gray-800 whitespace-pre-line mt-3">${order.services_done || '-'}</p>
            </article>
        `;
    }).join('');

    if (workshop?.logo_url) {
        const logo = document.getElementById('workshop-logo');
        logo.innerHTML = `<img src="${workshop.logo_url}" alt="Logo da oficina" class="w-full h-full object-cover">`;
        logo.classList.remove('hidden');
    }

    const whatsapp = onlyNumbers(workshop?.whatsapp);
    if (whatsapp) {
        const whatsappBox = document.getElementById('whatsapp-box');
        const whatsappLink = document.getElementById('whatsapp-link');
        whatsappLink.href = `https://wa.me/55${whatsapp}`;
        whatsappBox.classList.remove('hidden');
    }

    loading.classList.add('hidden');
    osSection.classList.remove('hidden');
}

async function loadOrder() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const workshopId = params.get('oficina');
    const plateKey = normalizePlate(params.get('placa'));

    if (!id && (!workshopId || !plateKey)) {
        showError('Link sem identificacao da placa.');
        return;
    }

    let finalWorkshopId = workshopId;
    let finalPlateKey = plateKey;

    if (id) {
        const { data: order, error } = await supabase
            .from('service_orders')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error || !order) {
            console.error('Erro ao carregar OS:', error);
            showError('Nao foi possivel carregar essa ordem de servico.');
            return;
        }

        finalWorkshopId = order.workshop_id;
        finalPlateKey = order.plate_key || normalizePlate(order.plate);
    }

    const [{ data: orders, error: ordersError }, { data: workshop, error: workshopError }] = await Promise.all([
        supabase
            .from('service_orders')
            .select('*')
            .eq('workshop_id', finalWorkshopId)
            .eq('plate_key', finalPlateKey)
            .order('os_date', { ascending: false }),
        supabase
            .from('workshops')
            .select('name, whatsapp, logo_url')
            .eq('id', finalWorkshopId)
            .maybeSingle()
    ]);

    if (ordersError || !orders?.length) {
        console.error('Erro ao carregar historico:', ordersError);
        showError('Nao foi possivel carregar o historico desse veiculo.');
        return;
    }

    if (workshopError) {
        console.warn('Erro ao carregar oficina:', workshopError);
    }

    renderHistory(orders, workshop);
}

loadOrder();
