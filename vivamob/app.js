/**
 * ============================================================
 * VIVAMOB — app.js
 * Lógica principal da aplicação SPA
 * ============================================================
 * Este arquivo contém toda a lógica de interface, navegação,
 * validação e interação do usuário. Para produção, substitua
 * as chamadas ao db.js por requisições fetch() a uma API.
 * ============================================================
 */

const app = {
  // Estado da aplicação
  state: {
    motorista: null,
    tempRegister: {},
    currentPage: 'home',
    mapZoom: 1,
    darkMode: false
  },

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================
  async init() {
    // Simula carregamento inicial com skeleton
    const bar = document.querySelector('.loading-bar-fill');
    if (bar) bar.style.animation = 'loadBar 1s ease forwards';

    try {
      await db.init();
    } catch (e) {
      console.warn('IndexedDB não disponível, usando fallback localStorage', e);
    }

    // Verifica sessão ativa
    const sessao = await db.getSessao();
    if (sessao) {
      const motorista = await db.getMotorista(sessao.id);
      if (motorista) {
        this.state.motorista = motorista;
        setTimeout(() => {
          this.hideLoading();
          this.navigate('dashboard');
          this.loadDashboardData();
        }, 800);
        return;
      }
    }

    setTimeout(() => {
      this.hideLoading();
      this.navigate('landing');
    }, 1200);

    // Configura listeners globais
    this.setupGlobalListeners();
  },

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  },

  setupGlobalListeners() {
    // Máscara CPF nos inputs
    document.getElementById('reg-cpf')?.addEventListener('input', (e) => {
      e.target.value = this.maskCPF(e.target.value);
    });
    document.getElementById('login-cpf')?.addEventListener('input', (e) => {
      e.target.value = this.maskCPF(e.target.value);
    });

    // Máscara placa
    document.getElementById('reg-placa')?.addEventListener('input', (e) => {
      e.target.value = this.maskPlaca(e.target.value);
    });

    // Validação ano
    document.getElementById('reg-ano')?.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });

    // Mapa interativo - clique para simular destino
    const mapCanvas = document.getElementById('map-canvas');
    if (mapCanvas) {
      mapCanvas.addEventListener('click', (e) => {
        if (document.getElementById('page-map')?.classList.contains('active')) {
          this.handleMapClick(e);
        }
      });
    }
  },

  // ============================================================
  // NAVEGAÇÃO
  // ============================================================
  navigate(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }

    // Atualiza sidebar e bottom nav
    if (screenId === 'dashboard') {
      this.setPage('home');
    }
  },

  setPage(pageName) {
    this.state.currentPage = pageName;

    // Esconde todas as páginas
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pageName);
    if (target) target.classList.add('active');

    // Atualiza navegação
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageName);
    });

    // Fecha sidebar no mobile
    this.closeSidebar();

    // Carrega dados específicos da página
    if (pageName === 'home') this.loadDashboardData();
    if (pageName === 'rides') this.loadRides();
    if (pageName === 'wallet') this.loadWallet();
    if (pageName === 'fuel') this.loadFuel();
    if (pageName === 'profile') this.loadProfile();
    if (pageName === 'map') this.resetMap();
  },

  // ============================================================
  // SIDEBAR
  // ============================================================
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const isOpen = sidebar?.classList.contains('open');
    sidebar?.classList.toggle('open', !isOpen);
    overlay?.classList.toggle('visible', !isOpen);
  },

  closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
  },

  // ============================================================
  // MÁSCARAS & VALIDAÇÕES
  // ============================================================
  maskCPF(valor) {
    return valor.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  },

  maskPlaca(valor) {
    return valor.toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 7);
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
    // Mercosul ou antiga
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

  // ============================================================
  // CADASTRO — ETAPA 1
  // ============================================================
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

  // ============================================================
  // CADASTRO — ETAPA 2
  // ============================================================
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

    // Preenche resumo
    document.getElementById('confirm-nome').textContent = this.state.tempRegister.nome;
    document.getElementById('confirm-cpf').textContent = this.maskCPF(this.state.tempRegister.cpf).replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '$1.$2.***-**');
    document.getElementById('confirm-marca').textContent = marca;
    document.getElementById('confirm-modelo').textContent = modelo;
    document.getElementById('confirm-ano').textContent = ano;
    document.getElementById('confirm-placa').textContent = this.maskPlaca(placa).replace(/^(...)(.)(..)$/, '$1*-$3');

    this.navigate('register-step3');
  },

  // ============================================================
  // CADASTRO — CONFIRMAÇÃO
  // ============================================================
  async registerConfirm() {
    try {
      const motorista = await db.cadastrarMotorista(this.state.tempRegister);
      this.state.motorista = motorista;
      this.state.tempRegister = {};

      // Preenche tela de sucesso
      document.getElementById('success-id').textContent = motorista.idLocal;
      document.getElementById('success-nome').textContent = motorista.nome;
      document.getElementById('success-veiculo').textContent = `${motorista.marca} ${motorista.modelo} ${motorista.ano}`;

      this.navigate('register-success');
      this.showToast('Cadastro realizado com sucesso!', 'success');
    } catch (e) {
      this.showToast('Erro ao cadastrar: ' + (e.message || 'tente novamente'), 'error');
    }
  },

  // ============================================================
  // LOGIN
  // ============================================================
  async doLogin() {
    this.clearFieldErrors();
    const cpf = document.getElementById('login-cpf')?.value.trim();
    const senha = document.getElementById('login-senha')?.value;

    let ok = true;
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) { this.showFieldError('login-cpf', 'CPF incompleto'); ok = false; }
    if (!senha) { this.showFieldError('login-senha', 'Senha é obrigatória'); ok = false; }
    if (!ok) return;

    const motorista = await db.autenticar(cpf, senha);
    if (!motorista) {
      this.showFieldError('login-senha', 'CPF ou senha incorretos');
      return;
    }

    this.state.motorista = motorista;
    await db.setSessao(motorista);
    this.showToast(`Bem-vindo, ${motorista.nome.split(' ')[0]}!`, 'success');
    this.navigate('dashboard');
    this.loadDashboardData();
  },

  showForgotPassword() {
    this.openModal('Recuperação de senha',
      'Esta é uma demonstração do MVP. Em uma versão de produção, enviaríamos um link de redefinição para o e-mail ou celular cadastrado.\n\nNenhum dado é enviado para servidores externos.',
      [{ text: 'Entendi', class: 'btn-primary', action: () => this.closeModal() }]
    );
  },

  // ============================================================
  // DASHBOARD
  // ============================================================
  async loadDashboardData() {
    const m = this.state.motorista;
    if (!m) return;

    document.getElementById('dash-nome').textContent = m.nome.split(' ')[0];
    document.getElementById('dash-avatar').textContent = m.nome.charAt(0).toUpperCase();
    document.getElementById('card-saldo').textContent = this.formatMoney(m.saldo);
    document.getElementById('card-corridas').textContent = m.corridasRealizadas;
    document.getElementById('card-ganhos').textContent = this.formatMoney(m.ganhosTotal);

    // Verifica se há corrida pendente
    const corridas = await db.getCorridasMotorista(m.id);
    const pendente = corridas.find(c => c.status === 'pending');
    document.getElementById('card-proxima').textContent = pendente
      ? `${pendente.passageiro} — ${pendente.embarque}`
      : 'Nenhuma corrida disponível';
  },

  // ============================================================
  // CORRIDAS
  // ============================================================
  async loadRides() {
    const m = this.state.motorista;
    if (!m) return;

    const corridas = await db.getCorridasMotorista(m.id);
    const container = document.getElementById('rides-list');
    const empty = document.getElementById('rides-empty');

    if (!corridas || corridas.length === 0) {
      container?.classList.add('hidden');
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    container?.classList.remove('hidden');

    container.innerHTML = corridas.map(c => `
      <div class="ride-card">
        <div class="ride-card-header">
          <span class="ride-passenger">${c.passageiro} ${c.demonstracao ? '<span style="font-size:0.7rem;color:var(--text-muted)">(Demo)</span>' : ''}</span>
          <span class="ride-status ${c.status}">${this.statusLabel(c.status)}</span>
        </div>
        <div class="ride-info-row">📍 <span>${c.embarque}</span></div>
        <div class="ride-info-row">🏁 <span>${c.destino}</span></div>
        <div class="ride-info-row">⏱️ <span>Estimativa</span><strong>${c.estimativa}</strong></div>
        <div class="ride-info-row">💰 <span>Valor</span><strong>${this.formatMoney(c.valor)}</strong></div>
        ${c.status === 'pending' ? `
          <div class="ride-actions">
            <button class="btn btn-primary" onclick="app.aceitarCorrida(${c.id})">Aceitar</button>
            <button class="btn btn-outline btn-dark" onclick="app.recusarCorrida(${c.id})">Recusar</button>
          </div>
        ` : ''}
      </div>
    `).join('');
  },

  statusLabel(status) {
    const labels = { pending: 'Pendente', accepted: 'Aceita', completed: 'Concluída', cancelled: 'Cancelada' };
    return labels[status] || status;
  },

  async createDemoRide() {
    const m = this.state.motorista;
    if (!m) return;

    const destinos = [
      { embarque: 'Entrada principal do complexo', destino: 'Shopping Center Norte', estimativa: '25 min', valor: 32.50 },
      { embarque: 'Rua das Flores, 123', destino: 'Aeroporto Internacional', estimativa: '40 min', valor: 58.00 },
      { embarque: 'Av. Paulista, 1000', destino: 'Estação da Luz', estimativa: '15 min', valor: 18.90 }
    ];
    const d = destinos[Math.floor(Math.random() * destinos.length)];

    await db.criarCorrida(m.id, {
      passageiro: 'Passageiro — Demonstração',
      embarque: d.embarque,
      destino: d.destino,
      estimativa: d.estimativa,
      valor: d.valor
    });

    this.showToast('Corrida de demonstração criada!', 'success');
    this.loadRides();
    this.loadDashboardData();
  },

  async aceitarCorrida(id) {
    const corrida = await db.get('corridas', id);
    if (!corrida) return;
    corrida.status = 'accepted';
    await db.atualizarCorrida(corrida);
    this.showToast('Corrida aceita!', 'success');
    this.loadRides();
  },

  async recusarCorrida(id) {
    const corrida = await db.get('corridas', id);
    if (!corrida) return;
    corrida.status = 'cancelled';
    await db.atualizarCorrida(corrida);
    this.showToast('Corrida recusada', 'info');
    this.loadRides();
  },

  // ============================================================
  // MAPA DEMONSTRATIVO
  // ============================================================
  resetMap() {
    this.state.mapZoom = 1;
    const canvas = document.getElementById('map-canvas');
    if (canvas) canvas.style.transform = 'scale(1)';

    document.getElementById('pickup-marker')?.classList.add('hidden');
    document.getElementById('dest-marker')?.classList.add('hidden');
    document.getElementById('route-path')?.setAttribute('d', '');

    const panel = document.getElementById('map-panel');
    if (panel) {
      panel.innerHTML = '<div class="map-panel-content"><p class="map-panel-hint">Toque no mapa para simular um destino</p></div>';
    }
  },

  handleMapClick(e) {
    const canvas = document.getElementById('map-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Posiciona marcador de destino
    const dest = document.getElementById('dest-marker');
    dest.style.left = x + '%';
    dest.style.top = y + '%';
    dest.classList.remove('hidden');

    // Posiciona marcador de embarque (aleatório próximo)
    const pickup = document.getElementById('pickup-marker');
    const px = Math.max(10, Math.min(90, x + (Math.random() * 20 - 10)));
    const py = Math.max(10, Math.min(90, y + (Math.random() * 20 - 10)));
    pickup.style.left = px + '%';
    pickup.style.top = py + '%';
    pickup.classList.remove('hidden');

    // Desenha rota simulada
    const routePath = document.getElementById('route-path');
    routePath.setAttribute('d', `M${px},${py} Q${(px+x)/2 + 10},${(py+y)/2 - 10} ${x},${y}`);

    // Painel inferior
    const panel = document.getElementById('map-panel');
    panel.innerHTML = `
      <div class="map-ride-info">
        <div class="map-ride-row"><span>📍 Embarque</span><strong>Local simulado</strong></div>
        <div class="map-ride-row"><span>🏁 Destino</span><strong>Destino simulado</strong></div>
        <div class="map-ride-row"><span>⏱️ Distância</span><strong>${(Math.random()*8+2).toFixed(1)} km</strong></div>
        <div class="map-ride-row"><span>💰 Estimativa</span><strong>R$ ${(Math.random()*40+15).toFixed(2).replace('.',',')}</strong></div>
        <button class="btn btn-primary btn-full mt-3" onclick="app.showToast('Rota simulada — demonstração','info')">Iniciar rota simulada</button>
      </div>
    `;
  },

  mapZoomIn() {
    this.state.mapZoom = Math.min(this.state.mapZoom + 0.2, 2);
    document.getElementById('map-canvas').style.transform = `scale(${this.state.mapZoom})`;
  },

  mapZoomOut() {
    this.state.mapZoom = Math.max(this.state.mapZoom - 0.2, 0.6);
    document.getElementById('map-canvas').style.transform = `scale(${this.state.mapZoom})`;
  },

  mapCenterDriver() {
    this.state.mapZoom = 1;
    const canvas = document.getElementById('map-canvas');
    canvas.style.transform = 'scale(1)';
    canvas.style.transformOrigin = 'center';
  },

  // ============================================================
  // CARTEIRA
  // ============================================================
  async loadWallet() {
    const m = this.state.motorista;
    if (!m) return;

    document.getElementById('wallet-saldo').textContent = this.formatMoney(m.saldo);
    document.getElementById('wallet-ganhos').textContent = this.formatMoney(m.ganhosTotal);
    document.getElementById('wallet-corridas').textContent = m.corridasRealizadas;
    document.getElementById('wallet-creditos').textContent = this.formatMoney(m.creditos);

    const transacoes = await db.getTransacoesMotorista(m.id);
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');

    if (!transacoes || transacoes.length === 0) {
      list?.classList.add('hidden');
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    list?.classList.remove('hidden');

    list.innerHTML = transacoes.slice().reverse().map(t => `
      <div class="history-item">
        <div class="history-item-info">
          <span class="history-item-title">${t.descricao}</span>
          <span class="history-item-date">${new Date(t.data).toLocaleDateString('pt-BR')}</span>
        </div>
        <span class="history-item-amount ${t.valor >= 0 ? 'positive' : 'negative'}">
          ${t.valor >= 0 ? '+' : ''}${this.formatMoney(t.valor)}
        </span>
      </div>
    `).join('');
  },

  // ============================================================
  // VALE COMBUSTÍVEL
  // ============================================================
  async loadFuel() {
    const m = this.state.motorista;
    if (!m) return;

    document.getElementById('fuel-credito').textContent = this.formatMoney(m.creditos);

    const solicitacoes = await db.getSolicitacoesVale(m.id);
    const list = document.getElementById('fuel-list');
    const empty = document.getElementById('fuel-empty');

    if (!solicitacoes || solicitacoes.length === 0) {
      list?.classList.add('hidden');
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    list?.classList.remove('hidden');

    list.innerHTML = solicitacoes.slice().reverse().map(s => `
      <div class="fuel-request-item">
        <div>
          <strong style="font-size:0.9rem">Solicitação #${s.id}</strong>
          <div style="font-size:0.75rem;color:var(--text-muted)">${new Date(s.data).toLocaleDateString('pt-BR')}</div>
        </div>
        <span class="fuel-request-status">${s.status}</span>
      </div>
    `).join('');
  },

  async requestFuel() {
    const m = this.state.motorista;
    if (!m) return;

    this.openModal('Solicitar vale combustível',
      'Esta é uma demonstração do MVP. Em produção, o vale seria processado pela operadora de pagamentos e creditado em até 2 dias úteis.\n\nNenhum pagamento real será efetuado.',
      [
        { text: 'Cancelar', class: 'btn-outline btn-dark', action: () => this.closeModal() },
        {
          text: 'Confirmar solicitação',
          class: 'btn-primary',
          action: async () => {
            await db.solicitarVale(m.id, 150.00);
            this.showToast('Solicitação registrada — demonstração', 'success');
            this.closeModal();
            this.loadFuel();
          }
        }
      ]
    );
  },

  // ============================================================
  // PERFIL
  // ============================================================
  loadProfile() {
    const m = this.state.motorista;
    if (!m) return;

    document.getElementById('profile-avatar').textContent = m.nome.charAt(0).toUpperCase();
    document.getElementById('profile-nome').textContent = m.nome;
    document.getElementById('profile-id').textContent = 'ID: ' + m.idLocal;
    document.getElementById('profile-cpf').textContent = this.maskCPF(m.cpf).replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/, '$1.$2.***-**');
    document.getElementById('profile-marca').textContent = m.marca;
    document.getElementById('profile-modelo').textContent = m.modelo;
    document.getElementById('profile-ano').textContent = m.ano;
    document.getElementById('profile-placa').textContent = this.maskPlaca(m.placa).replace(/^(...)(.)(..)$/, '$1*-$3');
  },

  // ============================================================
  // CONFIGURAÇÕES
  // ============================================================
  async toggleDarkMode(el) {
    this.state.darkMode = el.checked;
    document.body.classList.toggle('dark-mode', this.state.darkMode);
    await db.setConfig('dark_mode', this.state.darkMode);
  },

  async exportData() {
    try {
      const json = await db.exportarDados();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vivamob-dados-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Dados exportados com sucesso', 'success');
    } catch (e) {
      this.showToast('Erro ao exportar dados', 'error');
    }
  },

  clearAllData() {
    this.openModal('Apagar todos os dados',
      'Tem certeza que deseja apagar TODOS os dados armazenados localmente?\n\nEsta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', class: 'btn-outline btn-dark', action: () => this.closeModal() },
        {
          text: 'Apagar tudo',
          class: 'btn-primary',
          action: async () => {
            await db.limparTudo();
            this.state.motorista = null;
            this.closeModal();
            this.showToast('Todos os dados foram apagados', 'success');
            this.navigate('landing');
          }
        }
      ]
    );
  },

  // ============================================================
  // UTILIDADES
  // ============================================================
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

  showNotificationDemo() {
    this.showToast('Notificações — demonstração do MVP', 'info');
  },

  // ============================================================
  // TOAST
  // ============================================================
  showToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;

    const iconos = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span>${iconos[tipo] || 'ℹ️'}</span><span>${mensagem}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ============================================================
  // MODAL
  // ============================================================
  openModal(titulo, corpo, botoes = []) {
    document.getElementById('modal-title').textContent = titulo;
    document.getElementById('modal-body').innerHTML = corpo.replace(/\n/g, '<br>');

    const footer = document.getElementById('modal-footer');
    footer.innerHTML = botoes.map(b =>
      `<button class="btn ${b.class || 'btn-primary'}" onclick="(${b.action.toString()})(); app.closeModal();">${b.text}</button>`
    ).join('');

    // Re-anexa os handlers reais
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
  },

  // ============================================================
  // LOGOUT
  // ============================================================
  async logout() {
    await db.limparSessao();
    this.state.motorista = null;
    this.showToast('Você saiu da conta', 'info');
    this.navigate('landing');
  }
};

// Inicializa a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
