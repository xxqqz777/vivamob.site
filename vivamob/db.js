/**
 * ============================================================
 * VIVAMOB — db.js
 * Camada de persistência local: IndexedDB com fallback localStorage
 * ============================================================
 * Funciona em: file://, localhost, GitHub Pages (HTTPS),
 * e modo anônimo (onde IndexedDB pode estar indisponível).
 * ============================================================
 */

const DB_NAME = 'VivaMobDB';
const DB_VERSION = 3;  // bump version to force schema upgrade

class VivaMobDB {
  constructor() {
    this.db = null;
    this.ready = false;
    this.useLocalStorage = false; // fallback flag
  }

  /**
   * Inicializa a conexão com o IndexedDB.
   * Se IndexedDB falhar (modo anônimo, quotas, etc),
   * usa localStorage como fallback transparente.
   */
  async init() {
    // Primeiro tenta IndexedDB
    try {
      await this._initIndexedDB();
      this.ready = true;
      return;
    } catch (e) {
      console.warn('[VivaMobDB] IndexedDB indisponível, usando localStorage fallback:', e.message);
    }

    // Fallback para localStorage
    this.useLocalStorage = true;
    this.ready = true;
    console.log('[VivaMobDB] Modo localStorage ativado');
  }

  _initIndexedDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB não suportado'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store: motoristas
        if (!db.objectStoreNames.contains('motoristas')) {
          const store = db.createObjectStore('motoristas', { keyPath: 'id', autoIncrement: true });
          store.createIndex('cpf', 'cpf', { unique: true });
        }

        // Store: corridas
        if (!db.objectStoreNames.contains('corridas')) {
          const store = db.createObjectStore('corridas', { keyPath: 'id', autoIncrement: true });
          store.createIndex('motoristaId', 'motoristaId', { unique: false });
        }

        // Store: transacoes
        if (!db.objectStoreNames.contains('transacoes')) {
          const store = db.createObjectStore('transacoes', { keyPath: 'id', autoIncrement: true });
          store.createIndex('motoristaId', 'motoristaId', { unique: false });
        }

        // Store: solicitacoes_vale
        if (!db.objectStoreNames.contains('solicitacoes_vale')) {
          const store = db.createObjectStore('solicitacoes_vale', { keyPath: 'id', autoIncrement: true });
          store.createIndex('motoristaId', 'motoristaId', { unique: false });
        }

        // Store: configuracoes
        if (!db.objectStoreNames.contains('configuracoes')) {
          db.createObjectStore('configuracoes', { keyPath: 'chave' });
        }
      };

      request.onblocked = () => {
        reject(new Error('Banco bloqueado — feche outras abas com este site'));
      };
    });
  }

  // ============================================================
  // FALLBACK localStorage helpers
  // ============================================================

  _lsKey(store, id) {
    return `vm_${store}_${id}`;
  }

  _lsGetAll(store) {
    const items = [];
    const prefix = `vm_${store}_`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try { items.push(JSON.parse(localStorage.getItem(key))); } catch (e) {}
      }
    }
    return items;
  }

  _lsGet(store, key) {
    const raw = localStorage.getItem(this._lsKey(store, key));
    return raw ? JSON.parse(raw) : undefined;
  }

  _lsSet(store, key, value) {
    localStorage.setItem(this._lsKey(store, key), JSON.stringify(value));
  }

  _lsRemove(store, key) {
    localStorage.removeItem(this._lsKey(store, key));
  }

  _lsClear(store) {
    const prefix = `vm_${store}_`;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) toRemove.push(key);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  }

  _lsNextId(store) {
    const key = `vm_${store}_nextid`;
    let id = parseInt(localStorage.getItem(key) || '1', 10);
    localStorage.setItem(key, String(id + 1));
    return id;
  }

  // ============================================================
  // CRUD Genérico (unificado IndexedDB + localStorage)
  // ============================================================

  async add(storeName, data) {
    if (this.useLocalStorage) {
      const id = this._lsNextId(storeName);
      const item = { ...data, id };
      this._lsSet(storeName, id, item);
      return id;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    if (this.useLocalStorage) {
      this._lsSet(storeName, data.id, data);
      return data.id;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    if (this.useLocalStorage) {
      return this._lsGet(storeName, key);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName, indexName = null, query = null) {
    if (this.useLocalStorage) {
      let items = this._lsGetAll(storeName);
      if (indexName && query !== null) {
        items = items.filter(i => i[indexName] === query);
      }
      return items;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query !== null ? source.getAll(query) : source.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    if (this.useLocalStorage) {
      this._lsRemove(storeName, key);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    if (this.useLocalStorage) {
      this._lsClear(storeName);
      localStorage.removeItem(`vm_${storeName}_nextid`);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================
  // HASH & ID
  // ============================================================

  async hashSenha(senha) {
    const encoder = new TextEncoder();
    const data = encoder.encode(senha);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  gerarIdLocal() {
    return 'VM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
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
      status: 'pending',
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
  // TRANSAÇÕES
  // ============================================================

  async adicionarTransacao(motoristaId, dados) {
    const transacao = {
      motoristaId,
      tipo: dados.tipo,
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
  // LIMPEZA TOTAL
  // ============================================================

  async limparTudo() {
    await this.clear('motoristas');
    await this.clear('corridas');
    await this.clear('transacoes');
    await this.clear('solicitacoes_vale');
    await this.clear('configuracoes');
  }

  // ============================================================
  // EXPORTAR DADOS
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

// Instância global
const db = new VivaMobDB();
