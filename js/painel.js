// js/painel.js
import { supabase } from './config.js'

let currentUser = null;
let currentLogoUrl = null;
let serviceOrders = [];
let currentQrCanvas = null;
let currentQrFileName = 'qr-code.png';

const listaOs = document.getElementById('lista-os');
const buscaOs = document.getElementById('busca-os');
const osForm = document.getElementById('os-form');
const btnSubmit = document.getElementById('btn-submit');
const resultSection = document.getElementById('result-section');
const qrcodeContainer = document.getElementById('qrcode-container');
const publicLink = document.getElementById('public-link');
const btnBaixarQr = document.getElementById('btn-baixar-qr');
const btnImprimirQr = document.getElementById('btn-imprimir-qr');

async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            await supabase.auth.signOut();
            window.location.replace('index.html');
            return;
        }

        currentUser = session.user;
        await checkWorkshopProfile(currentUser.id);
    } catch (err) {
        console.error('Erro na autenticacao:', err);
    }
}

async function checkWorkshopProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('workshops')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            await supabase.from('workshops').insert({
                id: userId,
                name: 'Minha Oficina',
                whatsapp: '00000000000'
            });
        } else if (data.logo_url) {
            currentLogoUrl = data.logo_url;
            document.getElementById('logo-preview').innerHTML = `<img src="${currentLogoUrl}" alt="Logo da oficina" class="w-full h-full object-cover">`;
        }

        await loadServiceOrders();
    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
    }
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

function getClientUrlByPlate(plateKey) {
    const baseUrl = window.location.origin + window.location.pathname.replace('painel.html', '');
    const params = new URLSearchParams({
        oficina: currentUser.id,
        placa: plateKey
    });
    return `${baseUrl}os.html?${params.toString()}`;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

async function renderQrCodeWithLogo(url, plateKey) {
    qrcodeContainer.innerHTML = '';
    currentQrCanvas = null;
    currentQrFileName = `qr-${plateKey || 'veiculo'}.png`;

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);

    new QRCode(tempContainer, {
        text: url,
        width: 900,
        height: 900,
        colorDark: '#1E3A8A',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const qrSource = tempContainer.querySelector('canvas, img');
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 900;
    finalCanvas.height = 900;
    finalCanvas.className = 'w-[250px] h-[250px]';

    const ctx = finalCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    ctx.drawImage(qrSource, 0, 0, finalCanvas.width, finalCanvas.height);

    if (currentLogoUrl) {
        try {
            const logo = await loadImage(currentLogoUrl);
            const boxSize = 220;
            const padding = 24;
            const x = (finalCanvas.width - boxSize) / 2;
            const y = (finalCanvas.height - boxSize) / 2;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, boxSize, boxSize);

            const logoSize = boxSize - padding * 2;
            const ratio = Math.min(logoSize / logo.width, logoSize / logo.height);
            const drawWidth = logo.width * ratio;
            const drawHeight = logo.height * ratio;
            const drawX = (finalCanvas.width - drawWidth) / 2;
            const drawY = (finalCanvas.height - drawHeight) / 2;

            ctx.drawImage(logo, drawX, drawY, drawWidth, drawHeight);
        } catch (error) {
            console.warn('Nao foi possivel inserir a logo no QR Code:', error);
        }
    }

    tempContainer.remove();
    currentQrCanvas = finalCanvas;
    qrcodeContainer.appendChild(finalCanvas);
}

function downloadCurrentQrCode() {
    if (!currentQrCanvas) return alert('Gere um QR Code primeiro.');

    try {
        const link = document.createElement('a');
        link.download = currentQrFileName;
        link.href = currentQrCanvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Erro ao baixar QR Code:', error);
        alert('Nao foi possivel baixar o QR Code com a logo. Verifique se o bucket de logos esta publico e com CORS liberado.');
    }
}

function printCurrentQrCode() {
    if (!currentQrCanvas) return alert('Gere um QR Code primeiro.');

    let imageUrl = null;
    try {
        imageUrl = currentQrCanvas.toDataURL('image/png');
    } catch (error) {
        console.error('Erro ao imprimir QR Code:', error);
        alert('Nao foi possivel imprimir o QR Code com a logo. Verifique se o bucket de logos esta publico e com CORS liberado.');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <title>Imprimir QR Code</title>
            <style>
                body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; }
                img { width: 72mm; height: 72mm; }
            </style>
        </head>
        <body>
            <img src="${imageUrl}" alt="QR Code">
            <script>window.onload = () => { window.print(); };</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function renderServiceOrders(filter = '') {
    const term = filter.trim().toLowerCase();
    const filteredOrders = serviceOrders.filter((order) => {
        return !term ||
            String(order.plate || '').toLowerCase().includes(term) ||
            String(order.customer_name || '').toLowerCase().includes(term);
    });

    if (!filteredOrders.length) {
        listaOs.innerHTML = '<p class="text-sm text-gray-500 py-4">Nenhuma OS encontrada.</p>';
        return;
    }

    listaOs.innerHTML = filteredOrders.map((order) => {
        const plateKey = order.plate_key || normalizePlate(order.plate);
        const clientUrl = getClientUrlByPlate(plateKey);
        const pdfButton = order.pdf_url
            ? `<a href="${order.pdf_url}" target="_blank" class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded">PDF</a>`
            : '';

        return `
            <article class="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <div class="flex flex-wrap items-center gap-2">
                        <strong class="text-gray-900">${order.plate || 'Sem placa'}</strong>
                        <span class="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">${formatDate(order.os_date)}</span>
                    </div>
                    <p class="text-sm text-gray-700">${order.customer_name || 'Cliente nao informado'}</p>
                    <p class="text-xs text-gray-500">${formatMoney(order.total_value)}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${pdfButton}
                    <a href="${clientUrl}" target="_blank" class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded">Ver historico</a>
                    <button type="button" data-delete-os="${order.id}" class="text-sm bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded">Excluir</button>
                </div>
            </article>
        `;
    }).join('');
}

async function deleteServiceOrder(orderId) {
    const order = serviceOrders.find((item) => String(item.id) === String(orderId));
    const label = order ? `${order.plate || 'sem placa'} - ${formatDate(order.os_date)}` : 'esta OS';
    const confirmed = window.confirm(`Excluir ${label}? Esta acao remove a OS do historico do veiculo.`);

    if (!confirmed) return;

    const { error } = await supabase
        .from('service_orders')
        .delete()
        .eq('id', orderId)
        .eq('workshop_id', currentUser.id);

    if (error) {
        console.error('Erro ao excluir OS:', error);
        alert('Erro ao excluir OS: ' + error.message);
        return;
    }

    await loadServiceOrders();
}

async function loadServiceOrders() {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('workshop_id', currentUser.id)
        .order('os_date', { ascending: false });

    if (error) {
        console.error('Erro ao carregar OS:', error);
        listaOs.innerHTML = '<p class="text-sm text-red-600 py-4">Erro ao carregar ordens de servico.</p>';
        return;
    }

    serviceOrders = data || [];
    renderServiceOrders(buscaOs.value);
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('index.html');
});

document.getElementById('btn-salvar-logo').addEventListener('click', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('logo-file');
    const file = fileInput.files[0];
    const btn = document.getElementById('btn-salvar-logo');

    if (!file) return alert('Selecione uma imagem primeiro.');

    btn.textContent = 'Salvando...';
    btn.disabled = true;

    try {
        const nomeLimpo = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${currentUser.id}_${Date.now()}_${nomeLimpo}`;

        const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file);
        if (uploadError) throw new Error(uploadError.message);

        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
        currentLogoUrl = publicUrlData.publicUrl;

        await supabase.from('workshops').update({ logo_url: currentLogoUrl }).eq('id', currentUser.id);

        document.getElementById('logo-preview').innerHTML = `<img src="${currentLogoUrl}" alt="Logo da oficina" class="w-full h-full object-cover">`;
        alert('Logo salva com sucesso!');
    } catch (error) {
        alert('Erro ao salvar logo: ' + error.message);
    } finally {
        btn.textContent = 'Salvar Logo';
        btn.disabled = false;
    }
});

buscaOs.addEventListener('input', () => renderServiceOrders(buscaOs.value));
listaOs.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-os]');
    if (!deleteButton) return;

    deleteServiceOrder(deleteButton.dataset.deleteOs);
});
btnBaixarQr.addEventListener('click', downloadCurrentQrCode);
btnImprimirQr.addEventListener('click', printCurrentQrCode);

osForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = 'Enviando PDF e salvando...';
    btnSubmit.disabled = true;

    try {
        const file = document.getElementById('pdf-file').files[0];
        let pdfUrl = null;

        if (file) {
            const nomeLimpo = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `${Date.now()}_${nomeLimpo}`;

            const { error: uploadError } = await supabase.storage.from('os_files').upload(fileName, file);
            if (uploadError) throw new Error('Erro no upload do PDF: ' + uploadError.message);

            const { data: publicUrlData } = supabase.storage.from('os_files').getPublicUrl(fileName);
            pdfUrl = publicUrlData.publicUrl;
        }

        const plate = document.getElementById('placa').value.trim().toUpperCase();
        const plateKey = normalizePlate(plate);

        const { error: dbError } = await supabase
            .from('service_orders')
            .insert({
                workshop_id: currentUser.id,
                plate,
                plate_key: plateKey,
                customer_name: document.getElementById('cliente').value.trim(),
                mileage: document.getElementById('km').value.trim(),
                services_done: document.getElementById('servicos').value.trim(),
                total_value: parseFloat(document.getElementById('valor').value || 0),
                os_date: document.getElementById('data-os').value,
                pdf_url: pdfUrl
            });

        if (dbError) throw new Error('Erro ao salvar no banco: ' + dbError.message);

        const urlDoCliente = getClientUrlByPlate(plateKey);
        await renderQrCodeWithLogo(urlDoCliente, plateKey);

        publicLink.href = urlDoCliente;
        publicLink.textContent = urlDoCliente;
        resultSection.classList.remove('hidden');
        osForm.style.opacity = '0.5';
        osForm.style.pointerEvents = 'none';
        await loadServiceOrders();
    } catch (error) {
        console.error(error);
        alert(error.message);
    } finally {
        btnSubmit.textContent = originalText;
        btnSubmit.disabled = false;
    }
});

document.getElementById('btn-nova-os').addEventListener('click', () => {
    osForm.reset();
    osForm.style.opacity = '1';
    osForm.style.pointerEvents = 'auto';
    resultSection.classList.add('hidden');
    currentQrCanvas = null;
});

checkAuth();
