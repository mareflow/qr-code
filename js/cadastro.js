// js/cadastro.js
import { supabase } from './config.js'

const SUPABASE_URL = 'https://uzbzvscubbtcqdszkbjd.supabase.co'
const form = document.getElementById('cadastro-form')
const btnSubmit = document.getElementById('btn-submit')
const errorMessage = document.getElementById('error-message')
const paymentArea = document.getElementById('payment-area')

// Mascara de CPF/CNPJ básica
const cpfCnpjInput = document.getElementById('cpf-cnpj')
cpfCnpjInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '')
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2')
        v = v.replace(/(\d{3})(\d)/, '$1.$2')
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    } else {
        v = v.replace(/^(\d{2})(\d)/, '$1.$2')
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2')
        v = v.replace(/(\d{4})(\d)/, '$1-$2')
    }
    e.target.value = v
})

form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const plan = document.querySelector('input[name="plan"]:checked').value
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value
    const nomeOficina = document.getElementById('nome-oficina').value.trim()
    const cpfCnpj = cpfCnpjInput.value.replace(/\D/g, '')
    const email = document.getElementById('email').value.trim().toLowerCase()
    const password = document.getElementById('password').value

    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        showError('CPF ou CNPJ inválido.')
        return
    }

    btnSubmit.textContent = 'Criando conta...'
    btnSubmit.disabled = true
    errorMessage.classList.add('hidden')

    try {
        // 1. Criar usuário no Supabase
        let { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { role: 'parceiro' }
            }
        })

        if (authError) {
            if (authError.message.includes('registered')) {
                // Se já existe, tenta fazer login
                const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                })
                if (loginError) {
                    throw new Error('Esta conta já existe. Se for sua, a senha informada está incorreta.')
                }
                authData = loginData
                await supabase.auth.updateUser({
                    data: { role: 'parceiro' }
                })
            } else {
                throw new Error('Erro ao criar conta: ' + authError.message)
            }
        }
        
        if (!authData.session) throw new Error('Confirmação de e-mail obrigatória no Supabase. Desative para o cadastro fluir.')

        // 2. Criar registro da Oficina e Assinatura forçando pagamento inicial
        const user = authData.session.user || authData.user;
        
        // Vencimento hoje para forçar o primeiro pagamento
        const hoje = new Date();
        const vencimentoStr = hoje.toISOString().split('T')[0];

        // Usar upsert para garantir a criação do perfil da oficina
        const { error: workshopError } = await supabase
            .from('workshops')
            .upsert({
                id: user.id,
                name: nomeOficina,
                cpf_cnpj: cpfCnpj,
                whatsapp: '',
                assinatura_status: 'aguardando_pagamento',
                assinatura_vencimento: vencimentoStr
            }, { onConflict: 'id' });

        if (workshopError) throw new Error('Erro ao criar perfil da oficina: ' + workshopError.message);

        // Inserir assinatura inicial baseada no plano escolhido
        const { data: planoData, error: planoError } = await supabase.from('planos').select('id').eq('nome', plan).single();
        if (planoError) throw new Error('Erro ao buscar plano: ' + planoError.message);

        if (planoData) {
            const { error: assinError } = await supabase.from('assinaturas').insert({
                workshop_id: user.id,
                plano_id: planoData.id,
                status: 'ativo',
                data_inicio: vencimentoStr,
                proximo_vencimento: vencimentoStr
            });
            if (assinError) throw new Error('Erro ao criar assinatura: ' + assinError.message);
        }

        // Redirecionar imediatamente para a tela de pagamento
        window.location.href = 'assinatura.html';

    } catch (err) {
        showError(err.message)
        btnSubmit.textContent = 'Criar Conta'
        btnSubmit.disabled = false
    }
})

function showError(msg) {
    errorMessage.textContent = msg
    errorMessage.classList.remove('hidden')
}

// Polling simples para redirecionar assim que pagar
function startPaymentPolling(userId) {
    setInterval(async () => {
        const { data: workshop } = await supabase
            .from('workshops')
            .select('assinatura_status')
            .eq('id', userId)
            .single()

        if (workshop?.assinatura_status === 'ativo') {
            window.location.href = 'painel.html'
        }
    }, 5000)
}
