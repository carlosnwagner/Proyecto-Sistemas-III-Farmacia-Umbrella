// Ilustraciones de envases (caja, botella, tubo, spray, botiquín) para productos sin foto.
// Dibujadas a mano en SVG: no usan imágenes de terceros. Si el producto tiene imagen_url, se muestra esa.
const PALETAS = {
  "analgésicos": { base: "#91c837", oscuro: "#5f8f13", claro: "#e6f4c6" },
  "antibióticos": { base: "#2f9e8f", oscuro: "#1f6f65", claro: "#d3f0ea" },
  "perfumería": { base: "#c58bd9", oscuro: "#8a4fa3", claro: "#f0e1f7" },
  "venta libre": { base: "#4fb3d9", oscuro: "#2a7ea3", claro: "#d9f0fa" },
};
const PALETA_BASE = { base: "#91c837", oscuro: "#5f8f13", claro: "#e6f4c6" };
const TINTA = "#0f150b";

function tipoEnvase(nombre = "") {
  const n = nombre.toLocaleLowerCase("es");
  if (/botiqu/.test(n)) return "botiquin";
  if (/desodor|spray|aerosol/.test(n)) return "spray";
  if (/\bgel|crema|pomada|ung[uü]ento|hidratante/.test(n)) return "tubo";
  if (/jab[oó]n|alcohol|listerine|enjuague|soluci[oó]n|l[ií]quido|jarabe|gotas/.test(n)) return "botella";
  return "caja";
}

function partir(nombre = "", max, filas = 3) {
  const lineas = [];
  let actual = "";
  nombre.trim().split(/\s+/).forEach((palabra) => {
    if (actual && `${actual} ${palabra}`.length > max) { lineas.push(actual); actual = palabra; }
    else actual = actual ? `${actual} ${palabra}` : palabra;
  });
  if (actual) lineas.push(actual);
  if (lineas.length > filas) {
    const recorte = lineas.slice(0, filas);
    recorte[filas - 1] = `${recorte[filas - 1].slice(0, Math.max(1, max - 1))}…`;
    return recorte;
  }
  return lineas;
}

function Rotulo({ nombre, max, cx, cy, ancho, base, filas = 3, color = TINTA }) {
  const lineas = partir(nombre, max, filas);
  const largo = Math.max(...lineas.map((l) => l.length), 1);
  const fs = Math.max(9, Math.min(base, ancho / (largo * 0.56)));
  const salto = fs * 1.08;
  const y0 = cy - ((lineas.length - 1) * salto) / 2 + fs * 0.35;
  return (
    <text x={cx} textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight="700" fontSize={fs} fill={color}>
      {lineas.map((linea, i) => <tspan key={i} x={cx} y={y0 + i * salto}>{linea}</tspan>)}
    </text>
  );
}

export default function EnvaseProducto({ nombre, categoria }) {
  const p = PALETAS[(categoria || "").toLocaleLowerCase("es")] || PALETA_BASE;
  const tipo = tipoEnvase(nombre);
  return (
    <svg className="um-envase" viewBox="0 0 200 200" role="img" aria-label={nombre}>
      <path d="M100 18c34 0 66 22 72 58s-8 70-40 88-76 14-98-16S8 70 36 44s38-26 64-26z" fill={p.claro} />
      <ellipse cx="100" cy="176" rx="50" ry="6" fill={TINTA} opacity=".14" />

      {tipo === "caja" && (
        <g>
          <path d="M140 44l14 6v108l-14 6z" fill={p.oscuro} opacity=".35" />
          <rect x="60" y="38" width="80" height="126" rx="5" fill="#fff" stroke={TINTA} strokeOpacity=".12" />
          <rect x="60" y="38" width="80" height="30" rx="5" fill={p.base} />
          <rect x="60" y="56" width="80" height="12" fill={p.base} />
          <image href="/Umbrellafarmacia.svg" x="66" y="44" width="15" height="19" />
          <text x="85" y="56" fontFamily="'Barlow Condensed', sans-serif" fontWeight="700" fontSize="10" fill={TINTA} textLength="48" lengthAdjust="spacingAndGlyphs">UMBRELLA</text>
          <Rotulo nombre={nombre} max={11} cx={100} cy={106} ancho={68} base={17} />
          <path d="M60 148h80v11a5 5 0 0 1-5 5H65a5 5 0 0 1-5-5z" fill={p.oscuro} />
          <path d="M100 152v8M96 156h8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}

      {tipo === "botella" && (
        <g>
          <rect x="88" y="46" width="24" height="26" fill="#fff" />
          <rect x="82" y="28" width="36" height="20" rx="4" fill={TINTA} />
          <rect x="66" y="66" width="68" height="102" rx="18" fill={p.base} />
          <rect x="74" y="78" width="6" height="68" rx="3" fill="#fff" opacity=".4" />
          <rect x="71" y="94" width="58" height="62" rx="6" fill="#fff" />
          <rect x="72" y="96" width="56" height="8" rx="3" fill={p.oscuro} />
          <Rotulo nombre={nombre} max={10} cx={100} cy={130} ancho={50} base={14} filas={4} />
        </g>
      )}

      {tipo === "tubo" && (
        <g>
          <path d="M68 42h64l-4 112H72z" fill={p.base} />
          <rect x="66" y="34" width="68" height="11" rx="2" fill={p.oscuro} />
          <path d="M72 38h56M72 41h56" stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
          <rect x="82" y="152" width="36" height="22" rx="5" fill={TINTA} />
          <rect x="73" y="62" width="54" height="80" rx="6" fill="#fff" />
          <Rotulo nombre={nombre} max={10} cx={100} cy={102} ancho={48} base={14} filas={4} />
          <rect x="74" y="50" width="5" height="96" rx="2.5" fill="#fff" opacity=".28" />
        </g>
      )}

      {tipo === "spray" && (
        <g>
          <rect x="74" y="62" width="52" height="106" rx="10" fill={p.base} />
          <path d="M80 62c0-10 8-18 20-18s20 8 20 18z" fill="#d6dcc9" />
          <rect x="84" y="26" width="32" height="28" rx="6" fill={TINTA} />
          <rect x="108" y="32" width="14" height="6" rx="2" fill="#fff" />
          <rect x="78" y="82" width="44" height="72" rx="6" fill="#fff" />
          <Rotulo nombre={nombre} max={9} cx={100} cy={118} ancho={38} base={13} filas={4} />
          <rect x="80" y="70" width="5" height="90" rx="2.5" fill="#fff" opacity=".28" />
        </g>
      )}

      {tipo === "botiquin" && (
        <g>
          <path d="M82 78V66a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v12" fill="none" stroke={TINTA} strokeWidth="6" strokeLinecap="round" />
          <rect x="42" y="76" width="116" height="90" rx="14" fill="#fff" stroke={TINTA} strokeOpacity=".15" />
          <rect x="42" y="76" width="116" height="22" rx="14" fill={p.base} />
          <rect x="42" y="88" width="116" height="10" fill={p.base} />
          <rect x="93" y="104" width="14" height="32" rx="3" fill={p.base} />
          <rect x="84" y="113" width="32" height="14" rx="3" fill={p.base} />
          <Rotulo nombre={nombre} max={22} cx={100} cy={152} ancho={100} base={15} filas={1} />
        </g>
      )}
    </svg>
  );
}
