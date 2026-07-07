// js/admin.js
import { supabase } from './config.js'

// ═══════════════════════════════════════════════
// ⚙️ CONFIGURAÇÃO — EDITE AQUI
// ═══════════════════════════════════════════════
const ADMIN_EMAIL = 'ia.mareflow@gmail.com'  // E-mail de administrador
const PIX_CHAVE   = '54338791000193'          // Chave PIX (CNPJ)
const PIX_NOME    = 'Tales Ferreira do Amaral' // Nome do recebedor
// ═══════════════════════════════════════════════

let currentUser = null
let oficinas = []
let assinaturas = []
let pagamentos = []
let todasOs = []
let pendingPaymentId = null

// ── INICIALIZAÇÃO ──────────────────────────────
async function init() {
  // Verificar se já há sessão ativa
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    const isAdmin = session.user.user_metadata?.is_admin === true
    const isCorrectEmail = session.user.email === ADMIN_EMAIL

    if (isAdmin && isCorrectEmail) {
      // Já está logado como admin — vai direto para o painel
      currentUser = session.user
      showPanel()
    } else {
      // Sessão existe mas não é admin — desloga e mostra login limpo
      await supabase.auth.signOut()
      showLoginScreen()
    }
  } else {
    // Sem sessão — mostra tela de login
    showLoginScreen()
  }

  // Configurar formulário de login
  document.getElementById('admin-login-form').addEventListener('submit', handleLogin)
}

async function handleLogin(e) {
  e.preventDefault()

  const email    = document.getElementById('admin-email').value.trim()
  const password = document.getElementById('admin-password').value
  const btn      = document.getElementById('btn-admin-login')
  const errDiv   = document.getElementById('login-error')

  // 1ª barreira: verificar e-mail antes de sequer tentar login
  if (email !== ADMIN_EMAIL) {
    showLoginError('⛔ E-mail não autorizado para esta área.')
    return
  }

  btn.textContent = 'Entrando...'
  btn.disabled = true
  errDiv.style.display = 'none'

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  console.log('[Admin Login] Resultado Supabase:', { data, error })

  if (error) {
    btn.textContent = 'Entrar no Painel'
    btn.disabled = false
    // Mostra o erro exato do Supabase para debug
    showLoginError(`🔒 Erro: ${error.message}`)
    return
  }

  // 2ª barreira: verificar flag is_admin no metadata do Supabase
  const isAdmin = data.user.user_metadata?.is_admin === true
  console.log('[Admin Login] Metadata:', data.user.user_metadata, '| is_admin:', isAdmin)

  if (!isAdmin) {
    await supabase.auth.signOut()
    btn.textContent = 'Entrar no Painel'
    btn.disabled = false
    showLoginError('🚫 Conta sem privilégios de admin. Verifique o metadata no Supabase.')
    return
  }

  currentUser = data.user
  showPanel()
}

function showLoginScreen(errorMsg = '') {
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app').style.display = 'none'
  document.getElementById('auth-lock').style.display = 'none'
  if (errorMsg) showLoginError(errorMsg)
}

function showLoginError(msg) {
  const errDiv = document.getElementById('login-error')
  errDiv.textContent = msg
  errDiv.style.display = 'block'
}

async function showPanel() {
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('auth-lock').style.display = 'none'
  document.getElementById('app').style.display = 'block'

  // Preencher dados de PIX
  document.getElementById('pix-key-display').textContent = PIX_CHAVE

  // Preencher data padrão de vencimento (10 dias a partir de hoje)
  const defaultVenc = new Date()
  defaultVenc.setDate(defaultVenc.getDate() + 10)
  document.getElementById('input-vencimento').value = defaultVenc.toISOString().split('T')[0]
  document.getElementById('input-data-pagamento').value = new Date().toISOString().split('T')[0]

  // Preencher mês de referência
  const hoje = new Date()
  document.getElementById('input-referencia').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  await Promise.all([loadOficinas(), loadPagamentos(), loadTodasOs()])
  renderDashboard()
  setupEvents()
}

// ── CARREGAR DADOS ─────────────────────────────
async function loadOficinas() {
  // Buscar oficinas com data de criação do auth
  const { data, error } = await supabase
    .from('workshops')
    .select('*, assinaturas(id, status, data_inicio, proximo_vencimento, planos(nome))')
    .order('criado_em', { ascending: true })

  if (!error) {
    // Filtra o admin da lista — ele nunca deve ser cobrado
    oficinas = (data || []).filter(o => o.id !== currentUser?.id)

    // Carregar assinaturas vinculadas
    const { data: assinData } = await supabase
      .from('assinaturas')
      .select('*, planos(nome, preco_mensal)')
      .order('criado_em', { ascending: false })

    assinaturas = assinData || []
  }
}

async function loadTodasOs() {
  const { data, error } = await supabase
    .from('service_orders')
    .select('id, workshop_id, created_at, photos, pdf_url')

  if (!error) {
    todasOs = data || []
  }
}

async function loadPagamentos() {
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*, workshops(name)')
    .order('criado_em', { ascending: false })

  if (!error) pagamentos = data || []
}

// ── DASHBOARD ─────────────────────────────────
function renderDashboard() {
  const total = oficinas.length
  const ativas = oficinas.filter(o => (o.assinatura_status || 'ativo') === 'ativo').length
  const inadimplentes = oficinas.filter(o => o.assinatura_status === 'inadimplente').length

  const mesAtual = new Date()
  const anoMesAtual = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`
  
  const faturamento = pagamentos
    .filter(p => {
      if (p.status !== 'pago' || !p.data_pagamento) return false
      // data_pagamento comes as "2026-06-16..." or "2026-06-16T..."
      return p.data_pagamento.substring(0, 7) === anoMesAtual
    })
    .reduce((sum, p) => sum + Number(p.valor), 0)

  document.getElementById('stat-total').textContent = total
  document.getElementById('stat-ativas').textContent = ativas
  document.getElementById('stat-inadimplentes').textContent = inadimplentes
  document.getElementById('stat-faturamento').textContent = `R$ ${faturamento.toFixed(2).replace('.', ',')}`

  // Métricas do Sistema
  const mrr = oficinas
    .filter(o => (o.assinatura_status || 'ativo') === 'ativo')
    .reduce((sum, o) => {
      const ass = assinaturas.find(a => a.workshop_id === o.id && a.status === 'ativo') || assinaturas.find(a => a.workshop_id === o.id);
      return sum + (ass?.planos?.preco_mensal || 97.00);
    }, 0);
  const ltv = mrr * 6 // LTV estimado de 6 meses
  const elMrr = document.getElementById('metric-mrr')
  const elLtv = document.getElementById('metric-ltv')
  if (elMrr) elMrr.textContent = `R$ ${mrr.toFixed(2).replace('.', ',')}`
  if (elLtv) elLtv.textContent = `R$ ${ltv.toFixed(2).replace('.', ',')}`

  // Pagamentos recentes
  renderRecentPayments()

  // Preencher select de oficinas no modal
  fillOficinaSelect()
}

function renderRecentPayments() {
  const container = document.getElementById('recent-payments-list')
  const select = document.getElementById('filtro-dashboard-pagamentos')
  const filtro = select ? select.value : 'pendente'

  let filtered = pagamentos
  if (filtro === 'pendente') {
    filtered = pagamentos.filter(p => p.status === 'pendente')
  } else if (filtro === 'pago') {
    filtered = pagamentos.filter(p => p.status === 'pago')
  }

  const recent = filtered.slice(0, 15)

  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💳</div>
      <div class="empty-text">Nenhum pagamento registrado ainda</div>
      <div class="empty-sub">Comece lançando uma cobrança para uma oficina</div>
    </div>`
    return
  }

  container.innerHTML = `<table>
    <thead>
      <tr>
        <th>Oficina</th>
        <th>Valor</th>
        <th>Vencimento</th>
        <th>Status</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${recent.map(p => `
        <tr>
          <td><strong>${p.workshops?.name || '—'}</strong></td>
          <td>R$ ${Number(p.valor).toFixed(2).replace('.', ',')}</td>
          <td>${formatDate(p.data_vencimento)}</td>
          <td>${badgeStatus(p.status)}</td>
          <td>
            ${p.status === 'pendente' ? `<button class="btn btn-success btn-sm" onclick="openConfirmar('${p.id}', '${p.workshops?.name || ''}', ${p.valor}, '${p.data_vencimento}')">✅ Confirmar</button>` : ''}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`
}

// ── OFICINAS ──────────────────────────────────
function renderOficinas() {
  const container = document.getElementById('oficinas-list')
  document.getElementById('oficinas-count').textContent = `${oficinas.length} oficina(s)`

  if (oficinas.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔧</div>
      <div class="empty-text">Nenhuma oficina cadastrada ainda</div>
    </div>`
    return
  }

  container.innerHTML = `<table>
    <thead>
      <tr>
        <th>Oficina</th>
        <th>Cadastro</th>
        <th>Dia de Pgto</th>
        <th>Próx. Vencimento</th>
        <th>Cota O.S</th>
        <th>Consumo Total</th>
        <th>Situação</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${oficinas.map(o => {
        const status = o.assinatura_status || 'ativo'
        const cadastro = o.criado_em ? formatDate(o.criado_em) : '—'

        // Dia do mês de pagamento (baseado no dia de cadastro)
        const diaPagamento = o.criado_em
          ? new Date(o.criado_em).getDate()
          : '—'

        const venc = o.assinatura_vencimento
        let diasInfo = '—'
        let diasCor = 'var(--text2)'
        let diasAtraso = 0

        if (venc) {
          const hoje = new Date()
          hoje.setHours(0,0,0,0)
          const vencDate = new Date(venc + 'T00:00:00')
          const diff = Math.ceil((vencDate - hoje) / (1000 * 60 * 60 * 24))

          if (diff < 0) {
            diasAtraso = Math.abs(diff)
            diasInfo = `${diasAtraso}d atrasado`
            diasCor = 'var(--danger)'
          } else if (diff === 0) {
            diasInfo = '⚡ HOJE'
            diasCor = 'var(--danger)'
          } else if (diff <= 3) {
            diasInfo = `${diff}d (urgente)`
            diasCor = '#f97316'
          } else if (diff <= 7) {
            diasInfo = `${diff}d`
            diasCor = 'var(--warning)'
          } else {
            diasInfo = `${diff}d`
            diasCor = 'var(--success)'
          }
        }

        // Pagamento pendente desta oficina
        const pagPendente = pagamentos.find(p => p.workshop_id === o.id && p.status === 'pendente')

        // Cálculos de O.S e Consumo
        const osDaOficina = todasOs.filter(os => os.workshop_id === o.id)
        
        const mesAtual = new Date()
        const anoMesAtual = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, '0')}`
        const osUsadasMes = osDaOficina.filter(os => os.created_at && os.created_at.substring(0, 7) === anoMesAtual).length
        const osLimit = o.os_limit || 100
        
        // Estimativa de armazenamento
        let totalPhotos = 0
        let totalPdfs = 0
        osDaOficina.forEach(os => {
            if (os.photos && Array.isArray(os.photos)) totalPhotos += os.photos.length
            if (os.pdf_url) totalPdfs += 1
        })
        const consumoMB = (totalPhotos * 0.2) + (totalPdfs * 0.5) // ~200KB por foto, ~500KB por PDF

        return `
        <tr>
          <td>
            <strong>${o.name}</strong>
          </td>
          <td style="font-size:12px; color:var(--text2)">${cadastro}</td>
          <td>
            <span style="background:rgba(99,102,241,0.15);color:#818cf8;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">
              Todo dia ${diaPagamento}
            </span>
          </td>
          <td style="color:${diasCor}; font-weight:600;">
            ${venc ? formatDate(venc) : '—'}
            <div style="font-size:11px; margin-top:2px;">${diasInfo}</div>
          </td>
          <td>
            <div style="font-size:13px; font-weight:bold; color: ${osUsadasMes >= osLimit ? 'var(--danger)' : 'var(--text)'};">${osUsadasMes} / ${osLimit}</div>
          </td>
          <td>
            <div style="font-size:12px; font-weight:600;">${consumoMB.toFixed(1)} MB</div>
            <div style="font-size:10px; color:var(--text3);">${osDaOficina.length} OS totais</div>
          </td>
          <td>${badgeStatus(status)}</td>
          <td style="display:flex; gap:6px; flex-wrap:wrap;">
            ${pagPendente
              ? `<button class="btn btn-success btn-sm" onclick="openConfirmar('${pagPendente.id}', '${o.name.replace(/'/g,"\\'")}', ${pagPendente.valor}, '${pagPendente.data_vencimento}')">✅ Confirmar Pgto</button>`
              : `<span style="font-size:11px;color:var(--text3);">Em dia ✓</span>`
            }
            ${status !== 'bloqueado'
              ? `<button class="btn btn-danger btn-sm" onclick="bloquearOficina('${o.id}', '${o.name.replace(/'/g,"\\'")}')" title="Bloquear">🔒</button>`
              : `<button class="btn btn-success btn-sm" onclick="desbloquearOficina('${o.id}', '${o.name.replace(/'/g,"\\'")}')" title="Desbloquear">🔓</button>`
            }
            <button class="btn btn-ghost btn-sm" style="border:1px solid var(--border);" onclick="alterarCotaOs('${o.id}', '${o.name.replace(/'/g,"\\'")}', ${o.os_limit || 100})" title="Alterar Cota Mensal de O.S">⚙️ Cota</button>
          </td>
        </tr>
      `}).join('')}
    </tbody>
  </table>`
}


// ── PAGAMENTOS ────────────────────────────────
function renderPagamentosSection() {
  const container = document.getElementById('pagamentos-list')

  if (pagamentos.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💳</div>
      <div class="empty-text">Nenhum pagamento registrado ainda</div>
    </div>`
    return
  }

  container.innerHTML = `<table>
    <thead>
      <tr>
        <th>Oficina</th>
        <th>Valor</th>
        <th>Método</th>
        <th>Vencimento</th>
        <th>Pago em</th>
        <th>Status</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>
      ${pagamentos.map(p => `
        <tr>
          <td><strong>${p.workshops?.name || '—'}</strong></td>
          <td>R$ ${Number(p.valor).toFixed(2).replace('.', ',')}</td>
          <td>${p.metodo.toUpperCase()}</td>
          <td>${formatDate(p.data_vencimento)}</td>
          <td>${p.data_pagamento ? formatDateTime(p.data_pagamento) : '—'}</td>
          <td>${badgeStatus(p.status)}</td>
          <td>
            ${p.status === 'pendente' ? `<button class="btn btn-success btn-sm" onclick="openConfirmar('${p.id}', '${p.workshops?.name || ''}', ${p.valor}, '${p.data_vencimento}')">✅ Confirmar</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="deletarPagamento('${p.id}')">🗑️ Excluir</button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`
}

// ── FUNÇÃO DE COBRANÇAS REMOVIDA (Agora as abas foram reorganizadas) ──

// ── MODAL: NOVA COBRANÇA ───────────────────────
function fillOficinaSelect() {
  const select = document.getElementById('select-oficina')
  select.innerHTML = '<option value="">Selecione uma oficina...</option>'
  oficinas.forEach(o => {
    const opt = document.createElement('option')
    opt.value = o.id
    opt.textContent = o.name
    select.appendChild(opt)
  })
}

window.novaCobrancaParaOficina = function(id, nome) {
  document.getElementById('select-oficina').value = id
  openModal('modal-cobranca')
}

let isConfirmandoCobranca = false;
async function confirmarCobranca() {
  if (isConfirmandoCobranca) return;
  isConfirmandoCobranca = true;
  try {
  const workshopId = document.getElementById('select-oficina').value
  const valor = parseFloat(document.getElementById('input-valor').value)
  const vencimento = document.getElementById('input-vencimento').value
  const refMes = document.getElementById('input-referencia').value
  const obs = document.getElementById('input-obs-cobranca').value.trim()

  if (!workshopId || !valor || !vencimento) {
    showToast('⚠️ Preencha todos os campos obrigatórios.', 'warning')
    return
  }

  // Verificar se já existe assinatura para a oficina
  let assinId = assinaturas.find(a => a.workshop_id === workshopId)?.id

  if (!assinId) {
    // Buscar plano padrão
    const { data: planos } = await supabase.from('planos').select('id').limit(1).single()
    if (!planos) { showToast('❌ Nenhum plano cadastrado.', 'error'); return }

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

    if (assinErr) { showToast('❌ Erro ao criar assinatura.', 'error'); return }
    assinId = novaAssin.id
  }

  const { error } = await supabase.from('pagamentos').insert({
    assinatura_id: assinId,
    workshop_id: workshopId,
    valor,
    metodo: 'pix',
    status: 'pendente',
    data_vencimento: vencimento,
    referencia_mes: refMes ? `${refMes}-01` : null,
    observacoes: obs || null
  })

  if (error) {
    showToast('❌ Erro ao lançar cobrança.', 'error')
    return
  }

  // Atualizar status da oficina para inadimplente se venceu
  await supabase.from('workshops').update({
    assinatura_status: 'inadimplente',
    assinatura_vencimento: vencimento
  }).eq('id', workshopId)

  closeModal('modal-cobranca')
  showToast('✅ Cobrança lançada com sucesso!', 'success')
  await Promise.all([loadOficinas(), loadPagamentos()])
  renderDashboard()
  renderCobrancasPendentes()
  } finally {
    isConfirmandoCobranca = false;
  }
}

// ── MODAL: CONFIRMAR PAGAMENTO ─────────────────
window.openConfirmar = function(pagId, nomOficina, valor, vencimento) {
  pendingPaymentId = pagId
  document.getElementById('confirm-oficina-nome').textContent = nomOficina
  document.getElementById('confirm-valor').textContent = `R$ ${Number(valor).toFixed(2).replace('.', ',')}`
  document.getElementById('confirm-vencimento').textContent = formatDate(vencimento)
  document.getElementById('input-data-pagamento').value = new Date().toISOString().split('T')[0]
  openModal('modal-confirmar')
}

let isConfirmingPagamento = false;
async function confirmarPagamento() {
  if (!pendingPaymentId || isConfirmingPagamento) return
  isConfirmingPagamento = true;
  try {

  const dataPag = document.getElementById('input-data-pagamento').value
  const obs = document.getElementById('input-obs-confirmacao').value.trim()

  const { data: pag, error } = await supabase
    .from('pagamentos')
    .update({
      status: 'pago',
      data_pagamento: new Date(dataPag).toISOString(),
      observacoes: obs || null
    })
    .eq('id', pendingPaymentId)
    .select()
    .single()

  if (error) { showToast('❌ Erro ao confirmar pagamento.', 'error'); return }

  // Calcular próximo vencimento (mesmo dia do próximo mês)
  const partes = pag.data_vencimento.split('-') // YYYY-MM-DD
  let ano = parseInt(partes[0], 10)
  let mes = parseInt(partes[1], 10) + 1 // +1 para o próximo mês (1-indexed)
  let dia = parseInt(partes[2], 10)

  if (mes > 12) {
    mes = 1
    ano += 1
  }

  // Lidar com estouro de dias no mês subsequente
  const ultimoDiaProxMes = new Date(ano, mes, 0).getDate()
  if (dia > ultimoDiaProxMes) {
    dia = ultimoDiaProxMes
  }

  const proxVencStr = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  // Atualizar assinatura e status da oficina
  await supabase.from('assinaturas').update({
    status: 'ativo',
    proximo_vencimento: proxVencStr
  }).eq('id', pag.assinatura_id)

  await supabase.from('workshops').update({
    assinatura_status: 'ativo',
    assinatura_vencimento: proxVencStr
  }).eq('id', pag.workshop_id)

  // Criar nova cobrança pendente para o próximo mês
  await supabase.from('pagamentos').insert({
    assinatura_id: pag.assinatura_id,
    workshop_id: pag.workshop_id,
    valor: pag.valor,
    metodo: 'pix',
    status: 'pendente',
    data_vencimento: proxVencStr,
    referencia_mes: proxVencStr.slice(0, 7) + '-01',
    observacoes: 'Mensalidade subsequente — Gerada na confirmação do pagamento anterior'
  })

  closeModal('modal-confirmar')
  showToast('✅ Pagamento confirmado! Assinatura ativa até ' + formatDate(proxVencStr), 'success')
  pendingPaymentId = null
  await Promise.all([loadOficinas(), loadPagamentos()])
  // Remover referências antigas a cobrancasPendentes
  renderDashboard()
  renderPagamentosSection()
  } finally {
    isConfirmingPagamento = false;
  }
}

window.deletarPagamento = async function(id) {
  if (!confirm('Tem certeza que deseja excluir esta cobrança?')) return

  const { error } = await supabase.from('pagamentos').delete().eq('id', id)
  if (error) {
    showToast('❌ Erro ao excluir cobrança.', 'error')
    return
  }

  showToast('✅ Cobrança excluída.', 'success')
  await Promise.all([loadOficinas(), loadPagamentos()])
  renderDashboard()
  renderPagamentosSection()
}

// ── BLOQUEAR / DESBLOQUEAR / COTA ───────────────
window.alterarCotaOs = async function(id, nome, cotaAtual) {
  const novaCotaStr = window.prompt(`Alterar cota mensal de O.S para a oficina:\n${nome}\n\nCota Atual: ${cotaAtual}\n\nDigite a nova cota (ex: 300, 500, 1000):`, cotaAtual)
  if (!novaCotaStr) return

  const novaCota = parseInt(novaCotaStr)
  if (isNaN(novaCota) || novaCota < 0) {
    return showToast('❌ Valor inválido para a cota.', 'error')
  }

  const { error } = await supabase.from('workshops').update({ os_limit: novaCota }).eq('id', id)
  if (error) {
    showToast('❌ Erro ao atualizar cota.', 'error')
  } else {
    showToast(`✅ Cota atualizada para ${novaCota} O.S/mês!`, 'success')
    await loadOficinas()
    renderOficinas()
  }
}

window.bloquearOficina = async function(id, nome) {
  if (!confirm(`Bloquear o acesso de "${nome}"? A oficina será redirecionada para a tela de pagamento.`)) return

  await supabase.from('workshops').update({ assinatura_status: 'bloqueado' }).eq('id', id)
  showToast(`🔒 Oficina "${nome}" bloqueada.`, 'warning')
  await loadOficinas()
  renderOficinas()
  renderDashboard()
}

window.desbloquearOficina = async function(id, nome) {
  if (!confirm(`Reativar o acesso de "${nome}"?`)) return

  await supabase.from('workshops').update({ assinatura_status: 'ativo' }).eq('id', id)
  showToast(`🔓 Oficina "${nome}" reativada.`, 'success')
  await loadOficinas()
  renderOficinas()
  renderDashboard()
}

// ── NAVEGAÇÃO ──────────────────────────────────
function setupEvents() {
  // Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault()
      const section = item.dataset.section
      navigateTo(section)
    })
  })

  // Botões nova cobrança
  document.getElementById('btn-nova-cobranca')?.addEventListener('click', () => openModal('modal-cobranca'))
  document.getElementById('btn-nova-cobranca-2')?.addEventListener('click', () => openModal('modal-cobranca'))

  // Modal cobrança
  document.getElementById('close-modal-cobranca')?.addEventListener('click', () => closeModal('modal-cobranca'))
  document.getElementById('cancel-cobranca')?.addEventListener('click', () => closeModal('modal-cobranca'))
  document.getElementById('confirm-cobranca')?.addEventListener('click', confirmarCobranca)

  // Modal confirmar
  document.getElementById('close-modal-confirmar')?.addEventListener('click', () => closeModal('modal-confirmar'))
  document.getElementById('cancel-confirmar')?.addEventListener('click', () => closeModal('modal-confirmar'))
  document.getElementById('confirm-pagamento')?.addEventListener('click', confirmarPagamento)

  // Copiar PIX
  document.getElementById('btn-copy-pix')?.addEventListener('click', () => {
    navigator.clipboard.writeText(PIX_CHAVE)
    const btn = document.getElementById('btn-copy-pix')
    if (btn) {
      btn.textContent = 'Copiado!'
      btn.classList.add('copied')
      setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied') }, 2000)
    }
  })

  // Filtro de Dashboard
  document.getElementById('filtro-dashboard-pagamentos')?.addEventListener('change', () => {
    renderRecentPayments()
  })

  // Logout — volta para a tela de login do admin
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    showLoginScreen()
  })
}

function navigateTo(section) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'))
  document.querySelector(`[data-section="${section}"]`).classList.add('active')
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.getElementById(`section-${section}`).classList.add('active')

  const titles = {
    dashboard: ['Dashboard', 'Visão geral do negócio'],
    oficinas: ['Oficinas', 'Todas as oficinas cadastradas'],
    pagamentos: ['Pagamentos', 'Histórico completo de pagamentos'],
    configuracoes: ['Configurações', 'Métricas e configurações do sistema']
  }

  document.getElementById('page-title').textContent = titles[section][0]
  document.getElementById('page-subtitle').textContent = titles[section][1]

  if (section === 'oficinas') renderOficinas()
  if (section === 'pagamentos') renderPagamentosSection()
}

// ── HELPERS ────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open') }
function closeModal(id) { document.getElementById(id).classList.remove('open') }

function badgeStatus(status) {
  const map = {
    ativo: 'badge-ativo',
    inadimplente: 'badge-inadimplente',
    bloqueado: 'badge-bloqueado',
    cancelado: 'badge-cancelado',
    pago: 'badge-pago',
    pendente: 'badge-pendente',
    estornado: 'badge-inadimplente'
  }
  const labels = {
    ativo: 'Ativo', inadimplente: 'Inadimplente', bloqueado: 'Bloqueado',
    cancelado: 'Cancelado', pago: 'Pago', pendente: 'Pendente', estornado: 'Estornado'
  }
  return `<span class="badge ${map[status] || ''}">${labels[status] || status}</span>`
}

function formatDate(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

function formatDateTime(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast')
  toast.textContent = msg
  toast.style.display = 'flex'
  toast.style.borderColor = type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : 'var(--danger)'
  setTimeout(() => { toast.style.display = 'none' }, 4000)
}

// ── START ──────────────────────────────────────
init()


