(function () {
  'use strict';

  var form = document.getElementById('leadForm');
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.wizard-step'));
  var totalSteps = steps.length;
  var current = 1;
  var backBtn = document.getElementById('wizardBack');
  var progressBar = document.getElementById('wizardProgressBar');
  var stepLabel = document.getElementById('wizardStepLabel');
  var stepTitleEl = document.getElementById('wizardStepTitle');

  var stepTitles = {
    1: 'O seu objetivo',
    2: 'O seu imóvel',
    3: 'Simulação',
    4: 'Situação profissional',
    5: 'Encargos e crédito',
    6: 'Quando avançar',
    7: 'Contacto'
  };

  // Lead scoring: soma dos pesos escolhidos nas perguntas qualificadoras
  var score = { estado_processo: 0, incidentes_credito: 0, urgencia: 0 };

  function gtmPush(eventName, stepNum) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, wizard_step: stepNum });
  }

  function syncHeight() {
    var activeStep = steps[current - 1];
    if (!activeStep) return;
    // mede a altura natural do passo ativo (temporariamente sem a transição, para medir corretamente)
    form.style.height = activeStep.scrollHeight + 'px';
  }

  function showStep(n) {
    steps.forEach(function (s) {
      s.classList.toggle('active', parseInt(s.dataset.step, 10) === n);
    });
    var previous = current;
    current = n;
    var pct = (n / totalSteps) * 100;
    if (progressBar) progressBar.style.width = pct + '%';
    if (stepLabel) stepLabel.textContent = 'Passo ' + n + ' de ' + totalSteps;
    if (stepTitleEl) stepTitleEl.textContent = stepTitles[n] || '';
    if (backBtn) backBtn.style.display = n > 1 ? 'block' : 'none';
    gtmPush('wizard_step_view', n);
    syncHeight();
    // Passo 4 (situação profissional/financeira) pode crescer bastante — 2º
    // titular, "outra situação" — e ao validar e avançar para o passo 5 o
    // utilizador fica a meio da página sem ver o topo do formulário. Só esta
    // transição faz scroll, até ao topo do próprio cartão do formulário (não
    // da secção hero nem da página).
    if (previous === 4 && n === 5) {
      var formCard = document.getElementById('formulario');
      if (formCard) formCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  window.addEventListener('resize', syncHeight);

  function clearFieldError(el) {
    var group = el.closest('.form-group, .checkbox-group');
    if (group) group.classList.remove('error');
  }

  function stepIsValid(n) {
    var stepEl = steps[n - 1];
    var required = stepEl.querySelectorAll('[required]');
    var valid = true;
    required.forEach(function (field) {
      var isChecked = field.type === 'checkbox' ? field.checked : true;
      var hasValue = field.type === 'checkbox' ? true : !!field.value.trim();
      if (!isChecked || !hasValue) {
        valid = false;
        var group = field.closest('.form-group, .checkbox-group');
        if (group) group.classList.add('error');
      }
    });
    return valid;
  }

  function goNext() {
    if (!stepIsValid(current)) {
      var stepEl = steps[current - 1];
      var msg = stepEl.querySelector('.checkbox-error');
      if (msg) msg.style.display = 'block';
      return;
    }
    if (current < totalSteps) showStep(current + 1);
  }

  function goBack() {
    if (current > 1) showStep(current - 1);
  }

  if (backBtn) backBtn.addEventListener('click', goBack);

  // Botões "Continuar" (passos com inputs de texto/sliders)
  form.querySelectorAll('[data-next]').forEach(function (btn) {
    btn.addEventListener('click', goNext);
  });

  // Enter avança nos passos com inputs de texto (exceto no último passo, que submete)
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var stepEl = steps[current - 1];
    if (!stepEl.contains(e.target)) return;
    if (current === totalSteps) return; // deixa submeter normalmente
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    goNext();
  });

  // Limpa erro ao corrigir campo
  form.querySelectorAll('input, select, textarea').forEach(function (field) {
    field.addEventListener('input', function () { clearFieldError(field); });
    field.addEventListener('change', function () { clearFieldError(field); });
  });

  // ===== Option cards (seleção única, com avanço automático) =====
  // Campos que partilham o passo com outras perguntas (nº titulares, rendimento, etc.)
  // não avançam sozinhos — avançar automaticamente validaria campos que o utilizador
  // ainda nem viu, pintando-os de erro sem motivo.
  var noAutoAdvanceFields = ['situacao_profissional', 'situacao_profissional_t2'];
  var optionGroups = form.querySelectorAll('.option-grid');
  optionGroups.forEach(function (grid) {
    var fieldName = grid.dataset.field;
    var hiddenInput = document.getElementById('f_' + fieldName);
    var cards = grid.querySelectorAll('.option-card');

    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        // Seleciona apenas dentro do mesmo grupo de campo (pode haver 2 variantes no mesmo passo)
        form.querySelectorAll('.option-grid[data-field="' + fieldName + '"] .option-card').forEach(function (c) {
          c.classList.remove('selected');
        });
        card.classList.add('selected');
        if (hiddenInput) hiddenInput.value = card.dataset.value;

        if (['estado_processo', 'incidentes_credito', 'urgencia'].indexOf(fieldName) !== -1) {
          score[fieldName] = parseFloat(card.dataset.weight || '0');
        }

        var stepEl = card.closest('.wizard-step');
        clearFieldError(hiddenInput || card);
        gtmPush('wizard_option_' + fieldName, current);

        if (fieldName === 'finalidade') applyBranching(card.dataset.value);
        if (fieldName === 'situacao_profissional') toggleOutraSituacao(card.dataset.value === 'Outra');
        if (fieldName === 'situacao_profissional_t2') toggleOutraSituacaoT2(card.dataset.value === 'Outra');

        // Avança automaticamente após pequena pausa para feedback visual
        // (exceto em campos que partilham o passo com outras perguntas)
        if (noAutoAdvanceFields.indexOf(fieldName) === -1) {
          window.setTimeout(function () {
            if (parseInt(stepEl.dataset.step, 10) === current) goNext();
          }, 260);
        }
      });
    });
  });

  var outraWrap = document.getElementById('outraSituacaoWrap');
  var outraInput = document.getElementById('situacao_outra');
  function toggleOutraSituacao(show) {
    if (!outraWrap || !outraInput) return;
    outraWrap.style.display = show ? '' : 'none';
    outraInput.required = show;
    if (!show) {
      outraInput.value = '';
      clearFieldError(outraInput);
    }
    syncHeight();
  }

  var outraWrapT2 = document.getElementById('outraSituacaoWrapT2');
  var outraInputT2 = document.getElementById('situacao_outra_t2');
  function toggleOutraSituacaoT2(show) {
    if (!outraWrapT2 || !outraInputT2) return;
    outraWrapT2.style.display = show ? '' : 'none';
    outraInputT2.required = show;
    if (!show) {
      outraInputT2.value = '';
      clearFieldError(outraInputT2);
    }
    syncHeight();
  }

  var titular2Block = document.getElementById('titular2Block');
  var fSituacaoT2 = document.getElementById('f_situacao_profissional_t2');
  var rendimentoT2 = document.getElementById('rendimento_liquido_t2');
  function toggleTitular2(show) {
    if (!titular2Block) return;
    titular2Block.style.display = show ? '' : 'none';
    if (fSituacaoT2) fSituacaoT2.required = show;
    if (rendimentoT2) rendimentoT2.required = show;
    if (!show) {
      // limpa seleção e valores do 2º titular ao voltar para "1 titular"
      titular2Block.querySelectorAll('.option-card').forEach(function (c) { c.classList.remove('selected'); });
      if (fSituacaoT2) fSituacaoT2.value = '';
      if (rendimentoT2) rendimentoT2.value = '';
      toggleOutraSituacaoT2(false);
    }
    syncHeight();
  }
  var titularesSelect = document.getElementById('titulares');
  if (titularesSelect) {
    titularesSelect.addEventListener('change', function () {
      toggleTitular2(titularesSelect.value === '2');
    });
  }

  // ===== Adapta o formulário à resposta do passo 1 (ex: transferência de crédito) =====
  var step2El = form.querySelector('.wizard-step[data-step="2"]');
  var step3Title = document.getElementById('step3Title');
  var grupoValorImovel = document.getElementById('grupoValorImovel');
  var labelValorFinanciar = document.getElementById('labelValorFinanciar');
  var labelPrazo = document.getElementById('labelPrazo');
  var hiddenEstado = document.getElementById('f_estado_processo');

  function applyBranching(finalidadeValue) {
    var isTransfer = finalidadeValue === 'transferencia';

    // Passo 2: troca o conjunto de perguntas
    step2El.querySelectorAll('.wizard-variant').forEach(function (variant) {
      var shouldShow = (variant.dataset.variant === 'transferencia') === isTransfer;
      variant.style.display = shouldShow ? '' : 'none';
    });
    step2El.querySelectorAll('.option-card').forEach(function (c) { c.classList.remove('selected'); });
    if (hiddenEstado) hiddenEstado.value = '';
    score.estado_processo = 0;

    // Passo 3: numa transferência não faz sentido perguntar o valor do imóvel
    if (grupoValorImovel) grupoValorImovel.style.display = isTransfer ? 'none' : '';
    if (labelValorFinanciar) labelValorFinanciar.textContent = isTransfer ? 'Capital em dívida atual' : 'Valor de financiamento desejado';
    if (labelPrazo) labelPrazo.textContent = isTransfer ? 'Prazo restante do crédito' : 'Prazo';
    if (step3Title) step3Title.textContent = isTransfer ? 'Indique o capital em dívida atual' : 'Calcule a sua mensalidade estimada';
  }

  // ===== Sliders =====
  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function updateSliderFill(slider) {
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var val = parseFloat(slider.value);
    var pct = ((val - min) / (max - min)) * 100;
    slider.style.background = 'linear-gradient(to right, #C8102E 0%, #C8102E ' + pct + '%, #ddd ' + pct + '%, #ddd 100%)';
  }
  function initSlider(sliderId, displayId) {
    var slider = document.getElementById(sliderId);
    var display = document.getElementById(displayId);
    if (!slider) return;
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var step = parseFloat(slider.step) || 1;

    updateSliderFill(slider);

    slider.addEventListener('input', function () {
      display.value = formatNum(slider.value);
      updateSliderFill(slider);
    });
    display.addEventListener('focus', function () { display.select(); });
    display.addEventListener('input', function () {
      var raw = display.value.replace(/[^\d]/g, '');
      var num = parseInt(raw, 10);
      if (!isNaN(num)) {
        var clamped = Math.min(Math.max(num, min), max);
        clamped = Math.round(clamped / step) * step;
        slider.value = clamped;
        updateSliderFill(slider);
      }
    });
    display.addEventListener('blur', function () {
      var raw = display.value.replace(/[^\d]/g, '');
      var num = parseInt(raw, 10);
      if (isNaN(num) || num < min) { slider.value = min; }
      else if (num > max) { slider.value = max; }
      else { slider.value = Math.min(Math.max(Math.round(num / step) * step, min), max); }
      display.value = formatNum(slider.value);
      updateSliderFill(slider);
    });
    display.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); display.blur(); }
    });
  }
  initSlider('valor_imovel', 'valor_imovel_display');
  initSlider('valor_financiar', 'valor_financiar_display');
  initSlider('prazo', 'prazo_display');

  (function capFinanciar() {
    var sliderImovel = document.getElementById('valor_imovel');
    var sliderFinanciar = document.getElementById('valor_financiar');
    var displayFinanciar = document.getElementById('valor_financiar_display');
    if (!sliderImovel || !sliderFinanciar) return;

    function cap() {
      if (grupoValorImovel && grupoValorImovel.style.display === 'none') return;
      var limMax = parseFloat(sliderImovel.value);
      if (parseFloat(sliderFinanciar.value) > limMax) {
        sliderFinanciar.value = limMax;
        displayFinanciar.value = formatNum(limMax);
        updateSliderFill(sliderFinanciar);
      }
    }
    sliderImovel.addEventListener('input', cap);
    sliderFinanciar.addEventListener('input', cap);
    displayFinanciar.addEventListener('blur', cap);
  })();

  // ===== Cálculo da prestação estimada (para a página de agradecimento) =====
  function calcPrestacao(capital, prazoAnos, taxaAnualPercent) {
    var i = (taxaAnualPercent / 100) / 12;
    var n = prazoAnos * 12;
    if (i === 0) return capital / n;
    return capital * i / (1 - Math.pow(1 + i, -n));
  }
  var SPREAD = 0.8;
  var EURIBOR_6M = 2.621;
  var TAN = SPREAD + EURIBOR_6M;

  // ===== Submissão =====
  form.addEventListener('submit', function (e) {
    form.querySelectorAll('.form-group.error, .checkbox-group.error').forEach(function (el) {
      el.classList.remove('error');
    });
    var errBox = document.getElementById('wizardErrorMsg');
    if (errBox) errBox.style.display = 'none';

    if (!stepIsValid(totalSteps)) {
      e.preventDefault();
      if (errBox) {
        errBox.textContent = 'Por favor preencha todos os campos obrigatórios.';
        errBox.style.display = 'block';
      }
      return;
    }

    // Calcula pontuação final e etiqueta de qualificação
    var total = score.estado_processo + score.urgencia + score.incidentes_credito;
    var label = total >= 5 ? 'Quente' : (total >= 3 ? 'Morno' : 'Frio');
    document.getElementById('hidden_lead_score').value = total;
    document.getElementById('hidden_qualificacao').value = label;

    // Guarda dados para a página de agradecimento (mesma aba)
    try {
      var capital = parseFloat(document.getElementById('valor_financiar').value) || 250000;
      var prazo = parseFloat(document.getElementById('prazo').value) || 35;
      var prestacao = calcPrestacao(capital, prazo, TAN);
      sessionStorage.setItem('sim_valor_financiar', capital);
      sessionStorage.setItem('sim_prazo', prazo);
      sessionStorage.setItem('sim_prestacao', Math.round(prestacao));
      sessionStorage.setItem('sim_nome', document.getElementById('nome').value);
    } catch (err) { /* noop */ }

    gtmPush('wizard_submit', totalSteps);

    var submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'A enviar...';
    }
    // deixa o formulário submeter nativamente para o Netlify Forms
  });

  showStep(1);
})();
