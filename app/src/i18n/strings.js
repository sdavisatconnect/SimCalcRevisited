/**
 * Internationalization (i18n) for the elementary edition.
 * Provides t(key) function to look up translated strings.
 */

const STORAGE_KEY = 'simcalc-lang';

let _currentLang = null;

function _detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && STRINGS[stored]) return stored;
  if ((navigator.language || '').startsWith('es')) return 'es';
  return 'en';
}

export function getLanguage() {
  if (!_currentLang) _currentLang = _detectLang();
  return _currentLang;
}

export function setLanguage(lang) {
  _currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

export function t(key) {
  const lang = getLanguage();
  const dict = STRINGS[lang] || STRINGS.en;
  return dict[key] !== undefined ? dict[key] : (STRINGS.en[key] || key);
}

export const STRINGS = {
  en: {
    // World selector
    pickWorld: 'Pick Your World!',
    pickWorldSub: 'Where should your animal play?',
    frolicWorld: 'Frolic World',
    frolicDesc: 'Run through fields and meadows!',
    seaWorld: 'Sea World',
    seaDesc: 'Swim up and dive deep!',
    pickAnimal: 'Pick Your Animal!',
    pickColor: 'Pick Your Color!',
    letsGo: "Let's Go!",
    back: '← Back',
    joinChallenge: '🔗 Join a Challenge',
    broadcastChallenge: '📡 Broadcast a Challenge',
    mySessions: '📋 My Sessions',

    // Animal names
    puppy: 'Puppy',
    kitten: 'Kitten',
    bunny: 'Bunny',
    duck: 'Duck',
    penguin: 'Penguin',
    elephant: 'Elephant',
    horse: 'Horse',
    cow: 'Cow',
    frog: 'Frog',
    bear: 'Bear',

    // Sidebar
    velocitySection: 'Velocity',
    velocityBlock: 'Velocity Block',
    hearVelocity: 'Hear "velocity"',
    velocityWord: 'velocity',
    toolsSection: 'Tools',
    selectTool: '👆 Select',
    eraserTool: '🧹 Eraser',
    clearAll: '✕ Clear All',
    tipsSection: 'Tips',
    tip1: '🧱 Drag velocity blocks onto the graph!',
    tip2: '📈 Stack higher to go faster!',
    tip3: '⬇️ Blocks below the line go backward!',
    tip4: '▶️ Press Play to watch!',

    // Panel titles
    panelFrolicWorld: 'Frolic World',
    panelSeaWorld: 'Sea World',
    positionVsTime: 'Position vs Time',
    velocityVsTime: 'Velocity vs Time',

    // Graph axis labels
    positionAxis: 'Position',
    velocityAxis: 'Velocity',
    timeAxis: 'Time',

    // Palette
    addAnAnimal: 'Add an Animal',
    addBtn: 'Add',
    addAnother: 'Add another animal',

    // Buttons
    howTo: 'How To',
    about: 'About',

    // Controls bar
    time: 'Time:',
    speed: 'Speed:',
    reset: 'Reset',
    stepBack: 'Step Back',
    playPause: 'Play / Pause',
    stepForward: 'Step Forward',
    save: 'Save',
    open: 'Open',
    newBtn: 'New',

    // How To modal
    howToTitle: 'How To Play',
    howToVelocityTitle: '📚 What is Velocity?',
    howToVelocityBody: '<strong>Velocity</strong> means how fast something is going and which direction! Positive velocity = forward. Negative velocity = backward. You can click 🔊 in the sidebar to hear the word!',
    howToWorldTitle: '🌍 1. Pick Your World',
    howToWorldBody: 'Choose <strong>Frolic World</strong> to run through fields, or <strong>Sea World</strong> to swim up and dive deep!',
    howToAnimalTitle: '🐾 2. Pick Your Animal',
    howToAnimalBody: 'Choose your favorite baby animal and pick a color. Your animal will move based on the blocks you place!',
    howToBlocksTitle: '🧱 3. Drag Blocks',
    howToBlocksBody: 'Drag the <strong>block tool</strong> from the sidebar onto the <strong>Speed graph</strong>. Blocks stack up from zero &mdash; the higher you stack, the faster your animal goes!',
    howToBackwardTitle: '⬇️ 4. Go Backward!',
    howToBackwardBody: 'Drop blocks <strong>below the line</strong> to make your animal go backward (or dive underwater in Sea World!).',
    howToPlayTitle: '▶️ 5. Press Play',
    howToPlayBody: 'Hit the <strong>Play</strong> button at the bottom to watch your animal move. Use <strong>Reset</strong> to start over, or <strong>Step</strong> to go one moment at a time.',
    howToFixTitle: '🧹 6. Fix Mistakes',
    howToFixBody: 'Click on a block to remove it. Use the <strong>Eraser</strong> tool to remove blocks, or <strong>Clear All</strong> to start fresh.',

    // About modal
    aboutTitle: 'SimCalc Animal World',
    aboutKaput: '<strong>SimCalc MathWorlds</strong> was created by <strong>James J. Kaput</strong>, a mathematics education professor at the University of Massachusetts Dartmouth. Beginning in the late 1980s, Jim envisioned <em>"democratizing access to the mathematics of change"</em> &mdash; making calculus concepts like rate, accumulation, and the relationship between position, velocity, and acceleration accessible to all students, not just those in advanced courses.',
    aboutHistory: 'SimCalc linked animated worlds to editable graphs, letting students build intuition by dragging velocity segments and watching characters move. Across large-scale studies in Texas, SimCalc demonstrated significant gains in student learning of advanced mathematical concepts.',
    aboutLegacy: 'Jim passed away in 2005, but his vision lives on through the <strong>Kaput Center for Research and Innovation in STEM Education</strong> at UMass Dartmouth and in the continuing influence of his ideas.',
    aboutElementary: '<strong>SimCalc Animal World</strong> is the elementary edition, designed for K-5 students exploring speed, distance, and direction with baby animal characters and unifix-cube blocks.',
    aboutCredit: 'This website has been created by <strong>Sarah M. Davis</strong> who wishes she had been able to learn from him longer.',
    aboutDisclaimer: 'SimCalc Revisited is an independent project and is not affiliated with or endorsed by the University of Massachusetts Dartmouth.',

    // Drag hint
    dragHint: 'Drag blocks here to set velocity',
    blockConflict: 'Blocks cancel out! Remove one direction.',
  },

  es: {
    // World selector
    pickWorld: '¡Elige Tu Mundo!',
    pickWorldSub: '¿Dónde debe jugar tu animal?',
    frolicWorld: 'Mundo Pradera',
    frolicDesc: '¡Corre por campos y praderas!',
    seaWorld: 'Mundo Marino',
    seaDesc: '¡Nada hacia arriba y sumérgete!',
    pickAnimal: '¡Elige Tu Animal!',
    pickColor: '¡Elige Tu Color!',
    letsGo: '¡Vamos!',
    back: '← Atrás',
    joinChallenge: '🔗 Unirse a un Desafío',
    broadcastChallenge: '📡 Transmitir un Desafío',
    mySessions: '📋 Mis Sesiones',

    // Animal names
    puppy: 'Perrito',
    kitten: 'Gatito',
    bunny: 'Conejito',
    duck: 'Patito',
    penguin: 'Pingüino',
    elephant: 'Elefante',
    horse: 'Caballo',
    cow: 'Vaca',
    frog: 'Rana',
    bear: 'Oso',

    // Sidebar
    velocitySection: 'Velocidad',
    velocityBlock: 'Bloque de Velocidad',
    hearVelocity: 'Escucha "velocidad"',
    velocityWord: 'velocidad',
    toolsSection: 'Herramientas',
    selectTool: '👆 Seleccionar',
    eraserTool: '🧹 Borrador',
    clearAll: '✕ Borrar Todo',
    tipsSection: 'Consejos',
    tip1: '🧱 ¡Arrastra bloques de velocidad al gráfico!',
    tip2: '📈 ¡Apila más alto para ir más rápido!',
    tip3: '⬇️ ¡Los bloques debajo de la línea van hacia atrás!',
    tip4: '▶️ ¡Presiona Reproducir para ver!',

    // Panel titles
    panelFrolicWorld: 'Mundo Pradera',
    panelSeaWorld: 'Mundo Marino',
    positionVsTime: 'Posición vs Tiempo',
    velocityVsTime: 'Velocidad vs Tiempo',

    // Graph axis labels
    positionAxis: 'Posición',
    velocityAxis: 'Velocidad',
    timeAxis: 'Tiempo',

    // Palette
    addAnAnimal: 'Agregar un Animal',
    addBtn: 'Agregar',
    addAnother: 'Agregar otro animal',

    // Buttons
    howTo: 'Cómo Jugar',
    about: 'Acerca de',

    // Controls bar
    time: 'Tiempo:',
    speed: 'Velocidad:',
    reset: 'Reiniciar',
    stepBack: 'Paso Atrás',
    playPause: 'Reproducir / Pausa',
    stepForward: 'Paso Adelante',
    save: 'Guardar',
    open: 'Abrir',
    newBtn: 'Nuevo',

    // How To modal
    howToTitle: 'Cómo Jugar',
    howToVelocityTitle: '📚 ¿Qué es la Velocidad?',
    howToVelocityBody: '<strong>Velocidad</strong> significa qué tan rápido va algo ¡y en qué dirección! Velocidad positiva = adelante. Velocidad negativa = atrás. ¡Haz clic en 🔊 en la barra lateral para escuchar la palabra!',
    howToWorldTitle: '🌍 1. Elige Tu Mundo',
    howToWorldBody: '¡Elige <strong>Mundo Pradera</strong> para correr por los campos, o <strong>Mundo Marino</strong> para nadar y sumergirte!',
    howToAnimalTitle: '🐾 2. Elige Tu Animal',
    howToAnimalBody: '¡Elige tu animal bebé favorito y escoge un color. ¡Tu animal se moverá según los bloques que coloques!',
    howToBlocksTitle: '🧱 3. Arrastra Bloques',
    howToBlocksBody: 'Arrastra la <strong>herramienta de bloques</strong> desde la barra lateral al <strong>gráfico de Velocidad</strong>. Los bloques se apilan desde cero &mdash; ¡cuanto más alto apiles, más rápido irá tu animal!',
    howToBackwardTitle: '⬇️ 4. ¡Ve Hacia Atrás!',
    howToBackwardBody: 'Coloca bloques <strong>debajo de la línea</strong> para que tu animal vaya hacia atrás (¡o se sumerja en el Mundo Marino!).',
    howToPlayTitle: '▶️ 5. Presiona Reproducir',
    howToPlayBody: 'Presiona el botón de <strong>Reproducir</strong> en la parte inferior para ver a tu animal moverse. Usa <strong>Reiniciar</strong> para empezar de nuevo, o <strong>Paso</strong> para avanzar un momento a la vez.',
    howToFixTitle: '🧹 6. Corrige Errores',
    howToFixBody: 'Haz clic en un bloque para eliminarlo. Usa la herramienta <strong>Borrador</strong> para quitar bloques, o <strong>Borrar Todo</strong> para empezar de nuevo.',

    // About modal
    aboutTitle: 'SimCalc Mundo Animal',
    aboutKaput: '<strong>SimCalc MathWorlds</strong> fue creado por <strong>James J. Kaput</strong>, profesor de educación matemática en la Universidad de Massachusetts Dartmouth. A partir de finales de los años 1980, Jim imaginó <em>"democratizar el acceso a las matemáticas del cambio"</em> &mdash; haciendo que conceptos de cálculo como tasa, acumulación y la relación entre posición, velocidad y aceleración fueran accesibles para todos los estudiantes.',
    aboutHistory: 'SimCalc vinculó mundos animados con gráficos editables, permitiendo a los estudiantes construir intuición arrastrando segmentos de velocidad y observando cómo se mueven los personajes. En estudios a gran escala en Texas, SimCalc demostró mejoras significativas en el aprendizaje de conceptos matemáticos avanzados.',
    aboutLegacy: 'Jim falleció en 2005, pero su visión perdura a través del <strong>Centro Kaput para la Investigación e Innovación en Educación STEM</strong> en UMass Dartmouth y en la influencia continua de sus ideas.',
    aboutElementary: '<strong>SimCalc Mundo Animal</strong> es la edición para primaria, diseñada para estudiantes de K-5 que exploran velocidad, distancia y dirección con personajes de animales bebés y bloques unifix.',
    aboutCredit: 'Este sitio web ha sido creado por <strong>Sarah M. Davis</strong>, quien desearía haber podido aprender de él por más tiempo.',
    aboutDisclaimer: 'SimCalc Revisited es un proyecto independiente y no está afiliado ni respaldado por la Universidad de Massachusetts Dartmouth.',

    // Drag hint
    dragHint: 'Arrastra bloques aquí para definir velocidad',
    blockConflict: '¡Los bloques se cancelan! Quita una dirección.',
  },
};
