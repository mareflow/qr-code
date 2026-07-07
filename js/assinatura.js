// js/assinatura.js
import { supabase } from './config.js'

// ═══════════════════════════════════════════════
// ⚙️ CONFIGURAÇÃO
// ═══════════════════════════════════════════════
const SUPABASE_URL = 'https://uzbzvscubbtcqdszkbjd.supabase.co'
// ═══════════════════════════════════════════════

let workshopId = null
let currentSession = null
let currentWorkshopName = 'Oficina Parceira'

// ─── ASAAS: Garantir que a oficina tem customer_id ───────────────────
async function asaasEnsureCustomer(workshopName) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-create-customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ name: workshopName })
    })
    const data = await res.json()
    if (data.error) console.warn('Asaas customer:', data.error)
    return data.customerId || null
  } catch (err) {
    console.error('Erro ao criar cliente Asaas:', err)
    return null
  }
}

// ─── ASAAS: Gerar cobrança PIX real ──────────────────────────────────
async function asaasGerarCobranca(pagamentoId, valor, vencimento) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-create-charge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ pagamentoId, valor, vencimento })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

async function init() {
  const btnSairBloqueado = document.getElementById('btn-sair-bloqueado')
  if (btnSairBloqueado) {
    btnSairBloqueado.addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.replace('index.html')
    })
  }

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    window.location.replace('index.html')
    return
  }

  currentSession = session
  workshopId = session.user.id

  await renderAssinatura()
}

async function renderAssinatura() {
  const container = document.getElementById('main-content')

  // Buscar dados da oficina (fonte primária de verdade)
  const { data: workshop } = await supabase
    .from('workshops')
    .select('name, assinatura_status, assinatura_vencimento, criado_em')
    .eq('id', workshopId)
    .single()

  // Guardar nome da oficina globalmente para uso no Asaas
  if (workshop?.name) currentWorkshopName = workshop.name

  // Buscar assinatura
  const { data: assinaturas } = await supabase
    .from('assinaturas')
    .select('*, planos(nome, preco_mensal)')
    .eq('workshop_id', workshopId)
    .order('criado_em', { ascending: false })
    .limit(1)

  const assinatura = assinaturas?.[0] || null

  // Buscar histórico de pagamentos
  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select('*, invoice_url')
    .eq('workshop_id', workshopId)
    .order('data_vencimento', { ascending: false })

  const status = workshop?.assinatura_status || 'ativo'
  const vencimento = workshop?.assinatura_vencimento || null

  // Calcular dias para vencimento
  let diasParaVencer = null
  if (vencimento) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    // Usar T00:00:00 para evitar erro de fuso horário UTC
    const venc = new Date(vencimento.split('T')[0] + 'T00:00:00')
    diasParaVencer = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24))
  }

  // A tela de bloqueio (blocked-screen) manual foi removida para permitir que o usuário
  // use a interface interativa de assinaturas e gere o pagamento via Asaas
  // Definir estado do status card — usa workshops como fonte de verdade
  let cardClass, icon, statusTitulo, statusDesc
  if (status === 'bloqueado') {
    cardClass = 'inadimplente'
    icon = '🔒'
    statusTitulo = 'Acesso Suspenso'
    statusDesc = 'Seu acesso foi suspenso por falta de pagamento. Efetue o PIX abaixo para reativar.'
  } else if (status === 'inadimplente' || (diasParaVencer !== null && diasParaVencer < 0)) {
    cardClass = 'inadimplente'
    icon = '⚠️'
    statusTitulo = 'Pagamento em Atraso'
    const diasAtraso = diasParaVencer !== null ? Math.abs(diasParaVencer) : '?'
    statusDesc = `Sua mensalidade está ${diasAtraso} dia(s) em atraso. Regularize via PIX abaixo para não ter seu acesso suspenso.`
  } else if (diasParaVencer !== null && diasParaVencer <= 3) {
    cardClass = 'inadimplente_aviso'
    icon = '🔴'
    statusTitulo = diasParaVencer === 0 ? 'Vence Hoje!' : `Vence em ${diasParaVencer} dia(s)`
    statusDesc = 'Efetue o pagamento agora para garantir continuidade do serviço sem interrupções.'
  } else if (diasParaVencer !== null && diasParaVencer <= 7) {
    cardClass = 'inadimplente_aviso'
    icon = '⏰'
    statusTitulo = 'Vencimento Próximo'
    statusDesc = `Sua mensalidade vence em ${diasParaVencer} dia(s) (${formatDate(vencimento)}). Organize-se com antecedência!`
  } else if (status === 'aguardando_pagamento') {
    cardClass = 'inadimplente_aviso'
    icon = '⏳'
    statusTitulo = 'Aguardando Pagamento'
    statusDesc = 'Efetue o pagamento da primeira mensalidade abaixo para liberar o seu acesso ao painel.'
  } else {
    cardClass = 'ativo'
    icon = '✅'
    statusTitulo = 'Assinatura Ativa'
    statusDesc = 'Todos os serviços estão operando normalmente. Sua assinatura está ativa e em dia. Próximo vencimento em ' + (diasParaVencer !== null ? `${diasParaVencer} dias` : formatDate(vencimento) || '—') + '.'
  }

  // Year selection logic
  window.selectedYear = window.selectedYear || new Date().getFullYear().toString()
  const currentYearStr = new Date().getFullYear().toString()
  
  // Extract unique years from payments + current year
  const yearsSet = new Set([currentYearStr])
  if (pagamentos && pagamentos.length > 0) {
    pagamentos.forEach(p => {
      const ref = p.referencia_mes || p.data_vencimento
      if (ref) yearsSet.add(ref.substring(0, 4))
    })
  }
  // Let's add next year too just in case
  yearsSet.add((new Date().getFullYear() + 1).toString())
  
  const uniqueYears = Array.from(yearsSet).sort()

  // Montar HTML
  container.innerHTML = `
    <!-- STATUS CARD -->
    <div class="status-card ${cardClass}">
      <div class="status-glow"></div>
      <div class="status-icon">${icon}</div>
      <div class="status-label">Status da Assinatura</div>
      <div class="status-title">${statusTitulo}</div>
      <div class="status-desc">${statusDesc}</div>
    </div>

    <!-- INFO GRID -->
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label" style="display:flex; justify-content:space-between; align-items:center;">
          Modelo de Cobrança
          ${assinatura?.asaas_subscription_id ? '<button id="btn-cancel-sub" style="background:transparent; color:var(--danger); border:1px solid var(--danger); padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:bold;">Cancelar Débito Automático</button>' : ''}
        </div>
        <div class="info-value">${assinatura?.asaas_subscription_id ? 'Automático (Cartão)' : 'Avulso (Manual)'}</div>
        <div class="info-sub">${assinatura?.asaas_subscription_id ? 'Cobrado automaticamente no vencimento' : 'Requer pagamento manual a cada ciclo'}</div>
      </div>
      <div class="info-item">
        <div class="info-label" style="display:flex; justify-content:space-between; align-items:center;">
          Plano Atual
          ${assinatura?.planos?.nome === 'Basico' ? '<button id="btn-upgrade" style="background:var(--accent); color:white; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Fazer Upgrade</button>' : ''}
        </div>
        <div class="info-value">${assinatura?.planos?.nome || 'Plano Mensal'}</div>
        <div class="info-sub">${assinatura?.planos?.nome === 'Basico' ? '50 OS e 3 fotos por OS' : 'OS Ilimitadas e 6 fotos por OS'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Mensalidade</div>
        <div class="info-value" style="color:var(--accent)">R$ ${(assinatura?.planos?.preco_mensal || 97).toFixed(2).replace('.', ',')}</div>
        <div class="info-sub">Por mês</div>
      </div>
      <div class="info-item">
        <div class="info-label">Próximo Vencimento</div>
        <div class="info-value" style="color:${diasParaVencer !== null && diasParaVencer <= 3 ? 'var(--danger)' : 'var(--text)'}">
          ${vencimento ? formatDate(vencimento) : '—'}
        </div>
        <div class="info-sub">${diasParaVencer !== null ? (diasParaVencer < 0 ? `${Math.abs(diasParaVencer)} dia(s) atrasado` : diasParaVencer === 0 ? 'Vence hoje' : `Em ${diasParaVencer} dia(s)`) : '—'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Membro Desde</div>
        <div class="info-value">${workshop?.criado_em ? formatDate(workshop.criado_em) : (assinatura?.data_inicio ? formatDate(assinatura.data_inicio) : '—')}</div>
        <div class="info-sub">Data de cadastro na plataforma</div>
      </div>
    </div>

    <!-- HISTÓRICO -->
    <div class="historico-section">
      <div class="historico-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>📋 Mensalidades</div>
        <select id="filtro-ano" style="background:var(--surface2); border:1px solid var(--border); color:var(--text); padding:6px 10px; border-radius:6px; font-size:13px; outline:none; cursor:pointer;">
           ${uniqueYears.map(y => `<option value="${y}" ${y === window.selectedYear ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
      <div id="historico-list">
        ${renderHistorico(pagamentos || [], window.selectedYear, workshop, assinatura)}
      </div>
    </div>
  `

  // Bind events for year select
  document.getElementById('filtro-ano')?.addEventListener('change', (e) => {
    window.selectedYear = e.target.value
    document.getElementById('historico-list').innerHTML = renderHistorico(pagamentos || [], window.selectedYear, workshop, assinatura)
  })

  // Evento de Upgrade
  const btnUpgrade = document.getElementById('btn-upgrade')
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', async () => {
      if (confirm('Deseja fazer o upgrade para o plano Premium (R$ 147/mês)? O valor atualizado será cobrado no próximo pagamento.')) {
        btnUpgrade.textContent = 'Processando...'
        btnUpgrade.disabled = true
        
        // Chamar edge function de upgrade
        const { data: authData } = await supabase.auth.getSession()
        const res = await fetch('https://uzbzvscubbtcqdszkbjd.supabase.co/functions/v1/asaas-upgrade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`
          }
        })

        if (res.ok) {
          alert('Upgrade realizado com sucesso! O novo limite já está ativo.')
          window.location.reload()
        } else {
          alert('Erro ao realizar upgrade. Tente novamente.')
          btnUpgrade.textContent = 'Fazer Upgrade'
          btnUpgrade.disabled = false
        }
      }
    })
  }

  // Evento de Cancelar Recorrência
  const btnCancelSub = document.getElementById('btn-cancel-sub')
  if (btnCancelSub) {
    btnCancelSub.addEventListener('click', async () => {
      if (confirm('Deseja realmente cancelar o débito automático? Seu plano não será cancelado, mas você precisará pagar manualmente via PIX/Cartão nos próximos meses.')) {
        btnCancelSub.textContent = 'Cancelando...'
        btnCancelSub.disabled = true
        
        const { data: authData } = await supabase.auth.getSession()
        const res = await fetch('https://uzbzvscubbtcqdszkbjd.supabase.co/functions/v1/asaas-manage-sub', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`
          },
          body: JSON.stringify({ action: 'cancel' })
        })

        if (res.ok) {
          alert('Débito automático cancelado! Você passará a pagar de forma avulsa.')
          window.location.reload()
        } else {
          alert('Erro ao cancelar débito automático. Tente novamente.')
          btnCancelSub.textContent = 'Cancelar Débito Automático'
          btnCancelSub.disabled = false
        }
      }
    })
  }
  // Copiar PIX Modal (removido, substituído pelo Asaas)
}

function renderHistorico(pagamentos, year, workshop, assinatura) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  let html = ''

  const dataCriacao = workshop?.criado_em ? new Date(workshop.criado_em) : new Date()
  const anoCriacao = dataCriacao.getFullYear()
  const mesCriacao = dataCriacao.getMonth() + 1 // 1-12

  for (let i = 0; i < 12; i++) {
    const currentMonthNum = i + 1
    const currentYear = parseInt(year, 10)

    // Ignore months before the workshop was created
    if (currentYear < anoCriacao) continue
    if (currentYear === anoCriacao && currentMonthNum < mesCriacao) continue

    const monthNumStr = String(currentMonthNum).padStart(2, '0')
    const refPrefix = `${year}-${monthNumStr}`
    
    // Find payment for this month
    const p = pagamentos.find(x => {
       const ref = x.referencia_mes || x.data_vencimento || ''
       return ref.startsWith(refPrefix)
    })

    // Determine if previous month was paid (or is before creation date)
    let isPrevMonthPaid = true
    const prevYear = currentMonthNum === 1 ? currentYear - 1 : currentYear
    const prevMonth = currentMonthNum === 1 ? 12 : currentMonthNum - 1

    const isPrevBeforeCreation = (prevYear < anoCriacao) || (prevYear === anoCriacao && prevMonth < mesCriacao)
    
    if (!isPrevBeforeCreation) {
      const prevMonthNumStr = String(prevMonth).padStart(2, '0')
      const prevRefPrefix = `${prevYear}-${prevMonthNumStr}`
      const prevPay = pagamentos.find(x => {
        const ref = x.referencia_mes || x.data_vencimento || ''
        return ref.startsWith(prevRefPrefix)
      })
      isPrevMonthPaid = !!(prevPay && prevPay.status === 'pago')
    }

    if (p) {
      const badgeClass = p.status === 'pago' ? 'badge-pago' : p.status === 'pendente' ? 'badge-pendente' : 'badge-cancelado'
      const badgeLabel = p.status === 'pago' ? 'Pago' : p.status === 'pendente' ? 'Pendente' : 'Cancelado'
      const dataPag = (p.status === 'pago' && p.data_pagamento) 
         ? `Pago em ${formatDate(p.data_pagamento)}` 
         : `Vence em ${formatDate(p.data_vencimento)}`

      let pagarBtn = ''
      if (p.status === 'pendente') {
        if (isPrevMonthPaid) {
          pagarBtn = `<button onclick="window.abrirModalAsaas('${p.id}', ${p.valor}, '${p.data_vencimento}', '${p.referencia_mes || refPrefix + '-01'}')" style="padding:6px 12px; margin-left:12px; font-size:11px; background:var(--accent); color:white; border-radius:6px; border:none; font-weight:600; cursor:pointer;">Pagar</button>`
        } else {
          pagarBtn = `<span style="margin-left:12px; font-size:11px; color:var(--text3);" title="Pague o mês anterior primeiro">Bloqueado (Pagar anterior)</span>`
        }
      }

      html += `
      <div class="historico-item">
        <div class="historico-left">
          <div class="historico-mes">${meses[i]} / ${year}</div>
          <div class="historico-data">${dataPag}</div>
        </div>
        <div style="display:flex; align-items:center;">
            <div class="historico-valor" style="margin-right:12px;">R$ ${Number(p.valor).toFixed(2).replace('.', ',')}</div>
            <span class="badge ${badgeClass}">${badgeLabel}</span>
            ${pagarBtn}
        </div>
      </div>
      `
    } else {
      if (isPrevMonthPaid) {
        html += `
        <div class="historico-item">
          <div class="historico-left">
            <div class="historico-mes">${meses[i]} / ${year}</div>
            <div class="historico-data" style="color:var(--text3);">Sem cobrança gerada</div>
          </div>
          <div style="display:flex; align-items:center;">
              <div class="historico-valor" style="margin-right:12px; color:var(--text3);">R$ ${(assinatura?.planos?.preco_mensal || 97).toFixed(2).replace('.', ',')}</div>
              <button onclick="window.gerarPagamentoParaMes('${year}', ${currentMonthNum})" style="padding:6px 12px; font-size:11px; background:var(--success); color:white; border-radius:6px; border:none; font-weight:600; cursor:pointer;">Gerar Pagamento</button>
          </div>
        </div>
        `
      } else {
        html += `
        <div class="historico-item" style="opacity:0.5;">
          <div class="historico-left">
            <div class="historico-mes">${meses[i]} / ${year}</div>
            <div class="historico-data">—</div>
          </div>
          <div style="display:flex; align-items:center;">
              <div class="historico-valor" style="margin-right:12px; opacity:0;">R$ 00,00</div>
              <span class="badge" style="background:rgba(255,255,255,0.05); color:var(--text3);">Indisponível</span>
          </div>
        </div>
        `
      }
    }
  }

  return html
}

window.abrirModalAsaas = async function(pagamentoId, valor, vencimento, refMes) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const [y, m] = refMes.split('-')
  const mesFormatado = `${meses[parseInt(m) - 1]} / ${y}`

  // Atualiza modal com estado de loading
  document.getElementById('modal-pix-mes').textContent = `Ref: ${mesFormatado}`
  document.getElementById('modal-pix-valor').textContent = `R$ ${Number(valor).toFixed(2).replace('.', ',')}`

  const modal = document.getElementById('modal-pix')
  modal.style.display = 'flex'

  // Substituir conteúdo do modal por loading + QR Code
  const modalContent = modal.querySelector('.modal-content') || modal.querySelector('div')
  const originalInner = modalContent?.innerHTML || ''

  if (modalContent) {
    modalContent.innerHTML = `
      <div style="text-align:center; padding: 32px;">
        <div style="font-size:14px; font-weight:700; color:var(--text); margin-bottom:8px;">Ref: ${mesFormatado}</div>
        <div style="font-size:22px; font-weight:900; color:var(--accent); margin-bottom:24px;">R$ ${Number(valor).toFixed(2).replace('.', ',')}</div>
        <div id="asaas-loading" style="display:flex; flex-direction:column; align-items:center; gap:12px;">
          <div style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <p style="color:var(--text2); font-size:13px;">Gerando QR Code PIX...</p>
        </div>
        <div id="asaas-qr" style="display:none; flex-direction:column; align-items:center; gap:16px;">
          <p style="font-size:12px; color:var(--text2);">Escaneie o QR Code com seu banco:</p>
          <img id="asaas-qrcode-img" src="" alt="QR Code PIX" style="width:200px;height:200px;border-radius:12px;border:2px solid #e2e8f0;">
          <p style="font-size:11px; color:var(--text3); margin:0;">Ou copie o código abaixo:</p>
          <button id="btn-copy-asaas" class="btn-copy" style="width:100%;">📋 Copiar Código PIX</button>
          <a id="asaas-link" href="#" target="_blank" style="font-size:12px; color:var(--accent); text-decoration:underline;">Abrir fatura no navegador</a>
          <p style="font-size:11px; color:var(--text3);">✅ Após o pagamento, seu acesso é liberado automaticamente em instantes.</p>
        </div>
        <div id="asaas-error" style="display:none; color:#ef4444; font-size:13px; padding:16px;"></div>
        <button onclick="document.getElementById('modal-pix').style.display='none'" style="margin-top:16px; background:none; border:none; color:var(--text3); font-size:13px; cursor:pointer;">Fechar</button>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `
  }

  try {
    // 1. Garantir que a oficina tem um cliente no Asaas
    await asaasEnsureCustomer(currentWorkshopName)

    // 2. Gerar a cobrança PIX
    const charge = await asaasGerarCobranca(pagamentoId, valor, vencimento)

    document.getElementById('asaas-loading').style.display = 'none'
    const qrDiv = document.getElementById('asaas-qr')
    qrDiv.style.display = 'flex'

    if (charge.pixQrCode) {
      document.getElementById('asaas-qrcode-img').src = `data:image/png;base64,${charge.pixQrCode}`
    }

    const btnCopy = document.getElementById('btn-copy-asaas')
    if (charge.pixPayload) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(charge.pixPayload)
        btnCopy.textContent = '✅ Copiado!'
        setTimeout(() => { btnCopy.textContent = '📋 Copiar Código PIX' }, 2500)
      })
    } else {
      btnCopy.style.display = 'none'
    }

    if (charge.paymentLink) {
      document.getElementById('asaas-link').href = charge.paymentLink
    }
  } catch (err) {
    document.getElementById('asaas-loading').style.display = 'none'
    const errDiv = document.getElementById('asaas-error')
    errDiv.style.display = 'block'
    errDiv.textContent = '⚠️ ' + (err.message || 'Erro ao gerar cobrança. Tente novamente.')
  }
}

window.gerarPagamentoParaMes = async function(year, month) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('Sessão expirada. Faça login novamente.')
      window.location.replace('index.html')
      return
    }

    // Buscar dados da oficina (para pegar criado_em)
    const { data: workshop } = await supabase
      .from('workshops')
      .select('criado_em')
      .eq('id', workshopId)
      .single()

    const payDay = workshop?.criado_em ? new Date(workshop.criado_em).getDate() : 16

    // Calcular data de vencimento
    const lastDay = new Date(year, month, 0).getDate()
    const day = Math.min(payDay, lastDay)
    const vencimento = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const refMes = `${year}-${String(month).padStart(2, '0')}-01`

    // Buscar assinatura
    const { data: assinaturas } = await supabase
      .from('assinaturas')
      .select('*, planos(nome, preco_mensal)')
      .eq('workshop_id', workshopId)
      .order('criado_em', { ascending: false })
      .limit(1)

    let assinatura = assinaturas?.[0] || null

    if (!assinatura) {
      // Se não houver assinatura, buscar plano padrão (Basico) e criar
      const { data: planos } = await supabase.from('planos').select('id, preco_mensal').eq('nome', 'Basico').single()
      if (!planos) throw new Error('Plano padrão não encontrado.')

      const { data: novaAssin, error: assinErr } = await supabase
        .from('assinaturas')
        .insert({
          workshop_id: workshopId,
          plano_id: planos.id,
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
          proximo_vencimento: vencimento
        })
        .select()
        .single()

      if (assinErr) throw assinErr
      assinatura = novaAssin
      assinatura.planos = planos
    }

    const valor = assinatura?.planos?.preco_mensal || 97.00

    // Criar pagamento pendente
    const { data: novoPagamento, error: pagErr } = await supabase
      .from('pagamentos')
      .insert({
        assinatura_id: assinatura.id,
        workshop_id: workshopId,
        valor: valor,
        metodo: 'pix',
        status: 'pendente',
        data_vencimento: vencimento,
        referencia_mes: refMes,
        registrado_por: 'cliente',
        observacoes: 'Gerado pelo cliente na página de assinatura'
      })
      .select()
      .single()

    if (pagErr) throw pagErr

    // Recarregar a tela para atualizar a tabela
    await renderAssinatura()

    // Abrir o modal do Asaas para o pagamento gerado
    if (novoPagamento) {
      window.abrirModalAsaas(novoPagamento.id, novoPagamento.valor, novoPagamento.data_vencimento, refMes)
    }

  } catch (error) {
    console.error('Erro ao gerar pagamento:', error)
    alert('Erro ao gerar pagamento: ' + (error.message || error))
  }
}

function formatDate(d) {
  if (!d) return '—'
  const str = typeof d === 'string' ? d.split('T')[0] : d
  const [y, m, day] = str.split('-')
  return `${day}/${m}/${y}`
}

function formatMes(d) {
  if (!d) return '—'
  const str = typeof d === 'string' ? d.split('T')[0] : d
  const [y, m] = str.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(m) - 1]} / ${y}`
}

init()


