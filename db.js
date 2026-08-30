/**
 * ============================================================
 * VIVAMOB — db.js
 * Camada de persistência local usando IndexedDB
 * ============================================================
 * Este módulo gerencia todo o armazenamento local do MVP.
 * Em uma versão de produção, substitua as chamadas a este
 * módulo por requisições a uma API REST real.
 * ============================================================
 */

const DB_NAME = 'VivaMobDB';
const DB_VERSION = 2;

class VivaMobDB {
  constructor() {
    this.db = null;
    this.ready = false;
  }

  /**
   * Inicializa a conexão com o IndexedDB.
   * Cria os object stores se não existirem.
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.ready = true;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store: motoristas (dados de cadastro + auth)
        if (!db.objectStoreNames.contains('motoristas')) {
          const store = db.createObjectStore('motoristas', { keyPath: 'id', autoIncrement: true });
          store.createIndex('cpf', 'cpf', { unique: true });
        }

        // Store: corridas
        if (!db.objectStoreNames.contains('corridas')) {
          const store = db.createObjectStore('corridas', { keyPath: 'id', autoIncrement: true });
          store.createIndex('motoristaId', 'motoristaId', { unique: false });
        }

        // Store: transacoes (histórico da carteira)
        if (!db.objectStoreNames.contains('transacoes')) {
          const store = db.createObjectStore('transacoes', { keyPath: 'id', autoIncrement: true });
          store.createIndex('motoristaId', 'motoristaId', { unique: false });
        }

        // Store: solicitacoes_vale (vale combustível)
        if (!db.objectStoreNames.contains('solicitacoes_vale')) {
          const store = db.createObjectStore('solicitacoes_vale', { keyPath: 'id', autoIncrement: true });
          store.createIndex('motoristaId', 'motoristaId', { unique: false });
        }

        // Store: configuracoes
        if (!db.objectStoreNames.contains('configuracoes')) {
          db.createObjectStore('configuracoes', { keyPath: 'chave' });
        }
      };
    });
  }

  /**
   * Gera um hash SHA-256 da senha usando Web Crypto API.
   * Em produção, use bcrypt/argon2 no servidor.
   */
  async hashSenha(senha) {
    const encoder = new TextEncoder();
    const data = encoder.encode(senha);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Gera um ID único local para exibição ao usuário.
   */
  gerarIdLocal() {
    return 'VM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // ============================================================
  // CRUD Genérico
  // ============================================================

  _transaction(storeName, mode = 'readonly') {
    if (!this.db) throw new Error('DB não inicializado');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async add(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName, 'readwrite');
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName, 'readwrite');
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName, indexName = null, query = null) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.getAll(query) : source.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName, 'readwrite');
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const store = this._transaction(storeName, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================
  // MOTORISTA
  // ============================================================

  async cadastrarMotorista(dados) {
    const senhaHash = await this.hashSenha(dados.senha);
    const motorista = {
      idLocal: this.gerarIdLocal(),
      nome: dados.nome.trim(),
      cpf: dados.cpf.replace(/\D/g, ''),
      senhaHash: senhaHash,
      marca: dados.marca.trim(),
      modelo: dados.modelo.trim(),
      ano: parseInt(dados.ano, 10),
      placa: dados.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      saldo: 0,
      corridasRealizadas: 0,
      ganhosTotal: 0,
      creditos: 0,
      dataCadastro: new Date().toISOString(),
      ativo: true
    };
    const id = await this.add('motoristas', motorista);
    return { ...motorista, id };
  }

  async autenticar(cpf, senha) {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const motoristas = await this.getAll('motoristas', 'cpf', cpfLimpo);
    if (!motoristas || motoristas.length === 0) return null;
    const motorista = motoristas[0];
    const senhaHash = await this.hashSenha(senha);
    if (motorista.senhaHash !== senhaHash) return null;
    return motorista;
  }

  async getMotorista(id) {
    return this.get('motoristas', id);
  }

  async atualizarMotorista(motorista) {
    return this.put('motoristas', motorista);
  }

  // ============================================================
  // CORRIDAS
  // ============================================================

  async criarCorrida(motoristaId, dados) {
    const corrida = {
      motoristaId,
      passageiro: dados.passageiro || 'Passageiro',
      embarque: dados.embarque,
      destino: dados.destino,
      estimativa: dados.estimativa,
      valor: dados.valor || 0,
      status: 'pending', // pending, accepted, completed, cancelled
      dataCriacao: new Date().toISOString(),
      dataConclusao: null,
      demonstracao: true
    };
    const id = await this.add('corridas', corrida);
    return { ...corrida, id };
  }

  async getCorridasMotorista(motoristaId) {
    return this.getAll('corridas', 'motoristaId', motoristaId);
  }

  async atualizarCorrida(corrida) {
    return this.put('corridas', corrida);
  }

  // ============================================================
  // TRANSAÇÕES (Carteira)
  // ============================================================

  async adicionarTransacao(motoristaId, dados) {
    const transacao = {
      motoristaId,
      tipo: dados.tipo, // 'ganho', 'credito', 'transferencia', 'vale'
      descricao: dados.descricao,
      valor: dados.valor,
      data: new Date().toISOString(),
      demonstracao: true
    };
    const id = await this.add('transacoes', transacao);
    return { ...transacao, id };
  }

  async getTransacoesMotorista(motoristaId) {
    return this.getAll('transacoes', 'motoristaId', motoristaId);
  }

  // ============================================================
  // VALE COMBUSTÍVEL
  // ============================================================

  async solicitarVale(motoristaId, valor) {
    const solicitacao = {
      motoristaId,
      valor: valor || 300,
      status: 'Solicitação registrada — demonstração',
      data: new Date().toISOString(),
      demonstracao: true
    };
    const id = await this.add('solicitacoes_vale', solicitacao);
    return { ...solicitacao, id };
  }

  async getSolicitacoesVale(motoristaId) {
    return this.getAll('solicitacoes_vale', 'motoristaId', motoristaId);
  }

  // ============================================================
  // CONFIGURAÇÕES
  // ============================================================

  async setConfig(chave, valor) {
    await this.put('configuracoes', { chave, valor });
  }

  async getConfig(chave, padrao = null) {
    const item = await this.get('configuracoes', chave);
    return item ? item.valor : padrao;
  }

  // ============================================================
  // SESSÃO
  // ============================================================

  async setSessao(motorista) {
    await this.setConfig('sessao_ativa', JSON.stringify({
      id: motorista.id,
      nome: motorista.nome,
      idLocal: motorista.idLocal
    }));
  }

  async getSessao() {
    const raw = await this.getConfig('sessao_ativa');
    return raw ? JSON.parse(raw) : null;
  }

  async limparSessao() {
    await this.setConfig('sessao_ativa', null);
  }

  // ============================================================
  // LIMPEZA TOTAL (para testes)
  // ============================================================

  async limparTudo() {
    await this.clear('motoristas');
    await this.clear('corridas');
    await this.clear('transacoes');
    await this.clear('solicitacoes_vale');
    await this.clear('configuracoes');
  }

  // ============================================================
  // EXPORTAR DADOS (JSON)
  // ============================================================

  async exportarDados() {
    const dados = {
      motoristas: await this.getAll('motoristas'),
      corridas: await this.getAll('corridas'),
      transacoes: await this.getAll('transacoes'),
      solicitacoes_vale: await this.getAll('solicitacoes_vale'),
      configuracoes: await this.getAll('configuracoes'),
      exportadoEm: new Date().toISOString()
    };
    return JSON.stringify(dados, null, 2);
  }
}

// Instância global do banco de dados
const db = new VivaMobDB();
