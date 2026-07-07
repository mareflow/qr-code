// js/login-cliente.js
import { supabase } from './config.js'

// Verifica se já está logado como cliente → redireciona direto
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
        const urlParams = new URLSearchParams(window.location.search)
        const urlPlaca = urlParams.get('placa')

        if (session.user.user_metadata && session.user.user_metadata.role === 'cliente') {
            if (urlPlaca) {
                window.location.href = `os.html?placa=${urlPlaca}`
            } else {
                window.location.href = 'os.html'
            }
        } else {
            // É parceiro tentando acessar a área de cliente
            window.location.href = 'painel.html'
        }
    }
}
checkUser()

const errorMessage = document.getElementById('error-message')
const successMessage = document.getElementById('success-message')
const clienteLoginForm = document.getElementById('cliente-login-form')

const checkSemCarro = document.getElementById('sem-carro')
const placaContainer = document.getElementById('placa-container')
const inputPlaca = document.getElementById('cliente-placa')

// Verifica URL para auto-preencher placa
const urlParams = new URLSearchParams(window.location.search)
const urlPlaca = urlParams.get('placa')

if (checkSemCarro) {
    checkSemCarro.addEventListener('change', (e) => {
        if (e.target.checked) {
            placaContainer.classList.add('hidden')
            inputPlaca.removeAttribute('required')
            inputPlaca.value = ''
        } else {
            placaContainer.classList.remove('hidden')
            inputPlaca.setAttribute('required', 'true')
        }
    })
}

if (urlPlaca && inputPlaca) {
    inputPlaca.value = urlPlaca
}

// === LÓGICA DE LOGIN DO CLIENTE ===
if (clienteLoginForm) {
    clienteLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault()

        const isSemCarro = checkSemCarro && checkSemCarro.checked
        const placaInput = inputPlaca.value.trim().toUpperCase()
        const emailInput = document.getElementById('cliente-email').value.trim().toLowerCase()
        const senhaInput = document.getElementById('cliente-senha').value
        const btnLoginCliente = document.getElementById('btn-cliente-login')
        const plateKey = placaInput.replace(/[^A-Z0-9]/g, '')

        btnLoginCliente.textContent = 'Verificando...'
        btnLoginCliente.disabled = true
        errorMessage.classList.add('hidden')
        successMessage.classList.add('hidden')

        if (!isSemCarro) {
            // Validar se o e-mail pertence à placa
            const { data: isValid, error: verifyError } = await supabase.rpc('verify_vehicle_email', {
                p_plate_key: plateKey,
                p_email: emailInput
            })

            if (verifyError || !isValid) {
                errorMessage.textContent = 'Placa ou E-mail incorretos. Verifique se digitou o e-mail cadastrado na oficina.'
                errorMessage.classList.remove('hidden')
                btnLoginCliente.textContent = 'Acessar Meu Prontuário'
                btnLoginCliente.disabled = false
                return
            }
        } else {
            // Validar se o e-mail existe em algum lugar da base
            const { data: isValid, error: verifyError } = await supabase.rpc('verify_client_email_exists', {
                p_email: emailInput
            })

            if (verifyError || !isValid) {
                errorMessage.textContent = 'E-mail não cadastrado. Você precisa ter ou já ter tido um veículo cadastrado por uma oficina parceira para acessar o sistema.'
                errorMessage.classList.remove('hidden')
                btnLoginCliente.textContent = 'Acessar Meu Prontuário'
                btnLoginCliente.disabled = false
                return
            }
        }

        btnLoginCliente.textContent = 'Autenticando...'

        // Tenta fazer login primeiro
        let { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput,
            password: senhaInput
        })

        if (error && error.message.includes('Invalid login credentials')) {
            // Pode ser primeiro acesso — tenta criar a conta
            btnLoginCliente.textContent = 'Criando acesso...'
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: emailInput,
                password: senhaInput,
                options: {
                    data: { role: 'cliente' }
                }
            })

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    errorMessage.textContent = 'Senha incorreta para este e-mail.'
                } else {
                    errorMessage.textContent = 'Erro ao criar senha: ' + signUpError.message
                }
                errorMessage.classList.remove('hidden')
                btnLoginCliente.textContent = 'Acessar Meu Prontuário'
                btnLoginCliente.disabled = false
                return
            } else if (!signUpData.session) {
                errorMessage.textContent = 'Acesso bloqueado: O Supabase está exigindo confirmação de e-mail. Contate o suporte.'
                errorMessage.classList.remove('hidden')
                btnLoginCliente.textContent = 'Acessar Meu Prontuário'
                btnLoginCliente.disabled = false
                return
            } else {
                data = signUpData
                error = null
            }
        } else if (error) {
            errorMessage.textContent = 'Erro ao acessar: ' + error.message
            errorMessage.classList.remove('hidden')
            btnLoginCliente.textContent = 'Acessar Meu Prontuário'
            btnLoginCliente.disabled = false
            return
        }

        if (!error) {
            if (isSemCarro) {
                const { data: hasVehicle } = await supabase
                    .from('vehicles')
                    .select('plate_key')
                    .eq('client_email', emailInput)
                    .limit(1)

                if (hasVehicle && hasVehicle.length > 0) {
                    await supabase.auth.signOut()
                    errorMessage.textContent = 'Este e-mail já possui um veículo cadastrado. Desmarque "Estou sem carro" e informe sua placa.'
                    errorMessage.classList.remove('hidden')
                    btnLoginCliente.textContent = 'Acessar Meu Prontuário'
                    btnLoginCliente.disabled = false
                    return
                }
            }

            // Marca como cliente se não tiver role
            if (!data.user.user_metadata || !data.user.user_metadata.role) {
                await supabase.auth.updateUser({
                    data: { role: 'cliente' }
                })
            }

            if (isSemCarro) {
                window.location.href = 'os.html'
            } else {
                window.location.href = `os.html?placa=${plateKey}`
            }
        }
    })
}

// === RECUPERAÇÃO DE SENHA ===
const btnForgotPasswordCliente = document.getElementById('btn-forgot-password-cliente')
const forgotPasswordModal = document.getElementById('forgot-password-modal')
const btnCloseModal = document.getElementById('btn-close-modal')
const recoveryForm = document.getElementById('recovery-form')
const btnSendRecovery = document.getElementById('btn-send-recovery')
const recoveryMessage = document.getElementById('recovery-message')

if (btnForgotPasswordCliente) {
    btnForgotPasswordCliente.addEventListener('click', () => {
        forgotPasswordModal.classList.remove('hidden')
    })
}

if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        forgotPasswordModal.classList.add('hidden')
        recoveryMessage.classList.add('hidden')
        recoveryForm.reset()
    })
}

if (forgotPasswordModal) {
    forgotPasswordModal.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            forgotPasswordModal.classList.add('hidden')
            recoveryMessage.classList.add('hidden')
            recoveryForm.reset()
        }
    })
}

if (recoveryForm) {
    recoveryForm.addEventListener('submit', async (e) => {
        e.preventDefault()

        const recoveryEmail = document.getElementById('recovery-email').value.trim().toLowerCase()

        btnSendRecovery.textContent = 'Verificando...'
        btnSendRecovery.disabled = true
        recoveryMessage.classList.add('hidden')

        const { data: role } = await supabase.rpc('get_user_role_by_email', { p_email: recoveryEmail })

        if (role === 'nao_existe') {
            recoveryMessage.textContent = 'E-mail não cadastrado. Você precisa ter ou já ter tido um veículo cadastrado por uma oficina parceira.'
            recoveryMessage.className = 'mb-4 p-3 rounded-lg text-sm text-center font-medium bg-red-50 text-red-700 border border-red-200'
            recoveryMessage.classList.remove('hidden')
            btnSendRecovery.textContent = 'Enviar Link de Recuperação'
            btnSendRecovery.disabled = false
            return
        }

        if (role === 'parceiro') {
            recoveryMessage.textContent = 'Acesso Negado: Este e-mail pertence a uma Oficina Parceira. Acesse pela área de parceiros.'
            recoveryMessage.className = 'mb-4 p-3 rounded-lg text-sm text-center font-medium bg-red-50 text-red-700 border border-red-200'
            recoveryMessage.classList.remove('hidden')
            btnSendRecovery.textContent = 'Enviar Link de Recuperação'
            btnSendRecovery.disabled = false
            return
        }

        btnSendRecovery.textContent = 'Enviando...'

        const redirectToUrl = window.location.origin + '/recuperar.html'

        const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
            redirectTo: redirectToUrl,
        })

        if (error) {
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
}
