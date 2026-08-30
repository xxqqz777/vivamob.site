/**
 * ============================================================
 * VIVAMOB — app.js (Área Pública)
 * ============================================================
 */

const app = {
  state: {
    tempRegister: {},
    currentPage: 'landing'
  },

  async init() {
    const bar = document.querySelector('.loading-bar-fill');
    if (bar) bar.style.animation = 'loadBar 1s ease forwards';

    try {
      await db.init();
    } catch (e) {
      console.warn('IndexedDB não disponível', e);
    }

    // Verifica se já existe sessão ativa → redireciona para área do motorista
    const sessao = await db.getSessao();
    if (sessao && sessao.id && (!sessao.exp || Date.now() < sessao.exp)) {
      setTimeout(() => {
        this.hideLoading();
        window.location.href = 'areamotorista/';
      }, 600);
      return;
    }

    // Verifica erro na URL
    const params = new URLSearchParams(window.location.search);
    const erro = params.get('erro');
    if (erro) {
      setTimeout(() => this.showToast(SEC.escapeHtml(erro), 'error'), 800);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    setTimeout(() => {
      this.hideLoading();
      this.navigate('landing');
    }, 1200);

    this.setupGlobalListeners();
  },

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  setupGlobalListeners() {
    document.getElementById('reg-cpf')?.addEventListener('input', (e) => {
      e.target.value = this.maskCPF(e.target.value);
    });
    document.getElementById('login-cpf')?.addEventListener('input', (e) => {
      e.target.value = this.maskCPF(e.target.value);
    });
    document.getElementById('reg-placa')?.addEventListener('input', (e) => {
      e.target.value = this.maskPlaca(e.target.value);
    });
    document.getElementById('reg-ano')?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
  },

  navigate(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
  },

  maskCPF(valor) {
    return valor.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  maskPlaca(valor) {
    return valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  },

  validarCPF(cpf) {
    const str = cpf.replace(/\D/g, '');
    if (str.length !== 11 || /^(.)(\1){10}$/.test(str)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(str[i - 1]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(str[9])) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(str[i - 1]) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(str[10]);
  },

  validarPlaca(placa) {
    const p = placa.replace(/[^A-Z0-9]/g, '');
    return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p);
  },

  validarAno(ano) {
    const a = parseInt(ano, 10);
    const atual = new Date().getFullYear();
    return !isNaN(a) && a >= 1950 && a <= atual + 1;
  },

  showFieldError(id, msg) {
    const input = document.getElementById(id);
    const err = document.getElementById('err-' + id.replace('reg-', '').replace('login-', ''));
    if (input) input.classList.add('error');
    if (err) err.textContent = msg;
  },

  clearFieldErrors() {
    document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  },

  registerStep1() {
    this.clearFieldErrors();
    const nome = document.getElementById('reg-nome')?.value.trim();
    const cpf = document.getElementById('reg-cpf')?.value.trim();
    const senha = document.getElementById('reg-senha')?.value;

    let ok = true;
    if (!nome) { this.showFieldError('reg-nome', 'Nome completo é obrigatório'); ok = false; }
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) { this.showFieldError('reg-cpf', 'CPF incompleto'); ok = false; }
    else if (!this.validarCPF(cpf)) { this.showFieldError('reg-cpf', 'CPF inválido'); ok = false; }
    if (!senha || senha.length < 4) { this.showFieldError('reg-senha', 'Senha deve ter pelo menos 4 caracteres'); ok = false; }

    if (!ok) return;

    this.state.tempRegister = { nome, cpf, senha };
    this.navigate('register-step2');
  },

  registerStep2() {
    this.clearFieldErrors();
    const marca = document.getElementById('reg-marca')?.value.trim();
    const modelo = document.getElementById('reg-modelo')?.value.trim();
    const ano = document.getElementById('reg-ano')?.value.trim();
    const placa = document.getElementById('reg-placa')?.value.trim();

    let ok = true;
    if (!marca) { this.showFieldError('reg-marca', 'Marca é obrigatória'); ok = false; }
    if (!modelo) { this.showFieldError('reg-modelo', 'Modelo é obrigatório'); ok = false; }
    if (!ano || !this.validarAno(ano)) { this.showFieldError('reg-ano', 'Ano inválido'); ok = false; }
    if (!placa || !this.validarPlaca(placa)) { this.showFieldError('reg-placa', 'Placa inválida (ex: ABC1D23)'); ok = false; }

    if (!ok) return;

    this.state.tempRegister = { ...this.state.tempRegister, marca, modelo, ano, placa };

    document.getElementById('confirm-nome').textContent = SEC.escapeHtml(this.state.tempRegister.nome);
    document.getElementById('confirm-cpf').textContent = this.maskCPF(this.state.tempRegister.cpf).replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '$1.$2.***-**');
    document.getElementById('confirm-marca').textContent = SEC.escapeHtml(marca);
    document.getElementById('confirm-modelo').textContent = SEC.escapeHtml(modelo);
    document.getElementById('confirm-ano').textContent = SEC.escapeHtml(ano);
    document.getElementById('confirm-placa').textContent = this.maskPlaca(placa).replace(/^(...)(.)(..)$/, '$1*-$3');

    this.navigate('register-step3');
  },

  async registerConfirm() {
    try {
      const motorista = await db.cadastrarMotorista(this.state.tempRegister);
      this.state.tempRegister = {};

      document.getElementById('success-id').textContent = motorista.idLocal;
      document.getElementById('success-nome').textContent = SEC.escapeHtml(motorista.nome);
      document.getElementById('success-veiculo').textContent = `${SEC.escapeHtml(motorista.marca)} ${SEC.escapeHtml(motorista.modelo)} ${motorista.ano}`;

      this.navigate('register-success');
      this.showToast('Cadastro realizado com sucesso!', 'success');
    } catch (e) {
      this.showToast('Erro ao cadastrar: ' + SEC.escapeHtml(e.message || 'tente novamente'), 'error');
    }
  },

  async doLogin() {
    this.clearFieldErrors();

    // Rate limit
    const block = SEC.isBlocked();
    if (block && block.blocked) {
      this.showFieldError('login-senha', `Muitas tentativas. Aguarde ${block.minutes} min.`);
      return;
    }

    const cpf = document.getElementById('login-cpf')?.value.trim();
    const senha = document.getElementById('login-senha')?.value;

    let ok = true;
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) { this.showFieldError('login-cpf', 'CPF incompleto'); ok = false; }
    if (!senha) { this.showFieldError('login-senha', 'Senha é obrigatória'); ok = false; }
    if (!ok) return;

    const motorista = await db.autenticar(cpf, senha);
    if (!motorista) {
      SEC.recordAttempt();
      this.showFieldError('login-senha', 'CPF ou senha incorretos');
      return;
    }

    SEC.resetAttempts();
    await db.setSessao(motorista);
    this.showToast(`Bem-vindo, ${SEC.escapeHtml(motorista.nome.split(' ')[0])}!`, 'success');

    // Redireciona para área do motorista
    setTimeout(() => {
      window.location.href = 'areamotorista/';
    }, 600);
  },

  showForgotPassword() {
    this.openModal('Recuperação de senha',
      'Em produção, enviaríamos um link de redefinição para o celular cadastrado.\n\nNenhum dado é enviado para servidores externos.',
      [{ text: 'Entendi', class: 'btn-primary', action: () => this.closeModal() }]
    );
  },

  formatMoney(valor) {
    return 'R$ ' + parseFloat(valor || 0).toFixed(2).replace('.', ',');
  },

  togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? '🙈' : '👁️';
  },

  showToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const iconos = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span>${iconos[tipo] || 'ℹ️'}</span><span>${SEC.escapeHtml(mensagem)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  openModal(titulo, corpo, botoes = []) {
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-body').innerHTML = SEC.escapeHtml(corpo).replace(/\n/g, '<br>');
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    botoes.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `btn ${b.class || 'btn-primary'}`;
      btn.textContent = b.text;
      btn.onclick = () => { b.action(); };
      footer.appendChild(btn);
    });
    document.getElementById('modal-overlay').classList.add('visible');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('visible');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
