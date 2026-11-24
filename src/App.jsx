import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Calendar,
  ClipboardList,
  Droplet,
  Users,
  Trophy,
  Flame,
  Check,
  MapPin
} from 'lucide-react';
// ============================================================================
// COSTANTE: I 5 MACRO-GRUPPI DI DIPARTIMENTO DELL'UNIVERSITÀ DI PAVIA
// ============================================================================
const MACRO_DIPARTIMENTI_UNIPV = [
  'Area Medica e Sanitaria (Medicina, Professioni Sanitarie)',
  'Area Umanistica e Psicologica (Psicologia, Filosofia, Lettere, Lingue)',
  'Area Ingegneria e Architettura (Ingegneria, DICAr)',
  'Area Scienze e Farmacia (Biologia, Farmacia, Chimica, Fisica, Matematica)',
  'Area Giuridica, Politica ed Economica (Giurisprudenza, Economia, Scienze Politiche)'
];

// ============================================================================
// PERSISTENZA LOCALE, DATE REALI, EMAIL (DNS MX + EMAILJS) & CODICI AVIS
// ============================================================================
const STORAGE_KEY_APP = 'invein_pavia_state_v2';
const STORAGE_KEY_EMAILJS = 'invein_pavia_emailjs_v1';
const EMAILJS_CONFIG_DEFAULT = {
  serviceId: 'service_j716kmf',
  templateId: 'template_d7gcgd9',
  publicKey: 'LJdUiqkyms8RMaz49'
};
const MAX_PUNTI_GIOCHI_GIORNO = 6;

function caricaConfigEmailJS() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_EMAILJS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        serviceId: String(parsed?.serviceId || EMAILJS_CONFIG_DEFAULT.serviceId),
        templateId: String(parsed?.templateId || EMAILJS_CONFIG_DEFAULT.templateId),
        publicKey: String(parsed?.publicKey || EMAILJS_CONFIG_DEFAULT.publicKey)
      };
    }
  } catch (e) {
    // Ignora errori localStorage
  }
  return { ...EMAILJS_CONFIG_DEFAULT };
}

function salvaConfigEmailJS(cfg) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY_EMAILJS,
      JSON.stringify({
        serviceId: String(cfg?.serviceId || '').trim(),
        templateId: String(cfg?.templateId || '').trim(),
        publicKey: String(cfg?.publicKey || '').trim()
      })
    );
  } catch (e) {
    // Ignora errori localStorage
  }
}

function isEmailJSConfigurato(cfg) {
  return Boolean(cfg?.serviceId?.trim() && cfg?.templateId?.trim() && cfg?.publicKey?.trim());
}

function ottieniDataOggiISO(offsetGiorni = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetGiorni);
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${anno}-${mese}-${giorno}`;
}

function ottieniSettimanaISO(dataInput = new Date()) {
  const d = new Date(Date.UTC(dataInput.getFullYear(), dataInput.getMonth(), dataInput.getDate()));
  const giornoSett = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - giornoSett);
  const inizioAnno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const numSett = Math.ceil(((d - inizioAnno) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(numSett).padStart(2, '0')}`;
}

function calcolaDataTraGiorni(giorni, baseDataISO = null) {
  let d = new Date();
  if (typeof baseDataISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(baseDataISO)) {
    const parti = baseDataISO.split('-');
    d = new Date(Number(parti[0]), Number(parti[1]) - 1, Number(parti[2]));
  }
  d.setDate(d.getDate() + giorni);
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  const leggibile = d.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  return {
    isoCompatta: `${anno}${mese}${giorno}`,
    leggibile
  };
}

function normalizzaTestoConfronto(valore) {
  return (valore || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function mescolaCarte(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copia[i];
    copia[i] = copia[j];
    copia[j] = tmp;
  }
  return copia;
}

function validaCodiceAvis(tipo, valore) {
  const c = (valore || '').trim().toUpperCase();
  if (tipo === 'visita') {
    return c === 'AVIS-VISITA-PV' || (c.startsWith('AVIS-VIS-') && c.length >= 11);
  }
  if (tipo === 'donazione') {
    return c === 'AVIS-DONA-PV' || (c.startsWith('AVIS-DON-') && c.length >= 11);
  }
  if (tipo === 'tutor') {
    return c === 'AVIS-TUTOR-PV' || (c.startsWith('AVIS-TUT-') && c.length >= 11);
  }
  if (tipo === 'accompagnamento') {
    return c === 'AVIS-ACC-PV' || (c.startsWith('AVIS-ACC-') && c.length >= 11);
  }
  return false;
}

function verificaFormatoEmail(valore) {
  const email = (valore || '').trim();
  if (!email) {
    return { valida: false, errore: 'Inserisci un indirizzo email.' };
  }
  if (/\s/.test(email)) {
    return { valida: false, errore: 'L\'indirizzo email non può contenere spazi.' };
  }
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return { valida: false, errore: 'Formato email non valido (esempio: nome.cognome@dominio.it).' };
  }
  const parti = email.toLowerCase().split('@');
  const dominio = parti[1] || '';
  if (dominio.includes('..') || dominio.startsWith('.') || dominio.endsWith('.')) {
    return { valida: false, errore: 'Il dominio dell\'email non è valido.' };
  }
  const refusi = {
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'yaho.it': 'yahoo.it'
  };
  if (refusi[dominio]) {
    return { valida: false, errore: `Controlla il dominio: intendevi forse "@${refusi[dominio]}"?` };
  }
  if (dominio.endsWith('.con')) {
    return { valida: false, errore: 'Il dominio termina con ".con": intendevi ".com"?' };
  }
  return { valida: true, email: email.toLowerCase(), errore: '' };
}

async function verificaDominioEmailMX(email) {
  const parti = (email || '').toLowerCase().split('@');
  const dominio = parti[1] || '';
  if (!dominio) {
    return { valido: false, errore: 'Dominio email mancante.', offline: false };
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timerId = controller ? setTimeout(() => controller.abort(), 4000) : null;
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=MX`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined
    });
    if (timerId) clearTimeout(timerId);
    if (!res.ok) {
      return { valido: true, errore: '', offline: true };
    }
    const data = await res.json();
    if (data.Status === 3 || (data.Status === 0 && (!Array.isArray(data.Answer) || data.Answer.length === 0))) {
      return {
        valido: false,
        errore: `Il dominio @${dominio} non esiste o non può ricevere email. Controlla l'indirizzo.`,
        offline: false
      };
    }
    if (data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0) {
      return { valido: true, errore: '', offline: false };
    }
    return { valido: true, errore: '', offline: true };
  } catch (e) {
    if (timerId) clearTimeout(timerId);
    return { valido: true, errore: '', offline: true };
  }
}

async function inviaEmailCodiceReale({ email, nome, codice, config }) {
  const payload = {
    service_id: config.serviceId.trim(),
    template_id: config.templateId.trim(),
    user_id: config.publicKey.trim(),
    template_params: {
      to_email: email,
      email: email,
      to_name: nome || 'Studente',
      name: nome || 'Studente',
      title: 'Codice di verifica IN VEIN Pavia',
      message: `Il tuo codice di verifica per IN VEIN Pavia è: ${codice} (valido 10 minuti).`,
      time: '10 minuti',
      code: codice,
      passcode: codice,
      app_name: 'IN VEIN Pavia'
    }
  };
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const dettaglio = await res.text().catch(() => '');
    throw new Error(dettaglio || `HTTP ${res.status}`);
  }
}

function IconaOcchio({ visibile }) {
  if (visibile) {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M1 1l22 22" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ============================================================================
// COSTANZA SETTIMANALE & CICLI: 9 COLORI DEL FUOCO (0, 2, 4, 8, 12, 20, 32, 44, 52 sett.)
// ============================================================================
const SOGLIE_FUOCO = [
  { soglia: 0, nome: 'Fiamma Base', badgeCls: 'bg-orange-50 text-orange-700 border-orange-200', iconCls: 'text-orange-500 fill-orange-500', hex: '#F97316' },
  { soglia: 2, nome: 'Fuoco Cremisi', badgeCls: 'bg-red-50 text-red-700 border-red-200', iconCls: 'text-red-600 fill-red-600', hex: '#DC2626' },
  { soglia: 4, nome: 'Fuoco Oro', badgeCls: 'bg-amber-50 text-amber-800 border-amber-300', iconCls: 'text-amber-500 fill-amber-500', hex: '#EAB308' },
  { soglia: 8, nome: 'Fuoco Smeraldo', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconCls: 'text-emerald-600 fill-emerald-600', hex: '#10B981' },
  { soglia: 12, nome: 'Fuoco Ciano', badgeCls: 'bg-cyan-50 text-cyan-700 border-cyan-200', iconCls: 'text-cyan-500 fill-cyan-500', hex: '#06B6D4' },
  { soglia: 20, nome: 'Fuoco Blu Elettrico', badgeCls: 'bg-blue-50 text-blue-700 border-blue-200', iconCls: 'text-blue-600 fill-blue-600', hex: '#2563EB' },
  { soglia: 32, nome: 'Fuoco Ametista', badgeCls: 'bg-purple-50 text-purple-700 border-purple-200', iconCls: 'text-purple-600 fill-purple-600', hex: '#9333EA' },
  { soglia: 44, nome: 'Fuoco Magenta', badgeCls: 'bg-pink-50 text-pink-700 border-pink-200', iconCls: 'text-pink-600 fill-pink-600', hex: '#DB2777' },
  { soglia: 52, nome: 'Fuoco Leggendario', badgeCls: 'bg-stone-900 text-amber-300 border-amber-400', iconCls: 'text-amber-400 fill-amber-400', hex: '#1C1917' }
];

function ottieniStileFuoco(settimane) {
  let corrente = SOGLIE_FUOCO[0];
  for (let i = 0; i < SOGLIE_FUOCO.length; i++) {
    if (settimane >= SOGLIE_FUOCO[i].soglia) {
      corrente = SOGLIE_FUOCO[i];
    }
  }
  return corrente;
}

function ModaleSerieAttivita({
  serieSettimane,
  setSerieSettimane,
  serieCicliDonazione,
  modalitaSviluppatore,
  onClose
}) {
  const stileAttuale = ottieniStileFuoco(serieSettimane);
  const prossima = SOGLIE_FUOCO.find((s) => s.soglia > serieSettimane);
  const prevSoglia = stileAttuale.soglia;
  const perc = prossima
    ? Math.min(100, Math.max(0, Math.round(((serieSettimane - prevSoglia) / (prossima.soglia - prevSoglia)) * 100)))
    : 100;

  return (
    <div className="absolute inset-0 z-50 bg-stone-900/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-5 shadow-2xl border border-stone-200 space-y-4 max-h-[90%] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${stileAttuale.badgeCls}`}>
              <Flame className={`w-5 h-5 ${stileAttuale.iconCls}`} />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900">Costanza & Cicli Donazione</h3>
              <p className="text-[11px] font-bold text-stone-500">{stileAttuale.nome} · {serieSettimane} sett.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 font-bold text-xs">✕</button>
        </div>

        {/* RIQUADRO 1: SERIE DI CICLI DONAZIONE */}
        <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-rose-950">🩸 Serie di Cicli Donazione</span>
            <span className="font-black text-rose-700 bg-white px-2.5 py-0.5 rounded-lg border border-rose-200">
              {serieCicliDonazione} {serieCicliDonazione === 1 ? 'ciclo' : 'cicli'}
            </span>
          </div>
          <p className="text-[10px] text-rose-900/90 leading-snug">
            Si dona ogni 90 giorni (180 giorni per le donne in età fertile, 14 giorni per il plasma), quindi il traguardo vero è la continuità nel tempo: cresce quando confermi in sede AVIS una nuova donazione a fine ciclo.
          </p>
        </div>

        {/* RIQUADRO 2: COSTANZA SETTIMANALE */}
        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-stone-700">
              🔥 Costanza Settimanale · {prossima ? `Prossimo a ${prossima.soglia} sett.` : 'Traguardo massimo!'}
            </span>
            <span className="font-black text-stone-900">{serieSettimane} / {prossima ? prossima.soglia : 52}</span>
          </div>
          <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${perc}%`, backgroundColor: stileAttuale.hex }}
            />
          </div>
          <p className="text-[10px] text-stone-500 leading-snug">
            Basta 1 attività nella settimana reale (quiz, visita, tutoraggio o donazione) per tenere acceso il fuoco senza pressione quotidiana.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-black uppercase text-stone-400 block">
            {modalitaSviluppatore
              ? '[DEV] Soglie Colore Fuoco (tocca per testare)'
              : 'Soglie Colore Fuoco (settimane attive)'}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {SOGLIE_FUOCO.map((s) => {
              const attivo = stileAttuale.soglia === s.soglia;
              const sbloccata = serieSettimane >= s.soglia;
              if (modalitaSviluppatore) {
                return (
                  <button
                    key={s.soglia}
                    onClick={() => setSerieSettimane(s.soglia === 0 ? 1 : s.soglia)}
                    className={`p-2 rounded-xl border text-center transition ${
                      attivo ? `${s.badgeCls} ring-2 ring-stone-900/20` : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <Flame className={`w-4 h-4 mx-auto ${s.iconCls}`} />
                    <span className="text-[10px] font-black block mt-0.5">
                      {s.soglia === 0 ? 'Base' : `${s.soglia} sett.`}
                    </span>
                  </button>
                );
              }
              return (
                <div
                  key={s.soglia}
                  className={`p-2 rounded-xl border text-center ${
                    attivo
                      ? `${s.badgeCls} ring-2 ring-stone-900/20`
                      : sbloccata
                      ? 'bg-white border-stone-300'
                      : 'bg-stone-50 border-stone-200 opacity-65'
                  }`}
                >
                  <Flame className={`w-4 h-4 mx-auto ${s.iconCls}`} />
                  <span className="text-[10px] font-black block mt-0.5">
                    {s.soglia === 0 ? 'Base' : `${s.soglia} sett.`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-black"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SUPER AVATAR MASCOTTE "LA GOCCIA IN VEIN" (5 CATEGORIE, ABBIGLIAMENTO UNIPV)
// ============================================================================
function CustomAvatar({ config, size = 'md', onClick, felice = false, frameless = false }) {
  const sizes = {
    xs: 'w-8 h-8',
    sm: 'w-11 h-11',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
    stage: 'w-32 h-32'
  };

  const paletteGoccia = {
    rubino: { top: '#FB7185', mid: '#E11D48', bot: '#9F1239', rim: '#FFE4E6' },
    amarena: { top: '#F43F5E', mid: '#9F1239', bot: '#4C0519', rim: '#FECDD3' },
    plasma: { top: '#FDE047', mid: '#F59E0B', bot: '#B45309', rim: '#FEF9C3' },
    corallo: { top: '#FCA5A5', mid: '#F43F5E', bot: '#BE123C', rim: '#FFF1F2' },
    imperiale: { top: '#FB7185', mid: '#881337', bot: '#450A0A', rim: '#FDE68A' }
  };

  const coloreKey = config?.coloreGoccia || 'rubino';
  const pal = paletteGoccia[coloreKey] || paletteGoccia.rubino;
  const gradId = `gocciaGrad-${coloreKey}-${frameless ? 'st' : 'av'}`;

  const espressione = felice ? 'entusiasta' : (config?.espressione || 'sorridente');
  const abbigliamento = config?.abbigliamento || 'nessuno';
  const copricapo = config?.copricapo || 'nessuno';
  const oggettoStudio = config?.oggettoStudio || 'nessuno';
  const visoAccessorio = config?.visoAccessorio || 'cerotto';

  return (
    <div
      onClick={onClick || undefined}
      className={`relative inline-flex items-center justify-center transition-all select-none ${sizes[size] || sizes.md} ${
        frameless
          ? ''
          : 'rounded-full bg-rose-50/90 p-1 border-2 border-rose-200 shadow-sm'
      } ${onClick ? 'cursor-pointer hover:scale-105 hover:border-rose-400' : ''}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <radialGradient id={gradId} cx="35%" cy="32%" r="68%">
            <stop offset="0%" stopColor={pal.top} />
            <stop offset="52%" stopColor={pal.mid} />
            <stop offset="100%" stopColor={pal.bot} />
          </radialGradient>
        </defs>

        {/* Ombra morbida sotto la goccia */}
        <ellipse cx="50" cy="95" rx="22" ry="3.8" fill="#9F1239" opacity="0.22" />

        {/* Gambette e scarpine carine quando e sul piedistallo */}
        {frameless && (
          <g>
            <line x1="42" y1="84" x2="41" y2="93" stroke={pal.bot} strokeWidth="3.5" strokeLinecap="round" />
            <line x1="58" y1="84" x2="59" y2="93" stroke={pal.bot} strokeWidth="3.5" strokeLinecap="round" />
            <ellipse cx="39" cy="94" rx="5.2" ry="2.6" fill="#7F1D3A" />
            <ellipse cx="61" cy="94" rx="5.2" ry="2.6" fill="#7F1D3A" />
          </g>
        )}

        {/* Capelli lunghi dietro il corpo */}
        {copricapo === 'capelli_lunghi' && (
          <g>
            <path d="M27 42 C16 52, 14 70, 22 79 C26 74, 27 65, 29 55 Z" fill="#6D3B23" />
            <path d="M73 42 C84 52, 86 70, 78 79 C74 74, 73 65, 71 55 Z" fill="#6D3B23" />
          </g>
        )}

        {/* CORPO GOCCIA MASCOTTE */}
        <path
          d="M50 11 C50 11, 79 42, 79 62 C79 78, 66 88, 50 88 C34 88, 21 78, 21 62 C21 42, 50 11, 50 11 Z"
          fill={`url(#${gradId})`}
          stroke={pal.bot}
          strokeWidth="1.2"
        />

        {/* Riflesso lucido 3D */}
        <path
          d="M35 40 C30 48, 28 57, 30 65"
          stroke={pal.rim}
          strokeWidth="3.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <circle cx="38" cy="34" r="2.2" fill={pal.rim} opacity="0.88" />

        {/* === 1. ABBIGLIAMENTO === */}
        {abbigliamento === 'felpa_cappuccio_bordeaux' && (
          <g>
            <path d="M21 65 Q50 72 79 65 C79 80, 66 88, 50 88 C34 88, 21 80, 21 65 Z" fill="#6B142F" stroke="#4C0519" strokeWidth="1.2" />
            <path d="M26 65 Q50 73 74 65 Q68 60 60 63 Q50 67 40 63 Q32 60 26 65 Z" fill="#581026" />
            <line x1="45" y1="68" x2="45" y2="75" stroke="#F8FAFC" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="55" y1="68" x2="55" y2="75" stroke="#F8FAFC" strokeWidth="1.3" strokeLinecap="round" />
            <text x="50" y="82" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#FDE68A" fontFamily="sans-serif">UNIPV</text>
          </g>
        )}

        {abbigliamento === 'camice_med' && (
          <g>
            <path d="M21 65 L44 71 L50 86 L56 71 L79 65 C78 80, 65 88, 50 88 C35 88, 22 80, 21 65 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.3" />
            <polygon points="44,71 50,83 56,71" fill="#38BDF8" opacity="0.85" />
            <line x1="50" y1="83" x2="50" y2="88" stroke="#94A3B8" strokeWidth="1.2" />
            <rect x="58" y="75" width="7" height="5" rx="1" fill="#E2E8F0" />
          </g>
        )}

        {abbigliamento === 'tshirt_bordeaux' && (
          <g>
            <path d="M22 67 Q50 72 78 67 C77 81, 64 88, 50 88 C36 88, 23 81, 22 67 Z" fill="#881337" stroke="#581026" strokeWidth="1" />
            <path d="M40 68 Q50 73 60 68" fill="none" stroke="#FDE68A" strokeWidth="1.6" />
          </g>
        )}

        {abbigliamento === 'felpa_girocollo_blu' && (
          <g>
            <path d="M22 66 Q50 71 78 66 C78 80, 65 88, 50 88 C35 88, 22 80, 22 66 Z" fill="#1E3A5F" stroke="#CBD5E1" strokeWidth="1" />
            <path d="M39 67 Q50 73 61 67" fill="none" stroke="#F8FAFC" strokeWidth="2" />
            <circle cx="50" cy="79" r="4.2" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1" />
          </g>
        )}

        {abbigliamento === 'tshirt_1361_bianca' && (
          <g>
            <path d="M22 67 Q50 71 78 67 C77 81, 64 88, 50 88 C36 88, 23 81, 22 67 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.2" />
            <path d="M40 68 Q50 73 60 68" fill="none" stroke="#7F1D3A" strokeWidth="2.2" />
            <text x="50" y="81" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#7F1D3A" fontFamily="sans-serif">1361</text>
          </g>
        )}

        {abbigliamento === 'polo_unipv_bordeaux' && (
          <g>
            <path d="M22 66 L44 71 L50 78 L56 71 L78 66 C78 80, 65 88, 50 88 C35 88, 22 80, 22 66 Z" fill="#881337" />
            <polygon points="39,67 50,74 46,70" fill="#FFFFFF" />
            <polygon points="61,67 50,74 54,70" fill="#FFFFFF" />
            <circle cx="50" cy="77" r="1" fill="#FDE68A" />
            <circle cx="50" cy="81" r="1" fill="#FDE68A" />
            <circle cx="60" cy="76" r="2.6" fill="#FDE68A" />
          </g>
        )}

        {abbigliamento === 'sciarpa_unipv' && (
          <g>
            <path d="M25 67 Q50 75 75 67 L72 75 Q50 82 28 75 Z" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1.1" />
            <path d="M30 71 Q50 77 70 71" fill="none" stroke="#FDE68A" strokeWidth="1.4" />
            <path d="M58 71 L64 87 L55 87 L52 73 Z" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1" />
          </g>
        )}

        {abbigliamento === 'giacca_unipv_college' && (
          <g>
            <path d="M22 66 Q50 72 78 66 C78 80, 65 88, 50 88 C35 88, 22 80, 22 66 Z" fill="#1E3A5F" />
            <path d="M22 66 Q29 71 33 83 C26 79, 22 73, 22 66 Z" fill="#F5F0E6" />
            <path d="M78 66 Q71 71 67 83 C74 79, 78 73, 78 66 Z" fill="#F5F0E6" />
            <line x1="50" y1="69" x2="50" y2="88" stroke="#F5F0E6" strokeWidth="1.8" />
            <rect x="56" y="73" width="7" height="7" rx="1.5" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1" />
          </g>
        )}

        {abbigliamento === 'toga_laurea' && (
          <g>
            <path d="M21 65 Q50 70 79 65 C78 80, 65 88, 50 88 C35 88, 22 80, 21 65 Z" fill="#0F172A" />
            <path d="M39 67 L50 87 L61 67" fill="none" stroke="#881337" strokeWidth="3.2" />
            <path d="M40 68 L50 87 L60 68" fill="none" stroke="#F59E0B" strokeWidth="1.5" />
            <polygon points="45,68 50,76 55,68" fill="#FFFFFF" />
          </g>
        )}

        {/* === 2. CAPELLI E COPRICAPI === */}
        {copricapo === 'capelli_corti' && (
          <g>
            <path d="M29 37 C27 27, 42 23, 50 26 C57 22, 72 26, 71 37 C65 32, 57 34, 51 31 C44 35, 35 33, 29 37 Z" fill="#7C4327" stroke="#532B17" strokeWidth="1.2" />
            <path d="M37 31 Q47 26 57 30" stroke="#A16240" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        )}

        {copricapo === 'capelli_lunghi' && (
          <g>
            <path d="M26 42 C25 25, 42 21, 50 25 C58 21, 75 25, 74 42 C67 34, 58 32, 50 31 C42 32, 33 34, 26 42 Z" fill="#7C4327" stroke="#532B17" strokeWidth="1.2" />
            <path d="M34 31 Q50 24 66 31" stroke="#A16240" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
        )}

        {copricapo === 'chignon_cap' && (
          <g>
            <circle cx="58" cy="14" r="7.5" fill="#7C4327" stroke="#532B17" strokeWidth="1.2" />
            <path d="M30 30 C32 16, 68 16, 70 30 Z" fill="#7C4327" stroke="#532B17" strokeWidth="1.2" />
            <path d="M26 30 Q48 25 76 31 L71 34 Q48 30 26 30 Z" fill="#532B17" />
            <text x="48" y="26" textAnchor="middle" fontSize="6" fontWeight="900" fill="#FDE68A" fontFamily="sans-serif">PV</text>
          </g>
        )}

        {copricapo === 'cappellino_baseball_unipv' && (
          <g>
            <path d="M30 29 C31 15, 69 15, 70 29 Z" fill="#7F1D3A" stroke="#4C0519" strokeWidth="1.2" />
            <path d="M28 29 Q54 25 81 31 L75 34 Q52 30 28 29 Z" fill="#4C0519" />
            <text x="50" y="25" textAnchor="middle" fontSize="6" fontWeight="900" fill="#FDE68A" fontFamily="sans-serif">PV</text>
          </g>
        )}

        {copricapo === 'berretto_unipv' && (
          <g>
            <path d="M30 29 C32 12, 68 12, 70 29 Z" fill="#6B142F" stroke="#4C0519" strokeWidth="1.2" />
            <rect x="28" y="25" width="44" height="8" rx="3.5" fill="#7F1D3A" stroke="#4C0519" strokeWidth="1.2" />
            <text x="50" y="31" textAnchor="middle" fontSize="5.4" fontWeight="900" fill="#FDE68A" fontFamily="sans-serif">UNIPV</text>
          </g>
        )}

        {copricapo === 'cappellino_navy_unipv' && (
          <g>
            <path d="M30 29 C31 15, 69 15, 70 29 Z" fill="#1E3A5F" stroke="#0F172A" strokeWidth="1.2" />
            <path d="M28 29 Q54 25 81 31 L75 34 Q52 30 28 29 Z" fill="#0F172A" />
            <text x="50" y="25" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="#FFFFFF" fontFamily="sans-serif">1361</text>
          </g>
        )}

        {copricapo === 'feluca_rossa' && (
          <g>
            <path d="M24 27 L52 7 L78 24 L68 31 Q50 26 30 31 Z" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="1.2" />
            <path d="M30 28 Q50 23 69 28" fill="none" stroke="#FDE047" strokeWidth="2" />
            <circle cx="42" cy="22" r="1.8" fill="#FDE047" />
            <circle cx="54" cy="18" r="1.6" fill="#FFFFFF" />
            <circle cx="62" cy="23" r="1.6" fill="#38BDF8" />
          </g>
        )}

        {copricapo === 'feluca_blu' && (
          <g>
            <path d="M24 27 L52 7 L78 24 L68 31 Q50 26 30 31 Z" fill="#1D4ED8" stroke="#1E3A8A" strokeWidth="1.2" />
            <path d="M30 28 Q50 23 69 28" fill="none" stroke="#FDE047" strokeWidth="2" />
            <circle cx="42" cy="22" r="1.8" fill="#FDE047" />
            <circle cx="54" cy="18" r="1.6" fill="#FFFFFF" />
            <circle cx="62" cy="23" r="1.6" fill="#FB7185" />
          </g>
        )}

        {copricapo === 'corona_alloro' && (
          <g>
            <path d="M27 34 C24 22, 34 13, 47 13 C38 18, 33 25, 32 34 Z" fill="#15803D" />
            <path d="M73 34 C76 22, 66 13, 53 13 C62 18, 67 25, 68 34 Z" fill="#15803D" />
            <circle cx="31" cy="24" r="2" fill="#DC2626" />
            <circle cx="69" cy="24" r="2" fill="#DC2626" />
            <circle cx="39" cy="16" r="2" fill="#DC2626" />
            <circle cx="61" cy="16" r="2" fill="#DC2626" />
          </g>
        )}

        {copricapo === 'tocco_laurea' && (
          <g>
            <polygon points="50,4 76,13 50,22 24,13" fill="#0F172A" />
            <rect x="42" y="17" width="16" height="6" fill="#1E293B" />
            <path d="M50 13 L70 20 L70 30" stroke="#F59E0B" strokeWidth="2" fill="none" />
            <circle cx="70" cy="31" r="2.2" fill="#F59E0B" />
          </g>
        )}

        {/* === 3. OCCHI ED ESPRESSIONI === */}
        {espressione === 'occhietto' ? (
          <g>
            <circle cx="40" cy="50" r="4.8" fill="#FFFFFF" />
            <circle cx="40.5" cy="50" r="3.1" fill="#1C1917" />
            <circle cx="41.8" cy="48.5" r="1.2" fill="#FFFFFF" />
            <path d="M55 50 Q60 46 65 50" stroke="#1C1917" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </g>
        ) : espressione === 'grintosa' ? (
          <g>
            <path d="M35 47 L45 50 L35 53" stroke="#1C1917" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M65 47 L55 50 L65 53" stroke="#1C1917" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : espressione === 'concentrata' ? (
          <g>
            <circle cx="40" cy="50" r="4.5" fill="#FFFFFF" />
            <circle cx="60" cy="50" r="4.5" fill="#FFFFFF" />
            <circle cx="40.5" cy="50" r="2.9" fill="#1C1917" />
            <circle cx="60.5" cy="50" r="2.9" fill="#1C1917" />
            <circle cx="41.5" cy="48.8" r="1" fill="#FFFFFF" />
            <circle cx="61.5" cy="48.8" r="1" fill="#FFFFFF" />
            <line x1="34" y1="43" x2="45" y2="45" stroke="#532B17" strokeWidth="2" strokeLinecap="round" />
            <line x1="66" y1="43" x2="55" y2="45" stroke="#532B17" strokeWidth="2" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="40" cy="50" r="5" fill="#FFFFFF" />
            <circle cx="60" cy="50" r="5" fill="#FFFFFF" />
            <circle cx="40.5" cy="50" r="3.2" fill="#291A15" />
            <circle cx="60.5" cy="50" r="3.2" fill="#291A15" />
            <circle cx="42" cy="48.4" r="1.4" fill="#FFFFFF" />
            <circle cx="62" cy="48.4" r="1.4" fill="#FFFFFF" />
            <path d="M35 43 Q40 41 44 43" stroke="#532B17" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M56 43 Q60 41 65 43" stroke="#532B17" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        )}

        <ellipse cx="32" cy="56" rx="4.2" ry="2.2" fill="#FECDD3" opacity="0.72" />
        <ellipse cx="68" cy="56" rx="4.2" ry="2.2" fill="#FECDD3" opacity="0.72" />

        {espressione === 'entusiasta' || espressione === 'grintosa' ? (
          <path d="M43 58 Q50 67 57 58 Z" fill="#FFFFFF" stroke="#1C1917" strokeWidth="1.8" strokeLinejoin="round" />
        ) : espressione === 'concentrata' ? (
          <path d="M45 60 Q50 61 55 60" stroke="#1C1917" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M43 58 Q50 65 57 58" stroke="#1C1917" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        )}

        {/* === 4. ACCESSORI VISO / OCCHIALI === */}
        {visoAccessorio === 'occhiali_studio' && (
          <g stroke="#1E293B" strokeWidth="2.2" fill="rgba(255,255,255,0.2)">
            <circle cx="40" cy="50" r="7.5" />
            <circle cx="60" cy="50" r="7.5" />
            <line x1="47.5" y1="50" x2="52.5" y2="50" />
            <line x1="25" y1="48" x2="32.5" y2="50" />
            <line x1="67.5" y1="50" x2="75" y2="48" />
          </g>
        )}

        {visoAccessorio === 'occhiali_sole' && (
          <g>
            <rect x="31" y="44" width="16" height="10" rx="3" fill="#0F172A" />
            <rect x="53" y="44" width="16" height="10" rx="3" fill="#0F172A" />
            <line x1="47" y1="48" x2="53" y2="48" stroke="#0F172A" strokeWidth="2.2" />
            <line x1="34" y1="46" x2="40" y2="52" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.4" />
            <line x1="56" y1="46" x2="62" y2="52" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.4" />
          </g>
        )}

        {visoAccessorio === 'cerotto' && (
          <g transform="rotate(-18 65 60)">
            <rect x="58" y="57" width="13" height="5.5" rx="2" fill="#FFE4E6" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="64.5" cy="59.7" r="1.1" fill="#FB7185" />
          </g>
        )}

        {/* === 5. ACCESSORI & GADGET === */}
        {oggettoStudio === 'spilla_portachiavi' && (
          <g>
            <circle cx="34" cy="69" r="5.5" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1.6" />
            <circle cx="34" cy="69" r="2" fill="#FDE68A" />
          </g>
        )}

        {oggettoStudio === 'cancelleria_unipv' && (
          <g>
            <rect x="65" y="57" width="20" height="25" rx="2.5" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1.4" />
            <rect x="69" y="62" width="12" height="4.5" rx="1" fill="#FDE68A" />
            <line x1="67" y1="59" x2="67" y2="80" stroke="#4C0519" strokeWidth="2" />
          </g>
        )}

        {oggettoStudio === 'stetoscopio' && (
          <g>
            <path d="M33 65 C33 78, 67 78, 67 65" fill="none" stroke="#1E293B" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="50" y1="75" x2="50" y2="83" stroke="#1E293B" strokeWidth="2.4" />
            <circle cx="50" cy="84" r="3.4" fill="#CBD5E1" stroke="#334155" strokeWidth="1.4" />
          </g>
        )}

        {oggettoStudio === 'mug_unipv' && (
          <g>
            <rect x="67" y="65" width="16" height="18" rx="2.5" fill="#FFFFFF" stroke="#7F1D3A" strokeWidth="1.5" />
            <rect x="67.5" y="71" width="15" height="5" fill="#7F1D3A" />
            <circle cx="75" cy="73.5" r="1.6" fill="#FDE68A" />
            <path d="M83 68 C89 68, 89 79, 83 79" stroke="#7F1D3A" strokeWidth="2" fill="none" />
          </g>
        )}

        {oggettoStudio === 'borraccia_unipv' && (
          <g>
            <rect x="71" y="54" width="13" height="28" rx="3.5" fill="#7F1D3A" stroke="#E2E8F0" strokeWidth="1.2" />
            <rect x="73" y="49" width="9" height="5" rx="1.5" fill="#CBD5E1" stroke="#64748B" strokeWidth="1" />
            <circle cx="77.5" cy="67" r="3" fill="#FDE68A" opacity="0.95" />
          </g>
        )}

        {oggettoStudio === 'shopper_unipv' && (
          <g>
            <path d="M70 60 C70 52, 82 52, 82 60" stroke="#B45309" strokeWidth="1.8" fill="none" />
            <rect x="65" y="60" width="22" height="24" rx="2" fill="#F5F0E6" stroke="#D6C7AE" strokeWidth="1.4" />
            <circle cx="76" cy="71" r="4" fill="#7F1D3A" />
            <circle cx="76" cy="71" r="1.6" fill="#FDE68A" />
          </g>
        )}

        {oggettoStudio === 'zaino_unipv' && (
          <g>
            <path d="M72 54 C72 48, 82 48, 82 54" stroke="#0F172A" strokeWidth="2" fill="none" />
            <rect x="66" y="54" width="22" height="28" rx="5" fill="#1E3A5F" stroke="#0F172A" strokeWidth="1.4" />
            <rect x="69" y="68" width="16" height="10" rx="2.5" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1" />
          </g>
        )}

        {oggettoStudio === 'laptop' && (
          <g>
            <rect x="60" y="58" width="27" height="18" rx="2" fill="#334155" stroke="#94A3B8" strokeWidth="1.4" />
            <rect x="63" y="61" width="21" height="12" rx="1" fill="#38BDF8" />
            <polygon points="58,76 89,76 92,82 55,82" fill="#64748B" />
          </g>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// CICLO BIOLOGICO DELLA DONAZIONE (PULITO, SENZA BOTTONI INUTILI SOTTO)
// ============================================================================
function BarraGocciaProgressiva({
  timestampDonazione,
  setTimestampDonazione,
  giorniDemoOffset,
  setGiorniDemoOffset,
  tipoCiclo,
  setTipoCiclo,
  donazioneVerificataAvis,
  modalitaSviluppatore,
  onDonazioneVerificata,
  onAvviaSoloTimer
}) {
  const durate = { sangue_90: 90, donna_180: 180, plasma_14: 14 };
  const tipoNormalizzato = tipoCiclo === 'donna_fertile' ? 'donna_180' : tipoCiclo;
  const profiloValido = durate[tipoNormalizzato] ? tipoNormalizzato : 'sangue_90';
  const giorniTotali = durate[profiloValido];
  const isPlasma = profiloValido === 'plasma_14';

  const [oraAttuale, setOraAttuale] = useState(() => new Date());
  const [fasePreviewId, setFasePreviewId] = useState(null);
  const [boxCodiceAperto, setBoxCodiceAperto] = useState(false);
  const [codiceDonazioneInput, setCodiceDonazioneInput] = useState('');
  const [erroreCodiceDonazione, setErroreCodiceDonazione] = useState('');

  useEffect(() => {
    const intervallo = setInterval(() => {
      setOraAttuale(new Date());
    }, 60000);
    return () => clearInterval(intervallo);
  }, []);

  const haDonato = timestampDonazione !== null;
  const msTrascorsi = haDonato
    ? Math.max(0, oraAttuale.getTime() - timestampDonazione) + giorniDemoOffset * 86400000
    : 0;

  const giorniReali = haDonato ? Math.floor(msTrascorsi / 86400000) + 1 : 0;
  const giorniTrascorsi = haDonato ? Math.min(giorniTotali, giorniReali) : 0;
  const percentuale = haDonato
    ? Math.min(100, Math.max(0, Math.round((giorniTrascorsi / giorniTotali) * 100)))
    : 0;
  const giorniMancanti = haDonato ? Math.max(0, giorniTotali - giorniTrascorsi) : giorniTotali;

  const oreOggi = Math.floor((msTrascorsi % 86400000) / 3600000);
  const minutiOggi = Math.floor((msTrascorsi % 3600000) / 60000);

  const dataDonazioneStr = haDonato
    ? new Date(timestampDonazione).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  const inviaCodiceDonazione = (e) => {
    if (e) e.preventDefault();
    if (!validaCodiceAvis('donazione', codiceDonazioneInput)) {
      setErroreCodiceDonazione('Codice non riconosciuto. Chiedi il codice di conferma in sede AVIS.');
      return;
    }
    setErroreCodiceDonazione('');
    setBoxCodiceAperto(false);
    setCodiceDonazioneInput('');
    setFasePreviewId(null);
    if (onDonazioneVerificata) {
      onDonazioneVerificata(codiceDonazioneInput.trim().toUpperCase());
    }
  };

  const avviaPromemoriaPersonale = () => {
    setFasePreviewId(null);
    setBoxCodiceAperto(false);
    if (onAvviaSoloTimer) {
      onAvviaSoloTimer();
    } else {
      setTimestampDonazione(Date.now());
      setGiorniDemoOffset(0);
    }
  };

  const selezionaTipo = (tipo) => {
    setTipoCiclo(tipo);
    setFasePreviewId(null);
  };

  const tappeBiologiche = isPlasma
    ? [
        {
          id: 'volume',
          giornoTarget: 1,
          titolo: '24h',
          sottotitolo: 'Volume 100%',
          icona: '💧',
          descrizione: 'In circa 24 ore l\'organismo ricostituisce la parte liquida donata con una buona idratazione.'
        },
        {
          id: 'proteine',
          giornoTarget: 3,
          titolo: '3g',
          sottotitolo: 'Proteine',
          icona: '🧬',
          descrizione: 'Le proteine plasmatiche tornano rapidamente verso i livelli fisiologici di partenza.'
        },
        {
          id: 'riequilibrio',
          giornoTarget: 7,
          titolo: '7g',
          sottotitolo: 'Riequilibrio',
          icona: '⚖️',
          descrizione: 'I globuli rossi vengono restituiti durante la plasmaferesi, rendendo il recupero più leggero.'
        },
        {
          id: 'pronto',
          giornoTarget: 14,
          titolo: '14g',
          sottotitolo: 'Fine Ciclo',
          icona: '🎉',
          descrizione: 'Intervallo minimo AVIS Pavia completato: dopo 14 giorni dal plasma puoi donare di nuovo plasma o sangue intero.'
        }
      ]
    : [
        {
          id: 'plasma',
          giornoTarget: 1,
          titolo: '24h',
          sottotitolo: 'Plasma 100%',
          icona: '💧',
          descrizione: 'In circa 24–48 ore il corpo rigenera la parte liquida (volume plasmatico).'
        },
        {
          id: 'midollo',
          giornoTarget: 7,
          titolo: '7g',
          sottotitolo: 'Midollo Attivo',
          icona: '🧬',
          descrizione: 'Il midollo osseo lavora per produrre nuovi globuli rossi: mantieni buona idratazione e alimentazione varia.'
        },
        {
          id: 'globuli',
          giornoTarget: 30,
          titolo: '30g',
          sottotitolo: 'OK Plasma',
          icona: '🩸',
          descrizione: 'Dopo 30 giorni da una donazione di sangue intero puoi già donare plasma o piastrine.'
        },
        {
          id: 'pronto',
          giornoTarget: giorniTotali,
          titolo: `${giorniTotali}g`,
          sottotitolo: 'Fine Ciclo',
          icona: '🎉',
          descrizione:
            profiloValido === 'donna_180'
              ? 'Intervallo completato: 180 giorni (6 mesi) per donne in età fertile, massimo 2 donazioni di sangue intero all\'anno.'
              : 'Intervallo completato: 90 giorni (3 mesi) tra donazioni di sangue intero, massimo 4 all\'anno.'
        }
      ];

  const sogliaTerzaTappa = isPlasma ? 7 : 30;
  const sogliaSecondaTappa = isPlasma ? 3 : 7;

  const tappaAutomatica = !haDonato
    ? tappeBiologiche[0]
    : percentuale >= 100
    ? tappeBiologiche[3]
    : giorniTrascorsi >= sogliaTerzaTappa
    ? tappeBiologiche[2]
    : giorniTrascorsi >= sogliaSecondaTappa
    ? tappeBiologiche[1]
    : tappeBiologiche[0];

  const tappaVisualizzata =
    tappeBiologiche.find((t) => t.id === fasePreviewId) || tappaAutomatica;

  const notaLeggeCiclo =
    profiloValido === 'donna_180'
      ? 'Regola AVIS Pavia: 180 giorni (6 mesi) tra due donazioni di sangue intero in età fertile.'
      : profiloValido === 'plasma_14'
      ? 'Regola AVIS Pavia: 14 giorni dopo una donazione di plasma (verso plasma o sangue intero); 30 giorni da sangue intero a plasma o piastrine.'
      : 'Regola AVIS Pavia: 90 giorni (3 mesi, max 4 l\'anno) tra due donazioni di sangue intero per uomini e donne in menopausa.';

  return (
    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-stone-900">
          Il Ciclo Dopo una Donazione
        </h3>
        <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl shrink-0">
          {haDonato ? `Giorno ${giorniTrascorsi} / ${giorniTotali}` : 'In attesa'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => selezionaTipo('sangue_90')}
          className={`py-2.5 px-1 text-[11px] font-bold rounded-xl border transition ${
            profiloValido === 'sangue_90'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-stone-50 text-stone-600 border-stone-200'
          }`}
        >
          Sangue (90g)
        </button>
        <button
          onClick={() => selezionaTipo('donna_180')}
          className={`py-2.5 px-1 text-[11px] font-bold rounded-xl border transition ${
            profiloValido === 'donna_180'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-stone-50 text-stone-600 border-stone-200'
          }`}
        >
          Donna (180g)
        </button>
        <button
          onClick={() => selezionaTipo('plasma_14')}
          className={`py-2.5 px-1 text-[11px] font-bold rounded-xl border transition ${
            profiloValido === 'plasma_14'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-stone-50 text-stone-600 border-stone-200'
          }`}
        >
          Plasma (14g)
        </button>
      </div>

      <p className="text-[10px] text-stone-500 leading-snug bg-stone-50 px-2.5 py-2 rounded-xl border border-stone-200/70">
        {notaLeggeCiclo}
      </p>

      <div className="space-y-1.5 pt-1">
        <div className="relative w-full h-11 flex items-center">
          <div className="w-full h-3.5 bg-stone-100 rounded-full border border-stone-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isPlasma
                  ? 'bg-gradient-to-r from-amber-300 to-amber-500'
                  : 'bg-gradient-to-r from-rose-300 to-rose-600'
              }`}
              style={{ width: `${percentuale}%` }}
            />
          </div>

          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300 z-20"
            style={{ left: `${Math.max(5, Math.min(95, percentuale))}%` }}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white ${
                !haDonato
                  ? 'bg-stone-300 text-stone-600'
                  : percentuale >= 100
                  ? 'bg-emerald-500 text-white scale-110'
                  : isPlasma
                  ? 'bg-amber-500 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {percentuale >= 100 ? (
                <Check className="w-4 h-4 stroke-[3]" />
              ) : (
                <Droplet className="w-4 h-4 fill-current" />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-500 font-medium px-0.5 gap-1">
          <span className="truncate">
            {haDonato
              ? `Avviato il ${dataDonazioneStr}`
              : 'Sincronizzato con l\'orologio del dispositivo'}
          </span>
          <span className="font-bold text-stone-800 shrink-0">
            {!haDonato
              ? `${giorniTotali}g intervallo`
              : percentuale >= 100
              ? 'Ciclo completato!'
              : `-${giorniMancanti}g (${oreOggi}h ${minutiOggi}m)`}
          </span>
        </div>
      </div>

      {haDonato && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 px-3 py-2.5 rounded-2xl border border-stone-200/80 text-[11px]">
          <div className="min-w-0">
            <span className={`font-black block ${donazioneVerificataAvis ? 'text-emerald-700' : 'text-stone-700'}`}>
              {donazioneVerificataAvis ? '✓ Donazione verificata AVIS' : 'Promemoria personale (non verificata)'}
            </span>
          </div>
          {modalitaSviluppatore && (
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                onClick={() => setGiorniDemoOffset((d) => d + 15)}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-black transition"
              >
                [DEV] ⏩ +15g
              </button>
              <button
                onClick={() => {
                  setTimestampDonazione(null);
                  setGiorniDemoOffset(0);
                }}
                className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg font-bold transition"
              >
                [DEV] Reset
              </button>
            </div>
          )}
        </div>
      )}

      {(!haDonato || !donazioneVerificataAvis || percentuale >= 100) && (
        <div className="space-y-2">
          {!boxCodiceAperto ? (
            <button
              onClick={() => {
                setBoxCodiceAperto(true);
                setErroreCodiceDonazione('');
              }}
              className="w-full py-3.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-md shadow-rose-600/20 transition active:scale-95"
            >
              {percentuale >= 100
                ? '🩸 Registra Nuova Donazione a Fine Ciclo (+100 pt)'
                : '🩸 Registra Donazione con Codice AVIS (+100 pt)'}
            </button>
          ) : (
            <form onSubmit={inviaCodiceDonazione} className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-rose-950">Inserisci il Codice Donazione AVIS</span>
                <button
                  type="button"
                  onClick={() => setBoxCodiceAperto(false)}
                  className="text-[11px] font-bold text-stone-500"
                >
                  Chiudi
                </button>
              </div>
              <p className="text-[11px] text-stone-600 leading-snug">
                Il codice viene consegnato in sede AVIS al termine della donazione.
                {modalitaSviluppatore && (
                  <span className="block font-mono font-bold text-amber-800 mt-0.5">[DEV] Codice di prova: AVIS-DONA-PV</span>
                )}
              </p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={codiceDonazioneInput}
                  onChange={(e) => {
                    setCodiceDonazioneInput(e.target.value);
                    setErroreCodiceDonazione('');
                  }}
                  placeholder="Codice donazione AVIS"
                  className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs font-bold uppercase focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs"
                >
                  Conferma
                </button>
              </div>
              {erroreCodiceDonazione && (
                <p className="text-[11px] font-bold text-rose-700">{erroreCodiceDonazione}</p>
              )}
            </form>
          )}

          {!haDonato && (
            <button
              type="button"
              onClick={avviaPromemoriaPersonale}
              className="w-full py-2 text-[11px] font-bold text-stone-500 hover:text-stone-800 underline transition"
            >
              Oppure avvia solo promemoria personale (0 pt · non valido per Tutor)
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {tappeBiologiche.map((t) => {
          const raggiunta = haDonato && giorniTrascorsi >= t.giornoTarget;
          const selezionata = tappaVisualizzata.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFasePreviewId(t.id)}
              className={`p-2 rounded-2xl border text-center transition ${
                raggiunta
                  ? 'bg-rose-50/80 border-rose-300 text-rose-900'
                  : selezionata
                  ? 'bg-stone-100 border-stone-400 text-stone-800'
                  : 'bg-stone-50 border-stone-200 text-stone-400 hover:bg-stone-100'
              }`}
            >
              <span className="text-sm block">{t.icona}</span>
              <span className="text-[10px] font-black block mt-0.5">{t.titolo}</span>
              <span className="text-[9px] font-semibold block truncate">{t.sottotitolo}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/90 flex items-start space-x-2.5">
        <span className="text-lg shrink-0">{tappaVisualizzata.icona}</span>
        <p className="text-xs text-stone-700 leading-snug">
          <strong className="text-stone-900">{tappaVisualizzata.sottotitolo}: </strong>
          {tappaVisualizzata.descrizione}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// SCHERMATA INIZIALE DI REGISTRAZIONE (MACRO-DIPARTIMENTI, LOGO IN VEIN)
// ============================================================================
function SchermataRegistrazione({
  profilo,
  setProfilo,
  avatar,
  setModaleAvatarAperta,
  emailJsConfig,
  mostraNotifica,
  onCompletaRegistrazione
}) {
  const [nome, setNome] = useState(profilo.nome || '');
  const [cognome, setCognome] = useState(profilo.cognome || '');
  const [facolta, setFacolta] = useState(profilo.facolta || MACRO_DIPARTIMENTI_UNIPV[1]);
  const [confermaFacolta, setConfermaFacolta] = useState(false);

  const [email, setEmail] = useState(profilo.email || '');
  const [codiceEmailAtteso, setCodiceEmailAtteso] = useState('');
  const [codiceScadenzaMs, setCodiceScadenzaMs] = useState(0);
  const [codiceEmailInput, setCodiceEmailInput] = useState('');
  const [codiceEmailInviato, setCodiceEmailInviato] = useState(false);
  const [emailVerificata, setEmailVerificata] = useState(false);
  const [erroreEmail, setErroreEmail] = useState('');
  const [invioEmailInCorso, setInvioEmailInCorso] = useState(false);
  const [cooldownRinvio, setCooldownRinvio] = useState(0);

  const [password, setPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');
  const [mostraPassword, setMostraPassword] = useState(false);
  const [mostraConfermaPassword, setMostraConfermaPassword] = useState(false);

  useEffect(() => {
    if (cooldownRinvio <= 0) return;
    const timer = setTimeout(() => {
      setCooldownRinvio((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownRinvio]);

  const onCambiaEmail = (nuovaEmail) => {
    setEmail(nuovaEmail);
    setEmailVerificata(false);
    setCodiceEmailInviato(false);
    setCodiceEmailAtteso('');
    setCodiceScadenzaMs(0);
    setCodiceEmailInput('');
    setCooldownRinvio(0);
    setErroreEmail('');
  };

  const inviaCodiceVerificaEmail = async () => {
    if (invioEmailInCorso || cooldownRinvio > 0) return;
    const esito = verificaFormatoEmail(email);
    if (!esito.valida) {
      setErroreEmail(esito.errore);
      return;
    }

    setInvioEmailInCorso(true);
    setErroreEmail('');
    try {
      const mx = await verificaDominioEmailMX(esito.email);
      if (!mx.valido) {
        setErroreEmail(mx.errore);
        return;
      }

      if (!isEmailJSConfigurato(emailJsConfig)) {
        setErroreEmail('Servizio invio email non ancora attivo: configura il mittente nell\'app.');
        return;
      }

      const codice = String(Math.floor(100000 + Math.random() * 900000));
      await inviaEmailCodiceReale({
        email: esito.email,
        nome: nome.trim(),
        codice,
        config: emailJsConfig
      });

      setEmail(esito.email);
      setCodiceEmailAtteso(codice);
      setCodiceScadenzaMs(Date.now() + 10 * 60 * 1000);
      setCodiceEmailInput('');
      setCodiceEmailInviato(true);
      setEmailVerificata(false);
      setCooldownRinvio(60);
      if (mostraNotifica) {
        mostraNotifica('Codice inviato', `Controlla la casella ${esito.email} (anche nello spam).`, 0);
      }
    } catch (err) {
      const msg = err?.message || 'Controlla la connessione e riprova';
      const hintLocale =
        typeof window !== 'undefined' && window.location && window.location.protocol === 'file:'
          ? ' Apri l\'app tramite AVVIA_APP.bat invece che direttamente come file.'
          : '';
      setErroreEmail(`Invio email non riuscito: ${msg}.${hintLocale}`);
    } finally {
      setInvioEmailInCorso(false);
    }
  };

  const confermaCodiceEmail = () => {
    if (!codiceEmailAtteso || Date.now() > codiceScadenzaMs) {
      setErroreEmail('Codice scaduto. Richiedine uno nuovo.');
      return;
    }
    if (codiceEmailInput.trim() === codiceEmailAtteso && codiceEmailAtteso.length === 6) {
      setEmailVerificata(true);
      setCodiceEmailInviato(false);
      setCodiceEmailAtteso('');
      setCodiceScadenzaMs(0);
      setErroreEmail('');
      if (mostraNotifica) {
        mostraNotifica('Email verificata ✓', `${email} confermata.`, 0);
      }
    } else {
      setErroreEmail('Il codice inserito non corrisponde.');
    }
  };

  const passwordValida = password.length >= 6;
  const passwordCoincidono = passwordValida && password === confermaPassword;
  const puoRegistrarsi = Boolean(
    nome.trim() &&
      cognome.trim() &&
      confermaFacolta &&
      emailVerificata &&
      passwordCoincidono
  );

  const inviaRegistrazione = (e) => {
    if (e) e.preventDefault();
    if (!puoRegistrarsi) return;
    const profiloSalvato = {
      ...profilo,
      nome: nome.trim(),
      cognome: cognome.trim(),
      facolta,
      email: email.trim().toLowerCase()
    };
    setProfilo(profiloSalvato);
    onCompletaRegistrazione(profiloSalvato);
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 sm:py-7 safe-top safe-bottom flex flex-col justify-between bg-[#FDFBF7]">
      <div className="text-center space-y-2 pt-1">
        <div className="mx-auto w-24 h-24 rounded-[1.5rem] bg-[#F7F5EE] border border-stone-200/90 shadow-md overflow-hidden">
          <img
            src="Immagine_logo.jpeg"
            alt="IN VEIN"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="pt-0.5 space-y-0.5">
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">
            IN VEIN
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Il percorso per iniziare a donare a Pavia
          </p>
        </div>
      </div>

      <form onSubmit={inviaRegistrazione} className="bg-white p-4 sm:p-5 rounded-[2rem] border border-stone-200/80 shadow-sm space-y-3.5 text-xs my-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <CustomAvatar
              config={avatar}
              size="md"
              felice={true}
              onClick={() => setModaleAvatarAperta(true)}
            />
            <div className="min-w-0">
              <span className="text-xs font-black text-stone-900 block truncate">
                La tua Goccia Mascotte
              </span>
              <span className="text-[11px] text-stone-400 block truncate">
                Personalizza con abiti UniPv
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModaleAvatarAperta(true)}
            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-[11px] font-black transition shrink-0"
          >
            Personalizza
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-bold text-stone-500 mb-1">
              Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Alex"
              className="w-full px-3.5 py-3 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-stone-500 mb-1">
              Cognome
            </label>
            <input
              type="text"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              placeholder="Es. Rossi"
              className="w-full px-3.5 py-3 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500 transition"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-[11px] font-bold text-stone-500 mb-1">
              Macro-Area Dipartimentale UniPv
            </label>
            <select
              value={facolta}
              onChange={(e) => setFacolta(e.target.value)}
              className="w-full px-3.5 py-3 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500 transition"
            >
              {MACRO_DIPARTIMENTI_UNIPV.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <label className={`flex items-start space-x-2.5 p-3 rounded-2xl border cursor-pointer transition ${
            confermaFacolta
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-amber-50/70 border-amber-300'
          }`}>
            <input
              type="checkbox"
              checked={confermaFacolta}
              onChange={(e) => setConfermaFacolta(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500 shrink-0"
              required
            />
            <span className="text-[11px] text-stone-700 leading-snug">
              <strong className="text-stone-900 block">Confermo la mia Macro-Area UniPv</strong>
              Non potrai cambiarla in autonomia dall'app. Per cambi reali di corso scrivi all'assistenza.
            </span>
          </label>
        </div>

        {/* EMAIL CON VERIFICA CODICE AUTOMATICA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-[11px] font-bold text-stone-500">
              Email
            </label>
            {emailVerificata && (
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ✓ Email verificata
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            <input
              type="email"
              value={email}
              onChange={(e) => onCambiaEmail(e.target.value)}
              placeholder="nome.cognome@email.it"
              className="flex-1 min-w-0 px-3.5 py-3 bg-stone-50 border border-stone-200 rounded-2xl font-medium text-stone-800 focus:outline-none focus:bg-white focus:border-rose-500 transition"
              required
            />
            {!emailVerificata && (
              <button
                type="button"
                onClick={inviaCodiceVerificaEmail}
                disabled={invioEmailInCorso || cooldownRinvio > 0}
                className={`px-3.5 py-2 rounded-2xl font-black text-[11px] shrink-0 transition ${
                  invioEmailInCorso || cooldownRinvio > 0
                    ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                    : 'bg-stone-900 hover:bg-stone-800 text-white active:scale-95'
                }`}
              >
                {invioEmailInCorso
                  ? 'Invio...'
                  : cooldownRinvio > 0
                  ? `Rinvia (${cooldownRinvio}s)`
                  : codiceEmailInviato
                  ? 'Rinvia'
                  : 'Invia codice'}
              </button>
            )}
          </div>

          {codiceEmailInviato && !emailVerificata && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2">
              <p className="text-[11px] text-amber-950 leading-snug">
                Abbiamo inviato un codice a 6 cifre a <strong>{email}</strong> (valido 10 minuti). Controlla anche la cartella spam.
              </p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={codiceEmailInput}
                  onChange={(e) => {
                    setCodiceEmailInput(e.target.value.replace(/\D/g, ''));
                    setErroreEmail('');
                  }}
                  placeholder="Codice a 6 cifre"
                  className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs font-black tracking-widest text-stone-900 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={confermaCodiceEmail}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shrink-0"
                >
                  Verifica
                </button>
              </div>
            </div>
          )}

          {erroreEmail && (
            <p className="text-[11px] font-bold text-rose-600 leading-snug">{erroreEmail}</p>
          )}
        </div>

        {/* PASSWORD CON ICONA OCCHIO */}
        <div>
          <label className="block text-[11px] font-bold text-stone-500 mb-1">
            Password (minimo 6 caratteri)
          </label>
          <div className="relative">
            <input
              type={mostraPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Crea una password"
              className="w-full px-3.5 py-3 pr-11 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500 transition"
              required
            />
            <button
              type="button"
              onClick={() => setMostraPassword((v) => !v)}
              aria-label={mostraPassword ? 'Nascondi password' : 'Mostra password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700 transition"
            >
              <IconaOcchio visibile={mostraPassword} />
            </button>
          </div>
          {password.length > 0 && !passwordValida && (
            <p className="text-[11px] font-bold text-amber-700 mt-1">
              Inserisci almeno 6 caratteri.
            </p>
          )}
        </div>

        {/* CONFERMA PASSWORD CON ICONA OCCHIO */}
        <div>
          <label className="block text-[11px] font-bold text-stone-500 mb-1">
            Conferma Password
          </label>
          <div className="relative">
            <input
              type={mostraConfermaPassword ? 'text' : 'password'}
              value={confermaPassword}
              onChange={(e) => setConfermaPassword(e.target.value)}
              placeholder="Ripeti la password"
              className="w-full px-3.5 py-3 pr-11 bg-stone-50 border border-stone-200 rounded-2xl font-bold text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500 transition"
              required
            />
            <button
              type="button"
              onClick={() => setMostraConfermaPassword((v) => !v)}
              aria-label={mostraConfermaPassword ? 'Nascondi conferma password' : 'Mostra conferma password'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700 transition"
            >
              <IconaOcchio visibile={mostraConfermaPassword} />
            </button>
          </div>
          {confermaPassword.length > 0 && password !== confermaPassword && (
            <p className="text-[11px] font-bold text-rose-600 mt-1">
              Le due password non coincidono.
            </p>
          )}
          {confermaPassword.length > 0 && passwordCoincidono && (
            <p className="text-[11px] font-bold text-emerald-700 mt-1">
              ✓ Le password coincidono
            </p>
          )}
        </div>

        <div className="pt-2 space-y-1.5">
          <button
            type="submit"
            disabled={!puoRegistrarsi}
            className={`w-full py-3.5 rounded-2xl font-black text-xs transition ${
              puoRegistrarsi
                ? 'bg-stone-900 hover:bg-stone-800 text-white shadow-lg shadow-stone-900/15 active:scale-95'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Crea Profilo e Inizia →
          </button>
          {!puoRegistrarsi && (
            <p className="text-[10px] text-stone-400 text-center">
              Completa tutti i campi, verifica l'email e conferma la password per iniziare.
            </p>
          )}
        </div>
      </form>

      <p className="text-[11px] text-stone-400 text-center pb-2">
        I progressi restano salvati su questo dispositivo
      </p>
    </div>
  );
}

// ============================================================================
// SCHERMATA 1: HOME (PERCORSO IN 4 FASI FINO A TUTOR, CICLO, IMPOSTAZIONI)
// ============================================================================
function SchermataHome({
  profilo,
  avatar,
  setModaleAvatarAperta,
  passo1Completato,
  passo2Completato,
  passo3Completato,
  visitaVerificataAvis,
  isTutorAttivo,
  setSchedaAttiva,
  apriDiventaTutor,
  timestampDonazione,
  setTimestampDonazione,
  giorniDemoOffset,
  setGiorniDemoOffset,
  tipoCiclo,
  setTipoCiclo,
  donazioneVerificataAvis,
  modalitaSviluppatore,
  onDonazioneVerificata,
  onAvviaSoloTimer,
  apriImpostazioni
}) {
  const [infoCambioCorsoAperta, setInfoCambioCorsoAperta] = useState(false);

  const nomeAreaBreve = profilo.facolta.split('\x28')[0].trim();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full inline-block leading-tight">
                {nomeAreaBreve}
              </span>
              {isTutorAttivo && (
                <span className="text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-block leading-tight">
                  🌟 Tutor Abilitato AVIS
                </span>
              )}
              <button
                onClick={() => setInfoCambioCorsoAperta(!infoCambioCorsoAperta)}
                className="text-[10px] font-bold text-stone-400 hover:text-stone-700 underline transition shrink-0"
              >
                {infoCambioCorsoAperta ? 'Chiudi' : 'Hai cambiato corso?'}
              </button>
            </div>
            <h1 className="text-xl font-black text-stone-900 tracking-tight">
              Ciao, {profilo.nome}!
            </h1>
            <p className="text-xs text-stone-500 leading-snug">
              Il primo passo è una visita conoscitiva con analisi gratuite.
            </p>
          </div>

          <div className="flex flex-col items-center shrink-0">
            <CustomAvatar
              config={avatar}
              size="md"
              felice={passo1Completato || passo3Completato || isTutorAttivo}
              onClick={() => setModaleAvatarAperta(true)}
            />
            <span className="text-[9px] font-black text-rose-600 mt-1 uppercase">
              La tua Goccia
            </span>
          </div>
        </div>

        {infoCambioCorsoAperta && (
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/90 text-[11px] text-stone-600 leading-snug space-y-1">
            <p className="font-black text-stone-900">
              Cambio Macro-Area
            </p>
            <p>
              L'area resta bloccata per mantenere corretta la classifica mensile. Se cambi corso di laurea, contatta l'assistenza con il certificato UniPv aggiornato.
            </p>
          </div>
        )}
      </div>

      {/* PERCORSO CONTINUO IN 4 FASI */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3.5">
        <h2 className="text-sm font-black text-stone-900">
          Il Tuo Percorso
        </h2>

        <div className="relative grid grid-cols-4 gap-1 pt-1">
          <div className="absolute left-7 right-7 top-6 h-1 bg-stone-100 -z-0" />

          <button
            onClick={() => setSchedaAttiva('quiz')}
            className="relative z-10 flex flex-col items-center space-y-1.5"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border-2 transition ${
              passo1Completato
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/25'
            }`}>
              {passo1Completato ? '✓' : '1°'}
            </div>
            <span className="text-[10px] font-black text-stone-800 text-center leading-tight">
              Pre-Quiz
            </span>
          </button>

          <button
            onClick={() => setSchedaAttiva('tutor')}
            className="relative z-10 flex flex-col items-center space-y-1.5"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border-2 transition ${
              passo2Completato
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-white border-stone-300 text-stone-600 hover:border-rose-400'
            }`}>
              {passo2Completato ? '✓' : '2°'}
            </div>
            <span className="text-[10px] font-bold text-stone-600 text-center leading-tight">
              Tutor
            </span>
          </button>

          <button
            onClick={() => setSchedaAttiva('visita')}
            className="relative z-10 flex flex-col items-center space-y-1.5"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border-2 transition ${
              passo3Completato
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-white border-stone-300 text-stone-600 hover:border-rose-400'
            }`}>
              {passo3Completato ? '✓' : '3°'}
            </div>
            <span className="text-[10px] font-bold text-stone-600 text-center leading-tight">
              Visita AVIS
              {visitaVerificataAvis && <span className="block text-[8px] text-emerald-700 font-black">✓ AVIS</span>}
            </span>
          </button>

          <button
            onClick={apriDiventaTutor}
            className="relative z-10 flex flex-col items-center space-y-1.5"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border-2 transition ${
              isTutorAttivo
                ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/25'
                : 'bg-amber-50 border-amber-300 text-amber-800 hover:border-amber-500'
            }`}>
              {isTutorAttivo ? '★' : '4°'}
            </div>
            <span className="text-[10px] font-bold text-amber-800 text-center leading-tight">
              Diventa Tutor
            </span>
          </button>
        </div>

        <button
          onClick={() => {
            if (!passo1Completato) setSchedaAttiva('quiz');
            else if (!passo2Completato) setSchedaAttiva('tutor');
            else if (!passo3Completato) setSchedaAttiva('visita');
            else apriDiventaTutor();
          }}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md shadow-rose-600/20 transition active:scale-95"
        >
          {!passo1Completato
            ? 'Inizia dal Pre-Quiz →'
            : !passo2Completato
            ? 'Scegli un Tutor →'
            : !passo3Completato
            ? 'Richiedi la 1ª Visita AVIS →'
            : isTutorAttivo
            ? 'Apri la Dashboard Tutor →'
            : 'Scopri come diventare Tutor →'}
        </button>
      </div>

      {/* CICLO DI RECUPERO SINCRONIZZATO CON OROLOGIO TELEFONO */}
      <BarraGocciaProgressiva
        timestampDonazione={timestampDonazione}
        setTimestampDonazione={setTimestampDonazione}
        giorniDemoOffset={giorniDemoOffset}
        setGiorniDemoOffset={setGiorniDemoOffset}
        tipoCiclo={tipoCiclo}
        setTipoCiclo={setTipoCiclo}
        donazioneVerificataAvis={donazioneVerificataAvis}
        modalitaSviluppatore={modalitaSviluppatore}
        onDonazioneVerificata={onDonazioneVerificata}
        onAvviaSoloTimer={onAvviaSoloTimer}
      />

      {/* ACCESSO DISCRETO ALLE IMPOSTAZIONI */}
      <button
        type="button"
        onClick={apriImpostazioni}
        className="w-full py-3 px-4 bg-white hover:bg-stone-50 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between text-xs font-bold text-stone-700 transition"
      >
        <span>⚙️ Impostazioni</span>
        <span className="flex items-center space-x-1.5 shrink-0">
          {modalitaSviluppatore && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black">
              DEV ON
            </span>
          )}
          <span className="text-stone-400">Apri →</span>
        </span>
      </button>
    </div>
  );
}

// ============================================================================
// SCHERMATA 2: 1° PASSO — PRE-QUIZ PERSONALE SENZA PUNTI + 12 FAQ COMPLETE
// ============================================================================
function SchermataPreQuiz({
  passo1Completato,
  setPasso1Completato,
  setSchedaAttiva,
  mostraNotifica
}) {
  const [indiceCorrente, setIndiceCorrente] = useState(0);
  const [risposte, setRisposte] = useState({});
  const [tendinaFaqAperta, setTendinaFaqAperta] = useState(false);
  const [faqAperta, setFaqAperta] = useState(null);

  const domandeQuiz = [
    {
      id: 1,
      categoria: '1. Età Anagrafica',
      domanda: 'Hai un\'età compresa tra i 18 e i 60 anni compiuti?',
      rispostaIdonea: 'si',
      commentoSi: 'Rientri nella fascia d\'età prevista da AVIS Pavia per candidarti come nuovo donatore.',
      commentoNo: 'Per iniziare a donare il limite ufficiale è 18-60 anni (dopo i 60 anni decide il medico AVIS).'
    },
    {
      id: 2,
      categoria: '2. Peso Corporeo',
      domanda: 'Il tuo peso corporeo è di almeno 50 kg?',
      rispostaIdonea: 'si',
      commentoSi: 'Almeno 50 kg garantiscono che un eventuale prelievo standard da 450 ml sia sicuro.',
      commentoNo: 'Sotto i 50 kg non si effettuano prelievi di sangue intero per tutelare la tua salute.'
    },
    {
      id: 3,
      categoria: '3. Tatuaggi o Piercing',
      domanda: 'Hai fatto un tatuaggio, un piercing o trucco permanente negli ultimi 4 mesi?',
      rispostaIdonea: 'no',
      commentoSi: 'Dopo un tatuaggio o piercing la normativa prevede 4 mesi di attesa prima del prelievo.',
      commentoNo: 'Nessun tatuaggio o piercing negli ultimi 4 mesi: requisito rispettato.'
    },
    {
      id: 4,
      categoria: '4. Salute Recente',
      domanda: 'Ti senti in buona salute generale e senza febbre o influenza negli ultimi 14 giorni?',
      rispostaIdonea: 'si',
      commentoSi: 'Puoi svolgere sia gli esami preliminari sia il prelievo senza rischi.',
      commentoNo: 'Dopo febbre o infezioni bastano 14 giorni dalla completa guarigione.'
    },
    {
      id: 5,
      categoria: '5. Antibiotici o Cortisonici',
      domanda: 'Hai assunto antibiotici o cortisonici negli ultimi 15 giorni?',
      rispostaIdonea: 'no',
      commentoSi: 'Servono 15 giorni dalla fine della terapia con antibiotici o cortisonici.',
      commentoNo: 'Nessuna attesa necessaria (pillola anticoncezionale e antistaminici sono in genere compatibili).'
    },
    {
      id: 6,
      categoria: '6. Interventi Chirurgici',
      domanda: 'Hai subito interventi chirurgici maggiori o endoscopie (es. gastroscopia) negli ultimi 4 mesi?',
      rispostaIdonea: 'no',
      commentoSi: 'Dopo interventi maggiori o endoscopie sono previsti 4 mesi di sospensione temporanea.',
      commentoNo: 'Nessun impedimento legato a interventi o esami invasivi recenti.'
    },
    {
      id: 7,
      categoria: '7. Cure Odontoiatriche',
      domanda: 'Hai fatto un\'estrazione dentaria o devitalizzazione negli ultimi 7 giorni (o pulizia denti nelle ultime 48 ore)?',
      rispostaIdonea: 'no',
      commentoSi: 'Servono 48 ore dopo la pulizia dei denti oppure 7 giorni dopo estrazioni o devitalizzazioni.',
      commentoNo: 'Nessuna attesa necessaria per cure dentistiche recenti.'
    },
    {
      id: 8,
      categoria: '8. Viaggi Internazionali',
      domanda: 'Hai viaggiato in zone tropicali o a rischio malaria negli ultimi 6 mesi?',
      rispostaIdonea: 'no',
      commentoSi: 'Alcuni viaggi extra-europei prevedono attese da 28 giorni a 6 mesi: segnalalo sempre al medico AVIS.',
      commentoNo: 'I viaggi in Italia e nella maggior parte d\'Europa non comportano sospensioni.'
    },
    {
      id: 9,
      categoria: '9. Antinfiammatori (FANS)',
      domanda: 'Hai assunto aspirina o antinfiammatori (es. ibuprofene, ketoprofene) negli ultimi 5 giorni?',
      rispostaIdonea: 'no',
      commentoSi: 'Aspirina e FANS influenzano temporaneamente le piastrine: basta attendere 5 giorni.',
      commentoNo: 'Nessun antinfiammatorio recente che interferisca con gli esami o con il prelievo.'
    },
    {
      id: 10,
      categoria: '10. Sistema Sanitario Nazionale',
      domanda: 'Hai l\'iscrizione al Sistema Sanitario Nazionale (SSN) con Tessera Sanitaria?',
      rispostaIdonea: 'si',
      commentoSi: 'L\'iscrizione al SSN con tessera sanitaria valida è richiesta su avis.pv.it.',
      commentoNo: 'Per donare in Italia serve l\'iscrizione al SSN (puoi chiedere l\'iscrizione temporanea se sei fuori sede).'
    },
    {
      id: 11,
      categoria: '11. Rapporti a Rischio',
      domanda: 'Hai avuto rapporti sessuali occasionali non protetti negli ultimi 4 mesi?',
      rispostaIdonea: 'no',
      commentoSi: 'In questi casi è previsto un periodo finestra di 4 mesi prima della donazione a tutela di chi riceve.',
      commentoNo: 'Questo requisito di sicurezza è rispettato.'
    },
    {
      id: 12,
      categoria: '12. Gravidanza Recente',
      domanda: 'Sei attualmente in gravidanza oppure hai partorito negli ultimi 6 mesi?',
      rispostaIdonea: 'no',
      commentoSi: 'Durante la gravidanza e nei 6 mesi dopo il parto la donazione resta sospesa per proteggere le riserve di ferro.',
      commentoNo: 'Nessuna sospensione legata a gravidanza recente.'
    },
    {
      id: 13,
      categoria: '13. Vaccinazioni Recenti',
      domanda: 'Hai fatto un vaccino con virus attenuati (es. morbillo, febbre gialla) nelle ultime 4 settimane?',
      rispostaIdonea: 'no',
      commentoSi: 'I vaccini vivi attenuati richiedono 4 settimane di attesa (48 ore invece per i vaccini inattivati, se stai bene).',
      commentoNo: 'Nessuna sospensione legata a vaccinazioni recenti.'
    },
    {
      id: 14,
      categoria: '14. Pressione e Cuore',
      domanda: 'La tua pressione arteriosa è nella norma e non soffri di patologie cardiache importanti?',
      rispostaIdonea: 'si',
      commentoSi: 'Il medico misurerà comunque la pressione e farà l\'elettrocardiogramma gratuito alla Visita di Idoneità.',
      commentoNo: 'In presenza di problemi cardiovascolari o pressione instabile decide il medico AVIS alla visita.'
    },
    {
      id: 15,
      categoria: '15. Stile di Vita e 1ª Visita',
      domanda: 'Conduci uno stile di vita sano (senza uso di droghe) e vuoi prepararti alla 1ª Visita di Idoneità?',
      rispostaIdonea: 'si',
      commentoSi: 'A Pavia il 1° passo è una Visita di Idoneità con colloquio riservato ed esami del sangue gratuiti.',
      commentoNo: 'L\'uso di sostanze stupefacenti non è compatibile con la donazione; per dubbi puoi parlare col medico AVIS.'
    }
  ];

  const domandaAttuale = domandeQuiz[indiceCorrente];
  const rispostaAttuale = risposte[domandaAttuale.id];
  const numeroRisposte = Object.keys(risposte).length;
  const rispostaEIdonea = rispostaAttuale === domandaAttuale.rispostaIdonea;

  const selezionaRisposta = (scelta) => {
    setRisposte((prev) => ({
      ...prev,
      [domandaAttuale.id]: scelta
    }));
  };

  const vaiAvanti = () => {
    if (indiceCorrente < domandeQuiz.length - 1) {
      setIndiceCorrente((prev) => prev + 1);
    } else {
      if (!passo1Completato) {
        setPasso1Completato(true);
        mostraNotifica('Pre-Informativa Completata ✓', 'Ora sai come funziona: scegli un Tutor o invia la richiesta di visita.', 0);
      }
      setSchedaAttiva('tutor');
    }
  };

  const vaiIndietro = () => {
    if (indiceCorrente > 0) {
      setIndiceCorrente((prev) => prev - 1);
    }
  };

  // 12 FAQ COMPLETE SUL PERCORSO AVIS PAVIA E SULLA DONAZIONE
  const listaFaq = [
    {
      q: '1. Come funziona il percorso ufficiale su avis.pv.it/diventare-donatori/?',
      a: 'Prima compili il modulo online (o chiami la sede allo 0382 527963); poi la segreteria AVIS ti richiama per fissare la Visita di Idoneità. Se nessuno ti contatta entro 3 settimane, telefona in segreteria. Le 2 sedi di Pavia (solo su prenotazione) sono: Sede AVIS Via Taramelli 7 (Mer e Sab 08:00–11:30 per sangue intero e idoneità) e Policlinico San Matteo – Padiglione 12 (visite di idoneità Lun–Ven ore 09:00 e 10:00; sangue intero Lun, Mar, Gio, Ven ore 09:00 e 10:00; aferesi/plasma Lun–Ven 08:00/11:00 e Sab 08:00/09:30).'
    },
    {
      q: '2. Perché la prima volta si fa solo la Visita di Idoneità e non subito la donazione?',
      a: 'Per tutelare la tua salute: i medici verificano prima i valori (emocromo, ferro, elettrocardiogramma ed esami completi) prima di fissare la prima donazione.'
    },
    {
      q: '3. Fa male l\'ago? Quanto dura la donazione vera e propria?',
      a: 'Si avverte solo un pizzico iniziale di 2 secondi. Il prelievo dura circa 7-10 minuti, poi ti riposi e ti godi la colazione offerta in sede.'
    },
    {
      q: '4. Cosa posso mangiare a colazione prima della visita o del prelievo?',
      a: 'Una colazione leggera con tè, caffè poco zuccherato, spremuta, fette biscottate o frutta. Evita tassativamente latte, yogurt, burro o cornetti farciti perché alterano i grassi nel sangue.'
    },
    {
      q: '5. Posso donare durante o subito dopo il ciclo mestruale?',
      a: 'Sì, se stai bene e i tuoi livelli di emoglobina e ferritina sono nella norma; il medico valuterà i tuoi esami durante la Visita di Idoneità e potrà consigliarti eventualmente il plasma.'
    },
    {
      q: '6. Che differenza c\'è tra donare sangue intero e donare plasma (plasmaferesi)?',
      a: 'Nel sangue intero si prelevano tutte le componenti: secondo le regole AVIS Pavia l\'intervallo minimo è 90 giorni per uomini e donne in menopausa e 180 giorni (6 mesi) per le donne in età fertile. Dopo una donazione di plasma (plasmaferesi) bastano invece 14 giorni sia per donare altro plasma sia per il sangue intero, mentre da sangue intero a plasma o piastrine servono 30 giorni.'
    },
    {
      q: '7. Prendo la pillola anticoncezionale o antistaminici: posso donare?',
      a: 'Sì! La pillola anticoncezionale e i comuni antistaminici stagionali sono pienamente compatibili con la donazione. Dichiarali comunque al medico durante il colloquio riservato.'
    },
    {
      q: '8. Ho fatto un tatuaggio o un piercing: quanto devo aspettare?',
      a: 'La normativa nazionale prevede 4 mesi di attesa dalla data del tatuaggio o piercing, a tutela del periodo finestra sierologico per il paziente ricevente.'
    },
    {
      q: '9. Ho la pressione bassa o temo di avere capogiri: cosa succede?',
      a: 'Il medico misura la pressione ad ogni visita (valori minimi idonei: 110/60 mmHg). Inoltre con la tecnica AMT (contrarre leggermente le gambe in poltrona) e bevendo acqua prima, eviti capogiri da emozione.'
    },
    {
      q: '10. Riceverò le analisi del sangue complete gratuitamente?',
      a: 'Sì! Sia dopo la Visita di Idoneità sia dopo ogni successiva donazione, AVIS ti invia gratuitamente gli esiti completi (emocromo, ferro, colesterolo, glicemia, fegato, reni).'
    },
    {
      q: '11. Posso fare sport o andare in palestra dopo la donazione?',
      a: 'Il giorno stesso del prelievo è consigliato evitare sforzi fisici intensi o allenamenti pesanti. Dal giorno successivo puoi riprendere regolarmente l\'attività sportiva.'
    },
    {
      q: '12. Ho diritto alla giustificazione universitaria o al giorno di riposo?',
      a: 'L\'art. 8 della Legge 219/2005 garantisce la giornata di riposo retribuita ai lavoratori dipendenti. Per gli studenti universitari oggi non esiste ancora una tutela automatica di legge (ci sono disegni di legge in Senato): chiedi sempre l\'attestato di donazione in sede AVIS e verifica con il tuo corso di laurea o docente per eventuali assenze o esami.'
    }
  ];

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-stone-500 text-center px-2">
        🔒 Le tue risposte non vengono salvate né inviate.
      </p>

      {/* 1. CARD PRE-QUIZ */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-stone-900">
            Pre-Quiz Idoneità
          </h2>
          <span className="text-[11px] font-bold text-stone-400">
            {numeroRisposte} / {domandeQuiz.length}
          </span>
        </div>

        {/* Barra progressiva 15 segmenti (ottimizzata per smartphone) */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            onClick={vaiIndietro}
            disabled={indiceCorrente === 0}
            className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition shrink-0"
          >
            ←
          </button>

          <div className="flex items-center gap-1 flex-1">
            {domandeQuiz.map((d, idx) => {
              const risp = risposte[d.id];
              const isCurrent = idx === indiceCorrente;
              const isOk = risp !== undefined && risp === d.rispostaIdonea;
              return (
                <button
                  key={d.id}
                  onClick={() => setIndiceCorrente(idx)}
                  aria-label={`Domanda ${idx + 1}`}
                  className={`flex-1 h-2 rounded-full transition-all ${
                    isCurrent
                      ? 'bg-stone-900 scale-y-125'
                      : risp === undefined
                      ? 'bg-stone-200'
                      : isOk
                      ? 'bg-emerald-500'
                      : 'bg-rose-500'
                  }`}
                />
              );
            })}
          </div>

          <button
            onClick={() => indiceCorrente < domandeQuiz.length - 1 && setIndiceCorrente((prev) => prev + 1)}
            disabled={indiceCorrente === domandeQuiz.length - 1}
            className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition shrink-0"
          >
            →
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-black text-rose-600 block">
            {domandaAttuale.categoria}
          </span>
          <h3 className="text-base font-black text-stone-900 leading-snug">
            {domandaAttuale.domanda}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => selezionaRisposta('si')}
            className={`py-3.5 px-4 rounded-2xl text-sm font-black border-2 transition ${
              rispostaAttuale === 'si'
                ? domandaAttuale.rispostaIdonea === 'si'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
            }`}
          >
            Sì
          </button>

          <button
            onClick={() => selezionaRisposta('no')}
            className={`py-3.5 px-4 rounded-2xl text-sm font-black border-2 transition ${
              rispostaAttuale === 'no'
                ? domandaAttuale.rispostaIdonea === 'no'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
            }`}
          >
            No
          </button>
        </div>

        {rispostaAttuale && (
          <div className={`p-3.5 rounded-2xl border-2 text-xs leading-relaxed space-y-1 ${
            rispostaEIdonea
              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
              : 'bg-rose-50 border-rose-400 text-rose-950'
          }`}>
            <div className={`font-black ${rispostaEIdonea ? 'text-emerald-800' : 'text-rose-800'}`}>
              {rispostaEIdonea
                ? '✓ Requisito in linea per la Visita di Idoneità'
                : 'ℹ️ Sospensione temporanea o da valutare con il medico'}
            </div>
            <p>{rispostaAttuale === 'si' ? domandaAttuale.commentoSi : domandaAttuale.commentoNo}</p>
          </div>
        )}

        {rispostaAttuale && (
          <button
            onClick={vaiAvanti}
            className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black text-xs transition active:scale-95"
          >
            {indiceCorrente < domandeQuiz.length - 1
              ? `Domanda Successiva (${indiceCorrente + 2} di ${domandeQuiz.length}) →`
              : 'Completa Pre-Quiz e Vai ai Tutor →'}
          </button>
        )}
      </div>

      {/* 2. BOX INFORMATIVO UFFICIALE SOTTO IL QUIZ */}
      <div className="bg-amber-50/90 rounded-3xl p-4 border border-amber-200 text-xs text-amber-950 space-y-1">
        <div className="font-black flex items-center justify-between">
          <span>Solo scopo informativo</span>
          <a
            href="https://avis.pv.it/diventare-donatori/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-rose-700 underline font-black"
          >
            avis.pv.it ↗
          </a>
        </div>
        <p className="text-[11px] text-amber-900/90 leading-snug">
          Questo questionario non sostituisce il parere medico: l'idoneità effettiva viene valutata dal medico AVIS / San Matteo durante la visita.
        </p>
      </div>

      {/* 3. TENDINA UNICA PER TUTTE LE 12 FAQ (PAGINA LEGGERA) */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm overflow-hidden">
        <button
          onClick={() => setTendinaFaqAperta(!tendinaFaqAperta)}
          className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-stone-50 transition"
        >
          <div>
            <h3 className="text-sm font-black text-stone-900">
              Domande frequenti (12)
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              {tendinaFaqAperta
                ? 'Tocca una domanda per aprire la risposta'
                : 'Dubbi comuni su visita, colazione e sedi'}
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-[11px] font-black shrink-0">
            {tendinaFaqAperta ? 'Chiudi ▲' : 'Apri 12 ▼'}
          </span>
        </button>

        {tendinaFaqAperta && (
          <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-stone-100 divide-y divide-stone-100">
            {listaFaq.map((faq, idx) => {
              const aperta = faqAperta === idx;
              return (
                <div key={idx} className="py-3 first:pt-2 last:pb-0">
                  <button
                    onClick={() => setFaqAperta(aperta ? null : idx)}
                    className="w-full text-left flex items-center justify-between space-x-2"
                  >
                    <span className="text-xs font-bold text-stone-800 leading-snug">
                      {faq.q}
                    </span>
                    <span className="text-stone-400 text-xs shrink-0">
                      {aperta ? '▲' : '▼'}
                    </span>
                  </button>
                  {aperta && (
                    <p className="text-xs text-stone-600 leading-relaxed pt-2">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// FINESTRA TUTOR AMPIA E STRUTTURATA (STORIA, PERCORSO PASSO-PASSO, CHAT)
// ============================================================================
function ModaleTutorGrande({
  tutor,
  profilo,
  onClose,
  tutorSceltoId,
  setTutorSceltoId,
  setPasso2Completato,
  setSchedaAttiva,
  mostraNotifica
}) {
  const nomeUtente = profilo?.nome || 'Studente';
  const oraIniziale = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const [messaggi, setMessaggi] = useState([
    {
      id: 1,
      mittente: 'tutor',
      testo: `Ciao ${nomeUtente}, sono ${tutor.nome} (${tutor.area}). Di solito ci sono ${tutor.disponibilita.toLowerCase()}: chiedimi pure qualsiasi dubbio sulla prima visita o mettiamoci d'accordo quando AVIS ti fissa la data.`,
      orario: oraIniziale
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [staScrivendo, setStaScrivendo] = useState(false);
  const replyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, []);

  const generaRispostaTutor = (testoInviato) => {
    const t = testoInviato.toLowerCase();
    const isMarco = tutor.id === 'marco';
    const isGiulia = tutor.id === 'giulia';
    const isElena = tutor.id === 'elena';

    if (t.includes('tatuag') || t.includes('piercing') || t.includes('farmac') || t.includes('antibioti') || t.includes('aspirin') || t.includes('ciclo') || t.includes('pillol') || t.includes('viagg')) {
      return 'Per questi dettagli decide sempre il medico AVIS durante il colloquio riservato. In generale, dopo tatuaggi o piercing servono 4 mesi di attesa, mentre pillola anticoncezionale e antistaminici comuni di solito non creano problemi.';
    }
    if (t.includes('sport') || t.includes('palestra') || t.includes('universit') || t.includes('giustific') || t.includes('lezion') || t.includes('sessione') || (t.includes('esam') && !t.includes('analisi'))) {
      return 'Il giorno della donazione è meglio evitare allenamenti intensi, ma già dal giorno dopo puoi tornare in palestra. Per l\'università chiedi l\'attestato di donazione in sede AVIS e verifica con il tuo corso di laurea o docente per eventuali assenze.';
    }
    if (t.includes('document') || t.includes('portar') || t.includes('tessera') || t.includes('carta') || t.includes('cosa serve')) {
      return 'Porta con te un documento d\'identità valido e la Tessera Sanitaria (iscrizione SSN). Metti una maglietta con maniche comode da tirare su e una bottiglietta d\'acqua.';
    }
    if (t.includes('colazion') || t.includes('mangi') || t.includes('digiun') || t.includes('caff') || t.includes('latte') || t.includes('acqua') || t.includes('bere')) {
      return 'Bevi acqua prima di venire e fai una colazione leggera (tè, caffè poco zuccherato, fette biscottate o frutta). Evita latte, yogurt, burro o brioche farcite perché alterano le analisi; dopo la visita facciamo comunque colazione insieme.';
    }
    if (t.includes('bus') || t.includes('autobus') || t.includes('parchegg') || t.includes('arriv') || t.includes('macchina') || t.includes('auto')) {
      return 'Per Via Taramelli 7 passano le linee 3 e 6 (fermata Taramelli/Cravino) e c\'è il parcheggio gratuito interno per i donatori. Per il San Matteo (Padiglione 12) passano le linee 3, 7 e 8 e il biglietto del multipiano viene convalidato gratis al Centro Trasfusionale.';
    }
    if (t.includes('ogni quanto') || t.includes('intervall') || t.includes('plasma') || t.includes('180') || t.includes('90')) {
      return 'Secondo le regole AVIS Pavia, tra due donazioni di sangue intero passano 90 giorni per uomini e donne in menopausa e 180 giorni per le donne in età fertile. Dopo il plasma invece bastano 14 giorni (sia verso altro plasma sia verso sangue intero), mentre da sangue intero a plasma servono 30 giorni.';
    }
    if (t.includes('prenot') || t.includes('modulo') || t.includes('chiam') || t.includes('richiam') || t.includes('settiman') || t.includes('appuntament')) {
      return 'Prima compili il modulo su avis.pv.it (link nella scheda Visita), poi la segreteria AVIS ti richiama per fissare giorno, ora e sede. Se passano 3 settimane senza chiamata, puoi telefonare allo 0382 527963 (o scrivere al 335 5255989).';
    }
    if (t.includes('sven') || t.includes('ago') || t.includes('paur') || t.includes('ansi') || t.includes('mal') || t.includes('girament')) {
      if (isElena) {
        return `È normale avere un po' di ansia, ${nomeUtente}. Alla prima volta in AVIS fai solo la Visita di Idoneità (colloquio medico, ECG e piccole provette per le analisi), non la sacca intera. Se vuoi proviamo insieme qualche respiro lento prima di entrare.`;
      }
      return `Alla prima visita non ti tolgono la sacca intera, ma solo poche provette per le analisi gratuite dopo il colloquio medico. Il pizzico dura un attimo e, se ti agiti, puoi usare la tecnica AMT per evitare capogiri.`;
    }
    if (t.includes('dove') || t.includes('incontr') || t.includes('trov') || t.includes('quando') || t.includes('orari') || t.includes('giorn') || t.includes('sede') || t.includes('san matteo') || t.includes('taramelli')) {
      if (isMarco) {
        return 'Io vado soprattutto al Policlinico San Matteo (Padiglione 12, ingresso Viale Golgi 19): lì le visite di idoneità sono Lun–Ven alle 09:00 e 10:00 (sangue intero Lun, Mar, Gio, Ven; aferesi Lun–Ven 08:00/11:00 e Sab 08:00/09:30; chiuso Domenica). Se invece scegli Via Taramelli 7 (Mer e Sab 08:00–11:30), posso esserci anche lì.';
      }
      if (isGiulia) {
        return 'Di solito vado in Sede AVIS di Via Taramelli 7 (Mercoledì e Sabato 08:00–11:30), comoda anche col bus 3 dal Cravino. L\'altra sede è il San Matteo al Padiglione 12 (visite Lun–Ven 09:00 e 10:00). Appena AVIS ti dà la data ci organizziamo.';
      }
      return `A Pavia ci sono due sedi (su prenotazione): Via Taramelli 7 (Mercoledì e Sabato 08:00–11:30) e Policlinico San Matteo, Padiglione 12 (visite idoneità Lun–Ven 09:00/10:00; sangue intero Lun, Mar, Gio, Ven 09:00/10:00; plasma anche il Sabato 08:00/09:30). Io ci sono ${tutor.disponibilita.toLowerCase()}.`;
    }
    if (t.includes('tempo') || t.includes('resti') || t.includes('privacy') || t.includes('sola') || t.includes('solo') || t.includes('compagn')) {
      return 'Resto con te finché serve: ci troviamo 10 minuti prima all\'ingresso, facciamo l\'accettazione e ti aspetto in sala d\'attesa mentre parli in privato con il medico. Quando finisci prendiamo un caffè insieme.';
    }
    if (t.includes('dura') || t.includes('quanto ci vuole') || t.includes('minuti') || t.includes('analisi') || t.includes('succede') || t.includes('visita')) {
      return 'La Visita di Idoneità dura circa 30–40 minuti in tutto tra accettazione, questionario, colloquio medico, elettrocardiogramma ed esami del sangue gratuiti. La donazione vera e propria, una volta idonei, dura circa 7–10 minuti.';
    }
    if (t.includes('grazi') || t.includes('perfett') || t.includes('ok') || t.includes('va bene') || t.includes('ci vediamo') || t.includes('ciao')) {
      return `Figurati ${nomeUtente}. Conferma pure la scelta qui sotto e passa alla scheda Visita: scrivimi quando AVIS ti chiama per fissare la data.`;
    }
    return `Io di solito vado presso ${tutor.sedePreferita} (${tutor.disponibilita.toLowerCase()}). Chiedimi pure orari delle sedi, documenti da portare, cosa mangiare a colazione o come funziona la prima visita.`;
  };

  const inviaMessaggio = (testo) => {
    const msg = testo || inputMsg;
    if (!msg.trim()) return;

    setMessaggi((prev) => [
      ...prev,
      {
        id: Date.now(),
        mittente: 'utente',
        testo: msg,
        orario: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setInputMsg('');
    setStaScrivendo(true);

    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    replyTimerRef.current = setTimeout(() => {
      setStaScrivendo(false);
      const risposta = generaRispostaTutor(msg);

      setMessaggi((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          mittente: 'tutor',
          testo: risposta,
          orario: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 600);
  };

  const confermaTutor = () => {
    setTutorSceltoId(tutor.id);
    setPasso2Completato(true);
    mostraNotifica(`${tutor.nome} è il tuo Tutor! 🤝`, 'Accordati in chat appena la segreteria AVIS fissa la tua visita.', 0);
    onClose();
    setSchedaAttiva('visita');
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#FDFBF7] flex flex-col animate-in fade-in duration-150">
      {/* HEADER GRANDE CON TASTO CHIUDI IN ALTO A DESTRA */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 safe-top flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <CustomAvatar config={tutor.avatarConfig} size="sm" felice={true} />
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h3 className="text-sm font-black text-stone-900 truncate">{tutor.nome}, {tutor.eta}</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] font-bold text-emerald-600 shrink-0">Online</span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium truncate">
              {tutor.esperienza}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-black transition shrink-0"
        >
          ✕ Chiudi
        </button>
      </div>

      {/* CORPO SCROLLABILE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* 1. ESPERIENZA */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm space-y-1.5">
          <span className="text-[11px] font-black text-stone-900 block">
            La mia esperienza
          </span>
          <p className="text-xs text-stone-700 leading-relaxed italic">
            "{tutor.storia}"
          </p>
        </div>

        {/* 2. COME FUNZIONA L'INCONTRO */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm space-y-2.5">
          <span className="text-[11px] font-black text-stone-900 block">
            Come funziona l'incontro
          </span>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/70">
              <span className="font-black text-stone-900 block">1. Ritrovo fuori</span>
              <span className="text-stone-500">10 min prima all'ingresso</span>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/70">
              <span className="font-black text-stone-900 block">2. Sala d'attesa</span>
              <span className="text-stone-500">Accettazione insieme</span>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/70">
              <span className="font-black text-stone-900 block">3. Privacy Medica</span>
              <span className="text-stone-500">Colloquio 100% privato</span>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/70">
              <span className="font-black text-stone-900 block">4. Colazione insieme</span>
              <span className="text-stone-500">Caffè e brioche finale</span>
            </div>
          </div>
        </div>

        {/* 3. CHAT DIRETTA */}
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
          <div className="px-3.5 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-black text-stone-700">
            Chat con {tutor.nome}
          </div>

          <div className="p-3 space-y-2.5 min-h-[140px] max-h-[220px] overflow-y-auto bg-[#EFEAE2]/30 text-xs">
            {messaggi.map((m) => (
              <div key={m.id} className={`flex ${m.mittente === 'utente' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl shadow-sm leading-relaxed ${
                  m.mittente === 'utente'
                    ? 'bg-rose-600 text-white rounded-br-none'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-bl-none'
                }`}>
                  <p>{m.testo}</p>
                  <span className={`block text-[9px] mt-1 text-right ${m.mittente === 'utente' ? 'text-rose-100' : 'text-stone-400'}`}>
                    {m.orario} {m.mittente === 'utente' && '✓✓'}
                  </span>
                </div>
              </div>
            ))}
            {staScrivendo && (
              <div className="text-[11px] text-stone-500 italic px-2">
                {tutor.nome} sta scrivendo...
              </div>
            )}
          </div>

          <div className="px-2.5 py-2 bg-white border-t border-stone-100 flex space-x-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <button
              onClick={() => inviaMessaggio('Ho paura dell\'ago e di svenire...')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              😰 Paura dell'ago?
            </button>
            <button
              onClick={() => inviaMessaggio('Resti con me tutto il tempo?')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              🤝 Resti con me?
            </button>
            <button
              onClick={() => inviaMessaggio('Quali sono le sedi e gli orari di AVIS Pavia?')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              📍 Sedi e orari?
            </button>
            <button
              onClick={() => inviaMessaggio('Cosa posso mangiare a colazione prima della visita?')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              🥐 Colazione o digiuno?
            </button>
            <button
              onClick={() => inviaMessaggio('Che documenti devo portare alla visita?')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              🪪 Cosa portare?
            </button>
            <button
              onClick={() => inviaMessaggio('Quanto dura la prima visita di idoneità?')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              ⏱️ Quanto dura?
            </button>
            <button
              onClick={() => inviaMessaggio('Come si prenota sul sito AVIS?')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              📋 Come si prenota?
            </button>
            <button
              onClick={() => inviaMessaggio('Ho fatto un tatuaggio o preso farmaci di recente')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              💉 Tatuaggi / farmaci?
            </button>
          </div>

          <div className="p-2 bg-white border-t border-stone-200 flex space-x-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inviaMessaggio()}
              placeholder={`Scrivi a ${tutor.nome}...`}
              className="flex-1 px-3 py-2 bg-stone-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={() => inviaMessaggio()}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black"
            >
              Invia
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER CON BOTTONE PRINCIPALE */}
      <div className="p-4 safe-bottom bg-white border-t border-stone-200 shrink-0">
        <button
          onClick={confermaTutor}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md shadow-rose-600/20 active:scale-95 transition"
        >
          {tutorSceltoId === tutor.id
            ? `✓ ${tutor.nome} è già il tuo Tutor (Vai alla Visita →)`
            : `Scegli ${tutor.nome} come Tuo Tutor →`}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// CHAT LATO TUTOR: PARLA E ORGANIZZATI CON LO STUDENTE + CODICE SEDE AVIS (+35 PT)
// ============================================================================
function ModaleChatStudenteDaTutor({
  richiesta,
  profilo,
  modalitaSviluppatore,
  onClose,
  onConfermaIncontro
}) {
  const nomeTutor = profilo?.nome || 'Studente';
  const nomeStudenteBreve = richiesta.studente.split(',')[0];

  const oraIniziale = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const [messaggi, setMessaggi] = useState([
    {
      id: 1,
      mittente: 'studente',
      testo: `Ciao ${nomeTutor}, grazie per aver accettato di accompagnarmi. ${richiesta.nota}`,
      orario: oraIniziale
    }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [staScrivendo, setStaScrivendo] = useState(false);
  const [boxCodiceAccAperto, setBoxCodiceAccAperto] = useState(false);
  const [codiceAccInput, setCodiceAccInput] = useState('');
  const [erroreCodiceAcc, setErroreCodiceAcc] = useState('');
  const replyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, []);

  const inviaMessaggio = (testo) => {
    const msg = testo || inputMsg;
    if (!msg.trim()) return;

    setMessaggi((prev) => [
      ...prev,
      {
        id: Date.now(),
        mittente: 'tutor',
        testo: msg,
        orario: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setInputMsg('');
    setStaScrivendo(true);

    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    replyTimerRef.current = setTimeout(() => {
      setStaScrivendo(false);
      const t = msg.toLowerCase();
      let risposta = `Va bene ${nomeTutor}, grazie! Allora ci troviamo ${richiesta.giorno.toLowerCase()} davanti a ${richiesta.sede}.`;
      if (t.includes('document') || t.includes('tesser') || t.includes('carta')) {
        risposta = 'Promemoria salvato: metto subito Carta d\'Identità e Tessera Sanitaria nello zaino.';
      } else if (t.includes('digiun') || t.includes('latt') || t.includes('legger') || t.includes('acqua')) {
        risposta = 'Grazie del consiglio: niente latte o yogurt prima e bevo tanta acqua. Poi dopo facciamo colazione insieme.';
      } else if (t.includes('bus') || t.includes('arriv') || t.includes('fermat') || t.includes('parcheg')) {
        risposta = `Controllo subito la fermata dell'autobus per arrivare in orario davanti a ${richiesta.sede}.`;
      } else if (t.includes('colazion') || t.includes('caff') || t.includes('brioch')) {
        risposta = 'Volentieri, caffè e brioche insieme appena usciamo!';
      } else if (t.includes('10 min') || t.includes('fuori') || t.includes('ingress') || t.includes('troviamo')) {
        risposta = `Sì volentieri, arrivo 10 minuti prima davanti all'ingresso di ${richiesta.sede} così entriamo insieme.`;
      } else if (t.includes('paur') || t.includes('tranquill') || t.includes('colloqui') || t.includes('analisi') || t.includes('ago')) {
        risposta = 'Mi tranquillizza molto sapere che alla prima volta ci sono solo il colloquio riservato e le analisi e che mi aspetti in sala d\'attesa.';
      } else if (t.includes('conferm') || t.includes('orari') || t.includes('ci vediamo') || t.includes('ok')) {
        risposta = `Confermato per ${richiesta.giorno.toLowerCase()} a ${richiesta.sede}. Ci scriviamo qui se ci sono imprevisti.`;
      }

      setMessaggi((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          mittente: 'studente',
          testo: risposta,
          orario: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 600);
  };

  const verificaCodiceAccompagnamento = (e) => {
    if (e) e.preventDefault();
    if (!validaCodiceAvis('accompagnamento', codiceAccInput)) {
      setErroreCodiceAcc('Codice non valido. Chiedi il codice di conferma accompagnamento in sede AVIS.');
      return;
    }
    setErroreCodiceAcc('');
    setBoxCodiceAccAperto(false);
    setCodiceAccInput('');
    onConfermaIncontro(richiesta.id);
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#FDFBF7] flex flex-col animate-in fade-in duration-150">
      {/* HEADER CHAT STUDENTE */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 safe-top flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <CustomAvatar config={richiesta.avatarConfig} size="sm" felice={true} />
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h3 className="text-sm font-black text-stone-900 truncate">{richiesta.studente}</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px] font-bold text-emerald-600 shrink-0">Online</span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium truncate">
              {richiesta.area}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-black transition shrink-0"
        >
          ✕ Chiudi
        </button>
      </div>

      {/* CORPO CHAT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-sm text-xs space-y-1">
          <div className="font-black text-stone-900">Dettagli richiesta</div>
          <p className="text-[11px] text-stone-600">📍 <strong>{richiesta.sede}</strong> · {richiesta.giorno}</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
          <div className="px-3.5 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-black text-stone-700">
            Chat con {nomeStudenteBreve}
          </div>

          <div className="p-3 space-y-2.5 min-h-[180px] max-h-[260px] overflow-y-auto bg-[#EFEAE2]/30 text-xs">
            {messaggi.map((m) => (
              <div key={m.id} className={`flex ${m.mittente === 'tutor' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl shadow-sm leading-relaxed ${
                  m.mittente === 'tutor'
                    ? 'bg-rose-600 text-white rounded-br-none'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-bl-none'
                }`}>
                  <p>{m.testo}</p>
                  <span className={`block text-[9px] mt-1 text-right ${m.mittente === 'tutor' ? 'text-rose-100' : 'text-stone-400'}`}>
                    {m.orario} {m.mittente === 'tutor' && '✓✓'}
                  </span>
                </div>
              </div>
            ))}
            {staScrivendo && (
              <div className="text-[11px] text-stone-500 italic px-2">
                {nomeStudenteBreve} sta scrivendo...
              </div>
            )}
          </div>

          <div className="px-2.5 py-2 bg-white border-t border-stone-100 flex space-x-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <button
              onClick={() => inviaMessaggio('Ci troviamo 10 minuti prima davanti all\'ingresso?')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              📍 Ritrovo 10 min prima
            </button>
            <button
              onClick={() => inviaMessaggio('Niente paura: alla 1ª visita fai solo colloquio e piccole analisi!')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              😌 Rassicura su 1ª visita
            </button>
            <button
              onClick={() => inviaMessaggio('Ricorda di portare documento d\'identità e tessera sanitaria!')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              🪪 Documenti
            </button>
            <button
              onClick={() => inviaMessaggio('Bevi tanta acqua ed evita latte o yogurt prima della visita!')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              🥐 Colazione/digiuno
            </button>
            <button
              onClick={() => inviaMessaggio('Se vieni in bus ti spiego a quale fermata scendere!')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              🚌 Come arrivare
            </button>
            <button
              onClick={() => inviaMessaggio('Appena esci andiamo a fare colazione insieme!')}
              className="shrink-0 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full font-bold"
            >
              ☕ Colazione dopo
            </button>
          </div>

          <div className="p-2 bg-white border-t border-stone-200 flex space-x-2">
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && inviaMessaggio()}
              placeholder={`Scrivi a ${nomeStudenteBreve}...`}
              className="flex-1 px-3 py-2 bg-stone-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              onClick={() => inviaMessaggio()}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black"
            >
              Invia
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER CONFERMA ACCOMPAGNAMENTO CON CODICE SEDE AVIS */}
      <div className="p-4 safe-bottom bg-white border-t border-stone-200 shrink-0">
        {richiesta.completata ? (
          <div className="w-full py-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-center text-xs font-black">
            ✓ Accompagnamento verificato in sede AVIS (+35 pt accreditati)
          </div>
        ) : !boxCodiceAccAperto ? (
          <button
            onClick={() => {
              setBoxCodiceAccAperto(true);
              setErroreCodiceAcc('');
            }}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition"
          >
            ✓ Conferma con Codice Sede AVIS (+35 pt)
          </button>
        ) : (
          <form onSubmit={verificaCodiceAccompagnamento} className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-stone-900">
                Codice Sede AVIS{modalitaSviluppatore ? ' ([DEV] AVIS-ACC-PV)' : ''}
              </span>
              <button
                type="button"
                onClick={() => setBoxCodiceAccAperto(false)}
                className="text-[11px] font-bold text-stone-500"
              >
                Annulla
              </button>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={codiceAccInput}
                onChange={(e) => {
                  setCodiceAccInput(e.target.value);
                  setErroreCodiceAcc('');
                }}
                placeholder="Codice accompagnamento"
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-xs font-bold uppercase focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs"
              >
                Verifica
              </button>
            </div>
            {erroreCodiceAcc && (
              <p className="text-[11px] font-bold text-rose-700">{erroreCodiceAcc}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SCHERMATA 3: HUB TUTOR & DIVENTA TUTOR (ABILITAZIONE AVIS + GUIDA)
// ============================================================================
function SchermataTutor({
  passo1Completato,
  passo2Completato,
  setPasso2Completato,
  setSchedaAttiva,
  mostraNotifica,
  tutorTabAttiva,
  setTutorTabAttiva,
  tutorSceltoId,
  setTutorSceltoId,
  fraseTutor,
  setFraseTutor,
  disponibileTutor,
  setDisponibileTutor,
  richiesteTutor,
  setRichiesteTutor,
  donazioneVerificataAvis,
  guidaTutorAccettata,
  setGuidaTutorAccettata,
  tutorAbilitatoAvis,
  onVerificaCodiceTutor,
  isTutorAttivo,
  setIsTutorAttivo,
  profilo,
  avatar,
  aggiungiGocce,
  registraAttivitaSettimanale,
  modalitaSviluppatore,
  onSimulaRequisitiTutor,
  onSimulaTutorAttivo,
  onRipristinaTestTutor
}) {
  const [tutorSelezionato, setTutorSelezionato] = useState(null);
  const [richiestaInChatId, setRichiestaInChatId] = useState(null);
  const [devPanelAperto, setDevPanelAperto] = useState(false);
  const [codiceTutorInput, setCodiceTutorInput] = useState('');
  const [erroreCodiceTutor, setErroreCodiceTutor] = useState('');

  const listaTutor = [
    {
      id: 'luca',
      nome: 'Luca B.',
      eta: 22,
      area: 'Area Umanistica e Psicologica',
      sedePreferita: 'AVIS Pavia (Via Taramelli 7)',
      esperienza: '14 studenti accompagnati · Donatore da 3 anni',
      disponibilita: 'Mercoledì e Sabato mattina (08:00–11:30)',
      badge: '🤝 Supporto 1ª volta · Caffè prima',
      storia: 'Alla mia prima volta temevo tantissimo l\'ago! Ho scoperto che guardando altrove e parlando con un amico non si sente quasi nulla.',
      avatarConfig: { coloreGoccia: 'rubino', abbigliamento: 'felpa_cappuccio_bordeaux', copricapo: 'cappellino_baseball_unipv', oggettoStudio: 'mug_unipv', espressione: 'sorridente' }
    },
    {
      id: 'elena',
      nome: 'Elena M.',
      eta: 21,
      area: 'Area Umanistica e Psicologica',
      sedePreferita: 'AVIS Pavia o Policlinico San Matteo',
      esperienza: '11 studenti accompagnati · Donatrice da 2 anni',
      disponibilita: 'Martedì, Mercoledì e Venerdì mattina',
      badge: '🌟 Gestione ansia & prima visita',
      storia: 'Studio Psicologia a Pavia: alla Visita di Idoneità mi avevano spiegato tutto con calma. Ti insegno una tecnica di respirazione per zero ansia!',
      avatarConfig: { coloreGoccia: 'corallo', abbigliamento: 'sciarpa_unipv', copricapo: 'cappellino_navy_unipv', oggettoStudio: 'cancelleria_unipv', espressione: 'entusiasta' }
    },
    {
      id: 'marco',
      nome: 'Marco V.',
      eta: 24,
      area: 'Area Medica e Sanitaria',
      sedePreferita: 'Policlinico San Matteo (Padiglione 12)',
      esperienza: '22 studenti accompagnati · Volontario AVIS',
      disponibilita: 'Dal Lunedì al Venerdì mattina al San Matteo',
      badge: '🏥 San Matteo & Via Taramelli',
      storia: 'Frequento i reparti del San Matteo: ti spiego ogni fase prima che avvenga, così sai esattamente cosa aspettarti senza alcuna sorpresa.',
      avatarConfig: { coloreGoccia: 'amarena', abbigliamento: 'polo_unipv_bordeaux', copricapo: 'feluca_rossa', oggettoStudio: 'borraccia_unipv', visoAccessorio: 'occhiali_studio', espressione: 'sorridente' }
    },
    {
      id: 'giulia',
      nome: 'Giulia T.',
      eta: 22,
      area: 'Area Ingegneria e Architettura',
      sedePreferita: 'AVIS Pavia (Via Taramelli 7)',
      esperienza: '9 studenti accompagnati · Donatrice da 2 anni',
      disponibilita: 'Mercoledì e Sabato mattina (bus 3 dal Cravino)',
      badge: '☕ Compagnia & Caffè insieme',
      storia: 'Prendiamo il bus 3 insieme dal Cravino fino a Via Taramelli 7, ti faccio compagnia e poi ci premiamo con cappuccino e brioche!',
      avatarConfig: { coloreGoccia: 'plasma', abbigliamento: 'giacca_unipv_college', copricapo: 'feluca_blu', oggettoStudio: 'shopper_unipv', espressione: 'occhietto' }
    }
  ];

  const reqDonazione = donazioneVerificataAvis === true;
  const reqGuidaQuiz = passo1Completato && guidaTutorAccettata;
  const reqCodiceAvis = tutorAbilitatoAvis === true;
  const requisitiSoddisfatti = (reqDonazione ? 1 : 0) + (reqGuidaQuiz ? 1 : 0) + (reqCodiceAvis ? 1 : 0);
  const prontoPerTutor = requisitiSoddisfatti === 3;

  const studentiAccompagnati = richiesteTutor.filter((r) => r.completata).length;

  const verificaCodiceAbilitazioneTutor = (e) => {
    if (e) e.preventDefault();
    if (!validaCodiceAvis('tutor', codiceTutorInput)) {
      setErroreCodiceTutor('Codice non valido. Chiedi il codice di abilitazione Tutor alla segreteria AVIS Pavia.');
      return;
    }
    setErroreCodiceTutor('');
    setCodiceTutorInput('');
    if (onVerificaCodiceTutor) {
      onVerificaCodiceTutor();
    }
  };

  const attivaProfiloTutor = () => {
    if (!prontoPerTutor) {
      mostraNotifica(
        'Requisiti mancanti',
        `Hai completato ${requisitiSoddisfatti}/3 requisiti verificati per diventare Tutor IN VEIN.`,
        0
      );
      return;
    }
    setIsTutorAttivo(true);
    mostraNotifica(
      'Ti diamo il benvenuto tra i Tutor IN VEIN! 🌟',
      'La tua Dashboard Tutor Abilitato AVIS è ora attiva.',
      0
    );
  };

  const accettaEApriChat = (reqId) => {
    setRichiesteTutor((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, accettata: true } : r))
    );
    setRichiestaInChatId(reqId);
  };

  const confermaAccompagnamento = (reqId) => {
    const target = richiesteTutor.find((r) => r.id === reqId);
    if (!target || target.completata) return;
    setRichiesteTutor((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, accettata: true, completata: true } : r))
    );
    if (aggiungiGocce) {
      aggiungiGocce(35);
    }
    if (registraAttivitaSettimanale) {
      registraAttivitaSettimanale();
    }
    mostraNotifica(
      'Accompagnamento Verificato AVIS! 🤝',
      `Hai accompagnato ${target.studente.split(',')[0]}: +35 pt per te e la tua Macro-Area!`,
      35
    );
  };

  const richiestaInChat = richiesteTutor.find((r) => r.id === richiestaInChatId) || null;

  return (
    <div className="space-y-4">
      {/* SWITCHER MOBILE PULITO: TROVA UN TUTOR / DIVENTA TUTOR */}
      <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-bold">
        <button
          onClick={() => setTutorTabAttiva('trova')}
          className={`flex-1 py-2.5 rounded-xl transition ${
            tutorTabAttiva === 'trova' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
          }`}
        >
          🤝 Trova un Tutor
        </button>
        <button
          onClick={() => setTutorTabAttiva('diventa')}
          className={`flex-1 py-2.5 rounded-xl transition ${
            tutorTabAttiva === 'diventa' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
          }`}
        >
          🌟 Diventa Tutor
        </button>
      </div>

      {tutorTabAttiva === 'trova' ? (
        <div className="space-y-3.5">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-1.5">
            <h2 className="text-base font-black text-stone-900">
              Hai timore della prima volta? Non andare senza compagnia!
            </h2>
            <p className="text-xs text-stone-500 leading-snug">
              I Tutor volontari abilitati da AVIS Pavia ti accolgono fuori dalla sede e ti accompagnano per tutto il percorso. Scegli chi preferisci per chattare.
            </p>
          </div>

          {/* CARD TUTOR GENERALI */}
          <div className="space-y-3">
            {listaTutor.map((t) => {
              const isScelto = tutorSceltoId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTutorSelezionato(t)}
                  className={`bg-white p-4 rounded-3xl border shadow-sm cursor-pointer transition space-y-3 active:scale-[0.99] ${
                    isScelto ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-stone-200/90 hover:border-rose-400'
                  }`}
                >
                  <div className="flex items-start justify-between space-x-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <CustomAvatar config={t.avatarConfig} size="md" felice={isScelto} />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h3 className="text-sm font-black text-stone-900 truncate">{t.nome}, {t.eta} anni</h3>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        </div>
                        <p className="text-[11px] font-bold text-rose-600 leading-tight">{t.area}</p>
                        <p className="text-[10px] text-stone-500 font-semibold">{t.esperienza}</p>
                      </div>
                    </div>
                    {isScelto && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black shrink-0">
                        Scelto ✓
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 text-[11px]">
                    <span className="font-bold text-stone-700 bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200/80 truncate">
                      {t.badge}
                    </span>
                    <span className="font-black text-rose-600 shrink-0">
                      Apri & Chatta →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RICHIAMO CONTINUITÀ IN FONDO */}
          <button
            onClick={() => setTutorTabAttiva('diventa')}
            className="w-full text-left bg-amber-50/80 hover:bg-amber-100/80 p-4 rounded-3xl border border-amber-200 flex items-center justify-between gap-3 transition"
          >
            <div className="space-y-0.5">
              <span className="text-xs font-black text-amber-950 block">
                🌟 Vuoi diventare Tutor dopo la 1ª donazione?
              </span>
              <span className="text-[11px] text-amber-800 block leading-snug">
                Aiuta i prossimi studenti UniPv: scopri la guida e l'abilitazione con AVIS Pavia.
              </span>
            </div>
            <span className="text-xs font-black text-amber-900 shrink-0">Scopri →</span>
          </button>
        </div>
      ) : (
        /* VISTA DEDICATA: DIVENTA TUTOR (VERIFICA REALE AVIS + GUIDA + DASHBOARD ATTIVA) */
        <div className="space-y-3.5">
          {/* 1. RUOLO E REGOLE DEL TUTOR IN UN'UNICA CARD CHIARA */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3">
            <div>
              <h2 className="text-base font-black text-stone-900">
                Come funziona e regole del Tutor
              </h2>
              <p className="text-xs text-stone-600 leading-snug mt-0.5">
                Il ruolo si sblocca solo con <strong>donazione verificata e abilitazione AVIS</strong> (non coi punti dei giochi). Ad ogni accompagnamento confermato in sede ricevi <strong>+35 pt</strong>.
              </p>
            </div>

            <ul className="space-y-1.5 text-[11px] text-stone-700 bg-stone-50 p-3 rounded-2xl border border-stone-200/80 leading-snug">
              <li><strong>1. Puntualità:</strong> arriva 10 minuti prima all'ingresso (Via Taramelli 7 o San Matteo) e fai colazione dopo insieme allo studente.</li>
              <li><strong>2. Nessuna pressione:</strong> accogli con calma e rispetta sempre se chi accompagni ha dubbi o vuole rimandare.</li>
              <li><strong>3. Zero pareri medici:</strong> le domande sanitarie spettano solo ai medici AVIS durante il colloquio.</li>
              <li><strong>4. Privacy:</strong> resta in sala d'attesa durante la visita e non chiedere né condividere dati personali o clinici.</li>
              <li><strong>5. Segreteria:</strong> per ogni imprevisto contatta AVIS Pavia allo 0382 527963.</li>
            </ul>

            <label className={`flex items-start space-x-2.5 p-2.5 rounded-2xl border cursor-pointer transition text-[11px] ${
              guidaTutorAccettata ? 'bg-emerald-50/70 border-emerald-300' : 'bg-stone-50 border-stone-200'
            }`}>
              <input
                type="checkbox"
                checked={guidaTutorAccettata}
                onChange={(e) => setGuidaTutorAccettata(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500 shrink-0"
              />
              <span className="font-bold text-stone-800 leading-snug">
                Ho letto le regole e mi impegno a rispettarle durante gli accompagnamenti.
              </span>
            </label>
          </div>

          {/* 3. SE NON ANCORA ATTIVO: I 3 REQUISITI VERIFICATI + CANDIDATURA */}
          {!isTutorAttivo ? (
            <>
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-stone-900">
                    I 3 Requisiti per sbloccare il ruolo
                  </h3>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                    prontoPerTutor ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {requisitiSoddisfatti} / 3 verificati
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Requisito 1: 1ª Donazione verificata da AVIS */}
                  <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                    reqDonazione ? 'bg-emerald-50/70 border-emerald-200' : 'bg-stone-50 border-stone-200'
                  }`}>
                    <div className="min-w-0">
                      <span className="font-black text-stone-900 block">
                        {reqDonazione ? '✓' : '1.'} 1ª Donazione verificata da AVIS
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {reqDonazione
                          ? 'Confermata con codice sede AVIS!'
                          : 'Inserisci in Home il codice consegnato dopo la donazione'}
                      </span>
                    </div>
                    {!reqDonazione && (
                      <button
                        onClick={() => setSchedaAttiva('home')}
                        className="px-2.5 py-1.5 bg-white border border-stone-300 text-stone-800 rounded-xl text-[10px] font-black shrink-0"
                      >
                        Home →
                      </button>
                    )}
                  </div>

                  {/* Requisito 2: Pre-Quiz 15/15 + Guida accettata */}
                  <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                    reqGuidaQuiz ? 'bg-emerald-50/70 border-emerald-200' : 'bg-stone-50 border-stone-200'
                  }`}>
                    <div className="min-w-0">
                      <span className="font-black text-stone-900 block">
                        {reqGuidaQuiz ? '✓' : '2.'} Pre-Quiz + Guida Comportamento
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {reqGuidaQuiz
                          ? 'Pre-Quiz completato e guida accettata!'
                          : !passo1Completato
                          ? 'Completa il Pre-Quiz e spunta la guida qui sopra'
                          : 'Spunta l\'impegno nella Guida qui sopra'}
                      </span>
                    </div>
                    {!passo1Completato && (
                      <button
                        onClick={() => setSchedaAttiva('quiz')}
                        className="px-2.5 py-1.5 bg-white border border-stone-300 text-stone-800 rounded-xl text-[10px] font-black shrink-0"
                      >
                        Quiz →
                      </button>
                    )}
                  </div>

                  {/* Requisito 3: Codice Abilitazione AVIS Pavia */}
                  <div className={`p-3 rounded-2xl border space-y-2 ${
                    reqCodiceAvis ? 'bg-emerald-50/70 border-emerald-200' : 'bg-stone-50 border-stone-200'
                  }`}>
                    <div className="min-w-0">
                      <span className="font-black text-stone-900 block">
                        {reqCodiceAvis ? '✓' : '3.'} Codice Abilitazione Segreteria AVIS
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        {reqCodiceAvis
                          ? 'Abilitazione confermata da AVIS Pavia!'
                          : 'Rilasciato dopo il breve orientamento con i referenti AVIS'}
                      </span>
                    </div>

                    {!reqCodiceAvis && (
                      <form onSubmit={verificaCodiceAbilitazioneTutor} className="space-y-1.5">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={codiceTutorInput}
                            onChange={(e) => {
                              setCodiceTutorInput(e.target.value);
                              setErroreCodiceTutor('');
                            }}
                            placeholder="Codice Tutor AVIS"
                            className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs font-bold uppercase focus:outline-none focus:border-rose-500"
                          />
                          <button
                            type="submit"
                            className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-[11px] font-black shrink-0"
                          >
                            Verifica
                          </button>
                        </div>
                        {erroreCodiceTutor && (
                          <p className="text-[11px] font-bold text-rose-700">{erroreCodiceTutor}</p>
                        )}
                      </form>
                    )}
                  </div>
                </div>
              </div>

              <div className={`rounded-3xl p-4 sm:p-5 border shadow-sm space-y-3 text-xs ${
                prontoPerTutor ? 'bg-amber-50/80 border-amber-300' : 'bg-white border-stone-200/80'
              }`}>
                {prontoPerTutor && (
                  <div className="p-2.5 bg-emerald-100/80 border border-emerald-300 rounded-xl text-[11px] font-black text-emerald-900">
                    🎉 Tutti e 3 i requisiti verificati sono completati! Ora puoi attivare il tuo profilo Tutor.
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 mb-1.5">
                    La tua frase di presentazione per i nuovi studenti:
                  </label>
                  <textarea
                    rows="2"
                    value={fraseTutor}
                    onChange={(e) => setFraseTutor(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs text-stone-800 focus:outline-none focus:border-rose-500 transition"
                  />
                </div>
                <button
                  onClick={attivaProfiloTutor}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs transition ${
                    prontoPerTutor
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 active:scale-95'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {prontoPerTutor
                    ? '🌟 Attiva il mio Profilo Tutor IN VEIN'
                    : `Completa le verifiche per candidarti (${requisitiSoddisfatti}/3)`}
                </button>
              </div>
            </>
          ) : (
            /* 4. DASHBOARD TUTOR ATTIVA (ABILITATO AVIS) */
            <div className="space-y-3.5">
              <div className="bg-emerald-50 rounded-3xl p-4 sm:p-5 border-2 border-emerald-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-3 min-w-0">
                    <CustomAvatar config={avatar} size="md" felice={true} />
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-md inline-block">
                        🌟 Tutor Abilitato AVIS Attivo
                      </span>
                      <h3 className="text-sm font-black text-emerald-950 mt-0.5 truncate">
                        {profilo.nome} {profilo.cognome}
                      </h3>
                      <p className="text-[11px] text-emerald-800 font-semibold truncate">
                        {profilo.facolta.split('\x28')[0].trim()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDisponibileTutor(!disponibileTutor)}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border shrink-0 transition ${
                      disponibileTutor
                        ? 'bg-white border-emerald-400 text-emerald-800'
                        : 'bg-stone-200 border-stone-300 text-stone-600'
                    }`}
                  >
                    {disponibileTutor ? '🟢 Disponibile' : '⏸️ In pausa'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white/90 p-2.5 rounded-2xl border border-emerald-200">
                    <span className="text-lg font-black text-emerald-900 block">{studentiAccompagnati}</span>
                    <span className="text-[10px] font-bold text-emerald-700">Studenti accompagnati</span>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-2xl border border-emerald-200">
                    <span className="text-lg font-black text-rose-600 block">+{studentiAccompagnati * 35} pt</span>
                    <span className="text-[10px] font-bold text-stone-600">Bonus Macro-Area</span>
                  </div>
                </div>

                <p className="text-xs text-emerald-900 bg-white/80 p-3 rounded-2xl border border-emerald-200 italic leading-snug">
                  "{fraseTutor}"
                </p>
              </div>

              {/* RICHIESTE STUDENTI IN ARRIVO */}
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-stone-900">
                    Richieste di Accompagnamento
                  </h3>
                  <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    {richiesteTutor.filter((r) => !r.completata).length} in attesa
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {richiesteTutor.map((req) => (
                    <div
                      key={req.id}
                      className={`p-3.5 rounded-2xl border space-y-2.5 ${
                        req.completata
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : req.accettata
                          ? 'bg-amber-50/70 border-amber-300'
                          : 'bg-stone-50 border-stone-200/90'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <CustomAvatar config={req.avatarConfig} size="xs" felice={req.completata} />
                          <div className="min-w-0">
                            <div className="font-black text-stone-900 truncate">{req.studente}</div>
                            <div className="text-[10px] font-bold text-rose-600 truncate">{req.area}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-stone-500 shrink-0">{req.giorno}</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-snug">
                        📍 <strong>{req.sede}</strong> — "{req.nota}"
                      </p>
                      <button
                        onClick={() => accettaEApriChat(req.id)}
                        className={`w-full py-2.5 rounded-xl text-[11px] font-black transition active:scale-95 ${
                          req.completata
                            ? 'bg-emerald-600 text-white'
                            : req.accettata
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-stone-900 hover:bg-stone-800 text-white'
                        }`}
                      >
                        {req.completata
                          ? '✓ Accompagnamento verificato (+35 pt) · Apri Chat'
                          : req.accettata
                          ? `💬 Apri Chat con ${req.studente.split(',')[0]} →`
                          : `💬 Accetta & Apri Chat con ${req.studente.split(',')[0]} →`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. PANNELLO SVILUPPATORE VISIBILE SOLO QUANDO MODALITÀ SVILUPPATORE È ON */}
          {modalitaSviluppatore && (
            <div className="bg-stone-900 text-white rounded-3xl overflow-hidden shadow-sm">
              <button
                onClick={() => setDevPanelAperto(!devPanelAperto)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-black"
              >
                <span>🛠️ [DEV] Test Abilitazione Tutor AVIS</span>
                <span className="text-stone-400 text-[11px]">{devPanelAperto ? '▲ Chiudi' : '▼ Apri'}</span>
              </button>

              {devPanelAperto && (
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-stone-800 text-[11px]">
                  <p className="text-stone-300 leading-snug">
                    Codici di prova AVIS: Abilitazione Tutor <span className="font-mono font-bold text-amber-300">AVIS-TUTOR-PV</span> · Accompagnamento <span className="font-mono font-bold text-emerald-300">AVIS-ACC-PV</span>.
                  </p>
                  <button
                    onClick={onSimulaRequisitiTutor}
                    className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl font-black transition text-left"
                  >
                    ⚡ 1. Simula 3/3 Verifiche AVIS pronte
                  </button>
                  <button
                    onClick={onSimulaTutorAttivo}
                    className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-stone-950 rounded-xl font-black transition text-left"
                  >
                    🌟 2. Salta a Dashboard Tutor Abilitato Attivo
                  </button>
                  <button
                    onClick={() => {
                      setRichiesteTutor((prev) => prev.map((r) => ({ ...r, accettata: false, completata: false })));
                      setRichiestaInChatId(null);
                      if (onRipristinaTestTutor) onRipristinaTestTutor();
                    }}
                    className="w-full py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl font-bold transition text-left"
                  >
                    ↺ Ripristina stato iniziale (Neofita · 45 pt)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tutorSelezionato && (
        <ModaleTutorGrande
          tutor={tutorSelezionato}
          profilo={profilo}
          onClose={() => setTutorSelezionato(null)}
          tutorSceltoId={tutorSceltoId}
          setTutorSceltoId={setTutorSceltoId}
          setPasso2Completato={setPasso2Completato}
          setSchedaAttiva={setSchedaAttiva}
          mostraNotifica={mostraNotifica}
        />
      )}

      {richiestaInChat && (
        <ModaleChatStudenteDaTutor
          richiesta={richiestaInChat}
          profilo={profilo}
          modalitaSviluppatore={modalitaSviluppatore}
          onClose={() => setRichiestaInChatId(null)}
          onConfermaIncontro={confermaAccompagnamento}
        />
      )}
    </div>
  );
}

// ============================================================================
// SCHERMATA 4A: 3° PASSO — RICHIESTA 1ª VISITA DI IDONEITÀ SU AVIS.PV.IT
// ============================================================================
function SchermataPrenotaVisita({
  passo3Completato,
  visitaVerificataAvis,
  dataRichiestaVisita,
  sedePreferitaVisita,
  setSedePreferitaVisita,
  fasciaPreferitaVisita,
  setFasciaPreferitaVisita,
  modalitaSviluppatore,
  setSchedaAttiva,
  mostraNotifica,
  onRichiestaVisitaInviata,
  onVisitaVerificataAvis
}) {
  const [moduloAvisAperto, setModuloAvisAperto] = useState(false);
  const [mostraVisitaDettagli, setMostraVisitaDettagli] = useState(false);
  const [mostraAmt, setMostraAmt] = useState(false);
  const [avvisoCalendarioAperto, setAvvisoCalendarioAperto] = useState(false);
  const [codiceVisitaInput, setCodiceVisitaInput] = useState('');
  const [erroreCodiceVisita, setErroreCodiceVisita] = useState('');

  const sediBrevi = [
    { id: 'avis_pavia', nome: 'AVIS Pavia (Via Taramelli 7)', indirizzo: 'Via Taramelli 7, 27100 Pavia PV' },
    { id: 'san_matteo', nome: 'San Matteo SIMT (Pad. 12)', indirizzo: 'Viale Camillo Golgi 19 (Padiglione 12), 27100 Pavia PV' }
  ];

  const opzioniFascia =
    sedePreferitaVisita === 'san_matteo'
      ? ['Lun–Ven (09:00 / 10:00)', 'Sabato (aferesi)', 'Flessibile']
      : ['Mercoledì mattina', 'Sabato mattina', 'Flessibile'];

  const fasciaCorrenteValida = opzioniFascia.includes(fasciaPreferitaVisita)
    ? fasciaPreferitaVisita
    : opzioniFascia[0];

  const sedeObj = sediBrevi.find((s) => s.id === sedePreferitaVisita) || sediBrevi[0];
  const sedeSceltaNome = sedeObj.nome;
  const promemoria3Sett = calcolaDataTraGiorni(21, dataRichiestaVisita);
  const dtStart = `${promemoria3Sett.isoCompatta}T093000`;
  const dtEnd = `${promemoria3Sett.isoCompatta}T094500`;

  const scaricaPromemoriaCalendario = () => {
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//IN VEIN Pavia//Promemoria AVIS//IT',
      'BEGIN:VEVENT',
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      'SUMMARY:Controllo richiesta AVIS Pavia: se non ti hanno chiamato, telefona',
      `LOCATION:${sedeObj.indirizzo}`,
      'DESCRIPTION:Hai inviato la richiesta per la 1a Visita di Idoneita su avis.pv.it. Se la segreteria AVIS non ti ha ancora chiamato entro 3 settimane, telefona allo 0382 527963 (o Cell. 335 5255989).',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Promemoria_3_Settimane_AVIS_Pavia.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setAvvisoCalendarioAperto(false);
    mostraNotifica(
      'Promemoria a 3 Settimane Salvato! 📅',
      `Impostato per il ${promemoria3Sett.leggibile}: aprilo sul telefono per aggiungerlo al calendario.`,
      0
    );
  };

  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Controllo richiesta AVIS Pavia: se non ti hanno chiamato, telefona')}&dates=${dtStart}/${dtEnd}&location=${encodeURIComponent(sedeObj.indirizzo)}&details=${encodeURIComponent('Hai inviato la richiesta per la 1ª Visita di Idoneità su avis.pv.it. Se la segreteria AVIS non ti ha ancora chiamato entro 3 settimane, telefona allo 0382 527963 o Cell. 335 5255989.')}`;

  const confermaModuloInviato = () => {
    setAvvisoCalendarioAperto(true);
    if (onRichiestaVisitaInviata) {
      onRichiestaVisitaInviata(sedeSceltaNome);
    }
  };

  const verificaCodiceVisita = (e) => {
    if (e) e.preventDefault();
    if (!validaCodiceAvis('visita', codiceVisitaInput)) {
      setErroreCodiceVisita('Codice visita non riconosciuto. Chiedilo alla segreteria o al medico dopo la visita.');
      return;
    }
    setErroreCodiceVisita('');
    setCodiceVisitaInput('');
    if (onVisitaVerificataAvis) {
      onVisitaVerificataAvis();
    }
  };

  return (
    <div className="space-y-4">
      {/* UNICA CARD PRINCIPALE: RICHIESTA VISITA SU AVIS.PV.IT (NON APPUNTAMENTO DIRETTO) */}
      <div className="bg-white rounded-3xl p-5 border-2 border-rose-200 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-white bg-rose-600 px-2.5 py-0.5 rounded-md">
              3° Passo
            </span>
            <h2 className="text-base font-black text-stone-900 mt-1">
              Richiedi la 1ª Visita di Idoneità
            </h2>
          </div>
          <Calendar className="w-6 h-6 text-rose-600 shrink-0" />
        </div>

        <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-2xl border border-stone-200/70 leading-snug space-y-1.5">
          <p>
            <strong>1.</strong> Compili il modulo su <strong>avis.pv.it</strong> · <strong>2.</strong> La segreteria ti richiama per fissare la data · <strong>3.</strong> Se non ti chiamano entro 3 settimane, telefoni in sede.
          </p>
          <div className="text-[11px] font-bold text-rose-700 space-y-0.5 pt-0.5">
            <div>📍 Via Taramelli 7: Mer e Sab 08:00–11:30 (sangue intero e visite).</div>
            <div>🏥 San Matteo (Pad. 12): visite Lun–Ven 09:00/10:00 · sangue intero Lun, Mar, Gio, Ven · aferesi Lun–Ven 08:00/11:00 e Sab 08:00/09:30 (Dom chiuso).</div>
          </div>
        </div>

        {/* Scelta Sede Preferita (indicativa) */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500">
              Sede preferita (indicativa):
            </span>
            <button
              onClick={() => setSchedaAttiva('sedi')}
              className="text-[11px] font-bold text-rose-600 underline"
            >
              Vedi mappa sedi →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sediBrevi.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSedePreferitaVisita(s.id);
                  setFasciaPreferitaVisita(s.id === 'san_matteo' ? 'Lun–Ven (09:00 / 10:00)' : 'Mercoledì mattina');
                }}
                className={`p-2.5 rounded-xl border text-left font-bold transition ${
                  sedePreferitaVisita === s.id
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                <span className="block text-[11px] font-black">{s.nome}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Preferenza indicativa da riferire alla segreteria */}
        <div className="space-y-1.5 text-xs">
          <span className="text-[11px] font-bold text-stone-500 block">
            Preferenza indicativa da segnalare quando ti richiamano:
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {opzioniFascia.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFasciaPreferitaVisita(f)}
                className={`py-2 px-1.5 rounded-xl border font-bold text-[11px] text-center transition ${
                  fasciaCorrenteValida === f
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-stone-500 leading-snug">
            Le sedi lavorano solo su prenotazione: data e ora definitive te le conferma la segreteria AVIS al telefono.
          </p>
        </div>

        {/* FLUSSO ANTI LICENZA MORALE IN 2 STEP: PRIMA IL MODULO UFFICIALE, POI CONFERMA INVIO */}
        <div className="space-y-2 pt-1">
          <a
            href="https://avis.pv.it/diventare-donatori/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setModuloAvisAperto(true)}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md shadow-rose-600/20 transition active:scale-95 flex items-center justify-center space-x-1.5"
          >
            <span>1. Invia Richiesta sul Sito AVIS (avis.pv.it)</span>
            <span>↗</span>
          </a>

          <button
            type="button"
            onClick={confermaModuloInviato}
            className={`w-full py-3 rounded-2xl font-black text-xs border-2 transition active:scale-95 ${
              passo3Completato
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                : moduloAvisAperto
                ? 'bg-stone-900 hover:bg-stone-800 border-stone-900 text-white shadow-sm'
                : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700'
            }`}
          >
            {passo3Completato
              ? `✓ Richiesta inviata sul sito AVIS (${dataRichiestaVisita || 'registrata'})`
              : '2. Ho inviato il modulo sul sito AVIS ✓'}
          </button>
        </div>

        {/* RIQUADRO POST-INVIO + PROMEMORIA 3 SETTIMANE + VERIFICA SEDE AVIS (+40 PT) */}
        {passo3Completato && (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 space-y-3 text-xs text-emerald-950">
            <div>
              <div className="font-black text-emerald-900 text-sm">
                Richiesta Registrata! Attendi la chiamata AVIS 📞
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                Preferenza annotata: <strong>{sedeSceltaNome}</strong> ({fasciaCorrenteValida}). Se la segreteria non ti chiama entro <strong>3 settimane ({promemoria3Sett.leggibile})</strong>, contattali direttamente.
              </p>
            </div>

            <button
              onClick={() => setAvvisoCalendarioAperto(true)}
              className="w-full py-2.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-black text-xs transition"
            >
              📅 Imposta promemoria controllo a 3 settimane ({promemoria3Sett.leggibile})
            </button>

            <div className="bg-white/85 p-2.5 rounded-xl border border-emerald-200 text-[11px] text-stone-700 space-y-0.5">
              <div className="font-bold text-stone-900">Segreteria AVIS Pavia (Via Taramelli 7):</div>
              <div>📞 Tel: 0382 527963 · 📱 WhatsApp/Cell: 335 5255989</div>
              <div>✉️ Email: avis.pavia@avis.pv.it</div>
            </div>
          </div>
        )}

        {/* STEP 3: CONFERMA VISITA EFFETTUATA IN SEDE CON CODICE AVIS (+40 PT) */}
        <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
          visitaVerificataAvis ? 'bg-emerald-50/70 border-emerald-300' : 'bg-stone-50 border-stone-200'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-stone-900">
              {visitaVerificataAvis ? '✓ 1ª Visita Verificata in Sede AVIS (+40 pt)' : '🏥 Hai già fatto la 1ª Visita in AVIS?'}
            </span>
            {!visitaVerificataAvis && (
              <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md shrink-0">
                +40 pt
              </span>
            )}
          </div>
          {!visitaVerificataAvis ? (
            <form onSubmit={verificaCodiceVisita} className="space-y-2">
              <p className="text-[11px] text-stone-600 leading-snug">
                I punti della visita vengono accreditati solo dopo la conferma in sede: inserisci il codice ricevuto al termine della Visita di Idoneità.
                {modalitaSviluppatore && (
                  <span className="block font-mono font-bold text-amber-800 mt-0.5">[DEV] Codice di prova: AVIS-VISITA-PV</span>
                )}
              </p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={codiceVisitaInput}
                  onChange={(e) => {
                    setCodiceVisitaInput(e.target.value);
                    setErroreCodiceVisita('');
                  }}
                  placeholder="Codice Visita AVIS"
                  className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono text-xs font-bold uppercase focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-black text-xs"
                >
                  Conferma
                </button>
              </div>
              {erroreCodiceVisita && (
                <p className="text-[11px] font-bold text-rose-700">{erroreCodiceVisita}</p>
              )}
            </form>
          ) : (
            <p className="text-[11px] text-emerald-800 leading-snug">
              Visita registrata! Ora attendi gli esiti delle analisi gratuite e torna in Home dopo la 1ª donazione verificata (+100 pt).
            </p>
          )}
        </div>
      </div>

      {/* AVVISO POPUP: PROMEMORIA A 3 SETTIMANE ("SE NON TI CHIAMANO, TELEFONA") */}
      {avvisoCalendarioAperto && (
        <div className="absolute inset-0 z-50 bg-stone-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl border border-rose-200">
                📅
              </div>
              <h3 className="text-base font-black text-stone-900">
                Promemoria controllo a 3 settimane?
              </h3>
              <p className="text-xs text-stone-600 leading-snug">
                Sul sito AVIS la segreteria richiama per fissare la data. Vuoi salvare un promemoria per il <strong>{promemoria3Sett.leggibile}</strong>: <em>"Se AVIS non ti ha chiamato entro 3 settimane, telefona"</em>?
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <button
                onClick={scaricaPromemoriaCalendario}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black shadow-md shadow-rose-600/20 transition active:scale-95"
              >
                📥 Salva Promemoria 3 Settimane (.ics)
              </button>
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAvvisoCalendarioAperto(false)}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black transition flex items-center justify-center space-x-1.5"
              >
                <span>🌐 Apri in Google Calendar</span>
                <span>↗</span>
              </a>
              <button
                onClick={() => setAvvisoCalendarioAperto(false)}
                className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl font-bold transition"
              >
                Non ora, grazie
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UN SOLO BOTTONE OPZIONALE CHIUSO DI DEFAULT */}
      <button
        onClick={() => setMostraVisitaDettagli(!mostraVisitaDettagli)}
        className="w-full p-4 bg-white hover:bg-stone-50 rounded-2xl border border-stone-200/90 shadow-sm flex items-center justify-between text-xs font-black text-stone-800 transition"
      >
        <span>🩺 Cosa succede durante la Visita di Idoneità?</span>
        <span className="text-stone-400">{mostraVisitaDettagli ? '▲ Chiudi' : '▼ Apri'}</span>
      </button>

      {mostraVisitaDettagli && (
        <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm space-y-3">
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="p-2 bg-stone-50 rounded-2xl border border-stone-200/70">
              <span className="text-sm block">🪪</span>
              <span className="text-[10px] font-black text-stone-900 block mt-0.5">1. Modulo</span>
              <span className="text-[9px] text-stone-500 block leading-tight">Anamnesi</span>
            </div>
            <div className="p-2 bg-stone-50 rounded-2xl border border-stone-200/70">
              <span className="text-sm block">🩺</span>
              <span className="text-[10px] font-black text-stone-900 block mt-0.5">2. Medico</span>
              <span className="text-[9px] text-stone-500 block leading-tight">Visita privata</span>
            </div>
            <div className="p-2 bg-stone-50 rounded-2xl border border-stone-200/70">
              <span className="text-sm block">🧪</span>
              <span className="text-[10px] font-black text-stone-900 block mt-0.5">3. Provette</span>
              <span className="text-[9px] text-stone-500 block leading-tight">Analisi gratis</span>
            </div>
            <div className="p-2 bg-emerald-50 rounded-2xl border border-emerald-200/70">
              <span className="text-sm block">✅</span>
              <span className="text-[10px] font-black text-emerald-900 block mt-0.5">4. Esito</span>
              <span className="text-[9px] text-emerald-700 block leading-tight">Via alla 1ª!</span>
            </div>
          </div>

          <button
            onClick={() => setMostraAmt(!mostraAmt)}
            className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl text-[11px] font-black transition"
          >
            {mostraAmt ? 'Nascondi trucco anti-svenimento' : '💡 Trucco Anti-Svenimento (Tecnica AMT)'}
          </button>

          {mostraAmt && (
            <p className="text-[11px] text-blue-950 bg-blue-50/70 p-3 rounded-xl border border-blue-200 leading-snug">
              <strong>Tecnica AMT (Applied Muscle Tension):</strong> se provi emozione durante il prelievo, incrocia le gambe e tendi leggermente polpacci e glutei per 5 secondi. Mantiene alta la pressione ed evita capogiri!
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SCHERMATA 4B: SEZIONE DEDICATA ALLE 2 SEDI REALI DI PAVIA (MAPPA & MEZZI)
// ============================================================================
function SchermataSediMappa() {
  const [sedeId, setSedeId] = useState('avis_pavia');

  const sediRealiPavia = [
    {
      id: 'avis_pavia',
      nome: 'AVIS Comunale Pavia — Sede Centrale',
      breve: 'AVIS Pavia (Via Taramelli 7)',
      indirizzo: 'Via Taramelli 7 (angolo Strada Campeggi), 27100 Pavia (PV)',
      orariRighe: [
        'Solo su prenotazione',
        'Sangue intero e Visite di idoneità: Mercoledì e Sabato 08:00–11:30'
      ],
      telefono: '0382 527963 · WhatsApp 335 5255989',
      autoParcheggio: 'Parcheggio gratuito riservato ai donatori nel cortile interno di Via Taramelli 7 e lungo il viale.',
      busUrbano: 'Linee urbane 3 e 6 (fermata Taramelli / Cravino, 2 minuti a piedi).',
      mapEmbedUrl: 'https://maps.google.com/maps?q=AVIS+Comunale+Pavia+Via+Taramelli+7+Pavia&t=&z=16&ie=UTF8&iwloc=&output=embed',
      mapExternalUrl: 'https://www.google.com/maps/search/?api=1&query=AVIS+Comunale+Pavia+Via+Taramelli+7+Pavia'
    },
    {
      id: 'san_matteo',
      nome: 'Policlinico San Matteo — Centro Trasfusionale SIMT',
      breve: 'San Matteo SIMT (Pad. 12)',
      indirizzo: 'Viale Camillo Golgi 19 (Padiglione 12), 27100 Pavia (PV)',
      orariRighe: [
        'Solo su prenotazione (Domenica chiuso)',
        'Visite di idoneità: Lunedì–Venerdì 09:00 e 10:00',
        'Sangue intero: Lunedì, Martedì, Giovedì e Venerdì 09:00 e 10:00',
        'Aferesi / Plasma: Lunedì–Venerdì 08:00 e 11:00 · Sabato 08:00 e 09:30'
      ],
      telefono: '0382 503086 (segreteria AVIS: 0382 527963)',
      autoParcheggio: 'Parcheggio multipiano Piazzale Golgi e stalli Viale Golgi (tagliando convalidato gratis al Centro Trasfusionale).',
      busUrbano: 'Linee urbane 3, 7 e 8 dalla Stazione FS e dal Centro (fermata Golgi / San Matteo).',
      mapEmbedUrl: 'https://maps.google.com/maps?q=Policlinico+San+Matteo+Viale+Camillo+Golgi+19+Pavia&t=&z=16&ie=UTF8&iwloc=&output=embed',
      mapExternalUrl: 'https://www.google.com/maps/search/?api=1&query=Policlinico+San+Matteo+Viale+Camillo+Golgi+19+Pavia'
    }
  ];

  const sede = sediRealiPavia.find((s) => s.id === sedeId) || sediRealiPavia[0];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm space-y-3.5">
        <h2 className="text-base font-black text-stone-900">
          Sedi, Orari e Come Arrivare
        </h2>

        {/* Switch tra le 2 Sedi Reali */}
        <div className="grid grid-cols-2 gap-2">
          {sediRealiPavia.map((s) => (
            <button
              key={s.id}
              onClick={() => setSedeId(s.id)}
              className={`p-3 rounded-2xl border text-left transition ${
                sedeId === s.id
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
              }`}
            >
              <div className="text-xs font-black">{s.breve}</div>
            </button>
          ))}
        </div>

        {/* Mappa Google Maps */}
        <div className="relative w-full h-52 rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 shadow-inner">
          <iframe
            title={sede.nome}
            src={sede.mapEmbedUrl}
            className="w-full h-full border-0"
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <a
            href={sede.mapExternalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2.5 right-2.5 px-3 py-1.5 bg-white/95 hover:bg-white text-stone-900 rounded-xl text-[11px] font-black shadow-md border border-stone-200"
          >
            Apri in Google Maps ↗
          </a>
        </div>

        {/* Info Dettagliate Sede */}
        <div className="space-y-2 text-xs">
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <div className="font-black text-stone-900">{sede.nome}</div>
            <div className="text-stone-600">📍 {sede.indirizzo}</div>
            <div className="space-y-0.5 text-[11px] text-stone-600 pt-0.5">
              {sede.orariRighe.map((r, i) => (
                <div key={i} className={i === 0 ? 'font-bold text-rose-700' : ''}>{r}</div>
              ))}
            </div>
            <div className="text-stone-500 text-[11px]">📞 {sede.telefono}</div>
          </div>

          <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80 flex items-start space-x-2.5">
            <span className="text-base shrink-0">🚗</span>
            <div>
              <span className="font-black text-blue-950 block text-[11px] uppercase">Auto & Parcheggi Gratuiti</span>
              <p className="text-[11px] text-blue-900/90 leading-snug mt-0.5">{sede.autoParcheggio}</p>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex items-start space-x-2.5">
            <span className="text-base shrink-0">🚌</span>
            <div>
              <span className="font-black text-emerald-950 block text-[11px] uppercase">Autobus Urbani Pavia</span>
              <p className="text-[11px] text-emerald-900/90 leading-snug mt-0.5">{sede.busUrbano}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Portale AVIS Pavia */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm flex items-center justify-between text-xs">
        <div>
          <span className="font-black text-stone-900 block">Sito Ufficiale AVIS Pavia</span>
          <span className="text-[11px] text-stone-500">avis.pavia@avis.pv.it · Tel. 0382 527963</span>
        </div>
        <a
          href="https://avis.pv.it/diventare-donatori/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-black transition"
        >
          avis.pv.it ↗
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// MODALE RISCATTO & VERIFICA BUONI: QR CODE DEL BAR (PRINCIPALE) + PIN CASSA
// ============================================================================
function ModaleCouponLive({ coupon, modalitaSviluppatore, onConvalidaDefinitiva, onClose }) {
  const [secondi, setSecondi] = useState(300);
  const [oraLive, setOraLive] = useState(() => new Date());
  const [modalita, setModalita] = useState('qr'); // 'qr' | 'pin'
  const [cameraAttiva, setCameraAttiva] = useState(false);
  const [erroreCamera, setErroreCamera] = useState('');
  const [pinInserito, setPinInserito] = useState('');
  const [errorePin, setErrorePin] = useState('');
  const [ricevutaConvalidata, setRicevutaConvalidata] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fermaFotocamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraAttiva(false);
  };

  useEffect(() => {
    const t = setInterval(() => {
      setOraLive(new Date());
      setSecondi((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      clearInterval(t);
      fermaFotocamera();
    };
  }, []);

  useEffect(() => {
    if (cameraAttiva && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraAttiva]);

  if (!coupon) return null;

  const min = Math.floor(secondi / 60);
  const sec = secondi % 60;
  const tempo = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  const orarioCorrenteStr = oraLive.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const avviaFotocamera = async () => {
    setErroreCamera('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErroreCamera('Fotocamera non disponibile in questo browser: usa la scheda PIN Cassa con il personale.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setCameraAttiva(true);
    } catch (err) {
      setErroreCamera('Permesso fotocamera negato o dispositivo senza webcam: usa la scheda PIN Cassa.');
    }
  };

  const completaConvalida = (metodoUsato) => {
    if (secondi <= 0) {
      setErrorePin('Buono scaduto: chiudi e riapri davanti alla cassa.');
      return;
    }
    fermaFotocamera();
    const txId = `TX-${Math.floor(100000 + Math.random() * 900000)}`;
    const ricevuta = {
      txId,
      metodo: metodoUsato,
      titolo: coupon.titolo,
      luogo: coupon.luogo,
      costo: coupon.costo,
      codice: coupon.codice,
      orario: oraLive.toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };
    setRicevutaConvalidata(ricevuta);
    if (onConvalidaDefinitiva) {
      onConvalidaDefinitiva(ricevuta);
    }
  };

  const verificaPinEsercente = (e) => {
    if (e) e.preventDefault();
    if (pinInserito.trim() !== coupon.pinEsercente) {
      setErrorePin('PIN esercente non valido. Riprova in cassa.');
      return;
    }
    setErrorePin('');
    completaConvalida('PIN Esercente Verificato');
  };

  const chiudiModale = () => {
    fermaFotocamera();
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2.2rem] p-5 shadow-2xl border border-stone-200 space-y-3.5 max-h-[92%] overflow-y-auto">
        {!ricevutaConvalidata ? (
          <>
            <div className="text-center space-y-1">
              <span className="inline-block px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-[10px] font-black uppercase">
                Convalida in Cassa · {coupon.costo} pt
              </span>
              <h3 className="text-sm font-black text-stone-900 leading-snug">{coupon.titolo}</h3>
              <p className="text-[11px] text-stone-500">📍 {coupon.luogo}</p>
            </div>

            {/* BARRA LIVE ANTI-SCREENSHOT + TIMER */}
            <div className="bg-stone-50 rounded-2xl p-2.5 border border-stone-200 flex items-center justify-between text-center">
              <div className="flex-1 border-r border-stone-200 pr-2">
                <span className="text-[9px] font-black uppercase text-stone-400 block">Ora Live</span>
                <span className="text-xs font-mono font-black text-emerald-700">● {orarioCorrenteStr}</span>
              </div>
              <div className="flex-1 pl-2">
                <span className="text-[9px] font-black uppercase text-stone-400 block">Scadenza</span>
                <span className={`text-xs font-mono font-black ${secondi < 60 ? 'text-rose-600' : 'text-stone-900'}`}>
                  {tempo}
                </span>
              </div>
            </div>

            {/* SWITCHER: QR CODE DEL BAR (PRINCIPALE) vs PIN ESERCENTE (FALLBACK) */}
            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setModalita('qr')}
                className={`flex-1 py-2 rounded-lg transition ${
                  modalita === 'qr' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                }`}
              >
                📷 Scansiona QR Bar
              </button>
              <button
                type="button"
                onClick={() => {
                  fermaFotocamera();
                  setModalita('pin');
                }}
                className={`flex-1 py-2 rounded-lg transition ${
                  modalita === 'pin' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                }`}
              >
                🔐 PIN Cassa
              </button>
            </div>

            {modalita === 'qr' ? (
              <div className="space-y-3">
                <p className="text-[11px] text-stone-600 text-center leading-snug">
                  Inquadra il <strong>QR Code esposto sul bancone</strong> della cassa. I punti vengono scalati solo dopo la scansione.
                </p>

                {/* MIRINO SCANNER FOTOCAMERA */}
                <div className="relative w-full h-44 rounded-2xl bg-stone-900 overflow-hidden border-2 border-stone-800 flex flex-col items-center justify-center">
                  {cameraAttiva ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center px-4 space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-white/10 text-white flex items-center justify-center text-2xl">
                        📷
                      </div>
                      <span className="text-[11px] text-stone-300 font-semibold block">
                        Scanner pronto per il QR della cassa
                      </span>
                    </div>
                  )}

                  {/* Angoli mirino scanner */}
                  <div className="pointer-events-none absolute inset-4">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-rose-500 rounded-tl-lg absolute top-0 left-0" />
                    <div className="w-6 h-6 border-t-4 border-r-4 border-rose-500 rounded-tr-lg absolute top-0 right-0" />
                    <div className="w-6 h-6 border-b-4 border-l-4 border-rose-500 rounded-bl-lg absolute bottom-0 left-0" />
                    <div className="w-6 h-6 border-b-4 border-r-4 border-rose-500 rounded-br-lg absolute bottom-0 right-0" />
                  </div>
                </div>

                {erroreCamera && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-xl leading-snug">
                    {erroreCamera}
                  </p>
                )}

                <div className="space-y-2">
                  {!cameraAttiva ? (
                    <button
                      type="button"
                      onClick={avviaFotocamera}
                      className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-black transition active:scale-95"
                    >
                      📷 Attiva Fotocamera
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => completaConvalida('QR Code Cassa Scansionato')}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 transition active:scale-95"
                    >
                      ✓ QR Inquadrato · Convalida ({coupon.costo} pt)
                    </button>
                  )}

                  {modalitaSviluppatore && (
                    <button
                      type="button"
                      onClick={() => completaConvalida('QR Code Cassa (Test DEV)')}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-sm transition active:scale-95"
                    >
                      [DEV] ⚡ Simula Scansione QR (-{coupon.costo} pt)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* PIANO B: PIN ESERCENTE 4 CIFRE */
              <form onSubmit={verificaPinEsercente} className="space-y-2.5 text-left">
                <p className="text-[11px] text-stone-500 leading-snug">
                  Se la fotocamera non funziona o c'è poca luce, il personale alla cassa può digitare il PIN a 4 cifre del locale.
                </p>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black text-stone-800">
                      🔐 PIN Esercente (4 cifre)
                    </label>
                    {modalitaSviluppatore && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        [DEV] {coupon.pinEsercente}
                      </span>
                    )}
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInserito}
                    onChange={(e) => {
                      setPinInserito(e.target.value.replace(/\D/g, ''));
                      setErrorePin('');
                    }}
                    placeholder="••••"
                    className="w-full px-3.5 py-3 bg-stone-50 border border-stone-300 rounded-2xl text-center font-mono text-base font-black tracking-[0.4em] text-stone-900 focus:outline-none focus:bg-white focus:border-rose-500"
                  />
                  {errorePin && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1">{errorePin}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={pinInserito.length < 4}
                  className={`w-full py-3 rounded-2xl text-xs font-black transition ${
                    pinInserito.length === 4
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  Convalida con PIN & Scala {coupon.costo} pt ✓
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={chiudiModale}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold"
            >
              Annulla (Nessun punto scalato)
            </button>
          </>
        ) : (
          /* SCHERMATA VERDE DA MOSTRARE AL BARISTA DOPO LA SCANSIONE QR O PIN */
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border-4 border-emerald-500 text-emerald-700 flex items-center justify-center text-3xl font-black shadow-md shadow-emerald-500/20">
              ✓
            </div>
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase">
                Mostra al Barista · Valido & Registrato
              </span>
              <h3 className="text-base font-black text-stone-900 pt-1">{ricevutaConvalidata.titolo}</h3>
              <p className="text-xs text-stone-500">📍 {ricevutaConvalidata.luogo}</p>
            </div>

            <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200 text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-emerald-800">Verifica:</span>
                <span className="font-black text-emerald-950">{ricevutaConvalidata.metodo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Ricevuta:</span>
                <span className="font-mono font-black text-emerald-950">{ricevutaConvalidata.txId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Ora Live:</span>
                <span className="font-mono font-black text-emerald-700">● {orarioCorrenteStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Convalidato:</span>
                <span className="font-bold text-emerald-950">{ricevutaConvalidata.orario}</span>
              </div>
              <div className="flex justify-between border-t border-emerald-200 pt-1.5 mt-1">
                <span className="text-emerald-800">Punti scalati:</span>
                <span className="font-black text-rose-600">-{ricevutaConvalidata.costo} pt</span>
              </div>
            </div>

            <button
              type="button"
              onClick={chiudiModale}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-black"
            >
              Chiudi Ricevuta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SCHERMATA 5: RINGRAZIAMENTI PAVIA, CLASSIFICA MACRO-AREE & MINIGIOCHI (TETTO 6 PT/G)
// ============================================================================
function SchermataBonus({
  gocceConoscenza,
  setGocceConoscenza,
  contributoMacroArea,
  aggiungiGocce,
  registraAttivitaSettimanale,
  storicoBuoni,
  setStoricoBuoni,
  giochiStato,
  setGiochiStato,
  modalitaSviluppatore,
  avatar,
  profilo,
  mostraNotifica,
  setModaleAvatarAperta
}) {
  const [sottoTab, setSottoTab] = useState('premi'); // 'premi' | 'classifiche' | 'giochi'
  const [couponAttivo, setCouponAttivo] = useState(null);

  // Stato di navigazione dei Minigiochi (dati giornalieri in giochiStato persistiti per oggiISO)
  const [giocoAttivo, setGiocoAttivo] = useState('giornaliero'); // 'giornaliero' | 'verofalso' | 'compatibilita' | 'zaino' | 'parola' | 'memory'
  const [offsetGiorniQuizDev, setOffsetGiorniQuizDev] = useState(0);
  const [indiceGiornaliero, setIndiceGiornaliero] = useState(0);
  const [indiceVF, setIndiceVF] = useState(0);
  const [indiceCompat, setIndiceCompat] = useState(0);
  const [zainoScelti, setZainoScelti] = useState([]);
  const [indiceParola, setIndiceParola] = useState(0);
  const [inputParola, setInputParola] = useState('');

  const oggiISO = ottieniDataOggiISO();
  const oggiLeggibile = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  const puntiGiochiOggi = giochiStato?.data === oggiISO ? (giochiStato.puntiOggi || 0) : 0;

  const aggiornaStatoGiochi = (updater) => {
    setGiochiStato((prev) => {
      const base =
        prev && prev.data === oggiISO
          ? prev
          : {
              data: oggiISO,
              puntiOggi: 0,
              rispGiornaliere: {},
              quizGiornoPremiato: false,
              rispVF: {},
              vfPremiato: false,
              rispCompat: {},
              compatPremiato: false,
              zainoCompletato: false,
              paroleIndovinate: {},
              memoryPremiato: false
            };
      return updater(base);
    });
  };

  const assegnaPuntiGioco = (quantitaRichiesta, titoloOk, msgOk) => {
    const rimasti = Math.max(0, MAX_PUNTI_GIOCHI_GIORNO - puntiGiochiOggi);
    const accreditati = Math.min(quantitaRichiesta, rimasti);
    if (registraAttivitaSettimanale) {
      registraAttivitaSettimanale();
    }
    if (accreditati > 0) {
      aggiungiGocce(accreditati);
      aggiornaStatoGiochi((s) => ({ ...s, puntiOggi: s.puntiOggi + accreditati }));
      mostraNotifica(titoloOk, msgOk, accreditati);
    } else {
      mostraNotifica(
        `${titoloOk} (Tetto ${MAX_PUNTI_GIOCHI_GIORNO} pt/giorno raggiunto)`,
        'Puoi continuare a imparare coi giochi: i punti più grandi arrivano con visita (+40 pt) e donazione (+100 pt).',
        0
      );
    }
  };

  // --- 1. CATALOGO PREMI E RINGRAZIAMENTI DI PAVIA ---
  const catalogoPremiUniversitari = [
    {
      id: 'caffe_studio',
      titolo: '☕ Carnet 5 Colazioni & Caffè da Sessione Esami',
      desc: '5 buoni per caffè/cappuccino + brioche offerti dai bar convenzionati come piccolo grazie.',
      luogo: 'Bar San Tommaso / Bar Cortile Centrale',
      pinEsercente: '1361',
      costo: 150
    },
    {
      id: 'stampe',
      titolo: '🖨️ Buono Copisteria: 150 Stampe Dispense & Rilegatura Tesi',
      desc: '150 stampe/fotocopie di slide, dispense d\'esame o rilegatura bozze tesi.',
      luogo: 'Copisterie Corso Carlo Alberto & Polo Cravino',
      pinEsercente: '2710',
      costo: 250
    },
    {
      id: 'borraccia_tote',
      titolo: '🍼 Borraccia Termica da Biblioteca + Tote Bag "IN VEIN x UniPv"',
      desc: 'Borraccia in acciaio da 500 ml e borsa in cotone pesante porta-libri.',
      luogo: 'Sede AVIS Comunale Pavia (Via Taramelli 7)',
      pinEsercente: '7700',
      costo: 400
    },
    {
      id: 'zaino_felpa',
      titolo: '🎒 Zaino Universitario Porta-PC + Felpa Ufficiale UniPv',
      desc: 'Il ringraziamento speciale per gli studenti più costanti dell\'Università di Pavia.',
      luogo: 'Sede AVIS Comunale Pavia / UniPv Store',
      pinEsercente: '7700',
      costo: 650
    }
  ];

  const riscattaPremio = (premio) => {
    if (gocceConoscenza < premio.costo) {
      mostraNotifica('Punti insufficienti', `Ti mancano ${premio.costo - gocceConoscenza} punti per questo premio.`, 0);
      return;
    }
    const codice = `UNIPV-${Math.floor(1000 + Math.random() * 9000)}`;
    setCouponAttivo({ ...premio, codice });
  };

  const convalidaBuonoInCassa = (ricevuta) => {
    setGocceConoscenza((p) => Math.max(0, p - ricevuta.costo));
    setStoricoBuoni((prev) => [ricevuta, ...prev]);
    mostraNotifica('Buono Convalidato in Cassa! ✓', `Ricevuta ${ricevuta.txId} registrata.`, -ricevuta.costo);
  };

  // --- 2. CLASSIFICA 5 MACRO-AREE PONDERATA PER STUDENTE ATTIVO + MIGLIOR CRESCITA ---
  const parametriAree = [
    { studentiAttivi: 195, puntiBaseMese: 8650, mediaMeseScorso: 40.5 },
    { studentiAttivi: 165, puntiBaseMese: 7020, mediaMeseScorso: 39.2 },
    { studentiAttivi: 145, puntiBaseMese: 5980, mediaMeseScorso: 38.0 },
    { studentiAttivi: 125, puntiBaseMese: 4950, mediaMeseScorso: 32.0 },
    { studentiAttivi: 110, puntiBaseMese: 4180, mediaMeseScorso: 35.0 }
  ];

  const classificaMacroAree = MACRO_DIPARTIMENTI_UNIPV.map((nomeArea, index) => {
    const isMio = nomeArea === profilo.facolta;
    const param = parametriAree[index] || parametriAree[0];
    const puntiTotali = param.puntiBaseMese + (isMio ? contributoMacroArea : 0);
    const studenti = param.studentiAttivi + (isMio ? 1 : 0);
    const mediaPerStudente = Number((puntiTotali / studenti).toFixed(1));
    const crescitaPerc = Math.round(((mediaPerStudente - param.mediaMeseScorso) / param.mediaMeseScorso) * 100);
    return {
      nome: nomeArea,
      puntiTotali,
      studenti,
      mediaPerStudente,
      crescitaPerc,
      isMio
    };
  }).sort((a, b) => b.mediaPerStudente - a.mediaPerStudente);

  const areaPrimaNome = classificaMacroAree[0]?.nome;
  const migliorCrescitaNome = [...classificaMacroAree]
    .filter((a) => a.nome !== areaPrimaNome)
    .sort((a, b) => b.crescitaPerc - a.crescitaPerc)[0]?.nome;

  const maxMediaArea = Math.max(...classificaMacroAree.map((a) => a.mediaPerStudente));
  const miaPosizioneArea = classificaMacroAree.findIndex((a) => a.isMio) + 1;

  // --- DATI GIOCO 1: QUIZ DEL GIORNO LEGATO ALLA DATA REALE (+1 PT, +2 PT SE 3/3) ---
  const databaseGiornaliero = [
    { id: 'g1_1', g: 1, q: 'Qual è il 1° passo ufficiale su avis.pv.it per diventare donatore?', opts: ['Inviare la richiesta per la Visita di Idoneità', 'Presentarsi a caso senza visita', 'Pagare le analisi'], corr: 0 },
    { id: 'g1_2', g: 1, q: 'In quanto tempo il corpo recupera la parte liquida (plasma)?', opts: ['In 30 giorni', 'In circa 24 ore', 'In 6 mesi'], corr: 1 },
    { id: 'g1_3', g: 1, q: 'Qual è l\'età per candidarsi per la 1ª volta in AVIS?', opts: ['Dai 25 anni', 'Solo sotto i 30 anni', 'Tra 18 e 60 anni (peso > 50 kg)'], corr: 2 },

    { id: 'g2_1', g: 2, q: 'Dove si trova la sede dell\'AVIS Comunale a Pavia?', opts: ['Via Taramelli 7, Pavia', 'Piazza della Vittoria', 'Castello Visconteo'], corr: 0 },
    { id: 'g2_2', g: 2, q: 'A cosa serve il plasma raccolto con la plasmaferesi?', opts: ['Solo per idratare', 'A produrre farmaci salvavita (immunoglobuline, albumina)', 'Non viene usato'], corr: 1 },
    { id: 'g2_3', g: 2, q: 'Secondo le regole di AVIS Pavia, qual è l\'intervallo tra due donazioni di sangue intero?', opts: ['30 giorni per tutti', '90 giorni per uomini (180 giorni per donne in età fertile)', 'Una volta ogni 2 anni'], corr: 1 },

    { id: 'g3_1', g: 3, q: 'Secondo AVIS Pavia, quanto bisogna attendere dopo una donazione di plasma?', opts: ['120 giorni', '14 giorni (30 giorni invece da sangue intero a plasma)', '6 mesi'], corr: 1 },
    { id: 'g3_2', g: 3, q: 'Cosa riceve il donatore gratuitamente dopo ogni visita e prelievo?', opts: ['Analisi ematochimiche complete gratuite', 'Solo un certificato cartaceo', 'Niente'], corr: 0 },
    { id: 'g3_3', g: 3, q: 'Quanti ml di sangue intero vengono prelevati in una donazione standard?', opts: ['1,5 litri', '100 ml', '450 ml (± 10%)'], corr: 2 }
  ];

  const giornoRealeIndex = (Math.floor(Date.now() / 86400000) + (modalitaSviluppatore ? offsetGiorniQuizDev : 0)) % 3 + 1;
  const quizOggi = databaseGiornaliero.filter((x) => x.g === giornoRealeIndex);
  const rispGiornaliere = giochiStato?.data === oggiISO ? (giochiStato.rispGiornaliere || {}) : {};
  const quizGiornoPremiato = giochiStato?.data === oggiISO ? Boolean(giochiStato.quizGiornoPremiato) : false;
  const completatiOggi = quizOggi.every((x) => rispGiornaliere[x.id] !== undefined);
  const corretteOggiCount = quizOggi.filter((x) => rispGiornaliere[x.id] === x.corr).length;

  const rispondiGiornaliero = (q, idx) => {
    if (rispGiornaliere[q.id] !== undefined) return;
    const nuoveRisp = { ...rispGiornaliere, [q.id]: idx };
    const tutteRisposte = quizOggi.every((itemQ) => nuoveRisp[itemQ.id] !== undefined);
    const numCorrette = quizOggi.filter((itemQ) => nuoveRisp[itemQ.id] === itemQ.corr).length;

    aggiornaStatoGiochi((s) => ({
      ...s,
      rispGiornaliere: nuoveRisp,
      quizGiornoPremiato: tutteRisposte ? true : s.quizGiornoPremiato
    }));

    if (tutteRisposte && !quizGiornoPremiato) {
      const premioQuiz = numCorrette === quizOggi.length ? 2 : 1;
      assegnaPuntiGioco(
        premioQuiz,
        `Quiz del Giorno Completato (${numCorrette}/3) 🎯`,
        numCorrette === quizOggi.length ? '+2 pt per averle azzeccate tutte!' : '+1 pt per aver completato il quiz!'
      );
    } else if (idx === q.corr) {
      mostraNotifica('Risposta Esatta! ✓', 'Completa tutte e 3 le domande del giorno per ottenere i punti.', 0);
    } else {
      mostraNotifica('Risposta Errata', 'Nessun problema: il quiz serve per imparare insieme.', 0);
    }
  };

  // --- DATI GIOCO 2: VERO O FALSO LAMPO (6 MITI, +1 PT AL COMPLETAMENTO) ---
  const sfideVeroFalso = [
    { id: 'vf1', testo: 'Il sangue umano può essere prodotto artificialmente in laboratorio.', corr: 'Falso', spieg: 'Falso! La donazione volontaria è l\'unica fonte al mondo per il sangue.' },
    { id: 'vf2', testo: 'La Legge 219/2005 garantisce per legge la giustificazione automatica agli esami universitari.', corr: 'Falso', spieg: 'Falso: l\'art. 8 tutela i lavoratori dipendenti; per gli studenti chiedi l\'attestato AVIS e verifica col tuo corso di laurea.' },
    { id: 'vf3', testo: 'Su avis.pv.it prima della 1ª donazione fai sempre la Visita di Idoneità con esami gratuiti.', corr: 'Vero', spieg: 'Vero! Così verifichi i valori ematici in totale sicurezza.' },
    { id: 'vf4', testo: 'Donare il sangue fa ingrassare o abbassa il metabolismo.', corr: 'Falso', spieg: 'Falso! Aiuta invece a monitorare costantemente colesterolo e glicemia.' },
    { id: 'vf5', testo: 'Una sola donazione può aiutare fino a 3 pazienti diversi.', corr: 'Vero', spieg: 'Vero! Il sangue viene diviso in globuli rossi, plasma e piastrine.' },
    { id: 'vf6', testo: 'Chi assume la pillola anticoncezionale non può mai donare il sangue.', corr: 'Falso', spieg: 'Falso! La pillola anticoncezionale è pienamente compatibile con la donazione.' }
  ];

  const rispVeroFalso = giochiStato?.data === oggiISO ? (giochiStato.rispVF || {}) : {};
  const vfPremiato = giochiStato?.data === oggiISO ? Boolean(giochiStato.vfPremiato) : false;
  const vfCompletato = sfideVeroFalso.every((s) => rispVeroFalso[s.id] !== undefined);
  const vfCorretteCount = sfideVeroFalso.filter((s) => rispVeroFalso[s.id] === s.corr).length;

  const rispondiVF = (item, scelta) => {
    if (rispVeroFalso[item.id] !== undefined) return;
    const nuoveRisp = { ...rispVeroFalso, [item.id]: scelta };
    const tutteRisposte = sfideVeroFalso.every((s) => nuoveRisp[s.id] !== undefined);
    const numEsatte = sfideVeroFalso.filter((s) => nuoveRisp[s.id] === s.corr).length;

    aggiornaStatoGiochi((st) => ({
      ...st,
      rispVF: nuoveRisp,
      vfPremiato: tutteRisposte ? true : st.vfPremiato
    }));

    if (tutteRisposte && !vfPremiato) {
      if (numEsatte >= 4) {
        assegnaPuntiGioco(1, `Vero/Falso Completato (${numEsatte}/6) ⚡`, '+1 pt guadagnato!');
      } else {
        mostraNotifica(`Vero/Falso Completato (${numEsatte}/6)`, 'Servono almeno 4 risposte corrette per ottenere +1 pt.', 0);
      }
    }
  };

  // --- DATI GIOCO 3: COMPATIBILITA GRUPPI SANGUIGNI (+1 PT AL COMPLETAMENTO) ---
  const casiCompatibilita = [
    { id: 'c1', domanda: 'Un paziente in emergenza ha gruppo A+ e servono globuli rossi urgenti. Quale gruppo può donare sempre a tutti in emergenza?', opts: ['0 Rh- (Donatore Universale)', 'AB+ (Ricevitore)', 'Solo B-'], corr: 0 },
    { id: 'c2', domanda: 'Chi ha gruppo AB+ viene chiamato "Ricevitore Universale" di globuli rossi. Da chi può ricevere?', opts: ['Solo da AB+', 'Da qualsiasi gruppo (0, A, B, AB)', 'Solo da 0-'], corr: 1 },
    { id: 'c3', domanda: 'Invece per il PLASMA (parte liquida), qual è il donatore universale?', opts: ['Gruppo AB (non ha anticorpi anti-A né anti-B)', 'Gruppo 0-', 'Nessuno'], corr: 0 },
    { id: 'c4', domanda: 'Uno studente scopre di avere gruppo 0+. A quali gruppi Rh positivi può donare globuli rossi?', opts: ['Solo a 0+', 'Solo ad AB+', 'A tutti i gruppi positivi (0+, A+, B+, AB+)'], corr: 2 }
  ];

  const rispCompatibilita = giochiStato?.data === oggiISO ? (giochiStato.rispCompat || {}) : {};
  const compatPremiato = giochiStato?.data === oggiISO ? Boolean(giochiStato.compatPremiato) : false;
  const compatCompletato = casiCompatibilita.every((c) => rispCompatibilita[c.id] !== undefined);
  const compatCorretteCount = casiCompatibilita.filter((c) => rispCompatibilita[c.id] === c.corr).length;

  const rispondiCompat = (caso, idx) => {
    if (rispCompatibilita[caso.id] !== undefined) return;
    const nuoveRisp = { ...rispCompatibilita, [caso.id]: idx };
    const tuttiRisolti = casiCompatibilita.every((c) => nuoveRisp[c.id] !== undefined);
    const numEsatti = casiCompatibilita.filter((c) => nuoveRisp[c.id] === c.corr).length;

    aggiornaStatoGiochi((st) => ({
      ...st,
      rispCompat: nuoveRisp,
      compatPremiato: tuttiRisolti ? true : st.compatPremiato
    }));

    if (tuttiRisolti && !compatPremiato) {
      if (numEsatti >= 3) {
        assegnaPuntiGioco(1, `Casi Gruppi Completati (${numEsatti}/4) 🩸`, '+1 pt guadagnato!');
      } else {
        mostraNotifica(`Casi Gruppi Completati (${numEsatti}/4)`, 'Servono almeno 3 risposte corrette per ottenere +1 pt.', 0);
      }
    }
  };

  // --- DATI GIOCO 4: PREPARA LO ZAINO PER LA VISITA AVIS (+2 PT) ---
  const oggettiZaino = [
    { id: 'z1', label: '🪪 Tessera Sanitaria & Documento', giusto: true },
    { id: 'z2', label: '🥛 Bottiglione di Latte Intero', giusto: false },
    { id: 'z3', label: '💧 Bottiglietta d\'Acqua (500 ml)', giusto: true },
    { id: 'z4', label: '🥐 Fette Biscottate / Frutta', giusto: true },
    { id: 'z5', label: '💊 Aspirina presa stamattina', giusto: false },
    { id: 'z6', label: '👕 Maglietta a maniche comode', giusto: true },
    { id: 'z7', label: '🏋️ Pesi da 10 kg per allenarsi subito', giusto: false }
  ];

  const zainoCompletato = giochiStato?.data === oggiISO ? Boolean(giochiStato.zainoCompletato) : false;

  const toggleZaino = (item) => {
    if (zainoCompletato) return;
    if (zainoScelti.includes(item.id)) {
      setZainoScelti((prev) => prev.filter((x) => x !== item.id));
    } else {
      setZainoScelti((prev) => [...prev, item.id]);
    }
  };

  const verificaZaino = () => {
    if (zainoCompletato) return;
    const giustiIds = oggettiZaino.filter((x) => x.giusto).map((x) => x.id);
    const tuttoGiusto = zainoScelti.length === 4 && giustiIds.every((id) => zainoScelti.includes(id));

    if (tuttoGiusto) {
      aggiornaStatoGiochi((st) => ({ ...st, zainoCompletato: true }));
      assegnaPuntiGioco(2, 'Zaino Perfetto! 🎒', '+2 Punti! Tutto pronto per la visita in AVIS.');
    } else {
      mostraNotifica('Controlla lo Zaino!', 'Servono i 4 oggetti utili ed evitare latte, aspirina o pesi!', 0);
    }
  };

  // --- DATI GIOCO 5: PAROLA MISTERIOSA EMATICA (+1 PT A PAROLA) ---
  const paroleMisteriose = [
    { parola: 'PLASMA', indizio: 'La componente liquida giallognola del sangue che si recupera in 24 ore (6 lettere)' },
    { parola: 'FERRITINA', indizio: 'La proteina che immagazzina il ferro nel nostro corpo (9 lettere)' },
    { parola: 'TARAMELLI', indizio: 'Il nome della via di Pavia dove ha sede l\'AVIS Comunale al civico 7 (9 lettere)' },
    { parola: 'IDONEITA', indizio: 'La visita medica iniziale con esami gratuiti prima della 1ª donazione (8 lettere)' }
  ];

  const paroleIndovinate = giochiStato?.data === oggiISO ? (giochiStato.paroleIndovinate || {}) : {};
  const parolaAttuale = paroleMisteriose[indiceParola];

  const verificaParola = () => {
    if (paroleIndovinate[parolaAttuale.parola]) return;
    if (normalizzaTestoConfronto(inputParola) === parolaAttuale.parola) {
      aggiornaStatoGiochi((st) => ({
        ...st,
        paroleIndovinate: { ...(st.paroleIndovinate || {}), [parolaAttuale.parola]: true }
      }));
      setInputParola('');
      assegnaPuntiGioco(1, 'Parola Indovinata! 🔤', `+1 Punto! La parola era ${parolaAttuale.parola}.`);
    } else {
      mostraNotifica('Riprova!', 'Controlla l\'indizio o il numero di lettere.', 0);
    }
  };

  // --- DATI GIOCO 6: MEMORY EMATICO (+2 PT, 1 VOLTA AL GIORNO) ---
  const carteIniziali = [
    { id: 1, coppiaId: '0neg', label: '0 Rh-' },
    { id: 2, coppiaId: '0neg', label: 'Donatore Univ.' },
    { id: 3, coppiaId: 'abpos', label: 'AB Rh+' },
    { id: 4, coppiaId: 'abpos', label: 'Ricevitore Univ.' },
    { id: 5, coppiaId: 'plasma', label: 'Plasma' },
    { id: 6, coppiaId: 'plasma', label: 'Recupero 24h' },
    { id: 7, coppiaId: 'visita', label: '1° Passo AVIS' },
    { id: 8, coppiaId: 'visita', label: 'Visita Idoneità' }
  ];

  const [carte, setCarte] = useState(() => mescolaCarte(carteIniziali));
  const [scoperte, setScoperte] = useState([]);
  const [indovinate, setIndovinate] = useState([]);
  const memoryPremiato = giochiStato?.data === oggiISO ? Boolean(giochiStato.memoryPremiato) : false;

  const giraCarta = (c) => {
    if (scoperte.length === 2 || scoperte.includes(c.id) || indovinate.includes(c.coppiaId)) return;
    const nuove = [...scoperte, c.id];
    setScoperte(nuove);
    if (nuove.length === 2) {
      const c1 = carte.find((x) => x.id === nuove[0]);
      const c2 = carte.find((x) => x.id === nuove[1]);
      if (c1.coppiaId === c2.coppiaId) {
        const nuoveInd = [...indovinate, c1.coppiaId];
        setIndovinate(nuoveInd);
        setScoperte([]);
        if (nuoveInd.length === 4) {
          if (!memoryPremiato) {
            aggiornaStatoGiochi((st) => ({ ...st, memoryPremiato: true }));
            assegnaPuntiGioco(2, 'Memory Vinto! 🃏', '+2 Punti guadagnati oggi!');
          } else {
            mostraNotifica('Memory Completato! 🃏', 'Hai già ottenuto i punti del Memory per oggi.', 0);
          }
        }
      } else {
        setTimeout(() => setScoperte([]), 650);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER SALDO PUNTI & GUARDAROBA GOCCIA */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CustomAvatar config={avatar} size="md" felice={true} onClick={() => setModaleAvatarAperta(true)} />
          <div>
            <span className="text-[10px] font-black uppercase text-stone-400 block">I tuoi Punti</span>
            <div className="text-base font-black text-rose-600">{gocceConoscenza} Punti</div>
          </div>
        </div>
        <button
          onClick={() => setModaleAvatarAperta(true)}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-black transition"
        >
          Vesti Goccia ✨
        </button>
      </div>

      {/* 3 SOTTOSCHEDE CHIARE */}
      <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200 text-xs font-bold">
        <button
          onClick={() => setSottoTab('premi')}
          className={`flex-1 py-2 rounded-xl transition ${
            sottoTab === 'premi' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
          }`}
        >
          🎁 Ringraziamenti
        </button>
        <button
          onClick={() => setSottoTab('classifiche')}
          className={`flex-1 py-2 rounded-xl transition ${
            sottoTab === 'classifiche' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
          }`}
        >
          🏆 Macro-Aree
        </button>
        <button
          onClick={() => setSottoTab('giochi')}
          className={`flex-1 py-2 rounded-xl transition ${
            sottoTab === 'giochi' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
          }`}
        >
          🎮 Minigiochi
        </button>
      </div>

      {/* TAB 1: RINGRAZIAMENTI DI PAVIA */}
      {sottoTab === 'premi' && (
        <div className="space-y-3">
          <div className="bg-amber-50/80 rounded-3xl p-4 border border-amber-200/90 space-y-1 text-xs">
            <div className="font-black text-amber-950">💛 Ringraziamenti da Pavia</div>
            <p className="text-[11px] text-amber-900/90 leading-snug">
              Caffè, stampe e gadget offerti dai partner di Pavia e AVIS come ringraziamento per il tuo percorso da donatore.
            </p>
          </div>

          {catalogoPremiUniversitari.map((p) => {
            const riscattabile = gocceConoscenza >= p.costo;
            return (
              <div key={p.id} className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm space-y-2.5">
                <div className="flex items-start justify-between space-x-2">
                  <div>
                    <h4 className="text-xs font-black text-stone-900">{p.titolo}</h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">📍 {p.luogo}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-xl text-xs font-black shrink-0">
                    {p.costo.toLocaleString()} pt
                  </span>
                </div>
                <p className="text-xs text-stone-600 leading-snug">{p.desc}</p>
                <button
                  onClick={() => riscattaPremio(p)}
                  disabled={!riscattabile}
                  className={`w-full py-2.5 rounded-2xl text-xs font-black transition ${
                    riscattabile
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  {riscattabile ? `Usa in Cassa (${p.costo.toLocaleString()} pt)` : `Mancano ${(p.costo - gocceConoscenza).toLocaleString()} punti`}
                </button>
              </div>
            );
          })}

          {storicoBuoni.length > 0 && (
            <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm space-y-2">
              <h4 className="text-xs font-black text-stone-900">🧾 Buoni Convalidati</h4>
              <div className="space-y-1.5">
                {storicoBuoni.map((b) => (
                  <div key={b.txId} className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-[11px] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-black text-emerald-950 block truncate">{b.titolo}</span>
                      <span className="text-[10px] text-emerald-800 block">{b.txId} · {b.orario}</span>
                    </div>
                    <span className="font-black text-emerald-700 shrink-0">✓ Usato</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLASSIFICA 5 MACRO-GRUPPI PER STUDENTE ATTIVO + MIGLIOR CRESCITA */}
      {sottoTab === 'classifiche' && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-stone-900">
                Classifica Mensile Macro-Aree
              </h3>
              <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full shrink-0">
                La tua: #{miaPosizioneArea}
              </span>
            </div>

            {/* PREMI FINE MESE + PREMIO CHI MIGLIORA DI PIÙ */}
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-xs block">🥇 1ª Area (media)</span>
                <span className="text-[10px] font-black text-amber-900">+100 pt / stud.</span>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs block">🚀 Miglior Crescita</span>
                <span className="text-[10px] font-black text-emerald-900">+40 pt / stud. vs mese scorso</span>
              </div>
              <div className="p-2 rounded-xl bg-stone-100 border border-stone-200">
                <span className="text-xs block">🥈 2ª Area (media)</span>
                <span className="text-[10px] font-black text-stone-800">+55 pt / stud.</span>
              </div>
              <div className="p-2 rounded-xl bg-orange-50 border border-orange-200">
                <span className="text-xs block">🥉 3ª Area (media)</span>
                <span className="text-[10px] font-black text-orange-900">+25 pt / stud.</span>
              </div>
            </div>

            {/* COME SI CONTRIBUISCE ALLA PROPRIA MACRO-AREA (VERA SCALA: DONAZIONE SOPRA TUTTO) */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-2">
              <span className="text-[11px] font-black text-stone-900 block">
                ❓ Come fai salire la media della tua Macro-Area?
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="bg-white px-2.5 py-2 rounded-xl border border-stone-200/80 flex items-center justify-between gap-1">
                  <span className="font-bold text-stone-700 truncate">🩸 Donazione AVIS</span>
                  <span className="font-black text-rose-600 shrink-0">+100 pt</span>
                </div>
                <div className="bg-white px-2.5 py-2 rounded-xl border border-stone-200/80 flex items-center justify-between gap-1">
                  <span className="font-bold text-stone-700 truncate">🏥 Visita AVIS</span>
                  <span className="font-black text-emerald-700 shrink-0">+40 pt</span>
                </div>
                <div className="bg-white px-2.5 py-2 rounded-xl border border-stone-200/80 flex items-center justify-between gap-1">
                  <span className="font-bold text-stone-700 truncate">🤝 Tutor AVIS</span>
                  <span className="font-black text-amber-700 shrink-0">+35 pt</span>
                </div>
                <div className="bg-white px-2.5 py-2 rounded-xl border border-stone-200/80 flex items-center justify-between gap-1">
                  <span className="font-bold text-stone-700 truncate">🎮 Minigiochi</span>
                  <span className="font-black text-stone-800 shrink-0">1–2 pt (max 6/g)</span>
                </div>
              </div>
              <p className="text-[10px] text-stone-500 leading-snug">
                Classifica basata sulla media per studente attivo: riscattare premi non riduce il punteggio della tua area.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {classificaMacroAree.map((a, idx) => {
              const perc = Math.round((a.mediaPerStudente / maxMediaArea) * 100);
              const premioMensile = idx === 0 ? 100 : idx === 1 ? 55 : idx === 2 ? 25 : 0;
              const isMigliorCrescita = a.nome === migliorCrescitaNome;
              return (
                <div
                  key={a.nome}
                  className={`p-4 rounded-2xl border transition ${
                    a.isMio
                      ? 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-500/20'
                      : 'bg-white border-stone-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        idx === 0 ? 'bg-amber-100 text-amber-800'
                        : idx === 1 ? 'bg-stone-200 text-stone-700'
                        : idx === 2 ? 'bg-orange-100 text-orange-800'
                        : 'bg-stone-100 text-stone-500'
                      }`}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h4 className="text-xs font-black text-stone-900 leading-tight">{a.nome}</h4>
                          {a.isMio && (
                            <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-black shrink-0">
                              Tu
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <p className="text-[10px] text-stone-500">{a.studenti} stud. attivi</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${
                            a.crescitaPerc >= 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}>
                            {a.crescitaPerc >= 0 ? `+${a.crescitaPerc}%` : `${a.crescitaPerc}%`} vs mese scorso
                          </span>
                          {a.isMio && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded text-[9px] font-black">
                              Tuo contributo: +{contributoMacroArea} pt
                            </span>
                          )}
                          {premioMensile > 0 && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[9px] font-black">
                              +{premioMensile} pt/stud.
                            </span>
                          )}
                          {isMigliorCrescita && (
                            <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-black">
                              🚀 Miglior Crescita (+40 pt/stud.)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-stone-900 block">
                        {a.mediaPerStudente.toFixed(1)} pt/stud
                      </span>
                      <span className="text-[9px] text-stone-400 font-semibold block">
                        {a.puntiTotali.toLocaleString()} tot.
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full bg-stone-100 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${a.isMio ? 'bg-rose-600' : 'bg-stone-800'}`}
                      style={{ width: `${perc}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MINIGIOCHI INTERATTIVI (1-2 PT + TETTO 6 PT/GIORNO) */}
      {sottoTab === 'giochi' && (
        <div className="space-y-3">
          {/* Barra Tetto Giornaliero */}
          <div className="bg-white rounded-3xl p-3.5 border border-stone-200/80 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-stone-900">🎮 Punti giochi oggi</span>
              <span className={`font-black px-2 py-0.5 rounded-lg ${
                puntiGiochiOggi >= MAX_PUNTI_GIOCHI_GIORNO
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {puntiGiochiOggi} / {MAX_PUNTI_GIOCHI_GIORNO} pt
              </span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round((puntiGiochiOggi / MAX_PUNTI_GIOCHI_GIORNO) * 100))}%` }}
              />
            </div>
            <p className="text-[10px] text-stone-500 leading-snug">
              I minigiochi servono per imparare (1–2 pt, max {MAX_PUNTI_GIOCHI_GIORNO} pt al giorno): il vero salto arriva con <strong>Visita (+40 pt)</strong> e <strong>Donazione (+100 pt)</strong>.
            </p>
          </div>

          {/* Griglia 3x2: tutti i minigiochi visibili subito senza dover scorrere */}
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            {[
              { id: 'giornaliero', label: '🎯 Quiz Oggi' },
              { id: 'verofalso', label: '⚡ Vero/Falso' },
              { id: 'compatibilita', label: '🩸 Gruppi' },
              { id: 'zaino', label: '🎒 Zaino AVIS' },
              { id: 'parola', label: '🔤 Parola' },
              { id: 'memory', label: '🃏 Memory' }
            ].map((g) => (
              <button
                key={g.id}
                onClick={() => setGiocoAttivo(g.id)}
                className={`py-2.5 px-1.5 rounded-xl font-bold border text-center truncate transition ${
                  giocoAttivo === g.id
                    ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* GIOCO 1: QUIZ DEL GIORNO LEGATO ALLA DATA REALE */}
          {giocoAttivo === 'giornaliero' && (() => {
            const q = quizOggi[indiceGiornaliero] || quizOggi[0];
            const scelto = rispGiornaliere[q.id];
            const giaFatto = scelto !== undefined;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black text-stone-800">
                    Quiz del {oggiLeggibile} (+1 pt · +2 pt se 3/3)
                  </span>
                  {modalitaSviluppatore && (
                    <button
                      onClick={() => {
                        setOffsetGiorniQuizDev((d) => (d + 1) % 3);
                        setIndiceGiornaliero(0);
                      }}
                      className="text-[11px] font-bold text-rose-600 underline"
                    >
                      [DEV] Giorno successivo →
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3.5">
                  {/* Barra navigazione orizzontale avanti/indietro */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setIndiceGiornaliero((p) => Math.max(0, p - 1))}
                      disabled={indiceGiornaliero === 0}
                      className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition"
                    >
                      ←
                    </button>

                    <div className="flex items-center space-x-1.5">
                      {quizOggi.map((itemQ, idx) => {
                        const r = rispGiornaliere[itemQ.id];
                        const isCurr = idx === indiceGiornaliero;
                        return (
                          <button
                            key={itemQ.id}
                            onClick={() => setIndiceGiornaliero(idx)}
                            className={`h-2 rounded-full transition-all ${
                              isCurr
                                ? 'w-6 bg-stone-900'
                                : r === itemQ.corr
                                ? 'w-2.5 bg-emerald-500'
                                : r !== undefined
                                ? 'w-2.5 bg-rose-500'
                                : 'w-2.5 bg-stone-200'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setIndiceGiornaliero((p) => Math.min(quizOggi.length - 1, p + 1))}
                      disabled={indiceGiornaliero === quizOggi.length - 1}
                      className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition"
                    >
                      →
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                      Domanda {indiceGiornaliero + 1} di {quizOggi.length}
                    </span>
                    <h4 className="text-sm font-black text-stone-900 leading-snug">{q.q}</h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    {q.opts.map((opz, idx) => {
                      let cls = 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100';
                      if (giaFatto) {
                        if (idx === q.corr) cls = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
                        else if (idx === scelto) cls = 'bg-rose-50 border-rose-400 text-rose-900 line-through';
                        else cls = 'bg-stone-50 border-stone-200 text-stone-400';
                      }
                      return (
                        <button
                          key={idx}
                          disabled={giaFatto}
                          onClick={() => rispondiGiornaliero(q, idx)}
                          className={`w-full text-left p-3 rounded-2xl border-2 font-semibold transition ${cls}`}
                        >
                          {opz}
                        </button>
                      );
                    })}
                  </div>

                  {giaFatto && indiceGiornaliero < quizOggi.length - 1 && (
                    <button
                      onClick={() => setIndiceGiornaliero((p) => p + 1)}
                      className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black text-xs transition active:scale-95"
                    >
                      Domanda Successiva ({indiceGiornaliero + 2} di {quizOggi.length}) →
                    </button>
                  )}
                </div>

                <div className={`p-3.5 rounded-2xl border text-xs ${
                  quizGiornoPremiato ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-white border-stone-200 text-stone-700'
                }`}>
                  <span className="font-black block">
                    {quizGiornoPremiato
                      ? `✓ Quiz del giorno completato (${corretteOggiCount}/3 esatte)`
                      : `Completa le 3 domande di oggi (${oggiLeggibile})`}
                  </span>
                  <span className="text-[11px]">
                    {quizGiornoPremiato
                      ? 'Torna domani per le nuove domande del giorno.'
                      : 'Assegna +1 pt al completamento (o +2 pt con 3/3 risposte esatte).'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* GIOCO 2: VERO O FALSO PROGRESSIVO (+1 PT AL COMPLETAMENTO) */}
          {giocoAttivo === 'verofalso' && (() => {
            const item = sfideVeroFalso[indiceVF] || sfideVeroFalso[0];
            const risp = rispVeroFalso[item.id];
            return (
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIndiceVF((p) => Math.max(0, p - 1))}
                    disabled={indiceVF === 0}
                    className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition"
                  >
                    ←
                  </button>

                  <div className="flex items-center space-x-1.5">
                    {sfideVeroFalso.map((s, idx) => {
                      const r = rispVeroFalso[s.id];
                      const isCurr = idx === indiceVF;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setIndiceVF(idx)}
                          className={`h-2 rounded-full transition-all ${
                            isCurr
                              ? 'w-5 bg-stone-900'
                              : r === s.corr
                              ? 'w-2 bg-emerald-500'
                              : r !== undefined
                              ? 'w-2 bg-rose-500'
                              : 'w-2 bg-stone-200'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setIndiceVF((p) => Math.min(sfideVeroFalso.length - 1, p + 1))}
                    disabled={indiceVF === sfideVeroFalso.length - 1}
                    className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition"
                  >
                    →
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                      Vero / Falso • +1 pt (6 sfide)
                    </span>
                    <span className="text-[10px] font-bold text-stone-400">
                      Sfida {indiceVF + 1} di {sfideVeroFalso.length}
                    </span>
                  </div>
                  <p className="text-sm font-black text-stone-900 leading-snug">{item.testo}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {['Vero', 'Falso'].map((op) => (
                    <button
                      key={op}
                      disabled={risp !== undefined}
                      onClick={() => rispondiVF(item, op)}
                      className={`py-3 rounded-2xl text-sm font-black border-2 transition ${
                        risp !== undefined
                          ? item.corr === op
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : risp === op
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-stone-50 text-stone-400 border-stone-200'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>

                {risp && (
                  <div className="space-y-3">
                    <p className={`text-xs p-3 rounded-2xl border leading-relaxed ${
                      risp === item.corr
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}>
                      {item.spieg}
                    </p>
                    {indiceVF < sfideVeroFalso.length - 1 && (
                      <button
                        onClick={() => setIndiceVF((p) => p + 1)}
                        className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black text-xs transition active:scale-95"
                      >
                        Prossima Sfida ({indiceVF + 2} di {sfideVeroFalso.length}) →
                      </button>
                    )}
                  </div>
                )}

                {vfCompletato && (
                  <div className={`p-3 rounded-2xl border text-[11px] font-bold ${
                    vfCorretteCount >= 4 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-700'
                  }`}>
                    Hai completato le 6 sfide con {vfCorretteCount}/6 risposte corrette{vfCorretteCount >= 4 ? ' (+1 pt).' : ' (servono almeno 4/6 per +1 pt).'}
                  </div>
                )}
              </div>
            );
          })()}

          {/* GIOCO 3: COMPATIBILITÀ GRUPPI SANGUIGNI PROGRESSIVO (+1 PT AL COMPLETAMENTO) */}
          {giocoAttivo === 'compatibilita' && (() => {
            const c = casiCompatibilita[indiceCompat] || casiCompatibilita[0];
            const risp = rispCompatibilita[c.id];
            const fatto = risp !== undefined;
            return (
              <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-sm space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setIndiceCompat((p) => Math.max(0, p - 1))}
                    disabled={indiceCompat === 0}
                    className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition"
                  >
                    ←
                  </button>

                  <div className="flex items-center space-x-1.5">
                    {casiCompatibilita.map((caso, idx) => {
                      const r = rispCompatibilita[caso.id];
                      const isCurr = idx === indiceCompat;
                      return (
                        <button
                          key={caso.id}
                          onClick={() => setIndiceCompat(idx)}
                          className={`h-2 rounded-full transition-all ${
                            isCurr
                              ? 'w-5 bg-stone-900'
                              : r === caso.corr
                              ? 'w-2.5 bg-emerald-500'
                              : r !== undefined
                              ? 'w-2.5 bg-rose-500'
                              : 'w-2.5 bg-stone-200'
                          }`}
                        />
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setIndiceCompat((p) => Math.min(casiCompatibilita.length - 1, p + 1))}
                    disabled={indiceCompat === casiCompatibilita.length - 1}
                    className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 disabled:opacity-30 flex items-center justify-center font-black text-xs text-stone-700 transition"
                  >
                    →
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                      Caso Clinico • +1 pt (4 casi)
                    </span>
                    <span className="text-[10px] font-bold text-stone-400">
                      Caso {indiceCompat + 1} di {casiCompatibilita.length}
                    </span>
                  </div>
                  <p className="text-sm font-black text-stone-900 leading-snug">{c.domanda}</p>
                </div>

                <div className="space-y-2">
                  {c.opts.map((opt, idx) => (
                    <button
                      key={idx}
                      disabled={fatto}
                      onClick={() => rispondiCompat(c, idx)}
                      className={`w-full text-left p-3 rounded-2xl border-2 font-semibold transition ${
                        fatto
                          ? idx === c.corr
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                            : risp === idx
                            ? 'bg-rose-50 border-rose-400 text-rose-900 line-through'
                            : 'bg-stone-50 text-stone-400 border-stone-200'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {fatto && indiceCompat < casiCompatibilita.length - 1 && (
                  <button
                    onClick={() => setIndiceCompat((p) => p + 1)}
                    className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-black text-xs transition active:scale-95"
                  >
                    Caso Successivo ({indiceCompat + 2} di {casiCompatibilita.length}) →
                  </button>
                )}

                {compatCompletato && (
                  <div className={`p-3 rounded-2xl border text-[11px] font-bold ${
                    compatCorretteCount >= 3 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-700'
                  }`}>
                    Hai risolto i 4 casi con {compatCorretteCount}/4 risposte corrette{compatCorretteCount >= 3 ? ' (+1 pt).' : ' (servono almeno 3/4 per +1 pt).'}
                  </div>
                )}
              </div>
            );
          })()}

          {/* GIOCO 4: PREPARA LO ZAINO PER LA VISITA AVIS (+2 PT) */}
          {giocoAttivo === 'zaino' && (
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm space-y-3.5 text-xs">
              <div>
                <h3 className="text-sm font-black text-stone-900">
                  Prepara lo Zaino per la Visita AVIS (+2 pt)
                </h3>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Seleziona esattamente i <strong>4 oggetti utili</strong> ed evita i 3 sbagliati prima di uscire di casa!
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {oggettiZaino.map((obj) => {
                  const scelto = zainoScelti.includes(obj.id);
                  return (
                    <button
                      key={obj.id}
                      onClick={() => toggleZaino(obj)}
                      className={`p-3 rounded-2xl border flex items-center justify-between font-bold transition ${
                        zainoCompletato
                          ? obj.giusto
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                            : 'bg-stone-50 text-stone-400 border-stone-200'
                          : scelto
                          ? 'bg-rose-50 border-rose-500 text-rose-900'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700'
                      }`}
                    >
                      <span>{obj.label}</span>
                      <span className="text-xs font-black">
                        {scelto ? '✓ Scelto' : '+ Metti'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={verificaZaino}
                disabled={zainoCompletato}
                className={`w-full py-3 rounded-2xl font-black text-xs transition ${
                  zainoCompletato
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-900 hover:bg-stone-800 text-white'
                }`}
              >
                {zainoCompletato ? 'Zaino Completo! (+2 pt oggi ✓)' : `Verifica Zaino (${zainoScelti.length}/4 selezionati)`}
              </button>
            </div>
          )}

          {/* GIOCO 5: PAROLA MISTERIOSA EMATICA (+1 PT A PAROLA) */}
          {giocoAttivo === 'parola' && (
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                  Parola {indiceParola + 1} di 4 · +1 pt
                </span>
                <button
                  onClick={() => {
                    setIndiceParola((prev) => (prev + 1) % paroleMisteriose.length);
                    setInputParola('');
                  }}
                  className="text-[11px] font-bold text-stone-500 underline"
                >
                  Cambia parola →
                </button>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <p className="font-bold text-stone-800 leading-snug">
                  💡 {parolaAttuale.indizio}
                </p>
                <div className="flex space-x-1 justify-center pt-1">
                  {parolaAttuale.parola.split('').map((l, i) => (
                    <span
                      key={i}
                      className="w-6 h-7 rounded-lg bg-white border border-stone-300 flex items-center justify-center font-mono font-black text-stone-900"
                    >
                      {paroleIndovinate[parolaAttuale.parola] || i === 0 ? l : '_'}
                    </span>
                  ))}
                </div>
              </div>

              {!paroleIndovinate[parolaAttuale.parola] ? (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={inputParola}
                    onChange={(e) => setInputParola(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && verificaParola()}
                    placeholder="Scrivi la parola..."
                    className="flex-1 px-3 py-2.5 bg-stone-100 rounded-xl font-bold uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    onClick={verificaParola}
                    className="px-4 py-2.5 bg-rose-600 text-white rounded-xl font-black"
                  >
                    Verifica
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 text-emerald-800 font-black rounded-xl text-center">
                  ✓ Indovinata! (+1 pt aggiunto)
                </div>
              )}
            </div>
          )}

          {/* GIOCO 6: MEMORY EMATICO (+2 PT, 1 VOLTA AL GIORNO) */}
          {giocoAttivo === 'memory' && (
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-stone-900">
                  Abbina le 4 Coppie (+2 pt{memoryPremiato ? ' · Già preso oggi' : ''})
                </h3>
                <button
                  onClick={() => {
                    setIndovinate([]);
                    setScoperte([]);
                    setCarte(mescolaCarte(carteIniziali));
                  }}
                  className="text-xs font-bold text-rose-600"
                >
                  Mescola ↻
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {carte.map((c) => {
                  const visibile = scoperte.includes(c.id) || indovinate.includes(c.coppiaId);
                  return (
                    <button
                      key={c.id}
                      onClick={() => giraCarta(c)}
                      className={`h-16 rounded-2xl border text-[11px] font-black p-1 transition flex items-center justify-center text-center ${
                        visibile ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-stone-100 border-stone-200 text-stone-400'
                      }`}
                    >
                      {visibile ? c.label : '?'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {couponAttivo && (
        <ModaleCouponLive
          coupon={couponAttivo}
          modalitaSviluppatore={modalitaSviluppatore}
          onConvalidaDefinitiva={convalidaBuonoInCassa}
          onClose={() => setCouponAttivo(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// SCHERMATA PERSONALIZZAZIONE GOCCIA (STANZA + PIEDISTALLO + GRIGLIA MINIATURE)
// ============================================================================
function ModalePersonalizzaAvatar({
  avatar,
  setAvatar,
  vestiSbloccate,
  setVestiSbloccate,
  accessoriSbloccati,
  gocceTotali,
  setGocceTotali,
  modalitaSviluppatore,
  onClose,
  mostraNotifica
}) {
  const [bozzaAvatar, setBozzaAvatar] = useState(() => ({ ...avatar }));
  const [anteprimaBloccata, setAnteprimaBloccata] = useState(null);

  const catalogoTesta = [
    { id: 'nessuno', nome: 'Nessuno', costo: 0 },
    { id: 'capelli_corti', nome: 'Capelli Corti', costo: 0 },
    { id: 'capelli_lunghi', nome: 'Capelli Lunghi', costo: 0 },
    { id: 'chignon_cap', nome: 'Chignon PV', costo: 20 },
    { id: 'cappellino_baseball_unipv', nome: 'Cappellino PV', costo: 20 },
    { id: 'berretto_unipv', nome: 'Berretto UNIPV', costo: 25 },
    { id: 'cappellino_navy_unipv', nome: 'Cap 1361 Blu', costo: 25 },
    { id: 'feluca_rossa', nome: 'Feluca Rossa', costo: 35 },
    { id: 'feluca_blu', nome: 'Feluca Blu', costo: 35 },
    { id: 'corona_alloro', nome: 'Corona Alloro', costo: 80 },
    { id: 'tocco_laurea', nome: 'Tocco Laurea', costo: 100 }
  ];

  const espressioni = [
    { id: 'sorridente', nome: 'Sorridente' },
    { id: 'entusiasta', nome: 'Felice' },
    { id: 'grintosa', nome: 'Energica' },
    { id: 'occhietto', nome: 'Occhietto' },
    { id: 'concentrata', nome: 'Studio' }
  ];

  const catalogoAbiti = [
    { id: 'nessuno', nome: 'Base', costo: 0 },
    { id: 'felpa_cappuccio_bordeaux', nome: 'Felpa UNIPV', costo: 25 },
    { id: 'camice_med', nome: 'Camice', costo: 30 },
    { id: 'tshirt_bordeaux', nome: 'T-Shirt Bordeaux', costo: 30 },
    { id: 'felpa_girocollo_blu', nome: 'Girocollo Blu', costo: 35 },
    { id: 'tshirt_1361_bianca', nome: 'T-Shirt 1361', costo: 35 },
    { id: 'polo_unipv_bordeaux', nome: 'Polo UNIPV', costo: 45 },
    { id: 'sciarpa_unipv', nome: 'Sciarpa UNIPV', costo: 55 },
    { id: 'giacca_unipv_college', nome: 'Giacca College', costo: 70 },
    { id: 'toga_laurea', nome: 'Toga Laurea', costo: 110 }
  ];

  const catalogoAccessori = [
    { id: 'nessuno', nome: 'Nessuno', costo: 0 },
    { id: 'cancelleria_unipv', nome: 'Libro / Quaderno', costo: 20 },
    { id: 'stetoscopio', nome: 'Stetoscopio', costo: 25 },
    { id: 'mug_unipv', nome: 'Mug 1361', costo: 30 },
    { id: 'borraccia_unipv', nome: 'Borraccia', costo: 40 },
    { id: 'shopper_unipv', nome: 'Shopper Bag', costo: 50 },
    { id: 'zaino_unipv', nome: 'Zaino Campus', costo: 60 },
    { id: 'laptop', nome: 'Laptop Studio', costo: 85 },
    { id: 'spilla_portachiavi', nome: 'Spilla UNIPV', costo: 15 }
  ];

  const catalogoViso = [
    { id: 'nessuno', nome: 'Pulito', costo: 0 },
    { id: 'cerotto', nome: 'Cerottino', costo: 0 },
    { id: 'occhiali_studio', nome: 'Occhiali Studio', costo: 20 },
    { id: 'occhiali_sole', nome: 'Occhiali Sole', costo: 35 }
  ];

  const catalogoColori = [
    { id: 'rubino', nome: 'Rubino', costo: 0, hex: '#E11D48' },
    { id: 'amarena', nome: 'Amarena', costo: 25, hex: '#9F1239' },
    { id: 'plasma', nome: 'Oro Plasma', costo: 40, hex: '#F59E0B' },
    { id: 'corallo', nome: 'Corallo', costo: 50, hex: '#F43F5E' },
    { id: 'imperiale', nome: 'Cremisi', costo: 75, hex: '#881337' }
  ];

  const isSbloccato = (prefisso, item) => {
    const token = `${prefisso}:${item.id}`;
    return item.costo === 0 || vestiSbloccate.includes(token) || accessoriSbloccati.includes(token);
  };

  const selezionaElemento = (chiaveConfig, prefisso, item) => {
    if (isSbloccato(prefisso, item)) {
      setBozzaAvatar((prev) => ({ ...prev, [chiaveConfig]: item.id }));
      setAnteprimaBloccata(null);
    } else {
      setAnteprimaBloccata({ chiaveConfig, prefisso, item });
    }
  };

  const sbloccaElementoSelezionato = () => {
    if (!anteprimaBloccata) return;
    const { chiaveConfig, prefisso, item } = anteprimaBloccata;
    if (gocceTotali < item.costo) {
      mostraNotifica('Punti insufficienti', `Servono ${item.costo} punti per sbloccare ${item.nome}.`, 0);
      return;
    }
    const token = `${prefisso}:${item.id}`;
    setGocceTotali((prev) => prev - item.costo);
    setVestiSbloccate((prev) => [...prev, token]);
    setBozzaAvatar((prev) => ({ ...prev, [chiaveConfig]: item.id }));
    setAnteprimaBloccata(null);
    mostraNotifica('Oggetto Sbloccato! ✨', item.nome, -item.costo);
  };

  const salvaModifiche = () => {
    setAvatar(bozzaAvatar);
    mostraNotifica('Goccia Salvata! ✓', 'Il nuovo stile è attivo sul tuo profilo.', 0);
    onClose();
  };

  const avatarLive = anteprimaBloccata
    ? { ...bozzaAvatar, [anteprimaBloccata.chiaveConfig]: anteprimaBloccata.item.id }
    : bozzaAvatar;

  const renderMiniatura = (cat, id) => {
    if (id === 'nessuno') {
      return (
        <svg viewBox="0 0 40 40" className="w-8 h-8">
          <circle cx="20" cy="20" r="12" fill="none" stroke="#CBD5E1" strokeWidth="2.2" />
          <line x1="12" y1="28" x2="28" y2="12" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    }

    if (cat === 'testa') {
      if (id === 'capelli_corti') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M6 26 C5 15, 16 10, 21 13 C26 9, 35 14, 34 26 C29 21, 24 23, 20 20 C15 24, 10 22, 6 26 Z" fill="#7C4327" stroke="#532B17" strokeWidth="1.4" />
          </svg>
        );
      }
      if (id === 'capelli_lunghi') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M8 31 C4 22, 7 10, 20 9 C33 10, 36 22, 32 31 C28 27, 29 19, 20 18 C11 19, 12 27, 8 31 Z" fill="#7C4327" stroke="#532B17" strokeWidth="1.4" />
          </svg>
        );
      }
      if (id === 'chignon_cap') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <circle cx="25" cy="11" r="6" fill="#7C4327" stroke="#532B17" strokeWidth="1.2" />
            <path d="M9 26 C10 15, 29 15, 30 26 Z" fill="#7C4327" stroke="#532B17" strokeWidth="1.2" />
            <path d="M6 26 Q20 22 35 28 L31 30 Q20 26 6 26 Z" fill="#532B17" />
            <text x="19" y="23" textAnchor="middle" fontSize="6" fontWeight="900" fill="#FDE68A" fontFamily="sans-serif">PV</text>
          </svg>
        );
      }
      if (id === 'cappellino_baseball_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M9 25 C10 13, 30 13, 31 25 Z" fill="#7F1D3A" stroke="#4C0519" strokeWidth="1.3" />
            <path d="M7 25 Q22 21 36 27 L32 29 Q21 26 7 25 Z" fill="#4C0519" />
            <text x="20" y="22" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#FDE68A" fontFamily="sans-serif">PV</text>
          </svg>
        );
      }
      if (id === 'berretto_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M9 24 C10 11, 30 11, 31 24 Z" fill="#6B142F" stroke="#4C0519" strokeWidth="1.3" />
            <rect x="7" y="22" width="26" height="7" rx="3" fill="#7F1D3A" stroke="#4C0519" strokeWidth="1.2" />
            <text x="20" y="27.5" textAnchor="middle" fontSize="5.2" fontWeight="900" fill="#FDE68A" fontFamily="sans-serif">UNIPV</text>
          </svg>
        );
      }
      if (id === 'cappellino_navy_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M9 25 C10 13, 30 13, 31 25 Z" fill="#1E3A5F" stroke="#0F172A" strokeWidth="1.3" />
            <path d="M7 25 Q22 21 36 27 L32 29 Q21 26 7 25 Z" fill="#0F172A" />
            <text x="20" y="22" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="#FFFFFF" fontFamily="sans-serif">1361</text>
          </svg>
        );
      }
      if (id === 'feluca_rossa' || id === 'feluca_blu') {
        const fillCol = id === 'feluca_rossa' ? '#B91C1C' : '#1D4ED8';
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M5 26 L21 10 L35 23 L29 29 Q20 25 9 29 Z" fill={fillCol} stroke="#1E293B" strokeWidth="1.2" />
            <path d="M9 27 Q20 23 30 27" stroke="#FDE047" strokeWidth="2" fill="none" />
          </svg>
        );
      }
      if (id === 'corona_alloro') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M12 29 C6 22, 9 12, 18 11 C13 16, 12 22, 15 29 Z" fill="#15803D" />
            <path d="M28 29 C34 22, 31 12, 22 11 C27 16, 28 22, 25 29 Z" fill="#15803D" />
            <circle cx="11" cy="20" r="2" fill="#DC2626" />
            <circle cx="29" cy="20" r="2" fill="#DC2626" />
          </svg>
        );
      }
      if (id === 'tocco_laurea') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <polygon points="20,9 35,16 20,23 5,16" fill="#0F172A" />
            <rect x="13" y="20" width="14" height="6" fill="#1E293B" />
            <path d="M20 16 L31 22 L31 30" stroke="#F59E0B" strokeWidth="2" fill="none" />
          </svg>
        );
      }
    }

    if (cat === 'espressione') {
      return (
        <svg viewBox="0 0 40 40" className="w-9 h-9">
          <circle cx="20" cy="20" r="14" fill="#FDE047" stroke="#B45309" strokeWidth="1.6" />
          {id === 'sorridente' && (
            <g>
              <circle cx="15" cy="17" r="1.8" fill="#1C1917" />
              <circle cx="25" cy="17" r="1.8" fill="#1C1917" />
              <path d="M14 23 Q20 28 26 23" stroke="#1C1917" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
          )}
          {id === 'entusiasta' && (
            <g>
              <circle cx="15" cy="16" r="1.8" fill="#1C1917" />
              <circle cx="25" cy="16" r="1.8" fill="#1C1917" />
              <path d="M13 22 Q20 30 27 22 Z" fill="#FFFFFF" stroke="#1C1917" strokeWidth="1.5" />
            </g>
          )}
          {id === 'grintosa' && (
            <g>
              <path d="M12 14 L17 17 L12 20" stroke="#1C1917" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M28 14 L23 17 L28 20" stroke="#1C1917" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 23 Q20 29 26 23 Z" fill="#FFFFFF" stroke="#1C1917" strokeWidth="1.5" />
            </g>
          )}
          {id === 'occhietto' && (
            <g>
              <circle cx="15" cy="17" r="1.8" fill="#1C1917" />
              <path d="M22 17 Q25 14 28 17" stroke="#1C1917" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M15 24 Q20 27 25 23" stroke="#1C1917" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
          )}
          {id === 'concentrata' && (
            <g>
              <circle cx="15" cy="18" r="1.8" fill="#1C1917" />
              <circle cx="25" cy="18" r="1.8" fill="#1C1917" />
              <line x1="12" y1="13" x2="18" y2="15" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="28" y1="13" x2="22" y2="15" stroke="#1C1917" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="16" y1="25" x2="24" y2="25" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
            </g>
          )}
        </svg>
      );
    }

    if (cat === 'abiti') {
      if (id === 'felpa_cappuccio_bordeaux') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M12 10 Q20 6 28 10 L34 17 L30 22 L28 19 L28 33 L12 33 L12 19 L10 22 L6 17 Z" fill="#6B142F" stroke="#4C0519" strokeWidth="1.3" />
            <line x1="18" y1="13" x2="18" y2="20" stroke="#FFFFFF" strokeWidth="1.3" />
            <line x1="22" y1="13" x2="22" y2="20" stroke="#FFFFFF" strokeWidth="1.3" />
            <rect x="15" y="23" width="10" height="3.5" rx="1" fill="#FDE68A" />
          </svg>
        );
      }
      if (id === 'camice_med') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M12 10 L28 10 L33 17 L29 21 L28 19 L28 33 L12 33 L12 19 L11 21 L7 17 Z" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.4" />
            <polygon points="16,10 20,21 24,10" fill="#38BDF8" />
            <line x1="20" y1="21" x2="20" y2="33" stroke="#94A3B8" strokeWidth="1.2" />
          </svg>
        );
      }
      if (id === 'tshirt_bordeaux' || id === 'tshirt_1361_bianca') {
        const bg = id === 'tshirt_bordeaux' ? '#881337' : '#FFFFFF';
        const st = id === 'tshirt_bordeaux' ? '#4C0519' : '#CBD5E1';
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M13 10 Q20 14 27 10 L34 16 L30 21 L27 19 L27 32 L13 32 L13 19 L10 21 L6 16 Z" fill={bg} stroke={st} strokeWidth="1.3" />
          </svg>
        );
      }
      if (id === 'felpa_girocollo_blu' || id === 'giacca_unipv_college') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M12 10 Q20 14 28 10 L34 17 L30 22 L28 19 L28 33 L12 33 L12 19 L10 22 L6 17 Z" fill="#1E3A5F" stroke="#0F172A" strokeWidth="1.3" />
            <circle cx="20" cy="22" r="4" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1" />
          </svg>
        );
      }
      if (id === 'polo_unipv_bordeaux') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M12 10 L28 10 L34 16 L30 21 L27 19 L27 33 L13 33 L13 19 L10 21 L6 16 Z" fill="#881337" />
            <polygon points="14,10 20,16 17,10" fill="#FFFFFF" />
            <polygon points="26,10 20,16 23,10" fill="#FFFFFF" />
          </svg>
        );
      }
      if (id === 'sciarpa_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <rect x="9" y="10" width="22" height="9" rx="3" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1.2" />
            <rect x="21" y="17" width="8" height="16" rx="2" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1.2" />
          </svg>
        );
      }
      if (id === 'toga_laurea') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M12 9 L28 9 L33 33 L7 33 Z" fill="#0F172A" />
            <path d="M15 9 L20 27 L25 9" fill="none" stroke="#F59E0B" strokeWidth="2.5" />
          </svg>
        );
      }
    }

    if (cat === 'accessori') {
      if (id === 'cancelleria_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <rect x="10" y="8" width="20" height="24" rx="2.5" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="1.4" />
            <rect x="14" y="13" width="12" height="4" rx="1" fill="#FDE68A" />
          </svg>
        );
      }
      if (id === 'stetoscopio') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M12 10 C12 24, 28 24, 28 10" fill="none" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="20" y1="21" x2="20" y2="29" stroke="#1E293B" strokeWidth="2.5" />
            <circle cx="20" cy="30" r="3.5" fill="#CBD5E1" stroke="#334155" strokeWidth="1.4" />
          </svg>
        );
      }
      if (id === 'zaino_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M15 11 C15 6, 25 6, 25 11" stroke="#0F172A" strokeWidth="2" fill="none" />
            <rect x="10" y="11" width="20" height="23" rx="5" fill="#1E3A5F" stroke="#0F172A" strokeWidth="1.3" />
            <rect x="13" y="21" width="14" height="9" rx="2.5" fill="#E11D48" />
          </svg>
        );
      }
      if (id === 'laptop') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <rect x="8" y="11" width="24" height="15" rx="2" fill="#334155" stroke="#94A3B8" strokeWidth="1.3" />
            <rect x="10.5" y="13.5" width="19" height="10" rx="1" fill="#38BDF8" />
            <polygon points="5,26 35,26 37,30 3,30" fill="#64748B" />
          </svg>
        );
      }
      if (id === 'mug_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <rect x="10" y="12" width="16" height="18" rx="2.5" fill="#FFFFFF" stroke="#7F1D3A" strokeWidth="1.6" />
            <rect x="10.5" y="18" width="15" height="5" fill="#7F1D3A" />
            <path d="M26 15 C32 15, 32 26, 26 26" stroke="#7F1D3A" strokeWidth="2" fill="none" />
          </svg>
        );
      }
      if (id === 'borraccia_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <rect x="14" y="11" width="12" height="23" rx="3.5" fill="#7F1D3A" stroke="#CBD5E1" strokeWidth="1.2" />
            <rect x="16" y="6" width="8" height="5" rx="1.5" fill="#CBD5E1" />
            <circle cx="20" cy="21" r="2.8" fill="#FDE68A" />
          </svg>
        );
      }
      if (id === 'shopper_unipv') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <path d="M15 14 C15 8, 25 8, 25 14" stroke="#B45309" strokeWidth="1.8" fill="none" />
            <rect x="10" y="14" width="20" height="20" rx="2" fill="#F5F0E6" stroke="#D6C7AE" strokeWidth="1.4" />
            <circle cx="20" cy="23" r="3.5" fill="#7F1D3A" />
          </svg>
        );
      }
      if (id === 'spilla_portachiavi') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <circle cx="20" cy="20" r="10" fill="#7F1D3A" stroke="#FDE68A" strokeWidth="2" />
            <circle cx="20" cy="20" r="3.5" fill="#FDE68A" />
          </svg>
        );
      }
    }

    if (cat === 'viso') {
      if (id === 'cerotto') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <g transform="rotate(-20 20 20)">
              <rect x="8" y="15" width="24" height="10" rx="4" fill="#FFE4E6" stroke="#FB7185" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="2" fill="#FB7185" />
            </g>
          </svg>
        );
      }
      if (id === 'occhiali_studio') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <circle cx="13" cy="20" r="6" fill="none" stroke="#1E293B" strokeWidth="2.2" />
            <circle cx="27" cy="20" r="6" fill="none" stroke="#1E293B" strokeWidth="2.2" />
            <line x1="19" y1="20" x2="21" y2="20" stroke="#1E293B" strokeWidth="2.2" />
          </svg>
        );
      }
      if (id === 'occhiali_sole') {
        return (
          <svg viewBox="0 0 40 40" className="w-9 h-9">
            <rect x="6" y="15" width="12" height="9" rx="3" fill="#0F172A" />
            <rect x="22" y="15" width="12" height="9" rx="3" fill="#0F172A" />
            <line x1="18" y1="18" x2="22" y2="18" stroke="#0F172A" strokeWidth="2.2" />
          </svg>
        );
      }
    }

    return null;
  };

  const renderGriglia = (lista, cat, chiaveConfig, prefisso) => (
    <div className="grid grid-cols-5 gap-2">
      {lista.map((item) => {
        const sbloccato = isSbloccato(prefisso, item);
        const selezionato = avatarLive[chiaveConfig] === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.nome}
            onClick={() => selezionaElemento(chiaveConfig, prefisso, item)}
            className={`relative aspect-square rounded-2xl border-2 flex items-center justify-center transition p-1 ${
              selezionato
                ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/30 shadow-sm'
                : sbloccato
                ? 'bg-stone-50 border-stone-200 hover:border-stone-300'
                : 'bg-stone-100/90 border-stone-200/80 opacity-85 hover:opacity-100'
            }`}
          >
            <div className={sbloccato ? '' : 'opacity-65'}>
              {renderMiniatura(cat, item.id)}
            </div>
            {!sbloccato && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#222845] text-white text-[8px] font-black shadow">
                🔒{item.costo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 bg-[#FDF3EC] flex flex-col overflow-hidden">
      {/* HEADER CORALLO IN STILE MOCKUP */}
      <div className="bg-[#EE5D52] text-white px-4 py-3 safe-top flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center font-black text-sm transition"
          >
            ←
          </button>
          <h3 className="text-sm font-black tracking-tight">Personalizza il tuo Avatar</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center font-black text-xs transition"
        >
          ✕
        </button>
      </div>

      {/* PALCO STANZA UNIVERSITARIA + PIEDISTALLO + GOCCIA GRANDE */}
      <div className="relative shrink-0 bg-gradient-to-b from-[#FFF3EA] via-[#FCE6D9] to-[#F5DBD0] px-4 pt-2.5 pb-3 overflow-hidden">
        {/* Decorazioni stanza leggere sullo sfondo */}
        <div className="pointer-events-none absolute inset-0 opacity-35">
          <svg viewBox="0 0 400 180" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
            <rect x="20" y="18" width="52" height="72" rx="6" fill="#FFFFFF" />
            <circle cx="275" cy="40" r="14" fill="#FFFFFF" stroke="#FDA4AF" strokeWidth="3" />
            <line x1="275" y1="40" x2="275" y2="33" stroke="#9F1239" strokeWidth="2" />
            <line x1="275" y1="40" x2="281" y2="42" stroke="#9F1239" strokeWidth="2" />
            <rect x="315" y="42" width="62" height="90" rx="6" fill="#E7C2B0" />
            <rect x="322" y="54" width="12" height="22" rx="2" fill="#FB7185" />
            <rect x="336" y="58" width="10" height="18" rx="2" fill="#38BDF8" />
            <rect x="348" y="52" width="12" height="24" rx="2" fill="#FACC15" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          {/* Goccia in piedi sul piedistallo colorato */}
          <div className="relative flex flex-col items-center">
            <div className="z-10 -mb-4">
              <CustomAvatar config={avatarLive} size="stage" frameless={true} />
            </div>
            {/* Piedistallo a 3 fasce stile mockup */}
            <div className="w-40 h-5 rounded-full bg-white border-2 border-amber-200 shadow-sm relative z-0" />
            <div className="w-44 h-3 -mt-2 rounded-b-xl bg-gradient-to-r from-rose-400 via-amber-300 to-sky-400 shadow-md" />
          </div>

          {/* Barra punti stile mockup + bottone demo solo in modalità sviluppatore */}
          <div className="mt-2.5 flex items-center space-x-2">
            <span className="px-3.5 py-1 rounded-full bg-[#222845] text-white text-[11px] font-black shadow">
              PUNTI ATTIVI: {gocceTotali.toLocaleString()}
            </span>
            {modalitaSviluppatore && (
              <button
                type="button"
                onClick={() => {
                  setGocceTotali((p) => p + 50);
                  mostraNotifica('[DEV] +50 pt aggiunti!', 'Ora puoi provare a sbloccare gli oggetti.', 50);
                }}
                className="px-2.5 py-1 rounded-full bg-white/90 hover:bg-white text-amber-900 border border-amber-300 text-[10px] font-black shadow-sm transition"
              >
                [DEV] 🧪 +50 pt
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BARRA SBLOCCO RAPIDO QUANDO SI TOCCA UN OGGETTO BLOCCATO */}
      {anteprimaBloccata && (
        <div className="bg-[#222845] text-white px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-amber-300 uppercase block">Anteprima Oggetto Bloccato</span>
            <span className="text-xs font-black truncate block">
              🔒 {anteprimaBloccata.item.nome} · {anteprimaBloccata.item.costo} pt
            </span>
          </div>
          <button
            type="button"
            onClick={sbloccaElementoSelezionato}
            className={`px-3.5 py-2 rounded-xl text-[11px] font-black shrink-0 transition ${
              gocceTotali >= anteprimaBloccata.item.costo
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow'
                : 'bg-stone-700 text-stone-300'
            }`}
          >
            Sblocca ({anteprimaBloccata.item.costo} pt)
          </button>
        </div>
      )}

      {/* PANNELLO BIANCO SCROLLABILE A GRIGLIE DI MINIATURE */}
      <div className="flex-1 overflow-y-auto overscroll-contain bg-white rounded-t-[1.75rem] shadow-[0_-6px_20px_rgba(0,0,0,0.06)] px-4 pt-4 pb-4 space-y-4">
        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
            Capelli & Copricapi
          </span>
          {renderGriglia(catalogoTesta, 'testa', 'copricapo', 'ts')}
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
            Espressione
          </span>
          <div className="grid grid-cols-5 gap-2">
            {espressioni.map((e) => {
              const attiva = avatarLive.espressione === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  title={e.nome}
                  onClick={() => {
                    setBozzaAvatar((prev) => ({ ...prev, espressione: e.id }));
                    setAnteprimaBloccata(null);
                  }}
                  className={`aspect-square rounded-2xl border-2 flex items-center justify-center transition p-1 ${
                    attiva
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/40 shadow-sm'
                      : 'bg-stone-50 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {renderMiniatura('espressione', e.id)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
            Abbigliamento
          </span>
          {renderGriglia(catalogoAbiti, 'abiti', 'abbigliamento', 'ab')}
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
            Accessori
          </span>
          {renderGriglia(catalogoAccessori, 'accessori', 'oggettoStudio', 'st')}
        </div>

        <div className="grid grid-cols-1 gap-4 pt-1">
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
              Occhiali & Dettagli Viso
            </span>
            <div className="grid grid-cols-4 gap-2">
              {catalogoViso.map((item) => {
                const sbloccato = isSbloccato('vs', item);
                const selezionato = avatarLive.visoAccessorio === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.nome}
                    onClick={() => selezionaElemento('visoAccessorio', 'vs', item)}
                    className={`relative h-14 rounded-2xl border-2 flex items-center justify-center transition p-1 ${
                      selezionato
                        ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/30'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div className={sbloccato ? '' : 'opacity-65'}>
                      {renderMiniatura('viso', item.id)}
                    </div>
                    {!sbloccato && (
                      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#222845] text-white text-[8px] font-black">
                        🔒{item.costo}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
              Colore Goccia
            </span>
            <div className="grid grid-cols-5 gap-2">
              {catalogoColori.map((item) => {
                const sbloccato = isSbloccato('cl', item);
                const selezionato = avatarLive.coloreGoccia === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.nome}
                    onClick={() => selezionaElemento('coloreGoccia', 'cl', item)}
                    className={`relative h-12 rounded-2xl border-2 flex items-center justify-center transition ${
                      selezionato
                        ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/30'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: item.hex }}
                    />
                    {!sbloccato && (
                      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#222845] text-white text-[8px] font-black">
                        🔒{item.costo}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER CON 2 BOTTONI STILE MOCKUP: SALVA MODIFICHE + TORNA ALL'APP */}
      <div className="px-4 py-3 safe-bottom bg-white border-t border-stone-200 grid grid-cols-2 gap-2.5 shrink-0">
        <button
          type="button"
          onClick={salvaModifiche}
          className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black shadow-md shadow-emerald-500/20 active:scale-95 transition"
        >
          SALVA MODIFICHE
        </button>
        <button
          type="button"
          onClick={onClose}
          className="py-3 bg-[#EE5D52] hover:bg-rose-600 text-white rounded-2xl text-xs font-black shadow-md shadow-rose-500/20 active:scale-95 transition"
        >
          TORNA ALL'APP
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MASCOTTE SACCA DI SANGUE CON TOCCO UNIPV (SVG LEGGERO ISPIRATO AL LOGO)
// ============================================================================
function SaccaMascotte({ posa = 'stelle', size = 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-11' : size === 'lg' ? 'w-20 h-24' : 'w-14 h-16';
  return (
    <svg viewBox="0 0 100 120" className={`${dim} overflow-visible select-none shrink-0`}>
      <defs>
        <linearGradient id="saccaBloodGrad" x1="20%" y1="15%" x2="80%" y2="90%">
          <stop offset="0%" stopColor="#E11D48" />
          <stop offset="55%" stopColor="#B91C1C" />
          <stop offset="100%" stopColor="#7F1D1D" />
        </linearGradient>
      </defs>

      {/* Stelline decorative in posa Home */}
      {posa === 'stelle' && (
        <g fill="#FACC15" stroke="#B45309" strokeWidth="1">
          <polygon points="10,28 12,33 17,34 13,37 14,42 10,39 6,42 7,37 3,34 8,33" />
          <polygon points="88,45 90,49 94,50 91,53 92,57 88,55 84,57 85,53 82,50 86,49" />
        </g>
      )}

      {/* Gambette */}
      <path d="M38 97 L38 111 L32 111" stroke="#450A0A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M62 97 L62 111 L68 111" stroke="#450A0A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* Braccine */}
      <path
        d={posa === 'dito' || posa === 'stelle' ? 'M24 67 Q11 58 14 45' : 'M24 69 Q13 76 16 84'}
        stroke="#450A0A"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={posa === 'occhiolino' ? 'M76 67 Q89 58 86 46' : 'M76 69 Q87 76 84 84'}
        stroke="#450A0A"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Beccucci inferiori della sacca */}
      <rect x="43" y="96" width="5" height="7" rx="1.5" fill="#F8FAFC" stroke="#450A0A" strokeWidth="1.6" />
      <rect x="52" y="96" width="5" height="7" rx="1.5" fill="#F8FAFC" stroke="#450A0A" strokeWidth="1.6" />

      {/* Tubicino superiore */}
      <rect x="46" y="13" width="8" height="10" rx="2" fill="#F8FAFC" stroke="#450A0A" strokeWidth="1.8" />

      {/* Involucro trasparente esterno sacca */}
      <rect x="22" y="21" width="56" height="76" rx="16" fill="#FFF1F2" stroke="#450A0A" strokeWidth="2.6" />

      {/* Liquido sangue interno con onda superiore */}
      <path
        d="M26 42 Q38 36 50 41 Q62 46 74 40 L74 84 C74 90, 69 93, 62 93 L38 93 C31 93, 26 90, 26 84 Z"
        fill="url(#saccaBloodGrad)"
      />
      {/* Riflesso lucido */}
      <path d="M31 46 L31 78" stroke="#FFE4E6" strokeWidth="3" strokeLinecap="round" opacity="0.55" />

      {/* Tocco da Laurea UniPv inclinato in alto a destra (come nel logo) */}
      <g transform="rotate(14 66 20)">
        <polygon points="62,6 91,14 62,22 33,14" fill="#7F1D3A" stroke="#450A0A" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M47 18 L47 25 Q62 29 77 25 L77 18" fill="#6B142F" stroke="#450A0A" strokeWidth="1.6" />
        <path d="M77 15 L85 25 L85 33" stroke="#F59E0B" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="85" cy="34" r="2.2" fill="#F59E0B" />
      </g>

      {/* Viso espressivo */}
      {posa === 'occhiolino' ? (
        <g>
          <circle cx="40" cy="60" r="3.4" fill="#291A15" />
          <circle cx="41.2" cy="58.8" r="1.1" fill="#FFFFFF" />
          <path d="M55 60 Q60 56 65 60" stroke="#291A15" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <circle cx="40" cy="60" r="3.4" fill="#291A15" />
          <circle cx="60" cy="60" r="3.4" fill="#291A15" />
          <circle cx="41.2" cy="58.8" r="1.1" fill="#FFFFFF" />
          <circle cx="61.2" cy="58.8" r="1.1" fill="#FFFFFF" />
        </g>
      )}
      <ellipse cx="33" cy="66" rx="3.4" ry="1.8" fill="#FDA4AF" opacity="0.8" />
      <ellipse cx="67" cy="66" rx="3.4" ry="1.8" fill="#FDA4AF" opacity="0.8" />
      <path d="M43 68 Q50 76 57 68 Z" fill="#FFFFFF" stroke="#291A15" strokeWidth="1.6" strokeLinejoin="round" />

      {/* Oggetto extra: Sveglia (Visita) */}
      {posa === 'sveglia' && (
        <g transform="translate(0, 2)">
          <circle cx="13" cy="70" r="11" fill="#FFFBEB" stroke="#450A0A" strokeWidth="2" />
          <circle cx="6" cy="59" r="3" fill="#EF4444" stroke="#450A0A" strokeWidth="1.4" />
          <circle cx="20" cy="59" r="3" fill="#EF4444" stroke="#450A0A" strokeWidth="1.4" />
          <line x1="13" y1="70" x2="13" y2="63" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
          <line x1="13" y1="70" x2="18" y2="72" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {/* Oggetto extra: Mappa (Sedi) */}
      {posa === 'mappa' && (
        <g>
          <polygon points="24,78 40,73 54,78 70,73 70,92 54,97 40,92 24,97" fill="#FEF9C3" stroke="#450A0A" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M30 85 Q42 80 50 86 Q58 91 65 82" stroke="#38BDF8" strokeWidth="2.4" fill="none" />
          <circle cx="52" cy="84" r="3" fill="#E11D48" />
        </g>
      )}

      {/* Oggetto extra: Stella/Trofeo (Premi) */}
      {posa === 'trofeo' && (
        <g>
          <polygon points="15,62 18,69 25,70 20,75 21,82 15,78 9,82 10,75 5,70 12,69" fill="#FACC15" stroke="#B45309" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
}

// ============================================================================
// GUIDA INTERATTIVA (TOUR IN 6 TAPPE) + MINI-SACCA GUIDA NELL'ANGOLO
// ============================================================================
function GuidaSaccaInterattiva({
  profilo,
  schedaAttiva,
  setSchedaAttiva,
  tourAttivo,
  setTourAttivo,
  stepTour,
  setStepTour
}) {
  const [fumettoAperto, setFumettoAperto] = useState(false);
  const [indiceFrase, setIndiceFrase] = useState(0);
  const [ridottaBordo, setRidottaBordo] = useState(false);
  const [saltaAnim, setSaltaAnim] = useState(false);

  const nome = profilo?.nome || 'Studente';

  const tappeTour = [
    {
      scheda: 'home',
      titolo: '1. La tua Home',
      posa: 'stelle',
      testo: `Ciao ${nome}! Il primo passo è solo una visita conoscitiva con analisi gratuite.`
    },
    {
      scheda: 'quiz',
      titolo: '2. Pre-Quiz Idoneità',
      posa: 'dito',
      testo: '15 domande rapide sui requisiti AVIS per capire subito se puoi candidarti.'
    },
    {
      scheda: 'tutor',
      titolo: '3. Scegli o Diventa Tutor',
      posa: 'occhiolino',
      testo: 'Se non vuoi andare da solo, scegli un Tutor che ti aspetta davanti alla sede.'
    },
    {
      scheda: 'visita',
      titolo: '4. Richiedi la 1ª Visita',
      posa: 'sveglia',
      testo: 'Compili il modulo su avis.pv.it e la segreteria ti chiama per fissare giorno e ora.'
    },
    {
      scheda: 'sedi',
      titolo: '5. Sedi, Bus e Parcheggi',
      posa: 'mappa',
      testo: 'Qui trovi gli orari di Via Taramelli 7 e del San Matteo, con bus e parcheggi gratuiti.'
    },
    {
      scheda: 'bonus',
      titolo: '6. Minigiochi & Ringraziamenti',
      posa: 'trofeo',
      testo: 'Impara con i minigiochi, fai salire la tua Macro-Area e scopri i ringraziamenti dei partner a Pavia.'
    }
  ];

  const frasiPerScheda = {
    home: [
      `Alla 1ª volta fai solo una visita con esami del sangue gratuiti, nessun prelievo completo.`,
      'Il plasma si recupera in circa 24 ore bevendo normalmente acqua.',
      'Con una donazione di sangue intero si possono aiutare fino a tre pazienti.',
      'Dopo ogni visita o donazione in sede la colazione è offerta.'
    ],
    quiz: [
      'Le risposte del Pre-Quiz restano solo sullo schermo e non vengono salvate.',
      'È un controllo orientativo: la valutazione finale la fa sempre il medico AVIS.',
      'Dubbi su tatuaggi, pillola o colazione? Apri la tendina delle 12 domande qui sotto.'
    ],
    tutor: [
      'Tutti i Tutor sono studenti già donatori abilitati da AVIS Pavia.',
      'Hai dubbi sulla prima visita? Scrivigli in chat senza impegno.',
      'Dopo la 1ª donazione verificata puoi diventare Tutor anche tu.'
    ],
    visita: [
      'Compila il modulo su avis.pv.it: la segreteria ti richiama per Via Taramelli 7 o San Matteo (Pad. 12).',
      'Evita latte, yogurt e brioche farcite prima degli esami: prendi tè o caffè leggero.',
      'Salva il promemoria a 3 settimane: se AVIS non ha ancora chiamato, telefona in segreteria.'
    ],
    sedi: [
      'Via Taramelli 7 è vicino al polo Cravino e ha parcheggio gratuito interno per i donatori.',
      'La linea 3 raggiunge entrambe le sedi (3 e 6 per Via Taramelli, 3, 7 e 8 per il San Matteo).',
      'Al San Matteo il biglietto del multipiano viene convalidato gratuitamente al Centro Trasfusionale.'
    ],
    bonus: [
      'Visita (+40 pt), donazione (+100 pt) e tutoraggio (+35 pt) pesano molto più dei minigiochi.',
      'La classifica premia la media per studente attivo della tua Macro-Area.',
      'Con i punti attivi puoi sbloccare nuovi accessori per la tua Goccia.'
    ]
  };

  const posaPerScheda = {
    home: 'stelle',
    quiz: 'dito',
    tutor: 'occhiolino',
    visita: 'sveglia',
    sedi: 'mappa',
    bonus: 'trofeo'
  };

  const listaFrasi = frasiPerScheda[schedaAttiva] || frasiPerScheda.home;
  const fraseCorrente = listaFrasi[indiceFrase % listaFrasi.length];

  const vaiAStepTour = (nuovoIndice) => {
    if (nuovoIndice < 0) return;
    if (nuovoIndice >= tappeTour.length) {
      setTourAttivo(false);
      setSchedaAttiva('home');
      return;
    }
    setStepTour(nuovoIndice);
    setSchedaAttiva(tappeTour[nuovoIndice].scheda);
  };

  const toccaMiniSacca = () => {
    setSaltaAnim(true);
    setTimeout(() => setSaltaAnim(false), 300);
    if (!fumettoAperto) {
      setFumettoAperto(true);
    } else {
      setIndiceFrase((i) => i + 1);
    }
  };

  // MODALITÀ 1: TOUR GUIDATO INTERATTIVO ALLA 1ª APERTURA (O SU RICHIESTA)
  if (tourAttivo) {
    const tappa = tappeTour[stepTour] || tappeTour[0];
    return (
      <div className="absolute inset-0 z-40 bg-stone-900/45 flex flex-col justify-end p-3.5 pb-20 pointer-events-auto">
        <div className="bg-white rounded-[1.75rem] border-2 border-stone-900 shadow-2xl p-4 space-y-3 relative">
          <div className="flex items-start space-x-3">
            <div className="-mt-6 shrink-0">
              <SaccaMascotte posa={tappa.posa} size="lg" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                  {tappa.titolo}
                </span>
                <button
                  type="button"
                  onClick={() => setTourAttivo(false)}
                  className="text-[11px] font-bold text-stone-400 hover:text-stone-700 underline shrink-0"
                >
                  Salta
                </button>
              </div>
              <p className="text-xs font-bold text-stone-800 leading-snug pt-0.5">
                "{tappa.testo}"
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-stone-100">
            <div className="flex items-center space-x-1">
              {tappeTour.map((t, idx) => (
                <button
                  key={t.scheda}
                  type="button"
                  onClick={() => vaiAStepTour(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === stepTour ? 'w-5 bg-rose-600' : 'w-1.5 bg-stone-200'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center space-x-1.5">
              {stepTour > 0 && (
                <button
                  type="button"
                  onClick={() => vaiAStepTour(stepTour - 1)}
                  className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-[11px] font-black transition"
                >
                  ←
                </button>
              )}
              <button
                type="button"
                onClick={() => vaiAStepTour(stepTour + 1)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black shadow-sm transition active:scale-95"
              >
                {stepTour < tappeTour.length - 1 ? `Avanti (${stepTour + 1}/6) →` : 'Inizia! 🎉'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODALITÀ 2A: LINGUETTA MINIMIZZATA SUL BORDO DESTRO (ZERO INGOMBRO)
  if (ridottaBordo) {
    return (
      <button
        type="button"
        onClick={() => {
          setRidottaBordo(false);
          setFumettoAperto(true);
        }}
        title="Apri Sacca Guida"
        className="absolute bottom-20 right-0 z-30 bg-white border border-r-0 border-rose-200 rounded-l-2xl pl-2 pr-1.5 py-1.5 shadow-md flex items-center space-x-1 hover:bg-rose-50 transition"
      >
        <span className="text-xs">🩸</span>
      </button>
    );
  }

  // MODALITÀ 2B: MINI-SACCA DISCRETA NELL'ANGOLO + FUMETTO ON-DEMAND
  return (
    <div className="absolute bottom-20 right-3 z-30 flex flex-col items-end space-y-2 pointer-events-none">
      {fumettoAperto && (
        <div className="pointer-events-auto w-64 max-w-[82vw] bg-white rounded-3xl rounded-br-md border-2 border-stone-900 shadow-xl p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-stone-800 leading-snug">
              "{fraseCorrente}"
            </p>
            <button
              type="button"
              onClick={() => setFumettoAperto(false)}
              className="w-6 h-6 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 text-[10px] font-black shrink-0 flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-stone-100 text-[10px]">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  setSaltaAnim(true);
                  setTimeout(() => setSaltaAnim(false), 300);
                  setIndiceFrase((i) => i + 1);
                }}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-black transition"
              >
                🎲 Altra frase
              </button>
              <button
                type="button"
                onClick={() => {
                  setFumettoAperto(false);
                  setStepTour(0);
                  setSchedaAttiva('home');
                  setTourAttivo(true);
                }}
                className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-black transition"
              >
                🧭 Tour
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setFumettoAperto(false);
                setRidottaBordo(true);
              }}
              className="text-stone-400 hover:text-stone-600 font-bold px-1"
              title="Nascondi sul bordo"
            >
              Nascondi
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toccaMiniSacca}
        title="Tocca la Sacca per consigli e frasi!"
        className={`pointer-events-auto w-12 h-12 rounded-full bg-white border-2 border-rose-300 shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-90 ${
          saltaAnim ? '-translate-y-1.5 scale-110' : ''
        }`}
      >
        <SaccaMascotte posa={posaPerScheda[schedaAttiva] || 'stelle'} size="sm" />
      </button>
    </div>
  );
}

// ============================================================================
// PULSANTE NAV INFERIORE MOBILE-FIRST (TOUCH TARGET COMODO)
// ============================================================================
function PulsanteNav({ Icona, etichetta, attivo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-h-[48px] py-1.5 px-1 rounded-2xl transition duration-150 ${
        attivo ? 'text-rose-600' : 'text-stone-400 hover:text-stone-600'
      }`}
    >
      <Icona className={`w-5 h-5 transition-transform ${attivo ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'}`} />
      <span className={`text-[10px] mt-1 tracking-tight whitespace-nowrap truncate max-w-full ${attivo ? 'text-rose-600 font-black' : 'text-stone-400 font-semibold'}`}>
        {etichetta}
      </span>
    </button>
  );
}

// ============================================================================
// MODALE IMPOSTAZIONI: ELIMINA ACCOUNT & OPZIONE SVILUPPATORE
// ============================================================================
function ModaleImpostazioni({
  modalitaSviluppatore,
  setModalitaSviluppatore,
  emailJsConfig,
  setEmailJsConfig,
  onResetTuttiDati,
  onClose
}) {
  const [confermaReset, setConfermaReset] = useState(false);
  const [bozzaServiceId, setBozzaServiceId] = useState(emailJsConfig?.serviceId || '');
  const [bozzaTemplateId, setBozzaTemplateId] = useState(emailJsConfig?.templateId || '');
  const [bozzaPublicKey, setBozzaPublicKey] = useState(emailJsConfig?.publicKey || '');
  const [statoEmailSalvato, setStatoEmailSalvato] = useState('');

  const salvaEmailDaImpostazioni = () => {
    const nuovaCfg = {
      serviceId: bozzaServiceId.trim(),
      templateId: bozzaTemplateId.trim(),
      publicKey: bozzaPublicKey.trim()
    };
    salvaConfigEmailJS(nuovaCfg);
    if (setEmailJsConfig) {
      setEmailJsConfig(nuovaCfg);
    }
    setStatoEmailSalvato(isEmailJSConfigurato(nuovaCfg) ? 'Chiavi EmailJS salvate ✓' : 'Chiavi azzerate');
  };

  return (
    <div className="absolute inset-0 z-50 bg-stone-900/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-5 shadow-2xl border border-stone-200 space-y-4 max-h-[90%] overflow-y-auto text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-stone-900">Impostazioni</h3>
            <p className="text-[11px] text-stone-500">Account e opzioni sviluppatore</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 font-bold text-xs">✕</button>
        </div>

        {/* 1. ELIMINA ACCOUNT E DATI LOCALI */}
        <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200/80 space-y-2">
          <div className="font-black text-stone-900">🗑️ Elimina account</div>
          <p className="text-[11px] text-stone-600 leading-snug">
            Rimuove il profilo, i punti e tutti i progressi salvati su questo dispositivo.
          </p>
          {!confermaReset ? (
            <button
              type="button"
              onClick={() => setConfermaReset(true)}
              className="w-full py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-black text-[11px] transition"
            >
              Elimina account e dati locali
            </button>
          ) : (
            <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl space-y-2">
              <p className="text-[11px] font-bold text-rose-900">Confermi l'eliminazione dell'account e di tutti i dati?</p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfermaReset(false);
                    onResetTuttiDati();
                  }}
                  className="py-2 bg-rose-600 text-white rounded-lg font-black text-[11px]"
                >
                  Sì, elimina
                </button>
                <button
                  type="button"
                  onClick={() => setConfermaReset(false)}
                  className="py-2 bg-white border border-stone-300 text-stone-700 rounded-lg font-bold text-[11px]"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. OPZIONE SVILUPPATORE / DEMO */}
        <div className="bg-stone-900 text-white p-3.5 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="font-black block">🛠️ Opzione Sviluppatore</span>
              <span className="text-[10px] text-stone-400">
                {modalitaSviluppatore ? 'Attiva: comandi di prova visibili' : 'Spenta'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setModalitaSviluppatore((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition shrink-0 ${
                modalitaSviluppatore ? 'bg-amber-400 text-stone-950' : 'bg-stone-700 text-stone-200'
              }`}
            >
              {modalitaSviluppatore ? 'ON' : 'OFF'}
            </button>
          </div>
          {modalitaSviluppatore && (
            <>
              <div className="bg-stone-800 p-2.5 rounded-xl text-[10px] text-stone-200 space-y-1 font-mono">
                <div className="font-sans font-bold text-amber-300">Codici di prova AVIS attivi:</div>
                <div>• Visita Idoneità (+40 pt): AVIS-VISITA-PV</div>
                <div>• Donazione (+100 pt): AVIS-DONA-PV</div>
                <div>• Abilitazione Tutor: AVIS-TUTOR-PV</div>
                <div>• Accompagnamento (+35 pt): AVIS-ACC-PV</div>
                <div>• PIN Cassa Bar/Copisteria: 1361 / 2710 / 7700</div>
              </div>

              <div className="bg-stone-800 p-2.5 rounded-xl space-y-1.5 text-[10px]">
                <div className="font-bold text-amber-300">Invio Email Reale (EmailJS)</div>
                <input
                  type="text"
                  value={bozzaServiceId}
                  onChange={(e) => { setBozzaServiceId(e.target.value); setStatoEmailSalvato(''); }}
                  placeholder="Service ID"
                  className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded-lg font-mono text-white focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  value={bozzaTemplateId}
                  onChange={(e) => { setBozzaTemplateId(e.target.value); setStatoEmailSalvato(''); }}
                  placeholder="Template ID"
                  className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded-lg font-mono text-white focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  value={bozzaPublicKey}
                  onChange={(e) => { setBozzaPublicKey(e.target.value); setStatoEmailSalvato(''); }}
                  placeholder="Public Key"
                  className="w-full px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded-lg font-mono text-white focus:outline-none focus:border-amber-400"
                />
                <div className="flex items-center space-x-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={salvaEmailDaImpostazioni}
                    className="flex-1 py-1.5 bg-amber-400 text-stone-950 rounded-lg font-black"
                  >
                    Salva chiavi EmailJS
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBozzaServiceId('');
                      setBozzaTemplateId('');
                      setBozzaPublicKey('');
                      const vuota = { serviceId: '', templateId: '', publicKey: '' };
                      salvaConfigEmailJS(vuota);
                      if (setEmailJsConfig) setEmailJsConfig(vuota);
                      setStatoEmailSalvato('Chiavi azzerate');
                    }}
                    className="px-2.5 py-1.5 bg-stone-700 text-stone-200 rounded-lg font-bold"
                  >
                    Azzera
                  </button>
                </div>
                {statoEmailSalvato && (
                  <div className="text-emerald-300 font-bold">{statoEmailSalvato}</div>
                )}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-2xl font-black text-xs"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPALE APP: IN VEIN PAVIA (MOBILE-FIRST SMARTPHONE + PERSISTENZA)
// ============================================================================
function creaRichiesteTutorIniziali() {
  return [
    {
      id: 'req1',
      studente: 'Matteo R., 20 anni',
      area: 'Area Ingegneria e Architettura',
      sede: 'AVIS Pavia (Via Taramelli 7)',
      giorno: 'Mercoledì mattina · 08:30',
      nota: 'È la mia prima visita di idoneità, avrei piacere di entrare insieme!',
      avatarConfig: { coloreGoccia: 'rubino', abbigliamento: 'felpa_girocollo_blu', copricapo: 'nessuno', oggettoStudio: 'zaino_unipv', espressione: 'sorridente' },
      accettata: false,
      completata: false
    },
    {
      id: 'req2',
      studente: 'Chiara L., 21 anni',
      area: 'Area Giuridica, Politica ed Economica',
      sede: 'Policlinico San Matteo (Padiglione 12)',
      giorno: 'Giovedì mattina · 09:00',
      nota: 'Ho un po\' di ansia per le analisi iniziali, ci troviamo davanti all\'ingresso?',
      avatarConfig: { coloreGoccia: 'corallo', abbigliamento: 'tshirt_1361_bianca', copricapo: 'cappellino_baseball_unipv', oggettoStudio: 'shopper_unipv', espressione: 'occhietto' },
      accettata: false,
      completata: false
    }
  ];
}

function creaStatoGiochiVuoto(oggiISO) {
  return {
    data: oggiISO,
    puntiOggi: 0,
    rispGiornaliere: {},
    quizGiornoPremiato: false,
    rispVF: {},
    vfPremiato: false,
    rispCompat: {},
    compatPremiato: false,
    zainoCompletato: false,
    paroleIndovinate: {},
    memoryPremiato: false
  };
}

function caricaStatoSalvato() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_APP);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function App() {
  const statoSalvatoRef = useRef(undefined);
  if (statoSalvatoRef.current === undefined) {
    statoSalvatoRef.current = caricaStatoSalvato();
  }
  const saved = statoSalvatoRef.current;
  const oggiISO = ottieniDataOggiISO();

  const [registrato, setRegistrato] = useState(() => Boolean(saved?.registrato));
  const [schedaAttiva, setSchedaAttiva] = useState(() => saved?.schedaAttiva || 'home');
  const [tutorTabAttiva, setTutorTabAttiva] = useState(() => saved?.tutorTabAttiva || 'trova');
  const [gocceConoscenza, setGocceConoscenza] = useState(() => (typeof saved?.gocceConoscenza === 'number' ? saved.gocceConoscenza : 45));
  const [contributoMacroArea, setContributoMacroArea] = useState(() => (typeof saved?.contributoMacroArea === 'number' ? saved.contributoMacroArea : 45));

  const [passo1Completato, setPasso1Completato] = useState(() => Boolean(saved?.passo1Completato));
  const [passo2Completato, setPasso2Completato] = useState(() => Boolean(saved?.passo2Completato));
  const [passo3Completato, setPasso3Completato] = useState(() => Boolean(saved?.passo3Completato));
  const [visitaVerificataAvis, setVisitaVerificataAvis] = useState(() => Boolean(saved?.visitaVerificataAvis));
  const [dataRichiestaVisita, setDataRichiestaVisita] = useState(() => saved?.dataRichiestaVisita || null);
  const [sedePreferitaVisita, setSedePreferitaVisita] = useState(() => saved?.sedePreferitaVisita || 'avis_pavia');
  const [fasciaPreferitaVisita, setFasciaPreferitaVisita] = useState(() => saved?.fasciaPreferitaVisita || 'Mercoledì mattina');

  const [donazioneVerificataAvis, setDonazioneVerificataAvis] = useState(() => Boolean(saved?.donazioneVerificataAvis));
  const [timestampDonazione, setTimestampDonazione] = useState(() => (typeof saved?.timestampDonazione === 'number' ? saved.timestampDonazione : null));
  const [giorniDemoOffset, setGiorniDemoOffset] = useState(0);
  const [tipoCiclo, setTipoCiclo] = useState(() =>
    saved?.tipoCiclo === 'donna_fertile' ? 'donna_180' : (saved?.tipoCiclo || 'sangue_90')
  );

  const [tutorSceltoId, setTutorSceltoId] = useState(() => saved?.tutorSceltoId || null);
  const [guidaTutorAccettata, setGuidaTutorAccettata] = useState(() => Boolean(saved?.guidaTutorAccettata));
  const [tutorAbilitatoAvis, setTutorAbilitatoAvis] = useState(() => Boolean(saved?.tutorAbilitatoAvis));
  const [isTutorAttivo, setIsTutorAttivo] = useState(() => Boolean(saved?.isTutorAttivo));
  const [fraseTutor, setFraseTutor] = useState(
    () => saved?.fraseTutor || 'Anche io all\'inizio avevo mille dubbi: ti accompagno volentieri dall\'ingresso fino alla colazione post-visita!'
  );
  const [disponibileTutor, setDisponibileTutor] = useState(() => (saved?.disponibileTutor !== undefined ? Boolean(saved.disponibileTutor) : true));
  const [richiesteTutor, setRichiesteTutor] = useState(() => (Array.isArray(saved?.richiesteTutor) && saved.richiesteTutor.length > 0 ? saved.richiesteTutor : creaRichiesteTutorIniziali()));

  const [profilo, setProfilo] = useState(() => saved?.profilo || {
    nome: '',
    cognome: '',
    facolta: MACRO_DIPARTIMENTI_UNIPV[1],
    email: ''
  });

  const [avatar, setAvatar] = useState(() => saved?.avatar || {
    coloreGoccia: 'rubino',
    abbigliamento: 'nessuno',
    copricapo: 'nessuno',
    oggettoStudio: 'nessuno',
    visoAccessorio: 'cerotto',
    espressione: 'sorridente'
  });

  const [vestiSbloccate, setVestiSbloccate] = useState(() => (Array.isArray(saved?.vestiSbloccate) ? saved.vestiSbloccate : []));
  const [accessoriSbloccati, setAccessoriSbloccati] = useState(() => (Array.isArray(saved?.accessoriSbloccati) ? saved.accessoriSbloccati : []));
  const [storicoBuoni, setStoricoBuoni] = useState(() => (Array.isArray(saved?.storicoBuoni) ? saved.storicoBuoni : []));
  const [giochiStato, setGiochiStato] = useState(() => (saved?.giochiStato?.data === oggiISO ? saved.giochiStato : creaStatoGiochiVuoto(oggiISO)));

  const [serieSettimane, setSerieSettimane] = useState(() => (typeof saved?.serieSettimane === 'number' ? saved.serieSettimane : 1));
  const [ultimaSettimanaAttiva, setUltimaSettimanaAttiva] = useState(() => saved?.ultimaSettimanaAttiva || null);
  const [serieCicliDonazione, setSerieCicliDonazione] = useState(() => (typeof saved?.serieCicliDonazione === 'number' ? saved.serieCicliDonazione : 0));

  const [tourCompletato, setTourCompletato] = useState(() => Boolean(saved?.tourCompletato));
  const [tourAttivo, setTourAttivo] = useState(false);
  const [stepTour, setStepTour] = useState(0);

  const [modalitaSviluppatore, setModalitaSviluppatore] = useState(() => Boolean(saved?.modalitaSviluppatore));
  const [emailJsConfig, setEmailJsConfig] = useState(() => caricaConfigEmailJS());
  const [modaleAvatarAperta, setModaleAvatarAperta] = useState(false);
  const [modaleSerieAperta, setModaleSerieAperta] = useState(false);
  const [modaleImpostazioniAperta, setModaleImpostazioniAperta] = useState(false);

  const [notifica, setNotifica] = useState({ visibile: false, titolo: '', messaggio: '', punti: 0 });
  const notificaTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (notificaTimerRef.current) clearTimeout(notificaTimerRef.current);
    };
  }, []);

  // Persistenza automatica stato app su localStorage
  useEffect(() => {
    try {
      const payload = {
        registrato,
        schedaAttiva,
        tutorTabAttiva,
        gocceConoscenza,
        contributoMacroArea,
        passo1Completato,
        passo2Completato,
        passo3Completato,
        visitaVerificataAvis,
        dataRichiestaVisita,
        sedePreferitaVisita,
        fasciaPreferitaVisita,
        donazioneVerificataAvis,
        timestampDonazione,
        tipoCiclo,
        tutorSceltoId,
        guidaTutorAccettata,
        tutorAbilitatoAvis,
        isTutorAttivo,
        fraseTutor,
        disponibileTutor,
        richiesteTutor,
        profilo,
        avatar,
        vestiSbloccate,
        accessoriSbloccati,
        storicoBuoni,
        giochiStato,
        serieSettimane,
        ultimaSettimanaAttiva,
        serieCicliDonazione,
        tourCompletato,
        modalitaSviluppatore
      };
      window.localStorage.setItem(STORAGE_KEY_APP, JSON.stringify(payload));
    } catch (e) {
      // Ignora errori storage
    }
  }, [
    registrato,
    schedaAttiva,
    tutorTabAttiva,
    gocceConoscenza,
    contributoMacroArea,
    passo1Completato,
    passo2Completato,
    passo3Completato,
    visitaVerificataAvis,
    dataRichiestaVisita,
    sedePreferitaVisita,
    fasciaPreferitaVisita,
    donazioneVerificataAvis,
    timestampDonazione,
    tipoCiclo,
    tutorSceltoId,
    guidaTutorAccettata,
    tutorAbilitatoAvis,
    isTutorAttivo,
    fraseTutor,
    disponibileTutor,
    richiesteTutor,
    profilo,
    avatar,
    vestiSbloccate,
    accessoriSbloccati,
    storicoBuoni,
    giochiStato,
    serieSettimane,
    ultimaSettimanaAttiva,
    serieCicliDonazione,
    tourCompletato,
    modalitaSviluppatore
  ]);

  const registraAttivitaSettimanale = () => {
    const settimanaCorrente = ottieniSettimanaISO();
    if (ultimaSettimanaAttiva !== settimanaCorrente) {
      setUltimaSettimanaAttiva(settimanaCorrente);
      setSerieSettimane((s) => s + 1);
    }
  };

  const aggiungiGocce = (q) => {
    setGocceConoscenza((prev) => Math.max(0, prev + q));
    if (q > 0) {
      setContributoMacroArea((prev) => prev + q);
    }
  };

  const mostraNotifica = (titolo, messaggio, punti = 0) => {
    if (notificaTimerRef.current) clearTimeout(notificaTimerRef.current);
    setNotifica({ visibile: true, titolo, messaggio, punti });
    notificaTimerRef.current = setTimeout(() => {
      setNotifica((prev) => ({ ...prev, visibile: false }));
    }, 3400);
  };

  const apriDiventaTutor = () => {
    setTutorTabAttiva('diventa');
    setSchedaAttiva('tutor');
  };

  const onDonazioneVerificata = () => {
    setTimestampDonazione(Date.now());
    setGiorniDemoOffset(0);
    setDonazioneVerificataAvis(true);
    setSerieCicliDonazione((c) => c + 1);
    registraAttivitaSettimanale();
    aggiungiGocce(100);
    mostraNotifica(
      'Donazione Verificata AVIS! 🩸',
      '+100 pt per te e la tua Macro-Area! Il ciclo di recupero segue ora data e ora reali.',
      100
    );
  };

  const onAvviaSoloTimer = () => {
    setTimestampDonazione(Date.now());
    setGiorniDemoOffset(0);
    mostraNotifica(
      'Promemoria Personale Avviato 🕒',
      'Il tracker avanza con l\'orologio del telefono (0 pt finché non inserisci il codice AVIS).',
      0
    );
  };

  const onRichiestaVisitaInviata = (sedeNome) => {
    setPasso3Completato(true);
    const oggi = ottieniDataOggiISO();
    setDataRichiestaVisita(oggi);
    registraAttivitaSettimanale();
    mostraNotifica(
      'Richiesta Visita Registrata 📞',
      `Preferenza (${sedeNome}) salvata. I +40 pt si sbloccheranno con il codice AVIS dopo la visita.`,
      0
    );
  };

  const onVisitaVerificataAvis = () => {
    if (visitaVerificataAvis) return;
    setPasso3Completato(true);
    setVisitaVerificataAvis(true);
    registraAttivitaSettimanale();
    aggiungiGocce(40);
    mostraNotifica(
      '1ª Visita Verificata AVIS! 🏥',
      '+40 pt per te e la tua Macro-Area! Ora attendi gli esiti delle analisi.',
      40
    );
  };

  const onVerificaCodiceTutor = () => {
    setTutorAbilitatoAvis(true);
    mostraNotifica(
      'Codice Tutor Verificato AVIS! ✓',
      'La segreteria AVIS ha confermato la tua abilitazione al ruolo Tutor.',
      0
    );
  };

  const onSimulaRequisitiTutor = () => {
    setPasso1Completato(true);
    setPasso3Completato(true);
    setVisitaVerificataAvis(true);
    if (!timestampDonazione) {
      setTimestampDonazione(Date.now());
    }
    setDonazioneVerificataAvis(true);
    setGuidaTutorAccettata(true);
    setTutorAbilitatoAvis(true);
    setSerieCicliDonazione((c) => Math.max(c, 1));
    setGocceConoscenza((prev) => Math.max(prev, 185));
    setContributoMacroArea((prev) => Math.max(prev, 185));
    setIsTutorAttivo(false);
    mostraNotifica(
      '[DEV] 3/3 Verifiche AVIS pronte! 🛠️',
      'Ora puoi premere "Attiva il mio Profilo Tutor" per testare lo sblocco.',
      0
    );
  };

  const onSimulaTutorAttivo = () => {
    setPasso1Completato(true);
    setPasso3Completato(true);
    setVisitaVerificataAvis(true);
    if (!timestampDonazione) {
      setTimestampDonazione(Date.now());
    }
    setDonazioneVerificataAvis(true);
    setGuidaTutorAccettata(true);
    setTutorAbilitatoAvis(true);
    setSerieCicliDonazione((c) => Math.max(c, 1));
    setGocceConoscenza((prev) => Math.max(prev, 185));
    setContributoMacroArea((prev) => Math.max(prev, 185));
    setIsTutorAttivo(true);
    mostraNotifica(
      '[DEV] Tutor Abilitato Attivo! 🌟',
      'Prova ad accettare le richieste e a verificare con AVIS-ACC-PV.',
      0
    );
  };

  const onRipristinaTestTutor = () => {
    setPasso1Completato(false);
    setPasso2Completato(false);
    setPasso3Completato(false);
    setVisitaVerificataAvis(false);
    setDataRichiestaVisita(null);
    setDonazioneVerificataAvis(false);
    setGuidaTutorAccettata(false);
    setTutorAbilitatoAvis(false);
    setIsTutorAttivo(false);
    setTimestampDonazione(null);
    setGiorniDemoOffset(0);
    setSerieCicliDonazione(0);
    setGocceConoscenza(45);
    setContributoMacroArea(45);
    mostraNotifica('Stato Test Ripristinato ↺', 'Tornato al profilo iniziale da 45 pt.', 0);
  };

  const onResetTuttiDati = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY_APP);
    } catch (e) {
      // Ignora
    }
    setRegistrato(false);
    setSchedaAttiva('home');
    setTutorTabAttiva('trova');
    setGocceConoscenza(45);
    setContributoMacroArea(45);
    setPasso1Completato(false);
    setPasso2Completato(false);
    setPasso3Completato(false);
    setVisitaVerificataAvis(false);
    setDataRichiestaVisita(null);
    setSedePreferitaVisita('avis_pavia');
    setFasciaPreferitaVisita('Mercoledì mattina');
    setDonazioneVerificataAvis(false);
    setTimestampDonazione(null);
    setGiorniDemoOffset(0);
    setTipoCiclo('sangue_90');
    setTutorSceltoId(null);
    setGuidaTutorAccettata(false);
    setTutorAbilitatoAvis(false);
    setIsTutorAttivo(false);
    setFraseTutor('Anche io all\'inizio avevo mille dubbi: ti accompagno volentieri dall\'ingresso fino alla colazione post-visita!');
    setDisponibileTutor(true);
    setRichiesteTutor(creaRichiesteTutorIniziali());
    setProfilo({
      nome: '',
      cognome: '',
      facolta: MACRO_DIPARTIMENTI_UNIPV[1],
      email: ''
    });
    setAvatar({
      coloreGoccia: 'rubino',
      abbigliamento: 'nessuno',
      copricapo: 'nessuno',
      oggettoStudio: 'nessuno',
      visoAccessorio: 'cerotto',
      espressione: 'sorridente'
    });
    setVestiSbloccate([]);
    setAccessoriSbloccati([]);
    setStoricoBuoni([]);
    setGiochiStato(creaStatoGiochiVuoto(ottieniDataOggiISO()));
    setSerieSettimane(1);
    setUltimaSettimanaAttiva(null);
    setSerieCicliDonazione(0);
    setTourCompletato(false);
    setTourAttivo(false);
    setModalitaSviluppatore(false);
    setModaleImpostazioniAperta(false);
    mostraNotifica('Account Eliminato ↺', 'Tutti i dati locali sul dispositivo sono stati rimossi.', 0);
  };

  const stileFuoco = ottieniStileFuoco(serieSettimane);

  return (
    <div className="min-h-[100dvh] bg-[#FDFBF7] sm:bg-stone-900 sm:py-5 flex items-center justify-center font-sans antialiased text-stone-900 select-none">
      <div className="w-full sm:max-w-[430px] bg-[#FDFBF7] flex flex-col relative sm:shadow-2xl sm:rounded-[2.8rem] sm:border-[9px] sm:border-stone-800 h-[100dvh] sm:h-[840px] sm:max-h-[92vh] overflow-hidden">

        {/* SCHERMATA INIZIALE DI REGISTRAZIONE */}
        {!registrato ? (
          <SchermataRegistrazione
            profilo={profilo}
            setProfilo={setProfilo}
            avatar={avatar}
            setModaleAvatarAperta={setModaleAvatarAperta}
            emailJsConfig={emailJsConfig}
            mostraNotifica={mostraNotifica}
            onCompletaRegistrazione={() => {
              setRegistrato(true);
              setSchedaAttiva('home');
              if (!tourCompletato) {
                setStepTour(0);
                setTourAttivo(true);
                setTourCompletato(true);
              }
            }}
          />
        ) : (
          <>
            {/* 1. HEADER MOBILE-FIRST CON LOGO, COSTANZA SETTIMANALE E PUNTI */}
            <header className="bg-white/95 backdrop-blur-md border-b border-stone-200/70 px-3.5 sm:px-4 py-2.5 safe-top shrink-0 z-30 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#F7F5EE] border border-stone-200/90 shadow-sm overflow-hidden shrink-0">
                  <img
                    src="Immagine_logo.jpeg"
                    alt="IN VEIN"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-sm font-black tracking-tight text-stone-900 truncate">
                  IN VEIN
                </span>
                <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[9px] font-bold text-stone-500 uppercase shrink-0">
                  Pavia
                </span>
                {modalitaSviluppatore && (
                  <span className="px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded text-[9px] font-black text-amber-900 uppercase shrink-0">
                    DEV
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={() => setModaleSerieAperta(true)}
                  title={`Costanza: ${serieSettimane} sett. (${stileFuoco.nome}) · Cicli donazione: ${serieCicliDonazione}`}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-black border flex items-center space-x-1 transition ${stileFuoco.badgeCls}`}
                >
                  <Flame className={`w-3.5 h-3.5 ${stileFuoco.iconCls}`} />
                  <span>{serieSettimane}s</span>
                </button>
                <button
                  onClick={() => setSchedaAttiva('bonus')}
                  className="px-2.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black border border-rose-200/80 transition"
                >
                  ★ {gocceConoscenza.toLocaleString()} pt
                </button>
              </div>
            </header>

            {/* 2. CONTENUTO PRINCIPALE SCROLLABILE */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3.5 sm:px-4 pt-3 pb-20 space-y-4">
              {schedaAttiva === 'home' && (
                <SchermataHome
                  profilo={profilo}
                  avatar={avatar}
                  setModaleAvatarAperta={setModaleAvatarAperta}
                  passo1Completato={passo1Completato}
                  passo2Completato={passo2Completato}
                  passo3Completato={passo3Completato}
                  visitaVerificataAvis={visitaVerificataAvis}
                  isTutorAttivo={isTutorAttivo}
                  setSchedaAttiva={setSchedaAttiva}
                  apriDiventaTutor={apriDiventaTutor}
                  timestampDonazione={timestampDonazione}
                  setTimestampDonazione={setTimestampDonazione}
                  giorniDemoOffset={giorniDemoOffset}
                  setGiorniDemoOffset={setGiorniDemoOffset}
                  tipoCiclo={tipoCiclo}
                  setTipoCiclo={setTipoCiclo}
                  donazioneVerificataAvis={donazioneVerificataAvis}
                  modalitaSviluppatore={modalitaSviluppatore}
                  onDonazioneVerificata={onDonazioneVerificata}
                  onAvviaSoloTimer={onAvviaSoloTimer}
                  apriImpostazioni={() => setModaleImpostazioniAperta(true)}
                />
              )}

              {schedaAttiva === 'quiz' && (
                <SchermataPreQuiz
                  passo1Completato={passo1Completato}
                  setPasso1Completato={(val) => {
                    setPasso1Completato(val);
                    if (val) registraAttivitaSettimanale();
                  }}
                  setSchedaAttiva={setSchedaAttiva}
                  mostraNotifica={mostraNotifica}
                />
              )}

              {schedaAttiva === 'tutor' && (
                <SchermataTutor
                  passo1Completato={passo1Completato}
                  passo2Completato={passo2Completato}
                  setPasso2Completato={setPasso2Completato}
                  setSchedaAttiva={setSchedaAttiva}
                  mostraNotifica={mostraNotifica}
                  tutorTabAttiva={tutorTabAttiva}
                  setTutorTabAttiva={setTutorTabAttiva}
                  tutorSceltoId={tutorSceltoId}
                  setTutorSceltoId={setTutorSceltoId}
                  fraseTutor={fraseTutor}
                  setFraseTutor={setFraseTutor}
                  disponibileTutor={disponibileTutor}
                  setDisponibileTutor={setDisponibileTutor}
                  richiesteTutor={richiesteTutor}
                  setRichiesteTutor={setRichiesteTutor}
                  donazioneVerificataAvis={donazioneVerificataAvis}
                  guidaTutorAccettata={guidaTutorAccettata}
                  setGuidaTutorAccettata={setGuidaTutorAccettata}
                  tutorAbilitatoAvis={tutorAbilitatoAvis}
                  onVerificaCodiceTutor={onVerificaCodiceTutor}
                  isTutorAttivo={isTutorAttivo}
                  setIsTutorAttivo={setIsTutorAttivo}
                  profilo={profilo}
                  avatar={avatar}
                  aggiungiGocce={aggiungiGocce}
                  registraAttivitaSettimanale={registraAttivitaSettimanale}
                  modalitaSviluppatore={modalitaSviluppatore}
                  onSimulaRequisitiTutor={onSimulaRequisitiTutor}
                  onSimulaTutorAttivo={onSimulaTutorAttivo}
                  onRipristinaTestTutor={onRipristinaTestTutor}
                />
              )}

              {schedaAttiva === 'visita' && (
                <SchermataPrenotaVisita
                  passo3Completato={passo3Completato}
                  visitaVerificataAvis={visitaVerificataAvis}
                  dataRichiestaVisita={dataRichiestaVisita}
                  sedePreferitaVisita={sedePreferitaVisita}
                  setSedePreferitaVisita={setSedePreferitaVisita}
                  fasciaPreferitaVisita={fasciaPreferitaVisita}
                  setFasciaPreferitaVisita={setFasciaPreferitaVisita}
                  modalitaSviluppatore={modalitaSviluppatore}
                  setSchedaAttiva={setSchedaAttiva}
                  mostraNotifica={mostraNotifica}
                  onRichiestaVisitaInviata={onRichiestaVisitaInviata}
                  onVisitaVerificataAvis={onVisitaVerificataAvis}
                />
              )}

              {schedaAttiva === 'sedi' && (
                <SchermataSediMappa />
              )}

              {schedaAttiva === 'bonus' && (
                <SchermataBonus
                  gocceConoscenza={gocceConoscenza}
                  setGocceConoscenza={setGocceConoscenza}
                  contributoMacroArea={contributoMacroArea}
                  aggiungiGocce={aggiungiGocce}
                  registraAttivitaSettimanale={registraAttivitaSettimanale}
                  storicoBuoni={storicoBuoni}
                  setStoricoBuoni={setStoricoBuoni}
                  giochiStato={giochiStato}
                  setGiochiStato={setGiochiStato}
                  modalitaSviluppatore={modalitaSviluppatore}
                  avatar={avatar}
                  profilo={profilo}
                  mostraNotifica={mostraNotifica}
                  setModaleAvatarAperta={setModaleAvatarAperta}
                />
              )}
            </main>

            {/* 3. BARRA INFERIORE MOBILE-FIRST (6 COLONNE EQUIDISTANTI + SAFE-AREA) */}
            <nav className="shrink-0 bg-white/95 backdrop-blur-md border-t border-stone-200/80 grid grid-cols-6 items-center pt-1.5 px-1 safe-bottom z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
              <PulsanteNav
                Icona={Home}
                etichetta="Home"
                attivo={schedaAttiva === 'home'}
                onClick={() => setSchedaAttiva('home')}
              />
              <PulsanteNav
                Icona={ClipboardList}
                etichetta="Quiz"
                attivo={schedaAttiva === 'quiz'}
                onClick={() => setSchedaAttiva('quiz')}
              />
              <PulsanteNav
                Icona={Users}
                etichetta="Tutor"
                attivo={schedaAttiva === 'tutor'}
                onClick={() => {
                  setTutorTabAttiva('trova');
                  setSchedaAttiva('tutor');
                }}
              />
              <PulsanteNav
                Icona={Calendar}
                etichetta="Visita"
                attivo={schedaAttiva === 'visita'}
                onClick={() => setSchedaAttiva('visita')}
              />
              <PulsanteNav
                Icona={MapPin}
                etichetta="Sedi"
                attivo={schedaAttiva === 'sedi'}
                onClick={() => setSchedaAttiva('sedi')}
              />
              <PulsanteNav
                Icona={Trophy}
                etichetta="Premi"
                attivo={schedaAttiva === 'bonus'}
                onClick={() => setSchedaAttiva('bonus')}
              />
            </nav>
          </>
        )}

        {/* GUIDA INTERATTIVA TOUR + MINI-SACCA GUIDA NELL'ANGOLO */}
        {registrato && !modaleAvatarAperta && !modaleSerieAperta && !modaleImpostazioniAperta && (
          <GuidaSaccaInterattiva
            profilo={profilo}
            schedaAttiva={schedaAttiva}
            setSchedaAttiva={setSchedaAttiva}
            tourAttivo={tourAttivo}
            setTourAttivo={setTourAttivo}
            stepTour={stepTour}
            setStepTour={setStepTour}
          />
        )}

        {/* TOAST NOTIFICA */}
        {notifica.visibile && (
          <div className="absolute top-16 left-3.5 right-3.5 z-50">
            <div className="bg-stone-900 text-white p-3.5 rounded-2xl shadow-xl border border-stone-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-xs font-black text-white">{notifica.titolo}</h4>
                <p className="text-[11px] text-stone-300 leading-snug">{notifica.messaggio}</p>
              </div>
              {notifica.punti !== 0 && (
                <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${
                  notifica.punti > 0 ? 'bg-rose-600 text-white' : 'bg-stone-800 text-amber-400'
                }`}>
                  {notifica.punti > 0 ? `+${notifica.punti}` : notifica.punti} pt
                </span>
              )}
            </div>
          </div>
        )}

        {/* MODALE COSTANZA SETTIMANALE & CICLI DONAZIONE */}
        {modaleSerieAperta && (
          <ModaleSerieAttivita
            serieSettimane={serieSettimane}
            setSerieSettimane={setSerieSettimane}
            serieCicliDonazione={serieCicliDonazione}
            modalitaSviluppatore={modalitaSviluppatore}
            onClose={() => setModaleSerieAperta(false)}
          />
        )}

        {/* MODALE IMPOSTAZIONI (ELIMINA ACCOUNT + OPZIONE SVILUPPATORE) */}
        {modaleImpostazioniAperta && (
          <ModaleImpostazioni
            modalitaSviluppatore={modalitaSviluppatore}
            setModalitaSviluppatore={setModalitaSviluppatore}
            emailJsConfig={emailJsConfig}
            setEmailJsConfig={setEmailJsConfig}
            onResetTuttiDati={onResetTuttiDati}
            onClose={() => setModaleImpostazioniAperta(false)}
          />
        )}

        {/* MODALE PERSONALIZZAZIONE GOCCIA MASCOTTE */}
        {modaleAvatarAperta && (
          <ModalePersonalizzaAvatar
            avatar={avatar}
            setAvatar={setAvatar}
            vestiSbloccate={vestiSbloccate}
            setVestiSbloccate={setVestiSbloccate}
            accessoriSbloccati={accessoriSbloccati}
            gocceTotali={gocceConoscenza}
            setGocceTotali={setGocceConoscenza}
            modalitaSviluppatore={modalitaSviluppatore}
            onClose={() => setModaleAvatarAperta(false)}
            mostraNotifica={mostraNotifica}
          />
        )}
      </div>
    </div>
  );
}
export default App;