// js/login.js
import { supabase } from './config.js'

// Verifica se já está logado. Se sim, manda pro painel.
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
        window.location.href = 'painel.html'
    }
}
checkUser()

const loginForm = document.getElementById('login-form')
const btnLogin = document.getElementById('btn-login')
const errorMessage = document.getElementById('error-message')

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault() // Evita a página de recarregar
    
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    
    // Altera o botão para mostrar que está carregando
    btnLogin.textContent = 'Entrando...'
    btnLogin.disabled = true
    errorMessage.classList.add('hidden')

    // Tenta fazer o login no Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    })

    if (error) {
        // Se deu erro (senha errada, etc)
        console.error(error)
        errorMessage.textContent = 'E-mail ou senha incorretos. (Verifique o console se o erro persistir)'
        errorMessage.classList.remove('hidden')
        btnLogin.textContent = 'Entrar'
        btnLogin.disabled = false
    } else {
        // Se deu certo, vai pro painel
        window.location.href = 'painel.html'
    }
})