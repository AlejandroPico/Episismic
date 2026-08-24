import type { DiagramKind } from '../data/encyclopedia';

const grid = <><path d="M0 30H640M0 60H640M0 90H640M0 120H640M0 150H640M80 0V180M160 0V180M240 0V180M320 0V180M400 0V180M480 0V180M560 0V180" className="diagram-grid" /></>;

export function ScientificDiagram({ kind }: { kind: DiagramKind }) {
  return <figure className="scientific-diagram" aria-label={`Esquema científico: ${kind}`}>
    <svg viewBox="0 0 640 180" role="img">
      {grid}
      {kind === 'earth' && <>
        <circle cx="320" cy="90" r="72" className="diagram-earth-crust" />
        <circle cx="320" cy="90" r="58" className="diagram-earth-mantle" />
        <circle cx="320" cy="90" r="27" className="diagram-earth-outer" />
        <circle cx="320" cy="90" r="12" className="diagram-earth-inner" />
        <path d="M320 90L391 77" className="diagram-cut" /><text x="404" y="76">LITOSFERA</text>
        <path d="M320 90L370 130" className="diagram-cut" /><text x="381" y="142">MANTO</text>
        <path d="M320 90L280 45" className="diagram-cut" /><text x="182" y="39">NÚCLEO</text>
      </>}
      {kind === 'faults' && <>
        <path d="M30 42H186L158 140H8Z" className="diagram-block" /><path d="M190 42H292V140H158Z" className="diagram-block warm" />
        <path d="M80 62v42m0 0-12-14m12 14 12-14M245 105V63m0 0-12 14m12-14 12 14" className="diagram-arrow" /><text x="92" y="165">NORMAL</text>
        <path d="M352 42H472L506 140H384Z" className="diagram-block" /><path d="M472 42H625L638 140H506Z" className="diagram-block warm" />
        <path d="M422 104V63m0 0-12 14m12-14 12 14M560 63v42m0 0-12-14m12 14 12-14" className="diagram-arrow" /><text x="464" y="165">INVERSA</text>
      </>}
      {kind === 'waves' && <>
        <path d="M34 58c26-44 52 44 78 0s52 44 78 0 52 44 78 0 52 44 78 0 52 44 78 0 52 44 78 0 52 44 78 0" className="diagram-wave p" />
        <path d="M34 124c18 0 18-40 36-40s18 80 36 80 18-80 36-80 18 80 36 80 18-80 36-80 18 80 36 80 18-80 36-80 18 80 36 80 18-80 36-80 18 80 36 80 18-80 36-80 18 80 36 80" className="diagram-wave s" />
        <text x="38" y="28">ONDA P · COMPRESIÓN</text><text x="38" y="153">ONDA S · CIZALLA</text>
      </>}
      {kind === 'seismogram' && <>
        <path d="M20 90h60l8-2 5 4 4-9 5 14 6-22 7 30 6-18 6 5 9-3 8 4 6-9 8 21 9-46 10 68 11-82 12 93 10-63 8 31 12-8 10 16 12-40 10 49 11-24 10 7 18-2 8-7 10 10 12-5 12 1h140" className="diagram-seismo" />
        <path d="M88 25v135M182 25v135M410 25v135" className="diagram-marker" />
        <text x="91" y="35">P</text><text x="185" y="35">S</text><text x="413" y="35">SUPERFICIALES</text>
      </>}
      {kind === 'location' && <>
        <path d="M20 68c75-18 128 12 194-2s122-31 202-8 144 8 204-6V170H20Z" className="diagram-ground" />
        <path d="M320 62v66" className="diagram-marker" /><circle cx="320" cy="62" r="8" className="diagram-epicenter" /><circle cx="320" cy="128" r="8" className="diagram-focus" />
        <path d="M320 128l-95-42M320 128l102-58M320 128l125 19" className="diagram-ray" />
        <text x="334" y="57">EPICENTRO</text><text x="334" y="135">HIPOCENTRO</text>
      </>}
      {kind === 'magnitude' && <>
        {[1,2,3,4,5,6,7].map((m, index) => <g key={m}><rect x={42 + index * 82} y={150 - (index + 1) ** 1.65 * 5.3} width="50" height={(index + 1) ** 1.65 * 5.3} className="diagram-mag-bar" /><text x={58 + index * 82} y="169">M{m}</text></g>)}
        <path d="M25 150H620" className="diagram-axis" /><text x="34" y="24">ESCALA LOGARÍTMICA · +1 ≈ ×32 ENERGÍA</text>
      </>}
      {kind === 'intensity' && <>
        {['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'].map((value, index) => <g key={value}><rect x={20 + index * 50} y="58" width="44" height="56" className={`diagram-intensity i${index + 1}`} /><text x={42 + index * 50} y="92" textAnchor="middle">{value}</text></g>)}
        <text x="20" y="38">NO SENTIDO</text><text x="526" y="38">EXTREMO</text><text x="20" y="142">EFECTO LOCAL · NO ES MAGNITUD NI PROFUNDIDAD</text>
      </>}
      {kind === 'station' && <>
        <path d="M80 126V64m-26 62h52M80 64l-20 27h40L80 64Zm0-28v28" className="diagram-station" />
        <path d="M112 51c25 12 25 36 0 49M128 38c42 20 42 57 0 76" className="diagram-signal" />
        <rect x="214" y="52" width="122" height="76" className="diagram-device" /><path d="M231 90h18l8-19 12 39 14-52 13 43 10-11h13" className="diagram-seismo mini" />
        <path d="M146 90H214M336 90h76" className="diagram-flow" /><rect x="412" y="44" width="178" height="92" className="diagram-server" />
        <text x="48" y="155">SENSOR</text><text x="223" y="151">DIGITALIZADOR</text><text x="443" y="83">RED FDSN</text><text x="443" y="103">SEEDLINK</text>
      </>}
      {kind === 'subduction' && <>
        <path d="M10 60H290c92 0 128 24 175 109H10Z" className="diagram-oceanic" /><path d="M300 60H630V169H465c-47-85-83-109-175-109Z" className="diagram-continental" />
        <path d="M40 72h260c70 0 112 20 170 91" className="diagram-subduct" /><path d="M415 58l22-34 24 34" className="diagram-volcano" />
        {[0,1,2,3,4].map((i)=><circle key={i} cx={342+i*35} cy={80+i*16} r={4+i*.5} className="diagram-focus" />)}
        <text x="42" y="42">PLACA OCEÁNICA</text><text x="474" y="42">PLACA SUPERIOR</text><text x="456" y="154">ZONA WADATI–BENIOFF</text>
      </>}
      {kind === 'tsunami' && <>
        <path d="M0 102c70 0 82-4 132-4s72 4 132 4 84-5 132-5 76 5 118 5 72-4 126-4V170H0Z" className="diagram-water" />
        <path d="M0 148h340l42-14 48 18 58-25 72 30h80" className="diagram-seabed" /><path d="M384 133v-45m0 0-10 13m10-13 10 13" className="diagram-arrow" />
        <path d="M420 74c20-15 37 15 57 0s37 15 57 0 37 15 57 0" className="diagram-wave p" /><text x="31" y="32">DESPLAZAMIENTO DEL FONDO</text><text x="438" y="50">TREN DE ONDAS</text>
      </>}
      {kind === 'focal' && <>
        <circle cx="320" cy="90" r="66" className="diagram-beachball" /><path d="M254 90c23-50 109-50 132 0-23 50-109 50-132 0Z" className="diagram-beachball-fill" /><path d="M320 24v132M254 90h132" className="diagram-nodal" />
        <text x="60" y="76">COMPRESIÓN</text><path d="M170 82h74" className="diagram-flow" /><text x="448" y="76">DILATACIÓN</text><path d="M396 82h58" className="diagram-flow" />
      </>}
      {kind === 'catalogue' && <>
        {['USGS','EMSC','GEOFON'].map((name,index)=><g key={name}><rect x="35" y={25+index*50} width="126" height="34" className="diagram-source" /><text x="98" y={47+index*50} textAnchor="middle">{name}</text><path d={`M161 ${42+index*50}H258`} className="diagram-flow" /></g>)}
        <path d="M258 24h136v132H258Z" className="diagram-merge" /><text x="326" y="82" textAnchor="middle">NORMALIZAR</text><text x="326" y="104" textAnchor="middle">Y FUSIONAR</text><path d="M394 90h91" className="diagram-flow" /><rect x="485" y="55" width="125" height="70" className="diagram-server" /><text x="547" y="84" textAnchor="middle">EPISISMIC</text><text x="547" y="104" textAnchor="middle">SQLITE + MAPA</text>
      </>}
      {kind === 'plates' && <>
        <path d="M20 84h170M450 84h170" className="diagram-plate" /><path d="M190 84h260" className="diagram-boundary" /><path d="M165 66l25 18-25 18M475 66l-25 18 25 18" className="diagram-arrow" />
        <path d="M255 32l65 52 65-52M320 84v70" className="diagram-ridge" /><text x="32" y="41">PLACA A</text><text x="532" y="41">PLACA B</text><text x="257" y="169">LÍMITE / ZONA DIFUSA</text>
      </>}
      {kind === 'alert' && <>
        <circle cx="110" cy="90" r="52" className="diagram-alert-ring r1" /><circle cx="110" cy="90" r="30" className="diagram-alert-ring r2" /><circle cx="110" cy="90" r="8" className="diagram-epicenter" />
        <path d="M175 90h88" className="diagram-flow" /><rect x="263" y="48" width="135" height="84" className="diagram-device" /><text x="330" y="80" textAnchor="middle">DETECCIÓN</text><text x="330" y="102" textAnchor="middle">ASOCIACIÓN</text><path d="M398 90h88" className="diagram-flow" /><path d="M548 42l52 94H496Z" className="diagram-warning" /><text x="548" y="106" textAnchor="middle">!</text>
      </>}
    </svg>
    <figcaption>ESQUEMA ORIGINAL EPISISMIC · REPRESENTACIÓN DIDÁCTICA NO A ESCALA</figcaption>
  </figure>;
}
