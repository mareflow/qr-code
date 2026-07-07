// js/painel.js
import { supabase } from './config.js'

window.onerror = function(msg, url, line, col, error) { alert("JS Error em painel.js: " + msg + " at line " + line); };
window.addEventListener('unhandledrejection', function(event) { alert("Promise Error em painel.js: " + (event.reason && event.reason.message ? event.reason.message : event.reason)); });

let currentUser = null;
let currentLogoUrl = null;
let currentThemeColor = '#1E3A8A';
let currentButtonColor = '#2563EB';
let currentBgColor = '#F3F4F6';
let currentPanelBgColor = '#F9FAFB';
let currentPanelTextColor = '#1F2937';
let currentWorkshopName = 'Oficina';
let currentWhatsapp = '';
let currentInstagram = '';
let currentGoogleReview = '';
let currentAddress = '';
let currentCpfCnpj = '';
let currentQrCenterType = 'text';
let currentQrCenterText = '';
let currentQrLogoUrl = null;
let serviceOrders = [];
let filteredOrdersList = [];
let currentPage = 1;
const itemsPerPage = 10;
let currentQrCanvas = null;
let currentQrFileName = 'qr-code.png';
let currentEditingOsId = null;
let registeredVehicle = null;
let currentOsLimit = 100;
let currentPhotoLimit = 3;
let currentReminderLimit = 50;
let currentOsCountThisMonth = 0;
let currentReminderCountThisMonth = 0;

const listaOs = document.getElementById('lista-os');
const buscaOs = document.getElementById('busca-os');
const osForm = document.getElementById('os-form');
const btnSubmit = document.getElementById('btn-submit');
const resultSection = document.getElementById('result-section');
const qrcodeContainer = document.getElementById('qrcode-container');
const publicLink = document.getElementById('public-link');
const btnBaixarQr = document.getElementById('btn-baixar-qr');
const btnImprimirQr = document.getElementById('btn-imprimir-qr');

const configForm = document.getElementById('config-form');
const logoPreview = document.getElementById('logo-preview');
const logoPlaceholder = document.getElementById('logo-placeholder');
const navbarTitle = document.getElementById('navbar-title');
const navbar = document.getElementById('navbar');
const btnPrevPage = document.getElementById('btn-prev-page');
const btnNextPage = document.getElementById('btn-next-page');
const pageInfo = document.getElementById('page-info');

// ══════════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════════
window.switchTab = function(tabName) {
    // Esconde todos os painéis
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    // Desativa todos os botões
    document.querySelectorAll('.tab-nav-btn').forEach(b => {
        b.classList.remove('active-tab');
        b.setAttribute('aria-selected', 'false');
    });
    // Ativa o painel e botão corretos
    const panel = document.getElementById(`tab-${tabName}`);
    const btn   = document.getElementById(`tabn-${tabName}`);
    if (panel) panel.classList.remove('hidden');
    if (btn)   { btn.classList.add('active-tab'); btn.setAttribute('aria-selected', 'true'); }
};

// ══════════════════════════════════════════
// MODAL QR (acionado do histórico)
// ══════════════════════════════════════════
let modalQrCanvas = null;
let modalQrFileName = 'qr-code.png';

async function openQrHistoryModal(plateKey, clientUrl) {
    const modal     = document.getElementById('qr-history-modal');
    const container = document.getElementById('qr-modal-container');
    const title     = document.getElementById('qr-modal-plate');

    modalQrCanvas   = null;
    modalQrFileName = `qr-${plateKey}.png`;
    title.textContent = `QR Code — ${plateKey}`;
    container.innerHTML = '<p class="text-sm text-gray-400 animate-pulse">Gerando QR Code...</p>';
    modal.classList.remove('hidden');

    // Reutiliza a mesma lógica de renderização, mas num container temporário
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(tempDiv);

    const scale = 4, baseSize = 240, nativeSize = baseSize * scale;
    new QRCode(tempDiv, { text: clientUrl, width: nativeSize, height: nativeSize,
        colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });

    await new Promise(r => requestAnimationFrame(r));
    const qrSource = tempDiv.querySelector('canvas, img');
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = nativeSize; finalCanvas.height = nativeSize;
    const ctx = finalCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, nativeSize, nativeSize);
    ctx.drawImage(qrSource, 0, 0, nativeSize, nativeSize);

    try {
        const boxSize = 68 * scale;
        const x = (nativeSize - boxSize) / 2;
        const y = (nativeSize - boxSize) / 2;
        const cx = nativeSize / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, boxSize, boxSize);

        if (currentQrCenterType === 'logo' && currentQrLogoUrl) {
            try {
                const img = await loadImage(currentQrLogoUrl);
                const padding = 2 * scale;
                ctx.drawImage(img, x + padding, y + padding, boxSize - (padding*2), boxSize - (padding*2));
            } catch (err) {
                console.warn('Erro ao carregar qr logo', err);
            }
        } else {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000000';
            ctx.textBaseline = 'middle';
            
            const companyName = currentQrCenterText || currentWorkshopName || 'Oficina Parceira';
            const maxWidth = boxSize - (4 * scale);
            const maxHeight = boxSize - (8 * scale);
            const cy = y + (boxSize / 2);

            let fontSize = 16 * scale;
            let lines = [];
            
            while (fontSize > 6 * scale) {
                ctx.font = `900 ${fontSize}px sans-serif`;
                const words = companyName.split(' ');
                lines = [];
                let currentLine = words[0] || '';
                
                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const width = ctx.measureText(currentLine + ' ' + word).width;
                    if (width < maxWidth) {
                        currentLine += ' ' + word;
                    } else {
                        lines.push(currentLine);
                        currentLine = word;
                    }
                }
                if (currentLine) lines.push(currentLine);
                
                const lineHeight = fontSize * 1.1;
                const totalHeight = lines.length * lineHeight;
                let allLinesFitWidth = lines.every(line => ctx.measureText(line).width <= maxWidth);
                
                if (totalHeight <= maxHeight && allLinesFitWidth) {
                    break;
                }
                fontSize -= scale;
            }

            ctx.font = `900 ${fontSize}px sans-serif`;
            const lineHeight = fontSize * 1.1;
            const totalHeight = lines.length * lineHeight;
            let startY = cy - (totalHeight / 2) + (lineHeight / 2);
            
            for (const line of lines) {
                ctx.fillText(line, cx, startY);
                startY += lineHeight;
            }
        }
    } catch (_) {}

    tempDiv.remove();
    modalQrCanvas = finalCanvas;
    finalCanvas.className = 'mx-auto rounded-xl shadow-sm';
    finalCanvas.style.cssText = 'width:220px;height:220px;';
    container.innerHTML = '';
    container.appendChild(finalCanvas);
}

function closeQrHistoryModal() {
    document.getElementById('qr-history-modal').classList.add('hidden');
    modalQrCanvas = null;
}

document.getElementById('qr-modal-close').addEventListener('click', closeQrHistoryModal);
document.getElementById('qr-history-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('qr-history-modal')) closeQrHistoryModal();
});

document.getElementById('qr-modal-baixar').addEventListener('click', () => {
    if (!modalQrCanvas) return;
    const link = document.createElement('a');
    link.download = modalQrFileName;
    link.href = modalQrCanvas.toDataURL('image/png');
    link.click();
});

document.getElementById('qr-modal-imprimir').addEventListener('click', () => {
    if (!modalQrCanvas) return;
    printCurrentQrCode();
});

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
            // Se não encontrou o workshop, desloga e manda pro index
            await supabase.auth.signOut();
            window.location.replace('index.html');
            return;
        } else {
            // Bloqueia acesso se estiver aguardando pagamento
            if (data.assinatura_status === 'aguardando_pagamento') {
                window.location.replace('assinatura.html');
                return;
            }

            currentWorkshopName = data.name || 'Oficina';
            currentLogoUrl = data.logo_url || null;
            currentThemeColor = data.theme_color || '#1E3A8A';
            currentButtonColor = data.button_color || '#2563EB';
            currentBgColor = data.bg_color || '#F3F4F6';
            currentPanelBgColor = data.panel_bg_color || '#F9FAFB';
            currentPanelTextColor = data.panel_text_color || '#1F2937';
            currentWhatsapp = data.whatsapp || '';
            currentInstagram = data.instagram || '';
            currentGoogleReview = data.google_review_url || '';
            currentAddress = data.address || '';
            currentCpfCnpj = data.cpf_cnpj || '';
            currentOsLimit = data.os_limit || 50;
            currentPhotoLimit = data.photo_limit || 3;
            currentReminderLimit = data.reminder_limit || 50;
            currentQrCenterType = data.qr_center_type || 'text';
            currentQrCenterText = data.qr_center_text || '';
            currentQrLogoUrl = data.qr_logo_url || null;
            
            document.getElementById('config-cor-principal').value = currentThemeColor;
            document.getElementById('config-cor-botoes').value = currentButtonColor;
            document.getElementById('config-cor-fundo').value = currentBgColor;
            document.getElementById('config-cor-fundo-painel').value = currentPanelBgColor;
            document.getElementById('config-cor-texto-painel').value = currentPanelTextColor;
            document.getElementById('config-nome').value = currentWorkshopName;
            document.getElementById('config-whatsapp').value = currentWhatsapp;
            document.getElementById('config-instagram').value = currentInstagram;
            if (document.getElementById('config-google-review')) {
                document.getElementById('config-google-review').value = currentGoogleReview;
            }
            if (document.getElementById('config-cpf-cnpj')) {
                document.getElementById('config-cpf-cnpj').value = currentCpfCnpj;
            }
            if (currentAddress) {
                try {
                    const addrObj = JSON.parse(currentAddress);
                    if (document.getElementById('config-rua')) document.getElementById('config-rua').value = addrObj.rua || '';
                    if (document.getElementById('config-numero')) document.getElementById('config-numero').value = addrObj.numero || '';
                    if (document.getElementById('config-bairro')) document.getElementById('config-bairro').value = addrObj.bairro || '';
                    if (document.getElementById('config-cidade')) document.getElementById('config-cidade').value = addrObj.cidade || '';
                    if (document.getElementById('config-uf')) document.getElementById('config-uf').value = addrObj.uf || '';
                } catch (e) {
                    if (document.getElementById('config-endereco')) document.getElementById('config-endereco').value = currentAddress;
                }
            }
            
            if (currentQrCenterType === 'logo') {
                const rLogo = document.querySelector('input[name="config-qr-type"][value="logo"]');
                if (rLogo) rLogo.checked = true;
                document.getElementById('qr-text-container')?.classList.add('hidden');
                document.getElementById('qr-logo-container')?.classList.remove('hidden');
            } else {
                const rText = document.querySelector('input[name="config-qr-type"][value="text"]');
                if (rText) rText.checked = true;
                document.getElementById('qr-text-container')?.classList.remove('hidden');
                document.getElementById('qr-logo-container')?.classList.add('hidden');
            }
            if (document.getElementById('config-qr-text')) {
                document.getElementById('config-qr-text').value = currentQrCenterText;
            }
            if (currentQrLogoUrl && document.getElementById('qr-logo-preview')) {
                document.getElementById('qr-logo-preview').src = currentQrLogoUrl;
                document.getElementById('qr-logo-preview').classList.remove('hidden');
                document.getElementById('qr-logo-placeholder').classList.add('hidden');
            }
            
            updateQrCenterPreview();
            
            applyTheme();
            // Sincroniza cor de acento das abas com o tema da oficina
            document.documentElement.style.setProperty('--tab-accent', currentButtonColor);

            // ── VERIFICAÇÃO DE ASSINATURA ──────────────────────────
            checkAssinaturaBanner(data);
        }

        await loadServiceOrders();
    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
    }
}

function checkAssinaturaBanner(workshop) {
    const status = workshop.assinatura_status || 'ativo';
    const vencimento = workshop.assinatura_vencimento;
    const banner = document.getElementById('assinatura-banner');
    if (!banner) return;

    // Injetar animações CSS (apenas uma vez)
    if (!document.getElementById('banner-animations')) {
        const style = document.createElement('style');
        style.id = 'banner-animations';
        style.innerHTML = `
            @keyframes pulse-red {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            @keyframes flash-red {
                0%, 100% { background: #7f1d1d; }
                50% { background: #991b1b; }
            }
            .banner-pulse { animation: pulse-red 1.5s ease-in-out infinite; }
            .banner-flash { animation: flash-red 1s ease-in-out infinite; }
        `;
        document.head.appendChild(style);
    }

    // Calcular dias para o vencimento
    let diasParaVencer = null;
    if (vencimento) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const venc = new Date(vencimento + 'T00:00:00');
        diasParaVencer = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
    }

    // Se bloqueado, redireciona para tela de assinatura
    if (status === 'bloqueado' || (diasParaVencer !== null && diasParaVencer <= -5)) {
        window.location.replace('assinatura.html');
        return;
    }

    banner.style.display = 'none';
    banner.className = '';

    // 🔴 INADIMPLENTE — piscando em vermelho
    if (status === 'inadimplente' || (diasParaVencer !== null && diasParaVencer < 0)) {
        const diasAtraso = diasParaVencer !== null ? Math.abs(diasParaVencer) : '?';
        banner.style.display = 'block';
        banner.classList.add('banner-flash');
        banner.innerHTML = `<div style="color:#fca5a5;padding:12px 24px;text-align:center;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">
            🚨 PAGAMENTO ATRASADO há ${diasAtraso} dia(s)! Regularize agora para evitar bloqueio.
            <a href="assinatura.html" style="background:#ef4444;color:#fff;padding:5px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;box-shadow:0 0 12px rgba(239,68,68,0.5);">Pagar agora →</a>
        </div>`;
        return;
    }

    // 🟠 3 DIAS OU MENOS — urgente, laranja
    if (diasParaVencer !== null && diasParaVencer <= 3 && diasParaVencer >= 0) {
        const msg = diasParaVencer === 0 ? '⚠️ VENCE HOJE!' : `⚠️ Vence em ${diasParaVencer} dia(s)`;
        banner.style.display = 'block';
        banner.classList.add('banner-pulse');
        banner.innerHTML = `<div style="background:#7c2d12;color:#fed7aa;padding:12px 24px;text-align:center;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">
            ${msg} — Efetue o pagamento para não ter interrupção no serviço.
            <a href="assinatura.html" style="background:#ea580c;color:#fff;padding:5px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;">Ver detalhes →</a>
        </div>`;
        return;
    }

    // 🟡 7 DIAS — aviso antecipado, amarelo
    if (diasParaVencer !== null && diasParaVencer <= 7 && diasParaVencer > 3) {
        banner.style.display = 'block';
        banner.innerHTML = `<div style="background:#78350f;color:#fde68a;padding:10px 24px;text-align:center;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">
            ⏰ Sua mensalidade vence em ${diasParaVencer} dias (${formatDateBR(vencimento)}). Organize-se com antecedência!
            <a href="assinatura.html" style="background:#d97706;color:#fff;padding:4px 14px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;white-space:nowrap;">Ver assinatura →</a>
        </div>`;
        return;
    }
}

function formatDateBR(d) {
    if (!d) return '';
    const [y, m, day] = d.split('T')[0].split('-');
    return `${day}/${m}/${y}`;
}


function applyTheme() {
    navbarTitle.textContent = `${currentWorkshopName} | Painel`;
    navbar.style.backgroundColor = currentThemeColor;

    // Calcula luminancia para texto claro ou escuro
    const hex = currentThemeColor.replace('#', '');
    const r = parseInt(hex.substring(0,2),16)/255;
    const g = parseInt(hex.substring(2,4),16)/255;
    const b = parseInt(hex.substring(4,6),16)/255;
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    const isDark = lum < 0.4;

    // CSS variavel de acento das abas
    document.documentElement.style.setProperty('--tab-accent', currentButtonColor);
    
    // Injetando CSS dinamico para todo o painel
    let styleEl = document.getElementById('dynamic-theme');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-theme';
        document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
        /* BARRA DE ABAS - FIXA CLARA PARA LEITURA */
        .sticky.top-0.z-20 {
            background-color: #ffffff !important;
            border-bottom-color: #e5e7eb !important;
        }
        .tab-nav-btn {
            color: #6b7280 !important;
        }
        .tab-nav-btn:hover {
            background-color: #f9fafb !important;
            color: #374151 !important;
        }
        .tab-nav-btn.active-tab {
            color: ${currentButtonColor} !important;
            border-bottom-color: ${currentButtonColor} !important;
        }

        /* ─── CUSTOMIZAÇÃO DO PAINEL ─── */
        body {
            background-color: ${currentPanelBgColor} !important;
            color: ${currentPanelTextColor} !important;
        }
        .bg-white {
            background-color: ${currentPanelBgColor} !important;
            background-image: linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02));
        }
        .text-gray-900, .text-gray-800, .text-gray-700 {
            color: ${currentPanelTextColor} !important;
        }
        .text-gray-600, .text-gray-500 {
            color: ${currentPanelTextColor} !important;
            opacity: 0.75;
        }

        /* Cores de texto e icones (Tema Principal) */
        .text-blue-600 { color: ${currentThemeColor} !important; }
        
        /* Botoes de Acao Primarios */
        #btn-salvar-config, #btn-submit, #btn-baixar-qr, #btn-logout { background-color: ${currentButtonColor} !important; color: white !important; }
        #btn-salvar-config:hover, #btn-submit:hover, #btn-baixar-qr:hover, #btn-logout:hover { filter: brightness(0.9); }
        
        /* Botoes secundarios */
        #btn-submit-pendente { background-color: ${currentThemeColor} !important; color: ${getContrastColor(currentThemeColor)} !important; filter: brightness(1.2); }
        #btn-submit-pendente:hover { filter: brightness(1.1); }
        
        /* Inputs focus e rings */
        .focus\\:ring-blue-500:focus { --tw-ring-color: ${currentThemeColor} !important; }
        .focus\\:border-blue-500:focus { border-color: ${currentThemeColor} !important; }
    `;

    if (currentLogoUrl) {
        logoPreview.src = currentLogoUrl;
        logoPreview.classList.remove('hidden');
        logoPlaceholder.classList.add('hidden');
    } else {
        logoPreview.classList.add('hidden');
        logoPlaceholder.classList.remove('hidden');
    }
}

function normalizePlate(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function emailsMatch(a, b) {
    return normalizeEmail(a) === normalizeEmail(b);
}

function setEmailFieldLocked(locked, registeredEmail = '') {
    const emailInput = document.getElementById('email-cliente');
    const infoEl = document.getElementById('email-placa-info');
    const btnAlterar = document.getElementById('btn-alterar-email');

    emailInput.readOnly = locked;
    emailInput.classList.toggle('bg-gray-100', locked);
    emailInput.classList.toggle('cursor-not-allowed', locked);

    if (infoEl) {
        if (locked) {
            infoEl.textContent = `Placa já cadastrada. E-mail do proprietário: ${registeredEmail}`;
            infoEl.classList.remove('hidden');
        } else {
            infoEl.classList.add('hidden');
        }
    }

    if (btnAlterar) {
        btnAlterar.classList.toggle('hidden', !locked);
    }
}

async function loadRegisteredVehicle(plateValue) {
    const plateKey = normalizePlate(plateValue);
    if (!plateKey) {
        registeredVehicle = null;
        setEmailFieldLocked(false);
        return;
    }

    const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('plate_key', plateKey)
        .maybeSingle();

    if (error) {
        console.error('Erro ao buscar veículo cadastrado:', error);
        return;
    }

    registeredVehicle = data;

    if (data) {
        document.getElementById('email-cliente').value = data.client_email || '';
        if (!document.getElementById('cliente').value.trim() && data.customer_name) {
            document.getElementById('cliente').value = data.customer_name;
        }
        if (!document.getElementById('marca').value.trim() && data.brand) {
            document.getElementById('marca').value = data.brand;
        }
        if (!document.getElementById('veiculo').value.trim() && data.vehicle) {
            document.getElementById('veiculo').value = data.vehicle;
        }
        if (!document.getElementById('motorizacao').value.trim() && data.engine) {
            document.getElementById('motorizacao').value = data.engine;
        }
        setEmailFieldLocked(true, data.client_email);
    } else {
        setEmailFieldLocked(false);
    }
}

async function changeRegisteredVehicleEmail(plateKey) {
    const newEmail = window.prompt(
        'Digite o NOVO e-mail do proprietário.\n\nUse apenas quando o cliente solicitar a alteração:',
        registeredVehicle?.client_email || ''
    );

    if (!newEmail) return;

    const normalized = normalizeEmail(newEmail);
    if (!normalized.includes('@')) {
        alert('E-mail inválido.');
        return;
    }

    const confirmed = window.confirm(
        `Confirmar alteração do e-mail desta placa para:\n${normalized}\n\nTodas as OS desta placa serão atualizadas.`
    );
    if (!confirmed) return;

    const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ client_email: normalized, updated_at: new Date().toISOString() })
        .eq('plate_key', plateKey);

    if (vehicleError) {
        alert('Erro ao alterar e-mail: ' + vehicleError.message);
        return;
    }

    await supabase
        .from('service_orders')
        .update({ client_email: normalized })
        .eq('plate_key', plateKey);

    registeredVehicle = { ...registeredVehicle, client_email: normalized };
    document.getElementById('email-cliente').value = normalized;
    setEmailFieldLocked(true, normalized);
    alert('E-mail do proprietário atualizado com sucesso.');
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

function resizeImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Falha ao converter o canvas'));
                        return;
                    }
                    const resizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(resizedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
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
    qrcodeContainer.innerHTML = '<div class="text-sm text-gray-500 font-medium">Gerando QR Code...</div>';
    currentQrCanvas = null;
    currentQrFileName = `qr-${plateKey || 'veiculo'}.png`;

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    document.body.appendChild(tempContainer);

    // Resolução interna
    const scale = 4;
    const baseSize = 240;
    const nativeSize = baseSize * scale;

    new QRCode(tempContainer, {
        text: url,
        width: nativeSize,
        height: nativeSize,
        colorDark: '#000000',
        colorLight: '#ffffff',
        // Nível M (15%) gera menos módulos que o H (30%), sendo mais fácil de ler em 40x40mm.
        // O bloco central terá apenas ~10% de área, então o nível M é mais que suficiente.
        correctLevel: QRCode.CorrectLevel.M 
    });

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const qrSource = tempContainer.querySelector('canvas, img');
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = nativeSize;
    finalCanvas.height = nativeSize;
    finalCanvas.className = 'w-[250px] h-[250px] mx-auto border rounded-xl shadow-sm'; 

    const ctx = finalCanvas.getContext('2d');
    
    // Fundo branco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    
    // Desenha o QR Code
    ctx.drawImage(qrSource, 0, 0, finalCanvas.width, finalCanvas.height);

    try {
        // Bloco central reduzido para 28% (ocupa ~8% da área, o nível M corrige até 15%)
        const boxSize = 68 * scale; 
        const x = (finalCanvas.width - boxSize) / 2;
        const y = (finalCanvas.height - boxSize) / 2;
        const cx = finalCanvas.width / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, boxSize, boxSize);

        if (currentQrCenterType === 'logo' && currentQrLogoUrl) {
            try {
                const img = await loadImage(currentQrLogoUrl);
                const padding = 2 * scale;
                ctx.drawImage(img, x + padding, y + padding, boxSize - (padding*2), boxSize - (padding*2));
            } catch (err) {
                console.warn('Erro ao carregar qr logo', err);
            }
        } else {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000000';
            ctx.textBaseline = 'middle';
            
            const companyName = currentQrCenterText || currentWorkshopName || 'Oficina Parceira';
            const maxWidth = boxSize - (4 * scale);
            const maxHeight = boxSize - (8 * scale);
            const cy = y + (boxSize / 2);

            let fontSize = 16 * scale;
            let lines = [];
            
            while (fontSize > 6 * scale) {
                ctx.font = `900 ${fontSize}px sans-serif`;
                const words = companyName.split(' ');
                lines = [];
                let currentLine = words[0] || '';
                
                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const width = ctx.measureText(currentLine + ' ' + word).width;
                    if (width < maxWidth) {
                        currentLine += ' ' + word;
                    } else {
                        lines.push(currentLine);
                        currentLine = word;
                    }
                }
                if (currentLine) lines.push(currentLine);
                
                const lineHeight = fontSize * 1.1;
                const totalHeight = lines.length * lineHeight;
                let allLinesFitWidth = lines.every(line => ctx.measureText(line).width <= maxWidth);
                
                if (totalHeight <= maxHeight && allLinesFitWidth) {
                    break;
                }
                fontSize -= scale;
            }

            ctx.font = `900 ${fontSize}px sans-serif`;
            const lineHeight = fontSize * 1.1;
            const totalHeight = lines.length * lineHeight;
            let startY = cy - (totalHeight / 2) + (lineHeight / 2);
            
            for (let line of lines) {
                ctx.fillText(line, cx, startY);
                startY += lineHeight;
            }
        }
    } catch (error) {
        console.warn('Nao foi possivel renderizar o texto no QR Code:', error);
    }

    tempContainer.remove();
    currentQrCanvas = finalCanvas;
    qrcodeContainer.innerHTML = '';
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

    // Usando variáveis globais que já temos disponíveis no painel
    const wsName = currentWorkshopName || 'Oficina Parceira';
    const plate = document.getElementById('modal-plate-title')?.textContent || 'Veículo';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <title>Imprimir Etiqueta</title>
            <style>
                @page { size: 40mm 40mm; margin: 0; }
                body { 
                    margin: 0; 
                    width: 40mm; 
                    height: 40mm; 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: center; 
                    align-items: center; 
                    background: white; 
                    font-family: Arial, sans-serif;
                    overflow: hidden;
                    text-align: center;
                }
                img { 
                    width: 32mm; 
                    height: 32mm; 
                    object-fit: contain;
                    margin-bottom: 0.5mm;
                }
                .text-container {
                    display: flex;
                    flex-direction: column;
                    width: 38mm;
                    align-items: center;
                }
                .plate {
                    font-size: 8px;
                    font-weight: 900;
                    color: #000;
                    letter-spacing: 0.5px;
                    line-height: 1;
                }
                .workshop {
                    font-size: 6px;
                    font-weight: bold;
                    color: #333;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                    line-height: 1.2;
                }
            </style>
        </head>
        <body>
            <img src="${imageUrl}" alt="QR Code">
            <div class="text-container">
                <div class="plate">${plate}</div>
                <div class="workshop">${wsName}</div>
            </div>
            <script>
                // Pequeno delay para garantir a renderização da imagem antes de chamar a impressora
                window.onload = () => { 
                    setTimeout(() => { window.print(); window.close(); }, 300);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function renderServiceOrders(filter = '') {
    const term = filter.trim().toLowerCase();
    
    const dataInicio = document.getElementById('filtro-data-inicio')?.value;
    const dataFim = document.getElementById('filtro-data-fim')?.value;
    const categoria = document.getElementById('filtro-categoria')?.value;
    
    // Filter out deleted OS and then apply search filter
    filteredOrdersList = serviceOrders.filter((order) => {
        if (order.is_deleted === true) return false;
        
        const matchTerm = !term ||
            String(order.plate || '').toLowerCase().includes(term) ||
            String(order.customer_name || '').toLowerCase().includes(term);
            
        let matchData = true;
        if (dataInicio && order.os_date < dataInicio) matchData = false;
        if (dataFim && order.os_date > dataFim) matchData = false;
        
        let matchCategoria = true;
        if (categoria && order.compartimentos) {
             const cats = order.compartimentos.split(',').map(c => c.trim());
             if (!cats.includes(categoria)) matchCategoria = false;
        } else if (categoria) {
             matchCategoria = false;
        }
            
        return matchTerm && matchData && matchCategoria;
    });

    renderPagination();
    updateDashboardStats(filteredOrdersList);
    
    // Update Limit UI
    const resultSection = document.getElementById('result-section');
    let limitInfo = document.getElementById('limit-info');
    if (!limitInfo && document.getElementById('os-form')) {
        limitInfo = document.createElement('div');
        limitInfo.id = 'limit-info';
        limitInfo.className = 'w-full mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between text-sm';
        document.getElementById('os-form').before(limitInfo);
    }
    
    if (limitInfo) {
        const perc = Math.min(100, Math.round((currentOsCountThisMonth / currentOsLimit) * 100));
        const color = perc >= 100 ? 'text-red-600 font-bold' : (perc >= 80 ? 'text-amber-600 font-bold' : 'text-gray-600');
        
        limitInfo.innerHTML = `
            <div><strong class="text-gray-800">Cota Mensal:</strong> <span class="${color}">${currentOsCountThisMonth} / ${currentOsLimit} O.S</span> usadas neste mês</div>
            ${perc >= 100 ? '<a href="#" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold uppercase hover:bg-red-200">Aumentar Limite</a>' : ''}
        `;
    }
    
    // Block creation if limit reached
    const btnSubmit = document.getElementById('btn-submit');
    const btnSubmitPendente = document.getElementById('btn-submit-pendente');
    if (btnSubmit && btnSubmitPendente) {
        if (currentOsCountThisMonth >= currentOsLimit && !currentEditingOsId) {
            btnSubmit.disabled = true;
            btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
            btnSubmit.textContent = 'Limite de O.S excedido';
            
            btnSubmitPendente.disabled = true;
            btnSubmitPendente.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
            btnSubmit.textContent = currentEditingOsId ? 'Atualizar OS' : 'Salvar OS Finalizada';
            
            btnSubmitPendente.disabled = false;
            btnSubmitPendente.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

function updateDashboardStats(orders) {
    const dataInicio = document.getElementById('filtro-data-inicio')?.value;
    const dataFim    = document.getElementById('filtro-data-fim')?.value;
    const categoria  = document.getElementById('filtro-categoria')?.value;

    // Define o label dinâmico do período
    const hasFilter = dataInicio || dataFim || categoria;
    const labelPeriodo = hasFilter ? 'no Filtro' : 'no Mês';

    const elLabelOs      = document.querySelector('#dash-os-mes')?.previousElementSibling;
    const elLabelReceita = document.querySelector('#dash-receita-mes')?.previousElementSibling;
    const elLabelTicket  = document.querySelector('#dash-ticket-medio')?.previousElementSibling;
    
    if (elLabelOs)      elLabelOs.textContent      = `OS ${labelPeriodo}`;
    if (elLabelReceita) elLabelReceita.textContent  = `Faturamento ${labelPeriodo}`;
    if (elLabelTicket)  elLabelTicket.textContent   = `Ticket Médio`;

    // Se não há filtro de data/categoria e o campo de busca tá vazio, mostra o Mês atual por padrão.
    // O orders (filteredOrdersList) já vem filtrado pelo que está na tela.
    let baseList = orders;
    const searchbox = document.getElementById('busca-os')?.value.trim();
    if (!hasFilter && !searchbox) {
        const mesAtual = new Date();
        const anoMes = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`;
        baseList = (serviceOrders || []).filter(os =>
            !os.is_deleted && os.created_at && os.created_at.substring(0, 7) === anoMes
        );
    }

    let totalOs = 0;
    let totalReceita = 0;
    const tagsCount = {};

    (baseList || []).forEach(os => {
        if (os.is_deleted) return;
        totalOs++;
        totalReceita += parseFloat(os.total_value) || 0;
        if (os.compartimentos) {
            os.compartimentos.split(',').forEach(tag => {
                const t = tag.trim();
                if (t) tagsCount[t] = (tagsCount[t] || 0) + 1;
            });
        }
    });

    const ticketMedio = totalOs > 0 ? (totalReceita / totalOs) : 0;

    let topSvcName = '-';
    let topSvcCount = 0;
    for (const [tag, count] of Object.entries(tagsCount)) {
        if (count > topSvcCount) { topSvcCount = count; topSvcName = tag; }
    }

    const dashOsMes = document.getElementById('dash-os-mes');
    if (dashOsMes) {
        dashOsMes.textContent = totalOs;
        document.getElementById('dash-receita-mes').textContent = formatMoney(totalReceita);
        document.getElementById('dash-ticket-medio').textContent = formatMoney(ticketMedio);
        const dashTopSvc = document.getElementById('dash-top-servico');
        dashTopSvc.textContent = topSvcName;
        dashTopSvc.title = topSvcName;
    }
}

function getContrastColor(hexColor) {
    if (!hexColor) return '#1f2937';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#1f2937' : '#ffffff';
}

function getSecondaryContrastColor(hexColor) {
    if (!hexColor) return '#4b5563';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#4b5563' : '#d1d5db';
}

function renderPagination() {
    const totalPages = Math.ceil(filteredOrdersList.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageOrders = filteredOrdersList.slice(startIdx, endIdx);

    btnPrevPage.disabled = currentPage === 1;
    btnNextPage.disabled = currentPage === totalPages;
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

    if (!pageOrders.length) {
        listaOs.innerHTML = '<p class="text-sm text-gray-500 py-4">Nenhuma OS encontrada.</p>';
        return;
    }

    const themeColor = document.getElementById('config-cor-principal')?.value || '#1E3A8A';
    const buttonColor = document.getElementById('config-cor-botoes')?.value || '#2563EB';
    const bgColor = document.getElementById('config-cor-fundo')?.value || '#ffffff';
    
    const textColor = getContrastColor(bgColor);
    const textSecondaryColor = getSecondaryContrastColor(bgColor);

    listaOs.innerHTML = pageOrders.map((order) => {
        const plateKey = order.plate_key || normalizePlate(order.plate);
        const clientUrl = getClientUrlByPlate(plateKey);
        const pdfButton = order.pdf_url
            ? `<a href="${order.pdf_url}" target="_blank" class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded">PDF</a>`
            : '';

        let statusBadge = '';
        let finishButton = '';
        if (order.status === 'pendente') {
            statusBadge = `<span class="text-xs bg-yellow-100 text-yellow-800 font-bold px-2 py-1 rounded border border-yellow-300">Aguardando Arquivos</span>`;
            finishButton = `<button type="button" data-edit-os="${order.id}" class="text-sm px-3 py-2 rounded border transition-colors font-bold" style="background-color: ${textColor}10; color: ${textColor}; border-color: ${textColor}20;">Finalizar OS</button>`;
        }

        const vehicleIcon = order.vehicle_type === 'Moto'
            ? `<span class="text-lg" title="Moto">🏍️</span>`
            : `<span class="text-lg" title="Carro">🚗</span>`;

        return `
            <article class="p-4 rounded-xl mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 transition-colors border" style="background-color: ${bgColor}; border-color: ${textColor}1A;">
                <div class="flex items-center gap-3">
                    <div class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style="background-color: ${textColor}08;">
                        ${vehicleIcon}
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-2 mb-0.5">
                            <strong class="text-base" style="color: ${textColor}">${order.plate || 'Sem placa'}</strong>
                            <span class="text-xs px-2 py-0.5 rounded font-semibold" style="background-color: ${textColor}10; color: ${textColor};">${formatDate(order.os_date)}</span>
                            ${statusBadge}
                            ${order.lembrete_oficina ? `<span class="text-xs px-2 py-0.5 rounded border border-purple-300 bg-purple-100 text-purple-800 font-bold" title="${order.lembrete_oficina}">🔔 Lembrete</span>` : ''}
                        </div>
                        <p class="text-sm font-medium" style="color: ${textSecondaryColor}">${order.customer_name || 'Cliente não informado'}</p>
                        <p class="text-xs font-bold mt-0.5 mb-1" style="color: #16a34a;">${formatMoney(order.total_value)}</p>
                        ${order.compartimentos ? `<div class="flex flex-wrap gap-1 mt-1">` + order.compartimentos.split(',').map(tag => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold border border-gray-200">${tag.trim()}</span>`).join('') + `</div>` : ''}
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-3 md:mt-0">
                    ${pdfButton}
                    ${finishButton}
                    <button type="button" data-qr-os="${plateKey}" data-url="${clientUrl}" class="text-sm px-3 py-2 rounded transition-colors font-bold" style="background-color: ${textColor}15; color: ${textColor}; border: 1px solid ${textColor}20;">QR Code</button>
                    <a href="${clientUrl}" class="text-sm hover:brightness-110 text-white px-3 py-2 rounded transition font-bold" style="background-color: ${buttonColor}">Ver histórico</a>
                    <button type="button" data-delete-os="${order.id}" class="text-sm bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded transition-colors font-bold">Excluir</button>
                </div>
            </article>
        `;
    }).join('');
}

async function deleteServiceOrder(orderId) {
    const order = serviceOrders.find((item) => String(item.id) === String(orderId));
    const label = order ? `${order.plate || 'sem placa'} - ${formatDate(order.os_date)}` : 'esta OS';
    const confirmed = window.confirm(`Excluir ${label}? Isso removerá a OS da sua lista, mas não da cota mensal.`);

    if (!confirmed) return;

    // SOFT DELETE: Update is_deleted instead of delete()
    const { error } = await supabase
        .from('service_orders')
        .update({ is_deleted: true })
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
    
    // Count OS created this month for QUOTA (includes deleted)
    const mesAtual = new Date();
    const anoMesAtual = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`;
    
    currentOsCountThisMonth = serviceOrders.filter(os => {
        if (!os.created_at) return false;
        return os.created_at.substring(0, 7) === anoMesAtual;
    }).length;
    
    currentReminderCountThisMonth = serviceOrders.filter(os => {
        if (!os.created_at || os.is_deleted) return false;
        return os.created_at.substring(0, 7) === anoMesAtual && os.lembrete_data;
    }).length;
    
    // Calcula estatísticas do Dashboard
    let totalMesValido = 0;
    let faturamentoMes = 0;
    let totalValorGlobal = 0;
    let totalOsGlobal = 0;
    const tagsCount = {};

    serviceOrders.forEach(os => {
        if (os.is_deleted) return;
        
        totalOsGlobal++;
        totalValorGlobal += parseFloat(os.total_value) || 0;
        
        if (os.compartimentos) {
            os.compartimentos.split(',').forEach(tag => {
                const t = tag.trim();
                if (t) tagsCount[t] = (tagsCount[t] || 0) + 1;
            });
        }
        
        if (os.created_at && os.created_at.substring(0, 7) === anoMesAtual) {
            totalMesValido++;
            faturamentoMes += parseFloat(os.total_value) || 0;
        }
    });

    // Atualiza os labels dos cards para "no período" (serão atualizados depois pelo filtro)
    const labelOsMes = document.querySelector('[for="dash-os-mes"] span, #dash-os-mes')?.previousElementSibling;
    // Inicializa com valor do mês até o filtro ser aplicado

    const dashOsMes = document.getElementById('dash-os-mes');
    if (dashOsMes) {
        dashOsMes.textContent = totalMesValido;
        document.getElementById('dash-receita-mes').textContent = formatMoney(faturamentoMes);
        
        const ticketMedio = totalOsGlobal > 0 ? (totalValorGlobal / totalOsGlobal) : 0;
        document.getElementById('dash-ticket-medio').textContent = formatMoney(ticketMedio);
        
        let topSvcName = '-';
        let topSvcCount = 0;
        for (const [tag, count] of Object.entries(tagsCount)) {
            if (count > topSvcCount) {
                topSvcCount = count;
                topSvcName = tag;
            }
        }
        const dashTopSvc = document.getElementById('dash-top-servico');
        dashTopSvc.textContent = topSvcName;
        dashTopSvc.title = topSvcName;
    }
    
    renderServiceOrders(buscaOs.value);
    if (window.loadTodayReminders) window.loadTodayReminders();
}

document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('index.html');
});

buscaOs.addEventListener('input', () => {
    currentPage = 1;
    renderServiceOrders(buscaOs.value);
});
document.getElementById('filtro-data-inicio')?.addEventListener('change', () => {
    currentPage = 1;
    renderServiceOrders(buscaOs.value);
});
document.getElementById('filtro-data-fim')?.addEventListener('change', () => {
    currentPage = 1;
    renderServiceOrders(buscaOs.value);
});
document.getElementById('filtro-categoria')?.addEventListener('change', () => {
    currentPage = 1;
    renderServiceOrders(buscaOs.value);
});

btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderPagination();
    }
});

btnNextPage.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredOrdersList.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderPagination();
    }
});
listaOs.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-os]');
    if (deleteButton) {
        deleteServiceOrder(deleteButton.dataset.deleteOs);
        return;
    }

    const editButton = event.target.closest('[data-edit-os]');
    if (editButton) {
        const orderId = editButton.dataset.editOs;
        const order = serviceOrders.find(o => String(o.id) === String(orderId));
        if (order) {
            currentEditingOsId = order.id;
            // Navega para a aba de Nova OS
            switchTab('nova-os');
            const tipoVeiculoRadio = document.querySelector(`input[name="tipo_veiculo"][value="${order.vehicle_type || 'Carro'}"]`);
            if (tipoVeiculoRadio) tipoVeiculoRadio.checked = true;
            document.getElementById('placa').value = order.plate || '';
            document.getElementById('marca').value = order.brand || '';
            document.getElementById('veiculo').value = order.vehicle || '';
            document.getElementById('motorizacao').value = order.engine || '';
            document.getElementById('cliente').value = order.customer_name || '';
            document.getElementById('email-cliente').value = order.client_email || '';
            if (document.getElementById('telefone-cliente')) document.getElementById('telefone-cliente').value = order.client_phone || '';
            document.getElementById('km').value = order.mileage || '';
            document.getElementById('data-os').value = order.os_date || '';
            document.getElementById('servicos').value = order.services_done || '';
            document.getElementById('valor').value = order.total_value || '';
            if(document.getElementById('lembrete-titulo')) document.getElementById('lembrete-titulo').value = order.lembrete_titulo || '';
            if(document.getElementById('lembrete-data')) document.getElementById('lembrete-data').value = order.lembrete_data || '';
            if(document.getElementById('lembrete-km')) document.getElementById('lembrete-km').value = order.lembrete_km || '';
            if(document.getElementById('lembrete-observacoes')) document.getElementById('lembrete-observacoes').value = order.lembrete_observacoes || '';
            if(document.getElementById('lembrete-valor')) document.getElementById('lembrete-valor').value = order.lembrete_valor || '';
            
            const lembreteTipo = order.lembrete_tipo || 'parceiro';
            const radioTipo = document.querySelector(`input[name="lembrete_tipo"][value="${lembreteTipo}"]`);
            if (radioTipo) radioTipo.checked = true;
            
            // Limpar e preencher tags
            document.querySelectorAll('input[name="compartimentos"]').forEach(cb => cb.checked = false);
            document.getElementById('checkbox-outro').checked = false;
            document.getElementById('tag-outro-input').value = '';
            document.getElementById('tag-outro-container').classList.add('hidden');
            
            if (order.compartimentos) {
                const tagsArr = order.compartimentos.split(',').map(t => t.trim());
                tagsArr.forEach(t => {
                    const cb = document.querySelector(`input[name="compartimentos"][value="${t}"]`);
                    if (cb) {
                        cb.checked = true;
                    } else {
                        document.getElementById('checkbox-outro').checked = true;
                        document.getElementById('tag-outro-container').classList.remove('hidden');
                        document.getElementById('tag-outro-input').value = t;
                    }
                });
            }
            
            loadRegisteredVehicle(order.plate || '');
            // Garante que o form esteja visível e scrolla para o topo
            osForm.style.opacity = '1';
            osForm.style.pointerEvents = 'auto';
            resultSection.classList.add('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.getElementById('btn-submit').textContent = 'Salvar Edição (Finalizada)';
        }
        return;
    }

    const qrButton = event.target.closest('[data-qr-os]');
    if (qrButton) {
        const plateKey = qrButton.dataset.qrOs;
        const clientUrl = qrButton.dataset.url;
        // Abre o modal de QR diretamente no histórico (sem trocar de aba)
        openQrHistoryModal(plateKey, clientUrl);
        return;
    }
});
btnBaixarQr.addEventListener('click', downloadCurrentQrCode);
btnImprimirQr.addEventListener('click', printCurrentQrCode);

document.getElementById('checkbox-outro').addEventListener('change', (e) => {
    const container = document.getElementById('tag-outro-container');
    if (e.target.checked) container.classList.remove('hidden');
    else container.classList.add('hidden');
});

osForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const photosInput = document.getElementById('photos-file');
    const maxPhotos = currentPhotoLimit;
    if (photosInput.files.length > maxPhotos) {
        alert(`O seu plano permite no máximo ${maxPhotos} fotos por Ordem de Serviço.`);
        btnSubmit.textContent = 'Gerar OS e QR Code';
        btnSubmit.disabled = false;
        return;
    }
    
    const originalText = btnSubmit.textContent;
    btnSubmit.textContent = 'Enviando arquivos e salvando...';
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

        const photosInput = document.getElementById('photos-file');
        const photoUrls = [];

        if (photosInput.files && photosInput.files.length > 0) {
            for (let i = 0; i < photosInput.files.length; i++) {
                const originalFile = photosInput.files[i];
                const pFile = await resizeImage(originalFile, 1024, 1024, 0.8);
                const pNomeLimpo = pFile.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const pFileName = `${Date.now()}_img_${i}_${pNomeLimpo}`;

                const { error: pUploadError } = await supabase.storage.from('os_photos').upload(pFileName, pFile);
                if (pUploadError) throw new Error('Erro no upload da foto: ' + pUploadError.message);

                const { data: pUrlData } = supabase.storage.from('os_photos').getPublicUrl(pFileName);
                photoUrls.push(pUrlData.publicUrl);
            }
        }

        const submitterValue = e.submitter ? e.submitter.value : 'concluida';
        const statusToSave = submitterValue === 'pendente' ? 'pendente' : 'concluida';

        const plate = document.getElementById('placa').value.trim().toUpperCase();
        const plateKey = normalizePlate(plate);
        const clientEmail = normalizeEmail(document.getElementById('email-cliente').value);

        if (!clientEmail.includes('@')) {
            throw new Error('Informe um e-mail válido do proprietário do veículo.');
        }

        if (registeredVehicle && !emailsMatch(clientEmail, registeredVehicle.client_email)) {
            throw new Error(
                'Esta placa já possui um e-mail cadastrado. Não é possível usar outro e-mail ao criar uma nova OS. ' +
                'Se o cliente solicitou troca, use o botão "Alterar e-mail cadastrado".'
            );
        }

        const inputKmValue = document.getElementById('km').value.trim();
        if (registeredVehicle && inputKmValue) {
            const currentKm = parseInt(String(registeredVehicle.mileage || '0').replace(/\D/g, '')) || 0;
            const newKm = parseInt(inputKmValue.replace(/\D/g, '')) || 0;
            if (newKm < currentKm) {
                throw new Error(`A quilometragem informada (${newKm} km) não pode ser menor que a última registrada (${currentKm} km).`);
            }
        }

        const checkboxes = document.querySelectorAll('input[name="compartimentos"]:checked');
        const selectedTags = Array.from(checkboxes).map(cb => cb.value);
        if (document.getElementById('checkbox-outro').checked) {
            const outroTag = document.getElementById('tag-outro-input').value.trim();
            if (outroTag) selectedTags.push(outroTag);
        }
        const compartimentosStr = selectedTags.length > 0 ? selectedTags.join(', ') : null;
        
        const lembreteTitulo = document.getElementById('lembrete-titulo')?.value.trim() || null;
        const lembreteData = document.getElementById('lembrete-data')?.value || null;
        const lembreteKmStr = document.getElementById('lembrete-km')?.value.trim() || null;
        const lembreteKm = lembreteKmStr ? parseInt(lembreteKmStr) : null;
        const lembreteObservacoes = document.getElementById('lembrete-observacoes')?.value.trim() || null;
        const lembreteValorStr = document.getElementById('lembrete-valor')?.value;
        const lembreteValor = lembreteValorStr ? parseFloat(lembreteValorStr) : null;
        const lembreteTipo = document.querySelector('input[name="lembrete_tipo"]:checked')?.value || 'parceiro';
        
        if (lembreteTitulo && !lembreteData && !lembreteKm) {
            throw new Error('Para agendar uma notificação, você deve preencher a Data do Lembrete ou o KM do Lembrete (ou ambos).');
        }
        
        if ((lembreteData || lembreteKm) && currentReminderCountThisMonth >= currentReminderLimit && !currentEditingOsId) {
             throw new Error(`Você atingiu o limite de lembretes do seu plano neste mês (${currentReminderCountThisMonth}/${currentReminderLimit}). Faça um upgrade para agendar mais notificações.`);
        }

        const dbPayload = {
            workshop_id: currentUser.id,
            vehicle_type: document.querySelector('input[name="tipo_veiculo"]:checked').value,
            plate,
            plate_key: plateKey,
            brand: document.getElementById('marca').value.trim(),
            vehicle: document.getElementById('veiculo').value.trim(),
            engine: document.getElementById('motorizacao').value.trim(),
            customer_name: document.getElementById('cliente').value.trim(),
            client_email: clientEmail,
            client_phone: document.getElementById('telefone-cliente')?.value.trim() || null,
            mileage: document.getElementById('km').value.trim(),
            services_done: document.getElementById('servicos').value.trim(),
            compartimentos: compartimentosStr,
            lembrete_titulo: lembreteTitulo,
            lembrete_data: lembreteData,
            lembrete_km: lembreteKm,
            lembrete_observacoes: lembreteObservacoes,
            lembrete_valor: lembreteValor,
            lembrete_tipo: lembreteTipo,
            lembrete_enviado: false,
            lembrete_follow_enviado: false,
            lembrete_clicado: false,
            total_value: parseFloat(document.getElementById('valor').value || 0),
            os_date: document.getElementById('data-os').value,
            status: statusToSave
        };

        if (pdfUrl) dbPayload.pdf_url = pdfUrl;

        let dbError;
        if (currentEditingOsId) {
            const existingOrder = serviceOrders.find(o => String(o.id) === String(currentEditingOsId));
            if (photoUrls.length > 0) {
                const oldPhotos = existingOrder.photos || [];
                dbPayload.photos = [...oldPhotos, ...photoUrls];
            }
            const { error } = await supabase
                .from('service_orders')
                .update(dbPayload)
                .eq('id', currentEditingOsId);
            dbError = error;
        } else {
            if (photoUrls.length > 0) dbPayload.photos = photoUrls;
            const { error } = await supabase
                .from('service_orders')
                .insert(dbPayload);
            dbError = error;
        }

        if (dbError) throw new Error('Erro ao salvar no banco: ' + dbError.message);

        // Atualiza a quilometragem do veículo no banco, se tiver
        const finalKmValue = document.getElementById('km').value.trim();
        if (finalKmValue) {
            await supabase
                .from('vehicles')
                .update({ mileage: finalKmValue })
                .eq('plate_key', plateKey);
        }

        if (!registeredVehicle) {
            const { error: vehicleError } = await supabase.from('vehicles').insert({
                plate_key: plateKey,
                plate,
                client_email: clientEmail,
                customer_name: document.getElementById('cliente').value.trim(),
                brand: document.getElementById('marca').value.trim(),
                vehicle: document.getElementById('veiculo').value.trim(),
                engine: document.getElementById('motorizacao').value.trim(),
                mileage: finalKmValue || null,
                registered_workshop_id: currentUser.id
            });

            if (vehicleError) {
                throw new Error(
                    'OS salva, mas falhou ao registrar o veículo. Execute o SQL da tabela vehicles no Supabase. Detalhe: ' +
                    vehicleError.message
                );
            }

            registeredVehicle = { plate_key: plateKey, client_email: clientEmail };
            setEmailFieldLocked(true, clientEmail);
        }

        const urlDoCliente = getClientUrlByPlate(plateKey);
        await renderQrCodeWithLogo(urlDoCliente, plateKey);

        publicLink.href = urlDoCliente;
        publicLink.textContent = urlDoCliente;
        
        const resultTitle = resultSection.querySelector('h2');
        if (resultTitle) resultTitle.textContent = 'Sucesso! OS Gerada.';
        
        resultSection.classList.remove('hidden');
        osForm.style.opacity = '0.5';
        osForm.style.pointerEvents = 'none';
        // Expande o grid para 2 colunas quando o QR aparece
        const novaOsGrid = document.getElementById('nova-os-grid');
        if (novaOsGrid) novaOsGrid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
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
    currentEditingOsId = null;
    registeredVehicle = null;
    setEmailFieldLocked(false);
    document.getElementById('btn-submit').textContent = 'Salvar OS Finalizada';
    osForm.style.opacity = '1';
    osForm.style.pointerEvents = 'auto';
    resultSection.classList.add('hidden');
    currentQrCanvas = null;
    // Volta o grid para 1 coluna
    const novaOsGrid = document.getElementById('nova-os-grid');
    if (novaOsGrid) novaOsGrid.style.gridTemplateColumns = '';
});

document.getElementById('placa').addEventListener('blur', (event) => {
    loadRegisteredVehicle(event.target.value);
});

document.getElementById('email-cliente')?.addEventListener('blur', async (event) => {
    const emailValue = normalizeEmail(event.target.value);
    if (!emailValue || !emailValue.includes('@') || !currentUser) return;

    const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('client_email', emailValue)
        .eq('registered_workshop_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!error && data) {
        if (!document.getElementById('cliente').value.trim() && data.customer_name) {
            document.getElementById('cliente').value = data.customer_name;
        }
    }
});

document.getElementById('btn-alterar-email')?.addEventListener('click', () => {
    const plateKey = normalizePlate(document.getElementById('placa').value);
    if (!plateKey || !registeredVehicle) {
        alert('Informe uma placa já cadastrada para alterar o e-mail.');
        return;
    }
    changeRegisteredVehicleEmail(plateKey);
});

configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar-config');
    const originalText = btnSalvar.textContent;
    btnSalvar.textContent = 'Salvando...';
    btnSalvar.disabled = true;

    try {
        const nome = document.getElementById('config-nome').value.trim();
        const whatsapp = document.getElementById('config-whatsapp').value.trim();
        const instagram = document.getElementById('config-instagram').value.trim();
        const googleReview = document.getElementById('config-google-review') ? document.getElementById('config-google-review').value.trim() : '';
        const cpfCnpj = document.getElementById('config-cpf-cnpj') ? document.getElementById('config-cpf-cnpj').value.replace(/\D/g, '') : '';
        
        let enderecoToSave = '';
        let addressSearchQuery = '';
        
        const rRua = document.getElementById('config-rua');
        if (rRua) {
            const rua = rRua.value.trim();
            const num = document.getElementById('config-numero').value.trim();
            const bairro = document.getElementById('config-bairro').value.trim();
            const cidade = document.getElementById('config-cidade').value.trim();
            const uf = document.getElementById('config-uf').value.trim();
            
            if (rua && num && bairro && cidade && uf) {
                enderecoToSave = JSON.stringify({ rua, numero: num, bairro, cidade, uf });
                addressSearchQuery = `${rua}, ${num}, ${bairro}, ${cidade}, ${uf}, Brasil`;
            } else if (rua || num || bairro || cidade || uf) {
                throw new Error('Preencha todos os campos do endereço (Rua, Número, Bairro, Cidade e Estado).');
            }
        } else {
            const rEndereco = document.getElementById('config-endereco');
            enderecoToSave = rEndereco ? rEndereco.value.trim() : '';
            addressSearchQuery = enderecoToSave;
        }

        const corPrincipal = document.getElementById('config-cor-principal').value;
        const corBotoes = document.getElementById('config-cor-botoes').value;
        const corFundo = document.getElementById('config-cor-fundo').value;
        const corFundoPainel = document.getElementById('config-cor-fundo-painel').value;
        const corTextoPainel = document.getElementById('config-cor-texto-painel').value;
        const logoInput = document.getElementById('config-logo');
        
        let logoUrl = currentLogoUrl;

        if (logoInput.files && logoInput.files.length > 0) {
            const originalFile = logoInput.files[0];
            const file = await resizeImage(originalFile, 500, 500, 0.9);
            const nomeLimpo = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `${Date.now()}_logo_${nomeLimpo}`;

            const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file);
            if (uploadError) throw new Error('Erro no upload da logo: ' + uploadError.message);

            const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
            logoUrl = publicUrlData.publicUrl;
        }
        
        const qrType = document.querySelector('input[name="config-qr-type"]:checked')?.value || 'text';
        const qrText = document.getElementById('config-qr-text') ? document.getElementById('config-qr-text').value.trim() : '';
        const qrLogoInput = document.getElementById('config-qr-logo');
        let qrLogoUrl = currentQrLogoUrl;

        if (qrLogoInput && qrLogoInput.files && qrLogoInput.files.length > 0) {
            const originalFile = qrLogoInput.files[0];
            const file = await resizeImage(originalFile, 300, 300, 0.9);
            const nomeLimpo = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `${Date.now()}_qrlogo_${nomeLimpo}`;

            const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file);
            if (uploadError) throw new Error('Erro no upload do ícone QR: ' + uploadError.message);

            const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(fileName);
            qrLogoUrl = publicUrlData.publicUrl;
        }

        let updatePayload = {
            name: nome,
            whatsapp: whatsapp,
            instagram: instagram,
            google_review_url: googleReview,
            theme_color: corPrincipal,
            button_color: corBotoes,
            bg_color: corFundo,
            panel_bg_color: corFundoPainel,
            panel_text_color: corTextoPainel,
            logo_url: logoUrl,
            address: enderecoToSave,
            cpf_cnpj: cpfCnpj,
            qr_center_type: qrType,
            qr_center_text: qrText,
            qr_logo_url: qrLogoUrl
        };

        if (enderecoToSave && enderecoToSave !== currentAddress && addressSearchQuery) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearchQuery)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    updatePayload.lat = parseFloat(data[0].lat);
                    updatePayload.lng = parseFloat(data[0].lon);
                } else {
                    alert('Não conseguimos encontrar a localização exata deste endereço no mapa automaticamente. Verifique se digitou a rua, número, cidade e estado corretamente.');
                }
            } catch (err) {
                console.error('Erro ao buscar coordenadas:', err);
            }
        }

        const { error } = await supabase
            .from('workshops')
            .update(updatePayload)
            .eq('id', currentUser.id);

        if (error) throw new Error('Erro ao salvar configurações: ' + error.message);

        currentWorkshopName = nome;
        currentWhatsapp = whatsapp;
        currentInstagram = instagram;
        currentGoogleReview = googleReview;
        currentAddress = enderecoToSave;
        currentCpfCnpj = cpfCnpj;
        currentThemeColor = corPrincipal;
        currentButtonColor = corBotoes;
        currentBgColor = corFundo;
        currentPanelBgColor = corFundoPainel;
        currentPanelTextColor = corTextoPainel;
        currentLogoUrl = logoUrl;
        currentQrCenterType = qrType;
        currentQrCenterText = qrText;
        currentQrLogoUrl = qrLogoUrl;
        
        applyTheme();
        renderServiceOrders(buscaOs.value); // Re-render to update buttons color

        alert('Configurações salvas com sucesso!');
    } catch (error) {
        console.error(error);
        alert(error.message);
    } finally {
        btnSalvar.textContent = originalText;
        btnSalvar.disabled = false;
    }
});

document.getElementById('config-qr-logo')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('qr-logo-preview');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            document.getElementById('qr-logo-placeholder').classList.add('hidden');
            updateQrCenterPreview();
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('config-qr-text')?.addEventListener('input', updateQrCenterPreview);

document.querySelectorAll('input[name="config-qr-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'logo') {
            document.getElementById('qr-text-container')?.classList.add('hidden');
            document.getElementById('qr-logo-container')?.classList.remove('hidden');
        } else {
            document.getElementById('qr-text-container')?.classList.remove('hidden');
            document.getElementById('qr-logo-container')?.classList.add('hidden');
        }
        updateQrCenterPreview();
    });
});

async function updateQrCenterPreview() {
    const canvas = document.getElementById('qr-center-preview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const boxSize = canvas.width;
    
    // Gerar QR falso
    const tempContainer = document.createElement('div');
    new QRCode(tempContainer, {
        text: 'https://exemplo.com.br/qr',
        width: boxSize,
        height: boxSize,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M 
    });
    
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const qrSource = tempContainer.querySelector('canvas, img');
    if (qrSource) {
        ctx.drawImage(qrSource, 0, 0, boxSize, boxSize);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, boxSize, boxSize);
    }
    
    // Desenhar o miolo
    const scaleFactor = boxSize / 240;
    const centerBoxW = boxSize * (68 / 240);
    const x = (boxSize - centerBoxW) / 2;
    const y = (boxSize - centerBoxW) / 2;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, centerBoxW, centerBoxW);
    
    const qrType = document.querySelector('input[name="config-qr-type"]:checked')?.value || 'text';
    
    if (qrType === 'logo') {
        const previewImg = document.getElementById('qr-logo-preview');
        if (previewImg && previewImg.src && !previewImg.src.endsWith(window.location.host + '/')) {
            try {
                const img = await loadImage(previewImg.src);
                const padding = 2 * scaleFactor;
                ctx.drawImage(img, x + padding, y + padding, centerBoxW - (padding*2), centerBoxW - (padding*2));
            } catch(e) {}
        }
    } else {
        const textInput = document.getElementById('config-qr-text');
        const companyName = (textInput && textInput.value.trim()) ? textInput.value.trim() : (currentWorkshopName || 'Oficina');
        
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'middle';
        
        const maxWidth = centerBoxW - (4 * scaleFactor);
        const maxHeight = centerBoxW - (8 * scaleFactor);
        const cx = boxSize / 2;
        const cy = boxSize / 2;

        let fontSize = 16 * scaleFactor;
        let lines = [];
        
        while (fontSize > 4) {
            ctx.font = `900 ${fontSize}px sans-serif`;
            const words = companyName.split(' ');
            lines = [];
            let currentLine = words[0] || '';
            
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + ' ' + word).width;
                if (width < maxWidth) {
                    currentLine += ' ' + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            
            const lineHeight = fontSize * 1.1;
            const totalHeight = lines.length * lineHeight;
            let allLinesFitWidth = lines.every(line => ctx.measureText(line).width <= maxWidth);
            
            if (totalHeight <= maxHeight && allLinesFitWidth) {
                break;
            }
            fontSize -= 1;
        }

        ctx.font = `900 ${fontSize}px sans-serif`;
        const lineHeight = fontSize * 1.1;
        const totalHeight = lines.length * lineHeight;
        let startY = cy - (totalHeight / 2) + (lineHeight / 2);
        
        for (let line of lines) {
            ctx.fillText(line, cx, startY);
            startY += lineHeight;
        }
    }
}

checkAuth();

// ══════════════════════════════════════════════════════════════
// OPORTUNIDADES — Clientes para Contatar
// ══════════════════════════════════════════════════════════════

let oportunidadesData = []; // cache dos dados carregados

window.loadOportunidades = async function() {
    if (!currentUser) return;

    // Reseta UI
    document.getElementById('oport-loading').classList.remove('hidden');
    document.getElementById('oport-list')?.classList.add('hidden');
    document.getElementById('oport-empty')?.classList.add('hidden');
    document.getElementById('oport-stats')?.classList.add('hidden');

    try {
        // 1. Busca todas as OS desta oficina — tenta com client_phone, se falhar busca sem
        let orders, ordErr;
        ({ data: orders, error: ordErr } = await supabase
            .from('service_orders')
            .select('plate_key, plate, customer_name, client_phone, mileage, os_date, brand, vehicle')
            .eq('workshop_id', currentUser.id)
            .order('os_date', { ascending: false }));

        if (ordErr) {
            // Tenta sem client_phone (caso a coluna não exista)
            ({ data: orders, error: ordErr } = await supabase
                .from('service_orders')
                .select('plate_key, plate, customer_name, mileage, os_date, brand, vehicle')
                .eq('workshop_id', currentUser.id)
                .order('os_date', { ascending: false }));
        }

        if (ordErr) throw ordErr;

        // 2. Busca os veículos para pegar o KM atual (ignora erro se coluna mileage não existir)
        const { data: vehicles } = await supabase
            .from('vehicles')
            .select('plate_key, mileage');

        // 3. Busca TODO o histórico de contatos desta oficina (sem limite de data)
        const { data: contactLogs, error: logErr } = await supabase
            .from('contact_log')
            .select('plate_key, contacted_at, method')
            .eq('workshop_id', currentUser.id)
            .order('contacted_at', { ascending: false });

        // Se contact_log não existir, ignora silenciosamente
        const logsMap = {};
        if (!logErr && contactLogs) {
            contactLogs.forEach(log => {
                if (!logsMap[log.plate_key]) logsMap[log.plate_key] = [];
                logsMap[log.plate_key].push(log);
            });
        }

        // 4. Busca quais clientes ativaram notificações push
        const { data: pushSubs } = await supabase
            .from('push_subscriptions')
            .select('client_email');
        const pushEmailSet = new Set();
        (pushSubs || []).forEach(p => {
            if (p.client_email) pushEmailSet.add(p.client_email.trim().toLowerCase());
        });

        // 5. Busca os emails dos veículos desta oficina (para checar push)
        const { data: vehiclesFull } = await supabase
            .from('vehicles')
            .select('plate_key, mileage, client_email');

        // 6. Deduplica por placa (pega a OS mais recente de cada placa)
        const vehiclesMap = {};
        const vehicleEmailMap = {};
        (vehiclesFull || []).forEach(v => {
            if (v.mileage) vehiclesMap[v.plate_key] = v.mileage;
            if (v.client_email) vehicleEmailMap[v.plate_key] = v.client_email.toLowerCase();
        });
        // Fallback: also try from vehicles without mileage column
        if ((vehiclesFull || []).length === 0) {
            (vehicles || []).forEach(v => { if (v.mileage) vehiclesMap[v.plate_key] = v.mileage; });
        }

        const seenPlates = new Set();
        const combined = [];

        for (const order of (orders || [])) {
            if (!order.plate_key || seenPlates.has(order.plate_key)) continue;
            seenPlates.add(order.plate_key);

            const lastOsKm  = parseInt(String(order.mileage || '0').replace(/\D/g, '')) || 0;
            // currentKm vem do vehicles.mileage; se não tiver, usa o da última OS (diff = 0)
            const rawCurrentKm = vehiclesMap[order.plate_key];
            const currentKm = rawCurrentKm
                ? (parseInt(String(rawCurrentKm).replace(/\D/g, '')) || lastOsKm)
                : lastOsKm;
            // Garante que diff nunca seja negativo
            const kmDiff = Math.max(0, currentKm - lastOsKm);

            const contactsForPlate = logsMap[order.plate_key] || [];
            const lastContact      = contactsForPlate.length > 0
                ? contactsForPlate.sort((a, b) => new Date(b.contacted_at) - new Date(a.contacted_at))[0]
                : null;

            // Verifica se o cliente ativou push notifications
            const rawClientEmail = vehicleEmailMap[order.plate_key] || order.client_email;
            const clientEmail = rawClientEmail ? rawClientEmail.trim().toLowerCase() : '';
            const hasPush = clientEmail ? pushEmailSet.has(clientEmail) : false;

            combined.push({
                plate_key:     order.plate_key,
                plate:         order.plate,
                customer_name: order.customer_name,
                client_phone:  order.client_phone,
                brand:         order.brand,
                vehicle:       order.vehicle,
                last_os_date:  order.os_date,
                last_os_km:    lastOsKm,
                current_km:    currentKm,
                km_diff:       kmDiff,
                all_contacts:  contactsForPlate,  // histórico completo
                last_contact:  contactsForPlate.length > 0 ? contactsForPlate[0] : null, // já ordenado desc
                has_push:      hasPush,
                client_email:  clientEmail
            });
        }

        // Ordena pelos que rodaram mais KM (maiores oportunidades)
        combined.sort((a, b) => b.km_diff - a.km_diff);
        oportunidadesData = combined;

        renderOportunidades(combined);

    } catch (err) {
        console.error('Erro ao carregar oportunidades:', err);
        document.getElementById('oport-loading').classList.add('hidden');
        document.getElementById('oport-empty').classList.remove('hidden');
        document.getElementById('oport-empty').querySelector('p.font-semibold').textContent = 'Erro ao carregar dados.';
    }
};

function renderOportunidades(data) {
    const kmMin = parseInt(document.getElementById('oport-km-min').value) || 0;
    const filtered = data.filter(item => item.km_diff >= kmMin);

    document.getElementById('oport-loading').classList.add('hidden');

    if (filtered.length === 0) {
        document.getElementById('oport-list').classList.add('hidden');
        document.getElementById('oport-empty').classList.remove('hidden');
        document.getElementById('oport-stats').classList.add('hidden');
        return;
    }

    const contacted  = filtered.filter(i => i.last_contact);
    const pending    = filtered.filter(i => !i.last_contact);

    // Atualiza contadores
    document.getElementById('oport-stats').classList.remove('hidden');
    document.getElementById('oport-count-total').textContent     = filtered.length;
    document.getElementById('oport-count-pending').textContent   = pending.length;
    document.getElementById('oport-count-contacted').textContent = contacted.length;

    const listEl = document.getElementById('oport-list');
    listEl.innerHTML = '';

    for (const item of filtered) {
        const isContacted = !!item.last_contact;
        const kmDiffLabel = item.km_diff > 0
            ? `+${item.km_diff.toLocaleString('pt-BR')} km desde a última OS`
            : 'KM não atualizado pelo cliente';

        const kmColor = item.km_diff >= 10000 ? 'text-red-600 bg-red-50 border-red-200'
                      : item.km_diff >= 5000  ? 'text-orange-600 bg-orange-50 border-orange-200'
                      : 'text-yellow-700 bg-yellow-50 border-yellow-200';

        const whatsNum = (item.client_phone || '').replace(/\D/g, '');
        const hasWhats = !!whatsNum;
        const whatsMsg = `Olá ${item.customer_name || 'cliente'}! Percebemos que seu ${item.brand || ''} ${item.vehicle || ''} placa ${item.plate || ''} já rodou ${item.km_diff > 0 ? item.km_diff.toLocaleString('pt-BR') + ' km' : 'alguns KM'} desde sua última visita em ${item.last_os_date ? new Date(item.last_os_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}. Que tal agendar uma revisão? \uD83D\uDE0A`;

        const safeMsg = whatsMsg.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const safeName = (item.customer_name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        const whatsBtn = hasWhats
            ? `<button onclick="openContactModal('${item.plate_key}', 'whatsapp', '${safeMsg}', '${whatsNum}', '${safeName}')" class="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm px-4 py-2 rounded-xl transition shadow-sm" title="Contatar por WhatsApp">
                 <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.997 0C5.373 0 0 5.373 0 11.997c0 2.117.554 4.103 1.523 5.83L.06 23.94l6.291-1.448A11.94 11.94 0 0011.997 24C18.62 24 24 18.625 24 11.997 24 5.373 18.62 0 11.997 0zm0 21.818a9.818 9.818 0 01-5.01-1.372l-.36-.214-3.733.859.938-3.62-.234-.373A9.8 9.8 0 012.18 12c0-5.42 4.4-9.82 9.818-9.82 5.42 0 9.82 4.4 9.82 9.82 0 5.42-4.4 9.818-9.82 9.818z"/></svg>
                 WhatsApp
               </button>`
            : `<span class="inline-flex items-center gap-2 bg-gray-200 text-gray-400 font-bold text-sm px-4 py-2 rounded-xl cursor-not-allowed" title="Sem telefone cadastrado">
                 <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.997 0C5.373 0 0 5.373 0 11.997c0 2.117.554 4.103 1.523 5.83L.06 23.94l6.291-1.448A11.94 11.94 0 0011.997 24C18.62 24 24 18.625 24 11.997 24 5.373 18.62 0 11.997 0zm0 21.818a9.818 9.818 0 01-5.01-1.372l-.36-.214-3.733.859.938-3.62-.234-.373A9.8 9.8 0 012.18 12c0-5.42 4.4-9.82 9.818-9.82 5.42 0 9.82 4.4 9.82 9.82 0 5.42-4.4 9.818-9.82 9.818z"/></svg>
                 WhatsApp
               </span>`;

        // Botão Notificação — sempre desativado temporariamente
        const pushBtn = `<span class="inline-flex items-center gap-2 bg-gray-200 text-gray-400 font-bold text-sm px-4 py-2 rounded-xl cursor-not-allowed" title="Em breve">
                   <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                   Notificação
               </span>`;

        const contactBadge = isContacted
            ? `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                   ✅ Contatado em ${new Date(item.last_contact.contacted_at).toLocaleDateString('pt-BR')} via ${item.last_contact.method === 'whatsapp' ? 'WhatsApp' : 'Notificação'}
               </span>`
            : '';

        const actionButtons = isContacted
            ? `<button onclick="recontactClient('${item.plate_key}')" class="text-xs text-gray-400 hover:text-gray-600 underline transition mt-1">Contatar novamente</button>`
            : `<div class="flex gap-2 flex-wrap">${whatsBtn}${pushBtn}</div>`;

        const card = document.createElement('div');
        card.className = `border rounded-2xl p-5 transition ${isContacted ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white hover:shadow-md'}`;

        card.dataset.plateKey = item.plate_key;
        card.dataset.kmDiff = item.km_diff;
        card.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 flex-wrap mb-1">
                        <span class="font-bold text-gray-800 text-base">${item.customer_name || '-'}</span>
                        <span class="bg-gray-100 text-gray-700 font-bold text-xs px-2 py-0.5 rounded font-mono tracking-wider">${item.plate || item.plate_key}</span>
                        ${item.client_phone ? `<span class="text-xs text-gray-500">📱 ${item.client_phone}</span>` : '<span class="text-xs text-orange-400 italic">Sem telefone</span>'}
                    </div>
                    <div class="text-sm text-gray-500">${item.brand || ''} ${item.vehicle || ''}</div>
                    <div class="mt-2 flex items-center gap-3 flex-wrap">
                        <span class="inline-flex items-center gap-1 border rounded-full px-3 py-1 text-xs font-bold ${kmColor}">
                            ⚡ ${kmDiffLabel}
                        </span>
                        <span class="text-xs text-gray-400">Última OS: ${item.last_os_date ? new Date(item.last_os_date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} (${item.last_os_km.toLocaleString('pt-BR')} km)</span>
                    </div>
                    <div class="mt-2">${contactBadge}</div>
                </div>
                <div class="flex flex-col items-start md:items-end gap-2 flex-shrink-0">
                    ${actionButtons}
                </div>
            </div>
            ${item.all_contacts && item.all_contacts.length > 0 ? `
            <div class="mt-3 pt-3 border-t border-gray-100">
                <button onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('span.arrow').textContent = this.nextElementSibling.classList.contains('hidden') ? '▼' : '▲'"
                        class="text-xs text-gray-400 hover:text-gray-600 font-semibold flex items-center gap-1 transition">
                    <span class="arrow">▼</span> Histórico de contatos (${item.all_contacts.length})
                </button>
                <div class="hidden mt-2 space-y-1">
                    ${item.all_contacts.map(c => `
                        <div class="flex items-center gap-2 text-xs text-gray-500">
                            <span class="${c.method === 'whatsapp' ? 'text-green-500' : 'text-blue-500'} font-bold">${c.method === 'whatsapp' ? '💬 WhatsApp' : '🔔 Notificação'}</span>
                            <span>em ${new Date(c.contacted_at).toLocaleDateString('pt-BR')} às ${new Date(c.contacted_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
        `;
        listEl.appendChild(card);
    }

    listEl.classList.remove('hidden');
    document.getElementById('oport-empty').classList.add('hidden');
}

window.filterOportunidades = function() {
    if (oportunidadesData.length > 0) renderOportunidades(oportunidadesData);
};

window.logContact = async function(plateKey, method) {
    if (!currentUser) return;
    try {
        const now = new Date().toISOString();
        await supabase.from('contact_log').insert({
            workshop_id: currentUser.id,
            plate_key: plateKey,
            method: method,
            contacted_at: now
        });
        // Atualiza o cache local sem recarregar tudo
        const item = oportunidadesData.find(i => i.plate_key === plateKey);
        if (item) {
            const newLog = { plate_key: plateKey, method, contacted_at: now };
            item.all_contacts = [newLog, ...(item.all_contacts || [])];
            item.last_contact = newLog;
        }
        // Atualiza card
        setTimeout(() => renderOportunidades(oportunidadesData), 400);
    } catch(e) {
        console.warn('Erro ao salvar log de contato:', e);
    }
};

window.recontactClient = function(plateKey) {
    // Reseta last_contact localmente para mostrar os botões novamente
    // (não remove do banco — o histórico fica preservado)
    const item = oportunidadesData.find(i => i.plate_key === plateKey);
    if (item) {
        item.last_contact = null;
        renderOportunidades(oportunidadesData);
    }
};

window.openContactModal = function(plateKey, method, defaultMessage, phoneNum, customerName) {
    const modal = document.getElementById('contact-modal');
    const msgInput = document.getElementById('contact-modal-message');
    const title = document.getElementById('contact-modal-title');
    const sendBtn = document.getElementById('contact-modal-send');
    
    msgInput.value = defaultMessage;
    
    if (method === 'whatsapp') {
        title.textContent = 'Enviar WhatsApp';
        sendBtn.className = 'flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2';
        sendBtn.innerHTML = 'Ir para WhatsApp';
        sendBtn.onclick = () => {
            modal.classList.add('hidden');
            logContact(plateKey, 'whatsapp');
            window.open(`https://wa.me/55${phoneNum}?text=${encodeURIComponent(msgInput.value)}`, '_blank');
        };
    } else if (method === 'push') {
        title.textContent = 'Enviar Notificação Push';
        sendBtn.className = 'flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2';
        sendBtn.innerHTML = 'Disparar Notificação';
        sendBtn.onclick = () => {
            modal.classList.add('hidden');
            sendPushToClientWithCustomMessage(plateKey, customerName, msgInput.value);
        };
    }
    
    modal.classList.remove('hidden');
};

async function sendPushToClientWithCustomMessage(plateKey, customerName, customMessage) {
    if (!currentUser) return;

    // Acha o botão original só pra mostrar status "Enviando..."
    const btn = document.querySelector(`[data-plate-key="${plateKey}"] button[onclick*="openContactModal('"]`);
    const originalText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '⏳ Enviando...';
    
    try {
        const item = oportunidadesData.find(i => i.plate_key === plateKey);
        const email = item ? item.client_email : '';
        if (!email) throw new Error('Cliente não possui email registrado para receber Push.');

        const { data: subData, error: subErr } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('client_email', email)
            .limit(1)
            .single();

        if (subErr || !subData) throw new Error('Cliente não possui notificação ativa no aparelho.');

        const payload = {
            plate_key: plateKey,
            email: email,
            customer_name: customerName,
            message: customMessage,
            workshop_id: currentUser.id,
            workshop_name: currentWorkshopName,
            timestamp: new Date().toISOString(),
            subscription: subData.subscription
        };

        const response = await fetch('https://webhook.mareflow.com.br/webhook/bfe2b049-c796-4d98-8e94-cedd636030b1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Falha ao comunicar com o n8n. Verifique se o fluxo está "ouvindo".');

        alert(`✅ Notificação enviada para o n8n com sucesso!`);
        await logContact(plateKey, 'push');

    } catch (e) {
        console.error('Erro push:', e);
        alert(e.message || 'Não foi possível enviar a notificação.');
    } finally {
        if (btn) btn.innerHTML = originalText;
    }
}

// ══════════════════════════════════════════
// SININHO DE LEMBRETES INTERNO
// ══════════════════════════════════════════
window.toggleRemindersModal = function() {
    const modal = document.getElementById('reminders-modal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
        window.loadTodayReminders(true);
    }
};

window.loadTodayReminders = async function(showLoadingInModal = false) {
    if (!currentUser) return;
    
    const badge = document.getElementById('bell-badge');
    const loadingEl = document.getElementById('reminders-loading');
    const emptyEl = document.getElementById('reminders-empty');
    const contentEl = document.getElementById('reminders-content');
    
    if (showLoadingInModal && loadingEl) {
        loadingEl.classList.remove('hidden');
        emptyEl.classList.add('hidden');
        contentEl.classList.add('hidden');
    }

    const todayStr = new Date().toISOString().split('T')[0];

    try {
        const { data, error } = await supabase
            .from('service_orders')
            .select('*')
            .eq('workshop_id', currentUser.id)
            .lte('lembrete_data', todayStr)
            .eq('lembrete_enviado', false)
            .eq('is_deleted', false)
            .order('lembrete_data', { ascending: true });

        if (error) throw error;

        const reminders = data || [];
        
        // Atualiza a bolinha vermelha
        if (badge) {
            if (reminders.length > 0) {
                badge.textContent = reminders.length > 99 ? '99+' : reminders.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Se o modal estiver aberto, renderiza a lista
        if (contentEl && (!document.getElementById('reminders-modal').classList.contains('hidden') || showLoadingInModal)) {
            if (loadingEl) loadingEl.classList.add('hidden');
            
            if (reminders.length === 0) {
                emptyEl.classList.remove('hidden');
                contentEl.classList.add('hidden');
            } else {
                emptyEl.classList.add('hidden');
                contentEl.innerHTML = reminders.map(r => {
                    const dataFormatada = new Date(r.lembrete_data + 'T12:00:00').toLocaleDateString('pt-BR');
                    
                    const whatsNum = (r.client_phone || '').replace(/\D/g, '');
                    const hasWhats = !!whatsNum;
                    const whatsMsg = encodeURIComponent(`Olá ${r.customer_name || 'cliente'}! Passando para lembrar sobre "${r.lembrete_titulo || 'Serviço agendado'}". Podemos agendar a manutenção para o veículo placa ${r.plate}?`);
                    
                    const whatsAction = hasWhats 
                        ? `window.open('https://wa.me/55${whatsNum}?text=${whatsMsg}', '_blank')`
                        : `alert('Cliente não possui telefone/WhatsApp cadastrado na última OS.')`;

                    return `
                        <div class="bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:shadow-md transition">
                            <div class="flex justify-between items-start gap-2 mb-2">
                                <div>
                                    <h4 class="font-bold text-gray-800 text-sm">${r.lembrete_titulo || 'Lembrete sem título'}</h4>
                                    <p class="text-[11px] font-semibold text-purple-600 mb-1">Agendado para: ${dataFormatada}</p>
                                    <p class="text-xs text-gray-600"><span class="font-bold">Cliente:</span> ${r.customer_name || 'N/A'} - <span class="font-bold">Placa:</span> ${r.plate || 'N/A'}</p>
                                </div>
                            </div>
                            ${r.lembrete_observacoes ? `<p class="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg mt-2 mb-3 border border-gray-100 italic">"${r.lembrete_observacoes}"</p>` : ''}
                            
                            <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                                <button onclick="${whatsAction}" class="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition shadow-sm flex items-center justify-center gap-1">
                                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.997 0C5.373 0 0 5.373 0 11.997c0 2.117.554 4.103 1.523 5.83L.06 23.94l6.291-1.448A11.94 11.94 0 0011.997 24C18.62 24 24 18.625 24 11.997 24 5.373 18.62 0 11.997 0zm0 21.818a9.818 9.818 0 01-5.01-1.372l-.36-.214-3.733.859.938-3.62-.234-.373A9.8 9.8 0 012.18 12c0-5.42 4.4-9.82 9.818-9.82 5.42 0 9.82 4.4 9.82 9.82 0 5.42-4.4 9.818-9.82 9.818z"/></svg>
                                    WhatsApp
                                </button>
                                <button onclick="window.markReminderDone('${r.id}')" class="flex-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold py-2 px-3 rounded-lg text-xs transition shadow-sm">
                                    ✅ Concluído
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
                contentEl.classList.remove('hidden');
            }
        }

    } catch (e) {
        console.error('Erro ao buscar lembretes:', e);
        if (loadingEl) {
            loadingEl.innerHTML = '<p class="text-sm text-red-500 py-4">Erro ao carregar lembretes.</p>';
        }
    }
};

window.markReminderDone = async function(osId) {
    if (!currentUser) return;
    
    const btn = event.currentTarget;
    const origHtml = btn.innerHTML;
    btn.innerHTML = '⏳...';
    btn.disabled = true;

    try {
        const { error } = await supabase
            .from('service_orders')
            .update({ lembrete_enviado: true })
            .eq('id', osId)
            .eq('workshop_id', currentUser.id);

        if (error) throw error;
        
        // Recarrega a lista
        await window.loadTodayReminders(true);
    } catch (e) {
        console.error('Erro ao concluir lembrete:', e);
        alert('Erro ao concluir lembrete. Tente novamente.');
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
};

const btnPreviewSininho = document.getElementById('btn-preview-notification');
if (btnPreviewSininho) {
    btnPreviewSininho.addEventListener('click', () => {
        const title = document.getElementById('lembrete-titulo').value.trim() || 'Aviso de Manutenção';
        let dateStr = document.getElementById('lembrete-data').value;
        const kmStr = document.getElementById('lembrete-km').value;
        const obs = document.getElementById('lembrete-observacoes').value.trim();
        
        let dateKmDisplay = '';
        if (dateStr) {
            const d = new Date(dateStr + 'T12:00:00');
            dateKmDisplay += d.toLocaleDateString('pt-BR');
        }
        if (kmStr) {
            if (dateKmDisplay) dateKmDisplay += ' ou ';
            dateKmDisplay += kmStr + ' KM';
        }
        if (!dateKmDisplay) dateKmDisplay = 'DATA / KM';
        
        document.getElementById('preview-title').textContent = title;
        document.getElementById('preview-date-km').textContent = dateKmDisplay;
        
        const obsEl = document.getElementById('preview-obs');
        if (obs) {
            obsEl.textContent = obs;
            obsEl.classList.remove('hidden');
        } else {
            obsEl.classList.add('hidden');
        }
        
        document.getElementById('modal-preview-sininho').classList.remove('hidden');
    });
}
