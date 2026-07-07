import { supabase } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const osId = params.get('id');

    if (!osId) {
        showError('Link inválido. Nenhum lembrete especificado.');
        return;
    }

    try {
        const { data: order, error } = await supabase
            .from('service_orders')
            .select('*, workshops(name, logo_url, whatsapp, theme_color, button_color)')
            .eq('id', osId)
            .maybeSingle();

        if (error || !order) {
            showError('Lembrete não encontrado no sistema.');
            return;
        }

        const workshop = order.workshops;
        
        // Marcar o lembrete como clicado
        if (!order.lembrete_clicado) {
            await supabase.from('service_orders').update({ lembrete_clicado: true }).eq('id', osId);
        }

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('lembrete-container').classList.remove('hidden');

        // Preencher informações
        if (workshop.logo_url) {
            document.getElementById('workshop-logo').src = workshop.logo_url;
        } else {
            document.getElementById('workshop-logo-container').innerHTML = `<div class="w-full h-full flex items-center justify-center text-xl font-bold bg-gray-100 text-gray-400">OF</div>`;
        }

        document.getElementById('workshop-name').textContent = workshop.name || 'Oficina Parceira';
        document.getElementById('plate-number').textContent = `VEÍCULO ${order.plate || '-'}`;
        document.getElementById('lembrete-titulo').textContent = order.lembrete_titulo || 'Aviso de Manutenção';
        
        const obsEl = document.getElementById('lembrete-observacoes');
        obsEl.textContent = order.lembrete_observacoes || 'Você tem um serviço pendente agendado para o seu veículo.';

        const valorEl = document.getElementById('lembrete-valor');
        if (order.lembrete_valor && order.lembrete_valor > 0) {
            valorEl.textContent = Number(order.lembrete_valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else {
            document.getElementById('valor-container').classList.add('hidden');
        }

        // Estilos e WhatsApp
        const btnAgendar = document.getElementById('btn-agendar');
        if (workshop.button_color) {
            btnAgendar.style.backgroundColor = workshop.button_color;
        }
        
        // Background gradient
        const bgTheme = workshop.theme_color || '#2563eb';
        document.querySelector('.bg-gradient-to-br').style.background = `linear-gradient(to bottom right, ${bgTheme}, #000000)`;

        btnAgendar.addEventListener('click', () => {
            if (!workshop.whatsapp) {
                alert('A oficina não possui um número de WhatsApp cadastrado.');
                return;
            }
            const phone = String(workshop.whatsapp).replace(/\D/g, '');
            const text = encodeURIComponent(`Olá! Recebi a notificação no app sobre "${order.lembrete_titulo}" e gostaria de agendar meu serviço para o veículo ${order.plate}.`);
            window.open(`https://wa.me/55${phone}?text=${text}`, '_blank');
        });

    } catch (err) {
        console.error(err);
        showError('Ocorreu um erro inesperado ao carregar o lembrete.');
    }
});

function showError(msg) {
    document.getElementById('loading').classList.add('hidden');
    const errContainer = document.getElementById('error-container');
    errContainer.classList.remove('hidden');
    document.getElementById('error-message').textContent = msg;
}
