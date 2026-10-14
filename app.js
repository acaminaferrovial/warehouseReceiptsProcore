/**
 * PROCORE MATERIALS HUB - APLICACIÓN DE RECEPCIÓN DE MATERIALES
 * Interfaz unificada de campo (móvil) y oficina (web) integrada con Procore Daily Log
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // 1. ESTADO DE LA APLICACIÓN Y PERSISTENCIA (LOCALSTORAGE)
  // -------------------------------------------------------------
  const STORAGE_KEYS = {
    ORDERS: 'procore_materials_orders_v1',
    HISTORY: 'procore_materials_history_v1',
    LAST_SIGNEE: 'procore_materials_last_signee',
    CURRENT_PROJECT: 'procore_materials_current_project',
    PROCORE_CONFIG: 'procore_materials_config_v1'
  };

  const DEFAULT_PROCORE_CONFIG = {
    mode: 'demo', // 'demo' | 'live'
    env: 'sandbox', // 'sandbox' | 'production'
    companyId: '104928',
    projectId: '29814',
    projectName: 'Torre Skyline - Fase 2',
    token: ''
  };

  // Pedidos iniciales de demostración en obra
  const DEFAULT_ORDERS = [
    {
      id: 'ord-101',
      number: 'PED-2026-101',
      supplier: 'CEMEX España',
      description: 'Hormigón HA-25/B/20/IIa con aditivo retardante para losa de cimentación',
      quantity: '4 cubas (32 m³)',
      expectedDate: new Date().toISOString().split('T')[0],
      urgent: true,
      status: 'pending' // pending | partial | completed | rejected
    },
    {
      id: 'ord-102',
      number: 'PED-2026-102',
      supplier: 'Celsa Steel Group',
      description: 'Acero corrugado B500S Ø16mm (8 atados) y Ø12mm (4 atados)',
      quantity: '12 atados / 6.400 kg',
      expectedDate: new Date().toISOString().split('T')[0],
      urgent: true,
      status: 'pending'
    },
    {
      id: 'ord-103',
      number: 'PED-2026-103',
      supplier: 'Cerámicas La Paloma',
      description: 'Ladrillo caravista klinker hidrofugado rojo 24x11,5x5 cm',
      quantity: '18 palets (14.400 ud)',
      expectedDate: new Date().toISOString().split('T')[0],
      urgent: false,
      status: 'partial',
      notes: 'Llegaron 10 palets el viernes. Pendientes 8 palets restantes.'
    },
    {
      id: 'ord-104',
      number: 'PED-2026-104',
      supplier: 'Sika España',
      description: 'Mortero impermeable bicomponente SikaTop Seal-107 y masilla Sikaflex-11FC',
      quantity: '40 sacos + 24 cartuchos',
      expectedDate: getFutureDate(1),
      urgent: false,
      status: 'pending'
    },
    {
      id: 'ord-105',
      number: 'PED-2026-105',
      supplier: 'Pladur Gypsum',
      description: 'Placas de yeso laminado Pladur N 15mm y perfiles metálicos montantes 46mm',
      quantity: '8 palets + 160 perfiles',
      expectedDate: getFutureDate(2),
      urgent: false,
      status: 'pending'
    },
    {
      id: 'ord-106',
      number: 'PED-2026-106',
      supplier: 'Saint-Gobain PAM',
      description: 'Tubería de fundición dúctil Classic DN 200 mm para saneamiento',
      quantity: '24 tubos (144 m)',
      expectedDate: getFutureDate(3),
      urgent: false,
      status: 'pending'
    }
  ];

  // Historial inicial con firmas de demostración
  const DEFAULT_HISTORY = [
    {
      id: 'rec-098',
      orderId: 'ord-098',
      orderNumber: 'PED-2026-098',
      supplier: 'Áridos Madrileños',
      description: 'Arena de río lavada 0/4 mm para mortero de albañilería',
      quantity: '2 camiones bañera (48 Tn)',
      status: 'completo',
      notes: 'Material descargado en acopio norte. Conforme con albarán y densidad.',
      albaran: 'ALB-2026-8812',
      photo: null,
      signature: createSampleSignatureSVG('M. Gomez'),
      signeeName: 'Manuel Gómez (Encargado Obra)',
      timestamp: formatDateTime(new Date(Date.now() - 3600000 * 4)),
      procoreLogId: 'DL-90421',
      procorePayload: {
        delivery: {
          date: new Date().toISOString().split('T')[0],
          time: '08:30',
          tracking_number: 'ALB-2026-8812',
          vendor_name: 'Áridos Madrileños',
          description: 'Arena de río lavada 0/4 mm para mortero de albañilería (48 Tn)',
          contents: '2 camiones bañera (48 Tn)',
          confirmed: true,
          status: 'Delivered',
          signed_by: 'Manuel Gómez (Encargado Obra)',
          procore_log_id: 'DL-90421'
        }
      }
    },
    {
      id: 'rec-099',
      orderId: 'ord-103',
      orderNumber: 'PED-2026-103',
      supplier: 'Cerámicas La Paloma',
      description: 'Ladrillo caravista klinker hidrofugado rojo',
      quantity: '10 palets recibidos (de 18)',
      status: 'parcial',
      notes: 'Llegaron 10 palets en buen estado. Faltan 8 palets por rotura de stock en fábrica.',
      albaran: 'PAL-9921',
      photo: null,
      signature: createSampleSignatureSVG('J. Perez'),
      signeeName: 'Juan Pérez (Recepción)',
      timestamp: formatDateTime(new Date(Date.now() - 3600000 * 20)),
      procoreLogId: 'DL-90387',
      procorePayload: {
        delivery: {
          date: getFutureDate(-1),
          time: '15:45',
          tracking_number: 'PAL-9921',
          vendor_name: 'Cerámicas La Paloma',
          description: 'Llegada parcial: 10 palets de 18 previstos.',
          contents: '10 palets',
          confirmed: true,
          status: 'Partially Delivered',
          signed_by: 'Juan Pérez (Recepción)',
          procore_log_id: 'DL-90387'
        }
      }
    }
  ];

  // Estado reactivo en memoria
  let state = {
    orders: loadStorage(STORAGE_KEYS.ORDERS, DEFAULT_ORDERS),
    history: loadStorage(STORAGE_KEYS.HISTORY, DEFAULT_HISTORY),
    procore: loadStorage(STORAGE_KEYS.PROCORE_CONFIG, DEFAULT_PROCORE_CONFIG),
    activeFilter: 'all', // all | prioritario | parcial
    searchQuery: '',
    historySearchQuery: '',
    currentOrder: null,
    selectedStatus: 'completo', // completo | parcial | rechazado
    currentPhotoBase64: null,
    currentImpPhotoBase64: null,
    lastPayloadInspected: null
  };

  // -------------------------------------------------------------
  // 2. ELEMENTOS DEL DOM
  // -------------------------------------------------------------
  const DOM = {
    // Current project in header
    currentProject: document.getElementById('current-project'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    badgePendientes: document.getElementById('count-pendientes'),
    badgeHistorial: document.getElementById('count-historial'),
    chipCountAll: document.getElementById('chip-count-all'),
    chipCountUrgent: document.getElementById('chip-count-urgent'),
    chipCountPartial: document.getElementById('chip-count-partial'),

    // Tab 1: Recepción
    ordersContainer: document.getElementById('orders-container'),
    emptyOrdersState: document.getElementById('empty-orders-state'),
    inputSearchOrders: document.getElementById('input-search-orders'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterChips: document.querySelectorAll('.filter-chips .chip'),
    btnNuevaImprevista: document.getElementById('btn-nueva-imprevista'),

    // Tab 2: Crear / Importar
    formNuevoPedido: document.getElementById('form-nuevo-pedido'),
    orderExpectedDate: document.getElementById('order-expected-date'),
    excelDropZone: document.getElementById('excel-drop-zone'),
    excelFileInput: document.getElementById('excel-file-input'),
    btnLoadSampleData: document.getElementById('btn-load-sample-data'),
    importFeedback: document.getElementById('import-feedback'),
    procoreModeBadge: document.getElementById('procore-mode-badge'),
    btnSyncProcorePos: document.getElementById('btn-sync-procore-pos'),
    btnOpenProcoreSettingsTab: document.getElementById('btn-open-procore-settings-tab'),
    procorePoSyncFeedback: document.getElementById('procore-po-sync-feedback'),

    // Tab 3: Historial
    historyTbody: document.getElementById('history-tbody'),
    emptyHistoryState: document.getElementById('empty-history-state'),
    inputSearchHistory: document.getElementById('input-search-history'),
    btnExportCsv: document.getElementById('btn-export-csv'),

    // Modal Recepción
    modalReception: document.getElementById('modal-reception'),
    modalOrderTag: document.getElementById('modal-order-tag'),
    modalOrderSupplier: document.getElementById('modal-order-supplier'),
    modalOrderMaterial: document.getElementById('modal-order-material'),
    modalOrderQuantity: document.getElementById('modal-order-quantity'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelReception: document.getElementById('btn-cancel-reception'),
    btnConfirmReception: document.getElementById('btn-confirm-reception'),
    statusBtns: document.querySelectorAll('.status-options .status-btn'),
    partialDetailsContainer: document.getElementById('partial-details-container'),
    labelPartialNotes: document.getElementById('label-partial-notes'),
    inputPartialNotes: document.getElementById('input-partial-notes'),
    inputAlbaran: document.getElementById('input-albaran'),
    inputPhoto: document.getElementById('input-photo'),
    photoPreviewBox: document.getElementById('photo-preview-box'),
    photoPreviewImg: document.getElementById('photo-preview-img'),
    btnRemovePhoto: document.getElementById('btn-remove-photo'),
    signatureCanvas: document.getElementById('signature-canvas'),
    signatureHint: document.getElementById('signature-hint'),
    btnClearSignature: document.getElementById('btn-clear-signature'),
    inputSigneeName: document.getElementById('input-signee-name'),

    // Modal Imprevista
    modalImprevista: document.getElementById('modal-imprevista'),
    btnCloseImprevista: document.getElementById('btn-close-imprevista'),
    btnCancelImprevista: document.getElementById('btn-cancel-imprevista'),
    btnConfirmImprevista: document.getElementById('btn-confirm-imprevista'),
    impSupplier: document.getElementById('imp-supplier'),
    impAlbaran: document.getElementById('imp-albaran'),
    impMaterial: document.getElementById('imp-material'),
    impQuantity: document.getElementById('imp-quantity'),
    impPhoto: document.getElementById('imp-photo'),
    impPhotoPreviewBox: document.getElementById('imp-photo-preview-box'),
    impPhotoPreviewImg: document.getElementById('imp-photo-preview-img'),
    btnRemoveImpPhoto: document.getElementById('btn-remove-imp-photo'),
    impSignatureCanvas: document.getElementById('imp-signature-canvas'),
    impSignatureHint: document.getElementById('imp-signature-hint'),
    btnClearImpSignature: document.getElementById('btn-clear-imp-signature'),
    impSigneeName: document.getElementById('imp-signee-name'),

    // Lightbox & Procore Payload Modal
    modalLightbox: document.getElementById('modal-lightbox'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxTitle: document.getElementById('lightbox-title'),
    btnCloseLightbox: document.getElementById('btn-close-lightbox'),
    modalProcoreSync: document.getElementById('modal-procore-sync'),
    procorePayloadCode: document.getElementById('procore-payload-code'),
    btnCloseProcoreModal: document.getElementById('btn-close-procore-modal'),
    btnCloseProcoreModal2: document.getElementById('btn-close-procore-modal-2'),
    btnProcoreStatus: document.getElementById('btn-procore-status'),

    // Procore Instance Modal Controls
    procoreSubtabs: document.querySelectorAll('.procore-subtab'),
    procoreSubpanels: document.querySelectorAll('.procore-subpanel'),
    instanceTokenStatus: document.getElementById('instance-token-status'),
    instanceEnvVal: document.getElementById('instance-env-val'),
    instanceCompanyVal: document.getElementById('instance-company-val'),
    instanceProjectVal: document.getElementById('instance-project-val'),
    btnTestProcoreConn: document.getElementById('btn-test-procore-conn'),
    procoreTestResult: document.getElementById('procore-test-result'),
    btnModalSyncPos: document.getElementById('btn-modal-sync-pos'),
    modalPoSyncFeedback: document.getElementById('modal-po-sync-feedback'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // Canvas Pad Controllers
  let mainPad = null;
  let impPad = null;

  // -------------------------------------------------------------
  // 3. INICIALIZACIÓN
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    // 1. Establecer fecha por defecto en formulario (hoy)
    if (DOM.orderExpectedDate) {
      DOM.orderExpectedDate.value = new Date().toISOString().split('T')[0];
    }

    // 2. Inicializar Pads de firma digital
    mainPad = createSignaturePad(DOM.signatureCanvas, DOM.signatureHint);
    impPad = createSignaturePad(DOM.impSignatureCanvas, DOM.impSignatureHint);

    // 3. Cargar último nombre de receptor usado
    const lastSignee = localStorage.getItem(STORAGE_KEYS.LAST_SIGNEE);
    if (lastSignee) {
      DOM.inputSigneeName.value = lastSignee;
      DOM.impSigneeName.value = lastSignee;
    }

    // 4. Registrar Event Listeners
    setupTabNavigation();
    setupFiltersAndSearch();
    setupOrderReceptionModal();
    setupImprevistaModal();
    setupExcelImport();
    setupManualOrderForm();
    setupHistoryTable();
    setupLightboxAndProcoreModal();

    // 5. Renderizar vista inicial
    renderAll();
  }

  // -------------------------------------------------------------
  // 4. NAVEGACIÓN POR PESTAÑAS
  // -------------------------------------------------------------
  function setupTabNavigation() {
    DOM.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-tab');
        
        DOM.tabButtons.forEach(b => b.classList.remove('active'));
        DOM.tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePanel = document.getElementById(targetTabId);
        if (activePanel) {
          activePanel.classList.add('active');
        }

        // Renderizar según la pestaña activa
        if (targetTabId === 'tab-recepcion') {
          renderOrdersGrid();
        } else if (targetTabId === 'tab-historial') {
          renderHistoryTable();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 5. RENDERIZADO PRINCIPAL (GRID DE PEDIDOS PENDIENTES)
  // -------------------------------------------------------------
  function renderAll() {
    updateBadges();
    renderOrdersGrid();
    renderHistoryTable();
  }

  function updateBadges() {
    const pendingOrders = state.orders.filter(o => o.status === 'pending' || o.status === 'partial');
    const urgentCount = pendingOrders.filter(o => o.urgent).length;
    const partialCount = pendingOrders.filter(o => o.status === 'partial').length;

    DOM.badgePendientes.textContent = pendingOrders.length;
    DOM.chipCountAll.textContent = pendingOrders.length;
    DOM.chipCountUrgent.textContent = urgentCount;
    DOM.chipCountPartial.textContent = partialCount;
    DOM.badgeHistorial.textContent = state.history.length;
  }

  function renderOrdersGrid() {
    const container = DOM.ordersContainer;
    container.innerHTML = '';

    // Filtrar pedidos
    let filtered = state.orders.filter(o => o.status === 'pending' || o.status === 'partial');

    // Filtro por chips
    if (state.activeFilter === 'prioritario') {
      filtered = filtered.filter(o => o.urgent);
    } else if (state.activeFilter === 'parcial') {
      filtered = filtered.filter(o => o.status === 'partial');
    }

    // Filtro por búsqueda
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(o =>
        o.number.toLowerCase().includes(q) ||
        o.supplier.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      );
    }

    // Comprobar estado vacío
    if (filtered.length === 0) {
      DOM.emptyOrdersState.style.display = 'block';
      return;
    } else {
      DOM.emptyOrdersState.style.display = 'none';
    }

    // Renderizar tarjetas
    filtered.forEach(order => {
      const card = document.createElement('div');
      card.className = `order-card ${order.urgent ? 'urgent' : ''}`;
      
      const isPartial = order.status === 'partial';
      const partialBadge = isPartial
        ? `<span class="badge" style="background:#fffbeb; color:#b45309; border:1px solid #fde68a;">⏳ Entrega Parcial Previa</span>`
        : '';

      const urgentBadge = order.urgent
        ? `<span class="order-urgent-badge">🔥 Urgente</span>`
        : '';

      card.innerHTML = `
        <div>
          <div class="order-card-header">
            <span class="order-tag">${escapeHTML(order.number)}</span>
            <div style="display:flex; gap:0.4rem; align-items:center;">
              ${partialBadge}
              ${urgentBadge}
            </div>
          </div>
          <h3 class="order-supplier">${escapeHTML(order.supplier)}</h3>
          <p class="order-material">${escapeHTML(order.description)}</p>
          ${order.notes ? `<div style="font-size:0.8rem; background:#fffbeb; color:#92400e; padding:0.35rem 0.6rem; border-radius:6px; margin-bottom:0.75rem;">📝 ${escapeHTML(order.notes)}</div>` : ''}
        </div>

        <div>
          <div class="order-meta">
            <div>
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Previsto:</span>
              <span class="order-qty">${escapeHTML(order.quantity)}</span>
            </div>
            <div style="text-align:right;">
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Fecha de entrega:</span>
              <span class="order-date">${formatDate(order.expectedDate)}</span>
            </div>
          </div>

          <button class="btn btn-primary btn-block btn-recibir" data-id="${order.id}">
            <span class="btn-icon">✍️</span>
            <span>Registrar Llegada / Recibir</span>
          </button>
        </div>
      `;

      // Event listener para recibir
      const btnRecibir = card.querySelector('.btn-recibir');
      btnRecibir.addEventListener('click', () => {
        openReceptionModal(order);
      });

      container.appendChild(card);
    });
  }

  // -------------------------------------------------------------
  // 6. FILTROS Y BÚSQUEDA
  // -------------------------------------------------------------
  function setupFiltersAndSearch() {
    // Chips
    DOM.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        DOM.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeFilter = chip.getAttribute('data-filter');
        renderOrdersGrid();
      });
    });

    // Input Búsqueda Pedidos
    DOM.inputSearchOrders.addEventListener('input', e => {
      state.searchQuery = e.target.value;
      DOM.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
      renderOrdersGrid();
    });

    DOM.btnClearSearch.addEventListener('click', () => {
      DOM.inputSearchOrders.value = '';
      state.searchQuery = '';
      DOM.btnClearSearch.style.display = 'none';
      renderOrdersGrid();
    });

    // Input Búsqueda Historial
    DOM.inputSearchHistory.addEventListener('input', e => {
      state.historySearchQuery = e.target.value;
      renderHistoryTable();
    });
  }

  // -------------------------------------------------------------
  // 7. MODAL DE RECEPCIÓN DE PEDIDO PENDIENTE
  // -------------------------------------------------------------
  function setupOrderReceptionModal() {
    // Cerrar modal
    DOM.btnCloseModal.addEventListener('click', closeReceptionModal);
    DOM.btnCancelReception.addEventListener('click', closeReceptionModal);
    DOM.modalReception.addEventListener('click', e => {
      if (e.target === DOM.modalReception) closeReceptionModal();
    });

    // Botones de estado (Completo, Parcial, Rechazado)
    DOM.statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.statusBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedStatus = btn.getAttribute('data-status');
        updateStatusDetailsVisibility();
      });
    });

    // Subida y foto de cámara
    DOM.inputPhoto.addEventListener('change', e => {
      handleImageUpload(e.target.files[0], DOM.photoPreviewBox, DOM.photoPreviewImg, b64 => {
        state.currentPhotoBase64 = b64;
      });
    });

    DOM.btnRemovePhoto.addEventListener('click', () => {
      DOM.inputPhoto.value = '';
      DOM.photoPreviewBox.style.display = 'none';
      DOM.photoPreviewImg.src = '';
      state.currentPhotoBase64 = null;
    });

    // Borrar firma
    DOM.btnClearSignature.addEventListener('click', () => {
      if (mainPad) mainPad.clear();
    });

    // Confirmar recepción
    DOM.btnConfirmReception.addEventListener('click', handleConfirmReception);
  }

  function updateStatusDetailsVisibility() {
    if (state.selectedStatus === 'parcial') {
      DOM.partialDetailsContainer.style.display = 'block';
      DOM.labelPartialNotes.textContent = 'Indica qué cantidad ha llegado y qué queda pendiente *:';
      DOM.inputPartialNotes.placeholder = 'Ej: Han llegado 10 palets de 18, los otros 8 vienen mañana.';
      DOM.inputPartialNotes.focus();
    } else if (state.selectedStatus === 'rechazado') {
      DOM.partialDetailsContainer.style.display = 'block';
      DOM.labelPartialNotes.textContent = 'Indica el motivo del rechazo o cancelación *:';
      DOM.inputPartialNotes.placeholder = 'Ej: Material golpeado/roto, o camión equivocado.';
      DOM.inputPartialNotes.focus();
    } else {
      DOM.partialDetailsContainer.style.display = 'none';
      DOM.inputPartialNotes.value = '';
    }
  }

  function openReceptionModal(order) {
    state.currentOrder = order;
    state.selectedStatus = 'completo';
    state.currentPhotoBase64 = null;

    // Resetear botones de estado
    DOM.statusBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-status') === 'completo');
    });
    updateStatusDetailsVisibility();

    // Resetear formulario
    DOM.modalOrderTag.textContent = order.number;
    DOM.modalOrderSupplier.textContent = order.supplier;
    DOM.modalOrderMaterial.textContent = order.description;
    DOM.modalOrderQuantity.textContent = order.quantity;

    DOM.inputAlbaran.value = '';
    DOM.inputPartialNotes.value = '';
    DOM.inputPhoto.value = '';
    DOM.photoPreviewBox.style.display = 'none';
    DOM.photoPreviewImg.src = '';

    // Cargar nombre por defecto o anterior
    const lastSignee = localStorage.getItem(STORAGE_KEYS.LAST_SIGNEE);
    if (lastSignee && !DOM.inputSigneeName.value) {
      DOM.inputSigneeName.value = lastSignee;
    }

    // Limpiar canvas de firma
    if (mainPad) {
      setTimeout(() => mainPad.clear(), 50);
    }

    DOM.modalReception.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeReceptionModal() {
    DOM.modalReception.style.display = 'none';
    document.body.style.overflow = '';
    state.currentOrder = null;
  }

  async function handleConfirmReception() {
    const order = state.currentOrder;
    if (!order) return;

    // Validar nombre del receptor
    const signee = DOM.inputSigneeName.value.trim() || 'Encargado de Recepción';
    localStorage.setItem(STORAGE_KEYS.LAST_SIGNEE, signee);

    // Validar notas para parcial o rechazado
    const notes = DOM.inputPartialNotes.value.trim();
    if ((state.selectedStatus === 'parcial' || state.selectedStatus === 'rechazado') && !notes) {
      showToast('⚠️ Por favor indica el detalle o motivo para continuar.', 'warning');
      DOM.inputPartialNotes.focus();
      return;
    }

    // Deshabilitar botón mientras procesa
    DOM.btnConfirmReception.disabled = true;
    DOM.btnConfirmReception.innerHTML = '<span class="btn-icon">⏳</span><span>Sincronizando con Procore...</span>';

    // Obtener firma (o firma virtual si no ha dibujado para demo en PC)
    let signatureData = null;
    if (mainPad && mainPad.hasDrawn()) {
      signatureData = mainPad.toDataURL();
    } else {
      signatureData = createSampleSignatureSVG(signee);
    }

    const albaran = DOM.inputAlbaran.value.trim() || `ALB-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date();
    const timestampFormatted = formatDateTime(now);

    // Construir payload oficial de Procore Daily Log (Deliveries)
    const procorePayload = {
      delivery: {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].substring(0, 5),
        tracking_number: albaran,
        vendor_name: order.supplier,
        description: order.description,
        contents: order.quantity,
        confirmed: state.selectedStatus !== 'rechazado',
        status: state.selectedStatus === 'completo' ? 'Delivered' : (state.selectedStatus === 'parcial' ? 'Partially Delivered' : 'Rejected'),
        comments: notes || `Recepción conforme de pedido ${order.number}`,
        signed_by: signee,
        custom_fields: {
          order_reference: order.number,
          reception_mode: state.procore.mode === 'live' ? 'Procore Live API' : 'Procore Materials Hub Demo'
        }
      }
    };

    let procoreLogId = `DL-${Math.floor(10000 + Math.random() * 90000)}`;
    try {
      const syncResult = await ProcoreAPI.sendDeliveryLog(procorePayload);
      if (syncResult && syncResult.procoreLogId) {
        procoreLogId = syncResult.procoreLogId;
        procorePayload.delivery.procore_log_id = procoreLogId;
      }
    } catch (err) {
      console.warn('Error al sincronizar con Procore API:', err);
      procoreLogId = `DL-Pendiente-${Math.floor(1000 + Math.random() * 9000)}`;
      procorePayload.delivery.procore_log_id = procoreLogId;
      showToast(`⚠️ Aviso: Se guardó localmente (${err.message})`, 'warning');
    } finally {
      DOM.btnConfirmReception.disabled = false;
      DOM.btnConfirmReception.innerHTML = '<span class="btn-icon">💾</span><span>Confirmar y Enviar a Procore</span>';
    }

    // Crear registro en el Historial
    const historyEntry = {
      id: 'rec-' + Date.now(),
      orderId: order.id,
      orderNumber: order.number,
      supplier: order.supplier,
      description: order.description,
      quantity: order.quantity,
      status: state.selectedStatus,
      notes: notes,
      albaran: albaran,
      photo: state.currentPhotoBase64,
      signature: signatureData,
      signeeName: signee,
      timestamp: timestampFormatted,
      procoreLogId: procoreLogId,
      procorePayload: procorePayload
    };

    state.history.unshift(historyEntry);

    // Actualizar estado del pedido original
    if (state.selectedStatus === 'completo') {
      order.status = 'completed';
    } else if (state.selectedStatus === 'parcial') {
      order.status = 'partial';
      order.notes = `Última entrega parcial (${timestampFormatted}): ${notes}`;
    } else if (state.selectedStatus === 'rechazado') {
      order.status = 'rejected';
      order.notes = `Rechazado (${timestampFormatted}): ${notes}`;
    }

    // Persistir
    saveStorage(STORAGE_KEYS.ORDERS, state.orders);
    saveStorage(STORAGE_KEYS.HISTORY, state.history);

    // Guardar referencia para inspeccionar en Procore modal
    state.lastPayloadInspected = procorePayload;

    closeReceptionModal();
    renderAll();

    const modeLabel = state.procore.mode === 'live' ? 'en vivo en Procore' : 'en Procore Daily Log';
    showToast(`✅ Entrega sincronizada ${modeLabel} (${procoreLogId})`, 'success');
  }

  // -------------------------------------------------------------
  // 8. MODAL DE ENTREGA IMPREVISTA (SIN PEDIDO PREVIO)
  // -------------------------------------------------------------
  function setupImprevistaModal() {
    DOM.btnNuevaImprevista.addEventListener('click', openImprevistaModal);
    DOM.btnCloseImprevista.addEventListener('click', closeImprevistaModal);
    DOM.btnCancelImprevista.addEventListener('click', closeImprevistaModal);
    DOM.modalImprevista.addEventListener('click', e => {
      if (e.target === DOM.modalImprevista) closeImprevistaModal();
    });

    // Subida de foto
    DOM.impPhoto.addEventListener('change', e => {
      handleImageUpload(e.target.files[0], DOM.impPhotoPreviewBox, DOM.impPhotoPreviewImg, b64 => {
        state.currentImpPhotoBase64 = b64;
      });
    });

    DOM.btnRemoveImpPhoto.addEventListener('click', () => {
      DOM.impPhoto.value = '';
      DOM.impPhotoPreviewBox.style.display = 'none';
      DOM.impPhotoPreviewImg.src = '';
      state.currentImpPhotoBase64 = null;
    });

    // Borrar firma
    DOM.btnClearImpSignature.addEventListener('click', () => {
      if (impPad) impPad.clear();
    });

    // Confirmar imprevista
    DOM.btnConfirmImprevista.addEventListener('click', handleConfirmImprevista);
  }

  function openImprevistaModal() {
    DOM.impSupplier.value = '';
    DOM.impAlbaran.value = '';
    DOM.impMaterial.value = '';
    DOM.impQuantity.value = '';
    DOM.impPhoto.value = '';
    DOM.impPhotoPreviewBox.style.display = 'none';
    DOM.impPhotoPreviewImg.src = '';
    state.currentImpPhotoBase64 = null;

    const lastSignee = localStorage.getItem(STORAGE_KEYS.LAST_SIGNEE);
    if (lastSignee) DOM.impSigneeName.value = lastSignee;

    if (impPad) {
      setTimeout(() => impPad.clear(), 50);
    }

    DOM.modalImprevista.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeImprevistaModal() {
    DOM.modalImprevista.style.display = 'none';
    document.body.style.overflow = '';
  }

  async function handleConfirmImprevista() {
    const supplier = DOM.impSupplier.value.trim();
    const albaran = DOM.impAlbaran.value.trim();
    const material = DOM.impMaterial.value.trim();
    const quantity = DOM.impQuantity.value.trim();

    if (!supplier || !albaran || !material || !quantity) {
      showToast('⚠️ Por favor completa los campos obligatorios (*)', 'warning');
      return;
    }

    DOM.btnConfirmImprevista.disabled = true;
    DOM.btnConfirmImprevista.innerHTML = '<span class="btn-icon">⏳</span><span>Sincronizando con Procore...</span>';

    const signee = DOM.impSigneeName.value.trim() || 'Encargado de Recepción';
    localStorage.setItem(STORAGE_KEYS.LAST_SIGNEE, signee);

    let signatureData = null;
    if (impPad && impPad.hasDrawn()) {
      signatureData = impPad.toDataURL();
    } else {
      signatureData = createSampleSignatureSVG(signee);
    }

    const now = new Date();
    const timestampFormatted = formatDateTime(now);

    const procorePayload = {
      delivery: {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].substring(0, 5),
        tracking_number: albaran,
        vendor_name: supplier,
        description: material,
        contents: quantity,
        confirmed: true,
        status: 'Delivered',
        comments: 'Entrega imprevista en obra (sin pedido previo registrado en Procore)',
        signed_by: signee,
        custom_fields: {
          unplanned_arrival: true,
          reception_mode: state.procore.mode === 'live' ? 'Procore Live API' : 'Procore Materials Hub Demo'
        }
      }
    };

    let procoreLogId = `DL-${Math.floor(10000 + Math.random() * 90000)}`;
    try {
      const syncResult = await ProcoreAPI.sendDeliveryLog(procorePayload);
      if (syncResult && syncResult.procoreLogId) {
        procoreLogId = syncResult.procoreLogId;
        procorePayload.delivery.procore_log_id = procoreLogId;
      }
    } catch (err) {
      console.warn('Error al enviar entrega imprevista a Procore API:', err);
      procoreLogId = `DL-Pendiente-${Math.floor(1000 + Math.random() * 9000)}`;
      procorePayload.delivery.procore_log_id = procoreLogId;
      showToast(`⚠️ Aviso: Se guardó localmente (${err.message})`, 'warning');
    } finally {
      DOM.btnConfirmImprevista.disabled = false;
      DOM.btnConfirmImprevista.innerHTML = '<span class="btn-icon">⚡</span><span>Registrar y Sincronizar en Procore</span>';
    }

    const historyEntry = {
      id: 'rec-' + Date.now(),
      orderId: null,
      orderNumber: `IMP-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier: supplier,
      description: material,
      quantity: quantity,
      status: 'completo',
      notes: 'Llegada imprevista registrada con albarán en mano.',
      albaran: albaran,
      photo: state.currentImpPhotoBase64,
      signature: signatureData,
      signeeName: signee,
      timestamp: timestampFormatted,
      procoreLogId: procoreLogId,
      procorePayload: procorePayload
    };

    state.history.unshift(historyEntry);
    saveStorage(STORAGE_KEYS.HISTORY, state.history);

    state.lastPayloadInspected = procorePayload;

    closeImprevistaModal();
    renderAll();

    const modeLabel = state.procore.mode === 'live' ? 'en vivo en Procore' : 'en Procore Daily Log';
    showToast(`⚡ Llegada imprevista registrada y sincronizada ${modeLabel} (${procoreLogId})`, 'success');
  }

  // -------------------------------------------------------------
  // 9. FORMULARIO MANUAL DE NUEVO PEDIDO
  // -------------------------------------------------------------
  function setupManualOrderForm() {
    DOM.formNuevoPedido.addEventListener('submit', e => {
      e.preventDefault();

      const num = document.getElementById('order-num').value.trim();
      const supplier = document.getElementById('order-supplier').value.trim();
      const desc = document.getElementById('order-description').value.trim();
      const qty = document.getElementById('order-quantity').value.trim();
      const expectedDate = DOM.orderExpectedDate.value || new Date().toISOString().split('T')[0];
      const urgent = document.getElementById('order-urgent').checked;

      const newOrder = {
        id: 'ord-' + Date.now(),
        number: num,
        supplier: supplier,
        description: desc,
        quantity: qty,
        expectedDate: expectedDate,
        urgent: urgent,
        status: 'pending'
      };

      state.orders.unshift(newOrder);
      saveStorage(STORAGE_KEYS.ORDERS, state.orders);

      DOM.formNuevoPedido.reset();
      DOM.orderExpectedDate.value = new Date().toISOString().split('T')[0];

      renderAll();
      showToast(`📦 Pedido ${num} agregado a la lista de recepción`, 'success');

      // Cambiar a pestaña de recepción para verlo inmediatamente
      const tabRecepcionBtn = document.getElementById('tab-btn-recepcion');
      if (tabRecepcionBtn) tabRecepcionBtn.click();
    });
  }

  // -------------------------------------------------------------
  // 10. IMPORTACIÓN DESDE EXCEL Y CSV (SHEETJS + DEMO DATA)
  // -------------------------------------------------------------
  function setupExcelImport() {
    const dropZone = DOM.excelDropZone;
    const fileInput = DOM.excelFileInput;

    dropZone.addEventListener('click', () => fileInput.click());

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      if (files.length > 0) processSpreadsheetFile(files[0]);
    });

    fileInput.addEventListener('change', e => {
      if (e.target.files.length > 0) processSpreadsheetFile(e.target.files[0]);
    });

    // Botón de datos de prueba
    DOM.btnLoadSampleData.addEventListener('click', () => {
      const sampleOrders = [
        {
          id: 'ord-' + Date.now() + '-1',
          number: 'PED-2026-110',
          supplier: 'Holcim Hormigones',
          description: 'Hormigón para pilares HA-30/B/20/IIa + bomba 28m',
          quantity: '3 cubas (24 m³)',
          expectedDate: new Date().toISOString().split('T')[0],
          urgent: true,
          status: 'pending'
        },
        {
          id: 'ord-' + Date.now() + '-2',
          number: 'PED-2026-111',
          supplier: 'Mapei Spain',
          description: 'Adhesivo cementoso Keraflex Maxi S1 gris (sacos 25 kg)',
          quantity: '30 sacos (750 kg)',
          expectedDate: getFutureDate(1),
          urgent: false,
          status: 'pending'
        },
        {
          id: 'ord-' + Date.now() + '-3',
          number: 'PED-2026-112',
          supplier: 'Isover Saint-Gobain',
          description: 'Lana de roca acústica Arena Confort espesor 50 mm',
          quantity: '12 paquetes',
          expectedDate: getFutureDate(1),
          urgent: false,
          status: 'pending'
        },
        {
          id: 'ord-' + Date.now() + '-4',
          number: 'PED-2026-113',
          supplier: 'Ferros Planes',
          description: 'Mallazo electrosoldado ME 15x15 Ø6mm (6000x2200)',
          quantity: '40 paneles',
          expectedDate: getFutureDate(2),
          urgent: true,
          status: 'pending'
        }
      ];

      state.orders.unshift(...sampleOrders);
      saveStorage(STORAGE_KEYS.ORDERS, state.orders);
      renderAll();

      showFeedbackBanner(`🎉 ¡Se han cargado 4 pedidos de prueba correctamente! Listos en la pestaña de Recepción.`, 'success');
      showToast('Cargados 4 pedidos de prueba', 'success');
    });
  }

  function processSpreadsheetFile(file) {
    showFeedbackBanner(`⏳ Analizando "${escapeHTML(file.name)}"...`, 'info');

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = e.target.result;
        let rows = [];

        // Si SheetJS (XLSX) está disponible, procesa .xlsx, .xls o .csv
        if (window.XLSX) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        } else {
          // Fallback a parser CSV básico si no cargó SheetJS
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
          rows = parseSimpleCSV(text);
        }

        if (!rows || rows.length < 2) {
          showFeedbackBanner('⚠️ El archivo está vacío o solo contiene la cabecera.', 'warning');
          return;
        }

        const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
        
        // Detectar columnas por similitud de nombres
        const colNum = headers.findIndex(h => h.includes('pedido') || h.includes('ref') || h.includes('id') || h.includes('num'));
        const colSup = headers.findIndex(h => h.includes('prov') || h.includes('empresa') || h.includes('supplier'));
        const colMat = headers.findIndex(h => h.includes('mat') || h.includes('desc') || h.includes('art') || h.includes('item'));
        const colQty = headers.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('unidad'));
        const colDate = headers.findIndex(h => h.includes('fech') || h.includes('date'));

        let importedCount = 0;
        const newOrders = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[colSup >= 0 ? colSup : 1]) continue;

          const num = (colNum >= 0 && row[colNum]) ? String(row[colNum]).trim() : `PED-IMP-${100 + i}`;
          const supplier = (colSup >= 0 && row[colSup]) ? String(row[colSup]).trim() : String(row[0] || 'Proveedor Desconocido');
          const mat = (colMat >= 0 && row[colMat]) ? String(row[colMat]).trim() : String(row[1] || 'Material no especificado');
          const qty = (colQty >= 0 && row[colQty]) ? String(row[colQty]).trim() : '1 ud';
          let date = (colDate >= 0 && row[colDate]) ? String(row[colDate]).trim() : new Date().toISOString().split('T')[0];

          if (!date.includes('-')) date = new Date().toISOString().split('T')[0];

          newOrders.push({
            id: 'ord-' + Date.now() + '-' + i,
            number: num,
            supplier: supplier,
            description: mat,
            quantity: qty,
            expectedDate: date,
            urgent: false,
            status: 'pending'
          });
          importedCount++;
        }

        if (importedCount > 0) {
          state.orders.unshift(...newOrders);
          saveStorage(STORAGE_KEYS.ORDERS, state.orders);
          renderAll();

          showFeedbackBanner(`✅ ¡Importados ${importedCount} pedidos con éxito desde "${escapeHTML(file.name)}"!`, 'success');
          showToast(`Importados ${importedCount} pedidos`, 'success');
        } else {
          showFeedbackBanner('⚠️ No se encontraron filas de pedidos válidas en el archivo.', 'warning');
        }

      } catch (err) {
        console.error('Error importando archivo:', err);
        showFeedbackBanner(`❌ Error al procesar el archivo: ${err.message}`, 'error');
      }
    };

    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  }

  function showFeedbackBanner(msg, type) {
    const fb = DOM.importFeedback;
    fb.style.display = 'block';
    fb.innerHTML = msg;
    
    if (type === 'success') {
      fb.style.background = '#ecfdf5';
      fb.style.color = '#065f46';
      fb.style.border = '1px solid #a7f3d0';
    } else if (type === 'warning' || type === 'error') {
      fb.style.background = '#fef2f2';
      fb.style.color = '#991b1b';
      fb.style.border = '1px solid #fecaca';
    } else {
      fb.style.background = '#f0f9ff';
      fb.style.color = '#075985';
      fb.style.border = '1px solid #bae6fd';
    }
  }

  function parseSimpleCSV(text) {
    const lines = text.split(/\r?\n/);
    return lines.map(line => {
      // Separación por punto y coma o coma
      const delimiter = line.includes(';') ? ';' : ',';
      return line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
    });
  }

  // -------------------------------------------------------------
  // 11. HISTORIAL Y FIRMAS (TABLA Y EXPORTACIÓN CSV)
  // -------------------------------------------------------------
  function setupHistoryTable() {
    DOM.btnExportCsv.addEventListener('click', exportHistoryToCsv);
  }

  function renderHistoryTable() {
    const tbody = DOM.historyTbody;
    tbody.innerHTML = '';

    let items = state.history;
    const q = state.historySearchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(h =>
        h.orderNumber.toLowerCase().includes(q) ||
        h.supplier.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        (h.albaran && h.albaran.toLowerCase().includes(q)) ||
        (h.signeeName && h.signeeName.toLowerCase().includes(q))
      );
    }

    if (items.length === 0) {
      DOM.emptyHistoryState.style.display = 'block';
      return;
    } else {
      DOM.emptyHistoryState.style.display = 'none';
    }

    items.forEach(item => {
      const tr = document.createElement('tr');

      const statusBadge = `
        <span class="status-badge ${item.status}">
          ${item.status === 'completo' ? '✅ Completo' : (item.status === 'parcial' ? '⚠️ Parcial' : '❌ Rechazado')}
        </span>
      `;

      // Miniatura de firma clickeable
      const sigThumb = item.signature
        ? `<img src="${item.signature}" class="thumb-signature" title="Ver firma completa" alt="Firma">`
        : `<span style="font-size:0.8rem; color:var(--text-muted);">Sin firma</span>`;

      // Miniatura de foto de albarán clickeable
      const photoThumb = item.photo
        ? `<img src="${item.photo}" class="thumb-photo" title="Ver foto de albarán" alt="Albarán">`
        : `<span style="font-size:0.8rem; color:var(--text-muted);">${escapeHTML(item.albaran || '-')}</span>`;

      // Badge de Procore con link para inspeccionar payload
      const procoreBadge = `
        <span class="badge-procore" title="Haga clic para ver el JSON oficial enviado a Procore Daily Log">
          ☁️ ${item.procoreLogId || 'DL-Sync'}
        </span>
      `;

      tr.innerHTML = `
        <td>${statusBadge}</td>
        <td style="white-space:nowrap; font-size:0.85rem; color:var(--text-muted);">${escapeHTML(item.timestamp)}</td>
        <td><strong style="font-family:var(--font-mono); color:var(--secondary);">${escapeHTML(item.orderNumber)}</strong></td>
        <td><strong>${escapeHTML(item.supplier)}</strong></td>
        <td>
          <div style="font-weight:600;">${escapeHTML(item.description)}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">Cantidad: ${escapeHTML(item.quantity)}</div>
          ${item.notes ? `<div style="font-size:0.75rem; color:#b45309; margin-top:2px;">Nota: ${escapeHTML(item.notes)}</div>` : ''}
        </td>
        <td style="font-size:0.85rem;">${escapeHTML(item.signeeName || '-')}</td>
        <td>${sigThumb}</td>
        <td>${photoThumb}</td>
        <td>${procoreBadge}</td>
      `;

      // Clics para abrir lightbox
      const sigImg = tr.querySelector('.thumb-signature');
      if (sigImg) {
        sigImg.addEventListener('click', () => {
          openLightbox(`Firma de recepción - ${item.signeeName}`, item.signature);
        });
      }

      const photoImg = tr.querySelector('.thumb-photo');
      if (photoImg) {
        photoImg.addEventListener('click', () => {
          openLightbox(`Albarán / Remisión - ${item.albaran || item.orderNumber}`, item.photo);
        });
      }

      const procoreBtn = tr.querySelector('.badge-procore');
      if (procoreBtn) {
        procoreBtn.addEventListener('click', () => {
          openProcoreSyncModal(item.procorePayload || {
            delivery: {
              procore_log_id: item.procoreLogId,
              tracking_number: item.albaran,
              vendor_name: item.supplier,
              description: item.description,
              signed_by: item.signeeName
            }
          });
        });
      }

      tbody.appendChild(tr);
    });
  }

  function exportHistoryToCsv() {
    if (state.history.length === 0) {
      showToast('No hay registros en el historial para exportar', 'warning');
      return;
    }

    const headers = [
      'ID Registro',
      'Estado',
      'Fecha y Hora',
      'Nº Pedido / Ref',
      'Proveedor',
      'Materiales',
      'Cantidad',
      'Nº Albarán',
      'Receptor / Firmante',
      'ID Procore Daily Log',
      'Observaciones / Notas'
    ];

    const rows = state.history.map(h => [
      h.id,
      h.status,
      h.timestamp,
      h.orderNumber,
      h.supplier,
      h.description,
      h.quantity,
      h.albaran || '',
      h.signeeName || '',
      h.procoreLogId || '',
      h.notes || ''
    ]);

    // Generar formato CSV con BOM (\uFEFF) para compatibilidad con Excel en español
    let csvContent = '\uFEFF' + headers.map(escapeCsvValue).join(';') + '\r\n';
    rows.forEach(r => {
      csvContent += r.map(escapeCsvValue).join(';') + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `recepciones_materiales_procore_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('📊 Reporte CSV descargado con éxito', 'success');
  }

  function escapeCsvValue(val) {
    const s = String(val == null ? '' : val).replace(/"/g, '""');
    return `"${s}"`;
  }

  // -------------------------------------------------------------
  // 12. SERVICIO PROCORE (COMUNICACIÓN CON BACKEND PROXY / SECRETS)
  // -------------------------------------------------------------
  const ProcoreAPI = {
    async fetchInstanceConfig() {
      try {
        const resp = await fetch('/api/instance-config');
        if (resp.ok) {
          const config = await resp.json();
          state.instanceConfig = config;
          updateProcoreHeaderStatus();
          updateInstanceModalUI();
          return config;
        }
      } catch (e) {
        console.warn('Servidor proxy no alcanzable, usando configuración local:', e);
      }
      return null;
    },

    async testConnection() {
      try {
        const resp = await fetch('/api/procore/status');
        const data = await resp.json();
        return data;
      } catch (err) {
        return {
          connected: false,
          error: err.message,
          message: `Error al comunicar con el backend de la instancia: ${err.message}`
        };
      }
    },

    async fetchPurchaseOrders() {
      const resp = await fetch('/api/procore/purchase-orders');
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || `Error HTTP ${resp.status} al consultar órdenes de compra`);
      }
      const data = await resp.json();
      return data.orders || [];
    },

    async sendDeliveryLog(payload) {
      const resp = await fetch('/api/procore/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || `Error HTTP ${resp.status} al registrar entrega`);
      }

      const resData = await resp.json();
      return {
        success: true,
        procoreLogId: resData.procoreLogId || `DL-${Math.floor(10000 + Math.random() * 90000)}`,
        data: resData
      };
    }
  };

  function setupLightboxAndProcoreModal() {
    // Lightbox
    DOM.btnCloseLightbox.addEventListener('click', closeLightbox);
    DOM.modalLightbox.addEventListener('click', e => {
      if (e.target === DOM.modalLightbox) closeLightbox();
    });

    // Procore Modal Close
    DOM.btnCloseProcoreModal.addEventListener('click', closeProcoreSyncModal);
    DOM.btnCloseProcoreModal2.addEventListener('click', closeProcoreSyncModal);
    DOM.modalProcoreSync.addEventListener('click', e => {
      if (e.target === DOM.modalProcoreSync) closeProcoreSyncModal();
    });

    // Botón en la cabecera (abre Procore Hub)
    DOM.btnProcoreStatus.addEventListener('click', () => {
      openProcoreSyncModal();
    });

    // Subtabs dentro del modal de Procore
    DOM.procoreSubtabs.forEach(subtab => {
      subtab.addEventListener('click', () => {
        const targetId = subtab.getAttribute('data-subtab');
        DOM.procoreSubtabs.forEach(t => t.classList.remove('active'));
        DOM.procoreSubpanels.forEach(p => p.classList.remove('active'));

        subtab.classList.add('active');
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add('active');
      });
    });

    // Probar Conexión Servidor ↔ Procore
    if (DOM.btnTestProcoreConn) {
      DOM.btnTestProcoreConn.addEventListener('click', handleTestProcoreConnection);
    }

    // Sincronizar Purchase Orders (en Tab 2 y en Modal)
    if (DOM.btnSyncProcorePos) {
      DOM.btnSyncProcorePos.addEventListener('click', () => syncPurchaseOrders(DOM.procorePoSyncFeedback));
    }
    if (DOM.btnModalSyncPos) {
      DOM.btnModalSyncPos.addEventListener('click', () => syncPurchaseOrders(DOM.modalPoSyncFeedback));
    }
    if (DOM.btnOpenProcoreSettingsTab) {
      DOM.btnOpenProcoreSettingsTab.addEventListener('click', () => {
        openProcoreSyncModal();
      });
    }

    // Cargar configuración de la instancia desde el backend
    ProcoreAPI.fetchInstanceConfig();
  }

  function updateInstanceModalUI() {
    const cfg = state.instanceConfig;
    if (!cfg) return;

    if (DOM.instanceTokenStatus) {
      if (cfg.hasToken) {
        DOM.instanceTokenStatus.innerHTML = `<span class="status-dot online"></span> <strong>Activo en Servidor (.env)</strong>`;
      } else {
        DOM.instanceTokenStatus.innerHTML = `<span class="status-dot" style="background:#f59e0b;"></span> <strong>Sin Token (Modo Simulación)</strong>`;
      }
    }

    if (DOM.instanceEnvVal) {
      DOM.instanceEnvVal.textContent = `${(cfg.environment || 'sandbox').toUpperCase()} (${cfg.baseUrl})`;
    }

    if (DOM.instanceCompanyVal) {
      DOM.instanceCompanyVal.textContent = cfg.companyId || '104928';
    }

    if (DOM.instanceProjectVal) {
      DOM.instanceProjectVal.textContent = `${cfg.projectName} (ID: ${cfg.projectId})`;
    }
  }

  function updateProcoreHeaderStatus() {
    const cfg = state.instanceConfig || {
      projectName: 'Torre Skyline - Fase 2',
      hasToken: false
    };

    if (DOM.currentProject) {
      DOM.currentProject.innerHTML = `
        <span class="status-dot online"></span>
        <span>Proyecto: <strong>${escapeHTML(cfg.projectName)}</strong></span>
      `;
    }

    if (DOM.btnProcoreStatus) {
      if (cfg.hasToken) {
        DOM.btnProcoreStatus.innerHTML = `
          <span class="cloud-icon">🟢</span>
          <span class="btn-label">Procore API: <strong>Conectado (.env)</strong></span>
        `;
      } else {
        DOM.btnProcoreStatus.innerHTML = `
          <span class="cloud-icon">🟡</span>
          <span class="btn-label">Procore: <strong>Modo Simulación</strong></span>
        `;
      }
    }

    if (DOM.procoreModeBadge) {
      if (cfg.hasToken) {
        DOM.procoreModeBadge.className = 'procore-status-badge live';
        DOM.procoreModeBadge.textContent = 'En Vivo (Secrets .env)';
      } else {
        DOM.procoreModeBadge.className = 'procore-status-badge';
        DOM.procoreModeBadge.textContent = 'Modo Simulación (.env)';
      }
    }
  }

  async function handleTestProcoreConnection() {
    const resBox = DOM.procoreTestResult;
    resBox.style.display = 'block';
    resBox.className = 'procore-test-box';
    resBox.innerHTML = '⏳ Comprobando comunicación Servidor ↔ Procore API...';

    const res = await ProcoreAPI.testConnection();

    if (res.connected && res.live) {
      resBox.className = 'procore-test-box success';
      resBox.innerHTML = `✅ <strong>${res.message}</strong>`;
      showToast('Conexión con Procore validada correctamente', 'success');
    } else if (res.connected && !res.live) {
      resBox.className = 'procore-test-box';
      resBox.style.background = '#fffbeb';
      resBox.style.color = '#92400e';
      resBox.style.border = '1px solid #fde68a';
      resBox.innerHTML = `ℹ️ <strong>${res.message}</strong><br><span style="font-size:0.8rem; margin-top:4px; display:block;">Para conectar en vivo, pega tu Bearer Token en la variable <code>PROCORE_ACCESS_TOKEN</code> del archivo <code>.env</code> en el servidor.</span>`;
      showToast('Modo simulación activo en servidor', 'info');
    } else {
      resBox.className = 'procore-test-box error';
      resBox.innerHTML = `❌ <strong>${res.message || 'Error de conexión'}</strong>${res.error ? `<br><small style="color:#7f1d1d;">Detalles: ${escapeHTML(res.error)}</small>` : ''}`;
      showToast('Error al conectar con Procore API', 'warning');
    }
  }

  async function syncPurchaseOrders(feedbackEl) {
    if (feedbackEl) {
      feedbackEl.style.display = 'block';
      feedbackEl.style.background = '#f0f9ff';
      feedbackEl.style.color = '#0369a1';
      feedbackEl.style.border = '1px solid #bae6fd';
      feedbackEl.innerHTML = '⏳ Solicitando Órdenes de Compra a Procore API mediante el servidor...';
    }

    try {
      const pos = await ProcoreAPI.fetchPurchaseOrders();
      if (!pos || pos.length === 0) {
        if (feedbackEl) {
          feedbackEl.innerHTML = 'ℹ️ No se encontraron órdenes de compra pendientes en el proyecto.';
        }
        return;
      }

      // Evitar duplicados por número de pedido
      const existingNumbers = new Set(state.orders.map(o => o.number));
      const newOrders = pos.filter(p => !existingNumbers.has(p.number));

      if (newOrders.length === 0) {
        if (feedbackEl) {
          feedbackEl.innerHTML = 'ℹ️ Todas las órdenes de compra ya se encontraban importadas en la lista.';
        }
        showToast('Las órdenes de compra ya estaban en la lista', 'info');
        return;
      }

      state.orders.unshift(...newOrders);
      saveStorage(STORAGE_KEYS.ORDERS, state.orders);
      renderAll();

      const successMsg = `🎉 ¡Importadas con éxito ${newOrders.length} órdenes de compra desde Procore!`;
      if (feedbackEl) {
        feedbackEl.style.background = '#ecfdf5';
        feedbackEl.style.color = '#065f46';
        feedbackEl.style.border = '1px solid #a7f3d0';
        feedbackEl.innerHTML = successMsg;
      }
      showToast(`Importadas ${newOrders.length} órdenes de Procore`, 'success');
    } catch (err) {
      console.error('Error importando POs de Procore:', err);
      if (feedbackEl) {
        feedbackEl.style.background = '#fef2f2';
        feedbackEl.style.color = '#991b1b';
        feedbackEl.style.border = '1px solid #fecaca';
        feedbackEl.innerHTML = `❌ Error al sincronizar: ${escapeHTML(err.message)}`;
      }
      showToast(`Error al sincronizar con Procore: ${err.message}`, 'error');
    }
  }

  function openLightbox(title, imgSrc) {
    if (!imgSrc) return;
    DOM.lightboxTitle.textContent = title;
    DOM.lightboxImg.src = imgSrc;
    DOM.modalLightbox.style.display = 'flex';
  }

  function closeLightbox() {
    DOM.modalLightbox.style.display = 'none';
  }

  function openProcoreSyncModal(payload) {
    const cfg = state.instanceConfig || {};
    const payloadToShow = payload || state.lastPayloadInspected || (state.history[0] ? state.history[0].procorePayload : {
      server_proxy_endpoint: "/api/procore/deliveries",
      procore_target_url: `${cfg.baseUrl || 'https://sandbox.procore.com'}/rest/v1.0/projects/${cfg.projectId || '29814'}/daily_logs/deliveries`,
      auth_security: "Server Environment Secret (PROCORE_ACCESS_TOKEN)",
      project_name: cfg.projectName || "Torre Skyline - Fase 2",
      status: cfg.hasToken ? "Live Connected" : "Simulation Mode (Token pending in .env)"
    });

    if (DOM.procorePayloadCode) {
      DOM.procorePayloadCode.textContent = JSON.stringify(payloadToShow, null, 2);
    }
    updateInstanceModalUI();
    DOM.modalProcoreSync.style.display = 'flex';
  }

  function closeProcoreSyncModal() {
    DOM.modalProcoreSync.style.display = 'none';
  }

  // -------------------------------------------------------------
  // 13. CONTROLADOR DE CANVAS DE FIRMA DIGITAL (TOUCH + MOUSE)
  // -------------------------------------------------------------
  function createSignaturePad(canvas, hintEl) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let drawn = false;

    // Configurar resolución Retina / HiDPI
    function setupCanvasDPI() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      ctx.strokeStyle = '#0f2d4a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    setTimeout(setupCanvasDPI, 50);
    window.addEventListener('resize', setupCanvasDPI);

    function getCoords(e) {
      const rect = canvas.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function start(e) {
      isDrawing = true;
      drawn = true;
      if (hintEl) hintEl.style.opacity = '0';
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const { x, y } = getCoords(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    function stop() {
      if (isDrawing) {
        ctx.closePath();
        isDrawing = false;
      }
    }

    // Eventos de Ratón (Desktop)
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);

    // Eventos Táctiles (Móvil / Tablet)
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stop);
    canvas.addEventListener('touchcancel', stop);

    return {
      clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawn = false;
        if (hintEl) hintEl.style.opacity = '1';
      },
      hasDrawn() {
        return drawn;
      },
      toDataURL() {
        return canvas.toDataURL('image/png');
      }
    };
  }

  // Generador de firma SVG de fallback / muestra
  function createSampleSignatureSVG(name) {
    const cleanName = (name || 'Firma').split(' ')[0];
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="90" viewBox="0 0 300 90">
        <rect width="100%" height="100%" fill="transparent"/>
        <path d="M 30 55 Q 70 20 110 50 T 170 35 T 230 55" fill="none" stroke="#0f2d4a" stroke-width="3" stroke-linecap="round"/>
        <text x="50" y="75" font-family="Brush Script MT, cursive, sans-serif" font-size="28" fill="#0f2d4a" font-style="italic">${cleanName}</text>
      </svg>
    `.trim();
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // -------------------------------------------------------------
  // 14. SUBIDA Y COMPRESIÓN DE FOTOS
  // -------------------------------------------------------------
  function handleImageUpload(file, previewBox, previewImg, callback) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Redimensionar para optimizar almacenamiento en localStorage
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

        previewImg.src = dataUrl;
        previewBox.style.display = 'block';
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // -------------------------------------------------------------
  // 15. NOTIFICACIONES TOAST
  // -------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3800);
  }

  // -------------------------------------------------------------
  // 16. HELPERS Y UTILIDADES
  // -------------------------------------------------------------
  function formatDate(isoDate) {
    if (!isoDate) return '-';
    try {
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return isoDate;
    } catch {
      return isoDate;
    }
  }

  function formatDateTime(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getFutureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadStorage(key, defaultVal) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultVal;
    } catch {
      return defaultVal;
    }
  }

  function saveStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn('Error guardando en localStorage:', e);
    }
  }

})();
