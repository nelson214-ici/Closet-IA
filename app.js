// Closet AI Stylist — Web App v0.4
// New: camera for clothing photos, selfie analysis for colorimetry, "Fiesta" occasion

(function() {
  const STORAGE_KEY = 'closet_ai_v3';
  const API_ENDPOINT = '/api/claude';

  const SEED = [
    { id: 'c1', category: 'tshirts', name: 'Polera blanca', emoji: '👕', color: '#FFFFFF', colorName: 'Blanco', style: 'casual', formality: 2, season: ['verano','primavera'], tags: ['versátil','minimalista'], favorite: true },
    { id: 'c2', category: 'tshirts', name: 'Polera negra slim', emoji: '👕', color: '#1a1a1a', colorName: 'Negro', style: 'casual', formality: 3, season: ['todo el año'], tags: ['esencial'], favorite: false },
    { id: 'c3', category: 'pants', name: 'Jeans azul oscuro', emoji: '👖', color: '#1e3a5f', colorName: 'Azul indigo', style: 'casual', formality: 3, season: ['todo el año'], tags: ['denim'], favorite: true },
    { id: 'c4', category: 'pants', name: 'Chino beige', emoji: '👖', color: '#c9a876', colorName: 'Beige', style: 'casual', formality: 4, season: ['otoño','primavera'], tags: ['versátil'], favorite: false },
    { id: 'c5', category: 'jackets', name: 'Chaqueta mezclilla', emoji: '🧥', color: '#4a6b8a', colorName: 'Azul medio', style: 'casual', formality: 3, season: ['otoño','primavera'], tags: ['denim'], favorite: false },
    { id: 'c6', category: 'jackets', name: 'Abrigo lana camel', emoji: '🧥', color: '#a07c4f', colorName: 'Camel', style: 'elegant', formality: 5, season: ['invierno'], tags: ['lana'], favorite: true },
    { id: 'c7', category: 'shoes', name: 'Zapatillas blancas', emoji: '👟', color: '#f5f5f5', colorName: 'Blanco', style: 'casual', formality: 2, season: ['todo el año'], tags: ['minimalista'], favorite: true },
    { id: 'c8', category: 'shoes', name: 'Botas café', emoji: '👞', color: '#5d3a1f', colorName: 'Café', style: 'elegant', formality: 5, season: ['invierno','otoño'], tags: ['cuero'], favorite: false },
    { id: 'c9', category: 'hoodies', name: 'Polerón gris', emoji: '🧥', color: '#8a8a8a', colorName: 'Gris', style: 'streetwear', formality: 1, season: ['invierno','otoño'], tags: ['cómodo'], favorite: false },
    { id: 'c10', category: 'shorts', name: 'Shorts caqui', emoji: '🩳', color: '#a39160', colorName: 'Caqui', style: 'casual', formality: 2, season: ['verano'], tags: ['ligero'], favorite: false },
    { id: 'c11', category: 'hats', name: 'Gorro lana gris', emoji: '🧢', color: '#666', colorName: 'Gris carbón', style: 'casual', formality: 2, season: ['invierno'], tags: ['lana'], favorite: false },
    { id: 'c12', category: 'accessories', name: 'Bufanda burdeos', emoji: '🧣', color: '#722f37', colorName: 'Burdeos', style: 'elegant', formality: 4, season: ['invierno'], tags: ['lana'], favorite: false }
  ];

  const DEFAULT_PROFILE = {
    name: 'Tu nombre',
    colorimetry: 'Sin analizar',
    bodyType: 'Sin analizar',
    favoriteStyles: ['casual', 'minimalista'],
    location: 'Tu ciudad',
    skinUndertone: 'Sin analizar',
    recommendedColors: ['#a07c4f', '#722f37', '#3b5a3a', '#c9a876', '#5d3a1f'],
    avoidedColors: [],
    styleNotes: '',
    photoDataUrl: null,
    analyzed: false
  };

  const OCCASIONS = ['casual','trabajo','fiesta','cena','gym','formal','viaje'];

  let state = {
    currentTab: 'today',
    closet: [...SEED],
    profile: { ...DEFAULT_PROFILE },
    outfits: [],
    addStep: 'capture',
    addImage: null,
    occasion: 'casual',
    isGenerating: false,
    lastAnalyzed: null,
    filterCat: 'all',
    weather: null,
    weatherLoading: true,
    detailItem: null,
    colorStep: 'idle',
    colorImage: null,
    colorError: null
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.closet) {
      state.closet = saved.closet;
      state.profile = { ...DEFAULT_PROFILE, ...(saved.profile || {}) };
      state.outfits = saved.outfits || [];
    }
  } catch(e) {}

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        closet: state.closet, profile: state.profile, outfits: state.outfits
      }));
    } catch(e) {
      console.error('Storage error', e);
      try {
        const slim = { ...state.profile, photoDataUrl: null };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          closet: state.closet, profile: slim, outfits: state.outfits
        }));
        toast('Foto muy grande, no se guardó');
      } catch(e2) {}
    }
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2200);
  }

  function haptic() { if (navigator.vibrate) navigator.vibrate(10); }

  function getContrast(hex) {
    const r = parseInt(hex.substr(1,2),16), g = parseInt(hex.substr(3,2),16), b = parseInt(hex.substr(5,2),16);
    return (r*299+g*587+b*114)/1000 > 128 ? 'dark' : 'light';
  }

  async function compressImage(file, maxDim, quality) {
    maxDim = maxDim || 1024;
    quality = quality || 0.75;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = e => { img.src = e.target.result; };
      reader.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function stripDataUrl(dataUrl) {
    return dataUrl.split(',')[1];
  }

  async function loadWeather() {
    state.weatherLoading = true;
    try {
      let lat, lon, city;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 });
          });
          lat = pos.coords.latitude; lon = pos.coords.longitude;
        } catch(e) {
          lat = -33.4489; lon = -70.6693; city = 'Santiago';
        }
      } else {
        lat = -33.4489; lon = -70.6693; city = 'Santiago';
      }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,precipitation&daily=precipitation_probability_max&timezone=auto&forecast_days=1`;
      const r = await fetch(url);
      const data = await r.json();
      const codes = {0:['Despejado','ti-sun'],1:['Mayormente despejado','ti-sun'],2:['Parcialmente nublado','ti-cloud-sun'],3:['Nublado','ti-cloud'],45:['Niebla','ti-mist'],51:['Llovizna','ti-cloud-rain'],61:['Lluvia','ti-cloud-rain'],63:['Lluvia moderada','ti-cloud-rain'],65:['Lluvia fuerte','ti-cloud-storm'],71:['Nieve','ti-cloud-snow'],95:['Tormenta','ti-cloud-storm']};
      const c = data.current;
      const code = c.weather_code;
      const [cond, icon] = codes[code] || ['Variable','ti-cloud'];
      state.weather = {
        temp: Math.round(c.temperature_2m),
        feelsLike: Math.round(c.apparent_temperature),
        condition: cond, icon,
        isRaining: c.precipitation > 0.1 || [51,53,55,61,63,65,80,81,82].includes(code),
        rainProb: data.daily.precipitation_probability_max[0] || 0,
        city: city || await getCity(lat, lon)
      };
    } catch(e) {
      state.weather = { temp: 18, feelsLike: 17, condition: 'Variable', icon: 'ti-cloud-sun', isRaining: false, rainProb: 0, city: 'Tu ubicación' };
    }
    state.weatherLoading = false;
    if (state.currentTab === 'today') render();
  }

  async function getCity(lat, lon) {
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`);
      const d = await r.json();
      return d.city || d.locality || 'Tu ubicación';
    } catch(e) { return 'Tu ubicación'; }
  }

  async function callClaude(messages, maxTokens) {
    const r = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens || 1200,
        messages
      })
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error && err.error.message ? err.error.message : 'API error');
    }
    const data = await r.json();
    return data.content.map(c => c.text || '').join('').trim().replace(/```json|```/g, '').trim();
  }

  async function generateOutfits(occasion) {
    state.isGenerating = true; render();
    const w = state.weather || { temp: 18, condition: 'Variable', isRaining: false };
    const closetText = state.closet.map(it =>
      `- ID:${it.id} | ${it.category} | ${it.name} | color:${it.colorName} ${it.color} | estilo:${it.style} | formalidad:${it.formality}/5`
    ).join('\n');

    const colorPaletteText = state.profile.analyzed
      ? `colores recomendados (${state.profile.recommendedColors.join(', ')}), colores a evitar (${state.profile.avoidedColors.join(', ')})`
      : '';

    const prompt = `Eres stylist experto en colorimetría y armonía cromática.

PERFIL: ${state.profile.name}, colorimetría ${state.profile.colorimetry}, contextura ${state.profile.bodyType}, subtono ${state.profile.skinUndertone}. ${colorPaletteText}

CLIMA: ${w.temp}°C, sensación ${w.feelsLike || w.temp}°C, ${w.condition}, ${w.isRaining ? 'con lluvia' : 'sin lluvia'}.

OCASIÓN: ${occasion}.

CLÓSET (usa SOLO estos IDs exactos):
${closetText}

Genera 2 outfits distintos de 3-5 prendas con prenda superior + inferior + calzado.
${occasion === 'fiesta' ? 'Para fiesta: prioriza prendas con más formalidad (4-5) o piezas con carácter (colores oscuros, texturas elegantes, accesorios statement).' : ''}
${occasion === 'gym' ? 'Para gym: prioriza prendas deportivas o casuales cómodas con formalidad 1-2.' : ''}

Responde SOLO JSON sin markdown:
{
  "outfits": [
    {
      "item_ids": ["c1","c3","c7"],
      "title": "Título 3-4 palabras",
      "explanation": "Frase cálida explicando por qué funciona",
      "colorHarmony": "análoga|complementaria|monocromática|neutros",
      "highlights": ["razón 1","razón 2","razón 3"]
    }
  ]
}`;
    try {
      const text = await callClaude([{ role: 'user', content: prompt }], 1200);
      const parsed = JSON.parse(text);
      const newOutfits = parsed.outfits.map((o, i) => ({
        title: o.title, explanation: o.explanation, colorHarmony: o.colorHarmony, highlights: o.highlights,
        id: 'o'+Date.now()+i, occasion,
        weather: { temp: w.temp, condition: w.condition },
        items: o.item_ids.map(id => state.closet.find(c => c.id === id)).filter(Boolean),
        createdAt: new Date().toISOString(),
        favorite: false, worn: false
      }));
      state.outfits = [...newOutfits, ...state.outfits];
      save();
      toast('✨ ' + newOutfits.length + ' outfits generados');
    } catch(e) {
      console.error(e);
      toast('Error: ' + (e.message || 'reintenta'));
    }
    state.isGenerating = false; render();
  }

  async function analyzeClothingFromPhoto(dataUrl) {
    const base64 = stripDataUrl(dataUrl);
    const messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: `Analiza esta prenda en la foto. Identifica el tipo de prenda, color dominante real (mírala bien), estilo y todo lo necesario.

Responde SOLO JSON sin markdown:
{
  "name": "Nombre breve en español (max 4 palabras)",
  "category": "tshirts|pants|shorts|hoodies|jackets|shoes|hats|accessories",
  "colorName": "Color principal en español",
  "color": "#hexcolor real de la prenda",
  "style": "casual|formal|sporty|elegant|streetwear|minimalist",
  "formality": 1-5,
  "season": ["primavera"|"verano"|"otoño"|"invierno"|"todo el año"],
  "tags": ["tag1","tag2","tag3"],
  "emoji": "emoji apropiado (👕👖🧥👟👞🩳🧢🧣 etc)"
}`}
      ]
    }];
    try {
      const text = await callClaude(messages, 600);
      return JSON.parse(text);
    } catch(e) { console.error(e); return null; }
  }

  async function analyzeClothingFromDescription(description) {
    const prompt = `Analiza esta prenda: "${description}"

Responde SOLO JSON sin markdown:
{
  "name": "Nombre breve (max 4 palabras)",
  "category": "tshirts|pants|shorts|hoodies|jackets|shoes|hats|accessories",
  "colorName": "Color en español",
  "color": "#hexcolor",
  "style": "casual|formal|sporty|elegant|streetwear|minimalist",
  "formality": 1-5,
  "season": ["primavera"|"verano"|"otoño"|"invierno"|"todo el año"],
  "tags": ["tag1","tag2","tag3"],
  "emoji": "emoji apropiado"
}`;
    try {
      const text = await callClaude([{ role: 'user', content: prompt }], 500);
      return JSON.parse(text);
    } catch(e) { console.error(e); return null; }
  }

  async function analyzeUserFromPhoto(dataUrl) {
    const base64 = stripDataUrl(dataUrl);
    const messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: `Eres experto en colorimetría personal y análisis corporal para moda. Analiza esta foto y determina:

1. Colorimetría estacional
2. Subtono de piel (cálido/frío/neutro)
3. Tipo de contextura corporal visible
4. 5 colores hex que favorecerían esta colorimetría
5. 2 colores hex que evitar
6. Notas de estilo breves

Si no puedes ver claramente algún aspecto, igual da tu mejor estimación basada en lo visible.

Responde SOLO JSON sin markdown:
{
  "colorimetry": "Invierno profundo|Invierno verdadero|Invierno brillante|Verano claro|Verano verdadero|Verano suave|Primavera clara|Primavera cálida|Primavera brillante|Otoño profundo|Otoño cálido|Otoño suave",
  "skinUndertone": "Cálido|Frío|Neutro",
  "bodyType": "Rectangular|Triangular|Triángulo invertido|Reloj de arena|Ovalado|Atlético",
  "recommendedColors": ["#hex1","#hex2","#hex3","#hex4","#hex5"],
  "avoidedColors": ["#hex1","#hex2"],
  "styleNotes": "1-2 frases sobre qué cortes y estilos te favorecen"
}`}
      ]
    }];
    try {
      const text = await callClaude(messages, 800);
      return JSON.parse(text);
    } catch(e) { console.error(e); return null; }
  }

  // ============ VIEWS ============
  function viewToday() {
    const h = new Date().getHours();
    const greet = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const w = state.weather;
    return `
      <div class="anim-fade-in" style="padding-top:16px;">
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 2px;">${greet}</p>
        <h1 style="font-size:26px;font-weight:600;margin:0 0 20px;letter-spacing:-0.5px;">${state.profile.name} 👋</h1>
        ${state.weatherLoading ? `
          <div style="background:var(--bg-secondary);border-radius:20px;padding:24px;margin-bottom:20px;display:flex;align-items:center;justify-content:center;height:120px;">
            <i class="ti ti-loader" style="font-size:24px;animation:spin 1s linear infinite;color:var(--text-tertiary);"></i>
          </div>
        ` : `
          <div style="background:var(--bg-secondary);border-radius:20px;padding:18px 20px;margin-bottom:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <p style="font-size:12px;color:var(--text-secondary);margin:0 0 4px;">
                  <i class="ti ti-map-pin" style="font-size:11px;"></i> ${w.city}
                </p>
                <p style="font-size:40px;font-weight:500;margin:0;line-height:1;">${w.temp}°</p>
                <p style="font-size:13px;color:var(--text-secondary);margin:6px 0 0;">${w.condition} · ${w.feelsLike}°</p>
              </div>
              <i class="ti ${w.icon}" style="font-size:56px;color:var(--text-secondary);"></i>
            </div>
            ${w.rainProb > 30 ? `<p style="font-size:11px;color:var(--text-tertiary);margin:10px 0 0;padding-top:10px;border-top:0.5px solid var(--border);"><i class="ti ti-droplet"></i> Lluvia probable: ${w.rainProb}%</p>` : ''}
          </div>
        `}
        ${!state.profile.analyzed ? `
          <div onclick="window.__app.setTab('profile')" style="background:linear-gradient(135deg,#fff8e1,#ffe0b2);border-radius:14px;padding:12px 14px;margin-bottom:16px;cursor:pointer;border:0.5px solid #ffcc80;">
            <p style="font-size:12px;margin:0;color:#5d4037;line-height:1.4;">
              <i class="ti ti-sparkles"></i> <strong>Tip:</strong> analiza tu colorimetría en el perfil para outfits más precisos →
            </p>
          </div>
        ` : ''}
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 10px;">¿Qué tienes hoy?</p>
        <div class="h-scroll" style="display:flex;gap:8px;margin-bottom:20px;overflow-x:auto;padding-bottom:4px;">
          ${OCCASIONS.map(o => `
            <button onclick="window.__app.setOccasion('${o}')" style="flex-shrink:0;background:${state.occasion === o ? 'var(--accent)' : 'transparent'};color:${state.occasion === o ? 'var(--bg-primary)' : 'var(--text-primary)'};border:0.5px solid var(--border-strong);padding:9px 16px;border-radius:999px;font-size:13px;cursor:pointer;text-transform:capitalize;font-family:inherit;">${o}</button>
          `).join('')}
        </div>
        <button onclick="window.__app.generate()" ${state.isGenerating ? 'disabled' : ''} style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:17px;border-radius:16px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:24px;font-family:inherit;opacity:${state.isGenerating ? '0.7' : '1'};">
          ${state.isGenerating ? '<i class="ti ti-loader" style="animation:spin 1s linear infinite;"></i> Pensando...' : '<i class="ti ti-sparkles"></i> Generar outfits'}
        </button>
        ${state.outfits.length > 0 ? `
          <h2 style="font-size:17px;font-weight:600;margin:0 0 12px;">Outfits recientes</h2>
          ${state.outfits.slice(0,4).map(o => outfitCard(o)).join('')}
        ` : `
          <div style="text-align:center;padding:40px 20px;color:var(--text-tertiary);">
            <i class="ti ti-shirt" style="font-size:42px;margin-bottom:12px;"></i>
            <p style="font-size:13px;line-height:1.5;">Toca el botón para generar<br>tu primer outfit</p>
          </div>
        `}
      </div>
    `;
  }

  function itemTile(item, size) {
    const hasPhoto = item.photoDataUrl;
    return `
      <div style="aspect-ratio:1;background:${hasPhoto ? '#fff' : item.color};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:${size}px;border:0.5px solid var(--border);overflow:hidden;position:relative;">
        ${hasPhoto
          ? `<img src="${item.photoDataUrl}" style="width:100%;height:100%;object-fit:cover;">`
          : `<span style="${getContrast(item.color) === 'light' ? 'filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4));' : ''}">${item.emoji}</span>`}
      </div>
    `;
  }

  function outfitCard(o) {
    return `
      <div class="anim-slide-up" style="background:var(--bg-primary);border:0.5px solid var(--border);border-radius:16px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="flex:1;min-width:0;">
            <p style="font-size:15px;font-weight:600;margin:0 0 3px;">${o.title}</p>
            <p style="font-size:11px;color:var(--text-secondary);margin:0;">${o.items.length} prendas · ${o.colorHarmony}</p>
          </div>
          <button onclick="window.__app.toggleFav('${o.id}')" style="background:transparent;border:none;cursor:pointer;padding:4px;">
            <i class="ti ${o.favorite ? 'ti-heart-filled' : 'ti-heart'}" style="font-size:20px;color:${o.favorite ? '#e91e63' : 'var(--text-tertiary)'};"></i>
          </button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(o.items.length, 5)},1fr);gap:6px;margin-bottom:12px;">
          ${o.items.map(it => itemTile(it, 26)).join('')}
        </div>
        <p style="font-size:13px;line-height:1.45;margin:0 0 10px;font-style:italic;">"${o.explanation}"</p>
        ${o.highlights ? `
          <div class="h-scroll" style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;">
            ${o.highlights.map(h => `<span style="flex-shrink:0;font-size:10px;background:var(--bg-secondary);padding:4px 9px;border-radius:999px;color:var(--text-secondary);white-space:nowrap;">✓ ${h}</span>`).join('')}
          </div>
        ` : ''}
        <div style="display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:0.5px solid var(--border);">
          <button onclick="window.__app.markWorn('${o.id}')" style="flex:1;background:${o.worn ? 'var(--bg-secondary)' : 'transparent'};border:0.5px solid var(--border);padding:7px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit;color:var(--text-primary);">
            <i class="ti ${o.worn ? 'ti-check' : 'ti-shirt'}"></i> ${o.worn ? 'Usado' : 'Usar hoy'}
          </button>
          <button onclick="window.__app.shareOutfit('${o.id}')" style="flex:1;background:transparent;border:0.5px solid var(--border);padding:7px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit;color:var(--text-primary);">
            <i class="ti ti-share"></i> Compartir
          </button>
        </div>
      </div>
    `;
  }

  function viewCloset() {
    const cats = [{ k:'all',l:'Todo' },{ k:'tshirts',l:'Tops' },{ k:'pants',l:'Pantalones' },{ k:'jackets',l:'Abrigos' },{ k:'shoes',l:'Zapatos' },{ k:'hoodies',l:'Polerones' },{ k:'accessories',l:'Accesorios' }];
    const filtered = state.closet.filter(c => state.filterCat === 'all' || c.category === state.filterCat);
    return `
      <div class="anim-fade-in" style="padding-top:16px;">
        <h1 style="font-size:26px;font-weight:600;margin:0 0 3px;">Mi clóset</h1>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 16px;">${state.closet.length} prendas</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;">
          ${[['prendas',state.closet.length],['favoritas',state.closet.filter(c=>c.favorite).length],['categorías',new Set(state.closet.map(c=>c.category)).size]].map(([l,v]) => `
            <div style="background:var(--bg-secondary);padding:14px 8px;border-radius:14px;text-align:center;">
              <p style="font-size:22px;font-weight:600;margin:0;">${v}</p>
              <p style="font-size:10px;color:var(--text-secondary);margin:2px 0 0;">${l}</p>
            </div>
          `).join('')}
        </div>
        <div class="h-scroll" style="display:flex;gap:8px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px;">
          ${cats.map(c => `
            <button onclick="window.__app.filterCat('${c.k}')" style="flex-shrink:0;background:${state.filterCat === c.k ? 'var(--accent)' : 'transparent'};color:${state.filterCat === c.k ? 'var(--bg-primary)' : 'var(--text-primary)'};border:0.5px solid var(--border-strong);padding:7px 14px;border-radius:999px;font-size:12px;cursor:pointer;font-family:inherit;">${c.l}</button>
          `).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${filtered.map(item => `
            <div onclick="window.__app.showDetail('${item.id}')" style="aspect-ratio:1;background:${item.photoDataUrl ? '#fff' : item.color};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:38px;border:0.5px solid var(--border);position:relative;cursor:pointer;overflow:hidden;">
              ${item.photoDataUrl
                ? `<img src="${item.photoDataUrl}" style="width:100%;height:100%;object-fit:cover;">`
                : `<span>${item.emoji}</span>`}
              ${item.favorite ? '<i class="ti ti-heart-filled" style="position:absolute;top:6px;right:6px;font-size:12px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));z-index:2;"></i>' : ''}
              <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:white;font-size:9px;padding:8px 4px 4px;border-radius:0 0 12px 12px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;z-index:2;">${item.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function viewItemDetail() {
    const item = state.closet.find(c => c.id === state.detailItem);
    if (!item) return viewCloset();
    return `
      <div class="anim-slide-up" style="padding-top:12px;">
        <button onclick="window.__app.closeDetail()" style="background:transparent;border:none;padding:6px 0;cursor:pointer;font-size:14px;color:var(--text-primary);display:flex;align-items:center;gap:4px;margin-bottom:12px;font-family:inherit;">
          <i class="ti ti-chevron-left"></i> Clóset
        </button>
        <div style="aspect-ratio:1;background:${item.photoDataUrl ? '#fff' : item.color};border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:100px;margin-bottom:16px;overflow:hidden;">
          ${item.photoDataUrl
            ? `<img src="${item.photoDataUrl}" style="width:100%;height:100%;object-fit:cover;">`
            : item.emoji}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div><h2 style="font-size:22px;font-weight:600;margin:0 0 4px;">${item.name}</h2>
            <p style="font-size:13px;color:var(--text-secondary);margin:0;text-transform:capitalize;">${item.category}</p>
          </div>
          <button onclick="window.__app.toggleItemFav('${item.id}')" style="background:transparent;border:none;cursor:pointer;padding:4px;">
            <i class="ti ${item.favorite ? 'ti-heart-filled' : 'ti-heart'}" style="font-size:26px;color:${item.favorite ? '#e91e63' : 'var(--text-secondary)'};"></i>
          </button>
        </div>
        <div style="background:var(--bg-secondary);border-radius:16px;padding:16px;margin-bottom:12px;">
          ${[['Color',`<div style="display:flex;align-items:center;gap:8px;"><div style="width:20px;height:20px;border-radius:50%;background:${item.color};border:0.5px solid var(--border);"></div>${item.colorName}</div>`],['Estilo',item.style],['Formalidad','★'.repeat(item.formality)+'☆'.repeat(5-item.formality)],['Temporadas',item.season.join(', ')]].map(([k,v],i,arr) => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;${i < arr.length-1 ? 'border-bottom:0.5px solid var(--border);' : ''}">
              <span style="font-size:13px;color:var(--text-secondary);">${k}</span>
              <span style="font-size:13px;text-transform:capitalize;">${v}</span>
            </div>
          `).join('')}
        </div>
        <button onclick="window.__app.deleteItem('${item.id}')" style="width:100%;background:transparent;color:#d63031;border:0.5px solid #d6303133;padding:13px;border-radius:12px;font-size:13px;cursor:pointer;font-family:inherit;">
          <i class="ti ti-trash"></i> Eliminar prenda
        </button>
      </div>
    `;
  }

  function viewAdd() {
    if (state.addStep === 'analyzing') {
      return `
        <div class="anim-fade-in" style="padding-top:40px;text-align:center;">
          <div style="display:inline-flex;padding:24px;background:var(--bg-secondary);border-radius:50%;margin-bottom:20px;">
            <i class="ti ti-loader" style="font-size:40px;animation:spin 1.2s linear infinite;"></i>
          </div>
          <h2 style="font-size:20px;font-weight:600;margin:0 0 8px;">Analizando tu prenda</h2>
          <p style="font-size:13px;color:var(--text-secondary);margin:0 0 24px;">La IA está reconociendo colores, estilo y tags...</p>
        </div>
      `;
    }

    if (state.addStep === 'preview' && state.addImage) {
      return `
        <div class="anim-slide-up" style="padding-top:12px;">
          <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;">¿Se ve bien?</h1>
          <div style="aspect-ratio:1;background:#000;border-radius:20px;overflow:hidden;margin-bottom:16px;">
            <img src="${state.addImage}" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <button onclick="window.__app.analyzeFromPhoto()" style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:15px;border-radius:14px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px;font-family:inherit;">
            <i class="ti ti-sparkles"></i> Analizar con IA
          </button>
          <button onclick="window.__app.retakePhoto()" style="width:100%;background:transparent;color:var(--text-secondary);border:0.5px solid var(--border);padding:15px;border-radius:14px;font-size:14px;cursor:pointer;font-family:inherit;">
            Volver a sacar
          </button>
        </div>
      `;
    }

    if (state.addStep === 'review' && state.lastAnalyzed) {
      const a = state.lastAnalyzed;
      const photo = state.addImage;
      return `
        <div class="anim-slide-up" style="padding-top:12px;">
          <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;">Revisa tu prenda</h1>
          <div style="aspect-ratio:1;background:${photo ? '#000' : a.color};border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:100px;margin-bottom:16px;overflow:hidden;">
            ${photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;">` : a.emoji}
          </div>
          <div style="background:var(--bg-secondary);border-radius:16px;padding:16px;margin-bottom:16px;">
            <p style="font-size:10px;color:var(--text-tertiary);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.8px;">Detectado por IA</p>
            <p style="font-size:18px;font-weight:600;margin:0 0 12px;">${a.name}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;margin-bottom:12px;">
              <div><span style="color:var(--text-secondary);font-size:11px;">Color</span><br><span style="display:inline-flex;align-items:center;gap:6px;margin-top:2px;"><span style="width:14px;height:14px;border-radius:50%;background:${a.color};display:inline-block;border:0.5px solid var(--border);"></span>${a.colorName}</span></div>
              <div><span style="color:var(--text-secondary);font-size:11px;">Estilo</span><br><span style="text-transform:capitalize;">${a.style}</span></div>
              <div><span style="color:var(--text-secondary);font-size:11px;">Categoría</span><br><span style="text-transform:capitalize;">${a.category}</span></div>
              <div><span style="color:var(--text-secondary);font-size:11px;">Formalidad</span><br>${'★'.repeat(a.formality)}${'☆'.repeat(5-a.formality)}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;padding-top:8px;border-top:0.5px solid var(--border);">
              ${(a.tags||[]).map(t => `<span style="font-size:11px;background:var(--bg-primary);padding:4px 10px;border-radius:999px;">#${t}</span>`).join('')}
            </div>
          </div>
          <button onclick="window.__app.confirmAdd()" style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:15px;border-radius:14px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px;font-family:inherit;">
            <i class="ti ti-check"></i> Agregar al clóset
          </button>
          <button onclick="window.__app.cancelAdd()" style="width:100%;background:transparent;color:var(--text-secondary);border:0.5px solid var(--border);padding:15px;border-radius:14px;font-size:14px;cursor:pointer;font-family:inherit;">Cancelar</button>
        </div>
      `;
    }

    return `
      <div class="anim-fade-in" style="padding-top:16px;">
        <h1 style="font-size:22px;font-weight:600;margin:0 0 4px;">Agregar prenda</h1>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 20px;">Saca una foto y la IA la clasificará</p>

        <input type="file" id="clothing-photo-input" accept="image/*" capture="environment" style="display:none;" onchange="window.__app.handleClothingPhoto(this)">
        <input type="file" id="clothing-gallery-input" accept="image/*" style="display:none;" onchange="window.__app.handleClothingPhoto(this)">

        <button onclick="document.getElementById('clothing-photo-input').click()" style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:20px;border-radius:16px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;font-family:inherit;">
          <i class="ti ti-camera" style="font-size:18px;"></i> Sacar foto con cámara
        </button>

        <button onclick="document.getElementById('clothing-gallery-input').click()" style="width:100%;background:var(--bg-secondary);color:var(--text-primary);border:none;padding:18px;border-radius:16px;font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;font-family:inherit;">
          <i class="ti ti-photo" style="font-size:18px;"></i> Elegir de la galería
        </button>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <div style="flex:1;height:0.5px;background:var(--border);"></div>
          <span style="font-size:11px;color:var(--text-tertiary);">o describe con texto</span>
          <div style="flex:1;height:0.5px;background:var(--border);"></div>
        </div>

        <textarea id="cd" placeholder="Ej: polera de algodón color oliva con manga corta" style="width:100%;min-height:80px;padding:12px;border:0.5px solid var(--border-strong);border-radius:12px;font-size:14px;resize:vertical;box-sizing:border-box;margin-bottom:10px;background:var(--bg-primary);color:var(--text-primary);"></textarea>

        <button onclick="window.__app.analyzeFromDescription()" style="width:100%;background:transparent;color:var(--text-primary);border:0.5px solid var(--border-strong);padding:14px;border-radius:12px;font-size:13px;cursor:pointer;font-family:inherit;">
          <i class="ti ti-sparkles"></i> Analizar descripción
        </button>

        <p style="font-size:10px;color:var(--text-tertiary);text-align:center;margin:14px 0 0;">Powered by Claude Sonnet 4</p>
      </div>
    `;
  }

  function viewFeed() {
    return `
      <div class="anim-fade-in" style="padding-top:16px;">
        <h1 style="font-size:26px;font-weight:600;margin:0 0 3px;">Outfits</h1>
        <p style="font-size:13px;color:var(--text-secondary);margin:0 0 16px;">${state.outfits.length} guardados</p>
        ${state.outfits.length === 0 ? `
          <div style="text-align:center;padding:60px 20px;color:var(--text-tertiary);">
            <i class="ti ti-sparkles" style="font-size:50px;margin-bottom:16px;"></i>
            <p style="font-size:14px;margin-bottom:16px;">Aún no has generado outfits</p>
            <button onclick="window.__app.setTab('today')" style="background:var(--accent);color:var(--bg-primary);border:none;padding:11px 22px;border-radius:999px;font-size:13px;cursor:pointer;font-family:inherit;">Ir a Hoy</button>
          </div>
        ` : state.outfits.map(o => outfitCard(o)).join('')}
      </div>
    `;
  }

  function viewProfile() {
    const p = state.profile;
    return `
      <div class="anim-fade-in" style="padding-top:20px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:96px;height:96px;border-radius:50%;background:${p.photoDataUrl ? '#000' : 'linear-gradient(135deg,#a07c4f,#722f37)'};display:inline-flex;align-items:center;justify-content:center;font-size:38px;font-weight:600;color:white;margin-bottom:12px;overflow:hidden;">
            ${p.photoDataUrl ? `<img src="${p.photoDataUrl}" style="width:100%;height:100%;object-fit:cover;">` : p.name[0]}
          </div>
          <h1 style="font-size:22px;font-weight:600;margin:0 0 4px;">${p.name}</h1>
          <p style="font-size:13px;color:var(--text-secondary);margin:0;"><i class="ti ti-map-pin"></i> ${p.location}</p>
        </div>

        ${!p.analyzed && state.colorStep === 'idle' ? `
          <div style="background:linear-gradient(135deg,#a07c4f15,#722f3715);border:0.5px solid #a07c4f44;border-radius:18px;padding:18px;margin-bottom:12px;">
            <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;">
              <i class="ti ti-sparkles" style="font-size:24px;color:#a07c4f;margin-top:2px;"></i>
              <div>
                <p style="font-size:15px;font-weight:600;margin:0 0 4px;">Análisis IA de colorimetría</p>
                <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5;">Sube una foto tuya y la IA determinará tu colorimetría, subtono de piel, contextura y los colores que mejor te favorecen.</p>
              </div>
            </div>
            <input type="file" id="user-photo-input" accept="image/*" capture="user" style="display:none;" onchange="window.__app.handleUserPhoto(this)">
            <input type="file" id="user-gallery-input" accept="image/*" style="display:none;" onchange="window.__app.handleUserPhoto(this)">
            <button onclick="document.getElementById('user-photo-input').click()" style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:13px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:6px;font-family:inherit;">
              <i class="ti ti-camera"></i> Sacar selfie
            </button>
            <button onclick="document.getElementById('user-gallery-input').click()" style="width:100%;background:transparent;color:var(--text-primary);border:0.5px solid var(--border-strong);padding:13px;border-radius:12px;font-size:13px;cursor:pointer;font-family:inherit;">
              <i class="ti ti-photo"></i> Elegir de galería
            </button>
          </div>
        ` : ''}

        ${state.colorStep === 'preview' && state.colorImage ? `
          <div class="anim-slide-up" style="background:var(--bg-secondary);border-radius:18px;padding:16px;margin-bottom:12px;">
            <p style="font-size:13px;font-weight:600;margin:0 0 10px;">Foto lista para analizar</p>
            <div style="aspect-ratio:1;background:#000;border-radius:14px;overflow:hidden;margin-bottom:10px;max-height:280px;">
              <img src="${state.colorImage}" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <button onclick="window.__app.analyzeUser()" style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:13px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:6px;font-family:inherit;">
              <i class="ti ti-sparkles"></i> Analizar con IA
            </button>
            <button onclick="window.__app.cancelColorAnalysis()" style="width:100%;background:transparent;color:var(--text-secondary);border:0.5px solid var(--border);padding:11px;border-radius:12px;font-size:12px;cursor:pointer;font-family:inherit;">
              Cancelar
            </button>
          </div>
        ` : ''}

        ${state.colorStep === 'analyzing' ? `
          <div class="anim-fade-in" style="background:var(--bg-secondary);border-radius:18px;padding:24px;margin-bottom:12px;text-align:center;">
            <i class="ti ti-loader" style="font-size:32px;animation:spin 1s linear infinite;color:var(--text-primary);"></i>
            <p style="font-size:13px;color:var(--text-secondary);margin:12px 0 0;">Analizando tu colorimetría...</p>
          </div>
        ` : ''}

        ${state.colorError ? `
          <div style="background:#ff444411;border:0.5px solid #ff444444;border-radius:12px;padding:12px;margin-bottom:12px;">
            <p style="font-size:12px;color:#d63031;margin:0;">${state.colorError}</p>
          </div>
        ` : ''}

        ${p.analyzed ? `
          <div style="background:var(--bg-secondary);border-radius:18px;padding:16px;margin-bottom:12px;">
            <p style="font-size:10px;color:var(--text-tertiary);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.8px;"><i class="ti ti-palette"></i> Colorimetría</p>
            <p style="font-size:18px;font-weight:600;margin:0 0 12px;">${p.colorimetry}</p>
            <p style="font-size:11px;color:var(--text-secondary);margin:0 0 8px;">Colores recomendados:</p>
            <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
              ${p.recommendedColors.map(c => `<div style="width:36px;height:36px;border-radius:50%;background:${c};border:0.5px solid var(--border);"></div>`).join('')}
            </div>
            ${p.avoidedColors && p.avoidedColors.length > 0 ? `
              <p style="font-size:11px;color:var(--text-secondary);margin:8px 0 6px;">Mejor evitar:</p>
              <div style="display:flex;gap:8px;margin-bottom:10px;">
                ${p.avoidedColors.map(c => `<div style="width:28px;height:28px;border-radius:50%;background:${c};border:0.5px solid var(--border);opacity:0.7;"></div>`).join('')}
              </div>
            ` : ''}
            <p style="font-size:12px;color:var(--text-secondary);margin:0;padding-top:8px;border-top:0.5px solid var(--border);">Subtono: <span style="color:var(--text-primary);font-weight:500;">${p.skinUndertone}</span></p>
          </div>
          <div style="background:var(--bg-secondary);border-radius:18px;padding:16px;margin-bottom:12px;">
            <p style="font-size:10px;color:var(--text-tertiary);margin:0 0 4px;text-transform:uppercase;letter-spacing:0.8px;"><i class="ti ti-body-scan"></i> Contextura</p>
            <p style="font-size:18px;font-weight:600;margin:0 0 8px;">${p.bodyType}</p>
            ${p.styleNotes ? `<p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5;">${p.styleNotes}</p>` : ''}
          </div>
          <input type="file" id="user-photo-input" accept="image/*" capture="user" style="display:none;" onchange="window.__app.handleUserPhoto(this)">
          <input type="file" id="user-gallery-input" accept="image/*" style="display:none;" onchange="window.__app.handleUserPhoto(this)">
          <button onclick="document.getElementById('user-gallery-input').click()" style="width:100%;background:transparent;color:var(--text-secondary);border:0.5px solid var(--border);padding:11px;border-radius:12px;font-size:12px;cursor:pointer;margin-bottom:12px;font-family:inherit;">
            <i class="ti ti-refresh"></i> Reanalizar con nueva foto
          </button>
        ` : ''}

        <button onclick="window.__app.editProfile()" style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:14px;border-radius:14px;font-size:13px;cursor:pointer;margin-bottom:8px;font-family:inherit;font-weight:500;">
          <i class="ti ti-edit"></i> Editar mi perfil
        </button>
        <button onclick="window.__app.reset()" style="width:100%;background:transparent;color:#d63031;border:0.5px solid var(--border);padding:13px;border-radius:12px;font-size:13px;cursor:pointer;font-family:inherit;">
          Reiniciar datos
        </button>
        <p style="font-size:10px;color:var(--text-tertiary);text-align:center;margin:18px 0 0;">Closet AI v0.4</p>
      </div>
    `;
  }

  function viewEditProfile() {
    const p = state.profile;
    return `
      <div class="anim-slide-up" style="padding-top:12px;">
        <button onclick="window.__app.setTab('profile')" style="background:transparent;border:none;padding:6px 0;cursor:pointer;font-size:14px;color:var(--text-primary);display:flex;align-items:center;gap:4px;margin-bottom:12px;font-family:inherit;">
          <i class="ti ti-chevron-left"></i> Atrás
        </button>
        <h1 style="font-size:22px;font-weight:600;margin:0 0 20px;">Editar perfil</h1>
        ${[['name','Nombre',p.name],['location','Ciudad',p.location]].map(([k,l,v]) => `
          <div style="margin-bottom:14px;">
            <label style="font-size:12px;color:var(--text-secondary);display:block;margin-bottom:6px;">${l}</label>
            <input id="ef-${k}" value="${v}" style="width:100%;padding:12px;border:0.5px solid var(--border-strong);border-radius:12px;font-size:14px;background:var(--bg-primary);color:var(--text-primary);box-sizing:border-box;">
          </div>
        `).join('')}
        <p style="font-size:11px;color:var(--text-tertiary);margin:14px 0 6px;">Colorimetría, contextura y subtono se determinan con IA al subir tu foto.</p>
        <button onclick="window.__app.saveProfile()" style="width:100%;background:var(--accent);color:var(--bg-primary);border:none;padding:15px;border-radius:14px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:12px;">
          Guardar cambios
        </button>
      </div>
    `;
  }

  function render() {
    const content = document.getElementById('tab-content');
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === state.currentTab);
    });
    let html = '';
    if (state.currentTab === 'today') html = viewToday();
    else if (state.currentTab === 'closet') html = state.detailItem ? viewItemDetail() : viewCloset();
    else if (state.currentTab === 'add') html = viewAdd();
    else if (state.currentTab === 'feed') html = viewFeed();
    else if (state.currentTab === 'profile') html = viewProfile();
    else if (state.currentTab === 'editProfile') html = viewEditProfile();
    content.innerHTML = html;
    window.scrollTo(0, 0);
  }

  window.__app = {
    setTab(t) {
      haptic();
      state.currentTab = t;
      state.detailItem = null;
      if (t === 'add') {
        state.addStep = 'capture';
        state.addImage = null;
        state.lastAnalyzed = null;
      }
      if (t === 'profile') {
        state.colorStep = 'idle';
        state.colorImage = null;
        state.colorError = null;
      }
      render();
    },
    setOccasion(o) { haptic(); state.occasion = o; render(); },
    generate() { generateOutfits(state.occasion); },
    toggleFav(id) { haptic(); const o = state.outfits.find(x => x.id === id); if (o) { o.favorite = !o.favorite; save(); render(); } },
    markWorn(id) { haptic(); const o = state.outfits.find(x => x.id === id); if (o) { o.worn = !o.worn; save(); toast(o.worn ? '✓ Usado' : 'Desmarcado'); render(); } },
    async shareOutfit(id) {
      const o = state.outfits.find(x => x.id === id);
      if (!o) return;
      const text = `${o.title}\n\n${o.explanation}\n\n${o.items.map(i => '• ' + i.name).join('\n')}\n\n— Closet AI`;
      if (navigator.share) { try { await navigator.share({ title: o.title, text }); } catch(e) {} }
      else { navigator.clipboard.writeText(text); toast('Copiado'); }
    },
    filterCat(c) { haptic(); state.filterCat = c; render(); },
    showDetail(id) { haptic(); state.detailItem = id; render(); },
    closeDetail() { haptic(); state.detailItem = null; render(); },
    toggleItemFav(id) { haptic(); const i = state.closet.find(x => x.id === id); if (i) { i.favorite = !i.favorite; save(); render(); } },
    deleteItem(id) {
      if (confirm('¿Eliminar esta prenda?')) {
        state.closet = state.closet.filter(c => c.id !== id);
        state.detailItem = null;
        save();
        toast('Eliminada');
        render();
      }
    },

    async handleClothingPhoto(input) {
      const file = input.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file, 1024, 0.78);
        state.addImage = dataUrl;
        state.addStep = 'preview';
        render();
      } catch(e) {
        toast('Error al cargar la foto');
      }
      input.value = '';
    },
    retakePhoto() {
      state.addImage = null;
      state.addStep = 'capture';
      render();
    },
    async analyzeFromPhoto() {
      state.addStep = 'analyzing';
      render();
      const result = await analyzeClothingFromPhoto(state.addImage);
      if (result) {
        state.lastAnalyzed = result;
        state.addStep = 'review';
      } else {
        toast('Error al analizar');
        state.addStep = 'preview';
      }
      render();
    },
    async analyzeFromDescription() {
      const desc = document.getElementById('cd').value.trim();
      if (!desc) { toast('Escribe una descripción'); return; }
      state.addStep = 'analyzing';
      state.addImage = null;
      render();
      const result = await analyzeClothingFromDescription(desc);
      if (result) {
        state.lastAnalyzed = result;
        state.addStep = 'review';
      } else {
        toast('Error');
        state.addStep = 'capture';
      }
      render();
    },
    confirmAdd() {
      haptic();
      const item = Object.assign({}, state.lastAnalyzed, {
        id: 'u' + Date.now(),
        favorite: false,
        photoDataUrl: state.addImage
      });
      state.closet.unshift(item);
      state.lastAnalyzed = null;
      state.addImage = null;
      state.addStep = 'capture';
      state.currentTab = 'closet';
      save();
      toast('✓ Agregada al clóset');
      render();
    },
    cancelAdd() {
      state.lastAnalyzed = null;
      state.addImage = null;
      state.addStep = 'capture';
      state.currentTab = 'today';
      render();
    },

    async handleUserPhoto(input) {
      const file = input.files[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file, 768, 0.75);
        state.colorImage = dataUrl;
        state.colorStep = 'preview';
        state.colorError = null;
        render();
      } catch(e) {
        toast('Error al cargar la foto');
      }
      input.value = '';
    },
    cancelColorAnalysis() {
      state.colorImage = null;
      state.colorStep = 'idle';
      state.colorError = null;
      render();
    },
    async analyzeUser() {
      state.colorStep = 'analyzing';
      state.colorError = null;
      render();
      const result = await analyzeUserFromPhoto(state.colorImage);
      if (result) {
        state.profile.colorimetry = result.colorimetry || state.profile.colorimetry;
        state.profile.skinUndertone = result.skinUndertone || state.profile.skinUndertone;
        state.profile.bodyType = result.bodyType || state.profile.bodyType;
        state.profile.recommendedColors = result.recommendedColors || state.profile.recommendedColors;
        state.profile.avoidedColors = result.avoidedColors || [];
        state.profile.styleNotes = result.styleNotes || '';
        state.profile.photoDataUrl = state.colorImage;
        state.profile.analyzed = true;
        state.colorImage = null;
        state.colorStep = 'idle';
        save();
        toast('✨ Análisis completado');
      } else {
        state.colorError = 'No se pudo analizar la foto. Prueba con otra más clara.';
        state.colorStep = 'preview';
      }
      render();
    },

    editProfile() { haptic(); state.currentTab = 'editProfile'; render(); },
    saveProfile() {
      ['name','location'].forEach(k => {
        const el = document.getElementById('ef-'+k);
        if (el && el.value.trim()) state.profile[k] = el.value.trim();
      });
      save(); toast('Guardado'); state.currentTab = 'profile'; render();
    },
    reset() {
      if (confirm('¿Reiniciar todo?')) {
        localStorage.removeItem(STORAGE_KEY);
        state.closet = [...SEED];
        state.profile = Object.assign({}, DEFAULT_PROFILE);
        state.outfits = [];
        state.detailItem = null;
        state.currentTab = 'profile';
        toast('Reiniciado');
        render();
      }
    }
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => window.__app.setTab(btn.dataset.tab));
  });

  loadWeather();
  render();
})();
