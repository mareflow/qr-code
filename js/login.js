// js/login.js
import { supabase } from './config.js'

// Verifica se já está logado. Parceiros vão pro painel, clientes pro prontuário.
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
        if (session.user.user_metadata && session.user.user_metadata.role === 'cliente') {
            window.location.href = 'os.html'
        } else {
            window.location.href = 'painel.html'
        }
    }
}
checkUser()

const loginForm = document.getElementById('login-form')
const btnLogin = document.getElementById('btn-login')
const errorMessage = document.getElementById('error-message')

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault() 
    
    const emailInput = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    
    btnLogin.textContent = 'Entrando...'
    btnLogin.disabled = true
    errorMessage.classList.add('hidden')

    // Tenta fazer o login no Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput,
        password: password,
    })

    if (error) {
        errorMessage.textContent = 'E-mail ou senha incorretos.'
        errorMessage.classList.remove('hidden')
        btnLogin.textContent = 'Entrar no Sistema'
        btnLogin.disabled = false
    } else {
        // === VERIFICAÇÃO DE PORTA ERRADA ===
        const role = data.user.user_metadata?.role;
        if (role === 'cliente') {
            // Auto-heal: verifica se o usuário realmente tem uma oficina cadastrada
            const { data: wsData } = await supabase.from('workshops').select('id').eq('id', data.user.id).single();
            if (wsData) {
                // Restaura o cargo de parceiro
                await supabase.auth.updateUser({
                    data: { role: 'parceiro' }
                });
                window.location.href = 'painel.html';
                return;
            }

            // Se for cliente de verdade tentando entrar como oficina, derrubamos a sessão!
            await supabase.auth.signOut();
            errorMessage.textContent = 'Acesso negado. Você é um cliente. Por favor, utilize a aba "Sou Cliente".'
            errorMessage.classList.remove('hidden')
            btnLogin.textContent = 'Entrar no Sistema'
            btnLogin.disabled = false
            return;
        }

        // Se deu tudo certo e é parceiro, vai pro painel
        window.location.href = 'painel.html'
    }
})

// === RECUPERAÇÃO DE SENHA (Apenas Parceiro) ===
const btnForgotPassword = document.getElementById('btn-forgot-password')
const forgotPasswordModal = document.getElementById('forgot-password-modal')
const btnCloseModal = document.getElementById('btn-close-modal')
const recoveryForm = document.getElementById('recovery-form')
const btnSendRecovery = document.getElementById('btn-send-recovery')
const recoveryMessage = document.getElementById('recovery-message')

// Abrir Modal
if (btnForgotPassword) {
    btnForgotPassword.addEventListener('click', () => {
        forgotPasswordModal.classList.remove('hidden')
    })
}

// Fechar Modal
if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        forgotPasswordModal.classList.add('hidden')
        recoveryMessage.classList.add('hidden')
        recoveryForm.reset()
    })
}

// Fechar Modal clicando fora
forgotPasswordModal.addEventListener('click', (e) => {
    if (e.target === forgotPasswordModal) {
        forgotPasswordModal.classList.add('hidden')
        recoveryMessage.classList.add('hidden')
        recoveryForm.reset()
    }
})

// Enviar E-mail de Recuperação (somente parceiro)
recoveryForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const recoveryEmail = document.getElementById('recovery-email').value.trim().toLowerCase()
    
    btnSendRecovery.textContent = 'Verificando...'
    btnSendRecovery.disabled = true
    recoveryMessage.classList.add('hidden')

    const { data: role } = await supabase.rpc('get_user_role_by_email', { p_email: recoveryEmail });

    if (role === 'nao_existe') {
        recoveryMessage.textContent = 'E-mail não cadastrado.'
        recoveryMessage.className = 'mb-4 p-3 rounded-lg text-sm text-center font-medium bg-red-50 text-red-700 border border-red-200'
        recoveryMessage.classList.remove('hidden')
        btnSendRecovery.textContent = 'Enviar Link de Recuperação'
        btnSendRecovery.disabled = false
        return
    }

    if (role === 'cliente') {
        recoveryMessage.textContent = 'Acesso Negado: Este e-mail pertence a um Cliente. Utilize a página de acesso do motorista para recuperar sua senha.'
        recoveryMessage.className = 'mb-4 p-3 rounded-lg text-sm text-center font-medium bg-red-50 text-red-700 border border-red-200'
        recoveryMessage.classList.remove('hidden')
        btnSendRecovery.textContent = 'Enviar Link de Recuperação'
        btnSendRecovery.disabled = false
        return
    }

    btnSendRecovery.textContent = 'Enviando...'

    const redirectToUrl = window.location.origin + '/recuperar.html'

    const { data, error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: redirectToUrl,
    })

    if (error) {
        console.error("Erro ao enviar email:", error)
        recoveryMessage.textContent = 'Erro ao enviar o e-mail. Verifique se digitou corretamente.'
        recoveryMessage.className = 'mb-4 p-3 rounded-lg text-sm text-center font-medium bg-red-50 text-red-700 border border-red-200'
        recoveryMessage.classList.remove('hidden')
    } else {
        recoveryMessage.textContent = 'Link de recuperação enviado! Verifique sua caixa de entrada ou spam.'
        recoveryMessage.className = 'mb-4 p-3 rounded-lg text-sm text-center font-medium bg-green-50 text-green-700 border border-green-200'
        recoveryMessage.classList.remove('hidden')
        recoveryForm.reset()
    }

    btnSendRecovery.textContent = 'Enviar Link de Recuperação'
    btnSendRecovery.disabled = false
})
