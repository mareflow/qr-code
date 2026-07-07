import { supabase } from './config.js'

const resetForm = document.getElementById('reset-form');
const newPasswordInput = document.getElementById('new-password');
const btnReset = document.getElementById('btn-reset');
const resetMessage = document.getElementById('reset-message');

// Verifica se o usuário chegou aqui através de um link válido de recuperação
async function checkRecoverySession() {
    // 1. Verifica se tem um código na URL (Fluxo PKCE - padrão atual do Supabase)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    let currentSession = null;

    if (code) {
        // Troca o código por uma sessão válida
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.session) {
            currentSession = data.session;
            // Limpa a URL para remover o código por segurança
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } else {
        // 2. Fluxo Implícito (Hash na URL) ou sessão recém inicializada
        // Aguarda um instante para o supabase-js processar a URL assincronamente
        await new Promise(resolve => setTimeout(resolve, 800));
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
            currentSession = data.session;
        }
    }
    
    if (!currentSession) {
        resetMessage.textContent = 'Link de recuperação inválido ou expirado. Por favor, solicite um novo link na página de login.';
        resetMessage.className = 'mb-6 p-3 rounded-xl text-sm font-semibold text-center border bg-red-50 text-red-700 border-red-200';
        resetMessage.classList.remove('hidden');
        resetForm.style.display = 'none';
    } else {
        resetMessage.classList.add('hidden');
        resetForm.style.display = 'block';
    }
}

checkRecoverySession();

resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newPassword = newPasswordInput.value;
    
    btnReset.textContent = 'Salvando...';
    btnReset.disabled = true;
    resetMessage.classList.add('hidden');

    // O método updateUser atualiza os dados do usuário atualmente logado (pela sessão de recuperação)
    const { data, error } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (error) {
        console.error("Erro ao atualizar senha:", error);
        resetMessage.textContent = 'Ocorreu um erro ao atualizar sua senha. Tente novamente.';
        resetMessage.className = 'mb-6 p-3 rounded-xl text-sm font-semibold text-center border bg-red-50 text-red-700 border-red-200';
        resetMessage.classList.remove('hidden');
        btnReset.textContent = 'Salvar Nova Senha';
        btnReset.disabled = false;
    } else {
        const isClient = data.user.user_metadata && data.user.user_metadata.role === 'cliente';
        
        resetMessage.textContent = isClient 
            ? 'Senha atualizada com sucesso! Redirecionando aos seus veículos...' 
            : 'Senha atualizada com sucesso! Redirecionando ao painel...';
            
        resetMessage.className = 'mb-6 p-3 rounded-xl text-sm font-semibold text-center border bg-green-50 text-green-700 border-green-200';
        resetMessage.classList.remove('hidden');
        
        setTimeout(() => {
            window.location.href = isClient ? 'os.html' : 'painel.html';
        }, 1500);
    }
});


