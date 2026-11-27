/*
 * PROTOTIPO DESECHABLE — Switcher de 3 variantes UI (?variant=A|B|C)
 * + Navegación portada / Ámbito / ficha de Acción / Criterios
 * + Multiidioma ES/CA/EU/GL con prioridad suave de Territorio y estado visible.
 */
(function () {
  const D = window.PROTO_DATA;

  const state = {
    variant: 'A',
    lang: 'es',
    view: 'home', // 'home' | 'ambito' | 'accion' | 'criteria'
    ambitoId: 'dinero-y-hogar',
    accionId: 'banca-etica',
    manualTerritory: null, // null = soft priority by language (in-memory simulated localStorage)
    effortFilter: 'all', // used in Variant B Ámbito view
    triageBucket: 'quick', // used in Variant C Home hero
    mobileDrawerOpen: false, // used in Variant B mobile menu
    previewMobile: false,
    showStatePanel: false,
  };

  function readParams() {
    const params = new URLSearchParams(window.location.search);
    const v = (params.get('variant') || 'A').toUpperCase();
    state.variant = ['A', 'B', 'C', 'D'].includes(v) ? v : 'A';

    const lang = (params.get('lang') || 'es').toLowerCase();
    state.lang = D.LANGS.some((l) => l.code === lang) ? lang : 'es';

    const view = params.get('view') || 'home';
    state.view = ['home', 'ambito', 'accion', 'criteria'].includes(view) ? view : 'home';

    const ambito = params.get('ambito');
    if (ambito && D.AMBITOS.some((a) => a.id === ambito)) state.ambitoId = ambito;

    const accion = params.get('accion');
    if (accion && D.ACCIONES.some((a) => a.id === accion)) {
      state.accionId = accion;
      const found = D.ACCIONES.find((a) => a.id === accion);
      if (found) state.ambitoId = found.ambitoId;
    }
  }

  function syncUrl() {
    const params = new URLSearchParams();
    params.set('variant', state.variant);
    params.set('lang', state.lang);
    if (state.view !== 'home') params.set('view', state.view);
    if (state.view === 'ambito') params.set('ambito', state.ambitoId);
    if (state.view === 'accion') params.set('accion', state.accionId);
    const nextUrl = `?${params.toString()}`;
    try {
      window.history.replaceState(null, '', nextUrl);
    } catch (_) {
      // Safe fallback when opened from restricted contexts
    }
  }

  function simulatedPath() {
    const t = D.UI[state.lang];
    if (state.view === 'home') return `/${state.lang}/`;
    if (state.view === 'criteria') return `/${state.lang}/${t.criteriaSlug}/`;
    if (state.view === 'ambito') {
      const amb = getAmbito(state.ambitoId);
      return `/${state.lang}/${amb.slug[state.lang]}/`;
    }
    const acc = getAccion(state.accionId);
    const amb = getAmbito(acc.ambitoId);
    return `/${state.lang}/${amb.slug[state.lang]}/${acc.slug[state.lang]}/`;
  }

  function getAmbito(id) {
    return D.AMBITOS.find((a) => a.id === id) || D.AMBITOS[0];
  }

  function getAccion(id) {
    return D.ACCIONES.find((a) => a.id === id) || D.ACCIONES[0];
  }

  function getAccionesByAmbito(ambitoId) {
    return D.ACCIONES.filter((a) => a.ambitoId === ambitoId);
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Returns territories actually present in this Acción's Resources, ordered by soft language priority
  function getAvailableTerritories(accion) {
    const set = new Set();
    (accion.resourceIds || []).forEach((id) => {
      const res = D.RESOURCES[id];
      if (res) res.territories.forEach((ter) => set.add(ter));
    });
    const priority = D.SOFT_TERRITORY_PRIORITY[state.lang] || ['Estatal'];
    return Array.from(set).sort((a, b) => {
      const ia = priority.indexOf(a);
      const ib = priority.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'es');
    });
  }

  // Orders & filters Resources according to manual Territorio OR soft language priority
  function getOrderedResources(accion) {
    const list = (accion.resourceIds || []).map((id) => D.RESOURCES[id]).filter(Boolean);
    const priority = D.SOFT_TERRITORY_PRIORITY[state.lang] || ['Estatal'];

    if (state.manualTerritory) {
      const matching = list.filter(
        (r) => r.territories.includes(state.manualTerritory) || r.territories.includes('Estatal')
      );
      return matching.sort((a, b) => {
        const aExact = a.territories.includes(state.manualTerritory) ? 0 : 1;
        const bExact = b.territories.includes(state.manualTerritory) ? 0 : 1;
        return aExact - bExact;
      });
    }

    // Soft priority by browsing language (without hiding others)
    return list.slice().sort((a, b) => {
      const rank = (r) => {
        let best = 99;
        r.territories.forEach((ter) => {
          const idx = priority.indexOf(ter);
          if (idx !== -1 && idx < best) best = idx;
        });
        return best;
      };
      return rank(a) - rank(b);
    });
  }

  function getExternalLangBadge(res) {
    const t = D.UI[state.lang];
    if (res.webLangs.includes(state.lang)) return null;
    const primary = res.webLangs[0];
    const name = t.externalLangName[primary] || primary;
    return t.webInLang(name);
  }

  function renderDraftPreviewNotice(t) {
    return `
      <div style="border: 1px dashed currentColor; opacity: 0.92; padding: 16px 18px; border-radius: 10px; margin: 18px 0 24px;">
        <strong>${esc(t.draftBannerTitle)}</strong>
        <p style="margin: 6px 0 12px; font-size: 14px;">${esc(t.draftBannerText)}</p>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button type="button" data-action="go-accion" data-id="banca-etica" style="padding:6px 12px; border-radius:6px; border:1px solid currentColor; background:transparent;">
            1. ${esc(getAccion('banca-etica').title[state.lang])}
          </button>
          <button type="button" data-action="go-accion" data-id="redes-algoritmos" style="padding:6px 12px; border-radius:6px; border:1px solid currentColor; background:transparent;">
            4. ${esc(getAccion('redes-algoritmos').title[state.lang])}
          </button>
          <button type="button" data-action="go-accion" data-id="productores-locales" style="padding:6px 12px; border-radius:6px; border:1px solid currentColor; background:transparent;">
            8. ${esc(getAccion('productores-locales').title[state.lang])} (+ Guía local)
          </button>
        </div>
      </div>
    `;
  }

  function renderCriteriaBody(t) {
    const c = D.CRITERIA[state.lang];
    return `
      <div style="max-width: 72ch;">
        <button type="button" data-action="go-home" style="background:none;border:0;padding:0;text-decoration:underline;font-size:13.5px;margin-bottom:14px;">
          ${esc(t.criteriaBack)}
        </button>
        <h1 style="margin:0 0 12px;">${esc(c.title)}</h1>
        <p style="font-size:16.5px;margin:0 0 24px;">${esc(c.lead)}</p>

        <h2>✅ ${esc(c.includeTitle)}</h2>
        <ul>${c.include.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>

        <h2>❌ ${esc(c.excludeTitle)}</h2>
        <ul>${c.exclude.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>

        <h2>${esc(c.examplesTitle)}</h2>
        <div style="display:grid; gap:10px; margin:12px 0 24px;">
          ${c.examples
            .map(
              (ex) => `
              <div style="padding:10px 14px; border-radius:8px; border:1px solid rgba(0,0,0,0.12); background:rgba(255,255,255,0.65);">
                <strong>${ex.ok ? '✅' : '❌'} ${esc(ex.name)}</strong> — ${esc(ex.reason)}
              </div>`
            )
            .join('')}
        </div>

        <h2>${esc(c.governanceTitle)}</h2>
        <p>${esc(c.governance)}</p>
      </div>
    `;
  }

  /* ========================================================================
     VARIANT A — EDITORIAL DE REFERENCIA
     ======================================================================== */
  function VariantA() {
    const t = D.UI[state.lang];
    const draftBanner = t.draftLangNote
      ? `<div class="draft-lang-banner">${esc(t.draftLangNote)}</div>`
      : '';

    const header = `
      <header class="a-masthead">
        <div class="a-wrap">
          <div class="a-masthead__top">
            <span>${esc(t.heroKicker)}</span>
            <nav class="a-lang-list" aria-label="Idioma">
              ${D.LANGS.map(
                (l) => `
                <button type="button" class="a-lang-btn" data-action="set-lang" data-lang="${l.code}" ${
                  state.lang === l.code ? 'aria-current="true"' : ''
                }>${esc(l.label)}</button>`
              ).join('')}
            </nav>
          </div>
          <div class="a-masthead__bar">
            <button type="button" class="a-brand" data-action="go-home">${esc(t.brand)}</button>
            <nav class="a-nav" aria-label="Ámbitos">
              ${D.AMBITOS.map(
                (amb) => `
                <button type="button" class="a-nav-btn" data-action="go-ambito" data-id="${amb.id}" ${
                  state.view === 'ambito' && state.ambitoId === amb.id ? 'aria-current="page"' : ''
                }>${esc(amb.name[state.lang])}</button>`
              ).join('')}
              <button type="button" class="a-nav-btn a-nav-btn--criteria" data-action="go-criteria" ${
                state.view === 'criteria' ? 'aria-current="page"' : ''
              }>${esc(t.navCriteria)}</button>
            </nav>
          </div>
        </div>
      </header>
    `;

    let body = '';

    if (state.view === 'home') {
      body = `
        <div class="a-wrap">
          <section class="a-hero">
            <div>
              <div class="a-kicker">${esc(t.brandTag)}</div>
              <h1 class="a-h1">${esc(t.heroTitle)}</h1>
              <p class="a-lead">${esc(t.heroLead)}</p>
              <p class="a-sub">${esc(t.heroSub)}</p>
            </div>
            <aside class="a-start-box">
              <h2 class="a-start-box__title">${esc(t.startTitle)}</h2>
              <p class="a-start-box__lead">${esc(t.startLead)}</p>
              ${t.startQuestions
                .map(
                  (q) => `
                  <button type="button" class="a-start-item" data-action="go-accion" data-id="${q.targetAccion}">
                    <span class="a-start-item__q">${esc(q.prompt)}</span>
                    <span class="a-start-item__link">→ ${esc(q.targetLabel)}</span>
                  </button>`
                )
                .join('')}
            </aside>
          </section>

          <section class="a-section">
            <div class="a-section__head">
              <h2 class="a-h2">${esc(t.ambitosTitle)}</h2>
              <p class="a-section__sub">${esc(t.ambitosSubtitle)}</p>
            </div>
            <div class="a-ambitos-grid">
              ${D.AMBITOS.map((amb) => {
                const accs = getAccionesByAmbito(amb.id);
                return `
                  <article class="a-ambito-cell">
                    <span class="a-ambito-num">0${amb.order} · ${esc(t.actionsCount(accs.length))}</span>
                    <button type="button" class="a-ambito-title" data-action="go-ambito" data-id="${amb.id}">
                      ${esc(amb.name[state.lang])}
                    </button>
                    <p class="a-ambito-q">${esc(amb.question[state.lang])}</p>
                    <ul class="a-ambito-links">
                      ${accs
                        .map(
                          (a) => `
                          <li>
                            <button type="button" data-action="go-accion" data-id="${a.id}">
                              ${esc(a.title[state.lang])}
                            </button>
                          </li>`
                        )
                        .join('')}
                    </ul>
                  </article>
                `;
              }).join('')}
            </div>
          </section>

          <section class="a-section">
            <div class="a-section__head">
              <h2 class="a-h2">${esc(t.atajosTitle)}</h2>
              <p class="a-section__sub">${esc(t.atajosSubtitle)}</p>
            </div>
            <div class="a-atajos-ledger">
              ${D.ATAJOS.map(
                (at) => `
                <button type="button" class="a-atajo-row" data-action="go-accion" data-id="${at.accionId}">
                  <span class="a-atajo-row__title">${esc(at.label[state.lang])}</span>
                  <span class="a-atajo-row__meta">${esc(at.meta[state.lang])} →</span>
                </button>`
              ).join('')}
            </div>
          </section>
        </div>
      `;
    } else if (state.view === 'ambito') {
      const amb = getAmbito(state.ambitoId);
      const accs = getAccionesByAmbito(amb.id);
      body = `
        <div class="a-wrap">
          <div class="a-breadcrumb">
            <button type="button" data-action="go-home">${esc(t.navHome)}</button>
            <span>/</span>
            <span>${esc(amb.name[state.lang])}</span>
          </div>
          <div class="a-ambito-header">
            <div class="a-kicker">0${amb.order} · ${esc(t.actionsCount(accs.length))}</div>
            <h1 class="a-h1" style="margin-bottom:12px;">${esc(amb.name[state.lang])}</h1>
            <p class="a-lead" style="font-size:18px;margin:0;">${esc(amb.intro[state.lang])}</p>
          </div>
          <ol class="a-action-list">
            ${accs
              .map(
                (a, idx) => `
                <li class="a-action-item">
                  <span class="a-action-item__num">0${idx + 1}</span>
                  <div>
                    <button type="button" class="a-action-item__btn" data-action="go-accion" data-id="${a.id}">
                      ${esc(a.title[state.lang])}
                    </button>
                    <p class="a-action-item__sum">${esc(a.summary[state.lang])}</p>
                  </div>
                  <span class="a-pill">${esc(t.effortLabel[a.effort])}</span>
                </li>`
              )
              .join('')}
          </ol>
          <section class="a-section">
            <h2 class="a-h2" style="font-size:19px;margin-bottom:14px;">${esc(t.otherAmbitosHeading)}</h2>
            <div style="display:flex;flex-wrap:wrap;gap:10px;">
              ${D.AMBITOS.filter((x) => x.id !== amb.id)
                .map(
                  (x) => `
                  <button type="button" class="a-ter-btn" data-action="go-ambito" data-id="${x.id}">
                    ${esc(x.name[state.lang])} →
                  </button>`
                )
                .join('')}
              <button type="button" class="a-ter-btn" data-action="go-criteria" style="border-color:var(--accent);color:var(--accent);">
                ${esc(t.navCriteria)}
              </button>
            </div>
          </section>
        </div>
      `;
    } else if (state.view === 'criteria') {
      body = `<div class="a-wrap" style="padding-top:28px;padding-bottom:44px;">${renderCriteriaBody(t)}</div>`;
    } else {
      const acc = getAccion(state.accionId);
      const amb = getAmbito(acc.ambitoId);
      const territories = getAvailableTerritories(acc);
      const resources = getOrderedResources(acc);
      const priorityText = (D.SOFT_TERRITORY_PRIORITY[state.lang] || ['Estatal']).slice(0, 3).join(' · ');

      body = `
        <div class="a-wrap">
          <div class="a-breadcrumb">
            <button type="button" data-action="go-home">${esc(t.navHome)}</button>
            <span>/</span>
            <button type="button" data-action="go-ambito" data-id="${amb.id}">${esc(amb.name[state.lang])}</button>
            <span>/</span>
            <span>${esc(acc.title[state.lang])}</span>
          </div>

          <div class="a-article-layout">
            <article>
              <header class="a-article-head">
                <div class="a-kicker">${esc(amb.name[state.lang])}</div>
                <h1 class="a-h1" style="font-size:clamp(28px,3.6vw,38px);margin-bottom:12px;">${esc(acc.title[state.lang])}</h1>
                <p class="a-lead" style="font-size:18.5px;margin:0;">${esc(acc.summary[state.lang])}</p>
                <div class="a-meta-line">
                  <span class="a-pill a-pill--accent">${esc(t.effortLabel[acc.effort])} · ${esc(t.effortHint[acc.effort])}</span>
                  <span>${esc(t.lastReviewed)}: <strong>${esc(acc.reviewedAt)}</strong></span>
                </div>
              </header>

              ${!acc.full ? renderDraftPreviewNotice(t) : `
                <section class="a-block" id="a-why">
                  <h2>${esc(t.sectionWhy)}</h2>
                  <ul class="a-why-list">
                    ${acc.why[state.lang]
                      .map((item) => `<li><strong>${esc(item.axis)}:</strong> ${esc(item.text)}</li>`)
                      .join('')}
                  </ul>
                </section>

                <section class="a-block a-easy-callout" id="a-easy">
                  <div class="a-kicker" style="margin-bottom:4px;">${esc(t.sectionEasyTag)}</div>
                  <h2 style="margin-top:0;">${esc(t.sectionEasy)}</h2>
                  <p style="margin:0;">${esc(acc.easy[state.lang])}</p>
                </section>

                <section class="a-block" id="a-further">
                  <h2>${esc(t.sectionFurther)}</h2>
                  <p>${esc(acc.further[state.lang])}</p>
                </section>

                <section class="a-block" id="a-doubts">
                  <h2>${esc(t.sectionDoubts)}</h2>
                  ${acc.doubts[state.lang]
                    .map(
                      (d) => `
                      <div class="a-doubt-item">
                        <h3>${esc(d.q)}</h3>
                        <p>${esc(d.a)}</p>
                      </div>`
                    )
                    .join('')}
                </section>

                <section class="a-block" id="a-resources">
                  <h2>${esc(t.sectionResources)}</h2>
                  <p class="a-micro-notice">
                    ${esc(t.resourcesNotice)}
                    <button type="button" data-action="go-criteria">${esc(t.resourcesNoticeLink)}</button>.
                  </p>
                  <div class="a-ter-bar" role="group" aria-label="${esc(t.territoryFilterLabel)}">
                    <button type="button" class="a-ter-btn" data-action="set-territory" data-ter="" aria-pressed="${
                      !state.manualTerritory
                    }">${esc(t.territoryAll)}</button>
                    ${territories
                      .map(
                        (ter) => `
                        <button type="button" class="a-ter-btn" data-action="set-territory" data-ter="${esc(ter)}" aria-pressed="${
                          state.manualTerritory === ter
                        }">${esc(ter)}</button>`
                      )
                      .join('')}
                  </div>
                  <p class="a-ter-hint">
                    ${
                      state.manualTerritory
                        ? `${esc(t.territoryManualHint(state.manualTerritory))} · <button type="button" data-action="set-territory" data-ter="" style="background:none;border:0;padding:0;text-decoration:underline;color:var(--accent);">${esc(t.territoryReset)}</button>`
                        : esc(t.territoryAutoHint(priorityText))
                    }
                  </p>

                  <div>
                    ${resources
                      .map((r) => {
                        const extLang = getExternalLangBadge(r);
                        return `
                        <div class="a-res-row">
                          <div class="a-res-top">
                            <a class="a-res-name" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a>
                            <div class="a-res-meta">
                              <span class="a-pill">${esc(t.resourceTypeLabel[r.type])}</span>
                              <span class="a-pill">${esc(r.territories.join(' · '))}</span>
                              ${extLang ? `<span class="a-pill">${esc(extLang)}</span>` : ''}
                            </div>
                          </div>
                          <p class="a-res-desc">${esc(r.desc[state.lang])}</p>
                          ${
                            r.caveat
                              ? `<div class="a-res-caveat"><strong>${esc(t.caveatLabel)}:</strong> ${esc(r.caveat[state.lang])}</div>`
                              : ''
                          }
                        </div>`;
                      })
                      .join('')}
                  </div>
                </section>

                ${
                  acc.hasLocalGuide && acc.localGuide
                    ? `
                    <section class="a-block a-local-box" id="a-local">
                      <div class="a-kicker" style="color:var(--slate);margin-bottom:4px;">${esc(t.sectionLocalGuideTag)}</div>
                      <h2 style="margin-top:0;">${esc(t.sectionLocalGuide)}</h2>
                      <p style="margin:0;">${esc(acc.localGuide[state.lang].intro)}</p>
                      <ol>
                        ${acc.localGuide[state.lang].steps.map((s) => `<li>${esc(s)}</li>`).join('')}
                      </ol>
                    </section>`
                    : ''
                }
              `}

              <section class="a-block" id="a-related" style="border-top:2px solid var(--rule-strong);padding-top:20px;">
                <h2 style="font-size:19px;">${esc(t.sectionRelated)}</h2>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">
                  ${(acc.relatedIds || [])
                    .map((id) => {
                      const rel = getAccion(id);
                      return `<button type="button" class="a-ter-btn" data-action="go-accion" data-id="${rel.id}">${esc(rel.title[state.lang])} →</button>`;
                    })
                    .join('')}
                </div>
                <p style="font-size:13px;color:var(--ink-muted);margin:0;">
                  <a href="https://github.com/guillefixx/web-cambio-social/issues" target="_blank" rel="noopener noreferrer">${esc(t.improveLink)} ↗</a>
                </p>
              </section>
            </article>

            <aside class="a-toc" aria-label="${esc(t.tocTitle)}">
              <div class="a-toc__title">${esc(t.tocTitle)}</div>
              <a href="#a-why">${esc(t.sectionWhy)}</a>
              <a href="#a-easy">${esc(t.sectionEasy)}</a>
              <a href="#a-further">${esc(t.sectionFurther)}</a>
              <a href="#a-doubts">${esc(t.sectionDoubts)}</a>
              <a href="#a-resources">${esc(t.sectionResources)}</a>
              ${acc.hasLocalGuide ? `<a href="#a-local">${esc(t.sectionLocalGuide)}</a>` : ''}
              <a href="#a-related">${esc(t.sectionRelated)}</a>
            </aside>
          </div>
        </div>
      `;
    }

    const footer = `
      <div class="a-wrap">
        <footer class="a-footer">
          <span>${esc(t.footerIndependent)}</span>
          <span>
            ${esc(t.footerLicense)} ·
            <button type="button" data-action="go-criteria" style="background:none;border:0;padding:0;text-decoration:underline;">${esc(t.navCriteria)}</button>
          </span>
        </footer>
      </div>
    `;

    return `<div class="v-editorial">${draftBanner}${header}<main>${body}</main>${footer}</div>`;
  }

  /* ========================================================================
     VARIANT B — MANUAL CON ÍNDICE LATERAL (Privacy Guides / Swiss docs)
     ======================================================================== */
  function VariantB() {
    const t = D.UI[state.lang];
    const draftBanner = t.draftLangNote
      ? `<div class="draft-lang-banner">${esc(t.draftLangNote)}</div>`
      : '';

    const allTerritories = ['Estatal', 'Cataluña', 'Euskadi', 'Navarra', 'Galicia', 'Comunitat Valenciana', 'Illes Balears'];

    const sidebarInner = `
      <button type="button" class="b-brand" data-action="go-home">
        ${esc(t.brand)}
        <small>${esc(t.brandTag)}</small>
      </button>

      <div class="b-ter-widget">
        <label for="b-global-ter">${esc(t.territorySidebarTitle)}</label>
        <select id="b-global-ter" data-action="select-territory">
          <option value="" ${!state.manualTerritory ? 'selected' : ''}>${esc(t.territoryAll)} (auto)</option>
          ${allTerritories
            .map(
              (ter) => `<option value="${esc(ter)}" ${state.manualTerritory === ter ? 'selected' : ''}>${esc(ter)}</option>`
            )
            .join('')}
        </select>
        <p>${esc(t.territorySidebarSub)}</p>
      </div>

      <div>
        <div class="b-tree-title">${esc(t.navAmbitos)}</div>
        <ul class="b-tree">
          ${D.AMBITOS.map((amb) => {
            const isOpen = state.ambitoId === amb.id && (state.view === 'ambito' || state.view === 'accion');
            const accs = getAccionesByAmbito(amb.id);
            return `
              <li>
                <button type="button" class="b-tree-btn" data-action="go-ambito" data-id="${amb.id}" ${
                  state.view === 'ambito' && state.ambitoId === amb.id ? 'aria-current="page"' : ''
                }>
                  <span>${esc(amb.name[state.lang])}</span>
                  <span style="font-size:11px;opacity:0.65;">${accs.length}</span>
                </button>
                ${
                  isOpen
                    ? `<ul class="b-subtree">
                        ${accs
                          .map(
                            (a) => `
                            <li>
                              <button type="button" data-action="go-accion" data-id="${a.id}" ${
                                state.view === 'accion' && state.accionId === a.id ? 'aria-current="page"' : ''
                              }>${esc(a.title[state.lang])}</button>
                            </li>`
                          )
                          .join('')}
                      </ul>`
                    : ''
                }
              </li>`;
          }).join('')}
        </ul>
      </div>

      <div style="margin-top:auto;padding-top:14px;border-top:1px solid var(--border);font-size:12.5px;">
        <button type="button" class="b-tree-btn" data-action="go-criteria" ${
          state.view === 'criteria' ? 'aria-current="page"' : ''
        }>${esc(t.navCriteria)}</button>
      </div>
    `;

    let mainContent = '';

    if (state.view === 'home') {
      mainContent = `
        <h1 class="b-h1">${esc(t.heroTitle)}</h1>
        <p class="b-lead">${esc(t.heroLead)}</p>

        <section class="b-panel">
          <h2>${esc(t.atajosTitle)}</h2>
          <p class="b-panel__sub">${esc(t.atajosSubtitle)}</p>
          <div class="b-atajo-chips">
            ${D.ATAJOS.map(
              (at) => `
              <button type="button" class="b-atajo-chip" data-action="go-accion" data-id="${at.accionId}">
                ${esc(at.label[state.lang])} →
              </button>`
            ).join('')}
          </div>
        </section>

        <section style="margin-bottom:28px;">
          <h2 style="font-size:18px;margin:0 0 4px;">${esc(t.ambitosTitle)}</h2>
          <p style="font-size:13.5px;color:var(--ink-muted);margin:0 0 12px;">${esc(t.ambitosSubtitle)}</p>
          <div class="b-dir-list">
            ${D.AMBITOS.map((amb) => {
              const accs = getAccionesByAmbito(amb.id);
              return `
                <div class="b-dir-row">
                  <div>
                    <button type="button" class="b-dir-name" data-action="go-ambito" data-id="${amb.id}">
                      ${amb.order}. ${esc(amb.name[state.lang])}
                    </button>
                    <p class="b-dir-q">${esc(amb.question[state.lang])}</p>
                  </div>
                  <div class="b-dir-actions">
                    ${accs
                      .map(
                        (a) => `
                        <button type="button" class="b-dir-action-btn" data-action="go-accion" data-id="${a.id}">
                          ${esc(a.title[state.lang])}
                          <span style="opacity:0.6;font-size:11.5px;"> · ${esc(t.effortLabel[a.effort])}</span>
                        </button>`
                      )
                      .join('')}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </section>

        <section>
          <h2 style="font-size:16px;margin:0 0 4px;">${esc(t.startTitle)}</h2>
          <p style="font-size:13.5px;color:var(--ink-muted);margin:0 0 12px;">${esc(t.startLead)}</p>
          <div class="b-start-strip">
            ${t.startQuestions
              .map(
                (q) => `
                <button type="button" class="b-start-card" data-action="go-accion" data-id="${q.targetAccion}">
                  <strong style="display:block;font-size:13.5px;margin-bottom:4px;">${esc(q.prompt)}</strong>
                  <span style="display:block;font-size:12.5px;color:var(--ink-muted);margin-bottom:8px;">${esc(q.hint)}</span>
                  <span style="font-size:12.5px;font-weight:700;color:var(--accent);">${esc(q.targetLabel)} →</span>
                </button>`
              )
              .join('')}
          </div>
        </section>
      `;
    } else if (state.view === 'ambito') {
      const amb = getAmbito(state.ambitoId);
      const allAccs = getAccionesByAmbito(amb.id);
      const accs =
        state.effortFilter === 'all' ? allAccs : allAccs.filter((a) => a.effort === state.effortFilter);

      mainContent = `
        <h1 class="b-h1">${esc(amb.name[state.lang])}</h1>
        <p class="b-lead">${esc(amb.intro[state.lang])}</p>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px;">
          ${['all', 'quick', 'one-off', 'ongoing']
            .map((key) => {
              const label = key === 'all' ? t.filterAll : t.effortLabel[key];
              const active = state.effortFilter === key;
              return `<button type="button" data-action="set-effort" data-effort="${key}" style="padding:5px 12px;border-radius:999px;border:1px solid ${
                active ? 'var(--accent)' : 'var(--border)'
              };background:${active ? 'var(--accent)' : '#fff'};color:${
                active ? '#fff' : 'var(--ink-muted)'
              };font-size:12.5px;font-weight:600;">${esc(label)}</button>`;
            })
            .join('')}
        </div>

        <div class="b-dir-list">
          ${
            accs.length === 0
              ? `<p style="padding:16px 0;color:var(--ink-muted);font-size:14px;">No hay Acciones con este nivel de esfuerzo en este Ámbito.</p>`
              : accs
                  .map(
                    (a) => `
                    <div style="border-bottom:1px solid var(--border);padding:16px 0;display:flex;justify-content:space-between;gap:14px;align-items:start;flex-wrap:wrap;">
                      <div style="flex:1;min-width:220px;">
                        <button type="button" class="b-dir-name" style="font-size:17px;" data-action="go-accion" data-id="${a.id}">
                          ${esc(a.title[state.lang])}
                        </button>
                        <p style="margin:5px 0 0;font-size:14px;color:var(--ink-muted);">${esc(a.summary[state.lang])}</p>
                      </div>
                      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <span class="b-tag">${esc(t.effortLabel[a.effort])}</span>
                        ${a.hasLocalGuide ? `<span class="b-tag b-tag--neutral">${esc(t.sectionLocalGuideTag)}</span>` : ''}
                      </div>
                    </div>`
                  )
                  .join('')
          }
        </div>
      `;
    } else if (state.view === 'criteria') {
      mainContent = renderCriteriaBody(t);
    } else {
      const acc = getAccion(state.accionId);
      const amb = getAmbito(acc.ambitoId);
      const territories = getAvailableTerritories(acc);
      const resources = getOrderedResources(acc);
      const priorityText = (D.SOFT_TERRITORY_PRIORITY[state.lang] || ['Estatal']).slice(0, 3).join(' · ');

      mainContent = `
        <h1 class="b-h1">${esc(acc.title[state.lang])}</h1>
        <p class="b-lead" style="margin-bottom:14px;">${esc(acc.summary[state.lang])}</p>

        <div class="b-exec-strip">
          <span><strong>${esc(t.navAmbitos)}:</strong> <button type="button" data-action="go-ambito" data-id="${amb.id}" style="background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;">${esc(amb.name[state.lang])}</button></span>
          <span><span class="b-tag">${esc(t.effortLabel[acc.effort])}</span></span>
          <span><strong>${esc(t.lastReviewed)}:</strong> ${esc(acc.reviewedAt)}</span>
          <span style="color:var(--ink-muted);">${esc(acc.hasLocalGuide ? t.hasLocalGuideBadge : t.noLocalGuideBadge)}</span>
        </div>

        ${!acc.full ? renderDraftPreviewNotice(t) : `
          <section class="b-easy-box">
            <h2>⚡ ${esc(t.sectionEasy)} <span style="font-weight:500;font-size:13px;">(${esc(t.sectionEasyTag)})</span></h2>
            <p style="margin:0;font-size:14.5px;color:#1e3a5f;">${esc(acc.easy[state.lang])}</p>
          </section>

          <section class="b-section">
            <h2>${esc(t.sectionWhy)}</h2>
            <div class="b-why-grid">
              ${acc.why[state.lang]
                .map(
                  (w) => `<div class="b-why-card"><strong>${esc(w.axis)}</strong><span>${esc(w.text)}</span></div>`
                )
                .join('')}
            </div>
          </section>

          <section class="b-section">
            <h2>${esc(t.sectionFurther)}</h2>
            <p style="margin:0;font-size:14.5px;color:#334155;">${esc(acc.further[state.lang])}</p>
          </section>

          <section class="b-section">
            <h2>${esc(t.sectionDoubts)}</h2>
            <div class="b-accordion">
              ${acc.doubts[state.lang]
                .map(
                  (d, idx) => `
                  <details ${idx === 0 ? 'open' : ''}>
                    <summary>${esc(d.q)}</summary>
                    <p>${esc(d.a)}</p>
                  </details>`
                )
                .join('')}
            </div>
          </section>

          <section class="b-section">
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;">
              <h2 style="margin-bottom:4px;">${esc(t.sectionResources)}</h2>
              <span style="font-size:12.5px;color:var(--ink-muted);">
                ${esc(t.resourcesNotice)}
                <button type="button" data-action="go-criteria" style="background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;">${esc(t.resourcesNoticeLink)}</button>
              </span>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 8px;">
              <button type="button" data-action="set-territory" data-ter="" style="padding:4px 10px;border-radius:6px;border:1px solid ${
                !state.manualTerritory ? 'var(--accent)' : 'var(--border)'
              };background:${!state.manualTerritory ? 'var(--accent)' : '#fff'};color:${
                !state.manualTerritory ? '#fff' : 'var(--ink-muted)'
              };font-size:12.5px;font-weight:600;">${esc(t.territoryAll)}</button>
              ${territories
                .map((ter) => {
                  const active = state.manualTerritory === ter;
                  return `<button type="button" data-action="set-territory" data-ter="${esc(ter)}" style="padding:4px 10px;border-radius:6px;border:1px solid ${
                    active ? 'var(--accent)' : 'var(--border)'
                  };background:${active ? 'var(--accent)' : '#fff'};color:${
                    active ? '#fff' : 'var(--ink-muted)'
                  };font-size:12.5px;font-weight:600;">${esc(ter)}</button>`;
                })
                .join('')}
            </div>
            <p style="font-size:12px;color:var(--ink-muted);margin:0 0 14px;">
              ${
                state.manualTerritory
                  ? esc(t.territoryManualHint(state.manualTerritory))
                  : esc(t.territoryAutoHint(priorityText))
              }
            </p>

            <div class="b-res-grid">
              ${resources
                .map((r) => {
                  const extLang = getExternalLangBadge(r);
                  return `
                  <article class="b-res-card">
                    <div style="display:flex;justify-content:space-between;gap:8px;align-items:start;">
                      <a class="b-res-card__title" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:5px;">
                      <span class="b-tag">${esc(t.resourceTypeLabel[r.type])}</span>
                      <span class="b-tag b-tag--neutral">${esc(r.territories.join(' · '))}</span>
                      ${extLang ? `<span class="b-tag b-tag--neutral">${esc(extLang)}</span>` : ''}
                    </div>
                    <p style="margin:0;font-size:13.5px;color:#334155;">${esc(r.desc[state.lang])}</p>
                    ${
                      r.caveat
                        ? `<div class="b-res-card__caveat"><strong>${esc(t.caveatLabel)}:</strong> ${esc(r.caveat[state.lang])}</div>`
                        : ''
                    }
                  </article>`;
                })
                .join('')}
            </div>
          </section>

          ${
            acc.hasLocalGuide && acc.localGuide
              ? `
              <section class="b-section b-local-panel">
                <span class="b-tag" style="background:#dcfce7;color:#166534;margin-bottom:6px;">${esc(t.sectionLocalGuideTag)}</span>
                <h2 style="margin-top:4px;">${esc(t.sectionLocalGuide)}</h2>
                <p style="margin:0 0 10px;font-size:14px;">${esc(acc.localGuide[state.lang].intro)}</p>
                <ol style="margin:0;padding-left:20px;font-size:14px;display:grid;gap:6px;">
                  ${acc.localGuide[state.lang].steps.map((s) => `<li>${esc(s)}</li>`).join('')}
                </ol>
              </section>`
              : ''
          }
        `}

        <section style="border-top:1px solid var(--border);padding-top:18px;margin-top:26px;">
          <h2 style="font-size:15px;margin:0 0 10px;">${esc(t.sectionRelated)}</h2>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
            ${(acc.relatedIds || [])
              .map((id) => {
                const rel = getAccion(id);
                return `<button type="button" class="b-dir-action-btn" data-action="go-accion" data-id="${rel.id}">${esc(rel.title[state.lang])} →</button>`;
              })
              .join('')}
          </div>
          <p style="font-size:12.5px;color:var(--ink-muted);margin:0;">
            <a href="https://github.com/guillefixx/web-cambio-social/issues" target="_blank" rel="noopener noreferrer">${esc(t.improveLink)} ↗</a>
          </p>
        </section>
      `;
    }

    return `
      <div class="v-manual">
        ${draftBanner}
        <div class="b-shell">
          <aside class="b-sidebar" aria-label="Índice de la guía">${sidebarInner}</aside>
          <div>
            <header class="b-topbar">
              <div class="b-topbar-left">
                <button type="button" class="b-mobile-menu-btn" data-action="toggle-mobile-drawer">☰ ${esc(t.navMenu)}</button>
                <span class="b-url-chip">${esc(simulatedPath())}</span>
              </div>
              <div class="b-langs" role="group" aria-label="Idioma">
                ${D.LANGS.map(
                  (l) => `
                  <button type="button" data-action="set-lang" data-lang="${l.code}" ${
                    state.lang === l.code ? 'aria-current="true"' : ''
                  }>${esc(l.label)}</button>`
                ).join('')}
              </div>
            </header>
            <div class="b-mobile-drawer ${state.mobileDrawerOpen ? 'is-open' : ''}">
              ${sidebarInner}
            </div>
            <main class="b-main-inner">
              ${mainContent}
              <footer style="margin-top:40px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--ink-muted);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <span>${esc(t.footerIndependent)}</span>
                <span>${esc(t.footerLicense)}</span>
              </footer>
            </main>
          </div>
        </div>
      </div>
    `;
  }

  /* ========================================================================
     VARIANT C — ENFOQUE PASO A PASO (Progressive Civic Handbook)
     ======================================================================== */
  function VariantC() {
    const t = D.UI[state.lang];
    const draftBanner = t.draftLangNote
      ? `<div class="draft-lang-banner">${esc(t.draftLangNote)}</div>`
      : '';

    const header = `
      <header class="c-header">
        <div class="c-wrap c-header__inner">
          <button type="button" class="c-brand" data-action="go-home">${esc(t.brand)}</button>
          <div class="c-header__right">
            <button type="button" class="c-link-btn" data-action="go-home">${esc(t.navExplore)}</button>
            <button type="button" class="c-link-btn" data-action="go-criteria">${esc(t.navCriteria)}</button>
            <nav class="c-lang-pill" aria-label="Idioma">
              ${D.LANGS.map(
                (l) => `
                <button type="button" data-action="set-lang" data-lang="${l.code}" ${
                  state.lang === l.code ? 'aria-current="true"' : ''
                }>${esc(l.label)}</button>`
              ).join('')}
            </nav>
          </div>
        </div>
      </header>
    `;

    let body = '';

    if (state.view === 'home') {
      const matchingAtajos = D.ATAJOS.filter((at) => at.bucket === state.triageBucket);
      body = `
        <div class="c-wrap">
          <section class="c-hero">
            <span class="c-kicker">${esc(t.heroKicker)}</span>
            <h1 class="c-h1">${esc(t.heroTitle)}</h1>
            <p class="c-lead">${esc(t.heroLead)}</p>

            <div class="c-triage">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                <strong style="font-size:15px;">${esc(t.startTitle)}</strong>
                <span style="font-size:13px;color:var(--ink-muted);">${esc(t.startLead)}</span>
              </div>
              <div class="c-triage__tabs" role="group" aria-label="${esc(t.startTitle)}">
                ${t.startQuestions
                  .map(
                    (q) => `
                    <button type="button" class="c-triage__tab" data-action="set-triage" data-bucket="${q.id}" aria-pressed="${
                      state.triageBucket === q.id
                    }">
                      <strong>${esc(q.prompt)}</strong>
                      <span>${esc(q.hint)}</span>
                    </button>`
                  )
                  .join('')}
              </div>
              <div class="c-triage__results">
                ${matchingAtajos
                  .map(
                    (at) => `
                    <button type="button" class="c-atajo-card" data-action="go-accion" data-id="${at.accionId}">
                      <div>
                        <strong style="display:block;font-size:14.5px;color:var(--ink);">${esc(at.label[state.lang])}</strong>
                        <span style="font-size:12px;color:var(--ink-muted);">${esc(at.meta[state.lang])}</span>
                      </div>
                      <span style="font-weight:700;color:var(--accent);">→</span>
                    </button>`
                  )
                  .join('')}
              </div>
            </div>
          </section>

          <section>
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;">
              <h2 style="font-size:23px;margin:0;letter-spacing:-0.02em;">${esc(t.ambitosTitle)}</h2>
              <span style="font-size:13.5px;color:var(--ink-muted);">${esc(t.ambitosSubtitle)}</span>
            </div>
            <div class="c-bands">
              ${D.AMBITOS.map((amb) => {
                const accs = getAccionesByAmbito(amb.id);
                return `
                  <article class="c-band">
                    <div>
                      <span class="c-chip" style="margin-bottom:8px;">0${amb.order} · ${esc(t.actionsCount(accs.length))}</span><br />
                      <button type="button" class="c-band__name" data-action="go-ambito" data-id="${amb.id}">
                        ${esc(amb.name[state.lang])} →
                      </button>
                      <p class="c-band__q">${esc(amb.question[state.lang])}</p>
                    </div>
                    <div class="c-band__actions">
                      ${accs
                        .map(
                          (a) => `
                          <button type="button" class="c-band__action" data-action="go-accion" data-id="${a.id}">
                            <span>${esc(a.title[state.lang])}</span>
                            <span style="font-size:11.5px;color:var(--accent);white-space:nowrap;">${esc(t.effortLabel[a.effort])}</span>
                          </button>`
                        )
                        .join('')}
                    </div>
                  </article>`;
              }).join('')}
            </div>
          </section>
        </div>
      `;
    } else if (state.view === 'ambito') {
      const amb = getAmbito(state.ambitoId);
      const accs = getAccionesByAmbito(amb.id);
      body = `
        <div class="c-wrap" style="padding-top:22px;padding-bottom:40px;">
          <button type="button" class="c-link-btn" style="padding-left:0;" data-action="go-home">${esc(t.backHome)}</button>
          <div class="c-hero-band">
            <span class="c-chip">0${amb.order} · ${esc(t.actionsCount(accs.length))}</span>
            <h1 style="font-size:clamp(28px,4vw,38px);margin:10px 0 8px;letter-spacing:-0.025em;">${esc(amb.name[state.lang])}</h1>
            <p style="margin:0;font-size:16.5px;color:var(--ink-muted);max-width:62ch;">${esc(amb.intro[state.lang])}</p>
          </div>

          <h2 style="font-size:18px;margin:24px 0 10px;">${esc(t.ambitoActionsHeading)}</h2>
          <div class="c-ladder">
            ${accs
              .map(
                (a) => `
                <button type="button" class="c-ladder-card" data-action="go-accion" data-id="${a.id}">
                  <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
                    <span class="c-chip">${esc(t.effortLabel[a.effort])} · ${esc(t.effortHint[a.effort])}</span>
                    ${a.hasLocalGuide ? `<span style="font-size:12px;color:var(--ink-muted);">${esc(t.hasLocalGuideBadge)}</span>` : ''}
                  </div>
                  <strong style="display:block;font-size:19px;margin-bottom:4px;color:var(--ink);">${esc(a.title[state.lang])} →</strong>
                  <span style="font-size:14.5px;color:var(--ink-muted);">${esc(a.summary[state.lang])}</span>
                </button>`
              )
              .join('')}
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:18px;border-top:1px solid var(--border);">
            ${D.AMBITOS.filter((x) => x.id !== amb.id)
              .map(
                (x) => `<button type="button" class="c-tab" data-action="go-ambito" data-id="${x.id}">${esc(x.name[state.lang])}</button>`
              )
              .join('')}
          </div>
        </div>
      `;
    } else if (state.view === 'criteria') {
      body = `<div class="c-wrap" style="padding-top:26px;padding-bottom:44px;"><div class="c-card">${renderCriteriaBody(t)}</div></div>`;
    } else {
      const acc = getAccion(state.accionId);
      const amb = getAmbito(acc.ambitoId);
      const territories = getAvailableTerritories(acc);
      const resources = getOrderedResources(acc);
      const priorityText = (D.SOFT_TERRITORY_PRIORITY[state.lang] || ['Estatal']).slice(0, 3).join(' · ');

      body = `
        <div class="c-wrap" style="padding-top:18px;padding-bottom:48px;">
          <div style="font-size:13px;color:var(--ink-muted);display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="c-link-btn" style="padding:0;" data-action="go-home">${esc(t.navHome)}</button>
            <span>/</span>
            <button type="button" class="c-link-btn" style="padding:0;" data-action="go-ambito" data-id="${amb.id}">${esc(amb.name[state.lang])}</button>
          </div>

          <header class="c-hero-band">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
              <span class="c-chip">${esc(t.effortLabel[acc.effort])} · ${esc(t.effortHint[acc.effort])}</span>
              <span style="font-size:12.5px;color:var(--ink-muted);">${esc(t.lastReviewed)}: ${esc(acc.reviewedAt)}</span>
            </div>
            <h1 style="font-size:clamp(26px,3.8vw,36px);line-height:1.15;margin:0 0 10px;letter-spacing:-0.025em;">${esc(acc.title[state.lang])}</h1>
            <p style="margin:0;font-size:16.5px;color:var(--ink-muted);max-width:64ch;">${esc(acc.summary[state.lang])}</p>
          </header>

          ${!acc.full ? renderDraftPreviewNotice(t) : `
            <div class="c-split">
              <section class="c-card">
                <h2 style="font-size:19px;margin:0 0 12px;">${esc(t.sectionWhy)}</h2>
                <div style="display:grid;gap:12px;">
                  ${acc.why[state.lang]
                    .map(
                      (w) => `
                      <div style="padding-left:12px;border-left:3px solid var(--accent);">
                        <strong style="display:block;font-size:14px;">${esc(w.axis)}</strong>
                        <span style="font-size:14.5px;color:var(--ink-muted);">${esc(w.text)}</span>
                      </div>`
                    )
                    .join('')}
                </div>
              </section>

              <section class="c-card c-card--easy">
                <span class="c-chip">${esc(t.sectionEasyTag)}</span>
                <h2 style="font-size:20px;margin:10px 0 8px;">${esc(t.sectionEasy)}</h2>
                <p style="margin:0;font-size:15px;line-height:1.6;">${esc(acc.easy[state.lang])}</p>
              </section>
            </div>

            <div class="c-split" style="grid-template-columns:1fr 1fr;">
              <section class="c-card">
                <h2 style="font-size:18px;margin:0 0 10px;">${esc(t.sectionFurther)}</h2>
                <p style="margin:0;font-size:14.5px;color:var(--ink-muted);">${esc(acc.further[state.lang])}</p>
              </section>

              <section class="c-card">
                <h2 style="font-size:18px;margin:0 0 10px;">${esc(t.sectionDoubts)}</h2>
                <div style="display:grid;gap:12px;">
                  ${acc.doubts[state.lang]
                    .map(
                      (d) => `
                      <div>
                        <strong style="display:block;font-size:14.5px;margin-bottom:3px;">${esc(d.q)}</strong>
                        <p style="margin:0;font-size:13.5px;color:var(--ink-muted);">${esc(d.a)}</p>
                      </div>`
                    )
                    .join('')}
                </div>
              </section>
            </div>

            <section class="c-card" style="margin-bottom:22px;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;">
                <h2 style="font-size:21px;margin:0;">${esc(t.sectionResources)}</h2>
                <span style="font-size:12.5px;color:var(--ink-muted);">
                  ${esc(t.resourcesNotice)}
                  <button type="button" data-action="go-criteria" style="background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;">${esc(t.resourcesNoticeLink)}</button>
                </span>
              </div>

              <div class="c-tabs" role="group" aria-label="${esc(t.territoryFilterLabel)}">
                <button type="button" class="c-tab" data-action="set-territory" data-ter="" aria-pressed="${
                  !state.manualTerritory
                }">${esc(t.territoryAll)}</button>
                ${territories
                  .map(
                    (ter) => `
                    <button type="button" class="c-tab" data-action="set-territory" data-ter="${esc(ter)}" aria-pressed="${
                      state.manualTerritory === ter
                    }">${esc(ter)}</button>`
                  )
                  .join('')}
              </div>
              <p style="font-size:12.5px;color:var(--ink-muted);margin:-6px 0 16px;">
                ${
                  state.manualTerritory
                    ? esc(t.territoryManualHint(state.manualTerritory))
                    : esc(t.territoryAutoHint(priorityText))
                }
              </p>

              <div class="c-res-stack">
                ${resources
                  .map((r) => {
                    const extLang = getExternalLangBadge(r);
                    return `
                    <article class="c-res-item">
                      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
                        <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" style="font-size:17px;font-weight:700;color:var(--accent);text-decoration:none;">
                          ${esc(r.name)} ↗
                        </a>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                          <span class="c-chip">${esc(t.resourceTypeLabel[r.type])}</span>
                          <span class="c-chip" style="background:#fff;color:var(--ink-muted);">${esc(r.territories.join(' · '))}</span>
                          ${extLang ? `<span class="c-chip" style="background:#fff;color:var(--ink);">${esc(extLang)}</span>` : ''}
                        </div>
                      </div>
                      <p style="margin:0;font-size:14.5px;color:var(--ink);">${esc(r.desc[state.lang])}</p>
                      ${
                        r.caveat
                          ? `<div class="c-res-caveat"><strong>${esc(t.caveatLabel)}:</strong> ${esc(r.caveat[state.lang])}</div>`
                          : ''
                      }
                    </article>`;
                  })
                  .join('')}
              </div>
            </section>

            ${
              acc.hasLocalGuide && acc.localGuide
                ? `
                <section class="c-local-kit">
                  <span class="c-chip" style="background:#fff;">${esc(t.sectionLocalGuideTag)}</span>
                  <h2 style="font-size:20px;margin:8px 0 6px;">${esc(t.sectionLocalGuide)}</h2>
                  <p style="margin:0;font-size:14.5px;color:var(--ink-muted);">${esc(acc.localGuide[state.lang].intro)}</p>
                  <div class="c-kit-steps">
                    ${acc.localGuide[state.lang].steps
                      .map((s, i) => `<div class="c-kit-step"><span>${i + 1}</span><div>${esc(s)}</div></div>`)
                      .join('')}
                  </div>
                </section>`
                : ''
            }
          `}

          <section class="c-card" style="margin-top:20px;">
            <h2 style="font-size:16px;margin:0 0 10px;">${esc(t.sectionRelated)}</h2>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
              ${(acc.relatedIds || [])
                .map((id) => {
                  const rel = getAccion(id);
                  return `<button type="button" class="c-tab" data-action="go-accion" data-id="${rel.id}">${esc(rel.title[state.lang])} →</button>`;
                })
                .join('')}
            </div>
            <p style="font-size:12.5px;color:var(--ink-muted);margin:0;">
              <a href="https://github.com/guillefixx/web-cambio-social/issues" target="_blank" rel="noopener noreferrer">${esc(t.improveLink)} ↗</a>
            </p>
          </section>
        </div>
      `;
    }

    const footer = `
      <footer style="border-top:1px solid var(--border);padding:24px 0 36px;font-size:12.5px;color:var(--ink-muted);">
        <div class="c-wrap" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <span>${esc(t.footerIndependent)}</span>
          <span>${esc(t.footerLicense)}</span>
        </div>
      </footer>
    `;

    return `<div class="v-guided">${draftBanner}${header}<main>${body}</main>${footer}</div>`;
  }

  /* ========================================================================
     VARIANT D — SÍNTESIS RECOMENDADA (Base Editorial A + Portada C + UX B)
     ======================================================================== */
  function VariantD() {
    const t = D.UI[state.lang];
    const draftBanner = t.draftLangNote
      ? `<div class="draft-lang-banner">${esc(t.draftLangNote)}</div>`
      : '';

    const header = `
      <header class="d-header">
        <div class="d-wrap">
          <div class="d-header__util">
            <span>${esc(t.heroKicker)}</span>
            <nav class="d-langs" aria-label="Idioma">
              ${D.LANGS.map(
                (l) => `
                <button type="button" data-action="set-lang" data-lang="${l.code}" ${
                  state.lang === l.code ? 'aria-current="true"' : ''
                }>${esc(l.label)}</button>`
              ).join('')}
            </nav>
          </div>
          <div class="d-header__main">
            <button type="button" class="d-brand" data-action="go-home">${esc(t.brand)}</button>
            <nav class="d-nav" aria-label="Ámbitos">
              ${D.AMBITOS.map(
                (amb) => `
                <button type="button" data-action="go-ambito" data-id="${amb.id}" ${
                  state.view === 'ambito' && state.ambitoId === amb.id ? 'aria-current="page"' : ''
                }>${esc(amb.name[state.lang])}</button>`
              ).join('')}
              <button type="button" class="d-nav--criteria" data-action="go-criteria" ${
                state.view === 'criteria' ? 'aria-current="page"' : ''
              }>${esc(t.navCriteria)}</button>
            </nav>
          </div>
        </div>
      </header>
    `;

    let body = '';

    if (state.view === 'home') {
      const matchingAtajos = D.ATAJOS.filter((at) => at.bucket === state.triageBucket);
      body = `
        <div class="d-wrap">
          <section class="d-hero">
            <div class="d-hero__text">
              <div class="d-kicker">${esc(t.brandTag)}</div>
              <h1 class="d-h1">${esc(t.heroTitle)}</h1>
              <p class="d-lead">${esc(t.heroLead)}</p>
              <p class="d-sub">${esc(t.heroSub)}</p>
            </div>

            <div class="d-triage">
              <div class="d-triage__head">
                <h2 class="d-triage__title">${esc(t.startTitle)}</h2>
                <span style="font-size:13.5px;color:var(--ink-muted);">${esc(t.startLead)}</span>
              </div>
              <div class="d-triage__tabs" role="group" aria-label="${esc(t.startTitle)}">
                ${t.startQuestions
                  .map(
                    (q) => `
                    <button type="button" class="d-triage__tab" data-action="set-triage" data-bucket="${q.id}" aria-pressed="${
                      state.triageBucket === q.id
                    }">
                      <strong>${esc(q.prompt)}</strong>
                      <span>${esc(q.hint)}</span>
                    </button>`
                  )
                  .join('')}
              </div>
              <div class="d-triage__results">
                ${matchingAtajos
                  .map(
                    (at) => `
                    <button type="button" class="d-triage__pick" data-action="go-accion" data-id="${at.accionId}">
                      <div>
                        <strong>${esc(at.label[state.lang])}</strong>
                        <span>${esc(at.meta[state.lang])}</span>
                      </div>
                      <span style="font-weight:700;color:var(--accent);">→</span>
                    </button>`
                  )
                  .join('')}
              </div>
            </div>
          </section>

          <section class="d-section">
            <div class="d-section__head">
              <h2 class="d-h2">${esc(t.ambitosTitle)}</h2>
              <span style="font-size:14px;color:var(--ink-muted);">${esc(t.ambitosSubtitle)}</span>
            </div>
            <div class="d-ambitos-grid">
              ${D.AMBITOS.map((amb) => {
                const accs = getAccionesByAmbito(amb.id);
                return `
                  <button type="button" class="d-ambito-card" data-action="go-ambito" data-id="${amb.id}">
                    <span class="d-ambito-card__meta">0${amb.order} · ${esc(t.actionsCount(accs.length))}</span>
                    <span class="d-ambito-card__title">${esc(amb.name[state.lang])}</span>
                    <p class="d-ambito-card__q">${esc(amb.question[state.lang])}</p>
                    <span class="d-ambito-card__cta">${esc(t.ambitoActionsHeading)} →</span>
                  </button>`;
              }).join('')}
            </div>
          </section>

          <section class="d-section">
            <div class="d-section__head">
              <h2 class="d-h2">${esc(t.atajosTitle)}</h2>
              <span style="font-size:14px;color:var(--ink-muted);">${esc(t.atajosSubtitle)}</span>
            </div>
            <div class="d-atajos">
              ${D.ATAJOS.map(
                (at) => `
                <button type="button" class="d-atajo-row" data-action="go-accion" data-id="${at.accionId}">
                  <strong>${esc(at.label[state.lang])}</strong>
                  <span>${esc(at.meta[state.lang])} →</span>
                </button>`
              ).join('')}
            </div>
          </section>
        </div>
      `;
    } else if (state.view === 'ambito') {
      const amb = getAmbito(state.ambitoId);
      const accs = getAccionesByAmbito(amb.id);
      body = `
        <div class="d-wrap">
          <div class="d-crumb">
            <button type="button" data-action="go-home">${esc(t.navHome)}</button>
            <span>/</span>
            <span>${esc(amb.name[state.lang])}</span>
          </div>
          <header class="d-ambito-head">
            <div class="d-kicker">0${amb.order} · ${esc(t.actionsCount(accs.length))}</div>
            <h1 class="d-h1" style="margin-bottom:10px;">${esc(amb.name[state.lang])}</h1>
            <p class="d-lead" style="font-size:18px;margin:0;">${esc(amb.intro[state.lang])}</p>
          </header>

          <ol class="d-action-list">
            ${accs
              .map(
                (a, idx) => `
                <li class="d-action-row">
                  <span class="d-action-row__num">0${idx + 1}</span>
                  <div>
                    <button type="button" class="d-action-row__btn" data-action="go-accion" data-id="${a.id}">
                      ${esc(a.title[state.lang])}
                    </button>
                    <p style="margin:0;font-size:15px;color:var(--ink-muted);max-width:60ch;">${esc(a.summary[state.lang])}</p>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
                    <span class="d-pill d-pill--accent">${esc(t.effortLabel[a.effort])}</span>
                    ${a.hasLocalGuide ? `<span class="d-pill d-pill--slate">${esc(t.sectionLocalGuideTag)}</span>` : ''}
                  </div>
                </li>`
              )
              .join('')}
          </ol>

          <section class="d-section">
            <h2 class="d-h2" style="font-size:19px;margin-bottom:14px;">${esc(t.otherAmbitosHeading)}</h2>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${D.AMBITOS.filter((x) => x.id !== amb.id)
                .map(
                  (x) => `<button type="button" class="d-ter-pill" data-action="go-ambito" data-id="${x.id}">${esc(x.name[state.lang])} →</button>`
                )
                .join('')}
              <button type="button" class="d-ter-pill" data-action="go-criteria" style="border-color:var(--accent);color:var(--accent);">${esc(t.navCriteria)}</button>
            </div>
          </section>
        </div>
      `;
    } else if (state.view === 'criteria') {
      body = `<div class="d-wrap" style="padding-top:26px;padding-bottom:44px;">${renderCriteriaBody(t)}</div>`;
    } else {
      const acc = getAccion(state.accionId);
      const amb = getAmbito(acc.ambitoId);
      const territories = getAvailableTerritories(acc);
      const resources = getOrderedResources(acc);
      const priorityText = (D.SOFT_TERRITORY_PRIORITY[state.lang] || ['Estatal']).slice(0, 3).join(' · ');

      body = `
        <div class="d-wrap">
          <div class="d-crumb">
            <button type="button" data-action="go-home">${esc(t.navHome)}</button>
            <span>/</span>
            <button type="button" data-action="go-ambito" data-id="${amb.id}">${esc(amb.name[state.lang])}</button>
            <span>/</span>
            <span>${esc(acc.title[state.lang])}</span>
          </div>

          <div class="d-article-layout">
            <article>
              <header class="d-article-head">
                <div class="d-kicker">${esc(amb.name[state.lang])}</div>
                <h1 class="d-h1" style="font-size:clamp(27px,3.6vw,38px);margin-bottom:10px;">${esc(acc.title[state.lang])}</h1>
                <p class="d-lead" style="font-size:18px;margin:0;">${esc(acc.summary[state.lang])}</p>
                <div class="d-meta-strip">
                  <span class="d-pill d-pill--accent">${esc(t.effortLabel[acc.effort])} · ${esc(t.effortHint[acc.effort])}</span>
                  <span>${esc(t.lastReviewed)}: <strong>${esc(acc.reviewedAt)}</strong></span>
                  ${acc.hasLocalGuide ? `<span class="d-pill d-pill--slate">${esc(t.hasLocalGuideBadge)}</span>` : ''}
                </div>
              </header>

              ${!acc.full ? renderDraftPreviewNotice(t) : `
                <section class="d-block" id="d-why">
                  <h2>${esc(t.sectionWhy)}</h2>
                  <ul class="d-why-list">
                    ${acc.why[state.lang]
                      .map((w) => `<li><strong>${esc(w.axis)}:</strong> ${esc(w.text)}</li>`)
                      .join('')}
                  </ul>
                </section>

                <section class="d-block d-easy-box" id="d-easy">
                  <div class="d-kicker" style="margin-bottom:4px;">${esc(t.sectionEasyTag)}</div>
                  <h2 style="margin-top:0;">${esc(t.sectionEasy)}</h2>
                  <p style="margin:0;font-size:15.5px;">${esc(acc.easy[state.lang])}</p>
                </section>

                <section class="d-block" id="d-further">
                  <h2>${esc(t.sectionFurther)}</h2>
                  <p style="margin:0;font-size:15px;">${esc(acc.further[state.lang])}</p>
                </section>

                <section class="d-block" id="d-doubts">
                  <h2>${esc(t.sectionDoubts)}</h2>
                  <div class="d-accordion">
                    ${acc.doubts[state.lang]
                      .map(
                        (d, idx) => `
                        <details ${idx === 0 ? 'open' : ''}>
                          <summary>${esc(d.q)}</summary>
                          <p>${esc(d.a)}</p>
                        </details>`
                      )
                      .join('')}
                  </div>
                </section>

                <section class="d-block" id="d-resources">
                  <h2>${esc(t.sectionResources)}</h2>
                  <p style="font-size:13px;color:var(--ink-muted);margin:-4px 0 12px;">
                    ${esc(t.resourcesNotice)}
                    <button type="button" data-action="go-criteria" style="background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;">${esc(t.resourcesNoticeLink)}</button>.
                  </p>

                  <div class="d-ter-pills" role="group" aria-label="${esc(t.territoryFilterLabel)}">
                    <button type="button" class="d-ter-pill" data-action="set-territory" data-ter="" aria-pressed="${
                      !state.manualTerritory
                    }">${esc(t.territoryAll)}</button>
                    ${territories
                      .map(
                        (ter) => `
                        <button type="button" class="d-ter-pill" data-action="set-territory" data-ter="${esc(ter)}" aria-pressed="${
                          state.manualTerritory === ter
                        }">${esc(ter)}</button>`
                      )
                      .join('')}
                  </div>
                  <p style="font-size:12px;color:var(--ink-muted);margin:0;">
                    ${
                      state.manualTerritory
                        ? `${esc(t.territoryManualHint(state.manualTerritory))} · <button type="button" data-action="set-territory" data-ter="" style="background:none;border:0;padding:0;text-decoration:underline;color:var(--accent);">${esc(t.territoryReset)}</button>`
                        : esc(t.territoryAutoHint(priorityText))
                    }
                  </p>

                  <div class="d-res-list">
                    ${resources
                      .map((r) => {
                        const extLang = getExternalLangBadge(r);
                        return `
                        <article class="d-res-card">
                          <div class="d-res-card__top">
                            <a class="d-res-card__name" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)} ↗</a>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                              <span class="d-pill">${esc(t.resourceTypeLabel[r.type])}</span>
                              <span class="d-pill">${esc(r.territories.join(' · '))}</span>
                              ${extLang ? `<span class="d-pill d-pill--slate">${esc(extLang)}</span>` : ''}
                            </div>
                          </div>
                          <p style="margin:4px 0 0;font-size:14.5px;">${esc(r.desc[state.lang])}</p>
                          ${
                            r.caveat
                              ? `<div class="d-res-card__caveat"><strong>${esc(t.caveatLabel)}:</strong> ${esc(r.caveat[state.lang])}</div>`
                              : ''
                          }
                        </article>`;
                      })
                      .join('')}
                  </div>
                </section>

                ${
                  acc.hasLocalGuide && acc.localGuide
                    ? `
                    <section class="d-block d-local-kit" id="d-local">
                      <div class="d-kicker" style="color:var(--slate);margin-bottom:4px;">${esc(t.sectionLocalGuideTag)}</div>
                      <h2 style="margin-top:0;">${esc(t.sectionLocalGuide)}</h2>
                      <p style="margin:0;font-size:14.5px;color:#334155;">${esc(acc.localGuide[state.lang].intro)}</p>
                      <div class="d-kit-grid">
                        ${acc.localGuide[state.lang].steps
                          .map(
                            (s, i) => `
                            <div class="d-kit-step">
                              <span class="d-kit-step__num">0${i + 1}</span>
                              <div>${esc(s)}</div>
                            </div>`
                          )
                          .join('')}
                      </div>
                    </section>`
                    : ''
                }
              `}

              <section class="d-block" id="d-related" style="border-top:2px solid var(--rule-strong);padding-top:20px;">
                <h2 style="font-size:19px;">${esc(t.sectionRelated)}</h2>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
                  ${(acc.relatedIds || [])
                    .map((id) => {
                      const rel = getAccion(id);
                      return `<button type="button" class="d-ter-pill" data-action="go-accion" data-id="${rel.id}">${esc(rel.title[state.lang])} →</button>`;
                    })
                    .join('')}
                </div>
                <p style="font-size:13px;color:var(--ink-muted);margin:0;">
                  <a href="https://github.com/guillefixx/web-cambio-social/issues" target="_blank" rel="noopener noreferrer">${esc(t.improveLink)} ↗</a>
                </p>
              </section>
            </article>

            <aside class="d-toc" aria-label="${esc(t.tocTitle)}">
              <div class="d-toc__title">${esc(t.tocTitle)}</div>
              <a href="#d-why">${esc(t.sectionWhy)}</a>
              <a href="#d-easy">${esc(t.sectionEasy)}</a>
              <a href="#d-further">${esc(t.sectionFurther)}</a>
              <a href="#d-doubts">${esc(t.sectionDoubts)}</a>
              <a href="#d-resources">${esc(t.sectionResources)}</a>
              ${acc.hasLocalGuide ? `<a href="#d-local">${esc(t.sectionLocalGuide)}</a>` : ''}
              <a href="#d-related">${esc(t.sectionRelated)}</a>
            </aside>
          </div>
        </div>
      `;
    }

    const footer = `
      <div class="d-wrap">
        <footer class="d-footer">
          <span>${esc(t.footerIndependent)}</span>
          <span>
            ${esc(t.footerLicense)} ·
            <button type="button" data-action="go-criteria" style="background:none;border:0;padding:0;text-decoration:underline;">${esc(t.navCriteria)}</button>
          </span>
        </footer>
      </div>
    `;

    return `<div class="v-hybrid">${draftBanner}${header}<main>${body}</main>${footer}</div>`;
  }

  /* ========================================================================
     RENDER & PROTOTYPE SWITCHER WIRING
     ======================================================================== */
  function renderStatePanel() {
    const panel = document.getElementById('proto-state-panel');
    if (!panel) return;
    panel.hidden = !state.showStatePanel;
    if (!state.showStatePanel) return;

    const currentVariant = D.VARIANTS.find((v) => v.key === state.variant);
    const terState = state.manualTerritory
      ? `manual ("${state.manualTerritory}", simulado en localStorage)`
      : `automático por idioma (${(D.SOFT_TERRITORY_PRIORITY[state.lang] || ['Estatal']).join(' → ')})`;

    panel.innerHTML = `
      <div><strong>Variante ${esc(currentVariant.key)}:</strong> ${esc(currentVariant.shortDesc)}</div>
      <div><strong>Ruta simulada:</strong> <code>${esc(simulatedPath())}</code> · <strong>Vista:</strong> <code>${esc(state.view)}</code> · <strong>Idioma:</strong> <code>${esc(state.lang)}</code></div>
      <div><strong>Territorio:</strong> ${esc(terState)} · <strong>Viewport:</strong> ${state.previewMobile ? 'Móvil (390px)' : 'Escritorio'}</div>
      <div style="opacity:0.75;margin-top:4px;">Atajo teclado: <code>←</code> y <code>→</code> para cambiar de variante. Fichas completas: Banca ética (#1), Redes y algoritmos (#4), Productores locales (#8 + Guía local).</div>
    `;
  }

  function render() {
    document.documentElement.lang = state.lang;
    document.body.classList.toggle('preview-mobile', state.previewMobile);

    const app = document.getElementById('app');
    if (state.variant === 'A') app.innerHTML = VariantA();
    else if (state.variant === 'B') app.innerHTML = VariantB();
    else if (state.variant === 'C') app.innerHTML = VariantC();
    else app.innerHTML = VariantD();

    const currentVariant = D.VARIANTS.find((v) => v.key === state.variant);
    const labelEl = document.getElementById('proto-variant-label');
    if (labelEl && currentVariant) {
      labelEl.textContent = `${currentVariant.key} · ${currentVariant.name}`;
    }

    const vpBtn = document.getElementById('proto-viewport-toggle');
    if (vpBtn) {
      vpBtn.setAttribute('aria-pressed', String(state.previewMobile));
      vpBtn.textContent = state.previewMobile ? '🖥 Escritorio' : '📱 390px';
    }

    const stBtn = document.getElementById('proto-state-toggle');
    if (stBtn) {
      stBtn.setAttribute('aria-expanded', String(state.showStatePanel));
    }

    syncUrl();
    renderStatePanel();
  }

  function cycleVariant(delta) {
    const keys = D.VARIANTS.map((v) => v.key);
    const idx = keys.indexOf(state.variant);
    state.variant = keys[(idx + delta + keys.length) % keys.length];
    state.mobileDrawerOpen = false;
    render();
  }

  // Delegated clicks inside #app
  document.getElementById('app').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.getAttribute('data-action');

    if (act === 'set-lang') {
      state.lang = btn.getAttribute('data-lang');
      render();
    } else if (act === 'go-home') {
      state.view = 'home';
      state.mobileDrawerOpen = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      render();
    } else if (act === 'go-criteria') {
      state.view = 'criteria';
      state.mobileDrawerOpen = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      render();
    } else if (act === 'go-ambito') {
      state.view = 'ambito';
      state.ambitoId = btn.getAttribute('data-id');
      state.effortFilter = 'all';
      state.mobileDrawerOpen = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      render();
    } else if (act === 'go-accion') {
      const id = btn.getAttribute('data-id');
      const found = getAccion(id);
      state.view = 'accion';
      state.accionId = found.id;
      state.ambitoId = found.ambitoId;
      state.mobileDrawerOpen = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      render();
    } else if (act === 'set-territory') {
      const ter = btn.getAttribute('data-ter');
      state.manualTerritory = ter || null;
      render();
    } else if (act === 'set-effort') {
      state.effortFilter = btn.getAttribute('data-effort');
      render();
    } else if (act === 'set-triage') {
      state.triageBucket = btn.getAttribute('data-bucket');
      render();
    } else if (act === 'toggle-mobile-drawer') {
      state.mobileDrawerOpen = !state.mobileDrawerOpen;
      render();
    }
  });

  // Delegated select change (Variant B global Territorio select)
  document.getElementById('app').addEventListener('change', function (e) {
    const sel = e.target.closest('[data-action="select-territory"]');
    if (!sel) return;
    state.manualTerritory = sel.value || null;
    render();
  });

  // Floating Prototype Switcher events
  document.getElementById('proto-prev').addEventListener('click', () => cycleVariant(-1));
  document.getElementById('proto-next').addEventListener('click', () => cycleVariant(1));
  document.getElementById('proto-viewport-toggle').addEventListener('click', () => {
    state.previewMobile = !state.previewMobile;
    render();
  });
  document.getElementById('proto-state-toggle').addEventListener('click', () => {
    state.showStatePanel = !state.showStatePanel;
    render();
  });

  // Keyboard arrows ← / → (do not intercept inside editable elements)
  document.addEventListener('keydown', function (e) {
    const tag = e.target && e.target.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      (e.target && e.target.isContentEditable)
    ) {
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      cycleVariant(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      cycleVariant(1);
    }
  });

  readParams();
  render();
})();
